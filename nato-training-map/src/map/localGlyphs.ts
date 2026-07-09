/**
 * Fully-offline glyph provider.
 *
 * MapLibre normally fetches SDF glyph atlases (protobuf .pbf files) from a
 * font server. To keep the app self-contained and offline-capable, we
 * register a custom `local-glyphs://` protocol that rasterizes glyphs on the
 * client with TinySDF and encodes them in the standard glyphs.proto format.
 */

import maplibregl from 'maplibre-gl'
import TinySDF from '@mapbox/tiny-sdf'
import { PbfWriter } from 'pbf'

export const LOCAL_GLYPHS_URL = 'local-glyphs://fonts/{fontstack}/{range}.pbf'

const FONT_FAMILY = '"Open Sans", "Segoe UI", "Helvetica Neue", Arial, sans-serif'
const FONT_SIZE = 24
const BUFFER = 3

// glyphs.proto field numbers.
const GLYPHS_STACKS = 1
const STACK_NAME = 1
const STACK_RANGE = 2
const STACK_GLYPH = 3
const GLYPH_ID = 1
const GLYPH_BITMAP = 2
const GLYPH_WIDTH = 3
const GLYPH_HEIGHT = 4
const GLYPH_LEFT = 5
const GLYPH_TOP = 6
const GLYPH_ADVANCE = 7

let sdf: TinySDF | null = null
const cache = new Map<string, Uint8Array>()

function getSdf(): TinySDF {
  if (!sdf) {
    sdf = new TinySDF({
      fontSize: FONT_SIZE,
      buffer: BUFFER,
      radius: 8,
      cutoff: 0.25,
      fontFamily: FONT_FAMILY,
      fontWeight: '400',
    })
  }
  return sdf
}

function encodeRange(fontstack: string, start: number, end: number): Uint8Array {
  const tiny = getSdf()
  const pbf = new PbfWriter()

  pbf.writeMessage(
    GLYPHS_STACKS,
    (_obj, stackPbf) => {
      stackPbf.writeStringField(STACK_NAME, fontstack)
      stackPbf.writeStringField(STACK_RANGE, `${start}-${end}`)
      for (let id = start; id <= end; id++) {
        // Skip control characters.
        if (id < 32 || (id >= 127 && id < 160)) continue
        const char = String.fromCodePoint(id)
        const g = tiny.draw(char)
        if (g.glyphAdvance === 0 && g.glyphWidth === 0) continue
        stackPbf.writeMessage(
          STACK_GLYPH,
          (_g, glyphPbf) => {
            glyphPbf.writeVarintField(GLYPH_ID, id)
            if (g.glyphWidth > 0 && g.glyphHeight > 0) {
              glyphPbf.writeBytesField(GLYPH_BITMAP, new Uint8Array(g.data))
              glyphPbf.writeVarintField(GLYPH_WIDTH, g.glyphWidth)
              glyphPbf.writeVarintField(GLYPH_HEIGHT, g.glyphHeight)
            } else {
              glyphPbf.writeVarintField(GLYPH_WIDTH, 0)
              glyphPbf.writeVarintField(GLYPH_HEIGHT, 0)
            }
            glyphPbf.writeSVarintField(GLYPH_LEFT, g.glyphLeft)
            // Convert TinySDF's top-of-glyph-from-top metric to the baseline
            // convention used by the glyph PBF format (same offset MapLibre
            // applies for its built-in local CJK generation).
            glyphPbf.writeSVarintField(GLYPH_TOP, g.glyphTop - 27)
            glyphPbf.writeVarintField(GLYPH_ADVANCE, Math.round(g.glyphAdvance))
          },
          null,
        )
      }
    },
    null,
  )

  return pbf.finish()
}

/** Register the local-glyphs:// protocol. Call once before creating maps. */
export function registerLocalGlyphs(): void {
  maplibregl.addProtocol('local-glyphs', async (params) => {
    // URL shape: local-glyphs://fonts/<fontstack>/<start>-<end>.pbf
    const m = params.url.match(/^local-glyphs:\/\/fonts\/([^/]+)\/(\d+)-(\d+)\.pbf$/)
    if (!m) throw new Error(`Bad local glyph URL: ${params.url}`)
    const fontstack = decodeURIComponent(m[1])
    const start = parseInt(m[2], 10)
    const end = parseInt(m[3], 10)
    const key = `${fontstack}/${start}-${end}`
    let data = cache.get(key)
    if (!data) {
      data = encodeRange(fontstack, start, end)
      cache.set(key, data)
    }
    return { data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer }
  })
}
