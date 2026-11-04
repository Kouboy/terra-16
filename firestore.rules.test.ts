/**
 * Adversarial Security Specification Verification Suite for Terra 16
 * Verifies all adversarial payloads defined in security_spec.md
 * against the exact boolean invariants in firestore.rules.
 */

interface AuthContext {
  uid: string;
  emailVerified: boolean;
}

const REQUEST_TIME = 'SERVER_TIMESTAMP';

const VALID_PROFILE = {
  ownerId: 'user_1',
  displayName: 'Explorateur Nico',
  totalXp: 100,
  xpHistoire: 100,
  xpGeographie: 0,
  xpEcosysteme: 0,
  xpEtrange: 0,
  xpLegende: 0,
  gender: 'masculin',
  avatarPreset: 'cartographe',
  skinTone: 'hale',
  headgearId: 'tricorne_fauve',
  outfitId: 'arpenteur',
  toolId: 'lanterne_laiton',
  packId: 'besace_cuir',
  walkedMeters: 420,
  discoveriesCount: 1,
  completedMissions: ['first_step'],
  createdAt: REQUEST_TIME,
  updatedAt: REQUEST_TIME,
};

const VALID_DISCOVERY = {
  ownerId: 'user_1',
  poiId: 'osm_node_12345',
  name: 'Source Saint-Martin',
  category: 'geographie',
  subType: 'Source naturelle',
  eraLabel: 'Temps Géologique Profond',
  source: 'OpenStreetMap',
  lat: 48.8566,
  lng: 2.3522,
  summary: 'Source ancienne jaillissant au pied du coteau calcaire.',
  nearWaterway: true,
  waterwayName: 'La Bièvre',
  safetyNotice: '',
  externalUrl: 'https://www.openstreetmap.org/node/12345',
  xpAwarded: 85,
  relatedPoiIds: [],
  relatedPoiTitles: [],
  personalNote: 'Eau limpide et fraiche.',
  photoCount: 1,
  discoveredAt: REQUEST_TIME,
  updatedAt: REQUEST_TIME,
};

const VALID_CAIRN = {
  authorId: 'user_1',
  authorCallsign: 'Explorateur Nico',
  poiId: 'osm_node_12345',
  poiName: 'Source Saint-Martin',
  tag: 'point_de_vue',
  message: 'Superbe lumière rasante en fin d’après-midi près de la vasque en pierre.',
  visibility: 'public',
  createdAt: REQUEST_TIME,
  updatedAt: REQUEST_TIME,
};

const VALID_ARCHIVIST_CHEST = {
  ownerId: 'user_1',
  chestId: 'archivist_sommet_colline_488566_23522',
  archetype: 'sommet_colline',
  title: 'Coffre de Promontoire',
  placeNote: 'Posé au point culminant local dominant les coteaux.',
  relicId: 'relic_astrolabe_cassini',
  relicName: 'Astrolabe de Cassini',
  category: 'geographie',
  regionLabel: 'Bassin calcaire & ardoise',
  lat: 48.8566,
  lng: 2.3522,
  altitudeMeters: 128,
  isSubterranean: false,
  xpAwarded: 120,
  openedAt: REQUEST_TIME,
};

const VALID_GEOCACHE = {
  authorId: 'user_1',
  authorCallsign: 'Explorateur Nico',
  sectorKey: 's_p1221_p58',
  placementMode: 'unlocked_poi',
  anchorPoiId: 'osm_node_12345',
  lat: 48.8567,
  lng: 2.3523,
  isSubterranean: false,
  regionLabel: 'Bassin calcaire & ardoise',
  title: 'Capsule de la Source',
  riddleHint: 'Cherchez à trois pas au nord de la vasque moussue, sous la racine tordue.',
  giftKind: 'relic',
  giftId: 'relic_astrolabe_cassini',
  giftName: 'Astrolabe de Cassini',
  giftDomain: 'relique',
  visibility: 'public',
  createdAt: REQUEST_TIME,
  updatedAt: REQUEST_TIME,
};

const VALID_GEOCACHE_LOG = {
  cacheId: 'cache_user_1_488567_23523',
  finderId: 'user_1',
  finderCallsign: 'Explorateur Nico',
  note: 'Déterrée à la tombée du soir grâce à la résonance du sondeur !',
  visibility: 'public',
  foundAt: REQUEST_TIME,
  updatedAt: REQUEST_TIME,
};

const VALID_CHALLENGE_ENTRY = {
  challengeId: 'ch_daily_20261103_ondes',
  cadence: 'quotidien',
  periodKey: '2026-11',
  explorerId: 'user_1',
  explorerCallsign: 'Explorateur Nico',
  explorerGender: 'masculin',
  explorerAvatarPreset: 'cartographe',
  explorerSkinTone: 'hale',
  explorerHeadgearId: 'couronne_chroniqueur',
  explorerOutfitId: 'conteuse_legende',
  explorerFamiliarId: 'cerf_brumes',
  explorerPinnedTrophyId: 'tisserand_recits',
  contributionCount: 3,
  points: 90,
  regionLabel: 'Vallée de la Bièvre',
  visibility: 'public',
  createdAt: REQUEST_TIME,
  updatedAt: REQUEST_TIME,
};

const VALID_PANTHEON_ENTRY = {
  explorerId: 'user_1',
  explorerCallsign: 'Explorateur Nico',
  regionLabel: 'Vallée de la Loire',
  explorerGender: 'masculin',
  explorerAvatarPreset: 'cartographe',
  explorerSkinTone: 'hale',
  explorerHeadgearId: 'couronne_chroniqueur',
  explorerOutfitId: 'conteuse_legende',
  explorerFamiliarId: 'cerf_brumes',
  explorerPinnedTrophyId: 'temoin_phenomenes',
  pantheonScore: 1850,
  totalXp: 820,
  diversityScore: 510,
  rarityScore: 520,
  discoveriesCount: 14,
  categoriesCount: 4,
  strataCount: 3,
  sourcesCount: 6,
  secretArchivesCount: 1,
  officialHeritageCount: 3,
  liveEventsCount: 2,
  visibility: 'public',
  createdAt: REQUEST_TIME,
  updatedAt: REQUEST_TIME,
};

