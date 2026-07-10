# Maplewood Training Area — Tactical Planning Trainer

A browser-based training application for practising military map symbology and
tactical planning workflows, styled after modern NATO command-and-control
mapping tools. It uses authentic **NATO APP-6(D)** unit symbology and control
measure conventions on an **entirely fictional** Canadian-style training area.

> **Scope & intent.** This is an educational tool. The "Maplewood Training
> Area" is procedurally generated, invented terrain — it does not depict any
> real military installation, and the app ships no real-world imagery or map
> data at all. It is intended for symbology training, map-reading practice,
> and classroom planning exercises.

![Stack](https://img.shields.io/badge/stack-React%20%2B%20TypeScript%20%2B%20MapLibre-blue)

## Features

**Fictional 1:25k training terrain** (~22 × 16 km, eastern-Ontario character):
contour lines traced from an analytic heightfield, the Alder River and four
lakes, marshes, forest and open ground, paved/gravel roads, trails, a railway,
bridges at every water crossing, two training villages, and marked live-fire
ranges. Four base-map looks — topo, simulated imagery, hybrid, contour-only —
all rendered offline from the same procedural sources.

**Five independent overlays** — Terrain & Control Measures, Friendly Forces,
OPFOR, Fires, and a free-form User overlay — each with its own visibility
toggle, opacity slider, and feature count. Twelve base-map themes (contours,
water, forest, roads, …) toggle independently as well.

**APP-6(D) symbol editor**
- 30+ land-unit types across six branches (manoeuvre, fires, engineers,
  recce/int, sustainment, C2), all rendered by [milsymbol] from 20-digit
  APP-6(D) SIDCs
- All seven standard identities (friend, hostile, neutral, unknown, assumed
  friend, suspect, pending) and all three contexts (reality, exercise,
  simulation — exercise hostiles correctly render as Faker/K)
- Echelon (fire team → brigade), HQ/Task Force/Feint flags, unit designation,
  higher formation, reinforced/reduced, per-symbol scale and rotation
- Search, branch filter, favourites, recently used, live SVG previews
- Click-to-place, drag-to-move, arrow-key nudge, snap-to-100 m-grid option

**Tactical graphics** per APP-6(D) ch. 10 conventions: phase lines,
boundaries, FEBA, routes/MSR/ASR, axis of advance, checkpoints, RPs, SPs, OPs,
assembly areas, objectives, NAIs/TAIs, battle positions, strongpoints,
engagement areas, obstacle belts/zones, minefields, wire, AT ditches,
roadblocks, and a full fire-support set (targets, TRPs, FSAs, FSCL, CFL, RFL,
NFA, RFA). Vertex editing with drag handles, whole-feature drag, labels
composed from standard designators (e.g. `PL AMBER`, `NFA HOSPITAL`).

**Editing model**: undo/redo (100 steps, drags collapse to one step),
copy/paste/duplicate, lock/unlock, hide/show, right-click context menu,
keyboard shortcuts.

**Map tools**: distance, area, and bearing (degrees + NATO mils) measurement,
elevation profile with chart, MGRS coordinate pick (copies to clipboard),
go-to MGRS/lat-lon search, view bookmarks, MGRS/UTM grid at 1 km/10 km/100 km,
north arrow, scale bar, legend, live MGRS/lat-lon/elevation/scale status bar.

**Persistence**: JSON project save/load, autosave to localStorage every 30 s
(restored on relaunch), GeoJSON export/import (lossless round-trip of its own
exports; foreign GeoJSON lands on the User overlay), PNG and A3 PDF export.

**Offline capable**: no tile servers, no font servers, no external requests —
terrain is procedural and even the map glyphs are generated client-side
(TinySDF → glyph-PBF via a custom MapLibre protocol).

## Getting started

```bash
npm install
npm run dev        # development server
npm test           # unit tests (vitest)
npm run build      # production build to dist/
npm run preview    # serve the production build
```

## Quick tour

1. **Place a unit** — right panel → *APP-6(D) Units*, pick affiliation/echelon,
   click a symbol, then click the map. The symbol lands on the *active*
   overlay (highlighted in the left panel).
2. **Edit it** — select it; the right panel becomes the property editor
   (designation, HQ/TF, reinforced/reduced, rotation, scale…).
3. **Draw control measures** — right panel → *Tactical Graphics*, choose e.g.
   *Phase Line*, click vertices, press <kbd>Enter</kbd> (or double-click) to
   finish, then name it.
4. **Measure** — toolbar *Dist* / *Area* / *Brg* / *Prof*; <kbd>Esc</kbd>
   clears.
5. **Save** — *Save* downloads the project JSON; autosave also runs every
   30 s. *Export* produces PNG / PDF / GeoJSON.

### Keyboard shortcuts

| Keys | Action |
| --- | --- |
| <kbd>Ctrl/⌘ Z</kbd> / <kbd>Ctrl/⌘ Y</kbd> | Undo / redo |
| <kbd>Ctrl/⌘ C</kbd> / <kbd>V</kbd> / <kbd>D</kbd> | Copy / paste at cursor / duplicate |
| <kbd>Ctrl/⌘ S</kbd> | Save (autosave snapshot) |
| <kbd>Delete</kbd> | Delete selection |
| <kbd>Enter</kbd> | Finish drawing |
| <kbd>Esc</kbd> | Cancel drawing / clear measure / back to select |
| Arrow keys (+<kbd>Shift</kbd>) | Nudge selection (coarse) |

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the module map, data
model, rendering pipeline, and extension points.

[milsymbol]: https://github.com/spatialillusions/milsymbol
