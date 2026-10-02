# oAX

A spatially aware codebase onboarding, analysis, and refactoring platform, with Codex behind a provider boundary.

This local development preview supports versioned VS Code observations, deterministic TypeScript/JavaScript symbols and relationships, bounded context, optional Codex explanations, local Git evidence, and a reviewed symbol-rename workflow. It is not the complete platform or a public release. See [PROGRESS.md](PROGRESS.md) for verified results and remaining work.

## Build and use locally

**oAX: Show Buddy** opens an accessible native Explorer pane with workspace/provider presence, actual task and tool activity, pending approval prompts, output, edit/test review status and observed code locations. **Hide Buddy** changes presentation only. Buddy does not control the agent or grant permissions; voice is assessed and deferred. See [Buddy behavior](docs/buddy.md).

Use Node **24.19.0** and pnpm **11.25.0**:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm test
pnpm test:integration
pnpm package:local
```

Install `dist/oax-vscode-0.1.0.vsix` through **Extensions: Install from VSIX...**. In a trusted local workspace, select code and run **oAX: Explain Selection** for a real Codex explanation, or a **Find** relationship command for deterministic evidence. Symbols, exports and caller/import/implementation evidence come from the TypeScript checker; test relationships are labeled filename heuristics. Local relative modules, bounded project aliases and exact workspace package exports are supported. Full project/reference and external dependency resolution remain pending. See [codegraph scope](docs/codegraph.md). Session indexing refreshes in the background, preserving the selected unsaved buffer. **Show Index Status** reports freshness and failures.

Explain requires an existing official Codex login and compatible **Codex 0.159.2** executable. Windows discovers the official desktop installation; other installations require user setting `oax.codexExecutable` with an absolute path. The command previews context and requires consent before transmission. Model usage may apply. Setup failures are reported without substituting a mock answer. Provider tools, environment access, and inherited MCP servers are disabled in the private subprocess. Normal tests require no login or model usage.

**oAX: Rename Symbol with Preview** shows exact before/after text, requires approval, checks saved-file baselines, and writes only the pending plan's paths. Save affected editors first. Rename validation checks syntax and newly introduced diagnostics in the supported module model; it does not prove external-consumer compatibility. **oAX: Run Selected Node Tests with Approval** separately previews and authorizes a saved test file, reports actual exit status, and supports cancellation. Test code runs with local-account rights. **Onboard Repository** shows evidence with explicit heuristic labels. I/O failures can leave partial edits and are reported. **Show Git History Evidence** returns local commits and blame for saved tracked code, without inventing a cause.

The status bar and a separate symbol decoration reflect observed runtime activity. Your selection is preserved. **Reconnect Runtime** releases sessions. Voice and animated Buddy are pending.

**Refactor Selection with Codex Preview** accepts a requested change to saved selected code, previews bounded provider context, and obtains transmission consent. Codex returns a replacement proposal; oAX rejects malformed proposals and shows a native diff. Applying it requires separate exact-plan approval and unchanged file baselines. Only the selected range in that file can change. The proposal is unverified until you run relevant checks; **Run Selected Node Tests with Approval** executes a separately approved saved test file. Multi-file model refactoring remains pending.

## CLI

```powershell
node dist/cli.cjs init
node dist/cli.cjs analyze
node dist/cli.cjs query callers packages/context/src/index.ts 130 16
node dist/cli.cjs rename src/example.ts 0 17 welcome
# Inspect the JSON preview, then authorize that exact hash:
node dist/cli.cjs rename src/example.ts 0 17 welcome --apply <preview-hash>
node dist/cli.cjs explain src/example.ts
node dist/cli.cjs review src/example.ts
node dist/cli.cjs verify src/example.test.ts
# Review the operation disclosure, then authorize its exact hash:
node dist/cli.cjs verify src/example.test.ts --approve <plan-hash>
```

Positions are zero-based. `init` preserves valid configuration; `analyze` builds `.oax/graph.sqlite` and reports evidence and limitations. Private state is ignored by this repository's Git configuration. The bundled CLI currently runs from a built checkout; no global npm installation is advertised.

`query` answers callers, importers, implementations and heuristic related tests from the current runtime graph. TS/JS includes the common ESM/CJS extensions. The real-repository acceptance suite checks oAX's own cross-package callers and `AgentEngine` implementations; see [codebase intelligence](docs/codegraph.md) for verified scope, budgets and limitations.

## Documentation

[Development](DEVELOPMENT.md), [architecture](ARCHITECTURE.md), [security](SECURITY.md), [protocol](docs/protocol.md), [provider verification](docs/codex-integration.md), and the full [blueprint](oAX.md) describe setup, implemented boundaries, and planned capabilities.

The first distribution target is a local VS Code extension and CLI. Bounded Git/GitHub historical evidence is implemented; multi-file model refactoring, voice, additional interfaces, team services and cloud deployment remain separate work. Optional Chrome DevTools inspection is available through a separate, origin-scoped CLI adapter; see [browser setup](docs/browser.md). MIT license preserved.

CLI explain uses real Codex and prints a bounded context preview before transmission. Override executable discovery with --codex and an absolute Codex 0.159.2 path. Add --approve with the preview hash to authorize transmission. Explicit --mock is available only for development fixtures. CLI review returns labeled structural evidence, not a model quality verdict. Verification streams pass/fail diagnostics and returns exit code 1 on failed checks. See --help for exact arguments.

Optional read-only GitHub commands trace selected-line commits to bounded PR, review, discussion, referenced-issue and check evidence using selected-repository grants and password/secret-storage handling. Live product authentication remains unverified; see [GitHub setup](docs/github.md) and [historical evidence](docs/history.md). VS Code sign-in and chat connectors do not authenticate the product runtime. **Review Last Applied Edit and Test Evidence** connects exact approved changes to real checks and invalidates results when edited files or the test change.
