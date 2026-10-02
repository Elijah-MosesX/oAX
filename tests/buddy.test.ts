import test from 'node:test';
import assert from 'node:assert/strict';
import { BuddyStore, buddyLabel } from '@oax/buddy';
import { eventSchema, type Event } from '@oax/protocol';
function event(
  sequence: number,
  method: string,
  payload: unknown,
  sessionId = 's',
  taskId = 't',
  workspaceId = 'w',
): Event {
  return eventSchema.parse({
    id: `e${sequence}`,
    type: 'event',
    version: '0.1',
    timestamp: new Date().toISOString(),
    correlationId: 'request',
    workspaceId,
    sessionId,
    taskId,
    sequence,
    method,
    payload,
  });
}
test('Buddy projects actual task lifecycle without mistaking completed provider items for a completed task', () => {
  const store = new BuddyStore();
  store.register('s', '/repo', 'Codex');
  store.observe(event(1, 'task.state', { state: 'created' }));
  store.observe(event(2, 'task.state', { state: 'executing' }));
  store.observe(
    event(3, 'agent.activity', { kind: 'message', state: 'completed' }),
  );
  assert.equal(buddyLabel(store.snapshot().sessions[0]!), 'Working');
  store.observe(event(4, 'agent.delta', { text: 'secret repository source' }));
  assert.ok(!JSON.stringify(store.snapshot()).includes('secret'));
  store.observe(event(5, 'agent.activity', { kind: 'tool', state: 'denied' }));
  assert.equal(store.snapshot().sessions[0]!.activity?.state, 'denied');
  store.observe(event(6, 'task.state', { state: 'completed' }));
  assert.equal(buddyLabel(store.snapshot().sessions[0]!), 'Task completed');
  assert.equal(store.snapshot().sessions[0]!.result, undefined);
});
test('Buddy isolates sessions/workspaces, ignores duplicate and late task events, and returns detached snapshots', () => {
  const store = new BuddyStore();
  store.register('s', '/one', 'mock');
  store.register('other', '/two', 'Codex');
  store.observe(event(1, 'task.state', { state: 'created' }));
  store.observe(event(1, 'task.state', { state: 'failed' }));
  store.observe(
    event(2, 'task.state', { state: 'failed' }, 's', 't', 'foreign'),
  );
  store.observe(event(3, 'task.state', { state: 'completed' }, 'unknown'));
  assert.equal(store.snapshot().sessions[0]!.phase, 'created');
  store.observe(event(4, 'task.state', { state: 'created' }, 's', 'next'));
  store.observe(event(5, 'task.state', { state: 'failed' }));
  assert.equal(store.snapshot().sessions[0]!.taskId, 'next');
  assert.equal(store.snapshot().sessions[1]!.phase, 'idle');
  const view = store.snapshot();
  view.sessions[0]!.phase = 'completed';
  assert.equal(store.snapshot().sessions[0]!.phase, 'created');
});
test('Buddy cursor requires an accepted current event and clears on changed source and disconnection', () => {
  const store = new BuddyStore();
  store.register('s', '/repo', 'Codex');
  store.observe(event(1, 'task.state', { state: 'created' }));
  const cursor = event(2, 'agent.cursor.changed', {
    mode: 'investigating',
    path: 'one.ts',
    range: { start: { line: 0, column: 0 }, end: { line: 0, column: 8 } },
    contentHash: 'a'.repeat(64),
    documentVersion: 2,
  });
  assert.equal(cursor.method, 'agent.cursor.changed');
  if (cursor.method !== 'agent.cursor.changed') return;
  store.locationAccepted(cursor);
  assert.equal(store.snapshot().sessions[0]!.location, undefined);
  store.observe(cursor);
  assert.equal(store.snapshot().sessions[0]!.location, undefined);
  store.locationAccepted(cursor);
  assert.equal(store.snapshot().sessions[0]!.location?.path, 'one.ts');
  store.clearLocations();
  assert.equal(store.snapshot().sessions[0]!.location, undefined);
  store.disconnect('s');
  store.locationAccepted(cursor);
  store.observe(event(3, 'task.state', { state: 'executing' }));
  assert.equal(buddyLabel(store.snapshot().sessions[0]!), 'Disconnected');
});
test('Buddy prompt presentation never advances execution and review verification is distinct from task success', () => {
  const store = new BuddyStore();
  store.register('s', '/repo', 'Codex');
  store.showPrompt({ title: 'Approve exact diff?', action: 'Apply edit' });
  assert.equal(store.snapshot().sessions[0]!.phase, 'idle');
  store.showPrompt();
  store.editing('s', true);
  assert.equal(
    buddyLabel(store.snapshot().sessions[0]!),
    'Applying approved edit',
  );
  store.editing('s', false);
  store.result('s', {
    label: 'Edit current; verification incomplete',
    paths: ['one.ts'],
    verified: false,
  });
  assert.equal(store.snapshot().sessions[0]!.result?.verified, false);
  store.result('s', {
    label: 'Approved tests passed',
    paths: ['one.ts', 'one.test.mjs'],
    verified: true,
  });
  store.invalidate('/other', 'one.ts');
  assert.equal(store.snapshot().sessions[0]!.result?.verified, true);
  store.invalidate('/repo', 'one.test.mjs');
  assert.equal(store.snapshot().sessions[0]!.result?.verified, false);
});
test('Buddy retains failure/cancellation and releases observers and bounded state without controlling sessions', () => {
  const store = new BuddyStore();
  let notifications = 0;
  const remove = store.subscribe(() => notifications++);
  store.register('s', '/repo', 'mock');
  store.observe(event(1, 'task.state', { state: 'created' }));
  store.observe(event(2, 'task.state', { state: 'cancelled' }));
  assert.equal(buddyLabel(store.snapshot().sessions[0]!), 'Task cancelled');
  store.observe(event(3, 'task.state', { state: 'created' }, 's', 'next'));
  store.observe(event(4, 'task.state', { state: 'failed' }, 's', 'next'));
  assert.equal(buddyLabel(store.snapshot().sessions[0]!), 'Task failed');
  remove();
  const before = notifications;
  for (let i = 0; i < 40; i++) store.register(`s${i}`, '/repo', 'mock');
  assert.equal(store.snapshot().sessions.length, 32);
  assert.equal(notifications, before);
  store.dispose();
  store.observe(event(5, 'task.state', { state: 'created' }));
  assert.deepEqual(store.snapshot(), { sessions: [] });
});
