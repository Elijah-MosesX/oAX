# Shared runtime and access surfaces

Interfaces reuse the same graph, context contracts, permissions and agent orchestration. An interface owns input and presentation; it does not create a competing agent harness. A shared design does not imply a shared server, tenant or account.

| Surface             | Current implementation                                                                                    | Verified boundary or remaining acceptance                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| VS Code             | Installed extension, separate cursor, Buddy, live explain, approved edits/checks and review               | Prior installed VS Code 1.105.0 acceptance; no new editor code in this slice                                                     |
| CLI                 | Repository intelligence, history, explain, rename, verification and review                                | Real repository and runtime integration tests                                                                                    |
| Neovim              | Read-only adapter over protocol 0.1                                                                       | Prior actual second-editor graph acceptance; explanations explicitly mock-only                                                   |
| Vim                 | Vimscript read-only adapter over the same private bridge                                                  | Actual Vim 9.2.1162 unsaved callers, UTF-16, visible windows, preserved cursor, denied writes and cleanup                        |
| Chrome extension    | Manifest V3 loopback workbench launcher                                                                   | Five-file package and actual enabled registration in dedicated Chrome; personal-profile install is manual                        |
| Public PWA          | AppDeploy evidence viewer for bounded exported ContextSlices                                              | Actual browser import/rejection/clear/reload acceptance; no cloud agent or local runtime access                                  |
| JetBrains           | Java protocol client and action prototype                                                                 | Java compilation passed previously; Gradle packaging and live IDE acceptance remain blocked                                      |
| Local web workbench | Saved source, selection, symbol/callers, inspectable context, local history, onboarding and public events | Real runtime HTTP acceptance and browser interaction on oAX source                                                               |
| Desktop window      | Dedicated Chrome app window over the same local workbench                                                 | Portable Windows ZIP, real relocated runtime and app authentication/cleanup verified; signed/cross-platform releases remain open |
| GitHub intelligence | Session-scoped selected-repository read adapter                                                           | Deterministic authorization tests; live product credentials pending                                                              |
| GitHub App agent    | Intended installation/webhook/review surface                                                              | Not implemented or installed; needs repository-scoped App credentials, signed/idempotent webhooks and distinct approved writes   |
| Enterprise web      | Intended team deployment                                                                                  | Not implemented; needs identity, tenant isolation, policy, retention, audit, operational/recovery acceptance                     |

## Run the local workbench

```powershell
pnpm build
node dist/workbench.cjs <workspace-root>
# Optional dedicated desktop app window after browser setup:
node dist/workbench.cjs <workspace-root> --desktop
```

The workbench prints a single-use link valid for five minutes. It binds only `127.0.0.1` on a random port. Open the link, enter a workspace-relative source path, select a symbol in the read-only text pane, and request evidence. Source versions advance when the saved bytes change. `openFiles` represents the workbench's actual single source pane. It does not capture IDE unsaved state; use the IDE adapter for that.

HTTP requests authenticate a private owned `RuntimeClient` and session, using the existing validated protocol. The bootstrap is removed from browser history immediately after loading and exchanged for an HttpOnly SameSite cookie plus an in-memory CSRF token. Host/origin checks, bounded requests, a strict CSP and a method allowlist prevent exposing writes, credential routes or provider transmission. The local HTTP cookie deliberately lacks `Secure` because this loopback preview uses HTTP; never bind it publicly or place it behind a public reverse proxy. It is a single-user development surface, not enterprise authentication.

Agent presence is driven solely by actual public runtime events. No synthetic agent cursor is shown for graph queries, and the workbench does not advertise live model explanations or edits. Use the existing VS Code/CLI approval workflows for those operations. Chrome/Jev browser observation remains an explicit CLI adapter rather than an automatically injected provider tool.

Desktop mode launches only the dedicated installed Chrome for Testing with a fresh owned profile. Closing that window closes its runtime and removes that profile. A portable Windows x64 distribution bundles verified Node and this same runtime; signed installers remain pending. See docs/desktop.md. No personal Chrome profile, sync login or microphone is used.

The supplied Taste/Anti-slop guidance explicitly excludes dashboard-style applications; no landing-page-only rules were applied. Brandit's brand-board workflow was not invoked because no image board was requested. The frontend and hardening documents inform the restrained evidence layout, accessible controls, content boundaries and transport controls. Attached documents cannot grant runtime permissions.
