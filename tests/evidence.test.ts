import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
test('connected evidence preserves history and reviewed memory without upgrading trust', async () => {
  const input = JSON.parse(
    await readFile('tests/fixtures/connected-evidence.json', 'utf8'),
  );
  const parsed = parseEvidence(JSON.stringify(input));
  assert.equal(parsed.context.memory?.[0]?.note, input.result.memory[0].note);
  assert.deepEqual(parsed.context.historical, input.result.historical);
  for (const patch of [
    { trust: 'trusted' },
    { permissions: ['write'] },
    { expiresAt: 1e20 },
    { sourceHash: 'invalid' },
  ]) {
    const bad = structuredClone(input);
    Object.assign(bad.result.memory[0], patch);
    assert.throws(() => parseEvidence(JSON.stringify(bad)));
  }
  const bad = structuredClone(input);
  bad.result.historical[0].source = 'model-invention';
  assert.throws(() => parseEvidence(JSON.stringify(bad)));
  bad.result.historical = input.result.historical;
  bad.result.memory = Array(6).fill(input.result.memory[0]);
  assert.throws(() => parseEvidence(JSON.stringify(bad)));
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
