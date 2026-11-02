import { MISSIONS_CATALOG } from './missions';
import { getOutfitById, OUTFITS_CATALOG } from './rpgExtras';
import {
  CATEGORY_META,
  computeLevelFromXp,
  ExplorationCategory,
  ExplorerAppearance,
  ExplorerAvatarPreset,
  ExplorerFamiliarId,
  ExplorerGender,
  ExplorerHeadgearId,
  ExplorerOutfitId,
  ExplorerPackId,
  ExplorerProgress,
  ExplorerSkinTone,
  ExplorerToolId,
  getCategoryXp,
  UnlockedEntry,
} from './types';

// ============================================================================
// 1. GENRE / SILHOUETTE, ARCHÉTYPES DE VISAGE & CARNATIONS (TOUJOURS DISPONIBLES)
// ============================================================================
export interface ExplorerGenderDef {
  id: ExplorerGender;
  label: string;
  shortLabel: string;
  subtitle: string;
}

export const EXPLORER_GENDERS: ExplorerGenderDef[] = [
  {
    id: 'feminin',
    label: 'Féminin',
    shortLabel: 'Féminin',
    subtitle: 'Cils dessinés, coupe cintrée & titres accordés au féminin',
  },
  {
    id: 'masculin',
    label: 'Masculin',
    shortLabel: 'Masculin',
    subtitle: 'Carrure épaulée, traits marqués & titres au masculin',
  },
  {
    id: 'neutre',
    label: 'Neutre',
    shortLabel: 'Neutre',
    subtitle: 'Allure équilibrée d’arpenteur & titres épicènes',
  },
];

export interface AvatarPresetDef {
  id: ExplorerAvatarPreset;
  name: string;
  subtitle: string;
  hairDark: string;
  hairMid: string;
  hairLight: string;
  eyeColor: string;
  style: 'long_locks' | 'short_tousled' | 'braided' | 'copper_beard' | 'silver_mystic' | 'curls_glasses';
}

export const AVATAR_PRESETS: AvatarPresetDef[] = [
  {
    id: 'cartographe',
    name: 'Cartographe Châtain',
    subtitle: 'Mèches mi-longues dégradées & regard noisette',
    hairDark: '#4a1b0a',
    hairMid: '#8a3717',
    hairLight: '#cc622f',
    eyeColor: '#291509',
    style: 'long_locks',
  },
  {
    id: 'eclaireur',
    name: 'Éclaireur Brun',
    subtitle: 'Coupe courte effilée par le vent & yeux outremer',
    hairDark: '#1e1109',
    hairMid: '#452715',
    hairLight: '#78472a',
    eyeColor: '#1d4ed8',
    style: 'short_tousled',
  },
  {
    id: 'archiviste',
    name: 'Archiviste d’Or',
    subtitle: 'Tresse latérale blonde à ruban carmin & yeux émeraude',
    hairDark: '#854d0e',
    hairMid: '#d97706',
    hairLight: '#fde047',
    eyeColor: '#047857',
    style: 'braided',
  },
  {
    id: 'forgeron',
    name: 'Pionnier Cuivré',
    subtitle: 'Chevelure rousse flamboyante (barbe fine en allure masculine)',
    hairDark: '#6c240c',
    hairMid: '#c2410c',
    hairLight: '#fb923c',
    eyeColor: '#334155',
    style: 'copper_beard',
  },
  {
    id: 'oracle',
    name: 'Veilleur d’Argent',
    subtitle: 'Mèches platine lunaires & iris améthyste',
    hairDark: '#475569',
    hairMid: '#94a3b8',
    hairLight: '#f8fafc',
    eyeColor: '#6b21a8',
    style: 'silver_mystic',
  },
  {
    id: 'botaniste',
    name: 'Herboriste à Besicles',
    subtitle: 'Boucles ébène & fines besicles rondes de laiton',
    hairDark: '#0f172a',
    hairMid: '#1e293b',
    hairLight: '#64748b',
    eyeColor: '#291509',
    style: 'curls_glasses',
  },
];

export interface SkinToneDef {
  id: ExplorerSkinTone;
  name: string;
  base: string;
  light: string;
  shade: string;
  blush: string;
  lip: string;
}

export const SKIN_TONES: SkinToneDef[] = [
  {
    id: 'clair',
    name: 'Pêche dorée',
    base: '#fed7aa',
    light: '#ffedd5',
    shade: '#ea9e60',
    blush: '#f88b88',
    lip: '#d9776c',
  },
  {
    id: 'porcelaine',
    name: 'Ivoire rosé',
    base: '#ffedd5',
    light: '#fff7ed',
    shade: '#f5be8e',
    blush: '#fb8da0',
    lip: '#e07a8c',
  },
  {
    id: 'hale',
    name: 'Hâlé méditerranéen',
    base: '#eab676',
    light: '#f5ce9b',
    shade: '#b87c49',
    blush: '#d66e53',
    lip: '#b85d4b',
  },
  {
    id: 'ambre',
    name: 'Ambre cuivré',
    base: '#b87a4b',
    light: '#d19566',
    shade: '#824d29',
    blush: '#a35139',
    lip: '#8c4230',
  },
  {
    id: 'ebene',
    name: 'Ébène chaud',
    base: '#6f4228',
    light: '#8c583a',
    shade: '#432413',
    blush: '#7d3b2d',
    lip: '#59291e',
  },
];

export function getExplorerGenderDef(id?: ExplorerGender): ExplorerGenderDef {
  return EXPLORER_GENDERS.find((g) => g.id === id) || EXPLORER_GENDERS[1];
}

export function getAvatarPresetDef(id?: ExplorerAvatarPreset): AvatarPresetDef {
  return AVATAR_PRESETS.find((p) => p.id === id) || AVATAR_PRESETS[0];
}

export function getSkinToneDef(id?: ExplorerSkinTone): SkinToneDef {
  return SKIN_TONES.find((s) => s.id === id) || SKIN_TONES[0];
}

export function resolveExplorerAppearance(progress: ExplorerProgress): ExplorerAppearance {
  return {
    gender: getExplorerGenderDef(progress.gender).id,
    avatarPreset: getAvatarPresetDef(progress.avatarPreset).id,
    skinTone: getSkinToneDef(progress.skinTone).id,
    headgearId: progress.headgearId || 'tricorne_fauve',
    outfitId: progress.outfitId || 'arpenteur',
    toolId: progress.toolId || 'lanterne_laiton',
    packId: progress.packId || 'besace_cuir',
    familiarId: progress.familiarId || 'aucun',
  };
}

// ============================================================================
// 2. CATALOGUE DES ÉQUIPEMENTS COSMÉTIQUES & FAMILIERS (QUÊTES, ÉNIGMES, CHASSES & ALMANACH)
// ============================================================================
export type CosmeticSlot = 'headgear' | 'outfit' | 'tool' | 'pack' | 'familiar';
export type CosmeticUnlockSourceKind =
  | 'initial'
  | 'mission'
  | 'enigme'
  | 'chasse'
  | 'almanach'
  | 'terrain'
  | 'guilde';

export interface CosmeticItemDef {
  id: string;
  slot: CosmeticSlot;
  name: string;
  subtitle: string;
  unlockMissionId?: string;
  fallbackCategory?: ExplorationCategory;
  fallbackCategoryLevel?: number;
  minDiscoveries?: number;
  minCompletedMissions?: number;
  minSolvedRiddles?: number;
  minCompletedHunts?: number;
  minClaimedAlmanac?: number;
}

export const HEADGEAR_CATALOG: Array<CosmeticItemDef & { id: ExplorerHeadgearId }> = [
  {
    id: 'tricorne_fauve',
    slot: 'headgear',
    name: 'Feutre d’Arpenteur',
    subtitle: 'Couvre-chef initial · Cuir fauve souple & boucle de laiton',
  },
  {
    id: 'beret_chroniqueur',
    slot: 'headgear',
    name: 'Toque à Plume d’Or',
    subtitle: 'Velours carmin & grande plume blanche oscillante',
    unlockMissionId: 'm_first_discovery',
  },
  {
    id: 'casque_mineur',
    slot: 'headgear',
    name: 'Casque Frontal des Souterrains',
    subtitle: 'Dôme riveté en cuivre & lampe frontale ardente',
    unlockMissionId: 'm_underground_echo',
    fallbackCategory: 'etrange',
    fallbackCategoryLevel: 2,
  },
  {
    id: 'capuche_sylvestre',
    slot: 'headgear',
    name: 'Capuchon de la Futaie',
    subtitle: 'Drap d’émeraude orné d’une jeune pousse dorée',
    unlockMissionId: 'm_living_trace',
    fallbackCategory: 'ecosysteme',
    fallbackCategoryLevel: 2,
  },
  {
    id: 'couronne_menhir',
    slot: 'headgear',
    name: 'Diadème des Brumes & Contes',
    subtitle: 'Cercle d’argent runique, gemme améthyste & feu-follet',
    unlockMissionId: 'm_folklore_whisper',
    fallbackCategory: 'legende',
    fallbackCategoryLevel: 2,
  },
  {
    id: 'lunettes_astro',
    slot: 'headgear',
    name: 'Haut-de-Forme Géodésique',
    subtitle: 'Couvre-chef d’expédition XIXe & jumelles de laiton',
    unlockMissionId: 'm_time_traveler',
    fallbackCategory: 'histoire',
    fallbackCategoryLevel: 3,
  },
  {
    id: 'tricorne_reliquaire',
    slot: 'headgear',
    name: 'Bicorne de Chasseur de Reliques',
    subtitle: 'Feutre d’obsidienne galonné d’or & panache écarlate de pisteur',
    minCompletedHunts: 1,
  },
  {
    id: 'couronne_saisons',
    slot: 'headgear',
    name: 'Couronne des Quatre Saisons',
    subtitle: 'Tresse de feuilles d’or, bourgeon printanier & cristal de givre',
    minClaimedAlmanac: 2,
  },
  {
    id: 'monocle_erudit',
    slot: 'headgear',
    name: 'Toque & Monocle du Sceau d’Or',
    subtitle: 'Toque d’érudit pourpre, monocle cerclé d’or & fine chaînette',
    minSolvedRiddles: 3,
  },
];

