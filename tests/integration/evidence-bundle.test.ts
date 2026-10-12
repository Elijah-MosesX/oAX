import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('public viewer renders connected evidence as text and clears notes and history', async () => {
  class Element {
    textContent = '';
    value = '';
    hidden = true;
    children: Element[] = [];
    listeners: Record<string, (event: { preventDefault(): void }) => void> = {};
    addEventListener(
      name: string,
      listener: (event: { preventDefault(): void }) => void,
    ) {
      this.listeners[name] = listener;
    }
    append(...children: Element[]) {
      this.children.push(...children);
    }
    replaceChildren() {
      this.children = [];
    }
  }
  const elements = new Map<string, Element>();
  const get = (id: string) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id)!;
  };
  const sandbox = {
    document: { getElementById: get, createElement: () => new Element() },
    window: { addEventListener() {} },
    navigator: {},
    TextEncoder,
  };
  vm.runInNewContext(await readFile('dist/evidence/app.js', 'utf8'), sandbox, {
    timeout: 3000,
  });
  get('evidence').value = await readFile(
    'tests/fixtures/connected-evidence.json',
    'utf8',
  );
  get('import').listeners.submit!({ preventDefault() {} });
  assert.equal(get('details').hidden, false);
  assert.ok(
    get('related').children.some((x) => x.textContent.includes('ORCHID-27')),
  );
  assert.ok(
    get('related').children.some((x) => x.textContent.includes('local-git')),
  );
  get('clear').listeners.click!({ preventDefault() {} });
  assert.equal(get('details').hidden, true);
  assert.equal(get('evidence').value, '');
  assert.equal(get('related').textContent, '');
});
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
