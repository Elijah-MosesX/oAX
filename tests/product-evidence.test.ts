import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { build } from 'esbuild';

test('product backend uses the canonical connected evidence contract and rejects permission-bearing notes', async () => {
  const built = await build({
    entryPoints: ['deployments/product/backend/index.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    external: ['@appdeploy/sdk'],
    plugins: [
      {
        name: 'canonical-evidence',
        setup(b) {
          b.onResolve({ filter: /^\.\.\/shared\/validate$/ }, () => ({
            path: path.resolve('apps/evidence/src/validate.ts'),
          }));
        },
      },
    ],
  });
  const module = {
    exports: {} as {
      inspectSource(input: string): {
        memory: unknown[];
        historical: unknown[];
        limitations: string[];
      };
    },
  };
  vm.runInNewContext(built.outputFiles[0]!.text, {
    module,
    exports: module.exports,
    TextEncoder,
    require: (name: string) => {
      assert.equal(name, '@appdeploy/sdk');
      return { router: (value: unknown) => value };
    },
  });
  const input = JSON.parse(
    await readFile('tests/fixtures/connected-evidence.json', 'utf8'),
  );
  const result = module.exports.inspectSource(JSON.stringify(input));
  assert.match(JSON.stringify(result.memory), /ORCHID-27/);
  assert.match(JSON.stringify(result.historical), /local-git/);
  assert.ok(result.limitations.some((x) => x.includes('untrusted')));
  input.result.memory[0].permissions = ['write'];
  assert.throws(() => module.exports.inspectSource(JSON.stringify(input)));
});
