import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import {
  mkdir,
  mkdtemp,
  writeFile,
  copyFile,
  readFile,
} from 'node:fs/promises';
const selectedExecutable = process.env.OAX_VSCODE_EXECUTABLE;
if (selectedExecutable && !path.isAbsolute(selectedExecutable))
  throw new Error(
    'OAX_VSCODE_EXECUTABLE must be an absolute editor executable',
  );
const executable =
  selectedExecutable ?? (await downloadAndUnzipVSCode('1.105.0'));
const packaged = process.env.OAX_PACKAGED_TEST === '1';
const live = process.env.OAX_LIVE_EDITOR_TEST === '1';
let workspace = path.resolve('tests/fixtures/workspace');
let harness;
let extensionRoot = path.resolve(
  packaged
    ? '.vscode-test/vsix-installed/oax-dev.oax-vscode-0.1.0'
    : 'adapters/vscode',
);
let profile = path.resolve(
  packaged ? '.vscode-test/packaged-profile' : '.vscode-test/profile',
);
if (live) {
  await mkdir(path.resolve('.vscode-test'), { recursive: true });
  workspace = await mkdtemp(path.resolve('.vscode-test/m4-live-'));
  const snapshot = await mkdtemp(path.resolve('.vscode-test/live-product-'));
  await mkdir(path.join(snapshot, 'dist'));
  for (const file of ['package.json', 'dist/extension.cjs', 'dist/runtime.cjs'])
    await copyFile(path.join(extensionRoot, file), path.join(snapshot, file));
  extensionRoot = snapshot;
  profile = path.resolve(
    '.vscode-test',
    `live-profile-${path.basename(workspace)}`,
  );
  harness = await mkdtemp(path.resolve('.vscode-test/live-harness-'));
  await writeFile(
    path.join(harness, 'package.json'),
    JSON.stringify({
      name: 'oax-live-acceptance',
      publisher: 'oax-dev',
      version: '0.1.0',
      engines: { vscode: '^1.105.0' },
      activationEvents: ['onStartupFinished'],
      main: './extension.cjs',
    }),
  );
  await copyFile(
    path.resolve('dist/live-editor.cjs'),
    path.join(harness, 'extension.cjs'),
  );
  await writeFile(
    path.join(workspace, 'example.mjs'),
    'export function add(a, b) { return a - b; }\n// unrelated fixture content\n',
  );
  await writeFile(
    path.join(workspace, 'consumer.mjs'),
    "import { add } from './example.mjs';\nexport function total(a, b) { return add(a, b); }\n",
  );
  await writeFile(
    path.join(workspace, 'example.test.mjs'),
    "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { total } from './consumer.mjs';\ntest('addition', () => assert.equal(total(2, 3), 5));\n",
  );
  console.log(
    `Live editor acceptance sends only synthetic fixture context. Evidence directory: ${workspace}`,
  );
}
// Launch without a shell so Windows workspace paths containing spaces stay intact.
const child = spawn(
  executable,
  [
    workspace,
    `--extensionDevelopmentPath=${extensionRoot}`,
    ...(live
      ? [`--extensionDevelopmentPath=${harness}`]
      : [`--extensionTestsPath=${path.resolve('dist/editor-tests.cjs')}`]),
    `--user-data-dir=${profile}`,
    `--extensions-dir=${path.resolve(packaged ? '.vscode-test/vsix-installed' : '.vscode-test/extensions')}`,
    '--disable-workspace-trust',
    ...(packaged ? [] : ['--disable-extensions']),
    '--disable-updates',
    '--skip-welcome',
    '--skip-release-notes',
    '--no-sandbox',
    '--disable-gpu-sandbox',
  ],
  { shell: false, windowsHide: !live, stdio: 'inherit' },
);
const timer = setTimeout(() => child.kill(), live ? 600_000 : 120_000);
try {
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Editor test exited ${code}`)),
    );
  });
  if (live) {
    const result = JSON.parse(
      await readFile(path.join(workspace, 'acceptance.json'), 'utf8'),
    );
    if (!result.report?.verified || !result.preservedSelection)
      throw new Error(
        'Live editor acceptance did not establish verified review',
      );
    console.log(
      `M4 LIVE PASSED on VS Code ${result.editorVersion}; actual provider, approval, edit, test and review evidence: ${path.join(workspace, 'acceptance.json')}`,
    );
  }
} finally {
  clearTimeout(timer);
}
