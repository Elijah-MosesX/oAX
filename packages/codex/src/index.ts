import { OaxError } from '@oax/protocol';
import type { AgentEngine, AgentEvent, AgentSession } from '@oax/runtime';
import type { ContextSlice } from '@oax/context';
import { CodexTextClient } from './text-client.js';
export { CodexTextClient, SUPPORTED_CODEX_VERSION } from './text-client.js';
/** Opt-in restricted text engine. Provider tools remain disabled. */
export class CodexAgentEngine implements AgentEngine {
  readonly kind = 'external' as const;
  readonly toolPolicy = 'text-only' as const;
  private sessions = new Map<string, CodexTextClient>();
  constructor(private readonly options?: { executable: string }) {}
  async initialize(): Promise<void> {
    if (!this.options)
      throw new OaxError(
        'PROVIDER_DISABLED',
        'Configure a trusted Codex executable explicitly',
      );
    const client = new CodexTextClient(this.options.executable);
    try {
      const status = await client.connect();
      if (!status.authenticated)
        throw new OaxError(
          'PROVIDER_AUTH',
          'Sign in using the official Codex client first',
        );
    } finally {
      await client.close();
    }
  }
  async createSession(): Promise<AgentSession> {
    if (!this.options)
      throw new OaxError('PROVIDER_DISABLED', 'Codex is disabled');
    const session = { id: crypto.randomUUID() };
    this.sessions.set(session.id, new CodexTextClient(this.options.executable));
    return session;
  }
  async *run(
    session: AgentSession,
    context: ContextSlice,
    signal: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    const client = this.sessions.get(session.id);
    if (!client)
      throw new OaxError('SESSION_NOT_FOUND', 'Provider session closed');
    try {
      await client.connect();
      const queue: string[] = [];
      let ended = false;
      let failure: unknown;
      let wake: (() => void) | undefined;
      const work = client
        .explain(JSON.stringify(context), signal, (text) => {
          for (let offset = 0; offset < text.length; offset += 16000)
            queue.push(text.slice(offset, offset + 16000));
          wake?.();
        })
        .then(
          () => {
            ended = true;
            wake?.();
          },
          (error) => {
            failure = error;
            ended = true;
            wake?.();
          },
        );
      while (!ended || queue.length) {
        const text = queue.shift();
        if (text !== undefined) yield { type: 'delta', text };
        else
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
      }
      await work;
      if (failure) throw failure;
      yield { type: 'completed' };
    } finally {
      await client.close();
    }
  }
  async interrupt(session: AgentSession): Promise<void> {
    await this.sessions.get(session.id)?.interrupt();
  }
  async close(session: AgentSession): Promise<void> {
    await this.sessions.get(session.id)?.close();
    this.sessions.delete(session.id);
  }
}
