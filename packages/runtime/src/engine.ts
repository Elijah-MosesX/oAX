import { randomUUID } from 'node:crypto';
import type { ContextSlice } from '@oax/context';
export interface AgentSession {
  id: string;
}
export type AgentEvent =
  | { type: 'delta'; text: string }
  | { type: 'completed' };
export interface AgentEngine {
  readonly kind: 'local-mock' | 'external';
  readonly toolPolicy?: 'text-only';
  initialize(): Promise<void>;
  createSession(): Promise<AgentSession>;
  run(
    session: AgentSession,
    context: ContextSlice,
    signal: AbortSignal,
  ): AsyncIterable<AgentEvent>;
  interrupt(session: AgentSession): Promise<void>;
  close(session: AgentSession): Promise<void>;
}
export class MockAgentEngine implements AgentEngine {
  readonly kind = 'local-mock' as const;
  private sessions = new Set<string>();
  async initialize(): Promise<void> {}
  async createSession(): Promise<AgentSession> {
    const session = { id: randomUUID() };
    this.sessions.add(session.id);
    return session;
  }
  async *run(
    session: AgentSession,
    context: ContextSlice,
    signal: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    if (!this.sessions.has(session.id))
      throw new Error('Engine session closed');
    signal.throwIfAborted();
    yield {
      type: 'delta',
      text: `[Mock engine — no model inference]\nSelected ${context.path} at document version ${context.documentVersion}${context.dirty ? ' (unsaved buffer)' : ''}.\n`,
    };
    signal.throwIfAborted();
    yield {
      type: 'delta',
      text: `Context: ${context.excerpt}${context.truncated ? '\n[Context truncated]' : ''}\n${context.focusedSymbol ? `Resolved symbol: ${context.focusedSymbol.name}\n` : ''}Model explanations require the live provider integration. Use relationship commands for deterministic graph evidence.\n`,
    };
    yield { type: 'completed' };
  }
  async interrupt(_session: AgentSession): Promise<void> {}
  async close(session: AgentSession): Promise<void> {
    this.sessions.delete(session.id);
  }
}
