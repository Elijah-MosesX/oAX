import type { Event, TaskState, TextRange } from '@oax/protocol';

export interface BuddyLocation {
  path: string;
  range: TextRange;
  contentHash: string;
  documentVersion?: number;
}
export interface BuddySession {
  id: string;
  root: string;
  provider: 'mock' | 'Codex';
  connected: boolean;
  phase: TaskState | 'idle';
  taskId?: string;
  activity?: { kind: 'turn' | 'message' | 'tool'; state: string };
  location?: BuddyLocation;
  editing: boolean;
  inspection?: {
    id: number;
    label: string;
    state: 'running' | 'completed' | 'failed';
  };
  result?: { label: string; paths: string[]; verified: boolean };
}
export interface BuddySnapshot {
  sessions: BuddySession[];
  prompt?: { title: string; action: string };
}
/** Presentation only: no engine, commands, grants, credentials or model text. */
export class BuddyStore {
  private inspectionId = 0;
  private sessions = new Map<string, BuddySession>();
  private ordering = new Map<
    string,
    { sequence: number; workspaceId?: string }
  >();
  private listeners = new Set<() => void>();
  private prompt: BuddySnapshot['prompt'];
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  snapshot(): BuddySnapshot {
    return structuredClone({
      sessions: [...this.sessions.values()],
      ...(this.prompt ? { prompt: this.prompt } : {}),
    });
  }
  private changed(): void {
    for (const listener of this.listeners) listener();
  }
  register(id: string, root: string, provider: BuddySession['provider']): void {
    if (this.sessions.has(id)) return;
    // Bound presentation retention; eviction never closes a runtime session.
    if (this.sessions.size >= 32) {
      const oldest = this.sessions.keys().next().value!;
      this.sessions.delete(oldest);
      this.ordering.delete(oldest);
    }
    this.sessions.set(id, {
      id,
      root,
      provider,
      connected: true,
      phase: 'idle',
      editing: false,
    });
    this.ordering.set(id, { sequence: 0 });
    this.changed();
  }
  observe(event: Event): void {
    const session = this.sessions.get(event.sessionId);
    const order = this.ordering.get(event.sessionId);
    if (
      !session?.connected ||
      !order ||
      event.sequence <= order.sequence ||
      (order.workspaceId && order.workspaceId !== event.workspaceId)
    )
      return;
    order.workspaceId = event.workspaceId;
    order.sequence = event.sequence;
    if (event.method === 'task.state' && event.payload.state === 'created') {
      session.taskId = event.taskId;
      delete session.activity;
      delete session.location;
    }
    if (event.taskId !== session.taskId) return;
    if (event.method === 'task.state') session.phase = event.payload.state;
    if (event.method === 'agent.activity')
      session.activity = { ...event.payload };
    // Cursor events require editor snapshot validation before locationAccepted.
    // Deltas are deliberately never retained in Buddy.
    if (event.method === 'task.state' || event.method === 'agent.activity')
      this.changed();
  }
  locationAccepted(
    event: Extract<Event, { method: 'agent.cursor.changed' }>,
  ): void {
    const session = this.sessions.get(event.sessionId);
    const order = this.ordering.get(event.sessionId);
    if (
      !session?.connected ||
      session.taskId !== event.taskId ||
      !event.payload.contentHash ||
      order?.workspaceId !== event.workspaceId ||
      order.sequence !== event.sequence
    )
      return;
    const { path, range, contentHash, documentVersion } = event.payload;
    session.location = structuredClone({
      path,
      range,
      contentHash,
      ...(documentVersion === undefined ? {} : { documentVersion }),
    });
    this.changed();
  }
  clearLocations(): void {
    for (const session of this.sessions.values()) delete session.location;
    this.changed();
  }
  showPrompt(prompt?: BuddySnapshot['prompt']): void {
    this.prompt = prompt
      ? {
          title: prompt.title.slice(0, 256),
          action: prompt.action.slice(0, 256),
        }
      : undefined;
    this.changed();
  }
  editing(id: string, active: boolean): void {
    const session = this.sessions.get(id);
    if (!session?.connected) return;
    session.editing = active;
    this.changed();
  }
  /** Read receipts are distinct from agent tasks and do not imply verification. */
  beginInspection(id: string, label: string): number | undefined {
    const session = this.sessions.get(id);
    if (!session?.connected) return;
    const requestId = ++this.inspectionId;
    session.inspection = {
      id: requestId,
      label: label.slice(0, 128),
      state: 'running',
    };
    this.changed();
    return requestId;
  }
  finishInspection(id: string, requestId: number, succeeded: boolean): void {
    const session = this.sessions.get(id);
    if (!session?.connected || session.inspection?.id !== requestId) return;
    session.inspection.state = succeeded ? 'completed' : 'failed';
    this.changed();
  }
  result(id: string, result: NonNullable<BuddySession['result']>): void {
    const session = this.sessions.get(id);
    if (!session?.connected) return;
    session.result = structuredClone({
      ...result,
      label: result.label.slice(0, 256),
      paths: result.paths.slice(0, 21),
    });
    this.changed();
  }
  invalidate(root: string, path: string): void {
    for (const session of this.sessions.values()) {
      if (session.root === root && session.result?.paths.includes(path)) {
        session.result.verified = false;
        session.result.label = 'Source or test changed; review again';
      }
    }
    this.changed();
  }
  disconnect(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.connected = false;
    session.editing = false;
    delete session.inspection;
    delete session.location;
    this.changed();
  }
  reset(): void {
    this.sessions.clear();
    this.ordering.clear();
    this.prompt = undefined;
    this.changed();
  }
  dispose(): void {
    this.listeners.clear();
    this.reset();
  }
}

export function buddyLabel(session: BuddySession): string {
  if (!session.connected) return 'Disconnected';
  if (session.editing) return 'Applying approved edit';
  const labels: Record<BuddySession['phase'], string> = {
    idle: 'Ready',
    created: 'Task created',
    gathering_context: 'Gathering context',
    planning: 'Planning',
    awaiting_approval: 'Awaiting runtime approval',
    executing: 'Working',
    verifying: 'Verifying task',
    completed: 'Task completed',
    failed: 'Task failed',
    cancelled: 'Task cancelled',
  };
  return labels[session.phase];
}
