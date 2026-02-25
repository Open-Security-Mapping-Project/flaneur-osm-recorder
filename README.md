# Flaneur OSM Recorder

> A mobile-first PWA for field survey data collection, designed for the OpenStreetMap / JOSM workflow.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

* **GitHub:** TBD
* **GitLab:** TBD

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

## Install as PWA

On Android (Chrome): tap the browser menu → **Add to Home Screen**  
On iOS (Safari): tap the share icon → **Add to Home Screen**  
On desktop: look for the install icon in the address bar

---

## Development

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### Setup

```bash
git clone https://github.com/flaneur-osm/flaneur-osm-recorder.git
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

### Lint & Format

```bash
npm run lint          # ESLint (auto-fix)
npm run lint:check    # ESLint (no fix, CI-safe)
npm run format        # Prettier (auto-fix)
npm run format:check  # Prettier (no fix, CI-safe)
```

You can use mkcert to generate a self-signed certificate for HTTPS:

```bash
mkcert -key-file .cert/key.pem -cert-file .cert/cert.pem localhost 127.0.0.1 ::1 192.168.1.YOUR_IP_HERE

```

Then it is accessible on your LAN for mobile use.

---

## Project Structure

```
flaneur-osm-recorder/
├── index.html              # App shell (augmented-ui, Leaflet mount)
├── src/
│   └── js/
│       ├── main.js         # App wiring, event handlers
│       ├── i18n.js         # All UI strings + translation support
│       ├── presets.js      # OSM tag presets for all modes
│       ├── storage.js      # localStorage session management
│       ├── export.js       # OSM XML / GPX / GeoJSON export
│       └── gps.js          # Geolocation wrapper
├── vite.config.js          # Vite + PWA plugin config
├── package.json
├── .eslintrc.cjs
├── .prettierrc
└── LICENSE                 # GPL-3.0 + third-party notices
```

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

* There is a problem with the location GPS and getting OpenStreetMap to load currently (gps.js needs improvement).

---

## Contributing

Pull requests welcome. Please:
- Run `npm run lint:check && npm run format:check` before submitting
- Keep preset tag choices aligned with the [OSM wiki](https://wiki.openstreetmap.org/)
- Translation contributions especially welcome

## License

GPL-3.0-or-later. See [LICENSE](./LICENSE) for third-party component licenses.

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL 1.0.

## Credits

Initial version by Dan Feidt ( @hongpong ) 2/25/2026 . Much of the code was auto generated with assistance from Claude AI.