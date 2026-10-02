import test from 'node:test';
import assert from 'node:assert/strict';
import { activity } from '../packages/codex/src/events.js';
test('provider activity retains lifecycle and rejects tools without copying untrusted content', () => {
  const params = {
    item: { type: 'commandExecution', command: 'SECRET', output: 'SECRET' },
  };
  assert.deepEqual(activity({ method: 'item/started', params }), {
    kind: 'tool',
    state: 'denied',
  });
  assert.deepEqual(activity({ method: 'oax/serverRequestDenied', params }), {
    kind: 'tool',
    state: 'denied',
  });
  for (const type of ['reasoning', 'plan', 'userMessage'])
    assert.equal(
      activity({
        method: 'item/completed',
        params: { item: { type, text: 'SECRET' } },
      }),
      undefined,
    );
  assert.deepEqual(
    activity({
      method: 'item/completed',
      params: { item: { type: 'agentMessage', text: 'SECRET' } },
    }),
    { kind: 'message', state: 'completed' },
  );
  for (const [status, state] of [
    ['completed', 'completed'],
    ['failed', 'failed'],
    ['interrupted', 'cancelled'],
  ])
    assert.deepEqual(
      activity({ method: 'turn/completed', params: { turn: { status } } }),
      { kind: 'turn', state },
    );
  assert.throws(() =>
    activity({
      method: 'turn/completed',
      params: { turn: { status: 'unknown' } },
    }),
  );
  assert.throws(() => activity({ method: 'item/started', params: {} }));
});
