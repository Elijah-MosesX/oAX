import { readFile, writeFile, mkdir, realpath, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = path.resolve('.tools');
const pins = [
  {
    name: 'vim',
    version: '9.2.1162',
    url: 'https://github.com/vim/vim-win32-installer/releases/download/v9.2.1162/gvim_9.2.1162_x64_signed.zip',
    sha256: '19e29e7ade92a22d384928c92f11127166835c2ac5cefcebdd6fd3928174a0f7',
    destination: 'vim/9.2.1162',
  },
  {
    name: 'vimium',
    version: '2.4.2',
    commit: 'eb737abdd65b070c05ef06d39f1d78751aa7f738',
    url: 'https://codeload.github.com/philc/vimium/zip/eb737abdd65b070c05ef06d39f1d78751aa7f738',
    sha256: '9826655443cb2f544f81577884679f6df30355c9a2f6dfc2609f1d2bdad454c8',
    destination: 'vimium/eb737abdd65b070c05ef06d39f1d78751aa7f738',
  },
];
if (process.platform !== 'win32' || process.arch !== 'x64')
  throw new Error('This installer targets Windows x64');
await mkdir(root, { recursive: true });
if ((await lstat(root)).isSymbolicLink() || (await realpath(root)) !== root)
  throw new Error('Tool directory redirected');
for (const pin of pins) {
  const cache = path.join(root, pin.name + '-download');
  await mkdir(cache, { recursive: true });
  if ((await realpath(cache)) !== cache)
    throw new Error('Download cache redirected');
  const archive = path.join(cache, pin.name + '.zip');
  let bytes;
  try {
    if ((await lstat(archive)).isSymbolicLink())
      throw new Error('Archive redirected');
    bytes = await readFile(archive);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await fetch(pin.url, {
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error('Official tool download failed');
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 67108864) throw new Error('Tool archive exceeds limit');
      chunks.push(chunk);
    }
    bytes = Buffer.concat(chunks);
    if (createHash('sha256').update(bytes).digest('hex') !== pin.sha256)
      throw new Error('Tool checksum mismatch');
    await writeFile(archive, bytes, { flag: 'wx' });
  }
  if (createHash('sha256').update(bytes).digest('hex') !== pin.sha256)
    throw new Error('Tool checksum mismatch');
  const destination = path.join(root, pin.destination);
  await mkdir(path.dirname(destination), { recursive: true });
  if ((await realpath(path.dirname(destination))) !== path.dirname(destination))
    throw new Error('Install parent redirected');
  try {
    if ((await realpath(destination)) !== destination)
      throw new Error('Installation redirected');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await mkdir(destination);
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip=[IO.Compression.ZipFile]::OpenRead($env:OAX_TOOL_ARCHIVE); try { foreach($entry in $zip.Entries){ $target=[IO.Path]::GetFullPath([IO.Path]::Combine($env:OAX_TOOL_DEST,$entry.FullName)); if(-not $target.StartsWith($env:OAX_TOOL_DEST+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw "Invalid archive path"} } }finally{$zip.Dispose()}; [IO.Compression.ZipFile]::ExtractToDirectory($env:OAX_TOOL_ARCHIVE,$env:OAX_TOOL_DEST)',
      ],
      {
        shell: false,
        windowsHide: true,
        timeout: 60000,
        env: {
          ...process.env,
          OAX_TOOL_ARCHIVE: archive,
          OAX_TOOL_DEST: destination,
        },
      },
    );
    if (result.status !== 0) throw new Error('Portable tool extraction failed');
  }
}
await writeFile(
  path.join(root, 'editor-install.json'),
  JSON.stringify(
    {
      pins,
      vim: path.join(root, 'vim/9.2.1162/vim/vim92/vim.exe'),
      vimium: path.join(
        root,
        'vimium/eb737abdd65b070c05ef06d39f1d78751aa7f738/vimium-eb737abdd65b070c05ef06d39f1d78751aa7f738',
      ),
    },
    null,
    2,
  ),
);
console.log(
  'Pinned portable Vim and Vimium source installed in .tools. No personal settings, global PATH or browser profile changed.',
);
