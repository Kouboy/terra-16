import {
  computeLevelFromXp,
  ExplorationCategory,
  ExplorerProgress,
  getCategoryXp,
  UnlockedEntry,
} from './types';

export interface MissionDefinition {
  id: string;
  arcName: string;
  title: string;
  description: string;
  category: ExplorationCategory | 'global';
  requiredCategoryLevel: number;
  requiredGlobalLevel: number;
  xpBonus: number;
  evaluate: (entries: UnlockedEntry[]) => { current: number; target: number };
}

export const MISSIONS_CATALOG: MissionDefinition[] = [
  {
    id: 'm_first_discovery',
    arcName: 'Prologue',
    title: 'Premiers Pas en Terra Incognita',
    description: 'Approchez-vous d’un cristal « ? » sur la carte JRPG 16-bit pour révéler votre premier lieu secret.',
    category: 'global',
    requiredCategoryLevel: 1,
    requiredGlobalLevel: 1,
    xpBonus: 100,
    evaluate: (entries) => ({ current: Math.min(1, entries.length), target: 1 }),
  },
  {
    id: 'm_near_river',
    arcName: 'Hydrologie',
    title: 'Au Fil de l’Eau Vive',
    description: 'Découvrez un point d’intérêt situé à proximité d’une rivière, d’une source ou d’un cours d’eau.',
    category: 'geographie',
    requiredCategoryLevel: 1,
    requiredGlobalLevel: 1,
    xpBonus: 145,
    evaluate: (entries) => ({
      current: Math.min(1, entries.filter((e) => e.nearWaterway).length),
      target: 1,
    }),
  },
  {
    id: 'm_folklore_whisper',
    arcName: 'Folklore',
    title: 'Chasseur de Rumeurs & Légendes',
    description: 'Révélez une légende urbaine ou rurale, un mégalithe à contes ou une curiosité insolite.',
    category: 'legende',
    requiredCategoryLevel: 1,
    requiredGlobalLevel: 1,
    xpBonus: 165,
    evaluate: (entries) => ({
      current: Math.min(1, entries.filter((e) => e.category === 'legende').length),
      target: 1,
    }),
  },
  {
    id: 'm_deep_geology',
    arcName: 'Temps Profond',
    title: 'Mémoire Minérale & Fossiles',
    description: 'Débloquez un affleurement géologique, un gisement fossilifère ou une singularité du relief.',
    category: 'geographie',
    requiredCategoryLevel: 1,
    requiredGlobalLevel: 1,
    xpBonus: 155,
    evaluate: (entries) => ({
      current: Math.min(1, entries.filter((e) => e.category === 'geographie').length),
      target: 1,
    }),
  },
  {
    id: 'm_field_chronicler',
    arcName: 'Carnet',
    title: 'Plume & Objectif de Terrain',
    description: 'Consignez votre propre commentaire ou ajoutez une photo sur une page de votre Carnet d’exploration.',
    category: 'global',
    requiredCategoryLevel: 1,
    requiredGlobalLevel: 1,
    xpBonus: 130,
    evaluate: (entries) => ({
      current: Math.min(
        1,
        entries.filter((e) => e.personalNote.trim().length > 0 || e.photoCount > 0).length
      ),
      target: 1,
    }),
  },
  {
    id: 'm_underground_echo',
    arcName: 'Ombres',
    title: 'L’Appel des Souterrains',
    description: 'Approchez-vous d’une entrée de cavité, carrière souterraine, ruine ou friche oubliée.',
    category: 'etrange',
    requiredCategoryLevel: 1,
    requiredGlobalLevel: 1,
    xpBonus: 175,
    evaluate: (entries) => ({
      current: Math.min(1, entries.filter((e) => e.category === 'etrange').length),
      target: 1,
    }),
  },
  {
    id: 'm_living_trace',
    arcName: 'Vivant',
    title: 'Sentinelle de la Biodiversité',
    description: 'Observez une espèce patrimoniale (iNaturalist / GBIF) ou un arbre remarquable.',
    category: 'ecosysteme',
    requiredCategoryLevel: 1,
    requiredGlobalLevel: 1,
    xpBonus: 150,
    evaluate: (entries) => ({
      current: Math.min(1, entries.filter((e) => e.category === 'ecosysteme').length),
      target: 1,
    }),
  },
  {
    id: 'm_time_traveler',
    arcName: 'Strates d’Histoire',
    title: 'Archéologue des Strates',
    description: 'Débloquez des lieux issus d’au moins 3 époques ou strates temporelles différentes dans votre Carnet.',
    category: 'histoire',
    requiredCategoryLevel: 2,
    requiredGlobalLevel: 2,
    xpBonus: 250,
    evaluate: (entries) => {
      const distinctEras = new Set(entries.map((e) => e.eraLabel).filter(Boolean));
      return { current: Math.min(3, distinctEras.size), target: 3 };
    },
  },
  {
    id: 'm_connected_lore',
    arcName: 'Réseau Secret',
    title: 'Fils Invisibles du Territoire',
    description: 'Découvrez 2 points d’intérêt reliés entre eux par une connexion dans le Carnet.',
    category: 'histoire',
    requiredCategoryLevel: 2,
    requiredGlobalLevel: 2,
    xpBonus: 240,
    evaluate: (entries) => {
      const unlockedSet = new Set(entries.map((e) => e.poiId));
      let hasPair = 0;
      for (const entry of entries) {
        if (entry.relatedPoiIds.some((relId) => unlockedSet.has(relId))) {
          hasPair = 2;
          break;
        }
      }
      if (hasPair === 0 && entries.some((e) => e.relatedPoiIds.length > 0)) {
        hasPair = 1;
      }
      return { current: hasPair, target: 2 };
    },
  },
  {
    id: 'm_myth_master',
    arcName: 'Grimoire',
    title: 'Archiviste de l’Insolite',
    description: 'Annoter (commentaire ou photo) une légende locale ou un vestige souterrain.',
    category: 'legende',
    requiredCategoryLevel: 2,
    requiredGlobalLevel: 2,
    xpBonus: 270,
    evaluate: (entries) => ({
      current: Math.min(
        1,
        entries.filter(
          (e) =>
            (e.category === 'legende' || e.category === 'etrange') &&
            (e.personalNote.trim().length > 0 || e.photoCount > 0)
        ).length
      ),
      target: 1,
    }),
  },
  {
    id: 'm_preventive_archeo',
    arcName: 'Sous les Pavés',
    title: 'Fouilles & Strates Enfouies',
    description:
      'Débloquez un gisement de fouilles archéologiques (Atlas / INRAP), un site antique ou un vestige préhistorique.',
    category: 'histoire',
    requiredCategoryLevel: 1,
    requiredGlobalLevel: 1,
    xpBonus: 170,
    evaluate: (entries) => ({
      current: Math.min(
        1,
        entries.filter((e) =>
          /archéo|inrap|fouille|antique|gallo|préhistoire|mégalithe/i.test(
            `${e.source} ${e.subType} ${e.eraLabel}`
          )
        ).length
      ),
      target: 1,
    }),
  },
  {
    id: 'm_palissy_and_arts',
    arcName: 'Arts & Lettres',
    title: 'Reliques Classées & Regards d’Artistes',
    description:
      'Révélez un trésor mobilier classé (Base Palissy), un tableau (Base Joconde), un lieu de roman ou de tournage.',
    category: 'histoire',
    requiredCategoryLevel: 1,
    requiredGlobalLevel: 1,
    xpBonus: 165,
    evaluate: (entries) => ({
      current: Math.min(
        1,
        entries.filter((e) =>
          /palissy|joconde|littéraire|peinture|cinéma|tournage/i.test(
            `${e.source} ${e.subType} ${e.eraLabel}`
          )
        ).length
      ),
      target: 1,
    }),
  },
  {
    id: 'm_ghost_rails_and_toponyms',
    arcName: 'Mémoire Effacée',
    title: 'Rails Fantômes, Friches & Lieux-Dits',
    description:
      'Explorez un ancien lieu-dit cadastral, une voie ferrée déclassée ou une friche industrielle et ouvrière.',
    category: 'etrange',
    requiredCategoryLevel: 1,
    requiredGlobalLevel: 1,
    xpBonus: 175,
    evaluate: (entries) => ({
      current: Math.min(
        1,
        entries.filter((e) =>
          /toponym|lieu-dit|ferroviaire|voie ferrée|friche|industriel|moulin/i.test(
            `${e.source} ${e.subType} ${e.name}`
          )
        ).length
      ),
      target: 1,
    }),
  },
  {
    id: 'm_inpn_sanctuary',
    arcName: 'PatriNat & INPN',
    title: 'Gardien des Géosites & Refuges Sauvages',
    description:
      'Découvrez un géosite national (INPG), une zone écologique ZNIEFF ou un arbre remarquable centenaire.',
    category: 'ecosysteme',
    requiredCategoryLevel: 1,
    requiredGlobalLevel: 1,
    xpBonus: 175,
    evaluate: (entries) => ({
      current: Math.min(
        1,
        entries.filter((e) =>
          /inpg|inpn|znieff|arbre remarquable|site naturel/i.test(
            `${e.source} ${e.subType} ${e.name}`
          )
        ).length
      ),
      target: 1,
    }),
  },
  {
    id: 'm_speleo_cavites',
    arcName: 'Sous-sol & BRGM',
    title: 'Cartographe des Cavités & Gouffres',
    description:
      'Révélez une cavité naturelle, grotte, carrière souterraine, crypte ou ouvrage enfoui (BRGM / IGN).',
    category: 'etrange',
    requiredCategoryLevel: 1,
    requiredGlobalLevel: 1,
    xpBonus: 190,
    evaluate: (entries) => ({
      current: Math.min(
        1,
        entries.filter((e) =>
          /cavité|bdcavités|brgm|grotte|gouffre|aven|carrière|souterrain|mine|crypte|tunnel/i.test(
            `${e.source} ${e.subType} ${e.name} ${e.summary}`
          )
        ).length
      ),
      target: 1,
    }),
  },
  {
    id: 'm_subterranean_veteran',
    arcName: 'Maître Spéléologue',
    title: 'Veilleur des Profondeurs',
    description:
      'Débloquez au moins 3 lieux de la branche Souterrains, Friches & Rails dans votre Carnet d’exploration.',
    category: 'etrange',
    requiredCategoryLevel: 2,
    requiredGlobalLevel: 2,
    xpBonus: 280,
    evaluate: (entries) => ({
      current: Math.min(3, entries.filter((e) => e.category === 'etrange').length),
      target: 3,
    }),
  },
  {
    id: 'm_ign_geodesic_hunter',
    arcName: 'Géodésie IGN',
    title: 'Chasseur de Médaillons & Bornes IGN',
    description:
      'Dénichez en marchant un repère de nivellement en bronze scellé sur un mur ou une borne géodésique de triangulation IGN.',
    category: 'geographie',
    requiredCategoryLevel: 1,
    requiredGlobalLevel: 1,
    xpBonus: 185,
    evaluate: (entries) => ({
      current: Math.min(
        1,
        entries.filter((e) =>
          /nivellement|géodésique|geodesique|médaillon|repère ign|triangulation|rbf|rdf/i.test(
            `${e.source} ${e.subType} ${e.name} ${e.summary}`
          )
        ).length
      ),
      target: 1,
    }),
  },
  {
    id: 'm_rural_vernacular',
    arcName: 'Petit Patrimoine',
    title: 'Veilleur des Lavoirs, Fours & Fontaines',
    description:
      'Découvrez 2 trésors du petit patrimoine : lavoir communal, four à pain, moulin à eau ou à vent, calvaire, pigeonnier ou fontaine miraculeuse.',
    category: 'histoire',
    requiredCategoryLevel: 1,
    requiredGlobalLevel: 1,
    xpBonus: 210,
    evaluate: (entries) => ({
      current: Math.min(
        2,
        entries.filter((e) =>
          /lavoir|four banal|four à pain|fournil|moulin|calvaire|croix de chemin|oratoire|pigeonnier|colombier|fontaine miraculeuse|source sacrée|bonne fontaine|puits ancien/i.test(
            `${e.subType} ${e.name} ${e.summary}`
          )
        ).length
      ),
      target: 2,
    }),
  },
  {
    id: 'm_buried_rivers_faults',
    arcName: 'Hydrogéologie & Filons',
    title: 'Rivières Enfouies, Failles & Cryptes',
    description:
      'Explorez une rivière enterrée ou busée, une faille géologique, un filon minier BRGM ou une crypte voûtée sous un édifice ancien.',
    category: 'geographie',
    requiredCategoryLevel: 1,
    requiredGlobalLevel: 1,
    xpBonus: 205,
    evaluate: (entries) => ({
      current: Math.min(
        1,
        entries.filter((e) =>
          /enterré|busé|pertuis|aqueduc|faille|filon|gîte|crypte|hypogée|karstique/i.test(
            `${e.subType} ${e.name} ${e.summary}`
          )
        ).length
      ),
      target: 1,
    }),
  },
];

export function isMissionUnlocked(mission: MissionDefinition, progress: ExplorerProgress): boolean {
  const globalLvl = computeLevelFromXp(progress.totalXp).level;
  if (mission.category === 'global') {
    return globalLvl >= mission.requiredGlobalLevel;
  }
  const catXp = getCategoryXp(progress, mission.category);
  const catLvl = computeLevelFromXp(catXp).level;
  return catLvl >= mission.requiredCategoryLevel || globalLvl >= mission.requiredGlobalLevel + 1;
}
