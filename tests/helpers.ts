import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Observation } from '@oax/protocol';
export const fixtureRoot = path.resolve('tests/fixtures/workspace');
export function observation(
  text = 'export const unsaved = 7;',
  version = 2,
): Observation {
  return {
    path: 'example.ts',
    uri: pathToFileURL(path.join(fixtureRoot, 'example.ts')).href,
    documentVersion: version,
    dirty: true,
    text,
    cursor: { line: 0, column: 0 },
    selection: {
      start: { line: 0, column: 0 },
      end: { line: 0, column: text.length },
    },
    visibleRanges: [],
    openFiles: ['example.ts'],
  };
}