export const OUTFIT_COSMETICS_CATALOG: Array<CosmeticItemDef & { id: ExplorerOutfitId }> = [
  {
    id: 'arpenteur',
    slot: 'outfit',
    name: 'Tunique d’Arpenteur',
    subtitle: 'Tenue initiale · Manteau vert mousse, baudrier & écharpe carmin',
  },
  {
    id: 'chroniqueur',
    slot: 'outfit',
    name: 'Manteau Royal du Chroniqueur',
    subtitle: 'Velours pourpre impérial, galons d’or & écharpe solaire',
    unlockMissionId: 'm_preventive_archeo',
    fallbackCategory: 'histoire',
    fallbackCategoryLevel: 2,
  },
  {
    id: 'geomancien',
    slot: 'outfit',
    name: 'Pèlerine Azur des Eaux Vives',
    subtitle: 'Drap minéral bleu glacier, fermoir de quartz & foulard ambré',
    unlockMissionId: 'm_near_river',
    fallbackCategory: 'geographie',
    fallbackCategoryLevel: 2,
  },
  {
    id: 'barde',
    slot: 'outfit',
    name: 'Habit Pourpre des Arts & Mythes',
    subtitle: 'Soie améthyste brodée & écharpe rose d’aurore',
    unlockMissionId: 'm_palissy_and_arts',
    fallbackCategory: 'legende',
    fallbackCategoryLevel: 2,
  },
  {
    id: 'ombres',
    slot: 'outfit',
    name: 'Manteau d’Ardoise des Friches',
    subtitle: 'Redingote nocturne à col haut & écharpe rubis',
    unlockMissionId: 'm_ghost_rails_and_toponyms',
    fallbackCategory: 'etrange',
    fallbackCategoryLevel: 2,
  },
  {
    id: 'sylvestre',
    slot: 'outfit',
    name: 'Cape Feuillue de PatriNat',
    subtitle: 'Tissu forestier émeraude, épaulette de jade & cuir d’écorce',
    unlockMissionId: 'm_inpn_sanctuary',
    fallbackCategory: 'ecosysteme',
    fallbackCategoryLevel: 2,
  },
  {
    id: 'almanach_solaire',
    slot: 'outfit',
    name: 'Manteau de l’Almanach Solaire',
    subtitle: 'Drap d’ivoire doré des solstices, galons ambrés & écharpe carmin',
    minClaimedAlmanac: 2,
  },
  {
    id: 'chasseur_reliques',
    slot: 'outfit',
    name: 'Pelisse de Maître des Pistes',
    subtitle: 'Cuir fauve de chercheur de coffres, épaulettes d’or & foulard sarcelle',
    minCompletedHunts: 3,
  },
];

export const TOOL_CATALOG: Array<CosmeticItemDef & { id: ExplorerToolId }> = [
  {
    id: 'lanterne_laiton',
    slot: 'tool',
    name: 'Lanterne de Laiton',
    subtitle: 'Outil initial · Flamme chaude éclairant les pas sur la carte',
  },
  {
    id: 'plume_enluminee',
    slot: 'tool',
    name: 'Grimoire & Plume Ardente',
    subtitle: 'Carnet de terrain ouvert & plume dorée lumineuse',
    unlockMissionId: 'm_field_chronicler',
  },
  {
    id: 'marteau_geologue',
    slot: 'tool',
    name: 'Pic Cristallin du Géologue',
    subtitle: 'Marteau forgé serti d’un éclat de cristal azur',
    unlockMissionId: 'm_deep_geology',
    fallbackCategory: 'geographie',
    fallbackCategoryLevel: 2,
  },
  {
    id: 'boussole_astrale',
    slot: 'tool',
    name: 'Astrolabe des Réseaux',
    subtitle: 'Sphère armillaire d’or en rotation perpétuelle',
    unlockMissionId: 'm_connected_lore',
    fallbackCategory: 'histoire',
    fallbackCategoryLevel: 2,
  },
  {
    id: 'fiole_spectrale',
    slot: 'tool',
    name: 'Encensoir Feu-Follet',
    subtitle: 'Relique mystique entourée d’une luciole spectrale en orbite',
    unlockMissionId: 'm_myth_master',
    fallbackCategory: 'legende',
    fallbackCategoryLevel: 2,
  },
  {
    id: 'sablier_ephemeride',
    slot: 'tool',
    name: 'Sablier Astral des Éphémérides',
    subtitle: 'Ampoules de verre céleste où s’écoule le sable d’or des saisons',
    minClaimedAlmanac: 1,
  },
  {
    id: 'loupe_sceau_or',
    slot: 'tool',
    name: 'Loupe d’Érudit en Or Cisélé',
    subtitle: 'Lentille de saphir taillée pour déchiffrer les énigmes sur la pierre',
    minSolvedRiddles: 2,
  },
  {
    id: 'clef_coffres_anciens',
    slot: 'tool',
    name: 'Passe-Partout des Caches Anciennes',
    subtitle: 'Grande clef squelette en or massif ouvrant les coffres de piste',
    minCompletedHunts: 2,
  },
];

export const PACK_CATALOG: Array<CosmeticItemDef & { id: ExplorerPackId }> = [
  {
    id: 'besace_cuir',
    slot: 'pack',
    name: 'Besace de Terrain',
    subtitle: 'Paquetage initial · Sacoche de cuir fauve à boucle de cuivre',
  },
  {
    id: 'rouleau_cartes',
    slot: 'pack',
    name: 'Étui Grand-Aigle d’État-Major',
    subtitle: 'Rouleaux de parchemins scellés & fanion carmin dans le dos',
    minDiscoveries: 2,
  },
  {
    id: 'hotte_cristaux',
    slot: 'pack',
    name: 'Hotte à Géodes Luminescentes',
    subtitle: 'Hotte d’osier remplie de cristaux bleus et d’ambre brut',
    minDiscoveries: 5,
  },
  {
    id: 'ailerons_automate',
    slot: 'pack',
    name: 'Rouage Dorsal d’Horloger',
    subtitle: 'Mécanisme de laiton animé réservé aux vétérans des Quêtes',
    minCompletedMissions: 4,
  },
  {
    id: 'coffret_piste',
    slot: 'pack',
    name: 'Coffre-Reliquaire de Piste',
    subtitle: 'Malle de cèdre cerclée de laiton sanglée sur les épaules',
    minCompletedHunts: 3,
  },
  {
    id: 'grimoire_almanach',
    slot: 'pack',
    name: 'Grand Almanach Enluminé Dorsal',
    subtitle: 'Folio géant à fermoirs d’or & signets des quatre saisons',
    minClaimedAlmanac: 3,
  },
  {
    id: 'astrolabe_dorsal',
    slot: 'pack',
    name: 'Sphère Armillaire d’Érudit',
    subtitle: 'Anneaux célestes de laiton tournoyant dans le dos du marcheur',
    minSolvedRiddles: 4,
  },
];

export const FAMILIAR_CATALOG: Array<CosmeticItemDef & { id: ExplorerFamiliarId }> = [
  {
    id: 'aucun',
    slot: 'familiar',
    name: 'Marche Solitaire',
    subtitle: 'Aucun familier à vos côtés · Arpentez le monde en éclaireur discret',
  },
  {
    id: 'hermine_royale',
    slot: 'familiar',
    name: 'Hermine Blanche des Éclaireurs',
    subtitle: 'Vive hermine d’ivoire à pointe d’ébène qui bondit joyeusement dans vos pas',
    unlockMissionId: 'm_first_discovery',
  },
  {
    id: 'chouette_erudite',
    slot: 'familiar',
    name: 'Athéna, Chouette du Sceau d’Or',
    subtitle: 'Chouette hulotte à besicles de laiton voletant près de votre épaule',
    minSolvedRiddles: 1,
  },
  {
    id: 'goupil_saisons',
    slot: 'familiar',
    name: 'Goupil des Quatre Saisons',
    subtitle: 'Petit renard roux au foulard vert forêt qui trottine au fil de l’Almanach',
    minClaimedAlmanac: 1,
  },
  {
    id: 'scarabee_boussole',
    slot: 'familiar',
    name: 'Scarabée Boussole d’Airain',
    subtitle: 'Coléoptère mécanique doré aux élytres d’émeraude vibrant près des trésors',
    minCompletedHunts: 1,
  },
  {
    id: 'corbeau_cartographe',
    slot: 'familiar',
    name: 'Corbeau Porte-Parchemin',
    subtitle: 'Grand corbeau d’encre bleutée portant un rouleau scellé dans son bec',
    minCompletedHunts: 2,
  },
  {
    id: 'salamandre_cristal',
    slot: 'familiar',
    name: 'Salamandre des Géodes',
    subtitle: 'Salamandre d’azur constellée de cristaux luminescents des souterrains',
    minSolvedRiddles: 3,
  },
  {
    id: 'feu_follet_astral',
    slot: 'familiar',
    name: 'Feu-Follet des Éphémérides',
    subtitle: 'Esprit stellaire doré coiffé d’une minuscule couronne astrale',
    minClaimedAlmanac: 3,
  },
];

export const ALL_COSMETIC_ITEMS: CosmeticItemDef[] = [
  ...HEADGEAR_CATALOG,
  ...OUTFIT_COSMETICS_CATALOG,
  ...TOOL_CATALOG,
  ...PACK_CATALOG,
  ...FAMILIAR_CATALOG.filter((f) => f.id !== 'aucun'),
];

export function isCosmeticUnlocked(
  item: CosmeticItemDef,
  progress: ExplorerProgress,
  entries: UnlockedEntry[]
): boolean {
  if (
    !item.unlockMissionId &&
    !item.fallbackCategory &&
    !item.minDiscoveries &&
    !item.minCompletedMissions &&
    !item.minSolvedRiddles &&
    !item.minCompletedHunts &&
    !item.minClaimedAlmanac
  ) {
    return true;
  }
  if (item.unlockMissionId && progress.completedMissions.includes(item.unlockMissionId)) {
    return true;
  }
  if (item.fallbackCategory && item.fallbackCategoryLevel) {
    const catLvl = computeLevelFromXp(getCategoryXp(progress, item.fallbackCategory)).level;
    const globalLvl = computeLevelFromXp(progress.totalXp).level;
    if (catLvl >= item.fallbackCategoryLevel || globalLvl >= item.fallbackCategoryLevel + 1) {
      return true;
    }
  }
  if (item.minDiscoveries && Math.max(progress.discoveriesCount, entries.length) >= item.minDiscoveries) {
    return true;
  }
  if (item.minCompletedMissions && progress.completedMissions.length >= item.minCompletedMissions) {
    return true;
  }
  if (item.minSolvedRiddles && (progress.solvedRiddlesCount || 0) >= item.minSolvedRiddles) {
    return true;
  }
  if (item.minCompletedHunts && (progress.completedHuntsCount || 0) >= item.minCompletedHunts) {
    return true;
  }
  if (item.minClaimedAlmanac && (progress.claimedAlmanacCount || 0) >= item.minClaimedAlmanac) {
    return true;
  }
  return false;
}

