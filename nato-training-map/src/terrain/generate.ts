/**
 * Procedural generation of the fictional Maplewood Training Area.
 *
 * Everything here is invented terrain: contours are traced from the analytic
 * heightfield, vegetation from a noise field, and the road/river/village
 * network from hand-tuned control points. Generation is deterministic, so all
 * users see the identical map, and no external tiles or data are required.
 */

import { contours as d3contours } from 'd3-contour'
import * as turf from '@turf/turf'
import {
  AREA,
  elevationAt,
  fbm,
  mulberry32,
  riverAxisLat,
} from './elevation'

type FC = GeoJSON.FeatureCollection

const GRID_W = 220
const GRID_H = 160

function gridToLngLat(x: number, y: number): [number, number] {
  return [
    AREA.west + (x / (GRID_W - 1)) * (AREA.east - AREA.west),
    AREA.north - (y / (GRID_H - 1)) * (AREA.north - AREA.south),
  ]
}

function sampleField(fn: (lng: number, lat: number) => number): number[] {
  const values = new Array<number>(GRID_W * GRID_H)
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const [lng, lat] = gridToLngLat(x, y)
      values[y * GRID_W + x] = fn(lng, lat)
    }
  }
  return values
}

function contourToFeatures(
  field: number[],
  thresholds: number[],
  props: (v: number) => Record<string, unknown>,
  asPolygon: boolean,
): GeoJSON.Feature[] {
  const gen = d3contours().size([GRID_W, GRID_H]).thresholds(thresholds)
  const out: GeoJSON.Feature[] = []
  for (const c of gen(field)) {
    const rings: [number, number][][] = []
    for (const poly of c.coordinates) {
      for (const ring of poly) {
        rings.push(ring.map(([x, y]) => gridToLngLat(x, y)))
      }
    }
    if (rings.length === 0) continue
    if (asPolygon) {
      for (const poly of c.coordinates) {
        const mapped = poly.map((ring) => ring.map(([x, y]) => gridToLngLat(x, y)))
        out.push({
          type: 'Feature',
          properties: props(c.value),
          geometry: { type: 'Polygon', coordinates: mapped },
        })
      }
    } else {
      out.push({
        type: 'Feature',
        properties: props(c.value),
        geometry: { type: 'MultiLineString', coordinates: rings },
      })
    }
  }
  return out
}

// ---------------------------------------------------------------------------

export interface TerrainData {
  contours: FC
  contoursIndex: FC
  water: FC // lakes + wide river polygons
  rivers: FC // river/stream centrelines
  marsh: FC
  forest: FC
  openGround: FC
  roads: FC
  trails: FC
  railways: FC
  bridges: FC
  buildings: FC
  ranges: FC
  labels: FC
  boundary: FC
}

let cached: TerrainData | null = null

export function getTerrain(): TerrainData {
  if (!cached) cached = generateTerrain()
  return cached
}

function fc(features: GeoJSON.Feature[]): FC {
  return { type: 'FeatureCollection', features }
}

function smoothLine(points: [number, number][], sharpness = 0.85): GeoJSON.Feature {
  const line = turf.lineString(points)
  try {
    return turf.bezierSpline(line, { resolution: 4000, sharpness })
  } catch {
    return line
  }
}

