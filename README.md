# Flaneur OSM Recorder

> A mobile-first website app & PWA for field survey data collection, designed for the OpenStreetMap / JOSM workflow.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

* **GitHub:** https://github.com/Open-Security-Mapping-Project/flaneur-osm-recorder
<!-- * **GitLab:** mirror not currently published -->

Current version: **v1.1-alpha1** — see [CHANGELOG.md](./CHANGELOG.md).

This is an independent project. It is not affiliated with OpenStreetMap or JOSM. It aims to streamline working with those platforms, however.

---

## What it does

Flaneur lets you walk around a neighborhood and quickly record geotagged nodes by tapping preset buttons. It's a scratch pad — data never leaves your device until you explicitly export it. You get nodes formatted in the OpenStreetMap style and attributes. Then you export them to editor tools (e.g. JOSM) for a little more fiddling around.

The goal here is to make it as easy as possible to collect your geographic points of interested on the go with mobile. The app does *not* plug them into OSM for you.

The intended workflow is:

```
Field survey (Flaneur) → Export OSM XML → 
Open in JOSM → Review & enrich → 
Upload to OSM
```

This can help with team efforts. People in the field gather the data points and a cartographer adds them to OSM. The process is vastly streamlined this way.

**Key features:**
- Live GPS tracking with accuracy indicator
- OpenStreetMap base layer 
- 7 modes for quickly adding items: Urban, Surveillance (quick + detail), Curbs, Bicycle, Amenities, Power & Lights
- Photo attachment per node (photos stay local; workflow notes for Mapillary/Wikimedia Commons) - this is in development.
- Hold any preset button to add a text note before recording
- All data in `localStorage` — no server, no login
- Export to JOSM-compatible OSM XML, GPX, or GeoJSON
- GPS battery warning when left active
- i18n-ready (English, French, German, Spanish — add more in `src/js/i18n.js`) for full internationalization.
- Tutorial on first launch
- Augmented-UI cyberpunk aesthetic

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

Tiles are cached in the map as well - so you do not need an active Internet connection while in the field collecting your data points. The phone's GPS will keep tracking your location if it is enabled.

---

## Install as PWA

On Android (Chrome): tap the browser menu → **Add to Home Screen**  
On iOS (Safari): tap the share icon → **Add to Home Screen**  
On desktop: look for the install icon in the address bar

**NOTE**: PWA has not really been tested. 

## See [DEVELOPMENT.md](DEVELOPMENT.md) for the big info on dev process.

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

## Icon credits

<!-- ICON-CREDITS:START — generated by tools/build-credits.mjs, do not edit by hand -->

The preset buttons use freely-licensed SVG icons, vendored into `src/icons/`.
Every set below is compatible with GPL-3.0-or-later. Provenance for each
individual icon is in [`src/icons/icon-sources.json`](./src/icons/icon-sources.json);
`npm test` fails if an icon ships without an entry there.

### Temaki (rapideditor)

- **Licence:** CC0-1.0 — <https://creativecommons.org/publicdomain/zero/1.0/>
- **Source:** <https://github.com/rapideditor/temaki>
- **Shipped here:** 26 icons
- Public domain dedication — attribution is courtesy here, not obligation.

<details><summary>Per-icon attribution</summary>

