import assert from 'node:assert/strict';
import { CodexTextClient } from '../packages/codex/src/text-client.js';
import { RuntimeClient } from '../packages/runtime/src/client.js';
import { observation } from '../tests/helpers.js';
import path from 'node:path';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
async function main() {
  const executable = process.env.OAX_CODEX_EXECUTABLE;
  if (process.env.OAX_LIVE_TEST !== '1' || !executable)
    throw new Error(
      'Opt-in required: OAX_LIVE_TEST=1 and OAX_CODEX_EXECUTABLE',
    );
  const client = new CodexTextClient(executable);
  try {
    const preflight = await client.connect();
    assert.equal(
      preflight.authenticated,
      true,
      'Existing provider login required; oAX does not initiate login',
    );
    console.log(
      `Codex ${preflight.version} authenticated; no repository content sent.`,
    );
    const answer = await client.explain(
      'Explain this synthetic TypeScript function in one sentence: export function add(a: number, b: number) { return a + b; }',
    );
    assert.match(answer, /add|sum|addition|plus/i);
    console.log(
      'Live synthetic explain completed; text-only session policy verified.',
    );
  } finally {
    await client.close();
  }
  const root = await mkdtemp(path.join(tmpdir(), 'oax-live-edit-'));
  const source = 'export function add(a: number, b: number) { return a - b; }';
  const testSource =
    "import test from 'node:test'; import assert from 'node:assert/strict'; import { add } from './example.ts'; test('addition', () => assert.equal(add(2, 3), 5));";
  await writeFile(path.join(root, 'example.ts'), source);
  await writeFile(path.join(root, 'example.test.mjs'), testSource);
  const runtime = await RuntimeClient.connect(
    path.resolve('dist/cli.cjs'),
    root,
    process.execPath,
    executable,
  );
  try {
    const { sessionId } = (await runtime.call('session.open', {})) as {
      sessionId: string;
    };
    const captured = {
      ...observation(source),
      dirty: false,
      uri: pathToFileURL(path.join(root, 'example.ts')).href,
    };
    const objective =
      'Fix the selected add function to return the sum of a and b. Return strict JSON only with exactly two string fields: replacement (complete replacement selection) and explanation (at most 1024 characters). No markdown fences, paths or commands.';
    await assert.rejects(
      runtime.explain(sessionId, captured, objective),
      'Missing context grant must prevent transmission',
    );
    const preview = (await runtime.call(
      'context.preview',
      {
        observation: captured,
        objective,
      },
      sessionId,
    )) as { hash: string };
    const answer = await runtime.explain(
      sessionId,
      captured,
      objective,
      undefined,
      preview.hash,
    );
    assert.match(answer, /add|sum|addition|plus/i);
    console.log(
      'Live stdio runtime -> scoped context consent -> Codex -> answer passed; missing consent denied.',
    );
    const plan = (await runtime.call(
      'refactor.propose',
      { observation: captured, proposal: answer },
      sessionId,
    )) as { id: string; hash: string };
    assert.equal(await readFile(path.join(root, 'example.ts'), 'utf8'), source);
    await assert.rejects(
      runtime.call(
        'refactor.apply',
        {
          observation: captured,
          planId: plan.id,
          approvedHash: 'b'.repeat(64),
        },
        sessionId,
      ),
    );
    await runtime.call(
      'refactor.apply',
      { observation: captured, planId: plan.id, approvedHash: plan.hash },
      sessionId,
    );
    const checks = (await runtime.call(
      'verification.prepare',
      {
        observation: {
          ...captured,
          path: 'example.test.mjs',
          uri: pathToFileURL(path.join(root, 'example.test.mjs')).href,
          text: testSource,
          selection: {
            start: { line: 0, column: 0 },
            end: { line: 0, column: testSource.length },
          },
        },
      },
      sessionId,
    )) as { id: string; hash: string };
    await runtime.verify(sessionId, checks.id, checks.hash);
    console.log(
      'Live synthetic Codex proposal -> exact diff plan -> wrong-hash denial -> approved edit -> separately approved real Node test passed.',
    );
    await runtime.call('session.close', {}, sessionId);
  } finally {
    runtime.dispose();
    if (
      path.dirname(root) !== tmpdir() ||
      !path.basename(root).startsWith('oax-live-edit-')
    )
      throw new Error('Unexpected cleanup path');
    await rm(root, { recursive: true, force: true });
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Live test failed');
  process.exitCode = 1;
});
