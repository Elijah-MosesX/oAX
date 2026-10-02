# Language and implementation boundaries

oAX's versioned JSON protocol is independent of the implementation language. The Node runtime remains the single owner of sessions, permissions, approved writes, verification and event ordering. Additional workers must return bounded evidence rather than execute repository instructions or grant themselves permission.

| Language              | Current evidence                                                                                           | Appropriate next contribution                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript/JavaScript | Actual SQLite graph, semantic local project relationships, Codex context and approved edit/check workflows | Continue runtime/protocol ownership and existing compiler resolution                                                              |
| Java                  | JetBrains action compiled directly against IDEA Community 2025.2.1 SDK using Java 21                       | Finish plugin packaging and actual IDE acceptance; later investigate Java language-service evidence                               |
| Python                | No Python worker or semantic graph parser implemented                                                      | A separately pinned AST/language-service worker returning symbol/import evidence with explicit unresolved calls                   |
| Go                    | No Go worker or semantic graph parser implemented                                                          | A separately pinned compiler/language-service worker returning package/type/call evidence without executing repository generators |

Java implementation of an editor adapter does not establish semantic Java repository analysis. The same distinction applies to Python/Go utilities and analysis of those languages. Merely adding language files would not improve correctness or meet acceptance.

Before adding a parser worker, define versioned input/output schemas, workspace-authorized snapshots, UTF-16 range conversion, bounded input/output, cancellation/deadlines, evidence hashes and semantic/heuristic/unresolved labels. Validate against deterministic fixtures for aliases, duplicate names, unsaved edits, deletion and stale results. Do not load arbitrary project plugins or run build hooks during indexing. Keep reads within the existing authorized workspace and keep provider transmission separately approved.

The next language slice should prove one supported language's selected symbol and cross-file relationships before advertising full-language support. The release gate currently covers the documented TS/JS subset. Python, Java and Go semantic release gates remain open.
