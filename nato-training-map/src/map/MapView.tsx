import { useEffect, useRef, useState } from 'react'
import maplibregl, { Map as MlMap, MapMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as turf from '@turf/turf'
import { useStore, findFeature, newId, getSelectedFeatures } from '../state/store'
import { buildMapStyle, LAYER_TOGGLE_MAP } from './mapStyle'
import { registerLocalGlyphs } from './localGlyphs'
import { addOverlayLayers, buildOverlayData, overlayLayerIds, overlaySourceIds } from './overlayRender'
import { installImageFactory } from './symbolImages'
import { buildGrid } from './grid'
import { AREA_CENTER, elevationAt } from '../terrain/elevation'
import { latLonToUtm, utmToLatLon, toMgrs } from '../utils/coords'
import { findGraphicDef } from '../graphics/catalog'
import { OVERLAY_IDS, type Feature, type GraphicFeature, type OverlayId } from '../types'

/** Module-level handle so toolbar actions (export, fly-to) can reach the map. */
export const mapHandle: { current: MlMap | null } = { current: null }

interface CtxMenu {
  x: number
  y: number
  featureId: string | null
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

function snapLngLat(lngLat: [number, number], enabled: boolean): [number, number] {
  if (!enabled) return lngLat
  const { easting, northing, zone } = latLonToUtm(lngLat[0], lngLat[1])
  const step = 100 // metres
  const { lng, lat } = utmToLatLon(
    Math.round(easting / step) * step,
    Math.round(northing / step) * step,
    zone,
  )
  return [lng, lat]
}

function hitLayers(): string[] {
  const ids: string[] = []
  for (const oid of OVERLAY_IDS) {
    ids.push(
      `${oid}-symbols`,
      `${oid}-gfx-fill`,
      `${oid}-gfx-line`,
      `${oid}-gfx-line-dash`,
      `${oid}-gfx-point`,
      `${oid}-gfx-label`,
    )
  }
  return ids
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const styleReady = useRef(false)
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [bearing, setBearing] = useState(0)

  const project = useStore((s) => s.project)
  const selectedIds = useStore((s) => s.selectedIds)
  const tool = useStore((s) => s.tool)
  const drawing = useStore((s) => s.drawing)
  const measure = useStore((s) => s.measure)
  const mapStyleId = useStore((s) => s.project.settings.mapStyle)

  // ------------------------------------------------------------------ init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    registerLocalGlyphs()
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(useStore.getState().project.settings.mapStyle),
      center: AREA_CENTER,
      zoom: 12,
      maxZoom: 17.5,
      minZoom: 8,
      preserveDrawingBuffer: true, // needed for PNG/PDF export
      attributionControl: false,
    })
    mapRef.current = map
    mapHandle.current = map

    map.addControl(new maplibregl.ScaleControl({ maxWidth: 160, unit: 'metric' }), 'bottom-right')
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right')
    installImageFactory(map)

    map.on('style.load', () => {
      addOverlayLayers(map)
      styleReady.current = true
      syncAll(map)
    })

    map.on('rotate', () => setBearing(map.getBearing()))
    map.on('moveend', () => syncGrid(map))
    map.on('mousemove', (e) => {
      useStore.getState().setCursor({ lng: e.lngLat.lng, lat: e.lngLat.lat })
      handleHoverCursor(map, e)
      handleDrawMove(e)
      handleDragMove(map, e)
    })
    map.on('mousedown', (e) => handleMouseDown(map, e))
    map.on('mouseup', () => endDrag(map))
    map.on('click', (e) => handleClick(map, e))
    map.on('dblclick', (e) => {
      const t = useStore.getState().tool
      if (t.startsWith('draw-') || t.startsWith('measure-')) {
        e.preventDefault()
        finishDrawing()
      }
    })
    map.on('contextmenu', (e) => {
      const feats = map.queryRenderedFeatures(e.point, { layers: presentLayers(map, hitLayers()) })
      const fid = (feats[0]?.properties as any)?.fid ?? null
      if (fid) useStore.getState().select([fid])
      setCtxMenu({ x: e.point.x, y: e.point.y, featureId: fid })
      e.preventDefault()
    })

    return () => {
      map.remove()
      mapRef.current = null
      mapHandle.current = null
      styleReady.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // -------------------------------------------------------------- style swap
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    styleReady.current = false
    map.setStyle(buildMapStyle(mapStyleId), { diff: false })
    // style.load handler re-adds overlay layers and calls syncAll
  }, [mapStyleId])

  // ------------------------------------------------------------- data sync
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady.current) return
    syncOverlays(map)
    syncSelection(map)
    syncTerrainToggles(map)
    syncGrid(map)
  }, [project, selectedIds])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady.current) return
    syncScratch(map)
  }, [drawing, measure, tool])

  // Cursor style per tool
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const c =
      tool === 'select' ? '' : tool.startsWith('measure-') || tool === 'coordinate-pick' ? 'crosshair' : 'crosshair'
    map.getCanvas().style.cursor = c
  }, [tool])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {/* North arrow (rotates with map bearing) */}
      <div
        className="pointer-events-none absolute right-3 top-24 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-edge bg-panel/80"
        style={{ transform: `rotate(${-bearing}deg)` }}
        title="North"
      >
        <svg viewBox="0 0 24 24" className="h-8 w-8">
          <polygon points="12,2 15,14 12,11.5 9,14" fill="#e05c5c" />
          <polygon points="12,22 15,14 12,16.5 9,14" fill="#cfd6de" />
          <text x="12" y="7.5" textAnchor="middle" fontSize="5.5" fill="#fff" fontFamily="monospace">
            N
          </text>
        </svg>
      </div>
      {ctxMenu && (
        <ContextMenu
          menu={ctxMenu}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
}

// ===========================================================================
// Context menu
// ===========================================================================

function ContextMenu({ menu, onClose }: { menu: CtxMenu; onClose: () => void }) {
  const store = useStore()
  const hit = menu.featureId ? findFeature(store.project, menu.featureId) : null
  const f = hit?.feature

  const item =
    'px-3 py-1.5 text-left text-xs hover:bg-panel3 disabled:opacity-40 disabled:hover:bg-transparent'

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        className="absolute z-50 flex w-44 flex-col rounded border border-edge bg-panel2 py-1 shadow-xl"
        style={{ left: menu.x, top: menu.y }}
      >
        {f ? (
          <>
            <button className={item} onClick={() => { store.copy([f.id]); onClose() }}>Copy</button>
            <button className={item} onClick={() => { store.duplicateFeatures([f.id]); onClose() }}>Duplicate</button>
            <button className={item} disabled={f.locked} onClick={() => { store.deleteFeatures([f.id]); onClose() }}>Delete</button>
            <div className="my-1 border-t border-edge" />
            <button className={item} onClick={() => { store.updateFeature(f.id, { locked: !f.locked }); onClose() }}>
              {f.locked ? 'Unlock' : 'Lock'}
            </button>
            <button className={item} onClick={() => { store.updateFeature(f.id, { visible: !f.visible }); onClose() }}>
              {f.visible ? 'Hide' : 'Show'}
            </button>
          </>
        ) : (
          <>
            <button className={item} disabled={store.clipboard.length === 0} onClick={() => {
              const map = mapHandle.current
              if (map) {
                const ll = map.unproject([menu.x, menu.y])
                store.paste([ll.lng, ll.lat])
              }
              onClose()
            }}>Paste here</button>
            <button className={item} onClick={() => {
              const map = mapHandle.current
              if (map) {
                const ll = map.unproject([menu.x, menu.y])
                navigator.clipboard?.writeText(toMgrs(ll.lng, ll.lat)).catch(() => {})
              }
              onClose()
            }}>Copy MGRS</button>
          </>
        )}
      </div>
    </>
  )
}

