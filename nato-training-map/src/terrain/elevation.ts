/**
 * Deterministic fictional heightfield for the Maplewood Training Area.
 *
 * The training area is entirely invented: elevation is a smooth analytic
 * surface (blended gaussian hills + low-amplitude value noise) so that the
 * same terrain is generated on every machine with no downloads, and the app
 * works fully offline. Elevations are metres above sea level.
 */

// Bounding box of the fictional training area (rural eastern-Ontario-like
// terrain, ~22 km x 16 km).
export const AREA = {
  west: -76.46,
  south: 45.48,
  east: -76.18,
  north: 45.625,
}

export const AREA_CENTER: [number, number] = [
  (AREA.west + AREA.east) / 2,
  (AREA.south + AREA.north) / 2,
]

/** Deterministic 32-bit PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash2(ix: number, iy: number): number {
  let h = (ix * 374761393 + iy * 668265263) ^ 0x5bf03635
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Smooth value noise in [0,1] over an arbitrary xy plane. */
export function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = smoothstep(x - ix)
  const fy = smoothstep(y - iy)
  const v00 = hash2(ix, iy)
  const v10 = hash2(ix + 1, iy)
  const v01 = hash2(ix, iy + 1)
  const v11 = hash2(ix + 1, iy + 1)
  return (
    v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy
  )
}

/** Fractal (3-octave) value noise in [0,1]. */
export function fbm(x: number, y: number): number {
  return (
    (valueNoise(x, y) * 4 + valueNoise(x * 2 + 17.3, y * 2 + 9.1) * 2 + valueNoise(x * 4 + 41.7, y * 4 + 23.9)) /
    7
  )
}

interface Hill {
  lng: number
  lat: number
  height: number
  radLng: number
  radLat: number
}

// Named fictional high ground. Positions/sizes were tuned by hand.
const HILLS: Hill[] = [
  { lng: -76.408, lat: 45.596, height: 118, radLng: 0.030, radLat: 0.022 }, // Mount Cartier
  { lng: -76.335, lat: 45.565, height: 86, radLng: 0.024, radLat: 0.017 },  // Hill 210
  { lng: -76.252, lat: 45.598, height: 96, radLng: 0.026, radLat: 0.02 },   // Birchback Ridge
  { lng: -76.222, lat: 45.522, height: 72, radLng: 0.022, radLat: 0.016 },  // Hill 195
  { lng: -76.38, lat: 45.508, height: 64, radLng: 0.028, radLat: 0.014 },   // Southwood Heights
  { lng: -76.30, lat: 45.612, height: 58, radLng: 0.03, radLat: 0.012 },
]

const BASE_ELEVATION = 130 // valley floor, metres ASL

/**
 * Elevation (m ASL) at a lng/lat. Smooth, deterministic, fictional.
 */
export function elevationAt(lng: number, lat: number): number {
  let z = BASE_ELEVATION

  // A gentle regional tilt rising to the northwest.
  z += (AREA.north - lat) * -140 + (lng - AREA.west) * -90

  for (const h of HILLS) {
    const dx = (lng - h.lng) / h.radLng
    const dy = (lat - h.lat) / h.radLat
    z += h.height * Math.exp(-(dx * dx + dy * dy))
  }

  // Rolling micro-relief.
  z += (fbm(lng * 220, lat * 220) - 0.5) * 26

  // Carve the Alder River valley (a smooth SW-NE trough).
  const river = riverAxisDistance(lng, lat)
  z -= 24 * Math.exp(-(river * river) / (0.012 * 0.012))

  return Math.round(z * 10) / 10
}

/**
 * Signed-ish distance (degrees, approx) from the fictional Alder River axis,
 * used both to carve the valley and to route the river geometry.
 */
export function riverAxisDistance(lng: number, lat: number): number {
  // River axis: lat = f(lng), a lazy sine from SW to NE.
  const t = (lng - AREA.west) / (AREA.east - AREA.west)
  const axisLat = 45.515 + t * 0.075 + Math.sin(t * Math.PI * 2.2) * 0.012
  return lat - axisLat
}

export function riverAxisLat(lng: number): number {
  const t = (lng - AREA.west) / (AREA.east - AREA.west)
  return 45.515 + t * 0.075 + Math.sin(t * Math.PI * 2.2) * 0.012
}
