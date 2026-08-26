
## Development

Additional specs are located in [REQUIREMENTS.md](REQUIREMENTS.md). This document covers methodology.

### Prerequisites
- Node.js ≥ 20.19, ≥ 22.13, or ≥ 24 — floors set by Vite 8 and ESLint 10
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
npm run lint          # ESLint 10, flat config (auto-fix)
npm run lint:check    # ESLint (no fix, CI-safe)
npm run format        # Prettier (auto-fix)
npm run format:check  # Prettier (no fix, CI-safe)
npm test              # Storage + icon/tag audits (plain Node, no framework)
npm run icons:fetch   # Re-vendor upstream icons from src/icons/icon-sources.json
npm run icons:credits # Regenerate the icon attribution block in this README
```

`npm run icons:fetch` is the only command that needs network access, and it is
not part of the build — the vendored icons are committed.

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
│   │   ├── icons.css         # Icon sprite + contrast plates
│   │   └── direction-widget.css
│   ├── icons/                # Preset icons, one SVG per icon
│   │   ├── icon-sources.json # Provenance + licence for every icon
│   │   ├── custom/           # The 10 surveillance originals (CC0, this repo)
│   │   ├── temaki/           # Vendored, CC0
│   │   ├── maki/             # Vendored, CC0
│   │   └── mdi/              # Vendored, Apache-2.0
│   └── js/
│       ├── main.js           # App state, map, GPS, render + action functions
│       ├── handlers.js       # Every static-element addEventListener, one place
│       ├── i18n.js           # All UI strings + translation support
│       ├── presets.js        # OSM tag presets + icon refs for all modes
│       ├── icons.js          # Builds the SVG sprite, hands out <use> refs
│       ├── storage.js        # localStorage sessions, durability, health
│       ├── export.js         # OSM XML / GPX / GeoJSON export
│       ├── gps.js            # Geolocation wrapper
│       ├── direction-widget.js  # SVG compass-rose bearing picker
│       └── ui-utils.js       # Toast, modal open/close, HTML escaping
├── tools/
│   ├── fetch-icons.mjs       # Vendors upstream icons (refresh/audit only)
│   └── build-credits.mjs     # Regenerates the icon credits in this README
├── tests/
│   ├── storage.test.mjs      # Storage regression tests (npm test)
│   └── icons.test.mjs        # Icon resolution, attribution, OSM tag audit
├── vite.config.js            # Vite + PWA plugin config
├── REQUIREMENTS.md           # What the app must do — read before big changes
├── CLAUDE.md                 # Conventions for AI assistants / contributors
├── package.json
├── eslint.config.js         # ESLint flat config (ESLint 9+ format)
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
2. Add a preset array under the same key in `PRESETS`, each with an `iconRef`
3. Add label strings to every language block in `src/js/i18n.js`
4. Add the icon — see below

## Adding an Icon

Preset icons are plain SVG files under `src/icons/<set>/<id>.svg`, referenced
from a preset as `iconRef: 'set:id'`. They are bundled at build time, so
nothing is fetched at runtime and the app works offline on first load.

**From an upstream set:**

1. Add the ref to `icons` in `src/icons/icon-sources.json`
2. `npm run icons:fetch` — downloads it, scales it to a 24×24 viewBox, sets
   `fill="currentColor"`, and writes it with a provenance header
3. Point a preset's `iconRef` at it
4. `npm run icons:credits` to regenerate the attribution in this README
5. `npm test`

The vendored files are **committed** — `npm run build` never needs the
network. Do not hand-edit them; change the manifest and re-fetch. The fetch
script fails hard rather than writing a broken icon, including when an
upstream viewBox disagrees with the grid the manifest declares (`temaki:atm`
is 50×50 in an otherwise 15×15 set, which is what `gridOverrides` is for).

**A new set** additionally needs a `sets` entry with its licence, read from
that project's own `LICENSE` file rather than from documentation about it.
Only GPL-3.0-compatible licences.

**An original icon** goes in `src/icons/custom/` by hand: a 24×24 viewBox,
`fill="currentColor"`, and no hardcoded colours anywhere — `npm test` enforces
all three. If it strokes as well as fills, put `stroke="currentColor"` on the
stroked group explicitly.

Icons are drawn on a contrast plate, because a single-colour glyph on this
UI's near-black background would otherwise disappear. The default is dark ink
on an off-white plate; `.icon-tile--invert` flips it for a light-bodied icon.
See `src/css/icons.css`.

## Adding a Language or Country

The selector is **Language / Country**, not language alone. The preset wording
is regional even where the language is not — the shipped `en` locale is
`English: US`, where *Post Box* means the blue USPS collection box and
*Crossing* means ladder-bar markings.

1. Copy the `en` block in `src/js/i18n.js`
2. Change the key to your BCP-47 tag — `'pt'` for a new language, or
   `'en-GB'`, `'es-MX'` for a regional variant
3. Translate or re-word the values
4. Add an entry to `AVAILABLE_LOCALES`, e.g. `{ code: 'en-GB', label: 'English: UK' }`

A regional variant only changes the words on the buttons. OSM tag values are
the same worldwide, so `presets.js` needs no changes at all.
