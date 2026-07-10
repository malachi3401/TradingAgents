import { useRef, useState } from 'react'
import { useStore } from '../state/store'
import {
  autosave,
  deserializeProject,
  downloadText,
  exportPdf,
  exportPng,
  importGeoJson,
  projectToGeoJson,
  serializeProject,
} from '../state/persistence'
import { mapHandle } from '../map/MapView'
import { fromMgrs } from '../utils/coords'
import type { MapStyleId, ToolId } from '../types'

const STYLES: { id: MapStyleId; label: string }[] = [
  { id: 'topo', label: 'Topo 1:25k' },
  { id: 'satellite', label: 'Imagery (sim)' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'contour', label: 'Contours' },
]

function ToolButton({
  label,
  title,
  active,
  onClick,
}: {
  label: string
  title: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-accent text-black' : 'bg-panel3 text-gray-200 hover:bg-edge'
      }`}
    >
      {label}
    </button>
  )
}

export default function TopToolbar(props: {
  leftOpen: boolean
  rightOpen: boolean
  onToggleLeft: () => void
  onToggleRight: () => void
}) {
  const store = useStore()
  const tool = useStore((s) => s.tool)
  const settings = useStore((s) => s.project.settings)
  const fileRef = useRef<HTMLInputElement>(null)
  const geojsonRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)

  const setMeasureTool = (t: ToolId) => store.setTool(store.tool === t ? 'select' : t)

  const doSearch = () => {
    const q = search.trim()
    if (!q) return
    const pt = fromMgrs(q)
    if (pt) {
      mapHandle.current?.flyTo({ center: pt, zoom: 14 })
      return
    }
    const m = q.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/)
    if (m) {
      const lat = parseFloat(m[1])
      const lng = parseFloat(m[2])
      mapHandle.current?.flyTo({ center: [lng, lat], zoom: 14 })
    }
  }

  const saveNow = () => {
    autosave(store.project)
    downloadText(`${store.project.name.replace(/\s+/g, '_')}.json`, serializeProject(store.project))
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1200)
  }

  return (
    <div className="flex items-center gap-1.5 border-b border-edge bg-panel px-2 py-1.5">
      <button
        title="Toggle layer manager"
        onClick={props.onToggleLeft}
        className="rounded bg-panel3 px-2 py-1.5 text-xs hover:bg-edge"
      >
        ☰
      </button>
      <input
        value={useStore((s) => s.project.name)}
        onChange={(e) => store.setProjectName(e.target.value)}
        className="w-44 rounded border border-edge bg-panel2 px-2 py-1 text-xs text-gray-100 outline-none focus:border-accent"
        title="Exercise / project name"
      />
      <div className="mx-1 h-5 w-px bg-edge" />

      <ToolButton label="↶" title="Undo (Ctrl+Z)" onClick={store.undo} />
      <ToolButton label="↷" title="Redo (Ctrl+Y)" onClick={store.redo} />
      <div className="mx-1 h-5 w-px bg-edge" />

      <ToolButton label={savedFlash ? 'Saved ✓' : 'Save'} title="Save project as JSON (also autosaves locally)" onClick={saveNow} />
      <ToolButton label="Load" title="Load project JSON" onClick={() => fileRef.current?.click()} />
      <div className="relative">
        <ExportMenu />
      </div>
      <ToolButton label="Import GeoJSON" title="Import a GeoJSON FeatureCollection" onClick={() => geojsonRef.current?.click()} />
      <div className="mx-1 h-5 w-px bg-edge" />

      {/* Map style switcher */}
      <div className="flex overflow-hidden rounded border border-edge">
        {STYLES.map((s) => (
          <button
            key={s.id}
            onClick={() => store.setMapStyle(s.id)}
            className={`px-2 py-1 text-[11px] ${
              settings.mapStyle === s.id ? 'bg-accent text-black' : 'bg-panel2 hover:bg-panel3'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <ToolButton
        label="Grid"
        title="Toggle MGRS grid"
        active={settings.showGrid}
        onClick={() => store.setSetting('showGrid', !settings.showGrid)}
      />
      <ToolButton
        label="Snap"
        title="Snap placement to 100 m grid"
        active={settings.snapToGrid}
        onClick={() => store.setSetting('snapToGrid', !settings.snapToGrid)}
      />
      <ToolButton
        label="Legend"
        title="Toggle legend"
        active={settings.showLegend}
        onClick={() => store.setSetting('showLegend', !settings.showLegend)}
      />
      <div className="mx-1 h-5 w-px bg-edge" />

      <ToolButton label="Dist" title="Measure distance (Esc to clear)" active={tool === 'measure-distance'} onClick={() => setMeasureTool('measure-distance')} />
      <ToolButton label="Area" title="Measure area" active={tool === 'measure-area'} onClick={() => setMeasureTool('measure-area')} />
      <ToolButton label="Brg" title="Bearing between two points (degrees & mils)" active={tool === 'measure-bearing'} onClick={() => setMeasureTool('measure-bearing')} />
      <ToolButton label="Prof" title="Elevation profile between two points" active={tool === 'elevation-profile'} onClick={() => setMeasureTool('elevation-profile')} />
      <ToolButton label="MGRS" title="Pick a point, copy its MGRS reference" active={tool === 'coordinate-pick'} onClick={() => setMeasureTool('coordinate-pick')} />

      <div className="flex-1" />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && doSearch()}
        placeholder="Go to MGRS or lat,lon…"
        className="w-48 rounded border border-edge bg-panel2 px-2 py-1 text-xs outline-none focus:border-accent"
      />
      <button
        title="Toggle symbol editor"
        onClick={props.onToggleRight}
        className="rounded bg-panel3 px-2 py-1.5 text-xs hover:bg-edge"
      >
        ☰
      </button>

      {/* hidden file inputs */}
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (!f) return
          try {
            store.loadProject(deserializeProject(await f.text()))
          } catch (err) {
            alert(`Could not load project: ${err}`)
          }
          e.target.value = ''
        }}
      />
      <input
        ref={geojsonRef}
        type="file"
        accept=".geojson,.json,application/geo+json,application/json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (!f) return
          try {
            store.loadProject(importGeoJson(store.project, await f.text()))
          } catch (err) {
            alert(`Could not import GeoJSON: ${err}`)
          }
          e.target.value = ''
        }}
      />
    </div>
  )
}