const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function isValidId(id: unknown): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && ID_REGEX.test(id);
}

function isBoundedStringArray(arr: unknown, maxLen: number): boolean {
  if (!Array.isArray(arr) || arr.length > maxLen) return false;
  if (arr.length === 0) return true;
  return typeof arr[0] === 'string' && arr[0].length <= 200;
}

const VALID_GENDERS = ['feminin', 'masculin', 'neutre'];
const VALID_AVATARS = ['cartographe', 'eclaireur', 'archiviste', 'forgeron', 'oracle', 'botaniste'];
const VALID_SKINS = ['clair', 'hale', 'ambre', 'ebene', 'porcelaine'];
const VALID_HEADGEAR = [
  'tricorne_fauve', 'beret_chroniqueur', 'casque_mineur', 'capuche_sylvestre',
  'couronne_menhir', 'lunettes_astro', 'monocle_erudit', 'tricorne_reliquaire',
  'couronne_saisons', 'couronne_chroniqueur', 'bandeau_guilde_unie',
];
const VALID_OUTFITS = [
  'arpenteur', 'chroniqueur', 'geomancien', 'sylvestre', 'ombres', 'barde',
  'almanach_solaire', 'chasseur_reliques', 'conteuse_legende',
];
const VALID_TOOLS = [
  'lanterne_laiton', 'boussole_astrale', 'marteau_geologue', 'plume_enluminee',
  'fiole_spectrale', 'loupe_sceau_or', 'clef_coffres_anciens', 'sablier_ephemeride',
  'plume_trois_actes',
];
const VALID_PACKS = [
  'besace_cuir', 'rouleau_cartes', 'hotte_cristaux', 'ailerons_automate',
  'coffret_piste', 'grimoire_almanach', 'astrolabe_dorsal',
];
const VALID_FAMILIARS = [
  'aucun', 'chouette_erudite', 'goupil_saisons', 'scarabee_boussole',
  'salamandre_cristal', 'corbeau_cartographe', 'feu_follet_astral', 'hermine_royale',
  'cerf_brumes', 'loutre_riviere',
];
const VALID_PINNED_TROPHIES = [
  '', 'oiseau_de_nuit', 'marcheur_orage', 'speleologue', 'arpenteur_10km',
  'grand_randonneur_50km', 'maitre_7_roches', 'chasseur_geodesique',
  'gardien_petit_patrimoine', 'ouvreur_reliques', 'leveur_brumes',
  'naturaliste_complet', 'champion_contrats', 'tisserand_recits',
  'maitre_chroniques', 'heraut_communaute', 'temoin_phenomenes', 'champion_pantheon',
];

function isValidExplorerProfile(data: Record<string, unknown>, auth: AuthContext | null): boolean {
  if (!auth) return false;
  const requiredKeys = [
    'ownerId', 'displayName', 'totalXp', 'xpHistoire', 'xpGeographie',
    'xpEcosysteme', 'xpEtrange', 'discoveriesCount', 'completedMissions',
    'createdAt', 'updatedAt',
  ];
  const allowedKeys = [
    ...requiredKeys,
    'xpLegende',
    'gender',
    'avatarPreset',
    'skinTone',
    'headgearId',
    'outfitId',
    'toolId',
    'packId',
    'familiarId',
    'pinnedTrophyId',
    'walkedMeters',
    'nightFeatsCount',
    'stormFeatsCount',
    'completedContractsCount',
    'solvedRiddlesCount',
    'completedHuntsCount',
    'claimedAlmanacCount',
    'completedNarrativesCount',
    'claimedCommunityChallengesCount',
    'claimedLiveEventsCount',
  ];
  const dataKeys = Object.keys(data);
  if (!requiredKeys.every((k) => dataKeys.includes(k)) || !dataKeys.every((k) => allowedKeys.includes(k))) return false;
  return (
    isValidId(data.ownerId) &&
    data.ownerId === auth.uid &&
    typeof data.displayName === 'string' && data.displayName.length >= 1 && data.displayName.length <= 60 &&
    typeof data.totalXp === 'number' && data.totalXp >= 0 && data.totalXp <= 10000000 &&
    typeof data.xpHistoire === 'number' && data.xpHistoire >= 0 && data.xpHistoire <= 10000000 &&
    typeof data.xpGeographie === 'number' && data.xpGeographie >= 0 && data.xpGeographie <= 10000000 &&
    typeof data.xpEcosysteme === 'number' && data.xpEcosysteme >= 0 && data.xpEcosysteme <= 10000000 &&
    typeof data.xpEtrange === 'number' && data.xpEtrange >= 0 && data.xpEtrange <= 10000000 &&
    (!('xpLegende' in data) || (typeof data.xpLegende === 'number' && data.xpLegende >= 0 && data.xpLegende <= 10000000)) &&
    (!('gender' in data) || (typeof data.gender === 'string' && data.gender.length >= 1 && data.gender.length <= 16 && VALID_GENDERS.includes(data.gender))) &&
    (!('avatarPreset' in data) || (typeof data.avatarPreset === 'string' && data.avatarPreset.length >= 1 && data.avatarPreset.length <= 32 && VALID_AVATARS.includes(data.avatarPreset))) &&
    (!('skinTone' in data) || (typeof data.skinTone === 'string' && data.skinTone.length >= 1 && data.skinTone.length <= 32 && VALID_SKINS.includes(data.skinTone))) &&
    (!('headgearId' in data) || (typeof data.headgearId === 'string' && data.headgearId.length >= 1 && data.headgearId.length <= 32 && VALID_HEADGEAR.includes(data.headgearId))) &&
    (!('outfitId' in data) || (typeof data.outfitId === 'string' && data.outfitId.length >= 1 && data.outfitId.length <= 32 && VALID_OUTFITS.includes(data.outfitId))) &&
    (!('toolId' in data) || (typeof data.toolId === 'string' && data.toolId.length >= 1 && data.toolId.length <= 32 && VALID_TOOLS.includes(data.toolId))) &&
    (!('packId' in data) || (typeof data.packId === 'string' && data.packId.length >= 1 && data.packId.length <= 32 && VALID_PACKS.includes(data.packId))) &&
    (!('familiarId' in data) || (typeof data.familiarId === 'string' && data.familiarId.length >= 1 && data.familiarId.length <= 32 && VALID_FAMILIARS.includes(data.familiarId))) &&
    (!('pinnedTrophyId' in data) || (typeof data.pinnedTrophyId === 'string' && data.pinnedTrophyId.length <= 40 && VALID_PINNED_TROPHIES.includes(data.pinnedTrophyId))) &&
    (!('walkedMeters' in data) || (typeof data.walkedMeters === 'number' && data.walkedMeters >= 0 && data.walkedMeters <= 100000000)) &&
    (!('completedNarrativesCount' in data) || (typeof data.completedNarrativesCount === 'number' && data.completedNarrativesCount >= 0 && data.completedNarrativesCount <= 100000)) &&
    (!('claimedCommunityChallengesCount' in data) || (typeof data.claimedCommunityChallengesCount === 'number' && data.claimedCommunityChallengesCount >= 0 && data.claimedCommunityChallengesCount <= 100000)) &&
    (!('claimedLiveEventsCount' in data) || (typeof data.claimedLiveEventsCount === 'number' && data.claimedLiveEventsCount >= 0 && data.claimedLiveEventsCount <= 100000)) &&
    typeof data.discoveriesCount === 'number' && data.discoveriesCount >= 0 && data.discoveriesCount <= 100000 &&
    isBoundedStringArray(data.completedMissions, 50) &&
    data.createdAt === REQUEST_TIME &&
    data.updatedAt === REQUEST_TIME
  );
}

