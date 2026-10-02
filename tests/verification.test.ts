import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PermissionEngine } from '@oax/permissions';
import {
  prepareChecks,
  executeChecks,
} from '../packages/runtime/src/verification.js';
test('Node verification requires exact grants, checks source freshness, and reports actual pass/fail exits', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'oax-check-'));
  const scope = {
    principal: 'fixture',
    workspaceId: 'workspace',
    sessionId: 'session',
    taskId: 'task',
  };
  const permissions = new PermissionEngine();
  try {
    const file = path.join(root, 'sample.test.js');
    await writeFile(
      file,
      'const {test} = require("node:test"); test("synthetic", () => {});',
    );
    const plan = await prepareChecks(root, 'sample.test.js', 'task');
    const output: string[] = [];
    await assert.rejects(
      executeChecks(
        plan,
        permissions,
        scope,
        new AbortController().signal,
        (text) => output.push(text),
      ),
    );
    assert.equal(output.length, 0);
    permissions.grant({
      ...scope,
      id: 'execute',
      capability: 'terminal.execute',
      resource: `node-test:${plan.hash}`,
      decision: 'allow',
      expiresAt: plan.expiresAt,
    });
    assert.equal(
      (
        await executeChecks(
          plan,
          permissions,
          scope,
          new AbortController().signal,
          (text) => output.push(text),
        )
      ).exitCode,
      0,
    );
    assert.match(output.join(''), /synthetic/);
    await writeFile(file, 'throw new Error("synthetic failure");');
    await assert.rejects(
      executeChecks(
        plan,
        permissions,
        scope,
        new AbortController().signal,
        () => {},
      ),
    );
    const failed = await prepareChecks(root, 'sample.test.js', 'task');
    permissions.grant({
      ...scope,
      id: 'failed',
      capability: 'terminal.execute',
      resource: `node-test:${failed.hash}`,
      decision: 'allow',
      expiresAt: failed.expiresAt,
    });
    assert.notEqual(
      (
        await executeChecks(
          failed,
          permissions,
          scope,
          new AbortController().signal,
          () => {},
        )
      ).exitCode,
      0,
    );
    await writeFile(file, 'setInterval(() => {},1000);');
    const hanging = await prepareChecks(root, 'sample.test.js', 'task');
    permissions.grant({
      ...scope,
      id: 'hanging',
      capability: 'terminal.execute',
      resource: `node-test:${hanging.hash}`,
      decision: 'allow',
      expiresAt: hanging.expiresAt,
    });
    const controller = new AbortController();
    const work = executeChecks(
      hanging,
      permissions,
      scope,
      controller.signal,
      () => {},
    );
    setTimeout(() => controller.abort(), 100);
    await assert.rejects(work);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
