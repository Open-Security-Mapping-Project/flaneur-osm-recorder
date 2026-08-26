/**
 * Flaneur OSM Recorder — Preset Definitions
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Each preset maps a UI button to a set of OSM tags.
 * Tags follow OSM wiki conventions. Additional tags can be added in JOSM.
 *
 * Structure:
 *   id         — stable identifier (never change once deployed)
 *   labelKey   — i18n key for display name
 *   iconRef    — `set:id` into the icon sprite; see src/icons/icon-sources.json
 *   tags       — OSM tags to write on the node
 *   legacyTags — optional; tag sets this preset USED to write. Never emitted,
 *                only matched, so nodes saved before a tagging fix still show
 *                the right icon and label. See "Tagging corrections" below.
 *
 * ── Icons ────────────────────────────────────────────────────────────────
 * `iconRef` replaced the emoji these presets used to carry. Every ref must
 * resolve to a file at src/icons/<set>/<id>.svg and be listed in
 * src/icons/icon-sources.json; tests/icons.test.mjs enforces both. Upstream
 * sets are vendored by tools/fetch-icons.mjs — do not hand-edit those files.
 *
 * ── Tagging corrections ──────────────────────────────────────────────────
 * The surveillance tags were verified against openstreetmap/id-tagging-schema,
 * which is what the iD editor validates against, and several were wrong:
 *
 *   surveillance:type takes only camera | guard | gunshot_detector | ALPR.
 *   Camera GEOMETRY belongs in camera:type, which takes fixed | panning | dome.
 *
 * So `surveillance:type=fixed|dome|thermal|audio` and `camera:type=PTZ` were
 * all invalid values, and are corrected here. Camera presets now also write
 * `surveillance:type=camera` to match iD's own Surveillance Camera preset,
 * which makes them round-trip cleanly.
 *
 * `camera:direction` is a NUMBER field in degrees (0-359), so the old
 * `camera:direction=360` on survd_dome_360 was not a valid value — 360 is the
 * same bearing as 0. For a genuinely omnidirectional unit the key is omitted
 * entirely, which is what that preset now does.
 *
 * Anything corrected keeps its old tag set in `legacyTags` so existing saved
 * sessions are unaffected.
 *
 * ── Known duplicate tag output ───────────────────────────────────────────
 * urban_pole / pow_pole both write power=pole, and curb_barrier /
 * bike_bollard both write barrier=bollard. They are genuinely
 * indistinguishable by tags. Nodes record which preset created them
 * (node.presetId), so the UI still shows the right one; only nodes saved
 * before that existed fall back to tag matching and may resolve to the other
 * member of the pair. Merging the pairs is the real fix, if the duplicate
 * buttons turn out not to earn their place.
 */

/**
 * Icon drawn for a node whose preset cannot be determined — replaces the old
 * 📍 fallback. Must be present in src/icons/icon-sources.json like any other.
 */
export const FALLBACK_ICON = 'mdi:map-marker';

export const MODES = [
  { id: 'urban', labelKey: 'modeUrban' },
  { id: 'surveillance', labelKey: 'modeSurveillance' },
  { id: 'surveillance_detail', labelKey: 'modeSurveillanceDetail' },
  { id: 'curbs', labelKey: 'modeCurbs' },
  { id: 'bike', labelKey: 'modeBike' },
  { id: 'amenities', labelKey: 'modeAmenities' },
  { id: 'power', labelKey: 'modePower' },
];

