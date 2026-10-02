import { OaxError } from '@oax/protocol';
export type Capability =
  | 'workspace.read'
  | 'workspace.write'
  | 'terminal.execute'
  | 'provider.context'
  | 'git.read'
  | 'github.read'
  | 'browser.read'
  | 'browser.navigate';
export interface Action {
  principal: string;
  workspaceId: string;
  sessionId: string;
  taskId: string;
  capability: Capability;
  resource: string;
}
export interface Grant extends Action {
  id: string;
  expiresAt: number;
  decision: 'allow' | 'deny';
}
export interface AuditRecord {
  timestamp: string;
  action: Action;
  outcome: 'allow' | 'deny' | 'completed' | 'failed';
}
export class PermissionEngine {
  private grants: Grant[] = [];
  private records: AuditRecord[] = [];
  constructor(private readonly now: () => number = Date.now) {}
  grant(grant: Grant): void {
    this.grants.push(structuredClone(grant));
  }
  get audit(): AuditRecord[] {
    return structuredClone(this.records);
  }
  private same(a: Action, b: Action): boolean {
    return (Object.keys(a) as (keyof Action)[]).every((k) => a[k] === b[k]);
  }
  async execute<T>(action: Action, operation: () => Promise<T>): Promise<T> {
    const grants = this.grants.filter(
      (g) => this.same(action, g) && g.expiresAt > this.now(),
    );
    const allowed =
      grants.some((g) => g.decision === 'allow') &&
      !grants.some((g) => g.decision === 'deny');
    const record = (outcome: AuditRecord['outcome']) =>
      this.records.push({
        timestamp: new Date(this.now()).toISOString(),
        action: structuredClone(action),
        outcome,
      });
    record(allowed ? 'allow' : 'deny');
    if (!allowed)
      throw new OaxError(
        'PERMISSION_DENIED',
        'No valid scoped authorization for action',
      );
    try {
      const value = await operation();
      record('completed');
      return value;
    } catch (error) {
      record('failed');
      throw error;
    }
  }
  close(sessionId: string): void {
    this.grants = this.grants.filter((g) => g.sessionId !== sessionId);
  }
}
