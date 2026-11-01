import React, { useEffect, useRef } from 'react';
import {
  BedrockInfo,
  CollectedSpecimen,
  ElevationGrid,
  LithologyAffinity,
  PoiItem,
  SpecimenDomain,
  TerrainFeature,
  haversineMeters,
  sampleElevationMeters,
} from './types';

export interface SpecimenCatalogItem {
  id: string;
  domain: SpecimenDomain;
  affinity: LithologyAffinity;
  secondaryAffinities?: LithologyAffinity[];
  name: string;
  latinOrMineralName: string;
  familyLabel: string;
  defaultHabitatLabel: string;
  clueHint: string;
  isSubterranean: boolean;
  baseNarrative: string;
}

export interface WorldSpecimenNode {
  nodeId: string;
  specimenId: string;
  domain: SpecimenDomain;
  affinity: LithologyAffinity;
  name: string;
  latinOrMineralName: string;
  familyLabel: string;
  habitatLabel: string;
  lithologyLabel: string;
  bedrockPeriod: string;
  bedrockAgeMa: string;
  lat: number;
  lng: number;
  altitudeMeters: number | null;
  isSubterranean: boolean;
  seed: number;
  description: string;
}

// Tile & dungeon constants matching PixelMapCanvas
const T_MEADOW = 0;
const T_FARMLAND = 2;
const T_PARK = 3;
const T_FOREST = 4;
const T_WATER = 6;
const T_PATH = 7;
const T_STEPS = 10;
const T_CEMETERY = 16;
const T_SAND = 17;
const T_SCRUB = 18;
const T_WETLAND = 19;
const T_SCREE = 20;

const D_ROCK = 0;
const D_GALLERY = 1;
const D_SUB_WATER = 3;
const D_QUARRY_HALL = 5;
const D_NATURAL_CAVERN = 6;
const D_CRYPT = 7;
const D_CULVERT = 9;
const D_AQUEDUCT = 10;
const D_FAULT_VEIN = 11;

function specHash(a: number, b: number): number {
  let h = (Math.imul(a, 2246822519) + Math.imul(b, 3266489917)) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  return (h ^ (h >>> 13)) >>> 0;
}

export const LITHOLOGY_AFFINITY_META: Record<
  LithologyAffinity,
  { labelFr: string; soilNoteFr: string; rockColor: string; accentColor: string }
> = {
  calcaire: {
    labelFr: 'Socle calcaire & carbonaté',
    soilNoteFr: 'Sols chauds, perméables et riches en carbonate de calcium',
    rockColor: '#e7d8be',
    accentColor: '#d97706',
  },
  granit: {
    labelFr: 'Socle granitique & cristallin',
    soilNoteFr: 'Arènes siliceuses acides nées de l’altération du pluton',
    rockColor: '#e2b8a8',
    accentColor: '#be185d',
  },
  schiste: {
    labelFr: 'Massif schisteux & métamorphique',
    soilNoteFr: 'Feuillets sombres retenant fraîcheur minérale et mousses',
    rockColor: '#64748b',
    accentColor: '#eab308',
  },
  gres: {
    labelFr: 'Bancs de grès & sables siliceux',
    soilNoteFr: 'Terres filtrantes de quartz propices aux landes et bruyères',
    rockColor: '#d99b66',
    accentColor: '#9333ea',
  },
  alluvions: {
    labelFr: 'Alluvions & terrasses fluviales',
    soilNoteFr: 'Limons fertiles, galets roulés et nappes phréatiques proches',
    rockColor: '#a8a29e',
    accentColor: '#0284c7',
  },
  volcanique: {
    labelFr: 'Épanchements basaltiques & volcaniques',
    soilNoteFr: 'Andosols sombres riches en oligo-éléments et prismes de lave',
    rockColor: '#3f3f46',
    accentColor: '#65a30d',
  },
  souterrain: {
    labelFr: 'Cavités, carrières & karst profond',
    soilNoteFr: 'Atmosphère saturée où cristallisent calcite et gypse dans l’ombre',
    rockColor: '#44403c',
    accentColor: '#22d3ee',
  },
};

export function translateBedrockPeriodFr(raw?: string): string {
  if (!raw) return 'Temps géologiques anciens';
  const map: Array<[RegExp, string]> = [
    [/quaternary/i, 'Quaternaire'],
    [/holocene/i, 'Holocène'],
    [/pleistocene/i, 'Pléistocène'],
    [/neogene/i, 'Néogène'],
    [/miocene/i, 'Miocène'],
    [/pliocene/i, 'Pliocène'],
    [/paleogene/i, 'Paléogène'],
    [/eocene/i, 'Éocène'],
    [/oligocene/i, 'Oligocène'],
    [/paleocene/i, 'Paléocène'],
    [/cretaceous/i, 'Crétacé'],
    [/jurassic/i, 'Jurassique'],
    [/triassic/i, 'Trias'],
    [/permian/i, 'Permien'],
    [/carboniferous/i, 'Carbonifère'],
    [/devonian/i, 'Dévonien'],
    [/silurian/i, 'Silurien'],
    [/ordovician/i, 'Ordovicien'],
    [/cambrian/i, 'Cambrien'],
    [/precambrian|proterozoic|archean/i, 'Précambrien'],
  ];
  for (const [rx, fr] of map) {
    if (rx.test(raw)) return fr;
  }
  return raw;
}

