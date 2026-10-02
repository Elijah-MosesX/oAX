import type { Readable, Writable } from 'node:stream';
import { frames, FrameWriter } from '@oax/runtime/transport';
import { OaxError } from '@oax/protocol';
export interface ProviderNotification {
  method: string;
  params: Record<string, unknown>;
}
/** Codex JSONL RPC is provider-specific and never crosses the public oAX boundary. */
export class CodexRpc {
  private next = 0;
  private pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: unknown) => void;
      timer: NodeJS.Timeout;
    }
  >();
  private listeners = new Set<(event: ProviderNotification) => void>();
  private writer: FrameWriter;
  private failure: Error | undefined;
  readonly done: Promise<void>;
  constructor(
    input: Readable,
    output: Writable,
    private readonly timeoutMs = 10000,
  ) {
    const writer = new FrameWriter(output);
    this.writer = writer;
    output.on('error', () => this.close());
    this.done = (async () => {
      try {
        for await (const inputMessage of frames(input)) {
          if (!inputMessage || typeof inputMessage !== 'object')
            throw new OaxError('PROVIDER_PROTOCOL', 'Invalid provider frame');
          const message = inputMessage as Record<string, unknown>;
          if (typeof message.method === 'string') {
            if (message.id !== undefined) {
              for (const listener of this.listeners)
                listener({ method: 'oax/serverRequestDenied', params: {} });
              // No provider-originated tool or approval request can grant execution.
              await writer.send({
                id: message.id,
                error: {
                  code: -32601,
                  message: 'oAX text-only provider rejects all server requests',
                },
              });
              throw new OaxError(
                'PROVIDER_POLICY',
                'Provider requested an unavailable capability',
              );
            }
            if (
              !message.params ||
              typeof message.params !== 'object' ||
              Array.isArray(message.params)
            )
              throw new OaxError(
                'PROVIDER_PROTOCOL',
                'Invalid provider notification',
              );
            for (const listener of this.listeners)
              listener({
                method: message.method,
                params: message.params as Record<string, unknown>,
              });
          } else if (typeof message.id === 'number') {
            const pending = this.pending.get(message.id);
            if (!pending) continue;
            clearTimeout(pending.timer);
            this.pending.delete(message.id);
            if (message.error)
              pending.reject(
                new OaxError(
                  'PROVIDER_ERROR',
                  'Codex rejected the request; credentials and raw provider error are withheld',
                ),
              );
            else if ('result' in message) pending.resolve(message.result);
            else
              pending.reject(
                new OaxError(
                  'PROVIDER_PROTOCOL',
                  'Provider response lacks a result',
                ),
              );
          } else
            throw new OaxError(
              'PROVIDER_PROTOCOL',
              'Invalid provider envelope',
            );
        }
      } catch (error) {
        this.close(error instanceof Error ? error : undefined);
      } finally {
        this.close();
      }
    })();
  }
  async request<T = unknown>(method: string, params: unknown): Promise<T> {
    if (this.failure) throw this.failure;
    if (this.pending.size >= 32)
      throw new OaxError('BACKPRESSURE', 'Too many provider requests');
    const id = ++this.next;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new OaxError('PROVIDER_TIMEOUT', 'Codex request timed out'));
      }, this.timeoutMs);
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
      void this.writer.send({ id, method, params }).catch((error) => {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      });
    });
  }
  notify(method: string, params: unknown = {}): Promise<void> {
    return this.writer.send({ method, params });
  }
  subscribe(listener: (event: ProviderNotification) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  close(
    error: Error = new OaxError(
      'PROVIDER_DISCONNECTED',
      'Codex connection closed',
    ),
  ): void {
    this.failure ??= error;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(this.failure);
    }
    this.pending.clear();
  }
}
