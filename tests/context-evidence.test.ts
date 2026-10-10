import test from 'node:test';
import assert from 'node:assert/strict';
import { CodeGraph } from '@oax/codegraph';
import { contextEvidence } from '../packages/runtime/src/context-evidence.js';

test('objective-ranked graph context preserves exact symbol ranges, evidence grades and snapshot freshness', () => {
  const graph = new CodeGraph();
  const files = [
    {
      path: 'math.ts',
      text: 'import { leaf } from "./leaf"; export function add() { return leaf(); }',
    },
    {
      path: 'leaf.ts',
      text: '/* 😀 */ export function leaf() { return 1; } const unrelated = "PRIVATE NEIGHBOR";',
    },
    {
      path: 'caller.ts',
      text: 'import {add} from "./math"; export function caller() { return add(); }',
    },
    { path: 'math.test.ts', text: 'import {add} from "./math"; add();' },
  ];
  try {
    graph.update(files);
    const selected = graph.focused('math.ts', { line: 0, column: 46 })!;
    assert.equal(selected.name, 'add');
    const snapshots = new Map(files.map((file) => [file.path, file]));
    const dependencies = contextEvidence(
      graph,
      selected,
      snapshots,
      'Explain dependencies',
      8192,
    );
    assert.match(
      dependencies.related[0]!.reason,
      /^dependency relationship; semantic/,
    );
    assert.equal(
      dependencies.related[0]!.excerpt,
      'export function leaf() { return 1; }',
    );
    assert.equal(
      dependencies.related[0]!.excerpt.includes('PRIVATE NEIGHBOR'),
      false,
    );
    const testing = contextEvidence(
      graph,
      selected,
      snapshots,
      'Fix failing tests',
      8192,
    );
    assert.equal(testing.related[0]!.path, 'math.test.ts');
    assert.equal(testing.related[0]!.resolution, 'heuristic');
    assert.match(testing.related[0]!.reason, /^test relationship/);
    const bounded = contextEvidence(
      graph,
      selected,
      snapshots,
      'Explain dependencies',
      9,
    );
    assert.equal(
      bounded.related.reduce((n, item) => n + item.excerpt.length, 0),
      9,
    );
    assert.equal(bounded.truncated, true);
    snapshots.set('leaf.ts', {
      path: 'leaf.ts',
      text: 'changed after indexing',
    });
    const stale = contextEvidence(
      graph,
      selected,
      snapshots,
      'Explain dependencies',
      8192,
    );
    assert.ok(stale.related.every((item) => item.path !== 'leaf.ts'));
    assert.equal(stale.truncated, true);
    assert.match(stale.limitations.join(' '), /missing\/stale/);
  } finally {
    graph.close();
  }
});
