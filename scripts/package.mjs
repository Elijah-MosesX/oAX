import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  copyFile,
  rm,
} from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createVSIX, listFiles, PackageManager } from '@vscode/vsce';
const dist = path.resolve('dist');
await mkdir(dist, { recursive: true });
const stage = await mkdtemp(path.join(dist, 'package-'));
try {
  const manifest = JSON.parse(
    await readFile('adapters/vscode/package.json', 'utf8'),
  );
  delete manifest.dependencies;
  manifest.files = [
    'dist/extension.cjs',
    'dist/runtime.cjs',
    'README.md',
    'LICENSE',
    'THIRD_PARTY_NOTICES.txt',
  ];
  manifest.repository = {
    type: 'git',
    url: 'https://github.com/Elijah-MosesX/oAX',
  };
  await writeFile(
    path.join(stage, 'package.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  await mkdir(path.join(stage, 'dist'));
  for (const name of ['extension.cjs', 'runtime.cjs'])
    await copyFile(
      `adapters/vscode/dist/${name}`,
      path.join(stage, 'dist', name),
    );
  await copyFile('LICENSE', path.join(stage, 'LICENSE'));
  const notices = [];
  for (const [name, file] of [
    ['TypeScript 5.9.3', 'node_modules/typescript/LICENSE.txt'],
    [
      'TypeScript third-party notices',
      'node_modules/typescript/ThirdPartyNoticeText.txt',
    ],
    ['Zod 4.1.12', 'packages/protocol/node_modules/zod/LICENSE'],
  ])
    notices.push(`${name}\n${await readFile(file, 'utf8')}`);
  await writeFile(
    path.join(stage, 'THIRD_PARTY_NOTICES.txt'),
    notices.join('\n\n'),
  );
  await copyFile('adapters/vscode/README.md', path.join(stage, 'README.md'));
  const files = (
    await listFiles({ cwd: stage, packageManager: PackageManager.None })
  ).sort();
  const expected = [
    'LICENSE',
    'README.md',
    'dist/extension.cjs',
    'dist/runtime.cjs',
    'package.json',
    'THIRD_PARTY_NOTICES.txt',
  ].sort();
  if (JSON.stringify(files) !== JSON.stringify(expected))
    throw new Error('Unexpected packaged contents; packaging stopped');
  const packagePath = path.join(dist, `oax-vscode-${manifest.version}.vsix`);
  await createVSIX({ cwd: stage, packagePath, dependencies: false });
  const hash = createHash('sha256')
    .update(await readFile(packagePath))
    .digest('hex');
  await writeFile(
    `${packagePath}.sha256`,
    `${hash}  ${path.basename(packagePath)}\n`,
  );
  console.log(
    `Local package verified: ${packagePath}; no publication performed.`,
  );
} finally {
  if (
    path.dirname(stage) !== dist ||
    !path.basename(stage).startsWith('package-')
  )
    throw new Error('Unexpected staging cleanup path');
  await rm(stage, { recursive: true, force: true });
}
