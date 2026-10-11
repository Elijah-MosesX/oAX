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
    const memoryArgs = [
      'memory',
      'save',
      'a.ts',
      'sum returns a constant two',
      '30',
    ];
    const memoryPlan = JSON.parse((await run(memoryArgs)).stdout);
    assert.deepEqual(JSON.parse((await run(['memory', 'list'])).stdout), []);
    await assert.rejects(
      run([...memoryArgs, '--approve', '0'.repeat(64)]),
      /PERMISSION_DENIED/,
    );
    const memory = JSON.parse(
      (await run([...memoryArgs, '--approve', memoryPlan.hash])).stdout,
    );
    const memories = JSON.parse((await run(['memory', 'list'])).stdout);
    assert.equal(memories[0].id, memory.id);
    assert.equal(memories[0].status, 'fresh');
    const suggestions = JSON.parse(
      (await run(['memory', 'suggest', 'a.ts', 'Explain constant sum'])).stdout,
    );
    assert.equal(suggestions.automaticInclusion, false);
    assert.equal(suggestions.suggestions[0].id, memory.id);
    assert.match(suggestions.suggestions[0].reason, /Overlaps selected code/);
    assert.match(
      (await run(['explain', 'a.ts', '--mock', '--memory', memory.id])).stdout,
      /Mock engine/,
    );
    await run(['memory', 'delete', memory.id, '--approve', memories[0].hash]);
    await assert.rejects(
      run(['explain', 'a.ts', '--mock', '--memory', memory.id]),
      /MEMORY_STALE/,
    );
    assert.match(answer.stdout, /Mock engine/);
    assert.match(answer.stdout, /function sum/);
    await assert.rejects(
      run(['explain', 'a.ts', '--mock', '--history']),
      /GIT_READ_FAILED/,
    );
    const git = (args: string[]) =>
      exec(
        'git',
        [
          '-c',
          `safe.directory=${root}`,
          '-c',
          'user.name=Fixture',
          '-c',
          'user.email=fixture@example.invalid',
          '-c',
          'core.hooksPath=',
          ...args,
        ],
        { cwd: root, windowsHide: true },
      );
    await git(['init']);
    await git(['add', 'a.ts']);
    await git(['commit', '-m', 'Introduce sum']);
    assert.match(
      (await run(['explain', 'a.ts', '--mock', '--history'])).stdout,
      /Mock engine/,
    );
    await assert.rejects(
      run(['explain', 'a.ts', '--mock', '--history', '--history']),
      /INVALID_ARGS/,
    );
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