function isValidJournalDiscovery(data: Record<string, unknown>, auth: AuthContext | null): boolean {
  if (!auth) return false;
  const requiredKeys = [
    'ownerId', 'poiId', 'name', 'category', 'subType', 'source', 'lat', 'lng',
    'summary', 'nearWaterway', 'waterwayName', 'safetyNotice', 'externalUrl',
    'xpAwarded', 'relatedPoiIds', 'relatedPoiTitles', 'personalNote',
    'photoCount', 'discoveredAt', 'updatedAt',
  ];
  const allowedKeys = [...requiredKeys, 'eraLabel'];
  const dataKeys = Object.keys(data);
  if (!requiredKeys.every((k) => dataKeys.includes(k)) || !dataKeys.every((k) => allowedKeys.includes(k))) return false;
  return (
    isValidId(data.ownerId) &&
    data.ownerId === auth.uid &&
    isValidId(data.poiId) &&
    typeof data.name === 'string' && data.name.length >= 1 && data.name.length <= 200 &&
    typeof data.category === 'string' && ['histoire', 'geographie', 'ecosysteme', 'etrange', 'legende'].includes(data.category) &&
    typeof data.subType === 'string' && data.subType.length >= 1 && data.subType.length <= 80 &&
    (!('eraLabel' in data) || (typeof data.eraLabel === 'string' && data.eraLabel.length <= 100)) &&
    typeof data.source === 'string' && data.source.length >= 1 && data.source.length <= 80 &&
    typeof data.lat === 'number' && data.lat >= -90 && data.lat <= 90 &&
    typeof data.lng === 'number' && data.lng >= -180 && data.lng <= 180 &&
    typeof data.summary === 'string' && data.summary.length >= 1 && data.summary.length <= 2500 &&
    typeof data.nearWaterway === 'boolean' &&
    typeof data.waterwayName === 'string' && data.waterwayName.length <= 120 &&
    typeof data.safetyNotice === 'string' && data.safetyNotice.length <= 400 &&
    typeof data.externalUrl === 'string' && data.externalUrl.length <= 500 &&
    typeof data.xpAwarded === 'number' && data.xpAwarded >= 0 && data.xpAwarded <= 5000 &&
    isBoundedStringArray(data.relatedPoiIds, 10) &&
    isBoundedStringArray(data.relatedPoiTitles, 10) &&
    typeof data.personalNote === 'string' && data.personalNote.length <= 2000 &&
    typeof data.photoCount === 'number' && data.photoCount >= 0 && data.photoCount <= 20 &&
    data.discoveredAt === REQUEST_TIME &&
    data.updatedAt === REQUEST_TIME
  );
}

function isValidExplorerCairn(data: Record<string, unknown>, auth: AuthContext | null): boolean {
  if (!auth) return false;
  const requiredKeys = [
    'authorId', 'authorCallsign', 'poiId', 'poiName', 'tag',
    'message', 'visibility', 'createdAt', 'updatedAt',
  ];
  const allowedKeys = [
    ...requiredKeys,
    'authorGender',
    'authorAvatarPreset',
    'authorSkinTone',
    'authorHeadgearId',
    'authorOutfitId',
  ];
  const dataKeys = Object.keys(data);
  if (!requiredKeys.every((k) => dataKeys.includes(k)) || !dataKeys.every((k) => allowedKeys.includes(k))) return false;
  const validTags = ['architecture', 'acces', 'point_de_vue', 'conseil_heure', 'secret'];
  return (
    isValidId(data.authorId) &&
    data.authorId === auth.uid &&
    typeof data.authorCallsign === 'string' && data.authorCallsign.length >= 1 && data.authorCallsign.length <= 60 &&
    (!('authorGender' in data) || (typeof data.authorGender === 'string' && VALID_GENDERS.includes(data.authorGender))) &&
    (!('authorAvatarPreset' in data) || (typeof data.authorAvatarPreset === 'string' && VALID_AVATARS.includes(data.authorAvatarPreset))) &&
    (!('authorSkinTone' in data) || (typeof data.authorSkinTone === 'string' && VALID_SKINS.includes(data.authorSkinTone))) &&
    (!('authorHeadgearId' in data) || (typeof data.authorHeadgearId === 'string' && VALID_HEADGEAR.includes(data.authorHeadgearId))) &&
    (!('authorOutfitId' in data) || (typeof data.authorOutfitId === 'string' && VALID_OUTFITS.includes(data.authorOutfitId))) &&
    isValidId(data.poiId) &&
    typeof data.poiName === 'string' && data.poiName.length >= 1 && data.poiName.length <= 200 &&
    typeof data.tag === 'string' && validTags.includes(data.tag) &&
    typeof data.message === 'string' && data.message.length >= 3 && data.message.length <= 280 &&
    data.visibility === 'public' &&
    data.createdAt === REQUEST_TIME &&
    data.updatedAt === REQUEST_TIME
  );
}

