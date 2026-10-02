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
  focusedSymbol?: {
    id: string;
    name: string;
    path: string;
    range: TextRange;
    hash: string;
  };
  related?: {
    path: string;
    range: TextRange;
    excerpt: string;
    hash: string;
    reason: string;
    resolution: string;
  }[];
  limitations?: string[];
  redactions?: number;
}
/** Conservative known-token and labeled-assignment redaction; not a complete secret detector. */
export function redact(text: string): { text: string; count: number } {
  let count = 0;
  const replace = () => {
    count++;
    return '[REDACTED]';
  };
  text = text.replace(
    /(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g,
    replace,
  );
  text = text.replace(
    /(Bearer|Basic)\s+[A-Za-z0-9._~+\/-]+={0,2}/gi,
    (_match, prefix: string) => {
      count++;
      return `${prefix} [REDACTED]`;
    },
  );
  text = text.replace(
    /(\b(?:api[_-]?key|password|secret|token)\b\s*[=:]\s*)(["'])([^"'\r\n]{8,})\2/gi,
    (_match, prefix: string, quote: string, value: string) => {
      if (value === '[REDACTED]') return _match;
      count++;
      return `${prefix}${quote}[REDACTED]${quote}`;
    },
  );
  return { text, count };
}
export function redactContext(context: ContextSlice): ContextSlice {
  let count = 0;
  const clean = (text: string) => {
    const result = redact(text);
    count += result.count;
    return result.text;
  };
  const result = {
    ...context,
    objective: clean(context.objective),
    excerpt: clean(context.excerpt),
    ...(context.related
      ? {
          related: context.related.map((item) => ({
            ...item,
            excerpt: clean(item.excerpt),
          })),
        }
      : {}),
  };
  return { ...result, redactions: count };
}
function excluded(resource: string): boolean {
  return resource
    .split(/[\\/]/)
    .some(
      (p) =>
        [
          '.git',
          '.oax',
          'node_modules',
          '.aws',
          '.codex',
          '.tools',
          '.gradle',
          '.intellijplatform',
        ].includes(p.toLowerCase()) ||
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
export function offset(text: string, position: Position): number {
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
export async function validateObservation(
  root: string,
  observation: Observation,
): Promise<void> {
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
  validateRange(observation.text, observation.selection);
  for (const range of observation.visibleRanges)
    validateRange(observation.text, range);
  for (const resource of observation.openFiles)
    await workspacePath(root, resource);
}
export async function buildContext(
  root: string,
  observation: Observation,
  objective: string,
  budget = 8192,
): Promise<ContextSlice> {
  await validateObservation(root, observation);
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
