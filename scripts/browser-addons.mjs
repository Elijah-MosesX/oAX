import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = await realpath('.');
const editor = JSON.parse(await readFile('.tools/editor-install.json', 'utf8'));
const browser = JSON.parse(await readFile('.oax/browser-install.json', 'utf8'));
const vimium = path.resolve(editor.vimium);
const launcher = path.join(root, 'adapters/chrome');
if (
  vimium !==
    path.join(
      root,
      '.tools/vimium/eb737abdd65b070c05ef06d39f1d78751aa7f738/vimium-eb737abdd65b070c05ef06d39f1d78751aa7f738',
    ) ||
  (await realpath(vimium)) !== vimium ||
  (await realpath(launcher)) !== launcher
)
  throw new Error('Add-on path redirected');
const archive = path.join(root, '.tools/vimium-download/vimium.zip');
if (
  createHash('sha256')
    .update(await readFile(archive))
    .digest('hex') !==
  '9826655443cb2f544f81577884679f6df30355c9a2f6dfc2609f1d2bdad454c8'
)
  throw new Error('Vimium archive checksum mismatch');
// Compare every extracted upstream file with the verified archive, without
// executing upstream build scripts or loading a personal browser profile.
const integrity = spawnSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    'Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip=[IO.Compression.ZipFile]::OpenRead($env:OAX_ADDON_ARCHIVE); try { foreach($entry in $zip.Entries){if($entry.Name -eq ""){continue}; $relative=$entry.FullName.Substring($entry.FullName.IndexOf("/")+1); $target=[IO.Path]::GetFullPath([IO.Path]::Combine($env:OAX_ADDON_ROOT,$relative)); if(-not $target.StartsWith($env:OAX_ADDON_ROOT+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw "Archive boundary"}; if(([IO.File]::GetAttributes($target) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw "Redirected add-on"}; $stream=$entry.Open(); try{$digest=[Security.Cryptography.SHA256]::Create(); $expected=[BitConverter]::ToString($digest.ComputeHash($stream)); $disk=[IO.File]::OpenRead($target); try{$actual=[BitConverter]::ToString($digest.ComputeHash($disk))}finally{$disk.Dispose()}; if($expected -ne $actual){throw "Modified Vimium source"}}finally{$stream.Dispose()} } }finally{$zip.Dispose()}',
  ],
  {
    shell: false,
    windowsHide: true,
    timeout: 30000,
    stdio: 'ignore',
    env: { ...process.env, OAX_ADDON_ARCHIVE: archive, OAX_ADDON_ROOT: vimium },
  },
);
if (integrity.status !== 0)
  throw new Error('Vimium extracted-source integrity failed');
const executable = path.resolve(root, browser.executable);
if (
  !(await realpath(executable)).startsWith(
    path.join(root, '.oax/browser-cache') + path.sep,
  ) ||
  createHash('sha256')
    .update(await readFile(executable))
    .digest('hex') !==
    'f0b204ce7239e221f84c4030cd38e4b688ad05320acc8373da166f548bf57eb5'
)
  throw new Error('Dedicated browser integrity failed');
const profile = path.join(root, '.oax/browser-addons-profile');
await mkdir(profile, { recursive: true });
if ((await realpath(profile)) !== profile)
  throw new Error('Add-on profile redirected');
const verify = process.argv.slice(2).includes('--verify');
const result = spawnSync(
  executable,
  [
    `--user-data-dir=${profile}`,
    `--load-extension=${launcher},${vimium}`,
    `--disable-extensions-except=${launcher},${vimium}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    '--disable-background-networking',
    '--disable-component-update',
    ...(verify
      ? ['--headless=new', '--dump-dom', 'about:blank']
      : ['chrome://extensions/']),
  ],
  {
    shell: false,
    windowsHide: true,
    timeout: verify ? 45000 : undefined,
    stdio: verify ? 'pipe' : 'ignore',
    encoding: 'utf8',
  },
);
if (result.pid)
  spawnSync('taskkill.exe', ['/PID', String(result.pid), '/T', '/F'], {
    shell: false,
    windowsHide: true,
    stdio: 'ignore',
    timeout: 5000,
  });
if (!verify && (result.error || result.status !== 0))
  throw new Error('Owned extension browser failed to run');
if (verify) {
  const preferences = JSON.parse(
    await readFile(path.join(profile, 'Default/Secure Preferences'), 'utf8'),
  );
  const settings = Object.values(preferences.extensions?.settings || {});
  const relevant = settings.filter(
    (setting) => setting.path === launcher || setting.path === vimium,
  );
  const installed = relevant.map((setting) => ({
    path: path.relative(root, setting.path),
    disabled: setting.disable_reasons,
    version: setting.service_worker_registration_info?.version,
  }));
  if (
    relevant.length !== 2 ||
    relevant.some((setting) => setting.disable_reasons?.length)
  )
    throw new Error('Browser did not enable both unpacked extensions');
  await writeFile(
    'dist/browser-addons-acceptance.json',
    JSON.stringify(
      {
        passed: true,
        browser: browser.version,
        vimium: '2.4.2',
        profile: '.oax/browser-addons-profile',
        installed,
      },
      null,
      2,
    ),
  );
  console.log(
    'Actual dedicated Chrome registered oAX launcher and verified Vimium 2.4.2. Personal profiles unchanged.',
  );
}
