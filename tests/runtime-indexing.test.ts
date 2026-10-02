import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Runtime, MockAgentEngine } from '@oax/runtime';
import { request, CAPABILITIES } from '@oax/protocol';
test('runtime continuously indexes changes, renames and deletion without explicit refresh, preserves dirty overlay, and releases watcher on close', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'oax-continuous-index-'));
  const text = 'export function keep() {}\nexport function unsavedOnly() {}';
  await writeFile(path.join(root, 'a.ts'), 'export function diskOnly() {}');
  await writeFile(
    path.join(root, 'b.ts'),
    'import {keep} from "./a"; function caller() {keep();}',
  );
  const runtime = new Runtime({
    root,
    workspaceId: 'workspace',
    token: 'a'.repeat(64),
    engine: new MockAgentEngine(),
    emit: () => {},
    watchIntervalMs: 20,
  });
  const call = (method: string, payload: unknown, sessionId?: string) =>
    runtime.dispatch(request('workspace', method, payload, sessionId));
  try {
    assert.ok(
      (
        await call('initialize', {
          token: 'a'.repeat(64),
          capabilities: [...CAPABILITIES],
        })
      ).ok,
    );
    const opened = await call('session.open', {});
    assert.ok(opened.ok);
    const session = (opened.payload as { sessionId: string }).sessionId;
    assert.ok(
      (
        await call(
          'spatial.observe',
          {
            observation: {
              path: 'a.ts',
              uri: pathToFileURL(path.join(root, 'a.ts')).href,
              text,
              documentVersion: 1,
              dirty: true,
              cursor: { line: 0, column: 17 },
              selection: {
                start: { line: 0, column: 17 },
                end: { line: 0, column: 17 },
              },
              visibleRanges: [],
              openFiles: ['a.ts'],
            },
          },
          session,
        )
      ).ok,
    );
    const status = async () => {
      const response = await call('index.status', {}, session);
      assert.ok(response.ok);
      return response.payload as {
        generation: number;
        files: number;
        symbols: number;
        state: string;
      };
    };
    const wait = async (
      predicate: (state: Awaited<ReturnType<typeof status>>) => boolean,
    ) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        const state = await status();
        if (predicate(state)) return state;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw Error('Background index did not converge');
    };
    const before = await status();
    assert.equal(before.symbols, 3);
    await writeFile(
      path.join(root, 'b.ts'),
      'import {keep} from "./a"; function caller() {keep();} function secondCaller() {keep();}',
    );
    const updated = await wait(
      (state) => state.generation > before.generation && state.symbols === 4,
    );
    await rename(path.join(root, 'b.ts'), path.join(root, 'c.ts'));
    const renamed = await wait(
      (state) => state.generation > updated.generation,
    );
    assert.equal(renamed.files, 2);
    await rm(path.join(root, 'c.ts'));
    const deleted = await wait(
      (state) => state.generation > renamed.generation && state.files === 1,
    );
    assert.equal(deleted.symbols, 2);
    assert.equal(deleted.state, 'ready');
    await writeFile(
      path.join(root, 'package.json'),
      '{"name":"fixture","exports":"./a.ts"}',
    );
    const configured = await wait(
      (state) => state.generation > deleted.generation,
    );
    assert.equal(configured.symbols, 2);
    assert.equal(
      configured.files,
      1,
      'Metadata changes invalidate the graph without adding source-file nodes',
    );
    assert.ok((await call('session.close', {}, session)).ok);
    assert.equal((await call('index.status', {}, session)).ok, false);
  } finally {
    await runtime.stop();
    if (
      path.dirname(root) !== tmpdir() ||
      !path.basename(root).startsWith('oax-continuous-index-')
    )
      throw Error('Unexpected cleanup path');
    await rm(root, { recursive: true, force: true });
  }
});
