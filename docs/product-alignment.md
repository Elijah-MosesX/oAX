# Original product intent and implementation alignment

Reviewed on 2026-10-04 against the supplied `PDD_ oAX Ideation phase.md` and the text of its Word counterpart. This is an implementation reconciliation, not a replacement blueprint. The original attachments remain unchanged.

## The product we are building

oAX is a spatially aware developer agent runtime: a persistent participant in the workspace that understands the developer's current focus, code relationships, repository history and tools. It turns intent into inspectable context, governed action, observable results and retained knowledge. Codex is its primary engine behind an adapter. The runtime owns state; IDEs, desktop, CLI, web and Buddy present and interact with that state.

The distinguishing experience is: select code → identify the symbol and relationships → bring in relevant history → inspect the bounded context → ask the agent → see its evidenced location → propose a change → approve the exact operation → run approved verification → review the diff and record the outcome. Onboarding, analysis, collaboration and voice extend that same experience.

The hosted shared-knowledge app is a supporting surface. It is not yet the complete oAX runtime experience. Installing authoring tools, producing videos, adding languages or publishing a page does not satisfy this product's acceptance criteria.

## Alignment and gaps

| Original requirement                     | Actual implementation                                                                 | Remaining connection                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Replaceable clients, runtime-owned state | Validated protocol, private stdio runtime, VS Code/CLI plus read-only adapters        | Stable public client SDK; full second-editor agent workflow; remote transport and reconnect/replay |
| Persistent spatial understanding         | Versioned selection, unsaved buffers, real text tabs, graph focus, independent cursor | Cross-application/window context, unified screen observations, session continuity                  |
| Context relevance is the differentiator  | Bounded selected source and graph excerpts, redaction, transmission approval          | Objective-aware history, tests/configuration and reviewed memory in one inspectable slice          |
| Deterministic code intelligence          | TS/JS semantic subset; Python/Java/Go syntax workers with confidence labels           | Broader resolution, architecture views and evidence-backed analyst findings                        |
| Explain why code exists                  | Local history and selected-repository GitHub readers                                  | History associations integrated into task context; live product credential acceptance              |
| Governed changes and review              | Selected-range Codex proposals, exact write/test approvals, diffs and audit           | Broader impact-aware multi-file changes and unified investigation-to-review journey                |
| Buddy is a client of public events       | Runtime event projection, inspection receipts and separate cursor                     | Consistent presence across clients; integrated voice and visual observations                       |
| Validated memory                         | Reviewed hosted findings/decisions; local action audit                                | Explicit candidate→evidence→validation memory lifecycle and authorized task retrieval              |
| Collaborating participants               | Authenticated rooms, reader/contributor roles, source-free invalidations              | Automatic device pairing and shared agent orchestration; two independent users proven live         |
| Real-world distribution                  | Local VSIX and Windows portable artifacts, hosted service                             | Full supported-host matrix, signed releases, enterprise identity/policy/retention/recovery         |

## What changed in direction

The architecture largely follows the original boundaries, but delivery has overemphasized separate surfaces and integrations before completing their shared contextual journey. Caller-only context and separate history panels are a concrete example: all three can exist while the agent still cannot answer the original “why does this work this way?” with combined evidence.

The first corrective code change expands bounded graph context to objective-prioritized callers, direct callees, file imports and heuristic tests. Each item retains its resolution grade and selection reason; stale snapshots are excluded and truncation is explicit. It does not silently send history or shared memory. Those require a corresponding preview and consent contract.

## Delivery sequence and acceptance

1. **Connected understanding:** prove the five original questions—what am I looking at, why this way, what calls it, refactor it, show its history—against one representative repository. Combine relevant evidence under an inspectable budget. Never infer a historical cause from association alone.
2. **Connected action:** preserve the same task identity across investigation, proposal, exact approval, execution, verification and review. Retain meaningful evidence and invalidation rules.
3. **Continuity and presence:** validated workspace/repository memory, explainable agent location, opt-in voice/screen context and reconnect behavior.
4. **Shared core across environments:** extend the client contract and prove an actual second editor agent workflow; then authenticated device collaboration with local approval ownership and explicit enterprise controls.
5. **Challenge delivery:** installable supported builds, practical guide and accurate videos, with live acceptance receipts rather than feature-complete claims.

These are dependency priorities, not cancellations of previously requested capabilities. The ideation document's older “not yet” list does not override the user's later collaboration, language, voice and multi-interface requirements. Its several milestone numberings are historical examples; acceptance outcomes above are the stable reference.

The documents also contain illustrative APIs, event names, numeric examples and agent-location examples. They are not proof of current APIs or tests. Precise agent locations must come from observed tool/editor evidence, not narrative model text. Capability negotiation never grants authorization.

## Source provenance

- Markdown SHA-256: `f7d7526770bc6922081cf27f31b5d82a1f1092fc6982bfafd7ad04dd5d9ab776`.
- Word SHA-256: `9fe88f6bede797219bda6d5a18691e85a8ac61c44633a02068a28b98959e1dff`.
- Both contain the same product definition, persistent-participant principle, north-star context, memory and Codex adapter direction. Formatting/examples remain design input; the live source and tests establish implementation status.

October 11 update: the connected-history slice is implemented, and reviewed local memory now adds explicit candidate approval, persistence, source/workspace freshness, expiration, deletion and opt-in context through CLI/protocol. See docs/reviewed-memory.md. This does not complete automatic relevance retrieval, team memory, semantic claim validation or editor memory controls.
