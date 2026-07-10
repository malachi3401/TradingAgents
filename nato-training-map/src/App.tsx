import { useEffect, useRef, useState } from 'react'
import MapView, { finishDrawing, mapHandle } from './map/MapView'
import TopToolbar from './components/TopToolbar'
import LayerPanel from './components/LayerPanel'
import RightPanel from './components/RightPanel'
import StatusBar from './components/StatusBar'
import Legend from './components/Legend'
import { useStore } from './state/store'
import { autosave, loadAutosave } from './state/persistence'

const AUTOSAVE_INTERVAL_MS = 30_000

export default function App() {
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const restoredRef = useRef(false)

  // Restore autosave once on startup.
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    const saved = loadAutosave()
    if (saved) useStore.getState().loadProject(saved)
  }, [])

  // Autosave every 30 s when dirty.
  useEffect(() => {
    let lastSaved = 0
    const t = setInterval(() => {
      const { project, dirtySince } = useStore.getState()
      if (dirtySince > lastSaved) {
        autosave(project)
        lastSaved = Date.now()
      }
    }, AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(t)
  }, [])

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      const s = useStore.getState()
      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); s.undo(); return }
      if ((mod && e.key.toLowerCase() === 'y') || (mod && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault(); s.redo(); return
      }
      if (mod && e.key.toLowerCase() === 'c') { s.copy(s.selectedIds); return }
      if (mod && e.key.toLowerCase() === 'v') { s.paste(s.cursor ? [s.cursor.lng, s.cursor.lat] : undefined); return }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); s.duplicateFeatures(s.selectedIds); return }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        autosave(s.project)
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { s.deleteFeatures(s.selectedIds); return }
      if (e.key === 'Enter') { finishDrawing(); return }
      if (e.key === 'Escape') {
        if (s.drawing.length > 0) s.setDrawing([])
        else if (s.measure.points.length > 0) s.setMeasure({ points: [], result: '' })
        else s.setTool('select')
        return
      }
      // Nudge selection with arrow keys.
      const nudge = e.shiftKey ? 0.001 : 0.0002
      const deltas: Record<string, [number, number]> = {
        ArrowUp: [0, nudge],
        ArrowDown: [0, -nudge],
        ArrowLeft: [-nudge, 0],
        ArrowRight: [nudge, 0],
      }
      if (deltas[e.key] && s.selectedIds.length > 0) {
        e.preventDefault()
        for (const id of s.selectedIds) s.moveFeature(id, deltas[e.key])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const showLegend = useStore((s) => s.project.settings.showLegend)

  return (
    <div className="flex h-full flex-col">
      <TopToolbar
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onToggleLeft={() => setLeftOpen((v) => !v)}
        onToggleRight={() => setRightOpen((v) => !v)}
      />
      <div className="flex min-h-0 flex-1">
        {leftOpen && <LayerPanel />}
        <div className="relative min-w-0 flex-1">
          <MapView />
          {showLegend && <Legend />}
        </div>
        {rightOpen && <RightPanel />}
      </div>
      <StatusBar />
    </div>
  )
}

/** Fly the map to a bookmark (used by LayerPanel). */
export function flyTo(center: [number, number], zoom: number, bearing = 0) {
  mapHandle.current?.flyTo({ center, zoom, bearing })
}