export const PRESETS = {
  // ─── URBAN ────────────────────────────────────────────────────────────────
  urban: [
    {
      id: 'urban_camera',
      labelKey: 'presetCamera',
      iconRef: 'custom:camera-bullet',
      tags: { man_made: 'surveillance', surveillance: 'outdoor' },
    },
    {
      id: 'urban_pole',
      labelKey: 'presetPole',
      // Generic US wood pole with crossarm. temaki:power_pole (used by
      // pow_pole) is the same object with a bolt added.
      iconRef: 'temaki:utility_pole',
      tags: { power: 'pole' },
    },
    {
      id: 'urban_sos',
      labelKey: 'presetSOSPhone',
      iconRef: 'maki:emergency-phone',
      tags: { emergency: 'phone' },
    },
    {
      id: 'urban_streetlight',
      labelKey: 'presetStreetLight',
      // Cobra-head arm lamp: the standard American streetlight silhouette.
      iconRef: 'temaki:street_lamp_arm',
      tags: { highway: 'street_lamp' },
    },
    {
      id: 'urban_hydrant',
      labelKey: 'presetHydrant',
      // US pillar hydrant, not a UK/EU underground marker plate.
      iconRef: 'mdi:fire-hydrant',
      tags: { emergency: 'fire_hydrant' },
    },
    {
      id: 'urban_postbox',
      labelKey: 'presetPostBox',
      // USPS blue collection box. NOT mdi:mailbox — that is the residential
      // curbside box with the flag, which is amenity=letter_box, a different
      // tag. And not JOSM's, which is a red EU envelope.
      iconRef: 'temaki:post_box',
      tags: { amenity: 'post_box' },
    },
    {
      id: 'urban_bin',
      labelKey: 'presetWasteBin',
      iconRef: 'mdi:trash-can',
      tags: { amenity: 'waste_basket' },
    },
    {
      id: 'urban_cabinet',
      labelKey: 'presetCabinet',
      // Weak pick: mdi:locker is a gym locker. No free set has a street
      // cabinet; JOSM's misc/street_cabinet is right but full colour.
      iconRef: 'mdi:locker',
      tags: { man_made: 'street_cabinet' },
    },
    {
      id: 'urban_manhole',
      labelKey: 'presetManhole',
      iconRef: 'temaki:manhole',
      tags: { man_made: 'manhole' },
    },
    {
      id: 'urban_sign',
      labelKey: 'presetSign',
      // An emergency access point is a marker post carrying a code, so a
      // marker reads better than a barricade.
      iconRef: 'mdi:map-marker-alert',
      tags: { highway: 'emergency_access_point' },
    },
  ],

  // ─── SURVEILLANCE (quick / coarse) ────────────────────────────────────────
  surveillance: [
    {
      id: 'surv_fixed',
      labelKey: 'presetSurvFixed',
      iconRef: 'custom:camera-bullet',
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'camera',
        'camera:type': 'fixed',
      },
      legacyTags: [
        { man_made: 'surveillance', surveillance: 'outdoor', 'surveillance:type': 'fixed' },
      ],
    },
    {
      id: 'surv_dome',
      labelKey: 'presetSurvDome',
      iconRef: 'custom:camera-dome',
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'camera',
        'camera:type': 'dome',
      },
      legacyTags: [
        { man_made: 'surveillance', surveillance: 'outdoor', 'surveillance:type': 'dome' },
      ],
    },
    {
      id: 'surv_flock',
      labelKey: 'presetSurvFlock',
      iconRef: 'custom:camera-alpr',
      tags: { man_made: 'surveillance', surveillance: 'outdoor', 'surveillance:type': 'ALPR' },
    },
    {
      id: 'surv_ptz',
      labelKey: 'presetSurvPTZ',
      iconRef: 'custom:camera-ptz',
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'camera',
        'camera:type': 'panning',
        'camera:mount': 'pole',
      },
      legacyTags: [
        {
          man_made: 'surveillance',
          surveillance: 'outdoor',
          'surveillance:type': 'dome',
          'camera:mount': 'pole',
        },
      ],
    },
    {
      id: 'surv_indoor',
      labelKey: 'presetSurvIndoor',
      iconRef: 'custom:camera-indoor',
      tags: {
        man_made: 'surveillance',
        surveillance: 'indoor',
        'surveillance:type': 'camera',
      },
      legacyTags: [{ man_made: 'surveillance', surveillance: 'indoor' }],
    },
    {
      id: 'surv_unknown',
      labelKey: 'presetSurvUnknown',
      iconRef: 'custom:camera-unknown',
      // Deliberately minimal: this preset means "a surveillance device is
      // here, type not determined". Adding surveillance:type=camera would be
      // asserting something the surveyor did not observe.
      tags: { man_made: 'surveillance' },
    },
  ],

  // ─── SURVEILLANCE DETAIL ──────────────────────────────────────────────────
  surveillance_detail: [
    {
      id: 'survd_fixed_angle',
      labelKey: 'presetSurvDetailFixed',
      iconRef: 'custom:camera-bullet',
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'camera',
        'camera:type': 'fixed',
        'camera:mount': 'wall',
      },
      legacyTags: [
        {
          man_made: 'surveillance',
          surveillance: 'outdoor',
          'surveillance:type': 'fixed',
          'camera:mount': 'wall',
        },
      ],
    },
    {
      id: 'survd_dome_360',
      labelKey: 'presetSurvDetailDome360',
      iconRef: 'custom:camera-360',
      // camera:direction is deliberately absent: it is a number field in
      // degrees, and an omnidirectional unit has no single bearing to record.
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'camera',
        'camera:type': 'dome',
        'camera:mount': 'ceiling',
      },
      legacyTags: [
        {
          man_made: 'surveillance',
          surveillance: 'outdoor',
          'surveillance:type': 'dome',
          'camera:mount': 'ceiling',
          'camera:direction': '360',
        },
      ],
    },
    {
      id: 'survd_dome_tilted',
      labelKey: 'presetSurvDetailDomeTilted',
      iconRef: 'custom:camera-dome-pole',
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'camera',
        'camera:type': 'dome',
        'camera:mount': 'pole',
      },
      legacyTags: [
        {
          man_made: 'surveillance',
          surveillance: 'outdoor',
          'surveillance:type': 'dome',
          'camera:mount': 'pole',
        },
      ],
    },
    {
      id: 'survd_flock_entry',
      labelKey: 'presetSurvDetailFlockEntry',
      iconRef: 'custom:camera-alpr',
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'ALPR',
        'surveillance:zone': 'entrance',
      },
    },
    {
      id: 'survd_flock_exit',
      labelKey: 'presetSurvDetailFlockExit',
      iconRef: 'custom:camera-alpr',
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'ALPR',
        'surveillance:zone': 'exit',
      },
    },
    {
      id: 'survd_anpr',
      labelKey: 'presetSurvDetailANPR',
      iconRef: 'custom:camera-alpr',
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'ALPR',
      },
    },
    {
      id: 'survd_ptz_pole',
      labelKey: 'presetSurvDetailPTZPole',
      iconRef: 'custom:camera-ptz',
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'camera',
        'camera:type': 'panning',
        'camera:mount': 'pole',
      },
      legacyTags: [
        {
          man_made: 'surveillance',
          surveillance: 'outdoor',
          'surveillance:type': 'dome',
          'camera:mount': 'pole',
          'camera:type': 'PTZ',
        },
      ],
    },
    {
      id: 'survd_ptz_fixed',
      labelKey: 'presetSurvDetailPTZFixed',
      iconRef: 'custom:camera-ptz',
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'camera',
        'camera:type': 'panning',
        'camera:mount': 'wall',
      },
      legacyTags: [
        {
          man_made: 'surveillance',
          surveillance: 'outdoor',
          'camera:mount': 'wall',
          'camera:type': 'PTZ',
        },
      ],
    },
    {
      id: 'survd_thermal',
      labelKey: 'presetSurvDetailThermal',
      iconRef: 'custom:camera-thermal',
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'camera',
        'camera:type': 'fixed',
        'camera:thermal': 'yes',
      },
      legacyTags: [
        { man_made: 'surveillance', surveillance: 'outdoor', 'surveillance:type': 'thermal' },
      ],
    },
    {
      id: 'survd_audio',
      labelKey: 'presetSurvDetailAudio',
      iconRef: 'custom:acoustic-sensor',
      // gunshot_detector is the documented value (ShotSpotter and friends).
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'gunshot_detector',
      },
      legacyTags: [
        { man_made: 'surveillance', surveillance: 'outdoor', 'surveillance:type': 'audio' },
      ],
    },
  ],

  // ─── CURBS ────────────────────────────────────────────────────────────────
  curbs: [
    {
      id: 'curb_lowered',
      labelKey: 'presetKerbLowered',
      iconRef: 'temaki:kerb-lowered',
      tags: { barrier: 'kerb', kerb: 'lowered' },
    },
    {
      id: 'curb_raised',
      labelKey: 'presetKerbRaised',
      iconRef: 'temaki:kerb-raised',
      tags: { barrier: 'kerb', kerb: 'raised' },
    },
    {
      id: 'curb_drain',
      labelKey: 'presetStormDrain',
      iconRef: 'mdi:waves',
      // man_made=drain is an OPEN CHANNEL. For a street inlet, curb_catch_basin
      // is the correct preset.
      tags: { man_made: 'drain' },
    },
    {
      id: 'curb_crossing',
      labelKey: 'presetCrossing',
      // Ladder / "continental" bars: the standard US crosswalk marking.
      // Temaki ships 14 crossing_markings-* variants if this ever splits.
      iconRef: 'temaki:crossing_markings-ladder',
      tags: { highway: 'crossing' },
    },
    {
      id: 'curb_tactile',
      labelKey: 'presetTactile',
      // Truncated-dome pad; reads better than a wheelchair glyph.
      iconRef: 'mdi:dots-grid',
      tags: { tactile_paving: 'yes' },
    },
    {
      id: 'curb_bump',
      labelKey: 'presetSpeedBump',
      iconRef: 'temaki:speed_bump',
      tags: { traffic_calming: 'bump' },
    },
    {
      id: 'curb_parking_meter',
      labelKey: 'presetParkingMeter',
      // Weak pick: no free set has a parking meter at all. Cash + clock is the
      // least-bad monochrome read.
      iconRef: 'mdi:cash-clock',
      tags: { amenity: 'parking_meter' },
    },
    {
      id: 'curb_barrier',
      labelKey: 'presetBarrier',
      iconRef: 'temaki:bollard',
      tags: { barrier: 'bollard' },
    },
    {
      id: 'curb_catch_basin',
      labelKey: 'presetCatchBasin',
      iconRef: 'temaki:water_manhole',
      tags: { man_made: 'manhole', manhole: 'drain' },
    },
    {
      id: 'curb_gully',
      labelKey: 'presetGully',
      // Framed parallel bars read as a curb grate.
      iconRef: 'mdi:view-sequential-outline',
      tags: { man_made: 'gully' },
    },
  ],

  // ─── BICYCLE ──────────────────────────────────────────────────────────────
  bike: [
    {
      id: 'bike_parking',
      labelKey: 'presetBikeParking',
      iconRef: 'temaki:bicycle_parked',
      tags: { amenity: 'bicycle_parking' },
    },
    {
      id: 'bike_share',
      labelKey: 'presetBikeShare',
      iconRef: 'temaki:bicycle_rental',
      tags: { amenity: 'bicycle_rental' },
    },
    {
      id: 'bike_repair',
      labelKey: 'presetBikeRepair',
      iconRef: 'temaki:bicycle_repair',
      tags: { amenity: 'bicycle_repair_station' },
    },
    {
      id: 'bike_bollard',
      labelKey: 'presetBikeBollard',
      iconRef: 'temaki:bollard',
      tags: { barrier: 'bollard' },
    },
    {
      id: 'bike_signal',
      labelKey: 'presetBikeSignal',
      iconRef: 'temaki:traffic_signals',
      tags: { highway: 'traffic_signals', 'bicycle:signal': 'yes' },
    },
    {
      id: 'bike_lane',
      labelKey: 'presetBikeLane',
      // Weak pick: a road with no bicycle in it, sitting next to nine icons
      // that all contain a bicycle. The obvious next candidate for the custom
      // set. JOSM's transport/way/cycle_lane_track is correct but full colour.
      iconRef: 'mdi:road-variant',
      tags: { cycleway: 'lane' },
    },
    {
      id: 'bike_box',
      labelKey: 'presetBikeBox',
      // Temaki's bicycle_box is literally the painted intersection bike box.
      iconRef: 'temaki:bicycle_box',
      tags: { cycleway: 'box' },
    },
    {
      id: 'bike_ramp',
      labelKey: 'presetBikeRamp',
      iconRef: 'mdi:slope-uphill',
      tags: { highway: 'path', bicycle: 'designated', 'ramp:bicycle': 'yes' },
      legacyTags: [{ highway: 'path', bicycle: 'designated', ramp: 'bicycle' }],
    },
    {
      id: 'bike_locker',
      labelKey: 'presetBikeLocker',
      iconRef: 'temaki:bicycle_locker',
      tags: { amenity: 'bicycle_parking', bicycle_parking: 'lockers' },
    },
    {
      id: 'bike_pump',
      labelKey: 'presetBikePump',
      iconRef: 'mdi:pump',
      tags: { amenity: 'compressed_air' },
    },
  ],

  // ─── AMENITIES ────────────────────────────────────────────────────────────
  amenities: [
    {
      id: 'amen_bench',
      labelKey: 'presetBench',
      iconRef: 'temaki:bench',
      tags: { amenity: 'bench' },
    },
    {
      id: 'amen_water',
      labelKey: 'presetWaterFountain',
      iconRef: 'maki:drinking-water',
      tags: { amenity: 'drinking_water' },
    },
    {
      id: 'amen_toilet',
      labelKey: 'presetToilet',
      iconRef: 'maki:toilet',
      tags: { amenity: 'toilets' },
    },
    {
      id: 'amen_picnic',
      labelKey: 'presetPicnic',
      iconRef: 'mdi:table-picnic',
      tags: { leisure: 'picnic_table' },
    },
    {
      id: 'amen_info',
      labelKey: 'presetInfo',
      iconRef: 'maki:information',
      tags: { tourism: 'information', information: 'board' },
    },
    {
      id: 'amen_bus_stop',
      labelKey: 'presetBusStop',
      // mdi also ships bus-stop-covered / -uncovered if this splits on shelter.
      iconRef: 'mdi:bus-stop',
      tags: { highway: 'bus_stop' },
    },
    {
      id: 'amen_shelter',
      labelKey: 'presetShelter',
      iconRef: 'temaki:transit_shelter',
      tags: { amenity: 'shelter' },
    },
    {
      id: 'amen_atm',
      labelKey: 'presetATM',
      // Temaki's is a pictogram. mdi:atm is the literal letters "ATM", which
      // would be the only text-based glyph in the whole set.
      iconRef: 'temaki:atm',
      tags: { amenity: 'atm' },
    },
    {
      id: 'amen_recycling',
      labelKey: 'presetRecycling',
      iconRef: 'maki:recycling',
      tags: { amenity: 'recycling', recycling_type: 'container' },
    },
    {
      id: 'amen_aed',
      labelKey: 'presetDefibrillator',
      iconRef: 'maki:defibrillator',
      tags: { emergency: 'defibrillator' },
    },
  ],

  // ─── POWER & LIGHTS ───────────────────────────────────────────────────────
  power: [
    {
      id: 'pow_pole',
      labelKey: 'presetPowerPole',
      iconRef: 'temaki:power_pole',
      tags: { power: 'pole' },
    },
    {
      id: 'pow_tower',
      labelKey: 'presetPowerTower',
      iconRef: 'temaki:power_tower',
      tags: { power: 'tower' },
    },
    {
      id: 'pow_lamp',
      labelKey: 'presetStreetLamp',
      iconRef: 'temaki:street_lamp_arm',
      tags: { highway: 'street_lamp' },
    },
    {
      id: 'pow_floodlight',
      labelKey: 'presetFloodlight',
      iconRef: 'temaki:mast_lighting',
      // lamp_type is deprecated; lamp_mount=high_mast is the current key.
      tags: { highway: 'street_lamp', lamp_mount: 'high_mast' },
      legacyTags: [{ highway: 'street_lamp', lamp_type: 'floodlight' }],
    },
    {
      id: 'pow_cabinet',
      labelKey: 'presetPowerCabinet',
      // Box with a bolt — exactly a power street cabinet.
      iconRef: 'temaki:power_device',
      tags: { man_made: 'street_cabinet', street_cabinet: 'power' },
    },
    {
      id: 'pow_transformer',
      labelKey: 'presetTransformer',
      iconRef: 'temaki:power_transformer',
      tags: { power: 'transformer' },
    },
    {
      id: 'pow_substation',
      labelKey: 'presetSubstation',
      // No good monochrome substation glyph exists in any free set.
      iconRef: 'mdi:factory',
      tags: { power: 'substation' },
    },
    {
      id: 'pow_solar',
      labelKey: 'presetSolarPanel',
      iconRef: 'mdi:solar-panel',
      // Was generator=source, which is not a tag. The feature key is
      // power=generator; the fuel is generator:source.
      tags: {
        power: 'generator',
        'generator:source': 'solar',
        'generator:method': 'photovoltaic',
      },
      legacyTags: [
        { generator: 'source', 'generator:source': 'solar', 'generator:method': 'photovoltaic' },
      ],
    },
    {
      id: 'pow_wind',
      labelKey: 'presetWindTurbine',
      iconRef: 'temaki:wind_turbine',
      tags: { power: 'generator', 'generator:source': 'wind', 'generator:method': 'wind_turbine' },
    },
    {
      id: 'pow_meter',
      labelKey: 'presetPowerMeter',
      iconRef: 'temaki:power_meter',
      tags: { man_made: 'street_cabinet', street_cabinet: 'electricity' },
    },
  ],
};

