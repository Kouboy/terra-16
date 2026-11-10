export type ExplorationCategory =
  | 'histoire'
  | 'geographie'
  | 'legende'
  | 'etrange'
  | 'ecosysteme';

export type HistoricalStratum =
  | 'temps_profond'
  | 'prehistoire'
  | 'antiquite'
  | 'moyen_age'
  | 'moderne'
  | 'contemporain'
  | 'vivant_folklore';

export type ActiveTab = 'carte' | 'carnet' | 'missions' | 'branches' | 'profil';

export type CarnetViewMode =
  | 'liste'
  | 'collections'
  | 'secrets'
  | 'bestiaire'
  | 'herbier'
  | 'tresors'
  | 'frise'
  | 'constellation'
  | 'besace';

export interface NpcEncounterRecord {
  id: string;
  kind: string;
  isHuman: boolean;
  isSubterranean: boolean;
  name: string;
  roleLabel: string;
  habitatLabel: string;
  regionLabel: string;
  regionsVisited: string[];
  lat: number;
  lng: number;
  seed: number;
  dialogues: string[];
  sightingsCount: number;
  firstMetIso: string;
  lastMetIso: string;
}

export interface RumorLead {
  id: string;
  targetType: 'poi' | 'portal';
  targetId: string;
  title: string;
  rumorText: string;
  giverId: string;
  giverName: string;
  giverRole: string;
  regionLabel: string;
  lat: number;
  lng: number;
  isSubterranean: boolean;
  category?: ExplorationCategory;
  verified: boolean;
  createdAtIso: string;
  verifiedAtIso?: string;
}

export type ZoomLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'storm';

export interface WeatherInfo {
  condition: WeatherCondition;
  tempC: number;
  windKmh: number;
  isDay: boolean;
  labelFr: string;
}

export type TimeOfDayMode = 'auto' | 'dawn' | 'day' | 'dusk' | 'night';

export type EffectiveTimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

export function resolveEffectiveTimeOfDay(
  timeMode: TimeOfDayMode,
  weather?: WeatherInfo | null
): EffectiveTimeOfDay {
  if (timeMode && timeMode !== 'auto') return timeMode;
  const h = new Date().getHours();
  if (weather && !weather.isDay && h >= 7 && h <= 18) return 'night';
  if (h >= 6 && h < 9) return 'dawn';
  if (h >= 9 && h < 18) return 'day';
  if (h >= 18 && h < 21) return 'dusk';
  return 'night';
}

export type SpecimenDomain = 'botanique' | 'geologie';

export type LithologyAffinity =
  | 'calcaire'
  | 'granit'
  | 'schiste'
  | 'gres'
  | 'alluvions'
  | 'volcanique'
  | 'souterrain';

export interface CollectedSpecimen {
  specimenId: string;
  domain: SpecimenDomain;
  affinity: LithologyAffinity;
  name: string;
  latinOrMineralName: string;
  familyLabel: string;
  lithologyLabel: string;
  bedrockPeriod: string;
  bedrockAgeMa: string;
  regionLabel: string;
  habitatLabel: string;
  lat: number;
  lng: number;
  altitudeMeters: number | null;
  isSubterranean: boolean;
  harvestCount: number;
  firstCollectedIso: string;
  lastCollectedIso: string;
  description: string;
}

export type PostcardSubject =
  | { kind: 'poi'; entry: UnlockedEntry }
  | { kind: 'encounter'; encounter: NpcEncounterRecord }
  | { kind: 'specimen'; specimen: CollectedSpecimen };

export type SurfaceType = 'stone' | 'grass' | 'wood' | 'gravel';

export type ExplorerAvatarPreset =
  | 'cartographe'
  | 'eclaireur'
  | 'archiviste'
  | 'forgeron'
  | 'oracle'
  | 'botaniste';

export type ExplorerSkinTone = 'clair' | 'hale' | 'ambre' | 'ebene' | 'porcelaine';

export type ExplorerHeadgearId =
  | 'tricorne_fauve'
  | 'beret_chroniqueur'
  | 'casque_mineur'
  | 'capuche_sylvestre'
  | 'couronne_menhir'
  | 'lunettes_astro'
  | 'monocle_erudit'
  | 'tricorne_reliquaire'
  | 'couronne_saisons'
  | 'couronne_chroniqueur'
  | 'bandeau_guilde_unie'
  | 'casque_chantier_brgm'
  | 'foulard_sept_lieues'
  | 'chapeau_longues_routes'
  | 'couronne_grand_arpenteur';

export type ExplorerOutfitId =
  | 'arpenteur'
  | 'chroniqueur'
  | 'geomancien'
  | 'sylvestre'
  | 'ombres'
  | 'barde'
  | 'almanach_solaire'
  | 'chasseur_reliques'
  | 'conteuse_legende'
  | 'tenue_friches_urbex'
  | 'manteau_quatre_saisons'
  | 'tabard_maitres_marcheurs';

export type ExplorerToolId =
  | 'lanterne_laiton'
  | 'boussole_astrale'
  | 'marteau_geologue'
  | 'plume_enluminee'
  | 'fiole_spectrale'
  | 'loupe_sceau_or'
  | 'clef_coffres_anciens'
  | 'sablier_ephemeride'
  | 'plume_trois_actes'
  | 'sonde_piezo_laiton'
  | 'moulinet_hydro'
  | 'baton_chemins_creux'
  | 'boussole_alizes'
  | 'lanterne_brumes_marais';

export type ExplorerPackId =
  | 'besace_cuir'
  | 'rouleau_cartes'
  | 'hotte_cristaux'
  | 'ailerons_automate'
  | 'coffret_piste'
  | 'grimoire_almanach'
  | 'astrolabe_dorsal'
  | 'besace_pelerin_lunes'
  | 'sacoche_astronavigatrice';

export type ExplorerFamiliarId =
  | 'aucun'
  | 'chouette_erudite'
  | 'goupil_saisons'
  | 'scarabee_boussole'
  | 'salamandre_cristal'
  | 'corbeau_cartographe'
  | 'feu_follet_astral'
  | 'hermine_royale'
  | 'cerf_brumes'
  | 'loutre_riviere'
  | 'lerot_dore';

export type ExplorerGender = 'feminin' | 'masculin' | 'neutre';

export interface ExplorerAppearance {
  gender: ExplorerGender;
  avatarPreset: ExplorerAvatarPreset;
  skinTone: ExplorerSkinTone;
  headgearId: ExplorerHeadgearId;
  outfitId: ExplorerOutfitId;
  toolId: ExplorerToolId;
  packId: ExplorerPackId;
  familiarId?: ExplorerFamiliarId;
}

export type CairnTag =
  | 'architecture'
  | 'acces'
  | 'point_de_vue'
  | 'conseil_heure'
  | 'secret';

