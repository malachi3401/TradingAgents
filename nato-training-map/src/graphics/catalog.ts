/**
 * Tactical graphics (control measures) catalog, styled after APP-6(D)
 * chapter 10 conventions: friendly control measures in black, fire support
 * areas with standard labels, obstacles in green, etc.
 *
 * Each entry declares its geometry kind, how it is drawn (fill/line/point),
 * and how its designation label is composed (prefix + user-supplied name).
 */

import type { GraphicGeometryKind } from '../types'

export interface GraphicDef {
  key: string
  name: string
  group: string
  geometry: GraphicGeometryKind
  /** Label template; {name} is replaced with the feature's name. */
  labelTemplate: string
  color: string
  fill?: boolean
  fillOpacity?: number
  dash?: [number, number]
  width?: number
  /** For point graphics: id of the generated icon image. */
  pointIcon?: string
  keywords: string[]
}

export const GRAPHIC_GROUPS = [
  'Control Measures',
  'Manoeuvre Areas',
  'Obstacles',
  'Fire Support',
  'User Drawing',
] as const

const BLACK = '#111111'
const GREEN = '#227722'
const FIRES = '#111111'

export const GRAPHIC_CATALOG: GraphicDef[] = [
  // --- Control measures (lines & points) -----------------------------------
  { key: 'phase-line', name: 'Phase Line', group: 'Control Measures', geometry: 'line', labelTemplate: 'PL {name}', color: BLACK, width: 2, keywords: ['pl', 'phase'] },
  { key: 'boundary', name: 'Boundary', group: 'Control Measures', geometry: 'line', labelTemplate: '{name}', color: BLACK, width: 2.4, dash: [6, 3], keywords: ['boundary', 'bdry'] },
  { key: 'feba', name: 'FEBA', group: 'Control Measures', geometry: 'line', labelTemplate: 'FEBA', color: BLACK, width: 2.6, dash: [1.2, 1.6], keywords: ['feba', 'forward edge'] },
  { key: 'route', name: 'Route', group: 'Control Measures', geometry: 'line', labelTemplate: 'ROUTE {name}', color: BLACK, width: 2, keywords: ['route'] },
  { key: 'msr', name: 'Main Supply Route', group: 'Control Measures', geometry: 'line', labelTemplate: 'MSR {name}', color: BLACK, width: 2.6, keywords: ['msr', 'supply route'] },
  { key: 'asr', name: 'Alternate Supply Route', group: 'Control Measures', geometry: 'line', labelTemplate: 'ASR {name}', color: BLACK, width: 2, dash: [8, 4], keywords: ['asr'] },
  { key: 'axis', name: 'Axis of Advance', group: 'Control Measures', geometry: 'arrow', labelTemplate: '{name}', color: BLACK, width: 3, keywords: ['axis', 'advance', 'attack'] },
  { key: 'direction-attack', name: 'Direction of Attack', group: 'Control Measures', geometry: 'arrow', labelTemplate: '{name}', color: BLACK, width: 2, keywords: ['direction', 'attack'] },
  { key: 'checkpoint', name: 'Checkpoint', group: 'Control Measures', geometry: 'point', labelTemplate: 'CP {name}', color: BLACK, pointIcon: 'gfx-checkpoint', keywords: ['cp', 'checkpoint'] },
  { key: 'release-point', name: 'Release Point', group: 'Control Measures', geometry: 'point', labelTemplate: 'RP {name}', color: BLACK, pointIcon: 'gfx-rp', keywords: ['rp', 'release'] },
  { key: 'start-point', name: 'Start Point', group: 'Control Measures', geometry: 'point', labelTemplate: 'SP {name}', color: BLACK, pointIcon: 'gfx-sp', keywords: ['sp', 'start point'] },
  { key: 'op', name: 'Observation Post', group: 'Control Measures', geometry: 'point', labelTemplate: 'OP {name}', color: BLACK, pointIcon: 'gfx-op', keywords: ['op', 'observation'] },
  { key: 'coord-point', name: 'Coordination Point', group: 'Control Measures', geometry: 'point', labelTemplate: '{name}', color: BLACK, pointIcon: 'gfx-coord', keywords: ['coordination'] },

  // --- Manoeuvre areas ------------------------------------------------------
  { key: 'assembly-area', name: 'Assembly Area', group: 'Manoeuvre Areas', geometry: 'polygon', labelTemplate: 'AA {name}', color: BLACK, width: 2, keywords: ['aa', 'assembly'] },
  { key: 'objective', name: 'Objective', group: 'Manoeuvre Areas', geometry: 'polygon', labelTemplate: 'OBJ {name}', color: BLACK, width: 2.4, keywords: ['obj', 'objective'] },
  { key: 'nai', name: 'Named Area of Interest', group: 'Manoeuvre Areas', geometry: 'polygon', labelTemplate: 'NAI {name}', color: BLACK, width: 2, dash: [4, 3], keywords: ['nai', 'interest'] },
  { key: 'tai', name: 'Target Area of Interest', group: 'Manoeuvre Areas', geometry: 'polygon', labelTemplate: 'TAI {name}', color: BLACK, width: 2, dash: [4, 3], keywords: ['tai'] },
  { key: 'battle-position', name: 'Battle Position', group: 'Manoeuvre Areas', geometry: 'polygon', labelTemplate: 'BP {name}', color: BLACK, width: 2, keywords: ['bp', 'battle position', 'defensive'] },
  { key: 'strongpoint', name: 'Strongpoint', group: 'Manoeuvre Areas', geometry: 'polygon', labelTemplate: 'SP {name}', color: BLACK, width: 2.6, keywords: ['strongpoint'] },
  { key: 'engagement-area', name: 'Engagement Area', group: 'Manoeuvre Areas', geometry: 'polygon', labelTemplate: 'EA {name}', color: BLACK, width: 2.4, keywords: ['ea', 'engagement', 'kill zone'] },
  { key: 'restricted-area', name: 'Restricted Operations Area', group: 'Manoeuvre Areas', geometry: 'polygon', labelTemplate: 'ROA {name}', color: BLACK, width: 2, dash: [2, 2], fill: true, fillOpacity: 0.06, keywords: ['restricted', 'roa'] },

  // --- Obstacles -------------------------------------------------------------
  { key: 'obstacle-belt', name: 'Obstacle Belt', group: 'Obstacles', geometry: 'polygon', labelTemplate: '{name}', color: GREEN, width: 2.4, keywords: ['obstacle belt', 'belt'] },
  { key: 'obstacle-zone', name: 'Obstacle Zone', group: 'Obstacles', geometry: 'polygon', labelTemplate: '{name}', color: GREEN, width: 2, dash: [6, 3], keywords: ['obstacle zone'] },
  { key: 'minefield', name: 'Minefield', group: 'Obstacles', geometry: 'polygon', labelTemplate: 'M {name}', color: GREEN, width: 2, fill: true, fillOpacity: 0.08, keywords: ['minefield', 'mines'] },
  { key: 'wire', name: 'Wire Obstacle', group: 'Obstacles', geometry: 'line', labelTemplate: '{name}', color: GREEN, width: 2, dash: [2, 4], keywords: ['wire', 'concertina'] },
  { key: 'tank-ditch', name: 'Antitank Ditch', group: 'Obstacles', geometry: 'line', labelTemplate: '{name}', color: GREEN, width: 3, keywords: ['ditch', 'antitank'] },
  { key: 'abatis', name: 'Abatis / Roadblock', group: 'Obstacles', geometry: 'point', labelTemplate: '{name}', color: GREEN, pointIcon: 'gfx-block', keywords: ['abatis', 'roadblock', 'crater'] },

  // --- Fire support -----------------------------------------------------------
  { key: 'target-point', name: 'Target (Point)', group: 'Fire Support', geometry: 'point', labelTemplate: '{name}', color: FIRES, pointIcon: 'gfx-target', keywords: ['target', 'tgt', 'point target'] },
  { key: 'trp', name: 'Target Reference Point', group: 'Fire Support', geometry: 'point', labelTemplate: 'TRP {name}', color: FIRES, pointIcon: 'gfx-target', keywords: ['trp', 'reference'] },
  { key: 'mortar-target', name: 'Mortar Target', group: 'Fire Support', geometry: 'point', labelTemplate: '{name}', color: FIRES, pointIcon: 'gfx-target', keywords: ['mortar target'] },
  { key: 'artillery-target', name: 'Artillery Target', group: 'Fire Support', geometry: 'point', labelTemplate: '{name}', color: FIRES, pointIcon: 'gfx-target', keywords: ['artillery target'] },
  { key: 'fire-mission-area', name: 'Fire Mission (Area Target)', group: 'Fire Support', geometry: 'polygon', labelTemplate: '{name}', color: FIRES, width: 2, keywords: ['fire mission', 'area target'] },
  { key: 'fsa', name: 'Fire Support Area', group: 'Fire Support', geometry: 'polygon', labelTemplate: 'FSA {name}', color: FIRES, width: 2, keywords: ['fsa', 'fire support area'] },
  { key: 'fscl', name: 'Fire Support Coordination Line', group: 'Fire Support', geometry: 'line', labelTemplate: 'FSCL {name}', color: FIRES, width: 2.4, keywords: ['fscl', 'coordination line'] },
  { key: 'cfl', name: 'Coordinated Fire Line', group: 'Fire Support', geometry: 'line', labelTemplate: 'CFL {name}', color: FIRES, width: 2, dash: [8, 4], keywords: ['cfl'] },
  { key: 'nfa', name: 'No-Fire Area', group: 'Fire Support', geometry: 'polygon', labelTemplate: 'NFA {name}', color: FIRES, width: 2.4, fill: true, fillOpacity: 0.12, keywords: ['nfa', 'no fire'] },
  { key: 'rfa', name: 'Restrictive Fire Area', group: 'Fire Support', geometry: 'polygon', labelTemplate: 'RFA {name}', color: FIRES, width: 2, dash: [6, 3], keywords: ['rfa', 'restrictive fire'] },
  { key: 'rfl', name: 'Restrictive Fire Line', group: 'Fire Support', geometry: 'line', labelTemplate: 'RFL {name}', color: FIRES, width: 2, dash: [6, 3], keywords: ['rfl'] },

  // --- Free drawing ------------------------------------------------------------
  { key: 'user-line', name: 'Line', group: 'User Drawing', geometry: 'line', labelTemplate: '{name}', color: '#d8b64a', width: 2, keywords: ['line', 'draw'] },
  { key: 'user-polygon', name: 'Polygon / Area', group: 'User Drawing', geometry: 'polygon', labelTemplate: '{name}', color: '#d8b64a', width: 2, fill: true, fillOpacity: 0.1, keywords: ['polygon', 'area'] },
  { key: 'user-arrow', name: 'Arrow', group: 'User Drawing', geometry: 'arrow', labelTemplate: '{name}', color: '#d8b64a', width: 2.6, keywords: ['arrow'] },
  { key: 'user-freehand', name: 'Freehand', group: 'User Drawing', geometry: 'freehand', labelTemplate: '{name}', color: '#d8b64a', width: 2, keywords: ['freehand', 'sketch'] },
  { key: 'user-text', name: 'Text', group: 'User Drawing', geometry: 'text', labelTemplate: '{name}', color: '#d8b64a', keywords: ['text', 'label'] },
  { key: 'user-point', name: 'Marker', group: 'User Drawing', geometry: 'point', labelTemplate: '{name}', color: '#d8b64a', pointIcon: 'gfx-marker', keywords: ['marker', 'point', 'icon'] },
]

export function findGraphicDef(key: string): GraphicDef | undefined {
  return GRAPHIC_CATALOG.find((g) => g.key === key)
}
