# Architecture

## Design principles

1. **Rendering is separated from UI.** React components never draw map
   content. They mutate the Zustand store; `MapView` observes the store and
   pushes plain GeoJSON into MapLibre sources. All styling decisions live in
   `map/overlayRender.ts` and `map/mapStyle.ts`.
2. **The document is plain data.** A `Project` is a JSON-serializable tree
   (overlays → features). Undo/redo, autosave, save/load, and GeoJSON export
   all operate on that one structure.
3. **Deterministic, self-contained world.** The terrain, the elevation model,
   and even the font glyphs are generated in the client. The app makes zero
   network requests at runtime and depicts no real place.

## Module map

```
src/
├── types.ts                 Domain model: Project / Overlay / Feature, enums
├── state/
│   ├── store.ts             Zustand store: document, selection, tools,
│   │                        undo/redo (snapshot stacks), clipboard,
│   │                        transient (drag) transactions
│   └── persistence.ts       JSON (de)serialization, autosave, GeoJSON
│                            import/export, PNG/PDF export
├── terrain/
│   ├── elevation.ts         Analytic fictional heightfield (gaussian hills +
│   │                        value noise + river-valley carve), area bounds
│   └── generate.ts          Procedural terrain GeoJSON: contours (d3-contour
│                            over the heightfield), lakes, rivers, marshes,
│                            forest/open ground (noise fields), roads, trails,
│                            rail, bridges (turf line intersections),
│                            villages, ranges, labels
├── map/
│   ├── MapView.tsx          The only React⇄MapLibre bridge: map lifecycle,
│   │                        store→source sync, all pointer interactions
│   │                        (select / drag / vertex edit / draw / measure),
│   │                        context menu, north arrow
│   ├── mapStyle.ts          Style factory: 4 palettes (topo / imagery /
│   │                        hybrid / contour) over identical sources
│   ├── overlayRender.ts     Feature → render-GeoJSON conversion + overlay
│   │                        layer definitions (fills, lines, labels, icons)
│   ├── symbolImages.ts      milsymbol → canvas icon factory, lazy via
│   │                        styleimagemissing; hand-drawn point-graphic icons
│   ├── grid.ts              MGRS/UTM grid line + label generation
│   └── localGlyphs.ts       Offline glyph server: TinySDF → glyphs.proto PBF
│                            behind a custom local-glyphs:// protocol
├── symbols/
│   ├── sidc.ts              APP-6(D) 20-digit SIDC assembly/parsing
│   └── catalog.ts           Unit palette (verified entity codes, keywords)
├── graphics/catalog.ts      Tactical graphics palette (geometry kind, label
│                            template, APP-6(D)-style colors/dashes)
├── utils/coords.ts          MGRS wrapper + WGS-84⇄UTM (Krüger series)
└── components/              Pure UI: TopToolbar, LayerPanel, RightPanel
                             (palette + property editor), StatusBar
                             (+ elevation profile), Legend
```

## Data model

```
Project
├── overlays: { control | friendly | opfor | fires | user }
│   └── Overlay { visible, opacity, features: Feature[] }
│       ├── SymbolFeature   point + APP-6(D) fields (symbolSet, entity,
│       │                   affiliation, context, echelon, hqtf, modifiers,
│       │                   designation, higherFormation, reinforcedReduced,
│       │                   rotation, scale, locked, visible)
│       └── GraphicFeature  graphicType (catalog key) + geometryKind +
│                           vertex list + name + optional color override
├── bookmarks: Bookmark[]
└── settings { mapStyle, showGrid, snapToGrid, showLegend, symbolSize,
               terrainLayers{...} }
```

The SIDC is **derived**, never stored: `buildSidc(feature)` assembles the
20-digit code (version 10, context, identity, symbol set, status, HQ/TF,
echelon, entity, modifiers) whenever an icon or export needs it.

## Rendering pipeline

```
store change
   └─ MapView effect
        ├─ buildOverlayData(overlay)            (overlayRender.ts)
        │    symbols → Points {icon: "ms|<sidc>|<amplifiers>|<size>"}
        │    graphics → fill / outline / line / icon / label features
        ├─ GeoJSONSource.setData(...)           (per overlay, 2 sources)
        └─ layer visibility/opacity properties

missing icon id
   └─ styleimagemissing → symbolImages.ts
        "ms|…"  → milsymbol renders canvas (2× DPI) → map.addImage
        "gfx-…" → hand-drawn canvas icon (target cross, OP triangle, …)
```

Icon ids encode everything that affects appearance, so a symbol whose
affiliation or designation changes simply resolves to a new image id and the
old one stays cached. Thousands of symbols reduce to a handful of images when
they share type/affiliation/echelon.

### Undo/redo & drags

`commit(mutate)` snapshots the project (JSON string) onto the past stack and
applies the mutation to a fresh clone. Pointer drags use
`beginTransient / updateFeatureLive / endTransient` so a 60 Hz drag produces
exactly one undo step. History is capped at 100 entries.

### Offline glyphs

MapLibre needs SDF glyph atlases (protobuf) for every `text-field`. Instead
of a font server, `localGlyphs.ts` registers a `local-glyphs://` protocol that
rasterizes each requested 256-codepoint range with TinySDF and encodes the
standard `glyphs.proto` message with pbf. Results are cached per range.

### The fictional terrain

`elevation.ts` defines elevation as an analytic function: a regional tilt,
six named gaussian hills, 3-octave value noise, and a trough carved along a
sine-shaped river axis. Contours come from running d3-contour over a
220×160 sample grid of that function; vegetation and open ground threshold a
separate noise field; rivers/roads/villages are hand-tuned control points
smoothed with turf bezier splines. Everything is seeded (`mulberry32`), so
every user sees the identical map. **No real-world data is used anywhere.**

## Testing

`vitest` unit tests cover the pure core:

- `symbols/sidc.test.ts` — SIDC assembly/parsing; every catalog entry renders
  a valid milsymbol icon in friend and hostile affiliations
- `state/store.test.ts` — add/delete/lock/duplicate/copy-paste, undo/redo,
  transient drag collapse
- `state/persistence.test.ts` — project JSON round trip, GeoJSON export/import
  (lossless self round-trip, foreign-file fallback)
- `utils/coords.test.ts` — MGRS and UTM round trips
- `terrain/terrain.test.ts` — determinism, plausible relief, feature counts,
  geometry bounds

Interactive behaviour (placement, dragging, drawing, measuring, style
switching) was verified end-to-end in Chromium.

## Extension points

- **More unit types**: add a `CatalogEntry` in `symbols/catalog.ts` (verify
  the entity code renders in milsymbol — the test suite does this for you).
- **More control measures**: add a `GraphicDef` in `graphics/catalog.ts`;
  point icons need a matching case in `symbolImages.ts#drawGraphicIcon`.
- **New base-map looks**: add a palette in `mapStyle.ts`.
- **Different fictional terrain**: adjust hills/rivers/roads in
  `terrain/elevation.ts` + `terrain/generate.ts`; everything downstream
  (contours, bridges, labels) regenerates automatically.
- **Multi-user / server sync**: the whole document is one JSON tree with
  content-free ids — diff or broadcast `Project` snapshots.