export interface ExplorerCairn {
  id: string;
  authorId: string;
  authorCallsign: string;
  authorGender?: ExplorerGender;
  authorAvatarPreset?: ExplorerAvatarPreset;
  authorSkinTone?: ExplorerSkinTone;
  authorHeadgearId?: ExplorerHeadgearId;
  authorOutfitId?: ExplorerOutfitId;
  poiId: string;
  poiName: string;
  tag: CairnTag;
  message: string;
  createdAtIso: string;
}

export const CAIRN_TAG_META: Record<CairnTag, { label: string; badgeClass: string }> = {
  architecture: {
    label: 'Détail architectural',
    badgeClass: 'bg-amber-200 text-amber-950 border-amber-800',
  },
  acces: {
    label: 'Chemin & accès',
    badgeClass: 'bg-emerald-200 text-emerald-950 border-emerald-800',
  },
  point_de_vue: {
    label: 'Point de vue',
    badgeClass: 'bg-sky-200 text-sky-950 border-sky-800',
  },
  conseil_heure: {
    label: 'Lumière & heure idéale',
    badgeClass: 'bg-purple-200 text-purple-950 border-purple-800',
  },
  secret: {
    label: 'Indice discret',
    badgeClass: 'bg-rose-200 text-rose-950 border-rose-800',
  },
};

export type ArchivistChestArchetype =
  | 'sommet_colline'
  | 'confluence_eaux'
  | 'cul_de_sac_forestier'
  | 'clairiere_sylvestre'
  | 'bouche_souterraine';

export interface OpenedArchivistChestRecord {
  chestId: string;
  archetype: ArchivistChestArchetype;
  title: string;
  placeNote: string;
  relicId: string;
  relicName: string;
  category: ExplorationCategory;
  regionLabel: string;
  lat: number;
  lng: number;
  altitudeMeters: number | null;
  isSubterranean: boolean;
  xpAwarded: number;
  openedAtIso: string;
}

export type GeocachePlacementMode = 'gps_live' | 'unlocked_poi';
export type GeocacheGiftKind = 'relic' | 'specimen';
export type GeocacheGiftDomain = 'relique' | 'botanique' | 'geologie';

export interface ExplorerGeocacheRecord {
  id: string;
  authorId: string;
  authorCallsign: string;
  authorGender?: ExplorerGender;
  authorAvatarPreset?: ExplorerAvatarPreset;
  authorSkinTone?: ExplorerSkinTone;
  authorHeadgearId?: ExplorerHeadgearId;
  authorOutfitId?: ExplorerOutfitId;
  sectorKey: string;
  placementMode: GeocachePlacementMode;
  anchorPoiId?: string;
  lat: number;
  lng: number;
  isSubterranean: boolean;
  regionLabel: string;
  title: string;
  riddleHint: string;
  giftKind: GeocacheGiftKind;
  giftId: string;
  giftName: string;
  giftDomain: GeocacheGiftDomain;
  createdAtIso: string;
}

export interface GeocacheLogRecord {
  id: string;
  cacheId: string;
  finderId: string;
  finderCallsign: string;
  finderGender?: ExplorerGender;
  finderAvatarPreset?: ExplorerAvatarPreset;
  finderSkinTone?: ExplorerSkinTone;
  finderHeadgearId?: ExplorerHeadgearId;
  finderOutfitId?: ExplorerOutfitId;
  note: string;
  foundAtIso: string;
}

export interface ZoomMeta {
  level: ZoomLevel;
  scaleTag: string;
  label: string;
  metersPerPx: number;
}

export const ZOOM_LEVELS: ZoomLevel[] = [1, 2, 3, 4, 5, 6];

export const ZOOM_META: Record<ZoomLevel, ZoomMeta> = {
  1: { level: 1, scaleTag: '0.5x', label: 'Contrée', metersPerPx: 4.6 },
  2: { level: 2, scaleTag: '0.8x', label: 'Vallée', metersPerPx: 2.9 },
  3: { level: 3, scaleTag: '1.3x', label: 'Bourg', metersPerPx: 1.8 },
  4: { level: 4, scaleTag: '2x', label: 'Quartier', metersPerPx: 1.12 },
  5: { level: 5, scaleTag: '3x', label: 'Ruelle', metersPerPx: 0.7 },
  6: { level: 6, scaleTag: '4.5x', label: 'Détail', metersPerPx: 0.45 },
};

/**
 * Scales simulated walk step distances proportionally to the active zoom's meters-per-pixel,
 * keeping on-screen stride velocity natural across regional (0.5x) and street-detail (4.5x) zooms.
 */
export function getZoomWalkStepMeters(zoomLevel: ZoomLevel): {
  manualStepMeters: number;
  tickStepMeters: number;
  snapMeters: number;
} {
  const ratio = ZOOM_META[zoomLevel].metersPerPx / ZOOM_META[4].metersPerPx;
  const manualStepMeters = Math.max(8, Math.round(24 * ratio));
  const tickStepMeters = Math.max(9, Math.round(25 * ratio));
  const snapMeters = Math.max(7, Math.round(18 * ratio));
  return { manualStepMeters, tickStepMeters, snapMeters };
}

export type OfficialStateLabel =
  | 'monument_historique'
  | 'maison_illustres'
  | 'jardin_remarquable'
  | 'musee_de_france'
  | 'datatourisme';

export const OFFICIAL_STATE_LABEL_META: Record<
  OfficialStateLabel,
  { shortBadge: string; fullTitle: string; badgeClass: string }
> = {
  monument_historique: {
    shortBadge: 'Monument Historique',
    fullTitle: 'Ministère de la Culture · Immeuble protégé (Base Mérimée)',
    badgeClass: 'bg-[#7f1d1d] text-[#fef3c7] border-[#fbbf24]',
  },
  maison_illustres: {
    shortBadge: 'Maison des Illustres',
    fullTitle: 'Ministère de la Culture · Label Maisons des Illustres',
    badgeClass: 'bg-[#312e81] text-[#fef08a] border-[#c084fc]',
  },
  jardin_remarquable: {
    shortBadge: 'Jardin Remarquable',
    fullTitle: 'Ministère de la Culture · Label Jardin Remarquable',
    badgeClass: 'bg-[#064e3b] text-[#d1fae5] border-[#34d399]',
  },
  musee_de_france: {
    shortBadge: 'Musée de France',
    fullTitle: 'Ministère de la Culture · Appellation Musée de France (Muséofile)',
    badgeClass: 'bg-[#1e3a8a] text-[#e0f2fe] border-[#38bdf8]',
  },
  datatourisme: {
    shortBadge: 'Patrimoine & Tourisme',
    fullTitle: 'Référentiel national ouvert DATAtourisme · Offices de Tourisme',
    badgeClass: 'bg-[#78350f] text-[#fef3c7] border-[#f59e0b]',
  },
};

