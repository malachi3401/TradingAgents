import { beforeEach, describe, expect, it } from 'vitest'
import { newId, useStore } from './store'
import type { SymbolFeature } from '../types'

function makeSymbol(): SymbolFeature {
  return {
    id: newId(),
    kind: 'symbol',
    position: [-76.32, 45.55],
    symbolSet: '10',
    entity: '121100',
    affiliation: 'friend',
    context: 'exercise',
    echelon: '14',
    hqtf: '0',
    modifier1: '00',
    modifier2: '00',
    designation: 'A Coy',
    higherFormation: '',
    additionalInfo: '',
    reinforcedReduced: '',
    rotation: 0,
    scale: 1,
    locked: false,
    visible: true,
  }
}

beforeEach(() => {
  useStore.getState().newProject()
})

describe('feature operations', () => {
  it('adds, selects, and deletes a feature', () => {
    const f = makeSymbol()
    useStore.getState().addFeature('friendly', f)
    expect(useStore.getState().project.overlays.friendly.features).toHaveLength(1)
    expect(useStore.getState().selectedIds).toEqual([f.id])

    useStore.getState().deleteFeatures([f.id])
    expect(useStore.getState().project.overlays.friendly.features).toHaveLength(0)
  })

  it('locked features cannot be deleted', () => {
    const f = { ...makeSymbol(), locked: true }
    useStore.getState().addFeature('friendly', f)
    useStore.getState().deleteFeatures([f.id])
    expect(useStore.getState().project.overlays.friendly.features).toHaveLength(1)
  })

  it('duplicates with a fresh id and offset', () => {
    const f = makeSymbol()
    useStore.getState().addFeature('opfor', f)
    useStore.getState().duplicateFeatures([f.id])
    const feats = useStore.getState().project.overlays.opfor.features
    expect(feats).toHaveLength(2)
    expect(feats[1].id).not.toBe(f.id)
    expect((feats[1] as SymbolFeature).position[0]).not.toBe(f.position[0])
  })

  it('copy/paste targets the active overlay', () => {
    const f = makeSymbol()
    useStore.getState().addFeature('friendly', f)
    useStore.getState().copy([f.id])
    useStore.getState().setActiveOverlay('user')
    useStore.getState().paste([-76.25, 45.5])
    const pasted = useStore.getState().project.overlays.user.features
    expect(pasted).toHaveLength(1)
    expect((pasted[0] as SymbolFeature).position[0]).toBeCloseTo(-76.25, 6)
  })
})

describe('undo / redo', () => {
  it('undoes and redoes adds', () => {
    const s = useStore.getState()
    s.addFeature('friendly', makeSymbol())
    s.addFeature('friendly', makeSymbol())
    expect(useStore.getState().project.overlays.friendly.features).toHaveLength(2)

    useStore.getState().undo()
    expect(useStore.getState().project.overlays.friendly.features).toHaveLength(1)
    useStore.getState().undo()
    expect(useStore.getState().project.overlays.friendly.features).toHaveLength(0)
    useStore.getState().redo()
    useStore.getState().redo()
    expect(useStore.getState().project.overlays.friendly.features).toHaveLength(2)
  })

  it('a new action clears the redo stack', () => {
    const s = useStore.getState()
    s.addFeature('friendly', makeSymbol())
    useStore.getState().undo()
    useStore.getState().addFeature('friendly', makeSymbol())
    useStore.getState().redo() // should be a no-op
    expect(useStore.getState().project.overlays.friendly.features).toHaveLength(1)
  })

  it('transient drag collapses into one undo step', () => {
    const f = makeSymbol()
    useStore.getState().addFeature('friendly', f)
    useStore.getState().beginTransient()
    useStore.getState().updateFeatureLive(f.id, { position: [-76.3, 45.56] })
    useStore.getState().updateFeatureLive(f.id, { position: [-76.29, 45.57] })
    useStore.getState().endTransient()

    const moved = useStore.getState().project.overlays.friendly.features[0] as SymbolFeature
    expect(moved.position[1]).toBeCloseTo(45.57, 6)

    useStore.getState().undo() // one step back to pre-drag position
    const back = useStore.getState().project.overlays.friendly.features[0] as SymbolFeature
    expect(back.position[1]).toBeCloseTo(45.55, 6)
  })
})
