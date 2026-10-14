import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  writeFile,
  readFile,
  rm,
  mkdir,
  symlink,
  copyFile,
} from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { Runtime, MockAgentEngine } from '@oax/runtime';
import { CAPABILITIES, request, type Observation } from '@oax/protocol';
import {
  prepareMemory,
  saveMemory,
  listMemory,
  memoryContext,
  deleteMemory,
  suggestMemory,
  type MemoryPlan,
  type MemoryRecord,
} from '../packages/runtime/src/memory.js';

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'oax-memory-'));
  const text = 'export function answer() { return 42; }';
  await writeFile(path.join(root, 'a.ts'), text);
  const observation: Observation = {
    path: 'a.ts',
    uri: pathToFileURL(path.join(root, 'a.ts')).href,
    text,
    dirty: false,
    documentVersion: 1,
    cursor: { line: 0, column: 0 },
    selection: {
      start: { line: 0, column: 0 },
      end: { line: 0, column: text.length },
    },
    visibleRanges: [],
    openFiles: ['a.ts'],
  };
  return {
    root,
    observation,
    close: () =>
      rm(root, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      }),
  };
}
test('memory requires exact same-session review; context is opt-in, source-bound and deletion invalidates it', async () => {
  const f = await fixture();
  const runtime = new Runtime({
    root: f.root,
    workspaceId: 'w',
    token: 'a'.repeat(64),
    engine: new MockAgentEngine(),
    emit() {},
  });
  const call = (method: string, payload: unknown, session?: string) =>
    runtime.dispatch(request('w', method, payload, session));
  const ok = async (
    method: string,
    payload: unknown,
    session?: string,
  ): Promise<unknown> => {
    const r = await call(method, payload, session);
    assert.ok(r.ok, JSON.stringify(r));
    return r.payload;
  };
  try {
    await ok('initialize', {
      token: 'a'.repeat(64),
      capabilities: [...CAPABILITIES],
    });
    const a = ((await ok('session.open', {})) as { sessionId: string })
      .sessionId;
    const b = ((await ok('session.open', {})) as { sessionId: string })
      .sessionId;
    const plan = (await ok(
      'memory.prepare',
      {
        observation: f.observation,
        note: 'Answer stays synchronous. token="secretsecretsecret"',
        retentionDays: 30,
      },
      a,
    )) as MemoryPlan;
    assert.match(plan.operation.note, /REDACTED/);
    assert.deepEqual(await listMemory(f.root), []);
    assert.equal(
      (
        await call(
          'memory.save',
          { planId: plan.id, approvedHash: plan.hash },
          b,
        )
      ).ok,
      false,
    );
    assert.equal(
      (
        await call(
          'memory.save',
          { planId: plan.id, approvedHash: '0'.repeat(64) },
          a,
        )
      ).ok,
      false,
    );
    const saved = (await ok(
      'memory.save',
      { planId: plan.id, approvedHash: plan.hash },
      a,
    )) as MemoryRecord;
    assert.equal(
      (
        await call(
          'memory.save',
          { planId: plan.id, approvedHash: plan.hash },
          a,
        )
      ).ok,
      false,
    );
    const params = { observation: f.observation, objective: 'Explain' };
    const plain = (await ok('context.preview', params, a)) as {
      context: { memory?: unknown[] };
      hash: string;
    };
    assert.equal(plain.context.memory, undefined);
    const preview = (await ok(
      'context.preview',
      { ...params, memoryIds: [saved.id] },
      b,
    )) as { context: { memory: MemoryRecord[] }; hash: string };
    assert.equal(preview.context.memory[0]?.note, plan.operation.note);
    assert.notEqual(preview.hash, plain.hash);
    assert.ok(Buffer.byteLength(JSON.stringify(preview.context)) <= 16000);
    await writeFile(path.join(f.root, 'a.ts'), f.observation.text + '\n');
    assert.equal((await listMemory(f.root))[0]?.status, 'stale');
    assert.equal(
      (await call('context.preview', { ...params, memoryIds: [saved.id] }, a))
        .ok,
      false,
    );
    await writeFile(path.join(f.root, 'a.ts'), f.observation.text);
    const listed = (await listMemory(f.root))[0]!;
    assert.equal(
      (
        await call(
          'memory.delete',
          { id: saved.id, approvedHash: '0'.repeat(64) },
          a,
        )
      ).ok,
      false,
    );
    await ok('memory.delete', { id: saved.id, approvedHash: listed.hash }, a);
    assert.equal(
      (await call('context.preview', { ...params, memoryIds: [saved.id] }, a))
        .ok,
      false,
    );
    assert.ok(
      runtime.permissions.audit.some(
        (r) =>
          r.outcome === 'completed' &&
          r.action.resource.startsWith('memory:memory.save:'),
      ),
    );
  } finally {
    await runtime.stop();
    await f.close();
  }
});
test('persisted memory expires, rejects copied workspace records and linked state, and does not treat review as proof', async () => {
  const f = await fixture(),
    other = await fixture();
  try {
    const plan = await prepareMemory(
      f.root,
      f.observation,
      'A reviewed claim',
      1,
    );
    const saved = await saveMemory(f.root, plan);
    assert.equal(
      (await listMemory(f.root))[0]?.validation,
      'human-reviewed-source-linked',
    );
    const file = path.join(f.root, '.oax', 'memory', `${saved.id}.json`);
    const record = JSON.parse(await readFile(file, 'utf8'));
    record.expiresAt = Date.now() - 1;
    await writeFile(file, JSON.stringify(record));
    assert.equal((await listMemory(f.root))[0]?.status, 'expired');
    await assert.rejects(
      memoryContext(f.root, [saved.id], f.observation),
      /expired/,
    );
    await mkdir(path.join(other.root, '.oax', 'memory'), { recursive: true });
    await copyFile(
      file,
      path.join(other.root, '.oax', 'memory', `${saved.id}.json`),
    );
    await assert.rejects(listMemory(other.root), /workspace/);
    const item = (await listMemory(f.root))[0]!;
    await deleteMemory(f.root, item.id, item.hash);
    await rm(path.join(f.root, '.oax', 'memory'), { recursive: true });
    await symlink(
      path.join(other.root, '.oax', 'memory'),
      path.join(f.root, '.oax', 'memory'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await assert.rejects(listMemory(f.root), /ordinary workspace/);
  } finally {
    await f.close();
    await other.close();
  }
});

test('memory rejects stale saves, expired reviews and concurrent writer locks', async () => {
  const f = await fixture();
  try {
    const plan = await prepareMemory(
      f.root,
      f.observation,
      'Reviewed note',
      30,
    );
    await writeFile(path.join(f.root, 'a.ts'), 'changed');
    await assert.rejects(saveMemory(f.root, plan), /Source changed/);
    await writeFile(path.join(f.root, 'a.ts'), f.observation.text);
    await assert.rejects(
      saveMemory(f.root, { ...plan, expiresAt: 0 }),
      /Review expired/,
    );
    const lock = path.join(f.root, '.oax', 'memory', '.lock');
    await writeFile(lock, '');
    await assert.rejects(saveMemory(f.root, plan), /holds the lock/);
    await assert.rejects(listMemory(f.root), /holds the lock/);
    await rm(lock);
    assert.deepEqual(await listMemory(f.root), []);
  } finally {
    await f.close();
  }
});

test('memory suggestions rank exact-source range overlap before lexical evidence and disclose exclusions', async () => {
  const f = await fixture();
  try {
    const lines = [
      'export function first() { return 1; }',
      'export function second() { return 2; }',
      'export function third() { return 3; }',
    ];
    const text = lines.join('\n');
    await writeFile(path.join(f.root, 'a.ts'), text);
    const observation = {
      ...f.observation,
      text,
      selection: {
        start: { line: 1, column: 0 },
        end: { line: 1, column: lines[1]!.length },
      },
      cursor: { line: 1, column: 0 },
    };
    const add = async (line: number, note: string) =>
      saveMemory(
        f.root,
        await prepareMemory(
          f.root,
          {
            ...observation,
            selection: {
              start: { line, column: 0 },
              end: { line, column: lines[line]!.length },
            },
          },
          note,
          30,
        ),
      );
    const distant = await add(2, 'Payment payment handling');
    const overlapping = await add(1, 'Synchronous return value');
    await add(0, 'Unrelated reviewed claim');
    const ranked = await suggestMemory(
      f.root,
      observation,
      'Explain payment handling',
    );
    assert.equal(ranked.automaticInclusion, false);
    assert.equal(ranked.suggestions[0]?.id, overlapping.id);
    assert.equal(ranked.suggestions[1]?.id, distant.id);
    assert.deepEqual(ranked.suggestions[1]?.relevance.matchedTerms, [
      'payment',
      'handling',
    ]);
    const boundary = await suggestMemory(
      f.root,
      {
        ...observation,
        selection: {
          start: observation.selection.end,
          end: observation.selection.end,
        },
      },
      'Explain',
    );
    assert.equal(
      boundary.suggestions.find((item) => item.id === overlapping.id)?.relevance
        .overlaps,
      false,
    );
    for (let n = 0; n < 4; n++) await add(0, `Extra reviewed claim ${n}`);
    const bounded = await suggestMemory(
      f.root,
      observation,
      'Explain payment handling',
    );
    assert.equal(bounded.suggestions.length, 5);
    assert.equal(bounded.excluded.budget, 2);
    assert.deepEqual(
      (
        await suggestMemory(f.root, observation, 'Explain payment handling')
      ).suggestions.map((item) => item.id),
      bounded.suggestions.map((item) => item.id),
    );
    await writeFile(path.join(f.root, 'a.ts'), text + '\n');
    const stale = await suggestMemory(
      f.root,
      { ...observation, text: text + '\n' },
      'Explain payment',
    );
    assert.equal(stale.suggestions.length, 0);
    assert.equal(stale.excluded.stale, 7);
  } finally {
    await f.close();
  }
});
