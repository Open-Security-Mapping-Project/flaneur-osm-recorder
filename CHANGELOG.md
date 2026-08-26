# Changelog

All notable changes to Flaneur OSM Recorder are recorded here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning is [Semantic Versioning](https://semver.org/); pre-release builds
carry an `-alphaN` suffix and may change behaviour without notice.

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
- `REQUIREMENTS.md`: the behavioural contract, including the threat model and a
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
- **The launch session modal gained a "Show Tutorial [?]" option** and an
  attribution line: *"Flaneur is an Open Security Mapping Project web app. It is
  open source / GPLv3.0."* — linking the project name to the GitHub organisation
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
  believed they had cancelled.
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
