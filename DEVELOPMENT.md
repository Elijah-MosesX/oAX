# Developing oAX

The foundation is a local, read-only mock implementation. The actual VS Code selection loop is verified; live Codex, graph indexing, refactoring, packaging, and release are pending. See `PROGRESS.md`.

## Toolchain and setup

Pinned versions: Node.js **24.19.0**, pnpm **11.25.0**, TypeScript **5.9.3**. The extension is tested with VS Code **1.105.0**. Normal checks require no provider credentials or model usage.

```powershell
corepack enable
pnpm install --frozen-lockfile --ignore-scripts
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm test
pnpm test:integration
pnpm demo
```

The lockfile pins dependency resolution. Installation scripts are unnecessary on the tested Windows platform; esbuild uses its optional platform binary. `.npmrc` requests a project-local package store. pnpm's bundled runtime may apply its own store setting. Dependencies, stores, build output, test profiles, credentials, and private local state are ignored by Git.

Inspect `package.json`, `pnpm-workspace.yaml`, and scripts before execution. In this Codex Windows session, normal sandbox pnpm commands attempted dependency relinking and failed without a TTY; authorized elevated checks succeeded. This is an environment limitation, not a required product privilege. Do not change user credentials or global Git trust settings to run checks.

## Run the mock workflow

`pnpm demo` launches the actual bundled runtime over private stdio, creates a disposable fixture/session, passes an editor-shaped selection, prints explicitly labeled mock output, and cleans up. It does not call a model or interpret code semantically.

For VS Code development, open this checkout, run `pnpm build`, and launch **oAX extension (mock)** using the supplied F5 configuration. In the development host open a trusted local workspace, select text in an existing file, and invoke **oAX: Explain Selection (Mock)**. The **oAX (Mock)** Output channel displays the result. Unsaved buffer text and version are captured together. Each command owns its runtime and releases it afterward; overlapping commands are rejected. Cancel through the progress notification.

`pnpm test:editor` downloads VS Code 1.105.0 into `.vscode-test`, then launches a development host against `tests/fixtures/workspace`. It changes the fixture buffer without saving, invokes the real extension command, checks the selected text/version/unsaved status, and reverts the buffer. Download requires network access and approximately 155 MB. The runner uses argument-array process spawning for Windows paths containing spaces and isolated test profiles. Linux CI uses Xvfb. No user VS Code profile or extension installation is modified.

## Actual commands

| Command                    | Behavior                                                                         |
| -------------------------- | -------------------------------------------------------------------------------- |
| `pnpm build`               | Bundle CLI/runtime, extension, and editor acceptance test                        |
| `pnpm typecheck`           | Check all workspace source and tests without emitting                            |
| `pnpm lint`                | ESLint TypeScript checks                                                         |
| `pnpm format:check`        | Check source, schemas, and maintained documentation formatting                   |
| `pnpm format`              | Format maintained files; original blueprint and AGENTS instructions are excluded |
| `pnpm schemas`             | Regenerate versioned JSON schemas from protocol source                           |
| `pnpm test`                | Deterministic unit tests                                                         |
| `pnpm test:integration`    | Real child-process mock protocol/adapter tests; build first                      |
| `pnpm test:editor`         | Actual VS Code development-host acceptance; build first                          |
| `pnpm demo`                | Disposable CLI-to-mock-runtime demo; build first                                 |
| `node dist/cli.cjs --help` | Supported CLI contract                                                           |

The CLI exposes `demo`, `serve <workspace-root> <workspace-id>`, and help. `serve` is an internal private-stdio interface requiring `OAX_CONNECTION_TOKEN`; the adapter creates this token. No HTTP endpoint exists. Unsupported commands exit 2; configuration/runtime failure exits 1. `init`, `analyze`, `explain`, `review`, and live-provider tests are planned and are not advertised as working commands.

## Package boundaries

Only packages needed for the foundation exist. Core runtime/context/spatial/permissions depend on the public protocol; VS Code APIs remain in `adapters/vscode`. The Codex package contains an explicitly disabled `AgentEngine` implementation. Future graph, indexer, watcher, Git/GitHub, and evaluation packages must be created alongside real workflows. Internal packages export TypeScript source and are private; this is a development checkout, not a published installation.

Protocol semantics and limits: `docs/protocol.md`. Verified provider integration direction and next work: `docs/codex-integration.md`.

## Verification and contribution

Tests cover validation, buffer provenance/freshness, boundaries, scoped policy, lifecycle, cancellation/timeout, ordering, framing, disconnect, and the mock/editor loop. Normal tests use deterministic mocks; no live model usage is performed. A CI definition runs checks on Windows/Linux and the editor acceptance on Linux, but a workflow file alone is not evidence that hosted CI passed.

Preserve unrelated changes, inspect diffs, update `PROGRESS.md`, and record exact outcomes. The private repository is `Elijah-MosesX/oAX`, default branch `main`, MIT licensed. The selected GitHub connector confirms access; the pre-existing Git CLI identity could not fetch this repository. Connector sync must preserve the existing remote parent commit; do not force push unrelated local history. Configure the correct Git authentication before using the local checkout as a clone of remote history.

Before live provider work, pin the Codex version and generated contracts, establish authentication and context-transmission consent, and verify all enabled tool permissions. Before release, verify packaging, distribution, recovery, and private vulnerability reporting.