/** Flat list of every preset, in mode order. */
export function allPresets() {
  return Object.values(PRESETS).flat();
}

/** Exact lookup by the id stored on a node. */
export function findPresetById(id) {
  if (!id) return null;
  return allPresets().find((preset) => preset.id === id) ?? null;
}

/**
 * Best-effort lookup for nodes saved before node.presetId existed.
 *
 * Matches on tag containment, and returns the MOST SPECIFIC match rather than
 * the first one found. That ordering matters: urban_camera's two tags
 * (man_made=surveillance, surveillance=outdoor) are a subset of every camera
 * preset's tags, so a first-match scan labels every camera in the survey a
 * plain urban camera and draws them all with the same icon.
 *
 * legacyTags are matched too, but score below current tags so a node that
 * satisfies both is attributed to the preset that would write it today.
 */
export function findPresetByTags(tags) {
  if (!tags) return null;

  let best = null;
  let bestScore = 0;

  const matches = (candidate) =>
    Object.keys(candidate).length > 0 && Object.entries(candidate).every(([k, v]) => tags[k] === v);

  for (const preset of allPresets()) {
    // Current tags outrank legacy ones at equal size.
    const scored = [
      { set: preset.tags, bonus: 0.5 },
      ...(preset.legacyTags ?? []).map((set) => ({ set, bonus: 0 })),
    ];

    for (const { set, bonus } of scored) {
      if (!matches(set)) continue;
      const score = Object.keys(set).length + bonus;
      if (score > bestScore) {
        bestScore = score;
        best = preset;
      }
    }
  }

  return best;
}
