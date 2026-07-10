/**
 * APP-6(D) unit palette. Entity codes are 6-digit land-unit (symbol set 10)
 * entity/type/subtype codes; every code here has been verified to render a
 * complete icon with milsymbol 2.x.
 */

export interface CatalogEntry {
  key: string
  name: string
  branch: string
  symbolSet: string
  entity: string
  modifier1?: string
  modifier2?: string
  keywords: string[]
}

export const BRANCHES = [
  'Command & Control',
  'Manoeuvre',
  'Fires',
  'Protection & Engineers',
  'Intelligence & Recce',
  'Sustainment',
] as const

export const SYMBOL_CATALOG: CatalogEntry[] = [
  // --- Command & Control ---------------------------------------------------
  { key: 'hq', name: 'Headquarters (Unit)', branch: 'Command & Control', symbolSet: '10', entity: '110000', keywords: ['hq', 'headquarters', 'command'] },
  { key: 'signals', name: 'Signals', branch: 'Command & Control', symbolSet: '10', entity: '110600', keywords: ['signal', 'communications', 'comms', 'radio'] },
  { key: 'liaison', name: 'Liaison', branch: 'Command & Control', symbolSet: '10', entity: '110300', keywords: ['liaison'] },
  { key: 'civil-affairs', name: 'Civil-Military Cooperation', branch: 'Command & Control', symbolSet: '10', entity: '110200', keywords: ['cimic', 'civil'] },

  // --- Manoeuvre -----------------------------------------------------------
  { key: 'infantry', name: 'Infantry', branch: 'Manoeuvre', symbolSet: '10', entity: '121100', keywords: ['infantry', 'rifle', 'light infantry'] },
  { key: 'mech-infantry', name: 'Mechanized Infantry', branch: 'Manoeuvre', symbolSet: '10', entity: '121104', keywords: ['mechanized', 'mech', 'ifv', 'armoured infantry'] },
  { key: 'motorized-infantry', name: 'Motorized Infantry', branch: 'Manoeuvre', symbolSet: '10', entity: '121102', keywords: ['motorized', 'wheeled'] },
  { key: 'armour', name: 'Armour', branch: 'Manoeuvre', symbolSet: '10', entity: '120500', keywords: ['armour', 'armor', 'tank'] },
  { key: 'combined-arms', name: 'Combined Arms', branch: 'Manoeuvre', symbolSet: '10', entity: '121000', keywords: ['combined arms', 'battle group'] },
  { key: 'anti-armour', name: 'Anti-Armour', branch: 'Manoeuvre', symbolSet: '10', entity: '120400', keywords: ['anti-armour', 'anti-tank', 'atgm'] },
  { key: 'air-assault', name: 'Air Assault', branch: 'Manoeuvre', symbolSet: '10', entity: '120100', keywords: ['air assault', 'airmobile'] },
  { key: 'sf', name: 'Special Operations Forces', branch: 'Manoeuvre', symbolSet: '10', entity: '121800', keywords: ['special forces', 'sof'] },
  { key: 'support-weapons', name: 'Direct Fire Support (Wpns)', branch: 'Manoeuvre', symbolSet: '10', entity: '121500', keywords: ['support weapons', 'weapons det', 'direct fire'] },

  // --- Fires ---------------------------------------------------------------
  { key: 'artillery', name: 'Field Artillery', branch: 'Fires', symbolSet: '10', entity: '130300', keywords: ['artillery', 'guns', 'howitzer', 'fires'] },
  { key: 'artillery-sp', name: 'Self-Propelled Artillery', branch: 'Fires', symbolSet: '10', entity: '130300', modifier2: '52', keywords: ['self-propelled', 'sp artillery'] },
  { key: 'mortar', name: 'Mortar', branch: 'Fires', symbolSet: '10', entity: '130800', keywords: ['mortar', 'mortars', '81mm'] },
  { key: 'air-defence', name: 'Air Defence', branch: 'Fires', symbolSet: '10', entity: '130100', keywords: ['air defence', 'air defense', 'ad', 'gbad'] },
  { key: 'rocket-artillery', name: 'Rocket Artillery (MRL)', branch: 'Fires', symbolSet: '10', entity: '130900', keywords: ['rocket', 'mlrs', 'mrl'] },

  // --- Protection & Engineers ----------------------------------------------
  { key: 'engineer', name: 'Engineer', branch: 'Protection & Engineers', symbolSet: '10', entity: '140700', keywords: ['engineer', 'sapper', 'pioneers'] },
  { key: 'military-police', name: 'Military Police', branch: 'Protection & Engineers', symbolSet: '10', entity: '141200', keywords: ['mp', 'military police'] },
  { key: 'cbrn', name: 'CBRN Defence', branch: 'Protection & Engineers', symbolSet: '10', entity: '140100', keywords: ['cbrn', 'chemical', 'decon'] },
  { key: 'eod', name: 'EOD', branch: 'Protection & Engineers', symbolSet: '10', entity: '140800', keywords: ['eod', 'explosive ordnance'] },

  // --- Intelligence & Recce ------------------------------------------------
  { key: 'recon', name: 'Reconnaissance', branch: 'Intelligence & Recce', symbolSet: '10', entity: '121300', keywords: ['recon', 'recce', 'cavalry', 'scout'] },
  { key: 'sniper', name: 'Sniper', branch: 'Intelligence & Recce', symbolSet: '10', entity: '121900', keywords: ['sniper'] },
  { key: 'intel', name: 'Military Intelligence', branch: 'Intelligence & Recce', symbolSet: '10', entity: '151000', keywords: ['intelligence', 'int', 'mi'] },
  { key: 'uas', name: 'Unmanned Aerial Systems', branch: 'Intelligence & Recce', symbolSet: '10', entity: '150800', keywords: ['uas', 'uav', 'drone'] },

  // --- Sustainment -----------------------------------------------------------
  { key: 'medical', name: 'Medical', branch: 'Sustainment', symbolSet: '10', entity: '160900', keywords: ['medical', 'med', 'ambulance', 'aid'] },
  { key: 'supply', name: 'Supply', branch: 'Sustainment', symbolSet: '10', entity: '163600', keywords: ['supply', 'logistics', 'log', 'q'] },
  { key: 'transport', name: 'Transportation', branch: 'Sustainment', symbolSet: '10', entity: '163700', keywords: ['transport', 'trucks', 'movement'] },
  { key: 'maintenance', name: 'Maintenance', branch: 'Sustainment', symbolSet: '10', entity: '161100', keywords: ['maintenance', 'repair', 'workshop'] },
  { key: 'admin', name: 'Administrative', branch: 'Sustainment', symbolSet: '10', entity: '160100', keywords: ['admin', 'administrative'] },
]

export function findCatalogEntry(key: string): CatalogEntry | undefined {
  return SYMBOL_CATALOG.find((e) => e.key === key)
}

export function searchCatalog(query: string): CatalogEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return SYMBOL_CATALOG
  return SYMBOL_CATALOG.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.branch.toLowerCase().includes(q) ||
      e.keywords.some((k) => k.includes(q)),
  )
}
