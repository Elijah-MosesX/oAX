import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Chrome launcher has no privileged permissions and rejects remote/ambiguous links', async () => {
  const source = await readFile('adapters/chrome/link.js', 'utf8');
  const { workbenchLink } = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  );
  const token = 'a'.repeat(64);
  assert.equal(
    workbenchLink(`http://127.0.0.1:1234/#${token}`),
    `http://127.0.0.1:1234/#${token}`,
  );
  for (const url of [
    `https://example.com/#${token}`,
    `http://localhost:1234/#${token}`,
    `http://127.0.0.1:1234/other#${token}`,
    `http://user@127.0.0.1:1234/#${token}`,
    `http://127.0.0.1:1234/?secret=a#${token}`,
    'javascript:alert(1)',
    'http://127.0.0.1:1234/#short',
  ])
    assert.throws(() => workbenchLink(url));
  const manifest = JSON.parse(
    await readFile('adapters/chrome/manifest.json', 'utf8'),
  );
  assert.equal(manifest.manifest_version, 3);
  for (const key of [
    'permissions',
    'host_permissions',
    'content_scripts',
    'externally_connectable',
  ])
    assert.equal(manifest[key], undefined);
});
