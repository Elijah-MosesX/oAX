# Additional editor contract

## Editor capability and evidence matrix

Audited 2026-10-14 against source and the recorded acceptance runs. These are local development targets, not a universal IDE compatibility or release certification. An exposed runtime method is not proof that every adapter has a corresponding user workflow.

| Editor                                         | Implemented user workflow                                                                                                                                                | Spatial scope                                                                                                                                           | Verified evidence and remaining gate                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VS Code 1.105.0                                | Graph queries, context/history/memory previews, Codex explanation and selected-range proposals, reviewed rename, separately approved Node tests and review; native Buddy | Debounced observations, selected unsaved buffer, text tabs/visible ranges, source-validated separate agent cursor                                       | [Editor tests](../tests/editor), [extension](../adapters/vscode/src/extension.ts); deterministic editor acceptance in hosted Linux CI, recorded Windows/live-provider acceptance in PROGRESS. Live product GitHub login, voice and broader host versions remain separate gates.                                                                            |
| Neovim 0.11.5                                  | Read-only defaults; explicit Codex, edits and tests options enable separately approved explanation/proposal/rename/test/review                                           | Debounced selected-buffer observations, visible text windows, UTF-16 character/line selections, hash/version-validated highlights; optional status text | Actual [default](../tests/neovim/acceptance.lua), [presence](../tests/neovim/presence.lua), [edit/test](../tests/neovim/edit.lua), [live proposal](../tests/neovim/proposal.lua) and [live reconnect](../tests/neovim/lifecycle.lua) acceptance recorded in PROGRESS. No history/memory choice UI, Buddy pane, block selection or transparent task resume. |
| Vim 9.2.1162, Windows x64                      | `OaxObserve`, `OaxCallers`, `OaxContext`, connect/close; read-only popup and task-location highlights                                                                    | Debounced selected unsaved buffer, character/line visual ranges, visible windows, UTF-16 positions and source-validated highlights                      | [Actual Vim acceptance](../scripts/test-vim.mjs), [presence](../tests/vim/presence.vim) and [indicators](../tests/vim/cursor.vim) passed. [Visual selection acceptance](../tests/vim/selection.vim) passed. No provider/edit/test UI or block selection.                                                                                                   |
| IntelliJ IDEA Community 2025.2.1 SDK prototype | One structural-callers action through the read-only bridge                                                                                                               | Current document/selection; current file only in open files; empty visible ranges                                                                       | [Java action](../adapters/jetbrains/src/main/java/dev/oax/CallersAction.java) compiled against the SDK in the recorded checkpoint. Plugin packaging and actual IDE acceptance remain unverified; compilation does not establish editor operation.                                                                                                          |

All four adapters leave graph/context/policy ownership in the runtime. The selected buffer is the only dirty overlay; other unsaved files are not silently merged. TS/JS semantic relationships and other language-worker candidates retain their evidence grades; editor compatibility does not establish full language semantics. See [language limits](polyglot.md).

Neovim opt-ins compose as follows, matching the bootstrap selection in [editor-bridge.ts](../apps/cli/src/editor-bridge.ts). Provider choice and method availability do not grant transmission, write or test authorization.

| Trusted setup                            | Bootstrap contract          | Additional capability                                                                               |
| ---------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------- |
| No opt-ins                               | `editor-read-only.v1`       | Local reads and explicit mock explanation                                                           |
| Codex only                               | `editor-codex-text.v1`      | Explanation after exact context consent                                                             |
| Edits, without Codex or tests            | `editor-reviewed-rename.v1` | Reviewed deterministic rename and review                                                            |
| Tests, without Codex plus edits together | `editor-verification.v1`    | Saved test planning/execution and review; rename when edits enabled, explanation when Codex enabled |
| Codex plus edits, with optional tests    | `editor-codex-edit.v1`      | Reviewed selection proposals and rename; tests only when separately enabled                         |

Every connection advertises its exact method list. Older read-only clients do not acquire those opt-ins. Next acceptance gate: widen real host/version coverage and investigate reproducible spatial/recovery failures before introducing shared-agent sessions or cross-device approval ownership.

The CLI's `editor-bridge <trusted-workspace-root>` command is a parent-owned private stdio companion for prototype editor adapters. It creates the same authenticated runtime process and session used by VS Code. It does not create a listening socket or introduce another agent engine.

The default validated protocol 0.1 response has reserved correlation ID `adapter-bootstrap` and payload `{ contract: "editor-read-only.v1", workspaceId, sessionId, methods, engine: "mock" }`. This companion bootstrap is separate from the runtime's token-authenticated initialization. The token remains inside RuntimeClient; editors never receive it. A client waits for bootstrap before making requests.