export function getCosmeticUnlockStatus(
  item: CosmeticItemDef,
  progress: ExplorerProgress,
  entries: UnlockedEntry[]
): {
  unlocked: boolean;
  requirementLabel: string;
  current: number;
  target: number;
  missionId?: string;
  sourceKind: CosmeticUnlockSourceKind;
} {
  const unlocked = isCosmeticUnlocked(item, progress, entries);
  if (item.minSolvedRiddles) {
    const cur = Math.min(item.minSolvedRiddles, progress.solvedRiddlesCount || 0);
    return {
      unlocked,
      requirementLabel: `Résoudre ${item.minSolvedRiddles} énigme${item.minSolvedRiddles > 1 ? 's' : ''} contextuelle${item.minSolvedRiddles > 1 ? 's' : ''}`,
      current: cur,
      target: item.minSolvedRiddles,
      sourceKind: 'enigme',
    };
  }
  if (item.minCompletedHunts) {
    const cur = Math.min(item.minCompletedHunts, progress.completedHuntsCount || 0);
    return {
      unlocked,
      requirementLabel: `Accomplir ${item.minCompletedHunts} chasse${item.minCompletedHunts > 1 ? 's' : ''} au trésor`,
      current: cur,
      target: item.minCompletedHunts,
      sourceKind: 'chasse',
    };
  }
  if (item.minClaimedAlmanac) {
    const cur = Math.min(item.minClaimedAlmanac, progress.claimedAlmanacCount || 0);
    return {
      unlocked,
      requirementLabel: `Valider ${item.minClaimedAlmanac} quête${item.minClaimedAlmanac > 1 ? 's' : ''} de l’Almanach`,
      current: cur,
      target: item.minClaimedAlmanac,
      sourceKind: 'almanach',
    };
  }
  if (item.unlockMissionId) {
    const m = MISSIONS_CATALOG.find((x) => x.id === item.unlockMissionId);
    if (m) {
      const ev = m.evaluate(entries);
      return {
        unlocked,
        requirementLabel: `Quête « ${m.title} »`,
        current: unlocked ? ev.target : ev.current,
        target: ev.target,
        missionId: m.id,
        sourceKind: 'mission',
      };
    }
  }
  if (item.minDiscoveries) {
    const cur = Math.min(item.minDiscoveries, Math.max(progress.discoveriesCount, entries.length));
    return {
      unlocked,
      requirementLabel: `Révéler ${item.minDiscoveries} lieux sur le terrain`,
      current: cur,
      target: item.minDiscoveries,
      sourceKind: 'terrain',
    };
  }
  if (item.minCompletedMissions) {
    const cur = Math.min(item.minCompletedMissions, progress.completedMissions.length);
    return {
      unlocked,
      requirementLabel: `Accomplir ${item.minCompletedMissions} quêtes du Grimoire`,
      current: cur,
      target: item.minCompletedMissions,
      sourceKind: 'mission',
    };
  }
  if (item.fallbackCategory && item.fallbackCategoryLevel) {
    const catMeta = CATEGORY_META[item.fallbackCategory];
    const catLvl = computeLevelFromXp(getCategoryXp(progress, item.fallbackCategory)).level;
    return {
      unlocked,
      requirementLabel: `Guilde ${catMeta.shortLabel} Niv. ${item.fallbackCategoryLevel}`,
      current: Math.min(item.fallbackCategoryLevel, catLvl),
      target: item.fallbackCategoryLevel,
      sourceKind: 'guilde',
    };
  }
  return {
    unlocked: true,
    requirementLabel: 'Équipement initial',
    current: 1,
    target: 1,
    sourceKind: 'initial',
  };
}

export function getCosmeticRewardsForMission(missionId: string): CosmeticItemDef[] {
  return ALL_COSMETIC_ITEMS.filter((item) => item.unlockMissionId === missionId);
}

export function getCosmeticRewardForMission(missionId: string): CosmeticItemDef | null {
  return ALL_COSMETIC_ITEMS.find((item) => item.unlockMissionId === missionId) || null;
}

export function getNewlyUnlockedCosmetics(
  prevProgress: ExplorerProgress,
  nextProgress: ExplorerProgress,
  prevEntries: UnlockedEntry[],
  nextEntries: UnlockedEntry[]
): CosmeticItemDef[] {
  const newly = ALL_COSMETIC_ITEMS.filter(
    (item) =>
      !isCosmeticUnlocked(item, prevProgress, prevEntries) &&
      isCosmeticUnlocked(item, nextProgress, nextEntries)
  );
  // Prioritize familiars first so newly adopted companions shine in celebration banners
  return newly.sort((a, b) => (a.slot === 'familiar' ? -1 : b.slot === 'familiar' ? 1 : 0));
}

const GENDERED_GUILD_TITLES: Record<
  ExplorerGender,
  Record<ExplorationCategory, string>
> = {
  feminin: {
    histoire: 'Chroniqueuse des Âges',
    geographie: 'Géomancienne des Roches',
    legende: 'Chasseuse de Mythes',
    etrange: 'Éclaireuse des Ombres',
    ecosysteme: 'Naturaliste Sylvestre',
  },
  masculin: {
    histoire: 'Chroniqueur des Âges',
    geographie: 'Géomancien des Roches',
    legende: 'Chasseur de Mythes',
    etrange: 'Éclaireur des Ombres',
    ecosysteme: 'Naturaliste Sylvestre',
  },
  neutre: {
    histoire: 'Garde-Mémoire des Âges',
    geographie: 'Géomante des Roches',
    legende: 'Garde-Mythes',
    etrange: 'Sentinelle des Ombres',
    ecosysteme: 'Naturaliste Sylvestre',
  },
};

export function computeExplorerHonorificTitle(progress: ExplorerProgress): string {
  const globalLvl = computeLevelFromXp(progress.totalXp).level;
  if (progress.totalXp === 0) return 'Novice de Terra Incognita';

  const gender = getExplorerGenderDef(progress.gender).id;
  let bestCat: ExplorationCategory = 'histoire';
  let bestXp = -1;
  const cats: ExplorationCategory[] = ['histoire', 'geographie', 'legende', 'etrange', 'ecosysteme'];
  for (const c of cats) {
    const xp = getCategoryXp(progress, c);
    if (xp > bestXp) {
      bestXp = xp;
      bestCat = c;
    }
  }
  const baseTitle = GENDERED_GUILD_TITLES[gender][bestCat] || CATEGORY_META[bestCat].guildRankTitle;
  if (globalLvl >= 6) {
    const grandPrefix = gender === 'feminin' ? 'Grande' : gender === 'neutre' ? 'Archonte' : 'Grand';
    return `${grandPrefix} ${baseTitle}`;
  }
  if (globalLvl >= 3) {
    const masterPrefix = gender === 'feminin' ? 'Maîtresse' : gender === 'neutre' ? 'Guide' : 'Maître';
    return `${masterPrefix} ${baseTitle}`;
  }
  return baseTitle;
}

// Lookup legacy OutfitDefinition for compatibility
export { OUTFITS_CATALOG };

// ============================================================================
// 3. MOTEUR DE RENDU PIXEL-ART 16-BIT HAUTE PRÉCISION (GRILLE SUB-PIXEL 2x)
// ============================================================================
export interface DrawExplorerSpriteOptions {
  /** Center X in virtual pixel units */
  cx: number;
  /** Ground-contact foot Y in virtual pixel units */
  cy: number;
  /** Canvas pixels per virtual pixel (e.g., 2 on map -> 1px fine sub-pixel!) */
  scale: number;
  facingDir: 'down' | 'up' | 'left' | 'right';
  isWalking: boolean;
  animTick: number;
  appearance: ExplorerAppearance;
  drawAura?: boolean;
  isNight?: boolean;
}

/**
 * Draws the detailed 16-bit SNES/GBA explorer on a 2x fine sub-pixel grid (`u = scale * 0.5`),
 * delivering ~32x46 pixel resolution inside the standard map footprint with sculpted anatomy,
 * selectable gender features (lashes/brows/waist/tunic/beard), 3-tone hair locks,
 * 2-segment fringed scarf, cuffed boots, dorsal pack, headgear, and animated field relic.
 */
