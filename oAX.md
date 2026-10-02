# oAX — Complete Product & Engineering Blueprint

**Version:** 0.1  
**Status:** Build blueprint / canonical project plan  
**Primary coding engine:** OpenAI Codex  
**Initial IDE:** VS Code  
**Initial runtime:** TypeScript / Node.js  
**Initial transport:** JSON-RPC / JSONL over stdio  
**Initial persistence:** SQLite  
**Repository:** `oax/`

---

## 1. Product Definition

oAX is a **context-aware developer agent operating layer**.

It is not merely an IDE extension and it is not a replacement for Codex. oAX owns the product-level context, spatial awareness, codebase intelligence, permissions, orchestration, Git/GitHub intelligence, memory, and developer experience. Codex is the primary agentic coding engine.

### Core promise

oAX should understand:

- where the developer is working,
- what code is visible and selected,
- what symbol the developer is focused on,
- how that code relates to the rest of the repository,
- what changed recently,
- why a piece of code may exist,
- what the developer is trying to accomplish,
- what the agent is currently doing,
- and what actions require approval.

The result is an agent that feels embedded in the development environment rather than a chat window bolted onto an editor.

---

## 2. Product Principles

1. **Thin adapters, thick protocol.**
2. **Runtime owns state; UI renders state.**
3. **Codex is an engine, not the product architecture.**
4. **Spatial context is first-class.**
5. **The agent cursor is a first-class protocol concept.**
6. **Codebase intelligence is deterministic where possible.**
7. **Context is selected, not dumped.**
8. **Permissions are explicit and auditable.**
9. **Git/GitHub history is part of code understanding.**
10. **Every consequential action should be inspectable.**
11. **Start local and simple; add remote/distributed infrastructure only when justified.**
12. **Build evaluation into the product from the beginning.**

---

## 3. Target Architecture

```text
Developer
   |
   v
+---------------------------+
|          oAX UX           |
| Buddy / Agent Cursor      |
| Chat / Graph / Diff       |
+-------------+-------------+
              |
              v
+---------------------------+
|       OAX PROTOCOL        |
| Events / Commands / State |
+-------------+-------------+
              |
              v
+---------------------------+
|        OAX RUNTIME        |
| Context / Spatial /       |
| Memory / Policy /         |
| Sessions / Orchestration  |
+------+------+------+------+
       |      |      |
       v      v      v
  Code Graph Git/Hub Workspace
       \      |      /
        \     |     /
         v    v    v
+---------------------------+
|      CODEX INTEGRATION    |
| App Server / SDK boundary |
+-------------+-------------+
              |
              v
       Agent tool environment
```

OpenAI's current documentation distinguishes the managed Codex harness, the environment where code/files execute, and the application server that connects the harness to a product. For an embedded product experience, current OpenAI guidance specifically points to Codex app-server; the official SDK is also a programmatic integration option. oAX should isolate this behind its own `AgentEngine` interface so the rest of oAX remains Codex-independent. [OpenAI architecture](https://developers.openai.com/api/docs/guides/agents-api/architecture)

---

## 4. Why oAX Exists Beside Codex

Codex provides the agentic coding capability. oAX provides the surrounding developer operating layer.

### oAX owns

- workspace identity
- editor/spatial state
- context relevance
- codebase graph
- repository indexing
- Git history
- GitHub history
- permissions
- session state
- agent lifecycle
- agent cursor
- Buddy presence
- memory
- orchestration
- evaluations
- UI-independent event/state model

### Codex owns

- coding-agent loop
- model interaction
- tool use inside its harness
- code generation/editing/reasoning
- agent execution mechanics exposed through its integration surface

This separation prevents oAX from becoming tightly coupled to one vendor's internal objects.

---

# 5. Repository Structure

```text
oax/
├── apps/
│   ├── cli/
│   ├── desktop/
│   └── web/
│
├── adapters/
│   ├── vscode/
│   ├── jetbrains/
│   ├── neovim/
│   └── generic-lsp/
│
├── packages/
│   ├── protocol/
│   ├── runtime/
│   ├── context/
│   ├── spatial/
│   ├── codegraph/
│   ├── git/
│   ├── github/
│   ├── permissions/
│   ├── memory/
│   ├── orchestration/
│   ├── codex/
│   └── tools/
│
├── services/
│   ├── indexer/
│   ├── analyzer/
│   ├── watcher/
│   └── sync/
│
├── schemas/
│   ├── oax.schema.json
│   ├── events.schema.json
│   ├── context.schema.json
│   └── graph.schema.json
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── evals/
│
├── docs/
│   ├── architecture.md
│   ├── protocol.md
│   ├── permissions.md
│   └── evaluations.md
│
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
└── README.md
```

