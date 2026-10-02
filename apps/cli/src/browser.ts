import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { BrowserInspector, browserAction } from '@oax/browser';
import { PermissionEngine } from '@oax/permissions';
import { JevPlanner } from '../../../packages/browser/src/jev.js';
import { snapshotPage } from '../../../packages/browser/src/snapshot.js';
import { openAudit } from '../../../packages/runtime/src/audit.js';
async function main(): Promise<void> {
  const [command, url, flag, approvedHash] = process.argv.slice(2);
  if (
    !['inspect', 'inspect-jev'].includes(command ?? '') ||
    !url ||
    (flag !== undefined && flag !== '--approve')
  ) {
    console.log(
      'Usage: node dist/browser.cjs <inspect|inspect-jev> <url> [--approve <preview-hash>]\nPreview first. inspect-jev also projects observed accessibility elements through the installed Python planner locally. No provider transmission or browser input.',
    );
    process.exitCode = command ? 2 : 0;
    return;
  }
  const parsed = new URL(url);
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  )
    throw new Error('Use an HTTP(S) URL without embedded credentials');
  const plan = {
    version: '0.1',
    mode: command,
    url,
    origin: parsed.origin,
    operations: [
      'new_page',
      'take_snapshot',
      'list_console_messages',
      'list_network_requests',
    ],
    disclosure:
      'Navigation executes the application’s scripts and can make requests within its origin. Dedicated empty profile; no typing/submission/evaluation/screenshot tools. Evidence is displayed locally with limited token redaction; no model transmission.',
  };
  const hash = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  if (!flag) {
    console.log(JSON.stringify({ ...plan, hash }, null, 2));
    return;
  }
  if (approvedHash !== hash)
    throw new Error('Approve the exact browser preview hash');
  const root = path.resolve(__dirname, '..');
  const installation = JSON.parse(
    await readFile(path.join(root, '.oax', 'browser-install.json'), 'utf8'),
  ) as { executable: string; version: string };
  const executable = await realpath(installation.executable);
  if (
    !executable.startsWith(path.join(root, '.oax', 'browser-cache') + path.sep)
  )
    throw new Error('Use the dedicated installed testing browser');
  const journal = await openAudit(root);
  const permissions = new PermissionEngine(Date.now, journal.record);
  const scope = {
    principal: 'local-cli',
    workspaceId: root,
    sessionId: randomUUID(),
    taskId: randomUUID(),
  };
  const inspector = new BrowserInspector({
    serverEntry: path.join(
      path.dirname(require.resolve('chrome-devtools-mcp')),
      'bin',
      'chrome-devtools-mcp.js',
    ),
    chromeExecutable: executable,
    origin: parsed.origin,
    permissions,
    scope,
  });
  const grant = (
    tool: import('@oax/browser').BrowserTool,
    args: Record<string, unknown>,
  ) =>
    permissions.grant({
      ...browserAction(scope, parsed.origin, tool, args),
      id: randomUUID(),
      decision: 'allow',
      expiresAt: Date.now() + 15000,
    });
  try {
    await inspector.connect();
    grant('new_page', { url });
    const opened = (await inspector.call('new_page', { url })) as {
      pageId: number;
    };
    console.log(JSON.stringify(opened));
    for (const tool of [
      'take_snapshot',
      'list_console_messages',
      'list_network_requests',
    ] as const) {
      const args = { pageId: opened.pageId };
      grant(tool, args);
      const evidence = await inspector.call(tool, args);
      console.log(JSON.stringify({ tool, evidence }));
      if (tool === 'take_snapshot' && command === 'inspect-jev') {
        const page = snapshotPage(evidence, url);
        console.log(
          JSON.stringify({
            planner: 'jev',
            page,
            actionSpace: await new JevPlanner(root).inspect(page),
            limitations: [
              'Accessibility proposals only; UIDs are not executable permissions. No provider request or browser action executed.',
            ],
          }),
        );
      }
    }
  } finally {
    try {
      await inspector.close();
    } finally {
      permissions.close(scope.sessionId);
      await journal.close();
    }
  }
}
void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'Browser inspection failed',
  );
  process.exitCode = 1;
});
