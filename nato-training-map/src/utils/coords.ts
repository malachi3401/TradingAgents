import * as mgrsLib from 'mgrs'

/** Format a lng/lat pair as an MGRS grid reference (default 10-figure). */
export function toMgrs(lng: number, lat: number, accuracy: 1 | 2 | 3 | 4 | 5 = 5): string {
  try {
    return mgrsLib.forward([lng, lat], accuracy)
  } catch {
    return '—'
  }
}

/** Parse an MGRS string to [lng, lat] (point at cell centre), or null. */
export function fromMgrs(ref: string): [number, number] | null {
  try {
    const cleaned = ref.replace(/\s+/g, '').toUpperCase()
    const [w, s, e, n] = mgrsLib.inverse(cleaned)
    return [(w + e) / 2, (s + n) / 2]
  } catch {
    return null
  }
}

/** Insert conventional spacing into an MGRS string: 18TVR1234567890 -> 18T VR 12345 67890 */
export function prettyMgrs(ref: string): string {
  const m = ref.match(/^(\d{1,2}[C-X])([A-HJ-NP-Z]{2})(\d+)$/)
  if (!m) return ref
  const digits = m[3]
  const half = digits.length / 2
  return `${m[1]} ${m[2]} ${digits.slice(0, half)} ${digits.slice(half)}`
}

export function formatLatLon(lng: number, lat: number): string {
  const hemiLat = lat >= 0 ? 'N' : 'S'
  const hemiLng = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(5)}° ${hemiLat}  ${Math.abs(lng).toFixed(5)}° ${hemiLng}`
}

// ---------------------------------------------------------------------------
// WGS-84 <-> UTM (used to draw the MGRS/UTM grid). Standard Krüger series.
// ---------------------------------------------------------------------------

const A = 6378137.0
const F = 1 / 298.257223563
const K0 = 0.9996
const E2 = F * (2 - F)
const EP2 = E2 / (1 - E2)

export function utmZone(lng: number): number {
  return Math.floor((lng + 180) / 6) + 1
}

export function latLonToUtm(lng: number, lat: number, forcedZone?: number) {
  const zone = forcedZone ?? utmZone(lng)
  const lambda0 = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180)
  const phi = lat * (Math.PI / 180)
  const lambda = lng * (Math.PI / 180)

  const N = A / Math.sqrt(1 - E2 * Math.sin(phi) ** 2)
  const T = Math.tan(phi) ** 2
  const C = EP2 * Math.cos(phi) ** 2
  const Aa = Math.cos(phi) * (lambda - lambda0)

  const M =
    A *
    ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * phi -
      ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * E2 ** 3) / 3072) * Math.sin(6 * phi))

  const easting =
    K0 *
      N *
      (Aa +
        ((1 - T + C) * Aa ** 3) / 6 +
        ((5 - 18 * T + T ** 2 + 72 * C - 58 * EP2) * Aa ** 5) / 120) +
    500000

  let northing =
    K0 *
    (M +
      N *
        Math.tan(phi) *
        (Aa ** 2 / 2 +
          ((5 - T + 9 * C + 4 * C ** 2) * Aa ** 4) / 24 +
          ((61 - 58 * T + T ** 2 + 600 * C - 330 * EP2) * Aa ** 6) / 720))
  if (lat < 0) northing += 10000000

  return { easting, northing, zone }
}

export function utmToLatLon(easting: number, northing: number, zone: number, southern = false) {
  const x = easting - 500000
  const y = southern ? northing - 10000000 : northing

  const M = y / K0
  const mu = M / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256))
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2))

  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu)

  const N1 = A / Math.sqrt(1 - E2 * Math.sin(phi1) ** 2)
  const T1 = Math.tan(phi1) ** 2
  const C1 = EP2 * Math.cos(phi1) ** 2
  const R1 = (A * (1 - E2)) / (1 - E2 * Math.sin(phi1) ** 2) ** 1.5
  const D = x / (N1 * K0)

  const phi =
    phi1 -
    ((N1 * Math.tan(phi1)) / R1) *
      (D ** 2 / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * EP2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * EP2 - 3 * C1 ** 2) * D ** 6) / 720)

  const lambda0 = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180)
  const lambda =
    lambda0 +
    (D - ((1 + 2 * T1 + C1) * D ** 3) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * EP2 + 24 * T1 ** 2) * D ** 5) / 120) /
      Math.cos(phi1)

  return { lng: lambda * (180 / Math.PI), lat: phi * (180 / Math.PI) }
}