export function translateLithologyLabelFr(
  bedrock: BedrockInfo | null | undefined,
  fallbackAffinity: LithologyAffinity
): string {
  if (!bedrock || !bedrock.lithology) {
    return LITHOLOGY_AFFINITY_META[fallbackAffinity].labelFr;
  }
  const l = bedrock.lithology.toLowerCase();
  if (/limestone|calcaire/.test(l)) return 'Calcaire sédimentaire';
  if (/chalk|craie/.test(l)) return 'Craie blanche à silex';
  if (/dolostone|dolomite/.test(l)) return 'Dolomie & bancs carbonatés';
  if (/marl|marne/.test(l)) return 'Marnes & calcaires argileux';
  if (/granit|plutonic|tonalite|diorite/.test(l)) return 'Granite & roches plutoniques';
  if (/gneiss/.test(l)) return 'Gneiss & socle cristallin';
  if (/schist|slate|shale|phyllite|mudstone|argillite|claystone|siltstone/.test(l)) {
    return 'Schistes & pélites feuilletées';
  }
  if (/sandstone|arenite|arkose|quartzite|conglomerate/.test(l)) {
    return 'Grès siliceux & quartzites';
  }
  if (/basalt|volcanic|andesite|rhyolite|trachyte|tuff|mafic/.test(l)) {
    return 'Basaltes & roches volcaniques';
  }
  if (/alluvium|fluvial|gravel|sand|loess|sediment|unconsolidated/.test(l)) {
    return 'Alluvions, sables & galets';
  }
  return LITHOLOGY_AFFINITY_META[fallbackAffinity].labelFr;
}

/**
 * Classifies the real geological bedrock (Macrostrat) + local hydrography into a primary
 * `LithologyAffinity` so harvested plants and minerals genuinely match the ground beneath the player!
 */
export function classifySectorLithology(
  bedrock: BedrockInfo | null | undefined,
  terrain: TerrainFeature[] = []
): LithologyAffinity {
  const raw = `${bedrock?.lithology || ''} ${bedrock?.environment || ''} ${bedrock?.period || ''}`.toLowerCase();

  if (/basalt|volcanic|andesite|rhyolite|trachyte|tuff|scoria|mafic/.test(raw)) {
    return 'volcanique';
  }
  if (/granit|plutonic|felsic|tonalite|diorite|pegmatite|intrusive/.test(raw)) {
    return 'granit';
  }
  if (/schist|slate|phyllite|gneiss|metamorphic|shale|argillite/.test(raw)) {
    return 'schiste';
  }
  if (/sandstone|arenite|arkose|quartzite|conglomerate|grès/.test(raw)) {
    return 'gres';
  }
  if (/limestone|chalk|carbonate|marl|dolostone|dolomite|calcaire|craie|marne|marine/.test(raw)) {
    return 'calcaire';
  }
  if (/alluvium|fluvial|gravel|terrace|loess|unconsolidated|quaternary|holocene|pleistocene/.test(raw)) {
    return 'alluvions';
  }

  // Fallback when Macrostrat unit is generic sedimentary or unavailable: inspect real OSM hydrography/forests
  const hasMajorWater = terrain.some(
    (t) => t.kind === 'water' || (t.kind === 'waterway' && t.waterwayRank === 'river')
  );
  if (hasMajorWater) return 'alluvions';
  return 'calcaire';
}

