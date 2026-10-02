# oAX

oAX is a spatially aware developer platform for understanding repositories, explaining code, tracing history, and making reviewed changes. Its direction is one shared runtime, protocol, codebase graph, context engine, and permission system across IDE extensions, desktop applications, the CLI, GitHub-integrated agents, and web/enterprise interfaces. Codex is the primary agent engine behind a provider adapter.

The platform is being built end to end, with each supported workflow verified before it is advertised. The latest implementation and installation instructions are on [codex/local-intelligence-preview](https://github.com/Elijah-MosesX/oAX/tree/codex/local-intelligence-preview). Its [README support matrix](https://github.com/Elijah-MosesX/oAX/blob/codex/local-intelligence-preview/README.md) and [PROGRESS verification tracker](https://github.com/Elijah-MosesX/oAX/blob/codex/local-intelligence-preview/PROGRESS.md) distinguish implemented, tested, and remaining capabilities. Universal IDE compatibility and enterprise deployment remain goals requiring further implementation and acceptance.

Interfaces and deployment are separate: the current runtime runs locally; managed, hybrid, and self-hosted team deployments must add identity, isolation, installation, and recovery controls. The shared architecture does not require every developer to connect to one server. Python is used for the Jev planner, Java for the JetBrains prototype, and Go remains an available worker implementation choice. These language choices do not imply semantic graph support for every language.

## Main-branch snapshot

The instructions below describe the older source currently merged into `main`. For the newer live editing, Buddy, additional-editor, desktop, PWA and browser integrations, use the implementation branch linked above. This README update does not merge those code changes or declare a production release.

## Build and use locally

Use Node **24.19.0** and pnpm **11.25.0**:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm test
pnpm test:integration
pnpm package:local
```

Install `dist/oax-vscode-0.1.0.vsix` through **Extensions: Install from VSIX...**. In a trusted local workspace, select code and run **oAX: Explain Selection (Mock)** or a **Find** relationship command. Mock output is explicitly labeled. Symbols and caller/import/implementation evidence come from the TypeScript checker; test relationships are labeled filename heuristics. Relative local module resolution is supported; full project configuration and external dependency resolution are pending.

**oAX: Explain Selection (Codex)** requires an existing official Codex login and user setting `oax.codexExecutable` pointing to **Codex 0.159.2**. The command previews context and requires consent before transmission. Model usage may apply. Provider tools, environment access, and inherited MCP servers are disabled in the private subprocess. Normal tests require no login or model usage.

**oAX: Rename Symbol with Preview** shows exact before/after text, requires approval, checks saved-file baselines, and writes only the pending plan's paths. Save affected editors first. Rename validation checks syntax and newly introduced diagnostics in the supported module model; it does not prove external-consumer compatibility. **oAX: Run Selected Node Tests with Approval** separately previews and authorizes a saved test file, reports actual exit status, and supports cancellation. Test code runs with local-account rights. **Onboard Repository** shows evidence with explicit heuristic labels. I/O failures can leave partial edits and are reported. **Show Git History Evidence** returns local commits and blame for saved tracked code, without inventing a cause.

The status bar and a separate symbol decoration reflect observed runtime activity. Your selection is preserved. **Reconnect Runtime** releases sessions. Voice and animated Buddy are pending.

## CLI

```powershell
node dist/cli.cjs init
node dist/cli.cjs analyze
node dist/cli.cjs rename src/example.ts 0 17 welcome
# Inspect the JSON preview, then authorize that exact hash:
node dist/cli.cjs rename src/example.ts 0 17 welcome --apply <preview-hash>
node dist/cli.cjs explain src/example.ts
node dist/cli.cjs review src/example.ts
node dist/cli.cjs verify src/example.test.ts
# Review the operation disclosure, then authorize its exact hash:
node dist/cli.cjs verify src/example.test.ts --approve <plan-hash>
pnpm demo
```

Positions are zero-based. `init` preserves valid configuration; `analyze` builds `.oax/graph.sqlite` and reports evidence and limitations. Private state is ignored by this repository's Git configuration. The bundled CLI currently runs from a built checkout; no global npm installation is advertised.

## Documentation

[Development](DEVELOPMENT.md), [architecture](ARCHITECTURE.md), [security](SECURITY.md), [protocol](docs/protocol.md), [provider verification](docs/codex-integration.md), and the full [blueprint](oAX.md) describe setup, implemented boundaries, and planned capabilities.

The first distribution target is a local VS Code extension and CLI. Broader GitHub issue/review/check intelligence, general agent refactoring, voice, additional interfaces, team services, and cloud deployment remain separate work. Optional Chrome DevTools inspection is available through a separate, origin-scoped CLI adapter; see [browser setup](docs/browser.md). MIT license preserved.

CLI explain defaults to a labeled mock. For live text, add --codex with an absolute Codex 0.159.2 executable; this prints a bounded context preview first. Add --approve with that context hash to authorize transmission. CLI review returns labeled structural evidence, not a model quality verdict. Verification streams pass/fail diagnostics and returns exit code 1 on failed checks. See --help for exact arguments.

Optional read-only GitHub PR association commands are implemented with selected-repository grants and password/secret-storage handling. Live product authentication has not been verified; see [GitHub setup](docs/github.md). Chat connector access does not authenticate the product.
