import {
  CATEGORY_META,
  computeLevelFromXp,
  ExplorationCategory,
  ExplorerOutfitId,
  ExplorerProgress,
  getCategoryXp,
  PoiItem,
  STRATUM_META,
  TerrainFeature,
  UnlockedEntry,
} from './types';

// ============================================================================
// 1. TALENTS PASSIFS & ACTIFS DE TERRAIN DES 5 GUILDES
// ============================================================================
export interface ActiveGuildPerks {
  histoireLevel: number;
  geographieLevel: number;
  legendeLevel: number;
  etrangeLevel: number;
  ecosystemeLevel: number;
  /** Draws red/gold chronicle threads linking related POIs on the 16-bit map */
  chroniqueurThreads: boolean;
  /** Extra unlock/resonance radius (m) near rivers, canals & fountains */
  waterwayBonusMeters: number;
  /** Unlocks live topographic elevation cross-section to targeted POI */
  elevationProfileUnlocked: boolean;
  /** Spectral lantern range (m) piercing mystery '?' seals to reveal era & subType */
  spectralLanternMeters: number;
  /** Extra fog-of-war clearing radius (m) */
  fogVisionBonusMeters: number;
  /** % XP bonus at Dusk/Night or under Rain/Snow/Fog/Storm */
  atmosphereXpBonusPct: number;
}

export function computeGuildPerks(progress: ExplorerProgress): ActiveGuildPerks {
  const hLvl = computeLevelFromXp(getCategoryXp(progress, 'histoire')).level;
  const gLvl = computeLevelFromXp(getCategoryXp(progress, 'geographie')).level;
  const lLvl = computeLevelFromXp(getCategoryXp(progress, 'legende')).level;
  const eLvl = computeLevelFromXp(getCategoryXp(progress, 'etrange')).level;
  const ecoLvl = computeLevelFromXp(getCategoryXp(progress, 'ecosysteme')).level;

  return {
    histoireLevel: hLvl,
    geographieLevel: gLvl,
    legendeLevel: lLvl,
    etrangeLevel: eLvl,
    ecosystemeLevel: ecoLvl,
    chroniqueurThreads: hLvl >= 1,
    waterwayBonusMeters: gLvl >= 3 ? 40 : gLvl >= 2 ? 28 : 15,
    elevationProfileUnlocked: gLvl >= 1,
    spectralLanternMeters: eLvl >= 3 ? 380 : eLvl >= 2 ? 260 : 145,
    fogVisionBonusMeters: ecoLvl >= 3 ? 40 : ecoLvl >= 2 ? 25 : 10,
    atmosphereXpBonusPct: lLvl >= 3 ? 30 : lLvl >= 2 ? 20 : 10,
  };
}

export const GUILD_PERK_DESCRIPTIONS: Record<
  ExplorationCategory,
  { perkName: string; tier1: string; tier2: string }
> = {
  histoire: {
    perkName: 'Fils d’Ariane du Chroniqueur',
    tier1: 'Tisse sur la carte 16-bit les fils d’or et de pourpre reliant les lieux connexes.',
    tier2: 'Niv. 2+ : Révèle les échos éloignés et débloque le Manteau du Chroniqueur.',
  },
  geographie: {
    perkName: 'Résonance Hydrologique & Coupe Topographique',
    tier1: 'Portée de sceau +15 m près de l’eau et profil altimétrique 16-bit vers la cible.',
    tier2: 'Niv. 2+ : Portée +28 m au fil de l’eau et débloque la Cape Géomancienne.',
  },
  legende: {
    perkName: 'Veillée des Contes & Brumes',
    tier1: 'Bonus +10 % XP lors des explorations au crépuscule, de nuit ou sous la pluie.',
    tier2: 'Niv. 2+ : Bonus porté à +20 % XP et débloque l’Habit du Barde des Mythes.',
  },
  etrange: {
    perkName: 'Lanterne Spectrale des Ombres',
    tier1: 'Perce le voile des sceaux « ? » à moins de 145 m (époque & nature révélées).',
    tier2: 'Niv. 2+ : Portée spectrale étendue à 260 m et débloque la Capuche des Ombres.',
  },
  ecosysteme: {
    perkName: 'Pas Sylvestre & Regard de Cime',
    tier1: 'Étend le rayon de dissipation du brouillard Terra Incognita (+10 m).',
    tier2: 'Niv. 2+ : Rayon étendu (+25 m) et débloque la Pèlerine Sylvestre.',
  },
};

// ============================================================================
// 2. GARDE-ROBE 16-BIT DE L'EXPLORATRICE
// ============================================================================
export interface OutfitDefinition {
  id: ExplorerOutfitId;
  name: string;
  subtitle: string;
  requiredCategory: ExplorationCategory | null;
  requiredLevel: number;
  palette: {
    coatDark: string;
    coatMid: string;
    coatLight: string;
    scarfDark: string;
    scarfLight: string;
    hatBrim: string;
    hatMid: string;
    hatLight: string;
    pauldron: string;
    lanternCore: string;
    lanternAuraRgba: string;
  };
}

