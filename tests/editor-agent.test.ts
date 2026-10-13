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

test('edit bridge requires opt-in, fresh exact one-use plans and keeps execution unavailable', async () => {
  for (const enabled of [false, true]) {
    const input = new PassThrough(),
      output = new PassThrough();
    const writer = new FrameWriter(input),
      reader = frames(output)[Symbol.asyncIterator]();
    let time = 100,
      writes = 0;
    const captured = { ...observation(), dirty: false };
    const hash = 'a'.repeat(64);
    const client: Parameters<typeof serveEditorBridge>[0] = {
      identity: 'workspace',
      call: async (method) => {
        if (method === 'session.open') return { sessionId: 'session' };
        if (method === 'refactor.prepare')
          return {
            id: 'plan',
            hash,
            expiresAt: time + 60000,
            state: 'awaiting_approval',
            verification: 'Syntax only',
            changes: [
              {
                path: 'example.ts',
                before: 'before',
                after: 'after',
                beforeHash: hash,
              },
            ],
          };
        if (method === 'refactor.apply') {
          writes++;
          return { files: ['example.ts'] };
        }
        return {};
      },
      explain: async () => 'mock',
      subscribe: () => () => {},
      onDisconnect: () => () => {},
      dispose: () => {},
    };
    const running = serveEditorBridge(
      client,
      'mock',
      input,
      output,
      () => time,
      enabled,
    );
    const next = async () =>
      messageSchema.parse((await reader.next()).value) as Response;
    const send = async (
      method: string,
      payload: unknown,
      session = 'session',
    ) => {
      await writer.send(request('workspace', method, payload, session));
      return next();
    };
    const apply = { planId: 'plan', approvedHash: hash, observation: captured };
    const prepare = async () =>
      assert.ok(
        (
          await send('refactor.prepare', {
            observation: captured,
            newName: 'renamed',
          })
        ).ok,
      );
    const deny = async (value: unknown) => {
      const r = await send('refactor.apply', value);
      assert.ok(!r.ok && r.error.code === 'PERMISSION_DENIED');
    };
    try {
      const bootstrap = await next();
      assert.ok(bootstrap.ok);
      assert.equal(
        (bootstrap.payload as { contract: string }).contract,
        enabled ? 'editor-reviewed-rename.v1' : 'editor-read-only.v1',
      );
      if (!enabled) {
        const r = await send('refactor.prepare', {
          observation: captured,
          newName: 'renamed',
        });
        assert.ok(!r.ok && r.error.code === 'UNSUPPORTED_METHOD');
        continue;
      }
      await deny(apply);
      await prepare();
      await deny({ ...apply, approvedHash: 'b'.repeat(64) });
      await deny(apply);
      await prepare();
      await deny({ ...apply, planId: 'other' });
      await prepare();
      await deny({
        ...apply,
        observation: { ...captured, documentVersion: 3 },
      });
      await prepare();
      time += 60000;
      await deny(apply);
      assert.equal(writes, 0);
      await prepare();
      const foreign = await send('refactor.apply', apply, 'foreign');
      assert.ok(!foreign.ok && foreign.error.code === 'SCOPE_MISMATCH');
      const execute = await send('verification.prepare', {
        observation: captured,
      });
      assert.ok(!execute.ok && execute.error.code === 'UNSUPPORTED_METHOD');
      assert.ok((await send('refactor.apply', apply)).ok);
      assert.equal(writes, 1);
      await deny(apply);
      assert.equal(writes, 1);
      assert.ok((await send('review.get', {})).ok);
    } finally {
      input.end();
      await running;
      output.end();
    }
  }
});

test('test-only bridge binds approval and forwards late task output with original correlation', async () => {
  const input = new PassThrough(),
    output = new PassThrough();
  const writer = new FrameWriter(input),
    reader = frames(output)[Symbol.asyncIterator]();
  let time = 100,
    runs = 0;
  let emit: Parameters<
    Parameters<typeof serveEditorBridge>[0]['subscribe']
  >[0] = () => {};
  const hash = 'a'.repeat(64);
  const event = (method: 'task.state' | 'agent.delta', payload: unknown) => {
    emit(
      messageSchema.parse({
        type: 'event',
        version: '0.1',
        id: 'event',
        timestamp: new Date().toISOString(),
        workspaceId: 'workspace',
        sessionId: 'session',
        taskId: 'plan',
        correlationId: 'internal',
        sequence: 1,
        method,
        payload,
      }) as import('@oax/protocol').Event,
    );
  };
  const client: Parameters<typeof serveEditorBridge>[0] = {
    identity: 'workspace',
    call: async (method) => {
      if (method === 'session.open') return { sessionId: 'session' };
      if (method === 'verification.prepare')
        return {
          id: 'plan',
          hash,
          expiresAt: time + 60000,
          state: 'awaiting_approval',
          path: 'example.test.mjs',
          sourceHash: hash,
          executable: process.execPath,
          args: ['--test', 'example.test.mjs'],
          cwd: process.cwd(),
          timeoutMs: 5000,
          disclosure: 'Local-account execution',
        };
      if (method === 'verification.run') {
        runs++;
        event('task.state', { state: 'created' });
        return { taskId: 'plan' };
      }
      return {};
    },
    explain: async () => 'mock',
    subscribe: (fn) => {
      emit = fn;
      return () => {};
    },
    onDisconnect: () => () => {},
    dispose: () => {},
  };
  const running = serveEditorBridge(
    client,
    'mock',
    input,
    output,
    () => time,
    false,
    true,
  );
  const next = async () => messageSchema.parse((await reader.next()).value);
  const send = async (method: string, payload: unknown) => {
    const req = request('workspace', method, payload, 'session');
    await writer.send(req);
    return next();
  };
  const plan = { planId: 'plan', approvedHash: hash };
  const prepare = async () => {
    const r = await send('verification.prepare', {
      observation: observation(),
    });
    assert.ok(r.type === 'response' && r.ok);
  };
  const deny = async (payload: unknown) => {
    const r = await send('verification.run', payload);
    assert.ok(
      r.type === 'response' && !r.ok && r.error.code === 'PERMISSION_DENIED',
    );
  };
  try {
    const boot = await next();
    assert.ok(boot.type === 'response' && boot.ok);
    const methods = (boot.payload as { methods: string[] }).methods;
    assert.ok(
      methods.includes('verification.run') &&
        !methods.includes('refactor.apply'),
    );
    await deny(plan);
    await prepare();
    await deny({ ...plan, approvedHash: 'b'.repeat(64) });
    await deny(plan);
    await prepare();
    await deny({ ...plan, planId: 'foreign' });
    await prepare();
    time += 60000;
    await deny(plan);
    assert.equal(runs, 0);
    await prepare();
    const req = request('workspace', 'verification.run', plan, 'session');
    await writer.send(req);
    const started = await next();
    assert.equal(started.type, 'event');
    assert.equal(started.correlationId, req.id);
    const ack = await next();
    assert.ok(ack.type === 'response' && ack.ok);
    // Events must survive the immediate acknowledgement and unrelated requests.
    await send('review.get', {});
    event('agent.delta', { text: 'test output' });
    const delta = await next();
    assert.equal(delta.type, 'event');
    assert.equal(delta.correlationId, req.id);
    event('task.state', { state: 'completed' });
    const done = await next();
    assert.equal(done.type, 'event');
    assert.equal(done.correlationId, req.id);
    await deny(plan);
    assert.equal(runs, 1);
  } finally {
    input.end();
    await running;
    output.end();
  }
});
