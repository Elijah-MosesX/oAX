# Connected intelligence: historical context

The first connected-intelligence slice puts selected code, deterministic graph relationships and historical evidence in one inspectable ContextSlice. Historical context is opt-in. Existing code-only explanations remain unchanged.

## Use it

In VS Code, save tracked code, select at most 200 lines, and run **oAX: Explain Selection with History (Codex)**. Choose local Git or Git plus GitHub discussions. GitHub mode presents the existing repository-scoped connection approval and credential flow in the same provider session. Inspect the full Output preview before approving model transmission. Provider tools remain disabled.

From a built checkout, run `node <checkout>/dist/cli.cjs explain <path> --history` in the target repository. The CLI previews local historical context and its approval hash; repeat with `--approve <hash>` to transmit. The selected CLI file must fit the 200-line history limit. `--mock --history` exercises the local runtime without a model request and remains explicitly labeled mock. GitHub history is available through the runtime protocol and VS Code command; the CLI does not accept GitHub tokens on its command line.

## Contract and evidence

`context.preview` and `selection.explain` accept optional `history: "local" | "github"`, advertised by `context.history.v1`. GitHub mode includes local evidence. Clients must preserve the chosen mode when executing an approved preview. Existing clients that omit it keep their prior behavior.

Each historical excerpt includes its source, commit/repository reference, selected-source hash, evidence hash and truncation flag. Local context distinguishes selected-line blame commits from broader file commits. It omits raw blame author emails and unrelated branch inventories. GitHub evidence covers the first selected blame commit, including bounded PR associations, discussions, checks, retrieval time and partial-failure information. It remains untrusted data and cannot change policy or authorize actions. Associations and prose do not prove historical intent.

The existing 16,000-byte serialized context budget covers all evidence. Each historical excerpt is capped at 3,072 characters; truncated excerpts may be partial JSON text. Graph excerpts are removed first when the total budget is exceeded, followed by historical excerpts and selected text. Omissions and truncation remain visible. Known-secret redaction also applies to historical excerpts; it is not a complete secret detector.

## Freshness and permissions

Local history requires a saved snapshot matching disk. File content and repository HEAD are checked after historical retrieval. Both contribute to the preview and hash-bound provider consent; a changed HEAD invalidates previous approval even if selected text is unchanged.

Git reads pass through the existing scoped `git.read` boundary. GitHub requires an approved, unexpired connection in the same session and a scoped grant for each fixed-origin GET. No remote reads occur in local mode. Remote evidence is cached in that session for at most five minutes, keyed to repository, HEAD, selected-source hash and commit. Its original retrieval time remains part of the preview. Disconnect/reconnect clears the cache, and expiration or changed evidence requires another preview/approval. This is a bounded inspected snapshot, not a guarantee of continuously current remote discussions.

## Verification and next boundary

On October 10, 2026, the opt-in built-runtime test also passed against installed Codex 0.162.0-alpha.2. It rejected missing transmission consent and returned a real explanation citing the synthetic repository's commit, explicitly distinguishing its subject from proven historical intent. The local receipt is `dist/history-live-acceptance.json`. No live GitHub credential request or interactive editor history dialog was tested.

Real temporary Git repositories and an injected external-engine fixture verify matching preview/execution context, rejected missing/stale consent, saved-source enforcement and bounded payloads. Mock GitHub transport verifies connection scope, stable inspected snapshots, credential redaction, disconnect denial, session isolation and source changes during retrieval. Built CLI/stdio coverage exercises the public payloads. Mocked provider/remote tests do not establish live GitHub credentials or model answer quality.

Persistent validated memory is the next connected-intelligence step. It still needs evidence-bound candidate/review/validation states, invalidation and retention/deletion rules before automatic context retrieval. Hosted shared posts are not silently imported as verified facts. Cross-device agents, universal IDE workflows and enterprise controls remain separate subsequent phases.
