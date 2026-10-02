import test from 'node:test';
import assert from 'node:assert/strict';
import { PermissionEngine } from '@oax/permissions';
import { snapshotPage } from '../packages/browser/src/snapshot.js';
import {
  JevPlanner,
  jevPageSchema,
  jevContextAction,
  jevContext,
} from '../packages/browser/src/jev.js';
const page = {
  url: 'http://localhost:3000/',
  title: 'Fixture',
  text: 'Continue',
  actions: [
    { id: 'button1', kind: 'click' as const, node: '1', label: 'Continue' },
  ],
};
const scope = {
  principal: 'test',
  workspaceId: 'w',
  sessionId: 's',
  taskId: 't',
};
test('Chrome snapshot projection uses observed UIDs and matching URL; disabled elements are omitted', () => {
  const evidence = {
    content: [
      {
        type: 'text',
        text: 'uid=1_0 RootWebArea "Fixture" url="http://localhost:3000/"\n  uid=1_1 button "Continue"\n  uid=1_2 button "Disabled" disabled',
      },
    ],
  };
  const observed = snapshotPage(evidence, page.url);
  assert.deepEqual(
    observed.actions.map((action) => action.id),
    ['1_1'],
  );
  assert.throws(
    () => snapshotPage(evidence, 'http://localhost:3000/other'),
    /URL/,
  );
});
test('Jev disclosure strips URL queries and known secrets before approval and transmission', () => {
  const data = jevContext(
    {
      ...page,
      url: 'http://localhost:3000/?token=private#secret',
      text: 'Bearer abc1234567890',
    },
    'Continue',
  );
  assert.equal(data.page.url, 'http://localhost:3000/');
  assert.equal(data.page.text, 'Bearer [REDACTED]');
});
test('Jev accepts bounded observed action spaces and rejects invented or ambiguous operations', () => {
  assert.equal(jevPageSchema.parse(page).actions.length, 1);
  for (const input of [
    { ...page, actions: [...page.actions, ...page.actions] },
    { ...page, url: 'file:///secret' },
    { ...page, url: 'https://user:password@example.com/' },
    { ...page, actions: [{ id: 'x', kind: 'evaluate', label: 'eval' }] },
    { ...page, actions: [{ id: 'x', kind: 'click', label: 'missing node' }] },
    { ...page, text: 'x'.repeat(16001) },
  ])
    assert.throws(() => jevPageSchema.parse(input));
});
test('Jev transmission approval binds exact page and goal; missing permission fails before installation or request', async () => {
  const action = jevContextAction(scope, page, 'Continue');
  assert.notEqual(
    action.resource,
    jevContextAction(scope, { ...page, text: 'Changed' }, 'Continue').resource,
  );
  assert.notEqual(
    action.resource,
    jevContextAction(scope, page, 'Submit').resource,
  );
  const policy = new PermissionEngine();
  await assert.rejects(
    new JevPlanner('nonexistent').predict(page, 'Continue', policy, scope),
    /authorization/,
  );
  assert.equal(policy.audit.at(-1)?.outcome, 'deny');
});
