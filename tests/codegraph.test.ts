import test from 'node:test';
import assert from 'node:assert/strict';
import { CodeGraph } from '@oax/codegraph';
test('semantic callers distinguish aliases and duplicate names; unresolved edges remain labeled', () => {
  const graph = new CodeGraph();
  try {
    graph.update([
      { path: 'a.ts', text: 'export function greet() { return 1; }' },
      {
        path: 'b.ts',
        text: 'import { greet as hello } from "./a.js"; export function caller() { return hello(); } function greet() { return 2; } greet(); external();',
      },
      { path: 'a.test.ts', text: 'import {greet} from "./a"; greet();' },
    ]);
    const focused = graph.focused('a.ts', { line: 0, column: 17 });
    assert.equal(focused?.name, 'greet');
    const callers = graph.related(focused!.id, 'callers');
    assert.equal(callers.relationships.length, 2);
    assert.ok(
      callers.relationships.every((r) => r.edge.resolution === 'semantic'),
    );
    assert.ok(callers.relationships.some((r) => r.node?.name === 'caller'));
    assert.ok(
      graph
        .edges()
        .some((e) => e.target === null && e.resolution === 'unresolved'),
    );
    assert.equal(graph.related(focused!.id, 'imports').relationships.length, 2);
    assert.equal(
      graph.related(focused!.id, 'tests').relationships[0]?.edge.resolution,
      'heuristic',
    );
    const callOffset =
      'import { greet as hello } from "./a.js"; export function caller() { return hello(); } function greet() { return 2; } greet(); external();'.indexOf(
        'hello();',
      );
    assert.equal(
      graph.focused('b.ts', { line: 0, column: callOffset + 1 })?.path,
      'a.ts',
    );
  } finally {
    graph.close();
  }
});
test('implements, incremental invalidation, and deletion', () => {
  const graph = new CodeGraph();
  try {
    const initial = [
      { path: 'types.ts', text: 'export interface Contract { run(): void; }' },
      {
        path: 'worker.ts',
        text: 'import {Contract} from "./types"; class Worker implements Contract { run() {} }',
      },
    ];
    assert.equal(graph.update(initial).changed, 2);
    assert.equal(graph.update(initial).changed, 0);
    const contract = graph.nodes().find((n) => n.name === 'Contract')!;
    assert.equal(
      graph.related(contract.id, 'implements').relationships.length,
      1,
    );
    graph.update([
      { path: 'types.ts', text: 'export interface Replacement {}' },
    ]);
    assert.equal(
      graph.nodes().some((n) => n.name === 'Worker' || n.name === 'Contract'),
      false,
    );
    assert.equal(
      graph.edges().some((e) => e.relationship === 'implements'),
      false,
    );
  } finally {
    graph.close();
  }
});
