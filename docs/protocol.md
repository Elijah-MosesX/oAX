# oAX protocol 0.1 foundation

Transport is newline-delimited JSON over private parent/child stdio. It uses oAX envelopes rather than JSON-RPC 2.0 envelopes; this records the distinction from the blueprint's suggested JSON-RPC/JSONL transport. A future bridge can translate without leaking provider wire details. No listening socket exists.

Requests include `id`, `version`, `type`, `method`, UTC `timestamp`, `workspaceId`, optional `sessionId`, and `payload`. Responses have a unique ID, request `correlationId`, and either `ok: true` with `payload`, or `ok: false` with a structured `error`. Events include request correlation, workspace/session/task scope, and a connection-wide increasing `sequence`. Events may arrive before the acceptance response. No replay is implemented.

1. Parent creates a random 256-bit token and workspace ID. The child receives the token in its process environment, removes it, and accepts only the matching initialize request.
2. `initialize` negotiates the intersection of requested and available capabilities. Only mock explain, captured spatial snapshots, task events, and cancellation are advertised.
3. `session.open` returns `sessionId`.
4. `selection.explain` supplies an objective and complete bounded editor snapshot, then returns `taskId`. Events report lifecycle and mock text.
5. `task.cancel` names a task in the owning session. `session.close` interrupts, waits, and releases session state. Parent disposal terminates the child.

The foundation is read-only. Lifecycle: created → gathering_context → planning → executing → verifying → completed, with failed/cancelled exits from active states. Verification here checks stream completion; it does not execute tests or establish semantic answer correctness. Approval states will be introduced with an actual edit workflow.

Coordinates are zero-based UTF-16 positions; ranges are end-exclusive. Full text is captured before asynchronous work. Selection, cursor, and visible ranges are checked against that exact snapshot. Older versions and conflicting same-version text in a session fail. The context excerpt is capped at 8,192 UTF-16 code units, with truncation and buffer provenance. No symbol resolution or graph is claimed.

Limits: 256 KiB UTF-8 frames, 131,072 code-unit buffer, 2,048 code-unit objective, 100 visible ranges/open files, 8 sessions, 4,096 request IDs per connection, one task per session, 64 KiB cumulative agent text, and 1 MiB outbound queue. Reader consumption and awaited writes backpressure incoming requests; an oversized partial line disconnects. Requests time out at 10 seconds, runtime tasks at 30 seconds, adapter tasks at 35 seconds. Cancellation does not imply rollback.

Malformed framing closes the connection. Valid request envelopes receive structured errors for unsupported versions/methods, mismatched identities, missing initialization, invalid params, duplicate IDs, and limits. Repository content cannot change capabilities, tokens, policy, or grants.

The generated schemas describe envelope and snapshot structure. Cross-field range ordering, buffer bounds, URI/path equality, and realpath containment are additional runtime checks. `pnpm schemas` regenerates schemas from the Zod source of truth.
