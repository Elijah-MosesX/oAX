import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GitHistory } from '@oax/git';
import { RuntimeClient } from '@oax/runtime/client';
import { pathToFileURL } from 'node:url';
test('local history returns real commit and blame evidence without mutation or invented causal claims', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'oax-history-'));
  const git = (args: string[]) =>
    promisify(execFile)('git', ['-c', `safe.directory=${root}`, ...args], {
      cwd: root,
      windowsHide: true,
    });
  try {
    await git(['init']);
    await writeFile(path.join(root, 'a.ts'), 'export const value = 1;\n');
    await git(['add', 'a.ts']);
    await git([
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      '-c',
      'core.hooksPath=',
      'commit',
      '-m',
      'Introduce value',
    ]);
    const before = (await git(['status', '--porcelain'])).stdout;
    const evidence = await new GitHistory(root).history('a.ts', {
      start: { line: 0, column: 0 },
      end: { line: 0, column: 23 },
    });
    assert.equal(evidence.commits[0]?.subject, 'Introduce value');
    assert.match(evidence.blame, /summary Introduce value/);
    assert.match(evidence.commits[0]!.sha, /^[a-f0-9]{40}$/);
    assert.equal(evidence.selectedCommits[0], evidence.commits[0]!.sha);
    assert.equal(evidence.head, evidence.commits[0]!.sha);
    assert.ok(evidence.branches.length >= 1);
    assert.equal(evidence.diff, '');
    assert.equal(evidence.status, '');
    const introduced = evidence.selectedCommits[0];
    await writeFile(
      path.join(root, 'a.ts'),
      'export const value = 1;\n// unrelated later line\n',
    );
    await git(['add', 'a.ts']);
    await git([
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      '-c',
      'core.hooksPath=',
      'commit',
      '-m',
      'Unrelated line change',
    ]);
    const selected = await new GitHistory(root).history('a.ts', evidence.range);
    assert.equal(
      selected.selectedCommits[0],
      introduced,
      'Selected-line provenance must survive an unrelated newer file commit',
    );
    assert.notEqual(selected.commits[0]?.sha, introduced);
    await writeFile(
      path.join(root, 'a.ts'),
      'export const value = 2;\n// unrelated later line\n',
    );
    const changed = await new GitHistory(root).history('a.ts', evidence.range);
    assert.deepEqual(
      changed.selectedCommits,
      [],
      'Uncommitted selected lines cannot claim an existing origin commit',
    );
    assert.match(changed.status, /M/);
    assert.match(changed.diff, /value = 2/);
    await writeFile(
      path.join(root, 'a.ts'),
      'export const value = 1;\n// unrelated later line\n',
    );
    assert.equal((await git(['status', '--porcelain'])).stdout, before);
    const client = await RuntimeClient.connect(
      path.resolve('dist/cli.cjs'),
      root,
    );
    try {
      const { sessionId } = (await client.call('session.open', {})) as {
        sessionId: string;
      };
      const text = 'export const value = 1;\n// unrelated later line\n';
      const traced = (await client.call(
        'history.query',
        {
          observation: {
            path: 'a.ts',
            uri: pathToFileURL(path.join(root, 'a.ts')).href,
            text,
            documentVersion: 1,
            dirty: false,
            cursor: evidence.range.start,
            selection: evidence.range,
            visibleRanges: [],
            openFiles: ['a.ts'],
          },
        },
        sessionId,
      )) as typeof evidence;
      assert.equal(traced.selectedCommits[0], introduced);
      assert.notEqual(traced.commits[0]?.sha, introduced);
      await assert.rejects(client.call('git.push', {}, sessionId));
      await assert.rejects(client.call('github.post', {}, sessionId));
      await client.call('session.close', {}, sessionId);
    } finally {
      client.dispose();
    }
    await assert.rejects(
      new GitHistory(root).history('../outside.ts', evidence.range),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
