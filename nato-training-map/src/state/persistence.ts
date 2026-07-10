/**
 * Project persistence: JSON save/load, localStorage autosave, GeoJSON
 * import/export, and PNG/PDF map export.
 */

import type { Feature, OverlayId, Project } from '../types'
import { createEmptyProject, OVERLAY_IDS } from '../types'
import { buildSidc } from '../symbols/sidc'
import { findGraphicDef } from '../graphics/catalog'
import { newId, AUTOSAVE_KEY } from './store'

export function serializeProject(p: Project): string {
  return JSON.stringify(p, null, 2)
}

export function deserializeProject(text: string): Project {
  const raw = JSON.parse(text)
  if (!raw || raw.schemaVersion !== 1 || !raw.overlays) {
    throw new Error('Not a valid project file')
  }
  // Merge onto an empty project so missing fields get defaults.
  const base = createEmptyProject(raw.name ?? 'Imported Exercise')
  for (const oid of OVERLAY_IDS) {
    if (raw.overlays[oid]) {
      base.overlays[oid] = { ...base.overlays[oid], ...raw.overlays[oid] }
    }
  }
  base.bookmarks = raw.bookmarks ?? []
  base.settings = { ...base.settings, ...(raw.settings ?? {}) }
  return base
}

export function downloadText(filename: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function autosave(p: Project): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(p))
  } catch {
    /* storage full or unavailable */
  }
}

export function loadAutosave(): Project | null {
  try {
    const text = localStorage.getItem(AUTOSAVE_KEY)
    return text ? deserializeProject(text) : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// GeoJSON round trip
// ---------------------------------------------------------------------------

function featureToGeoJson(overlay: OverlayId, f: Feature): GeoJSON.Feature {
  if (f.kind === 'symbol') {
    return {
      type: 'Feature',
      properties: {
        kind: 'symbol',
        overlay,
        sidc: buildSidc(f),
        symbolSet: f.symbolSet,
        entity: f.entity,
        affiliation: f.affiliation,
        context: f.context,
        echelon: f.echelon,
        hqtf: f.hqtf,
        modifier1: f.modifier1,
        modifier2: f.modifier2,
        designation: f.designation,
        higherFormation: f.higherFormation,
        additionalInfo: f.additionalInfo,
        reinforcedReduced: f.reinforcedReduced,
        rotation: f.rotation,
        scale: f.scale,
      },
      geometry: { type: 'Point', coordinates: f.position },
    }
  }
  const def = findGraphicDef(f.graphicType)
  const props = {
    kind: 'graphic',
    overlay,
    graphicType: f.graphicType,
    geometryKind: f.geometryKind,
    name: f.name,
    color: f.color ?? def?.color,
  }
  if (f.geometryKind === 'point' || f.geometryKind === 'text') {
    return {
      type: 'Feature',
      properties: props,
      geometry: { type: 'Point', coordinates: f.coordinates[0] },
    }
  }
  if (f.geometryKind === 'polygon') {
    const ring = [...f.coordinates, f.coordinates[0]]
    return {
      type: 'Feature',
      properties: props,
      geometry: { type: 'Polygon', coordinates: [ring] },
    }
  }
  return {
    type: 'Feature',
    properties: props,
    geometry: { type: 'LineString', coordinates: f.coordinates },
  }
}

export function projectToGeoJson(p: Project): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (const oid of OVERLAY_IDS) {
    for (const f of p.overlays[oid].features) {
      features.push(featureToGeoJson(oid, f))
    }
  }
  return { type: 'FeatureCollection', features }
}

/**
 * Import a GeoJSON FeatureCollection. Features previously exported by this
 * app round-trip losslessly; foreign features become user-overlay graphics.
 */
export function importGeoJson(p: Project, fcText: string): Project {
  const fc = JSON.parse(fcText) as GeoJSON.FeatureCollection
  if (fc.type !== 'FeatureCollection') throw new Error('Not a GeoJSON FeatureCollection')
  const next: Project = JSON.parse(JSON.stringify(p))

  for (const gf of fc.features) {
    const props = (gf.properties ?? {}) as Record<string, any>
    const overlay: OverlayId = OVERLAY_IDS.includes(props.overlay) ? props.overlay : 'user'

    if (props.kind === 'symbol' && gf.geometry.type === 'Point') {
      next.overlays[overlay].features.push({
        id: newId(),
        kind: 'symbol',
        position: gf.geometry.coordinates as [number, number],
        symbolSet: props.symbolSet ?? '10',
        entity: props.entity ?? '121100',
        affiliation: props.affiliation ?? 'friend',
        context: props.context ?? 'exercise',
        echelon: props.echelon ?? '00',
        hqtf: props.hqtf ?? '0',
        modifier1: props.modifier1 ?? '00',
        modifier2: props.modifier2 ?? '00',
        designation: props.designation ?? '',
        higherFormation: props.higherFormation ?? '',
        additionalInfo: props.additionalInfo ?? '',
        reinforcedReduced: props.reinforcedReduced ?? '',
        rotation: props.rotation ?? 0,
        scale: props.scale ?? 1,
        locked: false,
        visible: true,
      })
      continue
    }

    // Graphics (or foreign geometry).
    let coordinates: [number, number][] = []
    let geometryKind = props.geometryKind
    if (gf.geometry.type === 'Point') {
      coordinates = [gf.geometry.coordinates as [number, number]]
      geometryKind = geometryKind ?? 'point'
    } else if (gf.geometry.type === 'LineString') {
      coordinates = gf.geometry.coordinates as [number, number][]
      geometryKind = geometryKind ?? 'line'
    } else if (gf.geometry.type === 'Polygon') {
      const ring = gf.geometry.coordinates[0] as [number, number][]
      coordinates = ring.slice(0, -1)
      geometryKind = geometryKind ?? 'polygon'
    } else {
      continue // unsupported geometry type
    }

    next.overlays[overlay].features.push({
      id: newId(),
      kind: 'graphic',
      graphicType: props.graphicType ?? (geometryKind === 'polygon' ? 'user-polygon' : geometryKind === 'point' ? 'user-point' : 'user-line'),
      geometryKind,
      coordinates,
      name: props.name ?? '',
      color: props.color,
      locked: false,
      visible: true,
    })
  }
  return next
}

// ---------------------------------------------------------------------------
// PNG / PDF export
// ---------------------------------------------------------------------------

export function exportPng(canvas: HTMLCanvasElement, name: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.png`
    a.click()
    URL.revokeObjectURL(url)
  })
}

export async function exportPdf(canvas: HTMLCanvasElement, name: string): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const landscape = canvas.width >= canvas.height
  const pdf = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a3',
  })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 10
  const scale = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2 - 12) / canvas.height)
  const w = canvas.width * scale
  const h = canvas.height * scale
  pdf.setFontSize(14)
  pdf.text(`${name} — Maplewood Training Area (fictional, training use only)`, margin, margin)
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin + 4, w, h)
  pdf.save(`${name}.pdf`)
}
