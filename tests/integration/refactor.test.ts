import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { RuntimeClient } from '../../packages/runtime/src/client.js';
import type { Observation } from '@oax/protocol';
import type { RenamePlan } from '../../packages/runtime/src/refactor.js';
test('real stdio rename requires the exact preview, applies semantic locations, and preserves unrelated files', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'oax-refactor-loop-'));
  let client: RuntimeClient | undefined;
  try {
    const text =
      'export function greet() { return 1; }\nfunction caller() { return greet(); }';
    await writeFile(path.join(root, 'a.ts'), text);
    await writeFile(
      path.join(root, 'a.test.ts'),
      'import {greet} from "./a.ts"; import {test} from "node:test"; import assert from "node:assert/strict"; test("renamed function behavior",() => assert.equal(greet(),1));',
    );
    await writeFile(path.join(root, 'unrelated.txt'), 'user-owned');
    client = await RuntimeClient.connect(path.resolve('dist/cli.cjs'), root);
    const { sessionId } = (await client.call('session.open', {})) as {
      sessionId: string;
    };
    const point = { line: 0, column: 17 };
    const observation: Observation = {
      path: 'a.ts',
      uri: pathToFileURL(path.join(root, 'a.ts')).href,
      text,
      documentVersion: 1,
      dirty: false,
      cursor: point,
      selection: { start: point, end: point },
      visibleRanges: [],
      openFiles: ['a.ts'],
    };
    const plan = (await client.call(
      'refactor.prepare',
      { observation, newName: 'welcome' },
      sessionId,
    )) as RenamePlan;
    await assert.rejects(
      client.call(
        'refactor.apply',
        { observation, planId: plan.id, approvedHash: 'a'.repeat(64) },
        sessionId,
      ),
    );
    assert.equal(await readFile(path.join(root, 'a.ts'), 'utf8'), text);
    await client.call(
      'refactor.apply',
      { observation, planId: plan.id, approvedHash: plan.hash },
      sessionId,
    );
    assert.match(
      await readFile(path.join(root, 'a.ts'), 'utf8'),
      /return welcome\(\)/,
    );
    assert.equal(
      await readFile(path.join(root, 'unrelated.txt'), 'utf8'),
      'user-owned',
    );
    const testText = await readFile(path.join(root, 'a.test.ts'), 'utf8');
    const testObservation: Observation = {
      ...observation,
      path: 'a.test.ts',
      uri: pathToFileURL(path.join(root, 'a.test.ts')).href,
      text: testText,
      openFiles: ['a.test.ts'],
    };
    const checks = (await client.call(
      'verification.prepare',
      { observation: testObservation },
      sessionId,
    )) as import('../../packages/runtime/src/verification.js').CheckPlan;
    await assert.rejects(client.verify(sessionId, checks.id, 'a'.repeat(64)));
    assert.match(
      await client.verify(sessionId, checks.id, checks.hash),
      /renamed function behavior/,
    );
    await assert.rejects(
      client.call(
        'refactor.apply',
        { observation, planId: plan.id, approvedHash: plan.hash },
        sessionId,
      ),
    );
    await client.call('session.close', {}, sessionId);
  } finally {
    client?.dispose();
    await rm(root, { recursive: true, force: true });
  }
});
