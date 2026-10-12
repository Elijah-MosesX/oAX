# oAX — Implementation Progress

**Status:** Local intelligence preview implemented and tested; installable VSIX; unreleased  
**Updated:** 2026-10-02  
**Canonical blueprint:** [oAX.md](./oAX.md)  
**Development environment:** Codex desktop · TypeScript · Node.js · pnpm · SQLite · VS Code

> Mark a task complete only after verification. Mock integration does not establish live Codex behavior, semantic explanations, indexing, or refactoring.

## Current status

| Workstream         | Verified status                                                                             | Next action                                                                |
| ------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Protocol/runtime   | Validated envelopes, scoped sessions, plans, events, cleanup and cancellation               | Retention/replay design; persistent metadata now tested                    |
| VS Code            | Versioned unsaved context, semantic relationships, cursor/status, approval commands         | Broader interaction acceptance and accessibility                           |
| Graph/context      | SQLite, TS/JS checker, bounded project aliases/workspace exports, real-repository queries   | Project references, external dependencies and Python/Java/Go parsers       |
| Codex              | Exact-version restricted text adapter; installed live explanation/edit acceptance passed    | General provider editing remains disabled until enforcement is established |
| Refactor/checks    | Saved-file semantic rename, exact approval/baselines, separate approved Node tests          | General edit plans and richer review workflows                             |
| History/onboarding | Local commits/blame and evidence-based walkthrough                                          | Live scoped GitHub acceptance; broader issue/review evidence               |
| Browser            | Optional pinned MCP inspection, dedicated profile, origin/page grants; real fixtures passed | Source-map/context integration                                             |
| Distribution       | Local VSIX and built-checkout CLI; content allowlist and notices                            | Supported release policy and hosted CI evidence                            |

M1 foundation and M2 spatial intelligence are complete with verified editor acceptance. M3 meets its actual-repository graph exit criteria in the documented TS/JS scope. M4's real Codex Explain -> refactor -> approve -> test -> review exit is verified from source and the installed VSIX. M5's selected-code local-history exit and deterministic GitHub contracts are verified; live scoped product GitHub authentication remains unverified. M6 Buddy meets its native text experience exit criteria, including final installed-VSIX live acceptance. The first distribution target is local VS Code and CLI; Neovim is verified; live JetBrains, Python/Java/Go semantic indexing, voice and team/cloud remain pending. This does not claim the full platform is complete.

M3 codebase intelligence now meets its exit criteria for the documented initial TS/JS scope: this actual oAX repository is indexed and callers, importers and implementations are answered from deterministic graph evidence. The current module scope additionally covers common Node ESM/CJS extensions, bounded project aliases and exact workspace package exports. Broader language/project support and production release maturity remain separate work.

The tracker retains its original milestone numbering, which differs from the attached master prompt. Historical work-log entries below describe their own checkpoints; current status supersedes old limitations without rewriting that evidence.

## Milestone 1 — Foundation

- [x] Initialize the Git repository and pnpm workspace.
- [x] Configure TypeScript, linting, formatting, tests, and CI definition (hosted CI results tracked separately).
- [x] Create only current-slice CLI, VS Code, protocol, runtime, context, spatial, permissions, Codex boundary, schemas, and tests; future services/evals remain planned.
- [x] Define the oAX protocol message envelope and versioning.
- [x] Implement events, spatial types, capability negotiation, and schema validation.
- [x] Implement the runtime process, ordered event delivery, workspace identity, and session manager.
- [x] Implement scoped permission enforcement and in-memory action audit records for enabled operations (production source-free persistence verified in the later acceptance slice).
- [x] Define the product-neutral `AgentEngine` interface.
- [x] Inspect official Codex app-server documentation and define its adapter boundary; restricted live text was subsequently implemented and verified in a later slice.
- [x] Create a minimal VS Code extension and authenticated private stdio runtime connection.
- [x] Pass initial build, unit tests, integration smoke tests, and actual VS Code mock selection test.

**Exit criteria:** VS Code or CLI can connect to the runtime, exchange validated messages, create an agent session, and stream lifecycle events.

## Milestone 2 — Spatial intelligence

- [x] Capture the active file, cursor, selection, visible ranges, and open files.
- [x] Resolve the focused symbol.
- [x] Publish meaningful spatial events without excessive updates.
- [x] Implement `agent.cursor.changed` and render a separate agent cursor in VS Code.
- [x] Test spatial state transitions and editor reconnection.

**Exit criteria:** Verified complete on VS Code 1.105.0: oAX identifies current code and shows an evidence-based agent location separately, preserving the developer selection. Open files mean actual text tabs rather than cached document models.

## Milestone 3 — Codebase intelligence

- [x] Create SQLite node and edge tables.
- [x] Implement file discovery and initial TS/JS language detection.
- [x] Integrate deterministic TypeScript compiler/language-service parsing (initial language scope).
- [x] Extract symbols, imports, exports, re-exports, calls, and local-relative module dependencies in the initial TS/JS scope; full project/external dependency resolution remains pending.
- [x] Implement graph queries for callers, imports, implementations, and heuristic tests.
- [x] Attach bounded session background polling with serialized refreshes, dirty overlays, status/error reporting, invalidation and cleanup tests; semantic edges still reconcile globally.

**Exit criteria:** oAX indexes a real repository and answers structural questions from its graph.

**Acceptance:** Verified against the actual oAX source through authenticated stdio and the built CLI: `offset` callers include `selectionEditPlan`, context importers include the refactor runtime, and `AgentEngine` implementations include `MockAgentEngine` and `CodexAgentEngine`. Every asserted relationship is semantically resolved with a source evidence location. Scope and remaining limits: [codegraph](docs/codegraph.md).

## Milestone 4 — Codex, context, and editing

The next three paragraphs retain the earlier work-in-progress checkpoint. The checked tasks and final 2026-10-02 acceptance work log supersede those temporary blockers.

2026-10-02 work in progress: added sanitized Codex turn/message activity and denied-tool events, a session-scoped applied-edit review record, exact approval hashes, captured before/after content, Node test exit/output evidence, and stale source/test detection. VS Code now exposes Review Last Applied Edit and Test Evidence and attaches selected Node tests to the edit session. These changes are local and not yet synced or marked complete.

Intermediate verification: typecheck/lint/build passed; unit tests passed 43/43 and integration tests passed 6/6, including exact edit/test approval rejection, real failed/passing Node checks, review freshness and session isolation. Additional test-freshness and preview-budget hardening followed those test runs and still require final regression verification.

Historical checkpoint before the successful M4 acceptance recorded below: live editor acceptance was incomplete. VS Code 1.105.0 rejects modal dialogs in extension-test mode, so a separate development-only synthetic acceptance harness was prepared to exercise production commands and real dialogs without adding an approval bypass to oAX. Computer Use was stopped by the user with the physical Escape key before this visible run could be completed. The owned synthetic host was closed. No live Explain → refactor → approve → test → review success is claimed. Next: finish regression checks, run the authorized synthetic live editor acceptance, verify the installed VSIX, update architecture/development documentation and sync the reviewed source to GitHub.

- [x] Implement bounded context selection and inspectable `ContextSlice` (initial callers scope).
- [x] Translate Codex lifecycle and tool events into oAX events (text-only provider; denied tools are observable).
- [x] Implement agent session lifecycle, interruption, and cleanup.
- [x] Enforce exact-plan approvals for supported rename writes and Node test execution.
- [x] Implement explain-symbol and refactor workflows (saved single-selection model edits and semantic rename).
- [x] Run relevant tests, capture diffs, and present review results.
- [x] Complete the first end-to-end VS Code demo (real provider/editor acceptance, not a substituted mock).

**Exit criteria:** Explain → refactor → approve → test → review works in VS Code.

## Milestone 5 — Git and GitHub intelligence

- [x] Read local branches, selected-file status/diff, selected-line blame, and bounded file history.
- [x] Integrate GitHub authentication and repository metadata (explicit repository-scoped token; deterministic acceptance).
- [x] Retrieve bounded PRs, referenced issues, reviews, discussion comments and check runs.
- [x] Link selected-line commits to PR associations and relevant discussions; issue references remain heuristic.
- [x] Enforce distinct Git and GitHub write permissions; read-only adapters expose no mutations.
- [x] Evaluate historical-context evidence quality with deterministic provenance/permission fixtures.

**Exit criteria:** oAX traces selected code through relevant repository history.

## Milestone 6 — Buddy experience

- [x] Define Buddy states and map them to actual agent events.
- [x] Show agent presence, activity, approval requests, and results.
- [x] Connect Buddy to the agent cursor.
- [x] Assess optional voice after the core experience is reliable (deferred with documented controls and acceptance requirements; no capture implemented).

**Exit criteria:** Buddy accurately represents agent state without owning it.

**Acceptance:** Native VS Code pane and status consume the editor-independent read-only projection. Actual editor tests verify accepted cursor linkage, unchanged developer selection, hidden-view execution and reconnect cleanup. The final installed VSIX passed real Codex Explain -> refactor -> actual production approval -> Node tests -> current verified review on VS Code 1.105.0. Buddy matched every production prompt and the final completed/verified result. See [Buddy](docs/buddy.md) and the latest evidence below.

## Milestone 7 — Multi-IDE and expanded surfaces

- [x] Stabilize the protocol for additional adapters.
- [x] Prototype JetBrains and Neovim adapters.
- [x] Improve CLI workflows.
- [x] Evaluate desktop and web interfaces.
- [x] Add cross-adapter compatibility tests.

**Exit criteria:** A second editor reuses the same runtime and protocol. Verified in actual Neovim 0.11.5. JetBrains Java source compiles against its SDK; Gradle packaging and live IDE acceptance remain unverified. Desktop/web were evaluated, not deployed.

## First vertical-slice acceptance test

- [x] Open and index a real repository (oAX self-analysis).
- [x] Capture the active file and selected symbol (versioned editor acceptance).
- [x] Resolve direct callers or dependencies within the supported local-relative module model.
- [x] Explain the symbol through Codex using relevant context.
- [x] Show the agent cursor during investigation.
- [x] Request a refactor and show an impact summary.
- [x] Request and record write permission.
- [x] Apply approved edits and run tests.
- [x] Present the diff and test results for review.
- [x] Preserve an audit trail of actions and permissions.

