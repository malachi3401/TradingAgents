import { useState } from 'react'
import { useStore } from '../state/store'
import { mapHandle } from '../map/MapView'
import { OVERLAY_IDS, TERRAIN_LAYER_KEYS, type OverlayId, type TerrainLayerKey } from '../types'

const TERRAIN_LABELS: Record<TerrainLayerKey, string> = {
  contours: 'Contour Lines',
  water: 'Rivers & Lakes',
  marsh: 'Marshes',
  forest: 'Forest / Woodline',
  openGround: 'Open Ground',
  roads: 'Roads',
  trails: 'Trails',
  railways: 'Railways',
  bridges: 'Bridges',
  buildings: 'Buildings',
  ranges: 'Range Boundaries',
  labels: 'Place Labels',
}

export default function LayerPanel() {
  const store = useStore()
  const project = useStore((s) => s.project)
  const activeOverlay = useStore((s) => s.activeOverlay)
  const [showTerrain, setShowTerrain] = useState(true)
  const [showBookmarks, setShowBookmarks] = useState(true)

  return (
    <div className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-edge bg-panel">
      <div className="border-b border-edge px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        Layer Manager
      </div>

      {/* Tactical overlays */}
      <div className="px-3 py-2">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Overlays
        </div>
        {OVERLAY_IDS.map((oid) => (
          <OverlayRow key={oid} oid={oid} active={activeOverlay === oid} />
        ))}
        <p className="mt-1 text-[10px] leading-snug text-gray-500">
          New symbols and graphics are placed on the highlighted (active) overlay.
        </p>
      </div>

      {/* Terrain layer toggles */}
      <div className="border-t border-edge px-3 py-2">
        <button
          className="mb-1 flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-gray-500"
          onClick={() => setShowTerrain((v) => !v)}
        >
          <span>Base Map Layers</span>
          <span>{showTerrain ? '▾' : '▸'}</span>
        </button>
        {showTerrain &&
          TERRAIN_LAYER_KEYS.map((key) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 py-0.5 text-xs">
              <input
                type="checkbox"
                checked={project.settings.terrainLayers[key]}
                onChange={(e) => store.setTerrainLayer(key, e.target.checked)}
                className="accent-[#6aa84f]"
              />
              {TERRAIN_LABELS[key]}
            </label>
          ))}
      </div>

      {/* Bookmarks */}
      <div className="border-t border-edge px-3 py-2">
        <button
          className="mb-1 flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-gray-500"
          onClick={() => setShowBookmarks((v) => !v)}
        >
          <span>Bookmarks</span>
          <span>{showBookmarks ? '▾' : '▸'}</span>
        </button>
        {showBookmarks && (
          <>
            {project.bookmarks.map((b) => (
              <div key={b.id} className="flex items-center gap-1 py-0.5">
                <button
                  className="flex-1 truncate rounded px-1 py-0.5 text-left text-xs hover:bg-panel3"
                  onClick={() => mapHandle.current?.flyTo({ center: b.center, zoom: b.zoom, bearing: b.bearing })}
                >
                  {b.name}
                </button>
                <button
                  className="rounded px-1 text-xs text-gray-500 hover:text-red-400"
                  title="Remove bookmark"
                  onClick={() => store.removeBookmark(b.id)}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              className="mt-1 w-full rounded bg-panel3 px-2 py-1 text-xs hover:bg-edge"
              onClick={() => {
                const map = mapHandle.current
                if (!map) return
                const name = window.prompt('Bookmark name:', `View ${project.bookmarks.length + 1}`)
                if (!name) return
                const c = map.getCenter()
                store.addBookmark({ name, center: [c.lng, c.lat], zoom: map.getZoom(), bearing: map.getBearing() })
              }}
            >
              + Bookmark current view
            </button>
          </>
        )}
      </div>

      <div className="mt-auto border-t border-edge px-3 py-2 text-[10px] leading-snug text-gray-600">
        MAPLEWOOD TRAINING AREA — entirely fictional terrain for training and education. Not a
        depiction of any real installation.
      </div>
    </div>
  )
}

function OverlayRow({ oid, active }: { oid: OverlayId; active: boolean }) {
  const store = useStore()
  const overlay = useStore((s) => s.project.overlays[oid])
  const count = overlay.features.length

  return (
    <div
      className={`mb-1 rounded border px-2 py-1.5 ${
        active ? 'border-accent bg-panel3' : 'border-edge bg-panel2'
      }`}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={overlay.visible}
          onChange={(e) => store.setOverlayVisible(oid, e.target.checked)}
          className="accent-[#6aa84f]"
          title="Show/hide overlay"
        />
        <button
          className="flex-1 truncate text-left text-xs font-medium"
          title="Set as active overlay"
          onClick={() => store.setActiveOverlay(oid)}
        >
          {overlay.name}
        </button>
        <span className="rounded bg-panel px-1.5 py-0.5 text-[10px] text-gray-400">{count}</span>
      </div>
      <input
        type="range"
        min={0.2}
        max={1}
        step={0.05}
        value={overlay.opacity}
        onChange={(e) => store.setOverlayOpacity(oid, parseFloat(e.target.value))}
        className="mt-1 w-full accent-[#6aa84f]"
        title="Overlay opacity"
      />
    </div>
  )
}
