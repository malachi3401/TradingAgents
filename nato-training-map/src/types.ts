/**
 * Core domain types for the tactical planning trainer.
 *
 * The document model is a Project containing five fixed overlays. Each overlay
 * owns an ordered list of features. A feature is either a point Symbol
 * (rendered with milsymbol from an APP-6(D) numeric SIDC) or a tactical
 * Graphic (point / line / polygon control measure drawn by the map renderer).
 */

export type OverlayId = 'control' | 'friendly' | 'opfor' | 'fires' | 'user'

export const OVERLAY_IDS: OverlayId[] = ['control', 'friendly', 'opfor', 'fires', 'user']

export const OVERLAY_NAMES: Record<OverlayId, string> = {
  control: 'Terrain & Control Measures',
  friendly: 'Friendly Forces',
  opfor: 'Opposing Force (OPFOR)',
  fires: 'Fires',
  user: 'User Overlay',
}

/** APP-6(D) standard identity (SIDC position 4). */
export type Affiliation =
  | 'pending'
  | 'unknown'
  | 'assumedFriend'
  | 'friend'
  | 'neutral'
  | 'suspect'
  | 'hostile'

export const AFFILIATION_DIGIT: Record<Affiliation, string> = {
  pending: '0',
  unknown: '1',
  assumedFriend: '2',
  friend: '3',
  neutral: '4',
  suspect: '5',
  hostile: '6',
}

/** APP-6(D) context (SIDC position 3): reality / exercise / simulation. */
export type SymbolContext = 'reality' | 'exercise' | 'simulation'

export const CONTEXT_DIGIT: Record<SymbolContext, string> = {
  reality: '0',
  exercise: '1',
  simulation: '2',
}

/** APP-6(D) echelon amplifier (SIDC positions 9-10). '00' = none. */
export type Echelon =
  | '00' // none
  | '11' // team / crew
  | '12' // squad / det
  | '13' // section
  | '14' // platoon
  | '15' // company
  | '16' // battalion
  | '17' // regiment
  | '18' // brigade

export const ECHELON_NAMES: Record<Echelon, string> = {
  '00': 'None',
  '11': 'Fire Team',
  '12': 'Squad',
  '13': 'Section',
  '14': 'Platoon',
  '15': 'Company',
  '16': 'Battalion',
  '17': 'Regiment',
  '18': 'Brigade',
}

/** APP-6(D) HQ / Task Force / Dummy flag (SIDC position 8). */
export type HqTf = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7'

export const HQTF_NAMES: Record<HqTf, string> = {
  '0': 'None',
  '1': 'Feint/Dummy',
  '2': 'Headquarters',
  '3': 'Feint/Dummy HQ',
  '4': 'Task Force',
  '5': 'Feint/Dummy TF',
  '6': 'Task Force HQ',
  '7': 'Feint/Dummy TF HQ',
}

export interface SymbolFeature {
  id: string
  kind: 'symbol'
  /** [lng, lat] */
  position: [number, number]
  /** Two-digit APP-6(D) symbol set, e.g. '10' = land unit. */
  symbolSet: string
  /** Six-digit APP-6(D) entity / entity-type / entity-subtype code. */
  entity: string
  affiliation: Affiliation
  context: SymbolContext
  echelon: Echelon
  hqtf: HqTf
  modifier1: string
  modifier2: string
  /** Free-text label rendered as "unique designation" amplifier. */
  designation: string
  higherFormation: string
  additionalInfo: string
  /** Reinforced / reduced amplifier: '', '(+)', '(-)', '(±)'. */
  reinforcedReduced: '' | '(+)' | '(-)' | '(±)'
  rotation: number
  scale: number
  locked: boolean
  visible: boolean
}

export type GraphicGeometryKind = 'point' | 'line' | 'polygon' | 'text' | 'arrow' | 'freehand'

export interface GraphicFeature {
  id: string
  kind: 'graphic'
  /** Key into the tactical-graphics catalog (see graphics/catalog.ts). */
  graphicType: string
  geometryKind: GraphicGeometryKind
  /** Point: [ [lng,lat] ]; line/arrow/freehand: vertices; polygon: ring (unclosed). */
  coordinates: [number, number][]
  /** User designation, e.g. 'PL AMBER', 'OBJ COBRA', 'AB1001'. */
  name: string
  /** Optional style overrides for the user overlay. */
  color?: string
  locked: boolean
  visible: boolean
}

export type Feature = SymbolFeature | GraphicFeature

export interface Overlay {
  id: OverlayId
  name: string
  visible: boolean
  opacity: number
  features: Feature[]
}

export interface Bookmark {
  id: string
  name: string
  center: [number, number]
  zoom: number
  bearing: number
}

export type MapStyleId = 'topo' | 'satellite' | 'hybrid' | 'contour'

/** Base-map thematic layers the user can toggle independently. */
export const TERRAIN_LAYER_KEYS = [
  'contours',
  'water',
  'marsh',
  'forest',
  'openGround',
  'roads',
  'trails',
  'railways',
  'bridges',
  'buildings',
  'ranges',
  'labels',
] as const

export type TerrainLayerKey = (typeof TERRAIN_LAYER_KEYS)[number]

export interface ProjectSettings {
  mapStyle: MapStyleId
  showGrid: boolean
  snapToGrid: boolean
  showLegend: boolean
  symbolSize: number
  terrainLayers: Record<TerrainLayerKey, boolean>
}

export interface Project {
  schemaVersion: 1
  name: string
  overlays: Record<OverlayId, Overlay>
  bookmarks: Bookmark[]
  settings: ProjectSettings
}

export type ToolId =
  | 'select'
  | 'place-symbol'
  | 'draw-line'
  | 'draw-polygon'
  | 'draw-point'
  | 'draw-text'
  | 'draw-arrow'
  | 'draw-freehand'
  | 'measure-distance'
  | 'measure-area'
  | 'measure-bearing'
  | 'elevation-profile'
  | 'coordinate-pick'

export function defaultTerrainLayers(): Record<TerrainLayerKey, boolean> {
  return Object.fromEntries(TERRAIN_LAYER_KEYS.map((k) => [k, true])) as Record<
    TerrainLayerKey,
    boolean
  >
}

export function createEmptyProject(name = 'New Exercise'): Project {
  const overlays = Object.fromEntries(
    OVERLAY_IDS.map((id) => [
      id,
      { id, name: OVERLAY_NAMES[id], visible: true, opacity: 1, features: [] as Feature[] },
    ]),
  ) as Record<OverlayId, Overlay>
  return {
    schemaVersion: 1,
    name,
    overlays,
    bookmarks: [],
    settings: {
      mapStyle: 'topo',
      showGrid: true,
      snapToGrid: false,
      showLegend: false,
      symbolSize: 30,
      terrainLayers: defaultTerrainLayers(),
    },
  }
}