export const SPECIMENS_CATALOG: SpecimenCatalogItem[] = [
  // ==================== 8 PLANCHES D'HERBIER BOTANIQUE ====================
  {
    id: 'bot_ophrys_abeille',
    domain: 'botanique',
    affinity: 'calcaire',
    name: 'Ophrys abeille',
    latinOrMineralName: 'Ophrys apifera',
    familyLabel: 'Herbier · Orchidacée calcicole',
    defaultHabitatLabel: 'Pelouses sèches & talus calcaires',
    clueHint: 'Pousse sur les pelouses et prairies en région au sous-sol calcaire ou crayeux.',
    isSubterranean: false,
    baseNarrative:
      'Orchidée sauvage emblématique des coteaux calcaires bien drainés : son labelle velouté imite à s’y méprendre l’abdomen d’une abeille solitaire.',
  },
  {
    id: 'bot_thym_serpolet',
    domain: 'botanique',
    affinity: 'calcaire',
    secondaryAffinities: ['schiste', 'volcanique'],
    name: 'Thym serpolet des coteaux',
    latinOrMineralName: 'Thymus serpyllum',
    familyLabel: 'Herbier · Lamiacée aromatique',
    defaultHabitatLabel: 'Dalles pierreuses & sentiers ensoleillés',
    clueHint: 'Tapissent les rebords pierreux, murets secs et prairies rases ensoleillées.',
    isSubterranean: false,
    baseNarrative:
      'Sous-arbrisseau rasant aux fleurs mauves parfumées, capable de prospérer dans une mince pellicule de terre au-dessus de la roche chaude.',
  },
  {
    id: 'bot_digitale_pourpre',
    domain: 'botanique',
    affinity: 'granit',
    secondaryAffinities: ['schiste', 'gres'],
    name: 'Digitale pourpre',
    latinOrMineralName: 'Digitalis purpurea',
    familyLabel: 'Herbier · Flore acidiphile',
    defaultHabitatLabel: 'Clairières & lisières sur arène granitique',
    clueHint: 'Dresse ses clochettes pourpres dans les bois clairs sur socle granitique, schisteux ou gréseux.',
    isSubterranean: false,
    baseNarrative:
      'Fidèle indicatrice des sols siliceux dépourvus de calcaire, elle hisse ses grappes de clochettes tachetées dans les trouées forestières.',
  },
  {
    id: 'bot_doradille_nord',
    domain: 'botanique',
    affinity: 'schiste',
    secondaryAffinities: ['granit', 'volcanique'],
    name: 'Doradille des parois',
    latinOrMineralName: 'Asplenium septentrionale',
    familyLabel: 'Herbier · Fougère rupicole',
    defaultHabitatLabel: 'Fissures schisteuses & escarpements',
    clueHint: 'Se niche dans les anfractuosités des massifs schisteux, cristallins ou escarpés.',
    isSubterranean: false,
    baseNarrative:
      'Petite fougère coriace aux frondes étroites en lanières, enracinée à même les joints obliques des roches métamorphiques et siliceuses.',
  },
  {
    id: 'bot_bruyere_cendree',
    domain: 'botanique',
    affinity: 'gres',
    secondaryAffinities: ['granit'],
    name: 'Bruyère cendrée',
    latinOrMineralName: 'Erica cinerea',
    familyLabel: 'Herbier · Éricacée des sables',
    defaultHabitatLabel: 'Landes siliceuses & chaos de grès',
    clueHint: 'Colonise les sols sableux filtrants, les chaos gréseux et les landes côtières.',
    isSubterranean: false,
    baseNarrative:
      'Ses grelots carmin illuminent les terres pauvres et sableuses issues de l’érosion des bancs de grès et des vieux massifs quartzitiques.',
  },
  {
    id: 'bot_iris_marais',
    domain: 'botanique',
    affinity: 'alluvions',
    secondaryAffinities: ['calcaire', 'gres', 'granit', 'schiste'],
    name: 'Iris jaune des marais',
    latinOrMineralName: 'Iris pseudacorus',
    familyLabel: 'Herbier · Flore rivulaire',
    defaultHabitatLabel: 'Berges limoneuses & noues fluviales',
    clueHint: 'Fleurit au bord des rivières, canaux, étangs et vallées alluviales.',
    isSubterranean: false,
    baseNarrative:
      'Haute silhouette dorée des berges humides : son rhizome filtre l’eau tout en stabilisant les limons et alluvions déposés par les crues.',
  },
  {
    id: 'bot_joubarbe_volcan',
    domain: 'botanique',
    affinity: 'volcanique',
    secondaryAffinities: ['granit', 'schiste'],
    name: 'Joubarbe des rochers',
    latinOrMineralName: 'Sempervivum arachnoideum',
    familyLabel: 'Herbier · Crassulacée montagnarde',
    defaultHabitatLabel: 'Orgues basaltiques & corniches vives',
    clueHint: 'S’accroche aux dalles volcaniques, coulées de lave anciennes et crêtes rocheuses.',
    isSubterranean: false,
    baseNarrative:
      'Rosette succulente tissée de fils argentés, adaptée aux écarts thermiques extrêmes des coulées volcaniques et des corniches d’altitude.',
  },
  {
    id: 'bot_mousse_luminescente',
    domain: 'botanique',
    affinity: 'souterrain',
    name: 'Mousse « Or des cavernes »',
    latinOrMineralName: 'Schistostega pennata',
    familyLabel: 'Herbier · Bryophyte cavernicole',
    defaultHabitatLabel: 'Entrées de grottes & carrières humides (Sous-sol)',
    clueHint: 'Descendez en strate Sous-sol (touche G ou escalier) pour relever ce croquis sous les voûtes.',
    isSubterranean: true,
    baseNarrative:
      'Ses cellules sphériques concentrent le moindre rayon rasant et le renvoient en un reflet vert-émeraude féerique sur la pierre humide.',
  },

  // ==================== 8 ÉCHANTILLONS GÉOLOGIQUES ====================
  {
    id: 'geo_calcaire_fossile',
    domain: 'geologie',
    affinity: 'calcaire',
    name: 'Calcaire blond à fossiles',
    latinOrMineralName: 'Biocalcarénite à cérithes',
    familyLabel: 'Lithothèque · Roche carbonatée',
    defaultHabitatLabel: 'Affleurements & talus calcaires',
    clueHint: 'Affleure dans les bassins sédimentaires calcaires (Bassin parisien, Bourgogne, Causses, Provence…).',
    isSubterranean: false,
    baseNarrative:
      'Formée au fond d’une mer chaude peu profonde, cette pierre de taille conserve en creux l’empreinte spiralée de coquillages vieux de plusieurs dizaines de millions d’années.',
  },
  {
    id: 'geo_rognon_silex',
    domain: 'geologie',
    affinity: 'calcaire',
    secondaryAffinities: ['alluvions', 'gres'],
    name: 'Rognon de silex à cortex',
    latinOrMineralName: 'Calcédoine SiO₂ cryptocristalline',
    familyLabel: 'Lithothèque · Accident siliceux',
    defaultHabitatLabel: 'Coteaux crayeux & terrasses à galets',
    clueHint: 'Se récolte sur les terres crayeuses, calcaires ou dans les cordons de galets.',
    isSubterranean: false,
    baseNarrative:
      'Sous sa croûte crayeuse blanchâtre se cache un cœur vitreux brun-miel à cassure tranchante, matière première des tailleurs préhistoriques et des pierres à briquet.',
  },
  {
    id: 'geo_granite_feldspath',
    domain: 'geologie',
    affinity: 'granit',
    name: 'Granite à quartz & mica noir',
    latinOrMineralName: 'Granite monzonitique à biotite',
    familyLabel: 'Lithothèque · Roche plutonique',
    defaultHabitatLabel: 'Chaos rocheux & talus cristallins',
    clueHint: 'Affleure sur les vieux socles granitiques (Bretagne, Massif central, Vosges, Corse…).',
    isSubterranean: false,
    baseNarrative:
      'Cristallisé lentement à plusieurs kilomètres sous d’anciennes chaînes de montagnes, il assemble grains de quartz gris, feldspath rosé et paillettes brillantes de biotite.',
  },
  {
    id: 'geo_schiste_pyrite',
    domain: 'geologie',
    affinity: 'schiste',
    name: 'Schiste ardoisier à pyrite',
    latinOrMineralName: 'Métapélite & FeS₂ cubique',
    familyLabel: 'Lithothèque · Roche métamorphique',
    defaultHabitatLabel: 'Parois clivées & chemins creux schisteux',
    clueHint: 'Se détache le long des coteaux et vallées taillés dans le schiste ou les micaschistes.',
    isSubterranean: false,
    baseNarrative:
      'Ancienne argile marine comprimée et plissée par l’orogenèse : son feuilletage bleuté enchâsse un petit cristal cubique naturel de pyrite aux reflets d’or.',
  },
  {
    id: 'geo_gres_oblique',
    domain: 'geologie',
    affinity: 'gres',
    name: 'Grès quartzitique rubané',
    latinOrMineralName: 'Arénite siliceuse cimentée',
    familyLabel: 'Lithothèque · Roche détritique',
    defaultHabitatLabel: 'Bancs gréseux & buttes sableuses',
    clueHint: 'Présent sur les plateaux et massifs gréseux (Vosges, Fontainebleau, grès rouges…).',
    isSubterranean: false,
    baseNarrative:
      'Des millions de grains de sable soudés par la silice et teintés d’oxydes de fer y dessinent encore le mouvement figé des courants et des dunes fossiles.',
  },
  {
    id: 'geo_galet_alluvial',
    domain: 'geologie',
    affinity: 'alluvions',
    secondaryAffinities: ['calcaire', 'granit', 'schiste', 'gres'],
    name: 'Galet de quartz fluviatile',
    latinOrMineralName: 'Quartz laiteux poli d’alluvions',
    familyLabel: 'Lithothèque · Dépôt fluviatile',
    defaultHabitatLabel: 'Grèves de rivière & terrasses alluviales',
    clueHint: 'Roulé le long des berges de rivières, fleuves et plaines alluviales.',
    isSubterranean: false,
    baseNarrative:
      'Arraché aux reliefs amont puis arrondi sur des dizaines de lieues par le courant, ce galet laiteux résume à lui seul le voyage géologique du fleuve.',
  },
  {
    id: 'geo_basalte_olivine',
    domain: 'geologie',
    affinity: 'volcanique',
    name: 'Basalte sombre à olivine',
    latinOrMineralName: 'Basalte alcalin à péridot',
    familyLabel: 'Lithothèque · Roche volcanique',
    defaultHabitatLabel: 'Coulées figées & versants volcaniques',
    clueHint: 'Affleure sur les terres volcaniques (Auvergne, Velay, Cantal, îles volcaniques…).',
    isSubterranean: false,
    baseNarrative:
      'Dans sa pâte microlitique noire issue d’une lave fluide scintillent des nodules vert bouteille d’olivine remontés des profondeurs du manteau.',
  },
  {
    id: 'geo_druse_calcite',
    domain: 'geologie',
    affinity: 'souterrain',
    name: 'Druse de calcite & gypse',
    latinOrMineralName: 'CaCO₃ rhomboédrique cavernicole',
    familyLabel: 'Lithothèque · Spéléothème profond',
    defaultHabitatLabel: 'Parois de carrières & grottes (Sous-sol)',
    clueHint: 'Explorez la strate Sous-sol (touche G ou escalier) pour prélever cet échantillon cristallin.',
    isSubterranean: true,
    baseNarrative:
      'Née de la lente percolation des eaux chargées de minéraux à travers la voûte, cette croûte étincelante dresse ses pointes translucides à la lueur de la lanterne.',
  },
];