### First implementation subset

Do not create every service immediately. Start with:

```text
apps/cli
adapters/vscode
packages/protocol
packages/runtime
packages/context
packages/spatial
packages/codegraph
packages/git
packages/github
packages/permissions
packages/codex
services/indexer
services/watcher
schemas
tests/evals
```

---

# 6. Bootstrap Commands

```bash
mkdir oax
cd oax

git init
pnpm init
mkdir -p apps/cli adapters/vscode packages services schemas tests/evals docs
```

Recommended initial package manager:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

Then create the workspace packages.

Suggested dependency categories:

- TypeScript
- Zod
- Tree-sitter bindings
- SQLite driver
- Git library or Git CLI wrapper
- GitHub API client
- VS Code extension API
- test runner
- JSON-RPC utilities

Keep dependencies minimal until a real use case requires them.

---

# 7. Protocol v0.1

The oAX protocol is the stable boundary between adapters, runtime, UI, and agent engines.

## Common message envelope

```ts
export type OaxMessageType =
  | "request"
  | "response"
  | "event"
  | "notification";

export interface OaxMessage<T = unknown> {
  id: string;
  version: "0.1";
  type: OaxMessageType;
  method: string;
  timestamp: string;
  workspaceId?: string;
  sessionId?: string;
  agentId?: string;
  payload?: T;
  metadata?: {
    correlationId?: string;
    source?: string;
  };
}
```

## Capability negotiation

```json
{
  "protocol": "0.1",
  "capabilities": [
    "spatial.cursor.v1",
    "codegraph.v1",
    "agent.events.v1",
    "agent.cursor.v1"
  ]
}
```

Protocol namespaces:

- `oax.protocol/0.1`
- `oax.context/0.1`
- `oax.agent/0.1`
- `oax.graph/0.1`

---

# 8. Spatial Context

Spatial context is one of the core differentiators.

```ts
export interface Position {
  line: number;
  column: number;
}

export interface TextRange {
  start: Position;
  end: Position;
}

export interface FileLocation {
  path: string;
  uri?: string;
}

export interface SymbolRef {
  id?: string;
  name: string;
  kind:
    | "file"
    | "class"
    | "function"
    | "method"
    | "variable"
    | "interface"
    | "type"
    | "module";
  file: string;
  range?: TextRange;
}

export interface SpatialContext {
  activeFile?: FileLocation;
  cursor?: Position;
  selection?: TextRange;
  visibleRanges?: TextRange[];
  focusedSymbol?: SymbolRef;
  hoveredSymbol?: SymbolRef;
  openFiles?: FileLocation[];
  activeTerminal?: string;
}
```

The VS Code adapter should continuously publish only meaningful changes, not every editor repaint.

Events:

- `spatial.cursor.moved`
- `spatial.selection.changed`
- `spatial.file.focused`
- `spatial.symbol.focused`
- `spatial.editor.changed`
- `spatial.window.changed`

---

# 9. Agent Cursor

The human cursor and agent cursor must be separate.

```ts
export interface AgentCursor {
  id: string;
  file: string;
  line: number;
  column: number;
  mode:
    | "observing"
    | "investigating"
    | "editing"
    | "testing";
  label?: string;
}
```

The adapter renders the agent cursor.

Semantics:

- observing = agent is looking at this location
- investigating = agent is tracing relationships
- editing = agent is modifying this area
- testing = agent is validating behavior

Event:

```text
agent.cursor.changed
```

---

# 10. Context Model

oAX must not dump the entire repository into the model.

Instead it constructs a relevant context slice.

```ts
export interface OaxContext {
  workspace: WorkspaceContext;
  spatial: SpatialContext;
  code?: CodeContext;
  git?: GitContext;
  github?: GitHubContext;
  session?: SessionContext;
}

export interface ContextSlice {
  objective: string;
  spatial?: SpatialContext;
  files: FileContext[];
  symbols: SymbolContext[];
  graphPaths?: GraphPath[];
  history?: HistoryContext[];
  github?: GitHubContext[];
}
```

## Context Relevance Engine

Pipeline:

```text
User request
     |
     v
Intent detection
     |
     v
Spatial context
     |
     v
Focused symbol
     |
     v
Graph expansion
     |
     v
Git/GitHub history if relevant
     |
     v
Context ranking
     |
     v
Small ContextSlice
     |
     v
Codex
```

