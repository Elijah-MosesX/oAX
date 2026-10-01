# Codex boundary verification — 2026-10-02

Official source inspected: [Codex App Server](https://learn.chatgpt.com/docs/app-server). The provider boundary is `packages/codex`; core runtime does not speak its RPC protocol.

The current documentation supports stdio, an initialize/initialized handshake, thread and turn operations, streamed notifications, interruption, and approval handling. App-server generates TypeScript and JSON schemas for the installed version. Use those generated contracts when implementing transport, and pin the verified Codex version then. Account connection in this development chat does not configure or authenticate oAX users.

`CodexAgentEngine` is explicitly disabled and fails closed. No process is launched, no context transmitted, and no provider tools enabled. The runtime refuses external engines in this foundation. Neither live inference nor tool permission enforcement is verified.

Next provider work: choose and pin an installed version; generate its schemas; verify authentication without logging secrets; implement injected transport and deterministic lifecycle fixtures; enumerate and restrict every enabled tool path; enforce oAX grants at actual execution boundaries; then run opt-in live explain and controlled refactor acceptance tests. Read-only sandbox settings alone do not establish command execution authorization or scoped read protection.