// ===========================================================================
// Map <-> store synchronization (pure functions of current state)
// ===========================================================================

function presentLayers(map: MlMap, ids: string[]): string[] {
  return ids.filter((id) => map.getLayer(id))
}

function setData(map: MlMap, sourceId: string, data: GeoJSON.FeatureCollection) {
  const src = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined
  if (src) src.setData(data as any)
}

function syncAll(map: MlMap) {
  syncOverlays(map)
  syncSelection(map)
  syncTerrainToggles(map)
  syncGrid(map)
  syncScratch(map)
}

function syncOverlays(map: MlMap) {
  const { project } = useStore.getState()
  for (const oid of OVERLAY_IDS) {
    const overlay = project.overlays[oid]
    const src = overlaySourceIds(oid)
    const data = buildOverlayData(overlay, project.settings.symbolSize)
    setData(map, src.symbols, data.symbols)
    setData(map, src.gfx, data.gfx)
    for (const layerId of presentLayers(map, overlayLayerIds(oid))) {
      map.setLayoutProperty(layerId, 'visibility', overlay.visible ? 'visible' : 'none')
      const layer = map.getLayer(layerId)
      const t = layer?.type
      if (t === 'symbol') {
        map.setPaintProperty(layerId, 'icon-opacity', overlay.opacity)
        map.setPaintProperty(layerId, 'text-opacity', overlay.opacity)
      } else if (t === 'line') {
        map.setPaintProperty(layerId, 'line-opacity', overlay.opacity)
      } else if (t === 'fill') {
        const base = layerId.endsWith('arrowhead') ? 1 : 0.12
        map.setPaintProperty(layerId, 'fill-opacity', base * overlay.opacity)
      }
    }
  }
}