Rules:

- Prefer focused code.
- Prefer direct dependencies.
- Prefer tests related to the target.
- Prefer recent relevant changes.
- Include history when the request contains “why”, “introduced”, “changed”, “regressed”, or similar intent.
- Avoid unrelated repository content.
- Record why context was selected.

---

# 11. Codebase Graph

Start with SQLite/relational storage.

```sql
CREATE TABLE nodes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    path TEXT,
    metadata JSON
);

CREATE TABLE edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relationship TEXT NOT NULL,
    metadata JSON
);
```

## Initial node types

- Repository
- Workspace
- Directory
- File
- Symbol
- Function
- Class
- Interface
- Variable
- API
- Database
- Service
- Test
- Commit
- Branch
- PullRequest
- Issue
- Developer

## Initial relationships

- contains
- imports
- exports
- calls
- implements
- extends
- depends_on
- tested_by
- changed_by
- introduced_by
- reviewed_in
- discussed_in
- related_to

Initial questions:

- What calls this?
- What imports this?
- What implements this?
- What tests this?
- What changed this?
- What PR introduced this?

Do not begin with Neo4j or another dedicated graph database.

---

# 12. Indexing Pipeline

```text
Repository
    |
    v
File discovery
    |
    v
Language detection
    |
    v
AST parsing
    |
    v
Symbol extraction
    |
    v
Dependency extraction
    |
    v
Code Graph
```

Recommended deterministic tools:

- Tree-sitter for parsing
- LSP where available
- ripgrep for fast text discovery
- Git for repository history

Codex should reason over the graph; it should not repeatedly rebuild the graph from scratch.

---

# 13. Incremental Watcher

The watcher listens for:

- file creation
- file deletion
- file modification
- rename
- branch changes
- commit changes

It should update only affected graph records.

Example:

```text
file changed
   |
   v
parse changed file
   |
   +--> symbols
   +--> imports
   +--> exports
   +--> calls
   |
   v
update graph
```

Avoid full-repository re-indexing during normal editing.

---

# 14. Git Intelligence

```ts
export interface GitContext {
  branch?: string;
  status?: string;
  diff?: string;
  recentCommits?: Commit[];
  blame?: BlameInfo[];
}
```

Events:

- `git.branch.changed`
- `git.commit.created`
- `git.diff.changed`
- `git.status.changed`

Git enables questions such as:

- What changed here?
- Who last changed this?
- What was the previous implementation?
- Did this regression appear after a particular commit?

---

# 15. GitHub Intelligence

```ts
export interface RepositoryProvider {
  getRepository(): Promise<Repository>;
  getBranches(): Promise<Branch[]>;
  getCommits(): Promise<Commit[]>;
  getPullRequests(): Promise<PullRequest[]>;
  getIssues(): Promise<Issue[]>;
  getReviews(): Promise<Review[]>;
  getChecks(): Promise<Check[]>;
}
```

Initial provider: GitHub.

Later providers:

- GitLab
- Bitbucket
- other repository hosts

GitHub events:

- `github.issue.updated`
- `github.pr.updated`
- `github.review.created`
- `github.ci.updated`

This creates historical intelligence:

```text
Code
  |
  v
Blame
  |
  v
Commit
  |
  v
Pull Request
  |
  v
Review
  |
  v
Issue / Discussion
```

---

# 16. Agent Engine

Keep Codex behind a product-neutral interface.

```ts
export interface AgentEngine {
  initialize(): Promise<void>;

  createSession(
    config: AgentSessionConfig
  ): Promise<AgentSession>;

  run(
    session: AgentSession,
    request: AgentRequest
  ): AsyncIterable<AgentEvent>;

  interrupt(session: AgentSession): Promise<void>;

  close(session: AgentSession): Promise<void>;
}
```

Implementation:

```text
AgentEngine
   |
   +-- CodexAgentEngine
```

Only `packages/codex` should know Codex-specific protocol details.

