import { describe, expect, it } from 'vitest'
import { AREA, AREA_CENTER, elevationAt } from './elevation'
import { generateTerrain } from './generate'

describe('elevation model', () => {
  it('is deterministic', () => {
    expect(elevationAt(-76.3, 45.55)).toBe(elevationAt(-76.3, 45.55))
  })

  it('produces plausible terrain heights across the area', () => {
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < 500; i++) {
      const lng = AREA.west + ((i * 7919) % 500) / 500 * (AREA.east - AREA.west)
      const lat = AREA.south + ((i * 104729) % 500) / 500 * (AREA.north - AREA.south)
      const z = elevationAt(lng, lat)
      min = Math.min(min, z)
      max = Math.max(max, z)
    }
    expect(min).toBeGreaterThan(0)
    expect(max).toBeLessThan(500)
    expect(max - min).toBeGreaterThan(50) // meaningful relief
  })

  it('hilltops are higher than the river valley', () => {
    expect(elevationAt(-76.408, 45.596)).toBeGreaterThan(elevationAt(-76.32, 45.53) + 40)
  })
})

describe('terrain generation', () => {
  const t = generateTerrain()

  it('generates every terrain theme', () => {
    expect(t.contours.features.length).toBeGreaterThan(5)
    expect(t.water.features.length).toBeGreaterThanOrEqual(5) // 4 lakes + river polygon
    expect(t.rivers.features.length).toBeGreaterThanOrEqual(5)
    expect(t.forest.features.length).toBeGreaterThan(0)
    expect(t.marsh.features.length).toBeGreaterThanOrEqual(3)
    expect(t.roads.features.length).toBe(6)
    expect(t.trails.features.length).toBe(5)
    expect(t.railways.features.length).toBe(1)
    expect(t.buildings.features.length).toBeGreaterThan(20)
    expect(t.ranges.features.length).toBe(3)
    expect(t.bridges.features.length).toBeGreaterThan(0)
    expect(t.labels.features.length).toBeGreaterThan(10)
  })

  it('keeps all road geometry inside the area bounds (with margin)', () => {
    for (const f of t.roads.features) {
      const coords = (f.geometry as GeoJSON.LineString).coordinates
      for (const [lng, lat] of coords) {
        expect(lng).toBeGreaterThan(AREA.west - 0.05)
        expect(lng).toBeLessThan(AREA.east + 0.05)
        expect(lat).toBeGreaterThan(AREA.south - 0.05)
        expect(lat).toBeLessThan(AREA.north + 0.05)
      }
    }
  })

  it('is centred on the fictional area', () => {
    const [lng, lat] = AREA_CENTER
    expect(lng).toBeCloseTo(-76.32, 2)
    expect(lat).toBeCloseTo(45.5525, 2)
  })
})
