import { build } from 'esbuild';
import { mkdir, cp, copyFile } from 'node:fs/promises';
import { pwaIcons } from './pwa-icons.mjs';
await pwaIcons('apps/workbench/public');
await mkdir('dist/evidence', { recursive: true });
await cp('apps/evidence/public', 'dist/evidence', { recursive: true });
for (const name of ['style.css', 'icon.svg', 'icon-192.png', 'icon-512.png'])
  await copyFile(`apps/workbench/public/${name}`, `dist/evidence/${name}`);
await build({
  entryPoints: ['apps/evidence/src/app.js'],
  outfile: 'dist/evidence/app.js',
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  format: 'iife',
});
for (const name of ['jev', 'workbench']) {
  await build({
    entryPoints: [
      name === 'jev' ? 'apps/cli/src/jev.ts' : 'apps/workbench/src/main.ts',
    ],
    outfile: `dist/${name}.cjs`,
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
  });
}
await build({
  entryPoints: ['tests/editor/live-extension.ts'],
  outfile: 'dist/live-editor.cjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['vscode'],
});
await build({
  entryPoints: ['apps/cli/src/browser.ts'],
  outfile: 'dist/browser.cjs',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  external: ['chrome-devtools-mcp'],
});
await build({
  entryPoints: ['apps/cli/src/main.ts'],
  outfile: 'dist/cli.cjs',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
});
await build({
  entryPoints: ['adapters/vscode/src/extension.ts'],
  outfile: 'adapters/vscode/dist/extension.cjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['vscode'],
});
await build({
  entryPoints: ['apps/cli/src/main.ts'],
  outfile: 'adapters/vscode/dist/runtime.cjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
});
await build({
  entryPoints: ['tests/editor/run.ts'],
  outfile: 'dist/editor-tests.cjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['vscode'],
});
