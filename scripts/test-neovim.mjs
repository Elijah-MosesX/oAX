import { spawn } from 'node:child_process';
import path from 'node:path';
const executable = process.env.OAX_NVIM_EXECUTABLE;
if (!executable || !path.isAbsolute(executable))
  throw new Error(
    'Set OAX_NVIM_EXECUTABLE to an absolute Neovim 0.11.5 executable',
  );
const child = spawn(
  executable,
  [
    '--headless',
    '-u',
    'NONE',
    '-i',
    'NONE',
    '--cmd',
    `set rtp+=${path.resolve('adapters/neovim').replaceAll('\\', '/').replaceAll(' ', '\\ ')}`,
    '-l',
    path.resolve('tests/neovim/acceptance.lua'),
  ],
  {
    shell: false,
    windowsHide: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      OAX_REPO: process.cwd().replaceAll('\\', '/'),
      OAX_NODE: process.execPath,
    },
  },
);
const timer = setTimeout(() => child.kill(), 120000);
try {
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Neovim acceptance exited ${code}`)),
    );
  });
} finally {
  clearTimeout(timer);
}