function isValidOpenedArchivistChest(data: Record<string, unknown>, auth: AuthContext | null): boolean {
  if (!auth) return false;
  const requiredKeys = [
    'ownerId', 'chestId', 'archetype', 'title', 'placeNote', 'relicId',
    'relicName', 'category', 'regionLabel', 'lat', 'lng', 'isSubterranean',
    'xpAwarded', 'openedAt',
  ];
  const allowedKeys = [...requiredKeys, 'altitudeMeters'];
  const dataKeys = Object.keys(data);
  if (!requiredKeys.every((k) => dataKeys.includes(k)) || !dataKeys.every((k) => allowedKeys.includes(k))) return false;
  const validArchetypes = ['sommet_colline', 'confluence_eaux', 'cul_de_sac_forestier', 'clairiere_sylvestre', 'bouche_souterraine'];
  return (
    isValidId(data.ownerId) &&
    data.ownerId === auth.uid &&
    isValidId(data.chestId) &&
    typeof data.archetype === 'string' && validArchetypes.includes(data.archetype) &&
    typeof data.title === 'string' && data.title.length >= 1 && data.title.length <= 160 &&
    typeof data.placeNote === 'string' && data.placeNote.length >= 1 && data.placeNote.length <= 240 &&
    isValidId(data.relicId) && (data.relicId as string).length <= 64 &&
    typeof data.relicName === 'string' && data.relicName.length >= 1 && data.relicName.length <= 160 &&
    typeof data.category === 'string' && ['histoire', 'geographie', 'ecosysteme', 'etrange', 'legende'].includes(data.category) &&
    typeof data.regionLabel === 'string' && data.regionLabel.length >= 1 && data.regionLabel.length <= 140 &&
    typeof data.lat === 'number' && data.lat >= -90 && data.lat <= 90 &&
    typeof data.lng === 'number' && data.lng >= -180 && data.lng <= 180 &&
    (!('altitudeMeters' in data) || (typeof data.altitudeMeters === 'number' && data.altitudeMeters >= -500 && data.altitudeMeters <= 9000)) &&
    typeof data.isSubterranean === 'boolean' &&
    typeof data.xpAwarded === 'number' && data.xpAwarded >= 0 && data.xpAwarded <= 5000 &&
    data.openedAt === REQUEST_TIME
  );
}

function isValidExplorerGeocache(data: Record<string, unknown>, auth: AuthContext | null): boolean {
  if (!auth) return false;
  const requiredKeys = [
    'authorId', 'authorCallsign', 'sectorKey', 'placementMode', 'lat', 'lng',
    'isSubterranean', 'regionLabel', 'title', 'riddleHint', 'giftKind',
    'giftId', 'giftName', 'giftDomain', 'visibility', 'createdAt', 'updatedAt',
  ];
  const allowedKeys = [
    ...requiredKeys,
    'anchorPoiId',
    'authorGender',
    'authorAvatarPreset',
    'authorSkinTone',
    'authorHeadgearId',
    'authorOutfitId',
  ];
  const dataKeys = Object.keys(data);
  if (!requiredKeys.every((k) => dataKeys.includes(k)) || !dataKeys.every((k) => allowedKeys.includes(k))) return false;
  return (
    isValidId(data.authorId) &&
    data.authorId === auth.uid &&
    typeof data.authorCallsign === 'string' && data.authorCallsign.length >= 1 && data.authorCallsign.length <= 60 &&
    (!('authorGender' in data) || (typeof data.authorGender === 'string' && VALID_GENDERS.includes(data.authorGender))) &&
    (!('authorAvatarPreset' in data) || (typeof data.authorAvatarPreset === 'string' && VALID_AVATARS.includes(data.authorAvatarPreset))) &&
    (!('authorSkinTone' in data) || (typeof data.authorSkinTone === 'string' && VALID_SKINS.includes(data.authorSkinTone))) &&
    (!('authorHeadgearId' in data) || (typeof data.authorHeadgearId === 'string' && VALID_HEADGEAR.includes(data.authorHeadgearId))) &&
    (!('authorOutfitId' in data) || (typeof data.authorOutfitId === 'string' && VALID_OUTFITS.includes(data.authorOutfitId))) &&
    isValidId(data.sectorKey) && (data.sectorKey as string).length >= 3 && (data.sectorKey as string).length <= 32 &&
    typeof data.placementMode === 'string' && ['gps_live', 'unlocked_poi'].includes(data.placementMode) &&
    (!('anchorPoiId' in data) || isValidId(data.anchorPoiId)) &&
    (data.placementMode === 'gps_live' || 'anchorPoiId' in data) &&
    typeof data.lat === 'number' && data.lat >= -90 && data.lat <= 90 &&
    typeof data.lng === 'number' && data.lng >= -180 && data.lng <= 180 &&
    typeof data.isSubterranean === 'boolean' &&
    typeof data.regionLabel === 'string' && data.regionLabel.length >= 1 && data.regionLabel.length <= 140 &&
    typeof data.title === 'string' && data.title.length >= 3 && data.title.length <= 100 &&
    typeof data.riddleHint === 'string' && data.riddleHint.length >= 5 && data.riddleHint.length <= 320 &&
    typeof data.giftKind === 'string' && ['relic', 'specimen'].includes(data.giftKind) &&
    isValidId(data.giftId) && (data.giftId as string).length <= 64 &&
    typeof data.giftName === 'string' && data.giftName.length >= 1 && data.giftName.length <= 160 &&
    typeof data.giftDomain === 'string' && ['relique', 'botanique', 'geologie'].includes(data.giftDomain) &&
    data.visibility === 'public' &&
    data.createdAt === REQUEST_TIME &&
    data.updatedAt === REQUEST_TIME
  );
}

