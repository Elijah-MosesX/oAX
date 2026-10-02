import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable, PassThrough } from 'node:stream';
import { frames, FrameWriter } from '../packages/runtime/src/transport.js';
import { MAX_FRAME_BYTES } from '@oax/protocol';
test('framing handles chunks and rejects oversized, malformed, or truncated input', async () => {
  const collect = async (chunks: string[]) => {
    const values = [];
    for await (const value of frames(Readable.from(chunks))) values.push(value);
    return values;
  };
  assert.deepEqual(await collect(['{"a":', '1}\n{"b":2}\n']), [
    { a: 1 },
    { b: 2 },
  ]);
  for (const chunks of [
    ['bad\n'],
    ['{}'],
    ['x'.repeat(MAX_FRAME_BYTES + 1)],
    ['x'.repeat(MAX_FRAME_BYTES + 1) + '\n'],
  ])
    await assert.rejects(collect(chunks));
});
test('writer preserves order and rejects frames exceeding payload limit', async () => {
  const stream = new PassThrough();
  let output = '';
  stream.on('data', (chunk) => {
    output += String(chunk);
  });
  const writer = new FrameWriter(stream);
  await Promise.all([writer.send({ n: 1 }), writer.send({ n: 2 })]);
  assert.equal(output, '{"n":1}\n{"n":2}\n');
  await assert.rejects(writer.send({ text: 'x'.repeat(MAX_FRAME_BYTES) }));
});