export function getCatalogItemById(specimenId: string): SpecimenCatalogItem | undefined {
  return SPECIMENS_CATALOG.find((item) => item.id === specimenId);
}

export interface SpawnWorldSpecimensParams {
  grid: Uint8Array;
  dungeonGrid: Uint8Array;
  elevGrid: Float32Array | null;
  elevMin: number;
  elevSpan: number;
  gridSize: number;
  originWx: number;
  originWy: number;
  tileMeters: number;
  cosRef: number;
  pois: PoiItem[];
  subterraneanPois?: PoiItem[];
  terrain: TerrainFeature[];
  bedrock: BedrockInfo | null;
  elevation: ElevationGrid | null | undefined;
}

/**
 * Spawns world-locked, bedrock-authentic botanical tufts and mineral outcrops across the 16-bit sector.
 * Coordinates depend strictly on world tile indices `(wx, wy)` + real geology/topology — never on player position!
 */
export function spawnWorldSpecimens(params: SpawnWorldSpecimensParams): WorldSpecimenNode[] {
  const {
    grid,
    dungeonGrid,
    elevGrid,
    elevMin,
    elevSpan,
    gridSize,
    originWx,
    originWy,
    tileMeters,
    cosRef,
    pois,
    subterraneanPois = [],
    terrain,
    bedrock,
    elevation,
  } = params;

  const primaryAffinity = classifySectorLithology(bedrock, terrain);
  const lithologyLabel = translateLithologyLabelFr(bedrock, primaryAffinity);
  const bedrockPeriod = translateBedrockPeriodFr(bedrock?.period);
  const bedrockAgeMa = bedrock?.ageRangeMa || '';

  const nodes: WorldSpecimenNode[] = [];
  const BLOCK = 30;
  const minBx = Math.floor((originWx + 6) / BLOCK);
  const maxBx = Math.floor((originWx + gridSize - 7) / BLOCK);
  const minBy = Math.floor((originWy + 6) / BLOCK);
  const maxBy = Math.floor((originWy + gridSize - 7) / BLOCK);

  const isNearPoi = (lat: number, lng: number, sub: boolean): boolean => {
    const list = sub ? subterraneanPois : pois;
    for (const p of list) {
      if (haversineMeters(lat, lng, p.lat, p.lng) < 18) return true;
    }
    return false;
  };

  const surfaceCandidatesForAffinity = (
    nearWater: boolean,
    steepSlope: boolean
  ): { flora: SpecimenCatalogItem[]; rocks: SpecimenCatalogItem[] } => {
    if (nearWater) {
      const iris = getCatalogItemById('bot_iris_marais')!;
      const galet = getCatalogItemById('geo_galet_alluvial')!;
      const localFlora = SPECIMENS_CATALOG.filter(
        (s) => !s.isSubterranean && s.domain === 'botanique' && s.affinity === primaryAffinity
      );
      const localRocks = SPECIMENS_CATALOG.filter(
        (s) => !s.isSubterranean && s.domain === 'geologie' && s.affinity === primaryAffinity
      );
      return {
        flora: [iris, ...localFlora],
        rocks: [galet, ...localRocks],
      };
    }

    const flora = SPECIMENS_CATALOG.filter(
      (s) =>
        !s.isSubterranean &&
        s.domain === 'botanique' &&
        (s.affinity === primaryAffinity ||
          (steepSlope && (s.id === 'bot_doradille_nord' || s.id === 'bot_joubarbe_volcan')) ||
          s.secondaryAffinities?.includes(primaryAffinity))
    );
    const rocks = SPECIMENS_CATALOG.filter(
      (s) =>
        !s.isSubterranean &&
        s.domain === 'geologie' &&
        (s.affinity === primaryAffinity || s.secondaryAffinities?.includes(primaryAffinity))
    );
    return {
      flora: flora.length > 0 ? flora : [SPECIMENS_CATALOG[0]],
      rocks: rocks.length > 0 ? rocks : [SPECIMENS_CATALOG[8]],
    };
  };

  const hasWaterAdjacent = (gx: number, gy: number): boolean => {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = gx + dx;
        const ny = gy + dy;
        if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;
        if (grid[ny * gridSize + nx] === T_WATER) return true;
      }
    }
    return false;
  };

  for (let by = minBy; by <= maxBy; by++) {
    for (let bx = minBx; bx <= maxBx; bx++) {
      const blockHash = specHash(bx, by);
      // Keep natural, uncrowded spacing (~55% of macro-blocks host a field specimen)
      if (blockHash % 9 < 4) continue;

      const startWx = Math.max(originWx + 6, bx * BLOCK + 2);
      const endWx = Math.min(originWx + gridSize - 7, (bx + 1) * BLOCK - 3);
      const startWy = Math.max(originWy + 6, by * BLOCK + 2);
      const endWy = Math.min(originWy + gridSize - 7, (by + 1) * BLOCK - 3);

      // 1. Surface botanical tuft or rock outcrop
      let bestSurf: {
        wx: number;
        wy: number;
        h: number;
        score: number;
        nearWater: boolean;
        steep: boolean;
        preferRock: boolean;
      } | null = null;

      for (let wy = startWy; wy <= endWy; wy += 3) {
        const gy = wy - originWy;
        for (let wx = startWx; wx <= endWx; wx += 3) {
          const gx = wx - originWx;
          const t = grid[gy * gridSize + gx];
          if (
            t !== T_MEADOW &&
            t !== T_PARK &&
            t !== T_FOREST &&
            t !== T_FARMLAND &&
            t !== T_PATH &&
            t !== T_STEPS &&
            t !== T_CEMETERY &&
            t !== T_SAND &&
            t !== T_SCRUB &&
            t !== T_WETLAND &&
            t !== T_SCREE
          ) {
            continue;
          }
          const h = specHash(wx, wy);
          const nearWater = t === T_WETLAND || hasWaterAdjacent(gx, gy);
          const localElev = elevGrid ? elevGrid[gy * gridSize + gx] : 0;
          const steep =
            t === T_SCREE ||
            (elevGrid !== null && elevSpan >= 14 && localElev >= elevMin + elevSpan * 0.6);
          const preferRock =
            t === T_SCREE || t === T_PATH || t === T_STEPS || steep || (h & 3) === 0;
          const score =
            (nearWater ? 26 : 0) +
            (steep ? 22 : 0) +
            (t === T_SCRUB || t === T_WETLAND || t === T_SCREE ? 22 : 0) +
            (t === T_PARK || t === T_FOREST ? 18 : 12) +
            (h % 19);

          if (!bestSurf || score > bestSurf.score) {
            bestSurf = { wx, wy, h, score, nearWater, steep, preferRock };
          }
        }
      }

      if (bestSurf) {
        const lat = -((bestSurf.wy + 0.5) * tileMeters) / 110540;
        const lng = ((bestSurf.wx + 0.5) * tileMeters) / (111320 * cosRef);
        if (!isNearPoi(lat, lng, false)) {
          const { flora, rocks } = surfaceCandidatesForAffinity(
            bestSurf.nearWater,
            bestSurf.steep
          );
          const wantGeo = bestSurf.preferRock || (blockHash & 1) === 1;
          const pool = wantGeo ? rocks : flora;
          const item = pool[bestSurf.h % pool.length];
          const alt = sampleElevationMeters(elevation, lat, lng);
          const description = `${item.baseNarrative} Relevé sur ${lithologyLabel.toLowerCase()} (${bedrockPeriod}${
            bedrockAgeMa ? `, ${bedrockAgeMa}` : ''
          }).`;

          nodes.push({
            nodeId: `spec_surf_${bestSurf.wx}_${bestSurf.wy}`,
            specimenId: item.id,
            domain: item.domain,
            affinity: primaryAffinity,
            name: item.name,
            latinOrMineralName: item.latinOrMineralName,
            familyLabel: item.familyLabel,
            habitatLabel: item.defaultHabitatLabel,
            lithologyLabel,
            bedrockPeriod,
            bedrockAgeMa,
            lat,
            lng,
            altitudeMeters: alt !== null ? Math.round(alt) : null,
            isSubterranean: false,
            seed: bestSurf.h,
            description,
          });
        }
      }

      // 2. Subterranean cavernicole moss or mineral druse (in accessible galleries/caverns/faults)
      if (blockHash % 2 === 0) {
        let bestSub: { wx: number; wy: number; h: number; dt: number } | null = null;
        for (let wy = startWy; wy <= endWy; wy += 3) {
          const gy = wy - originWy;
          for (let wx = startWx; wx <= endWx; wx += 3) {
            const gx = wx - originWx;
            const dt = dungeonGrid[gy * gridSize + gx];
            if (
              dt !== D_NATURAL_CAVERN &&
              dt !== D_QUARRY_HALL &&
              dt !== D_SUB_WATER &&
              dt !== D_CRYPT &&
              dt !== D_GALLERY &&
              dt !== D_CULVERT &&
              dt !== D_AQUEDUCT &&
              dt !== D_FAULT_VEIN
            ) {
              continue;
            }
            const h = specHash(wx + 41, wy - 23);
            if (!bestSub || dt > bestSub.dt || (dt === bestSub.dt && h > bestSub.h)) {
              bestSub = { wx, wy, h, dt };
            }
          }
        }

        if (bestSub) {
          const lat = -((bestSub.wy + 0.5) * tileMeters) / 110540;
          const lng = ((bestSub.wx + 0.5) * tileMeters) / (111320 * cosRef);
          if (!isNearPoi(lat, lng, true)) {
            const subItems = SPECIMENS_CATALOG.filter((s) => s.isSubterranean);
            const item = subItems[bestSub.h % subItems.length];
            const alt = sampleElevationMeters(elevation, lat, lng);
            const description = `${item.baseNarrative} Cristallisé dans la masse de ${lithologyLabel.toLowerCase()} (${bedrockPeriod}).`;
            nodes.push({
              nodeId: `spec_sub_${bestSub.wx}_${bestSub.wy}`,
              specimenId: item.id,
              domain: item.domain,
              affinity: 'souterrain',
              name: item.name,
              latinOrMineralName: item.latinOrMineralName,
              familyLabel: item.familyLabel,
              habitatLabel: item.defaultHabitatLabel,
              lithologyLabel,
              bedrockPeriod,
              bedrockAgeMa,
              lat,
              lng,
              altitudeMeters: alt !== null ? Math.round(alt) : null,
              isSubterranean: true,
              seed: bestSub.h,
              description,
            });
          }
        }
      }
    }
  }

  return nodes;
}

