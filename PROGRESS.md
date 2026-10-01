# oAX — Implementation Progress

**Status:** Foundation implemented; local mock editor loop verified; unreleased  
**Updated:** 2026-10-02  
**Canonical blueprint:** [oAX.md](./oAX.md)  
**Development environment:** Codex desktop · TypeScript · Node.js · pnpm · SQLite · VS Code

> Mark a task complete only after verification. Mock integration does not establish live Codex behavior, semantic explanations, indexing, or refactoring.

## Current status

| Workstream                      | Status                                                                     | Next action                                              |
| ------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------- |
| Product vision and architecture | Documented                                                                 | Refer to `oAX.md`                                        |
| Engineering roadmap             | Documented                                                                 | Execute Milestone 1                                      |
| Local Git repository            | Initialized; authenticated Git fetch unavailable                           | Preserve remote history through GitHub connector sync    |
| Protocol and runtime            | Implemented and tested                                                     | Extend contracts for deterministic relationships         |
| VS Code adapter                 | Mock command verified in VS Code 1.105.0 test host                         | Add spatial observation updates and symbol resolution    |
| Codebase Graph                  | Designed                                                                   | Implement SQLite schema and indexer                      |
| Codex adapter                   | Boundary implemented, external execution disabled; official docs inspected | Pin provider version and implement enforced transport    |
| First end-to-end demo           | Foundation mock loop verified; full product demo pending                   | Complete graph, live provider, authorized refactor, diff |

**Completed milestone:** M1 — Foundation (mock acceptance only)  
**Next task:** M2 spatial intelligence: versioned observation updates, deterministic focused-symbol resolution, and evidence-based agent locations.

Milestone numbering differs between this tracker, the blueprint phases, and the attached engineering prompt. This tracker retains its original numbering. Their common first milestone is the foundation selection-to-mock loop; no later milestone is marked complete through numbering equivalence.

## Milestone 1 — Foundation

- [x] Initialize the Git repository and pnpm workspace.
- [x] Configure TypeScript, linting, formatting, tests, and CI definition (hosted CI results tracked separately).
- [x] Create only current-slice CLI, VS Code, protocol, runtime, context, spatial, permissions, Codex boundary, schemas, and tests; future services/evals remain planned.
- [x] Define the oAX protocol message envelope and versioning.
- [x] Implement events, spatial types, capability negotiation, and schema validation.
- [x] Implement the runtime process, ordered event delivery, workspace identity, and session manager.
- [x] Implement scoped permission enforcement and in-memory action audit records for enabled operations (persistent audit remains future work).
- [x] Define the product-neutral `AgentEngine` interface.
- [x] Inspect current official Codex app-server documentation and implement a disabled adapter boundary; live transport remains pending.
- [x] Create a minimal VS Code extension and authenticated private stdio runtime connection.
- [x] Pass initial build, unit tests, integration smoke tests, and actual VS Code mock selection test.

**Exit criteria:** VS Code or CLI can connect to the runtime, exchange validated messages, create an agent session, and stream lifecycle events.

## Milestone 2 — Spatial intelligence

- [ ] Capture the active file, cursor, selection, visible ranges, and open files.
- [ ] Resolve the focused symbol.
- [ ] Publish meaningful spatial events without excessive updates.
- [ ] Implement `agent.cursor.changed` and render a separate agent cursor in VS Code.
- [ ] Test spatial state transitions and editor reconnection.

**Exit criteria:** oAX reliably identifies the developer's current code and shows the agent's location separately.

## Milestone 3 — Codebase intelligence

- [ ] Create SQLite node and edge tables.
- [ ] Implement file discovery and language detection.
- [ ] Integrate Tree-sitter and/or LSP parsing.
- [ ] Extract symbols, imports, exports, calls, and dependencies.
- [ ] Implement graph queries for callers, imports, implementations, and tests.
- [ ] Add an incremental file watcher and indexing tests.

**Exit criteria:** oAX indexes a real repository and answers structural questions from its graph.

## Milestone 4 — Codex, context, and editing

