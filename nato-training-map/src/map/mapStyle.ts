/**
 * MapLibre style factory. All four base-map looks (1:25k topo, simulated
 * imagery, hybrid, contour-only) are rendered from the same procedural
 * GeoJSON sources with different paint palettes — no external tiles, fully
 * offline, and the "satellite" view is simulated imagery of the fictional
 * terrain rather than real-world photography.
 */

import type { StyleSpecification } from 'maplibre-gl'
import type { MapStyleId, TerrainLayerKey } from '../types'
import { getTerrain } from '../terrain/generate'
import { LOCAL_GLYPHS_URL } from './localGlyphs'

interface Palette {
  background: string
  contour: string
  contourIndex: string
  water: string
  waterLine: string
  marsh: string
  forest: string
  open: string
  roadPrimary: string
  roadPrimaryCasing: string
  roadSecondary: string
  trail: string
  rail: string
  building: string
  range: string
  label: string
  labelHalo: string
}

const PALETTES: Record<MapStyleId, Palette> = {
  topo: {
    background: '#f4f0e4',
    contour: '#c8823c',
    contourIndex: '#a5641f',
    water: '#a8cfe0',
    waterLine: '#4f93b8',
    marsh: '#9fc4b8',
    forest: '#c4dcb0',
    open: '#efe9d2',
    roadPrimary: '#e8b04a',
    roadPrimaryCasing: '#7a5a1e',
    roadSecondary: '#ffffff',
    trail: '#7a6248',
    rail: '#444444',
    building: '#7d6f5c',
    range: '#c05050',
    label: '#3d3527',
    labelHalo: '#f4f0e4',
  },
  satellite: {
    background: '#39412e',
    contour: 'rgba(0,0,0,0)',
    contourIndex: 'rgba(0,0,0,0)',
    water: '#1d3a4a',
    waterLine: '#2b566b',
    marsh: '#3d5240',
    forest: '#2c3f24',
    open: '#5d6141',
    roadPrimary: '#8b8574',
    roadPrimaryCasing: '#4b473c',
    roadSecondary: '#77715f',
    trail: '#6a6350',
    rail: '#3c3c38',
    building: '#8f8677',
    range: '#7a6a4a',
    label: '#e8e4d8',
    labelHalo: 'rgba(20,24,16,0.8)',
  },
  hybrid: {
    background: '#39412e',
    contour: 'rgba(255,255,255,0.12)',
    contourIndex: 'rgba(255,255,255,0.2)',
    water: '#1d3a4a',
    waterLine: '#3f7d9e',
    marsh: '#3d5240',
    forest: '#2c3f24',
    open: '#5d6141',
    roadPrimary: '#e8b04a',
    roadPrimaryCasing: '#4b473c',
    roadSecondary: '#c9c4b4',
    trail: '#b09a72',
    rail: '#9a9a94',
    building: '#c9beab',
    range: '#e07a5f',
    label: '#f2eee2',
    labelHalo: 'rgba(20,24,16,0.9)',
  },
  contour: {
    background: '#ffffff',
    contour: '#b87333',
    contourIndex: '#8a4f1d',
    water: '#d5e8f2',
    waterLine: '#7ab2d0',
    marsh: 'rgba(0,0,0,0)',
    forest: 'rgba(0,0,0,0)',
    open: 'rgba(0,0,0,0)',
    roadPrimary: '#bbbbbb',
    roadPrimaryCasing: '#999999',
    roadSecondary: '#cccccc',
    trail: '#c9bfae',
    rail: '#aaaaaa',
    building: '#bbb3a4',
    range: '#d0a0a0',
    label: '#5a5248',
    labelHalo: '#ffffff',
  },
}

/** Map style-layer ids to the user-facing terrain toggle that controls them. */
export const LAYER_TOGGLE_MAP: Record<string, TerrainLayerKey> = {
  'terrain-contours': 'contours',
  'terrain-contours-index': 'contours',
  'terrain-contour-labels': 'contours',
  'terrain-water': 'water',
  'terrain-rivers': 'water',
  'terrain-marsh': 'marsh',
  'terrain-forest': 'forest',
  'terrain-open': 'openGround',
  'terrain-roads-casing': 'roads',
  'terrain-roads': 'roads',
  'terrain-roads-secondary': 'roads',
  'terrain-trails': 'trails',
  'terrain-rail': 'railways',
  'terrain-rail-ticks': 'railways',
  'terrain-bridges': 'bridges',
  'terrain-buildings': 'buildings',
  'terrain-ranges': 'ranges',
  'terrain-ranges-outline': 'ranges',
  'terrain-labels': 'labels',
  'terrain-road-labels': 'labels',
}

