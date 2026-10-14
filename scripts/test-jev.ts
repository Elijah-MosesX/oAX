import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { JevPlanner } from '../packages/browser/src/jev.js';
async function main() {
  const install = JSON.parse(
    await readFile('.tools/jev-install.json', 'utf8'),
  ) as { python: string; source: string };
  const result = spawnSync(
    install.python,
    ['-I', '-m', 'pytest', '-q', 'tests'],
    { cwd: install.source, encoding: 'utf8', timeout: 60000 },
  );
  console.log(result.stdout);
  assert.equal(result.status, 0, 'Pinned upstream offline tests must pass');
  const resultPage = (await new JevPlanner(process.cwd()).inspect({
    url: 'http://localhost:3000/',
    title: 'Fixture',
    text: 'Continue',
    actions: [
      { id: 'c1', kind: 'click', node: '1', label: 'Continue' },
      { id: 'f1', kind: 'fill', node: '2', label: 'Name' },
    ],
  })) as { operations: string[]; executed: boolean };
  assert.deepEqual(resultPage.operations, ['CLICK', 'TYPE_TEXT']);
  assert.equal(resultPage.executed, false);
  const module = path.join(install.source, 'jev_ultrafast', 'model.py');
  const original = await readFile(module);
  try {
    await writeFile(
      module,
      Buffer.concat([original, Buffer.from('\n# oAX integrity fixture\n')]),
    );
    await assert.rejects(
      new JevPlanner(process.cwd()).inspect({
        url: 'http://localhost:3000/',
        title: 'Fixture',
        text: '',
        actions: [],
      }),
      /integrity/,
    );
  } finally {
    await writeFile(module, original);
  }
  console.log(
    'Actual pinned Python planner action-space round trip passed. No browser daemon or live model request.',
  );
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Jev check failed');
  process.exitCode = 1;
});