// ============================================================================
// CRISP 16-BIT PIXEL ART RENDERER FOR HERBARIUM FLORA & GEOLOGICAL SPECIMENS
// ============================================================================

export function drawSpecimenSprite16Bit(
  ctx: CanvasRenderingContext2D,
  opts: {
    cx: number;
    cy: number;
    scale: number;
    specimenId: string;
    animTick?: number;
    isHarvestedOnMap?: boolean;
    isHovered?: boolean;
  }
): void {
  const {
    cx,
    cy,
    scale,
    specimenId,
    animTick = 0,
    isHarvestedOnMap = false,
    isHovered = false,
  } = opts;

  const px = (dx: number, dy: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(
      Math.round((cx + dx) * scale),
      Math.round((cy + dy) * scale),
      Math.max(1, Math.round(w * scale)),
      Math.max(1, Math.round(h * scale))
    );
  };

  const out = '#140b05';
  const sway = Math.floor(animTick / 6) % 2 === 0 ? 0 : 1;
  const glint = Math.floor(animTick / 4) % 4 === 0;

  if (isHovered && !isHarvestedOnMap) {
    px(-7, -1, 14, 3, '#fde047');
  } else {
    px(-5, 0, 10, 2, 'rgba(20, 11, 5, 0.34)');
  }

  if (isHarvestedOnMap) {
    // Neat little sketched brass marker + trimmed basal leaves/pebbles after collection
    px(-4, -3, 8, 3, out);
    px(-3, -2, 6, 2, '#a8a29e');
    px(-1, -6, 2, 4, '#d97706');
    px(-2, -7, 4, 2, '#fef08a');
    return;
  }

  switch (specimenId) {
    case 'bot_ophrys_abeille': {
      // Stem + basal leaves + bee-mimic pink/velvet orchid flower
      px(-4, -3, 8, 3, '#15803d');
      px(-1, -11, 2, 9, out);
      px(0, -10, 1, 8, '#22c55e');
      px(-4 + sway, -13, 9, 6, out);
      px(-3 + sway, -12, 3, 2, '#f472b6');
      px(1 + sway, -12, 3, 2, '#f472b6');
      px(-1 + sway, -14, 3, 2, '#fbcfe8');
      px(-1 + sway, -10, 3, 3, '#78350f');
      px(0 + sway, -9, 1, 1, '#fde047');
      break;
    }
    case 'bot_thym_serpolet': {
      // Cushion of tiny aromatic leaves + purple-lilac flower clusters
      px(-6, -5, 12, 5, out);
      px(-5, -4, 10, 3, '#15803d');
      px(-4, -5, 8, 2, '#22c55e');
      px(-4, -7 + sway, 3, 2, '#c084fc');
      px(0, -8, 3, 2, '#e879f9');
      px(3, -6 + sway, 2, 2, '#d8b4fe');
      break;
    }
    case 'bot_digitale_pourpre': {
      // Tall foxglove spire with magenta-purple spotted bells
      px(-4, -3, 8, 3, '#166534');
      px(-1, -15, 3, 13, out);
      px(0, -14, 1, 11, '#22c55e');
      px(-4 + sway, -14, 4, 3, '#be185d');
      px(1 + sway, -12, 4, 3, '#db2777');
      px(-4 + sway, -9, 4, 3, '#be185d');
      px(-2 + sway, -13, 1, 1, '#fce7f3');
      px(3 + sway, -11, 1, 1, '#fce7f3');
      break;
    }
    case 'bot_doradille_nord': {
      // Forked rock-fern fronds rising from dark schist crevice
      px(-5, -3, 10, 3, '#475569');
      px(-5, -9, 10, 7, out);
      px(-4, -8 + sway, 2, 5, '#4ade80');
      px(-1, -11, 2, 8, '#22c55e');
      px(2, -9 + sway, 2, 6, '#86efac');
      px(-2, -12, 2, 2, '#bef264');
      break;
    }
    case 'bot_bruyere_cendree': {
      // Sandstone heather shrub with crimson-violet bells
      px(-6, -7, 12, 7, out);
      px(-5, -5, 10, 4, '#14532d');
      px(-4, -9 + sway, 3, 4, '#9333ea');
      px(-1, -10, 3, 5, '#a855f7');
      px(2, -8 + sway, 3, 4, '#c084fc');
      px(0, -9, 1, 2, '#f5d0fe');
      break;
    }
    case 'bot_iris_marais': {
      // Sword-like reed leaves + bright golden wetland iris petals
      px(-5, -10, 10, 10, out);
      px(-4, -8, 2, 7, '#15803d');
      px(2, -8, 2, 7, '#16a34a');
      px(-1, -11, 2, 9, '#22c55e');
      px(-4 + sway, -13, 8, 4, out);
      px(-3 + sway, -12, 6, 3, '#facc15');
      px(-1 + sway, -14, 2, 3, '#fef08a');
      px(-1 + sway, -11, 2, 1, '#ca8a04');
      break;
    }
    case 'bot_joubarbe_volcan': {
      // Succulents rosette with cobweb silver tips on dark basalt
      px(-6, -4, 12, 4, '#27272a');
      px(-5, -8, 10, 6, out);
      px(-4, -7, 8, 4, '#4d7c0f');
      px(-3, -6, 6, 3, '#84cc16');
      px(-4, -7, 2, 1, '#fecdd3');
      px(2, -7, 2, 1, '#fecdd3');
      px(-1, -6, 2, 2, '#f8fafc');
      break;
    }
    case 'bot_mousse_luminescente': {
      // Glowing goblin-gold cave moss on dark cavern stone
      px(-6, -5, 12, 5, out);
      px(-5, -4, 10, 3, '#292524');
      px(-4, -7, 8, 4, '#065f46');
      px(-3, -6, 6, 3, glint ? '#bef264' : '#4ade80');
      px(-2, -6, 2, 1, '#ffffff');
      px(1, -5, 2, 1, '#fef08a');
      break;
    }
    case 'geo_calcaire_fossile': {
      // Warm Lutetian limestone block with carved spiral fossil shell
      px(-6, -9, 12, 9, out);
      px(-5, -8, 10, 7, '#e7d8be');
      px(-5, -8, 6, 3, '#fef3c7');
      px(-5, -3, 10, 2, '#c6b08d');
      // Fossil spiral
      px(-2, -7, 5, 4, '#92400e');
      px(-1, -6, 3, 2, '#fde68a');
      px(0, -6, 1, 1, '#78350f');
      break;
    }
    case 'geo_rognon_silex': {
      // Chalk-ringed dark honey flint nodule
      px(-6, -8, 12, 8, out);
      px(-5, -7, 10, 6, '#f5f5f4');
      px(-3, -6, 7, 4, '#451a03');
      px(-2, -5, 4, 2, '#b45309');
      if (glint) px(-1, -5, 2, 1, '#fef3c7');
      break;
    }
    case 'geo_granite_feldspath': {
      // Speckled pink-rose feldspar, white quartz & black biotite granite
      px(-6, -9, 12, 9, out);
      px(-5, -8, 10, 7, '#f4af9d');
      px(-4, -7, 3, 2, '#f8fafc');
      px(1, -6, 3, 2, '#e2e8f0');
      px(-3, -4, 2, 2, '#1e293b');
      px(2, -4, 2, 2, '#1e293b');
      px(-1, -8, 2, 2, '#fda4af');
      if (glint) px(-3, -7, 1, 1, '#ffffff');
      break;
    }
    case 'geo_schiste_pyrite': {
      // Layered slate slab + gleaming golden cube of pyrite
      px(-7, -8, 14, 8, out);
      px(-6, -7, 12, 2, '#64748b');
      px(-5, -5, 11, 2, '#475569');
      px(-6, -3, 12, 2, '#334155');
      // Golden pyrite cube
      px(-1, -9, 5, 5, out);
      px(0, -8, 3, 3, '#eab308');
      px(0, -8, 2, 1, glint ? '#ffffff' : '#fef08a');
      break;
    }
    case 'geo_gres_oblique': {
      // Cross-bedded warm ochre/terracotta sandstone block
      px(-6, -9, 12, 9, out);
      px(-5, -8, 10, 7, '#d97706');
      px(-5, -7, 10, 2, '#fdba74');
      px(-4, -5, 9, 1, '#9a3412');
      px(-5, -4, 8, 2, '#f59e0b');
      px(-3, -2, 8, 1, '#7c2d12');
      break;
    }
    case 'geo_galet_alluvial': {
      // Smooth rounded river quartz pebbles
      px(-6, -7, 12, 7, out);
      px(-5, -6, 7, 5, '#cbd5e1');
      px(-4, -6, 4, 2, '#ffffff');
      px(1, -5, 4, 4, '#d97706');
      px(2, -5, 2, 2, '#fde68a');
      break;
    }
    case 'geo_basalte_olivine': {
      // Hexagonal dark basalt prism + bright peridot-green olivine enclave
      px(-5, -11, 10, 11, out);
      px(-4, -10, 8, 9, '#27272a');
      px(-4, -10, 3, 8, '#3f3f46');
      px(-1, -7, 4, 3, '#65a30d');
      px(0, -6, 2, 2, glint ? '#ecfccb' : '#a3e635');
      break;
    }
    case 'geo_druse_calcite':
    default: {
      // Subterranean crystal cluster
      px(-6, -4, 12, 4, out);
      px(-5, -3, 10, 2, '#44403c');
      px(-4, -9, 3, 6, out);
      px(-1, -12, 4, 9, out);
      px(2, -8, 3, 5, out);
      px(-3, -8, 2, 5, '#67e8f9');
      px(0, -11, 2, 8, '#a5f3fc');
      px(3, -7, 2, 4, '#22d3ee');
      if (glint) {
        px(0, -11, 1, 3, '#ffffff');
      }
      break;
    }
  }

  // Subtle floating sparkle on unharvested mineral crystals
  if (!isHarvestedOnMap && specimenId.startsWith('geo_') && glint) {
    px(4, -11, 1, 3, '#fef08a');
    px(3, -10, 3, 1, '#ffffff');
  }
}

