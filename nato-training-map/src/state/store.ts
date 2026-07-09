import { create } from 'zustand'
import {
  createEmptyProject,
  type Bookmark,
  type Feature,
  type GraphicFeature,
  type MapStyleId,
  type OverlayId,
  type Project,
  type SymbolFeature,
  type TerrainLayerKey,
  type ToolId,
  OVERLAY_IDS,
} from '../types'
import type { CatalogEntry } from '../symbols/catalog'

/** Patch accepted by updateFeature — any mutable field of either feature kind. */
export type FeaturePatch = Partial<Omit<SymbolFeature, 'kind'>> &
  Partial<Omit<GraphicFeature, 'kind'>>

let idCounter = 0
export function newId(prefix = 'f'): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.floor(
    Math.random() * 1e6,
  ).toString(36)}`
}

const HISTORY_LIMIT = 100
let transientSnapshot: string | null = null
export const AUTOSAVE_KEY = 'nato-training-map:autosave'
export const FAVOURITES_KEY = 'nato-training-map:favourites'

export interface MeasureState {
  points: [number, number][]
  /** Result text computed by the measure tool. */
  result: string
}

interface AppState {
  project: Project
  /** Undo/redo stacks of serialized project snapshots. */
  past: string[]
  future: string[]

  selectedIds: string[]
  activeOverlay: OverlayId
  tool: ToolId
  /** Palette entry armed for placement (tool === 'place-symbol'). */
  placingSymbol: CatalogEntry | null
  /** Graphic type armed for drawing. */
  placingGraphic: string | null
  drawing: [number, number][]
  measure: MeasureState
  favourites: string[]
  recentSymbols: string[]
  cursor: { lng: number; lat: number } | null
  dirtySince: number

  // --- history -----------------------------------------------------------
  commit: (mutate: (p: Project) => void) => void
  undo: () => void
  redo: () => void
  /** Begin a drag: snapshot now, then apply live updates without history. */
  beginTransient: () => void
  /** End a drag: push the pre-drag snapshot as one undo step. */
  endTransient: () => void
  updateFeatureLive: (id: string, patch: FeaturePatch) => void

  // --- feature operations --------------------------------------------------
  addFeature: (overlay: OverlayId, feature: Feature) => void
  updateFeature: (id: string, patch: FeaturePatch) => void
  moveFeature: (id: string, delta: [number, number]) => void
  deleteFeatures: (ids: string[]) => void
  duplicateFeatures: (ids: string[]) => void
  clipboard: Feature[]
  copy: (ids: string[]) => void
  paste: (at?: [number, number]) => void

  // --- selection / tools ----------------------------------------------------
  select: (ids: string[], additive?: boolean) => void
  setTool: (tool: ToolId) => void
  armSymbol: (entry: CatalogEntry) => void
  armGraphic: (key: string) => void
  setDrawing: (pts: [number, number][]) => void
  setMeasure: (m: MeasureState) => void
  setCursor: (c: { lng: number; lat: number } | null) => void

  // --- overlays / settings ----------------------------------------------------
  setOverlayVisible: (id: OverlayId, visible: boolean) => void
  setOverlayOpacity: (id: OverlayId, opacity: number) => void
  setActiveOverlay: (id: OverlayId) => void
  setMapStyle: (style: MapStyleId) => void
  setTerrainLayer: (key: TerrainLayerKey, on: boolean) => void
  setSetting: <K extends keyof Project['settings']>(key: K, value: Project['settings'][K]) => void
  setProjectName: (name: string) => void

  // --- bookmarks ---------------------------------------------------------------
  addBookmark: (b: Omit<Bookmark, 'id'>) => void
  removeBookmark: (id: string) => void

  // --- favourites / recents -------------------------------------------------------
  toggleFavourite: (key: string) => void
  noteRecent: (key: string) => void

  // --- project I/O ------------------------------------------------------------------
  loadProject: (p: Project) => void
  newProject: () => void
}

export function findFeature(project: Project, id: string): { overlay: OverlayId; feature: Feature } | null {
  for (const oid of OVERLAY_IDS) {
    const f = project.overlays[oid].features.find((f) => f.id === id)
    if (f) return { overlay: oid, feature: f }
  }
  return null
}

function translateFeature(f: Feature, delta: [number, number]): void {
  if (f.kind === 'symbol') {
    f.position = [f.position[0] + delta[0], f.position[1] + delta[1]]
  } else {
    f.coordinates = f.coordinates.map(([x, y]) => [x + delta[0], y + delta[1]])
  }
}

export const useStore = create<AppState>((set, get) => ({
  project: createEmptyProject(),
  past: [],
  future: [],
  selectedIds: [],
  activeOverlay: 'friendly',
  tool: 'select',
  placingSymbol: null,
  placingGraphic: null,
  drawing: [],
  measure: { points: [], result: '' },
  favourites: loadFavourites(),
  recentSymbols: [],
  cursor: null,
  dirtySince: 0,
  clipboard: [],

  commit: (mutate) => {
    const { project, past } = get()
    const snapshot = JSON.stringify(project)
    const next: Project = JSON.parse(snapshot)
    mutate(next)
    set({
      project: next,
      past: [...past.slice(-HISTORY_LIMIT + 1), snapshot],
      future: [],
      dirtySince: Date.now(),
    })
  },

  undo: () => {
    const { past, future, project } = get()
    if (past.length === 0) return
    const prev = past[past.length - 1]
    set({
      project: JSON.parse(prev),
      past: past.slice(0, -1),
      future: [JSON.stringify(project), ...future].slice(0, HISTORY_LIMIT),
      selectedIds: [],
      dirtySince: Date.now(),
    })
  },

  beginTransient: () => {
    transientSnapshot = JSON.stringify(get().project)
  },

  endTransient: () => {
    if (transientSnapshot === null) return
    const snap = transientSnapshot
    transientSnapshot = null
    if (snap === JSON.stringify(get().project)) return // no-op drag
    set((s) => ({
      past: [...s.past.slice(-HISTORY_LIMIT + 1), snap],
      future: [],
      dirtySince: Date.now(),
    }))
  },

  updateFeatureLive: (id, patch) => {
    const next: Project = JSON.parse(JSON.stringify(get().project))
    const hit = findFeature(next, id)
    if (!hit) return
    Object.assign(hit.feature, patch)
    set({ project: next })
  },

  redo: () => {
    const { past, future, project } = get()
    if (future.length === 0) return
    const next = future[0]
    set({
      project: JSON.parse(next),
      future: future.slice(1),
      past: [...past, JSON.stringify(project)].slice(-HISTORY_LIMIT),
      selectedIds: [],
      dirtySince: Date.now(),
    })
  },

  addFeature: (overlay, feature) => {
    get().commit((p) => {
      p.overlays[overlay].features.push(feature)
    })
    set({ selectedIds: [feature.id] })
  },

  updateFeature: (id, patch) => {
    get().commit((p) => {
      const hit = findFeature(p, id)
      if (hit) Object.assign(hit.feature, patch)
    })
  },

  moveFeature: (id, delta) => {
    get().commit((p) => {
      const hit = findFeature(p, id)
      if (hit && !hit.feature.locked) translateFeature(hit.feature, delta)
    })
  },

  deleteFeatures: (ids) => {
    if (ids.length === 0) return
    get().commit((p) => {
      for (const oid of OVERLAY_IDS) {
        p.overlays[oid].features = p.overlays[oid].features.filter(
          (f) => !ids.includes(f.id) || f.locked,
        )
      }
    })
    set({ selectedIds: [] })
  },

  duplicateFeatures: (ids) => {
    const newIds: string[] = []
    get().commit((p) => {
      for (const oid of OVERLAY_IDS) {
        const clones: Feature[] = []
        for (const f of p.overlays[oid].features) {
          if (!ids.includes(f.id)) continue
          const clone: Feature = JSON.parse(JSON.stringify(f))
          clone.id = newId()
          translateFeature(clone, [0.0012, -0.0009])
          newIds.push(clone.id)
          clones.push(clone)
        }
        p.overlays[oid].features.push(...clones)
      }
    })
    set({ selectedIds: newIds })
  },

  copy: (ids) => {
    const { project } = get()
    const items: Feature[] = []
    for (const oid of OVERLAY_IDS) {
      for (const f of project.overlays[oid].features) {
        if (ids.includes(f.id)) items.push(JSON.parse(JSON.stringify(f)))
      }
    }
    set({ clipboard: items })
  },

  paste: (at) => {
    const { clipboard, activeOverlay } = get()
    if (clipboard.length === 0) return
    const newIds: string[] = []
    get().commit((p) => {
      // Paste at cursor: offset everything so the first feature lands at `at`.
      let delta: [number, number] = [0.0012, -0.0009]
      if (at) {
        const first = clipboard[0]
        const origin: [number, number] =
          first.kind === 'symbol' ? first.position : first.coordinates[0]
        delta = [at[0] - origin[0], at[1] - origin[1]]
      }
      for (const item of clipboard) {
        const clone: Feature = JSON.parse(JSON.stringify(item))
        clone.id = newId()
        clone.locked = false
        translateFeature(clone, delta)
        newIds.push(clone.id)
        p.overlays[activeOverlay].features.push(clone)
      }
    })
    set({ selectedIds: newIds })
  },

  select: (ids, additive = false) => {
    const { selectedIds } = get()
    set({ selectedIds: additive ? Array.from(new Set([...selectedIds, ...ids])) : ids })
  },

  setTool: (tool) =>
    set({
      tool,
      drawing: [],
      measure: { points: [], result: '' },
      ...(tool !== 'place-symbol' ? { placingSymbol: null } : {}),
    }),

  armSymbol: (entry) => set({ tool: 'place-symbol', placingSymbol: entry, placingGraphic: null }),

  armGraphic: (key) => set({ placingGraphic: key }),

  setDrawing: (pts) => set({ drawing: pts }),
  setMeasure: (m) => set({ measure: m }),
  setCursor: (c) => set({ cursor: c }),

  setOverlayVisible: (id, visible) =>
    set((s) => ({
      project: {
        ...s.project,
        overlays: { ...s.project.overlays, [id]: { ...s.project.overlays[id], visible } },
      },
    })),

  setOverlayOpacity: (id, opacity) =>
    set((s) => ({
      project: {
        ...s.project,
        overlays: { ...s.project.overlays, [id]: { ...s.project.overlays[id], opacity } },
      },
    })),

  setActiveOverlay: (id) => set({ activeOverlay: id }),

  setMapStyle: (mapStyle) =>
    set((s) => ({ project: { ...s.project, settings: { ...s.project.settings, mapStyle } } })),

  setTerrainLayer: (key, on) =>
    set((s) => ({
      project: {
        ...s.project,
        settings: {
          ...s.project.settings,
          terrainLayers: { ...s.project.settings.terrainLayers, [key]: on },
        },
      },
    })),

  setSetting: (key, value) =>
    set((s) => ({ project: { ...s.project, settings: { ...s.project.settings, [key]: value } } })),

  setProjectName: (name) => set((s) => ({ project: { ...s.project, name } })),

  addBookmark: (b) =>
    set((s) => ({
      project: { ...s.project, bookmarks: [...s.project.bookmarks, { ...b, id: newId('bm') }] },
    })),

  removeBookmark: (id) =>
    set((s) => ({
      project: { ...s.project, bookmarks: s.project.bookmarks.filter((b) => b.id !== id) },
    })),

  toggleFavourite: (key) => {
    const favourites = get().favourites.includes(key)
      ? get().favourites.filter((k) => k !== key)
      : [...get().favourites, key]
    set({ favourites })
    try {
      localStorage.setItem(FAVOURITES_KEY, JSON.stringify(favourites))
    } catch {
      /* storage unavailable */
    }
  },

  noteRecent: (key) =>
    set((s) => ({ recentSymbols: [key, ...s.recentSymbols.filter((k) => k !== key)].slice(0, 12) })),

  loadProject: (p) =>
    set({ project: p, past: [], future: [], selectedIds: [], dirtySince: Date.now() }),

  newProject: () =>
    set({ project: createEmptyProject(), past: [], future: [], selectedIds: [], dirtySince: Date.now() }),
}))

function loadFavourites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAVOURITES_KEY) ?? '[]')
  } catch {
    return []
  }
}

/** Convenience selector: currently selected features with their overlay. */
export function getSelectedFeatures(state: {
  project: Project
  selectedIds: string[]
}): { overlay: OverlayId; feature: Feature }[] {
  const out: { overlay: OverlayId; feature: Feature }[] = []
  for (const oid of OVERLAY_IDS) {
    for (const f of state.project.overlays[oid].features) {
      if (state.selectedIds.includes(f.id)) out.push({ overlay: oid, feature: f })
    }
  }
  return out
}
