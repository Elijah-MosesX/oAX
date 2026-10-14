import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { RuntimeClient } from '@oax/runtime/client';
import type { RenamePlan } from '../../packages/runtime/src/refactor.js';
import type { CheckPlan } from '../../packages/runtime/src/verification.js';
import type { inspectReview } from '../../packages/runtime/src/review.js';
type Report = Awaited<ReturnType<typeof inspectReview>>;
test('stdio edit review binds exact approval, failed and passing tests, freshness, and session isolation', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'oax-review-'));
  const source = 'export function add(a, b) { return a - b; }\n';
  const testText =
    "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from './example.mjs';\ntest('add', () => assert.equal(add(2, 3), 5));\n";
  await writeFile(path.join(root, 'example.mjs'), source);
  await writeFile(path.join(root, 'example.test.mjs'), testText);
  const client = await RuntimeClient.connect(
    path.resolve('dist/cli.cjs'),
    root,
  );
  const observe = (resource: string, text: string) => ({
    path: resource,
    uri: pathToFileURL(path.join(root, resource)).href,
    text,
    documentVersion: 1,
    dirty: false,
    cursor: { line: 0, column: 0 },
    selection: {
      start: { line: 0, column: 0 },
      end: { line: 0, column: text.split('\n')[0]!.length },
    },
    visibleRanges: [],
    openFiles: [resource],
  });
  try {
    const { sessionId } = (await client.call('session.open', {})) as {
      sessionId: string;
    };
    const observation = observe('example.mjs', source);
    assert.match(await client.explain(sessionId, observation), /Mock engine/);
    // Deterministic proposal fixture; real-provider editor acceptance is opt-in.
    const plan = (await client.call(
      'refactor.propose',
      {
        observation,
        proposal: JSON.stringify({
          replacement: 'export function add(a, b) { return a + b; }',
          explanation: 'Use addition.',
        }),
      },
      sessionId,
    )) as RenamePlan;
    await assert.rejects(
      client.call(
        'refactor.apply',
        { observation, planId: plan.id, approvedHash: 'b'.repeat(64) },
        sessionId,
      ),
    );
    assert.equal(
      await readFile(path.join(root, 'example.mjs'), 'utf8'),
      source,
    );
    await client.call(
      'refactor.apply',
      { observation, planId: plan.id, approvedHash: plan.hash },
      sessionId,
    );
    const report = () =>
      client.call('review.get', {}, sessionId) as Promise<Report>;
    assert.equal((await report()).verified, false);
    const verify = async () => {
      const check = (await client.call(
        'verification.prepare',
        {
          observation: observe(
            'example.test.mjs',
            await readFile(path.join(root, 'example.test.mjs'), 'utf8'),
          ),
        },
        sessionId,
      )) as CheckPlan;
      await assert.rejects(client.verify(sessionId, check.id, 'c'.repeat(64)));
      return client.verify(sessionId, check.id, check.hash);
    };
    await writeFile(
      path.join(root, 'example.test.mjs'),
      testText.replace(', 5)', ', 6)'),
    );
    await assert.rejects(verify());
    assert.equal((await report()).check?.state, 'failed');
    assert.equal((await report()).check?.exitCode, 1);
    assert.equal((await report()).verified, false);
    await writeFile(path.join(root, 'example.test.mjs'), testText);
    await verify();
    const passed = await report();
    assert.equal(passed.verified, true);
    assert.equal(passed.approvedHash, plan.hash);
    assert.equal(passed.changes[0]?.before, source);
    assert.match(passed.check!.output, /pass 1/);
    await writeFile(
      path.join(root, 'example.test.mjs'),
      testText + '// changed after verification',
    );
    assert.equal((await report()).checkCurrent, false);
    assert.equal(
      (await report()).verified,
      false,
      'A changed test invalidates its prior review',
    );
    await writeFile(path.join(root, 'example.test.mjs'), testText);
    await writeFile(
      path.join(root, 'example.mjs'),
      plan.changes[0]!.after + '// later user edit',
    );
    assert.equal((await report()).verified, false);
    await verify();
    assert.equal((await report()).check?.matchedBefore, false);
    assert.equal((await report()).verified, false);
    const other = (await client.call('session.open', {})) as {
      sessionId: string;
    };
    await assert.rejects(client.call('review.get', {}, other.sessionId));
    await client.call('session.close', {}, other.sessionId);
    await client.call('session.close', {}, sessionId);
    await assert.rejects(report());
  } finally {
    client.dispose();
    if (
      path.dirname(root) !== tmpdir() ||
      !path.basename(root).startsWith('oax-review-')
    )
      throw new Error('Unsafe cleanup');
    await rm(root, { recursive: true, force: true });
  }
});
