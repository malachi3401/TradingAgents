/**
 * MGRS / UTM grid overlay. Generates 1 km (or 10 km when zoomed out) grid
 * lines in the local UTM zone across the current viewport, with easting /
 * northing labels in the conventional two-digit principal style.
 */

import type { LngLatBounds } from 'maplibre-gl'
import { latLonToUtm, utmToLatLon, utmZone } from '../utils/coords'

export function buildGrid(bounds: LngLatBounds, zoom: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  const spacing = zoom >= 12 ? 1000 : zoom >= 9.5 ? 10000 : 100000
  const west = bounds.getWest()
  const east = bounds.getEast()
  const south = bounds.getSouth()
  const north = bounds.getNorth()
  const zone = utmZone((west + east) / 2)

  const corners = [
    latLonToUtm(west, south, zone),
    latLonToUtm(east, south, zone),
    latLonToUtm(west, north, zone),
    latLonToUtm(east, north, zone),
  ]
  const minE = Math.floor(Math.min(...corners.map((c) => c.easting)) / spacing) * spacing
  const maxE = Math.ceil(Math.max(...corners.map((c) => c.easting)) / spacing) * spacing
  const minN = Math.floor(Math.min(...corners.map((c) => c.northing)) / spacing) * spacing
  const maxN = Math.ceil(Math.max(...corners.map((c) => c.northing)) / spacing) * spacing

  // Guard against absurd extents when zoomed way out.
  if ((maxE - minE) / spacing > 80 || (maxN - minN) / spacing > 80) {
    return { type: 'FeatureCollection', features: [] }
  }

  const label = (value: number) => {
    // Principal digits: e.g. easting 3 46 000 -> "46"; 10km grid -> "4".
    if (spacing >= 100000) return String(Math.round(value / 100000))
    const km = Math.round(value / 1000)
    return String(km % 100).padStart(2, '0')
  }

  for (let e = minE; e <= maxE; e += spacing) {
    const pts: [number, number][] = []
    for (let n = minN; n <= maxN; n += spacing / 4) {
      const { lng, lat } = utmToLatLon(e, n, zone)
      pts.push([lng, lat])
    }
    features.push({
      type: 'Feature',
      properties: { axis: 'e', label: label(e), principal: (e / spacing) % 10 === 0 },
      geometry: { type: 'LineString', coordinates: pts },
    })
  }
  for (let n = minN; n <= maxN; n += spacing) {
    const pts: [number, number][] = []
    for (let e = minE; e <= maxE; e += spacing / 4) {
      const { lng, lat } = utmToLatLon(e, n, zone)
      pts.push([lng, lat])
    }
    features.push({
      type: 'Feature',
      properties: { axis: 'n', label: label(n), principal: (n / spacing) % 10 === 0 },
      geometry: { type: 'LineString', coordinates: pts },
    })
  }
  return { type: 'FeatureCollection', features }
}
