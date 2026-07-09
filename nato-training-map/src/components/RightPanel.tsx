import { useMemo, useState } from 'react'
import { useStore, getSelectedFeatures } from '../state/store'
import { BRANCHES, SYMBOL_CATALOG, searchCatalog, type CatalogEntry } from '../symbols/catalog'
import { GRAPHIC_CATALOG, GRAPHIC_GROUPS, findGraphicDef } from '../graphics/catalog'
import { buildSidc } from '../symbols/sidc'
import { previewSvg } from '../map/symbolImages'
import { paletteDefaults } from '../map/MapView'
import {
  AFFILIATION_DIGIT,
  ECHELON_NAMES,
  HQTF_NAMES,
  type Affiliation,
  type Echelon,
  type GraphicFeature,
  type SymbolContext,
  type SymbolFeature,
} from '../types'

const AFFILIATIONS: { id: Affiliation; label: string }[] = [
  { id: 'friend', label: 'Friendly' },
  { id: 'hostile', label: 'Hostile' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'unknown', label: 'Unknown' },
  { id: 'assumedFriend', label: 'Assumed Friend' },
  { id: 'suspect', label: 'Suspect' },
  { id: 'pending', label: 'Pending' },
]

const CONTEXTS: { id: SymbolContext; label: string }[] = [
  { id: 'reality', label: 'Reality' },
  { id: 'exercise', label: 'Exercise' },
  { id: 'simulation', label: 'Simulation' },
]

export default function RightPanel() {
  const selected = useStore((s) => getSelectedFeatures({ project: s.project, selectedIds: s.selectedIds }))
  const [tab, setTab] = useState<'units' | 'graphics'>('units')

  return (
    <div className="flex w-80 shrink-0 flex-col overflow-hidden border-l border-edge bg-panel">
      {selected.length > 0 ? (
        <PropertiesEditor />
      ) : (
        <>
          <div className="flex border-b border-edge">
            {(['units', 'graphics'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider ${
                  tab === t ? 'bg-panel3 text-gray-100' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t === 'units' ? 'APP-6(D) Units' : 'Tactical Graphics'}
              </button>
            ))}
          </div>
          {tab === 'units' ? <UnitPalette /> : <GraphicsPalette />}
        </>
      )}
    </div>
  )
}

// ===========================================================================
// Unit palette
// ===========================================================================

