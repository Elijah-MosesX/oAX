# Optional authoring and design resources

These tools support development and communication. They do not become runtime permissions or execute merely because a repository requests them. oAX's MIT license is unchanged.

## Hyperframes and Brag

The supplied Hyperframes archive is pinned by SHA-256 `41ddb38678274e8e883776a53ada6a338e9f9a6d9ea7d742046711afa4574a77`. `python scripts/setup-resources.py hyperframes <archive>` verifies/extracts 8703 regular files under `.tools/hyperframes/41ddb3867827/hyperframes-main`, retaining Apache-2.0 notices and skipping duplicate discovery symlinks. The source installer does not run hooks or build the upstream monorepo.

Codex skills were installed with the official skill installer: Brag at `cb89b9f44309b0bf4e3cb89e685fadf80c7999ed`, and Hyperframes router/core/animation/keyframes/creative/CLI at `237a984bb8d97f8dff7a5464c78851d633747f54`. Brag supplies the story/brief/quality workflow; Hyperframes supplies seekable HTML composition and rendering. No lifecycle hooks or hosted media service were configured.

The isolated renderer uses `hyperframes@0.8.116` and `gsap@3.14.2`. Reproduce dependencies by copying `docs/video/toolchain/package*.json` into `.tools/hyperframes-cli` and running `npm ci --prefix .tools/hyperframes-cli --ignore-scripts --no-audit --no-fund`. The lockfile belongs to this optional authoring environment, not the product runtime. Telemetry is disabled by `scripts/hyperframes.ps1`. Usage probing returned unknown; no allowance is inferred.

`python scripts/prepare-square-videos.py` creates four original 20-second, 1080×1080/30-fps compositions under `dist/oax-square-videos`. Inputs include the prior actual public landing capture and original synthesized music; bundled Brag music is not redistributed because its exact license was not established. Each film has a Brag plan, composition brief and share copy. Illustrative code/data are labeled. These are workflow films, not recordings proving live acceptance.

Use `scripts/hyperframes.ps1 check <composition> --json`, then `snapshot <composition> '--at=3,10,17'`, inspect the frames, and `render <composition> --quality delivery --workers 2 --output <absolute-mp4-path>`. Absolute output paths avoid Hyperframes resolving relative paths against the invoking working directory.

The wrapper expects Chrome Headless Shell 152.0.7977.30, downloaded from Google's Chrome for Testing storage. Its Windows archive SHA-256 is `5d7df999a6e4a65a1b16b25b61064f7337b8aa8ee2ed1b4e07bfdd24f6e4275e`; install with `python scripts/setup-resources.py hyperframes-browser <zip>`. The local `.oax/hyperframes-browser.json` receipt contains `version`, `executable` (the absolute installed path) and `archiveSha256`. Normal Windows Chrome passed composition checks but timed out on the renderer's version probe. No sandbox bypass is required.

Install the standalone audio/video encoder with `python -m pip install --target .tools/video-python --no-deps --only-binary=:all: imageio-ffmpeg==0.6.0`. The wrapper uses its bundled FFmpeg and OpenMontage's separately installed `ffprobe.exe`. The Remotion-specific FFmpeg cannot mix this score, so it is not used for encoding. These tools and their license notices remain in the optional authoring environment. After rendering all four `brag.mp4` files, run `python scripts/verify-square-videos.py` to bake the inspected poster into frame zero, verify dimensions/frame counts/audio and decode every frame. Receipts are written to `dist/oax-square-videos/verification.json`.

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
