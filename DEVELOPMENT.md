# Developing oAX

The local preview implements spatial/code intelligence, optional restricted Codex text, saved-file rename previews, and local Git evidence. It is not a public release. The first distribution target is VS Code and CLI.

## Setup and checks

Pinned: Node **24.19.0**, pnpm **11.25.0**, TypeScript **5.9.3**, VS Code acceptance host **1.105.0**, Codex **0.159.2** or the contract-verified **0.159.0-alpha.12.1** preview, local VSIX packager **@vscode/vsce 4.0.0**.

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm schemas
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm test
pnpm test:integration
pnpm test:editor
pnpm demo
pnpm package:local
```

Inspect scripts before running them. Normal tests are deterministic and do not call a provider. `test:editor` downloads the pinned host and launches it with argument arrays and an isolated profile. On this Windows environment pnpm checks required authorized sandbox escalation; product use does not require administrator privileges. Do not change user credentials or global Git trust settings.

`package:local` stages only the extension manifest, README, unchanged MIT license, third-party notices, and two bundles. It verifies the file allowlist, creates a local VSIX and SHA-256 sidecar, and never publishes. Install through **Extensions: Install from VSIX...**. Reinstall a rebuilt package to update; uninstall in the extension manager. The bundled runtime needs the extension host's compatible Node runtime; the verified host is 1.105.0. SQLite remains experimental.

The source development workflow uses the supplied F5 launch configuration. Commands and transmission behavior are documented in the extension README. Connections persist per workspace/provider and **Reconnect Runtime** closes them. Other unsaved editors are not overlaid into the selected document's context. Runtime sessions poll bounded workspace snapshots every second after first indexing; observations and polls share a serialized queue. The selected dirty buffer remains overlaid during background changes. `index.status` reports refresh generations/counts and failures. Session closure stops polling before closing graph storage.

## Opt-in live test

Additional adapters use `node dist/cli.cjs editor-bridge <trusted-workspace-root>`; read-only `doctor [root]` reports the toolchain and contract without contacting a provider. Run `pnpm test:neovim` after setting `OAX_NVIM_EXECUTABLE` to an absolute Neovim 0.11.5 executable. Java 21 and Gradle 8.14.3 build the JetBrains prototype with `gradle -p adapters/jetbrains buildPlugin`; SDK/package/live IDE verification is tracked separately. Portable tools under `.tools` and Gradle caches are excluded from source/context/indexing and packaging. Setup and limits: [additional adapters](docs/adapters.md).

RuntimeClient control requests have a 10-second deadline; initialization has 60 seconds to complete restricted provider preflight, and graph/context/onboarding reads that may require initial repository indexing have 30 seconds. Bounded local/remote historical reads have 90 seconds. A timeout disconnects the client and rejects outstanding work. These are request budgets, not latency guarantees.

Buddy is bundled into the same VSIX. Run **oAX: Show Buddy** or **Hide Buddy**; visibility is stored per workspace. Normal `pnpm test:editor` checks the actual native view commands, validated cursor linkage, unchanged selection, hidden-view execution and reconnect cleanup. Buddy unit tests cover lifecycle/item distinction, session/event ordering, prompt-only projection, verification freshness and disconnect handling. The opt-in live editor harness also compares Buddy's prompt to each real production Quick Pick and checks the final real-provider review projection. The production `inspectBuddy` export returns a detached, source-free snapshot and exposes no approval or execution control. See [Buddy](docs/buddy.md) for behavior and voice assessment.

For full editor acceptance, build first, then set `OAX_LIVE_EDITOR_TEST=1` and `OAX_AUTOMATED_LIVE_EDITOR_TEST=1` before running `pnpm test:editor`. This makes real model requests using the existing Codex login and sends only generated synthetic fixtures. The separate development-only harness runs production commands and explicitly selects real approval items through VS Code's command service; production code contains no auto-approval flag. An immutable extension snapshot and separate profile prevent rebuilds from restarting the workflow. Acceptance JSON remains in the generated `.vscode-test/m4-live-*` directory. Clear the variables afterward for deterministic editor checks. To test the installed package, also set `OAX_PACKAGED_TEST=1` after installing the VSIX into the isolated extension directory. No acceptance harness is packaged into the product.

Historical evidence scope, credential setup and deterministic quality scenarios are documented in docs/history.md. `github.trace` and `history.query` use bounded 90-second client request deadlines; individual Git/GitHub reads retain shorter timeouts.

This test sends only synthetic TypeScript through an existing login, may consume usage, and does not change credentials:

```powershell
$env:OAX_LIVE_TEST = '1'
$env:OAX_CODEX_EXECUTABLE = 'C:\path\to\codex.exe'
pnpm test:live
```

It verifies provider preflight, restricted thread configuration, model response, runtime context consent, and denial without consent. It does not establish a live editor UI test or general provider tool execution. Explain selects Codex by default, but transmission still requires exact context consent. Unsupported versions fail closed. Contracts were inspected using `codex app-server generate-ts --experimental --out .oax/provider-contract`; regenerate and review before changing the supported version.

## CLI and boundaries

`node dist/cli.cjs --help` is the implemented contract: `init`, `analyze`/`onboard`, `query`, `explain`, `review`, `verify`, `rename`, and internal private `serve`; `demo` remains a transport diagnostic. Exit codes: 0 success, 1 operation failure, 2 unsupported command. Query and rename positions are zero-based; writes require the exact preview hash. Workspace tests are not executed by rename. Internal `serve` requires a parent-generated connection token and opens no TCP listener.

The TypeScript checker resolves local imports, bounded baseUrl/paths and exact workspace package exports without reading libraries outside indexed snapshots. Project metadata changes invalidate the graph. The supported subset and structural CLI query contract are documented in docs/codegraph.md. Discovery skips dependencies, generated/private directories, environment files, and symbolic links, with 2,000-file, 128-KiB-file, and 8-MiB-total limits. Selected editor snapshots replace disk for context/graph queries. SQLite uses migration version 1, foreign keys, indexes, and transactions. Changes reuse unchanged ASTs/file records but rebuild semantic relationships globally for correctness; this is not a fully incremental semantic engine.

Core packages do not import VS Code APIs. Provider RPC stays in `packages/codex`. The adapter consumes the client subpath without loading the graph into the editor process. `packages/git` uses fixed local read commands; `refactor` compares every baseline and grant before writing, then rechecks each write. Sessions/grants remain memory-only; production action/permission metadata persists under .oax/audit (see docs/audit.md). Hosted CI, publication, recovery/security support policy, and private vulnerability reporting remain prerequisites for a supported release.

Preserve unrelated changes and update PROGRESS after each session. Remote history is maintained through the authorized GitHub connector because this machine's pre-existing Git CLI account cannot fetch the selected private repository. Do not force-push independent local history or change credentials to work around that limitation.

Selected saved Node test files can be run through the separate VS Code approval command. This invokes the host Node executable with fixed --test arguments, a restricted environment, five-second timeout and 64-KiB output limit. It does not run package scripts. Browser setup and scoped inspection are documented in docs/browser.md. All .oax state is local and ignored, including persisted graph evidence and the optional browser cache.

CLI explain reads a saved file and selects real Codex by default. The official Windows desktop executable is discovered within the vendor installation directory; --codex overrides it with an absolute pinned executable. It returns inspectable context before transmission; --approve must match its hash. Explicit --mock is restricted to development usage and cannot be combined with provider approval options. The editor acceptance harness calls the hidden oax.explainMock command, while the public Explain command and status bar select Codex. CLI review collects structural relationships and context without model claims. CLI verify previews a fixed Node-test plan, then --approve enables that exact operation; stdout retains captured failure diagnostics and exit code 1 reflects failed checks. Integration acceptance exercises the real built CLI with passing/failing synthetic tests and no provider usage.

Optional GitHub setup is in docs/github.md. Normal tests inject HTTP fixtures and require no token/network. The new adapter adds a fifteenth workspace project; frozen installation remains reproducible. Secrets must be entered through the extension's password command rather than shell/config. Provider and GitHub connections remain separate.

To verify an installed editor in addition to the pinned baseline, set OAX_VSCODE_EXECUTABLE to an absolute Code executable before test:editor. OAX_PACKAGED_TEST=1 loads the installed VSIX directory in the isolated development test host; install into .vscode-test/vsix-installed first. Neither option changes the normal pinned CI target or personal settings.

Sources are currently delivered on codex/local-intelligence-preview, preserving main. An authorized user can clone that branch explicitly with git clone --branch codex/local-intelligence-preview https://github.com/Elijah-MosesX/oAX.git, then use the pinned setup/build/package commands above. This is a private preview, not a Marketplace/npm release. The installed VS Code 1.138.0 updater blocked acceptance before activation; wait for setup to finish rather than interrupting it. The packaged baseline 1.105.0 passes.

Milestone 2 editor acceptance also checks automatic focused-symbol changes after caret movement, visible ranges, tab opening/closing, updated unsaved snapshots and clearing stale agent decorations. The extension exports inspectSpatial for read-only metadata inspection; it does not expose source text. Open files are file-backed text tabs, excluding cached closed documents and preview diff/virtual buffers. Test fixture edits are reverted.

Selection refactoring uses the text-only provider to propose strict JSON, followed by runtime refactor.propose and refactor.apply. Model output cannot choose paths or commands. A saved captured range determines the replacement; all existing execution-boundary path, grant and baseline checks apply. No syntax or behavior success is inferred from a proposal. Unit acceptance covers extra-field injection, incorrect hashes, changed baselines, Unicode/CRLF preservation and replay denial. The opt-in live test additionally generates a real synthetic fix, applies its exact approved plan, and runs a separately approved Node test. Installed VS Code 1.105.0 live acceptance verifies production approval dialogs, actual model edits, separate approved Node checks and current diff review.

Language implementation and semantic indexing are distinct: see [Python/Java/Go boundaries](docs/polyglot.md). The first vertical slice and durable permission records are described in [audit](docs/audit.md) and PROGRESS. Use the pinned pnpm 11.25.0; if the desktop fallback resolves another runtime, corepack with a workspace-local COREPACK_HOME can select the packageManager version without changing global configuration.

## Local workbench and Jev

After the normal build, run node dist/workbench.cjs with a trusted workspace root; add --desktop for a dedicated Chrome app window after browser setup. Use Python 3.12 to run scripts/setup-jev.py, then pnpm test:jev and pnpm test:browser-jev. No global installation or live model request is part of setup. Details, exact commands and disclosures: docs/surfaces.md and docs/jev.md. TypeSafe credentials are separate from Codex and remain process-local.

## Desktop, PWA and additional local tools

`pnpm package:desktop` creates an allowlisted Windows x64 portable ZIP using the
verified official Node binary. `pnpm test:desktop` checks the extracted application
and actual dedicated Chrome authentication/cleanup; its explicit sandbox setup
requires consent. The public PWA bundle is isolated from browser global properties
and built under `dist/evidence`, with deterministic 192/512 PNG icons.

`pnpm setup:editors` installs pinned portable Vim/Vimium in `.tools` without global
PATH or personal settings changes. `pnpm test:vim` uses real Vim and the existing
read-only bridge. `pnpm test:browser-addons` verifies actual Chrome registration
in a dedicated owned profile. `pnpm package:chrome` creates the five-file Manifest
V3 launcher ZIP; it is not Web Store publication. See docs/vim.md,
docs/browser-extensions.md, docs/pwa.md and docs/integration-audit.md.
