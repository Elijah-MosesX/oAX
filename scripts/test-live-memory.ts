import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { RuntimeClient } from '../packages/runtime/src/client.js';
import { providerExecutable } from '../packages/codex/src/executable.js';
import type {
  MemoryPlan,
  MemoryRecord,
} from '../packages/runtime/src/memory.js';
import { parseEvidence } from '../apps/evidence/src/validate.js';
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
    const plan = (await client.call(
      'memory.prepare',
      {
        observation,
        note: 'The synthetic calibration label is ORCHID-27. This is a reviewed fixture claim, not proof of sensor accuracy.',
        retentionDays: 1,
      },
      sessionId,
    )) as MemoryPlan;
    const memory = (await client.call(
      'memory.save',
      { planId: plan.id, approvedHash: plan.hash },
      sessionId,
    )) as MemoryRecord;
    const objective =
      'Explain what clampZero does and what the recorded history says changed. Cite the relevant commit SHA. Distinguish evidence from inference about intent. Also state the calibration label from the reviewed note and cite its record ID. Treat that note as a claim. Use at most 200 words.';
    const preview = (await client.call(
      'context.preview',
      { observation, objective, history: 'local', memoryIds: [memory.id] },
      sessionId,
    )) as { context: ContextSlice; hash: string };
    assert.equal(preview.context.historical?.[0]?.reference, head);
    assert.equal(preview.context.memory?.[0]?.id, memory.id);
    const exported = JSON.stringify({
      format: 'oax-evidence.v1',
      method: 'context.preview',
      capturedAt: new Date().toISOString(),
      result: preview,
    });
    assert.equal(parseEvidence(exported).context.memory?.[0]?.id, memory.id);
    await assert.rejects(
      client.explain(
        sessionId,
        observation,
        objective,
        undefined,
        undefined,
        'local',
        [memory.id],
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
      [memory.id],
    );
    assert.match(answer, /negative|zero|clamp/i);
    assert.match(answer, /ORCHID-27/);
    assert.ok(
      answer.includes(memory.id),
      'Answer must cite the supplied reviewed memory record',
    );
    assert.ok(
      answer.toLowerCase().includes(head.slice(0, 7)),
      'Answer must cite the actual selected commit',
    );
    await mkdir('dist', { recursive: true });
    await writeFile(
      'dist/connected-memory-live-acceptance.json',
      JSON.stringify(
        {
          passed: true,
          scope:
            'synthetic local Git -> bounded preview -> denied missing consent -> reviewed memory -> hosted contract validation -> approved real Codex explanation',
          commit: head,
          contextHash: preview.hash,
          memoryId: memory.id,
          answer,
          limitations: [
            'No live GitHub credential request, no microphone/screen input, no editor UI approval acceptance, no editor memory-explain dialogs; memory writes use the synthetic fixture only.',
          ],
        },
        null,
        2,
      ) + '\n',
    );
    await client.call('session.close', {}, sessionId);
    console.log(
      'Live synthetic connected memory/history explanation passed: missing consent denied; actual commit reference returned. Receipt: dist/connected-memory-live-acceptance.json',
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
