# Developing oAX

The local preview implements spatial/code intelligence, optional restricted Codex text, saved-file rename previews, and local Git evidence. It is not a public release. The first distribution target is VS Code and CLI.

## Setup and checks

Pinned: Node **24.19.0**, pnpm **11.25.0**, TypeScript **5.9.3**, VS Code acceptance host **1.105.0**, Codex **0.159.2**, local VSIX packager **@vscode/vsce 4.0.0**.

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

The source development workflow uses the supplied F5 launch configuration. Commands and transmission behavior are documented in the extension README. Connections persist per workspace/provider and **Reconnect Runtime** closes them. Other unsaved editors are not overlaid into the selected document's context. The watcher service is independently tested; runtime indexing currently refreshes on observation/commands rather than running a background watcher.

## Opt-in live test

This test sends only synthetic TypeScript through an existing login, may consume usage, and does not change credentials:

```powershell
$env:OAX_LIVE_TEST = '1'
$env:OAX_CODEX_EXECUTABLE = 'C:\path\to\codex.exe'
pnpm test:live
```

It verifies provider preflight, restricted thread configuration, model response, runtime context consent, and denial without consent. It does not establish a live editor UI test or general provider tool execution. No external provider is enabled by default. Unsupported versions fail closed. Contracts were inspected using `codex app-server generate-ts --experimental --out .oax/provider-contract`; regenerate and review before changing the supported version.

## CLI and boundaries

`node dist/cli.cjs --help` is the implemented contract: `init`, `analyze`/`onboard`, `rename`, `demo`, and internal private `serve`. Exit codes: 0 success, 1 operation failure, 2 unsupported command. Rename positions are zero-based and writes require the exact preview hash. Workspace tests are not executed by rename. Internal `serve` requires a parent-generated connection token and opens no TCP listener.

The TypeScript checker handles local relative imports without reading libraries outside indexed snapshots. Discovery skips dependencies, generated/private directories, environment files, and symbolic links, with 2,000-file, 128-KiB-file, and 8-MiB-total limits. Selected editor snapshots replace disk for context/graph queries. SQLite uses migration version 1, foreign keys, indexes, and transactions. Changes reuse unchanged ASTs/file records but rebuild semantic relationships globally for correctness; this is not a fully incremental semantic engine.

Core packages do not import VS Code APIs. Provider RPC stays in `packages/codex`. The adapter consumes the client subpath without loading the graph into the editor process. `packages/git` uses fixed local read commands; `refactor` compares every baseline and grant before writing, then rechecks each write. Audit/session state is memory-only. Hosted CI, publication, recovery/security support policy, and private vulnerability reporting remain prerequisites for a supported release.

Preserve unrelated changes and update PROGRESS after each session. Remote history is maintained through the authorized GitHub connector because this machine's pre-existing Git CLI account cannot fetch the selected private repository. Do not force-push independent local history or change credentials to work around that limitation.

Selected saved Node test files can be run through the separate VS Code approval command. This invokes the host Node executable with fixed --test arguments, a restricted environment, five-second timeout and 64-KiB output limit. It does not run package scripts. Browser setup and scoped inspection are documented in docs/browser.md. All .oax state is local and ignored, including persisted graph evidence and the optional browser cache.
