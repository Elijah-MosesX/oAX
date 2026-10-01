import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import {
  Runtime,
  MockAgentEngine,
  canTransition,
  type AgentEvent,
  type AgentSession,
} from '@oax/runtime';
import { CodexAgentEngine } from '@oax/codex';
import type { ContextSlice } from '@oax/context';
import { CAPABILITIES, request, type Event } from '@oax/protocol';
import { fixtureRoot, observation } from './helpers.js';
const token = 'a'.repeat(64);
async function setup(engine = new MockAgentEngine(), timeoutMs = 1000) {
  const events: Event[] = [];
  const runtime = new Runtime({
    root: fixtureRoot,
    workspaceId: 'workspace',
    token,
    engine,
    emit: (e) => events.push(e),
    timeoutMs,
  });
  const call = (method: string, payload: unknown, sessionId?: string) =>
    runtime.dispatch(request('workspace', method, payload, sessionId));
  assert.equal(
    (await call('initialize', { token, capabilities: [...CAPABILITIES] })).ok,
    true,
  );
  const opened = await call('session.open', {});
  assert.equal(opened.ok, true);
  const sessionId = (
    opened.ok ? (opened.payload as { sessionId: string }) : { sessionId: '' }
  ).sessionId;
  return { runtime, events, call, sessionId };
}
async function terminal(events: Event[], state: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (events.some((e) => 'state' in e.payload && e.payload.state === state))
      return;
    await delay(5);
  }
  assert.fail(`No ${state} event`);
}
test('authentication, version negotiation, duplicates, methods, and session isolation', async () => {
  const runtime = new Runtime({
    root: fixtureRoot,
    workspaceId: 'workspace',
    token,
    engine: new MockAgentEngine(),
    emit: () => {},
  });
  assert.equal(
    (await runtime.dispatch(request('workspace', 'session.open', {}))).ok,
    false,
  );
  assert.equal(
    (
      await runtime.dispatch(
        request('workspace', 'initialize', {
          token: 'b'.repeat(64),
          capabilities: [],
        }),
      )
    ).ok,
    false,
  );
  const req = request('workspace', 'initialize', {
    token,
    capabilities: ['unsupported', 'agent.events.v1'],
  });
  const initialized = await runtime.dispatch(req);
  assert.ok(initialized.ok);
  assert.deepEqual(
    (initialized.payload as { capabilities: string[] }).capabilities,
    ['agent.events.v1'],
  );
  for (const invalid of [
    req,
    request('other', 'session.open', {}),
    request('workspace', 'unknown', {}),
    request('workspace', 'session.close', {}, 'other'),
  ])
    assert.equal((await runtime.dispatch(invalid)).ok, false);
  await runtime.stop();
  assert.equal(
    (await runtime.dispatch(request('workspace', 'session.open', {}))).ok,
    false,
  );
});
test('mock lifecycle streams ordered scoped events from the unsaved selection', async () => {
  const { runtime, events, call, sessionId } = await setup();
  const response = await call(
    'selection.explain',
    { observation: observation(), objective: 'Explain' },
    sessionId,
  );
  assert.ok(response.ok);
  await terminal(events, 'completed');
  assert.deepEqual(
    events
      .filter((e) => 'state' in e.payload)
      .map((e) => 'state' in e.payload && e.payload.state),
    [
      'created',
      'gathering_context',
      'planning',
      'executing',
      'verifying',
      'completed',
    ],
  );
  assert.ok(
    events.some(
      (e) => 'text' in e.payload && e.payload.text.includes('unsaved = 7'),
    ),
  );
  assert.deepEqual(
    events.map((e) => e.sequence),
    events.map((_, i) => i + 1),
  );
  assert.ok(events.every((e) => e.sessionId === sessionId));
  assert.equal(runtime.permissions.audit.at(-1)?.outcome, 'completed');
  await runtime.stop();
});
class SlowEngine extends MockAgentEngine {
  interrupted = false;
  override async *run(
    _session: AgentSession,
    _context: ContextSlice,
    signal: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    await delay(2000, undefined, { signal });
    yield { type: 'completed' };
  }
  override async interrupt(): Promise<void> {
    this.interrupted = true;
  }
}
test('cancellation and timeout prevent completion and interrupt engine', async () => {
  for (const timeout of [false, true]) {
    const engine = new SlowEngine();
    const { runtime, events, call, sessionId } = await setup(
      engine,
      timeout ? 15 : 1000,
    );
    const response = await call(
      'selection.explain',
      { observation: observation(), objective: 'Explain' },
      sessionId,
    );
    assert.ok(response.ok);
    if (!timeout)
      await call(
        'task.cancel',
        { taskId: (response.payload as { taskId: string }).taskId },
        sessionId,
      );
    await terminal(events, 'cancelled');
    assert.equal(engine.interrupted, true);
    assert.equal(
      events.some(
        (e) => 'state' in e.payload && e.payload.state === 'completed',
      ),
      false,
    );
    await runtime.stop();
  }
});
test('active tasks reject overlapping requests and cross-session cancellation', async () => {
  const { runtime, events, call, sessionId } = await setup(new SlowEngine());
  const first = await call(
    'selection.explain',
    { observation: observation(), objective: 'Explain' },
    sessionId,
  );
  assert.ok(first.ok);
  assert.equal(
    (
      await call(
        'selection.explain',
        { observation: observation(), objective: 'Explain' },
        sessionId,
      )
    ).ok,
    false,
  );
  const other = await call('session.open', {});
  assert.ok(other.ok);
  assert.equal(
    (
      await call(
        'task.cancel',
        first.payload,
        (other.payload as { sessionId: string }).sessionId,
      )
    ).ok,
    false,
  );
  await call('session.close', {}, sessionId);
  await terminal(events, 'cancelled');
  await runtime.stop();
});
test('invalid transitions, context failure, and disabled provider never report success', async () => {
  assert.equal(canTransition('completed', 'executing'), false);
  assert.equal(canTransition('created', 'completed'), false);
  const { runtime, events, call, sessionId } = await setup();
  await call(
    'selection.explain',
    {
      observation: { ...observation(), path: '../outside.ts' },
      objective: 'Explain',
    },
    sessionId,
  );
  await terminal(events, 'failed');
  assert.equal(
    events.some((e) => e.method === 'agent.delta'),
    false,
  );
  await runtime.stop();
  const provider = new CodexAgentEngine();
  await assert.rejects(provider.initialize());
  const external = new Runtime({
    root: fixtureRoot,
    workspaceId: 'workspace',
    token,
    engine: provider,
    emit: () => {},
  });
  const response = await external.dispatch(
    request('workspace', 'initialize', { token, capabilities: [] }),
  );
  assert.equal(response.ok, false);
  await external.stop();
});
test('a stalled engine cannot prevent task timeout or session cleanup', async () => {
  class StalledEngine extends MockAgentEngine {
    override async *run(): AsyncIterable<AgentEvent> {
      await new Promise<void>(() => {});
      yield { type: 'completed' };
    }
  }
  const { runtime, events, call, sessionId } = await setup(
    new StalledEngine(),
    15,
  );
  await call(
    'selection.explain',
    { observation: observation(), objective: 'Explain' },
    sessionId,
  );
  await terminal(events, 'cancelled');
  await runtime.stop();
});
test('engine stream termination without completion is a failure', async () => {
  class IncompleteEngine extends MockAgentEngine {
    override async *run(): AsyncIterable<AgentEvent> {
      yield { type: 'delta', text: 'partial' };
    }
  }
  const { runtime, events, call, sessionId } = await setup(
    new IncompleteEngine(),
  );
  await call(
    'selection.explain',
    { observation: observation(), objective: 'Explain' },
    sessionId,
  );
  await terminal(events, 'failed');
  const failure = events.find(
    (e) => e.method === 'task.state' && e.payload.state === 'failed',
  );
  assert.ok(
    failure?.method === 'task.state' &&
      failure.payload.error?.code === 'ENGINE_PROTOCOL',
  );
  await runtime.stop();
});
