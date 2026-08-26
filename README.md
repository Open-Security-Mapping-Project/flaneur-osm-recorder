# Flaneur OSM Recorder

> A mobile-first PWA for field survey data collection, designed for the OpenStreetMap / JOSM workflow.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

* **GitHub:** https://github.com/Open-Security-Mapping-Project/flaneur-osm-recorder
<!-- * **GitLab:** mirror not currently published -->

Current version: **v1.1-alpha1** — see [CHANGELOG.md](./CHANGELOG.md).

---

## What it does

Flaneur lets you walk around a neighborhood and quickly record geotagged OSM nodes by tapping preset buttons. It's a scratch pad — data never leaves your device until you explicitly export it. The intended workflow is:

```
Field survey (Flaneur) → Export OSM XML → Open in JOSM → Review & enrich → Upload to OSM
```

**Key features:**
- 📍 Live GPS tracking with accuracy indicator
- 🗺️ OpenStreetMap base layer (Leaflet, tiles cached for offline use)
- 🎛️ 7 collection modes: Urban, Surveillance (quick + detail), Curbs, Bicycle, Amenities, Power & Lights
- 📷 Photo attachment per node (photos stay local; workflow notes for Mapillary/Wikimedia Commons)
- 📝 Hold any preset button to add a text note before recording
- 💾 All data in `localStorage` — no server, no login
- 📤 Export to JOSM-compatible OSM XML, GPX, or GeoJSON
- 🔋 GPS battery warning when left active
- 🌍 i18n-ready (English, French, German, Spanish — add more in `src/js/i18n.js`)
- 🧭 Tutorial on first launch
- ⚡ Augmented-UI cyberpunk aesthetic

---

## Where your data lives

Everything you record stays in **this browser, on this device**, in
`localStorage`. There is no server, no account, and nothing is uploaded — not
even in the background. That has a direct consequence worth being clear about:

> **Exporting is your only backup.** Clearing your browser's site data,
> using "clear browsing data", or uninstalling the home-screen app will delete
> every saved session permanently.

What the app does to keep your survey safe while you walk:

- **Each point is written to disk the moment you tap.** There is no unsaved
  buffer to lose.
- **A failed save is never silent.** If storage is full or blocked, the point
  is not recorded, and you get a banner saying so — rather than a marker for a
  node that was never saved.
- **The app asks the browser for persistent storage,** which exempts your data
  from being evicted when the phone runs low on space. Settings → *Storage on
  this device* shows whether the browser granted it.
- **Your last session resumes automatically** when you reopen the app.
- **Settings shows what is stored:** sessions, node count, bytes used, and
  space available.

A node without a photo is well under 1 KB, so a long survey is a few hundred
KB at most. **Photos are the exception** — they are stored as base64 and a
handful of camera photos can fill the entire quota. Attach them sparingly
until photo storage moves to IndexedDB (see
[REQUIREMENTS.md](./REQUIREMENTS.md) §9, D1).

---

## Install as PWA

On Android (Chrome): tap the browser menu → **Add to Home Screen**  
On iOS (Safari): tap the share icon → **Add to Home Screen**  
On desktop: look for the install icon in the address bar

NOTE: PWA has not really been tested. 

---

## Development

### Prerequisites
- Node.js ≥ 20.19 (or ≥ 22.12) — required by Vite 8
- npm ≥ 10

### Setup

```bash
git clone https://github.com/Open-Security-Mapping-Project/flaneur-osm-recorder.git
cd flaneur-osm-recorder
npm install
npm run dev
```

Open `http://localhost:5173` in a browser. For GPS to work on non-HTTPS, use a mobile device on the same LAN or use `vite --host`.

### Build

```bash
npm run build    # Output in dist/
npm run preview  # Preview the production build
```

### Lint, Format & Test

```bash
npm run lint          # ESLint (auto-fix)
npm run lint:check    # ESLint (no fix, CI-safe)
npm run format        # Prettier (auto-fix)
npm run format:check  # Prettier (no fix, CI-safe)
npm test              # Storage regression tests (plain Node, no framework)
```

### Testing GPS on a phone over the LAN

