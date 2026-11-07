import { CHEST_ARCHETYPE_META, WorldArchivistChestNode } from './treasures';
import {
  BedrockInfo,
  CATEGORY_META,
  computeLevelFromXp,
  EffectiveTimeOfDay,
  ElevationGrid,
  ExplorationCategory,
  ExplorerOutfitId,
  ExplorerProgress,
  getCategoryXp,
  haversineMeters,
  OpenedArchivistChestRecord,
  PoiItem,
  STRATUM_META,
  TerrainFeature,
  UnlockedEntry,
  WeatherInfo,
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
  minClaimedAlmanac?: number;
  minCompletedHunts?: number;
  minCompletedNarratives?: number;
  lockRequirementLabel?: string;
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
  {
    id: 'almanach_solaire',
    name: 'Manteau de l’Almanach Solaire',
    subtitle: 'Almanach (2 quêtes calendaires) · Drap ivoire céleste, broderies d’or & équinoxe',
    requiredCategory: null,
    requiredLevel: 1,
    minClaimedAlmanac: 2,
    lockRequirementLabel: '2 quêtes de l’Almanach',
    palette: {
      coatDark: '#92400e',
      coatMid: '#d97706',
      coatLight: '#fde68a',
      scarfDark: '#0369a1',
      scarfLight: '#7dd3fc',
      hatBrim: '#78350f',
      hatMid: '#b45309',
      hatLight: '#fde047',
      pauldron: '#fef9c3',
      lanternCore: '#fef08a',
      lanternAuraRgba: 'rgba(253, 224, 71, 0.26)',
    },
  },
  {
    id: 'chasseur_reliques',
    name: 'Pelisse de Maître des Pistes',
    subtitle: 'Chasse aux Trésors (3 pistes) · Cuir corsaire moka, revers carmin & boucles d’or',
    requiredCategory: null,
    requiredLevel: 1,
    minCompletedHunts: 3,
    lockRequirementLabel: '3 chasses aux trésors',
    palette: {
      coatDark: '#451a03',
      coatMid: '#78350f',
      coatLight: '#b45309',
      scarfDark: '#881337',
      scarfLight: '#f43f5e',
      hatBrim: '#1c1917',
      hatMid: '#44403c',
      hatLight: '#d97706',
      pauldron: '#fbbf24',
      lanternCore: '#fbbf24',
      lanternAuraRgba: 'rgba(251, 191, 36, 0.24)',
    },
  },
  {
    id: 'conteuse_legende',
    name: 'Manteau Enluminé des Récits',
    subtitle: 'Quêtes Narratives (2 trilogies) · Brocart outremer enluminé d’or & écharpe ivoire',
    requiredCategory: null,
    requiredLevel: 1,
    minCompletedNarratives: 2,
    lockRequirementLabel: '2 quêtes narratives',
    palette: {
      coatDark: '#172554',
      coatMid: '#1d4ed8',
      coatLight: '#60a5fa',
      scarfDark: '#b45309',
      scarfLight: '#fef3c7',
      hatBrim: '#1e1b4b',
      hatMid: '#312e81',
      hatLight: '#fbbf24',
      pauldron: '#fde047',
      lanternCore: '#fef08a',
      lanternAuraRgba: 'rgba(253, 224, 71, 0.26)',
    },
  },
  {
    id: 'tenue_friches_urbex',
    name: 'Tenue d’Exploration des Friches',
    subtitle: 'Friches Cerema & Urbex · Parka tout-terrain olive, renforts d’acier & écharpe de laiton',
    requiredCategory: 'etrange',
    requiredLevel: 1,
    palette: {
      coatDark: '#142907',
      coatMid: '#365314',
      coatLight: '#65a30d',
      scarfDark: '#78350f',
      scarfLight: '#facc15',
      hatBrim: '#1c1917',
      hatMid: '#3f3f46',
      hatLight: '#a1a1aa',
      pauldron: '#bef264',
      lanternCore: '#a3e635',
      lanternAuraRgba: 'rgba(163, 230, 53, 0.25)',
    },
  },
  {
    id: 'manteau_quatre_saisons',
    name: 'Manteau des Quatre Saisons des Marcheurs',
    subtitle: 'Défi Annuel (365 km) · Étoffe d’or boréale, doublure de givre & ramages printaniers',
    requiredCategory: null,
    requiredLevel: 1,
    lockRequirementLabel: 'Défi Annuel de Marche (365 km)',
    palette: {
      coatDark: '#1e3a5f',
      coatMid: '#2563eb',
      coatLight: '#60a5fa',
      scarfDark: '#b45309',
      scarfLight: '#fde047',
      hatBrim: '#1e293b',
      hatMid: '#334155',
      hatLight: '#94a3b8',
      pauldron: '#facc15',
      lanternCore: '#38bdf8',
      lanternAuraRgba: 'rgba(56, 189, 248, 0.28)',
    },
  },
  {
    id: 'tabard_maitres_marcheurs',
    name: 'Tabard des Maîtres-Marcheurs',
    subtitle: 'Défi Événement (20 km) · Tabard héraldique écarlate, liseré d’argent & lauriers brodés',
    requiredCategory: null,
    requiredLevel: 1,
    lockRequirementLabel: 'Défi Événementiel de Marche (20 km)',
    palette: {
      coatDark: '#881337',
      coatMid: '#be123c',
      coatLight: '#f43f5e',
      scarfDark: '#334155',
      scarfLight: '#e2e8f0',
      hatBrim: '#4c0519',
      hatMid: '#9f1239',
      hatLight: '#fecdd3',
      pauldron: '#e2e8f0',
      lanternCore: '#fde047',
      lanternAuraRgba: 'rgba(253, 224, 71, 0.26)',
    },
  },
];

