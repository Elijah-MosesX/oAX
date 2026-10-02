import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  CAPABILITIES,
  OaxError,
  messageSchema,
  request,
  type Event,
  type Observation,
  type Request,
  type Response,
} from '@oax/protocol';
import { frames, FrameWriter } from './transport.js';
interface Pending {
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}
export class RuntimeClient {
  private child: ChildProcessWithoutNullStreams;
  private writer: FrameWriter;
  private pending = new Map<string, Pending>();
  private listeners = new Set<(event: Event) => void>();
  private failures = new Set<(error: Error) => void>();
  private disconnects = new Set<() => void>();
  private sequence = 0;
  private closed = false;
  private constructor(
    private readonly workspaceId: string,
    runtimePath: string,
    root: string,
    token: string,
    nodePath: string,
    providerExecutable?: string,
  ) {
    this.child = spawn(nodePath, [runtimePath, 'serve', root, workspaceId], {
      stdio: 'pipe',
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        OAX_CONNECTION_TOKEN: token,
        ELECTRON_RUN_AS_NODE: '1',
        OAX_PROVIDER_EXECUTABLE: providerExecutable ?? '',
      },
    });
    this.writer = new FrameWriter(this.child.stdin);
    this.child.stderr.resume(); // Never echo child diagnostics that could contain user data.
    this.child.on('error', () =>
      this.fail(new OaxError('DISCONNECTED', 'Runtime could not start')),
    );
    this.child.on('exit', () =>
      this.fail(new OaxError('DISCONNECTED', 'Runtime exited')),
    );
    this.child.stdin.on('error', () =>
      this.fail(new OaxError('DISCONNECTED', 'Runtime input closed')),
    );
    void this.read().catch(() =>
      this.fail(new OaxError('INVALID_MESSAGE', 'Invalid runtime stream')),
    );
  }
  static async connect(
    runtimePath: string,
    root: string,
    nodePath = process.execPath,
    providerExecutable?: string,
  ): Promise<RuntimeClient> {
    const token = randomBytes(32).toString('hex');
    const client = new RuntimeClient(
      randomUUID(),
      runtimePath,
      root,
      token,
      nodePath,
      providerExecutable,
    );
    try {
      await client.call('initialize', {
        token,
        capabilities: [...CAPABILITIES],
      });
      return client;
    } catch (error) {
      client.dispose();
      throw error;
    }
  }
  private async read(): Promise<void> {
    for await (const input of frames(this.child.stdout)) {
      const message = messageSchema.parse(input);
      if (message.workspaceId !== this.workspaceId)
        throw new OaxError('WORKSPACE_MISMATCH', 'Runtime identity mismatch');
      if (message.type === 'event') {
        if (message.sequence <= this.sequence)
          throw new OaxError('EVENT_ORDER', 'Duplicate or reordered event');
        this.sequence = message.sequence;
        for (const listener of this.listeners) listener(message);
      } else if (message.type === 'response') {
        const pending = this.pending.get(message.correlationId);
        if (!pending)
          throw new OaxError('CORRELATION_MISMATCH', 'Unexpected response');
        clearTimeout(pending.timer);
        this.pending.delete(message.correlationId);
        pending.resolve(message);
      } else
        throw new OaxError(
          'INVALID_MESSAGE',
          'Runtime sent a request to adapter',
        );
    }
    this.fail(new OaxError('DISCONNECTED', 'Runtime stream closed'));
  }
  private fail(error: Error): void {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    this.listeners.clear();
    this.child.kill();
    for (const listener of this.failures) listener(error);
    this.failures.clear();
    for (const listener of this.disconnects) listener();
    this.disconnects.clear();
  }
  onDisconnect(listener: () => void): () => void {
    if (this.closed) listener();
    else this.disconnects.add(listener);
    return () => this.disconnects.delete(listener);
  }
  subscribe(listener: (event: Event) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private async send(req: Request): Promise<unknown> {
    if (this.closed) throw new OaxError('DISCONNECTED', 'Connection closed');
    const result = new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(
        () => this.fail(new OaxError('TIMEOUT', 'Runtime request timed out')),
        req.method === 'initialize'
          ? 60_000
          : ['github.trace', 'github.history', 'history.query'].includes(
                req.method,
              )
            ? 90_000
            : [
                  'spatial.observe',
                  'graph.query',
                  'context.preview',
                  'repository.onboard',
                  'refactor.prepare',
                  'index.status',
                ].includes(req.method)
              ? 30_000
              : 10_000,
      );
      this.pending.set(req.id, { resolve, reject, timer });
    });
    void this.writer
      .send(req)
      .catch(() =>
        this.fail(new OaxError('DISCONNECTED', 'Request delivery failed')),
      );
    const response = await result;
    if (!response.ok)
      throw new OaxError(response.error.code, response.error.message);
    return response.payload;
  }
  call(method: string, payload: unknown, sessionId?: string): Promise<unknown> {
    return this.send(request(this.workspaceId, method, payload, sessionId));
  }
  async explain(
    sessionId: string,
    observation: Observation,
    objective = 'Explain this selection',
    signal?: AbortSignal,
    approvedContextHash?: string,
  ): Promise<string> {
    return this.runTask(
      sessionId,
      'selection.explain',
      {
        observation,
        objective,
        ...(approvedContextHash ? { approvedContextHash } : {}),
      },
      signal,
    );
  }
  async verify(
    sessionId: string,
    planId: string,
    approvedHash: string,
    signal?: AbortSignal,
  ): Promise<string> {
    return this.runTask(
      sessionId,
      'verification.run',
      { planId, approvedHash },
      signal,
    );
  }
  private async runTask(
    sessionId: string,
    method: string,
    payload: unknown,
    signal?: AbortSignal,
  ): Promise<string> {
    signal?.throwIfAborted();
    const req = request(this.workspaceId, method, payload, sessionId);
    let text = '',
      taskId: string | undefined;
    let resolve!: (value: string) => void, reject!: (error: Error) => void;
    const answer = new Promise<string>((a, b) => {
      resolve = a;
      reject = b;
    });
    this.failures.add(reject);
    const unsubscribe = this.subscribe((event) => {
      if (event.correlationId !== req.id || event.sessionId !== sessionId)
        return;
      taskId = event.taskId;
      if (event.method === 'agent.delta' && 'text' in event.payload)
        text += event.payload.text;
      if (event.method === 'task.state' && 'state' in event.payload) {
        if (event.payload.state === 'completed') resolve(text);
        if (
          event.payload.state === 'failed' ||
          event.payload.state === 'cancelled'
        )
          reject(
            new OaxError(
              event.payload.error?.code ?? event.payload.state.toUpperCase(),
              event.payload.error?.message ?? `Task ${event.payload.state}`,
            ),
          );
      }
    });
    const cancel = () => {
      if (taskId)
        void this.call('task.cancel', { taskId }, sessionId).catch(() => {});
    };
    signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => {
      this.dispose();
      reject(new OaxError('TIMEOUT', 'Task timed out'));
    }, 75_000);
    // Attach immediately so early task failure cannot become an unhandled rejection.
    const sent = this.send(req).then(
      () => {
        if (signal?.aborted) cancel();
      },
      (error) => reject(error as Error),
    );
    try {
      const result = await answer;
      await sent;
      return result;
    } finally {
      clearTimeout(timer);
      unsubscribe();
      this.failures.delete(reject);
      signal?.removeEventListener('abort', cancel);
    }
  }
  dispose(): void {
    this.fail(new OaxError('DISCONNECTED', 'Client disposed'));
  }
}
