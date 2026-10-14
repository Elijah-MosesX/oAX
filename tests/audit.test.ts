import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PermissionEngine, type Action } from '@oax/permissions';
import { openAudit } from '../packages/runtime/src/audit.js';

test('durable authorization journal survives closure without raw resources or source', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'oax-audit-'));
  const journal = await openAudit(root);
  const policy = new PermissionEngine(Date.now, journal.record);
  const action: Action = {
    principal: 'editor',
    workspaceId: 'w',
    sessionId: 's',
    taskId: 'plan-hash',
    capability: 'workspace.write',
    resource: 'secret-resource.ts',
  };
  try {
    await assert.rejects(
      policy.execute(action, async () => assert.fail('Denied operation ran')),
    );
    policy.grant({
      ...action,
      id: 'exact-grant',
      decision: 'allow',
      expiresAt: Date.now() + 10000,
    });
    await policy.execute(action, async () => true);
    await assert.rejects(
      policy.execute(action, async () => {
        throw new Error('sensitive output');
      }),
    );
    await journal.close();
    const text = await readFile(journal.file, 'utf8');
    assert.ok(
      !text.includes('secret-resource') && !text.includes('sensitive output'),
    );
    const records = text
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.deepEqual(
      records.map((record) => record.outcome),
      ['deny', 'granted', 'allow', 'completed', 'allow', 'failed'],
    );
    assert.deepEqual(
      records.map((record) => record.sequence),
      [1, 2, 3, 4, 5, 6],
    );
    assert.equal(records[1].grantId, 'exact-grant');
    assert.equal(records[1].action.taskId, 'plan-hash');
    let calls = 0;
    await assert.rejects(policy.execute(action, async () => ++calls));
    assert.equal(calls, 0, 'Journal failure must prevent execution');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('audit refuses a redirected private directory', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'oax-audit-link-'));
  const outside = await mkdtemp(path.join(tmpdir(), 'oax-audit-outside-'));
  try {
    await mkdir(path.join(outside, 'audit'));
    await symlink(
      outside,
      path.join(root, '.oax'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await assert.rejects(openAudit(root), /ordinary workspace directory/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
