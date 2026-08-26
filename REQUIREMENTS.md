# Flaneur OSM Recorder — Requirements

Status: **draft for v1.1-alpha1** · Last revised 2026-08-26

This document states what the app must do, and — as importantly — what it must
never do. `CLAUDE.md` covers *how* the code is organized; this covers *what the
software is obliged to deliver*. When the two disagree about behavior, this
file wins and `CLAUDE.md` should be corrected.

## See [DEVELOPMENT.md](DEVELOPMENT.md) for the big info on dev process.


Requirements are marked:

| Mark | Meaning |
|---|---|
| **MUST** | Release blocker. A build that violates this does not ship. |
| **SHOULD** | Strongly expected. Deviations need a note in the release notes. |
| **MAY** | Optional / future. |

---

## 1. Purpose and scope

Flaneur is a **field survey scratch pad**. A surveyor walks a route, taps preset
buttons to drop geotagged OSM nodes at their position, and later exports the
session for review and upload in JOSM on a desktop.

It is explicitly **not**: an OSM editor, an upload client, a tracking app, or a
data-sharing platform. Anything that would make it one of those is out of scope.

**Primary user:** someone walking outdoors, one-handed, possibly in bad light,
possibly with poor connectivity, who needs to record a point in under two
seconds and trust that it is still there an hour later.

---

## 2. Data ownership and privacy

These are the requirements the project exists to honor. They are not
negotiable for convenience.

- **R2.1 (MUST)** No survey data leaves the device except through an export the
  user explicitly initiates. No telemetry, no analytics, no crash reporting, no
  remote session backup.
- **R2.2 (MUST)** No login, no account, no user identifier of any kind.
- **R2.3 (MUST)** The app makes no network requests other than: map tiles from
  the OSM tile CDN, the web fonts declared in `index.html`, and the
  augmented-ui stylesheet. Any new outbound request is a design change
  requiring explicit discussion.
- **R2.4 (MUST)** Recorded positions are never transmitted to a tile server or
  anywhere else. Tile requests reveal the viewport, which is unavoidable for a
  map; recorded node coordinates are a separate concern and stay local.
- **R2.5 (SHOULD)** The app works fully offline after first load, including
  recording, editing, and export. Only tile freshness depends on connectivity.
- **R2.6 (SHOULD)** The user can see, in the app, exactly what is stored and
  where — see §4.

> **Threat model note.** This tool is used to map surveillance infrastructure,
> sometimes in contexts where the surveyor would prefer that activity not be
> observable. The absence of a server is the primary protection and must be
> preserved. The residual exposure is the tile request pattern, which reveals
> approximate viewport history to the tile CDN. Users who need to avoid that
> should pre-cache tiles and survey in airplane mode.

---

## 3. Recording nodes

- **R3.1 (MUST)** A single tap on a preset button records a node at the current
  position with that preset's OSM tags, in one interaction.
- **R3.2 (MUST)** A tap must never *appear* to record a node that was not
  actually saved. If the node cannot be placed or cannot be persisted, the
  failure is stated plainly and no marker appears.
- **R3.3 (MUST)** When there is no position fix and placement mode is GPS,
  preset buttons are visibly disabled rather than silently failing. This is the
  fix for the reported "the first bookmark doesn't work" behavior: the app was
  accepting a tap it could not fulfil.
- **R3.4 (MUST)** Every recorded node carries: a negative integer id, lat/lon,
  an ISO timestamp, its preset tags, and `source=flaneur_survey`.
- **R3.5 (MUST)** Node ids are unique within a session **for the life of the
  session**, including across page reloads, app restarts, and session resume.
  Ids are derived from the session's existing nodes, never from a counter held
  in module memory.
- **R3.6 (MUST)** Holding a preset for 700 ms opens the note modal instead of
  recording immediately. Releasing before 700 ms records immediately.
- **R3.7 (SHOULD)** A crosshair placement mode lets the user place a node at
  the map center when GPS is unavailable or inaccurate.
- **R3.8 (SHOULD)** Haptic feedback (`navigator.vibrate(60)`) confirms a
  recording, guarded for browsers without support.
- **R3.9 (SHOULD)** A direction, once set, applies to the next recorded node and
  then clears, so a bearing is never silently reused — **except** on a node that
  carries `camera:direction`, where it is held for the node after it. A run of
  cameras along one street faces the same way, and re-setting the wheel between
  each was the cost of a rule written for one-off bearings. A held bearing must
  stay visible while it is held (top-bar badge, direction button arrow) and the
  record confirmation says it was kept.

