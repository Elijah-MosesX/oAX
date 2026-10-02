# Integration review — 2026-10-02

The supplied Repository Integration Guide is design guidance. Its installation
suggestions do not establish implemented functionality or execution permissions.
The current product retains one runtime, protocol, policy and graph across surfaces.

| Recommendation   | Evidence and decision                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex App Server | Existing pinned, text-only adapter and real installed VS Code acceptance; provider tools fail closed.                                                       |
| VS Code samples  | Existing native decoration, approval and editing implementation; examples are reference material, not a runtime dependency.                                 |
| TypeScript       | Pinned 5.9.3 compiler/language service performs semantic indexing.                                                                                          |
| Tree-sitter      | Additional-language parsing remains an explicit gap. Installing a parser would not prove calls or implementations.                                          |
| better-sqlite3   | Node 24's built-in SQLite already implements transactional graph storage; avoiding a second native driver preserves portable packaging.                     |
| Chokidar         | Existing serialized, bounded polling handles changed/deleted/renamed content. Native event watching is an optimization requiring its own correctness tests. |
| Ajv              | Existing strict Zod schemas validate protocol input and generate JSON schemas. A second validator requires compatibility evidence before replacement.       |
| Octokit          | Existing narrowly scoped GitHub GET adapter has deterministic permission and response tests; live product credentials remain pending.                       |
| MCP SDK          | Pinned 1.31.0 with verified Chrome DevTools MCP 1.10.1.                                                                                                     |
| Vitest           | Existing Node test runner has deterministic unit, integration and installed-editor acceptance; no duplicate runner is necessary.                            |
| Playwright       | Browser interaction and installed-editor acceptance already exist. Cross-browser Playwright acceptance remains additional work.                             |
| Jev              | Installed pinned Python planner, actual MCP-to-action-space acceptance; live TypeSafe prediction and action execution remain separate gates.                |
| Lean             | Optional precisely modeled proofs remain unimplemented; no formal verification claim.                                                                       |

## Acceptance gaps across the original scope

The tracker contains historical checkpoint results, not a certification of every
planned feature. VS Code live explain/approved selection edit/Node verification,
graph intelligence, local history, Buddy and a second editor were evidenced.
Remaining platform gates include live repository-scoped GitHub authentication,
GitHub App/webhooks, JetBrains packaging/live acceptance, additional semantic
languages, voice, arbitrary multi-file edits, team identity/isolation and managed
deployment. Signed desktop installers and cross-platform acceptance are also open.

Other developers' local repositories use workspace-specific sessions/graphs,
bounded supported-language discovery and read-only analysis. Repository scripts
are never run merely because a repository is readable. Write/test plans and remote
publication have distinct authorization boundaries. No dependency repository is
vendored into application source or silently forked.

## Current surface implementation checklist

- Make the authenticated local workbench installable with a manifest and static-only
  service worker; never cache source, context, cookies, bootstrap URLs or POSTs.
- Add a Chrome Manifest V3 launcher that accepts only explicitly entered loopback
  workbench links and requests no browsing/content/host permissions.
- Install verified portable Vim and pinned Vimium in owned tool folders; preserve
  personal editor settings and browser profiles.
- Deploy an installable evidence viewer through AppDeploy. It reads exported bounded
  evidence locally; it cannot reach this computer's loopback runtime from public HTTPS.
- Keep public source free of private repository excerpts, credentials and acceptance
  fixtures; verify JSON validation, clearing/error states and mobile behavior.

## AppDeploy preflight

Use frontend-only/html-static for deterministic evidence viewing, with no AI/API
requests. Include required model/intent/initiator/type fields, template diffs/new
files only, and three to five coverage-complete tests with exactly one sanity
workflow. Inspect deployment, QA and runtime outcomes until terminal status.
No attached archives are public app assets. Imported evidence stays in memory and
is cleared on request/reload; service-worker storage contains public shell assets only.