export const OUTFITS_CATALOG: OutfitDefinition[] = [
  {
    id: 'arpenteur',
    name: 'Tunique d’Arpenteuse',
    subtitle: 'Tenue initiale · Cuir fauve, manteau vert mousse & écharpe carmin',
    requiredCategory: null,
    requiredLevel: 1,
    palette: {
      coatDark: '#14532d',
      coatMid: '#15803d',
      coatLight: '#22c55e',
      scarfDark: '#b91c1c',
      scarfLight: '#ef4444',
      hatBrim: '#78350f',
      hatMid: '#b45309',
      hatLight: '#d97706',
      pauldron: '#f59e0b',
      lanternCore: '#fde047',
      lanternAuraRgba: 'rgba(251, 191, 36, 0.20)',
    },
  },
  {
    id: 'chroniqueur',
    name: 'Manteau du Chroniqueur',
    subtitle: 'Guilde Histoire (Niv. 2) · Velours pourpre royal & galons d’or',
    requiredCategory: 'histoire',
    requiredLevel: 2,
    palette: {
      coatDark: '#7f1d1d',
      coatMid: '#991b1b',
      coatLight: '#dc2626',
      scarfDark: '#b45309',
      scarfLight: '#fde047',
      hatBrim: '#451a03',
      hatMid: '#991b1b',
      hatLight: '#f59e0b',
      pauldron: '#fef08a',
      lanternCore: '#fef08a',
      lanternAuraRgba: 'rgba(253, 224, 71, 0.24)',
    },
  },
  {
    id: 'geomancien',
    name: 'Cape Géomancienne',
    subtitle: 'Guilde Géologie (Niv. 2) · Drap azur minéral & cristal de quartz',
    requiredCategory: 'geographie',
    requiredLevel: 2,
    palette: {
      coatDark: '#0c4a6e',
      coatMid: '#0369a1',
      coatLight: '#38bdf8',
      scarfDark: '#d97706',
      scarfLight: '#fde68a',
      hatBrim: '#082f49',
      hatMid: '#0284c7',
      hatLight: '#7dd3fc',
      pauldron: '#bae6fd',
      lanternCore: '#7dd3fc',
      lanternAuraRgba: 'rgba(56, 189, 248, 0.24)',
    },
  },
  {
    id: 'barde',
    name: 'Habit du Chasseur de Mythes',
    subtitle: 'Guilde Légendes (Niv. 2) · Soie améthyste & feu-follet doré',
    requiredCategory: 'legende',
    requiredLevel: 2,
    palette: {
      coatDark: '#3b0764',
      coatMid: '#6b21a8',
      coatLight: '#a855f7',
      scarfDark: '#be185d',
      scarfLight: '#f472b6',
      hatBrim: '#2e1065',
      hatMid: '#7e22ce',
      hatLight: '#c084fc',
      pauldron: '#fde047',
      lanternCore: '#f0abfc',
      lanternAuraRgba: 'rgba(216, 180, 254, 0.25)',
    },
  },
  {
    id: 'ombres',
    name: 'Capuche de l’Éclaireur des Ombres',
    subtitle: 'Guilde Souterrains (Niv. 2) · Ardoise nocturne & flamme spectrale',
    requiredCategory: 'etrange',
    requiredLevel: 2,
    palette: {
      coatDark: '#1c1917',
      coatMid: '#334155',
      coatLight: '#64748b',
      scarfDark: '#9f1239',
      scarfLight: '#fb7185',
      hatBrim: '#0f172a',
      hatMid: '#1e293b',
      hatLight: '#475569',
      pauldron: '#f43f5e',
      lanternCore: '#67e8f9',
      lanternAuraRgba: 'rgba(103, 232, 249, 0.24)',
    },
  },
  {
    id: 'sylvestre',
    name: 'Pèlerine du Naturaliste',
    subtitle: 'Guilde Écosystème (Niv. 2) · Feuillage d’émeraude & écorce d’ambre',
    requiredCategory: 'ecosysteme',
    requiredLevel: 2,
    palette: {
      coatDark: '#064e3b',
      coatMid: '#059669',
      coatLight: '#34d399',
      scarfDark: '#92400e',
      scarfLight: '#fbbf24',
      hatBrim: '#14532d',
      hatMid: '#15803d',
      hatLight: '#4ade80',
      pauldron: '#a7f3d0',
      lanternCore: '#bef264',
      lanternAuraRgba: 'rgba(163, 230, 53, 0.22)',
    },
  },
];

export function getOutfitById(id?: ExplorerOutfitId): OutfitDefinition {
  return OUTFITS_CATALOG.find((o) => o.id === id) || OUTFITS_CATALOG[0];
}

export function isOutfitUnlocked(outfit: OutfitDefinition, progress: ExplorerProgress): boolean {
  if (!outfit.requiredCategory) return true;
  const globalLvl = computeLevelFromXp(progress.totalXp).level;
  const catLvl = computeLevelFromXp(getCategoryXp(progress, outfit.requiredCategory)).level;
  return catLvl >= outfit.requiredLevel || globalLvl >= outfit.requiredLevel + 1;
}