---

## 4. Storage durability

The user's stated need: *assurance that geo bookmarks survive on the phone
while they move about.* These requirements exist to earn that.

- **R4.1 (MUST)** A recorded node is written to `localStorage` synchronously as
  part of the recording action. There is no unsaved in-memory window.
- **R4.2 (MUST)** Every write is failure-checked. A rejected write (quota
  exhausted, storage blocked, private mode) must:
  1. roll back the in-memory change, so the UI never shows a phantom node;
  2. tell the user the point was **not** saved, in plain language;
  3. raise a persistent banner, not just a 3-second toast.
- **R4.3 (MUST)** Survey data is never silently discarded to make room for
  anything else.
- **R4.4 (MUST)** On launch, the app verifies storage actually works by
  round-tripping a probe value. Exposing the API is not proof it persists —
  some privacy modes accept writes and discard them.
- **R4.5 (MUST)** A user's existing data must remain reachable through the UI.
  Creating a new session must never make a previous session with data
  unreachable. (The reported "localStorage is not working" was this: an empty
  new session shadowed the real one in the launch modal.)
- **R4.6 (SHOULD)** The app requests `navigator.storage.persist()` so the
  browser exempts the origin from eviction under storage pressure. Grant is not
  guaranteed; the resulting state is shown to the user either way.
- **R4.7 (SHOULD)** The session that was active last is resumed automatically
  on launch if it contains nodes. The user is only asked to choose when there
  is a genuine choice.
- **R4.8 (SHOULD)** The settings panel reports: number of sessions and nodes,
  bytes used, quota available, and whether storage is persisted or best-effort.
- **R4.9 (SHOULD)** Abandoned empty sessions are pruned on launch.
- **R4.9a (MUST)** "New session" means empty on screen as well as in storage.
  Adopting a session clears the markers of the one that was displayed before,
  along with any half-finished note, photo or bearing. (Node ids restart at −1
  in each session, so a leftover marker also *blocks* the first node of the new
  session from being drawn — `addNodeMarker()` treats the id as already
  present.)
- **R4.9b (SHOULD)** Starting a new session is reachable at any time, not only
  from the launch chooser — which R4.7 skips entirely once the active session
  holds nodes. The settings panel carries the control. Starting one keeps the
  previous session on the device; only "Clear All Sessions" deletes anything.
- **R4.9c (SHOULD)** The launch chooser is shown only when a choice is actually
  being offered, and its options are not presented as equivalent: whichever is
  the likely intent is drawn as the primary action. It is never left on screen
  over a session that has already been resumed.
- **R4.10 (MUST)** The app states plainly that clearing browser site data or
  uninstalling the PWA destroys all survey data, and that export is the only
  backup.

### Storage budget

| Data | Store | Notes |
|---|---|---|
| Sessions and nodes | `localStorage` | ~5–10 MB origin-wide. A node without photos is well under 1 KB. |
| Preferences | `localStorage` | Negligible. |
| Map tiles | Cache Storage (service worker) | Separate quota. Cannot evict survey data. |
| Photos (base64) | `localStorage` ⚠️ | **Known defect** — see §9. |

---

## 5. Export and JOSM interoperability

- **R5.1 (MUST)** OSM XML export opens in JOSM via `File › Open` with no
  conversion step.
- **R5.2 (MUST)** Exported node ids are negative and unique within the file.
  Duplicate ids corrupt the JOSM layer and must be impossible by construction.
- **R5.3 (MUST)** Every exported node carries `action="create"`.
- **R5.4 (MUST)** Coordinates are exported at 7 decimal places. Display
  precision (5 dp) must never leak into export.
- **R5.5 (MUST)** Photos are never embedded in any export format.
- **R5.6 (SHOULD)** GPX and GeoJSON are offered as secondary formats.
- **R5.7 (SHOULD)** Tag values are XML-escaped; a note containing `&`, `<`, or
  a quote must not produce a malformed file.
- **R5.8 (MUST)** Export never mutates or clears the session. Exporting is
  non-destructive and repeatable. This extends to the combined export: merging
  produces a throwaway object, and the stored sessions keep their own node ids.
