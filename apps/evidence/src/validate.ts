import { z, rangeSchema } from '../../../packages/protocol/src/browser.js';
const text = z.string().max(32768);
const location = z.strictObject({
  path: z.string().min(1).max(4096),
  range: rangeSchema,
});
const context = z.strictObject({
  objective: z.string().max(4000),
  path: z.string().min(1).max(4096),
  range: rangeSchema,
  documentVersion: z.number().int().nonnegative(),
  dirty: z.boolean(),
  excerpt: text,
  truncated: z.boolean(),
  provenance: z.literal('editor-buffer'),
  trust: z.literal('untrusted'),
  focusedSymbol: location
    .extend({
      id: z.string().max(4096),
      name: z.string().max(4096),
      hash: z.string().max(128),
    })
    .optional(),
  related: z
    .array(
      location.extend({
        excerpt: text,
        hash: z.string().max(128),
        reason: z.string().max(4096),
        resolution: z.string().max(200),
      }),
    )
    .max(6)
    .optional(),
  limitations: z.array(z.string().max(4096)).max(100).optional(),
  redactions: z.number().int().nonnegative().optional(),
});
/** Browser import is evidence, never executable content or a permission grant. */
export function parseEvidence(input: string) {
  if (new TextEncoder().encode(input).length > 196608)
    throw new Error('Evidence exceeds 192 KiB. Export a bounded ContextSlice.');
  const envelope = z
    .strictObject({
      format: z.literal('oax-evidence.v1'),
      method: z.literal('context.preview'),
      capturedAt: z.iso.datetime(),
      result: z.unknown(),
    })
    .parse(JSON.parse(input));
  // Runtime context.preview wraps context with the exact transmission preview.
  const result = envelope.result;
  const candidate =
    result && typeof result === 'object' && 'context' in result
      ? result.context
      : result;
  return { capturedAt: envelope.capturedAt, context: context.parse(candidate) };
}