export function getOutfitById(id?: ExplorerOutfitId): OutfitDefinition {
  return OUTFITS_CATALOG.find((o) => o.id === id) || OUTFITS_CATALOG[0];
}

export function isOutfitUnlocked(outfit: OutfitDefinition, progress: ExplorerProgress): boolean {
  if (outfit.id === 'manteau_quatre_saisons') {
    return (
      (progress.claimedWalkingChallengeIds || []).includes('ann_365km') ||
      (progress.walkedMeters || 0) >= 365_000
    );
  }
  if (outfit.id === 'tabard_maitres_marcheurs') {
    return (
      (progress.claimedWalkingChallengeIds || []).includes('ev_semaine_mobilite') ||
      (progress.walkedMeters || 0) >= 20_000
    );
  }
  if (outfit.minClaimedAlmanac) {
    return (progress.claimedAlmanacCount || 0) >= outfit.minClaimedAlmanac;
  }
  if (outfit.minCompletedHunts) {
    return (progress.completedHuntsCount || 0) >= outfit.minCompletedHunts;
  }
  if (outfit.minCompletedNarratives) {
    return (progress.completedNarrativesCount || 0) >= outfit.minCompletedNarratives;
  }
  if (!outfit.requiredCategory) return true;
  const globalLvl = computeLevelFromXp(progress.totalXp).level;
  const catLvl = computeLevelFromXp(getCategoryXp(progress, outfit.requiredCategory)).level;
  return catLvl >= outfit.requiredLevel || globalLvl >= outfit.requiredLevel + 1;
}

// ============================================================================
// 3. CONTRATS DYNAMIQUES DE CONTRÉE (Générés à la volée sur le secteur réel)
// ============================================================================
export type DynamicContractArchetype = 'triangulation' | 'coffre_meteo' | 'mandat_terroir';

export interface DynamicContractStep {
  id: string;
  label: string;
  shortTag: string;
  kind: 'poi' | 'chest' | 'summit';
  lat: number;
  lng: number;
  isSubterranean: boolean;
  poiId?: string;
  chestId?: string;
  altitudeMeters?: number | null;
  reachRadiusMeters: number;
}

export interface DynamicSectorContract {
  id: string;
  sectorKey: string;
  archetype: DynamicContractArchetype;
  kicker: string;
  title: string;
  description: string;
  category: ExplorationCategory;
  xpBonus: number;
  weatherBonusXp: number;
  weatherConditionLabel: string;
  isWeatherBonusActive: boolean;
  steps: DynamicContractStep[];
  /** Optional pool when any `targetCount` out of `targetPoiIds` satisfies the mandate */
  targetPoiIds: string[];
  targetChestId?: string;
  targetCount: number;
}

