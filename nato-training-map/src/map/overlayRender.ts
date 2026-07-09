/**
 * Converts overlay features into GeoJSON render collections and declares the
 * MapLibre layers that draw them. Rendering is separated from React: MapView
 * pushes new data into sources when the store changes; styling lives here.
 */

import * as turf from '@turf/turf'
import type { Map as MlMap } from 'maplibre-gl'
import type { GraphicFeature, Overlay, OverlayId, SymbolFeature } from '../types'
import { OVERLAY_IDS } from '../types'
import { findGraphicDef } from '../graphics/catalog'
import { symbolImageId } from './symbolImages'

export interface OverlayRenderData {
  symbols: GeoJSON.FeatureCollection
  gfx: GeoJSON.FeatureCollection
}

export function overlaySourceIds(oid: OverlayId): { symbols: string; gfx: string } {
  return { symbols: `ov-${oid}-symbols`, gfx: `ov-${oid}-gfx` }
}

function arrowHead(coords: [number, number][], sizeKm: number): GeoJSON.Feature | null {
  if (coords.length < 2) return null
  const tip = coords[coords.length - 1]
  const prev = coords[coords.length - 2]
  const bearing = turf.bearing(turf.point(prev), turf.point(tip))
  const left = turf.destination(turf.point(tip), sizeKm, bearing + 150, { units: 'kilometers' })
  const right = turf.destination(turf.point(tip), sizeKm, bearing - 150, { units: 'kilometers' })
  return turf.polygon([
    [
      tip,
      left.geometry.coordinates as [number, number],
      right.geometry.coordinates as [number, number],
      tip,
    ],
  ])
}

