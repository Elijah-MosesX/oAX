import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const exec = promisify(execFile);
test('built CLI explains, provides labeled structural evidence, and gates real Node verification by exact plan', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'oax-cli-acceptance-'));
  const executable = path.resolve('dist/cli.cjs');
  const run = (args: string[]) =>
    exec(process.execPath, [executable, ...args], {
      cwd: root,
      timeout: 15000,
      windowsHide: true,
    });
  try {
    const diagnostics = JSON.parse((await run(['doctor'])).stdout);
    assert.equal(diagnostics.compatibleNode, true);
    assert.equal(diagnostics.editorContract, 'editor-read-only.v1');
    assert.ok(!diagnostics.editorMethods.includes('refactor.apply'));
    await assert.rejects(run(['doctor', root, 'unexpected']), /INVALID_ARGS/);
    const code =
      'export function sum() { return 2; }\nfunction caller() { return sum(); }';
    await writeFile(path.join(root, 'a.ts'), code);
    await writeFile(
      path.join(root, 'a.test.ts'),
      'import {test} from "node:test"; import assert from "node:assert/strict"; import {sum} from "./a.ts"; test("sum", () => assert.equal(sum(), 2));',
    );
    const answer = await run(['explain', 'a.ts', '--mock']);
    assert.match(answer.stdout, /Mock engine/);
    assert.match(answer.stdout, /function sum/);
    const review = JSON.parse((await run(['review', 'a.ts'])).stdout);
    assert.equal(review.kind, 'structural-review-evidence');
    assert.equal(review.relationships.callers.node.name, 'sum');
    assert.ok(
      review.relationships.callers.relationships.some(
        (entry: { node: { name: string } }) => entry.node.name === 'caller',
      ),
    );
    const plan = JSON.parse((await run(['verify', 'a.test.ts'])).stdout);
    assert.equal(plan.state, 'awaiting_approval');
    await assert.rejects(
      run(['verify', 'a.test.ts', '--approve', '0'.repeat(64)]),
      /PERMISSION_DENIED/,
    );
    assert.match(
      (await run(['verify', 'a.test.ts', '--approve', plan.hash])).stdout,
      /pass 1/,
    );
    assert.equal(await readFile(path.join(root, 'a.ts'), 'utf8'), code);
    await writeFile(
      path.join(root, 'failing.test.ts'),
      'import {test} from "node:test"; import assert from "node:assert/strict"; test("intentional failure", () => assert.equal(1, 2));',
    );
    const failingPlan = JSON.parse(
      (await run(['verify', 'failing.test.ts'])).stdout,
    );
    await assert.rejects(
      run(['verify', 'failing.test.ts', '--approve', failingPlan.hash]),
      (error: unknown) => {
        const result = error as {
          code: number;
          stdout: string;
          stderr: string;
        };
        assert.equal(result.code, 1);
        assert.match(result.stdout, /fail 1/);
        assert.match(result.stderr, /CHECK_FAILED/);
        return true;
      },
    );
    await assert.rejects(run(['explain', '../outside.ts']));
  } finally {
    if (
      path.dirname(root) !== tmpdir() ||
      !path.basename(root).startsWith('oax-cli-acceptance-')
    )
      throw new Error('Unexpected fixture cleanup path');
    await rm(root, { recursive: true, force: true });
  }
});
