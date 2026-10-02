import test from 'node:test';
import assert from 'node:assert/strict';
import { CodeGraph } from '@oax/codegraph';
test('Node ESM and CJS extensions, dynamic imports and TS import-equals retain module evidence', () => {
  const graph = new CodeGraph();
  try {
    graph.update([
      { path: 'a.mts', text: 'export function run() {}' },
      {
        path: 'b.mts',
        text: 'import {run} from "./a.mjs"; function caller() {run();} import("./a.mjs");',
      },
      { path: 'c.cts', text: 'import module = require("./a.mjs");' },
      { path: 'plain.mjs', text: 'export const value = 1;' },
      { path: 'plain.cjs', text: 'const value = 2;' },
    ]);
    assert.equal(
      graph.nodes().filter((node) => node.kind === 'file').length,
      5,
    );
    const run = graph.nodes().find((node) => node.name === 'run')!;
    assert.equal(
      graph.related(run.id, 'callers').relationships[0]?.node?.name,
      'caller',
    );
    assert.equal(
      graph
        .edges()
        .filter(
          (edge) =>
            edge.relationship === 'imports' && edge.target === 'file:a.mts',
        ).length,
      3,
    );
  } finally {
    graph.close();
  }
});

test('workspace exports, nested aliases and local inherited configuration resolve real semantic callers and invalidate on metadata changes', () => {
  const graph = new CodeGraph();
  const sources = [
    { path: 'lib/a.ts', text: 'export function greet() {}' },
    { path: 'lib/b.ts', text: 'export function other() {}' },
    {
      path: 'app/caller.ts',
      text: 'import {greet as hello} from "@local/core"; import {greet} from "@lib/a"; export function caller() { hello(); greet(); }',
    },
    {
      path: 'nested/caller.ts',
      text: 'import {other} from "@lib/a"; function nestedCaller() {other();}',
    },
  ];
  const metadata = [
    {
      path: 'package.json',
      text: JSON.stringify({
        name: '@local/core',
        exports: { '.': './lib/a.ts', './other': { types: './lib/b.ts' } },
      }),
    },
    {
      path: 'tsconfig.base.json',
      text: '{"compilerOptions":{"baseUrl":".","paths":{"@lib/*":["lib/*"]}}}',
    },
    {
      path: 'tsconfig.json',
      text: '{/* JSONC */ "extends":"./tsconfig.base.json"}',
    },
    {
      path: 'nested/tsconfig.json',
      text: '{"compilerOptions":{"paths":{"@lib/a":["../lib/b.ts"]}}}',
    },
  ];
  try {
    graph.update(sources, metadata);
    const greet = graph.nodes().find((node) => node.name === 'greet')!;
    const other = graph.nodes().find((node) => node.name === 'other')!;
    assert.equal(graph.related(greet.id, 'callers').relationships.length, 2);
    assert.equal(
      graph.related(other.id, 'callers').relationships[0]?.node?.name,
      'nestedCaller',
    );
    assert.ok(
      graph
        .related(greet.id, 'callers')
        .relationships.every((item) => item.edge.resolution === 'semantic'),
    );
    const changed = metadata.map((file) =>
      file.path === 'package.json'
        ? { ...file, text: '{"name":"@local/core","exports":"./lib/b.ts"}' }
        : file,
    );
    assert.equal(graph.update(sources, changed).changed, 1);
    assert.equal(graph.related(greet.id, 'callers').relationships.length, 1);
    assert.ok(
      graph
        .edges()
        .some(
          (edge) =>
            edge.relationship === 'calls' &&
            edge.target === null &&
            edge.evidence.text === 'hello',
        ),
    );
    assert.equal(graph.update(sources, changed).changed, 0);
  } finally {
    graph.close();
  }
});

test('ambiguous packages, outside-workspace config targets and inherited cycles never become proven edges', () => {
  const graph = new CodeGraph();
  try {
    graph.update(
      [
        { path: 'a.ts', text: 'export function secret() {}' },
        {
          path: 'b.ts',
          text: 'import {secret} from "duplicate"; import {secret as outside} from "outside"; secret(); outside();',
        },
      ],
      [
        {
          path: 'one/package.json',
          text: '{"name":"duplicate","exports":"../a.ts"}',
        },
        {
          path: 'two/package.json',
          text: '{"name":"duplicate","exports":"../a.ts"}',
        },
        {
          path: 'tsconfig.json',
          text: '{"extends":"./tsconfig.loop.json","compilerOptions":{"baseUrl":"../../outside","paths":{"outside":["a.ts"]}}}',
        },
        { path: 'tsconfig.loop.json', text: '{"extends":"./tsconfig.json"}' },
      ],
    );
    const imports = graph
      .edges()
      .filter((edge) => edge.relationship === 'imports');
    assert.equal(imports.length, 2);
    assert.ok(
      imports.every(
        (edge) => edge.target === null && edge.resolution === 'unresolved',
      ),
    );
    assert.ok(graph.limitations.some((item) => item.includes('cycle')));
  } finally {
    graph.close();
  }
});
