import path from 'node:path';
import {
  mkdir,
  lstat,
  realpath,
  readFile,
  writeFile,
  open,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
async function main() {
  const root = await realpath(path.resolve(__dirname, '..'));
  const plan = {
    version: '0.1',
    browser: '154.0.8037.92',
    url: 'https://storage.googleapis.com/chrome-for-testing-public/154.0.8037.92/win64/chrome-win64.zip',
    sha256: 'b897ef3601c947ac0620c784556dec719ac602b0159ce105927acf645ee0f598',
    disclosure:
      'Download a dedicated Chrome for Testing from Google to this extracted application (approximately 196 MiB). Run its checksum-verified setup.exe --configure-browser-in-directory only on the downloaded browser folder to establish Windows sandbox read/execute permissions. No repository, personal profile, credentials, global installation or system security settings are changed.',
  };
  const hash = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  if (process.argv.length === 2) {
    console.log(JSON.stringify({ ...plan, hash }, null, 2));
    return;
  }
  if (
    process.argv.length !== 4 ||
    process.argv[2] !== '--approve' ||
    process.argv[3] !== hash
  )
    throw new Error('Approve the exact browser download preview');
  let directory = root;
  for (const segment of [
    '.oax',
    'browser-cache',
    'chrome',
    'win64-154.0.8037.92',
  ]) {
    directory = path.join(directory, segment);
    await mkdir(directory).catch((error) => {
      if (error.code !== 'EEXIST') throw error;
    });
    if (
      (await lstat(directory)).isSymbolicLink() ||
      (await realpath(directory)) !== directory
    )
      throw new Error('Redirected installation path');
  }
  const archive = path.join(directory, 'chrome-win64.zip');
  let existing;
  try {
    const metadata = await lstat(archive);
    if (metadata.isSymbolicLink() || metadata.size > 256 * 1024 * 1024)
      throw new Error('Invalid archive');
    existing = await readFile(archive);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (!existing) {
    const response = await fetch(plan.url, {
      redirect: 'error',
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok || !response.body)
      throw new Error('Official browser download failed');
    const file = await open(archive, 'wx');
    let size = 0;
    try {
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 256 * 1024 * 1024) throw new Error('Download exceeds limit');
        await file.writeFile(chunk);
      }
    } finally {
      await file.close();
    }
    existing = await readFile(archive);
  }
  if (createHash('sha256').update(existing).digest('hex') !== plan.sha256)
    throw new Error('Browser archive checksum mismatch');
  const executable = path.join(directory, 'chrome-win64', 'chrome.exe');
  try {
    await lstat(executable);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Add-Type -AssemblyName System.IO.Compression.FileSystem; $archive=[System.IO.Compression.ZipFile]::OpenRead($env:OAX_BROWSER_ARCHIVE); try { foreach($entry in $archive.Entries) { $target=[IO.Path]::GetFullPath([IO.Path]::Combine($env:OAX_BROWSER_DEST,$entry.FullName)); if(-not $target.StartsWith($env:OAX_BROWSER_DEST+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw "Invalid archive path"} } } finally { $archive.Dispose() }; [System.IO.Compression.ZipFile]::ExtractToDirectory($env:OAX_BROWSER_ARCHIVE,$env:OAX_BROWSER_DEST)',
      ],
      {
        env: {
          ...process.env,
          OAX_BROWSER_ARCHIVE: archive,
          OAX_BROWSER_DEST: directory,
        },
        windowsHide: true,
        encoding: 'utf8',
        timeout: 60000,
      },
    );
    if (result.status !== 0)
      throw new Error('Dedicated browser extraction failed');
  }
  if (!(await realpath(executable)).startsWith(directory + path.sep))
    throw new Error('Browser executable redirected');
  if (
    createHash('sha256')
      .update(await readFile(executable))
      .digest('hex') !==
    'f0b204ce7239e221f84c4030cd38e4b688ad05320acc8373da166f548bf57eb5'
  )
    throw new Error('Browser executable checksum mismatch');
  const setup = path.join(path.dirname(executable), 'setup.exe');
  if (
    (await realpath(setup)) !== setup ||
    createHash('sha256')
      .update(await readFile(setup))
      .digest('hex') !==
      '71ad0c3e995a03a1ede1f6e161a82f619f69abd4675956660b83db418e10be3a'
  )
    throw new Error('Browser sandbox setup checksum mismatch');
  const configured = spawnSync(
    setup,
    [`--configure-browser-in-directory=${path.dirname(executable)}`],
    { shell: false, windowsHide: true, stdio: 'ignore', timeout: 30000 },
  );
  // The official installer sometimes returns an error after applying permissions
  // (also documented by @puppeteer/browsers). Verify actual bounded state.
  const permissions = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$ErrorActionPreference="Stop"; $root=[IO.Path]::GetFullPath($env:OAX_SANDBOX_DIRECTORY); $sids=@("S-1-15-3-1024-3424233489-972189580-2057154623-747635277-1604371224-316187997-3786583170-1043257646","S-1-15-3-1024-2302894289-466761758-1166120688-1039016420-2430351297-4240214049-4028510897-3317428798"); $items=@(Get-Item -LiteralPath $root)+@(Get-ChildItem -LiteralPath $root -Recurse -Force); foreach($item in $items){ if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw "Redirected browser resource"}; $acl=if($item.PSIsContainer){[IO.Directory]::GetAccessControl($item.FullName)}else{[IO.File]::GetAccessControl($item.FullName)}; $rules=$acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]); foreach($sid in $sids){ $rights=0; foreach($rule in $rules){if($rule.IdentityReference.Value -eq $sid){if($rule.AccessControlType -eq "Deny"){throw "Denied sandbox rights"}; $rights=$rights -bor [int]$rule.FileSystemRights}}; if(($rights -band 1179817) -ne 1179817){throw "Missing sandbox read/execute rights"}} }',
    ],
    {
      shell: false,
      windowsHide: true,
      encoding: 'utf8',
      timeout: 30000,
      env: { ...process.env, OAX_SANDBOX_DIRECTORY: path.dirname(executable) },
    },
  );
  if (configured.error || permissions.status !== 0)
    throw new Error(
      `Browser sandbox permissions could not be verified (setup=${configured.status}, verify=${permissions.status}, error=${configured.error?.code || permissions.error?.code || 'none'}): ${permissions.stderr?.slice(0, 1200) || ''}; no launch was attempted`,
    );
  const manifest = path.join(root, '.oax', 'browser-install.json');
  try {
    if ((await lstat(manifest)).isSymbolicLink())
      throw new Error('Manifest symlink denied');
    const installed = JSON.parse(await readFile(manifest, 'utf8'));
    if (
      installed.version !== plan.browser ||
      path.resolve(root, installed.executable) !== executable
    )
      throw new Error(
        'Existing browser configuration preserved; inspect it before replacing',
      );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeFile(
      manifest,
      JSON.stringify(
        {
          version: plan.browser,
          executable: path.relative(root, executable),
          archiveSha256: plan.sha256,
        },
        null,
        2,
      ),
      { flag: 'wx' },
    );
  }
  console.log(
    'Dedicated pinned browser setup complete. Launch oax-desktop.cmd with your repository folder.',
  );
}
void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'Desktop setup failed',
  );
  process.exitCode = 1;
});
