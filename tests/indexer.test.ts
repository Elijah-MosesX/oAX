import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  writeFile,
  mkdir,
  rename,
  unlink,
  rm,
  readFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CodeGraph } from '@oax/codegraph';
import { Indexer } from '@oax/indexer';
import { WorkspaceWatcher } from '@oax/watcher';
import {
  initializeWorkspace,
  analyzeWorkspace,
} from '../apps/cli/src/workspace.js';
test('indexing excludes sensitive/generated paths, replaces disk with overlays, and invalidates renamed/deleted files', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'oax-index-'));
  const graph = new CodeGraph();
  try {
    await writeFile(path.join(root, 'a.ts'), 'export const disk = 1;');
    await mkdir(path.join(root, '.env'));
    await writeFile(path.join(root, '.env', 'secret.ts'), 'const secret = 1;');
    const indexer = new Indexer(root, graph);
    let notifications = 0;
    const failures: unknown[] = [];
    const watcher = new WorkspaceWatcher(
      indexer,
      () => notifications++,
      (error) => failures.push(error),
    );
    await indexer.refresh([
      {
        path: 'a.ts',
        text: 'export const unsaved = 2;',
        version: 4,
        dirty: true,
      },
    ]);
    assert.equal(
      graph.nodes().some((n) => n.name === 'unsaved'),
      true,
    );
    assert.equal(
      graph.nodes().some((n) => n.name === 'disk' || n.name === 'secret'),
      false,
    );
    await assert.rejects(
      indexer.refresh([{ path: '../outside.ts', text: '' }]),
    );
    await assert.rejects(
      indexer.refresh([{ path: 'a.ts', text: 'x'.repeat(131073) }]),
    );
    await rename(path.join(root, 'a.ts'), path.join(root, 'b.ts'));
    await watcher.tick();
    assert.equal(
      graph.nodes().some((n) => n.path === 'a.ts'),
      false,
    );
    assert.equal(
      graph.nodes().some((n) => n.path === 'b.ts'),
      true,
    );
    await unlink(path.join(root, 'b.ts'));
    await watcher.tick();
    assert.equal(graph.nodes().length, 0);
    assert.equal(notifications, 2);
    assert.deepEqual(failures, []);
    await watcher.close();
  } finally {
    graph.close();
    await rm(root, { recursive: true, force: true });
  }
});
test('init preserves configuration and analyze persists a migrated graph without advertising semantic test coverage', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'oax-config-'));
  try {
    await writeFile(path.join(root, 'a.ts'), 'export function hello() {}');
    assert.equal((await initializeWorkspace(root)).created, true);
    const original = await readFile(
      path.join(root, '.oax', 'config.json'),
      'utf8',
    );
    assert.equal((await initializeWorkspace(root)).created, false);
    assert.equal(
      await readFile(path.join(root, '.oax', 'config.json'), 'utf8'),
      original,
    );
    await analyzeWorkspace(root);
    const graph = new CodeGraph(path.join(root, '.oax', 'graph.sqlite'));
    try {
      assert.equal(
        graph.nodes().some((n) => n.name === 'hello'),
        true,
      );
    } finally {
      graph.close();
    }
    await writeFile(
      path.join(root, '.oax', 'config.json'),
      '{"version":"future"}',
    );
    await assert.rejects(initializeWorkspace(root));
    await assert.rejects(analyzeWorkspace(root));
    assert.equal(
      await readFile(path.join(root, '.oax', 'config.json'), 'utf8'),
      '{"version":"future"}',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