export function inferOfficialStateLabel(
  source?: string | null,
  subType?: string | null,
  explicit?: OfficialStateLabel
): OfficialStateLabel | null {
  if (explicit) return explicit;
  const hay = `${source || ''} ${subType || ''}`.toLowerCase();
  if (hay.includes('maison des illustres') || hay.includes('maisons des illustres')) {
    return 'maison_illustres';
  }
  if (hay.includes('jardin remarquable') || hay.includes('jardins remarquables')) {
    return 'jardin_remarquable';
  }
  if (hay.includes('muséofile') || hay.includes('museofile') || hay.includes('musée de france')) {
    return 'musee_de_france';
  }
  if (
    hay.includes('mérimée') ||
    hay.includes('merimee') ||
    hay.includes('monument historique') ||
    hay.includes('classé mh') ||
    hay.includes('inscrit mh')
  ) {
    return 'monument_historique';
  }
  if (hay.includes('datatourisme')) {
    return 'datatourisme';
  }
  return null;
}

export type PoiSignificanceTier = 'remarquable' | 'notable' | 'technique';

export function classifyPoiSignificanceTier(poi?: Partial<PoiItem> | null): PoiSignificanceTier {
  if (!poi) return 'notable';
  const nameL = (typeof poi.name === 'string' ? poi.name : '').toLowerCase();
  const subL = (typeof poi.subType === 'string' ? poi.subType : '').toLowerCase();
  const srcL = (typeof poi.source === 'string' ? poi.source : '').toLowerCase();

  if (poi.officialLabel || inferOfficialStateLabel(srcL, subL)) {
    return 'remarquable';
  }

  // Primary landmarks (châteaux, églises, menhirs, abbayes, cascades, grottes, arbres remarquables)
  if (
    subL.includes('château') ||
    subL.includes('abbaye') ||
    subL.includes('église') ||
    subL.includes('cathédrale') ||
    subL.includes('menhir') ||
    subL.includes('dolmen') ||
    subL.includes('arbre remarquable') ||
    subL.includes('cascade') ||
    subL.includes('grotte') ||
    subL.includes('ruine') ||
    subL.includes('oppidum') ||
    nameL.includes('menhir') ||
    nameL.includes('dolmen') ||
    nameL.includes('château')
  ) {
    return 'remarquable';
  }

  // Purely technical or dense geological/engineering sensors
  if (
    srcL.includes('bss') ||
    srcL.includes('piézom') ||
    srcL.includes('forage') ||
    srcL.includes('hub-eau') ||
    srcL.includes('hydrométrie') ||
    srcL.includes('station hydrométrique') ||
    srcL.includes('cartofriches') ||
    subL.includes('forage') ||
    subL.includes('piézomètre') ||
    subL.includes('débitmètre')
  ) {
    return 'technique';
  }

  return 'notable';
}

export interface PoiItem {
  id: string;
  name: string;
  mysteryTitle: string;
  category: ExplorationCategory;
  subType: string;
  stratum: HistoricalStratum;
  eraLabel: string;
  source: string;
  lat: number;
  lng: number;
  summary: string;
  nearWaterway: boolean;
  waterwayName: string;
  safetyNotice: string;
  externalUrl: string;
  xpReward: number;
  unlockRadiusMeters: number;
  relatedPoiIds: string[];
  relatedPoiTitles: string[];
  isSubterranean?: boolean;
  officialLabel?: OfficialStateLabel;
  officialRef?: string;
  epistemicStatus?: EpistemicStatus;
}

export type EpistemicStatus = 'fait_documente' | 'reconstitution_hypothese' | 'legende_folklore';

export interface EpistemicStatusMeta {
  key: EpistemicStatus;
  badgeLabel: string;
  badgeClass: string;
  iconSymbol: string;
  shortDefinition: string;
  tooltipDesc: string;
}

export const EPISTEMIC_STATUS_META: Record<EpistemicStatus, EpistemicStatusMeta> = {
  fait_documente: {
    key: 'fait_documente',
    badgeLabel: 'Fait documenté',
    badgeClass: 'bg-[#ecfdf5] text-emerald-950 border-emerald-700',
    iconSymbol: '✓',
    shortDefinition: 'Archives & inventaires officiels',
    tooltipDesc: 'Relevé attesté dans les archives ministérielles (Mérimée, BSS, INPN) ou géodésiques IGN.',
  },
  reconstitution_hypothese: {
    key: 'reconstitution_hypothese',
    badgeLabel: 'Hypothèse / Reconstitution',
    badgeClass: 'bg-[#fffbeb] text-amber-950 border-amber-700',
    iconSymbol: '~',
    shortDefinition: 'Tracé déduit ou estimation',
    tooltipDesc: 'Déduction cartographique, archéologique ou toponymique plausible non attestée in situ.',
  },
  legende_folklore: {
    key: 'legende_folklore',
    badgeLabel: 'Légende & Récit oral',
    badgeClass: 'bg-[#faf5ff] text-purple-950 border-purple-700',
    iconSymbol: '✦',
    shortDefinition: 'Tradition populaire & mémoire',
    tooltipDesc: 'Récits transmis par tradition orale, toponymie légendaire ou mémoire des conteurs.',
  },
};

export function resolveEpistemicStatus(poi: {
  category?: string;
  source?: string;
  subType?: string;
  officialLabel?: string;
  summary?: string;
  name?: string;
  epistemicStatus?: EpistemicStatus;
}): EpistemicStatus {
  if (poi.epistemicStatus) return poi.epistemicStatus;

  const cat = (poi.category || '').toLowerCase();
  const sub = (poi.subType || '').toLowerCase();
  const name = (poi.name || '').toLowerCase();
  const sum = (poi.summary || '').toLowerCase();

  // 1. Légendes & récits oraux
  if (
    cat === 'legende' ||
    sub.includes('légende') ||
    sub.includes('folklore') ||
    sub.includes('fée') ||
    sub.includes('diable') ||
    sub.includes('vouivre') ||
    sub.includes('miracle') ||
    name.includes('croix des fées') ||
    name.includes('trou du diable') ||
    name.includes('fontaine miraculeuse') ||
    sum.includes('raconte la légende') ||
    sum.includes('selon la légende') ||
    sum.includes('tradition populaire')
  ) {
    return 'legende_folklore';
  }

  // 2. Reconstitutions, hypothèses archéologiques ou tracés déduits
  if (
    sub.includes('reconstitution') ||
    sub.includes('hypothèse') ||
    sub.includes('estimé') ||
    sub.includes('voie antique supposée') ||
    sum.includes('tracé présumé') ||
    sum.includes('emplacement supposé') ||
    sum.includes('reconstitution plausible') ||
    sum.includes('hypothèse archéologique')
  ) {
    return 'reconstitution_hypothese';
  }

  // 3. Fait documenté
  return 'fait_documente';
}

