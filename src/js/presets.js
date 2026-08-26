/**
 * Flaneur OSM Recorder — Preset Definitions
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Each preset maps a UI button to a set of OSM tags.
 * Tags follow OSM wiki conventions. Additional tags can be added in JOSM.
 *
 * Structure:
 *   id        — stable identifier (never change once deployed)
 *   labelKey  — i18n key for display name
 *   icon      — emoji or could be replaced with SVG sprite ref
 *   tags      — OSM tags to write on the node
 *   extraTags — Optional tags shown as hints in note modal
 */

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
      icon: '📷',
      tags: { man_made: 'surveillance', surveillance: 'outdoor' },
    },
    {
      id: 'urban_pole',
      labelKey: 'presetPole',
      icon: '🔌',
      tags: { power: 'pole' },
    },
    {
      id: 'urban_sos',
      labelKey: 'presetSOSPhone',
      icon: '📞',
      tags: { emergency: 'phone' },
    },
    {
      id: 'urban_streetlight',
      labelKey: 'presetStreetLight',
      icon: '💡',
      tags: { highway: 'street_lamp' },
    },
    {
      id: 'urban_hydrant',
      labelKey: 'presetHydrant',
      icon: '🚒',
      tags: { emergency: 'fire_hydrant' },
    },
    {
      id: 'urban_postbox',
      labelKey: 'presetPostBox',
      icon: '📮',
      tags: { amenity: 'post_box' },
    },
    {
      id: 'urban_bin',
      labelKey: 'presetWasteBin',
      icon: '🗑️',
      tags: { amenity: 'waste_basket' },
    },
    {
      id: 'urban_cabinet',
      labelKey: 'presetCabinet',
      icon: '🔧',
      tags: { man_made: 'street_cabinet' },
    },
    {
      id: 'urban_manhole',
      labelKey: 'presetManhole',
      icon: '⭕',
      tags: { man_made: 'manhole' },
    },
    {
      id: 'urban_sign',
      labelKey: 'presetSign',
      icon: '🚧',
      tags: { highway: 'emergency_access_point' },
    },
  ],

  // ─── SURVEILLANCE (quick / coarse) ────────────────────────────────────────
  surveillance: [
    {
      id: 'surv_fixed',
      labelKey: 'presetSurvFixed',
      icon: '📹',
      tags: { man_made: 'surveillance', surveillance: 'outdoor', 'surveillance:type': 'fixed' },
    },
    {
      id: 'surv_dome',
      labelKey: 'presetSurvDome',
      icon: '🔮',
      tags: { man_made: 'surveillance', surveillance: 'outdoor', 'surveillance:type': 'dome' },
    },
    {
      id: 'surv_flock',
      labelKey: 'presetSurvFlock',
      icon: '🚗',
      tags: { man_made: 'surveillance', surveillance: 'outdoor', 'surveillance:type': 'ALPR' },
    },
    {
      id: 'surv_ptz',
      labelKey: 'presetSurvPTZ',
      icon: '🎥',
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'dome',
        'camera:mount': 'pole',
      },
    },
    {
      id: 'surv_indoor',
      labelKey: 'presetSurvIndoor',
      icon: '🏠',
      tags: { man_made: 'surveillance', surveillance: 'indoor' },
    },
    {
      id: 'surv_unknown',
      labelKey: 'presetSurvUnknown',
      icon: '❓',
      tags: { man_made: 'surveillance' },
    },
  ],

  // ─── SURVEILLANCE DETAIL ──────────────────────────────────────────────────
  surveillance_detail: [
    {
      id: 'survd_fixed_angle',
      labelKey: 'presetSurvDetailFixed',
      icon: '📹',
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'fixed',
        'camera:mount': 'wall',
      },
    },
    {
      id: 'survd_dome_360',
      labelKey: 'presetSurvDetailDome360',
      icon: '🔮',
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'dome',
        'camera:mount': 'ceiling',
        'camera:direction': '360',
      },
    },
    {
      id: 'survd_dome_tilted',
      labelKey: 'presetSurvDetailDomeTilted',
      icon: '🎱',
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'dome',
        'camera:mount': 'pole',
      },
    },
    {
      id: 'survd_flock_entry',
      labelKey: 'presetSurvDetailFlockEntry',
      icon: '🚦',
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
      icon: '🚥',
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
      icon: '🔢',
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'ALPR',
      },
    },
    {
      id: 'survd_ptz_pole',
      labelKey: 'presetSurvDetailPTZPole',
      icon: '🎮',
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'dome',
        'camera:mount': 'pole',
        'camera:type': 'PTZ',
      },
    },
    {
      id: 'survd_ptz_fixed',
      labelKey: 'presetSurvDetailPTZFixed',
      icon: '🕹️',
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'camera:mount': 'wall',
        'camera:type': 'PTZ',
      },
    },
    {
      id: 'survd_thermal',
      labelKey: 'presetSurvDetailThermal',
      icon: '🌡️',
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'thermal',
      },
    },
    {
      id: 'survd_audio',
      labelKey: 'presetSurvDetailAudio',
      icon: '🎤',
      tags: {
        man_made: 'surveillance',
        surveillance: 'outdoor',
        'surveillance:type': 'audio',
      },
    },
  ],

  // ─── CURBS ────────────────────────────────────────────────────────────────
  curbs: [
    {
      id: 'curb_lowered',
      labelKey: 'presetKerbLowered',
      icon: '♿',
      tags: { barrier: 'kerb', kerb: 'lowered' },
    },
    {
      id: 'curb_raised',
      labelKey: 'presetKerbRaised',
      icon: '🟫',
      tags: { barrier: 'kerb', kerb: 'raised' },
    },
    {
      id: 'curb_drain',
      labelKey: 'presetStormDrain',
      icon: '🌀',
      tags: { man_made: 'drain' },
    },
    {
      id: 'curb_crossing',
      labelKey: 'presetCrossing',
      icon: '🚶',
      tags: { highway: 'crossing' },
    },
    {
      id: 'curb_tactile',
      labelKey: 'presetTactile',
      icon: '🟡',
      tags: { tactile_paving: 'yes' },
    },
    {
      id: 'curb_bump',
      labelKey: 'presetSpeedBump',
      icon: '🚧',
      tags: { traffic_calming: 'bump' },
    },
    {
      id: 'curb_parking_meter',
      labelKey: 'presetParkingMeter',
      icon: '🅿️',
      tags: { amenity: 'parking_meter' },
    },
    {
      id: 'curb_barrier',
      labelKey: 'presetBarrier',
      icon: '🚫',
      tags: { barrier: 'bollard' },
    },
    {
      id: 'curb_catch_basin',
      labelKey: 'presetCatchBasin',
      icon: '🕳️',
      tags: { man_made: 'manhole', manhole: 'drain' },
    },
    {
      id: 'curb_gully',
      labelKey: 'presetGully',
      icon: '💧',
      tags: { man_made: 'gully' },
    },
  ],

  // ─── BICYCLE ──────────────────────────────────────────────────────────────
  bike: [
    {
      id: 'bike_parking',
      labelKey: 'presetBikeParking',
      icon: '🚲',
      tags: { amenity: 'bicycle_parking' },
    },
    {
      id: 'bike_share',
      labelKey: 'presetBikeShare',
      icon: '🔄',
      tags: { amenity: 'bicycle_rental' },
    },
    {
      id: 'bike_repair',
      labelKey: 'presetBikeRepair',
      icon: '🔧',
      tags: { amenity: 'bicycle_repair_station' },
    },
    {
      id: 'bike_bollard',
      labelKey: 'presetBikeBollard',
      icon: '🚦',
      tags: { barrier: 'bollard' },
    },
    {
      id: 'bike_signal',
      labelKey: 'presetBikeSignal',
      icon: '🚥',
      tags: { highway: 'traffic_signals', 'bicycle:signal': 'yes' },
    },
    {
      id: 'bike_lane',
      labelKey: 'presetBikeLane',
      icon: '⬜',
      tags: { cycleway: 'lane' },
    },
    {
      id: 'bike_box',
      labelKey: 'presetBikeBox',
      icon: '📦',
      tags: { cycleway: 'box' },
    },
    {
      id: 'bike_ramp',
      labelKey: 'presetBikeRamp',
      icon: '📐',
      tags: { highway: 'path', bicycle: 'designated', ramp: 'bicycle' },
    },
    {
      id: 'bike_locker',
      labelKey: 'presetBikeLocker',
      icon: '🔒',
      tags: { amenity: 'bicycle_parking', bicycle_parking: 'lockers' },
    },
    {
      id: 'bike_pump',
      labelKey: 'presetBikePump',
      icon: '🔔',
      tags: { amenity: 'compressed_air' },
    },
  ],

  // ─── AMENITIES ────────────────────────────────────────────────────────────
  amenities: [
    {
      id: 'amen_bench',
      labelKey: 'presetBench',
      icon: '🪑',
      tags: { amenity: 'bench' },
    },
    {
      id: 'amen_water',
      labelKey: 'presetWaterFountain',
      icon: '🚰',
      tags: { amenity: 'drinking_water' },
    },
    {
      id: 'amen_toilet',
      labelKey: 'presetToilet',
      icon: '🚻',
      tags: { amenity: 'toilets' },
    },
    {
      id: 'amen_picnic',
      labelKey: 'presetPicnic',
      icon: '🧺',
      tags: { leisure: 'picnic_table' },
    },
    {
      id: 'amen_info',
      labelKey: 'presetInfo',
      icon: 'ℹ️',
      tags: { tourism: 'information', information: 'board' },
    },
    {
      id: 'amen_bus_stop',
      labelKey: 'presetBusStop',
      icon: '🚌',
      tags: { highway: 'bus_stop' },
    },
    {
      id: 'amen_shelter',
      labelKey: 'presetShelter',
      icon: '⛺',
      tags: { amenity: 'shelter' },
    },
    {
      id: 'amen_atm',
      labelKey: 'presetATM',
      icon: '🏧',
      tags: { amenity: 'atm' },
    },
    {
      id: 'amen_recycling',
      labelKey: 'presetRecycling',
      icon: '♻️',
      tags: { amenity: 'recycling', recycling_type: 'container' },
    },
    {
      id: 'amen_aed',
      labelKey: 'presetDefibrillator',
      icon: '❤️',
      tags: { emergency: 'defibrillator' },
    },
  ],

  // ─── POWER & LIGHTS ───────────────────────────────────────────────────────
  power: [
    {
      id: 'pow_pole',
      labelKey: 'presetPowerPole',
      icon: '🔌',
      tags: { power: 'pole' },
    },
    {
      id: 'pow_tower',
      labelKey: 'presetPowerTower',
      icon: '🗼',
      tags: { power: 'tower' },
    },
    {
      id: 'pow_lamp',
      labelKey: 'presetStreetLamp',
      icon: '💡',
      tags: { highway: 'street_lamp' },
    },
    {
      id: 'pow_floodlight',
      labelKey: 'presetFloodlight',
      icon: '🔦',
      tags: { highway: 'street_lamp', lamp_type: 'floodlight' },
    },
    {
      id: 'pow_cabinet',
      labelKey: 'presetPowerCabinet',
      icon: '🗄️',
      tags: { man_made: 'street_cabinet', street_cabinet: 'power' },
    },
    {
      id: 'pow_transformer',
      labelKey: 'presetTransformer',
      icon: '⚡',
      tags: { power: 'transformer' },
    },
    {
      id: 'pow_substation',
      labelKey: 'presetSubstation',
      icon: '🏭',
      tags: { power: 'substation' },
    },
    {
      id: 'pow_solar',
      labelKey: 'presetSolarPanel',
      icon: '☀️',
      tags: {
        generator: 'source',
        'generator:source': 'solar',
        'generator:method': 'photovoltaic',
      },
    },
    {
      id: 'pow_wind',
      labelKey: 'presetWindTurbine',
      icon: '🌬️',
      tags: { power: 'generator', 'generator:source': 'wind', 'generator:method': 'wind_turbine' },
    },
    {
      id: 'pow_meter',
      labelKey: 'presetPowerMeter',
      icon: '🔋',
      tags: { man_made: 'street_cabinet', street_cabinet: 'electricity' },
    },
  ],
};
