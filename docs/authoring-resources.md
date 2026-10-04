# Optional authoring and design resources

These tools support development and communication. They do not become runtime permissions or execute merely because a repository requests them. oAX's MIT license is unchanged.

## Ponytail

Installed the supplied 4.10.3 source under `.tools/ponytail/b48bf3e09182/ponytail-main` using `scripts/setup-resources.py`. Archive SHA-256: `b48bf3e09182b0c9b4ddeb7c3c520918c173ec73e8756285cf794cbac84d38f0`. All 169 files were verified. Upstream MIT notices remain intact. No automatic lifecycle hooks were registered.

The official skill installer also installed `ponytail` and `ponytail-review` from upstream revision `c982cd411abb53323c4baa1baa3c2f020b8d0b08` into the user's Codex skills directory. Their reuse/standard-library/native-platform guidance was applied: original CSS, compiler ASTs, existing runtime transport and an existing video composer. Validation, grants, accessibility and acceptance remain required. The complexity review found no justified removal of execution or trust-boundary controls; no reduced-line-count or upstream benchmark claim is made for oAX.

## OpenMontage

Installed the supplied source separately under `.tools/openmontage/bacf55796fc6/OpenMontage-main`, preserving its AGPL-3.0 license and 2115 verified source files. Archive SHA-256: `bacf55796fc6166a5951ed356cbeaa83ca74ae868bd10d73105547432c4d725e`. Its Remotion composer uses its committed npm lockfile; installation used `npm ci --ignore-scripts --no-audit --no-fund`. It is an optional authoring program, not bundled into oAX's extension or deployed service. Cloud media generation, paid providers and its server are not configured or advertised as oAX capabilities.

The integration is an explicit local authoring workflow: `docs/video/storyboard.json` → original visual cards and actual app screenshot → OpenMontage props → H.264 MP4. `scripts/render-product-video.ps1 -Python <absolute-python>` renders the exact 60-second timeline using local Windows narration. It requires Pillow, the installed composer, `.oax/browser-install.json`, and the captured public landing-page image at `dist/product-video/workspace.png`. The scenes are an explanatory overview, not a recording of every acceptance test. Subtitles accompany the video. No private repository content or account identity is included.

Reinstall supplied archives with `python scripts/setup-resources.py ponytail <zip>` or `python scripts/setup-resources.py openmontage <zip>`. Checksums and paths are validated; changed existing files are refused. Upstream notices remain part of the separately licensed tools.

## Visual reference audit

The supplied frontend guidance informed the task-focused workspace: repository navigation, separate Knowledge/Screen lens/Team access/GitHub panels, readable typography, explicit states and reduced-motion support. The anti-slop landing-page guidance excludes dashboards and was not applied mechanically.

Magic UI and Awesome Design were inspected as MIT references; no source was copied. Animate UI's LICENSE.md includes the Commons Clause despite its README saying MIT, so no code was imported. img2threejs is an Apache-2.0 procedural scene tool, not screen perception; it and the MIT WebGL skill collection are not dependencies of this workspace. Playwright CLI was reviewed as a reference; UI inspection uses existing authorized browser tooling. Adding every archive as a dependency would not establish integration or improve acceptance.

Chrome DevTools MCP, Jev, Clicky-inspired Buddy, Vim/Vimium and the browser launcher have separate records in `docs/integration-audit.md`, `docs/jev.md`, `docs/clicky.md`, `docs/vim.md` and `docs/browser-extensions.md`.
