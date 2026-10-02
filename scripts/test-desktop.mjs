import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  copyFile,
  readdir,
  rm,
  access,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const descriptor = JSON.parse(
  await readFile('dist/desktop-package.json', 'utf8'),
);
assert.equal(
  createHash('sha256')
    .update(await readFile(descriptor.zip))
    .digest('hex'),
  descriptor.sha256,
);
const dist = path.resolve('dist');
const base = await mkdtemp(path.join(dist, 'desktop-acceptance-'));
const installed = path.join(base, 'relocated application with spaces');
const fixture = path.join(base, 'real repository');
await mkdir(installed);
await mkdir(fixture);
await writeFile(
  path.join(fixture, 'sample.ts'),
  'export function add(a: number, b: number) { return a+b; }\nexport const sum = add(1,2);\n',
);
const extract = spawnSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    'Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($env:OAX_PACKAGE_ARCHIVE,$env:OAX_PACKAGE_DEST)',
  ],
  {
    env: {
      ...process.env,
      OAX_PACKAGE_ARCHIVE: descriptor.zip,
      OAX_PACKAGE_DEST: installed,
    },
    windowsHide: true,
    encoding: 'utf8',
    timeout: 60000,
  },
);
assert.equal(extract.status, 0);
const manifest = JSON.parse(
  await readFile(path.join(installed, 'manifest.json'), 'utf8'),
);
for (const [file, metadata] of Object.entries(manifest.files)) {
  const bytes = await readFile(path.join(installed, file));
  assert.equal(bytes.length, metadata.bytes);
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    metadata.sha256,
  );
}
const inventory = (
  await readdir(installed, { recursive: true, withFileTypes: true })
)
  .filter((entry) => entry.isFile())
  .map((entry) =>
    path
      .relative(installed, path.join(entry.parentPath, entry.name))
      .replaceAll('\\', '/'),
  )
  .sort();
