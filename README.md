# oAX

**A spatially aware codebase onboarding, analysis, and refactoring platform, powered by Codex behind a provider boundary.**

The foundation is implemented: a VS Code selection travels through a local oAX runtime and bounded editor-buffer context to a deterministic mock engine, then returns to the editor. The actual VS Code development-host test includes unsaved changes and document versions.

This is an unreleased development checkout. Mock output echoes the captured selection; semantic explanations, deterministic graph queries, live Codex, authorized refactoring, history, and Buddy remain planned. See [PROGRESS.md](PROGRESS.md) for evidence and limitations.

## Try the foundation

Use Node.js 24.19.0 and pnpm 11.25.0:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm test
pnpm test:integration
pnpm demo
```

For the editor workflow, open this checkout in VS Code and launch **oAX extension (mock)** with F5. In the development host open a trusted local workspace, select code, and invoke **oAX: Explain Selection (Mock)**. The result appears in the **oAX (Mock)** Output channel. Run `pnpm test:editor` for automated acceptance in the pinned VS Code 1.105.0 host.

The mock loop requires no OpenAI credentials and transmits no context to a model. It does not edit source or run workspace commands. It uses authenticated private stdio pipes, explicit protocol scope, validated snapshots, bounded context, and workspace path checks. Security limitations are documented in [SECURITY.md](SECURITY.md).

## Architecture and next work

The runtime owns sessions, tasks, lifecycle, context, and permissions. Adapters translate editor observations and display results. The protocol is independent of VS Code and provider RPC. Codex-specific integration belongs in `packages/codex`; its implementation is currently disabled until live transport and tool policy are verified.

Next: spatial observation updates and deterministic focused-symbol resolution, followed by codegraph relationships and enforced live workflows. The complete platform roadmap remains in [oAX.md](oAX.md).

| Document                                       | Purpose                                              |
| ---------------------------------------------- | ---------------------------------------------------- |
| [DEVELOPMENT.md](DEVELOPMENT.md)               | Actual setup, commands, and editor tests             |
| [ARCHITECTURE.md](ARCHITECTURE.md)             | Implemented boundaries and design direction          |
| [PROGRESS.md](PROGRESS.md)                     | Verified work, blockers, and next actions            |
| [AGENTS.md](AGENTS.md)                         | Repository implementation instructions               |
| [SECURITY.md](SECURITY.md)                     | Controls, limitations, and release requirements      |
| [Protocol](docs/protocol.md)                   | JSONL contracts, limits, cancellation, and context   |
| [Codex integration](docs/codex-integration.md) | Official integration verification and remaining work |

Private source repository: [Elijah-MosesX/oAX](https://github.com/Elijah-MosesX/oAX). No extension or npm package has been released. MIT license, copyright 2026 Elijah Moses; see [LICENSE](LICENSE).
