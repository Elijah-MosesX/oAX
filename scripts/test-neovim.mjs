import { spawn } from 'node:child_process';
import path from 'node:path';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
const executable = process.env.OAX_NVIM_EXECUTABLE;
if (!executable || !path.isAbsolute(executable))
  throw new Error(
    'Set OAX_NVIM_EXECUTABLE to an absolute Neovim 0.11.5 executable',
  );
const live = process.env.OAX_NVIM_LIVE_TEST === '1';
let workspace;
if (live) {
  if (
    !process.env.OAX_CODEX_EXECUTABLE ||
    !path.isAbsolute(process.env.OAX_CODEX_EXECUTABLE)
  )
    throw new Error(
      'Live Neovim acceptance requires an absolute OAX_CODEX_EXECUTABLE and consumes account usage',
    );
  await mkdir('.oax', { recursive: true });
  workspace = await mkdtemp(path.resolve('.oax/nvim-live-'));
  await writeFile(
    path.join(workspace, 'example.mjs'),
    'export function add(a, b) { return a + b; }\n',
  );
  console.log(
    `Live Neovim acceptance sends only synthetic code. Evidence: ${workspace}`,
  );
}
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
    path.resolve(
      live ? 'tests/neovim/live.lua' : 'tests/neovim/acceptance.lua',
    ),
  ],
  {
    shell: false,
    windowsHide: true,
    stdio: live ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    env: {
      ...process.env,
      OAX_REPO: process.cwd().replaceAll('\\', '/'),
      OAX_NODE: process.execPath,
      ...(workspace
        ? { OAX_LIVE_WORKSPACE: workspace.replaceAll('\\', '/') }
        : {}),
    },
  },
);
const timer = setTimeout(() => child.kill(), live ? 240000 : 120000);
try {
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Neovim acceptance exited ${code}`)),
    );
  });
  if (live) {
    const result = JSON.parse(
      await readFile(path.join(workspace, 'acceptance.json'), 'utf8'),
    );
    if (!result.verified || result.engine !== 'codex')
      throw new Error('Live Neovim acceptance did not verify Codex');
  }
} finally {
  clearTimeout(timer);
}