export function drawExplorerSprite16Bit(
  ctx: CanvasRenderingContext2D,
  opts: DrawExplorerSpriteOptions
): void {
  const {
    cx,
    cy,
    scale,
    facingDir,
    isWalking,
    animTick,
    appearance,
    drawAura = true,
    isNight = false,
  } = opts;

  const gender = getExplorerGenderDef(appearance.gender).id;
  const preset = getAvatarPresetDef(appearance.avatarPreset);
  const skin = getSkinToneDef(appearance.skinTone);
  const outfitPal = getOutfitById(appearance.outfitId).palette;
  const headgear = appearance.headgearId || 'tricorne_fauve';
  const tool = appearance.toolId || 'lanterne_laiton';
  const pack = appearance.packId || 'besace_cuir';
  const familiar = appearance.familiarId || 'aucun';

  // Half-virtual-pixel fine grid: 1 unit = 0.5 virtual px (= 1 physical px on the map!)
  const u = scale * 0.5;
  const ox = Math.round(cx * 2);
  const oy = Math.round(cy * 2);

  const fp = (dx: number, dy: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    const x0 = Math.round((ox + dx) * u);
    const y0 = Math.round((oy + dy) * u);
    const x1 = Math.round((ox + dx + w) * u);
    const y1 = Math.round((oy + dy + h) * u);
    ctx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
  };

  // Animation clocks: smooth 4-step walk stride + gentle idle breathing + natural blink
  const stride = isWalking ? Math.floor(animTick / 2) % 4 : 0;
  const idleBreathe = !isWalking && Math.floor(animTick / 7) % 2 === 1 ? 1 : 0;
  const walkBob = isWalking && (stride === 1 || stride === 3) ? -2 : 0;
  // Torso collar anchor in fine half-pixels (~15 fine units above ground contact oy)
  const ty = -15 + walkBob + idleBreathe;
  const breeze = Math.floor(animTick / 3) % 2;
  const flamePulse = animTick % 3;
  const isBlinking = animTick % 43 === 0 || animTick % 43 === 1;
  const isSide = facingDir === 'left' || facingDir === 'right';
  const dirSign = facingDir === 'right' ? 1 : facingDir === 'left' ? -1 : 0;
  const OUT = '#160d07';

  // Tool-specific aura color
  const auraColor =
    tool === 'fiole_spectrale'
      ? 'rgba(192, 132, 252, 0.24)'
      : tool === 'marteau_geologue' || tool === 'sablier_ephemeride'
      ? 'rgba(56, 189, 248, 0.23)'
      : tool === 'boussole_astrale' || tool === 'loupe_sceau_or' || tool === 'clef_coffres_anciens'
      ? 'rgba(253, 224, 71, 0.23)'
      : outfitPal.lanternAuraRgba;

  if (drawAura) {
    ctx.fillStyle = auraColor;
    ctx.beginPath();
    ctx.arc(
      cx * scale,
      (cy - 4) * scale,
      (isNight ? 31 : 22 + (flamePulse === 0 ? 1 : 0)) * scale,
      0,
      Math.PI * 2
    );
    ctx.fill();

    if (headgear === 'casque_mineur') {
      ctx.save();
      ctx.fillStyle = isNight ? 'rgba(254, 240, 138, 0.22)' : 'rgba(254, 240, 138, 0.12)';
      ctx.beginPath();
      ctx.moveTo(cx * scale, (cy - 17) * scale);
      if (facingDir === 'right') {
        ctx.lineTo((cx + 34) * scale, (cy - 25) * scale);
        ctx.lineTo((cx + 34) * scale, (cy - 3) * scale);
      } else if (facingDir === 'left') {
        ctx.lineTo((cx - 34) * scale, (cy - 25) * scale);
        ctx.lineTo((cx - 34) * scale, (cy - 3) * scale);
      } else if (facingDir === 'up') {
        ctx.lineTo((cx - 14) * scale, (cy - 42) * scale);
        ctx.lineTo((cx + 14) * scale, (cy - 42) * scale);
      } else {
        ctx.lineTo((cx - 15) * scale, (cy + 15) * scale);
        ctx.lineTo((cx + 15) * scale, (cy + 15) * scale);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // Footstep dust puffs when walking
  if (isWalking) {
    const dustX =
      facingDir === 'right' ? -19 : facingDir === 'left' ? 14 : stride < 2 ? -12 : 8;
    fp(dustX, -3 - breeze * 2, 5, 3, 'rgba(245, 235, 214, 0.84)');
    fp(dustX + (facingDir === 'left' ? -2 : 3), -1, 3, 2, 'rgba(214, 196, 162, 0.72)');
  }

  // Crisp 2-tier elliptical 16-bit ground contact shadow
  fp(-13, -3, 26, 5, 'rgba(20, 12, 7, 0.42)');
  fp(-10, -4, 20, 7, 'rgba(20, 12, 7, 0.32)');

  // ==========================================================================
  // LAYER A: DORSAL PACK (behind torso when facing down/left/right; on top when up)
  // ==========================================================================
  const drawDorsalPack = (frontPass: boolean) => {
    if ((facingDir === 'up') !== frontPass) return;

    if (pack === 'besace_cuir') {
      if (facingDir === 'up') {
        fp(-11, ty + 1, 22, 13, OUT);
        fp(-9, ty + 2, 18, 10, '#6b2f0e');
        fp(-9, ty + 2, 18, 5, '#9a4416');
        fp(-8, ty + 3, 16, 2, '#c25e24');
        // Twin vertical leather straps + brass buckles
        fp(-6, ty + 2, 2, 10, '#451a03');
        fp(4, ty + 2, 2, 10, '#451a03');
        fp(-6, ty + 6, 2, 2, '#fbbf24');
        fp(4, ty + 6, 2, 2, '#fbbf24');
        fp(-2, ty + 5, 4, 3, '#fde047');
      } else if (isSide) {
        const px0 = facingDir === 'right' ? -15 : 5;
        fp(px0, ty + 1, 10, 13, OUT);
        fp(px0 + 2, ty + 2, 6, 10, '#78350f');
        fp(px0 + 2, ty + 2, 6, 4, '#b45309');
        fp(px0 + 3, ty + 6, 4, 2, '#fbbf24');
      } else {
        // Peeking leather bedroll & brass buckle above left shoulder
        fp(-13, ty - 2, 5, 9, OUT);
        fp(-12, ty - 1, 3, 7, '#92400e');
        fp(-12, ty, 3, 2, '#d97706');
      }
    } else if (pack === 'rouleau_cartes') {
      if (facingDir === 'up') {
        // Grand-Aigle brass-capped scroll cylinder + leather case + fluttering crimson pennant
        fp(-14, ty - 4, 28, 6, OUT);
        fp(-12, ty - 3, 24, 4, '#fef3c7');
        fp(-12, ty - 3, 24, 1, '#ffffff');
        fp(-13, ty - 3, 3, 4, '#d97706');
        fp(10, ty - 3, 3, 4, '#d97706');
        fp(-9, ty + 2, 18, 11, OUT);
        fp(-8, ty + 3, 16, 9, '#78350f');
        fp(-2, ty + 5, 4, 4, '#dc2626');
        fp(-1, ty + 6, 2, 2, '#fde047');
        fp(11, ty - 6 + breeze * 2, 7, 4, '#dc2626');
        fp(12, ty - 5 + breeze * 2, 4, 2, '#fca5a5');
      } else {
        const sx = facingDir === 'right' ? -15 : 8;
        fp(sx, ty - 6, 7, 17, OUT);
        fp(sx + 1, ty - 5, 5, 14, '#fef3c7');
        fp(sx + 1, ty - 5, 5, 3, '#d97706');
        fp(sx + 1, ty + 6, 5, 3, '#92400e');
        fp(sx + (facingDir === 'right' ? -4 : 5), ty - 4 + breeze * 2, 5, 3, '#dc2626');
      }
    } else if (pack === 'hotte_cristaux') {
      const shimmer = flamePulse === 0 ? '#ffffff' : '#bae6fd';
      if (facingDir === 'up') {
        fp(-11, ty, 22, 14, OUT);
        fp(-9, ty + 2, 18, 10, '#92400e');
        for (let wy = 3; wy <= 9; wy += 3) {
          fp(-8, ty + wy, 16, 1, '#d97706');
        }
        // Faceted glowing crystal cluster emerging from wicker basket
        fp(-8, ty - 7, 6, 8, OUT);
        fp(-7, ty - 6, 4, 7, '#0284c7');
        fp(-6, ty - 6, 2, 5, shimmer);
        fp(1, ty - 9, 7, 10, OUT);
        fp(2, ty - 8, 5, 9, '#38bdf8');
        fp(3, ty - 8, 2, 6, '#ffffff');
        fp(-2, ty - 5, 4, 6, '#f59e0b');
        fp(-1, ty - 4, 2, 3, '#fef08a');
      } else {
        const kx = facingDir === 'right' ? -15 : 8;
        fp(kx, ty - 3, 8, 15, OUT);
        fp(kx + 1, ty + 1, 6, 9, '#92400e');
        fp(kx + 1, ty + 3, 6, 1, '#d97706');
        fp(kx + 1, ty - 7, 6, 8, '#0284c7');
        fp(kx + 2, ty - 6, 3, 6, '#38bdf8');
        fp(kx + 3, ty - 6, 1, 4, shimmer);
      }
    } else if (pack === 'ailerons_automate') {
      const toothPhase = Math.floor(animTick / 2) % 2;
      if (facingDir === 'up') {
        fp(-13, ty - 4, 26, 16, OUT);
        fp(-11, ty - 2, 22, 12, '#92400e');
        fp(-8, ty - 1, 16, 10, '#f59e0b');
        fp(-6, ty + 1, 12, 6, '#fde047');
        fp(-3, ty + 2, 6, 4, '#0284c7');
        fp(-2, ty + 3, 4, 2, '#e0f2fe');
        if (toothPhase === 0) {
          fp(-15, ty + 2, 3, 4, '#fde047');
          fp(12, ty + 2, 3, 4, '#fde047');
          fp(-2, ty - 6, 4, 3, '#fde047');
        } else {
          fp(-13, ty - 4, 3, 3, '#fde047');
          fp(10, ty - 4, 3, 3, '#fde047');
          fp(-13, ty + 9, 3, 3, '#fde047');
          fp(10, ty + 9, 3, 3, '#fde047');
        }
      } else {
        const gx = facingDir === 'right' ? -15 : 8;
        fp(gx, ty - 4, 8, 15, OUT);
        fp(gx + 1, ty - 2, 6, 11, '#f59e0b');
        fp(gx + 2, ty, 4, 6, '#fde047');
        fp(gx + 3, ty + 2, 2, 2, '#38bdf8');
        fp(gx + (facingDir === 'right' ? -2 : 7), ty - 1 + toothPhase * 3, 3, 3, '#fde047');
      }
    } else if (pack === 'coffret_piste') {
      // Brass-bound cedar & crimson treasure chest strapped to shoulders
      if (facingDir === 'up') {
        fp(-12, ty - 2, 24, 15, OUT);
        fp(-10, ty - 1, 20, 12, '#7f1d1d');
        fp(-10, ty - 1, 20, 4, '#b91c1c');
        // Brass bands & central keyhole plate
        fp(-10, ty + 3, 20, 2, '#d97706');
        fp(-7, ty - 1, 2, 12, '#fbbf24');
        fp(5, ty - 1, 2, 12, '#fbbf24');
        fp(-2, ty + 2, 4, 5, '#fde047');
        fp(-1, ty + 4, 2, 2, OUT);
      } else {
        const cx0 = facingDir === 'right' ? -15 : 8;
        fp(cx0, ty - 2, 8, 14, OUT);
        fp(cx0 + 1, ty - 1, 6, 11, '#7f1d1d');
        fp(cx0 + 1, ty - 1, 6, 3, '#dc2626');
        fp(cx0 + 1, ty + 3, 6, 2, '#fbbf24');
        fp(cx0 + 3, ty + 6, 2, 3, '#fde047');
      }
    } else if (pack === 'grimoire_almanach') {
      // Grand Illuminated Almanac Tome with golden clasps & seasonal ribbons
      if (facingDir === 'up') {
        fp(-12, ty - 4, 24, 17, OUT);
        fp(-10, ty - 3, 20, 14, '#1e3a8a');
        fp(-9, ty - 2, 18, 12, '#2563eb');
        // Gilded border & sun crest
        fp(-9, ty - 2, 18, 2, '#fbbf24');
        fp(-9, ty + 8, 18, 2, '#fbbf24');
        fp(-3, ty + 1, 6, 5, '#fde047');
        fp(-2, ty + 2, 4, 3, '#ffffff');
        // Fluttering seasonal bookmark ribbons
        fp(-5, ty + 11, 2, 4 + breeze, '#dc2626');
        fp(3, ty + 11, 2, 3 + (1 - breeze), '#10b981');
      } else {
        const bx0 = facingDir === 'right' ? -15 : 8;
        fp(bx0, ty - 4, 7, 16, OUT);
        fp(bx0 + 1, ty - 3, 5, 13, '#1e3a8a');
        fp(bx0 + 2, ty - 2, 3, 11, '#fef3c7'); // gilded page edges
        fp(bx0 + 1, ty + 1, 5, 2, '#fbbf24');
        fp(bx0 + 1, ty + 6, 5, 2, '#fbbf24');
      }
    } else if (pack === 'astrolabe_dorsal') {
      // Dorsal Armillary Sphere with rotating celestial rings & glowing core
      const ringPhase = Math.floor(animTick / 2) % 2;
      if (facingDir === 'up') {
        fp(-13, ty - 5, 26, 17, OUT);
        fp(-11, ty - 3, 22, 13, '#d97706');
        fp(-9, ty - 1, 18, 9, '#1e1b4b');
        if (ringPhase === 0) {
          fp(-11, ty + 2, 22, 3, '#fde047');
          fp(-2, ty - 3, 4, 13, '#fbbf24');
        } else {
          fp(-9, ty - 2, 18, 3, '#fde047');
          fp(-9, ty + 6, 18, 3, '#fde047');
          fp(-5, ty - 1, 10, 9, '#fbbf24');
        }
        fp(-3, ty + 1, 6, 5, '#38bdf8');
        fp(-1, ty + 2, 2, 3, '#ffffff');
      } else {
        const ax0 = facingDir === 'right' ? -15 : 8;
        fp(ax0, ty - 5, 8, 16, OUT);
        fp(ax0 + 1, ty - 3, 6, 12, '#d97706');
        fp(ax0 + 2, ty - 1, 4, 8, '#fde047');
        fp(ax0 + 2, ty + 1 + ringPhase, 4, 4, '#38bdf8');
        fp(ax0 + 3, ty + 2 + ringPhase, 2, 2, '#ffffff');
      }
    }
  };

  drawDorsalPack(false);

  // ==========================================================================
  // LAYER B: ARTICULATED CUFFED BOOTS, TAILORED COAT / TUNIC & FLUTTERING SCARF
  // ==========================================================================
  // 2-Segment Fringed Scarf Tail (reacts dynamically to stride & wind)
  const scarfWave = (isWalking ? Math.floor(animTick / 2) : Math.floor(animTick / 5)) % 2;
  if (facingDir === 'right') {
    fp(-22 - scarfWave * 2, ty - 3, 12, 7, OUT);
    fp(-20 - scarfWave * 2, ty - 2, 10, 4, outfitPal.scarfDark);
    fp(-18 - scarfWave * 2, ty - 2, 7, 2, outfitPal.scarfLight);
    // Fringed ends
    fp(-22 - scarfWave * 2, ty - 2 + scarfWave, 2, 2, outfitPal.scarfLight);
    fp(-22 - scarfWave * 2, ty + 1, 2, 2, '#fde047');
  } else if (facingDir === 'left') {
    fp(10 + scarfWave * 2, ty - 3, 12, 7, OUT);
    fp(10 + scarfWave * 2, ty - 2, 10, 4, outfitPal.scarfDark);
    fp(11 + scarfWave * 2, ty - 2, 7, 2, outfitPal.scarfLight);
    fp(20 + scarfWave * 2, ty - 2 + scarfWave, 2, 2, outfitPal.scarfLight);
    fp(20 + scarfWave * 2, ty + 1, 2, 2, '#fde047');
  } else {
    fp(10, ty - 2 + scarfWave * 2, 9, 8, OUT);
    fp(10, ty - 1 + scarfWave * 2, 7, 5, outfitPal.scarfDark);
    fp(10, ty - 1 + scarfWave * 2, 5, 2, outfitPal.scarfLight);
    fp(15, ty + 3 + scarfWave * 2, 2, 2, '#fde047');
  }

  // 4-Frame Stride Cuffed Leather Boots + Trousers
  if (isSide) {
    const frontShift = stride === 1 ? 4 * dirSign : stride === 3 ? -4 * dirSign : 0;
    const backShift = -frontShift;
    const liftFront = stride === 1 ? -2 : 0;
    const liftBack = stride === 3 ? -2 : 0;

    // Back boot
    fp(-4 + backShift, ty + 9 + liftBack, 7, 7, OUT);
    fp(-3 + backShift, ty + 9 + liftBack, 5, 5, '#3b1806');
    fp(-3 + backShift, ty + 13 + liftBack, 5, 1, '#1c0f08');
    // Front boot with cuff, tongue highlight & sole
    fp(-3 + frontShift, ty + 9 + liftFront, 8, 7, OUT);
    fp(-2 + frontShift, ty + 9 + liftFront, 6, 2, '#92400e'); // folded cuff
    fp(-2 + frontShift, ty + 11 + liftFront, 6, 3, '#5c280d');
    fp(
      facingDir === 'right' ? 1 + frontShift : -2 + frontShift,
      ty + 11 + liftFront,
      3,
      2,
      '#b45309'
    );
    fp(-2 + frontShift, ty + 14 + liftFront, 6, 1, '#271307');
  } else {
    const leftLift = stride === 1 ? -2 : 0;
    const rightLift = stride === 3 ? -2 : 0;

    // Left leg & cuffed boot
    fp(-9, ty + 9 + leftLift, 7, 7, OUT);
    fp(-8, ty + 9 + leftLift, 5, 2, '#92400e');
    fp(-8, ty + 11 + leftLift, 5, 3, '#451a03');
    fp(-7, ty + 11 + leftLift, 3, 2, '#78350f');
    fp(-8, ty + 14 + leftLift, 5, 1, '#1f0f06');

    // Right leg & cuffed boot
    fp(2, ty + 9 + rightLift, 7, 7, OUT);
    fp(3, ty + 9 + rightLift, 5, 2, '#92400e');
    fp(3, ty + 11 + rightLift, 5, 3, '#451a03');
    fp(4, ty + 11 + rightLift, 3, 2, '#78350f');
    fp(3, ty + 14 + rightLift, 5, 1, '#1f0f06');
  }

  // Gender-tailored Coat / Tunic Silhouette
  const shoulderHalf = gender === 'masculin' ? 11 : gender === 'feminin' ? 9 : 10;
  const waistHalf = gender === 'feminin' ? 8 : gender === 'neutre' ? 9 : 10;
  const skirtHalf = gender === 'feminin' ? 11 : 10;

  if (isSide) {
    // Side-profile tailored explorer coat
    fp(-8, ty - 1, 16, 12, OUT);
    fp(-6, ty, 12, 10, outfitPal.coatDark);
    fp(-5, ty, 10, 8, outfitPal.coatMid);
    fp(facingDir === 'right' ? -1 : -5, ty + 1, 5, 6, outfitPal.coatLight);
    if (gender === 'feminin') {
      // Flared pleated coat hem in profile
      fp(-8, ty + 7, 16, 4, OUT);
      fp(-7, ty + 7, 14, 3, outfitPal.coatMid);
      fp(-7, ty + 9, 14, 1, outfitPal.pauldron);
    }
    // Side belt & brass buckle
    fp(-6, ty + 6, 12, 2, '#451a03');
    fp(facingDir === 'right' ? 3 : -5, ty + 6, 2, 2, '#fbbf24');
    // Shoulder pauldron
    fp(-3, ty, 6, 3, outfitPal.pauldron);
  } else {
    // Upper torso + waist + coat skirt with gender-specific cut
    fp(-shoulderHalf - 1, ty - 1, (shoulderHalf + 1) * 2, 7, OUT);
    fp(-waistHalf - 1, ty + 5, (waistHalf + 1) * 2, 3, OUT);
    fp(-skirtHalf - 1, ty + 7, (skirtHalf + 1) * 2, 4, OUT);

    fp(-shoulderHalf, ty, shoulderHalf * 2, 6, outfitPal.coatDark);
    fp(-waistHalf, ty + 5, waistHalf * 2, 2, outfitPal.coatDark);
    fp(-skirtHalf, ty + 7, skirtHalf * 2, 3, outfitPal.coatDark);

    fp(-shoulderHalf + 1, ty, (shoulderHalf - 1) * 2, 5, outfitPal.coatMid);
    fp(-skirtHalf + 1, ty + 7, (skirtHalf - 1) * 2, 2, outfitPal.coatMid);
    fp(-shoulderHalf + 1, ty, shoulderHalf - 1, 5, outfitPal.coatLight);

    if (facingDir === 'down') {
      // Crisp parchment shirt V-neck & coat lapels
      fp(-2, ty + 1, 4, 3, '#fef3c7');
      fp(-4, ty + 1, 2, 5, outfitPal.coatLight);
      fp(2, ty + 1, 2, 5, outfitPal.coatMid);
      // Central coat split / pleat below belt
      fp(-1, ty + 8, 2, 2, '#1f1209');
      if (gender === 'feminin') {
        // Golden/accent hem embroidery on pleated tunic skirt
        fp(-skirtHalf + 1, ty + 9, (skirtHalf - 1) * 2, 1, outfitPal.pauldron);
      }
      // Stitched diagonal leather bandolier + brass ring
      fp(-6, ty + 2, 3, 2, '#5c280d');
      fp(-4, ty + 3, 3, 2, '#78350f');
      fp(-2, ty + 4, 3, 2, '#78350f');
      fp(-3, ty + 3, 2, 1, '#fbbf24');
      // Belted waist with pronged brass buckle
      fp(-waistHalf, ty + 6, waistHalf * 2, 2, '#3b1806');
      fp(-3, ty + 5, 6, 3, '#d97706');
      fp(-2, ty + 6, 4, 2, '#fde047');
      fp(-1, ty + 6, 1, 2, '#78350f');
    } else {
      // Back pleat & rear belt when facing North ('up')
      fp(-2, ty + 1, 4, 8, outfitPal.coatDark);
      fp(-waistHalf, ty + 6, waistHalf * 2, 2, '#3b1806');
    }

    // Sculpted shoulder pauldrons
    fp(-shoulderHalf, ty, 4, 3, outfitPal.pauldron);
    fp(shoulderHalf - 4, ty, 4, 3, outfitPal.pauldron);
  }

  // Woven Scarf Collar wrapping neck
  const collarW = isSide ? 14 : 20;
  fp(-collarW / 2 - 1, ty - 2, collarW + 2, 4, OUT);
  fp(-collarW / 2, ty - 2, collarW, 3, outfitPal.scarfDark);
  fp(-collarW / 2 + 1, ty - 2, collarW - 4, 2, outfitPal.scarfLight);

  // Articulated Swinging Sleeves & Hands
  const armSwing = stride === 1 ? -2 : stride === 3 ? 2 : 0;
  if (facingDir === 'down') {
    // Left free arm
    fp(-shoulderHalf - 3, ty + 1 + armSwing, 4, 8, OUT);
    fp(-shoulderHalf - 2, ty + 2 + armSwing, 2, 4, outfitPal.coatMid);
    fp(-shoulderHalf - 2, ty + 5 + armSwing, 2, 1, outfitPal.pauldron);
    fp(-shoulderHalf - 2, ty + 6 + armSwing, 2, 2, skin.base);
    // Right tool-bearing arm
    fp(shoulderHalf - 1, ty + 1 - armSwing, 4, 8, OUT);
    fp(shoulderHalf, ty + 2 - armSwing, 2, 4, outfitPal.coatDark);
    fp(shoulderHalf, ty + 5 - armSwing, 2, 1, outfitPal.pauldron);
    fp(shoulderHalf, ty + 6 - armSwing, 2, 2, skin.base);
  } else if (isSide) {
    const swingX = armSwing * dirSign;
    fp(-2 + swingX, ty + 2, 5, 8, OUT);
    fp(-1 + swingX, ty + 3, 3, 4, outfitPal.coatLight);
    fp(-1 + swingX, ty + 6, 3, 1, outfitPal.pauldron);
    fp(-1 + swingX, ty + 7, 3, 2, skin.base);
  }

  // Dorsal Pack on top of back when facing North ('up')
  drawDorsalPack(true);

  // ==========================================================================
  // LAYER C: HIGH-DETAIL 16-BIT HEAD, GENDER ANATOMY, EYES, LASHES & HAIRSTYLE
  // ==========================================================================
  const faceShift = dirSign * 2;
  const hy = ty - 14; // Top of face / bangs zone

  // Sculpted rounded head & hair silhouette (not a flat box!)
  fp(-11, hy - 2, 22, 13, OUT);
  fp(-10, hy - 3, 20, 15, OUT);
  fp(-10, hy - 2, 20, 12, preset.hairDark);
  fp(-9, hy - 2, 18, 11, preset.hairMid);

  if (facingDir !== 'up') {
    // Ears peeking on sides (front view) or back-side ear (side view)
    if (!isSide) {
      fp(-11, hy + 4, 2, 4, OUT);
      fp(9, hy + 4, 2, 4, OUT);
      fp(-10, hy + 5, 2, 2, skin.shade);
      fp(8, hy + 5, 2, 2, skin.shade);
    } else {
      const earX = facingDir === 'right' ? -6 : 3;
      fp(earX, hy + 4, 3, 4, skin.shade);
      fp(earX + 1, hy + 5, 1, 2, skin.base);
    }

    // Sculpted face & tapered chin
    fp(-8 + faceShift, hy, 16, 10, skin.base);
    fp(-6 + faceShift, hy + 10, 12, 2, skin.base);
    // Forehead highlight + warm jawline contour
    fp(-6 + faceShift, hy + 1, 10, 2, skin.light);
    fp(-6 + faceShift, hy + 10, 12, 2, skin.shade);
    fp(-8 + faceShift, hy + 8, 2, 2, skin.shade);
    fp(6 + faceShift, hy + 8, 2, 2, skin.shade);

    // Subtle cheek warmth & delicate mouth/lip cue
    if (gender === 'feminin') {
      if (facingDir !== 'left') fp(-7 + faceShift, hy + 7, 3, 2, skin.blush);
      if (facingDir !== 'right') fp(4 + faceShift, hy + 7, 3, 2, skin.blush);
      fp(-1 + faceShift, hy + 9, 3, 1, skin.lip);
    } else if (gender === 'neutre') {
      if (facingDir !== 'left') fp(-7 + faceShift, hy + 7, 2, 1, skin.blush);
      if (facingDir !== 'right') fp(5 + faceShift, hy + 7, 2, 1, skin.blush);
      fp(-1 + faceShift, hy + 9, 2, 1, skin.shade);
    } else {
      fp(-1 + faceShift, hy + 9, 3, 1, skin.shade);
    }

    // Adventurer beard ONLY on 'copper_beard' when gender === 'masculin'
    if (preset.style === 'copper_beard' && gender === 'masculin') {
      fp(-7 + faceShift, hy + 8, 14, 4, preset.hairDark);
      fp(-5 + faceShift, hy + 9, 10, 3, preset.hairMid);
      fp(-2 + faceShift, hy + 9, 4, 1, skin.lip);
    }

    // Detailed 16-bit SNES/GBA Eyes (sclera + iris + pupil + gender brows/lashes)
    const drawDetailedEye = (ex: number, isOuterRight: boolean) => {
      if (isBlinking) {
        fp(ex, hy + 6, 3, 1, preset.hairDark);
        if (gender === 'feminin') {
          fp(ex + (isOuterRight ? 3 : -1), hy + 5, 1, 1, OUT);
        }
        return;
      }
      // Eyebrow
      const browH = gender === 'masculin' ? 1 : 1;
      fp(
        ex - (gender === 'masculin' ? 0 : 0),
        hy + 2,
        3,
        browH,
        gender === 'masculin' ? preset.hairDark : preset.hairMid
      );
      // Upper lash line (with outer wing for feminin)
      fp(ex, hy + 3, 3, 1, OUT);
      if (gender === 'feminin') {
        fp(ex + (isOuterRight ? 3 : -1), hy + 3, 1, 1, OUT);
      }
      // Sclera + Iris + Deep Pupil + Specular Catchlight
      fp(ex, hy + 4, 3, 4, '#ffffff');
      const irisX = facingDir === 'left' ? ex : ex + 1;
      fp(irisX, hy + 4, 2, 4, preset.eyeColor);
      fp(irisX + (facingDir === 'left' ? 0 : 1), hy + 5, 1, 2, OUT);
      fp(ex + (facingDir === 'left' ? 1 : 0), hy + 4, 1, 2, '#ffffff');
    };

    if (facingDir === 'right') {
      drawDetailedEye(2 + faceShift, true);
    } else if (facingDir === 'left') {
      drawDetailedEye(-5 + faceShift, false);
    } else {
      drawDetailedEye(-6, false);
      drawDetailedEye(3, true);
    }

    // Round Brass Spectacles for 'curls_glasses'
    if (preset.style === 'curls_glasses') {
      if (facingDir === 'right') {
        fp(1 + faceShift, hy + 3, 5, 1, '#fbbf24');
        fp(1 + faceShift, hy + 8, 5, 1, '#d97706');
        fp(-2 + faceShift, hy + 5, 3, 1, '#d97706');
      } else if (facingDir === 'left') {
        fp(-6 + faceShift, hy + 3, 5, 1, '#fbbf24');
        fp(-6 + faceShift, hy + 8, 5, 1, '#d97706');
        fp(-1 + faceShift, hy + 5, 3, 1, '#d97706');
      } else {
        fp(-7, hy + 3, 5, 1, '#fbbf24');
        fp(2, hy + 3, 5, 1, '#fbbf24');
        fp(-7, hy + 8, 5, 1, '#d97706');
        fp(2, hy + 8, 5, 1, '#d97706');
        fp(-2, hy + 5, 4, 1, '#fbbf24');
      }
    }

    // Layered Hair Bangs & Side Framing Locks (adapted to preset + gender!)
    fp(-9 + faceShift, hy - 1, 18, 3, preset.hairMid);
    fp(-6 + faceShift, hy - 1, 8, 2, preset.hairLight);
    fp(-2 + faceShift, hy + 1, 3, 2, preset.hairMid); // central parted bang tuft
    fp(4 + faceShift, hy + 1, 3, 1, preset.hairDark);

    const extraSideLen = gender === 'feminin' ? 3 : gender === 'neutre' ? 1 : 0;

    if (
      preset.style === 'long_locks' ||
      preset.style === 'silver_mystic' ||
      (preset.style === 'copper_beard' && gender !== 'masculin')
    ) {
      if (facingDir !== 'right') {
        fp(-11, hy + 1, 4, 11 + extraSideLen, OUT);
        fp(-10, hy + 1, 3, 10 + extraSideLen, preset.hairMid);
        fp(-9, hy + 2, 2, 6, preset.hairLight);
      }
      if (facingDir !== 'left') {
        fp(7, hy + 1, 4, 11 + extraSideLen, OUT);
        fp(7, hy + 1, 3, 10 + extraSideLen, preset.hairDark);
        fp(7, hy + 2, 2, 6, preset.hairMid);
      }
    } else if (preset.style === 'braided') {
      // Sculpted golden side-braid with alternating woven segments & crimson ribbon
      fp(-12, hy + 2, 5, 14 + extraSideLen, OUT);
      fp(-11, hy + 2, 3, 12 + extraSideLen, preset.hairDark);
      for (let by = 2; by < 12 + extraSideLen; by += 3) {
        fp(-11, hy + by, 2, 2, preset.hairLight);
        fp(-9, hy + by + 1, 1, 2, preset.hairMid);
      }
      fp(-11, hy + 13 + extraSideLen, 3, 2, '#dc2626');
      if (facingDir !== 'left') {
        fp(7, hy + 1, 3, 8, preset.hairMid);
      }
    } else if (preset.style === 'curls_glasses') {
      // Voluminous ebony curls framing temples
      fp(-12, hy, 4, 9 + extraSideLen, OUT);
      fp(8, hy, 4, 9 + extraSideLen, OUT);
      fp(-11, hy + 1, 3, 7 + extraSideLen, preset.hairMid);
      fp(8, hy + 1, 3, 7 + extraSideLen, preset.hairMid);
      fp(-10, hy + 2, 2, 2, preset.hairLight);
      fp(8, hy + 4, 2, 2, preset.hairLight);
    } else if (preset.style === 'short_tousled' && gender === 'feminin') {
      // Pixie side wisps for feminine tousled cut
      fp(-10, hy + 2, 2, 7, preset.hairMid);
      fp(8, hy + 2, 2, 7, preset.hairDark);
    }
  } else {
    // Detailed back-of-hair shading when walking North ('up')
    const backLen =
      preset.style === 'long_locks' || preset.style === 'silver_mystic'
        ? 14
        : gender === 'feminin'
        ? 13
        : 11;
    fp(-10, hy - 1, 20, backLen, OUT);
    fp(-9, hy, 18, backLen - 1, preset.hairDark);
    fp(-8, hy, 16, backLen - 3, preset.hairMid);
    fp(-5, hy + 1, 10, 6, preset.hairLight);
    // Vertical strand separations
    fp(-3, hy + 3, 1, backLen - 4, preset.hairDark);
    fp(3, hy + 3, 1, backLen - 4, preset.hairDark);
    if (preset.style === 'braided') {
      fp(-3, hy + 3, 6, 12, OUT);
      for (let by = 4; by <= 12; by += 3) {
        fp(-2, hy + by, 4, 2, preset.hairLight);
        fp(-1, hy + by + 2, 2, 1, preset.hairDark);
      }
      fp(-2, hy + 14, 4, 2, '#dc2626');
    }
  }

  // ==========================================================================
  // LAYER D: HIGH-DETAIL UNLOCKABLE 16-BIT HEADGEAR
  // ==========================================================================
  if (headgear === 'tricorne_fauve') {
    // Classic Surveyor Leather Fedora / Tricorne with stitched brim & brass buckle
    fp(-16, hy - 3, 32, 5, OUT);
    fp(-14, hy - 2, 28, 3, outfitPal.hatBrim);
    fp(-13, hy - 2, 22, 1, outfitPal.hatLight);
    fp(-11, hy - 10, 22, 8, OUT);
    fp(-9, hy - 9, 18, 6, outfitPal.hatMid);
    fp(-8, hy - 9, 12, 4, outfitPal.hatLight);
    fp(-2, hy - 9, 4, 1, outfitPal.hatBrim); // crown crease
    fp(-9, hy - 4, 18, 2, '#3b1806'); // dark leather hatband
    fp(-2, hy - 5, 5, 3, '#fbbf24');
    fp(-1, hy - 4, 3, 1, '#78350f');
  } else if (headgear === 'beret_chroniqueur') {
    // Crimson Velvet Chronicler Toque + Gold Trim + Multi-Barb Swaying Plume
    fp(-13, hy - 9, 26, 9, OUT);
    fp(-11, hy - 8, 22, 6, '#7f1d1d');
    fp(-10, hy - 8, 17, 4, '#dc2626');
    fp(-7, hy - 7, 9, 2, '#ef4444');
    fp(-11, hy - 3, 22, 2, '#fbbf24');
    const plumeTip = breeze === 0 ? 0 : 2;
    fp(6, hy - 17, 8, 11, OUT);
    fp(8, hy - 15, 4, 8, '#fef08a');
    fp(8 + plumeTip, hy - 16, 4, 5, '#ffffff');
    fp(7, hy - 9, 2, 3, '#d97706'); // golden feather clasp
  } else if (headgear === 'casque_mineur') {
    // Riveted Copper Caver Dome + Glowing Brass Headlamp
    fp(-13, hy - 9, 26, 9, OUT);
    fp(-11, hy - 8, 22, 6, '#9a3412');
    fp(-9, hy - 8, 18, 4, '#d97706');
    fp(-6, hy - 8, 10, 2, '#fbbf24');
    fp(-12, hy - 3, 24, 2, '#78350f');
    // Copper rivets
    fp(-8, hy - 5, 2, 1, '#fef08a');
    fp(6, hy - 5, 2, 1, '#fef08a');
    const lampX = facingDir === 'left' ? -10 : facingDir === 'right' ? 5 : -3;
    if (facingDir !== 'up') {
      fp(lampX - 1, hy - 9, 8, 7, OUT);
      fp(lampX, hy - 8, 6, 5, '#b45309');
      fp(lampX + 1, hy - 7, 4, 3, flamePulse === 0 ? '#ffffff' : '#fef08a');
    }
  } else if (headgear === 'capuche_sylvestre') {
    // Layered Woodland Ranger Hood + Golden Sprouting Leaf
    fp(-13, hy - 9, 26, 11, OUT);
    fp(-11, hy - 8, 22, 8, '#064e3b');
    fp(-9, hy - 8, 17, 6, '#059669');
    fp(-6, hy - 8, 10, 3, '#34d399');
    fp(-3, hy - 11, 7, 3, '#065f46');
    // Sprouting leaf on crown
    fp(2, hy - 15, 7, 6, OUT);
    fp(3, hy - 14, 5, 4, '#4ade80');
    fp(4, hy - 14, 3, 2, '#bef264');
  } else if (headgear === 'couronne_menhir') {
    // Silver Runic Circlet + Faceted Amethyst + Orbiting Fairy Wisp
    fp(-11, hy - 5, 22, 5, OUT);
    fp(-10, hy - 4, 20, 3, '#cbd5e1');
    fp(-8, hy - 5, 3, 3, '#f8fafc');
    fp(5, hy - 5, 3, 3, '#f8fafc');
    fp(-3, hy - 7, 6, 6, OUT);
    fp(-2, hy - 6, 4, 4, '#9333ea');
    fp(-1, hy - 5, 2, 2, '#f0abfc');
    const sparkX = animTick % 8 < 4 ? -15 : 13;
    fp(sparkX, hy - 11 - breeze * 2, 4, 4, '#fde047');
    fp(sparkX + 1, hy - 10 - breeze * 2, 2, 2, '#ffffff');
  } else if (headgear === 'lunettes_astro') {
    // XIXth-Century Geodesic Top-Hat + Twin Brass Goggles
    fp(-15, hy - 3, 30, 4, OUT);
    fp(-13, hy - 2, 26, 2, '#292524');
    fp(-11, hy - 15, 22, 13, OUT);
    fp(-9, hy - 14, 18, 11, '#44403c');
    fp(-7, hy - 14, 8, 9, '#57534e');
    // Brass strap & twin cyan glass lenses
    fp(-10, hy - 7, 20, 4, '#92400e');
    fp(-8, hy - 8, 7, 5, '#d97706');
    fp(1, hy - 8, 7, 5, '#d97706');
    fp(-7, hy - 7, 5, 3, '#38bdf8');
    fp(2, hy - 7, 5, 3, '#38bdf8');
    fp(-7, hy - 7, 2, 2, '#ffffff');
    fp(2, hy - 7, 2, 2, '#ffffff');
  } else if (headgear === 'tricorne_reliquaire') {
    // Obsidian Relic-Hunter Bicorne + Gold Trim + Scarlet Plume
    fp(-17, hy - 4, 34, 6, OUT);
    fp(-15, hy - 3, 30, 4, '#1c1917');
    fp(-15, hy - 3, 30, 1, '#fbbf24'); // gold braid along brim
    fp(-12, hy - 11, 24, 8, OUT);
    fp(-10, hy - 10, 20, 6, '#292524');
    fp(-8, hy - 9, 14, 3, '#44403c');
    // Gold compass cockade & swaying crimson feather
    fp(-2, hy - 8, 5, 5, '#fbbf24');
    fp(-1, hy - 7, 3, 3, '#fef08a');
    const plumeShift = breeze === 0 ? 0 : 2;
    fp(7, hy - 16, 8, 9, OUT);
    fp(8, hy - 15, 6, 7, '#dc2626');
    fp(9 + plumeShift, hy - 15, 4, 4, '#fca5a5');
  } else if (headgear === 'couronne_saisons') {
    // Wreath of the Four Seasons (Spring blossom, Summer gold, Autumn russet, Winter frost)
    fp(-12, hy - 6, 24, 6, OUT);
    fp(-11, hy - 5, 22, 4, '#15803d');
    fp(-9, hy - 6, 5, 3, '#4ade80'); // spring leaf
    fp(-5, hy - 7, 4, 4, '#f472b6'); // spring blossom
    fp(-1, hy - 7, 4, 4, '#fde047'); // summer sun-gem
    fp(3, hy - 6, 5, 3, '#ea580c'); // autumn oak leaf
    fp(7, hy - 7, 4, 4, '#38bdf8'); // winter frost crystal
    fp(8, hy - 6, 2, 2, '#ffffff');
  } else if (headgear === 'monocle_erudit') {
    // Velvet Burgundy Scholar Toque + Gleaming Gold Monocle & Chain
    fp(-13, hy - 9, 26, 8, OUT);
    fp(-11, hy - 8, 22, 6, '#581c87');
    fp(-9, hy - 8, 16, 4, '#7e22ce');
    fp(-11, hy - 3, 22, 2, '#fbbf24');
    // Gold tassel on side
    fp(-13, hy - 4, 3, 5 + breeze, '#fde047');
    // Monocle over eye & delicate gold chain when face is visible
    if (facingDir !== 'up') {
      const mx = facingDir === 'left' ? -6 + faceShift : 2 + faceShift;
      fp(mx - 1, hy + 2, 6, 1, '#fde047');
      fp(mx - 1, hy + 8, 6, 1, '#d97706');
      fp(mx - 1, hy + 3, 1, 5, '#fbbf24');
      fp(mx + 4, hy + 3, 1, 5, '#fbbf24');
      fp(mx, hy + 3, 2, 2, 'rgba(186, 230, 253, 0.78)');
      // Hanging gold monocle chain
      fp(mx + 4, hy + 8, 1, 3, '#fde047');
      fp(mx + 3, hy + 10, 2, 1, '#d97706');
    }
  }

  // ==========================================================================
  // LAYER E: HELD COSMETIC RELIC / FIELD TOOL IN HAND
  // ==========================================================================
  const toolX = facingDir === 'left' ? -18 : 11;
  const toolY = ty + 2 - (stride === 1 ? 2 : 0);

  if (tool === 'lanterne_laiton') {
    // Brass Handle Ring + Caged Lantern + Dancing Flame
    fp(toolX + 2, toolY - 2, 3, 2, '#d97706');
    fp(toolX, toolY, 7, 11, OUT);
    fp(toolX + 1, toolY, 5, 2, '#d97706');
    fp(toolX + 1, toolY + 2, 5, 6, outfitPal.lanternCore);
    fp(toolX + 2, toolY + 3, 3, 4, flamePulse === 0 ? '#ffffff' : '#fef08a');
    fp(toolX + 1, toolY + 8, 5, 2, '#b45309');
  } else if (tool === 'plume_enluminee') {
    fp(toolX - 2, toolY + 2, 10, 7, OUT);
    fp(toolX - 1, toolY + 3, 8, 4, '#fef3c7');
    fp(toolX + 3, toolY + 3, 1, 4, '#d97706');
    fp(toolX + 2, toolY - 6 + breeze * 2, 5, 8, OUT);
    fp(toolX + 3, toolY - 5 + breeze * 2, 3, 6, '#fde047');
    fp(toolX + 4, toolY - 6 + breeze * 2, 2, 3, '#ffffff');
  } else if (tool === 'marteau_geologue') {
    fp(toolX - 1, toolY - 5, 10, 5, OUT);
    fp(toolX, toolY - 4, 8, 3, '#38bdf8');
    fp(toolX + 5, toolY - 4, 3, 2, '#ffffff');
    fp(toolX + 2, toolY, 4, 10, OUT);
    fp(toolX + 3, toolY, 2, 8, '#92400e');
  } else if (tool === 'boussole_astrale') {
    const spin = animTick % 4 < 2;
    fp(toolX - 1, toolY - 2, 9, 9, OUT);
    fp(toolX, toolY - 1, 7, 7, '#f59e0b');
    fp(toolX + 2, toolY + 1, 3, 3, spin ? '#ffffff' : '#38bdf8');
    if (spin) {
      fp(toolX + 3, toolY - 2, 2, 9, '#fde047');
    } else {
      fp(toolX - 1, toolY + 2, 9, 2, '#fde047');
    }
  } else if (tool === 'fiole_spectrale') {
    fp(toolX, toolY, 7, 10, OUT);
    fp(toolX + 1, toolY + 1, 5, 7, '#c084fc');
    fp(toolX + 2, toolY + 2, 2, 3, '#ffffff');
    const orbAngle = ((animTick % 12) / 12) * Math.PI * 2;
    const orbX = Math.round(Math.cos(orbAngle) * 19);
    const orbY = Math.round(ty - 6 + Math.sin(orbAngle) * 9);
    fp(orbX, orbY, 5, 5, '#2e1065');
    fp(orbX + 1, orbY + 1, 3, 3, '#67e8f9');
    fp(orbX + 1, orbY + 1, 2, 2, '#ffffff');
  } else if (tool === 'sablier_ephemeride') {
    // Astral Hourglass with brass caps & trickling golden sand
    const sandStep = animTick % 4;
    fp(toolX, toolY - 2, 8, 12, OUT);
    fp(toolX + 1, toolY - 1, 6, 2, '#fbbf24'); // top brass cap
    fp(toolX + 1, toolY + 7, 6, 2, '#fbbf24'); // bottom brass cap
    fp(toolX + 1, toolY + 1, 6, 3, '#38bdf8'); // upper bulb
    fp(toolX + 2, toolY + 2, 4, 2, '#fde047'); // upper sand
    fp(toolX + 3, toolY + 3 + (sandStep % 2), 2, 3, '#fef08a'); // falling sand stream
    fp(toolX + 1, toolY + 4, 6, 3, '#0284c7'); // lower bulb
    fp(toolX + 2, toolY + 6, 4, 1, '#fde047'); // lower sand mound
  } else if (tool === 'loupe_sceau_or') {
    // Chiselled Gold Scholar Magnifying Glass with Sapphire Lens
    fp(toolX - 1, toolY - 4, 9, 9, OUT);
    fp(toolX, toolY - 3, 7, 7, '#fbbf24');
    fp(toolX + 1, toolY - 2, 5, 5, '#38bdf8');
    fp(toolX + 1, toolY - 2, 2, 2, '#ffffff');
    fp(toolX + 2, toolY + 5, 3, 6, OUT);
    fp(toolX + 3, toolY + 5, 1, 5, '#d97706');
  } else if (tool === 'clef_coffres_anciens') {
    // Gleaming Golden Skeleton Key of Ancient Caches
    fp(toolX, toolY - 4, 7, 6, OUT);
    fp(toolX + 1, toolY - 3, 5, 4, '#fde047');
    fp(toolX + 2, toolY - 2, 3, 2, OUT); // bow hole
    fp(toolX + 2, toolY + 2, 3, 9, OUT);
    fp(toolX + 3, toolY + 2, 1, 8, '#fbbf24');
    // Key ward teeth
    fp(toolX + 4, toolY + 6, 3, 4, OUT);
    fp(toolX + 4, toolY + 7, 2, 1, '#fde047');
    fp(toolX + 4, toolY + 9, 2, 1, '#fde047');
  }

  // ==========================================================================
  // LAYER F: ANIMATED 16-BIT COMPANION FAMILIAR (SIDE / TRAILING LOYAL PET)
  // ==========================================================================
  if (familiar && familiar !== 'aucun') {
    // Position beside explorer (left side when down/up; trailing behind when walking left/right)
    const fx = facingDir === 'left' ? 21 : facingDir === 'right' ? -22 : -21;
    const fLookRight = facingDir !== 'left';
    const fFlip = fLookRight ? 1 : -1;
    const wingFlap = Math.floor(animTick / 2) % 2;
    const petHop = isWalking ? (stride % 2 === 1 ? -2 : 0) : idleBreathe ? -1 : 0;

    // Subtle ground shadow under the companion
    fp(fx - 6, -2, 12, 3, 'rgba(20, 12, 7, 0.34)');

    if (familiar === 'chouette_erudite') {
      // Athéna: Hovering Tawny Owl with Brass Scholar Spectacles
      const oyPet = -18 + (wingFlap === 0 ? -2 : 0);
      // Flapping wings
      if (wingFlap === 0) {
        fp(fx - 9, oyPet - 2, 18, 6, OUT);
        fp(fx - 8, oyPet - 1, 16, 4, '#92400e');
      } else {
        fp(fx - 8, oyPet + 2, 16, 5, OUT);
        fp(fx - 7, oyPet + 3, 14, 3, '#78350f');
      }
      // Rounded owl body & ear tufts
      fp(fx - 6, oyPet - 5, 12, 13, OUT);
      fp(fx - 5, oyPet - 6, 3, 2, OUT);
      fp(fx + 2, oyPet - 6, 3, 2, OUT);
      fp(fx - 5, oyPet - 4, 10, 11, '#b45309');
      fp(fx - 3, oyPet + 1, 6, 5, '#fef3c7'); // speckled cream belly
      fp(fx - 2, oyPet + 3, 1, 1, '#92400e');
      fp(fx + 1, oyPet + 3, 1, 1, '#92400e');
      // Brass spectacles + golden eyes + beak
      fp(fx - 4, oyPet - 2, 3, 3, '#fbbf24');
      fp(fx + 1, oyPet - 2, 3, 3, '#fbbf24');
      fp(fx - 3, oyPet - 1, 2, 2, '#160d07');
      fp(fx + 2, oyPet - 1, 2, 2, '#160d07');
      fp(fx - 3, oyPet - 1, 1, 1, '#ffffff');
      fp(fx + 2, oyPet - 1, 1, 1, '#ffffff');
      fp(fx - 1, oyPet, 2, 2, '#f59e0b');
    } else if (familiar === 'goupil_saisons') {
      // Goupil: Russet Fox with White-Tipped Tail & Emerald Scarf
      const gy = -11 + petHop;
      // Fluffy wagging tail
      const tailX = fx - fFlip * 8;
      fp(tailX - 2, gy - 1 - breeze, 6, 7, OUT);
      fp(tailX - 1, gy - breeze, 4, 5, '#ea580c');
      fp(tailX - (fLookRight ? 1 : -1), gy - breeze, 2, 3, '#ffffff');
      // Fox body & paws
      fp(fx - 5, gy + 1, 10, 8, OUT);
      fp(fx - 4, gy + 2, 8, 5, '#ea580c');
      fp(fx - 3, gy + 7, 2, 3, '#1c1917');
      fp(fx + 1, gy + 7, 2, 3, '#1c1917');
      // Emerald neckerchief
      fp(fx - 4, gy + 1, 8, 2, '#059669');
      // Pointed ears & fox head
      fp(fx - 5, gy - 6, 10, 8, OUT);
      fp(fx - 5, gy - 8, 3, 3, OUT);
      fp(fx + 2, gy - 8, 3, 3, OUT);
      fp(fx - 4, gy - 7, 2, 2, '#ea580c');
      fp(fx + 2, gy - 7, 2, 2, '#ea580c');
      fp(fx - 4, gy - 5, 8, 6, '#f97316');
      fp(fx - 3, gy - 1, 6, 2, '#fff7ed'); // white cheeks
      fp(fx - 3, gy - 3, 2, 2, OUT);
      fp(fx + 1, gy - 3, 2, 2, OUT);
      fp(fx + fFlip * 2, gy - 1, 2, 1, OUT); // nose
    } else if (familiar === 'scarabee_boussole') {
      // Scarabée Boussole d'Airain: Clockwork Gold & Emerald Beetle
      const sy = -16 + (wingFlap === 0 ? -1 : 1);
      // Translucent fluttering wings
      if (wingFlap === 0) {
        fp(fx - 9, sy - 2, 18, 4, 'rgba(186, 230, 253, 0.85)');
      } else {
        fp(fx - 7, sy, 14, 3, 'rgba(125, 211, 252, 0.75)');
      }
      // Golden carapace & emerald elytra
      fp(fx - 5, sy - 4, 10, 10, OUT);
      fp(fx - 4, sy - 3, 8, 8, '#fbbf24');
      fp(fx - 3, sy - 1, 6, 5, '#059669');
      fp(fx - 1, sy, 2, 3, flamePulse === 0 ? '#ffffff' : '#fde047'); // glowing compass needle
      // Golden antennae
      fp(fx - 3, sy - 6, 2, 2, '#fde047');
      fp(fx + 1, sy - 6, 2, 2, '#fde047');
    } else if (familiar === 'hermine_royale') {
      // Hermine Blanche des Éclaireurs: Snowy Stoat with Black-Tipped Tail & Crimson Bell
      const ey = -10 + petHop;
      const tailX = fx - fFlip * 7;
      fp(tailX - 2, ey - breeze, 5, 6, OUT);
      fp(tailX - 1, ey + 1 - breeze, 3, 4, '#ffffff');
      fp(tailX - (fLookRight ? 1 : 0), ey - breeze, 2, 2, '#0f172a'); // iconic black tail tip!
      // Slender white body & collar
      fp(fx - 4, ey + 1, 8, 8, OUT);
      fp(fx - 3, ey + 2, 6, 6, '#f8fafc');
      fp(fx - 3, ey + 1, 6, 2, '#dc2626');
      fp(fx - 1, ey + 2, 2, 2, '#fde047'); // golden bell
      // Rounded stoat head & bright dark eyes
      fp(fx - 4, ey - 5, 8, 7, OUT);
      fp(fx - 3, ey - 4, 6, 5, '#ffffff');
      fp(fx - 3, ey - 5, 2, 2, '#fda4af');
      fp(fx + 1, ey - 5, 2, 2, '#fda4af');
      fp(fx - 2, ey - 2, 1, 2, OUT);
      fp(fx + 1, ey - 2, 1, 2, OUT);
    } else if (familiar === 'corbeau_cartographe') {
      // Corbeau Porte-Parchemin: Midnight Raven with Wax-Sealed Scroll in Beak
      const ry = -18 + (wingFlap === 0 ? -2 : 0);
      if (wingFlap === 0) {
        fp(fx - 9, ry - 3, 18, 6, OUT);
        fp(fx - 8, ry - 2, 16, 4, '#1e293b');
      } else {
        fp(fx - 7, ry + 1, 14, 5, OUT);
        fp(fx - 6, ry + 2, 12, 3, '#334155');
      }
      fp(fx - 5, ry - 5, 10, 11, OUT);
      fp(fx - 4, ry - 4, 8, 9, '#0f172a');
      fp(fx - 3, ry - 3, 5, 4, '#334155'); // iridescent blue-slate sheen
      fp(fx + (fLookRight ? 1 : -2), ry - 2, 2, 2, '#fde047'); // bright eye
      // Beak + miniature parchment scroll with red wax seal
      const beakX = fx + fFlip * 4;
      fp(beakX - 1, ry - 1, 3, 2, '#f59e0b');
      fp(beakX - 2, ry + 1, 6, 3, '#fef3c7');
      fp(beakX, ry + 1, 2, 2, '#dc2626');
    } else if (familiar === 'salamandre_cristal') {
      // Salamandre des Géodes: Cobalt Cave Salamander with Glowing Crystal Dorsal Spines
      const cyPet = -8 + (stride % 2 === 1 ? -1 : 0);
      const crystalGlow = flamePulse === 0 ? '#ffffff' : '#38bdf8';
      // Curling tail
      const tailX = fx - fFlip * 7;
      fp(tailX - 2, cyPet + 1, 6, 5, OUT);
      fp(tailX - 1, cyPet + 2, 4, 3, '#1d4ed8');
      // Body + glowing dorsal crystals
      fp(fx - 5, cyPet, 10, 7, OUT);
      fp(fx - 4, cyPet + 1, 8, 5, '#1e40af');
      fp(fx - 3, cyPet - 3, 2, 3, crystalGlow);
      fp(fx, cyPet - 4, 2, 4, '#fde047');
      fp(fx + 2, cyPet - 2, 2, 3, crystalGlow);
      // Head & golden eyes
      const hx = fx + fFlip * 3;
      fp(hx - 3, cyPet - 1, 6, 6, OUT);
      fp(hx - 2, cyPet, 4, 4, '#2563eb');
      fp(hx + (fLookRight ? 0 : -1), cyPet + 1, 2, 2, '#fde047');
    } else if (familiar === 'feu_follet_astral') {
      // Feu-Follet des Éphémérides: Starlight Wisp with Miniature Golden Crown
      const wy = -19 + (wingFlap === 0 ? -2 : 1);
      // Outer celestial aura
      fp(fx - 6, wy - 4, 12, 12, 'rgba(56, 189, 248, 0.35)');
      fp(fx - 4, wy - 3, 8, 9, OUT);
      fp(fx - 3, wy - 2, 6, 7, '#38bdf8');
      fp(fx - 2, wy - 1, 4, 5, '#fef08a');
      fp(fx - 1, wy, 2, 2, '#ffffff');
      // Expressive eyes
      fp(fx - 2, wy + 1, 1, 2, OUT);
      fp(fx + 1, wy + 1, 1, 2, OUT);
      // Tiny 3-point golden crown floating above wisp
      fp(fx - 3, wy - 6, 6, 3, '#fbbf24');
      fp(fx - 3, wy - 7, 1, 1, '#fde047');
      fp(fx, wy - 7, 1, 1, '#ffffff');
      fp(fx + 2, wy - 7, 1, 1, '#fde047');
      // Orbiting stardust mote
      const moteX = fx + (animTick % 6 < 3 ? -7 : 6);
      fp(moteX, wy - 2 + breeze * 2, 2, 2, '#fde047');
    }
  }
}