function ExportMenu() {
  const [open, setOpen] = useState(false)
  const project = useStore((s) => s.project)
  const item = 'px-3 py-1.5 text-left text-xs hover:bg-panel3 whitespace-nowrap'
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded bg-panel3 px-2.5 py-1.5 text-xs font-medium hover:bg-edge"
      >
        Export ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-8 z-50 flex flex-col rounded border border-edge bg-panel2 py-1 shadow-xl">
            <button
              className={item}
              onClick={() => {
                const canvas = mapHandle.current?.getCanvas()
                if (canvas) exportPng(canvas, project.name.replace(/\s+/g, '_'))
                setOpen(false)
              }}
            >
              PNG (map view)
            </button>
            <button
              className={item}
              onClick={async () => {
                const canvas = mapHandle.current?.getCanvas()
                if (canvas) await exportPdf(canvas, project.name.replace(/\s+/g, '_'))
                setOpen(false)
              }}
            >
              PDF (A3)
            </button>
            <button
              className={item}
              onClick={() => {
                downloadText(
                  `${project.name.replace(/\s+/g, '_')}.geojson`,
                  JSON.stringify(projectToGeoJson(project), null, 2),
                  'application/geo+json',
                )
                setOpen(false)
              }}
            >
              GeoJSON (all overlays)
            </button>
          </div>
        </>
      )}
    </>
  )
}
