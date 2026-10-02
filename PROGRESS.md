# oAX — Implementation Progress

**Status:** Local intelligence preview implemented and tested; installable VSIX; unreleased  
**Updated:** 2026-10-02  
**Canonical blueprint:** [oAX.md](./oAX.md)  
**Development environment:** Codex desktop · TypeScript · Node.js · pnpm · SQLite · VS Code

> Mark a task complete only after verification. Mock integration does not establish live Codex behavior, semantic explanations, indexing, or refactoring.

## Current status

| Workstream         | Verified status                                                                             | Next action                                                                |
| ------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Protocol/runtime   | Validated envelopes, scoped sessions, plans, events, cleanup and cancellation               | Persistent audit/retention and replay design                               |
| VS Code            | Versioned unsaved context, semantic relationships, cursor/status, approval commands         | Broader interaction acceptance and accessibility                           |
| Graph/context      | SQLite, TS/JS checker, local-relative imports, bounded provenance and redaction             | Project configuration, external dependencies and broader languages         |
| Codex              | 0.159.2 restricted text adapter; real synthetic explain and context-consent denial passed   | General provider editing remains disabled until enforcement is established |
| Refactor/checks    | Saved-file semantic rename, exact approval/baselines, separate approved Node tests          | General edit plans and richer review workflows                             |
| History/onboarding | Local commits/blame and evidence-based walkthrough                                          | Product GitHub authentication and PR/issue evidence                        |
| Browser            | Optional pinned MCP inspection, dedicated profile, origin/page grants; real fixtures passed | Source-map/context integration                                             |
| Distribution       | Local VSIX and built-checkout CLI; content allowlist and notices                            | Supported release policy and hosted CI evidence                            |

M1 foundation remains verified. Spatial and initial code intelligence are implemented and tested within documented TS/JS limitations. Later milestones are partial: a limited explain/rename/Node-check workflow exists, not the complete platform. The first distribution target is local VS Code and CLI; team/cloud/other IDEs and animated/voice Buddy are pending.

The tracker retains its original milestone numbering, which differs from the attached master prompt. Historical work-log entries below describe their own checkpoints; current status supersedes old limitations without rewriting that evidence.

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

- [x] Capture the active file, cursor, selection, visible ranges, and open files.
- [x] Resolve the focused symbol.
- [x] Publish meaningful spatial events without excessive updates.
- [x] Implement `agent.cursor.changed` and render a separate agent cursor in VS Code.
- [x] Test spatial state transitions and editor reconnection.

**Exit criteria:** oAX reliably identifies the developer's current code and shows the agent's location separately.

## Milestone 3 — Codebase intelligence

- [x] Create SQLite node and edge tables.
- [x] Implement file discovery and initial TS/JS language detection.
- [x] Integrate deterministic TypeScript compiler/language-service parsing (initial language scope).
- [ ] Extract symbols, imports, exports, calls, and dependencies.
- [x] Implement graph queries for callers, imports, implementations, and heuristic tests.
- [ ] Add an incremental file watcher and indexing tests.

**Exit criteria:** oAX indexes a real repository and answers structural questions from its graph.

## Milestone 4 — Codex, context, and editing

- [x] Implement bounded context selection and inspectable `ContextSlice` (initial callers scope).
- [ ] Translate Codex lifecycle and tool events into oAX events.
- [x] Implement agent session lifecycle, interruption, and cleanup.
- [x] Enforce exact-plan approvals for supported rename writes and Node test execution.
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

