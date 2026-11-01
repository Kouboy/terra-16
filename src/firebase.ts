import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type {
  CairnTag,
  CollectedSpecimen,
  ExplorationCategory,
  ExplorerAppearance,
  ExplorerAvatarPreset,
  ExplorerCairn,
  ExplorerGender,
  ExplorerHeadgearId,
  ExplorerOutfitId,
  ExplorerPackId,
  ExplorerProgress,
  ExplorerSkinTone,
  ExplorerToolId,
  LithologyAffinity,
  SpecimenDomain,
  UnlockedEntry,
} from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: Array<{
      providerId?: string | null;
      email?: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
const VALID_GENDERS: ExplorerGender[] = ['feminin', 'masculin', 'neutre'];
const VALID_AVATARS: ExplorerAvatarPreset[] = [
  'cartographe',
  'eclaireur',
  'archiviste',
  'forgeron',
  'oracle',
  'botaniste',
];
const VALID_SKINS: ExplorerSkinTone[] = ['clair', 'hale', 'ambre', 'ebene', 'porcelaine'];
const VALID_HEADGEAR: ExplorerHeadgearId[] = [
  'tricorne_fauve',
  'beret_chroniqueur',
  'casque_mineur',
  'capuche_sylvestre',
  'couronne_menhir',
  'lunettes_astro',
];
const VALID_OUTFITS: ExplorerOutfitId[] = [
  'arpenteur',
  'chroniqueur',
  'geomancien',
  'sylvestre',
  'ombres',
  'barde',
];
const VALID_TOOLS: ExplorerToolId[] = [
  'lanterne_laiton',
  'boussole_astrale',
  'marteau_geologue',
  'plume_enluminee',
  'fiole_spectrale',
];
const VALID_PACKS: ExplorerPackId[] = [
  'besace_cuir',
  'rouleau_cartes',
  'hotte_cristaux',
  'ailerons_automate',
];
const VALID_CAIRN_TAGS: CairnTag[] = [
  'architecture',
  'acces',
  'point_de_vue',
  'conseil_heure',
  'secret',
];

export function sanitizeFirestoreId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned.length >= 1 && ID_REGEX.test(cleaned) ? cleaned : 'id_fallback';
}

function sanitizeGender(raw?: string): ExplorerGender {
  return VALID_GENDERS.includes(raw as ExplorerGender) ? (raw as ExplorerGender) : 'masculin';
}

function sanitizeAvatarPreset(raw?: string): ExplorerAvatarPreset {
  return VALID_AVATARS.includes(raw as ExplorerAvatarPreset)
    ? (raw as ExplorerAvatarPreset)
    : 'cartographe';
}

function sanitizeSkinTone(raw?: string): ExplorerSkinTone {
  return VALID_SKINS.includes(raw as ExplorerSkinTone) ? (raw as ExplorerSkinTone) : 'hale';
}

function sanitizeHeadgear(raw?: string): ExplorerHeadgearId {
  return VALID_HEADGEAR.includes(raw as ExplorerHeadgearId)
    ? (raw as ExplorerHeadgearId)
    : 'tricorne_fauve';
}

function sanitizeOutfit(raw?: string): ExplorerOutfitId {
  return VALID_OUTFITS.includes(raw as ExplorerOutfitId) ? (raw as ExplorerOutfitId) : 'arpenteur';
}

function sanitizeTool(raw?: string): ExplorerToolId {
  return VALID_TOOLS.includes(raw as ExplorerToolId)
    ? (raw as ExplorerToolId)
    : 'lanterne_laiton';
}

function sanitizePack(raw?: string): ExplorerPackId {
  return VALID_PACKS.includes(raw as ExplorerPackId) ? (raw as ExplorerPackId) : 'besace_cuir';
}

function clampStr(val: string, minLen: number, maxLen: number, fallback = 'Inconnu'): string {
  const trimmed = (val || '').slice(0, maxLen);
  if (trimmed.length < minLen) return fallback.slice(0, maxLen);
  return trimmed;
}

function clampNum(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.min(max, Math.max(min, val));
}

function sanitizeStringArray(arr: string[], maxItems: number): string[] {
  return (arr || [])
    .filter((x) => typeof x === 'string')
    .slice(0, maxItems)
    .map((s) => s.slice(0, 200));
}