- [ ] Implement the Context Relevance Engine and inspectable `ContextSlice`.
- [ ] Translate Codex lifecycle and tool events into oAX events.
- [ ] Implement agent session lifecycle, interruption, and cleanup.
- [ ] Enforce approvals for workspace writes and command execution.
- [ ] Implement explain-symbol and refactor workflows.
- [ ] Run relevant tests, capture diffs, and present review results.
- [ ] Complete the first end-to-end VS Code demo.

**Exit criteria:** Explain → refactor → approve → test → review works in VS Code.

## Milestone 5 — Git and GitHub intelligence

- [ ] Read local branches, status, diffs, blame, and commit history.
- [ ] Integrate GitHub authentication and repository metadata.
- [ ] Retrieve PRs, issues, reviews, and checks.
- [ ] Link code to commits, PRs, and relevant discussions.
- [ ] Enforce distinct Git and GitHub write permissions.
- [ ] Evaluate historical-context answer quality.

**Exit criteria:** oAX traces selected code through relevant repository history.

## Milestone 6 — Buddy experience

- [ ] Define Buddy states and map them to actual agent events.
- [ ] Show agent presence, activity, approval requests, and results.
- [ ] Connect Buddy to the agent cursor.
- [ ] Assess optional voice after the core experience is reliable.

**Exit criteria:** Buddy accurately represents agent state without owning it.

## Milestone 7 — Multi-IDE and expanded surfaces

- [ ] Stabilize the protocol for additional adapters.
- [ ] Prototype JetBrains and Neovim adapters.
- [ ] Improve CLI workflows.
- [ ] Evaluate desktop and web interfaces.
- [ ] Add cross-adapter compatibility tests.

**Exit criteria:** A second editor reuses the same runtime and protocol.

## First vertical-slice acceptance test

- [ ] Open and index a real repository.
- [ ] Capture the active file and selected symbol.
- [ ] Resolve direct callers or dependencies.
- [ ] Explain the symbol through Codex using relevant context.
- [ ] Show the agent cursor during investigation.
- [ ] Request a refactor and show an impact summary.
- [ ] Request and record write permission.
- [ ] Apply approved edits and run tests.
- [ ] Present the diff and test results for review.
- [ ] Preserve an audit trail of actions and permissions.

**Release gate:** All steps are demonstrated reliably on a representative repository.

## Quality and security gates

- [ ] Protocol validation and unit tests pass.
- [ ] Runtime, adapter, and Codex integration tests pass.
- [ ] Indexing updates incrementally.
- [ ] High-impact operations require explicit approval.
- [ ] No silent package installs, pushes, or merges.
- [ ] Sessions record tool activity, permissions, changes, and test results.
- [ ] Evaluations cover explanations, callers, refactors, tests, and Git history.
- [ ] Evaluation regressions block release.

## Architectural decisions

| Decision                                  | Reason                                          |
| ----------------------------------------- | ----------------------------------------------- |
| Standalone runtime with thin IDE adapters | Cross-IDE portability                           |
| Codex behind `AgentEngine`                | Keep vendor-specific details isolated           |
| oAX-owned protocol and session state      | Stable application boundary                     |
| SQLite graph first                        | Simple local infrastructure                     |
| Deterministic parsing and Git tools       | Reliable structural and historical context      |
| Explicit capability permissions           | Developer control and auditability              |
| VS Code first                             | Validate one complete workflow before expanding |

## Blockers and open questions

| Item                                 | State                                                 | Next action                                                                                                       |
| ------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Git CLI authentication               | Existing CLI identity lacks access to selected remote | Use connected GitHub account for branch sync; authenticate correct account before fetching shared history locally |
| Codex transport and tool enforcement | Not implemented; disabled                             | Pin installed version, generate schemas, implement deterministic provider tests before opt-in live use            |
| Evaluation repositories              | Not selected                                          | Choose small and medium sample repositories                                                                       |
| Evaluation thresholds                | Not defined                                           | Establish baseline and release targets                                                                            |
| GitHub authentication                | Not selected                                          | Choose secure local auth approach                                                                                 |

## Work log

### 2026-10-02 — Foundation implementation

