/**
 * On-demand raster icons for the map.
 *
 * Unit symbols are drawn by milsymbol from APP-6(D) SIDCs, including text
 * amplifiers (designation, higher formation, reinforced/reduced), and cached
 * as map images keyed by a hash of everything that affects appearance.
 * Point-type tactical graphics use small hand-drawn canvas icons.
 */

import ms from 'milsymbol'
import type { Map as MlMap } from 'maplibre-gl'
import type { SymbolFeature } from '../types'
import { buildSidc } from '../symbols/sidc'

/** Stable image id for a symbol feature's current appearance. */
export function symbolImageId(f: SymbolFeature, baseSize: number): string {
  return [
    'ms',
    buildSidc(f),
    f.designation,
    f.higherFormation,
    f.additionalInfo,
    f.reinforcedReduced,
    Math.round(baseSize * f.scale),
  ]
    .join('|')
    .replace(/[^ -~]/g, '?')
}

/** Parse a symbolImageId back into render options. */
function renderFromId(id: string): { canvas: HTMLCanvasElement } | null {
  const parts = id.split('|')
  if (parts.length !== 7 || parts[0] !== 'ms') return null
  const [, sidc, designation, higher, info, rr, sizeStr] = parts
  const size = Number(sizeStr) || 30
  const sym = new ms.Symbol(sidc, {
    size,
    uniqueDesignation: designation,
    higherFormation: higher,
    additionalInformation: info,
    reinforcedReduced: rr === '(+)' ? '+' : rr === '(-)' ? '-' : rr === '(±)' ? '±' : '',
    outlineWidth: 3,
    outlineColor: 'rgba(0,0,0,0.35)',
    infoSize: 40,
  })
  return { canvas: sym.asCanvas(2) }
}

const GFX_ICON_SIZE = 36

/** Hand-drawn icons for point control measures (gfx-*). */
function drawGraphicIcon(id: string): HTMLCanvasElement | null {
  const m = id.match(/^(gfx-[a-z]+)@(.+)$/)
  if (!m) return null
  const [, kind, color] = m
  const s = GFX_ICON_SIZE
  const canvas = document.createElement('canvas')
  canvas.width = s * 2
  canvas.height = s * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(2, 2)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  const c = s / 2
  const r = s / 2 - 4

  switch (kind) {
    case 'gfx-target': {
      // Fire-support point target: diagonal cross.
      ctx.beginPath()
      ctx.moveTo(c - r, c - r)
      ctx.lineTo(c + r, c + r)
      ctx.moveTo(c + r, c - r)
      ctx.lineTo(c - r, c + r)
      ctx.stroke()
      break
    }
    case 'gfx-checkpoint': {
      // Checkpoint: flag on a post.
      ctx.beginPath()
      ctx.moveTo(c - 4, c + r)
      ctx.lineTo(c - 4, c - r)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(c - 4, c - r)
      ctx.lineTo(c + r, c - r + 5)
      ctx.lineTo(c - 4, c - r + 10)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'gfx-rp':
    case 'gfx-sp':
    case 'gfx-coord': {
      // Circle with centre dot; RP/SP labels come from the text layer.
      ctx.beginPath()
      ctx.arc(c, c, r - 2, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(c, c, 2.4, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'gfx-op': {
      // Observation post: open triangle.
      ctx.beginPath()
      ctx.moveTo(c, c - r)
      ctx.lineTo(c + r, c + r - 2)
      ctx.lineTo(c - r, c + r - 2)
      ctx.closePath()
      ctx.stroke()
      break
    }
    case 'gfx-block': {
      // Roadblock/abatis: heavy bar between posts.
      ctx.beginPath()
      ctx.moveTo(c - r, c - 6)
      ctx.lineTo(c - r, c + 6)
      ctx.moveTo(c + r, c - 6)
      ctx.lineTo(c + r, c + 6)
      ctx.moveTo(c - r, c)
      ctx.lineTo(c + r, c)
      ctx.stroke()
      break
    }
    case 'gfx-marker': {
      ctx.beginPath()
      ctx.arc(c, c, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(c, c, r - 3, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    default:
      return null
  }
  return canvas
}

/**
 * Install a styleimagemissing handler that lazily rasterizes any icon the
 * style asks for. Must be re-attached after each setStyle().
 */
export function installImageFactory(map: MlMap): void {
  map.on('styleimagemissing', (e) => {
    const id = e.id
    if (map.hasImage(id)) return
    let canvas: HTMLCanvasElement | null = null
    if (id.startsWith('ms|')) {
      canvas = renderFromId(id)?.canvas ?? null
    } else if (id.startsWith('gfx-')) {
      canvas = drawGraphicIcon(id)
    }
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
    map.addImage(id, data, { pixelRatio: 2 })
  })
}

/** SVG string for palette previews (side panel). */
export function previewSvg(opts: {
  sidc: string
  size?: number
}): string {
  const sym = new ms.Symbol(opts.sidc, { size: opts.size ?? 26 })
  return sym.asSVG()
}
