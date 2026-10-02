import { build } from 'esbuild';
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
