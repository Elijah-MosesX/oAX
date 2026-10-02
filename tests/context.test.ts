import test from 'node:test';
import { redact, redactContext } from '@oax/context';
import assert from 'node:assert/strict';
test('known tokens and labeled credentials are redacted without treating surrounding code as policy', () => {
  const secret = 'sk-' + 'synthetic'.repeat(4);
  const text = `const apiKey = "${secret}"; const password = 'synthetic-password'; // Bearer fixture-token-value`;
  const cleaned = redact(text);
  assert.equal(cleaned.count, 3);
  assert.equal(cleaned.text.includes(secret), false);
  assert.equal(cleaned.text.includes('synthetic-password'), false);
  assert.match(cleaned.text, /const apiKey/);
  assert.deepEqual(redact(cleaned.text), { text: cleaned.text, count: 0 });
  const context = redactContext({
    objective: 'Explain',
    path: 'a.ts',
    range: { start: { line: 0, column: 0 }, end: { line: 0, column: 1 } },
    documentVersion: 1,
    dirty: true,
    excerpt: text,
    truncated: false,
    provenance: 'editor-buffer',
    trust: 'untrusted',
  });
  assert.equal(context.redactions, 3);
});
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildContext, workspacePath } from '@oax/context';
import { SpatialStore } from '@oax/spatial';
import { fixtureRoot, observation } from './helpers.js';
test('context uses exact unsaved snapshot, end-exclusive coordinates, provenance, and budget', async () => {
  const input = observation('zero\r\nselected-tail');
  input.selection = {
    start: { line: 1, column: 0 },
    end: { line: 1, column: 8 },
  };
  const context = await buildContext(fixtureRoot, input, 'Explain', 4);
  assert.equal(context.excerpt, 'sele');
  assert.equal(context.truncated, true);
  assert.equal(context.dirty, true);
  assert.equal(context.provenance, 'editor-buffer');
  assert.equal(context.trust, 'untrusted');
  assert.equal(context.documentVersion, 2);
});
test('selection bounds, empty selection, URI mismatch, path traversal, and exclusions fail closed', async () => {
  for (const resource of [
    '../outside.ts',
    '/outside.ts',
    'C:/outside.ts',
    'a\\b.ts',
    'a/../example.ts',
    '.env',
    '.git/config',
    'node_modules/file.ts',
    '.aws/config',
    'secret.pem',
  ])
    await assert.rejects(workspacePath(fixtureRoot, resource));
  await assert.rejects(
    buildContext(
      fixtureRoot,
      { ...observation(), uri: 'https://example.com/file' },
      'Explain',
    ),
  );
  for (const selection of [
    { start: { line: 0, column: 2 }, end: { line: 0, column: 1 } },
    { start: { line: 5, column: 0 }, end: { line: 5, column: 1 } },
    { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
  ])
    await assert.rejects(
      buildContext(fixtureRoot, { ...observation(), selection }, 'Explain'),
    );
});
test('realpath rejects a symlink escaping the workspace', async (t) => {
  const temp = await mkdtemp(path.join(tmpdir(), 'oax-boundary-'));
  try {
    await writeFile(path.join(temp, 'outside.ts'), 'private');
    const root = path.join(temp, 'root');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(root);
    try {
      await symlink(
        temp,
        path.join(root, 'escape'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM') {
        t.skip('Windows symlink/junction privilege unavailable');
        return;
      }
      throw error;
    }
    await assert.rejects(workspacePath(root, 'escape/outside.ts'));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
test('spatial versions reject stale and conflicting buffers while isolating sessions', () => {
  const store = new SpatialStore();
  store.update('one', observation());
  assert.throws(() => store.update('one', observation('old', 1)));
  assert.throws(() => store.update('one', observation('conflict', 2)));
  store.update('two', observation('independent', 1));
  store.close('one');
  store.update('one', observation('fresh', 1));
});