const CLAIMED_CONTRACTS_KEY = 'terra16_claimed_sector_contracts_v1';
const VISITED_CONTRACT_STEPS_KEY = 'terra16_visited_contract_steps_v1';

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
    // Ignore storage quota
  }
}

export function loadVisitedContractSteps(): Set<string> {
  try {
    const raw = localStorage.getItem(VISITED_CONTRACT_STEPS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

export function saveVisitedContractSteps(set: Set<string>): void {
  try {
    localStorage.setItem(VISITED_CONTRACT_STEPS_KEY, JSON.stringify(Array.from(set).slice(-500)));
  } catch {
    // Ignore storage quota
  }
}

function findHighestPointInGrid(
  grid: ElevationGrid | null | undefined,
  fallbackLat: number,
  fallbackLng: number
): { lat: number; lng: number; altitudeMeters: number } | null {
  if (!grid || !grid.elevDm || grid.elevDm.length < grid.cols * grid.rows) return null;
  const reliefSpan = grid.maxMeters - grid.minMeters;
  if (reliefSpan < 4) return null;

  const cosLat = Math.max(0.15, Math.cos((grid.centerLat * Math.PI) / 180));
  const halfX = (grid.cols - 1) / 2;
  const halfY = (grid.rows - 1) / 2;

  let bestDm = -Infinity;
  let bestCol = Math.floor(halfX);
  let bestRow = Math.floor(halfY);

  // Avoid extreme outer 1-cell border so the summit is comfortably reachable inside the sector
  const minR = grid.rows > 4 ? 1 : 0;
  const maxR = grid.rows > 4 ? grid.rows - 2 : grid.rows - 1;
  const minC = grid.cols > 4 ? 1 : 0;
  const maxC = grid.cols > 4 ? grid.cols - 2 : grid.cols - 1;

  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const dm = grid.elevDm[r * grid.cols + c];
      if (dm > bestDm) {
        bestDm = dm;
        bestCol = c;
        bestRow = r;
      }
    }
  }

  if (!Number.isFinite(bestDm)) return null;
  const dxMeters = (bestCol - halfX) * grid.stepMeters;
  const dyMeters = (bestRow - halfY) * grid.stepMeters;
  const lat = grid.centerLat - dyMeters / 110540;
  const lng = grid.centerLng + dxMeters / (111320 * cosLat);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { lat: fallbackLat, lng: fallbackLng, altitudeMeters: Math.round(grid.maxMeters) };
  }
  return {
    lat,
    lng,
    altitudeMeters: Math.round(bestDm / 10),
  };
}

function classifyRuralLabel(poi: PoiItem): string {
  const txt = `${poi.subType} ${poi.name}`.toLowerCase();
  if (txt.includes('lavoir')) return 'le lavoir';
  if (txt.includes('moulin')) return 'le moulin';
  if (txt.includes('four')) return 'le four ancien';
  if (txt.includes('fontaine')) return 'la fontaine';
  if (txt.includes('calvaire') || txt.includes('croix') || txt.includes('oratoire')) {
    return 'le calvaire';
  }
  if (txt.includes('puits')) return 'le puits';
  if (txt.includes('pigeonnier') || txt.includes('colombier')) return 'le colombier';
  return 'le patrimoine bâti';
}

function classifySubLabel(poi: PoiItem): string {
  const txt = `${poi.subType} ${poi.name}`.toLowerCase();
  if (txt.includes('cavité') || txt.includes('grotte') || txt.includes('gouffre') || txt.includes('aven')) {
    return 'une cavité';
  }
  if (txt.includes('crypte') || txt.includes('hypogée') || txt.includes('substructions')) {
    return 'une crypte';
  }
  if (txt.includes('enterré') || txt.includes('busé') || txt.includes('aqueduc') || txt.includes('hydraulique')) {
    return 'un cours d’eau enterré';
  }
  if (txt.includes('mine') || txt.includes('carrière') || txt.includes('filon')) {
    return 'une galerie minière';
  }
  return 'le sous-sol';
}

