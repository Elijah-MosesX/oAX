# Vim adapter

Portable official signed Windows x64 Vim 9.2.1162 is installed under `.tools/vim`.
`pnpm setup:editors` downloads its pinned ZIP and checks the release's SHA-256.
It preserves personal vimrc files, registry entries and global PATH.

The Vimscript adapter uses the existing private `editor-read-only.v1` bridge and
protocol 0.1. It captures the current unsaved buffer, versions, UTF-16 cursor,
visible text windows and workspace scope. Current capture uses the cursor point;
visual selections and agent-location decorations are not yet implemented for Vim.
It is read-only, with no Codex transmission, edits or execution. Neovim remains a
separate adapter with its own existing acceptance.

After connecting, cursor, buffer, text and viewport changes automatically schedule a
local observation after 250 ms. Unchanged snapshots are deduplicated; active
requests/tasks defer observation. This starts no provider request, task or popup.
Set `let g:oax_observe = 0` before connecting to keep only explicit observations.
Scratch buffers, outside-root paths and oversized snapshots are skipped. An
unavailable or stale viewport is represented by an empty visible-range list.

`oax#inspect().observed` exposes the latest path, document version and graph focus,
without retaining source text. Responses require the current captured-state
signature plus matching focus path/hash/version. Edits and buffer leave clear the
observation; close cancels timers and clears it. No agent decoration or automatic
cursor movement is added. One explicit command can wait behind a background
observation; additional overlapping commands still report busy. Cancellation
bypasses that wait. Disconnect discards queued work with an inspectable error;
reconnect starts fresh and never replays it.

Configure explicit trusted paths in the Vim session:

```vim
set runtimepath^=C:/path/to/oAX/adapters/vim
runtime plugin/oax.vim
let g:oax_root = 'C:/path/to/your/trusted/repository'
let g:oax_cli = 'C:/path/to/oAX/dist/cli.cjs'
let g:oax_node = 'C:/Program Files/nodejs/node.exe'
OaxConnect
```

Place the cursor on a supported TypeScript/JavaScript symbol and use `OaxObserve`,
`OaxCallers` or `OaxContext`. A separate evidence popup preserves the developer's
cursor. `OaxClose` stops the owned bridge; editor exit also closes it. Responses
validate version/workspace/correlation, events validate session/order, input and
output are bounded and unsupported write methods fail closed.

`pnpm test:vim` runs the actual installed Vim against a synthetic repository and
the real built runtime. See PROGRESS.md for its outcome, rather than inferring
acceptance from this implementation.

Set `OAX_VIM_PRESENCE_TEST=1` and run `node scripts/test-vim.mjs` for actual-editor
automatic observation and deterministic delayed-response acceptance. The real
runtime verifies dirty symbol focus and Unicode capture; a test-only stdio fixture
verifies stale replies, mismatched evidence, command queuing and disconnects.
The receipt is `dist/vim-presence-acceptance.json`. Clear the flag for the original
read-only command regression. Both modes use no model account.
