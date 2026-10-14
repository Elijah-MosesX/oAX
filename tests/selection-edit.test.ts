import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Runtime, MockAgentEngine } from '@oax/runtime';
import { request, CAPABILITIES } from '@oax/protocol';
import { selectionEditPlan } from '../packages/runtime/src/refactor.js';

test('untrusted edit proposals are selection-scoped and exact approval and baselines control writes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'oax-selection-edit-'));
  const file = path.join(root, 'a.ts');
  const text =
    '// unrelated 😀\r\nexport function add(a: number, b: number) { return a - b; }\r\n// preserved';
  await writeFile(file, text);
  const runtime = new Runtime({
    root,
    workspaceId: 'workspace',
    token: 'a'.repeat(64),
    engine: new MockAgentEngine(),
    emit: () => {},
  });
  const call = (method: string, payload: unknown, sessionId?: string) =>
    runtime.dispatch(request('workspace', method, payload, sessionId));
  const observation = {
    path: 'a.ts',
    uri: pathToFileURL(file).href,
    text,
    documentVersion: 1,
    dirty: false,
    cursor: { line: 1, column: 0 },
    selection: {
      start: { line: 1, column: 0 },
      end: { line: 1, column: text.split('\r\n')[1]!.length },
    },
    visibleRanges: [],
    openFiles: ['a.ts'],
  };
  const replacement =
    'export function add(a: number, b: number) { return a + b; }';
  const proposal = JSON.stringify({
    replacement,
    explanation: 'Use addition.',
  });
  try {
    assert.ok(
      (
        await call('initialize', {
          token: 'a'.repeat(64),
          capabilities: [...CAPABILITIES],
        })
      ).ok,
    );
    const opened = await call('session.open', {});
    assert.ok(opened.ok);
    const session = (opened.payload as { sessionId: string }).sessionId;
    for (const invalid of [
      'not JSON',
      JSON.stringify({ replacement, explanation: 'x', path: '../escape' }),
      JSON.stringify({
        replacement,
        explanation: 'x',
        command: 'run anything',
      }),
    ])
      assert.equal(
        (
          await call(
            'refactor.propose',
            { observation, proposal: invalid },
            session,
          )
        ).ok,
        false,
      );
    assert.throws(() =>
      selectionEditPlan('fixture', { ...observation, dirty: true }, proposal),
    );
    const prepared = await call(
      'refactor.propose',
      { observation, proposal },
      session,
    );
    assert.ok(prepared.ok);
    const plan = prepared.payload as {
      id: string;
      hash: string;
      changes: { path: string; after: string }[];
      verification: string;
    };
    assert.deepEqual(
      plan.changes.map((change) => change.path),
      ['a.ts'],
    );
    assert.equal(
      plan.changes[0]!.after,
      text.replace('return a - b', 'return a + b'),
    );
    assert.match(plan.verification, /Unverified/);
    assert.equal(
      await readFile(file, 'utf8'),
      text,
      'Preparing a proposal must not write',
    );
    assert.equal(
      (
        await call(
          'refactor.apply',
          { observation, planId: plan.id, approvedHash: 'b'.repeat(64) },
          session,
        )
      ).ok,
      false,
    );
    await writeFile(file, text + '\r\n// concurrent user edit');
    assert.equal(
      (
        await call(
          'refactor.apply',
          { observation, planId: plan.id, approvedHash: plan.hash },
          session,
        )
      ).ok,
      false,
    );
    assert.equal(
      await readFile(file, 'utf8'),
      text + '\r\n// concurrent user edit',
    );
    await writeFile(file, text);
    assert.ok(
      (
        await call(
          'refactor.apply',
          { observation, planId: plan.id, approvedHash: plan.hash },
          session,
        )
      ).ok,
    );
    assert.equal(await readFile(file, 'utf8'), plan.changes[0]!.after);
    assert.equal(
      (
        await call(
          'refactor.apply',
          {
            observation: { ...observation, text: plan.changes[0]!.after },
            planId: plan.id,
            approvedHash: plan.hash,
          },
          session,
        )
      ).ok,
      false,
      'Approval cannot replay',
    );
  } finally {
    await runtime.stop();
    if (
      path.dirname(root) !== tmpdir() ||
      !path.basename(root).startsWith('oax-selection-edit-')
    )
      throw new Error('Unexpected cleanup path');
    await rm(root, { recursive: true, force: true });
  }
});