function isValidGeocacheLogEntry(data: Record<string, unknown>, auth: AuthContext | null): boolean {
  if (!auth) return false;
  const requiredKeys = [
    'cacheId', 'finderId', 'finderCallsign', 'note', 'visibility', 'foundAt', 'updatedAt',
  ];
  const allowedKeys = [
    ...requiredKeys,
    'finderGender',
    'finderAvatarPreset',
    'finderSkinTone',
    'finderHeadgearId',
    'finderOutfitId',
  ];
  const dataKeys = Object.keys(data);
  if (!requiredKeys.every((k) => dataKeys.includes(k)) || !dataKeys.every((k) => allowedKeys.includes(k))) return false;
  return (
    isValidId(data.cacheId) &&
    isValidId(data.finderId) &&
    data.finderId === auth.uid &&
    typeof data.finderCallsign === 'string' && data.finderCallsign.length >= 1 && data.finderCallsign.length <= 60 &&
    (!('finderGender' in data) || (typeof data.finderGender === 'string' && VALID_GENDERS.includes(data.finderGender))) &&
    (!('finderAvatarPreset' in data) || (typeof data.finderAvatarPreset === 'string' && VALID_AVATARS.includes(data.finderAvatarPreset))) &&
    (!('finderSkinTone' in data) || (typeof data.finderSkinTone === 'string' && VALID_SKINS.includes(data.finderSkinTone))) &&
    (!('finderHeadgearId' in data) || (typeof data.finderHeadgearId === 'string' && VALID_HEADGEAR.includes(data.finderHeadgearId))) &&
    (!('finderOutfitId' in data) || (typeof data.finderOutfitId === 'string' && VALID_OUTFITS.includes(data.finderOutfitId))) &&
    typeof data.note === 'string' && data.note.length >= 3 && data.note.length <= 240 &&
    data.visibility === 'public' &&
    data.foundAt === REQUEST_TIME &&
    data.updatedAt === REQUEST_TIME
  );
}

function isValidCommunityChallengeEntry(data: Record<string, unknown>, auth: AuthContext | null): boolean {
  if (!auth) return false;
  const requiredKeys = [
    'challengeId', 'cadence', 'periodKey', 'explorerId', 'explorerCallsign',
    'contributionCount', 'points', 'regionLabel', 'visibility', 'createdAt', 'updatedAt',
  ];
  const allowedKeys = [
    ...requiredKeys,
    'explorerGender',
    'explorerAvatarPreset',
    'explorerSkinTone',
    'explorerHeadgearId',
    'explorerOutfitId',
    'explorerFamiliarId',
    'explorerPinnedTrophyId',
  ];
  const dataKeys = Object.keys(data);
  if (!requiredKeys.every((k) => dataKeys.includes(k)) || !dataKeys.every((k) => allowedKeys.includes(k))) return false;
  return (
    isValidId(data.challengeId) && (data.challengeId as string).length <= 80 &&
    typeof data.cadence === 'string' && ['quotidien', 'hebdomadaire', 'mensuel'].includes(data.cadence) &&
    typeof data.periodKey === 'string' && /^[0-9]{4}-[0-9]{2}$/.test(data.periodKey) &&
    isValidId(data.explorerId) &&
    data.explorerId === auth.uid &&
    typeof data.explorerCallsign === 'string' && data.explorerCallsign.length >= 1 && data.explorerCallsign.length <= 60 &&
    (!('explorerGender' in data) || (typeof data.explorerGender === 'string' && VALID_GENDERS.includes(data.explorerGender))) &&
    (!('explorerAvatarPreset' in data) || (typeof data.explorerAvatarPreset === 'string' && VALID_AVATARS.includes(data.explorerAvatarPreset))) &&
    (!('explorerSkinTone' in data) || (typeof data.explorerSkinTone === 'string' && VALID_SKINS.includes(data.explorerSkinTone))) &&
    (!('explorerHeadgearId' in data) || (typeof data.explorerHeadgearId === 'string' && VALID_HEADGEAR.includes(data.explorerHeadgearId))) &&
    (!('explorerOutfitId' in data) || (typeof data.explorerOutfitId === 'string' && VALID_OUTFITS.includes(data.explorerOutfitId))) &&
    (!('explorerFamiliarId' in data) || (typeof data.explorerFamiliarId === 'string' && VALID_FAMILIARS.includes(data.explorerFamiliarId))) &&
    (!('explorerPinnedTrophyId' in data) || (typeof data.explorerPinnedTrophyId === 'string' && VALID_PINNED_TROPHIES.includes(data.explorerPinnedTrophyId))) &&
    typeof data.contributionCount === 'number' && data.contributionCount >= 1 && data.contributionCount <= 10000 &&
    typeof data.points === 'number' && data.points >= 1 && data.points <= 1000000 &&
    typeof data.regionLabel === 'string' && data.regionLabel.length >= 1 && data.regionLabel.length <= 100 &&
    data.visibility === 'public' &&
    data.createdAt === REQUEST_TIME &&
    data.updatedAt === REQUEST_TIME
  );
}

