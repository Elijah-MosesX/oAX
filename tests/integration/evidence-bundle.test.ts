import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
test('deployed public bundle cannot overwrite browser location or leak schema globals', async () => {
  const element = { addEventListener() {}, hidden: true };
  const sandbox = {
    document: { getElementById: () => element },
    window: { addEventListener() {} },
    navigator: {},
    TextEncoder,
  };
  const original = { href: 'https://oax.test/' };
  Object.defineProperty(sandbox, 'location', {
    get: () => original,
    set() {
      throw new Error('Browser location overwritten');
    },
  });
  vm.runInNewContext(await readFile('dist/evidence/app.js', 'utf8'), sandbox, {
    timeout: 3000,
  });
  assert.equal(original.href, 'https://oax.test/');
  assert.equal(Object.hasOwn(sandbox, 'parseEvidence'), false);
  assert.equal(Object.hasOwn(sandbox, 'z'), false);
});