export type TerrainKind =
  | 'water'
  | 'island'
  | 'waterway'
  | 'forest'
  | 'park'
  | 'farmland'
  | 'residential'
  | 'industrial'
  | 'commercial'
  | 'cemetery'
  | 'plaza'
  | 'pier'
  | 'sand'
  | 'scrub'
  | 'wetland'
  | 'scree'
  | 'building'
  | 'major_road'
  | 'minor_road'
  | 'path'
  | 'steps'
  | 'bridge'
  | 'rail'
  | 'tunnel_portal';

export type BridgeMode = 'road' | 'minor' | 'path' | 'rail';

export type LandmarkStyle =
  | 'church'
  | 'castle'
  | 'station'
  | 'civic'
  | 'arena'
  | 'tower'
  | 'fountain';

export type BuildingArchetype =
  | 'urban_midrise'
  | 'commercial_shop'
  | 'industrial'
  | 'suburban_house'
  | 'village_cottage'
  | 'rural_farm'
  | 'civic_school';

export type TrailNetwork = 'gr' | 'grp' | 'pr';

export type LieuDitKind =
  | 'ville'
  | 'village'
  | 'lieu_dit'
  | 'hameau'
  | 'quartier'
  | 'col_sommet'
  | 'bois_vallee'
  | 'hydronyme';

export interface LieuDitBanner {
  id: string;
  name: string;
  kind: LieuDitKind;
  lat: number;
  lng: number;
  altitudeMeters?: number;
}

export type HeritageMicroSpriteKind =
  | 'calvaire'
  | 'lavoir'
  | 'menhir'
  | 'moulin_vent'
  | 'moulin_eau'
  | 'fontaine'
  | 'four_pain'
  | 'pigeonnier'
  | 'phare'
  | 'borne_ign'
  | 'chapelle'
  | 'ruine'
  | 'puits'
  | 'table_orientation';

export interface OrientationTableNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  altitudeMeters: number;
  sourceLabel: string;
  poiId?: string;
}

export interface TerrainFeature {
  id: string;
  kind: TerrainKind;
  isPolygon?: boolean;
  name: string;
  points: Array<{ lat: number; lng: number }>;
  bridgeMode?: BridgeMode;
  landmark?: LandmarkStyle;
  bldgClass?: BuildingArchetype;
  levels?: number;
  waterwayRank?: 'river' | 'canal' | 'stream';
  trailNetwork?: TrailNetwork;
  trailRef?: string;
  tunnelMode?: 'road' | 'rail' | 'path';
}

export interface BedrockInfo {
  period: string;
  ageRangeMa: string;
  lithology: string;
  environment: string;
}

export interface ElevationGrid {
  centerLat: number;
  centerLng: number;
  cols: number;
  rows: number;
  stepMeters: number;
  minMeters: number;
  maxMeters: number;
  contourStepMeters: number;
  sourceLabel: string;
  /** Row-major (North to South, West to East) elevation values in decimeters (10 = 1.0 m) */
  elevDm: number[];
}

export type SubterraneanKind =
  | 'tunnel_road'
  | 'subway'
  | 'underground_water'
  | 'culvert'
  | 'aqueduct'
  | 'fault_line'
  | 'mineral_vein'
  | 'quarry'
  | 'cave_cellar'
  | 'natural_cave'
  | 'mine'
  | 'crypt'
  | 'military'
  | 'well_aquifer'
  | 'portal';

export interface SubterraneanFeature {
  id: string;
  kind: SubterraneanKind;
  name: string;
  isLine?: boolean;
  points: Array<{ lat: number; lng: number }>;
  depthLabel?: string;
  source?: string;
}

export interface SectorPayloadData {
  center: { lat: number; lng: number };
  radiusMeters: number;
  pois: PoiItem[];
  terrain: TerrainFeature[];
  subterranean?: SubterraneanFeature[];
  lieuxDits?: LieuDitBanner[];
  bedrock: BedrockInfo | null;
  elevation?: ElevationGrid | null;
  weather?: WeatherInfo | null;
  sourcesActive: string[];
  fetchedAt?: string;
}

/**
 * Smooth bilinear interpolation of real-world altitude (in meters) at any (lat, lng) within the sector grid
 */
