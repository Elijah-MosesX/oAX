import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEvidence } from '../apps/evidence/src/validate.js';
const context = {
  objective: 'Explain',
  path: 'src/a.ts',
  range: { start: { line: 0, column: 0 }, end: { line: 0, column: 4 } },
  documentVersion: 1,
  dirty: false,
  excerpt: '<script>untrusted()</script>',
  truncated: false,
  provenance: 'editor-buffer',
  trust: 'untrusted',
  related: [],
};
const envelope = (result: unknown) =>
  JSON.stringify({
    format: 'oax-evidence.v1',
    method: 'context.preview',
    capturedAt: '2026-10-02T00:00:00.000Z',
    result,
  });
test('Evidence viewer accepts real context shape without evaluating content', () => {
  assert.equal(
    parseEvidence(envelope(context)).context.excerpt,
    context.excerpt,
  );
  assert.equal(
    parseEvidence(envelope({ context, resource: 'opaque-plan-hash' })).context
      .path,
    'src/a.ts',
  );
});
test('Evidence viewer rejects oversized, unsupported, invalid-range and permission-bearing context', () => {
  assert.throws(() => parseEvidence('x'.repeat(196609)));
  assert.throws(() =>
    parseEvidence(envelope({ ...context, permissions: ['write'] })),
  );
  assert.throws(() =>
    parseEvidence(envelope({ ...context, trust: 'trusted' })),
  );
  assert.throws(() =>
    parseEvidence(
      envelope({
        ...context,
        range: { start: { line: -1, column: 0 }, end: { line: 0, column: 4 } },
      }),
    ),
  );
  assert.throws(() =>
    parseEvidence(envelope({ ...context, related: Array(7).fill({}) })),
  );
});
