import path from 'node:path';
import type { Observation, Position, TextRange } from '@oax/protocol';
export interface EditorSnapshot {
  fileName: string;
  uri: string;
  version: number;
  dirty: boolean;
  text: string;
  cursor: Position;
  selection: TextRange;
  visibleRanges: TextRange[];
  openFiles: string[];
}
export function capture(root: string, input: EditorSnapshot): Observation {
  const relative = (file: string) =>
    path.relative(root, file).split(path.sep).join('/');
  return {
    path: relative(input.fileName),
    uri: input.uri,
    documentVersion: input.version,
    dirty: input.dirty,
    text: input.text,
    cursor: input.cursor,
    selection: input.selection,
    visibleRanges: input.visibleRanges,
    openFiles: input.openFiles.map(relative),
  };
}
/** Compare editor state without retaining another source-text copy. */
export function observationSignature(
  root: string,
  observation: Observation,
): string {
  const { text: _text, ...state } = observation;
  void _text;
  return JSON.stringify({
    root,
    ...state,
    openFiles: [...state.openFiles].sort(),
  });
}
