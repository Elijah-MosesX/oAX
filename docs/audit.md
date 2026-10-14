# Local authorization audit

The production stdio runtime creates an exclusive per-process JSONL journal at `.oax/audit/<random-id>.jsonl`. It records grant/refusal, execution allow/deny and completed/failed outcomes. Each entry includes protocol version, monotonic process-local sequence, timestamp, workspace/principal/session/task scope, capability, hashed resource identity and grant ID/expiry when applicable. Exact plan/context identities are resources hashed in the journal; task IDs connect operations within a session.

Records contain no source excerpts, model responses, raw resource paths, command output or credentials. Review documents still show the exact diff and bounded redacted Node output in the session. Audit is metadata evidence, not a replacement for saving a review artifact when required.

Records are appended and flushed before authorization or execution proceeds. A journal failure prevents subsequent operations; a failure after an operation may mean that operation completed even though its final record could not be saved. Completed edits are never implicitly rolled back. Each process journal is capped at 4 MiB; reconnect to start a new journal. Grants remain memory-only and expire normally; restarting cannot replay persisted grants.

`.oax` and its audit directory must be ordinary workspace directories, not symlinks/junctions. Files are created exclusively with restrictive POSIX modes where supported. Windows ACLs are inherited; this is not tamper-resistant storage or OS sandboxing. Anyone with workspace access may inspect or modify local records. No automatic retention deletion occurs. Close the runtime, inspect the exact workspace-local audit directory and remove selected journals through normal file management when appropriate. Removal is not secure erasure and does not affect provider retention. Backups inherit the same privacy considerations.

Library consumers may inject a journal sink; production CLI/editor companions enable it automatically. Tests normally inject isolated workspaces. The read-only editor bridge may create this private state but cannot edit source or execute tests.
