import { once } from 'node:events';
import type { Readable, Writable } from 'node:stream';
import { MAX_FRAME_BYTES, OaxError } from '@oax/protocol';
/** Bounded framing. A partial line cannot grow without limit. */
export async function* frames(input: Readable): AsyncIterable<unknown> {
  let pending = Buffer.alloc(0);
  for await (const chunk of input) {
    pending = Buffer.concat([pending, Buffer.from(chunk as Uint8Array)]);
    let newline: number;
    while ((newline = pending.indexOf(10)) !== -1) {
      if (newline > MAX_FRAME_BYTES)
        throw new OaxError('PAYLOAD_LIMIT', 'Frame exceeds limit');
      const line = pending.subarray(0, newline).toString('utf8');
      pending = pending.subarray(newline + 1);
      try {
        yield JSON.parse(line);
      } catch (error) {
        if (error instanceof OaxError) throw error;
        throw new OaxError('INVALID_JSON', 'Malformed JSONL frame');
      }
    }
    if (pending.length > MAX_FRAME_BYTES)
      throw new OaxError('PAYLOAD_LIMIT', 'Incomplete frame exceeds limit');
  }
  if (pending.length)
    throw new OaxError(
      'INVALID_JSON',
      'Connection ended with incomplete frame',
    );
}
export class FrameWriter {
  private queued = 0;
  private tail = Promise.resolve();
  constructor(private readonly output: Writable) {}
  send(value: unknown): Promise<void> {
    const frame = JSON.stringify(value) + '\n';
    const size = Buffer.byteLength(frame);
    if (size > MAX_FRAME_BYTES || this.queued + size > 1_048_576)
      return Promise.reject(
        new OaxError('BACKPRESSURE', 'Output queue exceeds limit'),
      );
    this.queued += size;
    const work = this.tail
      .then(async () => {
        if (this.output.destroyed)
          throw new OaxError('DISCONNECTED', 'Output is closed');
        if (!this.output.write(frame)) await once(this.output, 'drain');
      })
      .finally(() => {
        this.queued -= size;
      });
    this.tail = work.catch(() => {});
    return work;
  }
  async flush(): Promise<void> {
    await this.tail;
  }
}
