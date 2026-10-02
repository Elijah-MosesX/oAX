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
import { providerExecutable } from '@oax/codex/executable';
import { workspacePath } from '@oax/context';
import { OaxError } from '@oax/protocol';
import type { RenamePlan } from '../../../packages/runtime/src/refactor.js';
import type { CheckPlan } from '../../../packages/runtime/src/verification.js';
async function inspectOrVerify(
  command: 'explain' | 'review' | 'verify',
  args: string[],
): Promise<void> {
  const resource = args.shift();
  let provider: string | undefined, approved: string | undefined;
  let mock = false;
  while (args.length) {
    const flag = args.shift();
    if (flag === '--mock' && command === 'explain' && !mock) {
      mock = true;
      continue;
    }
    const value = args.shift();
    if (flag === '--codex' && command === 'explain' && value && !provider)
      provider = value;
    else if (flag === '--approve' && command !== 'review' && value && !approved)
      approved = value;
    else
      throw new OaxError(
        'INVALID_ARGS',
        'Unexpected or duplicate argument; use --help',
      );
  }
  if (!resource || (command === 'explain' && mock && (approved || provider)))
    throw new OaxError(
      'INVALID_ARGS',
      'Specify a workspace path; --mock cannot be combined with provider transmission',
    );
  if (provider && !path.isAbsolute(provider))
    throw new OaxError(
      'INVALID_ARGS',
      'Codex executable must be an absolute path',
    );
  const root = await realpath(process.cwd());
  const absolute = await workspacePath(root, resource);
  if (command === 'explain' && !mock)
    provider = await providerExecutable(provider);
  const text = await readFile(absolute, 'utf8');
  const lines = text.split('\n');
  const observation: Observation = {
    path: resource,
    uri: pathToFileURL(absolute).href,
    text,
    dirty: false,
    documentVersion: 1,
    cursor: { line: 0, column: 0 },
    selection: {
      start: { line: 0, column: 0 },
      end: {
        line: lines.length - 1,
        column: lines.at(-1)!.replace(/\r$/, '').length,
      },
    },
    visibleRanges: [],
    openFiles: [resource],
  };
  const client = await RuntimeClient.connect(
    __filename,
    root,
    process.execPath,
    provider,
  );
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel);
  try {
    const { sessionId } = (await client.call('session.open', {})) as {
      sessionId: string;
    };
    if (command === 'verify') {
      const plan = (await client.call(
        'verification.prepare',
        { observation },
        sessionId,
      )) as CheckPlan;
      if (!approved) process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
      else {
        if (approved !== plan.hash)
          throw new OaxError(
            'PERMISSION_DENIED',
            'Verification preview changed; inspect the current plan',
          );
        const unsubscribe = client.subscribe((event) => {
          if (event.sessionId === sessionId && event.method === 'agent.delta')
            process.stdout.write(event.payload.text);
        });
        try {
          await client.verify(sessionId, plan.id, approved, controller.signal);
        } finally {
          unsubscribe();
        }
      }
    } else if (command === 'review') {
      const context = await client.call(
        'context.preview',
        { observation, objective: 'Collect structural review evidence' },
        sessionId,
      );
      const relationships: Record<string, unknown> = {};
      for (const relation of ['callers', 'imports', 'implements', 'tests'])
        relationships[relation] = await client.call(
          'graph.query',
          { observation, relationship: relation },
          sessionId,
        );
      process.stdout.write(
        JSON.stringify(
          {
            kind: 'structural-review-evidence',
            context,
            relationships,
            limitations: [
              'This is deterministic context/relationship evidence, not a model code-quality review. No tests run or files changed.',
            ],
          },
          null,
          2,
        ) + '\n',
      );
    } else {
      const objective = 'Explain this file';
      if (provider) {
        const preview = (await client.call(
          'context.preview',
          { observation, objective },
          sessionId,
        )) as { context: unknown; hash: string };
        if (!approved)
          process.stdout.write(
            JSON.stringify(
              {
                ...preview,
                disclosure:
                  'Sends this bounded context through your Codex login; account usage may apply. Re-run with --approve and this hash to transmit.',
              },
              null,
              2,
            ) + '\n',
          );
        else {
          if (approved !== preview.hash)
            throw new OaxError(
              'PERMISSION_DENIED',
              'Context preview changed; inspect it again',
            );
          process.stdout.write(
            await client.explain(
              sessionId,
              observation,
              objective,
              controller.signal,
              approved,
            ),
          );
        }
      } else
        process.stdout.write(
          await client.explain(
            sessionId,
            observation,
            objective,
            controller.signal,
          ),
        );
    }
    await client.call('session.close', {}, sessionId);
  } finally {
    process.removeListener('SIGINT', cancel);
    client.dispose();
  }
}
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
async function query(args: string[]): Promise<void> {
  const [relationship, resource, lineText, columnText] = args;
  const line = Number(lineText),
    column = Number(columnText);
  if (
    args.length !== 4 ||
    !resource ||
    !['callers', 'imports', 'implements', 'tests'].includes(
      relationship ?? '',
    ) ||
    !Number.isInteger(line) ||
    line < 0 ||
    !Number.isInteger(column) ||
    column < 0
  )
    throw new OaxError(
      'INVALID_ARGS',
      'query <callers|imports|implements|tests> <path> <zero-based-line> <zero-based-column>',
    );
  const root = await realpath(process.cwd());
  const absolute = await workspacePath(root, resource);
  const text = await readFile(absolute, 'utf8');
  const point = { line, column };
  const observation: Observation = {
    path: resource,
    uri: pathToFileURL(absolute).href,
    text,
    documentVersion: 1,
    dirty: false,
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
    const result = await client.call(
      'graph.query',
      { observation, relationship },
      sessionId,
    );
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
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
  if (command === 'explain' || command === 'review' || command === 'verify')
    return inspectOrVerify(command, process.argv.slice(3));
  if (command === 'rename') return rename(process.argv.slice(3));
  if (command === 'query') return query(process.argv.slice(3));
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
      'oAX CLI (Explain uses Codex; explicit --mock is development-only)\nUsage: node dist/cli.cjs init [workspace-root]\n       node dist/cli.cjs analyze [workspace-root]\n       node dist/cli.cjs onboard [workspace-root]\n       node dist/cli.cjs query <callers|imports|implements|tests> <path> <zero-based-line> <zero-based-column>\n       node dist/cli.cjs rename <path> <zero-based-line> <zero-based-column> <new-name> [--apply <preview-hash>]\n       node dist/cli.cjs explain <path> [--codex <absolute-executable>] [--approve <context-hash>]\n       node dist/cli.cjs review <path>\n       node dist/cli.cjs verify <saved-test-path> [--approve <plan-hash>]\n       node dist/cli.cjs serve <workspace-root> <workspace-id>\ninit preserves config; analyze builds a local TypeScript/JavaScript SQLite graph. Rename previews before writes and verifies syntax; workspace tests are not run.\nserve is a private stdio interface requiring OAX_CONNECTION_TOKEN; no TCP port is opened.\nExit codes: 0 success, 1 operation failed, 2 unsupported command.\n',
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
