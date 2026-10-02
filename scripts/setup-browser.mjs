import {
  Browser,
  BrowserTag,
  detectBrowserPlatform,
  resolveBuildId,
  install,
} from '@puppeteer/browsers';
import { mkdir, realpath, lstat, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = await realpath('.');
const state = path.join(root, '.oax');
await mkdir(state, { recursive: true });
if ((await lstat(state)).isSymbolicLink() || (await realpath(state)) !== state)
  throw new Error('Unsafe browser cache directory');
const cacheDir = path.join(state, 'browser-cache');
await mkdir(cacheDir, { recursive: true });
if (
  (await lstat(cacheDir)).isSymbolicLink() ||
  (await realpath(cacheDir)) !== cacheDir
)
  throw new Error('Unsafe browser cache directory');
const platform = detectBrowserPlatform();
if (!platform) throw new Error('Unsupported browser platform');
const buildId = await resolveBuildId(
  Browser.CHROME,
  platform,
  BrowserTag.STABLE,
);
if (Number(buildId.split('.')[0]) < 149)
  throw new Error(
    'Chrome 149+ is required for request-level origin restrictions',
  );
console.log(
  `Installing dedicated Chrome for Testing ${buildId} in ignored local state.`,
);
const browser = await install({
  browser: Browser.CHROME,
  buildId,
  platform,
  cacheDir,
});
const executable = await realpath(browser.executablePath);
if (!executable.startsWith(cacheDir + path.sep))
  throw new Error('Unexpected browser executable path');
await writeFile(
  path.join(state, 'browser-install.json'),
  JSON.stringify({ version: buildId, executable }, null, 2) + '\n',
);
console.log(
  'Dedicated testing browser installed; no user browser profile accessed.',
);
