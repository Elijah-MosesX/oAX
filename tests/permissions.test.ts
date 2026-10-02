import test from 'node:test';
import assert from 'node:assert/strict';
import { PermissionEngine, type Action } from '@oax/permissions';
test('only matching nonexpired grants authorize execution; deny wins', async () => {
  const policy = new PermissionEngine(() => 1000);
  const action: Action = {
    principal: 'editor',
    workspaceId: 'w',
    sessionId: 's',
    taskId: 't',
    capability: 'workspace.write',
    resource: 'example.ts',
  };
  let calls = 0;
  const operation = async () => ++calls;
  await assert.rejects(policy.execute(action, operation));
  policy.grant({ ...action, id: 'expired', expiresAt: 999, decision: 'allow' });
  await assert.rejects(policy.execute(action, operation));
  policy.grant({ ...action, id: 'valid', expiresAt: 2000, decision: 'allow' });
  for (const mismatch of [
    { principal: 'other' },
    { workspaceId: 'other' },
    { sessionId: 'other' },
    { taskId: 'other' },
    { capability: 'terminal.execute' as const },
    { resource: 'other.ts' },
  ])
    await assert.rejects(policy.execute({ ...action, ...mismatch }, operation));
  assert.equal(calls, 0);
  assert.equal(await policy.execute(action, operation), 1);
  assert.equal(await policy.execute(action, operation), 2);
  policy.grant({ ...action, id: 'deny', expiresAt: 2000, decision: 'deny' });
  await assert.rejects(policy.execute(action, operation));
  assert.equal(calls, 2);
  assert.equal(policy.audit.at(-1)?.outcome, 'deny');
  const records = policy.audit;
  records.length = 0;
  assert.ok(policy.audit.length > 0);
});
test('failed operations are audited and session cleanup removes grants', async () => {
  const policy = new PermissionEngine();
  const action: Action = {
    principal: 'editor',
    workspaceId: 'w',
    sessionId: 's',
    taskId: 't',
    capability: 'workspace.read',
    resource: 'example.ts',
  };
  policy.grant({
    ...action,
    id: 'valid',
    expiresAt: Date.now() + 1000,
    decision: 'allow',
  });
  await assert.rejects(
    policy.execute(action, async () => {
      throw new Error('operation failed');
    }),
  );
  assert.equal(policy.audit.at(-1)?.outcome, 'failed');
  policy.close('s');
  await assert.rejects(policy.execute(action, async () => true));
});