export interface GenerateDynamicContractsParams {
  centerLat: number;
  centerLng: number;
  surfacePois: PoiItem[];
  subterraneanPois: PoiItem[];
  terrain: TerrainFeature[];
  elevation?: ElevationGrid | null;
  bedrock?: BedrockInfo | null;
  worldChests?: WorldArchivistChestNode[];
  weather?: WeatherInfo | null;
  effectiveTime?: EffectiveTimeOfDay;
}

export function generateDynamicSectorContracts(
  params: GenerateDynamicContractsParams
): DynamicSectorContract[] {
  const {
    centerLat,
    centerLng,
    surfacePois,
    subterraneanPois,
    terrain,
    elevation,
    bedrock,
    worldChests = [],
    weather,
    effectiveTime = 'day',
  } = params;

  const allPois = [...surfacePois, ...subterraneanPois];
  if (allPois.length === 0 && worldChests.length === 0) return [];

  const sectorKey = `${centerLat.toFixed(2)}_${centerLng.toFixed(2)}`;
  const contracts: DynamicSectorContract[] = [];

  const isWetOrStormy =
    weather?.condition === 'rain' ||
    weather?.condition === 'storm' ||
    weather?.condition === 'snow' ||
    weather?.condition === 'fog';
  const isNightOrDusk = effectiveTime === 'night' || effectiveTime === 'dusk';
  const atmosActive = isWetOrStormy || isNightOrDusk;

  // ==========================================================================
  // CONTRAT I — TRIANGULATION DE TERRAIN (Relier 3 repères réels du secteur)
  // ==========================================================================
  const vernacularRegex =
    /lavoir|four à pain|four banal|moulin|fontaine|calvaire|croix|oratoire|puits|pigeonnier|colombier/i;
  const ignRegex = /nivellement|géodésique|repère ign|borne géodésique/i;

  const anchorA =
    surfacePois.find((p) => vernacularRegex.test(`${p.subType} ${p.name}`)) ||
    surfacePois.find((p) => p.category === 'histoire' || p.category === 'legende') ||
    surfacePois[0] ||
    null;

  const summitPoint = findHighestPointInGrid(elevation, centerLat, centerLng);
  const ignPoi = surfacePois.find(
    (p) => (!anchorA || p.id !== anchorA.id) && ignRegex.test(`${p.subType} ${p.name} ${p.source}`)
  );

  // Build Anchor B: either real topographic summit (Alt. XXX m) or IGN benchmark / second distinct landmark
  let stepB: DynamicContractStep | null = null;
  let anchorBShortTitle = 'le point culminant';
  if (
    summitPoint &&
    (!anchorA || haversineMeters(anchorA.lat, anchorA.lng, summitPoint.lat, summitPoint.lng) >= 65)
  ) {
    stepB = {
      id: `step_summit_${sectorKey}`,
      label: `Point culminant du secteur (Alt. ${summitPoint.altitudeMeters} m)`,
      shortTag: `Sommet · ${summitPoint.altitudeMeters} m`,
      kind: 'summit',
      lat: summitPoint.lat,
      lng: summitPoint.lng,
      isSubterranean: false,
      altitudeMeters: summitPoint.altitudeMeters,
      reachRadiusMeters: 52,
    };
    anchorBShortTitle = `le sommet (${summitPoint.altitudeMeters} m)`;
  } else if (ignPoi) {
    stepB = {
      id: `step_poi_${ignPoi.id}`,
      label: ignPoi.name,
      shortTag: 'Repère IGN',
      kind: 'poi',
      lat: ignPoi.lat,
      lng: ignPoi.lng,
      isSubterranean: false,
      poiId: ignPoi.id,
      reachRadiusMeters: ignPoi.unlockRadiusMeters || 48,
    };
    anchorBShortTitle = 'la borne IGN';
  } else {
    const secondSurface = surfacePois.find(
      (p) =>
        (!anchorA || p.id !== anchorA.id) &&
        (!anchorA || haversineMeters(anchorA.lat, anchorA.lng, p.lat, p.lng) >= 80)
    );
    if (secondSurface) {
      stepB = {
        id: `step_poi_${secondSurface.id}`,
        label: secondSurface.name,
        shortTag: CATEGORY_META[secondSurface.category].shortLabel,
        kind: 'poi',
        lat: secondSurface.lat,
        lng: secondSurface.lng,
        isSubterranean: false,
        poiId: secondSurface.id,
        reachRadiusMeters: secondSurface.unlockRadiusMeters || 48,
      };
      anchorBShortTitle = 'un repère voisin';
    }
  }

  // Build Anchor C: prioritize a real subterranean cavity / crypt / culverted river
  const subCandidate =
    subterraneanPois.find(
      (sp) =>
        !sp.id.startsWith('subpoi_bed_') &&
        (!anchorA || haversineMeters(anchorA.lat, anchorA.lng, sp.lat, sp.lng) >= 60)
    ) ||
    subterraneanPois[0] ||
    surfacePois.find(
      (p) =>
        p.nearWaterway &&
        (!anchorA || p.id !== anchorA.id) &&
        (!stepB?.poiId || p.id !== stepB.poiId)
    ) ||
    null;

  const triSteps: DynamicContractStep[] = [];
  if (anchorA) {
    triSteps.push({
      id: `step_poi_${anchorA.id}`,
      label: anchorA.name,
      shortTag: 'Surface',
      kind: 'poi',
      lat: anchorA.lat,
      lng: anchorA.lng,
      isSubterranean: Boolean(anchorA.isSubterranean),
      poiId: anchorA.id,
      reachRadiusMeters: anchorA.unlockRadiusMeters || 48,
    });
  }
  if (stepB) {
    triSteps.push(stepB);
  }
  if (subCandidate) {
    triSteps.push({
      id: `step_poi_${subCandidate.id}`,
      label: subCandidate.name,
      shortTag: subCandidate.isSubterranean ? 'Sous-sol' : 'Rive',
      kind: 'poi',
      lat: subCandidate.lat,
      lng: subCandidate.lng,
      isSubterranean: Boolean(subCandidate.isSubterranean),
      poiId: subCandidate.id,
      reachRadiusMeters: subCandidate.unlockRadiusMeters || 58,
    });
  }

  if (triSteps.length >= 2) {
    const labelA = anchorA ? classifyRuralLabel(anchorA) : 'un monument';
    const labelC = subCandidate
      ? subCandidate.isSubterranean
        ? classifySubLabel(subCandidate)
        : 'la rive'
      : 'un troisième repère';
    contracts.push({
      id: `dyn_tri_${sectorKey}`,
      sectorKey,
      archetype: 'triangulation',
      kicker: 'Contrat I · Triangulation géodésique',
      title:
        triSteps.length === 3
          ? `Triangulation : relier ${labelA}, ${anchorBShortTitle} et ${labelC}`
          : `Relevé croisé : relier ${labelA} et ${anchorBShortTitle}`,
      description:
        'Validez successivement ces jalons géographiques réels du secteur pour établir une coupe complète entre patrimoine bâti, relief et sous-sol.',
      category: 'geographie',
      xpBonus: triSteps.length === 3 ? 210 : 145,
      weatherBonusXp: 45,
      weatherConditionLabel: atmosActive
        ? 'Bonus météo / nocturne actif (+45 XP)'
        : 'Bonus +45 XP sous la pluie, l’orage ou de nuit',
      isWeatherBonusActive: atmosActive,
      steps: triSteps,
      targetPoiIds: [],
      targetCount: triSteps.length,
    });
  }

  // ==========================================================================
  // CONTRAT II — CHASSE AU COFFRE GÉOMORPHOLOGIQUE & MÉTÉO
  // ==========================================================================
  if (worldChests.length > 0) {
    // Prefer confluence when wet/riverine, or subterranean mouth / summit / forest cul-de-sac
    const confluenceChest = worldChests.find((c) => c.archetype === 'confluence_eaux');
    const subChest = worldChests.find((c) => c.archetype === 'bouche_souterraine');
    const hillChest = worldChests.find((c) => c.archetype === 'sommet_colline');
    const chosenChest =
      (isWetOrStormy && confluenceChest) ||
      confluenceChest ||
      subChest ||
      hillChest ||
      worldChests[0];

    const archMeta = CHEST_ARCHETYPE_META[chosenChest.archetype];
    let chestTitle = `Exhumer le ${chosenChest.title.toLowerCase()}`;
    if (chosenChest.archetype === 'confluence_eaux') {
      chestTitle =
        weather?.condition === 'rain' || weather?.condition === 'storm'
          ? 'Déterrer un coffre de confluence sous la pluie'
          : 'Déterrer le coffre de confluence des eaux';
    } else if (chosenChest.archetype === 'sommet_colline') {
      chestTitle = isNightOrDusk
        ? 'Ouvrir le coffre des crêtes à la lanterne'
        : 'Exhumer le coffre du promontoire local';
    } else if (chosenChest.archetype === 'bouche_souterraine') {
      chestTitle = 'Sonder le coffre d’Archiviste des profondeurs';
    } else if (chosenChest.archetype === 'cul_de_sac_forestier') {
      chestTitle = 'Débusquer le coffre du sentier en cul-de-sac';
    }

    contracts.push({
      id: `dyn_chest_${chosenChest.chestId}`,
      sectorKey,
      archetype: 'coffre_meteo',
      kicker: `Contrat II · ${archMeta.shortFr} & Intempéries`,
      title: chestTitle,
      description: `Localisez « ${chosenChest.title} » (${chosenChest.placeNote}) à moins de 45 m pour briser son sceau. Les averses, brumes et veillées nocturnes amplifient la prime d’Archiviste.`,
      category: chosenChest.category,
      xpBonus: 165,
      weatherBonusXp: 55,
      weatherConditionLabel: isWetOrStormy
        ? `Ciel d’intempéries (${weather?.labelFr || 'Averse'}) : +55 XP actif`
        : isNightOrDusk
        ? 'Veillée à la lanterne : +55 XP actif'
        : 'Prime +55 XP si ouvert sous la pluie, l’orage ou de nuit',
      isWeatherBonusActive: atmosActive,
      steps: [
        {
          id: `step_chest_${chosenChest.chestId}`,
          label: `${chosenChest.title} · ${chosenChest.placeNote}`,
          shortTag: chosenChest.isSubterranean ? 'Coffre Sous-sol' : archMeta.shortFr,
          kind: 'chest',
          lat: chosenChest.lat,
          lng: chosenChest.lng,
          isSubterranean: chosenChest.isSubterranean,
          chestId: chosenChest.chestId,
          altitudeMeters: chosenChest.altitudeMeters,
          reachRadiusMeters: 45,
        },
      ],
      targetPoiIds: [],
      targetChestId: chosenChest.chestId,
      targetCount: 1,
    });
  }

  // ==========================================================================
  // CONTRAT III — MANDAT SPÉCIALISÉ DU TERROIR (IGN / Rural / Sous-sol / Vivant)
  // ==========================================================================
  const ignPois = surfacePois.filter((p) => ignRegex.test(`${p.subType} ${p.name} ${p.source}`));
  const ruralPois = surfacePois.filter((p) => vernacularRegex.test(`${p.subType} ${p.name}`));
  const realSubPois = subterraneanPois.filter((p) => !p.id.startsWith('subpoi_bed_'));
  const ecoPois = surfacePois.filter((p) => p.category === 'ecosysteme');

  if (ignPois.length >= 2) {
    const targetCount = Math.min(2, ignPois.length);
    contracts.push({
      id: `dyn_ign_${sectorKey}`,
      sectorKey,
      archetype: 'mandat_terroir',
      kicker: 'Contrat III · Canevas Géodésique IGN',
      title: 'Chasse aux médaillons & bornes géodésiques IGN',
      description: `Ce secteur abrite ${ignPois.length} repères officiels de nivellement ou bornes géodésiques IGN. Relevez ${targetCount} médaillons scellés sur le terrain.`,
      category: 'geographie',
      xpBonus: 175,
      weatherBonusXp: 35,
      weatherConditionLabel: atmosActive
        ? 'Prime météo / lanterne active (+35 XP)'
        : 'Bonus +35 XP sous intempéries ou de nuit',
      isWeatherBonusActive: atmosActive,
      steps: ignPois.slice(0, 3).map((p) => ({
        id: `step_poi_${p.id}`,
        label: p.name,
        shortTag: 'IGN',
        kind: 'poi' as const,
        lat: p.lat,
        lng: p.lng,
        isSubterranean: false,
        poiId: p.id,
        reachRadiusMeters: p.unlockRadiusMeters || 45,
      })),
      targetPoiIds: ignPois.map((p) => p.id),
      targetCount,
    });
  } else if (ruralPois.length >= 2) {
    const targetCount = Math.min(2, ruralPois.length);
    contracts.push({
      id: `dyn_rural_${sectorKey}`,
      sectorKey,
      archetype: 'mandat_terroir',
      kicker: 'Contrat III · Petit Patrimoine Vernaculaire',
      title: 'Ronde des lavoirs, moulins & fontaines',
      description: `Consignez ${targetCount} témoins du petit patrimoine bâti ou hydraulique parmi les ${ruralPois.length} recensés autour de vous.`,
      category: 'histoire',
      xpBonus: 165,
      weatherBonusXp: 35,
      weatherConditionLabel: atmosActive
        ? 'Prime météo / lanterne active (+35 XP)'
        : 'Bonus +35 XP sous intempéries ou de nuit',
      isWeatherBonusActive: atmosActive,
      steps: ruralPois.slice(0, 3).map((p) => ({
        id: `step_poi_${p.id}`,
        label: p.name,
        shortTag: 'Patrimoine',
        kind: 'poi' as const,
        lat: p.lat,
        lng: p.lng,
        isSubterranean: false,
        poiId: p.id,
        reachRadiusMeters: p.unlockRadiusMeters || 48,
      })),
      targetPoiIds: ruralPois.map((p) => p.id),
      targetCount,
    });
  } else if (realSubPois.length >= 2) {
    const targetCount = Math.min(2, realSubPois.length);
    const rockHint = bedrock?.lithology ? ` (${bedrock.lithology.slice(0, 32)})` : '';
    contracts.push({
      id: `dyn_sub_${sectorKey}`,
      sectorKey,
      archetype: 'mandat_terroir',
      kicker: 'Contrat III · Exploration Souterraine',
      title: `Sondeur des profondeurs${rockHint}`,
      description: `Basculez en vue Sous-sol et cartographiez ${targetCount} cavités, cryptes, failles ou rivières enterrées du secteur.`,
      category: 'etrange',
      xpBonus: 180,
      weatherBonusXp: 40,
      weatherConditionLabel: atmosActive
        ? 'Prime météo / lanterne active (+40 XP)'
        : 'Bonus +40 XP sous intempéries ou de nuit',
      isWeatherBonusActive: atmosActive,
      steps: realSubPois.slice(0, 3).map((p) => ({
        id: `step_poi_${p.id}`,
        label: p.name,
        shortTag: 'Sous-sol',
        kind: 'poi' as const,
        lat: p.lat,
        lng: p.lng,
        isSubterranean: true,
        poiId: p.id,
        reachRadiusMeters: p.unlockRadiusMeters || 60,
      })),
      targetPoiIds: realSubPois.map((p) => p.id),
      targetCount,
    });
  } else if (ecoPois.length >= 2) {
    const targetCount = Math.min(2, ecoPois.length);
    contracts.push({
      id: `dyn_eco_${sectorKey}`,
      sectorKey,
      archetype: 'mandat_terroir',
      kicker: 'Contrat III · Sanctuaires & Biodiversité',
      title: 'Veilleur des sanctuaires naturels & ZNIEFF',
      description: `Explorez ${targetCount} réserves, zones humides, parcs ou arbres remarquables inventoriés dans ce secteur.`,
      category: 'ecosysteme',
      xpBonus: 160,
      weatherBonusXp: 35,
      weatherConditionLabel: atmosActive
        ? 'Prime météo / lanterne active (+35 XP)'
        : 'Bonus +35 XP sous intempéries ou de nuit',
      isWeatherBonusActive: atmosActive,
      steps: ecoPois.slice(0, 3).map((p) => ({
        id: `step_poi_${p.id}`,
        label: p.name,
        shortTag: 'Vivant',
        kind: 'poi' as const,
        lat: p.lat,
        lng: p.lng,
        isSubterranean: false,
        poiId: p.id,
        reachRadiusMeters: p.unlockRadiusMeters || 50,
      })),
      targetPoiIds: ecoPois.map((p) => p.id),
      targetCount,
    });
  } else {
    // Fallback: Riverbank or Dominant Guild survey
    const namedWater =
      surfacePois.find((p) => p.waterwayName)?.waterwayName ||
      terrain.find((t) => (t.kind === 'waterway' || t.kind === 'water') && t.name)?.name ||
      '';
    const countsByCat = new Map<ExplorationCategory, PoiItem[]>();
    for (const p of allPois) {
      const arr = countsByCat.get(p.category) || [];
      arr.push(p);
      countsByCat.set(p.category, arr);
    }
    const sortedCats = Array.from(countsByCat.entries()).sort((a, b) => b[1].length - a[1].length);
    if (sortedCats.length > 0) {
      const [domCat, catPois] = sortedCats[0];
      const targetCount = Math.min(3, catPois.length);
      contracts.push({
        id: `dyn_cat_${sectorKey}_${domCat}`,
        sectorKey,
        archetype: 'mandat_terroir',
        kicker: `Contrat III · Mandat de Guilde${namedWater ? ` (${namedWater})` : ''}`,
        title: `Archives locales : ${CATEGORY_META[domCat].shortLabel}`,
        description: `Révélez ${targetCount} sceaux de la branche « ${CATEGORY_META[domCat].label} » dans les environs.`,
        category: domCat,
        xpBonus: targetCount * 65,
        weatherBonusXp: 35,
        weatherConditionLabel: atmosActive
          ? 'Prime météo / lanterne active (+35 XP)'
          : 'Bonus +35 XP sous intempéries ou de nuit',
        isWeatherBonusActive: atmosActive,
        steps: catPois.slice(0, 3).map((p) => ({
          id: `step_poi_${p.id}`,
          label: p.name,
          shortTag: CATEGORY_META[p.category].shortLabel,
          kind: 'poi' as const,
          lat: p.lat,
          lng: p.lng,
          isSubterranean: Boolean(p.isSubterranean),
          poiId: p.id,
          reachRadiusMeters: p.unlockRadiusMeters || 48,
        })),
        targetPoiIds: catPois.map((p) => p.id),
        targetCount,
      });
    }
  }

  return contracts.slice(0, 3);
}

