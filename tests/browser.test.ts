import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserInspector, browserAction } from '@oax/browser';
import { PermissionEngine } from '@oax/permissions';
test('browser capabilities bind origin, tool, page, arguments, principal, and expiration', async () => {
  const permissions = new PermissionEngine();
  const scope = {
    principal: 'fixture',
    workspaceId: 'workspace',
    sessionId: 'session',
    taskId: 'task',
  };
  const origin = 'http://127.0.0.1:5000';
  const action = browserAction(scope, origin, 'take_snapshot', { pageId: 2 });
  permissions.grant({
    ...action,
    id: 'read',
    decision: 'allow',
    expiresAt: Date.now() + 10000,
  });
  assert.equal(
    await permissions.execute(action, async () => 'allowed'),
    'allowed',
  );
  for (const denied of [
    browserAction(scope, origin, 'take_snapshot', { pageId: 3 }),
    browserAction(scope, 'http://127.0.0.1:5001', 'take_snapshot', {
      pageId: 2,
    }),
    browserAction(scope, origin, 'new_page', { url: origin }),
    { ...action, principal: 'other' },
  ])
    await assert.rejects(
      permissions.execute(denied, async () => 'should not run'),
    );
  assert.throws(
    () =>
      new BrowserInspector({
        serverEntry: 'unused',
        chromeExecutable: 'unused',
        origin: 'https://user:password@example.com',
        permissions,
        scope,
      }),
  );
});
