# oAX for VS Code

Local development preview for trusted, local TypeScript/JavaScript workspaces. Requires VS Code 1.105.0 or newer with a compatible Node runtime; 1.105.0 is the verified host. This is not a Marketplace release.

Install the locally built VSIX using **Extensions: Install from VSIX...**, then select code and run **oAX: Explain Selection (Mock)**. Mock responses identify themselves and use the current unsaved buffer. **Find Callers**, **Find Importers**, **Find Implementations**, and **Find Related Tests** return deterministic source evidence. Related tests use filename heuristics. Module resolution currently covers local relative imports, not full project configuration or external dependencies.

**oAX: Explain Selection (Codex)** is opt-in. Set `oax.codexExecutable` in user settings to the absolute path of Codex **0.159.2**, already signed in using the official client. The command previews context and asks before transmitting it. Usage may apply. oAX disables provider environment/tool capabilities and inherited MCP servers in its private subprocess; provider execution does not perform refactors or run commands. Unsupported provider versions fail closed.

oAX displays activity in the status bar and a separate observed-symbol decoration. It does not move your selection. **oAX: Reconnect Runtime** releases connections and starts fresh sessions. Sessions are memory-only; repository indexing is refreshed on observations and commands. Only the selected editor buffer overlays disk; other unsaved editors are not included.

The runtime is bundled and uses authenticated private stdio, with no TCP listener. Exclusions and indexing budgets apply. Source excerpts can still contain secrets despite excluded credential paths; inspect the context before consenting. Local graph storage is experimental Node SQLite. Core explain and relationship commands do not modify source files.

Uninstall through VS Code's extension manager. Rebuild and reinstall the VSIX to update this preview. Report operational failures with command/version information, never credentials or sensitive source. A supported release policy and private vulnerability channel remain prerequisites for publication.

**Rename Symbol with Preview** presents exact before/after text and paths, then requires approval and fresh saved-file baselines. Other dirty affected files must be saved first. Rename preserves semantic references in the supported module model, not arbitrary external consumers. Partial I/O failures are reported without claiming rollback.

**Run Selected Node Tests with Approval** authorizes one saved .test/.spec TypeScript or JavaScript file using the host Node executable. It discloses arguments, cwd and local-account execution rights, captures actual exit status, and supports timeout/cancellation. It does not execute package scripts. **Show Git History Evidence** reads local commits/blame for saved selected code. **Onboard Repository** presents graph evidence and explicitly labeled filename heuristics.
