# oAX architecture

## Current implementation status

As of 2026-10-02, the foundation mock selection loop is implemented and verified in a VS Code 1.105.0 development host. The full platform is unreleased. The original remote contained only README and MIT LICENSE; source now exists locally. See `PROGRESS.md` for validation and remote sync evidence.

Implemented entry points: `apps/cli/src/main.ts`, `adapters/vscode/src/extension.ts`, and `packages/runtime/src/runtime.ts`. Shared contracts and generated schemas originate in `packages/protocol/src/index.ts`. Context, spatial state, scoped permission checks, private stdio client/framing, and deterministic mock engine are implemented. `packages/codex` exposes an explicitly disabled engine; graph/history/indexer/watcher remain proposed.

The extension captures one full document snapshot when the command runs and spawns a bundled runtime on private stdio pipes. A random per-process token authenticates initialization. No TCP/HTTP listener exists. The adapter does not load runtime code or commands from the opened repository. Extension and CLI bundles use esbuild; private workspace packages export source for development, not public distribution.

The implemented transport uses oAX JSONL envelopes, rather than JSON-RPC 2.0 envelopes suggested in the blueprint. Provider-specific RPC is reserved for `packages/codex`. Supported requests, limits, errors, sequencing, cancellation, and snapshot semantics are specified in `docs/protocol.md`. Runtime sessions and audit records are memory-only and discarded at exit.

Only workspace-buffer reads and local mock execution are enabled. External engines fail closed. Context uses the exact editor buffer, checks URI/path realpath containment and exclusions, validates ranges, and truncates the selected excerpt. No disk code is substituted for an unsaved selection. There is no symbol or graph resolution yet.

Foundation lifecycle skips approval states because no writes, commands, or external transmission are enabled. `verifying` checks successful engine termination. Approval and tool activity contracts will be introduced alongside enforceable live/edit workflows; their proposed semantics below remain design direction.

## Architectural direction

oAX is the context and interaction layer; Codex is its primary agent engine. The core runtime is independent of editor APIs and provider wire protocols. The first deployment is local, with a VS Code adapter and CLI.

## Proposed module boundaries

| Location               | Responsibility                                        | Boundary                                      |
| ---------------------- | ----------------------------------------------------- | --------------------------------------------- |
| `packages/protocol`    | Messages, commands, events, types, JSON schemas       | No editor or provider dependency              |
| `packages/runtime`     | Sessions, tasks, lifecycle, orchestration             | Coordinates injected services                 |
| `packages/context`     | Relevance selection and bounded ContextSlice          | Records provenance and freshness              |
| `packages/spatial`     | Latest editor state and version tracking              | Uses protocol types, no VS Code API           |
| `packages/codegraph`   | Symbols, relationships, graph queries                 | Deterministic evidence and confidence         |
| `packages/permissions` | Policies, scoped grants, enforcement, audit           | Required at every action boundary             |
| `packages/codex`       | AgentEngine implementation and provider transport     | Only provider-specific boundary               |
| `packages/git`         | Local history, blame, commit evidence                 | Read operations separated from mutations      |
| `packages/github`      | Authorized PR, issue, and review context              | Least-privilege remote access                 |
| `adapters/vscode`      | Editor observations, commands, decorations, approvals | No model orchestration logic                  |
| `apps/cli`             | Initialization, analysis, and local runtime commands  | Uses shared core services                     |
| `services/indexer`     | Discovery, parsing, symbol extraction                 | Honors exclusions and supported languages     |
| `services/watcher`     | Incremental updates and invalidation                  | Handles changes, deletion, and branch changes |

Only create modules needed for the current slice. Placeholder directories are not implemented capabilities.

## Explain flow

1. The editor adapter captures workspace identity, document URI/version, selection, and visible ranges.
2. The runtime validates the message and associates it with the session.
3. Spatial and graph services resolve the selected symbol against the matching document version.
4. The context engine produces a bounded ContextSlice containing relevant files, symbols, graph paths, and available history with provenance.
5. The orchestrator calls AgentEngine with the objective and approved context.
6. The Codex adapter translates supported provider events into oAX events.
7. The IDE displays the answer and supported agent locations. It does not move the user's cursor without a user-enabled behavior.

Unsaved buffers must be represented explicitly. Do not resolve a selection against stale on-disk code without reporting the mismatch.

## Refactor flow and task lifecycle

Proposed task states:

`created → gathering_context → planning → awaiting_approval → executing → verifying → completed`

Failure and cancellation are possible from any active state. Define valid transitions explicitly and test them. A denied approval ends the pending action or permits a revised plan; it must never transition directly to execution.

A refactor gathers impact context, produces a reviewable plan, obtains scoped authorization, performs permitted edits, runs authorized checks, and presents the diff and evidence. Failures preserve diagnostic results. Cancellation must stop pending work and release resources; it does not imply automatic rollback of existing edits.

## Protocol v0.1 rules

- Version envelopes and schemas together. Validate all inbound messages.
- Use discriminated request, response, event, and notification variants; document whether a response is success or structured error.
- Include unique message IDs, correlation IDs, timestamps, workspace/session scope, and ordered sequence numbers where replay requires ordering.
- Use zero-based line/column positions and end-exclusive ranges. Normalize workspace-relative paths; reject paths escaping the workspace.
- Define capability negotiation, unknown-method handling, structured errors, cancellation, timeouts, payload limits, and backpressure before live integration.
- Give agent events task and session identity. Emit UI locations only when supported by observable evidence; never invent precise file positions from prose.

Provider reasoning internals are not required for Buddy. Buddy consumes public status and tool activity events.

## Graph and context storage

SQLite is the initial graph direction. Nodes represent files and symbols; edges represent evidenced relationships. Add commits, PRs, issues, and tests when their integrations exist. Use foreign keys, relationship indexes, transactions, schema migrations, and per-file replacement/invalidation. Stable symbol IDs must account for path and identity changes.

Label unresolved, inferred, and syntactically extracted relationships separately from semantically resolved edges. Tests must cover ambiguous names and incomplete resolution.

Proposed local state lives under `.oax/`: configuration, graph, context metadata, and session records. Context and logs may contain sensitive data; do not commit them by default. Define retention and migrations before depending on persisted sessions.

## Provider boundary

AgentEngine should expose initialization, session creation, streamed execution, interruption, and closure. Use a mock implementation for the first loop. Verify the selected Codex integration's current official protocol and authentication requirements before implementing transport; this document does not pin endpoint names, method shapes, or SDK versions.

A provider adapter must surface connection failure, disconnects, approvals, cancellation, and terminal results. Do not claim runtime policy controls provider tools until every enabled path is enforced or explicitly disabled.

## Decision record

| Decision                                 | Status  | Reason                                             |
| ---------------------------------------- | ------- | -------------------------------------------------- |
| TypeScript monorepo with pnpm workspaces | Planned | Shared contracts across runtime and adapters       |
| Local runtime, VS Code and CLI first     | Planned | Small initial deployment and vertical slice        |
| Codex behind AgentEngine                 | Planned | Isolates provider protocol changes                 |
| Deterministic graph and bounded context  | Planned | Traceable evidence and relevant prompts            |
| Separate agent cursor                    | Planned | Visible activity without taking over user position |
| Enforced scoped permissions              | Planned | Consequential actions remain controlled            |

## Open decisions

Pin Node/pnpm and provider versions; choose local IPC transport and authentication; choose first supported languages and parser; define context budgets and exclusions; decide extension/runtime packaging and update policy; specify crash recovery and log retention. Record resolved decisions with implementation references and date.
