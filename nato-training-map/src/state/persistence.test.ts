import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../types'
import { deserializeProject, importGeoJson, projectToGeoJson, serializeProject } from './persistence'
import { newId } from './store'

function projectWithFeatures() {
  const p = createEmptyProject('Ex FICTION SPEAR')
  p.overlays.friendly.features.push({
    id: newId(),
    kind: 'symbol',
    position: [-76.31, 45.56],
    symbolSet: '10',
    entity: '130800',
    affiliation: 'friend',
    context: 'exercise',
    echelon: '14',
    hqtf: '0',
    modifier1: '00',
    modifier2: '00',
    designation: 'Mor Pl',
    higherFormation: '',
    additionalInfo: '',
    reinforcedReduced: '(+)',
    rotation: 0,
    scale: 1,
    locked: false,
    visible: true,
  })
  p.overlays.control.features.push({
    id: newId(),
    kind: 'graphic',
    graphicType: 'phase-line',
    geometryKind: 'line',
    coordinates: [
      [-76.4, 45.5],
      [-76.3, 45.52],
      [-76.2, 45.5],
    ],
    name: 'AMBER',
    locked: false,
    visible: true,
  })
  p.overlays.fires.features.push({
    id: newId(),
    kind: 'graphic',
    graphicType: 'nfa',
    geometryKind: 'polygon',
    coordinates: [
      [-76.36, 45.54],
      [-76.34, 45.545],
      [-76.35, 45.56],
    ],
    name: 'HOSPITAL',
    locked: false,
    visible: true,
  })
  return p
}

describe('project JSON round trip', () => {
  it('serializes and restores overlays and settings', () => {
    const p = projectWithFeatures()
    p.settings.mapStyle = 'hybrid'
    const restored = deserializeProject(serializeProject(p))
    expect(restored.name).toBe('Ex FICTION SPEAR')
    expect(restored.overlays.friendly.features).toHaveLength(1)
    expect(restored.overlays.control.features).toHaveLength(1)
    expect(restored.settings.mapStyle).toBe('hybrid')
  })

  it('rejects non-project JSON', () => {
    expect(() => deserializeProject('{"foo": 1}')).toThrow()
  })
})

describe('GeoJSON round trip', () => {
  it('exports one GeoJSON feature per app feature with SIDC properties', () => {
    const fc = projectToGeoJson(projectWithFeatures())
    expect(fc.features).toHaveLength(3)
    const sym = fc.features.find((f) => f.properties?.kind === 'symbol')!
    expect(sym.properties?.sidc).toMatch(/^\d{20}$/)
    expect(sym.geometry.type).toBe('Point')
    const poly = fc.features.find((f) => f.properties?.graphicType === 'nfa')!
    expect(poly.geometry.type).toBe('Polygon')
  })

  it('re-imports its own export losslessly (counts + overlays)', () => {
    const original = projectWithFeatures()
    const fc = projectToGeoJson(original)
    const imported = importGeoJson(createEmptyProject(), JSON.stringify(fc))
    expect(imported.overlays.friendly.features).toHaveLength(1)
    expect(imported.overlays.control.features).toHaveLength(1)
    expect(imported.overlays.fires.features).toHaveLength(1)
    const sym = imported.overlays.friendly.features[0]
    expect(sym.kind).toBe('symbol')
    if (sym.kind === 'symbol') {
      expect(sym.entity).toBe('130800')
      expect(sym.reinforcedReduced).toBe('(+)')
    }
  })

  it('imports foreign GeoJSON onto the user overlay', () => {
    const foreign = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [[-76.3, 45.5], [-76.29, 45.51]] },
        },
      ],
    }
    const imported = importGeoJson(createEmptyProject(), JSON.stringify(foreign))
    expect(imported.overlays.user.features).toHaveLength(1)
    expect(imported.overlays.user.features[0].kind).toBe('graphic')
  })
})
