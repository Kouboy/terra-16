import type { BedrockInfo, ElevationGrid, TerrainFeature } from './types';

export type RegionalStyleId =
  | 'bassin_calcaire'
  | 'armorique_granit'
  | 'midi_ocre'
  | 'flandres_brique'
  | 'alsace_colombage'
  | 'alpin_montagne'
  | 'auvergne_volcan';

export interface BuildingPalette {
  outline: string;
  roofShadow: string;
  roofMid: string;
  roofLight: string;
  roofRidge: string;
  wall: string;
  wallShade: string;
  cornice: string;
  timber: string;
  shutter: string;
}

export interface RegionalTheme {
  id: RegionalStyleId;
  shortLabel: string;
  fullLabel: string;
  architectureNote: string;
  /** Meadow / pasture 4-tone dithered grass */
  meadow: [string, string, string, string];
  elevatedHigh: [string, string, string, string];
  elevatedLow: [string, string, string, string];
  courtyard: [string, string, string, string];
  forestFloor: [string, string, string, string];
  /** Scrub / heath / garrigue colors: baseDark, baseMid, baseLight, accentFlower1, accentFlower2 */
  scrub: [string, string, string, string, string];
  /** Main road & village street cobble palettes: mortar, stone1, stone2, stone3, highlight */
  mainRoad: [string, string, string, string, string];
  street: [string, string, string, string, string];
  plaza: [string, string, string, string];
  /** Cliff stratum colors: body, sunShelf, midBand, shadeUndercut, fissure */
  cliff: [string, string, string, string, string];
  /** Architectural flags */
  hasSteppedGables: boolean;
  colombageStyle: 'none' | 'occasional' | 'alsace_rich';
  hasAlpineWoodBalcony: boolean;
  isCanalTile: boolean;
  isGraniteQuoins: boolean;
  isDarkBasalt: boolean;
  /** Flora mix */
  floraMode: 'temperate' | 'mediterranean' | 'alpine' | 'atlantic_bocage' | 'vosges_fir';
  urbanPalettes: [BuildingPalette, BuildingPalette, BuildingPalette];
  villagePalettes: [BuildingPalette, BuildingPalette, BuildingPalette];
  suburbanPalettes: [BuildingPalette, BuildingPalette, BuildingPalette];
}

export type SubterraneanLithoId =
  | 'calcaire_karst'
  | 'granit_cristallin'
  | 'schiste_houiller'
  | 'gres_ferrugineux'
  | 'basalte_volcanique';

export interface SubterraneanLithoProfile {
  id: SubterraneanLithoId;
  shortLabel: string;
  galleryStyleLabel: string;
  base: string;
  dark: string;
  mid: string;
  wallFace: string;
  wallTop: string;
  vein: string;
  crystalGlow: string;
  floorBase: string;
  floorTile: string;
  floorJoint: string;
  useTimberProps: boolean;
  hasKarstStalagmites: boolean;
}