export function generateTerrain(): TerrainData {
  const rand = mulberry32(20260709)

  // --- Elevation contours -------------------------------------------------
  const elevField = sampleField(elevationAt)
  const thresholds: number[] = []
  for (let v = 90; v <= 280; v += 10) thresholds.push(v)
  const contourLines = contourToFeatures(
    elevField,
    thresholds.filter((v) => v % 50 !== 0),
    (v) => ({ elev: v, index: 0 }),
    false,
  )
  const indexLines = contourToFeatures(
    elevField,
    thresholds.filter((v) => v % 50 === 0),
    (v) => ({ elev: v, index: 1 }),
    false,
  )

  // --- Lakes: closed basins below the local water table -------------------
  const lakeSpecs = [
    { lng: -76.427, lat: 45.556, r: 0.011, name: 'Loon Lake' },
    { lng: -76.300, lat: 45.545, r: 0.008, name: 'Bass Lake' },
    { lng: -76.207, lat: 45.585, r: 0.0135, name: 'Whitetail Lake' },
    { lng: -76.362, lat: 45.606, r: 0.006, name: 'Kettle Pond' },
  ]
  const lakes: GeoJSON.Feature[] = lakeSpecs.map((l) => {
    const pts: [number, number][] = []
    const n = 42
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2
      const wobble = 1 + (fbm(Math.cos(a) * 3 + l.lng * 90, Math.sin(a) * 3 + l.lat * 90) - 0.5) * 0.7
      pts.push([
        l.lng + Math.cos(a) * l.r * wobble,
        l.lat + Math.sin(a) * l.r * 0.72 * wobble,
      ])
    }
    pts[pts.length - 1] = pts[0]
    return turf.polygon([pts], { waterName: l.name, type: 'lake' })
  })

  // --- Alder River + tributaries ------------------------------------------
  const riverPts: [number, number][] = []
  for (let i = 0; i <= 40; i++) {
    const lng = AREA.west + (i / 40) * (AREA.east - AREA.west)
    riverPts.push([lng, riverAxisLat(lng)])
  }
  const alder = smoothLine(riverPts)
  alder.properties = { waterName: 'Alder River', major: 1 }

  const tribSpecs: [number, number][][] = [
    [
      [-76.427, 45.556], // out of Loon Lake
      [-76.41, 45.545],
      [-76.395, 45.532],
      [-76.383, riverAxisLat(-76.383)],
    ],
    [
      [-76.300, 45.545],
      [-76.297, 45.552],
      [-76.29, riverAxisLat(-76.29) + 0.001],
    ],
    [
      [-76.207, 45.585],
      [-76.222, 45.578],
      [-76.235, riverAxisLat(-76.235)],
    ],
    [
      [-76.26, 45.628],
      [-76.262, 45.61],
      [-76.256, riverAxisLat(-76.256)],
    ],
  ]
  const tribs = tribSpecs.map((pts, i) => {
    const f = smoothLine(pts)
    f.properties = { waterName: `Creek ${i + 1}`, major: 0 }
    return f
  })

  const riverPoly = turf.buffer(alder, 0.045, { units: 'kilometers' })
  if (riverPoly) riverPoly.properties = { waterName: 'Alder River', type: 'river' }

  // --- Marshes along low shorelines ---------------------------------------
  const marshes: GeoJSON.Feature[] = []
  for (const [lakeIdx, buf] of [
    [0, 0.35],
    [2, 0.5],
  ] as [number, number][]) {
    const ring = turf.buffer(lakes[lakeIdx], buf, { units: 'kilometers' })
    if (ring) {
      const clipped = turf.difference(turf.featureCollection([ring, lakes[lakeIdx]] as any))
      if (clipped) {
        clipped.properties = { type: 'marsh' }
        marshes.push(clipped as GeoJSON.Feature)
      }
    }
  }
  // A broad sedge fen in the SE lowland.
  marshes.push(
    turf.polygon(
      [
        [
          [-76.245, 45.497],
          [-76.222, 45.503],
          [-76.208, 45.498],
          [-76.212, 45.488],
          [-76.238, 45.487],
          [-76.245, 45.497],
        ],
      ],
      { type: 'marsh', name: 'Blackwater Fen' },
    ),
  )

  // --- Forest from a vegetation noise field --------------------------------
  const vegField = sampleField((lng, lat) => {
    let v = fbm(lng * 140 + 5.7, lat * 140 + 2.9)
    // Denser woods on higher ground, thinner along the river valley.
    const z = elevationAt(lng, lat)
    v += (z - 150) / 400
    return v
  })
  const forest = contourToFeatures(vegField, [0.52], () => ({ type: 'forest' }), true)

  // --- Open ground (meadow/fields) = mid-low vegetation --------------------
  const openField = sampleField((lng, lat) => 1 - fbm(lng * 140 + 5.7, lat * 140 + 2.9))
  const openGround = contourToFeatures(openField, [0.56], () => ({ type: 'open' }), true)

  // --- Road network ---------------------------------------------------------
  // Route 7 (paved E-W), Range Road (paved N-S), plus gravel connectors.
  const roadSpecs: { pts: [number, number][]; cls: string; name: string }[] = [
    {
      name: 'Route 7',
      cls: 'primary',
      pts: [
        [-76.46, 45.538],
        [-76.42, 45.532],
        [-76.372, 45.541],
        [-76.31, 45.536],
        [-76.262, 45.547],
        [-76.21, 45.542],
        [-76.18, 45.548],
      ],
    },
    {
      name: 'Range Road',
      cls: 'primary',
      pts: [
        [-76.318, 45.48],
        [-76.312, 45.51],
        [-76.31, 45.536],
        [-76.318, 45.566],
        [-76.308, 45.598],
        [-76.312, 45.625],
      ],
    },
    {
      name: 'Cartier Road',
      cls: 'secondary',
      pts: [
        [-76.42, 45.532],
        [-76.415, 45.56],
        [-76.4, 45.585],
        [-76.383, 45.607],
        [-76.36, 45.625],
      ],
    },
    {
      name: 'Whitetail Road',
      cls: 'secondary',
      pts: [
        [-76.262, 45.547],
        [-76.243, 45.566],
        [-76.225, 45.58],
        [-76.203, 45.6],
        [-76.19, 45.625],
      ],
    },
    {
      name: 'Fen Road',
      cls: 'secondary',
      pts: [
        [-76.21, 45.542],
        [-76.222, 45.52],
        [-76.23, 45.5],
        [-76.245, 45.48],
      ],
    },
    {
      name: 'Southwood Road',
      cls: 'secondary',
      pts: [
        [-76.372, 45.541],
        [-76.378, 45.52],
        [-76.39, 45.5],
        [-76.4, 45.482],
      ],
    },
  ]
  const roads = roadSpecs.map((r) => {
    const f = smoothLine(r.pts, 0.7)
    f.properties = { name: r.name, class: r.cls }
    return f
  })

  // --- Trails: wandering connectors seeded from a PRNG ----------------------
  const trails: GeoJSON.Feature[] = []
  const trailSeeds: [number, number][][] = [
    [
      [-76.4, 45.585],
      [-76.37, 45.59],
      [-76.34, 45.6],
      [-76.318, 45.598],
    ],
    [
      [-76.415, 45.56],
      [-76.39, 45.555],
      [-76.36, 45.562],
      [-76.335, 45.565],
      [-76.318, 45.566],
    ],
    [
      [-76.312, 45.51],
      [-76.29, 45.512],
      [-76.265, 45.52],
      [-76.24, 45.518],
      [-76.222, 45.52],
    ],
    [
      [-76.243, 45.566],
      [-76.25, 45.585],
      [-76.24, 45.6],
      [-76.225, 45.61],
    ],
    [
      [-76.39, 45.5],
      [-76.36, 45.495],
      [-76.33, 45.492],
      [-76.318, 45.48],
    ],
  ]
  trailSeeds.forEach((pts, i) => {
    const jittered = pts.map(
      ([lng, lat]) =>
        [lng + (rand() - 0.5) * 0.004, lat + (rand() - 0.5) * 0.003] as [number, number],
    )
    const f = smoothLine(jittered)
    f.properties = { name: `Trail ${String.fromCharCode(65 + i)}`, class: 'trail' }
    trails.push(f)
  })

  // --- Railway: single line skirting the south -------------------------------
  const railway = smoothLine(
    [
      [-76.46, 45.502],
      [-76.4, 45.494],
      [-76.34, 45.49],
      [-76.28, 45.492],
      [-76.22, 45.486],
      [-76.18, 45.49],
    ],
    0.6,
  )
  railway.properties = { name: 'Valley Line', class: 'rail' }

  // --- Bridges: where roads/rails cross watercourses -------------------------
  const bridges: GeoJSON.Feature[] = []
  const watercourses = [alder, ...tribs]
  for (const road of [...roads, railway]) {
    for (const w of watercourses) {
      const hits = turf.lineIntersect(road as any, w as any)
      for (const h of hits.features) {
        bridges.push(
          turf.point(h.geometry.coordinates as [number, number], {
            name: 'Bridge',
            over: (w.properties as any).waterName,
            carries: (road.properties as any).name,
          }),
        )
      }
    }
  }

  // --- Training villages (clusters of simple buildings) ----------------------
  const buildings: GeoJSON.Feature[] = []
  const villages = [
    { lng: -76.352, lat: 45.5455, n: 14, name: 'Village NORTHOLT' },
    { lng: -76.2335, lat: 45.5655, n: 10, name: 'Village KESTREL' },
  ]
  for (const v of villages) {
    for (let i = 0; i < v.n; i++) {
      const dx = (rand() - 0.5) * 0.006
      const dy = (rand() - 0.5) * 0.004
      const w = 0.0004 + rand() * 0.0004
      const h = 0.00025 + rand() * 0.00025
      const cx = v.lng + dx
      const cy = v.lat + dy
      buildings.push(
        turf.polygon(
          [
            [
              [cx - w, cy - h],
              [cx + w, cy - h],
              [cx + w, cy + h],
              [cx - w, cy + h],
              [cx - w, cy - h],
            ],
          ],
          { village: v.name },
        ),
      )
    }
  }

  // --- Live-fire ranges (marked rectangles, fictional) -----------------------
  const rangeSpecs = [
    { lng: -76.352, lat: 45.503, w: 0.012, h: 0.008, name: 'RANGE 1 — Small Arms' },
    { lng: -76.33, lat: 45.6, w: 0.014, h: 0.009, name: 'RANGE 3 — Support Weapons' },
    { lng: -76.268, lat: 45.6075, w: 0.01, h: 0.007, name: 'RANGE 5 — Grenade' },
  ]
  const ranges = rangeSpecs.map((r) =>
    turf.polygon(
      [
        [
          [r.lng - r.w, r.lat - r.h],
          [r.lng + r.w, r.lat - r.h],
          [r.lng + r.w, r.lat + r.h],
          [r.lng - r.w, r.lat + r.h],
          [r.lng - r.w, r.lat - r.h],
        ],
      ],
      { name: r.name, type: 'range' },
    ),
  )

  // --- Map labels -------------------------------------------------------------
  const labels: GeoJSON.Feature[] = [
    turf.point([-76.408, 45.596], { text: 'MOUNT CARTIER\n248', kind: 'hill' }),
    turf.point([-76.335, 45.565], { text: 'HILL 210', kind: 'hill' }),
    turf.point([-76.252, 45.598], { text: 'BIRCHBACK RIDGE\n226', kind: 'hill' }),
    turf.point([-76.222, 45.522], { text: 'HILL 195', kind: 'hill' }),
    turf.point([-76.38, 45.508], { text: 'SOUTHWOOD HEIGHTS', kind: 'hill' }),
    ...lakeSpecs.map((l) => turf.point([l.lng, l.lat], { text: l.name, kind: 'water' })),
    turf.point([-76.31, 45.527], { text: 'ALDER RIVER', kind: 'water' }),
    ...villages.map((v) => turf.point([v.lng, v.lat + 0.004], { text: v.name, kind: 'village' })),
    ...rangeSpecs.map((r) => turf.point([r.lng, r.lat], { text: r.name, kind: 'range' })),
    turf.point([-76.228, 45.4935], { text: 'BLACKWATER FEN', kind: 'marsh' }),
  ]

  // --- Training area boundary ---------------------------------------------------
  const boundary = turf.polygon(
    [
      [
        [AREA.west + 0.005, AREA.south + 0.005],
        [AREA.east - 0.005, AREA.south + 0.005],
        [AREA.east - 0.005, AREA.north - 0.005],
        [AREA.west + 0.005, AREA.north - 0.005],
        [AREA.west + 0.005, AREA.south + 0.005],
      ],
    ],
    { name: 'MAPLEWOOD TRAINING AREA (FICTIONAL)' },
  )

  return {
    contours: fc(contourLines),
    contoursIndex: fc(indexLines),
    water: fc([...lakes, ...(riverPoly ? [riverPoly as GeoJSON.Feature] : [])]),
    rivers: fc([alder, ...tribs]),
    marsh: fc(marshes),
    forest: fc(forest),
    openGround: fc(openGround),
    roads: fc(roads),
    trails: fc(trails),
    railways: fc([railway]),
    bridges: fc(bridges),
    buildings: fc(buildings),
    ranges: fc(ranges),
    labels: fc(labels),
    boundary: fc([boundary]),
  }
}
