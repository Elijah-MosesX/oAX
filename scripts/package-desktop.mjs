import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  copyFile,
  cp,
  readdir,
  lstat,
  rm,
} from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
if (process.platform !== 'win32' || process.arch !== 'x64')
  throw new Error('This package targets Windows x64 only');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
if (
  hash(await readFile(process.execPath)) !==
  '3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'
)
  throw new Error('Use the verified official Node 24.19.0 Windows x64 binary');
const dist = path.resolve('dist');
await mkdir(dist, { recursive: true });
await mkdir('.tools/desktop', { recursive: true });
try {
  await readFile('.tools/desktop/NODE-LICENSE.txt');
} catch {
  const response = await fetch(
    'https://raw.githubusercontent.com/nodejs/node/v24.19.0/LICENSE',
    { redirect: 'error' },
  );
  if (!response.ok) throw new Error('Official Node license notice unavailable');
  const notice = Buffer.from(await response.arrayBuffer());
  if (notice.length > 262144) throw new Error('License notice exceeds limit');
  await writeFile('.tools/desktop/NODE-LICENSE.txt', notice, { flag: 'wx' });
}
const stage = await mkdtemp(path.join(dist, 'desktop-package-'));
const zip = path.join(dist, `oax-desktop-0.1.0-win-x64-${Date.now()}.zip`);
try {
  for (const directory of [
    'dist',
    'apps/workbench/public',
    'scripts',
    'licenses',
  ])
    await mkdir(path.join(stage, directory), { recursive: true });
  await copyFile(process.execPath, path.join(stage, 'node.exe'));
  for (const name of ['cli.cjs', 'workbench.cjs'])
    await copyFile(path.join(dist, name), path.join(stage, 'dist', name));
  await cp('apps/workbench/public', path.join(stage, 'apps/workbench/public'), {
    recursive: true,
  });
  await copyFile('LICENSE', path.join(stage, 'LICENSE'));
  await copyFile('docs/desktop.md', path.join(stage, 'README.md'));
  await copyFile(
    '.tools/desktop/NODE-LICENSE.txt',
    path.join(stage, 'licenses/NODE-LICENSE.txt'),
  );
  for (const [name, file] of [
    ['TYPESCRIPT-LICENSE.txt', 'node_modules/typescript/LICENSE.txt'],
    [
      'TYPESCRIPT-NOTICES.txt',
      'node_modules/typescript/ThirdPartyNoticeText.txt',
    ],
    ['ZOD-LICENSE.txt', 'packages/protocol/node_modules/zod/LICENSE'],
  ])
    await copyFile(file, path.join(stage, 'licenses', name));
  for (const name of ['desktop-launch', 'setup-desktop'])
    await build({
      entryPoints: [`scripts/${name}.mjs`],
      outfile: path.join(stage, 'scripts', `${name}.cjs`),
      bundle: true,
      platform: 'node',
      target: 'node24',
      format: 'cjs',
    });
  await writeFile(
    path.join(stage, 'oax-desktop.cmd'),
    '@echo off\r\n"%~dp0node.exe" "%~dp0scripts\\desktop-launch.cjs" %*\r\n',
  );
  const files = {};
  async function inventory(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if ((await lstat(file)).isSymbolicLink())
        throw new Error('Package symlink denied');
      if (entry.isDirectory()) await inventory(file);
      else {
        const relative = path.relative(stage, file).replaceAll('\\', '/');
        if (
          !['node.exe', 'LICENSE', 'README.md', 'oax-desktop.cmd'].includes(
            relative,
          ) &&
          !/^(dist\/(cli|workbench)\.cjs|apps\/workbench\/public\/(app\.js|style\.css|index\.html|manifest\.webmanifest|sw\.js|icon\.svg|icon-(192|512)\.png|offline\.html)|scripts\/(desktop-launch|setup-desktop)\.cjs|licenses\/[A-Z-]+\.txt)$/.test(
            relative,
          )
        )
          throw new Error('Unexpected packaged file');
        const bytes = await readFile(file);
        files[relative] = { bytes: bytes.length, sha256: hash(bytes) };
      }
    }
  }
  await inventory(stage);
  await writeFile(
    path.join(stage, 'manifest.json'),
    JSON.stringify(
      {
        version: '0.1.0',
        target: 'win-x64',
        node: '24.19.0',
        protocol: '0.1',
        surface: 'local-read-only-workbench',
        files,
      },
      null,
      2,
    ),
  );
  const packed = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory($env:OAX_PACKAGE_STAGE, $env:OAX_PACKAGE_OUTPUT)',
    ],
    {
      env: {
        ...process.env,
        OAX_PACKAGE_STAGE: stage,
        OAX_PACKAGE_OUTPUT: zip,
      },
      windowsHide: true,
      encoding: 'utf8',
      timeout: 60000,
    },
  );
  if (packed.status !== 0) throw new Error('Desktop archive creation failed');
  const checksum = hash(await readFile(zip));
  await writeFile(`${zip}.sha256`, `${checksum}  ${path.basename(zip)}\n`);
  await writeFile(
    path.join(dist, 'desktop-package.json'),
    JSON.stringify(
      { zip, sha256: checksum, files: Object.keys(files).length },
      null,
      2,
    ),
  );
  console.log(
    `Portable Windows preview packaged: ${zip}\nSHA-256 ${checksum}; ${Object.keys(files).length + 1} allowlisted files. Chrome is downloaded separately by explicit pinned setup. No publication.`,
  );
} finally {
  if (
    path.dirname(stage) !== dist ||
    !path.basename(stage).startsWith('desktop-package-')
  )
    throw new Error('Unexpected cleanup path');
  await rm(stage, { recursive: true, force: true });
}