const REGIONAL_THEMES: Record<RegionalStyleId, RegionalTheme> = {
  bassin_calcaire: {
    id: 'bassin_calcaire',
    shortLabel: 'Pierre Blonde & Ardoise',
    fullLabel: 'Bassin Calcaire · Pierre de Taille & Ardoise',
    architectureNote: 'Pierre calcaire blonde, toits de zinc/ardoise et tuiles plates',
    meadow: ['#3a8238', '#4da142', '#64ba4c', '#98e063'],
    elevatedHigh: ['#49993f', '#5eb548', '#78cc54', '#bef264'],
    elevatedLow: ['#2d6b34', '#3c853d', '#4fa148', '#7ad15e'],
    courtyard: ['#5f8f49', '#74a659', '#88ba6a', '#add685'],
    forestFloor: ['#14381d', '#1d4d27', '#296633', '#499449'],
    scrub: ['#4d6b34', '#658544', '#82a358', '#facc15', '#e9d5ff'],
    mainRoad: ['#9c8669', '#eadbc2', '#dfd0b4', '#d2c0a1', '#f7efe0'],
    street: ['#856a4b', '#d9c3a3', '#cbb28e', '#e3d1b6', '#f3e7d3'],
    plaza: ['#bba889', '#efe4ce', '#e6d8be', '#fbf6ea'],
    cliff: ['#9c784c', '#ead7b3', '#c9a677', '#6e4e30', '#4a321c'],
    hasSteppedGables: false,
    colombageStyle: 'occasional',
    hasAlpineWoodBalcony: false,
    isCanalTile: false,
    isGraniteQuoins: false,
    isDarkBasalt: false,
    floraMode: 'temperate',
    urbanPalettes: [
      {
        outline: '#17202e',
        roofShadow: '#1e293b',
        roofMid: '#3b4c63',
        roofLight: '#64748b',
        roofRidge: '#cbd5e1',
        wall: '#f6eedc',
        wallShade: '#dfd1b4',
        cornice: '#ffffff',
        timber: '#54341d',
        shutter: '#334155',
      },
      {
        outline: '#291512',
        roofShadow: '#262f40',
        roofMid: '#3f4d63',
        roofLight: '#64748b',
        roofRidge: '#cbd5e1',
        wall: '#cf6a53',
        wallShade: '#ab4e3a',
        cornice: '#f5ebd6',
        timber: '#54341d',
        shutter: '#f8fafc',
      },
      {
        outline: '#261a10',
        roofShadow: '#4f3b27',
        roofMid: '#6e5237',
        roofLight: '#8f6d4c',
        roofRidge: '#cbb08c',
        wall: '#f2e4c9',
        wallShade: '#d4c09c',
        cornice: '#fbf6ea',
        timber: '#54341d',
        shutter: '#1d4ed8',
      },
    ],
    villagePalettes: [
      {
        outline: '#2b150e',
        roofShadow: '#573d28',
        roofMid: '#7d583a',
        roofLight: '#a17450',
        roofRidge: '#d4b48c',
        wall: '#f2e2c4',
        wallShade: '#d4be98',
        cornice: '#fbf6ea',
        timber: '#6e4226',
        shutter: '#1d4ed8',
      },
      {
        outline: '#17202e',
        roofShadow: '#283548',
        roofMid: '#3f5169',
        roofLight: '#5c7391',
        roofRidge: '#cbd5e1',
        wall: '#f5ecda',
        wallShade: '#d6c7ab',
        cornice: '#ffffff',
        timber: '#64748b',
        shutter: '#15803d',
      },
      {
        outline: '#261a10',
        roofShadow: '#4f3b27',
        roofMid: '#73573b',
        roofLight: '#967452',
        roofRidge: '#cbb08c',
        wall: '#ebd9b7',
        wallShade: '#cbb38a',
        cornice: '#f7efe0',
        timber: '#54341d',
        shutter: '#991b1b',
      },
    ],
    suburbanPalettes: [
      {
        outline: '#2b1810',
        roofShadow: '#8c3523',
        roofMid: '#bd4b33',
        roofLight: '#e06b4f',
        roofRidge: '#f7b29c',
        wall: '#faf8f2',
        wallShade: '#e2ddd1',
        cornice: '#ffffff',
        timber: '#6e4226',
        shutter: '#475569',
      },
      {
        outline: '#1e293b',
        roofShadow: '#263142',
        roofMid: '#3b495e',
        roofLight: '#576982',
        roofRidge: '#94a3b8',
        wall: '#f5efe2',
        wallShade: '#dbd1be',
        cornice: '#ffffff',
        timber: '#475569',
        shutter: '#334155',
      },
      {
        outline: '#291c12',
        roofShadow: '#573d28',
        roofMid: '#7d593b',
        roofLight: '#a17652',
        roofRidge: '#d1ad88',
        wall: '#f2dec4',
        wallShade: '#d6bc9c',
        cornice: '#fbf6ea',
        timber: '#54341d',
        shutter: '#15803d',
      },
    ],
  },

  armorique_granit: {
    id: 'armorique_granit',
    shortLabel: 'Granit & Ardoise',
    fullLabel: 'Terres d’Armorique · Granit Gris & Ardoise Bleue',
    architectureNote: 'Chaînages de granit, toits d’ardoise bleutée, longères et landes à ajoncs',
    meadow: ['#2b7a3d', '#3b964c', '#50b35e', '#86efac'],
    elevatedHigh: ['#3d8c45', '#4fa656', '#68bf6b', '#a7f3d0'],
    elevatedLow: ['#1f5e32', '#2d7840', '#3f9150', '#6ee7b7'],
    courtyard: ['#4d854f', '#609c60', '#77b374', '#a3dba0'],
    forestFloor: ['#113621', '#194a2d', '#24633c', '#3e8c56'],
    scrub: ['#3b5929', '#4d7036', '#648c46', '#facc15', '#c084fc'], // ajoncs d'or & bruyère pourpre!
    mainRoad: ['#64748b', '#cbd5e1', '#b8c4d4', '#94a3b8', '#f1f5f9'],
    street: ['#526071', '#b6c2cf', '#9fb0c2', '#cbd5e1', '#e2e8f0'],
    plaza: ['#788799', '#d5dde6', '#c2ccd9', '#f1f5f9'],
    cliff: ['#64748b', '#cbd5e1', '#94a3b8', '#475569', '#1e293b'],
    hasSteppedGables: false,
    colombageStyle: 'none',
    hasAlpineWoodBalcony: false,
    isCanalTile: false,
    isGraniteQuoins: true,
    isDarkBasalt: false,
    floraMode: 'atlantic_bocage',
    urbanPalettes: [
      {
        outline: '#0f172a',
        roofShadow: '#17253b',
        roofMid: '#263a59',
        roofLight: '#425b80',
        roofRidge: '#93c5fd',
        wall: '#d8dee6',
        wallShade: '#b0bac7',
        cornice: '#f8fafc',
        timber: '#475569',
        shutter: '#1d4ed8',
      },
      {
        outline: '#0f172a',
        roofShadow: '#1e293b',
        roofMid: '#334155',
        roofLight: '#526580',
        roofRidge: '#cbd5e1',
        wall: '#f8fafc',
        wallShade: '#cbd5e1',
        cornice: '#94a3b8',
        timber: '#475569',
        shutter: '#0284c7',
      },
      {
        outline: '#1e1b2e',
        roofShadow: '#1e293b',
        roofMid: '#2e3f59',
        roofLight: '#4b6385',
        roofRidge: '#bae6fd',
        wall: '#cbd5e1',
        wallShade: '#94a3b8',
        cornice: '#e2e8f0',
        timber: '#334155',
        shutter: '#0f766e',
      },
    ],
    villagePalettes: [
      {
        // Penty breton blanchi à la chaux + chaînages granit + volets bleu marin
        outline: '#0f172a',
        roofShadow: '#17253b',
        roofMid: '#273c5c',
        roofLight: '#435f87',
        roofRidge: '#bae6fd',
        wall: '#f8fafc',
        wallShade: '#cbd5e1',
        cornice: '#94a3b8',
        timber: '#64748b',
        shutter: '#0284c7',
      },
      {
        // Maison de bourg en granit gris taillé
        outline: '#0f172a',
        roofShadow: '#1e293b',
        roofMid: '#334155',
        roofLight: '#526580',
        roofRidge: '#cbd5e1',
        wall: '#cbd5e1',
        wallShade: '#94a3b8',
        cornice: '#e2e8f0',
        timber: '#475569',
        shutter: '#1d4ed8',
      },
      {
        // Granit doré / rose d'Armorique
        outline: '#1e293b',
        roofShadow: '#1c283d',
        roofMid: '#2f4261',
        roofLight: '#4b658c',
        roofRidge: '#cbd5e1',
        wall: '#e6d8cc',
        wallShade: '#bfa896',
        cornice: '#f1f5f9',
        timber: '#475569',
        shutter: '#047857',
      },
    ],
    suburbanPalettes: [
      {
        outline: '#0f172a',
        roofShadow: '#1e293b',
        roofMid: '#314259',
        roofLight: '#4e6582',
        roofRidge: '#cbd5e1',
        wall: '#ffffff',
        wallShade: '#dbe3ed',
        cornice: '#94a3b8',
        timber: '#475569',
        shutter: '#0284c7',
      },
      {
        outline: '#0f172a',
        roofShadow: '#17253b',
        roofMid: '#273b59',
        roofLight: '#435e85',
        roofRidge: '#93c5fd',
        wall: '#f1f5f9',
        wallShade: '#cbd5e1',
        cornice: '#ffffff',
        timber: '#475569',
        shutter: '#1e3a8a',
      },
      {
        outline: '#1e293b',
        roofShadow: '#263142',
        roofMid: '#3b495e',
        roofLight: '#576982',
        roofRidge: '#94a3b8',
        wall: '#e2e8f0',
        wallShade: '#bdcada',
        cornice: '#f8fafc',
        timber: '#334155',
        shutter: '#0f766e',
      },
    ],
  },

  midi_ocre: {
    id: 'midi_ocre',
    shortLabel: 'Ocre & Tuiles Canal',
    fullLabel: 'Midi & Garrigue · Enduits Ocres & Tuiles Romaines',
    architectureNote: 'Tuiles canal en terre cuite, façades ocres, pins parasols et cyprès',
    meadow: ['#558532', '#6ea13d', '#8ab84b', '#bef264'],
    elevatedHigh: ['#6d9639', '#88b347', '#a3cc58', '#d9f99d'],
    elevatedLow: ['#41702c', '#568a38', '#6da346', '#a3e635'],
    courtyard: ['#789649', '#8fab5b', '#a5bf6f', '#cde096'],
    forestFloor: ['#2a4d22', '#3a632d', '#4d7a3b', '#74a352'],
    scrub: ['#6e7838', '#879148', '#a3ab5e', '#a855f7', '#fef08a'], // garrigue thym, lavande & genêt
    mainRoad: ['#a6845e', '#f2dfc2', '#e8cfa9', '#d9bc91', '#fffbeb'],
    street: ['#967149', '#edd3ad', '#dfb98a', '#f5e1c3', '#fffbeb'],
    plaza: ['#c49d70', '#f7e6c8', '#edd4ab', '#fffbeb'],
    cliff: ['#b87e44', '#f7e4c1', '#deb076', '#855326', '#543114'],
    hasSteppedGables: false,
    colombageStyle: 'none',
    hasAlpineWoodBalcony: false,
    isCanalTile: true,
    isGraniteQuoins: false,
    isDarkBasalt: false,
    floraMode: 'mediterranean',
    urbanPalettes: [
      {
        outline: '#36190c',
        roofShadow: '#85321e',
        roofMid: '#b84a2e',
        roofLight: '#e06d48',
        roofRidge: '#fdba74',
        wall: '#f5d5a3',
        wallShade: '#d9b077',
        cornice: '#fef3c7',
        timber: '#7c2d12',
        shutter: '#38bdf8',
      },
      {
        outline: '#381510',
        roofShadow: '#7c2d12',
        roofMid: '#ad4224',
        roofLight: '#d9653b',
        roofRidge: '#fed7aa',
        wall: '#eb9d78',
        wallShade: '#c97853',
        cornice: '#ffedd5',
        timber: '#7c2d12',
        shutter: '#15803d',
      },
      {
        outline: '#2e1a0d',
        roofShadow: '#8a391b',
        roofMid: '#bd552c',
        roofLight: '#e37949',
        roofRidge: '#fde68a',
        wall: '#f7e6c4',
        wallShade: '#dbc397',
        cornice: '#ffffff',
        timber: '#78350f',
        shutter: '#7e22ce',
      },
    ],
    villagePalettes: [
      {
        // Mas provençal ocre doré + volets lavande
        outline: '#36190c',
        roofShadow: '#85321e',
        roofMid: '#ba4c2f',
        roofLight: '#e3724b',
        roofRidge: '#fdba74',
        wall: '#f5cf93',
        wallShade: '#d6ab69',
        cornice: '#fef3c7',
        timber: '#78350f',
        shutter: '#7e22ce',
      },
      {
        // Enduit terre de Sienne / Roussillon + volets vert olive
        outline: '#38140d',
        roofShadow: '#7c2d12',
        roofMid: '#b04325',
        roofLight: '#db6840',
        roofRidge: '#fed7aa',
        wall: '#eba883',
        wallShade: '#c9825d',
        cornice: '#ffedd5',
        timber: '#7c2d12',
        shutter: '#4d7c0f',
      },
      {
        // Pierre blonde méridionale + volets bleu pastel
        outline: '#2e1a0d',
        roofShadow: '#8a391b',
        roofMid: '#c2572d',
        roofLight: '#e87f52',
        roofRidge: '#fde68a',
        wall: '#f7e5c1',
        wallShade: '#d9c093',
        cornice: '#fffbeb',
        timber: '#78350f',
        shutter: '#0284c7',
      },
    ],
    suburbanPalettes: [
      {
        outline: '#36190c',
        roofShadow: '#8c3520',
        roofMid: '#c45133',
        roofLight: '#eb7954',
        roofRidge: '#fed7aa',
        wall: '#fbf2df',
        wallShade: '#e3d0ae',
        cornice: '#ffffff',
        timber: '#78350f',
        shutter: '#0284c7',
      },
      {
        outline: '#381510',
        roofShadow: '#85321e',
        roofMid: '#ba4c2f',
        roofLight: '#e3724b',
        roofRidge: '#fdba74',
        wall: '#f7d9b0',
        wallShade: '#dbb481',
        cornice: '#fef3c7',
        timber: '#78350f',
        shutter: '#65a30d',
      },
      {
        outline: '#2e1a0d',
        roofShadow: '#7c2d12',
        roofMid: '#ad4224',
        roofLight: '#d9653b',
        roofRidge: '#fed7aa',
        wall: '#f5bca0',
        wallShade: '#d69576',
        cornice: '#ffedd5',
        timber: '#7c2d12',
        shutter: '#f8fafc',
      },
    ],
  },

  flandres_brique: {
    id: 'flandres_brique',
    shortLabel: 'Brique & Pignons du Nord',
    fullLabel: 'Flandres & Artois · Brique Rouge & Pavés Bleus',
    architectureNote: 'Brique rouge flamande, pignons à pas de moineaux et pavés de grès bleu',
    meadow: ['#347d39', '#459947', '#5cb359', '#8ce079'],
    elevatedHigh: ['#449143', '#57ab52', '#6fc464', '#b4f089'],
    elevatedLow: ['#26632e', '#357d3b', '#479649', '#75cf6b'],
    courtyard: ['#528749', '#669e59', '#7db56b', '#a6d98c'],
    forestFloor: ['#14381d', '#1d4d27', '#296633', '#499449'],
    scrub: ['#435e35', '#587846', '#6f915a', '#fde047', '#f9a8d4'],
    mainRoad: ['#475569', '#94a3b8', '#7d8fa6', '#64748b', '#cbd5e1'], // Pavés du Nord Paris-Roubaix!
    street: ['#52525b', '#a8a29e', '#8c857e', '#bdb6ae', '#e7e5e4'],
    plaza: ['#78350f', '#d97757', '#c45d3e', '#f5ebd6'],
    cliff: ['#cbd5e1', '#ffffff', '#e2e8f0', '#94a3b8', '#475569'], // Craie blanche du Nord / Boulonnais!
    hasSteppedGables: true,
    colombageStyle: 'none',
    hasAlpineWoodBalcony: false,
    isCanalTile: false,
    isGraniteQuoins: false,
    isDarkBasalt: false,
    floraMode: 'temperate',
    urbanPalettes: [
      {
        outline: '#2b0f0c',
        roofShadow: '#1e293b',
        roofMid: '#334155',
        roofLight: '#526580',
        roofRidge: '#cbd5e1',
        wall: '#b8432e',
        wallShade: '#8f2e1d',
        cornice: '#f5ebd6',
        timber: '#451a03',
        shutter: '#f8fafc',
      },
      {
        outline: '#291512',
        roofShadow: '#5c2418',
        roofMid: '#853624',
        roofLight: '#ad4b34',
        roofRidge: '#fca5a5',
        wall: '#cc583f',
        wallShade: '#9e3e29',
        cornice: '#fef3c7',
        timber: '#451a03',
        shutter: '#1e293b',
      },
      {
        outline: '#1e293b',
        roofShadow: '#1e293b',
        roofMid: '#3b4c63',
        roofLight: '#64748b',
        roofRidge: '#e2e8f0',
        wall: '#e88b5a',
        wallShade: '#c46b3d',
        cornice: '#ffffff',
        timber: '#451a03',
        shutter: '#15803d',
      },
    ],
    villagePalettes: [
      {
        // Corons / maison flamande en brique rouge et linteaux de craie blanche
        outline: '#2b0f0c',
        roofShadow: '#5c2418',
        roofMid: '#873623',
        roofLight: '#b34b32',
        roofRidge: '#fdba74',
        wall: '#bd4630',
        wallShade: '#912f1d',
        cornice: '#f8fafc',
        timber: '#f8fafc',
        shutter: '#f8fafc',
      },
      {
        outline: '#1e293b',
        roofShadow: '#1e293b',
        roofMid: '#334155',
        roofLight: '#526580',
        roofRidge: '#cbd5e1',
        wall: '#c95a42',
        wallShade: '#9e3f2b',
        cornice: '#fef3c7',
        timber: '#f5ebd6',
        shutter: '#1d4ed8',
      },
      {
        outline: '#291512',
        roofShadow: '#263142',
        roofMid: '#3f5069',
        roofLight: '#5e7494',
        roofRidge: '#cbd5e1',
        wall: '#de7d54',
        wallShade: '#b55c38',
        cornice: '#ffffff',
        timber: '#f8fafc',
        shutter: '#15803d',
      },
    ],
    suburbanPalettes: [
      {
        outline: '#2b0f0c',
        roofShadow: '#1e293b',
        roofMid: '#334155',
        roofLight: '#4e617a',
        roofRidge: '#94a3b8',
        wall: '#c7523a',
        wallShade: '#9c3a27',
        cornice: '#f8fafc',
        timber: '#f8fafc',
        shutter: '#f8fafc',
      },
      {
        outline: '#2b150e',
        roofShadow: '#6e281a',
        roofMid: '#9c3b26',
        roofLight: '#c45239',
        roofRidge: '#fca5a5',
        wall: '#d97254',
        wallShade: '#b05339',
        cornice: '#ffffff',
        timber: '#f8fafc',
        shutter: '#334155',
      },
      {
        outline: '#1e293b',
        roofShadow: '#263142',
        roofMid: '#3b495e',
        roofLight: '#576982',
        roofRidge: '#cbd5e1',
        wall: '#f5efe2',
        wallShade: '#d4cab8',
        cornice: '#b8432e',
        timber: '#b8432e',
        shutter: '#1e293b',
      },
    ],
  },

  alsace_colombage: {
    id: 'alsace_colombage',
    shortLabel: 'Colombages & Grès Rose',
    fullLabel: 'Alsace & Vosges · Pans de Bois & Grès Rose',
    architectureNote: 'Maisons à colombages colorés, toits pentus en biberschwanz et grès des Vosges',
    meadow: ['#338038', '#459e44', '#5cb856', '#92e66c'],
    elevatedHigh: ['#41913f', '#54ad4e', '#6dc760', '#b3f285'],
    elevatedLow: ['#24632c', '#337d39', '#459648', '#73d166'],
    courtyard: ['#568c49', '#6ba35a', '#82ba6c', '#aad989'],
    forestFloor: ['#0f331c', '#174727', '#215e35', '#3b874d'],
    scrub: ['#3f5e32', '#527842', '#6a9155', '#f472b6', '#fde047'],
    mainRoad: ['#8c5e58', '#d9b2ab', '#c99e97', '#b88a82', '#f5e1dd'], // Grès rose des Vosges!
    street: ['#7a524c', '#cfa69f', '#bd918a', '#deb8b2', '#f7e6e4'],
    plaza: ['#9e6d66', '#e6c5bf', '#d6b0aa', '#faecea'],
    cliff: ['#a8554c', '#e8b4ae', '#c97e75', '#783730', '#471c18'], // Falaises de grès rose!
    hasSteppedGables: false,
    colombageStyle: 'alsace_rich',
    hasAlpineWoodBalcony: false,
    isCanalTile: false,
    isGraniteQuoins: false,
    isDarkBasalt: false,
    floraMode: 'vosges_fir',
    urbanPalettes: [
      {
        outline: '#29150e',
        roofShadow: '#592316',
        roofMid: '#823522',
        roofLight: '#a84932',
        roofRidge: '#f2a384',
        wall: '#fbf3dc',
        wallShade: '#decfa9',
        cornice: '#d98a80',
        timber: '#4a2811',
        shutter: '#15803d',
      },
      {
        outline: '#2b1410',
        roofShadow: '#4f291d',
        roofMid: '#733d2c',
        roofLight: '#96543e',
        roofRidge: '#d9a48f',
        wall: '#f5d0c5',
        wallShade: '#d4a699',
        cornice: '#faecea',
        timber: '#422006',
        shutter: '#991b1b',
      },
      {
        outline: '#261a10',
        roofShadow: '#572a19',
        roofMid: '#7d3f27',
        roofLight: '#a35639',
        roofRidge: '#eab696',
        wall: '#fae5a5',
        wallShade: '#d9be75',
        cornice: '#fffbeb',
        timber: '#4a2811',
        shutter: '#1d4ed8',
      },
    ],
    villagePalettes: [
      {
        outline: '#29150e',
        roofShadow: '#592316',
        roofMid: '#823522',
        roofLight: '#a84932',
        roofRidge: '#f2a384',
        wall: '#fef3c7',
        wallShade: '#e0ce94',
        cornice: '#d98a80',
        timber: '#451a03',
        shutter: '#dc2626',
      },
      {
        outline: '#261a10',
        roofShadow: '#4f291d',
        roofMid: '#733d2c',
        roofLight: '#96543e',
        roofRidge: '#d9a48f',
        wall: '#e0f2fe',
        wallShade: '#b6d5eb',
        cornice: '#f8fafc',
        timber: '#451a03',
        shutter: '#1d4ed8',
      },
      {
        outline: '#2b1410',
        roofShadow: '#572a19',
        roofMid: '#7d3f27',
        roofLight: '#a35639',
        roofRidge: '#eab696',
        wall: '#fce7f3',
        wallShade: '#deb8ce',
        cornice: '#fff1f2',
        timber: '#3b1806',
        shutter: '#15803d',
      },
    ],
    suburbanPalettes: [
      {
        outline: '#29150e',
        roofShadow: '#592316',
        roofMid: '#823522',
        roofLight: '#a84932',
        roofRidge: '#f2a384',
        wall: '#faf6eb',
        wallShade: '#dfd6c1',
        cornice: '#ffffff',
        timber: '#4a2811',
        shutter: '#991b1b',
      },
      {
        outline: '#261a10',
        roofShadow: '#4f291d',
        roofMid: '#733d2c',
        roofLight: '#96543e',
        roofRidge: '#d9a48f',
        wall: '#fef3c7',
        wallShade: '#e0cf96',
        cornice: '#ffffff',
        timber: '#4a2811',
        shutter: '#15803d',
      },
      {
        outline: '#1e293b',
        roofShadow: '#263142',
        roofMid: '#3b495e',
        roofLight: '#576982',
        roofRidge: '#94a3b8',
        wall: '#f5d5ce',
        wallShade: '#d4ada5',
        cornice: '#ffffff',
        timber: '#4a2811',
        shutter: '#334155',
      },
    ],
  },

  alpin_montagne: {
    id: 'alpin_montagne',
    shortLabel: 'Alpages & Lauzes',
    fullLabel: 'Haute Montagne · Chalets de Mélèze & Lauzes',
    architectureNote: 'Toitures de lauzes lourdes, chalets à balcons de bois sculpté et forêts d’épicéas',
    meadow: ['#2e7d3b', '#3f994b', '#56b560', '#93eb83'],
    elevatedHigh: ['#498f42', '#5eab54', '#78c468', '#bbf7d0'],
    elevatedLow: ['#1f5e2e', '#2d783d', '#3e914d', '#6ee7b7'],
    courtyard: ['#4e8248', '#629959', '#79b06d', '#a5d696'],
    forestFloor: ['#0d2e1c', '#144229', '#1d5938', '#337d51'],
    scrub: ['#4a5d3b', '#60754e', '#788f64', '#f43f5e', '#fef08a'], // Rhododendrons & gentianes!
    mainRoad: ['#57534e', '#a8a29e', '#948e88', '#78716c', '#e7e5e4'],
    street: ['#44403c', '#9c958e', '#857e77', '#b5aea6', '#d6d3d1'],
    plaza: ['#64748b', '#cbd5e1', '#b4c0cf', '#f1f5f9'],
    cliff: ['#64748b', '#e2e8f0', '#94a3b8', '#475569', '#1e293b'],
    hasSteppedGables: false,
    colombageStyle: 'none',
    hasAlpineWoodBalcony: true,
    isCanalTile: false,
    isGraniteQuoins: true,
    isDarkBasalt: false,
    floraMode: 'alpine',
    urbanPalettes: [
      {
        outline: '#1e1b18',
        roofShadow: '#292524',
        roofMid: '#44403c',
        roofLight: '#6b655f',
        roofRidge: '#d6d3d1',
        wall: '#e7e0d3',
        wallShade: '#c7bca8',
        cornice: '#f5f5f4',
        timber: '#78350f',
        shutter: '#991b1b',
      },
      {
        outline: '#1c1917',
        roofShadow: '#1e293b',
        roofMid: '#334155',
        roofLight: '#526580',
        roofRidge: '#e2e8f0',
        wall: '#c28b52',
        wallShade: '#996836',
        cornice: '#fde68a',
        timber: '#5c2d0c',
        shutter: '#dc2626',
      },
      {
        outline: '#1e1b18',
        roofShadow: '#27272a',
        roofMid: '#3f3f46',
        roofLight: '#63636e',
        roofRidge: '#e4e4e7',
        wall: '#d6ccc2',
        wallShade: '#b3a598',
        cornice: '#f8fafc',
        timber: '#78350f',
        shutter: '#15803d',
      },
    ],
    villagePalettes: [
      {
        // Chalet savoyard / pyrénéen : soubassement pierre + bardage mélèze doré + balcon bois
        outline: '#1f140a',
        roofShadow: '#292524',
        roofMid: '#44403c',
        roofLight: '#6b655f',
        roofRidge: '#e7e5e4',
        wall: '#b87d44',
        wallShade: '#8c5a2b',
        cornice: '#e7e5e4',
        timber: '#5c2d0c',
        shutter: '#dc2626',
      },
      {
        // Maison de montagne crépie + balcon mélèze + toit de lauzes
        outline: '#1e1b18',
        roofShadow: '#1e293b',
        roofMid: '#334155',
        roofLight: '#526580',
        roofRidge: '#e2e8f0',
        wall: '#f2ece1',
        wallShade: '#cfc4b2',
        cornice: '#9c6631',
        timber: '#78350f',
        shutter: '#991b1b',
      },
      {
        // Vieux chalet de mélèze bruni par le soleil d'altitude
        outline: '#1c1209',
        roofShadow: '#27272a',
        roofMid: '#3f3f46',
        roofLight: '#63636e',
        roofRidge: '#d4d4d8',
        wall: '#965d2c',
        wallShade: '#6e4019',
        cornice: '#d6d3d1',
        timber: '#451a03',
        shutter: '#f8fafc',
      },
    ],
    suburbanPalettes: [
      {
        outline: '#1f140a',
        roofShadow: '#292524',
        roofMid: '#44403c',
        roofLight: '#6b655f',
        roofRidge: '#e7e5e4',
        wall: '#c78c52',
        wallShade: '#9e6936',
        cornice: '#f5f5f4',
        timber: '#5c2d0c',
        shutter: '#dc2626',
      },
      {
        outline: '#1e293b',
        roofShadow: '#1e293b',
        roofMid: '#334155',
        roofLight: '#526580',
        roofRidge: '#cbd5e1',
        wall: '#f5f2eb',
        wallShade: '#d6cfc2',
        cornice: '#9c6631',
        timber: '#78350f',
        shutter: '#15803d',
      },
      {
        outline: '#1c1917',
        roofShadow: '#27272a',
        roofMid: '#3f3f46',
        roofLight: '#63636e',
        roofRidge: '#e4e4e7',
        wall: '#e6d5bd',
        wallShade: '#c4ae91',
        cornice: '#78350f',
        timber: '#5c2d0c',
        shutter: '#991b1b',
      },
    ],
  },

  auvergne_volcan: {
    id: 'auvergne_volcan',
    shortLabel: 'Basalte & Estives',
    fullLabel: 'Massif Volcanique · Pierre de Volvic & Estives',
    architectureNote: 'Maçonnerie sombre en basalte et trachy-andésite, toits de lauzes et hauts pâturages',
    meadow: ['#338236', '#469e43', '#5eba54', '#9be858'],
    elevatedHigh: ['#4a993d', '#60b34d', '#7acc5e', '#bef264'],
    elevatedLow: ['#24662c', '#338039', '#459948', '#75d466'],
    courtyard: ['#4f8546', '#639c57', '#7ab369', '#a6d98c'],
    forestFloor: ['#12361e', '#1a4a2a', '#246339', '#3f8c54'],
    scrub: ['#485e32', '#5d7842', '#759155', '#facc15', '#c084fc'],
    mainRoad: ['#3f3f46', '#71717a', '#52525b', '#63636e', '#a1a1aa'], // Pierre de Volvic sombre!
    street: ['#383533', '#78716c', '#57534e', '#8c857e', '#bdb6ae'],
    plaza: ['#44403c', '#8c857e', '#78716c', '#d6d3d1'],
    cliff: ['#3f3f46', '#a1a1aa', '#63636e', '#27272a', '#09090b'], // Orgues basaltiques!
    hasSteppedGables: false,
    colombageStyle: 'none',
    hasAlpineWoodBalcony: false,
    isCanalTile: false,
    isGraniteQuoins: false,
    isDarkBasalt: true,
    floraMode: 'atlantic_bocage',
    urbanPalettes: [
      {
        outline: '#09090b',
        roofShadow: '#18181b',
        roofMid: '#27272a',
        roofLight: '#475569',
        roofRidge: '#94a3b8',
        wall: '#78716c',
        wallShade: '#57534e',
        cornice: '#d6d3d1',
        timber: '#27272a',
        shutter: '#f8fafc',
      },
      {
        outline: '#0f172a',
        roofShadow: '#4f2419',
        roofMid: '#783524',
        roofLight: '#9e4832',
        roofRidge: '#fdba74',
        wall: '#8c857e',
        wallShade: '#66605b',
        cornice: '#e7e5e4',
        timber: '#3f3f46',
        shutter: '#1d4ed8',
      },
      {
        outline: '#09090b',
        roofShadow: '#1e293b',
        roofMid: '#334155',
        roofLight: '#526580',
        roofRidge: '#cbd5e1',
        wall: '#d6cfc7',
        wallShade: '#a89f96',
        cornice: '#52525b',
        timber: '#3f3f46',
        shutter: '#991b1b',
      },
    ],
    villagePalettes: [
      {
        // Buron / maison auvergnate en pierre volcanique sombre et joints clairs
        outline: '#09090b',
        roofShadow: '#18181b',
        roofMid: '#2e3440',
        roofLight: '#4c566a',
        roofRidge: '#94a3b8',
        wall: '#78716c',
        wallShade: '#57534e',
        cornice: '#d6d3d1',
        timber: '#44403c',
        shutter: '#f8fafc',
      },
      {
        outline: '#0f172a',
        roofShadow: '#572418',
        roofMid: '#803624',
        roofLight: '#a84a32',
        roofRidge: '#fdba74',
        wall: '#8f8881',
        wallShade: '#69625c',
        cornice: '#e7e5e4',
        timber: '#44403c',
        shutter: '#dc2626',
      },
      {
        outline: '#18181b',
        roofShadow: '#1e293b',
        roofMid: '#334155',
        roofLight: '#526580',
        roofRidge: '#cbd5e1',
        wall: '#dfd7cc',
        wallShade: '#b5aba0',
        cornice: '#57534e',
        timber: '#3f3f46',
        shutter: '#15803d',
      },
    ],
    suburbanPalettes: [
      {
        outline: '#18181b',
        roofShadow: '#1e293b',
        roofMid: '#334155',
        roofLight: '#526580',
        roofRidge: '#94a3b8',
        wall: '#f5f2ed',
        wallShade: '#cfc8be',
        cornice: '#57534e',
        timber: '#3f3f46',
        shutter: '#334155',
      },
      {
        outline: '#18181b',
        roofShadow: '#5c2619',
        roofMid: '#873825',
        roofLight: '#b04c35',
        roofRidge: '#fdba74',
        wall: '#e6dfd5',
        wallShade: '#bfb5a8',
        cornice: '#57534e',
        timber: '#44403c',
        shutter: '#991b1b',
      },
      {
        outline: '#09090b',
        roofShadow: '#18181b',
        roofMid: '#27272a',
        roofLight: '#475569',
        roofRidge: '#94a3b8',
        wall: '#a8a29e',
        wallShade: '#78716c',
        cornice: '#e7e5e4',
        timber: '#27272a',
        shutter: '#f8fafc',
      },
    ],
  },
};

