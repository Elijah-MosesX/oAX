# Jev browser planning integration

oAX installs the official [browser-use/jev-ultrafast](https://github.com/browser-use/jev-ultrafast) source at commit `1231850a0bf1a0c0341fe408ef1668dbbfdfac46` (upstream version 0.1.0). The attached archive's model file matches this pinned source. The executed installation uses the official archive with SHA-256 `61e3edab5be79a857647660bd24e60127b9a5881d71cf81f2c7d98bd99202b9d`.

## Installation

Run with Python 3.12; the verified environment is 3.12.14:

```powershell
python scripts/setup-jev.py
pnpm build
pnpm test:jev
pnpm test:browser-jev
```

The installer uses workspace-local uv 0.12.22, upstream's frozen lockfile and wheel-only dependencies. It skips the upstream project build backend and installs the reviewed source through an isolated virtual environment's import path. It verifies existing source and lockfiles against the checksum-verified archive. `.tools/jev-install.json`, dependencies and source remain ignored local installation state. No global Python configuration, browser daemon, personal browser profile or model request is started by installation. The upstream source retains its license in the downloaded checkout. This installation is required separately from the VSIX.

## Local browser observation

```powershell
node dist/browser.cjs inspect-jev http://localhost:3000/
# Review the preview, then use its exact hash:
node dist/browser.cjs inspect-jev http://localhost:3000/ --approve <preview-hash>
```

Chrome DevTools MCP collects an authorized accessibility snapshot in an empty dedicated browser. oAX projects supported observed roles and UIDs into a bounded page, then calls the installed Python planner's deterministic action-space builder. Disabled/read-only elements are excluded. This projection is incomplete: it is not an executable selector, DOM identity guard, source map, semantic assertion or browser execution permission. Snapshot URL disagreement fails closed. No model receives this inspection.

## Optional model proposal

```powershell
node dist/jev.cjs inspect observed-page.json
node dist/jev.cjs plan observed-page.json "Identify the Continue button"
node dist/jev.cjs plan observed-page.json "Identify the Continue button" --approve <context-resource>
```

The normalized page contract is exported as `jevPageSchema`: HTTP(S) URL without credentials, bounded title/text, up to 200 observed actions and unique identifiers. Element nodes use string identifiers. This is a bounded oAX projection, not the complete upstream snapshot format. For controls, only `wait`, `scroll_up` and `scroll_down` identifiers are supported.

`plan` previews the exact context and fixed TypeSafe destination before transmission. Configure `TYPESAFE_API_KEY` in the local process environment; never commit it or paste it into chat. A Codex login does not authenticate TypeSafe. URL queries/fragments are removed and known secrets conservatively redacted; review all remaining content because redaction is incomplete. The exact context/goal digest, principal, workspace, session, task and expiration gate the request. Metadata-only permissions and outcomes are persisted in `.oax/audit`.

The worker receives only a minimal environment plus the selected credential, bounded JSON input/output and a 90-second deadline. Pinned source files are checked before launch. A proposal returns `executed: false` and `verified: false`; a provider's `DONE` does not prove success. oAX never constructs upstream `Agent` or `Browser`, so its unrestricted automation loop, browser-harness daemon, existing-profile behavior and text helper are not exposed. Browser clicks, form submissions and typing remain unimplemented pending a separately reviewed execution/approval contract.

## Evidence and limits

The pinned upstream's 31 offline tests passed. The real installed Python action-space round trip passed. The actual dedicated Chrome → MCP snapshot → bounded observed page → Python Jev round trip passed on a synthetic loopback page, including existing origin and denied-action checks. No TypeSafe live request was made. Live prediction requires a locally configured credential and authorization for the disclosed data and usage. Dependency wheels and processes retain local-account rights; this is not an OS sandbox or tamper-resistant installation.
