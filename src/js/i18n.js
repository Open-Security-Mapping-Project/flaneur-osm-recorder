/**
 * Flaneur OSM Recorder — Internationalization Strings
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * To add a new language: copy the 'en' block, change the key to your
 * BCP-47 language tag (e.g. 'fr', 'de', 'es'), translate all values.
 * Then add it to AVAILABLE_LOCALES below.
 *
 * ── Language AND country ─────────────────────────────────────────────────
 * The selector is "Language / Country", not just language, because the
 * vocabulary of a street survey is regional even where the language is not.
 * The presets are written for US English: `post_box` is labelled "Post Box"
 * for the blue USPS collection box, hydrants are pillar hydrants, and the
 * crossing preset means ladder-bar markings.
 *
 * A regional variant is therefore a full locale entry, not a flag on an
 * existing one. To add British English, copy the 'en' block to 'en-GB',
 * change the labels that differ ("Post Box" → "Postbox", "Sidewalk" →
 * "Pavement", and so on), and add { code: 'en-GB', label: 'English: UK' }
 * below. Nothing else needs to change — the tags stay identical, since OSM
 * tag values are the same worldwide. Only the words on the buttons move.
 */

export const AVAILABLE_LOCALES = [
  { code: 'en', label: 'English: US' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
];

const strings = {
  en: {
    // App
    appName: 'Flaneur OSM Recorder',
    appTagline: 'Field survey tool for OpenStreetMap',

    // Top bar
    menuOpen: 'Menu',
    exportData: 'Export',
    gpsOn: 'GPS Active',
    gpsOff: 'GPS Off',
    gpsBatteryWarning: 'GPS is still active — disable it when not surveying to save battery.',
    gpsTrackingActive: 'GPS tracking active.',

    // Session management (launch modal)
    sessionModalTitle: 'Session',
    sessionNew: 'New Session',
    sessionAppend: 'Append to Last Session',
    sessionNewLabel: 'Start a fresh data collection session',
    sessionAppendLabel: 'Continue adding to your previous session',
    sessionLastInfo: 'Last session: {count} nodes on {date}',
    sessionNoExisting: 'No previous session found.',
    sessionResumed: 'Resumed your last session — {count} nodes still saved.',
    sessionNewConfirm:
      'Start a new, empty session? The current one keeps its {count} nodes and stays on this device — reopen it with "Append to Last Session".',
    sessionNewStarted: 'New session started — 0 nodes.',
    sessionTutorial: 'Show Tutorial [?]',
    sessionTutorialDesc: 'Helpful messages',
    // Assembled inline around two links — see the session modal in index.html.
    sessionAboutIntro: 'Flaneur is an',
    sessionAboutApp: 'web app. It is',
    sessionAboutOpenSource: 'open source',
    sessionAboutLicense: '/ GPLv3.0.',

    // Map
    mapLocating: 'Locating…',
    mapAccuracy: 'Accuracy: ±{meters}m',
    mapCenterOnMe: 'Center map on my location',
    mapLocked: 'Map locked to GPS',
    mapUnlocked: 'Map free to pan',

    // Node recording
    nodeRecorded: '{label} recorded',
    nodeUndo: 'Undo last',
    nodeCount: '{count} nodes',
    holdForNote: 'Hold for note',
    noteModalTitle: 'Add Note',
    noteModalPlaceholder: 'Optional note for this point…',
    noteModalSave: 'Save Point',
    noteModalCancel: 'Cancel',
    photoAttach: 'Attach Photo',
    photoTake: 'Take Photo',
    photoAttached: '{count} photo(s) attached',
    photoWorkflowHint:
      'Photos will be included in export. Upload to Wikimedia Commons or Mapillary, then add the URL as a tag in JOSM.',
    nodeUndone: 'Undone',
    nodeDeleted: 'Node deleted',
    nodeNoteUpdated: 'Note updated',
    nodeGeneric: 'Node',
    nodeNoTags: '(no tags)',
    nodeEditTitle: 'Edit note',
    nodeDeleteTitle: 'Delete node',
    nodeListEmpty: 'No nodes recorded yet in this session.',
    waitingForGps: 'Waiting for GPS fix — or switch to crosshair mode (⊕)',

    // Direction
    directionLabel: 'Direction',
    directionSet: 'Direction: {deg}° {cardinal}',
    directionNotSet: 'Not set',
    directionCleared: 'Direction cleared.',
    directionPickFirst: 'Tap a direction on the wheel to set a direction, or select Cancel.',
    summaryNote: 'note',
    // Shown after a camera's bearing to say it carries to the next node.
    summaryDirectionHeld: 'dir held',

    // Placement mode
    placementGps: 'GPS mode: place at current location',
    placementCrosshair: 'Crosshair mode: place at map center',
    placementManualSuffix: '(manual)',

    // Manual location
    manualLocationSet: 'Map centered at {lat}, {lon}. Use crosshair mode to place nodes.',

    // Storage
    storageTitle: 'Storage on this device',
    storageUsedLabel: 'Survey data',
    storageQuotaLabel: 'Space available',
    storageSessionsLabel: 'Saved',
    storageStateLabel: 'Durability',
    storageSessionSummary: '{sessions} sessions · {nodes} nodes',
    storageUnknown: 'unknown',
    storageStatePersisted: 'Protected — the browser will not evict this data.',
    storageStateBestEffort:
      'Best effort — data can be cleared if the device runs out of space. Export regularly.',
    storageStateBlocked: 'NOT SAVING — this browser is blocking local storage.',
    storageUnavailable:
      'Local storage is blocked, so nothing can be saved. Leave private/incognito mode or allow site data for this page.',
    storageFullError:
      'Storage is full — that point was NOT saved. Export this session, then clear old sessions.',
    storageWriteError: 'Could not save to local storage — that point was NOT saved.',
    storageExplainer:
      'All survey data is stored only in this browser, on this device. It is never uploaded. Clearing browser site data, or uninstalling the app, deletes it — export before you do either.',

    // Collection modes
    modeLabel: 'Mode',
    modeUrban: 'Urban',
    modeSurveillance: 'Surveillance',
    modeSurveillanceDetail: 'Surv. Detail',
    modeCurbs: 'Curbs',
    modeBike: 'Bicycle',
    modeAmenities: 'Amenities',
    modePower: 'Power & Lights',

    // Preset labels — Urban
    presetCamera: 'Camera',
    presetPole: 'Utility Pole',
    presetSOSPhone: 'Emergency Phone',
    presetStreetLight: 'Street Light',
    presetHydrant: 'Fire Hydrant',
    presetPostBox: 'Post Box',
    presetWasteBin: 'Waste Bin',
    presetCabinet: 'Street Cabinet',
    presetManhole: 'Manhole',
    presetSign: 'Traffic Sign',

    // Preset labels — Surveillance (quick mode)
    presetSurvFixed: 'Fixed Camera',
    presetSurvDome: 'Dome / Omni',
    presetSurvFlock: 'Flock / ANPR',
    presetSurvPTZ: 'PTZ Camera',
    presetSurvIndoor: 'Indoor (visible)',
    presetSurvUnknown: 'Camera (unknown)',

    // Preset labels — Surveillance Detail mode
    presetSurvDetailFixed: 'Fixed Angle',
    presetSurvDetailDome360: 'Dome 360°',
    presetSurvDetailDomeTilted: 'Dome Tilted',
    presetSurvDetailFlockEntry: 'Flock (entry)',
    presetSurvDetailFlockExit: 'Flock (exit)',
    presetSurvDetailANPR: 'ANPR / LPR',
    presetSurvDetailPTZFixed: 'PTZ (fixed post)',
    presetSurvDetailPTZPole: 'PTZ (on pole)',
    presetSurvDetailThermal: 'Thermal',
    presetSurvDetailAudio: 'Acoustic Monitor',

    // Preset labels — Curbs
    presetKerbLowered: 'Curb Cut',
    presetKerbRaised: 'Raised Curb',
    presetStormDrain: 'Storm Drain',
    presetCrossing: 'Crossing',
    presetTactile: 'Tactile Paving',
    presetSpeedBump: 'Speed Bump',
    presetParkingMeter: 'Parking Meter',
    presetBarrier: 'Barrier',
    presetCatchBasin: 'Catch Basin',
    presetGully: 'Gully',

    // Preset labels — Bicycle
    presetBikeParking: 'Bike Parking',
    presetBikeShare: 'Bike Share',
    presetBikeRepair: 'Repair Station',
    presetBikeBollard: 'Bollard',
    presetBikeSignal: 'Bike Signal',
    presetBikeLane: 'Lane Marker',
    presetBikeBox: 'Bike Box',
    presetBikeRamp: 'Ramp',
    presetBikeLocker: 'Bike Locker',
    presetBikePump: 'Air Pump',

    // Preset labels — Amenities
    presetBench: 'Bench',
    presetWaterFountain: 'Drinking Water',
    presetToilet: 'Toilet',
    presetPicnic: 'Picnic Table',
    presetInfo: 'Info Board',
    presetBusStop: 'Bus Stop',
    presetShelter: 'Shelter',
    presetATM: 'ATM',
    presetRecycling: 'Recycling',
    presetDefibrillator: 'Defibrillator',

    // Preset labels — Power & Lights
    presetPowerPole: 'Power Pole',
    presetPowerTower: 'Power Tower',
    presetStreetLamp: 'Street Lamp',
    presetFloodlight: 'Floodlight',
    presetPowerCabinet: 'Power Cabinet',
    presetTransformer: 'Transformer',
    presetSubstation: 'Substation',
    presetSolarPanel: 'Solar Panel',
    presetWindTurbine: 'Wind Turbine',
    presetPowerMeter: 'Power Meter',

    // Export
    exportModalTitle: 'Export Session',
    exportOsmXml: 'JOSM / OSM XML',
    exportGpx: 'GPX Track',
    exportGeoJson: 'GeoJSON',
    exportOsmHint: 'Open in JOSM via File › Open. Review nodes, add detail, then upload to OSM.',
    exportGpxHint: 'Universal format. Tags are embedded as <cmt> descriptions.',
    exportGeoJsonHint: 'For use in GIS tools, QGIS, etc.',
    exportFilename: 'flaneur_{date}',
    exportEmpty: 'No nodes in current session yet.',
    // Export scope picker
    exportScopeSession: 'This Session',
    exportScopeAll: 'All Sessions',
    exportScopeSessionInfo: '{count} nodes',
    exportScopeAllInfo: '{nodes} nodes in {sessions} sessions',
    exportScopeAllNote:
      'All {sessions} saved sessions with {nodes} nodes in one file. Node ids are renumbered so JOSM loads them as one layer.',
    exportEmptyAll: 'No saved sessions have any nodes yet.',
    exportPhotoNote:
      'Note: Photos are not embedded in exports. See photo workflow in tutorial. (This feature is in development)',

    // Settings / gear menu
    settingsTitle: 'Settings',
    settingsTutorial: 'Show Tutorial',
    settingsDownload: 'Export Data',
    settingsNewSession: 'Start New Session',
    settingsClearStorage: 'Clear All Sessions',
    settingsClearConfirm: 'Delete ALL saved sessions? This cannot be undone.',
    settingsClearYes: 'Delete Everything',
    settingsClearNo: 'Cancel',
    // "/ Country" because the entry selects regional wording, not only
    // language — see the AVAILABLE_LOCALES note at the top of this file.
    settingsLanguage: 'Language / Country',
    soundOn: '🔊 Sound On',
    soundOff: '🔇 Sound Off',
    settingsAbout: 'About',
    settingsVersion: 'Version {version}',
    settingsLicense: 'GPL-3.0 — Source on GitHub',

    // About
    aboutText:
      'Flaneur OSM Recorder is a free, open-source field survey tool for GIS power users. Data never leaves your device. Export to apps like JOSM (XML or GeoJson) for processing & review before contributing to OpenStreetMap. This app does NOT add anything to OSM directly.',

    // Tutorial slides
    tutorialSkip: 'Skip',
    tutorialNext: 'Next',
    tutorialDone: 'Start Surveying',
    tutorialSlide1Title: 'Welcome to Flaneur - from the Open Security Mapping Project',
    tutorialSlide1Body:
      'A field recorder for mapping the world around you. All data stays on your device — nothing is sent anywhere without your review.',
    tutorialSlide2Title: 'GPS & the Map',
    tutorialSlide2Body:
      'Tap the GPS button (top right) to enable location. A green dot means active. The map zooms to your position. Tap the crosshair to re-center.',
    tutorialSlide3Title: 'Recording Nodes',
    tutorialSlide3Body:
      'Tap any preset button to instantly save your current GPS position with OSM tags. Hold the button for 1 second to add a text note before saving.',
    tutorialSlide4Title: 'Collection Modes',
    tutorialSlide4Body:
      'Switch between Urban, Surveillance / Detail, Curbs, Bicycle, Amenities, and Power modes. Each mode shows some relevant OSM presets for that survey type.',
    tutorialSlide5Title: 'Photos',
    tutorialSlide5Body:
      'Hold any preset and tap the camera icon to attach a photo. Photos stay on your device. For OSM, upload to Mapillary or Wikimedia Commons and link the URL in JOSM. (Note this feature is still in development and NOT efficient.)',
    tutorialSlide6Title: 'Export to JOSM or other GIS apps',
    tutorialSlide6Body:
      'Tap Export → choose OSM XML → send the file to your desktop → open in JOSM with File › Open. Review your nodes, add detail, and upload to OSM when ready. It can also export GeoJSON files for QGis and so on.',

    // Errors / warnings
    errorGpsUnavailable: 'GPS not available on this device.',
    errorGpsDenied: 'Location permission denied. Enable in browser settings.',
    errorGpsTimeout: 'GPS timeout — is location enabled?',
    errorGpsFallback: 'No GPS fix. Pan the map and use crosshair mode (⊕) to place nodes.',
    errorNoSession: 'No active session — start one first.',
    errorCoordsInvalid: 'Invalid coordinates. Please enter valid numbers.',
    errorCoordsRange: 'Coordinates out of range. Lat: -90 to 90, Lon: -180 to 180.',
    warningLowAccuracy: 'Low GPS accuracy (±{meters}m) — find open sky.',
    errorStorageFull: 'Storage full — export and clear old sessions.',
    settingsCleared: 'All sessions cleared',
    settingsLocation: 'Set Map Location',
    settingsEditNodes: 'Edit Saved Items',
    nodeListTitle: 'Saved Items',
    nodeEditModalTitle: 'Edit Node',
    nodeEditTagsLabel: 'Tags (edit in JOSM)',
    nodeEditCoordsLabel: 'Coordinates',
    nodeEditRecordedLabel: 'Recorded',
    nodeEditNoteLabel: 'Note',
    nodeEditNotePlaceholder: 'Add or edit note…',
    nodeDeleteModalTitle: 'Delete Node?',
    nodeDeleteWarning: 'This cannot be undone.',
    manualLocationTitle: 'Set Map Location',
    manualLocationHint: 'Enter coordinates to navigate the map. Useful when GPS is unavailable.',
    manualLocationLat: 'Latitude (-90 to 90)',
    manualLocationLon: 'Longitude (-180 to 180)',
    manualLocationUseView: 'Use Current Map Center',
    manualLocationFooter:
      'After setting location, use crosshair mode (⊕) to place nodes by panning the map.',
    actionSave: 'Save',
    actionCancel: 'Cancel',
    actionDelete: 'Delete',
    actionClose: 'Close',
  },

  fr: {
    appName: 'Flaneur OSM Recorder',
    appTagline: 'Outil de relevé terrain pour OpenStreetMap',
    menuOpen: 'Menu',
    exportData: 'Exporter',
    gpsOn: 'GPS Actif',
    gpsOff: 'GPS Éteint',
    gpsBatteryWarning: 'Le GPS est toujours actif — désactivez-le pour économiser la batterie.',
    sessionModalTitle: 'Session',
    sessionNew: 'Nouvelle session',
    sessionAppend: 'Reprendre la dernière session',
    sessionNewLabel: 'Démarrer une nouvelle collecte de données',
    sessionAppendLabel: 'Continuer la session précédente',
    sessionLastInfo: 'Dernière session : {count} nœuds le {date}',
    sessionNoExisting: 'Aucune session précédente trouvée.',
    // ... (remaining keys inherit from 'en' as fallback in getString())
  },

  de: {
    appName: 'Flaneur OSM Recorder',
    appTagline: 'Feldvermessungswerkzeug für OpenStreetMap',
    menuOpen: 'Menü',
    exportData: 'Exportieren',
    gpsOn: 'GPS Aktiv',
    gpsOff: 'GPS Aus',
    gpsBatteryWarning: 'GPS ist noch aktiv — deaktivieren Sie es, um Akku zu sparen.',
    sessionModalTitle: 'Sitzung',
    sessionNew: 'Neue Sitzung',
    sessionAppend: 'Letzte Sitzung fortsetzen',
    sessionNewLabel: 'Eine neue Datenerfassungssitzung starten',
    sessionAppendLabel: 'Zur vorherigen Sitzung hinzufügen',
    sessionLastInfo: 'Letzte Sitzung: {count} Knoten am {date}',
    sessionNoExisting: 'Keine vorherige Sitzung gefunden.',
  },

  es: {
    appName: 'Flaneur OSM Recorder',
    appTagline: 'Herramienta de encuesta de campo para OpenStreetMap',
    menuOpen: 'Menú',
    exportData: 'Exportar',
    gpsOn: 'GPS Activo',
    gpsOff: 'GPS Apagado',
    gpsBatteryWarning: 'El GPS sigue activo — desactívelo para ahorrar batería.',
    sessionModalTitle: 'Sesión',
    sessionNew: 'Nueva sesión',
    sessionAppend: 'Continuar última sesión',
    sessionNewLabel: 'Iniciar una nueva sesión de recolección de datos',
    sessionAppendLabel: 'Agregar a la sesión anterior',
    sessionLastInfo: 'Última sesión: {count} nodos el {date}',
    sessionNoExisting: 'No se encontró sesión anterior.',
  },
};

let currentLocale = 'en';

export function setLocale(code) {
  if (strings[code]) currentLocale = code;
}

export function getLocale() {
  return currentLocale;
}

/**
 * Get a localized string, falling back to English if key missing.
 * Supports {placeholder} interpolation.
 * @param {string} key
 * @param {Object} [vars] - e.g. { count: 5, date: '2026-02-25' }
 */
export function t(key, vars = {}) {
  const locale = strings[currentLocale] || strings.en;
  let str = locale[key] ?? strings.en[key] ?? `[${key}]`;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replaceAll(`{${k}}`, v);
  }
  return str;
}
