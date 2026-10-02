import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('workbench Buddy ignores out-of-order polls and visibility cannot call the runtime', async () => {
  const elements = new Map<
    string,
    {
      textContent: string;
      hidden: boolean;
      listeners: Record<string, () => void>;
      addEventListener(event: string, callback: () => void): void;
      setAttribute(): void;
    }
  >();
  const element = (id: string) => {
    if (!elements.has(id))
      elements.set(id, {
        textContent: '',
        hidden: false,
        listeners: {},
        addEventListener(event, callback) {
          this.listeners[event] = callback;
        },
        setAttribute() {},
      });
    return elements.get(id)!;
  };
  let requests = 0;
  const sandbox = vm.createContext({
    document: { getElementById: element, querySelectorAll: () => [] },
    history: { replaceState() {} },
    location: { hash: '' },
    navigator: {},
    fetch: () => {
      requests++;
      return new Promise(() => {});
    },
  });
  vm.runInContext(
    await readFile('apps/workbench/public/app.js', 'utf8'),
    sandbox,
  );
  vm.runInContext(
    `renderBuddy({revision:2,label:'Ready',inspection:{id:1,label:'Find callers',state:'completed'}});
    renderBuddy({revision:1,label:'Ready',inspection:{id:1,label:'Find callers',state:'running'}});`,
    sandbox,
  );
  assert.equal(
    element('buddy-operation').textContent,
    'Find callers · completed',
  );
  assert.equal(
    element('buddy-location').textContent,
    'No observed agent location.',
  );
  const before = requests;
  element('buddy-toggle').listeners.click!();
  assert.equal(element('buddy').hidden, true);
  element('buddy-toggle').listeners.click!();
  assert.equal(element('buddy').hidden, false);
  assert.equal(requests, before);
  vm.runInContext(
    `buddyRevision = Infinity; renderBuddy({revision:3,label:'Working'});`,
    sandbox,
  );
  assert.equal(
    element('buddy-state').textContent,
    'Ready · Local graph session',
  );
});
