import {
  AFFILIATION_DIGIT,
  CONTEXT_DIGIT,
  type SymbolFeature,
} from '../types'

/**
 * Assemble a 20-digit APP-6(D) SIDC from a symbol feature.
 *
 * Positions: 1-2 version, 3 context, 4 standard identity, 5-6 symbol set,
 * 7 status, 8 HQ/TF/dummy, 9-10 echelon amplifier, 11-16 entity code,
 * 17-18 modifier 1, 19-20 modifier 2.
 */
export function buildSidc(s: {
  context: SymbolFeature['context']
  affiliation: SymbolFeature['affiliation']
  symbolSet: string
  hqtf: string
  echelon: string
  entity: string
  modifier1?: string
  modifier2?: string
}): string {
  const version = '10'
  const status = '0'
  const mod1 = (s.modifier1 || '00').padStart(2, '0')
  const mod2 = (s.modifier2 || '00').padStart(2, '0')
  return (
    version +
    CONTEXT_DIGIT[s.context] +
    AFFILIATION_DIGIT[s.affiliation] +
    s.symbolSet.padStart(2, '0') +
    status +
    s.hqtf +
    s.echelon.padStart(2, '0') +
    s.entity.padEnd(6, '0') +
    mod1 +
    mod2
  )
}

/** Parse the parts of a 20-digit SIDC we care about (used by tests/import). */
export function parseSidc(sidc: string) {
  if (!/^\d{20}$/.test(sidc)) throw new Error(`Invalid APP-6(D) SIDC: ${sidc}`)
  return {
    version: sidc.slice(0, 2),
    contextDigit: sidc[2],
    affiliationDigit: sidc[3],
    symbolSet: sidc.slice(4, 6),
    status: sidc[6],
    hqtf: sidc[7],
    echelon: sidc.slice(8, 10),
    entity: sidc.slice(10, 16),
    modifier1: sidc.slice(16, 18),
    modifier2: sidc.slice(18, 20),
  }
}
