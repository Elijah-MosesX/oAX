import test from 'node:test';
import assert from 'node:assert/strict';
import { CodeGraph } from '@oax/codegraph';
test('calls inside variable initializers belong to their enclosing callable, not the result variable', () => {
  const graph = new CodeGraph();
  try {
    graph.update([
      {
        path: 'a.ts',
        text: 'function target() {} function caller() { const value = target(); return value; } const arrow = () => { const value = target(); };',
      },
    ]);
    const target = graph.nodes().find((node) => node.name === 'target')!;
    assert.deepEqual(
      graph
        .related(target.id, 'callers')
        .relationships.map((item) => item.node?.name)
        .sort(),
      ['arrow', 'caller'],
    );
  } finally {
    graph.close();
  }
});
test('exports and reexports retain alias targets and invalidate removed modules', () => {
  const graph = new CodeGraph();
  try {
    const sources = [
      { path: 'a.ts', text: 'export function greet() { return 1; }' },
      {
        path: 'barrel.ts',
        text: 'export { greet as hello } from "./a"; export * from "./missing";',
      },
      {
        path: 'local.ts',
        text: 'function privateName() {} export { privateName as publicName }; export default privateName;',
      },
    ];
    graph.update(sources);
    const greet = graph.nodes().find((node) => node.name === 'greet')!;
    const exports = graph
      .edges()
      .filter(
        (edge) => edge.relationship === 'exports' && edge.target === greet.id,
      );
    assert.deepEqual(exports.map((edge) => edge.evidence.path).sort(), [
      'a.ts',
      'barrel.ts',
    ]);
    assert.ok(exports.every((edge) => edge.resolution === 'semantic'));
    const reexports = graph
      .edges()
      .filter((edge) => edge.relationship === 'reexports');
    assert.ok(
      reexports.some(
        (edge) => edge.target === 'file:a.ts' && edge.resolution === 'semantic',
      ),
    );
    assert.ok(
      reexports.some(
        (edge) => edge.target === null && edge.resolution === 'unresolved',
      ),
    );
    const local = graph.nodes().find((node) => node.name === 'privateName')!;
    assert.equal(
      graph
        .edges()
        .filter(
          (edge) => edge.relationship === 'exports' && edge.target === local.id,
        ).length,
      2,
    );
    graph.update(sources.slice(1));
    assert.equal(
      graph.nodes().some((node) => node.id === greet.id),
      false,
    );
    assert.ok(
      graph
        .edges()
        .some(
          (edge) =>
            edge.relationship === 'reexports' &&
            edge.evidence.text.includes('./a') &&
            edge.target === null,
        ),
    );
  } finally {
    graph.close();
  }
});
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
