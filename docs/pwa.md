# Progressive web applications

The local workbench has a standalone manifest and a static-only offline shell.
Install it through your browser while the runtime is running. Reloading resumes
the existing scoped session through its HttpOnly cookie and same-origin POST;
cross-origin requests still fail. Sessions expire after one hour. A new random
runtime port requires a fresh launcher link and a separate installation origin.
The offline shell cannot analyze repositories. No source, context, POST, bootstrap
URL, cookie or result is saved in service-worker storage.

The separately hosted **oAX Evidence Viewer** is deployed with AppDeploy at:
https://oax-evidence-viewer-xvokez.v2.appdeploy.ai/

Select a symbol in your local workbench, click **Inspect context**, then **Export
displayed evidence**. Review the JSON because it may contain private source.
Paste that `oax-evidence.v1` context.preview export into the viewer. The viewer
validates bounded ContextSlice fields, displays excerpts and relationship evidence
as text, and labels freshness/provenance limitations. Imports remain in memory;
clearing or reloading removes them. Its service worker caches only the public
shell, which also works offline after a successful online installation.

The public viewer has no backend, model calls or local-runtime connection. It does
not grant permissions, execute imported code, recheck source freshness or certify
historical causes. A cloud agent surface still requires identity, workspace access,
policy and deployment acceptance. Browser installation availability varies; use
the browser's Install app menu if the optional install button is unavailable.

Public deployment sources derive from `apps/evidence`, shared browser-safe protocol
coordinates and actual runtime export compatibility tests. `pnpm build` creates
`dist/evidence`; AppDeploy uses the HTML-static baseline plus these public assets.
No private repository excerpts, acceptance directories or attached ZIPs are published.