export function sampleElevationMeters(
  grid: ElevationGrid | null | undefined,
  lat: number,
  lng: number
): number | null {
  if (!grid || !grid.elevDm || grid.elevDm.length < grid.cols * grid.rows) return null;
  const cosLat = Math.max(0.15, Math.cos((grid.centerLat * Math.PI) / 180));
  const dxMeters = (lng - grid.centerLng) * 111320 * cosLat;
  const dyMeters = (grid.centerLat - lat) * 110540;

  const halfX = (grid.cols - 1) / 2;
  const halfY = (grid.rows - 1) / 2;
  const fx = Math.max(0, Math.min(grid.cols - 1.001, halfX + dxMeters / grid.stepMeters));
  const fy = Math.max(0, Math.min(grid.rows - 1.001, halfY + dyMeters / grid.stepMeters));

  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(grid.cols - 1, x0 + 1);
  const y1 = Math.min(grid.rows - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;

  const v00 = grid.elevDm[y0 * grid.cols + x0];
  const v10 = grid.elevDm[y0 * grid.cols + x1];
  const v01 = grid.elevDm[y1 * grid.cols + x0];
  const v11 = grid.elevDm[y1 * grid.cols + x1];

  const top = v00 + (v10 - v00) * tx;
  const bot = v01 + (v11 - v01) * tx;
  return (top + (bot - top) * ty) / 10;
}

export interface UnlockedEntry {
  poiId: string;
  name: string;
  category: ExplorationCategory;
  subType: string;
  eraLabel: string;
  source: string;
  lat: number;
  lng: number;
  summary: string;
  nearWaterway: boolean;
  waterwayName: string;
  safetyNotice: string;
  externalUrl: string;
  xpAwarded: number;
  relatedPoiIds: string[];
  relatedPoiTitles: string[];
  personalNote: string;
  photoCount: number;
  discoveredAtIso: string;
  epistemicStatus?: EpistemicStatus;
}

export type TrophyId =
  | 'oiseau_de_nuit'
  | 'marcheur_orage'
  | 'speleologue'
  | 'arpenteur_10km'
  | 'grand_randonneur_50km'
  | 'maitre_7_roches'
  | 'chasseur_geodesique'
  | 'gardien_petit_patrimoine'
  | 'ouvreur_reliques'
  | 'leveur_brumes'
  | 'naturaliste_complet'
  | 'champion_contrats'
  | 'tisserand_recits'
  | 'maitre_chroniques'
  | 'heraut_communaute'
  | 'temoin_phenomenes'
  | 'champion_pantheon'
  | 'sondeur_bss'
  | 'hydrometre_hubeau'
  | 'explorateur_friches';

export const VALID_TROPHY_IDS: TrophyId[] = [
  'oiseau_de_nuit',
  'marcheur_orage',
  'speleologue',
  'arpenteur_10km',
  'grand_randonneur_50km',
  'maitre_7_roches',
  'chasseur_geodesique',
  'gardien_petit_patrimoine',
  'ouvreur_reliques',
  'leveur_brumes',
  'naturaliste_complet',
  'champion_contrats',
  'tisserand_recits',
  'maitre_chroniques',
  'heraut_communaute',
  'temoin_phenomenes',
  'champion_pantheon',
  'sondeur_bss',
  'hydrometre_hubeau',
  'explorateur_friches',
];

export interface ExplorerProgress {
  displayName: string;
  totalXp: number;
  xpHistoire: number;
  xpGeographie: number;
  xpEcosysteme: number;
  xpEtrange: number;
  xpLegende: number;
  gender?: ExplorerGender;
  avatarPreset?: ExplorerAvatarPreset;
  skinTone?: ExplorerSkinTone;
  headgearId?: ExplorerHeadgearId;
  outfitId?: ExplorerOutfitId;
  toolId?: ExplorerToolId;
  packId?: ExplorerPackId;
  familiarId?: ExplorerFamiliarId;
  pinnedTrophyId?: TrophyId | '';
  walkedMeters?: number;
  simulatedWalkedMeters?: number;
  nightFeatsCount?: number;
  stormFeatsCount?: number;
  completedContractsCount?: number;
  solvedRiddlesCount?: number;
  completedHuntsCount?: number;
  claimedAlmanacCount?: number;
  completedNarrativesCount?: number;
  claimedCommunityChallengesCount?: number;
  claimedLiveEventsCount?: number;
  claimedCollectionIds?: string[];
  claimedWalkingChallengeIds?: string[];
  discoveriesCount: number;
  completedMissions: string[];
}

export interface CategoryMeta {
  key: ExplorationCategory;
  label: string;
  shortLabel: string;
  guildRankTitle: string;
  tagline: string;
  emblemSrc: string;
  mapHex: string;
  mapTextClass: string;
  accentBgClass: string;
}

export const HERO_BANNER_SRC = '/src/assets/images/hero_overworld_16bit_1793180778807.jpg';
export const EXPLORER_PORTRAIT_SRC = '/src/assets/images/jrpg_explorer_portrait_1793182565537.jpg';

export const CATEGORY_ORDER: ExplorationCategory[] = [
  'histoire',
  'geographie',
  'legende',
  'etrange',
  'ecosysteme',
];

export const CATEGORY_META: Record<ExplorationCategory, CategoryMeta> = {
  histoire: {
    key: 'histoire',
    label: 'Histoire, Fouilles & Arts',
    shortLabel: 'Histoire',
    guildRankTitle: 'Chroniqueur des Âges',
    tagline:
      'Fouilles archéologiques (INRAP), monuments Mérimée, lavoirs, fours à pain, calvaires, colombiers, trésors Palissy, Joconde et plaques.',
    emblemSrc: '/src/assets/images/cat_histoire_emblem_1793180780013.jpg',
    mapHex: '#f59e0b',
    mapTextClass: 'text-amber-900',
    accentBgClass: 'bg-amber-500',
  },
  geographie: {
    key: 'geographie',
    label: 'Géodésie IGN, Roches & Eaux',
    shortLabel: 'Géologie',
    guildRankTitle: 'Géomancien des Roches',
    tagline:
      'Médaillons de nivellement & bornes géodésiques IGN, géosites INPG, failles & filons BRGM, rivières enterrées, moulins et sources.',
    emblemSrc: '/src/assets/images/cat_geographie_emblem_1793180781022.jpg',
    mapHex: '#0284c7',
    mapTextClass: 'text-sky-900',
    accentBgClass: 'bg-sky-500',
  },
  legende: {
    key: 'legende',
    label: 'Légendes, Contes & Lieux-Dits',
    shortLabel: 'Légendes',
    guildRankTitle: 'Chasseur de Mythes',
    tagline:
      'Fontaines miraculeuses & sources guérisseuses, toponymes aux fées et au diable, mégalithes enchantés et légendes locales.',
    emblemSrc: '/src/assets/images/cat_legende_emblem_1793182564466.jpg',
    mapHex: '#9333ea',
    mapTextClass: 'text-purple-900',
    accentBgClass: 'bg-purple-500',
  },
  etrange: {
    key: 'etrange',
    label: 'Souterrains, Mines & Friches',
    shortLabel: 'Souterrains',
    guildRankTitle: 'Éclaireur des Ombres',
    tagline:
      'Cavités et mines BRGM, ruisseaux busés, carrières à piliers, boyaux karstiques, cryptes voûtées, friches et voies ferrées fantômes.',
    emblemSrc: '/src/assets/images/cat_etrange_emblem_1793180782207.jpg',
    mapHex: '#e11d48',
    mapTextClass: 'text-rose-900',
    accentBgClass: 'bg-rose-500',
  },
  ecosysteme: {
    key: 'ecosysteme',
    label: 'Écosystème, ZNIEFF & Arbres',
    shortLabel: 'Écosystème',
    guildRankTitle: 'Naturaliste Sylvestre',
    tagline:
      'Sanctuaires écologiques ZNIEFF I & II (INPN), arbres remarquables centenaires, sites classés et espèces sauvages (iNaturalist & GBIF).',
    emblemSrc: '/src/assets/images/cat_ecosysteme_emblem_1793180782808.jpg',
    mapHex: '#059669',
    mapTextClass: 'text-emerald-900',
    accentBgClass: 'bg-emerald-500',
  },
};

export const STRATUM_ORDER: HistoricalStratum[] = [
  'temps_profond',
  'prehistoire',
  'antiquite',
  'moyen_age',
  'moderne',
  'contemporain',
  'vivant_folklore',
];

export const STRATUM_META: Record<HistoricalStratum, { label: string; short: string; eraSpan: string }> = {
  temps_profond: {
    label: 'Temps Géologique Profond (Ma)',
    short: 'Géologie & Fossiles',
    eraSpan: '−500 Ma à −2,5 Ma',
  },
  prehistoire: {
    label: 'Préhistoire & Mégalithes',
    short: 'Préhistoire',
    eraSpan: 'Paléolithique · Néolithique',
  },
  antiquite: {
    label: 'Antiquité & Gallo-Romain',
    short: 'Antiquité',
    eraSpan: 'Ve s. av. J.-C. – Ve s.',
  },
  moyen_age: {
    label: 'Moyen Âge',
    short: 'Moyen Âge',
    eraSpan: 'Ve – XVe siècle',
  },
  moderne: {
    label: 'Époque Moderne (XVIe–XVIIIe)',
    short: 'XVIe–XVIIIe',
    eraSpan: '1500 – 1789',
  },
  contemporain: {
    label: 'Ère Industrielle & Contemporaine',
    short: 'XIXe–XXIe',
    eraSpan: '1789 – Aujourd’hui',
  },
  vivant_folklore: {
    label: 'Folklore Vivant & Biodiversité',
    short: 'Vivant & Mythes',
    eraSpan: 'Mémoire orale & Vivant',
  },
};

export const PRESET_LOCATIONS: Array<{ label: string; region: string; lat: number; lng: number }> = [
  { label: 'Paris — Lutèce & Ste-Geneviève', region: 'Butte antique, arènes & carrières', lat: 48.8503, lng: 2.3435 },
  { label: 'Paris — Butte Montmartre', region: 'Escaliers, vignes & coteaux escarpés', lat: 48.8867, lng: 2.3431 },
  { label: 'Saint-Malo — Cité Corsaire', region: 'Granit, ardoise, plages & remparts', lat: 48.6493, lng: -2.0257 },
  { label: 'Roussillon — Ocres du Luberon', region: 'Tuiles canal, falaises ocres & garrigue', lat: 43.9023, lng: 5.2931 },
  { label: 'Arras — Grand-Place & Boves', region: 'Brique flamande, pignons & carrières de craie', lat: 50.2910, lng: 2.7775 },
  { label: 'Riquewihr — Alsace & Vignoble', region: 'Colombages, grès rose & coteaux', lat: 48.1667, lng: 7.2972 },
  { label: 'Chamonix — Aiguilles & Alpages', region: 'Chalets de mélèze, lauzes & torrents', lat: 45.9237, lng: 6.8694 },
  { label: 'Vallée de la Vézère (Les Eyzies)', region: 'Falaises calcaires, grottes & préhistoire', lat: 44.9364, lng: 1.0136 },
  { label: 'Lyon — Croix-Rousse & Fourvière', region: 'Collines, traboules, arêtes & Saône', lat: 45.7672, lng: 4.8318 },
  { label: 'Rocamadour — Cité & Canyon', region: 'Vertige calcaire, sanctuaires & Alzou', lat: 44.7994, lng: 1.6178 },
  { label: 'Brocéliande (Paimpont)', region: 'Val sans Retour, schiste pourpre & landes', lat: 48.0195, lng: -2.1742 },
];

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Computes minimum distance in meters from point P to segment A->B so wide-zoom simulated strides
 * never skip over POI proximity unlock circles along a path segment.
 */
export function minDistancePointToSegmentMeters(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const cosLat = Math.max(0.1, Math.cos((pLat * Math.PI) / 180));
  const px = (pLng - aLng) * 111320 * cosLat;
  const py = (pLat - aLat) * 110540;
  const bx = (bLng - aLng) * 111320 * cosLat;
  const by = (bLat - aLat) * 110540;
  const segLenSq = bx * bx + by * by;
  if (segLenSq < 1e-4) {
    return Math.hypot(px, py);
  }
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / segLenSq));
  return Math.hypot(px - t * bx, py - t * by);
}

