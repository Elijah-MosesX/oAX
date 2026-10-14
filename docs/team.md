# Shared repository knowledge

The hosted service is [oAX Shared Knowledge](https://oax-shared-knowledge-omcqtl.v2.appdeploy.ai/). It is a separately deployed collaboration surface over the canonical exported ContextSlice contract. It does not run the local runtime in the cloud or automatically connect to an IDE.

## Practical workflow

1. Install the VS Code preview or build the CLI from `codex/local-intelligence-preview`, following README. Index your authorized repository. Use deterministic relationships, or separately authorize Codex explanation/refactoring and tests.
2. For evidence sharing, start `node dist/workbench.cjs <workspace-root>`, select a symbol, inspect context, and export the displayed evidence. Review excerpts before sharing.
3. Open the hosted service in Chrome or Edge and sign in through its provider popup. Create a private room using a repository label such as `owner/repository`. This label is not proof of GitHub access.
4. Publish a reviewed finding, question or decision, optionally attaching the bounded evidence JSON. Sharing requires an explicit checkbox. Source ranges, document version and unsaved status remain visible as historical snapshot evidence.
5. Create an invitation for a specific teammate's email, selecting reader or contributor. Share the generated link yourself. Invitations expire after 24 hours; access is rechecked on every content operation. Manage saved invitations to revoke one after a reload.
6. Keep a room open for WebSocket invalidation updates followed by authenticated reads. Use Refresh or Reconnect subscription after a connection failure. These are knowledge updates, not shared editor buffers or execution grants.

Contributors can add independent entries and retract their own; owners can retract any entry. Readers cannot publish. Retraction removes the active body/evidence while retaining a tombstone; recipients' copies cannot be recalled. Room owners are not automatically authorized to read any participant's GitHub repositories or execute commands on their machine.

## Voice and credentials

Optional dictation requires browser-speech consent and microphone permission. It produces a draft, never automatic publication. Stop and Cancel are explicit; room navigation and sign-out cancel audio. Browser speech recognition may send audio to the browser's provider. Read-aloud selects only a browser-reported local English voice and reports unsupported availability. Typed text remains available. Live microphone and speaker acceptance has not been completed. These controls currently belong to this hosted surface, not VS Code or the desktop Buddy.

The optional GitHub check accepts a fine-grained token restricted to the selected repository with Metadata read. It makes a bounded fixed-origin metadata GET through the backend, without persisting the credential. It is not OAuth, a GitHub App installation, or the local runtime's history connection. Do not send tokens in chat. Live authenticated product verification remains pending.

[Terms](https://oax-shared-knowledge-omcqtl.v2.appdeploy.ai/#/terms) and [Privacy](https://oax-shared-knowledge-omcqtl.v2.appdeploy.ai/#/privacy) describe the current service. They are operational drafts: operator identity/contact, jurisdiction, support and retention/account-deletion arrangements need finalization before general availability. The sign-in popup links to these pages.

## Implementation and evidence

Source: `deployments/team`. AppDeploy supplies React/Vite hosting, SDK authentication, invitations, database and WebSocket transport. The frontend uses its API client; private routes use its authentication middleware and enforce room/role checks. No hand-rolled authentication or client-supplied identity is trusted. Canonical `apps/evidence/src/validate.ts` and `packages/protocol/src/browser.ts` are copied by `node scripts/prepare-team.mjs` into the deployment payload, changing only the validator import path.

Private socket messages carry only room invalidation IDs. Content fetches reauthorize, including invitation expiration/revocation. Socket subscriptions expire after one hour and renew while open. Published entries use separate generated record IDs, so concurrent additions do not overwrite one another. This is not a transactional collaborative editor. The application does not claim exactly-once writes: after an ambiguous network failure, refresh before retrying a publication.

`tests/team.test.ts` executes the actual bundled handlers with injected SDK fixtures. It verifies missing authentication, room isolation, role checks, invitation revocation, persistent owner revocation handles, concurrent entries and source-free socket messages. `tests/voice.test.ts` checks consent, bounded final transcription and rejection of late cancelled results. These are deterministic tests, not proof of live identity or microphone operation. Five deployed QA scenarios specify owner, reader, contributor, mobile and failure workflows; deployment status did not report their execution results.

The deployed landing/Terms navigation and error-free deployment status were observed. The embedded browser did not open the sign-in popup. The owner subsequently confirmed successful product sign-in and reaching Your repositories in their browser; this is user-reported evidence, not automated owner-workflow acceptance. Persistent room/publication acceptance is being checked separately. Independent multi-user acceptance needs a second distinct account. One account in two windows does not satisfy that gate.

## Remaining platform work

Automatic device/IDE pairing, cross-machine spatial streams, shared agent invocation, offline merge/conflict handling, organization identity/SSO, quotas, monitored support, configurable retention and account deletion remain open. Sharing reviewed exports is the current integration. Universal IDE compatibility, Python/Java/Go semantic indexing and a complete enterprise platform are not delivered by this service.

## Screen lens and recovery update

The redesigned workspace separates Knowledge, Screen lens, Team access and GitHub connection. Screen lens captures one user-selected display/window/tab frame, stops capture, previews a bounded JPEG and requires explicit provider transmission consent. AppDeploy AI returns structured visible observations, suggestions and uncertainty; no exact source location is invented. The image is not persisted as a room entry. A user may transfer the analysis into a draft and separately approve publication. `tests/vision.test.ts` and the actual handler fixture verify media/approval/result bounds. Real microphone, screen capture/provider and two-account acceptance are still pending.

A socket connection deadline now leaves saved room operations accessible through Refresh. Storage quota responses retain HTTP 429 with a visible wait/check-before-retrying message. Screen playback deadlines are cleared and error copy acknowledges that an approved image may already have reached the provider. Snapshot 1791035575618 is deployed and ready; returned frontend/backend/network error arrays are empty, but no E2E execution result was returned.

## Connected context update - 2026-10-12

Shared Knowledge now accepts and displays bounded historical excerpts and up to five explicitly selected reviewed notes, including evidence/source hashes, ranges, eligibility timestamps and untrusted-claim labels. The canonical validator is shared with the browser-only viewer and oAX1. Current source freshness is not inferred from an export. Deployment readiness and deterministic room-handler coverage passed; this slice does not add automatic agent sharing or establish new live multi-user acceptance.
