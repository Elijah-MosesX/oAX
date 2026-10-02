import { randomUUID, timingSafeEqual } from 'node:crypto';
import { buildContext, validateObservation, redactContext } from '@oax/context';
import { SpatialStore } from '@oax/spatial';
import { CodeGraph, digest } from '@oax/codegraph';
import { Indexer } from '@oax/indexer';
import { GitHistory } from '@oax/git';
import { readFile } from 'node:fs/promises';
import { workspacePath } from '@oax/context';
import { renamePlan, applyRename, type RenamePlan } from './refactor.js';
import { onboarding } from './onboarding.js';
import {
  prepareChecks,
  executeChecks,
  type CheckPlan,
} from './verification.js';
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
  graph?: CodeGraph;
  indexer?: Indexer;
  plan?: RenamePlan;
  checks?: CheckPlan;
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
  planning: ['awaiting_approval', 'executing', 'cancelled', 'failed'],
  awaiting_approval: ['executing', 'cancelled', 'failed'],
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
      externalText?: boolean;
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
        if (
          this.options.engine.kind !== 'local-mock' &&
          (!this.options.externalText ||
            this.options.engine.toolPolicy !== 'text-only')
        )
          throw new OaxError(
            'PROVIDER_DISABLED',
            'External provider is not enabled in foundation',
          );
        await this.options.engine.initialize();
        this.initialized = true;
        payload = {
          protocol: VERSION,
          engine: this.options.engine.kind,
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
        if (req.method === 'repository.onboard') {
          if (
            session.task &&
            !['completed', 'failed', 'cancelled'].includes(session.task.state)
          )
            throw new OaxError('TASK_BUSY', 'A task is active');
          const { observation } = payloadSchemas['repository.onboard'].parse(
            req.payload,
          );
          await validateObservation(this.options.root, observation);
          this.spatial.update(sessionId, observation);
          await this.intelligence(session, observation);
          payload = await onboarding(
            this.options.root,
            session.graph!,
            session.indexer!.exclusions,
          );
        } else if (
          req.method === 'verification.prepare' ||
          req.method === 'verification.run'
        ) {
          if (
            session.task &&
            !['completed', 'failed', 'cancelled'].includes(session.task.state)
          )
            throw new OaxError('TASK_BUSY', 'A task is active');
          if (req.method === 'verification.prepare') {
            const { observation } = payloadSchemas[
              'verification.prepare'
            ].parse(req.payload);
            await validateObservation(this.options.root, observation);
            if (
              observation.dirty ||
              (await readFile(
                await workspacePath(this.options.root, observation.path),
                'utf8',
              )) !== observation.text
            )
              throw new OaxError(
                'CHECK_CONFLICT',
                'Save the selected test before verification',
              );
            session.checks = await prepareChecks(
              this.options.root,
              observation.path,
              randomUUID(),
            );
            payload = session.checks;
          } else {
            const params = payloadSchemas['verification.run'].parse(
              req.payload,
            );
            const plan = session.checks;
            if (
              !plan ||
              plan.id !== params.planId ||
              plan.hash !== params.approvedHash
            )
              throw new OaxError(
                'PERMISSION_DENIED',
                'Approve the exact verification preview',
              );
            const task: Task = {
              id: plan.id,
              state: 'created',
              controller: new AbortController(),
              done: Promise.resolve(),
            };
            session.task = task;
            delete session.checks;
            const action = {
              principal: 'local-editor',
              workspaceId: this.options.workspaceId,
              sessionId,
              taskId: task.id,
              capability: 'terminal.execute' as const,
              resource: `node-test:${plan.hash}`,
            };
            this.permissions.grant({
              ...action,
              id: randomUUID(),
              decision: 'allow',
              expiresAt: plan.expiresAt,
            });
            task.done = this.checks(req, sessionId, task, plan);
            payload = { taskId: task.id };
          }
        } else if (
          req.method === 'refactor.prepare' ||
          req.method === 'refactor.apply'
        ) {
          if (
            session.task &&
            !['completed', 'failed', 'cancelled'].includes(session.task.state)
          )
            throw new OaxError('TASK_BUSY', 'An agent task is active');
          const { observation } = payloadSchemas['history.query'].parse({
            observation: (req.payload as { observation: unknown }).observation,
          });
          await validateObservation(this.options.root, observation);
          const disk = await readFile(
            await workspacePath(this.options.root, observation.path),
            'utf8',
          );
          if (observation.dirty || disk !== observation.text)
            throw new OaxError(
              'EDIT_CONFLICT',
              'Save the selected file and keep it unchanged before renaming',
            );
          this.spatial.update(sessionId, observation);
          if (req.method === 'refactor.prepare') {
            await this.intelligence(session, observation);
            const params = payloadSchemas['refactor.prepare'].parse(
              req.payload,
            );
            session.plan = renamePlan(
              randomUUID(),
              session.graph!.rename(
                observation.path,
                observation.selection.start,
                params.newName,
              ),
            );
            payload = session.plan;
          } else {
            const params = payloadSchemas['refactor.apply'].parse(req.payload);
            const plan = session.plan;
            if (
              !plan ||
              plan.id !== params.planId ||
              plan.hash !== params.approvedHash
            )
              throw new OaxError(
                'PERMISSION_DENIED',
                'Approve the exact pending rename plan',
              );
            const scope = {
              principal: 'local-editor',
              workspaceId: this.options.workspaceId,
              sessionId,
              taskId: plan.id,
            };
            for (const change of plan.changes)
              this.permissions.grant({
                ...scope,
                id: randomUUID(),
                capability: 'workspace.write',
                resource: change.path,
                decision: 'allow',
                expiresAt: plan.expiresAt,
              });
            delete session.plan;
            payload = await applyRename(
              this.options.root,
              plan,
              this.permissions,
              scope,
            );
          }
        } else if (req.method === 'history.query') {
          const { observation } = payloadSchemas['history.query'].parse(
            req.payload,
          );
          await validateObservation(this.options.root, observation);
          const disk = await readFile(
            await workspacePath(this.options.root, observation.path),
            'utf8',
          );
          if (observation.dirty || disk !== observation.text)
            throw new OaxError(
              'DISK_SNAPSHOT_MISMATCH',
              'Save the selected document before querying Git history',
            );
          const action = {
            principal: 'local-editor',
            workspaceId: this.options.workspaceId,
            sessionId,
            taskId: randomUUID(),
            capability: 'git.read' as const,
            resource: observation.path,
          };
          this.permissions.grant({
            ...action,
            id: randomUUID(),
            decision: 'allow',
            expiresAt: Date.now() + 30000,
          });
          payload = await this.permissions.execute(action, () =>
            new GitHistory(this.options.root).history(
              observation.path,
              observation.selection,
            ),
          );
        } else if (req.method === 'context.preview') {
          if (
            session.task &&
            !['completed', 'failed', 'cancelled'].includes(session.task.state)
          )
            throw new OaxError('TASK_BUSY', 'A task is active');
          const params = payloadSchemas['context.preview'].parse(req.payload);
          const context = await this.context(sessionId, session, params);
          payload = { context, hash: digest(JSON.stringify(context)) };
        } else if (
          req.method === 'spatial.observe' ||
          req.method === 'graph.query'
        ) {
          const params = payloadSchemas['spatial.observe'].parse({
            observation: (req.payload as { observation: unknown }).observation,
          });
          if (
            session.task &&
            !['completed', 'failed', 'cancelled'].includes(session.task.state)
          )
            throw new OaxError(
              'TASK_BUSY',
              'Cannot replace context during an active task',
            );
          await validateObservation(this.options.root, params.observation);
          this.spatial.update(sessionId, params.observation);
          await this.intelligence(session, params.observation);
          const focused = session.graph!.focused(
            params.observation.path,
            req.method === 'graph.query'
              ? params.observation.selection.start
              : params.observation.cursor,
          );
          payload =
            req.method === 'graph.query'
              ? session.graph!.related(
                  focused?.id ?? '',
                  payloadSchemas['graph.query'].parse(req.payload).relationship,
                )
              : {
                  focused,
                  documentVersion: params.observation.documentVersion,
                };
        } else if (req.method === 'selection.explain') {
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
      approvedContextHash?: string | undefined;
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
    let transmission: import('@oax/permissions').Action | undefined;
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
        this.context(sessionId, session, params),
      );
      task.controller.signal.throwIfAborted();
      const focused = context.focusedSymbol;
      if (focused)
        emit('agent.cursor.changed', {
          path: focused.path,
          range: focused.range,
          mode: 'investigating',
          contentHash: focused.hash,
          ...(focused.path === params.observation.path
            ? { documentVersion: params.observation.documentVersion }
            : {}),
        });
      if (this.options.engine.kind === 'external') {
        const hash = digest(JSON.stringify(context));
        if (params.approvedContextHash !== hash)
          throw new OaxError(
            'PERMISSION_DENIED',
            'Approve the current context preview before provider transmission',
          );
        transmission = {
          ...action,
          capability: 'provider.context' as const,
          resource: `codex:${hash}`,
        };
        this.permissions.grant({
          ...transmission,
          id: randomUUID(),
          decision: 'allow',
          expiresAt: Date.now() + 60000,
        });
      }
      move('planning');
      move('executing');
      let completed = false,
        outputSize = 0;
      const iterator = this.options.engine
        .run(session.engine, context, task.controller.signal)
        [Symbol.asyncIterator]();
      try {
        while (true) {
          const item = await abortable(
            transmission
              ? this.permissions.execute(transmission, () => iterator.next())
              : iterator.next(),
            task.controller.signal,
          );
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
  private async checks(
    req: Request,
    sessionId: string,
    task: Task,
    plan: CheckPlan,
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
        throw new OaxError(
          'INVALID_TRANSITION',
          'Invalid verification transition',
        );
      task.state = state;
      emit('task.state', { state, ...(error ? { error } : {}) });
    };
    try {
      emit('task.state', { state: 'created' });
      move('gathering_context');
      move('planning');
      move('executing');
      const result = await executeChecks(
        plan,
        this.permissions,
        {
          principal: 'local-editor',
          workspaceId: this.options.workspaceId,
          sessionId,
          taskId: task.id,
        },
        task.controller.signal,
        (text) => emit('agent.delta', { text }),
      );
      move('verifying');
      if (result.exitCode !== 0)
        throw new OaxError(
          'CHECK_FAILED',
          `Node tests exited ${result.exitCode ?? 'without an exit code'}`,
        );
      move('completed');
    } catch (error) {
      const state = task.controller.signal.aborted ? 'cancelled' : 'failed';
      if (canTransition(task.state, state))
        move(
          state,
          error instanceof OaxError
            ? { code: error.code, message: error.message }
            : { code: 'CHECK_FAILED', message: 'Verification failed' },
        );
    }
  }
  private async closeSession(id: string, session: Session): Promise<void> {
    session.task?.controller.abort();
    await this.options.engine.interrupt(session.engine);
    await session.task?.done;
    await this.options.engine.close(session.engine);
    this.spatial.close(id);
    session.graph?.close();
    this.permissions.close(id);
    this.sessions.delete(id);
  }
  private async context(
    sessionId: string,
    session: Session,
    params: {
      observation: import('@oax/protocol').Observation;
      objective: string;
    },
  ): Promise<import('@oax/context').ContextSlice> {
    const context = await buildContext(
      this.options.root,
      params.observation,
      params.objective,
    );
    this.spatial.update(sessionId, params.observation);
    await this.intelligence(session, params.observation);
    const focused = session.graph!.focused(
      params.observation.path,
      params.observation.selection.start,
    );
    if (focused) {
      context.focusedSymbol = {
        id: focused.id,
        name: focused.name,
        path: focused.path,
        range: focused.range,
        hash: focused.hash,
      };
      context.limitations = session.graph!.limitations;
      let remaining = Math.max(0, 8192 - context.excerpt.length);
      context.related = session
        .graph!.related(focused.id, 'callers')
        .relationships.slice(0, 6)
        .flatMap(({ edge, node }) => {
          const snapshot = node
            ? session.indexer!.snapshots.get(node.path)
            : undefined;
          if (!node || !snapshot || remaining <= 0) return [];
          const excerpt = snapshot.text
            .split('\n')
            .slice(node.range.start.line, node.range.end.line + 1)
            .join('\n')
            .slice(0, Math.min(1024, remaining));
          remaining -= excerpt.length;
          return [
            {
              path: node.path,
              range: node.range,
              hash: node.hash,
              excerpt,
              reason: 'Direct caller from TypeScript checker',
              resolution: edge.resolution,
            },
          ];
        });
    }
    const bounded = redactContext(context);
    while (
      Buffer.byteLength(JSON.stringify(bounded)) > 16000 &&
      bounded.related?.length
    ) {
      bounded.related.pop();
      bounded.truncated = true;
    }
    while (
      Buffer.byteLength(JSON.stringify(bounded)) > 16000 &&
      bounded.excerpt.length
    ) {
      bounded.excerpt = bounded.excerpt.slice(
        0,
        Math.floor(bounded.excerpt.length * 0.9),
      );
      bounded.truncated = true;
    }
    if (Buffer.byteLength(JSON.stringify(bounded)) > 16000)
      throw new OaxError(
        'CONTEXT_LIMIT',
        'Context metadata exceeds the provider budget; select a smaller scope',
      );
    return bounded;
  }
  private async intelligence(
    session: Session,
    observation: import('@oax/protocol').Observation,
  ): Promise<void> {
    session.graph ??= new CodeGraph();
    session.indexer ??= new Indexer(this.options.root, session.graph);
    await session.indexer.refresh([
      {
        path: observation.path,
        text: observation.text,
        version: observation.documentVersion,
        dirty: observation.dirty,
      },
    ]);
  }
  async stop(): Promise<void> {
    this.stopped = true;
    for (const [id, session] of this.sessions)
      await this.closeSession(id, session);
  }
}