function syncTerrainToggles(map: MlMap) {
  const { terrainLayers } = useStore.getState().project.settings
  for (const [layerId, key] of Object.entries(LAYER_TOGGLE_MAP)) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', terrainLayers[key] ? 'visible' : 'none')
    }
  }
}

function syncGrid(map: MlMap) {
  const { project } = useStore.getState()
  if (!map.getSource('grid')) return
  setData(
    map,
    'grid',
    project.settings.showGrid ? buildGrid(map.getBounds(), map.getZoom()) : EMPTY_FC,
  )
}

function syncSelection(map: MlMap) {
  const state = useStore.getState()
  const selected = getSelectedFeatures(state)
  const features: GeoJSON.Feature[] = []
  for (const { feature } of selected) {
    if (feature.kind === 'symbol') {
      features.push({
        type: 'Feature',
        properties: { vertex: false },
        geometry: { type: 'Point', coordinates: feature.position },
      })
    } else {
      const g = feature as GraphicFeature
      const coords =
        g.geometryKind === 'polygon' && g.coordinates.length >= 3
          ? [...g.coordinates, g.coordinates[0]]
          : g.coordinates
      if (coords.length >= 2) {
        features.push({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords },
        })
      }
      g.coordinates.forEach((c, i) => {
        features.push({
          type: 'Feature',
          properties: { vertex: true, fid: g.id, vi: i },
          geometry: { type: 'Point', coordinates: c },
        })
      })
    }
  }
  setData(map, 'selection', { type: 'FeatureCollection', features })
}

function syncScratch(map: MlMap) {
  const { drawing, measure, tool, placingGraphic } = useStore.getState()
  const draft: GeoJSON.Feature[] = []
  if (drawing.length > 0) {
    const def = placingGraphic ? findGraphicDef(placingGraphic) : undefined
    drawing.forEach((c) => draft.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }))
    if (drawing.length >= 2) {
      draft.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: drawing } })
    }
    if (def?.geometry === 'polygon' && drawing.length >= 3) {
      draft.push(turf.polygon([[...drawing, drawing[0]]]))
    }
  }
  setData(map, 'draft', { type: 'FeatureCollection', features: draft })

  const mfeats: GeoJSON.Feature[] = []
  measure.points.forEach((c) => mfeats.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }))
  if (measure.points.length >= 2) {
    const line: [number, number][] =
      tool === 'measure-area' && measure.points.length >= 3
        ? [...measure.points, measure.points[0]]
        : measure.points
    mfeats.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } })
  }
  setData(map, 'measure', { type: 'FeatureCollection', features: mfeats })
}

// ===========================================================================
// Interactions
// ===========================================================================

interface DragState {
  fid: string
  /** For vertex drags, the vertex index; -1 = whole feature. */
  vertexIndex: number
  last: [number, number]
}
let drag: DragState | null = null

function handleHoverCursor(map: MlMap, e: MapMouseEvent) {
  if (useStore.getState().tool !== 'select' || drag) return
  const feats = map.queryRenderedFeatures(e.point, {
    layers: presentLayers(map, [...hitLayers(), 'selection-halo']),
  })
  map.getCanvas().style.cursor = feats.length > 0 ? 'pointer' : ''
}

function handleMouseDown(map: MlMap, e: MapMouseEvent) {
  const state = useStore.getState()
  if (state.tool === 'select') {
    // Vertex handles take priority.
    const vhits = map
      .queryRenderedFeatures(e.point, { layers: presentLayers(map, ['selection-halo']) })
      .filter((f) => (f.properties as any).vertex)
    if (vhits.length > 0) {
      const p = vhits[0].properties as any
      startDrag(map, { fid: p.fid, vertexIndex: p.vi, last: [e.lngLat.lng, e.lngLat.lat] })
      return
    }
    const hits = map.queryRenderedFeatures(e.point, { layers: presentLayers(map, hitLayers()) })
    const fid = (hits[0]?.properties as any)?.fid
    if (fid) {
      const hit = findFeature(state.project, fid)
      if (hit && !hit.feature.locked) {
        useStore.getState().select([fid])
        startDrag(map, { fid, vertexIndex: -1, last: [e.lngLat.lng, e.lngLat.lat] })
      }
    }
    return
  }
  if (state.tool === 'draw-freehand' && state.placingGraphic) {
    map.dragPan.disable()
    useStore.getState().setDrawing([[e.lngLat.lng, e.lngLat.lat]])
    freehandActive = true
  }
}

