# oAX

A spatially aware codebase onboarding, analysis, and refactoring platform, with Codex behind a provider boundary.

This local development preview supports versioned VS Code observations, deterministic TypeScript/JavaScript symbols and relationships, bounded context, optional Codex explanations, local Git evidence, and a reviewed symbol-rename workflow. It is not the complete platform or a public release. See [PROGRESS.md](PROGRESS.md) for verified results and remaining work.

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
pnpm demo
```

Positions are zero-based. `init` preserves valid configuration; `analyze` builds `.oax/graph.sqlite` and reports evidence and limitations. Private state is ignored by this repository's Git configuration. The bundled CLI currently runs from a built checkout; no global npm installation is advertised.

## Documentation

[Development](DEVELOPMENT.md), [architecture](ARCHITECTURE.md), [security](SECURITY.md), [protocol](docs/protocol.md), [provider verification](docs/codex-integration.md), and the full [blueprint](oAX.md) describe setup, implemented boundaries, and planned capabilities.

The first distribution target is a local VS Code extension and CLI. GitHub product integration, general agent refactoring, voice, additional interfaces, team services, and cloud deployment remain separate work. Optional Chrome DevTools inspection is available through a separate, origin-scoped CLI adapter; see [browser setup](docs/browser.md). MIT license preserved.