export function buildOverlayData(overlay: Overlay, baseSymbolSize: number): OverlayRenderData {
  const symbolFeatures: GeoJSON.Feature[] = []
  const gfxFeatures: GeoJSON.Feature[] = []

  for (const f of overlay.features) {
    if (!f.visible) continue

    if (f.kind === 'symbol') {
      symbolFeatures.push({
        type: 'Feature',
        properties: {
          fid: f.id,
          icon: symbolImageId(f as SymbolFeature, baseSymbolSize),
          rotation: f.rotation,
          locked: f.locked,
        },
        geometry: { type: 'Point', coordinates: f.position },
      })
      continue
    }

    const g = f as GraphicFeature
    const def = findGraphicDef(g.graphicType)
    if (!def) continue
    const color = g.color ?? def.color
    const labelText = def.labelTemplate.replace('{name}', g.name || '').trim()
    const common = { fid: g.id, color, width: def.width ?? 2, dashed: !!def.dash, locked: g.locked }

    if (g.geometryKind === 'point') {
      gfxFeatures.push({
        type: 'Feature',
        properties: { ...common, role: 'icon', icon: `${def.pointIcon ?? 'gfx-marker'}@${color}` },
        geometry: { type: 'Point', coordinates: g.coordinates[0] },
      })
      if (labelText) {
        gfxFeatures.push({
          type: 'Feature',
          properties: { ...common, role: 'label', label: labelText, anchor: 'top' },
          geometry: { type: 'Point', coordinates: g.coordinates[0] },
        })
      }
      continue
    }

    if (g.geometryKind === 'text') {
      gfxFeatures.push({
        type: 'Feature',
        properties: { ...common, role: 'label', label: g.name || 'TEXT', anchor: 'center', big: true },
        geometry: { type: 'Point', coordinates: g.coordinates[0] },
      })
      continue
    }

    if (g.geometryKind === 'polygon') {
      if (g.coordinates.length < 3) continue
      const ring = [...g.coordinates, g.coordinates[0]]
      const poly = turf.polygon([ring], { ...common, role: def.fill ? 'fill' : 'nofill' })
      gfxFeatures.push(poly)
      gfxFeatures.push({
        type: 'Feature',
        properties: { ...common, role: 'outline' },
        geometry: { type: 'LineString', coordinates: ring },
      })
      if (labelText) {
        const centroid = turf.centroid(poly)
        gfxFeatures.push({
          type: 'Feature',
          properties: { ...common, role: 'label', label: labelText, anchor: 'center' },
          geometry: centroid.geometry,
        })
      }
      continue
    }

    // line / arrow / freehand
    if (g.coordinates.length < 2) continue
    gfxFeatures.push({
      type: 'Feature',
      properties: { ...common, role: 'line' },
      geometry: { type: 'LineString', coordinates: g.coordinates },
    })
    if (g.geometryKind === 'arrow') {
      const head = arrowHead(g.coordinates, 0.25)
      if (head) {
        head.properties = { ...common, role: 'arrowhead' }
        gfxFeatures.push(head)
      }
    }
    if (labelText) {
      gfxFeatures.push({
        type: 'Feature',
        properties: { ...common, role: 'linelabel', label: labelText },
        geometry: { type: 'LineString', coordinates: g.coordinates },
      })
    }
  }

  return {
    symbols: { type: 'FeatureCollection', features: symbolFeatures },
    gfx: { type: 'FeatureCollection', features: gfxFeatures },
  }
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

/**
 * Add all overlay sources and layers to a freshly-styled map. Called after
 * every style swap; data is pushed separately via updateOverlayData.
 */
export function addOverlayLayers(map: MlMap): void {
  // Grid + measure + selection helper sources.
  map.addSource('grid', { type: 'geojson', data: EMPTY })
  map.addSource('measure', { type: 'geojson', data: EMPTY })
  map.addSource('draft', { type: 'geojson', data: EMPTY })
  map.addSource('selection', { type: 'geojson', data: EMPTY })

  map.addLayer({
    id: 'grid-lines',
    type: 'line',
    source: 'grid',
    paint: {
      'line-color': '#3d6ea5',
      'line-opacity': ['case', ['get', 'principal'], 0.85, 0.45],
      'line-width': ['case', ['get', 'principal'], 1.4, 0.8],
    },
  })
  map.addLayer({
    id: 'grid-labels',
    type: 'symbol',
    source: 'grid',
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 420,
      'text-field': ['get', 'label'],
      'text-font': ['Open Sans Regular'],
      'text-size': 11,
      'text-keep-upright': true,
    },
    paint: { 'text-color': '#3d6ea5', 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1.4 },
  })

  for (const oid of OVERLAY_IDS) {
    const src = overlaySourceIds(oid)
    map.addSource(src.gfx, { type: 'geojson', data: EMPTY, promoteId: 'fid' })
    map.addSource(src.symbols, { type: 'geojson', data: EMPTY, promoteId: 'fid' })

    map.addLayer({
      id: `${oid}-gfx-fill`,
      type: 'fill',
      source: src.gfx,
      filter: ['==', ['get', 'role'], 'fill'],
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.12 },
    })
    map.addLayer({
      id: `${oid}-gfx-arrowhead`,
      type: 'fill',
      source: src.gfx,
      filter: ['==', ['get', 'role'], 'arrowhead'],
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 1 },
    })
    map.addLayer({
      id: `${oid}-gfx-line`,
      type: 'line',
      source: src.gfx,
      filter: [
        'all',
        ['in', ['get', 'role'], ['literal', ['line', 'outline']]],
        ['!', ['get', 'dashed']],
      ],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'] },
    })
    map.addLayer({
      id: `${oid}-gfx-line-dash`,
      type: 'line',
      source: src.gfx,
      filter: [
        'all',
        ['in', ['get', 'role'], ['literal', ['line', 'outline']]],
        ['get', 'dashed'],
      ],
      layout: { 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-dasharray': [4, 2.5] },
    })
    map.addLayer({
      id: `${oid}-gfx-point`,
      type: 'symbol',
      source: src.gfx,
      filter: ['==', ['get', 'role'], 'icon'],
      layout: { 'icon-image': ['get', 'icon'], 'icon-size': 0.55, 'icon-allow-overlap': true },
    })
    map.addLayer({
      id: `${oid}-gfx-label`,
      type: 'symbol',
      source: src.gfx,
      filter: ['==', ['get', 'role'], 'label'],
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Open Sans Regular'],
        'text-size': ['case', ['==', ['get', 'big'], true], 16, 12],
        'text-anchor': ['match', ['get', 'anchor'], 'top', 'top', 'center'],
        'text-offset': ['match', ['get', 'anchor'], 'top', ['literal', [0, 0.9]], ['literal', [0, 0]]],
        'text-allow-overlap': true,
        'text-letter-spacing': 0.06,
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': 'rgba(255,255,255,0.9)',
        'text-halo-width': 1.6,
      },
    })
    map.addLayer({
      id: `${oid}-gfx-linelabel`,
      type: 'symbol',
      source: src.gfx,
      filter: ['==', ['get', 'role'], 'linelabel'],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 500,
        'text-field': ['get', 'label'],
        'text-font': ['Open Sans Regular'],
        'text-size': 12,
        'text-letter-spacing': 0.06,
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': 'rgba(255,255,255,0.9)',
        'text-halo-width': 1.6,
      },
    })
    map.addLayer({
      id: `${oid}-symbols`,
      type: 'symbol',
      source: src.symbols,
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-rotate': ['get', 'rotation'],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    })
  }

  // Selection halo on top of everything.
  map.addLayer({
    id: 'selection-halo',
    type: 'circle',
    source: 'selection',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': ['case', ['==', ['get', 'vertex'], true], 5.5, 24],
      'circle-color': ['case', ['==', ['get', 'vertex'], true], '#ffd75e', 'rgba(255,215,94,0.12)'],
      'circle-stroke-color': '#ffd75e',
      'circle-stroke-width': 1.6,
    },
  })
  map.addLayer({
    id: 'selection-line',
    type: 'line',
    source: 'selection',
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: { 'line-color': '#ffd75e', 'line-width': 1.6, 'line-dasharray': [2, 2] },
  })

  // Measure / draft scratch layers.
  map.addLayer({
    id: 'draft-line',
    type: 'line',
    source: 'draft',
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: { 'line-color': '#5ec1ff', 'line-width': 2, 'line-dasharray': [3, 2] },
  })
  map.addLayer({
    id: 'draft-fill',
    type: 'fill',
    source: 'draft',
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': '#5ec1ff', 'fill-opacity': 0.12 },
  })
  map.addLayer({
    id: 'draft-points',
    type: 'circle',
    source: 'draft',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 4,
      'circle-color': '#5ec1ff',
      'circle-stroke-color': '#0b2536',
      'circle-stroke-width': 1.4,
    },
  })
  map.addLayer({
    id: 'measure-line',
    type: 'line',
    source: 'measure',
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: { 'line-color': '#ff9d5e', 'line-width': 2.4 },
  })
  map.addLayer({
    id: 'measure-points',
    type: 'circle',
    source: 'measure',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 4,
      'circle-color': '#ff9d5e',
      'circle-stroke-color': '#3a1d08',
      'circle-stroke-width': 1.4,
    },
  })
}

/** Per-overlay layer ids, used for visibility & opacity control. */
export function overlayLayerIds(oid: OverlayId): string[] {
  return [
    `${oid}-gfx-fill`,
    `${oid}-gfx-arrowhead`,
    `${oid}-gfx-line`,
    `${oid}-gfx-line-dash`,
    `${oid}-gfx-point`,
    `${oid}-gfx-label`,
    `${oid}-gfx-linelabel`,
    `${oid}-symbols`,
  ]
}