function startDrag(map: MlMap, d: DragState) {
  drag = d
  map.dragPan.disable()
  useStore.getState().beginTransient()
}

let freehandActive = false

function handleDragMove(map: MlMap, e: MapMouseEvent) {
  const state = useStore.getState()
  if (freehandActive && state.tool === 'draw-freehand') {
    state.setDrawing([...state.drawing, [e.lngLat.lng, e.lngLat.lat]])
    return
  }
  if (!drag) return
  const snap = state.project.settings.snapToGrid
  const cur = snapLngLat([e.lngLat.lng, e.lngLat.lat], snap)
  const hit = findFeature(state.project, drag.fid)
  if (!hit) return
  const f = hit.feature
  if (f.kind === 'symbol') {
    state.updateFeatureLive(f.id, { position: cur })
  } else if (drag.vertexIndex >= 0) {
    const coords = f.coordinates.map((c, i) => (i === drag!.vertexIndex ? cur : c)) as [number, number][]
    state.updateFeatureLive(f.id, { coordinates: coords })
  } else {
    const dx = e.lngLat.lng - drag.last[0]
    const dy = e.lngLat.lat - drag.last[1]
    const coords = f.coordinates.map(([x, y]) => [x + dx, y + dy]) as [number, number][]
    state.updateFeatureLive(f.id, { coordinates: coords })
    drag.last = [e.lngLat.lng, e.lngLat.lat]
  }
}

function endDrag(map: MlMap) {
  if (freehandActive) {
    freehandActive = false
    map.dragPan.enable()
    finishDrawing()
    return
  }
  if (!drag) return
  drag = null
  map.dragPan.enable()
  useStore.getState().endTransient()
}

function handleDrawMove(_e: MapMouseEvent) {
  // Live rubber-banding is covered by the draft source (vertices only).
}

function handleClick(map: MlMap, e: MapMouseEvent) {
  const state = useStore.getState()
  const lngLat = snapLngLat([e.lngLat.lng, e.lngLat.lat], state.project.settings.snapToGrid)

  switch (state.tool) {
    case 'select': {
      if (drag) return
      const hits = map.queryRenderedFeatures(e.point, { layers: presentLayers(map, hitLayers()) })
      const fid = (hits[0]?.properties as any)?.fid
      state.select(fid ? [fid] : [], e.originalEvent.shiftKey)
      return
    }
    case 'place-symbol': {
      const entry = state.placingSymbol
      if (!entry) return
      const paletteDefaults = usePaletteDefaults()
      state.addFeature(state.activeOverlay, {
        id: newId(),
        kind: 'symbol',
        position: lngLat,
        symbolSet: entry.symbolSet,
        entity: entry.entity,
        affiliation: paletteDefaults.affiliation,
        context: paletteDefaults.context,
        echelon: paletteDefaults.echelon,
        hqtf: '0',
        modifier1: entry.modifier1 ?? '00',
        modifier2: entry.modifier2 ?? '00',
        designation: '',
        higherFormation: '',
        additionalInfo: '',
        reinforcedReduced: '',
        rotation: 0,
        scale: 1,
        locked: false,
        visible: true,
      })
      state.noteRecent(entry.key)
      return
    }
    case 'draw-point': {
      placePointGraphic(state.placingGraphic, lngLat)
      return
    }
    case 'draw-text': {
      const text = window.prompt('Text label:')
      if (text) {
        useStore.getState().addFeature(state.activeOverlay, {
          id: newId(),
          kind: 'graphic',
          graphicType: 'user-text',
          geometryKind: 'text',
          coordinates: [lngLat],
          name: text,
          locked: false,
          visible: true,
        })
      }
      return
    }
    case 'draw-line':
    case 'draw-polygon':
    case 'draw-arrow': {
      state.setDrawing([...state.drawing, lngLat])
      return
    }
    case 'measure-distance':
    case 'measure-bearing':
    case 'measure-area': {
      const pts = [...state.measure.points, [e.lngLat.lng, e.lngLat.lat] as [number, number]]
      state.setMeasure({ points: pts, result: measureResult(state.tool, pts) })
      return
    }
    case 'elevation-profile': {
      const pts = [...state.measure.points, [e.lngLat.lng, e.lngLat.lat] as [number, number]].slice(-2)
      state.setMeasure({ points: pts, result: pts.length === 2 ? 'profile-ready' : 'Pick end point…' })
      return
    }
    case 'coordinate-pick': {
      const ref = toMgrs(e.lngLat.lng, e.lngLat.lat)
      navigator.clipboard?.writeText(ref).catch(() => {})
      state.setMeasure({ points: [[e.lngLat.lng, e.lngLat.lat]], result: `${ref} (copied)` })
      return
    }
    default:
      return
  }
}