export function getRegionalThemeById(id: RegionalStyleId): RegionalTheme {
  return REGIONAL_THEMES[id] || REGIONAL_THEMES.bassin_calcaire;
}

/**
 * Resolves the authentic 16-bit Regional Tileset & Vernacular Architecture Style
 * by crossing real GPS coordinates, DEM elevation, and Macrostrat/BRGM bedrock lithology.
 */
export function resolveRegionalTheme(params: {
  lat: number;
  lng: number;
  elevation?: ElevationGrid | null;
  bedrock?: BedrockInfo | null;
  terrain?: TerrainFeature[];
}): RegionalTheme {
  const { lat, lng, elevation, bedrock } = params;
  const avgElev = elevation ? (elevation.minMeters + elevation.maxMeters) * 0.5 : 80;
  const maxElev = elevation ? elevation.maxMeters : 80;
  const litho = `${bedrock?.lithology || ''} ${bedrock?.environment || ''}`.toLowerCase();

  // 1. High-Altitude Mountain & Subalpine Biome (Alps, Pyrenees, High Jura, High Massif Central >= 820m)
  if (avgElev >= 820 || (maxElev >= 980 && avgElev >= 680)) {
    if (
      /basalt|volcan|trachyt|andésit|pouzzolan/i.test(litho) ||
      (lat >= 44.7 && lat <= 46.0 && lng >= 2.3 && lng <= 4.3 && avgElev < 1350)
    ) {
      return REGIONAL_THEMES.auvergne_volcan;
    }
    return REGIONAL_THEMES.alpin_montagne;
  }

  // 2. Volcanic Massif Central / Basaltic Bedrock (Chaîne des Puys, Cantal, Velay, Aubrac, Agde basalt)
  if (
    /basalt|volcan|trachyt|andésit|scorie/i.test(litho) ||
    (lat >= 44.85 && lat <= 45.95 && lng >= 2.55 && lng <= 3.35 && avgElev >= 380)
  ) {
    return REGIONAL_THEMES.auvergne_volcan;
  }

  // 3. Alsace, Vosges & Pays d'Auge Half-Timbered Tradition (Colombages & Grès Rose)
  const inAlsaceVosges = lat >= 47.42 && lat <= 49.18 && lng >= 6.75 && lng <= 8.3;
  const inPaysDAuge = lat >= 49.02 && lat <= 49.44 && lng >= -0.25 && lng <= 0.62;
  if (inAlsaceVosges || inPaysDAuge) {
    return REGIONAL_THEMES.alsace_colombage;
  }

  // 4. Northern France / Flanders / Artois / Somme Red-Brick & Stepped Gables Belt
  const inFlandresArtois = lat >= 49.78 && lat <= 51.2 && lng >= 1.45 && lng <= 4.35;
  if (inFlandresArtois) {
    return REGIONAL_THEMES.flandres_brique;
  }

  // 5. Mediterranean, Provence, Occitanie, Corsica & Southern Aquitaine (Roman Canal Tiles & Ochre)
  const inMediterraneanSouth =
    (lat >= 41.2 && lat <= 44.58 && lng >= -1.85 && lng <= 9.7) ||
    (lat >= 44.58 && lat <= 45.05 && lng >= -1.25 && lng <= 0.95) || // Gironde / Dordogne Sud
    (lat >= 44.58 && lat <= 45.05 && lng >= 4.45 && lng <= 5.65); // Drôme provençale / Ardèche méridionale
  if (inMediterraneanSouth) {
    return REGIONAL_THEMES.midi_ocre;
  }

  // 6. Armorican Massif, Brittany, Cotentin, Limousin & Crystalline Granite/Slate Terrains
  const inBrittanyCotentin =
    (lat >= 47.05 && lat <= 49.75 && lng <= -1.02) ||
    (lat >= 45.25 && lat <= 46.45 && lng >= 0.95 && lng <= 2.35); // Limousin granitique
  const isGraniticCrystalline = /granit|gneiss|micaschist|schist|ardoise|quartzit/i.test(litho);
  if (inBrittanyCotentin || (isGraniticCrystalline && (lng <= 0.5 || lat >= 49.5))) {
    return REGIONAL_THEMES.armorique_granit;
  }

  // 7. Classic French Limestone / Tuffeau / Chalk Basin (Paris, Val de Loire, Bourgogne, Champagne, Charentes)
  return REGIONAL_THEMES.bassin_calcaire;
}