Subsequent requests use the existing versioned request envelope, exact assigned workspace/session identity, unique ID, timestamp, method and payload. The bridge validates the envelope and the existing method JSON schemas. It emits existing discriminated response envelopes and actual runtime event envelopes. Request IDs are correlated across the bridge; event task/session identities and increasing sequence numbers remain unchanged. Responses can interleave with events. Unsupported versions or malformed framing close the connection. Wrong scope, duplicate IDs, invalid parameters and unsupported methods return structured errors. The session permits 4096 unique requests before reconnecting. Only one non-cancellation operation runs at a time; cancellation remains available while it runs. Frame and output-queue limits reuse the core transport. EOF/disconnection closes the owned runtime and outstanding operations.

Default-mode methods: `spatial.observe`, `graph.query`, `index.status`, `context.preview`, `repository.onboard`, `history.query`, explicitly selected mock `selection.explain`, and scoped `task.cancel`. Provider configuration through RPC, credentials, edits, tests, Git mutations and GitHub mutations are unavailable. Capability exposure is deliberately narrower than the VS Code workflows. A prototype never substitutes a mock for a requested live provider.

### Opt-in Codex text mode

Launch `node dist/cli.cjs editor-bridge <trusted-root> --codex <absolute-executable>` to use the existing exact-version-verified text adapter and login. This returns the separately versioned `editor-codex-text.v1` bootstrap with `engine: "codex"`; the method allowlist stays the same. Old clients remain on the original contract and never silently acquire provider transmission. No provider wire protocol is exposed.

In Codex mode, preview and execution must use the same connection and exact normalized observation, objective, history and memory selection. A preview receipt expires after 60 seconds and is consumed by one explanation attempt, including a denied or failed attempt. `approvedContextHash` must match the receipt; the runtime independently reconstructs and checks context at execution, so changed source or related evidence cannot be authorized by an old preview. A new preview replaces the previous receipt. Disconnect drops receipts. Cancellation stays available during a running explanation. The adapter is a trusted local consent UI, not an isolation boundary against arbitrary code running in the editor process.

For Neovim, explicitly add `codex = 'C:/absolute/path/to/codex.exe'` to the trusted user setup options. `:OaxExplain [objective]` (or an Ex line range) opens the full read-only context/hash preview, then offers **Cancel** first and **Send to Codex** second. Closing/cancelling sends nothing. A changed source version or reconnected session invalidates the UI decision. `:OaxCancel` cancels the observed running task. Public `User OaxEvent` events retain actual lifecycle/delta/cursor evidence; the final answer appears in a scratch buffer. `OaxExplainMock` is rejected in Codex mode. Text-only setup does not enable writes or tests. Separate edit/test flags and spatial indicators are described below; Neovim has no history/memory selection UI or VS Code Buddy pane.

Positions are zero-based **UTF-16 code units**, with end-exclusive ranges. Include exact unsaved text and a monotonically increasing document version. Neovim converts UTF-8 byte coordinates to UTF-16; JetBrains offsets are already UTF-16. URI/path/version/snapshot validation and graph resolution remain in the existing runtime. No disk snapshot may silently replace an unsaved selection. Results retain the existing semantic/heuristic/unresolved evidence labels.

## Neovim prototype

Validated target: Neovim 0.11.5 and Node 24.19.0. Add `adapters/neovim` to your runtime path, then configure the built checkout explicitly:

```lua
require('oax').setup({
  root = 'C:/path/to/trusted/workspace',
  cli = 'C:/path/to/oAX/dist/cli.cjs',
  node = 'node',
})
```

Use `:OaxCallers`, `:OaxObserve`, or the development-only `:OaxExplainMock`. Results appear in a read-only scratch buffer. Characterwise and linewise current visual selections are supported; block selections and other dirty-buffer overlays are not. Open files come from actual visible text windows across tabs rather than all cached buffers. `User OaxEvent` delivers actual scoped lifecycle/activity/cursor events for presentation consumers. Default setup does not apply edits or automatically follow an agent. `require('oax').close()` releases the connection; VimLeave closes it automatically. Neovim setup assumes you explicitly trust the configured root; it does not claim a VS Code-style workspace trust UI.

Run `pnpm test:neovim` with `OAX_NVIM_EXECUTABLE` set to the absolute pinned executable. The actual headless editor acceptance verifies unsaved semantic callers, an actual Unicode visual selection, ordered runtime/mock events, unsupported-write denial and preserved developer cursor. The optional portable editor lives under ignored `.tools`; it is excluded from indexing and provider context. Normal Node tests need no Neovim installation.

Use `:OaxContext [objective]` to inspect the current line's bounded context and approval hash, or `:2,5OaxContext Explain callers` for an explicit line range. Visual Ex ranges select whole lines. The command captures the unsaved document and its version, uses UTF-16 end-exclusive coordinates, and opens a read-only result buffer without modifying the source or starting an agent task. Default mode remains read-only; opt-in provider explanation is described above, while reviewed rename and saved tests each require the separate opt-ins below.

