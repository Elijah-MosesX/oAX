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
| History/onboarding | Local commits/blame and evidence-based walkthrough                                          | Live scoped GitHub acceptance; broader issue/review evidence               |
| Browser            | Optional pinned MCP inspection, dedicated profile, origin/page grants; real fixtures passed | Source-map/context integration                                             |
| Distribution       | Local VSIX and built-checkout CLI; content allowlist and notices                            | Supported release policy and hosted CI evidence                            |

M1 foundation and M2 spatial intelligence are complete with verified editor acceptance. The attached master prompt's M2 selected-symbol/relationship acceptance is also verified within the initial TS/JS local-relative module scope. Later milestones are partial: a limited explain/rename/Node-check workflow exists, not the complete platform. The first distribution target is local VS Code and CLI; team/cloud/other IDEs and animated/voice Buddy are pending.

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

- [x] Open and index a real repository (oAX self-analysis).
- [x] Capture the active file and selected symbol (versioned editor acceptance).
- [x] Resolve direct callers or dependencies within the supported local-relative module model.
- [ ] Explain the symbol through Codex using relevant context.
- [ ] Show the agent cursor during investigation.
- [ ] Request a refactor and show an impact summary.
- [ ] Request and record write permission.
- [ ] Apply approved edits and run tests.
- [ ] Present the diff and test results for review.
- [ ] Preserve an audit trail of actions and permissions.

**Release gate:** All steps are demonstrated reliably on a representative repository.

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
