import { OaxError } from '@oax/protocol';
import type { AgentEngine, AgentEvent, AgentSession } from '@oax/runtime';
import type { ContextSlice } from '@oax/context';
/** Explicit disabled boundary; no invented transport, tool permissions, or authentication. */
export class CodexAgentEngine implements AgentEngine {
  readonly kind = 'external' as const;
  async initialize(): Promise<void> {
    throw new OaxError(
      'PROVIDER_DISABLED',
      'Codex transport and policy enforcement are not yet implemented',
    );
  }
  async createSession(): Promise<AgentSession> {
    throw new OaxError('PROVIDER_DISABLED', 'Codex is disabled');
  }
  async *run(
    _session: AgentSession,
    _context: ContextSlice,
    _signal: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    throw new OaxError('PROVIDER_DISABLED', 'Codex is disabled');
  }
  async interrupt(_session: AgentSession): Promise<void> {}
  async close(_session: AgentSession): Promise<void> {}
}