export function computeLevelFromXp(xp: number): {
  level: number;
  currentFloorXp: number;
  nextLevelXp: number;
  progressPct: number;
} {
  let level = 1;
  let threshold = 0;
  let step = 380;
  while (xp >= threshold + step && level < 50) {
    threshold += step;
    level += 1;
    step = Math.round(step * 1.28);
  }
  const nextLevelXp = threshold + step;
  const span = Math.max(1, nextLevelXp - threshold);
  const progressPct = Math.min(100, Math.max(0, Math.round(((xp - threshold) / span) * 100)));
  return {
    level,
    currentFloorXp: threshold,
    nextLevelXp,
    progressPct,
  };
}

export function getCategoryXp(progress: ExplorerProgress, category: ExplorationCategory): number {
  switch (category) {
    case 'histoire':
      return progress.xpHistoire;
    case 'geographie':
      return progress.xpGeographie;
    case 'ecosysteme':
      return progress.xpEcosysteme;
    case 'etrange':
      return progress.xpEtrange;
    case 'legende':
      return progress.xpLegende || 0;
  }
}

const SUBTERRANEAN_POI_REGEX =
  /\b(cavit[ée]s?|grotte|gouffre|aven|doline|souterrains?|catacombes?|cryptes?|boves?|carri[èe]res?\s+souterrain|galeries?\s+souterrain|mines?\s+de|anciennes?\s+mines?|fosses?\s+mini[èe]res?|puits\s+de\s+mine|travers-bancs?|nappes?\s+phr[ée]atiques?|aquif[èe]res?|pi[ée]zom[èe]tres?|casemates?|abris?\s+souterrains?|bunkers?|tunnels?\s+|stations?\s+souterraines?|[ée]gouts?|rivi[èe]res?\s+enterr[ée]es?|ruisseaux?\s+bus[ée]s?|conduits?\s+bus[ée]s?|pertuis\s+vo[ûu]t[ée]s?|aqueducs?\s+souterrains?|failles?\s+g[ée]ologiques?|filons?\s+min[ée]ra|filons?\s+m[ée]tallif|g[îi]tes?\s+min[ée]ra|boyaux?\s+karstiques?|caves?\s+vo[ûu]t[ée]es?|hypog[ée]es?)\b/i;