Current OpenAI documentation says Codex app-server is intended for product integrations that need an embedded Codex experience, including persistent conversations, streamed events, interruption, tools, and approval handling. The integration is separate from MCP; MCP remains appropriate for exposing tools to agents. [OpenAI Codex platform guidance](https://developers.openai.com/blog/codex-as-a-platform) [OpenAI MCP documentation](https://developers.openai.com/plugins/build/mcp-server)

**Implementation rule:** do not hard-code undocumented Codex wire messages into the oAX protocol. Wrap the current Codex integration surface behind the adapter and translate its events into oAX events.

---

# 17. Agent Lifecycle

```text
IDLE
  |
  v
UNDERSTANDING
  |
  v
PLANNING
  |
  +----> NEEDS_APPROVAL
  |             |
  |             v
  |         EXECUTING
  |             |
  +-------------+
                |
                v
            VERIFYING
                |
                v
            REVIEWING
                |
          +-----+-----+
          |           |
          v           v
      COMPLETED     FAILED
```

Events:

- `agent.created`
- `agent.started`
- `agent.thinking`
- `agent.tool.started`
- `agent.tool.completed`
- `agent.permission.requested`
- `agent.paused`
- `agent.resumed`
- `agent.completed`
- `agent.failed`

---

# 18. Permissions

Permissions are capability-based.

```ts
export type Capability =
  | "workspace.read"
  | "workspace.write"
  | "terminal.execute"
  | "git.read"
  | "git.write"
  | "github.read"
  | "github.write"
  | "network.request"
  | "package.install"
  | "process.spawn";
```

Example:

```json
{
  "workspace.read": "allow",
  "workspace.write": "ask",
  "terminal.execute": "ask",
  "git.read": "allow",
  "git.write": "ask",
  "github.read": "allow",
  "github.write": "ask",
  "package.install": "deny"
}
```

Permission events:

- `permission.requested`
- `permission.granted`
- `permission.denied`

The agent must never bypass policy.

Suggested approval progression:

```text
READ
  ->
ANALYZE
  ->
PROPOSE
  ->
EDIT
  ->
EXECUTE
  ->
COMMIT
  ->
PUSH
  ->
MERGE
```

Higher-impact operations require explicit approval.

---

# 19. Session Architecture

Default:

```text
oAX Session
   |
   +-- Main Codex
   |
   +-- Analyst
   +-- Tester
   +-- Reviewer
```

These are roles/sub-agents orchestrated by one oAX session, not necessarily independent long-lived brains.

The main agent should coordinate specialized work when useful.

---

# 20. Buddy UX

Buddy is a visual representation of agent state, not a separate agent.

```ts
export interface BuddyState {
  mood:
    | "idle"
    | "observing"
    | "thinking"
    | "working"
    | "waiting"
    | "success"
    | "error";

  position?: {
    file?: string;
    line?: number;
    column?: number;
  };

  target?: string;
  message?: string;
}
```

Mapping:

```text
agent.started             -> thinking
agent.tool.started        -> working
agent.permission.requested-> waiting
agent.completed           -> success
agent.failed              -> error
```

Do not build a complex avatar first. Build state semantics first.

---

# 21. Memory

Memory layers:

### Session memory
Current task and active reasoning context.

### Workspace memory
Developer preferences, architecture decisions, conventions.

### Repository memory
Long-lived architectural constraints and explanations.

Memory lifecycle:

```text
Candidate memory
      |
      v
Evidence
      |
      v
Validation
      |
      v
Persistent memory
```

Never blindly persist every agent statement.

---

# 22. CLI

Initial commands:

```bash
oax init
oax analyze
oax status
oax doctor
oax run
oax session
oax permissions
```

### `oax init`

Should:

1. detect repository
2. create `.oax/`
3. initialize configuration
4. connect to Codex
5. index repository
6. start runtime

### `.oax/`

```text
.oax/
├── config.json
├── graph.db
├── context/
├── sessions/
└── logs/
```

Example config:

```yaml
version: "0.1"

agent:
  engine: codex

context:
  spatial: true
  git: true
  github: true

indexing:
  incremental: true

permissions:
  workspace:
    read: allow
    write: ask
  terminal:
    execute: ask
  git:
    read: allow
    write: ask
  github:
    read: allow
    write: ask

ui:
  agentCursor: true
  buddy: true
```

---

# 23. VS Code Adapter

The first adapter is VS Code.

Responsibilities:

- detect workspace
- report active file
- report cursor
- report selection
- report visible ranges
- resolve symbols
- report open editors
- render agent cursor
- show permission prompts
- display agent state
- display diffs
- send user commands to runtime

The adapter should not contain business logic.

Architecture:

```text
VS Code Extension
      |
      | oAX protocol
      v
oAX Runtime
```

---

# 24. Runtime Responsibilities

The runtime is the center of the system.

Responsibilities:

- session management
- context state
- spatial state
- event bus
- context slicing
- permission enforcement
- agent orchestration
- Codex lifecycle
- graph queries
- Git/GitHub queries
- memory
- audit logs

The runtime should expose a small set of explicit interfaces rather than becoming one giant service.

---

# 25. Event Bus

Recommended event envelope:

```ts
export interface OaxEvent<T = unknown> {
  type: string;
  version: "0.1";
  timestamp: string;
  workspaceId?: string;
  sessionId?: string;
  agentId?: string;
  payload: T;
}
```

The event bus enables:

```text
VS Code
   |
   v
Spatial Event
   |
   v
Runtime
   |
   +--> Context Engine
   +--> Agent
   +--> Buddy
   +--> Logger
   +--> Evaluator
```

This prevents the UI from becoming the source of truth.

---

# 26. First Vertical Slice

This is the first end-to-end milestone.

### User flow

1. Open repository.
2. oAX indexes repository.
3. oAX detects active file.
4. oAX detects cursor and selection.
5. oAX resolves selected symbol.
6. oAX finds immediate dependencies.
7. User asks a question.
8. oAX builds `ContextSlice`.
9. Codex answers.
10. User asks for a refactor.
11. oAX evaluates required permissions.
12. User approves.
13. Codex edits.
14. oAX runs tests.
15. oAX shows diff.
16. Agent cursor moves through relevant code while working.

### Definition of done

A developer can open a real repository and complete:

```text
Explain this symbol
        ->
Refactor this
        ->
Approve edit
        ->
Run tests
        ->
Inspect diff
```

without leaving the editor.

---

# 27. Second Vertical Slice — Refactoring

```text
"Refactor this"
       |
       v
Capture spatial context
       |
       v
Impact analysis
       |
       v
Codex plan
       |
       v
Permission
       |
       v
Codex edit
       |
       v
Tests
       |
       v
Diff
       |
       v
Review
```

---

# 28. Third Vertical Slice — Agent Cursor

During execution:

```text
Codex event
    |
    v
oAX event translator
    |
    v
agent.cursor.changed
    |
    v
VS Code adapter
    |
    v
Agent cursor rendered
```

The developer can see where the agent is investigating or editing.

---

# 29. Fourth Vertical Slice — Historical Intelligence

Example:

```text
Developer asks:
"Why is this validation here?"
```

oAX:

```text
focused symbol
   |
   v
graph
   |
   v
Git blame
   |
   v
commit
   |
   v
PR
   |
   v
issue/review
   |
   v
ContextSlice
   |
   v
Codex explanation
```

---

# 30. Repository Onboarding

`oax analyze` should generate a repository intelligence report.

Include:

- repository summary
- languages
- package managers
- applications
- services
- modules
- entry points
- major symbols
- dependency relationships
- test locations
- build commands
- deployment configuration
- Git history overview
- active branches
- important PR/issue relationships
- architectural observations
- unknown/ambiguous areas

The onboarding experience should progressively teach an unfamiliar repository.

---

# 31. Evaluation Framework

Build this early.

Directory:

```text
tests/evals/
├── explain-symbol/
├── find-callers/
├── understand-architecture/
├── refactor-function/
├── fix-test/
├── trace-git-history/
├── github-context/
└── security-analysis/
```

Metrics:

- context relevance
- tool correctness
- files touched
- tests passed
- unnecessary changes
- permission violations
- time
- token usage
- developer approval
- regression rate

Every major runtime change should be tested against representative repositories.

---

# 32. Testing Strategy

### Unit tests

Test:

- protocol validation
- event serialization
- permission policies
- graph queries
- context ranking
- spatial state transitions
- Git parsing

### Integration tests

Test:

- VS Code ↔ runtime
- runtime ↔ graph
- runtime ↔ Codex adapter
- runtime ↔ Git
- runtime ↔ GitHub

### End-to-end tests

Test complete developer flows.

### Evaluation tests

Test actual agent quality.

---

# 33. Security Model

Treat the agent as an untrusted executor with explicit capabilities.

Requirements:

- deny-by-default for high-impact actions
- permission prompts
- audit logs
- command visibility
- file-change visibility
- Git diff before commit
- no silent pushes
- no silent package installation
- no unrestricted network access unless granted
- workspace boundaries
- secrets should not be injected into model context unnecessarily

Security events must be persisted.

---

# 34. Transport

### v0.1

Local:

```text
JSON-RPC / JSONL
       |
       v
stdio
```

Later:

```text
Remote
  |
  v
WebSocket
```

HTTP/SSE can be added for appropriate external workflows.

The transport should remain separate from the semantic protocol.

---

# 35. MCP Position

MCP is an integration/tool layer, not the internal oAX protocol.

Use MCP when oAX needs to expose or consume external tools/services.

Do not make MCP the definition of:

- oAX sessions
- spatial state
- agent cursor
- context state
- permissions
- internal events

This keeps oAX product architecture independent.

---

# 36. Versioning

Protocol changes must be versioned.

Example:

```text
oax.protocol/0.1
oax.context/0.1
oax.agent/0.1
oax.graph/0.1
```

Capabilities are negotiated.

Example:

```json
{
  "protocol": "0.1",
  "capabilities": [
    "spatial.cursor.v1",
    "codegraph.v1",
    "agent.events.v1",
    "agent.cursor.v1"
  ]
}
```

Do not break existing adapters without explicit protocol migration.

---

# 37. Milestones

## Milestone 1 — Foundation

Deliver:

- monorepo
- protocol
- runtime
- VS Code adapter
- Codex adapter
- event bus
- basic permissions

## Milestone 2 — Spatial Intelligence

Deliver:

- cursor
- selection
- visible ranges
- focused symbol
- open files
- agent cursor

## Milestone 3 — Code Intelligence

Deliver:

- indexer
- Tree-sitter parsing
- symbol extraction
- dependency graph
- incremental updates

## Milestone 4 — Agent

Deliver:

- Codex sessions
- context slicing
- execution
- approvals
- tests
- diff

## Milestone 5 — Historical Intelligence

Deliver:

- Git
- blame
- commits
- GitHub
- PRs
- issues
- reviews
- checks

## Milestone 6 — Buddy

Deliver:

- presence
- agent cursor integration
- animation/state system
- optional voice

## Milestone 7 — Multi-IDE

Deliver:

- JetBrains
- Neovim
- CLI
- desktop
- web

---

# 38. Explicit Non-Goals for the First Release

Do not initially build:

- custom foundation model
- distributed microservices
- dedicated graph database
- vector database
- autonomous GitHub bot
- marketplace
- elaborate avatar
- 15 IDE integrations
- cloud-first infrastructure
- fully autonomous merge/push behavior
- large multi-agent swarm architecture

These can come later when validated by real usage.

---

# 39. Exact Engineering Order

Execute in this order:

### Phase A — Repository

1. Create monorepo.
2. Configure pnpm.
3. Configure TypeScript.
4. Add linting/formatting.
5. Add test runner.
6. Create package boundaries.
7. Add CI.

### Phase B — Protocol

8. Define message envelope.
9. Define capability negotiation.
10. Define event types.
11. Define spatial types.
12. Define context types.
13. Define agent types.
14. Define permission types.
15. Generate/validate JSON schemas.

### Phase C — Runtime

16. Create runtime process.
17. Create event bus.
18. Create session manager.
19. Create state store.
20. Create permission engine.
21. Create audit logger.

### Phase D — VS Code

22. Create extension.
23. Detect workspace.
24. Capture active file.
25. Capture cursor.
26. Capture selection.
27. Capture visible ranges.
28. Resolve symbols.
29. Connect extension to runtime.
30. Render agent cursor.

### Phase E — Graph

31. Create SQLite schema.
32. Implement file discovery.
33. Add language detection.
34. Add Tree-sitter parsing.
35. Extract symbols.
36. Extract imports/exports.
37. Build relationships.
38. Implement graph queries.
39. Add incremental watcher.

### Phase F — Codex

40. Implement `AgentEngine`.
41. Implement current Codex adapter.
42. Translate Codex events to oAX events.
43. Translate approval requests.
44. Translate tool lifecycle.
45. Implement interruption.
46. Implement session lifecycle.

### Phase G — Context

47. Implement spatial context collector.
48. Implement focused-symbol resolver.
49. Implement graph expansion.
50. Implement relevance ranking.
51. Implement ContextSlice.
52. Attach ContextSlice to agent requests.

### Phase H — Editing

53. Implement workspace write capability.
54. Add permission flow.
55. Apply edits.
56. Run tests.
57. Capture diff.
58. Show diff.
59. Add review state.

### Phase I — Git/GitHub

60. Add Git provider.
61. Add branch state.
62. Add status.
63. Add diff.
64. Add blame.
65. Add commit history.
66. Add GitHub provider.
67. Add PRs.
68. Add issues.
69. Add reviews.
70. Add checks.

### Phase J — Product UX

71. Add chat.
72. Add agent status.
73. Add activity timeline.
74. Add context inspector.
75. Add permission UI.
76. Add diff/review UI.
77. Add Buddy.
78. Add optional voice.

### Phase K — Quality

79. Build eval corpus.
80. Run benchmark tasks.
81. Measure context relevance.
82. Measure unnecessary edits.
83. Measure permission violations.
84. Measure regression rate.
85. Fix highest-impact failures.

---

# 40. Initial Definition of Done

oAX v0.1 is not “done” because it can chat.

It is done when all of the following work:

- [ ] repository can be indexed
- [ ] active editor context is known
- [ ] focused symbol is known
- [ ] relevant code graph is queryable
- [ ] relevant context is assembled
- [ ] Codex can receive that context
- [ ] Codex events are translated into oAX events
- [ ] agent cursor is visible
- [ ] edits require correct permission
- [ ] tests can run
- [ ] diff can be reviewed
- [ ] Git state is visible
- [ ] actions are auditable
- [ ] the workflow works end-to-end inside VS Code
- [ ] evaluation cases pass agreed thresholds

---

# 41. Suggested Initial Interfaces

```ts
// packages/runtime/src/runtime.ts

export interface OaxRuntime {
  start(): Promise<void>;
  stop(): Promise<void>;

  createWorkspace(input: WorkspaceInput): Promise<Workspace>;
  createSession(input: SessionInput): Promise<Session>;

  dispatch<T>(
    message: OaxMessage<T>
  ): Promise<OaxMessage>;

  subscribe(
    handler: (event: OaxEvent) => void
  ): () => void;
}
```

```ts
// packages/context/src/context-engine.ts

export interface ContextEngine {
  buildSlice(input: {
    objective: string;
    context: OaxContext;
  }): Promise<ContextSlice>;
}
```

```ts
// packages/codegraph/src/graph.ts

export interface CodeGraph {
  upsertNode(node: GraphNode): Promise<void>;
  upsertEdge(edge: GraphEdge): Promise<void>;

  getNode(id: string): Promise<GraphNode | null>;
  findRelated(
    nodeId: string,
    relationship?: string
  ): Promise<GraphNode[]>;

  findPaths(
    from: string,
    to: string,
    maxDepth?: number
  ): Promise<GraphPath[]>;
}
```

```ts
// packages/permissions/src/policy.ts

export interface PermissionPolicy {
  check(capability: Capability): PermissionDecision;
  request(
    capability: Capability,
    reason: string
  ): Promise<PermissionDecision>;
}
```

---

# 42. Configuration and Environment

Development environment should support:

```text
Node.js
pnpm
TypeScript
Git
GitHub authentication
Codex authentication/integration
VS Code
SQLite
```

Environment variables should be documented and kept outside source control.

Example:

```text
OPENAI_API_KEY=...
GITHUB_TOKEN=...
```

Only use credentials required by the selected integration path.

---

# 43. Observability

Every agent session should have:

- session ID
- workspace ID
- agent ID
- timestamps
- event sequence
- tool activity
- permissions
- file changes
- test results
- final diff
- failure reason

This enables debugging and future product analytics without relying on model introspection.

---

# 44. Developer Experience

The developer should be able to answer at any time:

1. What does oAX know?
2. What is it looking at?
3. What is it doing?
4. Why is it doing it?
5. What files might it change?
6. What permission does it need?
7. What happened after it changed something?
8. What tests passed?
9. What changed in Git?
10. Can I undo it?

This transparency should be a product feature, not merely a debugging facility.

---

# 45. Long-Term Product Direction

Once the foundation works, oAX can evolve toward:

```text
Developer
   |
   v
oAX
   |
   +-- Code Intelligence
   +-- Spatial Intelligence
   +-- Historical Intelligence
   +-- Agent Runtime
   +-- Memory
   +-- Permissions
   +-- Collaboration
   |
   +-- Codex
   |
   +-- Multiple IDEs
   +-- CLI
   +-- Desktop
   +-- Web
```

Potential future capabilities:

- repository onboarding tutor
- architectural map
- live codebase graph
- agent activity playback
- voice interaction
- proactive code explanations
- regression investigation
- PR preparation
- review assistance
- repository-specific engineering memory
- multiple agent roles
- team-level knowledge

---

# 46. Product Success Metrics

Track:

### Understanding

- symbol-resolution accuracy
- context relevance
- architecture-answer accuracy
- history retrieval accuracy

### Coding

- successful task completion
- tests passing
- unnecessary files changed
- regression rate
- edit acceptance rate

### Trust

- permission accuracy
- unexpected action rate
- rollback rate
- developer override rate

### Experience

- time to first useful result
- time saved on onboarding
- task completion time
- repeated-use rate

---

# 47. The Core Build Loop

For every feature:

```text
Define protocol
    |
    v
Implement runtime capability
    |
    v
Expose adapter capability
    |
    v
Instrument events
    |
    v
Add permission boundary
    |
    v
Add tests/eval
    |
    v
Expose UX
    |
    v
Measure
    |
    v
Iterate
```

Do not start with UI and retrofit the runtime afterward.

---

# 48. Immediate Next Actions

The first implementation sprint should produce a real running skeleton.

### Day 1

- initialize repo
- pnpm workspace
- TypeScript
- package boundaries
- protocol envelope
- event types

### Day 2

- runtime
- event bus
- workspace/session state
- permissions

### Day 3

- VS Code adapter
- spatial context
- protocol transport

### Day 4

- SQLite graph
- file indexer
- symbol extraction

### Day 5

- Codex adapter
- session lifecycle
- event translation

### Day 6

- ContextSlice
- explain-symbol flow
- agent cursor

### Day 7

- refactor flow
- approval
- tests
- diff
- first evaluation suite

The goal is not to finish the entire product in seven days. The goal is to prove the architecture with one complete vertical slice.

---

# 49. Canonical First Demo

The first demo should be:

> Developer opens an unfamiliar repository.  
> oAX indexes it.  
> Developer clicks a function.  
> The agent cursor appears on the function.  
> Developer asks: “Explain this and show me what calls it.”  
> oAX uses spatial context + code graph.  
> Codex explains the function and callers.  
> Developer asks: “Refactor this to make it easier to test.”  
> oAX shows an impact summary.  
> oAX requests write permission.  
> Developer approves.  
> Codex edits.  
> oAX runs tests.  
> oAX shows the diff and test results.  
> The Buddy changes state throughout the operation.

If this demo is reliable, the core architecture is validated.

---

# 50. Final Architecture Rule

The most important architectural rule for oAX is:

```text
The IDE is a window into oAX.
Codex is an engine inside oAX.
The oAX protocol is the contract.
The oAX runtime is the source of truth.
The codebase graph is the structural memory.
Spatial context is the immediate awareness.
Git/GitHub are historical memory.
Permissions are the safety boundary.
Buddy is the visible presence.
Evaluations are the quality gate.
```

That is the system to build.

---

## 51. Reference Sources

Current OpenAI documentation consulted for the Codex integration decision:

- OpenAI Agents architecture: https://developers.openai.com/api/docs/guides/agents-api/architecture
- OpenAI Codex platform guidance: https://developers.openai.com/blog/codex-as-a-platform
- OpenAI MCP server documentation: https://developers.openai.com/plugins/build/mcp-server
- OpenAI agent runtime overview: https://developers.openai.com/api/docs/guides/agents
- OpenAI code generation / Codex overview: https://developers.openai.com/api/docs/guides/code-generation

These sources should be rechecked when implementing the Codex adapter because Codex integration surfaces and API details can change.

---

# 52. Build Principle

**Build the smallest complete oAX, not the smallest collection of oAX features.**

The first objective is one trustworthy end-to-end loop:

```text
Spatial context
   ->
Code graph
   ->
Relevant context
   ->
Codex
   ->
Permission
   ->
Edit
   ->
Test
   ->
Diff
   ->
Agent cursor
   ->
Developer review
```

Once that loop is stable, every additional feature has a clear place in the architecture.

## Browser Runtime Intelligence and Verification

An optional Chrome DevTools MCP adapter extends source intelligence with authorized browser evidence. Keep its wire details and lifecycle behind a tool adapter; scope each operation to an approved development origin and dedicated profile. Browser context is untrusted, cannot change policy, and requires separate authorization from provider context transmission. Disable unnecessary tools, personal profiles, telemetry and CrUX requests; bound and redact captured evidence.

The local preview implements a pinned, origin-scoped read-only CLI inspection adapter with real loopback tests. Source-map relationships, browser evidence in ContextSlice, approved browser-driven fixes and repeated application verification remain planned. This addition does not replace the core spatial/context/runtime/Codex architecture or authorize remote submissions.
