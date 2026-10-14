import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';

// Dedicated synthetic browser session; never attaches to a personal profile.
const base = path.resolve('.oax');
const profile = await mkdtemp(path.join(base, 'hosted-evidence-'));
const browser = JSON.parse(await readFile('.oax/browser-install.json', 'utf8'));
const fixture = await readFile(
  'tests/fixtures/connected-evidence.json',
  'utf8',
);
const child = spawn(
  browser.executable,
  [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);
const closed = new Promise((resolve) => child.once('close', resolve));
let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try {
      port = (
        await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')
      ).split('\n')[0];
      break;
    } catch {
      await pause(200);
    }
  }
  assert.ok(port, 'Dedicated browser failed to start');
  const pages = await (
    await fetch(`http://127.0.0.1:${port}/json/list`)
  ).json();
  socket = new WebSocket(
    pages.find((p) => p.type === 'page').webSocketDebuggerUrl,
  );
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let next = 0;
  const pending = new Map();
  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id) {
      const item = pending.get(msg.id);
      if (item) {
        clearTimeout(item.timer);
        pending.delete(msg.id);
        if (msg.error) item.reject(new Error(msg.error.message));
        else item.resolve(msg.result);
      }
    }
  };
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++next;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 15000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await call('Runtime.evaluate', {
      expression,
      returnByValue: true,
    });
    assert.equal(result.exceptionDetails, undefined, 'Page script failed');
    return result.result.value;
  };
  const waitFor = async (expression) => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression)) return;
      await pause(200);
    }
    throw new Error(`Expected hosted UI state did not arrive: ${expression}`);
  };
  await call('Page.enable');
  await call('Page.navigate', {
    url: 'https://oax-evidence-viewer-xvokez.v2.appdeploy.ai/',
  });
  await waitFor(
    "document.readyState === 'complete' && !!document.querySelector('#evidence')",
  );
  await evaluate(
    `document.querySelector('#evidence').value=${JSON.stringify(fixture)};document.querySelector('#import').requestSubmit()`,
  );
  await waitFor("document.querySelector('#details')?.hidden === false");
  assert.ok(
    await evaluate(
      "document.querySelector('#related').textContent.includes('ORCHID-27') && document.querySelector('#related').textContent.includes('local-git')",
    ),
  );
  await evaluate("document.querySelector('#clear').click()");
  assert.ok(
    await evaluate(
      "document.querySelector('#details').hidden && !document.querySelector('#related').textContent",
    ),
  );
  await call('Page.navigate', { url: 'https://oax1-7mirgx.v2.appdeploy.ai/' });
  await waitFor(
    "document.readyState === 'complete' && !!document.querySelector('#export')",
  );
  const setInput = (value) =>
    evaluate(
      `Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(document.querySelector('#export'),${JSON.stringify(value)});document.querySelector('#export').dispatchEvent(new Event('input',{bubbles:true}));`,
    );
  await setInput(fixture);
  await waitFor(
    "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Inspect export'))?.disabled === true",
  );
  await evaluate("document.querySelector('input[type=checkbox]').click()");
  await waitFor(
    "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Inspect export'))?.disabled === false",
  );
  await evaluate(
    "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Inspect export')).click()",
  );
  await waitFor(
    "[...document.querySelectorAll('pre')].some(p=>p.textContent.includes('ORCHID-27'))",
  );
  assert.ok(
    await evaluate(
      "[...document.querySelectorAll('pre')].some(p=>p.textContent.includes('local-git'))",
    ),
  );
  await writeFile(
    '.oax/hosted-connected-evidence.png',
    Buffer.from(
      (await call('Page.captureScreenshot', { format: 'png' })).data,
      'base64',
    ),
  );
  await setInput('{');
  await waitFor(
    "document.querySelector('input[type=checkbox]').checked === false",
  );
  await evaluate("document.querySelector('input[type=checkbox]').click()");
  await waitFor(
    "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Inspect export'))?.disabled === false",
  );
  await evaluate(
    "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Inspect export')).click()",
  );
  await waitFor(
    "document.body.textContent.includes('This is not an oax-evidence.v1 export.') || document.body.textContent.includes('The evidence could not be inspected.')",
  );
  assert.equal(
    await evaluate(
      "[...document.querySelectorAll('pre')].some(p=>p.textContent.includes('ORCHID-27'))",
    ),
    false,
  );
  await writeFile(
    'dist/hosted-evidence-acceptance.json',
    JSON.stringify(
      {
        passed: true,
        checkedAt: new Date().toISOString(),
        scope:
          'Actual hosted viewer import/render/clear; oAX1 consent, backend connected evidence, consent reset and invalid-input recovery',
        limitations: [
          'No authenticated shared-room or two-user acceptance was performed.',
        ],
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'Hosted evidence acceptance passed using only a synthetic export.',
  );
} finally {
  socket?.close();
  child.kill();
  await closed;
  if (
    path.dirname(profile) !== base ||
    !path.basename(profile).startsWith('hosted-evidence-')
  )
    throw new Error('Unexpected browser cleanup path');
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 250,
  });
}
