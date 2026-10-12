import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
if (process.argv[2] && process.argv[2] !== '--product')
  throw new Error(
    'Use no argument for shared knowledge, or --product for oAX1.',
  );
const product = process.argv[2] === '--product';
const root = path.resolve(product ? 'deployments/product' : 'deployments/team');
const files = [];
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(file);
    else
      files.push({
        filename: path.relative(root, file).replaceAll('\\', '/'),
        content: await readFile(file, 'utf8'),
      });
  }
}
await visit(root);
// Deploy the exact canonical evidence contract, changing only its import path.
files.push({
  filename: 'shared/validate.ts',
  content: (await readFile('apps/evidence/src/validate.ts', 'utf8')).replace(
    '../../../packages/protocol/src/browser.js',
    './protocol',
  ),
});
files.push({
  filename: 'shared/protocol.ts',
  content: await readFile('packages/protocol/src/browser.ts', 'utf8'),
});
await mkdir('dist', { recursive: true });
await writeFile(
  product ? 'dist/product-deploy-files.json' : 'dist/team-deploy-files.json',
  JSON.stringify(files),
);
console.log(
  `Prepared ${files.length} collaboration source files; no credentials or repository evidence included.`,
);