// ============================================================================
// 3. CONTRATS DYNAMIQUES DE CONTRÉE (Générés à partir des POIs du secteur réel)
// ============================================================================
export interface DynamicSectorContract {
  id: string;
  sectorKey: string;
  title: string;
  description: string;
  category: ExplorationCategory;
  xpBonus: number;
  targetPoiIds: string[];
  targetCount: number;
}

const CLAIMED_CONTRACTS_KEY = 'terra16_claimed_sector_contracts_v1';

export function loadClaimedSectorContracts(): Set<string> {
  try {
    const raw = localStorage.getItem(CLAIMED_CONTRACTS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

export function saveClaimedSectorContracts(set: Set<string>): void {
  try {
    localStorage.setItem(CLAIMED_CONTRACTS_KEY, JSON.stringify(Array.from(set).slice(-300)));
  } catch {
    // Ignore
  }
}

export function generateDynamicSectorContracts(
  centerLat: number,
  centerLng: number,
  pois: PoiItem[],
  terrain: TerrainFeature[]
): DynamicSectorContract[] {
  if (pois.length === 0) return [];
  const sectorKey = `${centerLat.toFixed(2)}_${centerLng.toFixed(2)}`;
  const contracts: DynamicSectorContract[] = [];

  // Contract 1: Dominant Guild in this real-world sector
  const countsByCat = new Map<ExplorationCategory, PoiItem[]>();
  for (const p of pois) {
    const arr = countsByCat.get(p.category) || [];
    arr.push(p);
    countsByCat.set(p.category, arr);
  }
  const sortedCats = Array.from(countsByCat.entries()).sort((a, b) => b[1].length - a[1].length);
  if (sortedCats.length > 0 && sortedCats[0][1].length >= 2) {
    const [domCat, catPois] = sortedCats[0];
    const targetCount = Math.min(3, catPois.length);
    contracts.push({
      id: `dyn_cat_${sectorKey}_${domCat}`,
      sectorKey,
      title: `Mandat local : ${CATEGORY_META[domCat].shortLabel}`,
      description: `Ce secteur est riche en archives « ${CATEGORY_META[domCat].label} ». Révélez ${targetCount} sceaux de cette Guilde dans les environs.`,
      category: domCat,
      xpBonus: targetCount * 65,
      targetPoiIds: catPois.map((p) => p.id),
      targetCount,
    });
  }

  // Contract 2: Waterway / River Exploration if a river or fountain network crosses this sector
  const waterPois = pois.filter((p) => p.nearWaterway);
  const namedWater =
    waterPois.find((p) => p.waterwayName)?.waterwayName ||
    terrain.find((t) => (t.kind === 'waterway' || t.kind === 'water') && t.name)?.name ||
    '';
  if (waterPois.length >= 2) {
    const targetCount = Math.min(2, waterPois.length);
    contracts.push({
      id: `dyn_water_${sectorKey}`,
      sectorKey,
      title: namedWater ? `Sentinelle de « ${namedWater} »` : 'Arpenteur des Berges Locales',
      description: `Suivez le fil de l’eau${
        namedWater ? ` (${namedWater})` : ''
      } et brisez ${targetCount} sceaux liés au réseau hydrographique de ce secteur.`,
      category: 'geographie',
      xpBonus: 140,
      targetPoiIds: waterPois.map((p) => p.id),
      targetCount,
    });
  }

  // Contract 3: Dominant Historical Stratum or Connected Pair in this sector
  const countsByStrat = new Map<PoiItem['stratum'], PoiItem[]>();
  for (const p of pois) {
    const arr = countsByStrat.get(p.stratum) || [];
    arr.push(p);
    countsByStrat.set(p.stratum, arr);
  }
  const sortedStrats = Array.from(countsByStrat.entries()).sort((a, b) => b[1].length - a[1].length);
  if (sortedStrats.length > 0 && sortedStrats[0][1].length >= 2) {
    const [domStrat, stratPois] = sortedStrats[0];
    const targetCount = Math.min(2, stratPois.length);
    contracts.push({
      id: `dyn_strat_${sectorKey}_${domStrat}`,
      sectorKey,
      title: `Enquête stratigraphique : ${STRATUM_META[domStrat].short}`,
      description: `Comparez ${targetCount} témoignages locaux appartenant à la strate « ${STRATUM_META[domStrat].label} ».`,
      category: stratPois[0].category,
      xpBonus: 135,
      targetPoiIds: stratPois.map((p) => p.id),
      targetCount,
    });
  }

  return contracts.slice(0, 3);
}

export function evaluateDynamicContract(
  contract: DynamicSectorContract,
  entries: UnlockedEntry[]
): { current: number; target: number } {
  const unlockedSet = new Set(entries.map((e) => e.poiId));
  let hits = 0;
  for (const pid of contract.targetPoiIds) {
    if (unlockedSet.has(pid)) hits++;
  }
  return {
    current: Math.min(contract.targetCount, hits),
    target: contract.targetCount,
  };
}
