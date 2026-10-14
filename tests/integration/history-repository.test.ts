import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { RuntimeClient } from '@oax/runtime/client';
import type { HistoryEvidence } from '@oax/git';
test('actual oAX selected code traces to local commit and blame evidence over validated stdio', async () => {
  const root = path.resolve('.');
  const resource = 'packages/context/src/index.ts';
  const absolute = path.join(root, resource);
  const text = await readFile(absolute, 'utf8');
  const lines = text.split('\n');
  const line = lines.findIndex((value) =>
    value.startsWith('export function offset('),
  );
  assert.ok(line >= 0);
  const client = await RuntimeClient.connect(
    path.resolve('dist/cli.cjs'),
    root,
  );
  try {
    const { sessionId } = (await client.call('session.open', {})) as {
      sessionId: string;
    };
    const evidence = (await client.call(
      'history.query',
      {
        observation: {
          path: resource,
          uri: pathToFileURL(absolute).href,
          text,
          documentVersion: 1,
          dirty: false,
          cursor: { line, column: 0 },
          selection: {
            start: { line, column: 0 },
            end: { line, column: lines[line]!.replace(/\r$/, '').length },
          },
          visibleRanges: [],
          openFiles: [resource],
        },
      },
      sessionId,
    )) as HistoryEvidence;
    assert.equal(evidence.path, resource);
    assert.ok(evidence.selectedCommits.length >= 1);
    assert.match(evidence.selectedCommits[0]!, /^[a-f0-9]{40,64}$/);
    assert.match(evidence.blame, /export function offset/);
    assert.match(evidence.head, /^[a-f0-9]{40,64}$/);
    assert.ok(evidence.branches.length >= 1);
    assert.match(evidence.limitations.join(' '), /not proof of intent/);
    await client.call('session.close', {}, sessionId);
  } finally {
    client.dispose();
  }
});
