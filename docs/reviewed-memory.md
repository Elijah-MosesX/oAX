# Reviewed local memory

The runtime retains an explicitly reviewed note linked to a saved source snapshot. Review is not proof of factual correctness. Notes remain untrusted context and cannot grant permissions. This first slice supports CLI and protocol access; editor/Buddy memory controls and automatic relevance retrieval remain subsequent work.

From the target repository, replace `<cli>` with the absolute path to the built `dist/cli.cjs`:

```text
node <cli> memory save src/example.ts "This module owns input validation" 30
node <cli> memory save src/example.ts "This module owns input validation" 30 --approve <preview-hash>
node <cli> memory list
node <cli> explain src/example.ts --memory <record-id>
node <cli> explain src/example.ts --memory <record-id> --approve <context-hash>
node <cli> memory delete <record-id> --approve <record-hash-from-list>
```

The first command previews the candidate, selected range, full source hash, redacted note and storage disclosure without saving. Inspect before approving. Saving requires an exact, unexpired same-session review; the repeated CLI command recreates that review and checks its content hash. Records persist across sessions. Explain includes only explicitly selected IDs (up to five), with separate hash-bound consent covering code, graph, optional history and memory together. No hosted posts or model statements are automatically imported. Avoid secrets in notes or shell history.

## Boundaries and recovery

- Versioned JSON records live under `.oax/memory/`, excluded from indexing and Git. Source and canonical workspace hashes prevent reuse with different code or a copied workspace. Changed/deleted/excluded source and different unsaved snapshots block retrieval. An exact reverted snapshot can match again.
- The explicit 1–90 day period controls context eligibility. Expired records remain inspectable until explicitly deleted; this is not automatic physical erasure. Deletion does not erase backups, audit metadata or previously transmitted provider context.
- The initial store allows 16 records, each at most 12,000 serialized bytes and 2,000 note characters. Memory shares the 16,000-byte ContextSlice budget; truncation/omission is disclosed.
- An exclusive `.lock` serializes operations across local runtime processes. Concurrent operations return `MEMORY_BUSY`. After a crash, stop all oAX runtimes, back up records, confirm no writer remains, then remove only the stale lock. Malformed/incomplete records fail closed and require inspection/restoration or explicit local removal; no silent repair occurs.
- Ordinary local-account filesystem controls apply. No encryption, tamper-resistant review, hostile-local-user isolation, semantic proof, cross-device synchronization or team approval ownership is claimed.

## Protocol and checks

`memory.reviewed.v1` advertises `memory.prepare`, `memory.save`, `memory.list`, and `memory.delete`. Save/delete cross the audited workspace-write boundary. Optional `memoryIds` on preview/explain selects records; freshness is rechecked for each context. Missing or changed provider consent still blocks transmission. No new execution or remote-write grant is introduced.

Tests exercise wrong/cross-session/replayed approvals, redaction, persistence, stale source, expired review/records, copied workspaces, linked state, writer locks, deletion, bounded context and the built CLI sequence. They do not establish live voice, product GitHub login, team identity or editor memory-dialog acceptance.
