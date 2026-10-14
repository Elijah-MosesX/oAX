# Codebase intelligence

oAX indexes authorized workspace snapshots into SQLite and answers structural questions without asking a model to invent relationships. VS Code relationship commands use the same runtime graph as the CLI. Provider access is not required.

## Supported source and resolution

The initial language scope is TypeScript and JavaScript: `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, and `.cjs`. Nodes represent files and named functions, methods, classes, interfaces, types and variables. Edges represent containment, imports, exports/re-exports, calls, inheritance/implementation and heuristic test associations. Every edge retains source range/text and a semantic, syntactic, heuristic or unresolved classification. Semantic means a static declaration/module was resolved, not that runtime dispatch or test coverage was proved.

Resolution reads only captured workspace files. It supports relative modules, nearest `tsconfig.json`/`jsconfig.json`, JSONC configuration, one local `extends` chain (maximum eight levels), `baseUrl`, single-wildcard `paths`, and exact workspace package exports. Supported export conditions are direct `types`, `import`, `default` and `require` string targets; a target must exist in the captured sources. Duplicate package names stay unresolved. External libraries/config packages, project references, full include/exclude semantics, wildcard package exports, custom condition combinations, computed module names and dynamic dispatch are outside the verified scope. Python and Java parser support is not yet implemented; allowing these implementation languages does not make their repository graphs available.

## Commands

```powershell
node dist/cli.cjs init
node dist/cli.cjs analyze
node dist/cli.cjs query callers packages/context/src/index.ts 130 16
node dist/cli.cjs query imports packages/context/src/index.ts 130 16
```

Query positions are zero-based UTF-16 coordinates and should point at the desired declaration/reference. Supported queries are `callers`, `imports`, `implements` and `tests`. Results contain the focused node, at most 100 relationships, evidence locations and explicit limitations. `imports` answers which files import the focused file; `tests` uses adjacent `.test`/`.spec` filename evidence and does not claim execution coverage. Source movement can change the example coordinates; use current editor positions.

`analyze` persists the graph under `.oax/graph.sqlite`, using validated versioned configuration, migration 1, foreign keys, indexes and transactions. CLI queries refresh a private runtime session against current saved files; they do not treat a possibly stale persisted graph as current. VS Code overlays the selected document snapshot, including unsaved changes, and runs background refreshes after initial indexing. Other unsaved editors are not overlaid.

## Bounds and freshness

Discovery rejects symbolic links and excludes credentials, private state, dependencies and generated directories. Limits are 20,000 discovered directory entries, 2,000 source files, 256 project metadata files, 128 KiB per captured file and 8 MiB combined source/metadata content. Overlays share the content budget. Exceeding a limit produces an actionable error; oversized files are listed as excluded.

Changes to source or project metadata, deletion, rename and branch content changes invalidate relationships. Unchanged source ASTs/file records are reused; semantic edges reconcile globally for correctness. Session refreshes are serialized. `Show Continuous Index Status` reports generation/counts/freshness and errors. A failed refresh does not claim the old graph is fresh. Session closure stops background work before closing SQLite.

The next in-memory source/compiler/symbol state is published only after the SQLite transaction commits. A database failure leaves the committed graph and focused-symbol snapshot intact; the next successful refresh recognizes and applies the pending change. A controlled SQLite trigger failure verifies this recovery behavior in the normal test suite.

## Acceptance evidence

`tests/integration/repository-graph.test.ts` indexes this actual oAX repository through the built authenticated stdio runtime and CLI. It verifies callers of `offset`, files importing the context package, and both `MockAgentEngine` and `CodexAgentEngine` implementations of `AgentEngine`, with semantic evidence. Deterministic fixtures cover aliases, exports, unresolved/ambiguous targets, configuration invalidation, module extensions, overlays and rename/deletion. The editor suite separately verifies current code, actual open tabs and an evidence-backed decoration without moving the developer selection. Exact outcomes are recorded in `PROGRESS.md`; this milestone does not establish a supported public release.
