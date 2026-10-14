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
  historical: z
    .array(
      z.strictObject({
        source: z.enum(['local-git', 'github']),
        reference: z.string().min(1).max(4096),
        sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
        evidenceHash: z.string().regex(/^[a-f0-9]{64}$/),
        excerpt: z.string().max(3072),
        truncated: z.boolean(),
      }),
    )
    .max(2)
    .optional(),
  memory: z
    .array(
      location.extend({
        id: z.uuid(),
        sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
        note: z.string().max(2000),
        reviewedAt: z.number().int().nonnegative().max(8640000000000000),
        expiresAt: z.number().int().nonnegative().max(8640000000000000),
        validation: z.literal('human-reviewed-source-linked'),
        trust: z.literal('untrusted'),
      }),
    )
    .max(5)
    .optional(),
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
