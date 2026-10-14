import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CodeGraph } from '@oax/codegraph';

test('failed SQLite refresh retains the committed symbol snapshot and a retry invalidates correctly', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'oax-graph-recovery-'));
  const database = path.join(root, 'graph.sqlite');
  const graph = new CodeGraph(database);
  const faults = new DatabaseSync(database);
  try {
    const original = [
      {
        path: 'a.ts',
        text: 'function oldTarget() {} function caller() { oldTarget(); }',
      },
    ];
    const updated = [
      {
        path: 'a.ts',
        text: 'function newTarget() {} function caller() { newTarget(); }',
      },
    ];
    graph.update(original);
    const before = graph.nodes();
    faults.exec(
      "CREATE TRIGGER fixture_failure BEFORE DELETE ON edges BEGIN SELECT RAISE(ABORT, 'synthetic database failure'); END;",
    );
    assert.throws(() => graph.update(updated), /synthetic database failure/);
    assert.deepEqual(graph.nodes(), before);
    assert.equal(
      graph.focused('a.ts', { line: 0, column: 11 })?.name,
      'oldTarget',
    );
    faults.exec('DROP TRIGGER fixture_failure;');
    assert.equal(graph.update(updated).changed, 1);
    assert.equal(
      graph.focused('a.ts', { line: 0, column: 11 })?.name,
      'newTarget',
    );
    assert.equal(
      graph.nodes().some((node) => node.name === 'oldTarget'),
      false,
    );
    const target = graph.nodes().find((node) => node.name === 'newTarget')!;
    assert.equal(
      graph.related(target.id, 'callers').relationships[0]?.node?.name,
      'caller',
    );
  } finally {
    faults.close();
    graph.close();
    if (
      path.dirname(root) !== tmpdir() ||
      !path.basename(root).startsWith('oax-graph-recovery-')
    )
      throw new Error('Unexpected cleanup path');
    await rm(root, { recursive: true, force: true });
  }
});
