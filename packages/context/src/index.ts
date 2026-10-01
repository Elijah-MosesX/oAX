import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OaxError,
  type Observation,
  type Position,
  type TextRange,
} from '@oax/protocol';
export interface ContextSlice {
  objective: string;
  path: string;
  range: TextRange;
  documentVersion: number;
  dirty: boolean;
  excerpt: string;
  truncated: boolean;
  provenance: 'editor-buffer';
  trust: 'untrusted';
}
function excluded(resource: string): boolean {
  return resource
    .split(/[\\/]/)
    .some(
      (p) =>
        ['.git', '.oax', 'node_modules', '.aws', '.codex'].includes(
          p.toLowerCase(),
        ) ||
        /^\.env(?:\.|$)/i.test(p) ||
        /\.(pem|key)$/i.test(p),
    );
}
export async function workspacePath(
  root: string,
  resource: string,
): Promise<string> {
  if (
    path.isAbsolute(resource) ||
    path.win32.isAbsolute(resource) ||
    resource.includes('\\') ||
    resource.includes(':') ||
    resource.split('/').some((p) => !p || p === '.' || p === '..')
  )
    throw new OaxError(
      'PATH_DENIED',
      'Use a normalized workspace-relative path',
    );
  if (excluded(resource))
    throw new OaxError('PATH_DENIED', 'Resource is excluded');
  const actualRoot = await realpath(root);
  const target = await realpath(path.resolve(actualRoot, resource));
  const relative = path.relative(actualRoot, target);
  if (
    !relative ||
    relative.startsWith('..' + path.sep) ||
    relative === '..' ||
    path.isAbsolute(relative)
  )
    throw new OaxError('PATH_DENIED', 'Resource escapes workspace');
  if (excluded(relative))
    throw new OaxError('PATH_DENIED', 'Resolved resource is excluded');
  return target;
}
function offset(text: string, position: Position): number {
  const lines = text.split('\n');
  const line = lines[position.line];
  if (line === undefined || position.column > line.replace(/\r$/, '').length)
    throw new OaxError(
      'INVALID_RANGE',
      'Position is outside document snapshot',
    );
  return (
    lines.slice(0, position.line).reduce((n, item) => n + item.length + 1, 0) +
    position.column
  );
}
export function validateRange(
  text: string,
  range: TextRange,
): [number, number] {
  const start = offset(text, range.start),
    end = offset(text, range.end);
  if (start > end)
    throw new OaxError(
      'INVALID_RANGE',
      'Range must be ordered and end-exclusive',
    );
  return [start, end];
}
export async function buildContext(
  root: string,
  observation: Observation,
  objective: string,
  budget = 8192,
): Promise<ContextSlice> {
  const actual = await workspacePath(root, observation.path);
  let uriPath: string;
  try {
    uriPath = await realpath(fileURLToPath(observation.uri));
  } catch {
    throw new OaxError(
      'PATH_DENIED',
      'Document URI must resolve to selected workspace file',
    );
  }
  if (uriPath !== actual)
    throw new OaxError('PATH_DENIED', 'Document URI and path disagree');
  offset(observation.text, observation.cursor);
  for (const range of observation.visibleRanges)
    validateRange(observation.text, range);
  for (const resource of observation.openFiles)
    await workspacePath(root, resource);
  const [start, end] = validateRange(observation.text, observation.selection);
  if (start === end)
    throw new OaxError('EMPTY_SELECTION', 'Select code before explaining');
  const selected = observation.text.slice(start, end);
  return {
    objective,
    path: observation.path,
    range: observation.selection,
    documentVersion: observation.documentVersion,
    dirty: observation.dirty,
    excerpt: selected.slice(0, budget),
    truncated: selected.length > budget,
    provenance: 'editor-buffer',
    trust: 'untrusted',
  };
}