`npm run dev` serves over plain HTTP by default, which is fine on `localhost` —
browsers treat it as a secure context, so GPS works. To test on a **phone over
your LAN** you need HTTPS, because a LAN IP is not a secure context. Generate a
certificate with [mkcert](https://github.com/FiloSottile/mkcert):

```bash
mkcert -key-file .cert/key.pem -cert-file .cert/cert.pem localhost 127.0.0.1 ::1 192.168.1.YOUR_IP_HERE
npm run dev
```

Vite picks up `.cert/` automatically when present and prints the HTTPS LAN
addresses on startup. `.cert/` is gitignored; without it the dev server simply
falls back to HTTP.

### Testing on a phone over Tailscale

Handy when the phone isn't on the same Wi-Fi. The dev server already binds
`0.0.0.0`, and `vite.config.js` allows `.ts.net` hostnames, so it is reachable
at your machine's tailnet address as soon as it starts.

GPS still needs a secure context, so pick one of these:

**Option A — Tailscale-issued cert (best; no warnings, works on iOS).**
Enable **HTTPS Certificates** once at
[login.tailscale.com/admin/dns](https://login.tailscale.com/admin/dns), then:

```bash
sudo tailscale serve --bg --https=443 5173
tailscale serve status          # shows the public https://<host>.ts.net URL
sudo tailscale serve reset      # tear it down when finished
```

Tailscale terminates TLS with a real Let's Encrypt certificate, so no CA needs
installing on the phone. Note the hostname appears in public Certificate
Transparency logs, and `serve` exposes the dev server to **every device on the
tailnet** — use `serve`, never `funnel` (which publishes to the open internet).

**Option B — mkcert, including your tailnet address.** Add the Tailscale IP and
MagicDNS name to the SAN list:

```bash
mkcert -key-file .cert/key.pem -cert-file .cert/cert.pem \
  localhost 127.0.0.1 ::1 192.168.1.YOUR_LAN_IP \
  100.x.y.z your-host.your-tailnet.ts.net your-host
```

Then install the mkcert root CA (`mkcert -CAROOT`, file `rootCA.pem`) on the
phone — Android: *Settings → Security → Encryption & credentials → Install a
certificate → CA certificate*; iOS: install the profile, then enable it under
*Settings → General → About → Certificate Trust Settings*.

**Option C — Android Chrome, zero setup.** Skip HTTPS entirely: open
`chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add
`http://100.x.y.z:5173`, set the flag to **Enabled**, and relaunch Chrome. GPS
then works over plain HTTP from that origin. Development only — there is no
iOS/Safari equivalent.

---

## Project Structure

```
flaneur-osm-recorder/
├── index.html                # App shell (augmented-ui, Leaflet mount)
├── public/
│   ├── favicon.svg
│   └── icons/                # PWA install icons (192, 512, maskable)
├── src/
│   ├── css/
│   │   ├── index.css         # All app styles (no inline styles anywhere)
│   │   └── direction-widget.css
│   └── js/
│       ├── main.js           # App state, map, GPS, render + action functions
│       ├── handlers.js       # Every static-element addEventListener, one place
│       ├── i18n.js           # All UI strings + translation support
│       ├── presets.js        # OSM tag presets for all modes
│       ├── storage.js        # localStorage sessions, durability, health
│       ├── export.js         # OSM XML / GPX / GeoJSON export
│       ├── gps.js            # Geolocation wrapper
│       ├── direction-widget.js  # SVG compass-rose bearing picker
│       └── ui-utils.js       # Toast, modal open/close, HTML escaping
├── tests/
│   └── storage.test.mjs      # Storage regression tests (npm test)
├── vite.config.js            # Vite + PWA plugin config
├── REQUIREMENTS.md           # What the app must do — read before big changes
├── CLAUDE.md                 # Conventions for AI assistants / contributors
├── package.json
├── .eslintrc.cjs
├── .prettierrc
└── LICENSE                   # GPL-3.0 + third-party notices
```

**Architecture notes.** `main.js` owns the DOM and exports action functions;
`handlers.js` binds them to elements and holds no logic of its own. All other
modules are DOM-free. All styles live in `src/css/` — there are no inline
`style=` attributes and no `<style>` blocks. See `CLAUDE.md` for the full
conventions and `REQUIREMENTS.md` for the behavioral contract.

---

## Adding a Collection Mode

1. Add an entry to `MODES` in `src/js/presets.js`
2. Add a preset array under the same key in `PRESETS`
3. Add label strings to every language block in `src/js/i18n.js`

## Adding a Language

1. Copy the `en` block in `src/js/i18n.js`
2. Change the key to your BCP-47 language code (e.g. `'pt'`)
3. Translate all values
4. Add an entry to `AVAILABLE_LOCALES`

---

## Export → JOSM Workflow

1. In Flaneur, tap **Export** → **JOSM / OSM XML** → file downloads
2. Transfer to desktop (cable, AirDrop, cloud folder, email)
3. In JOSM: **File → Open** the `.osm` file
4. Your surveyed nodes appear as a new layer with all tags set
5. Cross-reference against existing OSM data, adjust positions, add detail
6. When satisfied, upload through JOSM's normal upload flow

**Photo workflow:** Photos cannot be embedded in OSM data. Upload to
[Mapillary](https://www.mapillary.com/) or [Wikimedia Commons](https://commons.wikimedia.org/),
then add the URL as an `image=` tag in JOSM.
---

## Known issues

Tracked in full in [REQUIREMENTS.md](./REQUIREMENTS.md) §9. The ones most
likely to affect you:

* **Photos eat the storage quota.** They are stored as base64 in
  `localStorage`; a few phone photos can fill it and block further recording.
  Attach sparingly until this moves to IndexedDB.
* **No photo review UI.** Photos can be attached but not viewed or removed
  before saving.
* **No session picker.** The app resumes your last session with data; older
  sessions are kept but are not reachable from the UI.
* **Tiles cache on demand only.** Pan the area you intend to survey while you
  still have connectivity — there is no "cache this area" control yet.
* **French, German and Spanish are partial**, falling back to English for
  untranslated keys.

---

## Contributing

Pull requests welcome. Please:
- Run `npm run lint:check && npm run format:check && npm test` before submitting
- Read [REQUIREMENTS.md](./REQUIREMENTS.md) — especially §2 (data ownership)
  and §4 (storage durability) — before changing anything that touches saved data
- Keep preset tag choices aligned with the [OSM wiki](https://wiki.openstreetmap.org/)
- Translation contributions especially welcome

## License

GPL-3.0-or-later. See [LICENSE](./LICENSE) for third-party component licenses.

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL 1.0.

## Credits

Initial version by Dan Feidt ( @hongpong ) 2/25/2026 . Much of the code was auto generated with assistance from Claude AI.