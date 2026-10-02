# oAX security policy

## Status and scope

Implemented local controls include authenticated private stdio, bounded validated messages, workspace/session isolation, versioned selected-buffer context, lexical/realpath exclusions, index budgets, scoped exact-resource grants, memory-only audit, output limits, and cancellation. The extension requires trusted local workspaces. No listening socket exists.

Codex text is opt-in and pinned to 0.159.2. Effective disabled tool features, empty environment selection, read-only/no-environment-network settings, no repository instruction sources, and process-only disabled MCP servers are verified before a turn. Every provider-originated request fails closed. Context transmission requires a matching preview hash and scoped grant at execution. Existing login is used without credential changes; network inference may consume usage. Provider/model networking is distinct from the disabled environment network. General provider tools are unavailable.

Saved-file rename is explicit approval of exact before/after content and paths. Every baseline/grant is checked before the first write, then path/file identity and hash are checked again per write. Symbolic or multiply linked files are rejected. Completed or partial I/O writes are reported and are not automatically rolled back. These checks reduce path races but do not establish race-proof isolation against a malicious local account. Syntax checks do not execute repository code or establish semantic/API compatibility. Arbitrary commands, Git mutation, remote posting, deployment and access changes are not exposed. A separate exact-plan approval enables saved Node test files with local-account rights, restricted environment, five-second timeout and bounded output; this is not an OS sandbox.

Local Git evidence is scoped to the workspace and uses fixed arguments, no shell, no pager, no text conversion, bounded output, and no network or mutation. Default workspace/Git reads are within the explicitly opened root; they do not authorize provider transmission or writes.

Limitations: no comprehensive secret-content redaction, credential store, persistent/tamper-resistant audit, configurable retention, event replay, OS sandbox guarantee, or tenant isolation. Inline secrets in normal source names can appear in context/output; inspect the preview before sending. SQLite is experimental. The polling watcher is independently tested but not attached to runtime sessions. A private reporting channel and supported-version/security policy must be established before public release.

The developer's authorization to implement/test/sync oAX is separate from product grants. Connecting GitHub in this chat does not implement oAX's GitHub integration. The first distribution is a local VS Code/CLI preview; no publication or deployment is claimed.

## Permission model

Separate reading, editing, executing, Git mutations, and remote actions. Policies must be evaluated at the actual tool or operation boundary.

| Operation                                           | Initial policy                       | Scope and requirements                                   |
| --------------------------------------------------- | ------------------------------------ | -------------------------------------------------------- |
| Read workspace files                                | Allow within configured scope        | Respect exclusions and sensitive-file restrictions       |
| Read local Git history                              | Allow within workspace               | No mutation; redact sensitive results                    |
| Read GitHub data                                    | Allow only after explicit connection | Selected repositories and least-privilege credentials    |
| Send context to a provider                          | Require configured authorization     | Disclose destination, data scope, and exclusions         |
| Edit workspace files                                | Ask unless already granted           | Specific task, paths, and operation limits               |
| Run terminal commands/tests                         | Ask unless already granted           | Command, arguments, cwd, environment, and side effects   |
| Commit or mutate Git state                          | Ask                                  | Exact repository and operation; separate from editing    |
| Push, open PRs, or post reviews                     | Ask                                  | Exact remote destination and public/team-visible content |
| Delete data, rewrite history, deploy, change access | Explicit approval                    | Concrete consequence and recovery options                |

An existing valid grant can authorize subsequent actions within its stated scope. Do not request repeated approval for the same authorized operation. Deny by default when a required grant is absent or invalid. Reading an untrusted repository does not authorize execution of its scripts.

## Grant requirements

Bind grants to principal, workspace, session/task, capability, resource scope, and expiration. For execution, include the command and relevant execution context. For remote operations, include repository and destination. Record request and decision IDs and invalidate authorization when the action materially changes.

The approval UI must show what will occur and relevant side effects. A refactor plan approval does not authorize arbitrary commands, credential access, publishing, or unrelated files. Cancellation or denial prevents pending actions. Never silently elevate privileges or reroute a denied action through another provider or tool.

## Provider and runtime boundary