export async function signInExplorerWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function signOutExplorer(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function ensureExplorerProfileInCloud(
  user: User,
  localProgress: ExplorerProgress
): Promise<void> {
  const uid = sanitizeFirestoreId(user.uid);
  const profilePath = `explorers/${uid}`;
  const profileRef = doc(db, 'explorers', uid);

  let snap;
  try {
    snap = await getDoc(profileRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, profilePath);
  }

  const fallbackName = clampStr(
    user.displayName || localProgress.displayName || 'Explorateur',
    1,
    60,
    'Explorateur'
  );

  if (!snap.exists()) {
    try {
      await setDoc(profileRef, {
        ownerId: uid,
        displayName: fallbackName,
        totalXp: clampNum(Math.round(localProgress.totalXp), 0, 10000000),
        xpHistoire: clampNum(Math.round(localProgress.xpHistoire), 0, 10000000),
        xpGeographie: clampNum(Math.round(localProgress.xpGeographie), 0, 10000000),
        xpEcosysteme: clampNum(Math.round(localProgress.xpEcosysteme), 0, 10000000),
        xpEtrange: clampNum(Math.round(localProgress.xpEtrange), 0, 10000000),
        xpLegende: clampNum(Math.round(localProgress.xpLegende || 0), 0, 10000000),
        gender: sanitizeGender(localProgress.gender),
        avatarPreset: sanitizeAvatarPreset(localProgress.avatarPreset),
        skinTone: sanitizeSkinTone(localProgress.skinTone),
        headgearId: sanitizeHeadgear(localProgress.headgearId),
        outfitId: sanitizeOutfit(localProgress.outfitId),
        toolId: sanitizeTool(localProgress.toolId),
        packId: sanitizePack(localProgress.packId),
        walkedMeters: clampNum(Math.round(localProgress.walkedMeters || 0), 0, 100000000),
        discoveriesCount: clampNum(Math.round(localProgress.discoveriesCount), 0, 100000),
        completedMissions: sanitizeStringArray(localProgress.completedMissions, 50),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, profilePath);
    }
  } else {
    const cloud = snap.data();
    const mergedTotalXp = Math.max(Number(cloud.totalXp || 0), Math.round(localProgress.totalXp));
    const mergedDiscoveriesCount = Math.max(
      Number(cloud.discoveriesCount || 0),
      Math.round(localProgress.discoveriesCount)
    );
    const mergedWalkedMeters = Math.max(
      Number(cloud.walkedMeters || 0),
      Math.round(localProgress.walkedMeters || 0)
    );
    if (
      mergedTotalXp > Number(cloud.totalXp || 0) ||
      mergedDiscoveriesCount > Number(cloud.discoveriesCount || 0) ||
      mergedWalkedMeters > Number(cloud.walkedMeters || 0)
    ) {
      const mergedMissions = Array.from(
        new Set([
          ...(Array.isArray(cloud.completedMissions) ? cloud.completedMissions : []),
          ...localProgress.completedMissions,
        ])
      );
      try {
        await updateDoc(profileRef, {
          totalXp: clampNum(mergedTotalXp, 0, 10000000),
          xpHistoire: clampNum(
            Math.max(Number(cloud.xpHistoire || 0), Math.round(localProgress.xpHistoire)),
            0,
            10000000
          ),
          xpGeographie: clampNum(
            Math.max(Number(cloud.xpGeographie || 0), Math.round(localProgress.xpGeographie)),
            0,
            10000000
          ),
          xpEcosysteme: clampNum(
            Math.max(Number(cloud.xpEcosysteme || 0), Math.round(localProgress.xpEcosysteme)),
            0,
            10000000
          ),
          xpEtrange: clampNum(
            Math.max(Number(cloud.xpEtrange || 0), Math.round(localProgress.xpEtrange)),
            0,
            10000000
          ),
          xpLegende: clampNum(
            Math.max(Number(cloud.xpLegende || 0), Math.round(localProgress.xpLegende || 0)),
            0,
            10000000
          ),
          gender: sanitizeGender(String(cloud.gender || localProgress.gender || 'masculin')),
          avatarPreset: sanitizeAvatarPreset(
            String(cloud.avatarPreset || localProgress.avatarPreset || 'cartographe')
          ),
          skinTone: sanitizeSkinTone(String(cloud.skinTone || localProgress.skinTone || 'hale')),
          headgearId: sanitizeHeadgear(
            String(cloud.headgearId || localProgress.headgearId || 'tricorne_fauve')
          ),
          outfitId: sanitizeOutfit(String(cloud.outfitId || localProgress.outfitId || 'arpenteur')),
          toolId: sanitizeTool(String(cloud.toolId || localProgress.toolId || 'lanterne_laiton')),
          packId: sanitizePack(String(cloud.packId || localProgress.packId || 'besace_cuir')),
          walkedMeters: clampNum(mergedWalkedMeters, 0, 100000000),
          discoveriesCount: clampNum(mergedDiscoveriesCount, 0, 100000),
          completedMissions: sanitizeStringArray(mergedMissions, 50),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, profilePath);
      }
    }
  }
}

export async function syncProgressToCloud(
  uidRaw: string,
  progress: ExplorerProgress
): Promise<void> {
  const uid = sanitizeFirestoreId(uidRaw);
  const profilePath = `explorers/${uid}`;
  const profileRef = doc(db, 'explorers', uid);
  try {
    await updateDoc(profileRef, {
      totalXp: clampNum(Math.round(progress.totalXp), 0, 10000000),
      xpHistoire: clampNum(Math.round(progress.xpHistoire), 0, 10000000),
      xpGeographie: clampNum(Math.round(progress.xpGeographie), 0, 10000000),
      xpEcosysteme: clampNum(Math.round(progress.xpEcosysteme), 0, 10000000),
      xpEtrange: clampNum(Math.round(progress.xpEtrange), 0, 10000000),
      xpLegende: clampNum(Math.round(progress.xpLegende || 0), 0, 10000000),
      gender: sanitizeGender(progress.gender),
      avatarPreset: sanitizeAvatarPreset(progress.avatarPreset),
      skinTone: sanitizeSkinTone(progress.skinTone),
      headgearId: sanitizeHeadgear(progress.headgearId),
      outfitId: sanitizeOutfit(progress.outfitId),
      toolId: sanitizeTool(progress.toolId),
      packId: sanitizePack(progress.packId),
      walkedMeters: clampNum(Math.round(progress.walkedMeters || 0), 0, 100000000),
      discoveriesCount: clampNum(Math.round(progress.discoveriesCount), 0, 100000),
      completedMissions: sanitizeStringArray(progress.completedMissions, 50),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, profilePath);
  }
}

export async function updateExplorerIdentityInCloud(
  uidRaw: string,
  displayName: string,
  appearance?: Partial<ExplorerAppearance>
): Promise<void> {
  const uid = sanitizeFirestoreId(uidRaw);
  const profilePath = `explorers/${uid}`;
  const profileRef = doc(db, 'explorers', uid);
  const patch: Record<string, unknown> = {
    displayName: clampStr(displayName, 1, 60, 'Explorateur'),
    updatedAt: serverTimestamp(),
  };
  if (appearance?.gender) patch.gender = sanitizeGender(appearance.gender);
  if (appearance?.avatarPreset) patch.avatarPreset = sanitizeAvatarPreset(appearance.avatarPreset);
  if (appearance?.skinTone) patch.skinTone = sanitizeSkinTone(appearance.skinTone);
  if (appearance?.headgearId) patch.headgearId = sanitizeHeadgear(appearance.headgearId);
  if (appearance?.outfitId) patch.outfitId = sanitizeOutfit(appearance.outfitId);
  if (appearance?.toolId) patch.toolId = sanitizeTool(appearance.toolId);
  if (appearance?.packId) patch.packId = sanitizePack(appearance.packId);
  try {
    await updateDoc(profileRef, patch);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, profilePath);
  }
}

async function writeDiscoveryDocToCloud(uid: string, entry: UnlockedEntry): Promise<void> {
  const poiId = sanitizeFirestoreId(entry.poiId);
  const docPath = `explorers/${uid}/discoveries/${poiId}`;
  const docRef = doc(db, 'explorers', uid, 'discoveries', poiId);

  const validCategory: ExplorationCategory = [
    'histoire',
    'geographie',
    'ecosysteme',
    'etrange',
    'legende',
  ].includes(entry.category)
    ? entry.category
    : 'histoire';

  try {
    await setDoc(docRef, {
      ownerId: uid,
      poiId,
      name: clampStr(entry.name, 1, 200, 'Lieu découvert'),
      category: validCategory,
      subType: clampStr(entry.subType, 1, 80, 'Point remarquable'),
      eraLabel: (entry.eraLabel || 'Strate locale').slice(0, 100),
      source: clampStr(entry.source, 1, 80, 'OpenStreetMap'),
      lat: clampNum(entry.lat, -90, 90),
      lng: clampNum(entry.lng, -180, 180),
      summary: clampStr(entry.summary, 1, 2500, 'Lieu débloqué sur le terrain.'),
      nearWaterway: Boolean(entry.nearWaterway),
      waterwayName: (entry.waterwayName || '').slice(0, 120),
      safetyNotice: (entry.safetyNotice || '').slice(0, 400),
      externalUrl: (entry.externalUrl || '').slice(0, 500),
      xpAwarded: clampNum(Math.round(entry.xpAwarded), 0, 5000),
      relatedPoiIds: sanitizeStringArray(entry.relatedPoiIds, 10),
      relatedPoiTitles: sanitizeStringArray(entry.relatedPoiTitles, 10),
      personalNote: (entry.personalNote || '').slice(0, 2000),
      photoCount: clampNum(Math.round(entry.photoCount), 0, 20),
      discoveredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function createDiscoveryInCloud(
  uidRaw: string,
  entry: UnlockedEntry
): Promise<void> {
  const uid = sanitizeFirestoreId(uidRaw);
  const poiId = sanitizeFirestoreId(entry.poiId);
  const docPath = `explorers/${uid}/discoveries/${poiId}`;
  const docRef = doc(db, 'explorers', uid, 'discoveries', poiId);

  let existingSnap;
  try {
    existingSnap = await getDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }
  if (existingSnap.exists()) return;

  await writeDiscoveryDocToCloud(uid, entry);
}

export async function syncMissingDiscoveriesToCloud(
  uidRaw: string,
  localEntries: UnlockedEntry[]
): Promise<void> {
  if (localEntries.length === 0) return;
  const uid = sanitizeFirestoreId(uidRaw);
  const discoveriesPath = `explorers/${uid}/discoveries`;
  const q = query(collection(db, 'explorers', uid, 'discoveries'), where('ownerId', '==', uid));

  let existingIds = new Set<string>();
  try {
    const snap = await getDocs(q);
    existingIds = new Set(snap.docs.map((d) => d.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, discoveriesPath);
  }

  const missing = localEntries.filter((e) => !existingIds.has(sanitizeFirestoreId(e.poiId)));
  if (missing.length === 0) return;

  const BATCH_SIZE = 8;
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const slice = missing.slice(i, i + BATCH_SIZE);
    await Promise.all(slice.map((entry) => writeDiscoveryDocToCloud(uid, entry)));
  }
}

export async function updateDiscoveryJournalInCloud(
  uidRaw: string,
  poiIdRaw: string,
  personalNote: string,
  photoCount: number
): Promise<void> {
  const uid = sanitizeFirestoreId(uidRaw);
  const poiId = sanitizeFirestoreId(poiIdRaw);
  const docPath = `explorers/${uid}/discoveries/${poiId}`;
  const docRef = doc(db, 'explorers', uid, 'discoveries', poiId);

  try {
    await updateDoc(docRef, {
      personalNote: (personalNote || '').slice(0, 2000),
      photoCount: clampNum(Math.round(photoCount), 0, 20),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function upsertSpecimenInCloud(
  uidRaw: string,
  specimen: CollectedSpecimen
): Promise<void> {
  const uid = sanitizeFirestoreId(uidRaw);
  const specId = sanitizeFirestoreId(specimen.specimenId).slice(0, 64);
  const docPath = `explorers/${uid}/specimens/${specId}`;
  const docRef = doc(db, 'explorers', uid, 'specimens', specId);

  const validDomains: SpecimenDomain[] = ['botanique', 'geologie'];
  const validAffinities: LithologyAffinity[] = [
    'calcaire',
    'granit',
    'schiste',
    'gres',
    'alluvions',
    'volcanique',
    'souterrain',
  ];
  const safeDomain: SpecimenDomain = validDomains.includes(specimen.domain)
    ? specimen.domain
    : 'botanique';
  const safeAffinity: LithologyAffinity = validAffinities.includes(specimen.affinity)
    ? specimen.affinity
    : 'calcaire';
  const altFields =
    specimen.altitudeMeters !== null && Number.isFinite(specimen.altitudeMeters)
      ? { altitudeMeters: clampNum(Math.round(specimen.altitudeMeters), -500, 9000) }
      : {};

  let snap;
  try {
    snap = await getDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }

  if (!snap.exists()) {
    try {
      await setDoc(docRef, {
        ownerId: uid,
        specimenId: specId,
        domain: safeDomain,
        affinity: safeAffinity,
        name: clampStr(specimen.name, 1, 160, 'Spécimen'),
        latinOrMineralName: clampStr(specimen.latinOrMineralName, 1, 160, 'Species'),
        familyLabel: clampStr(specimen.familyLabel, 1, 120, 'Herbier'),
        lithologyLabel: clampStr(specimen.lithologyLabel, 1, 160, 'Socle local'),
        bedrockPeriod: clampStr(specimen.bedrockPeriod, 1, 100, 'Ère géologique'),
        bedrockAgeMa: (specimen.bedrockAgeMa || '').slice(0, 60),
        regionLabel: clampStr(specimen.regionLabel, 1, 140, 'Contrée'),
        habitatLabel: clampStr(specimen.habitatLabel, 1, 160, 'Terrain'),
        lat: clampNum(specimen.lat, -90, 90),
        lng: clampNum(specimen.lng, -180, 180),
        ...altFields,
        isSubterranean: Boolean(specimen.isSubterranean),
        harvestCount: clampNum(Math.round(specimen.harvestCount || 1), 1, 100000),
        description: clampStr(specimen.description, 1, 1000, 'Échantillon relevé sur le terrain.'),
        firstCollectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docPath);
    }
  } else {
    const existingCount = Number(snap.data().harvestCount || 1);
    try {
      await updateDoc(docRef, {
        affinity: safeAffinity,
        lithologyLabel: clampStr(specimen.lithologyLabel, 1, 160, 'Socle local'),
        bedrockPeriod: clampStr(specimen.bedrockPeriod, 1, 100, 'Ère géologique'),
        bedrockAgeMa: (specimen.bedrockAgeMa || '').slice(0, 60),
        regionLabel: clampStr(specimen.regionLabel, 1, 140, 'Contrée'),
        habitatLabel: clampStr(specimen.habitatLabel, 1, 160, 'Terrain'),
        lat: clampNum(specimen.lat, -90, 90),
        lng: clampNum(specimen.lng, -180, 180),
        ...altFields,
        isSubterranean: Boolean(specimen.isSubterranean),
        harvestCount: clampNum(
          Math.max(existingCount, Math.round(specimen.harvestCount || 1)),
          1,
          100000
        ),
        description: clampStr(specimen.description, 1, 1000, 'Échantillon relevé sur le terrain.'),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docPath);
    }
  }
}

export async function syncMissingSpecimensToCloud(
  uidRaw: string,
  localSpecimens: CollectedSpecimen[]
): Promise<void> {
  if (localSpecimens.length === 0) return;
  const uid = sanitizeFirestoreId(uidRaw);
  const specimensPath = `explorers/${uid}/specimens`;
  let existingIds = new Set<string>();
  try {
    const q = query(collection(db, 'explorers', uid, 'specimens'), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    existingIds = new Set(snap.docs.map((d) => d.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, specimensPath);
  }

  const missing = localSpecimens.filter(
    (s) => !existingIds.has(sanitizeFirestoreId(s.specimenId).slice(0, 64))
  );
  if (missing.length === 0) return;

  const BATCH_SIZE = 8;
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const slice = missing.slice(i, i + BATCH_SIZE);
    await Promise.all(slice.map((spec) => upsertSpecimenInCloud(uid, spec)));
  }
}

export function subscribeToCloudExplorer(
  uidRaw: string,
  onProfile: (p: ExplorerProgress) => void,
  onDiscoveries: (entries: UnlockedEntry[]) => void,
  onSpecimens?: (specimens: CollectedSpecimen[]) => void
): Unsubscribe {
  const uid = sanitizeFirestoreId(uidRaw);
  const profilePath = `explorers/${uid}`;
  const discoveriesPath = `explorers/${uid}/discoveries`;
  const specimensPath = `explorers/${uid}/specimens`;

  const unsubProfile = onSnapshot(
    doc(db, 'explorers', uid),
    (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      onProfile({
        displayName: String(d.displayName || 'Explorateur'),
        totalXp: Number(d.totalXp || 0),
        xpHistoire: Number(d.xpHistoire || 0),
        xpGeographie: Number(d.xpGeographie || 0),
        xpEcosysteme: Number(d.xpEcosysteme || 0),
        xpEtrange: Number(d.xpEtrange || 0),
        xpLegende: Number(d.xpLegende || 0),
        gender: sanitizeGender(String(d.gender || 'masculin')),
        avatarPreset: sanitizeAvatarPreset(String(d.avatarPreset || 'cartographe')),
        skinTone: sanitizeSkinTone(String(d.skinTone || 'hale')),
        headgearId: sanitizeHeadgear(String(d.headgearId || 'tricorne_fauve')),
        outfitId: sanitizeOutfit(String(d.outfitId || 'arpenteur')),
        toolId: sanitizeTool(String(d.toolId || 'lanterne_laiton')),
        packId: sanitizePack(String(d.packId || 'besace_cuir')),
        walkedMeters: Number(d.walkedMeters || 0),
        discoveriesCount: Number(d.discoveriesCount || 0),
        completedMissions: Array.isArray(d.completedMissions)
          ? (d.completedMissions as string[])
          : [],
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, profilePath);
    }
  );

  const q = query(collection(db, 'explorers', uid, 'discoveries'), where('ownerId', '==', uid));
  const unsubDiscoveries = onSnapshot(
    q,
    (snap) => {
      const list: UnlockedEntry[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const ts = d.discoveredAt as { toDate?: () => Date } | undefined;
        return {
          poiId: String(d.poiId || docSnap.id),
          name: String(d.name || 'Lieu découvert'),
          category: (['histoire', 'geographie', 'ecosysteme', 'etrange', 'legende'].includes(
            String(d.category)
          )
            ? d.category
            : 'histoire') as ExplorationCategory,
          subType: String(d.subType || 'Point remarquable'),
          eraLabel: String(d.eraLabel || 'Strate locale'),
          source: String(d.source || 'OpenStreetMap'),
          lat: Number(d.lat || 0),
          lng: Number(d.lng || 0),
          summary: String(d.summary || ''),
          nearWaterway: Boolean(d.nearWaterway),
          waterwayName: String(d.waterwayName || ''),
          safetyNotice: String(d.safetyNotice || ''),
          externalUrl: String(d.externalUrl || ''),
          xpAwarded: Number(d.xpAwarded || 0),
          relatedPoiIds: Array.isArray(d.relatedPoiIds) ? (d.relatedPoiIds as string[]) : [],
          relatedPoiTitles: Array.isArray(d.relatedPoiTitles)
            ? (d.relatedPoiTitles as string[])
            : [],
          personalNote: String(d.personalNote || ''),
          photoCount: Number(d.photoCount || 0),
          discoveredAtIso:
            ts && typeof ts.toDate === 'function'
              ? ts.toDate().toISOString()
              : new Date().toISOString(),
        };
      });
      list.sort((a, b) => b.discoveredAtIso.localeCompare(a.discoveredAtIso));
      onDiscoveries(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, discoveriesPath);
    }
  );

  let unsubSpecimens: Unsubscribe | null = null;
  if (onSpecimens) {
    const sq = query(collection(db, 'explorers', uid, 'specimens'), where('ownerId', '==', uid));
    unsubSpecimens = onSnapshot(
      sq,
      (snap) => {
        const list: CollectedSpecimen[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          const firstTs = d.firstCollectedAt as { toDate?: () => Date } | undefined;
          const upTs = d.updatedAt as { toDate?: () => Date } | undefined;
          const firstIso =
            firstTs && typeof firstTs.toDate === 'function'
              ? firstTs.toDate().toISOString()
              : new Date().toISOString();
          const lastIso =
            upTs && typeof upTs.toDate === 'function' ? upTs.toDate().toISOString() : firstIso;
          return {
            specimenId: String(d.specimenId || docSnap.id),
            domain: (d.domain === 'geologie' ? 'geologie' : 'botanique') as SpecimenDomain,
            affinity: ([
              'calcaire',
              'granit',
              'schiste',
              'gres',
              'alluvions',
              'volcanique',
              'souterrain',
            ].includes(String(d.affinity))
              ? d.affinity
              : 'calcaire') as LithologyAffinity,
            name: String(d.name || 'Spécimen'),
            latinOrMineralName: String(d.latinOrMineralName || ''),
            familyLabel: String(d.familyLabel || ''),
            lithologyLabel: String(d.lithologyLabel || ''),
            bedrockPeriod: String(d.bedrockPeriod || ''),
            bedrockAgeMa: String(d.bedrockAgeMa || ''),
            regionLabel: String(d.regionLabel || ''),
            habitatLabel: String(d.habitatLabel || ''),
            lat: Number(d.lat || 0),
            lng: Number(d.lng || 0),
            altitudeMeters:
              typeof d.altitudeMeters === 'number' && Number.isFinite(d.altitudeMeters)
                ? d.altitudeMeters
                : null,
            isSubterranean: Boolean(d.isSubterranean),
            harvestCount: Number(d.harvestCount || 1),
            firstCollectedIso: firstIso,
            lastCollectedIso: lastIso,
            description: String(d.description || ''),
          };
        });
        list.sort((a, b) => b.lastCollectedIso.localeCompare(a.lastCollectedIso));
        onSpecimens(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, specimensPath);
      }
    );
  }

  return () => {
    unsubProfile();
    unsubDiscoveries();
    if (unsubSpecimens) unsubSpecimens();
  };
}

function buildCairnDocId(uidRaw: string, poiIdRaw: string): string {
  const uidPart = sanitizeFirestoreId(uidRaw).slice(0, 56);
  const poiPart = sanitizeFirestoreId(poiIdRaw).slice(0, 68);
  return sanitizeFirestoreId(`${uidPart}_${poiPart}`);
}

export function subscribeToPoiCairns(
  poiIdRaw: string,
  onCairns: (cairns: ExplorerCairn[]) => void
): Unsubscribe {
  const poiId = sanitizeFirestoreId(poiIdRaw);
  const q = query(
    collection(db, 'cairns'),
    where('poiId', '==', poiId),
    where('visibility', '==', 'public'),
    limit(25)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: ExplorerCairn[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const ts = d.createdAt as { toDate?: () => Date } | undefined;
        const rawTag = String(d.tag || 'architecture');
        const safeTag: CairnTag = VALID_CAIRN_TAGS.includes(rawTag as CairnTag)
          ? (rawTag as CairnTag)
          : 'architecture';
        return {
          id: docSnap.id,
          authorId: String(d.authorId || ''),
          authorCallsign: String(d.authorCallsign || 'Éclaireur'),
          authorGender: d.authorGender ? sanitizeGender(String(d.authorGender)) : undefined,
          authorAvatarPreset: d.authorAvatarPreset
            ? sanitizeAvatarPreset(String(d.authorAvatarPreset))
            : undefined,
          authorSkinTone: d.authorSkinTone ? sanitizeSkinTone(String(d.authorSkinTone)) : undefined,
          authorHeadgearId: d.authorHeadgearId
            ? sanitizeHeadgear(String(d.authorHeadgearId))
            : undefined,
          authorOutfitId: d.authorOutfitId ? sanitizeOutfit(String(d.authorOutfitId)) : undefined,
          poiId: String(d.poiId || poiId),
          poiName: String(d.poiName || ''),
          tag: safeTag,
          message: String(d.message || ''),
          createdAtIso:
            ts && typeof ts.toDate === 'function'
              ? ts.toDate().toISOString()
              : new Date().toISOString(),
        };
      });
      list.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      onCairns(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cairns');
    }
  );
}

export async function upsertPoiCairnInCloud(params: {
  uidRaw: string;
  authorCallsign: string;
  authorAppearance?: ExplorerAppearance;
  poiEntry: UnlockedEntry;
  tag: CairnTag;
  message: string;
}): Promise<void> {
  const uid = sanitizeFirestoreId(params.uidRaw);
  const poiId = sanitizeFirestoreId(params.poiEntry.poiId);
  const cairnId = buildCairnDocId(uid, poiId);
  const docPath = `cairns/${cairnId}`;
  const docRef = doc(db, 'cairns', cairnId);

  // Ensure the parent discovery exists in cloud first so relational rule passes
  await createDiscoveryInCloud(uid, params.poiEntry);

  const safeTag: CairnTag = VALID_CAIRN_TAGS.includes(params.tag) ? params.tag : 'architecture';
  const safeCallsign = clampStr(params.authorCallsign.trim(), 1, 60, 'Éclaireur');
  const safeMsg = clampStr(params.message.trim(), 3, 280, 'Observation sur le terrain.');
  const avatarFields = params.authorAppearance
    ? {
        authorGender: sanitizeGender(params.authorAppearance.gender),
        authorAvatarPreset: sanitizeAvatarPreset(params.authorAppearance.avatarPreset),
        authorSkinTone: sanitizeSkinTone(params.authorAppearance.skinTone),
        authorHeadgearId: sanitizeHeadgear(params.authorAppearance.headgearId),
        authorOutfitId: sanitizeOutfit(params.authorAppearance.outfitId),
      }
    : {};

  let snap;
  try {
    snap = await getDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }

  if (!snap.exists()) {
    try {
      await setDoc(docRef, {
        authorId: uid,
        authorCallsign: safeCallsign,
        ...avatarFields,
        poiId,
        poiName: clampStr(params.poiEntry.name, 1, 200, 'Lieu découvert'),
        tag: safeTag,
        message: safeMsg,
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docPath);
    }
  } else {
    try {
      await updateDoc(docRef, {
        authorCallsign: safeCallsign,
        ...avatarFields,
        tag: safeTag,
        message: safeMsg,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docPath);
    }
  }
}

export async function deletePoiCairnInCloud(uidRaw: string, poiIdRaw: string): Promise<void> {
  const cairnId = buildCairnDocId(uidRaw, poiIdRaw);
  const docPath = `cairns/${cairnId}`;
  try {
    await deleteDoc(doc(db, 'cairns', cairnId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function resetExplorerCharacterInCloud(
  uidRaw: string,
  initialProgress: ExplorerProgress
): Promise<void> {
  const uid = sanitizeFirestoreId(uidRaw);
  const profilePath = `explorers/${uid}`;
  const profileRef = doc(db, 'explorers', uid);
  const discoveriesPath = `explorers/${uid}/discoveries`;

  // 1. Delete all public cairns authored by this explorer
  try {
    const cairnQuery = query(
      collection(db, 'cairns'),
      where('authorId', '==', uid),
      where('visibility', '==', 'public')
    );
    const cairnSnap = await getDocs(cairnQuery);
    const BATCH = 10;
    for (let i = 0; i < cairnSnap.docs.length; i += BATCH) {
      const slice = cairnSnap.docs.slice(i, i + BATCH);
      await Promise.all(
        slice.map(async (d) => {
          try {
            await deleteDoc(d.ref);
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `cairns/${d.id}`);
          }
        })
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'cairns');
  }

  // 2. Delete all unlocked Carnet discoveries in /explorers/{uid}/discoveries
  try {
    const discQuery = query(
      collection(db, 'explorers', uid, 'discoveries'),
      where('ownerId', '==', uid)
    );
    const discSnap = await getDocs(discQuery);
    const BATCH = 10;
    for (let i = 0; i < discSnap.docs.length; i += BATCH) {
      const slice = discSnap.docs.slice(i, i + BATCH);
      await Promise.all(
        slice.map(async (d) => {
          try {
            await deleteDoc(d.ref);
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `${discoveriesPath}/${d.id}`);
          }
        })
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, discoveriesPath);
  }

  // 2b. Delete all collected Herbarium & Lithothèque specimens in /explorers/{uid}/specimens
  const specimensPath = `explorers/${uid}/specimens`;
  try {
    const specQuery = query(
      collection(db, 'explorers', uid, 'specimens'),
      where('ownerId', '==', uid)
    );
    const specSnap = await getDocs(specQuery);
    const BATCH = 10;
    for (let i = 0; i < specSnap.docs.length; i += BATCH) {
      const slice = specSnap.docs.slice(i, i + BATCH);
      await Promise.all(
        slice.map(async (d) => {
          try {
            await deleteDoc(d.ref);
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `${specimensPath}/${d.id}`);
          }
        })
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, specimensPath);
  }

  // 3. Reset master /explorers/{uid} profile to Level 1 / zero progression (Action 3)
  let snap;
  try {
    snap = await getDoc(profileRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, profilePath);
  }

  const resetPayload = {
    displayName: clampStr(initialProgress.displayName || 'Explorateur', 1, 60, 'Explorateur'),
    totalXp: 0,
    xpHistoire: 0,
    xpGeographie: 0,
    xpEcosysteme: 0,
    xpEtrange: 0,
    xpLegende: 0,
    gender: sanitizeGender(initialProgress.gender),
    avatarPreset: sanitizeAvatarPreset(initialProgress.avatarPreset),
    skinTone: sanitizeSkinTone(initialProgress.skinTone),
    headgearId: sanitizeHeadgear(initialProgress.headgearId),
    outfitId: sanitizeOutfit(initialProgress.outfitId),
    toolId: sanitizeTool(initialProgress.toolId),
    packId: sanitizePack(initialProgress.packId),
    walkedMeters: 0,
    discoveriesCount: 0,
    completedMissions: [] as string[],
    updatedAt: serverTimestamp(),
  };

  if (snap.exists()) {
    try {
      await updateDoc(profileRef, resetPayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, profilePath);
    }
  } else {
    try {
      await setDoc(profileRef, {
        ownerId: uid,
        ...resetPayload,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, profilePath);
    }
  }
}

