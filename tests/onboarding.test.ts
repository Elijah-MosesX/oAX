import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CodeGraph } from '@oax/codegraph';
import { onboarding } from '../packages/runtime/src/onboarding.js';
test('onboarding distinguishes deterministic file/symbol evidence from heuristic entrypoints and tests', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'oax-onboard-'));
  const graph = new CodeGraph();
  try {
    await writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ dependencies: { example: '1.0.0' } }),
    );
    graph.update([
      { path: 'index.ts', text: 'export function entry() {}' },
      {
        path: 'index.test.ts',
        text: 'import {entry} from "./index"; entry();',
      },
    ]);
    const report = await onboarding(root, graph, ['.env']);
    assert.equal(report.files, 2);
    assert.equal(report.symbols, 1);
    assert.equal(report.entrypointCandidates[0]?.basis, 'filename heuristic');
    assert.equal(report.tests[0]?.basis, 'filename heuristic');
    assert.deepEqual(report.dependencies, ['example']);
    assert.equal(report.resolvedImports, 1);
    assert.deepEqual(report.exclusions, ['.env']);
  } finally {
    graph.close();
    await rm(root, { recursive: true, force: true });
  }
});
