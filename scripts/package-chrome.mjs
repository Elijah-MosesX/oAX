import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const source = path.resolve('adapters/chrome');
const expected = [
  'link.js',
  'manifest.json',
  'popup.css',
  'popup.html',
  'popup.js',
];
if (
  JSON.stringify((await readdir(source)).sort()) !==
  JSON.stringify(expected.sort())
)
  throw new Error('Chrome package contains unexpected files');
const manifest = JSON.parse(
  await readFile(path.join(source, 'manifest.json'), 'utf8'),
);
if (
  manifest.permissions ||
  manifest.host_permissions ||
  manifest.content_scripts ||
  manifest.externally_connectable
)
  throw new Error('Launcher permission boundary changed');
await mkdir('dist', { recursive: true });
const zip = path.resolve(`dist/oax-chrome-0.1.0-${Date.now()}.zip`);
const run = spawnSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    'Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory($env:OAX_CHROME_SOURCE,$env:OAX_CHROME_ZIP)',
  ],
  {
    shell: false,
    windowsHide: true,
    env: { ...process.env, OAX_CHROME_SOURCE: source, OAX_CHROME_ZIP: zip },
    stdio: 'ignore',
  },
);
if (run.status !== 0) throw new Error('Chrome ZIP creation failed');
const sha256 = createHash('sha256')
  .update(await readFile(zip))
  .digest('hex');
await writeFile(
  'dist/chrome-package.json',
  JSON.stringify({ zip, sha256, files: expected }, null, 2),
);
console.log(
  `Chrome launcher packaged: ${zip}\nSHA-256 ${sha256}; five files; no host, content, history or storage permissions.`,
);
