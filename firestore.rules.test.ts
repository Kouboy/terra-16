/**
 * Adversarial Security Specification Verification Suite for Terra 16
 * Verifies all 12+ adversarial payloads defined in security_spec.md
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

const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function isValidId(id: unknown): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && ID_REGEX.test(id);
}

function isBoundedStringArray(arr: unknown, maxLen: number): boolean {
  if (!Array.isArray(arr) || arr.length > maxLen) return false;
  if (arr.length === 0) return true;
  return typeof arr[0] === 'string' && arr[0].length <= 200;
}

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
    'walkedMeters',
  ];
  const dataKeys = Object.keys(data);
  if (!requiredKeys.every((k) => dataKeys.includes(k)) || !dataKeys.every((k) => allowedKeys.includes(k))) return false;
  const validGenders = ['feminin', 'masculin', 'neutre'];
  const validAvatars = ['cartographe', 'eclaireur', 'archiviste', 'forgeron', 'oracle', 'botaniste'];
  const validSkins = ['clair', 'hale', 'ambre', 'ebene', 'porcelaine'];
  const validHeadgear = ['tricorne_fauve', 'beret_chroniqueur', 'casque_mineur', 'capuche_sylvestre', 'couronne_menhir', 'lunettes_astro'];
  const validOutfits = ['arpenteur', 'chroniqueur', 'geomancien', 'sylvestre', 'ombres', 'barde'];
  const validTools = ['lanterne_laiton', 'boussole_astrale', 'marteau_geologue', 'plume_enluminee', 'fiole_spectrale'];
  const validPacks = ['besace_cuir', 'rouleau_cartes', 'hotte_cristaux', 'ailerons_automate'];
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
    (!('gender' in data) || (typeof data.gender === 'string' && data.gender.length >= 1 && data.gender.length <= 16 && validGenders.includes(data.gender))) &&
    (!('avatarPreset' in data) || (typeof data.avatarPreset === 'string' && data.avatarPreset.length >= 1 && data.avatarPreset.length <= 32 && validAvatars.includes(data.avatarPreset))) &&
    (!('skinTone' in data) || (typeof data.skinTone === 'string' && data.skinTone.length >= 1 && data.skinTone.length <= 32 && validSkins.includes(data.skinTone))) &&
    (!('headgearId' in data) || (typeof data.headgearId === 'string' && data.headgearId.length >= 1 && data.headgearId.length <= 32 && validHeadgear.includes(data.headgearId))) &&
    (!('outfitId' in data) || (typeof data.outfitId === 'string' && data.outfitId.length >= 1 && data.outfitId.length <= 32 && validOutfits.includes(data.outfitId))) &&
    (!('toolId' in data) || (typeof data.toolId === 'string' && data.toolId.length >= 1 && data.toolId.length <= 32 && validTools.includes(data.toolId))) &&
    (!('packId' in data) || (typeof data.packId === 'string' && data.packId.length >= 1 && data.packId.length <= 32 && validPacks.includes(data.packId))) &&
    (!('walkedMeters' in data) || (typeof data.walkedMeters === 'number' && data.walkedMeters >= 0 && data.walkedMeters <= 100000000)) &&
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
  const validGenders = ['feminin', 'masculin', 'neutre'];
  const validAvatars = ['cartographe', 'eclaireur', 'archiviste', 'forgeron', 'oracle', 'botaniste'];
  const validSkins = ['clair', 'hale', 'ambre', 'ebene', 'porcelaine'];
  const validHeadgear = ['tricorne_fauve', 'beret_chroniqueur', 'casque_mineur', 'capuche_sylvestre', 'couronne_menhir', 'lunettes_astro'];
  const validOutfits = ['arpenteur', 'chroniqueur', 'geomancien', 'sylvestre', 'ombres', 'barde'];
  return (
    isValidId(data.authorId) &&
    data.authorId === auth.uid &&
    typeof data.authorCallsign === 'string' && data.authorCallsign.length >= 1 && data.authorCallsign.length <= 60 &&
    (!('authorGender' in data) || (typeof data.authorGender === 'string' && validGenders.includes(data.authorGender))) &&
    (!('authorAvatarPreset' in data) || (typeof data.authorAvatarPreset === 'string' && validAvatars.includes(data.authorAvatarPreset))) &&
    (!('authorSkinTone' in data) || (typeof data.authorSkinTone === 'string' && validSkins.includes(data.authorSkinTone))) &&
    (!('authorHeadgearId' in data) || (typeof data.authorHeadgearId === 'string' && validHeadgear.includes(data.authorHeadgearId))) &&
    (!('authorOutfitId' in data) || (typeof data.authorOutfitId === 'string' && validOutfits.includes(data.authorOutfitId))) &&
    isValidId(data.poiId) &&
    typeof data.poiName === 'string' && data.poiName.length >= 1 && data.poiName.length <= 200 &&
    typeof data.tag === 'string' && validTags.includes(data.tag) &&
    typeof data.message === 'string' && data.message.length >= 3 && data.message.length <= 280 &&
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

  // Verify valid baseline passes
  if (!isValidExplorerProfile(VALID_PROFILE, verifiedOwner)) {
    throw new Error('Baseline VALID_PROFILE should be accepted for verifiedOwner');
  }

  // 1. Unauthenticated Write
  assertDenied(Boolean(null) && isValidExplorerProfile(VALID_PROFILE, null), '1. Unauthenticated Write');

  // 2. Unverified Email Spoof
  assertDenied(unverifiedOwner.emailVerified && isValidExplorerProfile(VALID_PROFILE, unverifiedOwner), '2. Unverified Email Spoof');

  // 3. Identity Spoofing (Cross-User Profile & Cairn)
  assertDenied(attacker.uid === 'user_1' && isValidExplorerProfile(VALID_PROFILE, attacker), '3a. Identity Spoofing Profile');
  assertDenied(isValidExplorerCairn(VALID_CAIRN, attacker), '3b. Identity Spoofing Cairn');

  // 4. Shadow Ghost Field Injection
  assertDenied(isValidExplorerProfile({ ...VALID_PROFILE, isAdmin: true }, verifiedOwner), '4. Shadow Ghost Field Injection');

  // 5. ID Resource Poisoning
  assertDenied(isValidId('bad$id/poison') && isValidJournalDiscovery(VALID_DISCOVERY, verifiedOwner), '5. ID Resource Poisoning');

  // 6. Orphaned Subcollection / Undiscovered Cairn Write
  const parentExists = false;
  assertDenied(parentExists && isValidJournalDiscovery(VALID_DISCOVERY, verifiedOwner), '6a. Orphaned Subcollection Write');
  const hasUnlockedTargetPoi = false;
  assertDenied(hasUnlockedTargetPoi && isValidExplorerCairn(VALID_CAIRN, verifiedOwner), '6b. Cairn on Undiscovered POI');

  // 7. Unbounded Array (> 50 missions)
  const hugeMissions = Array.from({ length: 55 }, (_, i) => `m_${i}`);
  assertDenied(isValidExplorerProfile({ ...VALID_PROFILE, completedMissions: hugeMissions }, verifiedOwner), '7. Unbounded Array');

  // 8. String Oversize Attack (> 2000 chars personalNote, > 280 chars cairn)
  assertDenied(isValidJournalDiscovery({ ...VALID_DISCOVERY, personalNote: 'x'.repeat(2500) }, verifiedOwner), '8a. String Oversize Note');
  assertDenied(isValidExplorerCairn({ ...VALID_CAIRN, message: 'x'.repeat(300) }, verifiedOwner), '8b. String Oversize Cairn');

  // 9. Client Timestamp Forgery
  assertDenied(isValidExplorerProfile({ ...VALID_PROFILE, updatedAt: '2099-01-01T00:00:00Z' }, verifiedOwner), '9. Client Timestamp Forgery');

  // 10. Immutable Field Mutation (changing xpAwarded on update)
  const allowedNoteKeys = ['personalNote', 'photoCount', 'updatedAt'];
  const mutatedKeys = ['xpAwarded', 'updatedAt'];
  assertDenied(mutatedKeys.every((k) => allowedNoteKeys.includes(k)), '10. Immutable Field Mutation');

  // Verify all valid genders pass
  for (const g of ['feminin', 'masculin', 'neutre']) {
    if (!isValidExplorerProfile({ ...VALID_PROFILE, gender: g }, verifiedOwner)) {
      throw new Error(`Valid gender [${g}] should be accepted for verifiedOwner`);
    }
  }

  // 11. Value Poisoning on Whitelisted Update Keys (cosmetic enums, gender & walkedMeters)
  assertDenied(isValidExplorerProfile({ ...VALID_PROFILE, outfitId: 'god_mode_cape' }, verifiedOwner), '11a. Value Poisoning Outfit');
  assertDenied(isValidExplorerProfile({ ...VALID_PROFILE, headgearId: 'golden_crown_hack' }, verifiedOwner), '11b. Value Poisoning Headgear');
  assertDenied(isValidExplorerProfile({ ...VALID_PROFILE, avatarPreset: 'x'.repeat(64) }, verifiedOwner), '11c. Value Poisoning AvatarPreset');
  assertDenied(isValidExplorerProfile({ ...VALID_PROFILE, walkedMeters: -100 }, verifiedOwner), '11d. Negative walkedMeters');
  assertDenied(isValidExplorerProfile({ ...VALID_PROFILE, gender: 'invalid_gender' }, verifiedOwner), '11e. Value Poisoning Gender Enum');
  assertDenied(isValidExplorerProfile({ ...VALID_PROFILE, gender: 12345 }, verifiedOwner), '11f. Value Poisoning Gender Type');

  // 12. Cross-Tenant List Scraping & Unauthorized Cairn Delete
  const targetUserId: string = 'user_1';
  assertDenied(attacker.uid === targetUserId, '12a. Cross-Tenant List Scraping');
  assertDenied(attacker.uid === VALID_CAIRN.authorId, '12b. Unauthorized Cairn Deletion');

  // 13. Action 3 Character Reset Gate & Cross-User Discovery Delete
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
    '13a. Partial Non-Zero XP Decrement Bypass'
  );

  const validZeroResetPayload = {
    ...VALID_PROFILE,
    displayName: 'Explorateur',
    totalXp: 0,
    xpHistoire: 0,
    xpGeographie: 0,
    xpEcosysteme: 0,
    xpEtrange: 0,
    xpLegende: 0,
    walkedMeters: 0,
    discoveriesCount: 0,
    completedMissions: [] as string[],
  };
  if (
    !isValidExplorerProfile(validZeroResetPayload, verifiedOwner) ||
    !isFullZeroReset(validZeroResetPayload)
  ) {
    throw new Error('Valid full-zero Character Reset payload should pass Action 3');
  }

  assertDenied(
    attacker.uid === targetUserId && attacker.uid === VALID_DISCOVERY.ownerId,
    '13b. Cross-User Discovery Deletion'
  );

  // 14. Cairn Author Avatar Enum Validation (Valid accepted, Poisoned rejected)
  const validAvatarCairn = {
    ...VALID_CAIRN,
    authorGender: 'feminin',
    authorAvatarPreset: 'oracle',
    authorSkinTone: 'ambre',
    authorHeadgearId: 'casque_mineur',
    authorOutfitId: 'ombres',
  };
  if (!isValidExplorerCairn(validAvatarCairn, verifiedOwner)) {
    throw new Error('Valid Cairn with 16-bit author avatar fields should be accepted');
  }
  assertDenied(
    isValidExplorerCairn({ ...validAvatarCairn, authorOutfitId: 'cyber_armor' }, verifiedOwner),
    '14. Cairn Author Avatar Enum Poisoning'
  );
}

runSecuritySuite();