function placePointGraphic(graphicType: string | null, lngLat: [number, number]) {
  const state = useStore.getState()
  const key = graphicType ?? 'user-point'
  const def = findGraphicDef(key)
  if (!def) return
  const name = def.labelTemplate.includes('{name}') ? window.prompt(`${def.name} designation:`, '') ?? '' : ''
  state.addFeature(state.activeOverlay, {
    id: newId(),
    kind: 'graphic',
    graphicType: key,
    geometryKind: 'point',
    coordinates: [lngLat],
    name,
    locked: false,
    visible: true,
  })
}

export function finishDrawing() {
  const state = useStore.getState()
  const { tool, drawing, placingGraphic } = state
  if (tool === 'measure-distance' || tool === 'measure-area' || tool === 'measure-bearing') {
    return // measures stay until tool change / Esc
  }
  if (!tool.startsWith('draw-') || drawing.length === 0) return
  const key = placingGraphic ?? (tool === 'draw-polygon' ? 'user-polygon' : tool === 'draw-arrow' ? 'user-arrow' : tool === 'draw-freehand' ? 'user-freehand' : 'user-line')
  const def = findGraphicDef(key)
  if (!def) return
  const kind = def.geometry
  const minPts = kind === 'polygon' ? 3 : 2
  if (drawing.length < minPts) {
    state.setDrawing([])
    return
  }
  const name = def.labelTemplate.includes('{name}') ? window.prompt(`${def.name} designation:`, '') ?? '' : ''
  state.addFeature(state.activeOverlay, {
    id: newId(),
    kind: 'graphic',
    graphicType: key,
    geometryKind: kind === 'freehand' ? 'freehand' : kind,
    coordinates: drawing,
    name,
    locked: false,
    visible: true,
  })
  state.setDrawing([])
}

function measureResult(tool: string, pts: [number, number][]): string {
  if (tool === 'measure-distance' && pts.length >= 2) {
    const km = turf.length(turf.lineString(pts), { units: 'kilometers' })
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`
  }
  if (tool === 'measure-bearing' && pts.length >= 2) {
    const a = pts[pts.length - 2]
    const b = pts[pts.length - 1]
    let brg = turf.bearing(turf.point(a), turf.point(b))
    if (brg < 0) brg += 360
    const mils = Math.round((brg / 360) * 6400)
    return `${brg.toFixed(1)}° / ${mils} mils`
  }
  if (tool === 'measure-area' && pts.length >= 3) {
    const areaM2 = turf.area(turf.polygon([[...pts, pts[0]]]))
    return areaM2 > 1e6 ? `${(areaM2 / 1e6).toFixed(2)} km²` : `${Math.round(areaM2)} m²`
  }
  return 'Keep clicking…'
}

/** Defaults applied when placing from the palette (owned by the side panel). */
export const paletteDefaults = {
  affiliation: 'friend' as import('../types').Affiliation,
  context: 'reality' as import('../types').SymbolContext,
  echelon: '14' as import('../types').Echelon,
}

function usePaletteDefaults() {
  return paletteDefaults
}

/** Sample the fictional heightfield along the current profile line. */
export function sampleProfile(a: [number, number], b: [number, number], n = 80) {
  const line = turf.lineString([a, b])
  const totalKm = turf.length(line, { units: 'kilometers' })
  const samples: { d: number; z: number }[] = []
  for (let i = 0; i <= n; i++) {
    const p = turf.along(line, (totalKm * i) / n, { units: 'kilometers' })
    const [lng, lat] = p.geometry.coordinates
    samples.push({ d: (totalKm * i) / n, z: elevationAt(lng, lat) })
  }
  return { samples, totalKm }
}

export type { Feature, OverlayId }