**Release gate:** The supported local TS/JS vertical slice is demonstrated on a controlled multi-file repository with real Codex and installed VS Code approvals, and self-analysis separately verifies the actual oAX repository graph. This does not establish general multi-file editing, Python/Java/Go semantic support, external customer-repository acceptance or a supported public release. See the latest evidence below and docs/polyglot.md.

## Quality and security gates

- [x] Protocol validation and unit tests pass.
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

| Item                           | State                                                                                                     | Next action                                                                               |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Git CLI authentication         | Existing CLI account lacks selected private-repository access; connector sync works                       | Keep remote ancestry through connector; no credential changes                             |
| Installed VS Code 1.138.0      | Running CodeSetup updater holds installation mutex and prevents UI launch                                 | Let setup finish, then run installed-version acceptance; pinned 1.105.0 acceptance passes |
| General provider tools         | Restricted text integration is live verified; tools deliberately unavailable                              | Establish enforcement before enabling model edits/commands                                |
| Product GitHub live acceptance | GET-only adapter and credential UI implemented; HTTP fixtures pass                                        | Connect a selected-repository read-only token through the extension, not chat/config      |
| Broader evaluation             | Deterministic fixtures and oAX self-index exist; thresholds/representative quality evaluation remain open | Establish measured release gates and user acceptance                                      |
| Public release                 | No public publication; support/reporting policy not configured                                            | Owner must select maintained support/private reporting before public release              |

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

**Next concrete action:** Verify live scoped GitHub reads and broaden the installable local workflow/evaluation evidence before considering additional deployment surfaces. No full-platform or public-release completion is claimed.

**Final checkpoint checks:** Frozen lockfile installation passed across 14 workspace projects. After the diff-preview and query-limit changes, build/typecheck/lint, 31 unit tests, three stdio integration tests and VSIX packaging passed again. The installed VSIX contents were loaded in the isolated VS Code 1.105.0 development host and passed unsaved context, relationships, reconnection, onboarding and unchanged-selection assertions (exit 0). The eight-entry 1.73-MB package contains both bundles, manifest, README, MIT license and TypeScript/Zod notices. CLI self-analysis succeeded with 46 supported files and 785 symbols. Formatting passed. Schema generation initially failed after introducing top-level await under CommonJS; an async main wrapper fixed it, and generation/typecheck/lint/format checks then passed. Hosted CI is defined but no hosted result is claimed.

