import { describe, expect, it } from 'vitest'
import ms from 'milsymbol'
import { buildSidc, parseSidc } from './sidc'
import { SYMBOL_CATALOG } from './catalog'

describe('buildSidc', () => {
  it('assembles a friendly exercise infantry platoon SIDC', () => {
    const sidc = buildSidc({
      context: 'exercise',
      affiliation: 'friend',
      symbolSet: '10',
      hqtf: '0',
      echelon: '14',
      entity: '121100',
    })
    expect(sidc).toBe('10131000141211000000')
    const parts = parseSidc(sidc)
    expect(parts.contextDigit).toBe('1')
    expect(parts.affiliationDigit).toBe('3')
    expect(parts.symbolSet).toBe('10')
    expect(parts.echelon).toBe('14')
    expect(parts.entity).toBe('121100')
  })

  it('round-trips all affiliations', () => {
    for (const aff of ['pending', 'unknown', 'assumedFriend', 'friend', 'neutral', 'suspect', 'hostile'] as const) {
      const sidc = buildSidc({
        context: 'reality',
        affiliation: aff,
        symbolSet: '10',
        hqtf: '0',
        echelon: '00',
        entity: '121100',
      })
      expect(sidc).toHaveLength(20)
      expect(() => parseSidc(sidc)).not.toThrow()
    }
  })

  it('rejects malformed SIDCs in parseSidc', () => {
    expect(() => parseSidc('123')).toThrow()
    expect(() => parseSidc('1003100000121100000x')).toThrow()
  })
})

describe('symbol catalog', () => {
  it('every catalog entry renders a valid milsymbol icon', () => {
    for (const entry of SYMBOL_CATALOG) {
      const sidc = buildSidc({
        context: 'exercise',
        affiliation: 'friend',
        symbolSet: entry.symbolSet,
        hqtf: '0',
        echelon: '15',
        entity: entry.entity,
        modifier1: entry.modifier1,
        modifier2: entry.modifier2,
      })
      const sym = new ms.Symbol(sidc, { size: 24 })
      expect(sym.isValid(), `${entry.name} (${sidc})`).toBe(true)
      expect(sym.asSVG().length).toBeGreaterThan(200)
    }
  })

  it('hostile affiliation renders for every entry', () => {
    for (const entry of SYMBOL_CATALOG) {
      const sidc = buildSidc({
        context: 'exercise',
        affiliation: 'hostile',
        symbolSet: entry.symbolSet,
        hqtf: '0',
        echelon: '14',
        entity: entry.entity,
      })
      expect(new ms.Symbol(sidc, { size: 24 }).isValid()).toBe(true)
    }
  })
})