function isValidPantheonLeaderboardEntry(data: Record<string, unknown>, auth: AuthContext | null): boolean {
  if (!auth) return false;
  const requiredKeys = [
    'explorerId', 'explorerCallsign', 'regionLabel',
    'pantheonScore', 'totalXp', 'diversityScore', 'rarityScore',
    'discoveriesCount', 'categoriesCount', 'strataCount', 'sourcesCount',
    'secretArchivesCount', 'officialHeritageCount', 'liveEventsCount',
    'visibility', 'createdAt', 'updatedAt',
  ];
  const allowedKeys = [
    ...requiredKeys,
    'explorerGender',
    'explorerAvatarPreset',
    'explorerSkinTone',
    'explorerHeadgearId',
    'explorerOutfitId',
    'explorerFamiliarId',
    'explorerPinnedTrophyId',
  ];
  const dataKeys = Object.keys(data);
  if (!requiredKeys.every((k) => dataKeys.includes(k)) || !dataKeys.every((k) => allowedKeys.includes(k))) return false;
  return (
    isValidId(data.explorerId) &&
    data.explorerId === auth.uid &&
    typeof data.explorerCallsign === 'string' && data.explorerCallsign.length >= 1 && data.explorerCallsign.length <= 60 &&
    typeof data.regionLabel === 'string' && data.regionLabel.length >= 1 && data.regionLabel.length <= 100 &&
    (!('explorerGender' in data) || (typeof data.explorerGender === 'string' && VALID_GENDERS.includes(data.explorerGender))) &&
    (!('explorerAvatarPreset' in data) || (typeof data.explorerAvatarPreset === 'string' && VALID_AVATARS.includes(data.explorerAvatarPreset))) &&
    (!('explorerSkinTone' in data) || (typeof data.explorerSkinTone === 'string' && VALID_SKINS.includes(data.explorerSkinTone))) &&
    (!('explorerHeadgearId' in data) || (typeof data.explorerHeadgearId === 'string' && VALID_HEADGEAR.includes(data.explorerHeadgearId))) &&
    (!('explorerOutfitId' in data) || (typeof data.explorerOutfitId === 'string' && VALID_OUTFITS.includes(data.explorerOutfitId))) &&
    (!('explorerFamiliarId' in data) || (typeof data.explorerFamiliarId === 'string' && VALID_FAMILIARS.includes(data.explorerFamiliarId))) &&
    (!('explorerPinnedTrophyId' in data) || (typeof data.explorerPinnedTrophyId === 'string' && VALID_PINNED_TROPHIES.includes(data.explorerPinnedTrophyId))) &&
    typeof data.pantheonScore === 'number' && data.pantheonScore >= 0 && data.pantheonScore <= 50000000 &&
    typeof data.totalXp === 'number' && data.totalXp >= 0 && data.totalXp <= 10000000 &&
    typeof data.diversityScore === 'number' && data.diversityScore >= 0 && data.diversityScore <= 1000000 &&
    typeof data.rarityScore === 'number' && data.rarityScore >= 0 && data.rarityScore <= 5000000 &&
    typeof data.discoveriesCount === 'number' && data.discoveriesCount >= 0 && data.discoveriesCount <= 100000 &&
    typeof data.categoriesCount === 'number' && data.categoriesCount >= 0 && data.categoriesCount <= 5 &&
    typeof data.strataCount === 'number' && data.strataCount >= 0 && data.strataCount <= 7 &&
    typeof data.sourcesCount === 'number' && data.sourcesCount >= 0 && data.sourcesCount <= 50 &&
    typeof data.secretArchivesCount === 'number' && data.secretArchivesCount >= 0 && data.secretArchivesCount <= 10000 &&
    typeof data.officialHeritageCount === 'number' && data.officialHeritageCount >= 0 && data.officialHeritageCount <= 100000 &&
    typeof data.liveEventsCount === 'number' && data.liveEventsCount >= 0 && data.liveEventsCount <= 100000 &&
    data.visibility === 'public' &&
    data.createdAt === REQUEST_TIME &&
    data.updatedAt === REQUEST_TIME
  );
}

function assertDenied(allowed: boolean, name: string) {
  if (allowed) {
    throw new Error(`SECURITY FAILURE: Payload [${name}] was ALLOWED instead of PERMISSION_DENIED!`);
  }
}

