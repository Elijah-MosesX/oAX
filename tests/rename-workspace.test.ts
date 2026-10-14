import test from 'node:test';
import assert from 'node:assert/strict';
import { CodeGraph } from '@oax/codegraph';
import { OaxError } from '@oax/protocol';
test('rename verification keeps workspace package resolution and reports conflicts as typed errors', () => {
  const graph = new CodeGraph();
  try {
    graph.update(
      [
        {
          path: 'packages/core/src/index.ts',
          text: 'export function greet(): string { return "hi"; }\nexport const taken = 1;\n',
        },
        {
          path: 'apps/app/src/main.ts',
          text: 'import { greet } from "@local/core";\nexport function run() { return greet(); }\n',
        },
      ],
      [
        {
          path: 'packages/core/package.json',
          text: JSON.stringify({
            name: '@local/core',
            exports: './src/index.ts',
          }),
        },
        {
          path: 'apps/app/package.json',
          text: JSON.stringify({
            name: '@local/app',
            dependencies: { '@local/core': 'workspace:*' },
          }),
        },
      ],
    );
    const changes = graph.rename(
      'packages/core/src/index.ts',
      { line: 0, column: 16 },
      'welcome',
    );
    assert.deepEqual(
      changes.map((c) => c.path),
      ['apps/app/src/main.ts', 'packages/core/src/index.ts'],
    );
    assert.match(changes[0]!.after, /import \{ welcome \} from "@local\/core"/);
    assert.throws(
      () =>
        graph.rename(
          'packages/core/src/index.ts',
          { line: 0, column: 16 },
          'taken',
        ),
      (error: unknown) =>
        error instanceof OaxError && error.code === 'RENAME_REJECTED',
    );
  } finally {
    graph.close();
  }
});
