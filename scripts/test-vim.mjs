import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
const dist = path.resolve('dist');
const root = await mkdtemp(path.join(dist, 'vim-acceptance-'));
const vim = path.resolve('.tools/vim/9.2.1162/vim/vim92/vim.exe');
const presence = process.env.OAX_VIM_PRESENCE_TEST === '1';
const cursor = process.env.OAX_VIM_CURSOR_TEST === '1';
if (presence && cursor) throw new Error('Choose one Vim acceptance mode');
const literal = (value) =>
  `'${value.replaceAll('\\', '/').replaceAll("'", "''")}'`;
try {
  await writeFile(
    path.join(root, 'sample.ts'),
    '// 😀 marker\nexport function add(a: number, b: number) { return a+b; }\n',
  );
  await writeFile(
    path.join(root, 'consumer.ts'),
    'import { add } from "./sample";\nexport const sum = add(1, 2);\n',
  );
  const script = path.join(root, 'accept.vim');
  const result = path.join(root, 'result.json');
  await writeFile(
    script,
    `set encoding=utf-8\nset nomore\nlet g:oax_acceptance=1\nexecute 'set runtimepath^=' . fnameescape(${literal(path.resolve('adapters/vim'))})\nruntime plugin/oax.vim\nexecute 'edit ' . fnameescape(${literal(path.join(root, 'sample.ts'))})\ncall setline(2, 'export function add(a: number, b: number) { return a+b+1; }')\ncall bufadd(${literal(path.join(root, 'consumer.ts'))})\ncall oax#connect(${literal(root)}, ${literal(path.resolve('dist/cli.cjs'))}, ${literal(process.execPath)})\nlet deadline=reltime()\nwhile !oax#inspect().connected && reltimefloat(reltime(deadline)) < 15\n  sleep 10m\nendwhile\ncall assert_true(oax#inspect().connected)\ncall cursor(1, strlen('// 😀 ') + 1)\ncall assert_equal(6, oax#capture().cursor.column)\ncall assert_equal(1, len(oax#capture().openFiles))\ncall assert_true(oax#capture().dirty)\ncall cursor(2, 17)\nlet before=getpos('.')\ncall oax#request('graph.query', {'observation':oax#capture(),'relationship':'callers'})\nlet deadline=reltime()\nwhile empty(oax#inspect().result) && empty(oax#inspect().error) && reltimefloat(reltime(deadline)) < 15\n  sleep 10m\nendwhile\nlet report=oax#inspect()\ncall assert_true(get(report.result, 'ok', 0))\ncall assert_match('consumer.ts', json_encode(report.result))\ncall assert_equal(before, getpos('.'))\ntry\n  call oax#request('refactor.apply', {})\n  call assert_report('Write was not rejected')\ncatch /Unsupported read-only method/\nendtry\ncall oax#close()\ncall assert_false(oax#inspect().connected)\ncall writefile([json_encode({'errors':v:errors,'vimError':v:errmsg,'report':report,'closed':!oax#inspect().connected})], ${literal(result)})\nif !empty(v:errors) | cquit | endif\nqa!\n`,
  );
  const run = spawnSync(
    vim,
    [
      '-Nu',
      'NONE',
      '-i',
      'NONE',
      '-n',
      '-es',
      '-S',
      cursor
        ? path.resolve('tests/vim/cursor.vim')
        : presence
          ? path.resolve('tests/vim/presence.vim')
          : script,
    ],
    {
      timeout: 90000,
      encoding: 'utf8',
      windowsHide: true,
      env: {
        ...process.env,
        OAX_TEST_ROOT: root,
        OAX_TEST_REPO: process.cwd(),
        OAX_TEST_CLI: path.resolve('dist/cli.cjs'),
        OAX_TEST_NODE: process.execPath,
        OAX_TEST_RESULT: result,
      },
    },
  );
  const evidence = JSON.parse(await readFile(result, 'utf8'));
  assert.equal(run.status, 0, JSON.stringify(evidence) + run.stderr);
  assert.deepEqual(evidence.errors, []);
  await writeFile(
    cursor
      ? 'dist/vim-cursor-acceptance.json'
      : presence
        ? 'dist/vim-presence-acceptance.json'
        : 'dist/vim-acceptance.json',
    JSON.stringify(
      {
        version: '9.2.1162',
        passed: true,
        checks: cursor
          ? [
              'real-runtime-agent-event',
              'utf16-byte-range',
              'combining-character-capture-and-range',
              'multiline-end-exclusive-eof',
              'source-version-hash',
              'visible-only',
              'invalid-range-rejection',
              'terminal-late-event-rejection',
              'wrong-session-clears-indicators',
              'edit-window-disconnect-cleanup',
              'unrelated-properties-preserved',
              'cursor-source-preserved',
              'opt-out',
            ]
          : presence
            ? [
                'automatic-observation',
                'debounce',
                'deduplication',
                'utf16',
                'dirty-symbol-focus',
                'scratch-exclusion',
                'outside-root-and-budget-exclusion',
                'focus-hash-path-version-binding',
                'opt-out',
                'stale-cursor-buffer-replies',
                'foreground-queue',
                'cancel-bypass',
                'disconnect-cleanup',
                'fresh-reconnect',
              ]
            : [
                'real-runtime-callers',
                'dirty-buffer',
                'utf16',
                'actual-visible-tabs',
                'preserved-cursor',
                'denied-writes',
                'cleanup',
              ],
      },
      null,
      2,
    ),
  );
  console.log(
    cursor
      ? 'Actual Vim 9.2.1162 source-validated agent-location acceptance passed.'
      : presence
        ? 'Actual Vim 9.2.1162 spatial presence and delayed-response lifecycle acceptance passed.'
        : 'Actual Vim 9.2.1162: shared protocol graph, unsaved buffer, UTF-16, visible text windows, unchanged cursor, denied writes and cleanup passed.',
  );
} finally {
  if (
    path.dirname(root) !== dist ||
    !path.basename(root).startsWith('vim-acceptance-')
  )
    throw new Error('Unsafe cleanup');
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
}
