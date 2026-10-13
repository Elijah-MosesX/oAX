import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { serveEditorBridge } from '../apps/cli/src/editor-bridge.js';
import { frames, FrameWriter } from '@oax/runtime/transport';
import {
  OaxError,
  request,
  messageSchema,
  editorAgentBootstrapSchema,
  editorBootstrapSchema,
  type Response,
} from '@oax/protocol';
import { observation } from './helpers.js';

test(
  'Codex bridge permits cancellation while busy and disposes an outstanding task on EOF',
  { timeout: 10000 },
  async () => {
    const input = new PassThrough(),
      output = new PassThrough();
    const writer = new FrameWriter(input),
      reader = frames(output)[Symbol.asyncIterator]();
    let rejectTask: ((error: Error) => void) | undefined;
    const hash = 'a'.repeat(64),
      selection = { observation: observation(), objective: 'Explain' };
    const client: Parameters<typeof serveEditorBridge>[0] = {
      identity: 'workspace',
      call: async (method) => {
        if (method === 'session.open') return { sessionId: 'session' };
        if (method === 'context.preview') return { hash };
        if (method === 'task.cancel')
          setImmediate(() =>
            rejectTask?.(new OaxError('CANCELLED', 'Cancelled')),
          );
        return {};
      },
      explain: async () =>
        new Promise((_, reject) => {
          rejectTask = reject;
        }),
      subscribe: () => () => {},
      onDisconnect: () => () => {},
      dispose: () => rejectTask?.(new OaxError('DISCONNECTED', 'Closed')),
    };
    const running = serveEditorBridge(client, 'codex', input, output);
    const next = async () =>
      messageSchema.parse((await reader.next()).value) as Response;
    const send = async (method: string, payload: unknown) => {
      const req = request('workspace', method, payload, 'session');
      await writer.send(req);
      return req.id;
    };
    await next();
    await send('context.preview', selection);
    await next();
    const task = await send('selection.explain', {
      ...selection,
      approvedContextHash: hash,
    });
    await send('context.preview', selection);
    const busy = await next();
    assert.ok(!busy.ok && busy.error.code === 'BUSY');
    const cancellation = await send('task.cancel', { taskId: 'task' });
    const responses = [await next(), await next()];
    assert.ok(responses.some((r) => r.correlationId === cancellation && r.ok));
    assert.ok(
      responses.some(
        (r) =>
          r.correlationId === task && !r.ok && r.error.code === 'CANCELLED',
      ),
    );
    await send('context.preview', selection);
    await next();
    const last = await send('selection.explain', {
      ...selection,
      approvedContextHash: hash,
    });
    input.end();
    await running;
    const closed = await next();
    assert.ok(
      closed.correlationId === last &&
        !closed.ok &&
        closed.error.code === 'DISCONNECTED',
    );
    output.end();
  },
);

test('Codex bridge requires a fresh one-use preview bound to connection, content and explicit hash', async () => {
  const input = new PassThrough(),
    output = new PassThrough();
  const writer = new FrameWriter(input),
    reader = frames(output)[Symbol.asyncIterator]();
  let time = 100,
    calls = 0,
    disposed = false,
    staleRuntime = false;
  const approved = 'a'.repeat(64);
  const selection = { observation: observation(), objective: 'Explain' };
  const client: Parameters<typeof serveEditorBridge>[0] = {
    identity: 'workspace',
    call: async (method) =>
      method === 'session.open'
        ? { sessionId: 'session' }
        : method === 'context.preview'
          ? { hash: approved, context: {} }
          : {},
    explain: async (session, captured, objective, signal, hash) => {
      calls++;
      assert.equal(session, 'session');
      assert.equal(hash, approved);
      assert.deepEqual(captured, selection.observation);
      assert.equal(objective, selection.objective);
      if (staleRuntime)
        throw new OaxError(
          'PERMISSION_DENIED',
          'Runtime detected changed evidence',
        );
      return 'provider result';
    },
    subscribe: () => () => {},
    onDisconnect: () => () => {},
    dispose: () => {
      disposed = true;
    },
  };
  const running = serveEditorBridge(client, 'codex', input, output, () => time);
  const next = async () =>
    messageSchema.parse((await reader.next()).value) as Response;
  const send = async (
    method: string,
    payload: unknown,
    session = 'session',
  ) => {
    const req = request('workspace', method, payload, session);
    await writer.send(req);
    const result = await next();
    assert.equal(result.correlationId, req.id);
    return result;
  };
  const denied = async (payload: unknown) => {
    const result = await send('selection.explain', payload);
    assert.ok(!result.ok && result.error.code === 'PERMISSION_DENIED');
  };
  const preview = async () =>
    assert.ok((await send('context.preview', selection)).ok);
  try {
    const bootstrap = await next();
    assert.ok(bootstrap.ok);
    assert.equal(
      editorAgentBootstrapSchema.parse(bootstrap.payload).engine,
      'codex',
    );
    assert.equal(
      editorBootstrapSchema.safeParse(bootstrap.payload).success,
      false,
    );
    await denied({ ...selection, approvedContextHash: approved });
    await preview();
    await denied(selection);
    await preview();
    await denied({ ...selection, approvedContextHash: 'b'.repeat(64) });
    await preview();
    await denied({
      ...selection,
      observation: observation('changed'),
      approvedContextHash: approved,
    });
    await preview();
    await denied({
      ...selection,
      objective: 'different',
      approvedContextHash: approved,
    });
    await preview();
    time += 60000;
    await denied({ ...selection, approvedContextHash: approved });
    assert.equal(calls, 0, 'Denied attempts never reach runtime execution');
    await preview();
    const foreign = await send(
      'selection.explain',
      { ...selection, approvedContextHash: approved },
      'foreign',
    );
    assert.ok(!foreign.ok && foreign.error.code === 'SCOPE_MISMATCH');
    const write = await send('refactor.apply', {});
    assert.ok(!write.ok && write.error.code === 'UNSUPPORTED_METHOD');
    assert.ok(
      (
        await send('selection.explain', {
          ...selection,
          approvedContextHash: approved,
        })
      ).ok,
    );
    assert.equal(calls, 1);
    await denied({ ...selection, approvedContextHash: approved });
    assert.equal(calls, 1);
    await preview();
    staleRuntime = true;
    await denied({ ...selection, approvedContextHash: approved });
    assert.equal(calls, 2);
    await denied({ ...selection, approvedContextHash: approved });
    assert.equal(calls, 2);
  } finally {
    input.end();
    await running;
    output.end();
  }
  assert.ok(disposed);
});