**Repository delivery:** Synced implementation commit [`1357984775cfcbb3abc3897b613d93f631c41384`](https://github.com/Elijah-MosesX/oAX/commit/1357984775cfcbb3abc3897b613d93f631c41384) to [`codex/foundation-mock-loop`](https://github.com/Elijah-MosesX/oAX/tree/codex/foundation-mock-loop) through the authorized GitHub connector. It preserves existing remote parent `98a2cfe074491b5f0ec5784765411ece37f5b722` and unchanged license blob `ed15f3baa74f98072ea443230ff29686eec8fe39`. Local snapshot `818a858` and the remote implementation have identical tree `8536d4ebf4ab795ca9455c1ea232092d5903c0ca` (59 reviewed files). This delivery-evidence update follows as a documentation commit. Local Git history remains independent because authenticated Git fetch is unavailable; do not push its root history to the remote. No release is claimed.

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

### 2026-10-02 — Local intelligence and installable preview

**Implemented:** Persistent editor sessions and versioned observations; TS/JS SQLite graph with semantic local-relative relationships, unresolved/heuristic labels and bounded queries; selected unsaved overlays; bounded, inspectable context with conservative redaction; restricted Codex 0.159.2 text transport; exact-plan semantic rename with grants and baseline checks; separately authorized saved Node test execution; observed-source cursor/status; local Git commits/blame; deterministic repository walkthrough; optional Chrome DevTools MCP 1.10.1 origin/page-scoped inspection; local VSIX packaging with MIT/third-party notices.

**Verified evidence:** `pnpm typecheck`, `pnpm lint`, `pnpm build`, generated schemas, unit tests (31 passed) and stdio integration tests (3 passed) succeeded. Real VS Code 1.105.0 acceptance verifies unsaved selected code, semantic caller query, unchanged human selection and reconnection. The synthetic live test, explicitly authorized by the user, passed direct restricted-provider and stdio context-consent workflows; missing consent was denied. Real dedicated Chrome 154.0.8037.92 fixtures passed snapshot/navigation plus blocked cross-origin redirects/subresources and denied ungranted/file-output operations. `pnpm package:local` produced an eight-entry VSIX with verified allowlist and license notices. `pnpm audit` reported no known advisories. Final post-documentation checks and installed-package acceptance are recorded below.

**Limits:** TS/JS graph does not implement full tsconfig/external library resolution; changed snapshots rebuild semantic edges globally. Polling watcher is tested independently, not attached to editor sessions. Related test edges and entrypoint candidates remain heuristics. Live provider tools are disabled; semantic rename is deterministic rather than model-generated editing. Node tests execute under local-account rights, with fixed arguments, limited environment/output and timeout, not an OS sandbox. General commands/package scripts are unavailable. Browser evidence is a separate CLI workflow, not source-map/model integration. Product GitHub, full evaluations, persistent audit/retention, voice/animation, other IDEs/team/cloud, hosted CI and public release support/reporting remain unfinished. Approval modal workflows are implemented but not fully automated editor acceptance; runtime execution boundaries are tested.

**Delivery:** Preserve the remote MIT license and main ancestry. Sync reviewed sources/documents through the authorized GitHub connector because the existing Git CLI login cannot fetch this private repository. Do not push the independent local root history. The user's raw oAX-Complete.md, ZIP/PDF attachments, credentials, browser profiles, local state and generated binaries are excluded from commits.

**Next concrete action:** Complete product GitHub read integration and broaden the installable local workflow/evaluation evidence before considering additional deployment surfaces. No full-platform or public-release completion is claimed.

**Final checkpoint checks:** Frozen lockfile installation passed across 14 workspace projects. After the diff-preview and query-limit changes, build/typecheck/lint, 31 unit tests, three stdio integration tests and VSIX packaging passed again. The installed VSIX contents were loaded in the isolated VS Code 1.105.0 development host and passed unsaved context, relationships, reconnection, onboarding and unchanged-selection assertions (exit 0). The eight-entry 1.73-MB package contains both bundles, manifest, README, MIT license and TypeScript/Zod notices. CLI self-analysis succeeded with 46 supported files and 785 symbols. Formatting passed. Schema generation initially failed after introducing top-level await under CommonJS; an async main wrapper fixed it, and generation/typecheck/lint/format checks then passed. Hosted CI is defined but no hosted result is claimed.
