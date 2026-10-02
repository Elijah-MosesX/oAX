# oAX portable desktop preview — Windows x64

Buddy reports actual graph inspection activity through the same presentation
store used by VS Code. You can hide/show it without changing the operation or
source selection. A completed inspection means a runtime read returned; it does
not imply an agent executed or tests passed. This interface has no agent cursor
until an actual supported agent workflow supplies validated location evidence.

This distribution runs the local repository workbench in a dedicated desktop app window. It includes Node 24.19.0, the shared oAX runtime, graph and static interface. It does not require npm, pnpm, Python, VS Code or a Node installation. A dedicated, pinned Chrome for Testing is downloaded separately during explicit first setup; it is not bundled or attached to your personal browser profile.

Git is optional for structural analysis and required for local commit/blame/history
queries. Install Git separately if you need those queries. The launcher never runs
repository setup or test scripts automatically.

## Install and launch

1. Extract the ZIP into a writable folder you control, outside the repositories you analyze. Keep all files together. This is a portable application; it does not modify Windows registry, system PATH or account settings.
2. In that extracted folder, run `node.exe scripts/setup-desktop.cjs`. Review the fixed Google download URL, version, checksum, size and disclosure. Then run `node.exe scripts/setup-desktop.cjs --approve <shown-hash>`. This downloads approximately 196 MiB, verifies the archive/executables and runs Chrome's own directory-scoped Windows sandbox setup. That setup grants the browser's sandbox read/execute access only to its downloaded binaries. It does not disable the sandbox or grant access to repository files. Review the browser's own terms and credits before distribution/use under your organization's policy.
3. Run `oax-desktop.cmd "C:\path\to\repository"`. With no argument, it asks for your repository folder. Choose an existing trusted workspace.
4. Enter a workspace-relative source path in the app, open it, select a symbol and inspect callers, context or history. Closing the app window closes its owned runtime and removes its temporary browser profile.

The ZIP's adjacent `.sha256` detects corruption; compare it before extraction. `manifest.json` records exact hashes of the allowlisted application files and included licenses. These hashes are not a digital signature or publisher identity guarantee. This preview has no signed installer, auto-updater or public release policy.

## Supported behavior and privacy

The runtime and protocol are the same core used by VS Code and CLI. This desktop surface currently supports saved-source structural intelligence, context inspection, local history, repository walkthrough and actual runtime events. It does not expose model transmission, provider editing, GitHub tokens, browser automation or voice. Live explain/refactor/test/review remains in the existing VS Code and CLI surfaces. See the repository's shared-surface documentation for the broader roadmap.

The local interface binds to 127.0.0.1, authenticates its owned session and enforces Host/Origin/CSRF checks and a read-method allowlist. The dedicated browser uses an empty temporary profile with extensions and sync disabled. Runtime audit/graph metadata can persist in the selected workspace's ignored `.oax` directory. The browser's own sandbox remains enabled; oAX does not claim an OS sandbox for Node/runtime execution. No enterprise identity, tenancy or comprehensive secret detection is claimed.

## Update, recovery and removal

Extract a new verified ZIP into a separate folder. Preserve the old folder for rollback and never overwrite an active installation. A new app folder needs its own explicit pinned-browser setup. Your repositories and their `.oax` state are independent of the application folder.

If the browser download is interrupted or fails its checksum, close the application, inspect and remove only the failed `chrome-win64.zip` in the application's `.oax/browser-cache/chrome/win64-154.0.8037.92` folder, then rerun the reviewed setup. Failed extraction can leave a partial `chrome-win64` folder: remove only that owned application cache folder before retrying. Setup never overwrites a different browser configuration. If a saved source changes elsewhere, reopen it before asking for evidence. For connection failures, close and relaunch the app; do not expose its loopback port publicly.

To remove the portable application, close it and remove its extracted application folder. This does not remove repositories or their local oAX state and is not secure erasure. Node's complete license and third-party notices, TypeScript/Zod licenses/notices and oAX's MIT license are included. Google Chrome retains its own downloaded ABOUT, terms and credits.

## Build and verify from source

```powershell
pnpm build
pnpm package:desktop
pnpm test:desktop
```

Packaging requires the verified official Windows x64 Node 24.19.0 binary and its complete license notice. Desktop acceptance checks the extracted archive's allowlist/hashes, bundled Node, actual graph over the packaged runtime, approved browser setup, actual app-window authentication, cleanup and relocation. macOS/Linux and signed installers remain unverified.
