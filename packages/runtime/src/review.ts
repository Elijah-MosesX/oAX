import { readFile } from 'node:fs/promises';
import { workspacePath } from '@oax/context';
import { digest } from '@oax/codegraph';
import type { RenamePlan } from './refactor.js';
export interface EditReview {
  planId: string;
  approvedHash: string;
  appliedAt: string;
  changes: RenamePlan['changes'];
  verification: string;
  check?: {
    planId: string;
    approvedHash: string;
    sourceHash: string;
    path: string;
    state: 'running' | 'passed' | 'failed' | 'cancelled';
    exitCode?: number | null;
    error?: string;
    output: string;
    matchedBefore: boolean;
    matchedAfter?: boolean;
  };
}
export async function reviewMatches(
  root: string,
  review: EditReview,
): Promise<boolean> {
  for (const change of review.changes) {
    try {
      const content = await readFile(
        await workspacePath(root, change.path),
        'utf8',
      );
      if (digest(content) !== digest(change.after)) return false;
    } catch {
      return false;
    }
  }
  return true;
}
export async function inspectReview(root: string, review: EditReview) {
  const current = await reviewMatches(root, review);
  let checkCurrent = false;
  if (review.check) {
    try {
      checkCurrent =
        digest(
          await readFile(await workspacePath(root, review.check.path), 'utf8'),
        ) === review.check.sourceHash;
    } catch {
      /* missing or inaccessible test is stale */
    }
  }
  return {
    ...review,
    current,
    checkCurrent,
    verified: Boolean(
      current &&
        checkCurrent &&
        review.check?.state === 'passed' &&
        review.check.matchedBefore &&
        review.check.matchedAfter === true,
    ),
    limitations: [
      'Tests execute arbitrary code using your local account; no OS sandbox is claimed.',
      'Checks cover only the explicitly approved Node test command. Dependency or transient changes during execution are not tracked.',
      'The retained review output is bounded to its first 8,000 characters; full bounded output is delivered during execution.',
      'An applied edit is not automatically rolled back on failure or cancellation.',
    ],
  };
}
