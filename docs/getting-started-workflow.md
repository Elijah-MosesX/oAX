# Use oAX on a real repository

This walkthrough uses the built implementation checkout. It does not require a published npm package. The runtime is local; Codex inference, when explicitly approved, uses the provider. Supported surface limits are in README.md.

## 1. Prepare the tools

Use Node 24.19.0 and pnpm 11.25.0. From the oAX checkout:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
node dist/cli.cjs doctor
pnpm package:local
```

Install `dist/oax-vscode-0.1.0.vsix` using VS Code's **Extensions: Install from VSIX...** command. For actual Neovim/Vim setup, follow [adapters](adapters.md) and [Vim](vim.md). They currently expose read-only structural workflows. Java/Go/Python parser setup is in [language workers](language-workers.md); it does not enable semantic refactors in those languages.

## 2. Understand code in place

Open a trusted repository, select a function, and run an oAX **Find** relationship command. Inspect the source references and semantic/heuristic labels. **Show Index Status** exposes freshness or failures. Unsaved selection context uses the editor's document version.

Run **oAX: Show Buddy** to see actual activity and the independent agent location. Your selection remains yours. A location means observed activity, not proof that an edit occurred.

## 3. Ask for an explanation

Run **oAX: Explain Selection**. Inspect the bounded context before approving transmission. Related excerpts prioritize callers, dependencies, imports or tests using explicit keyword rules; reasons and truncation are visible in the context. To include saved tracked history, use **oAX: Explain Selection with History (Codex)** and choose local Git or the explicitly connected GitHub repository. See [historical context](connected-intelligence.md) for freshness, consent and limits.

This requires an existing official Codex login and the verified provider executable versions documented in README.md. oAX does not substitute a mock answer when live setup fails. An approved request may consume account usage.

## 4. Make and verify a change

Save the affected file. Select a small function and run **Refactor Selection with Codex Preview**. Describe the intended change, inspect and approve context transmission, then review the proposed diff. Approve the exact write only if it is correct. Changed file baselines invalidate the plan.

Open the relevant saved Node test file and use **Run Selected Node Tests with Approval**. This is a separate execution decision. Finally run **Review Last Applied Edit and Test Evidence**. A proposal is not a verified result; changed files/tests invalidate older verification. Current model edits are limited to the selected range in one saved file.

## 5. Explore history and share findings

Use **Show Git History Evidence** for saved tracked code. GitHub setup is separately documented in [GitHub](github.md); IDE sign-in does not automatically authenticate oAX's product adapter.

Open [Shared Knowledge](https://oax-shared-knowledge-omcqtl.v2.appdeploy.ai/), sign in, create a repository room and invite a consenting collaborator as reader or contributor. Publish a reviewed finding or exported ContextSlice only after inspecting its contents. Voice creates a draft; Screen lens requires selecting a surface and approving the captured frame. These controls exist, but live two-user/microphone/screen-provider acceptance remains pending. Rooms do not yet pair devices or execute a shared agent task.

## 6. Use the same local core without VS Code

From your target repository, use the absolute path to the built CLI:

```powershell
node '<oAX checkout>/dist/cli.cjs' init
node '<oAX checkout>/dist/cli.cjs' analyze
node '<oAX checkout>/dist/cli.cjs' query callers src/example.ts 0 16
node '<oAX checkout>/dist/cli.cjs' explain src/example.ts
```

Replace the sample file and zero-based coordinates with a real symbol. Explain first prints the context disclosure; follow its exact approval-hash instructions. Run `--help` for command contracts. The local workbench starts with `node '<oAX checkout>/dist/workbench.cjs' '<repository path>'` and supports read-only inspection.

## Challenge acceptance

Demonstrate one repository from selection through explanation, approved change, real checks and review. Keep the context preview, actual diff, test exit status and audit evidence. Repeat in the supported environment instead of using a promotional video as proof. The full product's outstanding continuity, multi-editor, collaboration and enterprise gates are tracked in [product alignment](product-alignment.md).