export interface DynamicContractEvalInput {
  entries: UnlockedEntry[];
  openedChests: OpenedArchivistChestRecord[];
  visitedStepIds: ReadonlySet<string>;
}

export function evaluateDynamicContract(
  contract: DynamicSectorContract,
  input: DynamicContractEvalInput
): { current: number; target: number; completedStepIds: Set<string> } {
  const unlockedPoiIds = new Set(input.entries.map((e) => e.poiId));
  const openedChestIds = new Set(input.openedChests.map((c) => c.chestId));
  const completedStepIds = new Set<string>();

  for (const step of contract.steps) {
    if (step.kind === 'poi' && step.poiId && unlockedPoiIds.has(step.poiId)) {
      completedStepIds.add(step.id);
    } else if (step.kind === 'chest' && step.chestId && openedChestIds.has(step.chestId)) {
      completedStepIds.add(step.id);
    } else if (input.visitedStepIds.has(step.id)) {
      completedStepIds.add(step.id);
    }
  }

  // Pool-based terroir contract (e.g. any 2 out of 5 IGN benchmarks)
  if (contract.targetPoiIds.length > 0) {
    let poolHits = 0;
    for (const pid of contract.targetPoiIds) {
      if (unlockedPoiIds.has(pid)) poolHits++;
    }
    return {
      current: Math.min(contract.targetCount, poolHits),
      target: contract.targetCount,
      completedStepIds,
    };
  }

  return {
    current: Math.min(contract.targetCount, completedStepIds.size),
    target: contract.targetCount,
    completedStepIds,
  };
}

