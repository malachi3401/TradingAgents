import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { toMgrs, prettyMgrs, formatLatLon } from '../utils/coords'
import { elevationAt } from '../terrain/elevation'
import { mapHandle, sampleProfile } from '../map/MapView'

export default function StatusBar() {
  const cursor = useStore((s) => s.cursor)
  const tool = useStore((s) => s.tool)
  const measure = useStore((s) => s.measure)
  const [zoom, setZoom] = useState(12)

  useEffect(() => {
    const t = setInterval(() => {
      const m = mapHandle.current
      if (m) setZoom(m.getZoom())
    }, 500)
    return () => clearInterval(t)
  }, [])

  // Approximate map scale denominator at current zoom/latitude.
  const scaleDen = useMemo(() => {
    const lat = cursor?.lat ?? 45.55
    const metersPerPixel = (156543.03 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
    return Math.round(metersPerPixel / 0.00028) // 0.28 mm/px standard
  }, [zoom, cursor])

  const mgrs = cursor ? prettyMgrs(toMgrs(cursor.lng, cursor.lat)) : '—'
  const latlon = cursor ? formatLatLon(cursor.lng, cursor.lat) : '—'
  const elev = cursor ? `${elevationAt(cursor.lng, cursor.lat).toFixed(0)} m` : '—'

  const showProfile = tool === 'elevation-profile' && measure.points.length === 2

  return (
    <div className="border-t border-edge bg-panel">
      {showProfile && <ProfileChart />}
      <div className="flex items-center gap-4 px-3 py-1 font-mono text-[11px] text-gray-400">
        <span className="text-gray-500">MGRS</span>
        <span className="min-w-[190px] text-gray-200">{mgrs}</span>
        <span className="text-gray-500">LAT/LON</span>
        <span className="min-w-[210px]">{latlon}</span>
        <span className="text-gray-500">ELEV</span>
        <span className="min-w-[52px]">{elev}</span>
        <span className="text-gray-500">SCALE</span>
        <span>1:{scaleDen.toLocaleString()}</span>
        <div className="flex-1" />
        {measure.result && (
          <span className="rounded bg-panel3 px-2 py-0.5 text-amber">
            {tool.replace('measure-', '').replace('-', ' ')}: {measure.result === 'profile-ready' ? 'see profile' : measure.result}
          </span>
        )}
        <span className="text-gray-600">FICTIONAL TRAINING AREA — EDUCATIONAL USE</span>
      </div>
    </div>
  )
}

function ProfileChart() {
  const measure = useStore((s) => s.measure)
  const [a, b] = measure.points
  const { samples, totalKm } = useMemo(() => sampleProfile(a, b), [a, b])

  const w = 640
  const h = 90
  const pad = 28
  const zs = samples.map((s) => s.z)
  const zMin = Math.floor(Math.min(...zs) / 10) * 10
  const zMax = Math.ceil(Math.max(...zs) / 10) * 10 || zMin + 10
  const x = (d: number) => pad + (d / totalKm) * (w - pad * 2)
  const y = (z: number) => h - 18 - ((z - zMin) / Math.max(zMax - zMin, 1)) * (h - 30)
  const path = samples.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(s.d).toFixed(1)},${y(s.z).toFixed(1)}`).join(' ')

  return (
    <div className="flex items-center gap-3 border-b border-edge px-3 py-1.5">
      <svg width={w} height={h} className="shrink-0">
        <rect x={0} y={0} width={w} height={h} fill="#1b2129" rx={4} />
        <path d={`${path} L${x(totalKm)},${h - 18} L${x(0)},${h - 18} Z`} fill="rgba(106,168,79,0.25)" />
        <path d={path} stroke="#6aa84f" strokeWidth={1.8} fill="none" />
        <text x={pad} y={12} fill="#8896a5" fontSize={10} fontFamily="monospace">{zMax} m</text>
        <text x={pad} y={h - 6} fill="#8896a5" fontSize={10} fontFamily="monospace">{zMin} m</text>
        <text x={w - pad} y={h - 6} fill="#8896a5" fontSize={10} fontFamily="monospace" textAnchor="end">
          {totalKm.toFixed(2)} km
        </text>
      </svg>
      <div className="text-[11px] leading-snug text-gray-400">
        Elevation profile (fictional heightfield).
        <br />
        Max {Math.max(...zs).toFixed(0)} m · Min {Math.min(...zs).toFixed(0)} m · Gain{' '}
        {samples.reduce((acc, s, i) => (i > 0 && s.z > samples[i - 1].z ? acc + s.z - samples[i - 1].z : acc), 0).toFixed(0)}{' '}
        m
      </div>
    </div>
  )
}
