import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CodeGraph } from '@oax/codegraph';
import { PermissionEngine } from '@oax/permissions';
import { renamePlan, applyRename } from '../packages/runtime/src/refactor.js';
test('semantic rename previews preserve aliases and unrelated names; grants and baseline conflicts prevent writes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'oax-rename-'));
  const graph = new CodeGraph();
  const permissions = new PermissionEngine();
  const scope = {
    principal: 'fixture',
    workspaceId: 'workspace',
    sessionId: 'session',
    taskId: 'plan',
  };
  try {
    graph.update([
      {
        path: 'conflict.ts',
        text: 'export function greet() {} function welcome() {}',
      },
    ]);
    assert.throws(() =>
      graph.rename('conflict.ts', { line: 0, column: 17 }, 'welcome'),
    );
    const sources = [
      { path: 'a.ts', text: 'export function greet() { return 1; }' },
      {
        path: 'b.ts',
        text: 'import {greet as hello} from "./a"; hello(); function greet() { return 2; } greet();',
      },
    ];
    for (const source of sources)
      await writeFile(path.join(root, source.path), source.text);
    graph.update(sources);
    const changes = graph.rename('a.ts', { line: 0, column: 17 }, 'welcome');
    const plan = renamePlan('plan', changes);
    assert.match(
      changes.find((change) => change.path === 'b.ts')!.after,
      /welcome as hello/,
    );
    assert.match(
      changes.find((change) => change.path === 'b.ts')!.after,
      /function greet/,
    );
    await assert.rejects(applyRename(root, plan, permissions, scope));
    assert.equal(
      await readFile(path.join(root, 'a.ts'), 'utf8'),
      sources[0]!.text,
    );
    for (const change of changes)
      permissions.grant({
        ...scope,
        id: change.path,
        capability: 'workspace.write',
        resource: change.path,
        decision: 'allow',
        expiresAt: plan.expiresAt,
      });
    await writeFile(
      path.join(root, 'b.ts'),
      sources[1]!.text + ' // user change',
    );
    await assert.rejects(applyRename(root, plan, permissions, scope));
    assert.equal(
      await readFile(path.join(root, 'a.ts'), 'utf8'),
      sources[0]!.text,
    );
    await writeFile(path.join(root, 'b.ts'), sources[1]!.text);
    const result = await applyRename(root, plan, permissions, scope);
    assert.deepEqual(result.files, ['a.ts', 'b.ts']);
    assert.match(
      await readFile(path.join(root, 'a.ts'), 'utf8'),
      /function welcome/,
    );
    await assert.rejects(
      applyRename(root, { ...plan, expiresAt: 0 }, permissions, scope),
    );
  } finally {
    graph.close();
    await rm(root, { recursive: true, force: true });
  }
});
