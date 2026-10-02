import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPABILITIES,
  OaxError,
  eventSchema,
  messageSchema,
  payloadSchemas,
  request,
  validateRequest,
} from '@oax/protocol';
import { observation } from './helpers.js';
test('request contracts reject malformed versions, scope, params, and extra fields', () => {
  const req = request(
    'workspace',
    'selection.explain',
    { observation: observation(), objective: 'Explain' },
    'session',
  );
  assert.deepEqual(validateRequest(req), req);
  for (const malformed of [
    { ...req, version: '2' },
    { ...req, id: '' },
    { ...req, timestamp: 'yesterday' },
    { ...req, trusted: true },
  ])
    assert.throws(() => validateRequest(malformed), OaxError);
  assert.equal(
    payloadSchemas['selection.explain'].safeParse(req.payload).success,
    true,
  );
  assert.equal(
    payloadSchemas['selection.explain'].safeParse({
      observation: { ...observation(), documentVersion: 0 },
      objective: 'Explain',
    }).success,
    false,
  );
  assert.equal(
    payloadSchemas['selection.explain'].safeParse({
      observation: { ...observation(), cursor: { line: -1, column: 0 } },
      objective: 'Explain',
    }).success,
    false,
  );
  assert.ok(CAPABILITIES.includes('agent.mock.explain.v1'));
});
test('responses require discriminated success/error and events require ordering', () => {
  const base = {
    id: 'response',
    version: '0.1',
    type: 'response',
    timestamp: new Date().toISOString(),
    workspaceId: 'workspace',
    correlationId: 'request',
  };
  assert.equal(
    messageSchema.safeParse({ ...base, ok: true, payload: {} }).success,
    true,
  );
  assert.equal(
    messageSchema.safeParse({
      ...base,
      ok: false,
      error: { code: 'DENIED', message: 'Denied' },
    }).success,
    true,
  );
  assert.equal(
    messageSchema.safeParse({
      ...base,
      ok: true,
      error: { code: 'DENIED', message: 'Denied' },
    }).success,
    false,
  );
  assert.equal(
    eventSchema.safeParse({
      ...base,
      type: 'event',
      method: 'task.state',
      sessionId: 's',
      taskId: 't',
      payload: { state: 'completed' },
    }).success,
    false,
  );
});