/**
 * Resolves the Subterranean Lithology & Dungeon Architecture Profile from real `BedrockInfo`.
 */
export function resolveSubterraneanLithoProfile(
  bedrock: BedrockInfo | null | undefined
): SubterraneanLithoProfile {
  const lithoText = `${bedrock?.lithology || ''} ${bedrock?.environment || ''}`.toLowerCase();

  if (/basalt|volcan|trachyt|andésit|magma|lave/i.test(lithoText)) {
    return {
      id: 'basalte_volcanique',
      shortLabel: 'Basalte Volcanique',
      galleryStyleLabel: 'Prismes basaltiques & veines géothermales',
      base: '#16161c',
      dark: '#09090d',
      mid: '#252530',
      wallFace: '#383847',
      wallTop: '#63667a',
      vein: '#f97316',
      crystalGlow: '#fb923c',
      floorBase: '#2d2a32',
      floorTile: '#403c47',
      floorJoint: '#1c1a21',
      useTimberProps: false,
      hasKarstStalagmites: false,
    };
  }

  if (/schist|ardoise|houill|charbon|argil|marne\s+noire/i.test(lithoText)) {
    return {
      id: 'schiste_houiller',
      shortLabel: 'Schiste & Veine Boisée',
      galleryStyleLabel: 'Galeries boisées sur étançons & strates schisteuses',
      base: '#17202b',
      dark: '#0d131a',
      mid: '#233142',
      wallFace: '#34475e',
      wallTop: '#5b7694',
      vein: '#cbd5e1',
      crystalGlow: '#38bdf8',
      floorBase: '#3b352e',
      floorTile: '#52493f',
      floorJoint: '#26211c',
      useTimberProps: true,
      hasKarstStalagmites: false,
    };
  }

  if (/granit|gneiss|cristal|métamorph|migmatit/i.test(lithoText)) {
    return {
      id: 'granit_cristallin',
      shortLabel: 'Socle Granitique',
      galleryStyleLabel: 'Parois cristallines & filons de quartz',
      base: '#1c222e',
      dark: '#10151f',
      mid: '#2a3447',
      wallFace: '#404e66',
      wallTop: '#7184a3',
      vein: '#e9d5ff',
      crystalGlow: '#c084fc',
      floorBase: '#424752',
      floorTile: '#585f6e',
      floorJoint: '#292d36',
      useTimberProps: true,
      hasKarstStalagmites: false,
    };
  }

  if (/gr[èe]s|sable|quartzit|ferrug|alluvion|gravier/i.test(lithoText)) {
    return {
      id: 'gres_ferrugineux',
      shortLabel: 'Grès & Sables Anciens',
      galleryStyleLabel: 'Voûtes troglodytiques & bancs gréseux',
      base: '#2b1913',
      dark: '#190d09',
      mid: '#42261d',
      wallFace: '#633829',
      wallTop: '#9a5b42',
      vein: '#f59e0b',
      crystalGlow: '#fbbf24',
      floorBase: '#593b28',
      floorTile: '#734e36',
      floorJoint: '#3b2619',
      useTimberProps: false,
      hasKarstStalagmites: false,
    };
  }

  return {
    id: 'calcaire_karst',
    shortLabel: 'Calcaire & Karst',
    galleryStyleLabel: 'Piliers tournés de carrière & concrétions karstiques',
    base: '#251c13',
    dark: '#140e09',
    mid: '#382a1c',
    wallFace: '#57422c',
    wallTop: '#8a6d4b',
    vein: '#d6be96',
    crystalGlow: '#22d3ee',
    floorBase: '#5c4d3c',
    floorTile: '#73614d',
    floorJoint: '#3d3226',
    useTimberProps: false,
    hasKarstStalagmites: true,
  };
}
