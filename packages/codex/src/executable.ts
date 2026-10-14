import { readdir } from 'node:fs/promises';
import path from 'node:path';
/** User configuration wins. Discovery is restricted to the official Windows app location. */
export async function providerExecutable(configured?: string): Promise<string> {
  if (configured) {
    if (!path.isAbsolute(configured))
      throw new Error(
        'oax.codexExecutable must be an absolute path in user settings',
      );
    return configured;
  }
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const root = path.join(process.env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin');
    try {
      const directories = (await readdir(root, { withFileTypes: true }))
        .filter(
          (entry) => entry.isDirectory() && /^[a-f0-9]+$/i.test(entry.name),
        )
        .sort((a, b) => a.name.localeCompare(b.name));
      for (const directory of directories.reverse()) {
        const files = await readdir(path.join(root, directory.name));
        if (files.includes('codex.exe'))
          return path.join(root, directory.name, 'codex.exe');
      }
    } catch {
      /* Explicit setup remains available when the official installation is absent. */
    }
  }
  throw new Error(
    'Codex is not configured. Set oax.codexExecutable to an absolute verified Codex executable in user settings and sign in using the official Codex client. See docs/codex-integration.md for exact supported versions. No mock fallback is used.',
  );
}
