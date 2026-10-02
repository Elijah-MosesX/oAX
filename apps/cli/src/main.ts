import { realpath, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Runtime, MockAgentEngine } from '@oax/runtime';
import { RuntimeClient } from '../../../packages/runtime/src/client.js';
import {
  FrameWriter,
  frames,
} from '../../../packages/runtime/src/transport.js';
import type { Observation } from '@oax/protocol';
import { initializeWorkspace, analyzeWorkspace } from './workspace.js';
import { CodexAgentEngine } from '@oax/codex';
import { workspacePath } from '@oax/context';
import { OaxError } from '@oax/protocol';
import type { RenamePlan } from '../../../packages/runtime/src/refactor.js';
async function rename(args: string[]): Promise<void> {
  const [resource, lineText, columnText, newName, flag, hash] = args;
  const line = Number(lineText),
    column = Number(columnText);
  if (
    !resource ||
    !newName ||
    !Number.isInteger(line) ||
    line < 0 ||
    !Number.isInteger(column) ||
    column < 0 ||
    (flag !== undefined && (flag !== '--apply' || !hash))
  )
    throw new OaxError(
      'INVALID_ARGS',
      'rename <path> <zero-based-line> <zero-based-column> <new-name> [--apply <preview-hash>]',
    );
  const root = await realpath(process.cwd());
  const absolute = await workspacePath(root, resource);
  const text = await readFile(absolute, 'utf8');
  const point = { line, column };
  const observation: Observation = {
    path: resource,
    uri: pathToFileURL(absolute).href,
    text,
    dirty: false,
    documentVersion: 1,
    cursor: point,
    selection: { start: point, end: point },
    visibleRanges: [],
    openFiles: [resource],
  };
  const client = await RuntimeClient.connect(__filename, root);
  try {
    const { sessionId } = (await client.call('session.open', {})) as {
      sessionId: string;
    };
    const plan = (await client.call(
      'refactor.prepare',
      { observation, newName },
      sessionId,
    )) as RenamePlan;
    if (!flag) process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
    else {
      if (hash !== plan.hash)
        throw new OaxError(
          'PERMISSION_DENIED',
          'Preview changed; inspect the current plan before applying',
        );
      process.stdout.write(
        JSON.stringify(
          await client.call(
            'refactor.apply',
            { planId: plan.id, approvedHash: hash, observation },
            sessionId,
          ),
          null,
          2,
        ) + '\n',
      );
    }
    await client.call('session.close', {}, sessionId);
  } finally {
    client.dispose();
  }
}
async function serve(root: string, workspaceId: string): Promise<void> {
  const token = process.env.OAX_CONNECTION_TOKEN;
  delete process.env.OAX_CONNECTION_TOKEN;
  if (!token || token.length < 32 || !workspaceId)
    throw new Error('Missing runtime identity/credential');
  const writer = new FrameWriter(process.stdout);
  let broken = false;
  const runtime = new Runtime({
    root: await realpath(root),
    workspaceId,
    token,
    engine: process.env.OAX_PROVIDER_EXECUTABLE
      ? new CodexAgentEngine({
          executable: process.env.OAX_PROVIDER_EXECUTABLE,
        })
      : new MockAgentEngine(),
    externalText: !!process.env.OAX_PROVIDER_EXECUTABLE,
    timeoutMs: process.env.OAX_PROVIDER_EXECUTABLE ? 70000 : 30000,
    emit: (event) => {
      void writer.send(event).catch(() => {
        broken = true;
        process.stdin.destroy();
      });
    },
  });
  const stop = () => {
    process.stdin.destroy();
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  process.stdout.on('error', stop);
  try {
    for await (const input of frames(process.stdin)) {
      if (broken) break;
      await writer.send(await runtime.dispatch(input));
    }
  } finally {
    await runtime.stop();
    await writer.flush();
  }
}
async function demo(): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), 'oax-demo-'));
  let client: RuntimeClient | undefined;
  try {
    const text =
      'export function greet(name: string) { return `Hello ${name}`; }';
    await writeFile(path.join(root, 'example.ts'), text);
    client = await RuntimeClient.connect(__filename, root);
    const { sessionId } = (await client.call('session.open', {})) as {
      sessionId: string;
    };
    const observation: Observation = {
      path: 'example.ts',
      uri: pathToFileURL(path.join(root, 'example.ts')).href,
      documentVersion: 1,
      dirty: false,
      text,
      cursor: { line: 0, column: 0 },
      selection: {
        start: { line: 0, column: 0 },
        end: { line: 0, column: text.length },
      },
      visibleRanges: [],
      openFiles: ['example.ts'],
    };
    process.stdout.write(await client.explain(sessionId, observation));
    await client.call('session.close', {}, sessionId);
  } finally {
    client?.dispose();
    await rm(root, { recursive: true, force: true });
  }
}
const [command, root, workspaceId] = process.argv.slice(2);
const main = async () => {
  if (command === 'serve' && root && workspaceId)
    return serve(root, workspaceId);
  if (command === 'demo') return demo();
  if (command === 'rename') return rename(process.argv.slice(3));
  if (command === 'init') {
    process.stdout.write(
      JSON.stringify(
        await initializeWorkspace(root ?? process.cwd()),
        null,
        2,
      ) + '\n',
    );
    return;
  }
  if (command === 'analyze' || command === 'onboard') {
    process.stdout.write(
      JSON.stringify(await analyzeWorkspace(root ?? process.cwd()), null, 2) +
        '\n',
    );
    return;
  }
  if (!command || command === '--help' || command === 'help') {
    process.stdout.write(
      'oAX local development CLI (default engine: mock)\nUsage: node dist/cli.cjs init [workspace-root]\n       node dist/cli.cjs analyze [workspace-root]\n       node dist/cli.cjs onboard [workspace-root]\n       node dist/cli.cjs rename <path> <zero-based-line> <zero-based-column> <new-name> [--apply <preview-hash>]\n       node dist/cli.cjs demo\n       node dist/cli.cjs serve <workspace-root> <workspace-id>\ninit preserves config; analyze builds a local TypeScript/JavaScript SQLite graph. Rename previews before writes and verifies syntax; workspace tests are not run.\nserve is a private stdio interface requiring OAX_CONNECTION_TOKEN; no TCP port is opened.\nExit codes: 0 success, 1 operation failed, 2 unsupported command.\n',
    );
    return;
  }
  process.exitCode = 2;
  process.stderr.write('Unsupported command. Use --help.\n');
};
void main().catch((error) => {
  process.stderr.write(
    error instanceof OaxError
      ? `${error.code}: ${error.message}\n`
      : 'oAX operation failed. Check runtime configuration and workspace.\n',
  );
  process.exitCode = 1;
});
