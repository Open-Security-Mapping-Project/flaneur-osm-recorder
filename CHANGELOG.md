# Changelog

All notable changes to Flaneur OSM Recorder are recorded here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning is [Semantic Versioning](https://semver.org/); pre-release builds
carry an `-alphaN` suffix and may change behavior without notice.

---

## [v1.1-alpha1] — 2026-08-25

First release after a full audit of the v1 code. The headline items are two
data-integrity bugs that were silently corrupting surveys, and a storage layer
rebuilt so that a point which appears on screen is guaranteed to be on disk.

### Fixed — data integrity

- **Recorded nodes could be invisible on the map, and edits could hit the wrong
  node.** The negative node-ID counter lived in a module variable that reset to
  `-1` on every page load. Resuming a saved session therefore re-issued IDs that
  already existed in it. Consequences: the marker for a new node was suppressed
  as a duplicate (this is the reported "the first bookmark doesn't work, then it
  works from the second or third"); edit and delete resolved by ID and acted on
  the wrong node; and OSM XML export emitted duplicate node IDs, which JOSM
  rejects. IDs are now derived from the session's own nodes via
  `nextNodeId(session)` and survive reloads. Covered by regression tests.
- **Saved sessions could look permanently lost.** `getLastSession()` returned
  the most recently *created* session rather than the most recently *updated*
  one with data. Tapping "New Session" and reloading left an empty session
  shadowing the real survey, so "Append" reported nothing and the data appeared
  gone — it was on disk throughout. Now returns the most recently updated
  session that contains nodes. Covered by regression tests.
- **Undo and delete now remove the map marker**, not just the stored node.
  Markers are tracked in a `nodeMarkers` map keyed by node ID.
- Node notes and preset labels are HTML-escaped in map popups and the node list.

- **The first crosshair placement no longer jumps away from the reticle.** In
  crosshair mode the recording path called `map.invalidateSize()` before reading
  `map.getCenter()`, with a comment claiming this aligned the center with the
  drawn reticle. It did the opposite. `invalidateSize()` defaults to
  `pan: true`: when the container has resized since Leaflet last measured it —
  a phone URL bar collapsing, the storage banner appearing, the session modal
  closing — it pans the map by half the size delta and *then* returns, so
  `getCenter()` reported somewhere the user never aimed. On a phone that is
  easily 50+ pixels, tens of meters at survey zoom. Only the first placement was
  affected, because the pan clears Leaflet's size-changed flag and every later
  call short-circuits — which is exactly the reported "first one jogs over,
  subsequent are fine". Placement now reads the reticle's actual rendered
  position and converts it with `containerPointToLatLng()`, which resolves
  against the pixel origin the visible tiles are drawn with, so the node lands
  precisely under the crosshair and the map never moves. Container re-measuring
  moved to `resize`/`orientationchange` handlers where it belongs.

### Fixed — release blockers

- **The PWA could not be installed.** `public/` contained no icon files at all,
  and `index.html` linked a non-existent `/manifest.json` that competed with the
  manifest vite-plugin-pwa injects. Added 192px and 512px icons plus a padded
  maskable variant (a maskable icon is cropped to a safe zone, so it cannot be
  the same file as the standard icon).
- **A fresh clone could not build.** `vite.config.js` read `.cert/key.pem`
  unconditionally, but `.cert/` is gitignored — so `npm run dev` *and*
  `npm run build` failed with `ENOENT` for every new contributor and in CI. The
  dev certificate is now optional and the server falls back to HTTP.
- **CI was failing.** 20 ESLint errors, all inside unreferenced files.

### Added — storage durability

- `navigator.storage.persist()` is requested on launch, asking the browser to
  exempt survey data from eviction when the device runs low on space.
- Every write is failure-checked. A rejected write (quota exhausted, storage
  blocked, private mode) rolls back the in-memory change, so the UI can no
  longer show a marker for a node that was never saved.
- Write failures raise a persistent banner and a plain-language message stating
  the point was **not** saved, rather than a 3-second toast.
- Storage availability is verified on launch by round-tripping a probe value —
  exposing the API is not proof that it persists.
- Settings gained a storage panel: sessions and node count, bytes used, quota
  available, and whether storage is *protected* or *best-effort*.
- The active session is resumed automatically on launch when it contains nodes.
  The launch modal now only appears when there is a real choice to make.
- Abandoned empty sessions are pruned on launch.

### Added — other

- `npm test` runs real storage regression tests (`tests/storage.test.mjs`) —
  plain Node, no framework, no new dependencies. Wired into GitHub and GitLab CI.
- `REQUIREMENTS.md`: the behavioral contract, including the threat model and a
  tracked list of known defects.
- `CHANGELOG.md` (this file).
- Tailscale support for mobile testing: `vite.config.js` allows `.ts.net`
  hostnames, which Vite 5.4 would otherwise reject. README documents three
  routes to a secure context on a phone.

### Changed — UI

- **The tutorial's final slide drops the Skip button.** Skip and "Start
  Surveying" did the same thing there, which is a false choice. "Start
  Surveying" now spans the full modal width and turns green, reading as the
  affirmative go action rather than another step.
- **Optional UI sounds**, with an enable/disable toggle under Export Data in the
  settings menu: a soft click when a node is saved, and a light ratcheting
  detent while dragging the direction dial (one tick per 3° crossed, rate
  limited so a fast drag cannot machine-gun it). Synthesized with the Web Audio
  API rather than shipping sample files — no new dependency, no binary assets
  to precache, nothing to break offline, and no third-party license to track.
  **Off by default**: this tool surveys surveillance infrastructure, sometimes
  where the user would rather not draw attention (REQUIREMENTS.md §2), so an
  audibly clicking phone should be opted into rather than discovered in the
  field. One line in `initSound()` changes that default if you disagree.
- **The launch session modal gained a "Show Tutorial [?]" option** and an
  attribution line: *"Flaneur is an Open Security Mapping Project web app. It is
  open source / GPLv3.0."* — linking the project name to the GitHub organization
  and "open source" to the repository. The tutorial opens over the session modal
  without picking a session, so the choice is still waiting when it closes.
- **The map opens on New York City Hall instead of the ocean.** Before a GPS fix
  the map sat at `[0, 0]` — Null Island, open water off West Africa — at zoom 18,
  which renders as a blank blue tile and reads as a broken map. It now opens at
  City Hall (40.712772, -74.006058) at zoom 16 for street context, and snaps to
  zoom 18 on the first real fix. A second, contradictory fallback that jumped to
  London on GPS timeout was removed.
- **Toasts wrap.** Longer messages, such as the GPS battery warning, ran off the
  side of a phone screen on a single line.
- **"GPS tracking active." is shown when GPS is engaged.** Only for changes the
  user initiates — GPS auto-starts at launch, and announcing that would bury the
  session-resume message.
- **The recording confirmation reports what was written**, not just the preset
  name: preset, bearing with cardinal (marked `cam` when `camera:direction` was
  applied), accuracy or manual placement, note and photo indicators, and the
  node's number in the session.
  Example: `📷 Fixed Camera · cam 245° WSW · ±8m · note · #12`
- **Cancel in the direction overlay is red, and now clears the bearing.**
  Previously it dismissed the overlay but left the direction badge set in the
  top bar, so the next recorded node was silently tagged with a bearing the user
  believed they had canceled.
- Preset buttons are disabled while there is no position fix, instead of
  accepting a tap that cannot be fulfilled. This is the user-visible half of the
  "first bookmark" fix.
- A short tap no longer leaves a preset pending, which previously caused the
  note modal to reopen unexpectedly after using the direction widget.
- Settings links to
  `github.com/Open-Security-Mapping-Project/flaneur-osm-recorder`. The GitLab
  link is commented out pending a published mirror.

### Changed — code structure

- **All static event listeners moved to `src/js/handlers.js`**, each bound to a
  named `on*` function, per the convention `CLAUDE.md` already documented but
  the code did not follow. `main.js` exports actions and registers nothing.
  Listeners for dynamically created elements stay with the code that creates
  them, still delegating to named functions.
- **All inline styles removed** from `index.html` (14 `style=` attributes) and
  from the direction widget's button construction. The inline `onclick` in the
  node list header is gone.
- Every user-visible string moved into `i18n.js`; several had been hardcoded in
  `main.js` and `index.html`.
- Removed 868 lines of unreferenced code: `direction-picker.js`,
  `direction-picker-integration.js`, `map-controls.js`, and stray
  `photo-review.*` files. `direction-widget.js` remains the live implementation.
- Removed verbose emoji console logging from the GPS and map hot paths.
- `CLAUDE.md` file map corrected — it described `node-list.js` and
  `photo-review.js`, which have never existed.

### Security / toolchain

- **`npm audit` is clean — 0 vulnerabilities, down from 16** (11 high, 4
  moderate, 1 low). All 16 were in the dev toolchain; the production audit was
  already clean, and nothing vulnerable ever reached the shipped bundle — the
  only runtime dependency is Leaflet. Two of them did matter to contributors,
  though: an esbuild flaw letting any website issue requests to the dev server
  and read the responses, and a Vite path traversal — both relevant because
  this project deliberately binds `0.0.0.0` for phone testing.
- **Vite 5.4 → 8.2, vite-plugin-pwa 0.19 → 1.3.** Required to clear the last
  three advisories. Build output verified identical in structure: same
  manifest, same three icons, same 9 precache entries.
- **Node requirement raised to `^20.19.0 || >=22.12.0`** (was `>=18.0.0`) to
  match Vite 8. CI moves to Node 22 LTS.
- **`"type": "module"` added to package.json**, clearing Vite's CJS config
  deprecation warning. `vite.config.js` now uses `import.meta.dirname` instead
  of `__dirname`.
- **CI actions bumped v4 → v7.** The v4 line targets Node 20, which GitHub has
  deprecated and force-runs on Node 24 with a warning on every job.
- **`caniuse-lite` refreshed** (was 6 months stale). No target browser changes.
- **Test harness no longer crashes on Node 21+.** It installed browser globals
  by plain assignment (`global.navigator = {}`), which throws
  `Cannot set property navigator of #<Object> which has only a getter` on Node
  21 and later, where `navigator` is a real read-only global. Node 22+ can
  expose `localStorage` the same way, so that assignment was equally fragile.
  Both now go through `Object.defineProperty`, which works whether or not the
  global already exists.
- **ESLint 8 → 10, migrated to flat config.** ESLint 8 reached end-of-life.
  `.eslintrc.cjs` is replaced by `eslint.config.js`, and the scripts drop the
  `--ext` flag that flat config no longer accepts. Linting now also covers
  `tests/` and the build configs, not just `src/`.
  - The `eslint-config-prettier` ban is unchanged and restated in the new
    config. The two formatting rules the old config had to switch off were
    removed from ESLint's recommended set in ESLint 9, so those overrides are
    simply gone. Verified empirically that ESLint is clean on Prettier-formatted
    output.
  - Browser and Node globals are listed explicitly rather than pulling in the
    `globals` package: the app uses fifteen browser globals, so the dependency
    would buy little, and an explicit list is stricter — a typo like `documnet`
    is still caught. One new dev dependency was unavoidable, `@eslint/js`, which
    holds the recommended ruleset that ESLint 10 no longer bundles; it is
    first-party (OpenJS Foundation, same repository as ESLint) with zero
    dependencies of its own.
  - Node floor raised to `^20.19.0 || ^22.13.0 || >=24`, the intersection of
    Vite 8's and ESLint 10's requirements.
- **GitLab CI caching actually works now.** The pipeline cached `node_modules/`
  while installing with `npm ci`, which deletes `node_modules` before it runs —
  so the restored cache was discarded every time, and the log showed a bare
  "Failed to extract cache". It now caches npm's download directory
  (`npm ci --cache .npm --prefer-offline`), keyed on `package-lock.json`, with a
  per-Node-version prefix so parallel matrix jobs cannot clobber each other's
  entry. `.npm/` added to `.gitignore`.
- **CI runs a Node matrix (20.19, 22, 24)** — both ends of the range declared in
  `package.json` "engines", plus the common LTS. The `navigator` breakage above
  was introduced and shipped precisely because the pipeline tested one version
  while development happened on another; a matrix makes that class of bug
  visible before merge. GitLab CI matches.
- **Test output no longer interleaves stack traces into unrelated sections.**
  Several tests deliberately drive storage failure paths, which log to stderr;
  Node buffers stdout and stderr separately, so in CI a `QuotaExceededError`
  stack printed underneath "BUG 1" and read as a failure when nothing was
  wrong. Expected error output is now suppressed while the assertions still
  verify the failure was reported.

### Known issues

Tracked in full in [REQUIREMENTS.md](./REQUIREMENTS.md) §9. Most significant:

- **Photos are stored as base64 in `localStorage`** and can exhaust the quota,
  after which no further nodes can be saved. Must move to IndexedDB before
  photos are promoted as a feature.
- No photo review or removal UI.
- No session picker — older sessions are retained but unreachable from the UI.
- Tiles cache on demand only; there is no "cache this area" control.
- `direction-widget.js` still sets styles via `style.cssText` in places,
  contrary to the project's CSS separation rule.
- French, German and Spanish are partial and fall back to English.

---

## [v1.0] — 2026-02-25

Initial version by Dan Feidt ([@hongpong](https://github.com/hongpong)).

- Mobile-first PWA shell with Leaflet map and OSM tiles
- 7 collection modes with OSM tag presets
- GPS tracking with accuracy indicator; crosshair mode for manual placement
- Hold-to-note recording, photo attachment, SVG compass direction widget
- Session storage in `localStorage`
- Export to OSM XML, GPX and GeoJSON
- i18n scaffolding (English complete; French, German, Spanish partial)
- Augmented-UI visual treatment

[v1.1-alpha1]: https://github.com/Open-Security-Mapping-Project/flaneur-osm-recorder/releases/tag/v1.1-alpha1
[v1.0]: https://github.com/Open-Security-Mapping-Project/flaneur-osm-recorder/releases/tag/v1.0