**GitHub checkpoint:** Implementation commit [47e270f2eeee49d27c4fee9f4d85387dcda282de](https://github.com/Elijah-MosesX/oAX/commit/47e270f2eeee49d27c4fee9f4d85387dcda282de) is synced to [codex/local-intelligence-preview](https://github.com/Elijah-MosesX/oAX/tree/codex/local-intelligence-preview). Its 107-file tree c64f84dac825a8ff4a1ae4c55839d3f0e1040533 exactly matches local snapshot 2599600. Parent 377ad0ccc2ae7f8ada093f1d6b69c0aa04ca805f and MIT blob ed15f3baa74f98072ea443230ff29686eec8fe39 are preserved; main was not changed.

**CLI follow-through:** Added saved-file `explain` (mock by default; optional pinned Codex with exact context consent), `review` (explicit structural evidence, no fabricated quality verdict), and `verify` (exact Node-test preview/approval). SIGINT cancels tasks. Failed checks retain captured stdout diagnostics and exit 1. Build/typecheck/lint passed; integration acceptance now passes 4/4 including the built CLI, actual successful/failing Node checks, wrong-hash denial, path escape and unchanged source. Initial test assertions incorrectly assumed caller ordering and TAP output; they were corrected to assert actual caller membership and reporter-independent pass/fail counts. No live-model test was needed for this CLI-only change; restricted live runtime evidence remains recorded above.

**Scoped GitHub continuation:** Implemented packages/github and VS Code selected-repository connect/PR evidence/disconnect commands. Fine-grained token entry uses password input with optional VS Code SecretStorage. Runtime credentials/one-hour authorization remain session scoped; fixed-origin GET requests, exact resource grants, eight-second timeout, redirect rejection, 64-KiB response cap and credential redaction gate metadata/commit-to-PR evidence. No writes/model transmission exist. Official REST API 2026-03-10 and VS Code APIs were checked. Deterministic HTTP fixture tests prove no network without grants, repository/session scope, rejected unapproved connections, bounded responses, constructed references, credential non-disclosure and disconnect. Build/typecheck/lint and 33 unit tests passed; four stdio/CLI integration tests passed. Live authenticated product/credential UI are pending because product credentials must be connected separately from this chat. Issues/reviews/checks, pagination and evaluation of historical causes remain incomplete.

**Final GitHub-slice verification:** After echoed-token redaction and expiry cleanup, 33/33 unit tests, typecheck/lint/build, format checking, frozen installation across 15 workspaces, packaging and audit all passed. Four integration tests passed before this final redaction-only change. The final installed VSIX passed the isolated VS Code 1.105.0 development-host assertions again, including onboarding and preserved selection. Package SHA-256: 56edcb4dee26703a4378ab6eebf76ab76f4f012550229a006313217f6e97271c. Testing the installed VS Code 1.138.0 executable failed before extension activation because CodeSetup still held its update mutex after 30 seconds; read-only process inspection confirmed active setup processes. The updater was not interrupted or modified. No installed-1.138.0 or live GitHub acceptance is claimed.

**Follow-up delivery verified:** CLI commit 11e07cc2a59d28e613e677df7d1fed9d71b68601 and scoped GitHub commit 27c411e1e01fe3af8793b3f4d658e5400daf78a2 are synced to codex/local-intelligence-preview. Latest implementation tree 7d1572f626feefd626a6a93adb67b51e93f03324 exactly matches local snapshot 49194e5. Remote GitHub adapter content was fetched after updating the branch. Main remains 98a2cfe074491b5f0ec5784765411ece37f5b722; no force push, merge, PR posting, publication or credential changes occurred. The only untracked workspace file is the preserved user attachment oAX-Complete.md. This delivery evidence follows as a documentation-only commit.

### 2026-10-02 — Milestone 2 acceptance and observation fixes

**Completed:** Rechecked M1 acceptance and completed M2 spatial verification. Observation deduplication now includes workspace identity, URI, document version, dirty/saved state, cursor, selection, visible ranges and open files. Opening/closing tabs and saving files schedule observations. Open-file capture uses actual file-backed text tabs rather than VS Code's cached document models; stale asynchronous observations cannot replace a newer active editor state. Empty/nonlocal/untrusted active views clear current spatial status. A read-only extension inspection API exposes source-free metadata and only a cursor location actually accepted for decoration after version/hash checks.

**Evidence:** Actual VS Code 1.105.0 test host verifies selected unsaved text and version, observed decoration/source hash, automatic caret-to-focused-symbol changes, captured visible ranges, actual tab opening/closing, no full source in inspection metadata, stale decoration clearing after a buffer edit, semantic callers with source evidence, preserved developer selection, onboarding and reconnection. Unit suite: 34/34; integration suite: 4/4. `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:integration`, `pnpm test:editor`, and `pnpm package:local` passed. Initial editor acceptance exposed cached closed documents in openFiles; tab-based capture fixed that. A later test used an old TextEditor instance after switching tabs; the harness now uses the returned current editor. Fixtures are restored and no model requests were made in this session.

**Scope:** The tracker/blueprint M2 is spatial intelligence. The attached master prompt combines spatial and initial code intelligence; its selected-symbol/relationship acceptance is also covered by the existing deterministic TS/JS SQLite graph and editor tests. Full project configuration, external dependencies, broader languages and runtime background watcher attachment remain pending. Graph changes already invalidate on refreshed queries; unchanged AST/file records are reused and semantic edges rebuild globally. No full-platform or release completion is implied.

**Next milestone:** M3 codebase intelligence: attach the bounded watcher safely to session indexing, preserving unsaved overlays and serializing refreshes, then expand supported graph evidence. Keep later provider/tool and deployment work separate.

**Packaged M2 acceptance:** The rebuilt eight-entry VSIX was installed into the isolated extension directory and passed the expanded VS Code 1.105.0 acceptance again (exit 0). No live-provider/GitHub/browser requests were required by this spatial-only change. The installed editor updater limitation remains separate from the verified baseline.

**M2 delivery:** Synced implementation commit 97be10933cfc7451b15b5d80ec535b68bf34a79f to codex/local-intelligence-preview. Remote tree 510400c72b6eec5f91f6e00ad8ff18eb9de5fd9f matches local snapshot 823ff25 exactly. It preserves parent 7c302252c5e2a5c96363a08c8f73c6e3406528fd and remote main ancestry; no force push or publication. Updated VSIX SHA-256 is 10469d568f22076789bd3821b35667ce5ff378284e53d2b6e4aacc2e8ccaa411. Read-only process inspection still found the user's running CodeSetup processes; no updater/process changes were made. The raw oAX-Complete.md attachment remains preserved and untracked.

### 2026-10-02 — Real Explain defaults, continuous indexing and Codex selection editing

**Error diagnosis:** The user's in-app GitHub commit page first displayed 504 Gateway Time-out, then 404 after reload with a Sign in link. The authenticated GitHub connector confirmed the private commit exists. Browser cookies and connector authentication are separate; the signed-out browser cannot view this private repository. The precise gateway timeout cause is not established. No credentials or access controls were changed.

**Implemented:** Public VS Code Explain/status-bar and CLI explain select real Codex. Official Windows executable discovery is constrained to the vendor installation directory; explicit absolute paths still override it and pinned-version/auth checks remain mandatory. There is no automatic mock fallback. Deterministic tests call a hidden editor mock command or explicit CLI --mock. Context is displayed before transmission consent. Session watchers serialize observation/background refreshes, preserve the selected dirty overlay, invalidate changes/renames/deletions, expose index.status and stop before graph disposal. Named/local alias exports, re-exports and unresolved modules retain deterministic evidence.

**Actual model editing:** Refactor Selection with Codex Preview collects a requested change, obtains exact context consent, generates strict JSON through the text-only provider, and stages a single captured-selection replacement. Model data cannot select another path, execute commands or grant permissions. Native diff approval is separate from transmission consent. Saved document/disk baselines, expiration, exact hash and scoped write grants remain enforced. A proposal is unverified until separately authorized checks pass. Multi-file model editing and file creation/deletion remain pending.

**Verified:** pnpm schemas, typecheck, lint and build passed. pnpm test passed 37/37; pnpm test:integration passed 4/4. pnpm test:editor passed on VS Code 1.105.0. New fixtures verify export alias targets/deletion, autonomous background updates with dirty overlay preservation, malformed/extra-field proposal rejection, wrong-hash denial, concurrent edits, Unicode/CRLF preservation and approval replay denial. The authorized pnpm test:live passed real synthetic explanation and a complete synthetic Codex fix -> no-write preview -> wrong-hash denial -> exact approved write -> separately approved Node test. No real repository content was sent in live acceptance.

**Limits and next actions:** Live editor modal interaction is implemented but not yet verified end to end; runtime live editing/verification is verified. Supported graph scope remains local-relative TS/JS. Provider tools remain disabled. Broader GitHub evidence, persistent audit/retention, project configuration, richer Buddy/voice, team/cloud and supported-release operations remain incomplete. Continue with broader edit impact/verification and interaction acceptance; keep release claims separate from implemented slices.

**Repository/package acceptance:** Final typecheck, lint, format:check and build passed. The built CLI indexed this actual repository: 54 source files and 972 symbols, with 36 resolved and 248 unresolved imports under the explicitly limited local-relative model (workspace aliases/external dependencies are not resolved). The rebuilt eight-entry VSIX was installed into the isolated acceptance profile and passed VS Code 1.105.0 acceptance, exit 0. SHA-256: d09e26d1e7e8cd916ba6e9dc701e34cb1559f650e9daa11f7d2b122a8d68f94a. No user updater, credentials, access controls, publication or deployment were changed.

**Source delivery:** Implementation commit 614590a956274c3110cd98cc62067281c94f835f is verified on codex/local-intelligence-preview. Its tree 5ad8438f06d354c0686c4af4f04a31dbee26f48a exactly matches local snapshot f7c1833 (28 reviewed changed files). Delivery preserved the existing remote parent c3b94526b9c9a75f82a5e4eeefa00544901a06a3 and main ancestry, using a non-force ref update. The original attachment oAX-Complete.md remains preserved and untracked. This progress evidence follows as a documentation-only commit.

### 2026-10-02 — Milestones 1/2 reconfirmed and Milestone 3 repository acceptance

**Implemented:** Bounded JSONC project metadata, nearest config/baseUrl/paths with one local inherited chain, exact local workspace package exports, metadata-only invalidation, common Node ESM/CJS extensions, TS import-equals and literal dynamic-import dependencies, and a public structural CLI query command. Calls inside variable initializers now belong to the enclosing callable instead of the result variable. Source/metadata reads share content budgets; discovery additionally caps directory entries and metadata count. Configuration is parsed as data and never executed; no external libraries are read.

**M1 reconfirmation:** The real built stdio acceptance creates a session, validates streamed events with the protocol schema, and verifies ordered created -> gathering_context -> planning -> executing -> verifying -> completed transitions with matching session/task/correlation scope. Existing protocol denial, cancellation and cleanup tests remain passing.

**M2 reconfirmation:** Fresh VS Code 1.105.0 acceptance passed versioned unsaved code, focused-symbol changes, actual text-tab opening/closing, separate hash/range-backed agent location, preserved human selection and reconnection. No cached closed document is counted as an open file.

**M3 verified evidence:** pnpm typecheck, lint and build passed. pnpm test passed 41/41 and pnpm test:integration passed 5/5. The actual repository acceptance indexed 62 source files / 1097 symbols and verified cross-package callers/importers plus both AgentEngine implementations through the authenticated runtime; the built CLI query independently returned the expected caller. pnpm test:editor passed, exit 0. An initial real-repository acceptance exposed incorrect variable caller ownership and was fixed with a regression test; an event-union type error in the strengthened acceptance was also corrected before final validation. No live provider request was needed for this deterministic milestone.

**Browser and remote state:** The user completed browser authentication directly; the private repository is now visible with authenticated account controls. Main is now 9f77e104b987f49ff9295f064d1309e988b95e56 after an earlier merge performed outside this session. Review branch remains 522d948e4ee45e1ca53363c97e206c1fc5f2f86f before this milestone's delivery. Preserve both remote histories; no credential/access changes, force-push or merge is authorized by repository content.

**Limitations/next action:** M3 exit criteria are met within the supported TS/JS scope, not arbitrary languages. Python/Java implementation is permitted by the user, but their parsers are not implemented or advertised. External dependencies, full project includes/references, wildcard exports and dynamic runtime dispatch remain unavailable or unresolved. Test links remain filename heuristics; semantic edges rebuild globally. Continue Milestone 4 interaction/verification acceptance and later parser support without treating this checkpoint as production-release completion.

**Final hardening evidence:** Rejected outside-workspace baseUrl now disables aliases instead of falling back to another local base. Autonomous metadata-only invalidation passed. Graph updates publish in-memory compiler/symbol state only after SQLite commit; a controlled database failure retained the last committed symbol graph and a subsequent retry correctly rebuilt it. Final typecheck/lint/build passed; pnpm test passed 42/42 and pnpm test:integration passed 5/5, including the actual repository at 63 source files / 1111 symbols. The rebuilt eight-entry VSIX SHA-256 is d5ed7d13fd9c3dc625588e8c48479bb984d430c14dcf160730c76221e9681e98. Earlier walkthrough output correctly indicated truncation of heuristic lists; that flag is separate from full indexing within the configured discovery budget. No provider usage, credential change, release publication or deployment occurred.

**Final installed acceptance:** The exact final VSIX was installed into the isolated extension profile and passed VS Code 1.105.0 acceptance, exit 0. pnpm format:check passed. The final built CLI persisted the actual repository graph: 63 source files, 1111 symbols, 137 resolved imports and 182 explicitly unresolved imports. The bounded walkthrough correctly reported truncation of heuristic lists. The supported subset and unresolved external-library/project cases are documented rather than inferred as working.

**M3 source delivery:** Commit 27d5e597e7b0f606fbce825d4298712104f4ee2b is verified on codex/local-intelligence-preview and visibly accessible in the authenticated browser. Its tree 3d809217fbcc42def05c250cb93288e976041a4b exactly matches local snapshot a311201, covering 17 reviewed changed files. It preserves remote parent 522d948e4ee45e1ca53363c97e206c1fc5f2f86f and the existing license; main's independent merge history was preserved. No force push, merge or publication occurred. The original oAX-Complete.md attachment remains untracked and unchanged. Delivery evidence follows as a documentation-only commit.

### 2026-10-02 — Milestone 4 exit verified and initial Milestone 5 historical intelligence

**M4 implemented and verified:** Sanitized Codex lifecycle/message and denied-tool events now reach oAX. Exact approved plans retain captured diffs, test-plan/source identity, actual exit status and bounded redacted output. Review checks edited-file and saved-test freshness. Production approval Quick Picks start on Cancel, show full details in output, and require an explicit selected action. The inspection API is read-only; automated approval exists solely in the excluded development acceptance harness. Custom refactor instructions and a bug-fix objective are supported. Provider tools remain disabled; only the runtime applies approved edits and executes approved checks.

**M4 exit evidence:** pnpm test:live passed existing-login preflight, real synthetic explanation/activity translation, exact context consent, real model proposal, wrong-hash denial, approved write and a separately approved real Node test. Full editor acceptance passed on VS Code 1.105.0 from both the source snapshot and the installed final VSIX. Production commands executed Explain -> refactor -> explicitly select native approval -> test -> review, with real Codex 0.159.2, exit 0, matching before/after hashes, verified review and preserved developer selection. Evidence files: .vscode-test/m4-live-wrvZZ7/acceptance.json and .vscode-test/m4-live-oeHnz4/acceptance.json. Only synthetic context was transmitted. Earlier Windows helper owner mismatch and modal-test restrictions were resolved for acceptance by using actual VS Code Quick Pick commands, not a production authorization bypass. A Thenable typing error in the harness was corrected; final typecheck passed.

**M5 implemented:** Fixed read-only Git operations now return HEAD, bounded branches, selected-file status/diff, file history and selected-line origin commits. Uncommitted lines do not invent origins. GitHub trace retrieves bounded PR associations, reviews, timeline comments, same-repository referenced issues and check runs. Issue references remain textual heuristics, remote failures are explicit, and each request requires its scoped read grant. Git/GitHub write capabilities are distinct; neither adapter exposes a mutation method. VS Code GitHub sign-in and this chat's connector remain separate from product authentication.

**Final verification:** pnpm schemas, typecheck, lint, build, format:check and diff --check passed. pnpm test passed 44/44; pnpm test:integration passed 7/7. Real Git fixtures verify an unrelated newer file commit does not replace selected-line provenance, uncommitted origin handling, status/diff reads and write denial over stdio. Actual oAX selected offset code traced to local commit/blame evidence. Deterministic GitHub fixtures verify PR/review/comment/issue/check evidence, reference deduplication, redaction, session scope and read-to-write denial. Actual graph regression indexed 71 source files / 1243 symbols. Deterministic VS Code spatial acceptance also passed. Final eight-entry local VSIX SHA-256: 29f97973763dcc88f110496ade3cd3b6df90bd4d0d5cd9d3dd98294754bfa027; isolated installation and live editor acceptance passed. No acceptance harness is packaged.

**Remaining limitations:** M4 exit is verified for the supported saved single-selection workflow, not arbitrary commands or multi-file model editing. M5 selected-code local history exit and deterministic remote contracts are verified; live authenticated GitHub product/credential-UI acceptance still needs an explicitly configured read-only product connection. Pagination, OAuth/GitHub Apps and live-model historical narrative evaluation remain pending. The quality evaluation measures evidence correctness, not unmeasured model acceptance. Session review/audit remains memory-only. No general no-error, sandbox, full-platform or public-release claim is made. Next: verify live product GitHub evidence with a configured repository-scoped credential, then continue the next supported milestone.

**Source sync:** GitHub review branch codex/local-intelligence-preview is verified at 081c362933c9981907a166e363c66b47c68cb9c3. Its tree d51f14530cbce70c0e80ede51f3079bf2e253157 exactly matches tested local commit 7f6b62956b2dc108bc3bde6e2bc3a35861ebb339 (39 changed files). The non-force update preserves remote parent 86cdc3a6ae0db58a50cfb1fcdca7fc9e67632e17 and leaves main unchanged. No merge, credential/access change, publication or deployment occurred. The original untracked oAX-Complete.md attachment remains untouched. This delivery record follows as a documentation-only commit.

### 2026-10-02 — Milestone 6 Buddy exit verified; Milestones 1–5 rechecked

**Implementation:** Added the editor-independent `packages/buddy` projection and a native VS Code tree/status view. Sessions and providers are separate; actual task lifecycle remains authoritative. Completed provider items do not complete a task. Buddy shows real production prompts, observed activity, actual approved-edit receipts and the last observed review. Prompt clicks reopen the Cancel-default UI without accepting it. Location clicks recheck hash/version and preserve developer selection. Hiding Buddy affects presentation only. Source/test changes invalidate known results and clear cursor locations. Reconnect clears old projection state, and late connection failures cannot delete a newer connection. Runtime disconnection observers are separate from task rejection. Voice was assessed and deferred, with controls and acceptance requirements documented; no microphone capture or voice transmission is enabled.

**Milestones 1–5:** Final regression reconfirmed validated stdio/session/event exchange, unsaved spatial context, actual text tabs, graph relationships on this real repository, exact approved edits and real passing/failing Node verification, selected-line local Git history and deterministic GitHub PR/issue/review/check contracts. M4's real provider editor exit was rechecked in the final installed package. M5 live authenticated product GitHub evidence remains unverified and requires a configured repository-scoped product credential; VS Code account sign-in and this chat's connector do not establish it.

**Final checks:** `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm schemas`, `pnpm format:check` and `git diff --check` passed. `pnpm test`: 49/49. `pnpm test:integration`: 7/7, including real repository acceptance at 74 indexed source files / 1336 symbols. Normal `pnpm test:editor` passed native Buddy show/hide commands, continued execution while hidden, exact accepted cursor linkage, unchanged developer selection, changed-buffer invalidation and reconnect cleanup on VS Code 1.105.0. The final broad regression ran after the initialization deadline change.

**Live acceptance:** The final installed VSIX passed with `OAX_PACKAGED_TEST=1 OAX_LIVE_EDITOR_TEST=1 OAX_AUTOMATED_LIVE_EDITOR_TEST=1 pnpm test:editor`. Evidence: `.vscode-test/m4-live-xxEuCP/acceptance.json`. Actual Codex 0.159.2 produced the explanation and approved proposal; the actual production prompts were explicitly selected through VS Code commands by the excluded development harness. Real Node tests exited 0; current matching edit/test review was verified; Buddy had the matching completed task and verified result, no pending prompt, and developer selection was preserved. Only synthetic context was transmitted. This is real acceptance, not a provider mock or production approval bypass. The existing baseline host update-mutex warning did not prevent exit 0.

**Failures and corrections:** One new cursor test fixture omitted the required mode; it was corrected and all 49 tests passed. Initial concurrent real-repository acceptance hit the short control deadline; graph/context reads now have a bounded 30-second budget. A live check timed out at its unchanged five-second execution limit, and a sequential run exposed provider preflight exceeding the old 10-second initialization budget. Initialization now has 60 seconds; ordinary controls remain 10 seconds and historical reads 90 seconds. The harness surfaces early command failures immediately and records Buddy state on failure. Final sequential packaged acceptance and the full regressions passed. No failed run was treated as success.

**Packaging:** `pnpm package:local` passed the eight-file allowlist. Final `dist/oax-vscode-0.1.0.vsix` SHA-256: `d879b0ef5aa4ed5c08eff6186cd427aa2a55ca37b6013b3c68018994281885cf`. Isolated installation succeeded before live acceptance. The development harness is not packaged. The MIT license is unchanged. This remains an unreleased local VS Code/CLI preview.

**Remaining work:** Live scoped GitHub product authentication, manual screen-reader/usability assessment, broader languages, general multi-file model edits, persistent audit/retention, voice backend selection and later interfaces remain separate work. Buddy's retained verification is a last observed saved-file review; external changes require fresh review. The next concrete action is live GitHub evidence acceptance once a product credential is configured, followed by the next selected milestone. No full-platform, zero-error, OS-sandbox or release claim is made.

**M6 source sync:** GitHub review branch `codex/local-intelligence-preview` is verified at `bcbc50eca12ba48a2be1bbedbf6b9eb11cbe92d1`. Its tree `57c19a829d78f4734d7546f6e83365efe31aab97` exactly matches tested local commit `ddfc90bdc1cbc653d0a08e4d58f6d21a67158d1a` (20 changed files). The non-force update preserves remote parent `186873a0dd62bb04ff773d1fa65ea9970a8d2f29`. No merge, credential/access change, publication or deployment occurred. The original untracked `oAX-Complete.md` attachment remains unchanged. This sync record follows as a documentation-only commit.

### 2026-10-02 — Milestone 7 and first vertical-slice audit acceptance

**M7 implementation:** Added a versioned strict editor bootstrap schema, canonical narrow capability list and private read-only editor bridge over the existing RuntimeClient/Runtime. Requests validate workspace/session, correlation, versions, parameters, duplicate IDs, concurrency and payload limits. Neovim captures actual current unsaved text, document versions, visible text windows, end-exclusive visual selections and UTF-16 positions. It consumes actual ordered events without moving the developer cursor. Reconnection generation guards and close cleanup protect subsequent sessions. CLI doctor reports real toolchain compatibility without contacting a model. Desktop/web boundaries were evaluated; no new network listener or application is deployed.

**M7 acceptance:** Actual Neovim 0.11.5 headless acceptance passed unsaved semantic callers, a Unicode visual selection, actual runtime/mock lifecycle, unsupported-write denial, preserved cursor and cleanup. Direct-vs-bridge integration compares deterministic evidence and rejects invalid scope/parameters/duplicate IDs/future protocol versions. Portable tools and Gradle caches are excluded from graph discovery, context and packages. JetBrains Java action compiled twice directly with Java 21 against IDEA Community 2025.2.1 SDK, including bounded framing and session correlation. Gradle 8.14.3/platform plugin 2.9.0 reached compileJava but failed in the Java worker with Unable to establish loopback connection / Invalid argument: connect. No firewall, credentials or global configuration was changed. No JetBrains plugin ZIP or live IDE result is claimed.

**Release-gate gap fixed:** Production companions now inject an exclusive source-free JSONL audit sink. It persists grant/refusal, permission allow/deny and action completed/failed outcomes with scope, timestamps, monotonic sequence and hashed resource identity. Recording failures prevent subsequent execution. Journals are flushed and bounded to 4 MiB per process; grants remain memory-only. Tests prove post-close persistence, denied execution, outcome order, absence of raw resource/error content, refusal of redirected private directories and failure-before-execution when the sink closes. Retention is manual; Windows ACLs are inherited; no tamper resistance or OS sandbox is claimed.

**Live vertical slice:** Final installed VSIX acceptance passed on VS Code 1.105.0 using actual installed Codex 0.159.0-alpha.12.1. Evidence: .vscode-test/m4-live-6uHss9/acceptance.json. A three-file synthetic module/consumer/test repository verifies semantic cross-file caller evidence before Explain; bounded relevant context reaches the real provider; an accepted source-hash investigation cursor remains separate; a concrete impact summary accompanies the exact diff; actual Cancel-default write/test prompts are explicitly selected by the excluded development harness; approved edits preserve unrelated content; real Node tests exit 0; current review shows matching diffs/tests; 282 source-free audit entries retain grants and outcomes. Only synthetic context was transmitted. All listed vertical-slice steps are evidenced within the documented subset. Broader customer workloads and language/release gates remain open.

**Provider compatibility:** The first fresh live run correctly failed before transmission because the official installed binary now reports 0.159.0-alpha.12.1 instead of 0.159.2. Official App Server documentation was checked, experimental contracts regenerated locally, and initialization/thread start/turn start/interrupt/configuration/thread/sandbox/user-input contracts match the earlier generated contracts byte-for-byte. Only these two exact versions are accepted; unknown patch/alpha versions fail closed. Effective disabled tools, environments, MCP, instruction sources and context consent remain checked at runtime. The subsequent installed live workflow passed. This is experimental preview compatibility, not a wildcard or production certification.

**Checks:** Pinned Node 24.19.0 and pnpm 11.25.0 via workspace-local Corepack; typecheck, lint, build, schemas and formatting passed during the slice. Unit suite: 52/52. Integration suite: 8/8, including actual oAX at 80 source files / 1413 symbols. Neovim acceptance passed after audit integration. Normal VS Code Buddy regression passed before the audit addition; final live installed acceptance covers the updated runtime. Initial non-escalated checks failed due sandbox dependency discovery/Node user-info restrictions, before tests executed; authorized pinned-toolchain checks then passed. Final package/format follow-through and source sync are recorded below after completion.

**Voice and polyglot status:** Voice was assessed in M6, not implemented; the user's request explicitly places it on the implementation backlog. No microphone capture or deployment is enabled. Java is used for the compiled adapter, while Python/Java/Go semantic workers remain unimplemented. docs/polyglot.md defines a shared schema/snapshot/evidence boundary rather than claiming support from language names. Continue with actual JetBrains packaging/IDE acceptance, a scoped additional-language parser slice, live product GitHub authentication and voice backend/control acceptance. The local preview is not the entire platform or a public release.

**Final review corrections:** An attempted adapter-response session field was rejected by the existing strict protocol 0.1 schema. It was removed: the Java client now checks correlation/workspace on its session-owned connection, while requests/events carry session identity. A regression assertion preserves that contract. The newly added JetBrains cache exclusion initially used mixed case even though discovery compares lowercase names; the actual fixture caught it and the exclusion was corrected. Subsequent typecheck/lint/build and all 52 unit tests passed; final integration/Neovim outcomes follow. These failed attempts were not treated as acceptance.

**Final verified snapshot:** After the response-contract/cache corrections, typecheck, lint and build passed; 52/52 unit tests and 8/8 integration tests passed, with this actual repository at 81 indexed source files / 1418 symbols. Actual Neovim acceptance passed again. Direct Java SDK compilation passed after the final contract correction. Formatting and diff checks passed. The final eight-entry VSIX SHA-256 is 81b5a49d6b2e2eec15f687c3c6df414168b0557144b092094d63ba2ff70ad00d. Isolated installation succeeded and the exact final package passed actual Codex -> native approval -> edit -> real Node tests -> current diff review with cursor, impact and audit assertions on VS Code 1.105.0; evidence .vscode-test/m4-live-TDTHiL/acceptance.json. Two preceding multi-file live acceptances also passed (.vscode-test/m4-live-6uHss9 and m4-live-hHR3oh). The last normal installed Buddy/spatial regression also passed. Only synthetic context was transmitted; no unrelated source was edited or credentials changed. This is an unreleased local preview, not deployment.

**Verified source sync:** Review branch codex/local-intelligence-preview is at be39dea78e960398165ee9bb782f800a8555d24b. Remote tree 1ca3e1001b9bb63bd6425df1bcb4377510a89727 exactly matches tested local commit 3411e092aa3f5fb0c956ccadd862922051683ccd (45 reviewed files). The non-force update preserves parent 74cf70d070b98d45a2342fd6159a495576d7aea6 and leaves main untouched. MIT blob ed15f3baa74f98072ea443230ff29686eec8fe39 is unchanged. The original oAX-Complete.md attachment remains untracked and untouched. Tool downloads, SDK caches, audit data, acceptance workspaces and packages are excluded from source sync. No merge, publication, deployment, credential or access-control change occurred. This delivery record follows as a documentation-only commit.

## Shared surfaces and browser planner checkpoint — 2026-10-02

**Implemented:** Revalidated pinned Chrome DevTools MCP 1.10.1 with dedicated Chrome 154.0.8037.92. Installed official Jev 0.1.0 at commit 1231850a0bf1a0c0341fe408ef1668dbbfdfac46, archive SHA-256 61e3edab5be79a857647660bd24e60127b9a5881d71cf81f2c7d98bd99202b9d, Python 3.12.14 and workspace-local uv 0.12.22. Frozen wheel-only dependencies are installed without the upstream build backend, browser daemon or provider requests. Extracted source/lock integrity and execution-time committed source hashes are verified. A bounded Python worker exposes local action-space inspection and separately approved TypeSafe proposals; it never constructs upstream Agent/Browser or executes a choice. Chrome snapshot projection uses observed accessibility UIDs and checks the actual URL. Browser and provider-context permissions have durable metadata-only audit records.

**Shared interface:** Added a real local web workbench over the existing RuntimeClient/protocol and graph: saved source, versioned selection, symbol identification, semantic callers, bounded context preview, history, onboarding, public events and review reads. Strict loopback Host/Origin, one-use bootstrap, HttpOnly SameSite cookie, CSRF header, CSP, payload limits, read-method allowlist and scoped owned session are enforced. Source reads use bounded handles and identity/freshness checks; changed saved snapshots must be reopened. Added a dedicated Chrome app-window launcher over that same interface; native desktop GUI acceptance and signed/cross-platform distribution remain pending. IDE/CLI behavior and core protocol 0.1 are reused, not duplicated.

**Verified:** corepack pnpm typecheck, lint and build passed. pnpm test passed 56/56 tests. pnpm test:integration passed 9/9, including a real runtime-backed workbench graph query and rejection of missing authentication, cross-origin requests, replayed bootstrap, traversal, write/model routes and stale snapshots. After final handle hardening, the focused workbench integration passed again. Actual repository evidence at the integration checkpoint: 91 indexed source files / 1583 symbols. pnpm test:jev passed 31 pinned upstream offline tests plus the actual installed Python action-space round trip and tampered-source rejection. pnpm test:browser-jev passed actual Chrome → MCP → observed action-space → Python, plus denied grants, out-of-origin navigation/redirect/subresource and file-output checks. All these checks avoid live TypeSafe requests. The installer was rerun successfully against the pinned archive/frozen environment. Formatting and diff checks passed before final documentation updates; final checks follow below.

**Browser evidence:** The actual local workbench connected to its owned runtime, loaded packages/context/src/index.ts, selected export function offset (positions 137:0–137:22), returned semantic callers and an inspectable ContextSlice. Selection offsets 3591–3613 stayed unchanged. Screenshot evidence is ignored local .oax/workbench-acceptance.png. This is functional repository inspection, without fabricated model answers or activity.

**Limits and next actions:** Configure a TypeSafe credential locally and authorize exact disclosed context/usage before live Jev prediction acceptance. No browser input or unrestricted upstream automation is enabled. Browser source-map/fix-verification integration remains pending. Desktop launcher needs native-window acceptance and distribution work. GitHub App installation/webhooks/review posting and enterprise identity/isolation/hosting remain unimplemented; current GitHub reads still need live product credentials. Voice and Python/Java/Go semantic indexing remain tracked work. The supplied guidance was treated as design/security input, never runtime authorization; Taste excludes this dashboard surface and Brandit's image-board workflow was not requested. See docs/jev.md and docs/surfaces.md. This checkpoint is an unreleased local preview, not the completed full platform.

## Desktop distribution, Vim, Chrome and PWA acceptance — 2026-10-02

**Scope and review:** The user selected local desktop distribution first, then requested a complete integration/gap review, Vim/Vimium, Chrome extensions, a functional PWA, AppDeploy publication and GitHub sync. Read the supplied Repository Integration Guide and official upstream sources. docs/integration-audit.md records existing equivalents and unresolved gates; recommended libraries were evaluated instead of importing unrelated repositories or adding unused duplicate dependencies. Existing MIT and the unrelated oAX-Complete.md attachment are preserved.

**Desktop:** Built a portable Windows x64 distribution with official checksum-verified Node 24.19.0, shared runtime/graph, licenses, workbench assets and explicit separate Chrome setup. Exact final ZIP: dist/oax-desktop-0.1.0-win-x64-1790958594428.zip; SHA-256 ccd4d49416aee43c8a735bb8358cf3b21d2c23a9274535b57a10627d0805ba96. pnpm test:desktop passed all 22-file hashes/allowlist, bundled Node, relocation with spaces, real graph query, denied writes, setup consent, actual Chrome app authentication, profile removal and listener cleanup. Evidence: dist/desktop-acceptance.json. It has no signed installer/auto-updater or cross-platform certification. Git is optional for structural reads and required for history. Desktop live provider/editing remains available through the separate existing IDE/CLI surfaces, not this read-only window.

**Sandbox repair and consent:** The first actual desktop check exposed Chrome sandbox executable access denial. The user explicitly approved the checksum-verified setup.exe --configure-browser-in-directory operation only within downloaded, owned desktop acceptance/install folders. No repository ACL, personal profile or sandbox-disable flag was changed. Chrome setup returns 78 even after applying the required rights, a behavior documented by the installed official Puppeteer source. Verification reads every downloaded file/directory's pinned sandbox capability SID read/execute rules before launch. An inherited PowerShell 7 module path initially prevented Windows PowerShell's Get-Acl from loading; direct read-only .NET ACL APIs fixed this. Final actual desktop acceptance passed. Failed runs were not counted as passes.

**Vim and browser additions:** Installed official signed portable Vim 9.2.1162 (release ZIP SHA-256 19e29e7ade92a22d384928c92f11127166835c2ac5cefcebdd6fd3928174a0f7), preserving global PATH/vimrc/registry. Added a bounded read-only Vimscript adapter over the existing protocol/bridge. pnpm test:vim passed actual runtime callers from an unsaved buffer, UTF-16 including an emoji, actual visible windows rather than cached buffers, preserved cursor, unsupported-write rejection and cleanup. Initial tests caught unsupported strftime UTC arguments, a reserved Vim local name and numeric JSON booleans; all were corrected and rerun. Vim visual selection/cursor decorations/live provider behavior remain open; the accepted current capture is a cursor point.

Pinned Vimium 2.4.2 commit eb737abdd65b070c05ef06d39f1d78751aa7f738; archive SHA-256 9826655443cb2f544f81577884679f6df30355c9a2f6dfc2609f1d2bdad454c8. Every extracted upstream file is checked before loading. The dedicated .oax/browser-addons-profile contains enabled actual Chrome registrations for Vimium and the oAX Manifest V3 launcher. pnpm test:browser-addons passed registration checks; an initial dump-DOM timeout was handled with bounded owned-process cleanup and explicit registration acceptance, not claimed as an interactive Vimium test. This does not modify or prove personal-profile installation. The launcher requests no host/content/history/storage permissions and validates exact loopback links. Chrome ZIP: dist/oax-chrome-0.1.0-1790957480099.zip; SHA-256 f724cbb05ffdfbcd9e76d57f80b8591315a4ac7ea9c16a7dade6e1778cc49fc2, five files. Web Store publication remains unperformed.

**PWA:** The local workbench now has a standalone manifest, standard code-generated 192/512 PNG icons, authenticated reload/resume, export disclosure and a static-only offline shell. Private requests, source, context, cookies and bootstrap URLs are never cached. The separately published AppDeploy PWA is https://oax-evidence-viewer-xvokez.v2.appdeploy.ai/ at snapshot 1790958191826. It validates actual exported ContextSlices, renders untrusted evidence as text, reports freshness/provenance limitations and keeps imports in memory. Actual browser acceptance verified valid import/rendering, rejection of permission-shaped invalid JSON, clear and reload loss of input. Final deployment status ready; QA/frontend/network/backend error arrays empty. Six actual public assets were fetched, PNG/manifest formats checked and hashed in apps/evidence/deployment.json. No private repository excerpts or attached ZIPs were published. The hosted viewer owns no agent session, model call, write approval or local-runtime access.

The first AppDeploy build rejected the public module entry; it was corrected to a deferred public script. Actual browser checking then exposed the bundle's global location name collision, which caused repeated navigation and was absent from initial deployment status. The browser bundle is now an isolated IIFE; a regression executes the built artifact with a protected location property. The corrected public browser workflow passed. Screenshot evidence is local ignored .oax/pwa-acceptance.png. Browser-native install/offline menu interaction is not separately claimed; manifest/icons/service-worker implementation and deployed assets are verified.

**Final regression:** Pinned toolchain typecheck, lint, build, schemas, formatting and diff checks passed. pnpm test: 59/59; pnpm test:integration: 10/10, including actual runtime export compatibility, cross-origin/resume guards and browser-global isolation. Real repository: 110 indexed source files / 1786 symbols. Actual Neovim 0.11.5 acceptance passed again after configuring its required absolute executable (the first unconfigured invocation correctly refused to run). Normal VS Code 1.105.0 selection/spatial/Buddy/graph/mock acceptance passed; baseline mutex and built-in GitHub-provider startup warnings did not prevent exit 0. The new eight-file VSIX SHA-256 is 4ad25578ad0ce41ba8eda00c4c583eccbcbeaedd220f2a5fbdbe7d9a70df0799. Prior installed live Codex acceptance remains the evidence for live editing; no additional model request was made this slice. Actual Chrome → pinned MCP → Python Jev observation acceptance passed again, with origin and grant denial checks. Earlier pinned Jev offline acceptance passed 31 upstream tests and source-integrity rejection; live TypeSafe remains unverified.

**Remaining gates:** The full platform is not complete. Live repository-scoped product GitHub credentials, GitHub App/webhooks, voice, Python/Go/Java semantic indexing, general multi-file model edits, JetBrains packaging/live IDE use, enterprise identity/isolation/hosting, signed installers and broader real customer acceptance remain open. The next concrete slice is scoped live GitHub history acceptance when product credentials are configured, followed by the separately specified voice/backend and language gates. docs/integration-audit.md distinguishes intended, implemented, tested and released behavior. Source sync follows after the final commit/tree check.

**Verified delivery:** Remote review branch codex/local-intelligence-preview is at 7633b3fc119b925d8354ae169311e7e41e0a32d0. Its tree 72b4e6169eb96462e07915f2b19fb2b7cb16d43a exactly matches tested local source commit 114e86fb13e844c5475ec7dba832d6e29ec00e3c (66 reviewed files). The non-force update preserves remote parent 9dfd9f3f39067ce5a4675d540cbb7cd10dcf3ed3 and leaves main untouched. MIT blob ed15f3baa74f98072ea443230ff29686eec8fe39 is unchanged. The original oAX-Complete.md remains untracked and untouched. Downloads, private profiles, acceptance fixtures, runtime data and generated packages remain excluded from source sync. The explicitly requested public PWA deployment contains only public viewer code/assets, with its actual version/hashes committed separately. This delivery record follows as a documentation-only commit.

## Platform overview, Clicky reference and shared desktop Buddy — 2026-10-02

**Scope and documentation:** Replaced the narrow README introduction with the complete-platform vision, explicit interface support matrix, separate local/managed/hybrid/self-hosted deployment direction, and accurate Python/Java/Go status. Corrected stale architecture/security statements claiming no TCP surface, no deployed viewer and no persistent audit. The source remains a verified subset, not universal IDE compatibility or an enterprise release. Main README now points to the current implementation branch while labeling its older merged source; documentation-only GitHub commit b732a4f5fa6ca8dea382c053e2c22092dbffc87f preserves all main source files and the MIT license.

**Clicky:** Inspected upstream source, README, MIT license, companion/pointing/dictation architecture and the supplied archive. Installed 85 reference files at official commit a80fa80721a8aebe51a170a7780705024ebc6e46, archive SHA-256 a629892821a7f85122de86cc2a36738f2db7a2befe349e9259ef1f1c7272171b. scripts/setup-clicky.py verifies hashes, bounded paths and existing contents without running upstream code. Reinstallation succeeded; all 85 supplied-archive files match the official snapshot byte-for-byte. Native Clicky requires macOS 14.2+/Xcode and separate speech/chat services, so native Windows installation is unavailable. No proxy, analytics, microphone, screen capture or upstream updater was launched. docs/clicky.md maps reviewed concepts to implementation and remaining gates.

**Adaptation:** Local workbench/portable desktop now share BuddyStore with VS Code. Actual inspection start/completion/failure receipts stay distinct from agent lifecycle, permissions, verification and cursor evidence. Authenticated polls and RPC receipts use monotonic presentation revisions to prevent out-of-order regression. Hide/show stays available during work and changes only visibility. No model coordinates or human selections become agent locations. Real browser acceptance opened packages/buddy/src/index.ts, ran repository onboarding, observed running/completed receipts, hid/showed Buddy during work, preserved source selection, and resumed an authenticated session on reload. Screenshot: .oax/clicky-buddy-acceptance.png.

**Checks:** Pinned Node 24.19.0/pnpm 11.25.0 build, typecheck, lint and formatting passed. Unit suite: 60/60. Existing integration suite: 10/10; added delayed-poll/visibility UI regression passed separately (11 integration cases total). Actual repository: 110 indexed source files / 1809 symbols. pnpm test:jev passed all 31 upstream offline tests, real Python round trip and altered-source rejection. pnpm test:browser-jev passed actual Chrome DevTools MCP 1.10.1 -> bounded snapshot -> pinned Jev worker, including origin/grant/file-output denial. No live provider request was made. Product GitHub/TypeSafe credentials remain separate from chat connector access.

**Packages:** pnpm package:desktop and pnpm test:desktop passed with 22 exact files, bundled Node, relocation, real graph, denied writes, explicit pinned browser setup, real app authentication and owned cleanup. ZIP: dist/oax-desktop-0.1.0-win-x64-1790965938716.zip; SHA-256 609eed5c8165de485134327c073d622813498881af27fc21c698e9e49ad9d45c. The owned Chrome process reported code 1 during intentional teardown; the recorded acceptance verifies authentication and cleanup, not a normal interactive exit-code claim. VSIX packaging passed the eight-file allowlist; SHA-256 4dde25a821be41b0552a0b36ed931da019d22ed4a37db74255a5addeedb7285c. Prior installed live Codex and editor acceptance remains the evidence for those workflows; it was not rerun this slice. Public evidence viewer was unchanged and not redeployed.

**Open work:** Complete voice input/output, live product GitHub authentication, GitHub App posting/webhooks, general multi-file model changes, JetBrains packaging/live acceptance, additional-language semantic workers, cross-platform signed desktop distributions and enterprise identity/isolation/operations remain open. Clicky-inspired desktop presence is the first adapted feature, not all of Clicky ported to Windows. The next connected implementation is a separately specified voice capture/transcript-review/provider boundary and acceptance, alongside the existing scoped history and language gates. Do not mark the complete platform finished. Original oAX-Complete.md remains untouched and untracked. Source sync follows after commit/tree verification.

**Verified Clicky/Buddy delivery:** Source commit b3e51624447947fabe45b31a9a652644ed4e1c80 and GitHub review-branch commit 5b7e290ed6888c388ba0e2e3d3a43bc772c9732c share exact tree 6a6c97764c0073b8777257c4831265eb5abbbcf7 (15 reviewed files). The non-force branch update preserves abfb4e5521b82e46fb7b3e5fd20b70f89e15242a. Separately, main received only the explicitly requested README overview at b732a4f5fa6ca8dea382c053e2c22092dbffc87f; the implementation is not silently merged. MIT and the untracked original attachment are unchanged. This sync record follows in a documentation-only commit.

## Shared knowledge, browser voice controls and legal pages — 2026-10-03

Implemented a separate authenticated AppDeploy knowledge service at https://oax-shared-knowledge-omcqtl.v2.appdeploy.ai/ (snapshot 1790984804420): identity-bound reader/contributor invitations, owner revocation handles surviving reloads, append-only findings/questions/decisions, canonical spatial evidence exports, source-free WebSocket invalidations and reauthorized reads. Optional browser dictation creates reviewed drafts; local-voice read-aloud has a typed fallback. Draft Terms/Privacy describe actual data flows and unresolved operator/retention details. The existing evidence PWA links to this service without transferring source; snapshot 1790985172068. Both deployments report ready with empty QA/frontend/network/backend error arrays; no E2E execution result was returned.

Verification: pinned pnpm typecheck, lint, build and format:check passed; unit tests 63/63, integration tests 11/11. Real repository acceptance indexed 119 files / 1990 symbols and verified callers/importers. New actual backend-handler tests use injected SDK fixtures for authentication, authorization, invitation revocation/listing, concurrent writes and source-free notifications. Voice tests use a mock speech API and verify consent/cancellation. No live model or microphone request was made. Actual browser Terms/Privacy navigation passed. The embedded browser did not open the sign-in popup; the owner subsequently confirmed reaching Your repositories through the real external-browser login. That is user-reported sign-in evidence, not automated room persistence or two-user acceptance. Direct /api/\_healthcheck on the public static hostname returned the frontend fallback and is not counted as backend verification; product calls use the SDK transport.

Current boundary: hosted sharing exchanges reviewed evidence, not automatic IDE pairing, shared agent execution or local approval grants. Live room persistence, two independent accounts, microphone/speaker and GitHub credential acceptance remain pending. Broader-language semantic indexing, universal IDE support and full enterprise operations remain open. Original untracked oAX-Complete.md is preserved. The user has now requested a further visual redesign, screen understanding, polyglot functionality and investigation of visible red failures; this work continues after this verified checkpoint.

## Connected workspace, syntax workers and authoring — 2026-10-04

Implemented and deployed a redesigned workspace with separate Knowledge, Screen lens, Team access and GitHub panels. Fixed stylesheet ordering that removed button padding. Screen lens captures one selected display/window/tab frame, stops capture, previews a bounded image and requires explicit transmission approval. AppDeploy AI returns structured observations and uncertainty; it does not establish exact code locations. Analysis becomes a draft only by user action. Socket waits are bounded; saved room reads remain available through Refresh. Storage quota errors retain HTTP 429 without retries. Snapshot `1791035575618` reported ready with empty frontend/backend/network error arrays; the actual signed-out interface was visually inspected and captured. No E2E execution result or live microphone/image-provider/two-user acceptance is claimed.

Python AST, Go parser and Java 21 compiler-tree workers now feed the existing transactional SQLite graph. Actual three-language acceptance passed through the built authenticated stdio runtime: declarations, caller candidates, UTF-16/emoji, ignored comments, unchanged snapshots, unsaved replacement, syntax failures and deletion. File-local unique-name callers are heuristic; imports and ambiguous calls remain unresolved. Explicit application/global tool paths cannot be selected by repository workspace settings. Additional-language semantic refactoring is not implemented. See `docs/language-workers.md`.

Before final documentation, pinned typecheck/lint/build passed; unit tests passed 64/64 and integration tests 11/11 (actual repository: 132 files / 2081 symbols). New parser-path rejection and quota regressions were added afterward; final results follow. Actual VS Code 1.105.0 passed selection/runtime/graph/mock response, Buddy/cursor and preserved selection. The editor host logged a GitHub authentication-provider startup timeout while oAX acceptance exited successfully; that does not establish product GitHub authentication. Neovim initially lacked its required executable setting, then actual 0.11.5 acceptance passed after configuration. Actual Vim 9.2.1162 acceptance also passed.

GitHub audit found run `37114397034` failed at Prettier on misplaced `workflows/deploy-pages.yml`; the owner had already removed it, and subsequent main run `37114834123` passed. No workflow was disabled or shared history rewritten. Main `f914fa7a34a62dc53b73af75b2b8e9796ebeab53` and review branch `47e9c8963ce9b44a78525d81e8b74f038d161626` were inspected before delivery.

Installed Ponytail source (169 verified files) and official Codex coding/review skills at revision `c982cd411abb53323c4baa1baa3c2f020b8d0b08`. Applied its reuse/standard-library guidance while retaining required validation and approvals. Installed OpenMontage source (2115 verified files) and its locked 199-package composer separately. Upstream licenses remain intact; oAX remains MIT. No automatic hooks, cloud media providers or OpenMontage server were enabled. Original product-video scenes use local narration and an actual public app capture; render verification follows. `docs/authoring-resources.md` records setup and the design-resource audit.

An approval-service usage limit interrupted the final package/install command before execution and the running render did not leave a completed MP4. Work resumed on October 4; no interrupted operation was treated as successful. Remaining release gates include independent-user sharing acceptance, live GitHub credential/microphone/image-model checks, automatic cross-device pairing/shared agent invocation, JetBrains live packaging, universal IDE support, broader semantic analysis and enterprise operations. Original untracked `oAX-Complete.md` remains untouched.

**Final delivery evidence:** Typecheck, lint, formatting and diff checks passed. Six targeted tests passed, including new relative-parser-path rejection and real handler quota reporting. The earlier 64-unit/11-integration regression remains the full-suite evidence; the new integration case raises the available integration cases to 12. The eight-file VSIX SHA-256 is `4443ab4750180fe3f28235b8904fae2dc3f7b7686cda0b555500ce893678c73d`; installation into the user's VS Code succeeded and `oax-dev.oax-vscode@0.1.0` was listed. Portable ZIP `dist/oax-desktop-0.1.0-win-x64-1791071947594.zip` SHA-256 `01a070ea536d1672572be4ff9a53d76fe622fcef82a4fa1d875e4dd24c8d96c8` passed 22-file integrity, relocation, actual graph, denied writes, owned browser authentication and cleanup. Chrome reported code 1 during intentional teardown, not a startup failure.

OpenMontage rendered all 1800 frames successfully. Final `dist/product-video/oax-product-video.mp4` is 1920×1080 H.264 at 30 fps with AAC narration; video track exactly 60 seconds, container 60.010667 seconds including audio padding. SHA-256: `e169639029d324652a90d8c70591df759a1edfe2ddf7a2f48278c71cfd927914`. Subtitles: `dist/product-video/oax-60s.srt`. Original scene cards and an encoded frame were visually inspected. This is a narrated workflow overview with illustrative code and an actual public app screen, not fabricated live acceptance. GitHub PR #3 had a README conflict; the main-only delta was verified to be README.md, and delivery retains its product overview while updating the supported scope. Source synchronization and CI are checked after this commit.

## oAX1 backbone verification — 2026-10-04

The ideation documents, Desktop\oAX tree, and the supplied archives are the oAX1 inputs. The implementation backbone stays this repository on local `master` at `42a7148`. No second copy was created. Existing uncommitted `scripts/setup-resources.py`, untracked `oAX-Complete.md`, and untracked `scripts/prepare-square-videos.py` were left unchanged. Git fetch/pull was not run.

Pinned Node 24.19.0 and workspace pnpm 11.25.0: `typecheck`, `lint`, `format:check`, and `build` passed. Unit tests passed 64/64. Integration tests passed 12/12, including actual repository indexing. Editor, Neovim, Vim, desktop, browser, and live Codex acceptance were not rerun in that check.

Follow-up confirmation the same day: `python scripts/setup-clicky.py` rechecked all 85 files of farzaa/clicky at `a80fa80721a8aebe51a170a7780705024ebc6e46`, which is still GitHub HEAD. `chrome-devtools-mcp` resolves at 1.10.1, and the Grok plugin of the same version is installed. `pnpm test:jev` passed 31/31 plus the pinned Python action-space round trip; browser-use/jev-ultrafast `1231850a0bf1a0c0341fe408ef1668dbbfdfac46` is still GitHub HEAD. `pnpm test:languages` passed actual Python, Go, and Java parsers. `node dist/cli.cjs doctor` reported protocol 0.1 on Node 24.19.0 and did not contact a provider. `git ls-remote origin` returned repository not found for the signed-in `elijahmoses1000-jpg` account against `Elijah-MosesX/oAX`; no credential or remote was changed. Open release gates remain open.

## Original-vision realignment and integrated delivery — 2026-10-10

Read both supplied PDD ideation documents and reconciled their persistent, spatially aware workspace-participant vision with actual source. `docs/product-alignment.md` records the gaps and dependency order; `docs/getting-started-workflow.md` gives supported installation and selection-to-review steps. The shared hosted desk supports the product; it does not replace the runtime/context/graph/permission core or prove universal IDE support.

Restored the interrupted work from the preserved auto-stash onto `codex/realign-context-delivery`, above existing rename-metadata and watcher/test-cleanup fixes (51c294e and 58fe4f8). Context now selects objective-prioritized callers, direct dependencies, imports and tests with exact UTF-16 ranges, resolution grades, snapshot-hash freshness, explicit omissions and the existing transmission budget/consent hash. Removed a restored diagnostic-only raw internal-error disclosure; expected domain errors retain their codes. Included the saved Chrome launcher link to the separately deployed oAX1 desk without adding host/content/history/storage permissions. Original attachment and temporary diagnostic files remain uncommitted; the stash remains recoverable.

Verification on Node 24.19.0 / pnpm 11.25.0: typecheck passed; unit tests 67/67; integration tests 12/12, repeated successfully against the rebuilt runtime. Lint of production packages/services, Chrome adapter and changed tests passed; formatting of delivery files and diff checks passed. `node scripts/test-editor.mjs` passed actual VS Code 1.105.0 unsaved selection → runtime → graph → mock response, semantic callers and unchanged selection. The editor logged authentication-provider/startup/marketplace network warnings; these are not product GitHub-authentication evidence. No live model request was made.

Build and eight-file VSIX packaging passed. Installed `dist/oax-vscode-0.1.0.vsix` successfully; SHA-256 `f2b16e0e1795d1166ec3f70883451a7d7ff400f08a8ba0e51ef96945ed66ddf9`. Chrome five-file package: `dist/oax-chrome-0.1.0-1791645588067.zip`, SHA-256 `ce2c4b34c18d1fcaf277b426e6a0ce93a278cbf8b66fedb67008c782f47b941b`. Older portable desktop archives were not rebuilt in this slice.

Installed pinned Hyperframes/Brag authoring resources and completed four original 20-second 1080×1080 / 30 fps H.264/AAC workflow films. Each has 600 frames, a selected poster and original synthesized score. All four passed full decoding and format checks; posters and composition frames were visually inspected. Hyperframes checks passed with nonblocking timeline-organization warnings. `docs/video/square-verification.json` records hashes; source-generation and verification scripts plus isolated npm lockfile reproduce the authoring workflow. Illustrative code/data are labeled and the films do not stand in for live product acceptance.

Both AppDeploy apps reported ready with empty returned frontend/backend/network errors on October 10; QA screenshots were from earlier deployment snapshots, not new E2E runs. No hosted source changed or redeployed in this slice. The user confirmed two distinct accounts signed in, exchanged test posts automatically without Refresh, and retained both after reload. This is user-observed live synchronization/persistence evidence, not an agent-observed browser run. Browser automation could not initialize because the local sandbox helper reported setup refresh errors; the approved command fallback allowed source work to continue. Revocation acceptance is being checked separately. No account email is committed.

Open release gates remain: integrated historical context and validated memory, complete second-editor agent workflows/universal IDE support, automatic cross-device agent orchestration, enterprise controls, and live microphone/screen-model/product GitHub-authentication acceptance. Next implementation follows the connected-understanding sequence in the alignment document. GitHub synchronization follows this verified checkpoint; no complete-platform claim is made.

## Desktop shutdown fix and final synchronization — 2026-10-10

The combined implementation was synchronized without force to GitHub review commit `321c287ef48bdd0235333b42a4d1a54f0c83585f`, matching local `07c691c9f53e5c12fa620a2e686be6567d1bed3a` at tree `14b54d8813f5f3697998ac7210d7184de60a5436`. Push run 38063570869 and PR run 38063574334 both passed Windows and Ubuntu checks. Main remains unchanged and PR #3 remains open for review.

Follow-up actual Neovim 0.11.5, Vim 9.2.1162 and Python/Go/Java parser acceptance all passed against the rebuilt runtime. Desktop acceptance exposed an IPC shutdown race: a late status report attempted to use a closed parent channel. The workbench now checks connection state, handles the send callback, and reuses one cleanup promise. The acceptance harness retains bounded/redacted stderr and preserves the original failure when cleanup also fails. Typecheck, focused lint/format checks, build and the actual desktop regression passed after the fix.

The refreshed Windows archive is `dist/oax-desktop-0.1.0-win-x64-1791646682997.zip`, SHA-256 `b53ac61d0b3e5085c636a9426f18f2a787ef1775d82871a3b3d051cb5c8ebf7d`. Acceptance verified 22 exact files, bundled Node, relocation, real graph, denied writes, scoped browser setup, actual app authentication and profile/listener cleanup. The owned Chrome process returned code 1 during intentional teardown; the workbench and acceptance process exited successfully. Earlier failed candidate archives are not the delivered artifact. No live microphone, image-model or product GitHub-credential test was performed. Two-user synchronization/persistence is user-observed; the reply confirming both memberships did not establish revocation, which remains open.

## Connected historical intelligence — 2026-10-11

Implemented opt-in local Git and GitHub historical excerpts alongside selected code and deterministic graph evidence in the inspectable ContextSlice. Added `context.history.v1`, optional history scope on preview/explain, VS Code **Explain Selection with History (Codex)** and CLI `explain <path> --history`. Existing code-only behavior remains available. Historical excerpts carry source/evidence hashes, references and truncation; the total serialized budget remains 16,000 bytes. Saved-source and HEAD freshness checks prevent stale consent; GitHub reads require a same-session approved repository connection, scoped grants and a bounded five-minute inspected snapshot. Shared posts are not imported as verified memory.

Validation: full unit suite 69/69 and integration suite 12/12 passed against the built runtime, including real Git/CLI fixtures, missing/stale consent, disconnect/session isolation, redaction and source changes during retrieval. Typecheck and focused lint passed. Actual VS Code 1.105.0 regression passed unsaved selection, graph/mock response and preserved developer selection; its GitHub authentication-provider startup timeout remains a separate product-authentication gate. New history dialogs were not driven interactively.

Installed Codex 0.162.0-alpha.2 initially failed the exact-version guard. Generated contracts were inspected before adding this exact version: consumed contracts match, except an unused TurnStartParams comment. Unknown versions remain rejected and effective tool/environment restrictions remain enforced. The authorized real synthetic history test then passed: missing consent denied, approved context transmitted, streamed answer cited the actual commit and distinguished evidence from inferred intent. Receipt: dist/history-live-acceptance.json. No private repository content was sent. Three provider RPC/version regression tests passed after this update.

The prior approval-service usage limit interrupted final formatting/packaging; the work resumed October 11. Updated eight-file VSIX packaging passed. Final source synchronization follows this checkpoint; hosted apps were not changed or redeployed. Persistent validated memory remains the next implementation: evidence-bound review/validation, freshness invalidation and explicit retention/deletion before retrieval. Universal IDE workflows, cross-device agent collaboration, enterprise controls and live microphone/screen/product GitHub authentication are not marked complete.

Final resumed checks: typecheck and focused lint passed. A nominal-class identity conflict in the language acceptance test was fixed by using the indexer's existing default parser instead of constructing the same class through a second import path. Real Python/Go/Java acceptance passed afterward. Initial sandbox attempts denied fixture realpath and VS Code directory access; normal-user checks passed and the updated VSIX installed successfully. VSIX SHA-256: 8f74376d3280cbf0f34efd21ff9bef475a517a6d17fa4e792cbd28031ae4bf38. Packaged contents and diff checks passed; no Marketplace publication occurred.

## Reviewed local memory and Windows cleanup — 2026-10-11

Checked the prior connected-history CI runs 38125192651 and 38125189846: they failed, so the earlier pending-CI checkpoint is not a passing remote result. The Windows unit job reported EBUSY while deleting the Node-verification fixture after cancellation. Execution now waits for its Windows taskkill operation as well as child close before settling; owned fixture removal has bounded retries for transient filesystem locks. The real cancellation regression and full local suite passed after the fix. No test or CI gate was disabled.

Implemented the next connected-intelligence slice: memory.prepare/save/list/delete, the memory.reviewed.v1 capability, versioned schemas and optional memoryIds in context preview/explanation. A candidate previews a redacted note, source/range, workspace hash, expiry eligibility and disclosure. Exact same-session review approval is required for persistence. Saved notes are local untrusted, human-reviewed claims; source hashes are evidence links, not semantic proof. Explicit selection includes them in the existing bounded context and separate transmission hash consent. Source changes, expiration, excluded/missing files, copied workspace state and deletion prevent retrieval. Save/delete use the existing audited workspace-write boundary.

CLI now supports memory save (preview first, then --approve), memory list, memory delete with exact record hash, and explain --memory <id>. This is a complete local review/save/reload/use/delete workflow. Store limits: 16 records, 12,000 bytes per saved record, 2,000 note characters, 1–90 day context eligibility, five selected IDs. Expiration does not silently erase files; explicit deletion is documented. A cross-process exclusive lock rejects concurrent operations and interrupted-writer state, with manual crash recovery documented. No team ownership, encryption, tamper-proof validation or automatic model/hosted-note ingestion is claimed.

Checks: build, schema generation, typecheck and focused lint passed. Unit suite 72/72; integration suite 12/12, including real CLI persistence/approval/deletion, stdio workflows and oAX self-indexing. New tests cover wrong/cross-session/replayed approvals, redaction, stale source/save, expired review/records, copied workspaces, linked directories, writer locks and deletion. No live model request was needed. Updated eight-file VSIX packaging passed; SHA-256 2a57dbb438083440fea5e2b099198de85ba457dfc7c372bb01f64f93289fcf33. Editor memory dialogs are not implemented; CLI/protocol are the supported memory surfaces in this slice. Existing desktop archives and hosted deployments were not rebuilt/redeployed.

Next: expose this reviewed-memory workflow in editor/Buddy controls, then add evidence-based relevance selection before expanding team memory and the subsequent IDE/collaboration phases. Product GitHub authentication, voice/screen acceptance and enterprise/distributed controls remain open. Source sync and new remote CI results follow this checkpoint.

## Editor and Buddy reviewed-memory controls — 2026-10-11

Previous memory delivery is synchronized: local f75fb13786ed806f149d12386ee2610ca70785b8 and remote 5c6832b782db000bc4e3e457990aeeea218d0ce5 share tree b0d8aa8a95ee616e6114684b0de5a49d8a7b86d2. GitHub runs 38154027231 and 38154022550 both passed Windows/Ubuntu; this closes the prior Windows cleanup CI failure.

Added VS Code commands to save a reviewed note from saved selected code, inspect all workspace notes, delete an inspected note, and explain with explicitly selected fresh notes. Full candidates/records/context appear in Output; write and transmission confirmations reuse the existing Cancel-default UI. Buddy links to those same commands and reflects actual pending prompts rather than owning memory or approvals. Explain lists only exact-file/source-hash matches and passes selected IDs through both context preview and execution; the runtime still performs authoritative freshness/consent checks.

Actual VS Code 1.105.0 acceptance initially exposed a non-file document invalidation bug: writing memory records to the Output panel cleared the agent cursor. Invalidation now ignores non-file document changes. The real editor regression then passed command registration, runtime-backed listing, rejection of unsaved memory, unchanged developer selection, retained observed cursor, existing graph/mock/Buddy workflows and reconnect. Interactive save/delete approval dialogs and live memory explanation were not driven end to end. These remain explicit acceptance gaps, not mocked success claims.

Typecheck and focused lint passed before the editor run; final formatting/build/package checks follow. Core storage/protocol behavior is unchanged from the previous 72-unit/12-integration and remote CI evidence. No hosted deployment, desktop archive, live microphone, GitHub credential or model request changed in this slice. Next work is interactive editor acceptance and evidence-based memory relevance selection, followed by the remaining IDE/collaboration phases.

Final checks: typecheck, focused ESLint, changed-file formatting, build, eight-file VSIX packaging and git diff --check passed. Installed the new VSIX successfully; SHA-256 bf975926942ea2e82fe9243a03988b730d2569b486adbeae309df5c43fc65451. GitHub synchronization follows this checkpoint.

## Memory relevance and actual editor approvals — 2026-10-11

The previous editor-memory commit is synchronized to remote 1734f61fa1d2cc7c96a045b95bd083fb12d5e6fa (tree 547166fcbe70f21367e8462ad29e0365d8e2ee80); GitHub runs 38155060608 and 38155058306 passed Windows and Ubuntu.

Added runtime-owned memory.suggest with a versioned schema/capability, CLI memory suggest, and VS Code evidence-bearing suggestions. Ranking uses exact-source freshness, end-exclusive range overlap, distinct objective word matches and line distance. At most five results include reasons and exclusion counts. Nothing is automatically selected, transmitted or treated as semantic proof. Existing explicit record selection and context-hash consent remain authoritative.

Actual VS Code 1.105.0 acceptance passed real Cancel-default save/delete approvals, cancellation without mutation, Buddy prompts, persistence across runtime reconnect and unchanged developer selection. The harness supplies synthetic draft note/period inputs through command arguments; these do not bypass the production approval and do not verify manual text entry. Existing unsaved context/graph/mock/cursor acceptance also passed. The editor emitted a GitHub authentication-provider startup timeout; this does not verify product GitHub login. No model request was made.

Targeted relevance and built CLI tests passed 5/5. Full unit suite passed 73/73. Final integration, lint, packaging and synchronization results follow this checkpoint. Live provider-backed memory explanation, broader semantic/cross-file relevance, team memory ownership and remaining IDE/collaboration/enterprise phases remain open. Hosted apps and desktop archives are unchanged.

Final local checks: typecheck, focused ESLint, build, git diff --check, 73/73 unit tests and 12/12 integration tests passed. Actual editor approval acceptance passed as described above. Packaging, installation and GitHub CI are recorded separately in the delivery receipt.

## Connected hosted evidence and live memory - 2026-10-12

Closed an actual compatibility gap: the hosted validator rejected newer ContextSlice history/memory fields. Canonical validation now preserves bounded history and reviewed notes while rejecting unsupported trust/permission fields. Shared Knowledge and the browser viewer display these fields; oAX1 replaces its duplicate parser with the canonical one. Added CLI export <path> [--history] [--memory <id>] with no provider call or automatic upload. oAX1 requires explicit backend-transmission consent, resets it after edits and clears stale reports on errors.

Installed Codex had moved to 0.162.0-alpha.17.2 and initially failed the version guard. Generated contracts were compared before adding this exact version; new optional parent/root turn IDs are unused, inspected consumed contracts otherwise match. Real synthetic history+memory acceptance then passed: absent consent denied, approved answer cites actual commit and note ID and labels the note as a claim. No private repository content was transmitted. The VSIX was rebuilt and installed; SHA-256 3c0e9444bbb7124eb3f02b489b6dd6f4239fbf9fb5e968ffb0d98afd056c8ac7.

Verification: typecheck/focused lint/build passed; 75/75 unit tests passed. The concurrent integration run passed 12/13, with the review fixture failing its expected exit-code assertion under load. An unchanged sequential rerun passed 13/13, including that real edit/test/review flow. No timeout or gate was loosened. Keep this load sensitivity visible.

AppDeploy updated Shared Knowledge (1791757522441), evidence viewer (1791784785710), and oAX1 (1791785222866); all report ready with empty frontend/backend/network errors. Initial viewer deployment placed assets at root while the existing app served public/ assets; actual browser acceptance caught the stale bundle, and the correct public assets were redeployed. Actual synthetic browser acceptance now passes viewer import/render/clear and oAX1 consent, backend history/memory display, consent reset and invalid-input stale-result removal. AppDeploy did not return E2E test execution results; readiness alone is not treated as workflow proof. Authenticated shared-room publication/revocation was not reverified live.

The local and hosted applications are connected through the reviewed evidence contract and explicit sharing workflow. No automatic device pairing, shared agent execution, universal IDE completion, enterprise readiness, microphone/screen/product GitHub credential acceptance is claimed. Next: actual editor memory-explain consent acceptance, then full second-editor agent workflows. GitHub synchronization/CI follows this checkpoint. A prior single non-UTF-8 dash in this tracker was normalized without changing its content.