assert.deepEqual(
  inventory,
  [...Object.keys(manifest.files), 'manifest.json'].sort(),
);
const node = path.join(installed, 'node.exe');
assert.equal(
  spawnSync(node, ['--version'], { encoding: 'utf8' }).stdout.trim(),
  'v24.19.0',
);
function start(desktop) {
  const child = spawn(
    node,
    [
      path.join(installed, 'dist/workbench.cjs'),
      fixture,
      ...(desktop ? ['--desktop'] : []),
    ],
    {
      env: { ...process.env, OAX_DESKTOP_PROBE: '1' },
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    },
  );
  child.stderr.resume();
  const messages = new Map(),
    waiters = new Map();
  child.on('message', (message) => {
    if (message.type === 'desktop.exit')
      console.log('Owned browser exit:', message);
    messages.set(message.type, message);
    waiters.get(message.type)?.(message);
  });
  const wait = (type) =>
    new Promise((resolve, reject) => {
      if (messages.has(type)) return resolve(messages.get(type));
      const timer = setTimeout(
        () => reject(new Error(`Timed out waiting for ${type}`)),
        30000,
      );
      waiters.set(type, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
    });
  const exit = new Promise((resolve) =>
    child.once('exit', (code) => resolve(code)),
  );
  return {
    child,
    wait,
    async close() {
      if (child.connected) child.send('close');
      const timer = setTimeout(() => child.kill(), 12000);
      const code = await exit;
      clearTimeout(timer);
      assert.equal(code, 0);
    },
  };
}
let active;
try {
  active = start(false);
  const ready = await active.wait('workbench.ready');
  const post = async (route, payload, auth = {}) =>
    fetch(ready.origin + route, {
      method: 'POST',
      headers: {
        Origin: ready.origin,
        'Content-Type': 'application/json',
        ...auth,
      },
      body: JSON.stringify(payload),
    });
  const connected = await post('/connect', { token: ready.url.split('#')[1] });
  assert.equal(connected.status, 200);
  const data = await connected.json();
  const auth = {
    Cookie: connected.headers.get('set-cookie').split(';')[0],
    'X-oax-csrf': data.csrf,
  };
  const opened = await (
    await post('/file', { resource: 'sample.ts' }, auth)
  ).json();
  opened.observation.cursor = { line: 0, column: 20 };
  opened.observation.selection = {
    start: { line: 0, column: 20 },
    end: { line: 0, column: 23 },
  };
  const graph = await post(
    '/rpc',
    {
      method: 'graph.query',
      payload: { observation: opened.observation, relationship: 'callers' },
    },
    auth,
  );
  assert.equal(graph.status, 200);
  assert.match(JSON.stringify(await graph.json()), /sample.ts/);
  assert.equal(
    (await post('/rpc', { method: 'refactor.apply', payload: {} }, auth))
      .status,
    400,
  );
  await active.close();
  active = undefined;
  const setup = path.join(installed, 'scripts/setup-desktop.cjs');
  const preview = spawnSync(node, [setup], { encoding: 'utf8' });
  assert.equal(preview.status, 0);
  const plan = JSON.parse(preview.stdout);
  assert.equal(
    spawnSync(node, [setup, '--approve', 'wrong'], { encoding: 'utf8' }).status,
    1,
  );
  await assert.rejects(access(path.join(installed, '.oax')));
  const browserCache = path.join(
    installed,
    '.oax/browser-cache/chrome/win64-154.0.8037.92',
  );
  await mkdir(browserCache, { recursive: true });
  await copyFile(
    '.tools/desktop/chrome-win64.zip',
    path.join(browserCache, 'chrome-win64.zip'),
  );
  const setupResult = spawnSync(node, [setup, '--approve', plan.hash], {
    encoding: 'utf8',
    timeout: 60000,
  });
  assert.equal(setupResult.status, 0, setupResult.stdout + setupResult.stderr);
  active = start(true);
  const desktop = await active.wait('workbench.ready');
  try {
    await active.wait('desktop.authenticated');
  } catch (error) {
    try {
      const ports = (
        await readFile(path.join(desktop.profile, 'DevToolsActivePort'), 'utf8')
      ).split('\n');
      const pages = await (
        await fetch(`http://127.0.0.1:${Number(ports[0])}/json/list`, {
          signal: AbortSignal.timeout(3000),
        })
      ).json();
      console.log(
        'Owned browser pages:',
        pages.map((page) => ({
          type: page.type,
          url: page.url.split('#')[0],
          title: page.title,
        })),
      );
    } catch {
      console.log('Owned browser debugging endpoint was not ready.');
    }
    try {
      console.log(
        (await readFile(path.join(desktop.profile, 'startup.log'), 'utf8'))
          .slice(-3000)
          .replace(/[a-f0-9]{64}/gi, '[EPHEMERAL-ID]'),
      );
    } catch {}
    active.child.send('inspect');
    console.log(await active.wait('transport.inspection'));
    throw error;
  }
  assert.ok(desktop.profile.includes('oax-workbench-'));
  await active.close();
  active = undefined;
  await assert.rejects(access(desktop.profile));
  await assert.rejects(fetch(desktop.origin));
  console.log(
    `Portable archive ${descriptor.sha256}: ${inventory.length} exact files verified. Bundled Node, relocated real runtime graph, denied writes, explicit pinned browser setup, actual desktop app authentication, profile and listener cleanup passed.`,
  );
  await writeFile(
    'dist/desktop-acceptance.json',
    JSON.stringify(
      {
        version: '0.1',
        zip: descriptor.zip,
        sha256: descriptor.sha256,
        files: inventory.length,
        node: '24.19.0',
        checks: [
          'archive-integrity',
          'content-allowlist',
          'relocation-with-spaces',
          'real-runtime-graph',
          'denied-writes',
          'setup-consent',
          'actual-desktop-authentication',
          'owned-profile-cleanup',
          'listener-cleanup',
        ],
        passed: true,
      },
      null,
      2,
    ),
  );
} finally {
  if (active) await active.close();
  if (
    path.dirname(base) !== dist ||
    !path.basename(base).startsWith('desktop-acceptance-')
  )
    throw new Error('Unexpected acceptance cleanup path');
  await rm(base, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 200,
  });
}