## JetBrains prototype

`adapters/jetbrains` contains an IntelliJ Platform Java action and plugin descriptor targeting IDEA Community 2025.2.1, platform plugin 2.9.0 and Java 21. It captures the current document/selection on the editor thread and runs the same read-only bridge in a background task. Configure trusted absolute paths through IDE VM options `-Doax.cli=/absolute/oAX/dist/cli.cjs` and optional `-Doax.node=/absolute/node`. The editor-popup **oAX: Find Callers** action displays correlated structural evidence. Workspace files cannot supply executable configuration.

Prototype limits: current text tab only in `openFiles`, empty visible ranges, no continuous observations, Buddy view, provider consent, edits or tests. Direct `javac --release 21 -cp "<IDEA-SDK>/lib/*" -d <output> adapters/jetbrains/src/main/java/dev/oax/CallersAction.java` passed against the downloaded 2025.2.1 SDK. Gradle `buildPlugin` reached Java compilation but its worker failed with a Windows loopback connection error; no plugin ZIP or live IDE acceptance is claimed. Consult PROGRESS for exact build evidence. A live JetBrains acceptance remains distinct from Neovim acceptance.

Official APIs used: [Neovim job control](https://neovim.io/doc/user/job_control/), [Neovim API](https://neovim.io/doc/user/api/), [IntelliJ editor APIs](https://plugins.jetbrains.com/docs/intellij/editors.html) and [IntelliJ listeners](https://plugins.jetbrains.com/docs/intellij/plugin-listeners.html).

## Expanded surfaces assessment

| Surface         | Fit and required boundary                                                                 | Decision for this slice                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| CLI             | Local workspace detection, explicit previews/approval hashes, headless integration        | Add read-only `doctor [root]` and the documented editor bridge                                                  |
| Desktop         | A local companion can own stdio and expose a narrow authenticated IPC boundary to its UI  | Evaluate after adapter stabilization; no new desktop application shipped                                        |
| Web             | A browser cannot directly spawn this stdio runtime or freely read local workspace buffers | Requires a separately designed authenticated local broker or selected managed service; no HTTP listener shipped |
| Additional IDEs | Capture snapshots and translate public protocol events; keep execution in core            | Neovim acceptance first; JetBrains remains a separate prototype/acceptance target                               |

Desktop/web evaluation does not establish cloud deployment, tenant isolation or browser filesystem access. Remote services require their own authentication, policy, retention and operational validation. The current local preview is not deployed to those surfaces.

## Requested voice follow-up

Voice was not implemented in Milestone 6, whose checklist required assessment. The user's subsequent request explicitly adds voice to the implementation backlog. It remains planned, not cancelled or deployed. The next voice slice must choose and verify a backend, add explicit microphone start/stop and indication, provide text alternatives and keep all transcription-driven actions behind the same runtime approvals. No microphone capture is enabled by this milestone. See [voice acceptance requirements](buddy.md#optional-voice-assessment).

## Opt-in reviewed rename

Set `edits = true` in trusted Neovim setup, without Codex or tests, to select `editor-reviewed-rename.v1`; combined opt-ins use the contracts in the matrix above. The CLI equivalent is `editor-bridge <root> [--codex <absolute-executable>] --edits`. This contract adds only `refactor.prepare`, `refactor.apply` and `review.get`; it can use mock or explicit Codex text mode. Codex is not needed for deterministic rename.

Place the cursor on a saved TypeScript/JavaScript symbol and run `:OaxRename newName`. A read-only view displays every path and complete before/after content. The native choice defaults to Cancel. Apply uses an exact, single-use, connection-bound receipt with a maximum 60-second lifetime; a changed source version or any affected dirty/changed loaded buffer requires a fresh preview. The runtime independently enforces saved-file baselines, exact plan/hash, expiration, path identity and resource grants. Unmodified affected buffers reload after completion; unsaved buffers are preserved.

Use `:OaxReview` to inspect the latest completed edit and current disk freshness. Rename's limited syntax/checker validation does not establish test success or external API compatibility. Rename-only setup exposes no provider-generated edits or test execution. Codex plus edits enables selection proposals, and tests require their own flag; Git writes and automatic rollback remain unavailable. A multi-file I/O failure can leave partial writes and is reported by the runtime; this is not an atomic transaction.

With pinned Neovim configured, set `OAX_NVIM_EDIT_TEST=1` and run `node scripts/test-neovim.mjs`. The isolated synthetic fixture verifies native cancellation, changed secondary buffers, cross-file writes, refresh, review and disk-conflict rejection. It uses no provider account. Clear the flag to run default acceptance.

## Separately approved test execution

Set `tests = true` in trusted setup (CLI: `--tests`) to select `editor-verification.v1`. This independently adds `verification.prepare`, `verification.run` and `review.get`; combine with `edits = true` for reviewed rename and, when Codex is also configured, selection proposals. Codex plus edits selects `editor-codex-edit.v1` even when tests are enabled; the advertised method list includes the separately enabled test methods. Existing default/text/rename contracts keep their previous allowlists.

Open a saved `.test` or `.spec` JavaScript/TypeScript file and run `:OaxVerify`. Review the executable, fixed arguments, working directory, source hash, timeout and execution disclosure. Cancel is first. Run test consumes a connection-bound exact-plan approval receipt; changed buffers or sessions require a new preview, and the runtime checks disk freshness and grants at execution. Tests and their dependencies run with local-account rights, restricted environment and a five-second timeout. They can modify files or use the network; no OS sandbox or rollback is claimed. Arbitrary shell commands/package scripts remain unavailable.

Output and final completed/failed/cancelled state appear in the reusable result window. Runtime events continue after the immediate task acknowledgement. `:OaxCancel` stops an active check; `:OaxReview` shows the latest edit and its test result, with source freshness checked again. Passing one selected test does not establish full project correctness. No edit review exists until a rename has completed in this session.

## Codex selection edit proposals

Configuring both an absolute `codex` executable and `edits = true` selects `editor-codex-edit.v1`. It adds `refactor.propose` to reviewed editing; `tests = true` remains independent. Provider tools remain disabled.

Use `:OaxPropose describe the change` on the current saved line, or `:2,5OaxPropose describe the change` for an explicit whole-line Ex range. The complete bounded context appears first, with Cancel-default approval to send it to Codex. Truncated/redacted previews are rejected for editing. After generation, the runtime parses the exact returned JSON as an untrusted single-selection replacement. A second read-only view shows every before/after byte and the unverified status; a separate Cancel-default Apply edit decision is required. Changing the source or reconnecting invalidates the pending UI decision.

The bridge binds proposal preparation to a single fresh provider response and observation. The resulting edit plan has its own exact hash, expiring one-use approval and runtime baseline/path checks. Cancelling either dialog leaves source unchanged. Text outside the captured selection is preserved; model syntax/behavior is unverified until separately authorized checks. Use `:OaxVerify` on a relevant saved test and `:OaxReview` for actual freshness/results. This does not add multi-file generation, file creation/deletion, arbitrary commands or automatic rollback.

## Neovim spatial presence

Explicit commands arriving during an in-flight background observation wait for its response; cancellation is sent immediately. Closing the connection fails queued requests instead of replaying them into a new session.

Trusted setup now automatically observes meaningful cursor/buffer/view changes after a 250-ms debounce. Observations include unsaved text and document version, use the existing local runtime graph, and start no task or provider transmission. Pending requests and active tasks defer background observations. Non-file buffers, outside-root captures and oversized snapshots are ignored. Set `observe = false` to use only explicit commands. Existing session request limits still apply; close/setup reconnects when needed.

Actual `agent.cursor.changed` events render a range highlight and an oAX mode label only in already visible buffers whose source hash and optional document version match. UTF-16 positions are converted to byte offsets; invalid and half-surrogate ranges are rejected. Text/save/buffer-leave events, new/terminal tasks and disconnect clear indicators. No files are opened and the human cursor/selection is not moved. This is a location indicator based on public events, not a claim to show hidden model reasoning.

`require("oax").status()` returns a fixed status string for an optional statusline integration: offline, observing/idle, or the latest runtime task phase. Setup does not replace your statusline. `inspect().presence` exposes focused-symbol metadata, observation count and marked buffers without retaining source text. Observation and rendering remain distinct: a local graph focus is not displayed as agent activity.

## Live interruption and reconnect acceptance

The opt-in `OAX_NVIM_LIFECYCLE_TEST=1` mode of `node scripts/test-neovim.mjs` verifies Neovim 0.11.5 with the configured live provider and synthetic source. It cancels through `OaxCancel` only after a public provider turn-start event, checks terminal cancellation and indicator cleanup, then closes and creates a new connection. Pending UI consent and the old context receipt are rejected. New spatial focus and a freshly approved completed explanation must arrive, with the source and human cursor preserved.

This verifies an explicit close/setup recovery, not transparent resume of a cancelled task. The test permits up to 10 seconds for local spatial focus after reconnect and requires a displayed answer for the new task. Cancellation is evidenced by the runtime terminal event and absence of subsequent task events during the observation window; the test does not claim provider-side billing reversal, a server interrupt acknowledgement, or resilience to every network/process failure. Set the executable paths as described in DEVELOPMENT.md; live mode uses account usage and is excluded from ordinary tests.