- **R5.9 (MUST)** Every stored session is exportable. A session that is on the
  device but cannot be got off it is data loss with extra steps — the export
  modal offers "This Session" and "All Sessions", both labelled with the node
  counts they would write, counted from the same set the export walks. With
  only one session stored the picker is hidden entirely: two buttons that
  produce the identical file are not a choice, and showing them implies more is
  saved than is.
- **R5.10 (MUST)** The combined export reissues node ids across the whole file.
  Ids are per-session and every session starts again at −1, so concatenation
  alone would emit duplicates and violate R5.2. Guarded by
  `tests/export.test.mjs`.
- **R5.11 (SHOULD)** A combined file is identifiable as one: `flaneur_all_` in
  the filename, the source sessions listed in the OSM XML header comments and
  in the GeoJSON `source_sessions`, and each GeoJSON feature labelled with the
  session it came from. Provenance stays out of OSM *tags* — Flaneur's internal
  bookkeeping does not belong in OSM's data.

---

## 6. Field usability

- **R6.1 (MUST)** Usable one-handed on a phone. Preset tap targets are at least
  44×44 CSS px.
- **R6.2 (MUST)** Installable as a home-screen PWA, which requires a valid
  manifest and real icon files at the declared sizes.
- **R6.3 (SHOULD)** Readable outdoors; the dark high-contrast theme is the
  default and only theme.
- **R6.4 (SHOULD)** The map can be locked to GPS or freed for panning, and the
  current state is always visible on the lock button.
- **R6.5 (SHOULD)** GPS can be switched off to save battery, with the state
  shown by the indicator dot.
- **R6.6 (SHOULD)** All user-visible strings come from `i18n.js`. No string is
  hardcoded in `main.js` or `index.html`.
- **R6.7 (SHOULD)** Map overlays — the direction dial above all — fit inside
  the map pane on the smallest supported phone. Their parts are laid out in
  flow relative to each other, never pinned at fixed pixel offsets from the
  pane's center, which pushes controls off the bottom as soon as the pane is
  shorter than the offset assumes. The dial scales with the pane.
