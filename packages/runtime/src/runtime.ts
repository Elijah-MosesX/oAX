import { randomUUID, timingSafeEqual } from 'node:crypto';
import { buildContext } from '@oax/context';
import { SpatialStore } from '@oax/spatial';
import { PermissionEngine } from '@oax/permissions';
import {
  CAPABILITIES,
  VERSION,
  OaxError,
  payloadSchemas,
  eventSchema,
  validateRequest,
  type Event,
  type Request,
  type Response,
  type TaskState,
} from '@oax/protocol';
import type { AgentEngine, AgentSession } from './engine.js';
interface Session {
  engine: AgentSession;
  task?: Task;
}
interface Task {
  id: string;
  state: TaskState;
  controller: AbortController;
  done: Promise<void>;
}
const transitions: Record<TaskState, TaskState[]> = {
  created: ['gathering_context', 'cancelled', 'failed'],
  gathering_context: ['planning', 'cancelled', 'failed'],
  planning: ['executing', 'cancelled', 'failed'],
  executing: ['verifying', 'cancelled', 'failed'],
  verifying: ['completed', 'cancelled', 'failed'],
  completed: [],
  failed: [],
  cancelled: [],
};
export function canTransition(from: TaskState, to: TaskState): boolean {
  return transitions[from].includes(to);
}
function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new OaxError('CANCELLED', 'Task cancelled'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    work
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort))
      .catch(() => {});
  });
}
export class Runtime {
  private initialized = false;
  private stopped = false;
  private sessions = new Map<string, Session>();
  private seen = new Set<string>();
  private spatial = new SpatialStore();
  private sequence = 0;
  readonly permissions = new PermissionEngine();
  constructor(
    private readonly options: {
      root: string;
      workspaceId: string;
      token: string;
      engine: AgentEngine;
      emit: (event: Event) => void;
      timeoutMs?: number;
    },
  ) {}
  async dispatch(input: unknown): Promise<Response> {
    let req: Request | undefined;
    const base = () => ({
      id: randomUUID(),
      version: VERSION,
      timestamp: new Date().toISOString(),
      workspaceId: this.options.workspaceId,
      type: 'response' as const,
      correlationId: req?.id ?? 'invalid',
    });
    try {
      req = validateRequest(input);
      if (this.stopped) throw new OaxError('DISCONNECTED', 'Runtime stopped');
      if (req.workspaceId !== this.options.workspaceId)
        throw new OaxError('WORKSPACE_MISMATCH', 'Workspace identity mismatch');
      if (this.seen.has(req.id))
        throw new OaxError('DUPLICATE_REQUEST', 'Request ID already used');
      if (this.seen.size >= 4096)
        throw new OaxError('REQUEST_LIMIT', 'Reconnect after request limit');
      this.seen.add(req.id);
      if (!this.initialized && req.method !== 'initialize')
        throw new OaxError(
          'NOT_INITIALIZED',
          'Initialize authenticated connection first',
        );
      const schema = payloadSchemas[req.method as keyof typeof payloadSchemas];
      if (!schema) throw new OaxError('METHOD_NOT_FOUND', 'Unsupported method');
      if (!schema.safeParse(req.payload).success)
        throw new OaxError('INVALID_PARAMS', 'Invalid method payload');
      let payload: unknown;
      if (req.method === 'initialize') {
        if (this.initialized)
          throw new OaxError(
            'ALREADY_INITIALIZED',
            'Connection already initialized',
          );
        const params = payloadSchemas.initialize.parse(req.payload);
        const token = Buffer.from(params.token),
          expected = Buffer.from(this.options.token);
        if (
          token.length !== expected.length ||
          !timingSafeEqual(token, expected)
        )
          throw new OaxError('UNAUTHORIZED', 'Invalid connection credential');
        if (this.options.engine.kind !== 'local-mock')
          throw new OaxError(
            'PROVIDER_DISABLED',
            'External provider is not enabled in foundation',
          );
        await this.options.engine.initialize();
        this.initialized = true;
        payload = {
          protocol: VERSION,
          engine: 'local-mock',
          capabilities: CAPABILITIES.filter((c) =>
            params.capabilities.includes(c),
          ),
        };
      } else if (req.method === 'session.open') {
        if (this.sessions.size >= 8)
          throw new OaxError('SESSION_LIMIT', 'Too many sessions');
        const sessionId = randomUUID();
        this.sessions.set(sessionId, {
          engine: await this.options.engine.createSession(),
        });
        payload = { sessionId };
      } else {
        const sessionId = req.sessionId;
        const session = sessionId ? this.sessions.get(sessionId) : undefined;
        if (!session || !sessionId)
          throw new OaxError('SESSION_NOT_FOUND', 'Unknown session');
        if (req.method === 'selection.explain') {
          if (
            session.task &&
            !['completed', 'failed', 'cancelled'].includes(session.task.state)
          )
            throw new OaxError('TASK_BUSY', 'A task is active in this session');
          const params = payloadSchemas['selection.explain'].parse(req.payload);
          const task: Task = {
            id: randomUUID(),
            state: 'created',
            controller: new AbortController(),
            done: Promise.resolve(),
          };
          session.task = task;
          task.done = this.run(req, sessionId, session, task, params);
          payload = { taskId: task.id };
        } else if (req.method === 'task.cancel') {
          const { taskId } = payloadSchemas['task.cancel'].parse(req.payload);
          if (session.task?.id !== taskId)
            throw new OaxError('TASK_NOT_FOUND', 'Unknown task in session');
          session.task.controller.abort();
          await this.options.engine.interrupt(session.engine);
          payload = { cancelled: true };
        } else {
          await this.closeSession(sessionId, session);
          payload = { closed: true };
        }
      }
      return { ...base(), ok: true, payload };
    } catch (error) {
      return {
        ...base(),
        ok: false,
        error:
          error instanceof OaxError
            ? { code: error.code, message: error.message }
            : {
                code: 'INTERNAL_ERROR',
                message:
                  'Operation failed; no provider or credential details logged',
              },
      };
    }
  }
  private async run(
    req: Request,
    sessionId: string,
    session: Session,
    task: Task,
    params: {
      observation: import('@oax/protocol').Observation;
      objective: string;
    },
  ): Promise<void> {
    const emit = (method: Event['method'], payload: Event['payload']) =>
      this.options.emit(
        eventSchema.parse({
          id: randomUUID(),
          version: VERSION,
          type: 'event',
          timestamp: new Date().toISOString(),
          workspaceId: this.options.workspaceId,
          sessionId,
          taskId: task.id,
          correlationId: req.id,
          sequence: ++this.sequence,
          method,
          payload,
        }),
      );
    const move = (
      state: TaskState,
      error?: { code: string; message: string },
    ) => {
      if (!canTransition(task.state, state))
        throw new OaxError('INVALID_TRANSITION', 'Invalid task transition');
      task.state = state;
      emit('task.state', { state, ...(error ? { error } : {}) });
    };
    const timer = setTimeout(() => {
      task.controller.abort();
      void this.options.engine.interrupt(session.engine).catch(() => {});
    }, this.options.timeoutMs ?? 30_000);
    try {
      emit('task.state', { state: 'created' });
      move('gathering_context');
      const action = {
        principal: 'local-editor',
        workspaceId: this.options.workspaceId,
        sessionId,
        taskId: task.id,
        capability: 'workspace.read' as const,
        resource: params.observation.path,
      };
      this.permissions.grant({
        ...action,
        id: randomUUID(),
        decision: 'allow',
        expiresAt: Date.now() + 30_000,
      });
      const context = await this.permissions.execute(action, () =>
        buildContext(this.options.root, params.observation, params.objective),
      );
      task.controller.signal.throwIfAborted();
      this.spatial.update(sessionId, params.observation);
      move('planning');
      move('executing');
      let completed = false,
        outputSize = 0;
      const iterator = this.options.engine
        .run(session.engine, context, task.controller.signal)
        [Symbol.asyncIterator]();
      try {
        while (true) {
          const item = await abortable(iterator.next(), task.controller.signal);
          if (item.done) break;
          const event = item.value;
          task.controller.signal.throwIfAborted();
          if (completed)
            throw new OaxError(
              'ENGINE_PROTOCOL',
              'Engine emitted after completion',
            );
          if (event.type === 'delta') {
            outputSize += event.text.length;
            if (event.text.length > 16_384 || outputSize > 65_536)
              throw new OaxError(
                'OUTPUT_LIMIT',
                'Engine output limit exceeded',
              );
            emit('agent.delta', { text: event.text });
          } else completed = true;
        }
      } finally {
        void iterator.return?.().catch(() => {});
      }
      if (!completed)
        throw new OaxError(
          'ENGINE_PROTOCOL',
          'Engine stream ended without completion',
        );
      move('verifying');
      move('completed');
    } catch (error) {
      const state = task.controller.signal.aborted ? 'cancelled' : 'failed';
      if (canTransition(task.state, state))
        move(
          state,
          error instanceof OaxError
            ? { code: error.code, message: error.message }
            : {
                code: state === 'cancelled' ? 'CANCELLED' : 'ENGINE_FAILED',
                message:
                  state === 'cancelled'
                    ? 'Task cancelled or timed out'
                    : 'Engine or context operation failed',
              },
        );
    } finally {
      clearTimeout(timer);
    }
  }
  private async closeSession(id: string, session: Session): Promise<void> {
    session.task?.controller.abort();
    await this.options.engine.interrupt(session.engine);
    await session.task?.done;
    await this.options.engine.close(session.engine);
    this.spatial.close(id);
    this.permissions.close(id);
    this.sessions.delete(id);
  }
  async stop(): Promise<void> {
    this.stopped = true;
    for (const [id, session] of this.sessions)
      await this.closeSession(id, session);
  }
}
