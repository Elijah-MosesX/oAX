import { spawn } from 'node:child_process';
import path from 'node:path';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
const executable = process.env.OAX_NVIM_EXECUTABLE;
if (!executable || !path.isAbsolute(executable))
  throw new Error(
    'Set OAX_NVIM_EXECUTABLE to an absolute Neovim 0.11.5 executable',
  );
const proposal = process.env.OAX_NVIM_PROPOSAL_TEST === '1';
const lifecycle = process.env.OAX_NVIM_LIFECYCLE_TEST === '1';
const live = process.env.OAX_NVIM_LIVE_TEST === '1' || proposal || lifecycle;
const presence = process.env.OAX_NVIM_PRESENCE_TEST === '1';
const verify = process.env.OAX_NVIM_VERIFY_TEST === '1';
const edits = process.env.OAX_NVIM_EDIT_TEST === '1' || verify;
if ((proposal && lifecycle) || (live && edits) || (presence && (live || edits)))
  throw new Error('Choose one acceptance mode');
let workspace;
if (live || edits) {
  if (
    live &&
    (!process.env.OAX_CODEX_EXECUTABLE ||
      !path.isAbsolute(process.env.OAX_CODEX_EXECUTABLE))
  )
    throw new Error(
      'Live Neovim acceptance requires an absolute OAX_CODEX_EXECUTABLE and consumes account usage',
    );
  await mkdir('.oax', { recursive: true });
  workspace = await mkdtemp(
    path.resolve(edits ? '.oax/nvim-edit-' : '.oax/nvim-live-'),
  );
  await writeFile(
    path.join(workspace, edits ? 'example.ts' : 'example.mjs'),
    'export function add(a, b) { return a + b; }\n' +
      (edits
        ? 'export const result = add(1, 2);\n'
        : proposal
          ? '// preserved outside selection\n'
          : ''),
  );
  if (edits)
    await writeFile(
      path.join(workspace, 'caller.ts'),
      "import { add } from './example';\nexport const value = add(3, 4);\n",
    );
  if (proposal)
    await writeFile(
      path.join(workspace, 'proposal.test.mjs'),
      "import assert from 'node:assert/strict';\nimport {add} from './example.mjs';\nassert.equal(add(7, 2), 5);\n",
    );
  if (verify)
    await writeFile(
      path.join(workspace, 'verify.test.mjs'),
      "import {readFileSync,writeFileSync} from 'node:fs';\nimport assert from 'node:assert/strict';\nassert.match(readFileSync('example.ts','utf8'), /function renamed/);\nwriteFileSync('ran.txt','yes');\n",
    );
  console.log(
    `Synthetic Neovim acceptance (live provider: ${live}). Evidence: ${workspace}`,
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
      presence
        ? 'tests/neovim/presence.lua'
        : lifecycle
          ? 'tests/neovim/lifecycle.lua'
          : proposal
            ? 'tests/neovim/proposal.lua'
            : live
              ? 'tests/neovim/live.lua'
              : edits
                ? 'tests/neovim/edit.lua'
                : 'tests/neovim/acceptance.lua',
    ),
  ],
  {
    shell: false,
    windowsHide: true,
    stdio: live || edits ? ['pipe', 'inherit', 'inherit'] : 'inherit',
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
  if (live || edits) {
    const result = JSON.parse(
      await readFile(path.join(workspace, 'acceptance.json'), 'utf8'),
    );
    if (
      (proposal && !result.proposal) ||
      (lifecycle && !result.lifecycle) ||
      (verify && !result.verification) ||
      !result.verified ||
      result.engine !== (live ? 'codex' : 'mock')
    )
      throw new Error(
        'Neovim acceptance receipt is missing or has the wrong engine',
      );
  }
} finally {
  clearTimeout(timer);
}