function UnitPalette() {
  const store = useStore()
  const favourites = useStore((s) => s.favourites)
  const recents = useStore((s) => s.recentSymbols)
  const placing = useStore((s) => s.placingSymbol)
  const [query, setQuery] = useState('')
  const [branch, setBranch] = useState<string>('all')
  const [affiliation, setAffiliation] = useState<Affiliation>('friend')
  // Reality is the default: per APP-6(D), exercise-context hostiles render as
  // "Faker" (friend frame + K amplifier), which surprises most users.
  const [context, setContext] = useState<SymbolContext>('reality')
  const [echelon, setEchelon] = useState<Echelon>('14')

  // Palette defaults are read by the map click handler at placement time.
  paletteDefaults.affiliation = affiliation
  paletteDefaults.context = context
  paletteDefaults.echelon = echelon

  const entries = useMemo(() => {
    let list = searchCatalog(query)
    if (branch !== 'all') list = list.filter((e) => e.branch === branch)
    return list
  }, [query, branch])

  const favEntries = SYMBOL_CATALOG.filter((e) => favourites.includes(e.key))
  const recentEntries = recents
    .map((k) => SYMBOL_CATALOG.find((e) => e.key === k))
    .filter((e): e is CatalogEntry => !!e)

  const previewSidc = (e: CatalogEntry) =>
    buildSidc({
      context,
      affiliation,
      symbolSet: e.symbolSet,
      hqtf: '0',
      echelon,
      entity: e.entity,
      modifier1: e.modifier1,
      modifier2: e.modifier2,
    })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-edge p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search units… (e.g. mortar, recce)"
          className="w-full rounded border border-edge bg-panel2 px-2 py-1.5 text-xs outline-none focus:border-accent"
        />
        <div className="flex gap-1.5">
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="min-w-0 flex-1 rounded border border-edge bg-panel2 px-1 py-1 text-[11px]"
            title="Filter by branch"
          >
            <option value="all">All branches</option>
            {BRANCHES.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select
            value={echelon}
            onChange={(e) => setEchelon(e.target.value as Echelon)}
            className="w-24 rounded border border-edge bg-panel2 px-1 py-1 text-[11px]"
            title="Echelon for placed symbols"
          >
            {Object.entries(ECHELON_NAMES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5">
          <select
            value={affiliation}
            onChange={(e) => setAffiliation(e.target.value as Affiliation)}
            className="min-w-0 flex-1 rounded border border-edge bg-panel2 px-1 py-1 text-[11px]"
            title="Affiliation for placed symbols"
          >
            {AFFILIATIONS.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
          <select
            value={context}
            onChange={(e) => setContext(e.target.value as SymbolContext)}
            className="w-24 rounded border border-edge bg-panel2 px-1 py-1 text-[11px]"
            title="Context (reality / exercise / simulation)"
          >
            {CONTEXTS.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        {placing && (
          <div className="rounded border border-accent bg-panel3 px-2 py-1 text-[11px] text-accent2">
            Placing: {placing.name} — click map (Esc to stop)
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {favEntries.length > 0 && (
          <PaletteSection title="★ Favourites" entries={favEntries} previewSidc={previewSidc} />
        )}
        {recentEntries.length > 0 && (
          <PaletteSection title="Recently used" entries={recentEntries} previewSidc={previewSidc} />
        )}
        {(branch === 'all' ? BRANCHES : [branch]).map((b) => {
          const list = entries.filter((e) => e.branch === b)
          if (list.length === 0) return null
          return <PaletteSection key={b} title={b} entries={list} previewSidc={previewSidc} />
        })}
      </div>
    </div>
  )
}

function PaletteSection({
  title,
  entries,
  previewSidc,
}: {
  title: string
  entries: CatalogEntry[]
  previewSidc: (e: CatalogEntry) => string
}) {
  const store = useStore()
  const favourites = useStore((s) => s.favourites)
  const placing = useStore((s) => s.placingSymbol)
  const [open, setOpen] = useState(true)

  return (
    <div className="mb-2">
      <button
        className="mb-1 flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-gray-500"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="grid grid-cols-3 gap-1.5">
          {entries.map((e) => (
            <div
              key={`${title}-${e.key}`}
              className={`group relative flex cursor-pointer flex-col items-center rounded border p-1.5 hover:border-accent ${
                placing?.key === e.key ? 'border-accent bg-panel3' : 'border-edge bg-panel2'
              }`}
              title={`${e.name} — click, then click the map to place`}
              onClick={() => store.armSymbol(e)}
            >
              <div
                className="h-9 w-12 [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: previewSvg({ sidc: previewSidc(e) }) }}
              />
              <div className="mt-1 w-full truncate text-center text-[9px] leading-tight text-gray-400">
                {e.name}
              </div>
              <button
                className={`absolute right-0.5 top-0.5 text-[10px] ${
                  favourites.includes(e.key)
                    ? 'text-amber'
                    : 'text-gray-600 opacity-0 group-hover:opacity-100'
                }`}
                title="Favourite"
                onClick={(ev) => {
                  ev.stopPropagation()
                  store.toggleFavourite(e.key)
                }}
              >
                ★
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ===========================================================================
// Tactical graphics palette
// ===========================================================================

function GraphicsPalette() {
  const store = useStore()
  const placingGraphic = useStore((s) => s.placingGraphic)
  const tool = useStore((s) => s.tool)
  const [query, setQuery] = useState('')

  const arm = (key: string) => {
    const def = findGraphicDef(key)
    if (!def) return
    store.armGraphic(key)
    switch (def.geometry) {
      case 'point': store.setTool('draw-point'); break
      case 'line': store.setTool('draw-line'); break
      case 'polygon': store.setTool('draw-polygon'); break
      case 'arrow': store.setTool('draw-arrow'); break
      case 'freehand': store.setTool('draw-freehand'); break
      case 'text': store.setTool('draw-text'); break
    }
  }

  const q = query.trim().toLowerCase()
  const list = q
    ? GRAPHIC_CATALOG.filter(
        (g) => g.name.toLowerCase().includes(q) || g.keywords.some((k) => k.includes(q)),
      )
    : GRAPHIC_CATALOG

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-edge p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search graphics… (e.g. phase line, NFA)"
          className="w-full rounded border border-edge bg-panel2 px-2 py-1.5 text-xs outline-none focus:border-accent"
        />
        {tool.startsWith('draw-') && placingGraphic && (
          <div className="mt-2 rounded border border-accent bg-panel3 px-2 py-1 text-[11px] text-accent2">
            Drawing: {findGraphicDef(placingGraphic)?.name}. Click to add points; double-click or
            Enter to finish; Esc to cancel.
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {GRAPHIC_GROUPS.map((group) => {
          const items = list.filter((g) => g.group === group)
          if (items.length === 0) return null
          return (
            <div key={group} className="mb-2">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                {group}
              </div>
              <div className="flex flex-col gap-1">
                {items.map((g) => (
                  <button
                    key={g.key}
                    onClick={() => arm(g.key)}
                    className={`flex items-center justify-between rounded border px-2 py-1 text-left text-xs hover:border-accent ${
                      placingGraphic === g.key ? 'border-accent bg-panel3' : 'border-edge bg-panel2'
                    }`}
                  >
                    <span>{g.name}</span>
                    <span className="text-[10px] uppercase text-gray-500">{g.geometry}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ===========================================================================
// Properties editor for the current selection
// ===========================================================================

function PropertiesEditor() {
  const store = useStore()
  const selected = useStore((s) => getSelectedFeatures({ project: s.project, selectedIds: s.selectedIds }))
  const first = selected[0]

  if (!first) return null
  const f = first.feature

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-edge px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {selected.length > 1 ? `${selected.length} features` : f.kind === 'symbol' ? 'Symbol Properties' : 'Graphic Properties'}
        </span>
        <button className="text-xs text-gray-500 hover:text-gray-200" onClick={() => store.select([])}>
          ✕ close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {selected.length === 1 && f.kind === 'symbol' && <SymbolEditor f={f as SymbolFeature} />}
        {selected.length === 1 && f.kind === 'graphic' && <GraphicEditor f={f as GraphicFeature} />}
        <div className="mt-4 grid grid-cols-2 gap-1.5">
          <ActionBtn onClick={() => store.duplicateFeatures(store.selectedIds)}>Duplicate</ActionBtn>
          <ActionBtn onClick={() => store.copy(store.selectedIds)}>Copy</ActionBtn>
          <ActionBtn onClick={() => selected.forEach(({ feature }) => store.updateFeature(feature.id, { locked: !feature.locked }))}>
            {f.locked ? 'Unlock' : 'Lock'}
          </ActionBtn>
          <ActionBtn onClick={() => selected.forEach(({ feature }) => store.updateFeature(feature.id, { visible: !feature.visible }))}>
            {f.visible ? 'Hide' : 'Show'}
          </ActionBtn>
          <ActionBtn danger onClick={() => store.deleteFeatures(store.selectedIds)}>
            Delete
          </ActionBtn>
        </div>
      </div>
    </div>
  )
}

function ActionBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-2 py-1.5 text-xs ${
        danger ? 'bg-red-900/40 text-red-300 hover:bg-red-900/70' : 'bg-panel3 hover:bg-edge'
      }`}
    >
      {children}
    </button>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-2 block">
      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</div>
      {children}
    </label>
  )
}

const inputCls =
  'w-full rounded border border-edge bg-panel2 px-2 py-1 text-xs outline-none focus:border-accent'

function SymbolEditor({ f }: { f: SymbolFeature }) {
  const store = useStore()
  const sidc = buildSidc(f)
  const up = (patch: Partial<SymbolFeature>) => store.updateFeature(f.id, patch)

  return (
    <>
      <div className="mb-3 flex items-center justify-center rounded border border-edge bg-panel2 p-2">
        <div
          className="h-20 [&>svg]:h-full"
          dangerouslySetInnerHTML={{ __html: previewSvg({ sidc, size: 48 }) }}
        />
      </div>
      <div className="mb-2 rounded bg-panel2 px-2 py-1 font-mono text-[10px] text-gray-500" title="APP-6(D) SIDC">
        {sidc}
      </div>

      <Row label="Affiliation">
        <select className={inputCls} value={f.affiliation} onChange={(e) => up({ affiliation: e.target.value as Affiliation })}>
          {AFFILIATIONS.map((a) => (
            <option key={a.id} value={a.id}>{a.label} ({AFFILIATION_DIGIT[a.id]})</option>
          ))}
        </select>
      </Row>
      <Row label="Context">
        <select className={inputCls} value={f.context} onChange={(e) => up({ context: e.target.value as SymbolContext })}>
          {CONTEXTS.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </Row>
      <div className="grid grid-cols-2 gap-2">
        <Row label="Echelon">
          <select className={inputCls} value={f.echelon} onChange={(e) => up({ echelon: e.target.value as Echelon })}>
            {Object.entries(ECHELON_NAMES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Row>
        <Row label="HQ / Task Force">
          <select className={inputCls} value={f.hqtf} onChange={(e) => up({ hqtf: e.target.value as SymbolFeature['hqtf'] })}>
            {Object.entries(HQTF_NAMES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Row>
      </div>
      <Row label="Unit designation / callsign">
        <input className={inputCls} value={f.designation} placeholder="e.g. A Coy / C21"
          onChange={(e) => up({ designation: e.target.value })} />
      </Row>
      <Row label="Higher headquarters">
        <input className={inputCls} value={f.higherFormation} placeholder="e.g. 2 CMBG (fictional)"
          onChange={(e) => up({ higherFormation: e.target.value })} />
      </Row>
      <Row label="Additional information">
        <input className={inputCls} value={f.additionalInfo} onChange={(e) => up({ additionalInfo: e.target.value })} />
      </Row>
      <div className="grid grid-cols-2 gap-2">
        <Row label="Reinforced / Reduced">
          <select className={inputCls} value={f.reinforcedReduced}
            onChange={(e) => up({ reinforcedReduced: e.target.value as SymbolFeature['reinforcedReduced'] })}>
            <option value="">None</option>
            <option value="(+)">Reinforced (+)</option>
            <option value="(-)">Reduced (−)</option>
            <option value="(±)">Reinforced & Reduced (±)</option>
          </select>
        </Row>
        <Row label={`Scale ×${f.scale.toFixed(2)}`}>
          <input type="range" min={0.5} max={2.5} step={0.05} value={f.scale}
            className="w-full accent-[#6aa84f]"
            onChange={(e) => up({ scale: parseFloat(e.target.value) })} />
        </Row>
      </div>
      <Row label={`Rotation ${f.rotation}°`}>
        <input type="range" min={0} max={359} step={1} value={f.rotation}
          className="w-full accent-[#6aa84f]"
          onChange={(e) => up({ rotation: parseInt(e.target.value, 10) })} />
      </Row>
    </>
  )
}

function GraphicEditor({ f }: { f: GraphicFeature }) {
  const store = useStore()
  const def = findGraphicDef(f.graphicType)
  const up = (patch: Partial<GraphicFeature>) => store.updateFeature(f.id, patch)

  return (
    <>
      <div className="mb-2 text-sm font-medium text-gray-200">{def?.name ?? f.graphicType}</div>
      <Row label="Designation / name">
        <input className={inputCls} value={f.name} onChange={(e) => up({ name: e.target.value })} />
      </Row>
      {def && (
        <div className="mb-2 text-[11px] text-gray-500">
          Label renders as: <span className="text-gray-300">{def.labelTemplate.replace('{name}', f.name || '…')}</span>
        </div>
      )}
      <Row label="Colour override">
        <div className="flex items-center gap-2">
          <input type="color" value={f.color ?? def?.color ?? '#d8b64a'}
            onChange={(e) => up({ color: e.target.value })} className="h-7 w-10 cursor-pointer rounded border border-edge bg-panel2" />
          {f.color && (
            <button className="text-[11px] text-gray-500 underline" onClick={() => up({ color: undefined })}>
              reset to standard
            </button>
          )}
        </div>
      </Row>
      <div className="text-[11px] text-gray-500">
        {f.coordinates.length} vertex{f.coordinates.length === 1 ? '' : 'es'} — drag the yellow
        handles on the map to reshape; drag the body to move.
      </div>
    </>
  )
}
