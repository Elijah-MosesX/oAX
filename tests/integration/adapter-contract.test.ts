import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { request, messageSchema, type Response } from '@oax/protocol';
import { RuntimeClient } from '@oax/runtime/client';
import { frames, FrameWriter } from '@oax/runtime/transport';
import { observation, fixtureRoot } from '../helpers.js';
import type { GraphResult } from '@oax/codegraph';

test('second-editor bridge reuses protocol validation and deterministic graph results while rejecting scope and writes', async () => {
  const child = spawn(
    process.execPath,
    [path.resolve('dist/cli.cjs'), 'editor-bridge', fixtureRoot],
    { stdio: 'pipe', windowsHide: true },
  );
  child.stderr.resume();
  const reader = frames(child.stdout)[Symbol.asyncIterator]();
  const writer = new FrameWriter(child.stdin);
  const direct = await RuntimeClient.connect(
    path.resolve('dist/cli.cjs'),
    fixtureRoot,
  );
  const next = async () => {
    const message = messageSchema.parse((await reader.next()).value);
    assert.equal(message.type, 'response');
    return message as Response;
  };
  try {
    const bootstrap = await next();
    assert.ok(bootstrap.ok);
    const identity = bootstrap.payload as {
      workspaceId: string;
      sessionId: string;
      engine: string;
      methods: string[];
    };
    assert.equal(identity.engine, 'mock');
    assert.ok(!identity.methods.includes('refactor.apply'));
    const input = observation();
    const { sessionId } = (await direct.call('session.open', {})) as {
      sessionId: string;
    };
    const expected = (await direct.call(
      'graph.query',
      { observation: input, relationship: 'callers' },
      sessionId,
    )) as GraphResult;
    const req = request(
      identity.workspaceId,
      'graph.query',
      { observation: input, relationship: 'callers' },
      identity.sessionId,
    );
    await writer.send(req);
    const response = await next();
    assert.ok(response.ok);
    assert.equal(response.correlationId, req.id);
    assert.equal(
      'sessionId' in response,
      false,
      'Protocol 0.1 responses correlate to scoped requests; session IDs belong in requests/events',
    );
    assert.deepEqual(
      response.payload,
      expected,
      'Editor-independent graph contracts must return the same evidence',
    );
    await writer.send(req);
    const duplicate = await next();
    assert.ok(!duplicate.ok && duplicate.error.code === 'DUPLICATE_REQUEST');
    await writer.send(
      request(
        'foreign',
        'graph.query',
        { observation: input, relationship: 'callers' },
        identity.sessionId,
      ),
    );
    const foreign = await next();
    assert.ok(!foreign.ok && foreign.error.code === 'SCOPE_MISMATCH');
    await writer.send(
      request(identity.workspaceId, 'refactor.apply', {}, identity.sessionId),
    );
    const denied = await next();
    assert.ok(!denied.ok && denied.error.code === 'UNSUPPORTED_METHOD');
    await writer.send(
      request(
        identity.workspaceId,
        'graph.query',
        {
          observation: { ...input, documentVersion: 0 },
          relationship: 'callers',
        },
        identity.sessionId,
      ),
    );
    const malformed = await next();
    assert.ok(!malformed.ok && malformed.error.code === 'INVALID_PARAMS');
    await writer.send({
      ...request(identity.workspaceId, 'index.status', {}, identity.sessionId),
      version: 'future',
    });
    assert.equal(
      (await reader.next()).done,
      true,
      'Unsupported protocol versions close the private bridge',
    );
  } finally {
    direct.dispose();
    child.kill();
  }
});
