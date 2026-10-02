import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PermissionEngine, type Action } from '@oax/permissions';
import { OaxError, z } from '@oax/protocol';
import { redact } from '@oax/context';
export type BrowserTool =
  | 'new_page'
  | 'take_snapshot'
  | 'list_console_messages'
  | 'list_network_requests';
export function browserAction(
  scope: Omit<Action, 'capability' | 'resource'>,
  origin: string,
  tool: BrowserTool,
  args: Record<string, unknown>,
): Action {
  return {
    ...scope,
    capability: tool === 'new_page' ? 'browser.navigate' : 'browser.read',
    resource: `${origin}:${tool}:${createHash('sha256').update(JSON.stringify(args)).digest('hex')}`,
  };
}
/** Dedicated optional observer; not attached to provider tools or the user's browser. */
export class BrowserInspector {
  private client: Client | undefined;
  private profile: string | undefined;
  private pages = new Set<number>();
  readonly origin: string;
  constructor(
    private readonly options: {
      serverEntry: string;
      chromeExecutable: string;
      origin: string;
      permissions: PermissionEngine;
      scope: Omit<Action, 'capability' | 'resource'>;
    },
  ) {
    const url = new URL(options.origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.origin !== options.origin
    )
      throw new OaxError(
        'BROWSER_SCOPE',
        'Use an exact HTTP(S) origin without credentials or a path',
      );
    this.origin = url.origin;
  }
  async connect(): Promise<void> {
    // The pinned server rejects Chrome <149 when establishing its allowlist.
    // Do not launch a version probe that could touch the user's default profile.
    this.profile = await mkdtemp(path.join(tmpdir(), 'oax-browser-'));
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        this.options.serverEntry,
        '--headless',
        '--user-data-dir',
        this.profile,
        '--executable-path',
        this.options.chromeExecutable,
        '--no-usage-statistics',
        '--no-performance-crux',
        '--allowed-url-pattern',
        `${this.origin}/*`,
        '--category-input=false',
        '--category-emulation=false',
        '--category-performance=false',
        '--category-memory=false',
        '--category-experimental-third-party=false',
        '--javascript-evaluation=false',
      ],
      cwd: this.profile,
      stderr: 'ignore',
      maxBufferSize: 262144,
      env: {
        CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: '1',
        CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS: '1',
      },
    });
    this.client = new Client({
      name: 'oax-browser-observer',
      version: '0.1.0',
    });
    try {
      await this.client.connect(transport);
      if (this.client.getServerVersion()?.version !== '1.10.1')
        throw new OaxError(
          'BROWSER_VERSION',
          'Unsupported DevTools MCP version',
        );
    } catch (error) {
      await this.close();
      throw error;
    }
  }
  async call(
    tool: BrowserTool,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    if (
      ![
        'new_page',
        'take_snapshot',
        'list_console_messages',
        'list_network_requests',
      ].includes(tool)
    )
      throw new OaxError('BROWSER_POLICY', 'Browser tool is disabled');
    if (!this.client)
      throw new OaxError(
        'BROWSER_STATE',
        'Connect the dedicated browser first',
      );
    if (tool === 'new_page') {
      if (
        Object.keys(args).join(',') !== 'url' ||
        typeof args.url !== 'string' ||
        new URL(args.url).origin !== this.origin ||
        new URL(args.url).username ||
        new URL(args.url).password
      )
        throw new OaxError(
          'BROWSER_SCOPE',
          'Navigation must match the approved origin',
        );
    } else if (
      Object.keys(args).join(',') !== 'pageId' ||
      typeof args.pageId !== 'number' ||
      !this.pages.has(args.pageId)
    )
      throw new OaxError(
        'BROWSER_POLICY',
        'Observer tools require an owned pageId and accept no file paths or evaluation code',
      );
    const result = await this.options.permissions.execute(
      browserAction(this.options.scope, this.origin, tool, args),
      () =>
        this.client!.callTool({ name: tool, arguments: args }, undefined, {
          timeout: 15000,
        }),
    );
    if (result.isError)
      throw new OaxError(
        'BROWSER_TOOL_FAILED',
        `DevTools ${tool} failed: ${redact(JSON.stringify(result.content).slice(0, 512)).text}`,
      );
    let pageId: number | undefined;
    if (tool === 'new_page') {
      const text = z
        .array(
          z.object({ type: z.literal('text'), text: z.string().max(65536) }),
        )
        .parse(result.content)
        .map((block) => block.text)
        .join('\n');
      const selected = text.split('\n').flatMap((line) => {
        const match = line.match(/^(\d+): (.+) \[selected\]$/);
        if (
          !match ||
          (match[2] !== args.url && !match[2]!.endsWith(`(${args.url})`))
        )
          return [];
        return [Number(match[1])];
      });
      if (selected.length !== 1)
        throw new OaxError(
          'BROWSER_SCOPE',
          'Dedicated page identity is unavailable; inspection stays disabled',
        );
      pageId = selected[0]!;
      this.pages.add(selected[0]!);
    }
    const serialized = JSON.stringify({
      ...result,
      ...(pageId === undefined ? {} : { pageId }),
    });
    if (Buffer.byteLength(serialized) > 65536)
      throw new OaxError(
        'BROWSER_LIMIT',
        'Browser evidence exceeded output limit',
      );
    // Conservative token/authorization redaction; arbitrary secrets and screenshots are not supported.
    return JSON.parse(
      serialized
        .replace(
          /(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g,
          '[REDACTED]',
        )
        .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]'),
    ) as unknown;
  }
  async close(): Promise<void> {
    await this.client?.close();
    this.client = undefined;
    if (this.profile) {
      if (
        path.dirname(this.profile) !== tmpdir() ||
        !path.basename(this.profile).startsWith('oax-browser-')
      )
        throw new OaxError('BROWSER_STATE', 'Unexpected browser cleanup path');
      await rm(this.profile, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200,
      });
      this.profile = undefined;
    }
  }
}