export function isPoiSubterranean(
  poi: Pick<PoiItem, 'id' | 'name' | 'subType' | 'source' | 'isSubterranean'>
): boolean {
  if (typeof poi.isSubterranean === 'boolean') return poi.isSubterranean;
  if (/^(ign_rn_|ign_geod_|ov_ign_surv_)/i.test(poi.id)) return false;
  if (/^(cav_|bss_|sub_|subpoi_|brgm_gite_|brgm_mine_|ign_ug_)/i.test(poi.id)) return true;
  if (/BDCavit[ée]s|Sous-Sol\s*&\s*Nappes|Hub[’']Eau|Hydrographie\s+Souterraine/i.test(poi.source)) {
    return true;
  }
  return SUBTERRANEAN_POI_REGEX.test(`${poi.name} ${poi.subType}`);
}

/**
 * Strictly separates Surface POIs from Sous-sol POIs so the two world layers never share duplicate markers,
 * while promoting real mapped subterranean features (BRGM cavities, tunnels, culverted rivers, crypts, quarries,
 * aquifers, and deep bedrock strata) into dedicated underground discoveries.
 */
export function partitionSurfaceAndSubterraneanPois(params: {
  rawPois: PoiItem[];
  subterranean: SubterraneanFeature[];
  terrain: TerrainFeature[];
  bedrock: BedrockInfo | null;
  centerLat: number;
  centerLng: number;
}): {
  surfacePois: PoiItem[];
  subterraneanPois: PoiItem[];
} {
  const { rawPois, subterranean, terrain, bedrock, centerLat, centerLng } = params;
  const surfacePois: PoiItem[] = [];
  const subterraneanPois: PoiItem[] = [];

  for (const p of rawPois) {
    if (isPoiSubterranean(p)) {
      subterraneanPois.push({ ...p, isSubterranean: true });
    } else {
      surfacePois.push({ ...p, isSubterranean: false });
    }
  }

  const hasNearbySubPoi = (lat: number, lng: number, minMeters = 68): boolean =>
    subterraneanPois.some((sp) => haversineMeters(lat, lng, sp.lat, sp.lng) < minMeters);

  const bedNote = bedrock
    ? ` Creusé dans un substrat de ${bedrock.lithology.toLowerCase()} datant de l’ère « ${bedrock.period} » (${bedrock.ageRangeMa} Ma).`
    : '';

  // 1. Promote real mapped SubterraneanFeatures (BRGM cavities, culverted waterways, tunnels, quarries, mines, crypts)
  for (const sf of subterranean) {
    if (subterraneanPois.length >= 22) break;
    if (sf.points.length === 0) continue;
    const anchor = sf.isLine
      ? sf.points[Math.floor(sf.points.length / 2)]
      : sf.points[0];
    if (hasNearbySubPoi(anchor.lat, anchor.lng, 68)) continue;

    let category: ExplorationCategory = 'etrange';
    let stratum: HistoricalStratum = 'contemporain';
    let subType = 'Ouvrage souterrain';
    let mysteryTitle = 'Écho des galeries';
    let eraLabel = 'Sous-sol & galeries';
    let name = (sf.name || '').trim();
    let summary = '';

    switch (sf.kind) {
      case 'natural_cave':
        category = 'geographie';
        stratum = 'temps_profond';
        subType = 'Cavité naturelle & karst';
        mysteryTitle = 'Souffle de caverne';
        eraLabel = bedrock ? bedrock.period : 'Karst & temps profond';
        if (!name) name = 'Cavité naturelle & réseau karstique';
        summary = `Cavité souterraine naturelle façonnée par l’infiltration des eaux dans la roche.${
          sf.depthLabel ? ` Profondeur ou repère : ${sf.depthLabel}.` : ''
        }${bedNote}`;
        break;
      case 'quarry':
      case 'mine':
        category = 'etrange';
        stratum = 'moderne';
        subType = sf.kind === 'mine' ? 'Ancienne galerie minière' : 'Carrière souterraine';
        mysteryTitle = 'Chambre de taille enfouie';
        eraLabel = 'Extraction souterraine';
        if (!name) name = sf.kind === 'mine' ? 'Galerie minière ancienne' : 'Chambre de carrière souterraine';
        summary = `Ancienne excavation souterraine où les carriers et mineurs extrayaient la pierre ou le minerai sous le territoire.${
          sf.depthLabel ? ` Indication : ${sf.depthLabel}.` : ''
        }${bedNote}`;
        break;
      case 'underground_water':
      case 'culvert':
      case 'aqueduct':
      case 'well_aquifer':
        category = sf.kind === 'aqueduct' ? 'histoire' : 'geographie';
        stratum = sf.kind === 'aqueduct' ? 'antiquite' : 'temps_profond';
        subType =
          sf.kind === 'culvert'
            ? 'Rivière enterrée & collecteur voûté'
            : sf.kind === 'aqueduct'
            ? 'Aqueduc & galerie d’adduction'
            : sf.kind === 'underground_water'
            ? 'Cours d’eau souterrain voûté'
            : 'Veine phréatique & puits';
        mysteryTitle =
          sf.kind === 'aqueduct' ? 'Galerie des Fontainiers' : 'Murmure d’eau souterraine';
        eraLabel = sf.kind === 'aqueduct' ? 'Génie hydraulique ancien' : 'Hydrogéologie enfouie';
        if (!name) {
          name =
            sf.kind === 'culvert'
              ? 'Ruisseau busé & canalisation voûtée'
              : sf.kind === 'aqueduct'
              ? 'Galerie d’aqueduc souterrain'
              : sf.kind === 'underground_water'
              ? 'Galerie hydraulique & ruisseau voûté'
              : 'Puits & nappe phréatique locale';
        } else if (
          (sf.kind === 'underground_water' || sf.kind === 'culvert') &&
          !/souterrain|vo[ûu]t|canalisation|bus[ée]|enterr[ée]/i.test(name)
        ) {
          name = `Cours enterré : ${name}`;
        }
        summary = `Écoulement souterrain ou galerie hydraulique dissimulée sous la surface, témoin des rivières recouvertes par l’urbanisme ou des infiltrations dans la roche.${bedNote}`;
        break;
      case 'fault_line':
      case 'mineral_vein':
        category = 'geographie';
        stratum = 'temps_profond';
        subType =
          sf.kind === 'mineral_vein'
            ? 'Filon minier & gîte métallifère'
            : 'Faille géologique & fracture tectonique';
        mysteryTitle =
          sf.kind === 'mineral_vein' ? 'Veine Cristalline Profonde' : 'Fracture du Socle';
        eraLabel = bedrock ? bedrock.period : 'Tectonique & Temps profond';
        if (!name) {
          name =
            sf.kind === 'mineral_vein'
              ? 'Filon hydrothermal & gîte minéral'
              : 'Faille tectonique & veine cristalline';
        }
        summary =
          sf.kind === 'mineral_vein'
            ? `Gîte minéral et filon hydrothermal logé dans les fractures de la roche-mère${
                sf.depthLabel ? ` (${sf.depthLabel})` : ''
              }.${bedNote}`
            : `Discontinuité géologique et zone de fracture dans le socle rocheux favorisant la circulation des eaux profondes et la cristallisation de filons minéraux.${bedNote}`;
        break;
      case 'crypt':
      case 'military':
        category = 'histoire';
        stratum = sf.kind === 'crypt' ? 'moyen_age' : 'contemporain';
        subType = sf.kind === 'crypt' ? 'Crypte & substructions' : 'Casemate & ouvrage défensif';
        mysteryTitle = sf.kind === 'crypt' ? 'Voûte scellée sous la pierre' : 'Casemate enfouie';
        eraLabel = sf.kind === 'crypt' ? 'Fondations & cryptes' : 'Ouvrage enfoui';
        if (!name) name = sf.kind === 'crypt' ? 'Crypte voûtée ancienne' : 'Ouvrage souterrain abrité';
        summary = `Architecture souterraine maçonnée préservée sous le niveau du sol actuel.${bedNote}`;
        break;
      case 'tunnel_road':
      case 'subway':
        category = 'etrange';
        stratum = 'contemporain';
        subType = sf.kind === 'subway' ? 'Galerie ferroviaire souterraine' : 'Tunnel & percée souterraine';
        mysteryTitle = 'Galerie de franchissement';
        eraLabel = 'Génie civil souterrain';
        if (!name) {
          name = sf.kind === 'subway' ? 'Voie souterraine métropolitaine' : 'Tunnel de franchissement';
        } else if (!/tunnel|souterrain|m[ée]tro|galerie/i.test(name)) {
          name = `Percée souterraine : ${name}`;
        }
        summary = `Ouvrage d’art percé sous le relief ou le bâti urbain pour relier deux versants sans interrompre la surface.${bedNote}`;
        break;
      default:
        category = 'etrange';
        stratum = 'moderne';
        subType = 'Caves voûtées & celliers';
        mysteryTitle = 'Cellier de pierre';
        eraLabel = 'Sous-sol bâti';
        if (!name) name = 'Caves voûtées & celliers anciens';
        summary = `Réseau de caves et d’assises anciennes bâties à l’abri des variations thermiques de la surface.${bedNote}`;
        break;
    }

    subterraneanPois.push({
      id: `subpoi_${sf.id}`,
      name,
      mysteryTitle,
      category,
      subType,
      stratum,
      eraLabel,
      source: sf.source || 'Cartographie Souterraine (BRGM / OSM)',
      lat: anchor.lat,
      lng: anchor.lng,
      summary,
      nearWaterway:
        sf.kind === 'underground_water' ||
        sf.kind === 'culvert' ||
        sf.kind === 'aqueduct' ||
        sf.kind === 'well_aquifer',
      waterwayName:
        sf.kind === 'underground_water' || sf.kind === 'culvert' ? sf.name || '' : '',
      safetyNotice: 'Accès souterrain réglementé ou non ouvert au public : observation cartographique uniquement.',
      externalUrl: '',
      xpReward: 55,
      unlockRadiusMeters: 62,
      relatedPoiIds: [],
      relatedPoiTitles: [],
      isSubterranean: true,
    });
  }

  // 2. Promote historic subterranean crypts / foundations beneath named monumental buildings (churches, castles, arenas)
  for (const tf of terrain) {
    if (subterraneanPois.length >= 22) break;
    if (tf.kind !== 'building' || !tf.landmark || tf.points.length === 0) continue;
    if (tf.landmark !== 'church' && tf.landmark !== 'castle' && tf.landmark !== 'arena') continue;
    const rawName = (tf.name || '').trim();
    if (!rawName) continue;
    let latSum = 0;
    let lngSum = 0;
    for (const pt of tf.points) {
      latSum += pt.lat;
      lngSum += pt.lng;
    }
    const cLat = latSum / tf.points.length;
    const cLng = lngSum / tf.points.length;
    if (hasNearbySubPoi(cLat, cLng, 80)) continue;

    const kindTitle =
      tf.landmark === 'church'
        ? `Crypte & assises sous ${rawName}`
        : tf.landmark === 'castle'
        ? `Souterrains & basses-fosses (${rawName})`
        : `Hypogée & substructions (${rawName})`;

    subterraneanPois.push({
      id: `subpoi_ldmk_${tf.id}`,
      name: kindTitle,
      mysteryTitle: 'Fondations séculaires',
      category: 'histoire',
      subType: 'Substructions & crypte',
      stratum: tf.landmark === 'arena' ? 'antiquite' : 'moyen_age',
      eraLabel: tf.landmark === 'arena' ? 'Substructions antiques' : 'Assises médiévales',
      source: 'Topologie Patrimoniale & Sous-sol',
      lat: cLat,
      lng: cLng,
      summary: `Assises de fondation, caves voûtées et niveaux anciens enfouis sous l’emprise monumentale de « ${rawName} ».${bedNote}`,
      nearWaterway: false,
      waterwayName: '',
      safetyNotice: '',
      externalUrl: '',
      xpReward: 60,
      unlockRadiusMeters: 62,
      relatedPoiIds: [],
      relatedPoiTitles: [],
      isSubterranean: true,
    });
  }

  // 3. World-locked geological / hydrogeological underground echoes on a fixed 0.014° lattice
  //    (never shifts or disappears when the player walks across sector boundaries!)
  if (subterraneanPois.length < 6) {
    const stepDeg = 0.014;
    const baseCellLat = Math.round(centerLat / stepDeg);
    const baseCellLng = Math.round(centerLng / stepDeg);
    const period = bedrock ? bedrock.period : 'Temps profond';
    const litho = bedrock ? bedrock.lithology.toLowerCase() : 'roche-mère';
    const age = bedrock ? bedrock.ageRangeMa : 'Ère géologique ancienne';
    const kinds = ['geol', 'hydro', 'fossil', 'karst'] as const;

    for (let dLatIdx = -1; dLatIdx <= 1; dLatIdx++) {
      for (let dLngIdx = -1; dLngIdx <= 1; dLngIdx++) {
        const cLatIdx = baseCellLat + dLatIdx;
        const cLngIdx = baseCellLng + dLngIdx;
        const h = Math.abs((cLatIdx * 73856093) ^ (cLngIdx * 19349663));
        const jLat = (((h % 61) - 30) / 100) * stepDeg * 0.65;
        const jLng = ((((h >> 6) % 61) - 30) / 100) * stepDeg * 0.65;
        const gLat = cLatIdx * stepDeg + jLat;
        const gLng = cLngIdx * stepDeg + jLng;
        if (hasNearbySubPoi(gLat, gLng, 220)) continue;

        const kind = kinds[h % kinds.length];
        subterraneanPois.push({
          id: `subpoi_bed_${cLatIdx}_${cLngIdx}`,
          name:
            kind === 'geol'
              ? `Banc rocheux (${period})`
              : kind === 'hydro'
              ? `Infiltration & veine phréatique`
              : kind === 'fossil'
              ? `Horizon sédimentaire ancien`
              : `Diaclase & poche minérale`,
          mysteryTitle: 'Strate du temps profond',
          category: kind === 'karst' ? 'etrange' : 'geographie',
          subType: 'Géologie souterraine',
          stratum: 'temps_profond',
          eraLabel: `${period} (${age})`,
          source: bedrock ? 'Macrostrat · Coupe du Sous-sol' : 'Coupe Géologique Locale',
          lat: gLat,
          lng: gLng,
          summary: `Observation souterraine du socle régional composé de ${litho}${
            bedrock?.environment ? ` (ancien milieu : ${bedrock.environment.toLowerCase()})` : ''
          }, daté de ${age}.`,
          nearWaterway: kind === 'hydro',
          waterwayName: '',
          safetyNotice: '',
          externalUrl: '',
          xpReward: 50,
          unlockRadiusMeters: 65,
          relatedPoiIds: [],
          relatedPoiTitles: [],
          isSubterranean: true,
        });
      }
    }
  }

  return { surfacePois, subterraneanPois };
}
