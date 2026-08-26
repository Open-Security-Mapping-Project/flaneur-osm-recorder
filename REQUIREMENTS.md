# Flaneur OSM Recorder — Requirements

Status: **draft for v1.1-alpha1** · Last revised 2026-08-26

This document states what the app must do, and — as importantly — what it must
never do. `CLAUDE.md` covers *how* the code is organized; this covers *what the
software is obliged to deliver*. When the two disagree about behavior, this
file wins and `CLAUDE.md` should be corrected.

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
- **R3.9 (SHOULD)** A direction, once set, applies to the next recorded node
  and then clears, so a bearing is never silently reused.

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
  non-destructive and repeatable.

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
| D3 | No session picker                      | Medium | Only "new" or "most recent with data". Older sessions are retained and exportable in principle but not reachable from the UI.                                                        |
| D4 | Tile pre-caching is on-demand only     | Medium | A "cache this area" control is needed for genuine offline surveying.                                                                                                                 |
| D5 | Full tag editing deferred to JOSM      | Low | Deliberate. Only the note field is editable in-app.                                                                                                                                  |
| D6 | No existing-OSM-data overlay           | Low | Overpass integration planned so surveyors can see what is already mapped.                                                                                                            |
| D7 | Non-English locales are stubs          | Low | fr/de/es carry a handful of keys and fall back to English for the rest.                                                                                                              |
| D8 | No automated browser/E2E test          | Low | Storage logic is unit-tested; UI flows are manual.                                                                                                                                   |
| D9 | PWA not really tested                  | Low | The PWA feature has not been reviewed.                                                                                                                                               |
| D10 | The first click of sound is loud.      | Low | When you first tap a preset it, it is louder than the subsequent.                                                                                                                    |
| D11 | Resuming a session is ambiguous       | Low | The user must decide whether to resume the last session or start a new one. But it also sometimes says that it is restarting the session anyway. Which I think is okay but the buttons should not be presented in the same fashion then. 
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
- [ ] Manual: install as a PWA on Android, confirm the icon and offline load
- [ ] Manual: airplane mode — confirm recording and export still work
- [ ] Known defects in §9 reviewed and updated
