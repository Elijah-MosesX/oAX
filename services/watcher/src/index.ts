import type { Indexer } from '@oax/indexer';
/** Serialized, bounded polling catches rename/delete and branch content changes portably. */
export class WorkspaceWatcher {
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<void> = Promise.resolve();
  private stopped = false;
  constructor(
    private readonly indexer: Pick<Indexer, 'refresh'>,
    private readonly changed: () => void,
    private readonly failed: (error: unknown) => void,
    private readonly intervalMs = 1000,
  ) {}
  start(): void {
    if (!this.timer && !this.stopped) this.schedule();
  }
  private schedule(): void {
    this.timer = setTimeout(() => {
      this.running = this.tick().finally(() => {
        if (!this.stopped) this.schedule();
      });
    }, this.intervalMs);
    // Background polling alone must not keep the process alive; owners call close().
    this.timer.unref?.();
  }
  async tick(): Promise<void> {
    try {
      const result = await this.indexer.refresh();
      if (result.changed) this.changed();
    } catch (error) {
      this.failed(error);
    }
  }
  async close(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.running;
  }
}
