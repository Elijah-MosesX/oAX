import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { RuntimeClient } from '../packages/runtime/src/client.js';
import { providerExecutable } from '../packages/codex/src/executable.js';
import type { ContextSlice } from '@oax/context';

async function main() {
  if (process.env.OAX_LIVE_TEST !== '1')
    throw new Error(
      'Opt-in required: OAX_LIVE_TEST=1; one synthetic model request may consume account usage',
    );
  const executable = await providerExecutable(process.env.OAX_CODEX_EXECUTABLE);
  const root = await mkdtemp(path.join(tmpdir(), 'oax-live-history-'));
  let client: RuntimeClient | undefined;
  const git = (args: string[]) =>
    promisify(execFile)(
      'git',
      [
        '-c',
        `safe.directory=${root}`,
        '-c',
        'user.name=Synthetic fixture',
        '-c',
        'user.email=fixture@example.invalid',
        '-c',
        'core.hooksPath=',
        ...args,
      ],
      { cwd: root, windowsHide: true },
    );
  try {
    await git(['init']);
    await writeFile(
      path.join(root, 'sample.ts'),
      'export function clampZero(value: number) { return value; }\n',
    );
    await git(['add', 'sample.ts']);
    await git(['commit', '-m', 'Introduce synthetic sensor reading']);
    const text =
      'export function clampZero(value: number) { return Math.max(0, value); }\n';
    await writeFile(path.join(root, 'sample.ts'), text);
    await git(['add', 'sample.ts']);
    await git([
      'commit',
      '-m',
      'Clamp negative readings after a synthetic sensor produced -3',
    ]);
    const head = (await git(['rev-parse', 'HEAD'])).stdout.trim();
    client = await RuntimeClient.connect(
      path.resolve('dist/cli.cjs'),
      root,
      process.execPath,
      executable,
    );
    const { sessionId } = (await client.call('session.open', {})) as {
      sessionId: string;
    };
    const observation = {
      path: 'sample.ts',
      uri: pathToFileURL(path.join(root, 'sample.ts')).href,
      text,
      dirty: false,
      documentVersion: 1,
      cursor: { line: 0, column: 16 },
      selection: {
        start: { line: 0, column: 0 },
        end: { line: 0, column: text.trimEnd().length },
      },
      visibleRanges: [],
      openFiles: ['sample.ts'],
    };
    const objective =
      'Explain what clampZero does and what the recorded history says changed. Cite the relevant commit SHA. Distinguish evidence from inference about intent. Use at most 150 words.';
    const preview = (await client.call(
      'context.preview',
      { observation, objective, history: 'local' },
      sessionId,
    )) as { context: ContextSlice; hash: string };
    assert.equal(preview.context.historical?.[0]?.reference, head);
    await assert.rejects(
      client.explain(
        sessionId,
        observation,
        objective,
        undefined,
        undefined,
        'local',
      ),
      /Approve the current context/,
    );
    const answer = await client.explain(
      sessionId,
      observation,
      objective,
      undefined,
      preview.hash,
      'local',
    );
    assert.match(answer, /negative|zero|clamp/i);
    assert.ok(
      answer.toLowerCase().includes(head.slice(0, 7)),
      'Answer must cite the actual selected commit',
    );
    await mkdir('dist', { recursive: true });
    await writeFile(
      'dist/history-live-acceptance.json',
      JSON.stringify(
        {
          passed: true,
          scope:
            'synthetic local Git -> bounded preview -> denied missing consent -> approved real Codex explanation',
          commit: head,
          contextHash: preview.hash,
          answer,
          limitations: [
            'No live GitHub credential request, no microphone/screen input, no editor UI approval acceptance, no edits or memory persistence.',
          ],
        },
        null,
        2,
      ) + '\n',
    );
    await client.call('session.close', {}, sessionId);
    console.log(
      'Live synthetic historical explanation passed: missing consent denied; actual commit reference returned. Receipt: dist/history-live-acceptance.json',
    );
  } finally {
    client?.dispose();
    await rm(root, { recursive: true, force: true });
  }
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'History acceptance failed',
  );
  process.exitCode = 1;
});