- `temaki:atm` — <https://github.com/rapideditor/temaki/blob/main/icons/atm.svg> — used by: amen_atm
- `temaki:bench` — <https://github.com/rapideditor/temaki/blob/main/icons/bench.svg> — used by: amen_bench
- `temaki:bicycle_box` — <https://github.com/rapideditor/temaki/blob/main/icons/bicycle_box.svg> — used by: bike_box
- `temaki:bicycle_locker` — <https://github.com/rapideditor/temaki/blob/main/icons/bicycle_locker.svg> — used by: bike_locker
- `temaki:bicycle_parked` — <https://github.com/rapideditor/temaki/blob/main/icons/bicycle_parked.svg> — used by: bike_parking
- `temaki:bicycle_rental` — <https://github.com/rapideditor/temaki/blob/main/icons/bicycle_rental.svg> — used by: bike_share
- `temaki:bicycle_repair` — <https://github.com/rapideditor/temaki/blob/main/icons/bicycle_repair.svg> — used by: bike_repair
- `temaki:bollard` — <https://github.com/rapideditor/temaki/blob/main/icons/bollard.svg> — used by: curb_barrier, bike_bollard
- `temaki:crossing_markings-ladder` — <https://github.com/rapideditor/temaki/blob/main/icons/crossing_markings-ladder.svg> — used by: curb_crossing
- `temaki:kerb-lowered` — <https://github.com/rapideditor/temaki/blob/main/icons/kerb-lowered.svg> — used by: curb_lowered
- `temaki:kerb-raised` — <https://github.com/rapideditor/temaki/blob/main/icons/kerb-raised.svg> — used by: curb_raised
- `temaki:manhole` — <https://github.com/rapideditor/temaki/blob/main/icons/manhole.svg> — used by: urban_manhole
- `temaki:mast_lighting` — <https://github.com/rapideditor/temaki/blob/main/icons/mast_lighting.svg> — used by: pow_floodlight
- `temaki:post_box` — <https://github.com/rapideditor/temaki/blob/main/icons/post_box.svg> — used by: urban_postbox
- `temaki:power_device` — <https://github.com/rapideditor/temaki/blob/main/icons/power_device.svg> — used by: pow_cabinet
- `temaki:power_meter` — <https://github.com/rapideditor/temaki/blob/main/icons/power_meter.svg> — used by: pow_meter
- `temaki:power_pole` — <https://github.com/rapideditor/temaki/blob/main/icons/power_pole.svg> — used by: pow_pole
- `temaki:power_tower` — <https://github.com/rapideditor/temaki/blob/main/icons/power_tower.svg> — used by: pow_tower
- `temaki:power_transformer` — <https://github.com/rapideditor/temaki/blob/main/icons/power_transformer.svg> — used by: pow_transformer
- `temaki:speed_bump` — <https://github.com/rapideditor/temaki/blob/main/icons/speed_bump.svg> — used by: curb_bump
- `temaki:street_lamp_arm` — <https://github.com/rapideditor/temaki/blob/main/icons/street_lamp_arm.svg> — used by: urban_streetlight, pow_lamp
- `temaki:traffic_signals` — <https://github.com/rapideditor/temaki/blob/main/icons/traffic_signals.svg> — used by: bike_signal
- `temaki:transit_shelter` — <https://github.com/rapideditor/temaki/blob/main/icons/transit_shelter.svg> — used by: amen_shelter
- `temaki:utility_pole` — <https://github.com/rapideditor/temaki/blob/main/icons/utility_pole.svg> — used by: urban_pole
- `temaki:water_manhole` — <https://github.com/rapideditor/temaki/blob/main/icons/water_manhole.svg> — used by: curb_catch_basin
- `temaki:wind_turbine` — <https://github.com/rapideditor/temaki/blob/main/icons/wind_turbine.svg> — used by: pow_wind

</details>

### Maki (Mapbox)

- **Licence:** CC0-1.0 — <https://creativecommons.org/publicdomain/zero/1.0/>
- **Source:** <https://github.com/mapbox/maki>
- **Shipped here:** 6 icons
- Public domain dedication — attribution is courtesy here, not obligation.

<details><summary>Per-icon attribution</summary>

- `maki:defibrillator` — <https://github.com/mapbox/maki/blob/main/icons/defibrillator.svg> — used by: amen_aed
- `maki:drinking-water` — <https://github.com/mapbox/maki/blob/main/icons/drinking-water.svg> — used by: amen_water
- `maki:emergency-phone` — <https://github.com/mapbox/maki/blob/main/icons/emergency-phone.svg> — used by: urban_sos
- `maki:information` — <https://github.com/mapbox/maki/blob/main/icons/information.svg> — used by: amen_info
- `maki:recycling` — <https://github.com/mapbox/maki/blob/main/icons/recycling.svg> — used by: amen_recycling
- `maki:toilet` — <https://github.com/mapbox/maki/blob/main/icons/toilet.svg> — used by: amen_toilet

</details>

### Material Design Icons (Pictogrammers)

- **Licence:** Apache-2.0 — <https://www.apache.org/licenses/LICENSE-2.0>
- **Source:** <https://pictogrammers.com/library/mdi/>
- **Shipped here:** 16 icons
- Apache-2.0 requires this notice be retained in distributions. **Do not delete this section.**

<details><summary>Per-icon attribution</summary>

