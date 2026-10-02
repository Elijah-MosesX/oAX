import test from 'node:test';
import assert from 'node:assert/strict';
import { observationSignature } from '../adapters/vscode/src/capture.js';
import { observation } from './helpers.js';
test('observation deduplication includes workspace, dirty state, open files and spatial coordinates without copying source text', () => {
  const original = observation('private-source-marker');
  const signature = observationSignature('root', original);
  assert.ok(!signature.includes('private-source-marker'));
  for (const changed of [
    { ...original, dirty: false },
    { ...original, openFiles: [...original.openFiles, 'second.ts'] },
    { ...original, cursor: { line: 0, column: 3 } },
    { ...original, visibleRanges: [original.selection] },
    { ...original, documentVersion: original.documentVersion + 1 },
  ])
    assert.notEqual(observationSignature('root', changed), signature);
  assert.notEqual(observationSignature('other-root', original), signature);
  assert.equal(
    observationSignature('root', { ...original, openFiles: ['b.ts', 'a.ts'] }),
    observationSignature('root', { ...original, openFiles: ['a.ts', 'b.ts'] }),
  );
});
