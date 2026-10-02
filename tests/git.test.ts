import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GitHistory } from '@oax/git';
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
    assert.equal((await git(['status', '--porcelain'])).stdout, before);
    await assert.rejects(
      new GitHistory(root).history('../outside.ts', evidence.range),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