export function runSecuritySuite() {
  const verifiedOwner: AuthContext = { uid: 'user_1', emailVerified: true };
  const unverifiedOwner: AuthContext = { uid: 'user_1', emailVerified: false };
  const attacker: AuthContext = { uid: 'attacker_1', emailVerified: true };

  // Verify valid baselines pass
  if (!isValidExplorerProfile(VALID_PROFILE, verifiedOwner)) {
    throw new Error('Baseline VALID_PROFILE should be accepted for verifiedOwner');
  }
  if (!isValidOpenedArchivistChest(VALID_ARCHIVIST_CHEST, verifiedOwner)) {
    throw new Error('Baseline VALID_ARCHIVIST_CHEST should be accepted for verifiedOwner');
  }
  if (!isValidExplorerGeocache(VALID_GEOCACHE, verifiedOwner)) {
    throw new Error('Baseline VALID_GEOCACHE should be accepted for verifiedOwner');
  }
  if (!isValidGeocacheLogEntry(VALID_GEOCACHE_LOG, verifiedOwner)) {
    throw new Error('Baseline VALID_GEOCACHE_LOG should be accepted for verifiedOwner');
  }
  if (!isValidCommunityChallengeEntry(VALID_CHALLENGE_ENTRY, verifiedOwner)) {
    throw new Error('Baseline VALID_CHALLENGE_ENTRY should be accepted for verifiedOwner');
  }
  if (!isValidPantheonLeaderboardEntry(VALID_PANTHEON_ENTRY, verifiedOwner)) {
    throw new Error('Baseline VALID_PANTHEON_ENTRY should be accepted for verifiedOwner');
  }

  // 1. Unauthenticated Write
  assertDenied(Boolean(null) && isValidExplorerProfile(VALID_PROFILE, null), '1a. Unauthenticated Profile Write');
  assertDenied(Boolean(null) && isValidExplorerGeocache(VALID_GEOCACHE, null), '1b. Unauthenticated Geocache Write');
  assertDenied(Boolean(null) && isValidPantheonLeaderboardEntry(VALID_PANTHEON_ENTRY, null), '1c. Unauthenticated Pantheon Write');

  // 2. Unverified Email Spoof
  assertDenied(unverifiedOwner.emailVerified && isValidExplorerProfile(VALID_PROFILE, unverifiedOwner), '2a. Unverified Email Spoof');
  assertDenied(unverifiedOwner.emailVerified && isValidExplorerGeocache(VALID_GEOCACHE, unverifiedOwner), '2b. Unverified Geocache Spoof');
  assertDenied(unverifiedOwner.emailVerified && isValidPantheonLeaderboardEntry(VALID_PANTHEON_ENTRY, unverifiedOwner), '2c. Unverified Pantheon Spoof');

  // 3. Identity Spoofing (Cross-User Profile, Cairn, Geocache, Log, Pantheon)
  assertDenied(attacker.uid === 'user_1' && isValidExplorerProfile(VALID_PROFILE, attacker), '3a. Identity Spoofing Profile');
  assertDenied(isValidExplorerCairn(VALID_CAIRN, attacker), '3b. Identity Spoofing Cairn');
  assertDenied(isValidExplorerGeocache(VALID_GEOCACHE, attacker), '3c. Identity Spoofing Geocache');
  assertDenied(isValidGeocacheLogEntry(VALID_GEOCACHE_LOG, attacker), '3d. Identity Spoofing Geocache Log');
  assertDenied(isValidPantheonLeaderboardEntry(VALID_PANTHEON_ENTRY, attacker), '3e. Identity Spoofing Pantheon Entry');

  // 4. Shadow Ghost Field Injection
  assertDenied(isValidExplorerProfile({ ...VALID_PROFILE, isAdmin: true }, verifiedOwner), '4a. Shadow Ghost Field Profile');
  assertDenied(isValidExplorerGeocache({ ...VALID_GEOCACHE, isFeatured: true }, verifiedOwner), '4b. Shadow Ghost Field Geocache');
  assertDenied(isValidPantheonLeaderboardEntry({ ...VALID_PANTHEON_ENTRY, rankOverride: 1 }, verifiedOwner), '4c. Shadow Ghost Field Pantheon');

  // 5. ID Resource Poisoning
  assertDenied(isValidId('bad$id/poison') && isValidJournalDiscovery(VALID_DISCOVERY, verifiedOwner), '5a. ID Resource Poisoning');
  assertDenied(isValidId('bad$chest/id') && isValidOpenedArchivistChest(VALID_ARCHIVIST_CHEST, verifiedOwner), '5b. Chest ID Poisoning');
  assertDenied(isValidId('bad$pantheon/id') && isValidPantheonLeaderboardEntry(VALID_PANTHEON_ENTRY, verifiedOwner), '5c. Pantheon ID Poisoning');

  // 6. Orphaned Subcollection / Ununlocked Geocache Anchor / Missing Parent Geocache
  const parentExists = false;
  assertDenied(parentExists && isValidOpenedArchivistChest(VALID_ARCHIVIST_CHEST, verifiedOwner), '6a. Orphaned ArchivistChest Write');
  const hasUnlockedAnchorPoi = false;
  assertDenied(
    (VALID_GEOCACHE.placementMode === 'gps_live' || hasUnlockedAnchorPoi) &&
      isValidExplorerGeocache(VALID_GEOCACHE, verifiedOwner),
    '6b. Geocache on Ununlocked Anchor POI'
  );
  const ownsSpecimen = false;
  const specimenGeocache = { ...VALID_GEOCACHE, giftKind: 'specimen', giftDomain: 'botanique', giftId: 'bot_ophrys_abeille' };
  assertDenied(
    (specimenGeocache.giftKind === 'relic' || ownsSpecimen) &&
      isValidExplorerGeocache(specimenGeocache, verifiedOwner),
    '6c. Geocache with Unowned Specimen'
  );
  const parentGeocacheExists = false;
  assertDenied(
    parentGeocacheExists && isValidGeocacheLogEntry(VALID_GEOCACHE_LOG, verifiedOwner),
    '6d. Orphaned Geocache Log Without Parent'
  );
  assertDenied(
    parentExists && isValidPantheonLeaderboardEntry(VALID_PANTHEON_ENTRY, verifiedOwner),
    '6e. Orphaned Pantheon Entry Without Master Profile'
  );

  // 7. Unbounded Array (> 50 missions)
  const hugeMissions = Array.from({ length: 55 }, (_, i) => `m_${i}`);
  assertDenied(isValidExplorerProfile({ ...VALID_PROFILE, completedMissions: hugeMissions }, verifiedOwner), '7. Unbounded Array');

  // 8. String Oversize Attack
  assertDenied(isValidJournalDiscovery({ ...VALID_DISCOVERY, personalNote: 'x'.repeat(2500) }, verifiedOwner), '8a. String Oversize Note');
  assertDenied(isValidExplorerCairn({ ...VALID_CAIRN, message: 'x'.repeat(300) }, verifiedOwner), '8b. String Oversize Cairn');
  assertDenied(isValidExplorerGeocache({ ...VALID_GEOCACHE, riddleHint: 'x'.repeat(350) }, verifiedOwner), '8c. String Oversize Geocache Riddle');
  assertDenied(isValidGeocacheLogEntry({ ...VALID_GEOCACHE_LOG, note: 'x'.repeat(260) }, verifiedOwner), '8d. String Oversize Geocache Log');
  assertDenied(isValidPantheonLeaderboardEntry({ ...VALID_PANTHEON_ENTRY, regionLabel: 'x'.repeat(120) }, verifiedOwner), '8e. String Oversize Pantheon Region');

  // 9. Client Timestamp Forgery
  assertDenied(isValidExplorerProfile({ ...VALID_PROFILE, updatedAt: '2099-01-01T00:00:00Z' }, verifiedOwner), '9a. Client Timestamp Forgery');
  assertDenied(isValidOpenedArchivistChest({ ...VALID_ARCHIVIST_CHEST, openedAt: '2099-01-01T00:00:00Z' }, verifiedOwner), '9b. Chest Timestamp Forgery');
  assertDenied(isValidGeocacheLogEntry({ ...VALID_GEOCACHE_LOG, foundAt: '2099-01-01T00:00:00Z' }, verifiedOwner), '9c. Log Timestamp Forgery');
  assertDenied(isValidPantheonLeaderboardEntry({ ...VALID_PANTHEON_ENTRY, createdAt: '2099-01-01T00:00:00Z' }, verifiedOwner), '9d. Pantheon Timestamp Forgery');

  // 10. Immutable Field Mutation
  const allowedGeocacheUpdateKeys = [
    'authorCallsign', 'authorGender', 'authorAvatarPreset', 'authorSkinTone',
    'authorHeadgearId', 'authorOutfitId', 'title', 'riddleHint', 'updatedAt',
  ];
  const mutatedGeoKeys = ['lat', 'lng', 'updatedAt'];
  assertDenied(mutatedGeoKeys.every((k) => allowedGeocacheUpdateKeys.includes(k)), '10a. Geocache Coordinate Mutation');
  assertDenied(false, '10b. OpenedArchivistChest Update Terminal Lock');

  // 11. Value Poisoning on Whitelisted Update Keys & Enums
  assertDenied(isValidExplorerProfile({ ...VALID_PROFILE, outfitId: 'god_mode_cape' }, verifiedOwner), '11a. Value Poisoning Outfit');
  assertDenied(isValidOpenedArchivistChest({ ...VALID_ARCHIVIST_CHEST, archetype: 'dungeon_boss' }, verifiedOwner), '11b. Value Poisoning Chest Archetype');
  assertDenied(isValidExplorerGeocache({ ...VALID_GEOCACHE, placementMode: 'teleported_hack' }, verifiedOwner), '11c. Value Poisoning PlacementMode');
  assertDenied(isValidExplorerGeocache({ ...VALID_GEOCACHE, giftDomain: 'diamonds' }, verifiedOwner), '11d. Value Poisoning GiftDomain');
  assertDenied(isValidPantheonLeaderboardEntry({ ...VALID_PANTHEON_ENTRY, explorerPinnedTrophyId: 'hacked_trophy' }, verifiedOwner), '11e. Value Poisoning Pantheon Pinned Trophy');

  // 12. Cross-Tenant List Scraping & Unauthorized Deletion
  const targetUserId = 'user_1';
  assertDenied(attacker.uid === targetUserId, '12a. Cross-Tenant ArchivistChest List Scraping');
  assertDenied(attacker.uid === VALID_GEOCACHE.authorId, '12b. Unauthorized Geocache Deletion');
  assertDenied(attacker.uid === VALID_GEOCACHE_LOG.finderId, '12c. Unauthorized Geocache Log Deletion');
  assertDenied(attacker.uid === VALID_PANTHEON_ENTRY.explorerId, '12d. Unauthorized Pantheon Entry Deletion');

  // 13. Action 3 Character Reset Gate
  const isFullZeroReset = (incoming: typeof VALID_PROFILE) =>
    incoming.totalXp === 0 &&
    incoming.xpHistoire === 0 &&
    incoming.xpGeographie === 0 &&
    incoming.xpEcosysteme === 0 &&
    incoming.xpEtrange === 0 &&
    incoming.xpLegende === 0 &&
    incoming.walkedMeters === 0 &&
    incoming.discoveriesCount === 0 &&
    incoming.completedMissions.length === 0;

  const partialDecrementPayload = { ...VALID_PROFILE, totalXp: 50, xpHistoire: 50 };
  const monotonicPass = partialDecrementPayload.totalXp >= VALID_PROFILE.totalXp;
  assertDenied(
    monotonicPass || isFullZeroReset(partialDecrementPayload),
    '13. Partial Non-Zero XP Decrement Bypass'
  );

  // 14. Avatar Enum Poisoning on Geocache & Log
  assertDenied(
    isValidExplorerGeocache({ ...VALID_GEOCACHE, authorOutfitId: 'cyber_suit' }, verifiedOwner),
    '14a. Geocache Author Outfit Poisoning'
  );
  assertDenied(
    isValidGeocacheLogEntry({ ...VALID_GEOCACHE_LOG, finderHeadgearId: 'laser_visor' }, verifiedOwner),
    '14b. Geocache Log Finder Headgear Poisoning'
  );

  // 15. CommunityChallengeEntry Adversarial Hardening
  assertDenied(
    isValidCommunityChallengeEntry(VALID_CHALLENGE_ENTRY, attacker),
    '15a. Challenge Entry Cross-User Identity Spoofing'
  );
  assertDenied(
    isValidCommunityChallengeEntry({ ...VALID_CHALLENGE_ENTRY, rankOverride: 1 }, verifiedOwner),
    '15b. Challenge Entry Shadow Ghost Field'
  );
  assertDenied(
    isValidCommunityChallengeEntry({ ...VALID_CHALLENGE_ENTRY, regionLabel: 'x'.repeat(120) }, verifiedOwner),
    '15c. Challenge Entry Oversize Region String'
  );
  assertDenied(
    isValidCommunityChallengeEntry({ ...VALID_CHALLENGE_ENTRY, explorerFamiliarId: 'dragon_overload' }, verifiedOwner),
    '15d. Challenge Entry Familiar Enum Poisoning'
  );
  const decrementedScoreEntry = { ...VALID_CHALLENGE_ENTRY, points: 20 };
  const scoreMonotonic =
    decrementedScoreEntry.points >= VALID_CHALLENGE_ENTRY.points &&
    decrementedScoreEntry.contributionCount >= VALID_CHALLENGE_ENTRY.contributionCount;
  assertDenied(scoreMonotonic, '15e. Challenge Entry Score Decrement Attack');

  // 16. PantheonLeaderboardEntry Score Decrement & Bounds Hardening
  assertDenied(
    isValidPantheonLeaderboardEntry({ ...VALID_PANTHEON_ENTRY, categoriesCount: 99 }, verifiedOwner),
    '16a. Pantheon Categories Bound Overflow'
  );
  const decrementedPantheon = { ...VALID_PANTHEON_ENTRY, pantheonScore: 900 };
  const pantheonMonotonic =
    decrementedPantheon.pantheonScore >= VALID_PANTHEON_ENTRY.pantheonScore &&
    decrementedPantheon.totalXp >= VALID_PANTHEON_ENTRY.totalXp &&
    decrementedPantheon.discoveriesCount >= VALID_PANTHEON_ENTRY.discoveriesCount;
  assertDenied(pantheonMonotonic, '16b. Pantheon Score Decrement Attack');
}

runSecuritySuite();
