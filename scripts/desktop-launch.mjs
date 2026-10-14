import path from 'node:path';
import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
async function main() {
  const root = path.resolve(__dirname, '..');
  if (process.argv.length > 3) throw new Error('Specify one repository path');
  try {
    await access(path.join(root, '.oax', 'browser-install.json'));
  } catch {
    console.log(
      'First run: review the dedicated browser download by running node.exe scripts/setup-desktop.cjs from this extracted folder. It shows the exact approval hash.',
    );
    process.exitCode = 1;
  }
  if (!process.exitCode) {
    let workspace = process.argv[2];
    if (!workspace) {
      const input = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      try {
        workspace = await input.question('Repository folder: ');
      } finally {
        input.close();
      }
    }
    if (!workspace?.trim()) throw new Error('Choose a repository folder');
    const child = spawn(
      process.execPath,
      [path.join(root, 'dist/workbench.cjs'), workspace, '--desktop'],
      { shell: false, stdio: 'inherit', windowsHide: true },
    );
    child.once('exit', (code) => {
      process.exitCode = code ?? 1;
    });
    child.once('error', () => {
      console.error('Desktop could not start');
      process.exitCode = 1;
    });
  }
}
void main().catch(() => {
  console.error(
    'Choose an existing repository folder and complete the pinned browser setup.',
  );
  process.exitCode = 1;
});
