# Reviewed local memory

The runtime retains an explicitly reviewed note linked to a saved source snapshot. Review is not proof of factual correctness. Notes remain untrusted context and cannot grant permissions. CLI, protocol and VS Code commands support explicit review and retrieval. Buddy links to those same commands without owning approval state. Deterministic same-source relevance suggestions are available; inclusion remains an explicit user choice.

From the target repository, replace `<cli>` with the absolute path to the built `dist/cli.cjs`:

```text
node <cli> memory save src/example.ts "This module owns input validation" 30
node <cli> memory save src/example.ts "This module owns input validation" 30 --approve <preview-hash>
node <cli> memory list
node <cli> memory suggest src/example.ts "Explain input validation"
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

Tests exercise wrong/cross-session/replayed approvals, redaction, persistence, stale source, expired review/records, copied workspaces, linked state, writer locks, deletion, bounded context and the built CLI sequence. They do not establish live voice, product GitHub login, team identity or live provider-backed memory explanation.

## VS Code and Buddy

Save the file and select supporting code, then run **oAX: Save Reviewed Memory from Selection**. Enter the claim and eligibility period, inspect the full candidate in Output, then choose Save reviewed note; Cancel is selected initially. **Inspect Reviewed Workspace Memory** shows full records and their freshness. **Delete Reviewed Memory** previews the chosen record and requires a separate exact-record approval. **Explain Selection with Reviewed Memory (Codex)** offers only fresh notes matching the current file snapshot, previews up to five selected notes alongside code context, then requests provider transmission consent.

Buddy's **Reviewed workspace memory** group opens these commands. Its prompt row reopens the actual approval UI; Buddy cannot authorize a write or transmission. Output-panel updates preserve the observed agent cursor; file-document changes still invalidate it. Actual editor acceptance covers command registration, runtime listing, unsaved-save denial and preserved selection/cursor. Actual VS Code 1.105.0 also verified Cancel-default save/delete dialogs, Buddy prompts, persistence across reconnect, cancelled operations and unchanged selection. The harness supplies note/period drafts through command arguments, so manual text entry is not covered. Live memory-explain acceptance remains unverified.

## Inspectable relevance suggestions

`memory.suggest.v1` advertises `memory.suggest`. Suggestions require the exact current file and source hash, exclude stale/expired records and invalid ranges, and return at most five. Ranking uses end-exclusive selection overlap, distinct objective words found in the note, then line distance and record ID. Each result discloses these signals and exclusion counts. This is lexical/range evidence, not semantic proof or cross-file retrieval. Suggestions never select notes automatically or grant transmission consent. VS Code displays the evidence and starts with no notes selected.

Save/delete commands may receive draft arguments (`note`, `retentionDays`, or an existing `id`); these only prefill inputs. The actual exact-operation approval remains mandatory and defaults to Cancel.