export function buildMapStyle(styleId: MapStyleId): StyleSpecification {
  const t = getTerrain()
  const p = PALETTES[styleId]

  const style: StyleSpecification = {
    version: 8,
    name: `maplewood-${styleId}`,
    glyphs: LOCAL_GLYPHS_URL,
    sources: {
      'terrain-contours': { type: 'geojson', data: t.contours as any },
      'terrain-contours-index': { type: 'geojson', data: t.contoursIndex as any },
      'terrain-water': { type: 'geojson', data: t.water as any },
      'terrain-rivers': { type: 'geojson', data: t.rivers as any },
      'terrain-marsh': { type: 'geojson', data: t.marsh as any },
      'terrain-forest': { type: 'geojson', data: t.forest as any },
      'terrain-open': { type: 'geojson', data: t.openGround as any },
      'terrain-roads': { type: 'geojson', data: t.roads as any },
      'terrain-trails': { type: 'geojson', data: t.trails as any },
      'terrain-rail': { type: 'geojson', data: t.railways as any },
      'terrain-bridges': { type: 'geojson', data: t.bridges as any },
      'terrain-buildings': { type: 'geojson', data: t.buildings as any },
      'terrain-ranges': { type: 'geojson', data: t.ranges as any },
      'terrain-labels': { type: 'geojson', data: t.labels as any },
      'terrain-boundary': { type: 'geojson', data: t.boundary as any },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': p.background } },
      {
        id: 'terrain-open',
        type: 'fill',
        source: 'terrain-open',
        paint: { 'fill-color': p.open, 'fill-opacity': styleId === 'contour' ? 0 : 0.7 },
      },
      {
        id: 'terrain-forest',
        type: 'fill',
        source: 'terrain-forest',
        paint: { 'fill-color': p.forest, 'fill-opacity': styleId === 'contour' ? 0 : 0.85 },
      },
      {
        id: 'terrain-marsh',
        type: 'fill',
        source: 'terrain-marsh',
        paint: { 'fill-color': p.marsh, 'fill-opacity': styleId === 'contour' ? 0 : 0.6 },
      },
      {
        id: 'terrain-contours',
        type: 'line',
        source: 'terrain-contours',
        paint: { 'line-color': p.contour, 'line-width': 0.7, 'line-opacity': 0.75 },
      },
      {
        id: 'terrain-contours-index',
        type: 'line',
        source: 'terrain-contours-index',
        paint: { 'line-color': p.contourIndex, 'line-width': 1.4, 'line-opacity': 0.85 },
      },
      {
        id: 'terrain-contour-labels',
        type: 'symbol',
        source: 'terrain-contours-index',
        layout: {
          'symbol-placement': 'line',
          'text-field': ['to-string', ['get', 'elev']],
          'text-font': ['Open Sans Regular'],
          'text-size': 10,
        },
        paint: { 'text-color': p.contourIndex, 'text-halo-color': p.background, 'text-halo-width': 1 },
      },
      {
        id: 'terrain-water',
        type: 'fill',
        source: 'terrain-water',
        paint: { 'fill-color': p.water, 'fill-outline-color': p.waterLine },
      },
      {
        id: 'terrain-rivers',
        type: 'line',
        source: 'terrain-rivers',
        paint: {
          'line-color': p.waterLine,
          'line-width': ['case', ['==', ['get', 'major'], 1], 2.5, 1.2],
        },
      },
      {
        id: 'terrain-rail',
        type: 'line',
        source: 'terrain-rail',
        paint: { 'line-color': p.rail, 'line-width': 1.6 },
      },
      {
        id: 'terrain-rail-ticks',
        type: 'line',
        source: 'terrain-rail',
        paint: { 'line-color': p.rail, 'line-width': 5, 'line-dasharray': [0.12, 3] },
      },
      {
        id: 'terrain-trails',
        type: 'line',
        source: 'terrain-trails',
        paint: { 'line-color': p.trail, 'line-width': 1.1, 'line-dasharray': [3, 2] },
      },
      {
        id: 'terrain-roads-casing',
        type: 'line',
        source: 'terrain-roads',
        filter: ['==', ['get', 'class'], 'primary'],
        paint: { 'line-color': p.roadPrimaryCasing, 'line-width': 4.6 },
      },
      {
        id: 'terrain-roads',
        type: 'line',
        source: 'terrain-roads',
        filter: ['==', ['get', 'class'], 'primary'],
        paint: { 'line-color': p.roadPrimary, 'line-width': 3 },
      },
      {
        id: 'terrain-roads-secondary',
        type: 'line',
        source: 'terrain-roads',
        filter: ['==', ['get', 'class'], 'secondary'],
        paint: { 'line-color': p.roadSecondary, 'line-width': 2, 'line-opacity': 0.95 },
      },
      {
        id: 'terrain-buildings',
        type: 'fill',
        source: 'terrain-buildings',
        paint: { 'fill-color': p.building, 'fill-opacity': 0.9 },
      },
      {
        id: 'terrain-bridges',
        type: 'circle',
        source: 'terrain-bridges',
        paint: {
          'circle-radius': 4,
          'circle-color': p.background,
          'circle-stroke-color': p.rail,
          'circle-stroke-width': 1.6,
        },
      },
      {
        id: 'terrain-ranges',
        type: 'fill',
        source: 'terrain-ranges',
        paint: { 'fill-color': p.range, 'fill-opacity': 0.08 },
      },
      {
        id: 'terrain-ranges-outline',
        type: 'line',
        source: 'terrain-ranges',
        paint: { 'line-color': p.range, 'line-width': 1.5, 'line-dasharray': [4, 2] },
      },
      {
        id: 'terrain-boundary',
        type: 'line',
        source: 'terrain-boundary',
        paint: { 'line-color': p.range, 'line-width': 2.2, 'line-dasharray': [6, 3] },
      },
      {
        id: 'terrain-road-labels',
        type: 'symbol',
        source: 'terrain-roads',
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': 11,
        },
        paint: { 'text-color': p.label, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.4 },
      },
      {
        id: 'terrain-labels',
        type: 'symbol',
        source: 'terrain-labels',
        layout: {
          'text-field': ['get', 'text'],
          'text-font': ['Open Sans Regular'],
          'text-size': ['match', ['get', 'kind'], 'range', 10, 'village', 12, 11],
          'text-letter-spacing': 0.08,
        },
        paint: {
          'text-color': [
            'match',
            ['get', 'kind'],
            'water',
            p.waterLine,
            'range',
            p.range,
            p.label,
          ],
          'text-halo-color': p.labelHalo,
          'text-halo-width': 1.4,
        },
      },
    ],
  }
  return style
}
