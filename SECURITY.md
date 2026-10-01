# oAX security policy

## Status and scope

Foundation controls were implemented and tested on 2026-10-02; the remaining sections specify target requirements unless explicitly stated here. Before public release, maintainers must publish supported versions, a private reporting channel, and a tested security configuration.

The enabled mock workflow uses private parent/child stdio, random-token initialization, validated bounded messages, workspace/session/task identity checks, versioned buffer context, lexical and realpath boundaries (including symlink escape and resolved exclusions), scoped exact-resource grants, in-memory action audit, cancellation, and output limits. Missing, expired, denied, and scope-mismatched grants block operations in tests. No network listener, live provider, editor writes, arbitrary terminal commands, Git mutation, remote posting, or deployment capability is exposed to oAX users.

The developer's permission to build/test/sync this repository is separate from product grants. The current built-in mock engine has no tool surface. The runtime rejects external engines, and the Codex boundary fails closed until transport and execution policy are verified.

Limitations: no general secret-content detection/redaction, credential store, persistent audit, retention configuration, replay, OS sandbox guarantee, or tamper resistance is claimed. Local-process environment tokens do not defend against a compromised local account. Path checks protect captured buffer selection; they are not an implementation of race-safe filesystem edits. Inline secrets in normally named source files may appear in local mock output. The test host trusts only the controlled fixture; the extension itself requires a trusted local workspace.

The first deployment targets a developer-owned local runtime. Local indexing does not mean that model requests or GitHub integrations remain on the device. Disclose what data leaves the workspace and obtain authorization appropriate to that transfer.

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
