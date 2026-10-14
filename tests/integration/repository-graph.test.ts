import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { RuntimeClient } from '@oax/runtime/client';
import type { GraphResult } from '@oax/codegraph';
const execute = promisify(execFile);

test('actual oAX repository indexing answers semantic callers and importers over validated stdio and the built CLI', async () => {
  const root = path.resolve('.');
  const resource = 'packages/context/src/index.ts';
  const absolute = path.join(root, resource);
  const text = await readFile(absolute, 'utf8');
  const offset = text.indexOf('function offset(') + 'function '.length;
  assert.ok(offset >= 'function '.length);
  const prefix = text.slice(0, offset).split('\n');
  const position = { line: prefix.length - 1, column: prefix.at(-1)!.length };
  const observation = {
    path: resource,
    uri: pathToFileURL(absolute).href,
    text,
    documentVersion: 1,
    dirty: false,
    cursor: position,
    selection: { start: position, end: position },
    visibleRanges: [],
    openFiles: [resource],
  };
  const client = await RuntimeClient.connect(
    path.resolve('dist/cli.cjs'),
    root,
  );
  try {
    const { sessionId } = (await client.call('session.open', {})) as {
      sessionId: string;
    };
    const callers = (await client.call(
      'graph.query',
      { observation, relationship: 'callers' },
      sessionId,
    )) as GraphResult;
    assert.equal(callers.node?.name, 'offset');
    assert.ok(
      callers.relationships.some(
        (item) =>
          item.node?.name === 'selectionEditPlan' &&
          item.node.path === 'packages/runtime/src/refactor.ts',
      ),
    );
    assert.ok(
      callers.relationships.every(
        (item) =>
          item.edge.resolution === 'semantic' &&
          item.edge.evidence.range.start.line >= 0,
      ),
    );
    const imports = (await client.call(
      'graph.query',
      { observation, relationship: 'imports' },
      sessionId,
    )) as GraphResult;
    assert.ok(
      imports.relationships.some(
        (item) => item.node?.path === 'packages/runtime/src/refactor.ts',
      ),
    );
    const engineResource = 'packages/runtime/src/engine.ts';
    const engineText = await readFile(path.join(root, engineResource), 'utf8');
    const engineOffset =
      engineText.indexOf('interface AgentEngine') + 'interface '.length;
    const enginePrefix = engineText.slice(0, engineOffset).split('\n');
    const enginePosition = {
      line: enginePrefix.length - 1,
      column: enginePrefix.at(-1)!.length,
    };
    const implementations = (await client.call(
      'graph.query',
      {
        observation: {
          ...observation,
          path: engineResource,
          uri: pathToFileURL(path.join(root, engineResource)).href,
          text: engineText,
          cursor: enginePosition,
          selection: { start: enginePosition, end: enginePosition },
        },
        relationship: 'implements',
      },
      sessionId,
    )) as GraphResult;
    assert.equal(implementations.node?.name, 'AgentEngine');
    assert.ok(
      implementations.relationships.some(
        (item) => item.node?.name === 'MockAgentEngine',
      ),
    );
    assert.ok(
      implementations.relationships.some(
        (item) => item.node?.name === 'CodexAgentEngine',
      ),
    );
    assert.ok(
      implementations.relationships.every(
        (item) => item.edge.resolution === 'semantic',
      ),
    );
    const status = (await client.call('index.status', {}, sessionId)) as {
      files: number;
      symbols: number;
      state: string;
    };
    assert.equal(status.state, 'ready');
    assert.ok(status.files >= 50 && status.symbols >= 900);
    await client.call('session.close', {}, sessionId);
    const cli = await execute(
      process.execPath,
      [
        path.resolve('dist/cli.cjs'),
        'query',
        'callers',
        resource,
        String(position.line),
        String(position.column),
      ],
      { cwd: root, windowsHide: true, timeout: 30000, maxBuffer: 262144 },
    );
    const result = JSON.parse(cli.stdout) as GraphResult;
    assert.equal(result.node?.name, 'offset');
    assert.ok(
      result.relationships.some(
        (item) => item.node?.name === 'selectionEditPlan',
      ),
    );
    console.log(
      `Actual repository: ${status.files} indexed source files, ${status.symbols} symbols; offset callers and context importers verified.`,
    );
  } finally {
    client.dispose();
  }
});
