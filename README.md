# oAX

oAX is a spatially aware developer agent runtime, designed to be a persistent participant in the workspace: understanding what the developer is viewing, how it connects to the codebase and its history, and which actions are authorized. One shared runtime, protocol, codebase graph, context engine, and permission system serves IDEs, desktop, CLI, GitHub, and web interfaces. Codex is the primary agent engine behind a provider adapter.

The intended experience connects understanding → explanation → proposal → approval → execution → verification → review. The hosted knowledge app supports that experience; it is one surface of the platform. See the [original-intent alignment and concrete gaps](docs/product-alignment.md) and [practical walkthrough](docs/getting-started-workflow.md).

The platform is being built end to end, with each supported workflow verified before it is advertised. The implementation branch is [codex/local-intelligence-preview](https://github.com/Elijah-MosesX/oAX/tree/codex/local-intelligence-preview); see its [verification tracker](https://github.com/Elijah-MosesX/oAX/blob/codex/local-intelligence-preview/PROGRESS.md) for tested versions, evidence, and remaining release gates. Universal IDE support and enterprise deployment are goals, not current compatibility claims.

## Interfaces and deployment

| Interface      | Available implementation                                                                                                                                                      | Remaining scope                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| VS Code        | Versioned selection, deterministic TS/JS graph, real Codex explanation and selected-range refactor, exact approvals, Node tests, diff review, Buddy and separate agent cursor | Broader semantic indexing and general multi-file model edits                      |
| Neovim and Vim | Actual editor acceptance for read-only structural queries using the shared runtime; unsaved text and preserved developer cursor                                               | Editing/provider workflows and broader host acceptance                            |
| JetBrains      | Java adapter compiled against the IntelliJ SDK                                                                                                                                | Plugin packaging and live IDE acceptance                                          |
| Desktop        | Portable Windows x64 workbench, authenticated local runtime, source/context/history inspection and Buddy inspection receipts                                                  | Signed installers, full agent/editing UI, macOS/Linux acceptance                  |
| CLI            | Initialization, indexing, structural queries, explanation, rename previews, approved checks and review                                                                        | Published package and broader installation acceptance                             |
| GitHub         | Selected-repository read adapter for commits, PRs, issues, reviews and checks                                                                                                 | Live product authentication acceptance, GitHub App and authorized posting         |
| Web/PWA        | Local workbench, exported-evidence PWA, and deployed authenticated shared-knowledge rooms with optional voice controls                                                        | Live multi-user/voice acceptance, automatic IDE pairing and enterprise operations |

An interface is separate from its deployment: the supported runtime currently runs locally. Managed, hybrid and enterprise self-hosted deployments will reuse the core contracts but still require their own identity, isolation, installation and recovery validation. A local runtime can use remote model inference. No interface requires all users to share one server.

Python already powers the pinned Jev planning worker; Java powers the JetBrains prototype. Python AST, Go parser and Java compiler-tree workers now feed declarations and labeled caller candidates into the same graph. Cross-language workers must preserve the same validated contracts, permissions and evidence; using a language does not imply semantic indexing support for that language. See [language-worker setup and limits](docs/language-workers.md).

Optional integrations include [Chrome DevTools MCP](docs/browser.md), the [Jev Python planner](docs/jev.md), and [Clicky-inspired companion behavior](docs/clicky.md). Their supported capabilities and external-service limits are explicit. [Ponytail and OpenMontage](docs/authoring-resources.md) support code review and product-video authoring, outside runtime authority.

## Build and use locally

The Neovim read-only prototype uses the same runtime and protocol for unsaved-buffer structural queries. A JetBrains prototype and cross-adapter tests accompany it. `node dist/cli.cjs doctor [root]` checks the local toolchain without a model request. See [adapter setup and verified limits](docs/adapters.md); SDK compilation and live IDE acceptance are recorded separately in PROGRESS.

**oAX: Show Buddy** opens an accessible native Explorer pane with workspace/provider presence, actual task and tool activity, pending approval prompts, output, edit/test review status and observed code locations. **Hide Buddy** changes presentation only. Buddy does not control the agent or grant permissions. VS Code voice remains pending; optional browser dictation and local read-aloud are implemented in the hosted knowledge service, with live audio acceptance outstanding. See [Buddy behavior](docs/buddy.md) and [shared knowledge](docs/team.md).

Use Node **24.19.0** and pnpm **11.25.0**:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm test
pnpm test:integration
pnpm package:local
```

Install `dist/oax-vscode-0.1.0.vsix` through **Extensions: Install from VSIX...**. In a trusted local workspace, select code and run **oAX: Explain Selection** for a real Codex explanation, or a **Find** relationship command for deterministic evidence. Symbols, exports and caller/import/implementation evidence come from the TypeScript checker; test relationships are labeled filename heuristics. Local relative modules, bounded project aliases and exact workspace package exports are supported. Full project/reference and external dependency resolution remain pending. See [codegraph scope](docs/codegraph.md). Session indexing refreshes in the background, preserving the selected unsaved buffer. **Show Index Status** reports freshness and failures.

Explain requires an existing official Codex login and compatible **Codex 0.159.2** or the exact verified **0.159.0-alpha.12.1** preview executable. Windows discovers the official desktop installation; other installations require user setting `oax.codexExecutable` with an absolute path. The command previews context and requires consent before transmission. Model usage may apply. Setup failures are reported without substituting a mock answer. Provider tools, environment access, and inherited MCP servers are disabled in the private subprocess. Normal tests require no login or model usage.

**oAX: Rename Symbol with Preview** shows exact before/after text, requires approval, checks saved-file baselines, and writes only the pending plan's paths. Save affected editors first. Rename validation checks syntax and newly introduced diagnostics in the supported module model; it does not prove external-consumer compatibility. **oAX: Run Selected Node Tests with Approval** separately previews and authorizes a saved test file, reports actual exit status, and supports cancellation. Test code runs with local-account rights. **Onboard Repository** shows evidence with explicit heuristic labels. I/O failures can leave partial edits and are reported. **Show Git History Evidence** returns local commits and blame for saved tracked code, without inventing a cause.

The status bar and a separate symbol decoration reflect observed runtime activity. Your selection is preserved. **Reconnect Runtime** releases sessions. Editor voice and animated Buddy are pending.

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

The first distribution target is a local VS Code extension and CLI. Bounded Git/GitHub historical evidence is implemented; multi-file model refactoring, editor voice, broader interfaces and enterprise deployment remain separate work. Optional Chrome DevTools inspection is available through a separate, origin-scoped CLI adapter; see [browser setup](docs/browser.md). MIT license preserved.

CLI explain uses real Codex and prints a bounded context preview before transmission. Override executable discovery with --codex and an absolute contract-verified Codex executable path. Add --approve with the preview hash to authorize transmission. Explicit --mock is available only for development fixtures. CLI review returns labeled structural evidence, not a model quality verdict. Verification streams pass/fail diagnostics and returns exit code 1 on failed checks. See --help for exact arguments.

Optional read-only GitHub commands trace selected-line commits to bounded PR, review, discussion, referenced-issue and check evidence using selected-repository grants and password/secret-storage handling. Live product authentication remains unverified; see [GitHub setup](docs/github.md) and [historical evidence](docs/history.md). VS Code sign-in and chat connectors do not authenticate the product runtime. **Review Last Applied Edit and Test Evidence** connects exact approved changes to real checks and invalidates results when edited files or the test change.

[Additional editor adapters](docs/adapters.md), [audit storage](docs/audit.md), and [Python/Java/Go boundaries](docs/polyglot.md) document the verified preview and remaining release gates.

## Local workbench and optional Jev planning

The built checkout includes a local repository workbench: `node dist/workbench.cjs <workspace-root>`. It reuses the same runtime for saved-source symbol/caller/context/history inspection. A portable Windows x64 desktop package includes Node and the runtime; relocation, actual app authentication and cleanup are verified. See [desktop installation](docs/desktop.md) and [shared surfaces](docs/surfaces.md). The pinned Python Jev adapter projects authorized Chrome MCP observations locally and supports separately approved TypeSafe proposals without executing them. See [installation, checks and limitations](docs/jev.md).

The [installable PWA](docs/pwa.md) includes a local runtime workbench and a publicly
deployed [evidence viewer](https://oax-evidence-viewer-xvokez.v2.appdeploy.ai/).
The hosted viewer inspects exported ContextSlices locally; it has no cloud agent
or private workspace access. [Chrome launcher and Vimium](docs/browser-extensions.md)
and the [Vim adapter](docs/vim.md) are separate interfaces over the existing boundaries.
See the [integration and gap review](docs/integration-audit.md) for evaluated dependencies
and open release gates. This is a verified subset of the platform, not the completed
enterprise product or a signed Marketplace release.

## Shared knowledge on the web

Open [oAX Shared Knowledge](https://oax-shared-knowledge-omcqtl.v2.appdeploy.ai/) to sign in, create a private repository room, invite a reader/contributor and publish reviewed findings or exported ContextSlices. Optional dictation produces a draft; local read-aloud depends on browser support. The local runtime keeps execution and approval ownership. See [practical use and acceptance limits](docs/team.md). Deployment and deterministic authorization checks passed; live owner/two-user sign-in, microphone use and product GitHub credentials still need acceptance. The hosted service does not automatically pair IDEs or run a shared Codex agent.

Historical explanations: see [connected intelligence](docs/connected-intelligence.md) for the opt-in VS Code command and CLI --history workflow, consent boundaries and verified limits.

Reviewed persistent local memory is now available through CLI and protocol: [reviewed-memory workflow](docs/reviewed-memory.md). Notes require explicit review, exact source freshness and separate provider transmission consent.