- **R6.8 (MUST)** No Leaflet control may cover an interactive overlay control.
  Leaflet parks its control containers at `z-index: 1000`; anything of ours
  that takes taps over the map must out-stack them for as long as it is open.
  (The attribution box was covering the direction dial's own buttons.)
- **R6.9 (SHOULD)** Feedback sounds are off by default (§2), and every sound is
  scheduled a fixed lead ahead of `AudioContext.currentTime` so its envelope
  renders from sample zero. Scheduling at `currentTime` discards the first
  rendering quantum of the attack on every sound *except* the first, which is
  what made the first click of a session audibly louder than the rest.
- **R6.10 (SHOULD)** Sounds are audible on a laptop's speakers as well as a
  phone's. A brief filtered-noise burst alone carries almost no energy in the
  band a laptop reproduces; ticks pair it with a pitched component.
- **R6.10a (SHOULD)** Escape backs out of the topmost open layer — the
  direction wheel or any modal or panel — with the same effect as that layer's
  own cancel, never a second exit path that behaves subtly differently. The
  launch session chooser is the one exception: it is a required choice, and
  dismissing it would leave no session to record into.
- **R6.11 (MUST)** No enabled control silently does nothing. A button that
  cannot act yet says what it is waiting for — the direction dial's "Set
  Direction" toasts for a bearing rather than ignoring the tap.
- **R6.12 (SHOULD)** Text drawn over map tiles carries its own contrast plate.
  Map tiles are arbitrary; a pale building or a road label underneath will
  otherwise swallow the glyph. Applies to the dial's cardinal letters and to
  preset icons (`.icon-tile`).
- **R6.13 (MUST)** Every row of the app shell — top bar, map, presets, status
  bar — is visible on the shortest supported phone, with the browser's own
  chrome showing. The shell is sized in `dvh` (`vh` only as the preceding
  fallback), and `env(safe-area-inset-bottom)` is applied to the bottom row
  alone.
- **R6.14 (SHOULD)** A control and the value it acts on are grouped and share a
  color, so the association is visible rather than inferred — the node count
  and the caret that opens the node list are one yellow pair at the right edge,
  and the direction button's arrow turns to the bearing it sets.
- **R6.15 (MUST)** The app shell does not scale under a browser pinch. Pinch is
  the map's gesture — Leaflet handles it — so a page-level pinch is never what
  the surveyor meant, and because `html`/`body` are `overflow: hidden` there is
  no scrollbar to reach whatever it pushes off-screen. Enforced three ways,
  because none is sufficient alone: `maximum-scale=1, user-scalable=no` in the
  viewport meta (which iOS honors only in an installed PWA), `touch-action:
  pan-x pan-y` on the root, and refusing Safari's `gesture*` events outside the
  map. Accepted trade-off against WCAG 1.4.4: the map zooms, the text does not.
- **R6.16 (MUST)** A modal opened from a panel stacks above that panel. The
  node list sheet clears the map buttons at `z-index: 1010` while modals sit at
  1000, so its edit and delete modals are explicitly lifted to 1020 — a modal
  behind the thing that launched it is a dead end. Stack, low to high: map
  controls 450–650 · settings 900 · modals 1000 · node list 1010 · node list's
  modals 1020 · toast 2000.

---

## 7. Data correctness

- **R7.1 (MUST)** Preset tags follow OSM wiki conventions. New presets are
  checked against the wiki before merging.
- **R7.2 (MUST)** Preset `id` values are stable forever once released — they
  are not user-visible and renaming them breaks nothing visibly, which is
  exactly why the breakage would go unnoticed.
- **R7.3 (MUST)** `direction` and `camera:direction` are written as integer
  degrees 0–359, never strings or floats.
- **R7.4 (MUST)** Flaneur records **nodes only**. Ways and relations are JOSM's
  job.
- **R7.5 (SHOULD)** GPS accuracy is recorded as `flaneur:accuracy` so the
  reviewer can judge which points need repositioning in JOSM.

---

## 8. Engineering constraints

- **R8.1 (MUST)** No frontend framework. Vanilla ES2022 modules.
- **R8.2 (MUST)** New npm dependencies require discussion and an NVD/OSV check
  first. `eslint-config-prettier` is permanently barred (CVE-2025-54313).
- **R8.3 (MUST)** No inline `style="..."` attributes, no `<style>` blocks, no
  inline `onclick` attributes. See `CLAUDE.md` for the two narrow exceptions.
- **R8.4 (MUST)** No anonymous functions passed to `addEventListener`. Static
  element listeners are registered in `handlers.js`; dynamic element listeners
  stay with the code that creates the element but still call a named function.
- **R8.5 (MUST)** `npm run lint:check`, `npm run format:check`, `npm test`, and
  `npm run build` all pass before a release tag.
- **R8.6 (MUST)** A fresh `git clone && npm install` can run `npm run dev` and
  `npm run build` with no extra setup. Optional local files (TLS certs) must
  degrade, never crash the config.
- **R8.7 (SHOULD)** Storage and export logic — the parts that can lose a user's
  work — carry regression tests in `tests/`.
- **R8.8 (MUST)** Use American US English spelling, not British English spelling.
  Applies to UI strings, documentation, comments, and commit messages —
  "center" not "centre", "color" not "colour", "behavior" not "behaviour".
- **R8.9 (MUST)** `npm audit --omit=dev` reports zero vulnerabilities before a
  release tag. The shipped bundle carries exactly one runtime dependency
  (Leaflet), so this is a low bar that must never be missed.
- **R8.10 (SHOULD)** `npm audit` (including dev dependencies) is clean. Dev
  toolchain advisories do not reach users, but the dev server is deliberately
  bound to `0.0.0.0` for phone testing, so dev-server vulnerabilities are a
  real exposure for contributors.
- **R8.11 (SHOULD)** CI output stays legible: tests that exercise failure paths
  suppress their expected error logging, so a passing run contains no stack
  traces that could be mistaken for failures.
- **R8.12 (MUST)** CI exercises both ends of the Node range declared in
  `package.json` "engines". Node's browser-global surface changes between
  majors — 21+ added a read-only `navigator`, 22+ can expose `localStorage` —
  so a single-version pipeline will miss breakage that only appears on a
  contributor's machine, or only on CI. Test harness code must install browser
  globals with `Object.defineProperty`, never bare assignment, for the same
  reason.

---

## 9. Known defects and deferred work

Carried forward as of this revision.

| # | Item                                   | Severity | Notes                                                                                                                                                                                |
|---|----------------------------------------|---|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| D1 | Photos stored base64 in `localStorage` | **High** | A few camera photos can exhaust the quota and block node saving. Must move to IndexedDB before photos are promoted as a feature. Until then the UI should discourage heavy photo use. |
| D2 | No photo review/removal UI             | Medium | Photos can be attached but not viewed or detached before saving.                                                                                                                     |
| D3 | No session picker                      | Low | Recording still targets "new" or "most recent with data" — an individual older session cannot be reopened by name. Their **data** is no longer stranded: "All Sessions" exports every one of them in a single file (R5.9). |
| D4 | Tile pre-caching is on-demand only     | Medium | A "cache this area" control is needed for genuine offline surveying.                                                                                                                 |
| D5 | Full tag editing deferred to JOSM      | Low | Deliberate. Only the note field is editable in-app.                                                                                                                                  |
| D6 | No existing-OSM-data overlay           | Low | Overpass integration planned so surveyors can see what is already mapped.                                                                                                            |
| D7 | Non-English locales are stubs          | Low | fr/de/es carry a handful of keys and fall back to English for the rest.                                                                                                              |
| D8 | No automated browser/E2E test          | Low | Storage logic is unit-tested; UI flows are manual.                                                                                                                                   |
| D9 | PWA not really tested                  | Low | The PWA feature has not been reviewed.                                                                                                                                               |
| D12 | iOS silences Web Audio                 | Low | On iPhone the ring/silent switch mutes Web Audio unless the page sets `navigator.audioSession.type = 'playback'`, which only Safari 16.4+ has. Below that there is no way to make the app audible with the switch set to silent; the sound toggle should say so rather than appear broken. |

### Resolved in this revision

- **D10 — the first click was louder than the rest.** Sounds were scheduled at
  exactly `ac.currentTime`. The audio thread renders in 128-sample quanta, so
  everything scheduled mid-quantum loses the first milliseconds of its attack —
  every sound except the first, which lands on a quantum boundary because the
  context has only just started. Fixed by a constant `SCHEDULE_LEAD_S` on every
  sound (R6.9), a shared master gain, and real attack ramps instead of jumps
  straight to peak. Drag ticks also gained a pitched component so they are
  audible on a desktop mouse drag, not only held to a phone's speaker (R6.10).
- **D11 — "New Session" gave you the previous session's nodes.** `#modal-session`
  carried no `hidden` attribute, so the chooser was painted on every launch, and
  the silent-resume path in `openSessionModal()` returned *without closing it* —
  leaving the chooser on top of a session that had already been restored and
  drawn on the map. Tapping "New Session" there created an empty session under a
  map still full of the old session's markers. Fixed by R4.9a–R4.9c: the modal
  is hidden until a choice is genuinely offered, adopting a session clears the
  previous one's markers and pending state, and the two options are no longer
  styled identically. A "Start New Session" control in settings makes a new
  session reachable once resume has taken over the launch path (R4.9b).

---

## 10. Release checklist

Before tagging a release:

- [ ] `npm run lint:check` clean
- [ ] `npm run format:check` clean
- [ ] `npm test` passes, with no stray stack traces in the output
- [ ] `npm run build` succeeds from a clean clone with no `.cert/`
- [ ] `npm audit --omit=dev` reports zero vulnerabilities (R8.9)
- [ ] `npm audit` reviewed; any remaining dev advisories noted in the changelog
- [ ] Manual: record a node, reload the page, confirm it is still there
- [ ] Manual: record nodes, reload, append to the session, confirm new markers
      appear and node ids do not repeat
- [ ] Manual: export OSM XML, open in JOSM, confirm the layer loads with all
      nodes and no duplicate-id warning
- [ ] Manual: with two or more sessions saved, export "All Sessions" and
      confirm JOSM loads every node from every session as one layer, with no
      duplicate-id warning
- [ ] Manual: start a new session with nodes on screen — confirm the map,
      the count and the node list all come back empty
- [ ] Manual: on the shortest phone screen supported, open the direction dial
      and confirm its buttons sit inside the map pane and are not covered by
      the OpenStreetMap attribution box
- [ ] Manual: with sound on, record several nodes — the first click must be no
      louder than the rest — and drag the dial with a mouse to hear the ticks
- [ ] Manual: install as a PWA on Android, confirm the icon and offline load
- [ ] Manual: airplane mode — confirm recording and export still work
- [ ] Known defects in §9 reviewed and updated
