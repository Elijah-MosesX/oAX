import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
const executable = await downloadAndUnzipVSCode('1.105.0');
const packaged = process.env.OAX_PACKAGED_TEST === '1';
// Launch without a shell so Windows workspace paths containing spaces stay intact.
const child = spawn(
  executable,
  [
    path.resolve('tests/fixtures/workspace'),
    ...(packaged
      ? [
          `--extensionDevelopmentPath=${path.resolve('.vscode-test/vsix-installed/oax-dev.oax-vscode-0.1.0')}`,
        ]
      : [`--extensionDevelopmentPath=${path.resolve('adapters/vscode')}`]),
    `--extensionTestsPath=${path.resolve('dist/editor-tests.cjs')}`,
    `--user-data-dir=${path.resolve(packaged ? '.vscode-test/packaged-profile' : '.vscode-test/profile')}`,
    `--extensions-dir=${path.resolve(packaged ? '.vscode-test/vsix-installed' : '.vscode-test/extensions')}`,
    '--disable-workspace-trust',
    ...(packaged ? [] : ['--disable-extensions']),
    '--disable-updates',
    '--skip-welcome',
    '--skip-release-notes',
    '--no-sandbox',
    '--disable-gpu-sandbox',
  ],
  { shell: false, windowsHide: true, stdio: 'inherit' },
);
const timer = setTimeout(() => child.kill(), 120_000);
try {
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Editor test exited ${code}`)),
    );
  });
} finally {
  clearTimeout(timer);
}