**Completed:** Nine-project pinned pnpm/TypeScript workspace, validated protocol and generated JSON schemas, bounded buffer context, versioned spatial store, scoped grants and in-memory audit, runtime/mock engine lifecycle, private authenticated stdio transport, CLI demo, bundled VS Code command, editor test harness, and CI definition. MIT license copied unchanged from the remote repository. No empty future service packages were created.

**Workflow evidence:** VS Code 1.105.0 development host opened a fixture, replaced its text without saving, selected the replacement, invoked `oax.explainSelection`, and verified the returned mock answer includes the selection, current document version, and unsaved status. Fixture changes were reverted.

**Validation:** `pnpm typecheck`, `pnpm build`, `pnpm schemas`, `pnpm test` (17 passed, zero skipped), `pnpm test:integration` (2 passed), `pnpm demo`, and `pnpm test:editor` (exit 0). Final lint/format/frozen-lockfile/audit evidence is recorded below after the final checks. Tests include traversal/symlink escape, buffer freshness, authentication, scope isolation, grant denial/expiration, lifecycle, cancellation, stalled engine timeout, malformed framing, disconnect, and provider disabled behavior.

**Decisions and discrepancies:** Private stdio uses versioned oAX JSONL envelopes, not JSON-RPC 2.0. Provider RPC stays inside the future Codex transport. `verifying` currently verifies stream completion, not code changes or tests. The mock echoes selected text and makes no semantic claim. CLI supports `demo`, `serve`, and help only. SQLite, indexing, continuous spatial events, symbols, edits, persistent sessions/audit, and Buddy are not implemented.

**Resources:** Read canonical Markdown and attached engineering prompt. ZIP inventory is the AGENTS.md reference website, not oAX implementation. Existing PDF remains a planning attachment and is not regenerated. Shared ChatGPT link failed to fetch; no claims depend on its contents.

**Environment issues resolved:** Sandbox npm network access required authorized escalation. VS Code test-electron's Windows shell launch split paths with spaces; the harness now downloads the pinned editor and launches its executable directly with argument arrays and an isolated test profile. No credentials were changed. Git CLI fetch failed for the private repository while the selected GitHub connector confirms access.

**Next action:** Implement M2 deterministic symbol resolution and spatial updates, then attach codegraph/context and verified live Codex execution in their respective milestones. The full platform and release acceptance remain incomplete.

**Final checks:** `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm typecheck`, `pnpm lint` (ESLint 10.11.0 / typescript-eslint 8.71.0), `pnpm format:check`, `pnpm build`, `pnpm test` (17/17), `pnpm test:integration` (2/2), `pnpm demo`, and `pnpm test:editor` all passed. `pnpm audit --json` reported zero known advisories across 168 resolved dependencies. The editor acceptance passed twice after the Windows launch correction. `node dist/cli.cjs --help` matches the implemented commands. Live-provider checks are unavailable because external execution is deliberately disabled. Hosted CI and public packaging/release are not verified.

**Repository delivery:** A connector-authorized branch `codex/foundation-mock-loop` was created from existing remote commit `98a2cfe074491b5f0ec5784765411ece37f5b722`; implementation synchronization is the final delivery step. Local Git snapshots are independent because authenticated Git fetch is unavailable; do not push this local root history to the remote. The connector commit preserves the existing remote parent and MIT license.

### 2026-10-01 — Planning and handoff

**Completed:** Defined product direction, architecture, milestone roadmap, and this progress tracker.  
**Validation:** Planning artifacts only; no source build or tests verified.  
**Next action:** Bootstrap the repository and implement M1.

### Session template

Copy this block after every implementation session:

```markdown
### YYYY-MM-DD — Session title

**Milestone:** M1 / M2 / ...
**Completed:**

- ...

**Files changed:**

- ...

**Validation:**

- Command: `...`
- Result: ...

**Decisions:**

- ...

**Blockers:**

- ...

**Next action:** ...
```

## Codex maintenance instructions

1. Read `oAX.md`, `AGENTS.md` (if present), and `PROGRESS.md` before implementation.
2. Work on the next unchecked item in the active milestone.
3. Make small, testable changes and run relevant checks.
4. Check off tasks only after verification, and record the evidence in the work log.
5. Update current status, blockers, and the next action at the end of each session.
6. Keep this file factual; never claim unverified work is complete.