- `mdi:bus-stop` — <https://pictogrammers.com/library/mdi/icon/bus-stop/> — used by: amen_bus_stop
- `mdi:cash-clock` — <https://pictogrammers.com/library/mdi/icon/cash-clock/> — used by: curb_parking_meter
- `mdi:dots-grid` — <https://pictogrammers.com/library/mdi/icon/dots-grid/> — used by: curb_tactile
- `mdi:factory` — <https://pictogrammers.com/library/mdi/icon/factory/> — used by: pow_substation
- `mdi:fire-hydrant` — <https://pictogrammers.com/library/mdi/icon/fire-hydrant/> — used by: urban_hydrant
- `mdi:locker` — <https://pictogrammers.com/library/mdi/icon/locker/> — used by: urban_cabinet
- `mdi:map-marker` — <https://pictogrammers.com/library/mdi/icon/map-marker/> — used by: (fallback for unmatched nodes)
- `mdi:map-marker-alert` — <https://pictogrammers.com/library/mdi/icon/map-marker-alert/> — used by: urban_sign
- `mdi:pump` — <https://pictogrammers.com/library/mdi/icon/pump/> — used by: bike_pump
- `mdi:road-variant` — <https://pictogrammers.com/library/mdi/icon/road-variant/> — used by: bike_lane
- `mdi:slope-uphill` — <https://pictogrammers.com/library/mdi/icon/slope-uphill/> — used by: bike_ramp
- `mdi:solar-panel` — <https://pictogrammers.com/library/mdi/icon/solar-panel/> — used by: pow_solar
- `mdi:table-picnic` — <https://pictogrammers.com/library/mdi/icon/table-picnic/> — used by: amen_picnic
- `mdi:trash-can` — <https://pictogrammers.com/library/mdi/icon/trash-can/> — used by: urban_bin
- `mdi:view-sequential-outline` — <https://pictogrammers.com/library/mdi/icon/view-sequential-outline/> — used by: curb_gully
- `mdi:waves` — <https://pictogrammers.com/library/mdi/icon/waves/> — used by: curb_drain

</details>

### Flaneur surveillance set (this repo)

- **Licence:** CC0-1.0 — <https://creativecommons.org/publicdomain/zero/1.0/>
- **Source:** `src/icons/custom/`
- **Shipped here:** 10 icons
- Public domain dedication — attribution is courtesy here, not obligation.

<details><summary>Per-icon attribution</summary>

- `custom:acoustic-sensor` — `src/icons/custom/acoustic-sensor.svg` — used by: survd_audio
- `custom:camera-360` — `src/icons/custom/camera-360.svg` — used by: survd_dome_360
- `custom:camera-alpr` — `src/icons/custom/camera-alpr.svg` — used by: surv_flock, survd_flock_entry, survd_flock_exit, survd_anpr
- `custom:camera-bullet` — `src/icons/custom/camera-bullet.svg` — used by: urban_camera, surv_fixed, survd_fixed_angle
- `custom:camera-dome` — `src/icons/custom/camera-dome.svg` — used by: surv_dome
- `custom:camera-dome-pole` — `src/icons/custom/camera-dome-pole.svg` — used by: survd_dome_tilted
- `custom:camera-indoor` — `src/icons/custom/camera-indoor.svg` — used by: surv_indoor
- `custom:camera-ptz` — `src/icons/custom/camera-ptz.svg` — used by: surv_ptz, survd_ptz_pole, survd_ptz_fixed
- `custom:camera-thermal` — `src/icons/custom/camera-thermal.svg` — used by: survd_thermal
- `custom:camera-unknown` — `src/icons/custom/camera-unknown.svg` — used by: surv_unknown

</details>

### Sets evaluated and rejected

- **osm-icons.org** — mostly CC0 (SJJB-derived), **but** the site publishes a
  per-icon licence table and some entries are CC BY-SA 2.0. Never bulk-import.
- **freesvg.org** — the ToS declares uploads CC0, but provenance is not verified
  and the site disclaims liability. Clipart-detailed, not icon-grade at 24px.
- **The Noun Project** — CC BY 3.0 with per-icon attribution in a prescribed
  format, or paid. Usable, but it would pollute an otherwise clean pipeline.
- **JOSM preset images** — GPL-2.0-or-later, so perfectly usable, and they have
  the closest semantic match for a handful of presets (street cabinet, ticket
  machine, substation, AED, cycle lane, kerb pattern). Not shipped because they
  are **full colour** and would clash with a flat single-colour UI. Adopt them
  only if you accept the colour or flatten them first.

<!-- ICON-CREDITS:END -->