Do not equate an oAX approval display with enforcement. Restrict provider execution using supported controls, intercept relevant approval requests, and validate every tool path. Disable capabilities that cannot satisfy oAX policy. Document the provider's actual isolation and permission behavior; do not advertise sandbox guarantees without tests.

Authenticate local runtime connections, bind to local interfaces by default, and reject unauthorized clients. Validate schema, message size, workspace identity, and capability at ingress. If a network service is introduced, add transport security, identity, authorization, and tenant isolation before enabling shared access.

## Workspace safety and untrusted content

Normalize paths and verify resolved locations, including symlinks, against authorized roots. Handle time-of-check/time-of-use races where operations can change targets. Limit indexing and payload size. Respect exclusions for dependencies, generated output, credentials, and private directories.

Treat source, documentation, Git history, issues, reviews, and tool responses as untrusted context. They may contain instructions designed to redirect an agent. Keep them separate from trusted policy; they cannot grant permissions or alter security settings.

Before edits, preserve unrelated changes and detect document-version conflicts. Prefer reviewable diffs and isolated workspaces where practical. Test commands can execute arbitrary repository code and must be authorized accordingly.

## Credentials

Use operating-system credential storage or an appropriate secret manager where available. For development, environment variables may be used if they are not logged or committed. Store references rather than secret values in project configuration.

Never commit access tokens, API keys, passwords, private keys, or authenticated URLs. Exclude `.env` files, local credential files, and private `.oax` data from version control. Examples must use obvious placeholders. Redact credentials from diagnostics, crash reports, prompts, and screenshots.

Prefer short-lived and least-privilege credentials. An oAX GitHub App should request only permissions needed for enabled features. Rotate and revoke exposed credentials immediately; deleting a committed secret does not revoke it or remove it from history.

## Data, logs, and retention

Minimize provider context and retain provenance without unnecessary code copies. Define configurable retention for graph caches, context snapshots, and session logs. Provide a documented deletion procedure and explain its limits for provider or remote retention.

Audit permission requests, decisions, action attempts, actual outcomes, errors, and cancellations using correlation IDs. Avoid raw secrets and unnecessary source in audit records. Local logs are not inherently tamper-proof; do not claim tamper-resistant auditing without a designed and tested mechanism.

## Dependencies and releases

Pin dependencies with a lockfile, review installation scripts, and run appropriate dependency checks. Protect release credentials, verify packaged contents, and test extension/runtime compatibility. The repository uses the MIT license. Establish the distribution policy before release. Evaluate provider terms, authentication, data handling, and usage costs before commercial deployment.

## Reporting vulnerabilities

No private security address or reporting URL has been designated yet. The owner must configure a monitored private channel before public distribution, preferably the repository's private vulnerability reporting feature if available.

If a private channel is available, report affected version/commit, impact, minimal reproduction, and sanitized evidence there. Do not put secrets, private repository contents, or exploit details in a public issue. If no channel exists, ask the maintainer privately to establish one before sharing sensitive details.

Acknowledgment targets, remediation deadlines, supported releases, and disclosure timelines remain to be established. No response-time guarantee is made by this document.

## Release security acceptance

Verify denied actions cannot execute, path restrictions resist traversal and symlink escape, secrets are redacted, provider tools obey policy, cancellation stops pending work, and published documentation accurately describes data transmission and isolation. Record evidence in `PROGRESS.md` before claiming these controls are operational.

## Optional browser and local data

The pinned Chrome DevTools MCP adapter uses a dedicated temporary profile, exact approved origin patterns and owned page IDs. Evaluation, input, screenshots and arbitrary tools are disabled. Telemetry and CrUX requests are explicitly disabled. Redirect/subresource isolation is verified against controlled loopback fixtures; browser processes retain local-account rights. Browser evidence is not sent to Codex.

Known token formats and labeled credentials are conservatively redacted in provider context and captured verification/browser output. This is not comprehensive secret detection. CLI SQLite graph data includes bounded source evidence; .oax is ignored but contains private data. Closing editor sessions clears in-memory graph/session state; persisted CLI graphs and browser downloads remain until the user removes the workspace's .oax directory. Removal is not secure erasure and does not alter provider retention.
