# Buddy experience

Buddy is a read-only projection of oAX sessions. Open **oAX: Show Buddy** to see the Explorer pane. **Hide Buddy** hides the pane and status item without cancelling tasks, disconnecting the runtime or changing authorization. The setting persists per workspace.

The native VS Code tree provides text labels, keyboard navigation and theme icons. Each workspace/provider session has a separate entry. The mock engine is explicitly labeled. No avatar or animation implies unseen agent behavior.

| Evidence                                              | Presentation                                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| Session opened                                        | Ready, connected, workspace and provider                                      |
| `task.state`: created/gathering_context/planning      | Task created/Gathering context/Planning                                       |
| `task.state`: executing/verifying                     | Working/Verifying task                                                        |
| `task.state`: awaiting_approval                       | Awaiting runtime approval                                                     |
| Actual production Quick Pick                          | Input requested, concrete prompt, default Cancel                              |
| `agent.activity`                                      | Separate turn/message/tool activity; item completion never completes the task |
| `task.state`: completed/failed/cancelled              | Task completed/Task failed/Task cancelled                                     |
| Actual approved `refactor.apply` request and response | Applying approved edit, then applied/unverified or failed                     |
| Actual `review.get` response                          | Current/incomplete, failed, stale, or last observed verified review           |
| Runtime disconnection                                 | Disconnected, stale location cleared                                          |
| Accepted `agent.cursor.changed`                       | Hash/version-validated observed location                                      |

The protocol's actual `task.state`/`agent.activity` names replace the blueprint's illustrative `agent.started` and `agent.permission.requested` names. Buddy does not invent protocol methods or inspect provider reasoning. Prompt state comes from the editor presenting an actual decision; it is a presentation overlay and does not transition a runtime task or grant permission.

Click the prompt to reopen the real Quick Pick. Buddy cannot choose or accept it. Click an observed location to reveal that existing document; its content hash/version is checked again and developer selection is preserved. Location changes never automatically navigate the editor. Buffer edits clear prior locations. Reconnect discards the old session projection.

Results remain observations of session-local evidence. Task completion does not mean tests passed. Only the runtime's matching applied-edit/test review establishes verification. Source/test edits invalidate the displayed result; external disk changes require a fresh review. A previously displayed verified result is labeled **Last observed review**, not continuous verification. General multi-file model edits and arbitrary provider tools remain unavailable.

`packages/buddy` has no execution, policy, credentials, editor or provider dependency. It consumes public typed events and actual adapter presentation receipts. Snapshots are detached copies. Unknown sessions, foreign workspaces, duplicate/out-of-order events and late events from earlier tasks cannot replace the current projection. Retention is bounded to 32 presentation sessions and 21 result paths. Eviction affects the view only. Source excerpts, streamed model text, tool arguments, tokens and error details are not stored in Buddy. The existing output and review documents retain their documented privacy limitations.

## Optional voice assessment

Voice is deferred. The core interaction remains usable through native text commands, prompts, output and review documents; no microphone permission, capture, transcription service or voice networking is enabled.

A future voice implementation must provide explicit start/stop and recording indication, a text alternative, consent before external transcription, inspectable transmission/retention settings and credential storage through platform facilities. Spoken intents must route to the same runtime commands and exact-plan approvals. Transcription cannot grant permission or silently accept a displayed edit/test plan. Cancellation must distinguish stopping microphone capture from cancelling an agent task. Validate keyboard/screen-reader use, noisy input, accidental activation, connectivity loss and sensitive-content handling before enabling a backend. Selecting a backend and verifying its supported authentication/API are future work; no voice provider or entitlement is assumed.
