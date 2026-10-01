import { realpath, mkdtemp, writeFile, rm } from 'node:fs/promises';
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
    engine: new MockAgentEngine(),
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
  if (!command || command === '--help' || command === 'help') {
    process.stdout.write(
      'oAX foundation (mock only)\nUsage: node dist/cli.cjs demo\n       node dist/cli.cjs serve <workspace-root> <workspace-id>\nserve requires a private stdio parent and OAX_CONNECTION_TOKEN; no TCP port is opened.\n',
    );
    return;
  }
  process.exitCode = 2;
  process.stderr.write('Unsupported command. Use --help.\n');
};
void main().catch(() => {
  process.stderr.write(
    'oAX operation failed. Check runtime configuration and workspace.\n',
  );
  process.exitCode = 1;
});