export const SpecimenPlateCanvas: React.FC<{
  specimenId: string;
  affinity: LithologyAffinity;
  isSubterranean?: boolean;
  silhouette?: boolean;
  animTick?: number;
  className?: string;
}> = ({
  specimenId,
  affinity,
  isSubterranean = false,
  silhouette = false,
  animTick = 0,
  className = 'w-14 h-14',
}) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (silhouette) {
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      const tctx = tmp.getContext('2d');
      if (tctx) {
        tctx.imageSmoothingEnabled = false;
        drawSpecimenSprite16Bit(tctx, {
          cx: 12,
          cy: 19,
          scale: 3,
          specimenId,
          animTick: 0,
        });
        tctx.globalCompositeOperation = 'source-in';
        tctx.fillStyle = '#3b2414';
        tctx.fillRect(0, 0, tmp.width, tmp.height);
      }
      ctx.fillStyle = '#e5d3b3';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#cfb78f';
      ctx.fillRect(0, canvas.height - 16, canvas.width, 16);
      ctx.globalAlpha = 0.72;
      ctx.drawImage(tmp, 0, 0);
      ctx.globalAlpha = 1;
      return;
    }

    const meta = LITHOLOGY_AFFINITY_META[affinity] || LITHOLOGY_AFFINITY_META.calcaire;
    ctx.fillStyle = isSubterranean
      ? '#1c1917'
      : specimenId.startsWith('bot_')
      ? '#ecfccb'
      : '#fef3c7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Real lithology ground band at bottom of plate!
    ctx.fillStyle = meta.rockColor;
    ctx.fillRect(0, canvas.height - 18, canvas.width, 18);
    ctx.fillStyle = '#2b1d12';
    ctx.fillRect(0, canvas.height - 18, canvas.width, 2);

    drawSpecimenSprite16Bit(ctx, {
      cx: 12,
      cy: 19,
      scale: 3,
      specimenId,
      animTick,
    });
  }, [specimenId, affinity, isSubterranean, silhouette, animTick]);

  return React.createElement('canvas', {
    ref,
    width: 72,
    height: 72,
    className: `pixelated border-2 border-[#2b1d12] shrink-0 ${className}`,
  });
};
