# Additional editor contract

The CLI's `editor-bridge <trusted-workspace-root>` command is a parent-owned private stdio companion for prototype editor adapters. It creates the same authenticated runtime process and session used by VS Code. It does not create a listening socket or introduce another agent engine.

The default validated protocol 0.1 response has reserved correlation ID `adapter-bootstrap` and payload `{ contract: "editor-read-only.v1", workspaceId, sessionId, methods, engine: "mock" }`. This companion bootstrap is separate from the runtime's token-authenticated initialization. The token remains inside RuntimeClient; editors never receive it. A client waits for bootstrap before making requests.

Subsequent requests use the existing versioned request envelope, exact assigned workspace/session identity, unique ID, timestamp, method and payload. The bridge validates the envelope and the existing method JSON schemas. It emits existing discriminated response envelopes and actual runtime event envelopes. Request IDs are correlated across the bridge; event task/session identities and increasing sequence numbers remain unchanged. Responses can interleave with events. Unsupported versions or malformed framing close the connection. Wrong scope, duplicate IDs, invalid parameters and unsupported methods return structured errors. The session permits 4096 unique requests before reconnecting. Only one non-cancellation operation runs at a time; cancellation remains available while it runs. Frame and output-queue limits reuse the core transport. EOF/disconnection closes the owned runtime and outstanding operations.

Default-mode methods: `spatial.observe`, `graph.query`, `index.status`, `context.preview`, `repository.onboard`, `history.query`, explicitly selected mock `selection.explain`, and scoped `task.cancel`. Provider configuration through RPC, credentials, edits, tests, Git mutations and GitHub mutations are unavailable. Capability exposure is deliberately narrower than the VS Code workflows. A prototype never substitutes a mock for a requested live provider.

### Opt-in Codex text mode

Launch `node dist/cli.cjs editor-bridge <trusted-root> --codex <absolute-executable>` to use the existing exact-version-verified text adapter and login. This returns the separately versioned `editor-codex-text.v1` bootstrap with `engine: "codex"`; the method allowlist stays the same. Old clients remain on the original contract and never silently acquire provider transmission. No provider wire protocol is exposed.

In Codex mode, preview and execution must use the same connection and exact normalized observation, objective, history and memory selection. A preview receipt expires after 60 seconds and is consumed by one explanation attempt, including a denied or failed attempt. `approvedContextHash` must match the receipt; the runtime independently reconstructs and checks context at execution, so changed source or related evidence cannot be authorized by an old preview. A new preview replaces the previous receipt. Disconnect drops receipts. Cancellation stays available during a running explanation. The adapter is a trusted local consent UI, not an isolation boundary against arbitrary code running in the editor process.

For Neovim, explicitly add `codex = 'C:/absolute/path/to/codex.exe'` to the trusted user setup options. `:OaxExplain [objective]` (or an Ex line range) opens the full read-only context/hash preview, then offers **Cancel** first and **Send to Codex** second. Closing/cancelling sends nothing. A changed source version or reconnected session invalidates the UI decision. `:OaxCancel` cancels the observed running task. Public `User OaxEvent` events retain actual lifecycle/delta/cursor evidence; the final answer appears in a scratch buffer. `OaxExplainMock` is rejected in Codex mode. This slice does not add edit/test approvals, live history/memory selection UI, or Buddy decorations to Neovim.

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

Use `:OaxContext [objective]` to inspect the current line's bounded context and approval hash, or `:2,5OaxContext Explain callers` for an explicit line range. Visual Ex ranges select whole lines. The command captures the unsaved document and its version, uses UTF-16 end-exclusive coordinates, and opens a read-only result buffer without modifying the source or starting an agent task. Default mode remains read-only; opt-in provider explanation is described above, while reviewed rename requires the separate opt-in below and tests remain unavailable.

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

Set `edits = true` in trusted Neovim setup to select `editor-reviewed-rename.v1`. The CLI equivalent is `editor-bridge <root> [--codex <absolute-executable>] --edits`. This contract adds only `refactor.prepare`, `refactor.apply` and `review.get`; it can use mock or explicit Codex text mode. Codex is not needed for deterministic rename.

Place the cursor on a saved TypeScript/JavaScript symbol and run `:OaxRename newName`. A read-only view displays every path and complete before/after content. The native choice defaults to Cancel. Apply uses an exact, single-use, connection-bound receipt with a maximum 60-second lifetime; a changed source version or any affected dirty/changed loaded buffer requires a fresh preview. The runtime independently enforces saved-file baselines, exact plan/hash, expiration, path identity and resource grants. Unmodified affected buffers reload after completion; unsaved buffers are preserved.

Use `:OaxReview` to inspect the latest completed edit and current disk freshness. Rename's limited syntax/checker validation does not establish test success or external API compatibility. No provider-generated edits, test execution, Git writes or automatic rollback are exposed. A multi-file I/O failure can leave partial writes and is reported by the runtime; this is not an atomic transaction.

With pinned Neovim configured, set `OAX_NVIM_EDIT_TEST=1` and run `node scripts/test-neovim.mjs`. The isolated synthetic fixture verifies native cancellation, changed secondary buffers, cross-file writes, refresh, review and disk-conflict rejection. It uses no provider account. Clear the flag to run default acceptance.

## Separately approved test execution

Set `tests = true` in trusted setup (CLI: `--tests`) to select `editor-verification.v1`. This independently adds `verification.prepare`, `verification.run` and `review.get`; combine with `edits = true` only for rename support. Existing default/text/rename contracts keep their previous allowlists.

Open a saved `.test` or `.spec` JavaScript/TypeScript file and run `:OaxVerify`. Review the executable, fixed arguments, working directory, source hash, timeout and execution disclosure. Cancel is first. Run test consumes a connection-bound exact-plan approval receipt; changed buffers or sessions require a new preview, and the runtime checks disk freshness and grants at execution. Tests and their dependencies run with local-account rights, restricted environment and a five-second timeout. They can modify files or use the network; no OS sandbox or rollback is claimed. Arbitrary shell commands/package scripts remain unavailable.

Output and final completed/failed/cancelled state appear in the reusable result window. Runtime events continue after the immediate task acknowledgement. `:OaxCancel` stops an active check; `:OaxReview` shows the latest edit and its test result, with source freshness checked again. Passing one selected test does not establish full project correctness. No edit review exists until a rename has completed in this session.
