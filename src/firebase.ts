import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
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
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  ArchivistChestArchetype,
  CairnTag,
  CollectedSpecimen,
  ExplorationCategory,
  ExplorerAppearance,
  ExplorerAvatarPreset,
  ExplorerCairn,
  ExplorerFamiliarId,
  ExplorerGender,
  ExplorerGeocacheRecord,
  ExplorerHeadgearId,
  ExplorerOutfitId,
  ExplorerPackId,
  ExplorerProgress,
  ExplorerSkinTone,
  ExplorerToolId,
  GeocacheGiftDomain,
  GeocacheGiftKind,
  GeocacheLogRecord,
  GeocachePlacementMode,
  LithologyAffinity,
  OpenedArchivistChestRecord,
  SpecimenDomain,
  TrophyId,
  UnlockedEntry,
} from './types';
import { VALID_TROPHY_IDS } from './types';
import type {
  ChallengeCadence,
  CommunityChallengeLeaderboardRow,
} from './communityChallenges';
import type {
  PantheonLeaderboardRow,
  PantheonMetrics,
} from './pantheonAndLiveEvents';

interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
}

const localFirebaseConfigModules = import.meta.glob<{ default: FirebaseAppletConfig }>(
  '../firebase-applet-config.json',
  { eager: true }
);
const localFirebaseConfig: Partial<FirebaseAppletConfig> =
  localFirebaseConfigModules['../firebase-applet-config.json']?.default ?? {};

const firebaseConfig: FirebaseAppletConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || localFirebaseConfig.projectId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || localFirebaseConfig.appId || '',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || localFirebaseConfig.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || localFirebaseConfig.authDomain || '',
  firestoreDatabaseId:
    import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
    localFirebaseConfig.firestoreDatabaseId,
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || localFirebaseConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || localFirebaseConfig.messagingSenderId,
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || localFirebaseConfig.measurementId,
  oAuthClientId:
    import.meta.env.VITE_FIREBASE_OAUTH_CLIENT_ID || localFirebaseConfig.oAuthClientId,
  recaptchaSiteKey:
    import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY || localFirebaseConfig.recaptchaSiteKey,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

const app: FirebaseApp | null = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const db: Firestore = (
  app
    ? firebaseConfig.firestoreDatabaseId
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app)
    : null
) as Firestore;
export const auth: Auth | null = app ? getAuth(app) : null;

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
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
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

export function isTransientCloudOfflineError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('CLOUD_OFFLINE') ||
    msg.includes('the client is offline') ||
    msg.includes('unavailable') ||
    msg.includes('network-request-failed') ||
    msg.includes('Fetching auth token failed') ||
    msg.includes('token-service-api-has-not-been-used') ||
    msg.includes('securetoken.googleapis.com') ||
    msg.includes('api-not-enabled')
  );
}

export function formatFirebaseAuthErrorFr(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('popup-closed-by-user') || raw.includes('cancelled-popup-request')) {
    return 'La fenêtre de connexion Google a été refermée avant validation.';
  }
  if (raw.includes('popup-blocked')) {
    return 'Le navigateur a bloqué la fenêtre de connexion Google. Autorisez les pop-ups pour ce site.';
  }
  if (
    raw.includes('token-service-api-has-not-been-used') ||
    raw.includes('securetoken.googleapis.com') ||
    raw.includes('api-not-enabled')
  ) {
    return 'Mode Sauvegarde Locale actif : l’API Google Cloud « Token Service API » (securetoken.googleapis.com) est désactivée ou en cours d’activation sur le projet Firebase. Vos découvertes restent intégralement sauvegardées sur cet appareil.';
  }
  if (raw.includes('unauthorized-domain')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'ce domaine';
    return `Ajoutez « ${host} » dans Firebase Console > Authentication > Settings > Authorized domains pour activer la connexion Google sur cette URL.`;
  }
  if (raw.includes('FIREBASE_NOT_CONFIGURED')) {
    return 'Mode Sauvegarde Locale actif : configuration Firebase absente sur cette instance.';
  }
  if (raw.includes('network-request-failed') || raw.includes('the client is offline')) {
    return 'Réseau indisponible : votre Grimoire continue de sauvegarder toutes vos découvertes localement.';
  }
  return 'Synchronisation Cloud momentanément indisponible. Vos découvertes restent sauvegardées sur cet appareil.';
}

export interface AuthSessionPreflightResult {
  validUser: User | null;
  cloudReachable: boolean;
  warningMessage: string;
}

const inflightAuthChecks = new Map<string, Promise<AuthSessionPreflightResult>>();

export async function validateExplorerAuthSession(
  candidateUser?: User | null
): Promise<AuthSessionPreflightResult> {
  if (!auth || !isFirebaseConfigured) {
    return { validUser: null, cloudReachable: false, warningMessage: '' };
  }
  if (candidateUser === undefined) {
    try {
      await auth.authStateReady();
    } catch {
      // Ignore authStateReady errors and fall back to auth.currentUser
    }
  }

  const activeUser = candidateUser !== undefined ? candidateUser : auth.currentUser;
  const browserOnline = typeof navigator === 'undefined' || navigator.onLine !== false;

  if (!activeUser) {
    return { validUser: null, cloudReachable: browserOnline, warningMessage: '' };
  }

  if (!browserOnline) {
    return { validUser: activeUser, cloudReachable: false, warningMessage: '' };
  }

  const existingCheck = inflightAuthChecks.get(activeUser.uid);
  if (existingCheck) return existingCheck;

  const checkPromise = (async (): Promise<AuthSessionPreflightResult> => {
    try {
      await activeUser.getIdToken(true);
      return { validUser: activeUser, cloudReachable: true, warningMessage: '' };
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes('network-request-failed')) {
        return { validUser: activeUser, cloudReachable: false, warningMessage: '' };
      }
      await firebaseSignOut(auth).catch(() => {});
      return {
        validUser: null,
        cloudReachable: browserOnline,
        warningMessage: formatFirebaseAuthErrorFr(err),
      };
    } finally {
      inflightAuthChecks.delete(activeUser.uid);
    }
  })();

  inflightAuthChecks.set(activeUser.uid, checkPromise);
  return checkPromise;
}

async function assertCloudSessionHealthy(): Promise<void> {
  if (!auth || !db || !isFirebaseConfigured) {
    throw new Error('CLOUD_OFFLINE');
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('CLOUD_OFFLINE');
  }
  const current = auth.currentUser;
  if (!current) {
    throw new Error('CLOUD_OFFLINE');
  }
  try {
    await current.getIdToken(false);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (!raw.includes('network-request-failed')) {
      await firebaseSignOut(auth).catch(() => {});
    }
    throw new Error('CLOUD_OFFLINE');
  }
}

async function testConnection() {
  if (!isFirebaseConfigured || !db) return;
  try {
    const preflight = await validateExplorerAuthSession();
    if (!preflight.cloudReachable) return;
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
  'monocle_erudit',
  'tricorne_reliquaire',
  'couronne_saisons',
  'couronne_chroniqueur',
  'bandeau_guilde_unie',
];
const VALID_OUTFITS: ExplorerOutfitId[] = [
  'arpenteur',
  'chroniqueur',
  'geomancien',
  'sylvestre',
  'ombres',
  'barde',
  'almanach_solaire',
  'chasseur_reliques',
  'conteuse_legende',
];
const VALID_TOOLS: ExplorerToolId[] = [
  'lanterne_laiton',
  'boussole_astrale',
  'marteau_geologue',
  'plume_enluminee',
  'fiole_spectrale',
  'loupe_sceau_or',
  'clef_coffres_anciens',
  'sablier_ephemeride',
  'plume_trois_actes',
];
const VALID_PACKS: ExplorerPackId[] = [
  'besace_cuir',
  'rouleau_cartes',
  'hotte_cristaux',
  'ailerons_automate',
  'coffret_piste',
  'grimoire_almanach',
  'astrolabe_dorsal',
];
const VALID_FAMILIARS: ExplorerFamiliarId[] = [
  'aucun',
  'chouette_erudite',
  'goupil_saisons',
  'scarabee_boussole',
  'salamandre_cristal',
  'corbeau_cartographe',
  'feu_follet_astral',
  'hermine_royale',
  'cerf_brumes',
  'loutre_riviere',
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

function sanitizeFamiliar(raw?: string): ExplorerFamiliarId {
  return VALID_FAMILIARS.includes(raw as ExplorerFamiliarId)
    ? (raw as ExplorerFamiliarId)
    : 'aucun';
}

function sanitizePinnedTrophyId(raw?: string | null): TrophyId | '' {
  if (!raw) return '';
  return VALID_TROPHY_IDS.includes(raw as TrophyId) ? (raw as TrophyId) : '';
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
  if (!auth || !isFirebaseConfigured) {
    throw new Error(formatFirebaseAuthErrorFr(new Error('FIREBASE_NOT_CONFIGURED')));
  }
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  try {
    await cred.user.getIdToken(true);
  } catch (tokenErr) {
    await firebaseSignOut(auth).catch(() => {});
    throw new Error(formatFirebaseAuthErrorFr(tokenErr));
  }
  return cred.user;
}

export async function signOutExplorer(): Promise<void> {
  if (!auth) return;
  await firebaseSignOut(auth);
}

export async function ensureExplorerProfileInCloud(
  user: User,
  localProgress: ExplorerProgress
): Promise<void> {
  await assertCloudSessionHealthy();
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
        familiarId: sanitizeFamiliar(localProgress.familiarId),
        pinnedTrophyId: sanitizePinnedTrophyId(localProgress.pinnedTrophyId),
        walkedMeters: clampNum(Math.round(localProgress.walkedMeters || 0), 0, 100000000),
        nightFeatsCount: clampNum(Math.round(localProgress.nightFeatsCount || 0), 0, 100000),
        stormFeatsCount: clampNum(Math.round(localProgress.stormFeatsCount || 0), 0, 100000),
        completedContractsCount: clampNum(
          Math.round(localProgress.completedContractsCount || 0),
          0,
          100000
        ),
        solvedRiddlesCount: clampNum(
          Math.round(localProgress.solvedRiddlesCount || 0),
          0,
          100000
        ),
        completedHuntsCount: clampNum(
          Math.round(localProgress.completedHuntsCount || 0),
          0,
          100000
        ),
        claimedAlmanacCount: clampNum(
          Math.round(localProgress.claimedAlmanacCount || 0),
          0,
          100000
        ),
        completedNarrativesCount: clampNum(
          Math.round(localProgress.completedNarrativesCount || 0),
          0,
          100000
        ),
        claimedCommunityChallengesCount: clampNum(
          Math.round(localProgress.claimedCommunityChallengesCount || 0),
          0,
          100000
        ),
        claimedLiveEventsCount: clampNum(
          Math.round(localProgress.claimedLiveEventsCount || 0),
          0,
          100000
        ),
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
    const mergedNightFeats = Math.max(
      Number(cloud.nightFeatsCount || 0),
      Math.round(localProgress.nightFeatsCount || 0)
    );
    const mergedStormFeats = Math.max(
      Number(cloud.stormFeatsCount || 0),
      Math.round(localProgress.stormFeatsCount || 0)
    );
    const mergedContracts = Math.max(
      Number(cloud.completedContractsCount || 0),
      Math.round(localProgress.completedContractsCount || 0)
    );
    const mergedRiddles = Math.max(
      Number(cloud.solvedRiddlesCount || 0),
      Math.round(localProgress.solvedRiddlesCount || 0)
    );
    const mergedHunts = Math.max(
      Number(cloud.completedHuntsCount || 0),
      Math.round(localProgress.completedHuntsCount || 0)
    );
    const mergedAlmanac = Math.max(
      Number(cloud.claimedAlmanacCount || 0),
      Math.round(localProgress.claimedAlmanacCount || 0)
    );
    const mergedNarratives = Math.max(
      Number(cloud.completedNarrativesCount || 0),
      Math.round(localProgress.completedNarrativesCount || 0)
    );
    const mergedCommunityChallenges = Math.max(
      Number(cloud.claimedCommunityChallengesCount || 0),
      Math.round(localProgress.claimedCommunityChallengesCount || 0)
    );
    const mergedLiveEvents = Math.max(
      Number(cloud.claimedLiveEventsCount || 0),
      Math.round(localProgress.claimedLiveEventsCount || 0)
    );
    if (
      mergedTotalXp > Number(cloud.totalXp || 0) ||
      mergedDiscoveriesCount > Number(cloud.discoveriesCount || 0) ||
      mergedWalkedMeters > Number(cloud.walkedMeters || 0) ||
      mergedNightFeats > Number(cloud.nightFeatsCount || 0) ||
      mergedStormFeats > Number(cloud.stormFeatsCount || 0) ||
      mergedContracts > Number(cloud.completedContractsCount || 0) ||
      mergedRiddles > Number(cloud.solvedRiddlesCount || 0) ||
      mergedHunts > Number(cloud.completedHuntsCount || 0) ||
      mergedAlmanac > Number(cloud.claimedAlmanacCount || 0) ||
      mergedNarratives > Number(cloud.completedNarrativesCount || 0) ||
      mergedCommunityChallenges > Number(cloud.claimedCommunityChallengesCount || 0) ||
      mergedLiveEvents > Number(cloud.claimedLiveEventsCount || 0)
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
          familiarId: sanitizeFamiliar(
            String(cloud.familiarId || localProgress.familiarId || 'aucun')
          ),
          pinnedTrophyId: sanitizePinnedTrophyId(
            String(cloud.pinnedTrophyId ?? localProgress.pinnedTrophyId ?? '')
          ),
          walkedMeters: clampNum(mergedWalkedMeters, 0, 100000000),
          nightFeatsCount: clampNum(mergedNightFeats, 0, 100000),
          stormFeatsCount: clampNum(mergedStormFeats, 0, 100000),
          completedContractsCount: clampNum(mergedContracts, 0, 100000),
          solvedRiddlesCount: clampNum(mergedRiddles, 0, 100000),
          completedHuntsCount: clampNum(mergedHunts, 0, 100000),
          claimedAlmanacCount: clampNum(mergedAlmanac, 0, 100000),
          completedNarrativesCount: clampNum(mergedNarratives, 0, 100000),
          claimedCommunityChallengesCount: clampNum(mergedCommunityChallenges, 0, 100000),
          claimedLiveEventsCount: clampNum(mergedLiveEvents, 0, 100000),
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
  await assertCloudSessionHealthy();
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
      familiarId: sanitizeFamiliar(progress.familiarId),
      pinnedTrophyId: sanitizePinnedTrophyId(progress.pinnedTrophyId),
      walkedMeters: clampNum(Math.round(progress.walkedMeters || 0), 0, 100000000),
      nightFeatsCount: clampNum(Math.round(progress.nightFeatsCount || 0), 0, 100000),
      stormFeatsCount: clampNum(Math.round(progress.stormFeatsCount || 0), 0, 100000),
      completedContractsCount: clampNum(
        Math.round(progress.completedContractsCount || 0),
        0,
        100000
      ),
      solvedRiddlesCount: clampNum(
        Math.round(progress.solvedRiddlesCount || 0),
        0,
        100000
      ),
      completedHuntsCount: clampNum(
        Math.round(progress.completedHuntsCount || 0),
        0,
        100000
      ),
      claimedAlmanacCount: clampNum(
        Math.round(progress.claimedAlmanacCount || 0),
        0,
        100000
      ),
      completedNarrativesCount: clampNum(
        Math.round(progress.completedNarrativesCount || 0),
        0,
        100000
      ),
      claimedCommunityChallengesCount: clampNum(
        Math.round(progress.claimedCommunityChallengesCount || 0),
        0,
        100000
      ),
      claimedLiveEventsCount: clampNum(
        Math.round(progress.claimedLiveEventsCount || 0),
        0,
        100000
      ),
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
  appearance?: Partial<ExplorerAppearance>,
  pinnedTrophyId?: TrophyId | ''
): Promise<void> {
  await assertCloudSessionHealthy();
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
  if (appearance?.familiarId) patch.familiarId = sanitizeFamiliar(appearance.familiarId);
  if (pinnedTrophyId !== undefined) {
    patch.pinnedTrophyId = sanitizePinnedTrophyId(pinnedTrophyId);
  }
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
  await assertCloudSessionHealthy();
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
  await assertCloudSessionHealthy();
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
  await assertCloudSessionHealthy();
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
  await assertCloudSessionHealthy();
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
  await assertCloudSessionHealthy();
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

const VALID_CHEST_ARCHETYPES: ArchivistChestArchetype[] = [
  'sommet_colline',
  'confluence_eaux',
  'cul_de_sac_forestier',
  'clairiere_sylvestre',
  'bouche_souterraine',
];

export async function recordOpenedArchivistChestInCloud(
  uidRaw: string,
  chest: OpenedArchivistChestRecord
): Promise<void> {
  await assertCloudSessionHealthy();
  const uid = sanitizeFirestoreId(uidRaw);
  const chestId = sanitizeFirestoreId(chest.chestId).slice(0, 80);
  const docPath = `explorers/${uid}/archivistChests/${chestId}`;
  const docRef = doc(db, 'explorers', uid, 'archivistChests', chestId);

  let snap;
  try {
    snap = await getDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }

  // Opened Archivist Chests are immutable once unlocked (allow update: if false)
  if (snap.exists()) return;

  const safeArchetype: ArchivistChestArchetype = VALID_CHEST_ARCHETYPES.includes(chest.archetype)
    ? chest.archetype
    : 'clairiere_sylvestre';
  const safeCat: ExplorationCategory = (
    ['histoire', 'geographie', 'ecosysteme', 'etrange', 'legende'] as ExplorationCategory[]
  ).includes(chest.category)
    ? chest.category
    : 'geographie';

  const payload: Record<string, unknown> = {
    ownerId: uid,
    chestId,
    archetype: safeArchetype,
    title: clampStr(chest.title, 1, 160, "Coffre d'Archiviste"),
    placeNote: clampStr(chest.placeNote, 1, 240, 'Point topographique remarquable.'),
    relicId: sanitizeFirestoreId(chest.relicId).slice(0, 64),
    relicName: clampStr(chest.relicName, 1, 160, "Relique d'Archiviste"),
    category: safeCat,
    regionLabel: clampStr(chest.regionLabel || 'Secteur local', 1, 140, 'Secteur local'),
    lat: clampNum(chest.lat, -90, 90),
    lng: clampNum(chest.lng, -180, 180),
    isSubterranean: Boolean(chest.isSubterranean),
    xpAwarded: Math.round(clampNum(chest.xpAwarded, 0, 5000)),
    openedAt: serverTimestamp(),
  };
  if (typeof chest.altitudeMeters === 'number' && Number.isFinite(chest.altitudeMeters)) {
    payload.altitudeMeters = Math.round(clampNum(chest.altitudeMeters, -500, 9000));
  }

  try {
    await setDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function syncMissingArchivistChestsToCloud(
  uidRaw: string,
  localChests: OpenedArchivistChestRecord[]
): Promise<void> {
  if (localChests.length === 0) return;
  await assertCloudSessionHealthy();
  const uid = sanitizeFirestoreId(uidRaw);
  const chestsPath = `explorers/${uid}/archivistChests`;

  let existingIds = new Set<string>();
  try {
    const q = query(
      collection(db, 'explorers', uid, 'archivistChests'),
      where('ownerId', '==', uid)
    );
    const snap = await getDocs(q);
    existingIds = new Set(snap.docs.map((d) => d.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, chestsPath);
  }

  const missing = localChests.filter(
    (c) => !existingIds.has(sanitizeFirestoreId(c.chestId).slice(0, 80))
  );
  if (missing.length === 0) return;

  const BATCH_SIZE = 8;
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const slice = missing.slice(i, i + BATCH_SIZE);
    await Promise.all(slice.map((ch) => recordOpenedArchivistChestInCloud(uid, ch)));
  }
}

export function subscribeToCloudExplorer(
  uidRaw: string,
  onProfile: (p: ExplorerProgress) => void,
  onDiscoveries: (entries: UnlockedEntry[]) => void,
  onSpecimens?: (specimens: CollectedSpecimen[]) => void,
  onArchivistChests?: (chests: OpenedArchivistChestRecord[]) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !db) return () => {};
  const uid = sanitizeFirestoreId(uidRaw);
  const profilePath = `explorers/${uid}`;
  const discoveriesPath = `explorers/${uid}/discoveries`;
  const specimensPath = `explorers/${uid}/specimens`;
  const chestsPath = `explorers/${uid}/archivistChests`;

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
        familiarId: sanitizeFamiliar(String(d.familiarId || 'aucun')),
        pinnedTrophyId: sanitizePinnedTrophyId(String(d.pinnedTrophyId || '')),
        walkedMeters: Number(d.walkedMeters || 0),
        nightFeatsCount: Number(d.nightFeatsCount || 0),
        stormFeatsCount: Number(d.stormFeatsCount || 0),
        completedContractsCount: Number(d.completedContractsCount || 0),
        solvedRiddlesCount: Number(d.solvedRiddlesCount || 0),
        completedHuntsCount: Number(d.completedHuntsCount || 0),
        claimedAlmanacCount: Number(d.claimedAlmanacCount || 0),
        completedNarrativesCount: Number(d.completedNarrativesCount || 0),
        claimedCommunityChallengesCount: Number(d.claimedCommunityChallengesCount || 0),
        claimedLiveEventsCount: Number(d.claimedLiveEventsCount || 0),
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

  let unsubChests: Unsubscribe | null = null;
  if (onArchivistChests) {
    const qChests = query(
      collection(db, 'explorers', uid, 'archivistChests'),
      where('ownerId', '==', uid)
    );
    unsubChests = onSnapshot(
      qChests,
      (snap) => {
        const list: OpenedArchivistChestRecord[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          const ts = d.openedAt as { toDate?: () => Date } | undefined;
          const openedIso =
            ts && typeof ts.toDate === 'function'
              ? ts.toDate().toISOString()
              : new Date().toISOString();
          return {
            chestId: String(d.chestId || docSnap.id),
            archetype: VALID_CHEST_ARCHETYPES.includes(d.archetype as ArchivistChestArchetype)
              ? (d.archetype as ArchivistChestArchetype)
              : 'clairiere_sylvestre',
            title: String(d.title || "Coffre d'Archiviste"),
            placeNote: String(d.placeNote || ''),
            relicId: String(d.relicId || 'astrolabe_laiton'),
            relicName: String(d.relicName || 'Relique'),
            category: (['histoire', 'geographie', 'ecosysteme', 'etrange', 'legende'].includes(
              String(d.category)
            )
              ? d.category
              : 'geographie') as ExplorationCategory,
            regionLabel: String(d.regionLabel || 'Secteur local'),
            lat: Number(d.lat || 0),
            lng: Number(d.lng || 0),
            altitudeMeters:
              typeof d.altitudeMeters === 'number' && Number.isFinite(d.altitudeMeters)
                ? d.altitudeMeters
                : null,
            isSubterranean: Boolean(d.isSubterranean),
            xpAwarded: Number(d.xpAwarded || 0),
            openedAtIso: openedIso,
          };
        });
        list.sort((a, b) => b.openedAtIso.localeCompare(a.openedAtIso));
        onArchivistChests(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, chestsPath);
      }
    );
  }

  return () => {
    unsubProfile();
    unsubDiscoveries();
    if (unsubSpecimens) unsubSpecimens();
    if (unsubChests) unsubChests();
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
  if (!isFirebaseConfigured || !db) {
    onCairns([]);
    return () => {};
  }
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
  await assertCloudSessionHealthy();
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
  await assertCloudSessionHealthy();
  const cairnId = buildCairnDocId(uidRaw, poiIdRaw);
  const docPath = `cairns/${cairnId}`;
  try {
    await deleteDoc(doc(db, 'cairns', cairnId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export function buildGeocacheDocId(uidRaw: string, lat: number, lng: number): string {
  const uidPart = sanitizeFirestoreId(uidRaw).slice(0, 44);
  const latTag = `${lat >= 0 ? 'N' : 'S'}${Math.abs(Math.round(lat * 10000))}`;
  const lngTag = `${lng >= 0 ? 'E' : 'W'}${Math.abs(Math.round(lng * 10000))}`;
  return sanitizeFirestoreId(`gc_${uidPart}_${latTag}_${lngTag}`).slice(0, 110);
}

export function subscribeToNearbyGeocaches(
  sectorKeys: string[],
  onCaches: (caches: ExplorerGeocacheRecord[]) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !db) {
    onCaches([]);
    return () => {};
  }
  const cleanSectors = Array.from(
    new Set(
      sectorKeys
        .map((k) => sanitizeFirestoreId(k).slice(0, 32))
        .filter((k) => k.length >= 3)
    )
  ).slice(0, 10);

  if (cleanSectors.length === 0) {
    onCaches([]);
    return () => {};
  }

  const q = query(
    collection(db, 'geocaches'),
    where('sectorKey', 'in', cleanSectors),
    where('visibility', '==', 'public'),
    limit(40)
  );

  return onSnapshot(
    q,
    (snap) => {
      const list: ExplorerGeocacheRecord[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const ts = d.createdAt as { toDate?: () => Date } | undefined;
        const createdIso =
          ts && typeof ts.toDate === 'function'
            ? ts.toDate().toISOString()
            : new Date().toISOString();
        const mode: GeocachePlacementMode =
          d.placementMode === 'unlocked_poi' ? 'unlocked_poi' : 'gps_live';
        const gKind: GeocacheGiftKind = d.giftKind === 'specimen' ? 'specimen' : 'relic';
        const gDom: GeocacheGiftDomain = (
          ['relique', 'botanique', 'geologie'] as GeocacheGiftDomain[]
        ).includes(d.giftDomain as GeocacheGiftDomain)
          ? (d.giftDomain as GeocacheGiftDomain)
          : 'relique';

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
          sectorKey: String(d.sectorKey || ''),
          placementMode: mode,
          anchorPoiId: d.anchorPoiId ? String(d.anchorPoiId) : undefined,
          lat: Number(d.lat || 0),
          lng: Number(d.lng || 0),
          isSubterranean: Boolean(d.isSubterranean),
          regionLabel: String(d.regionLabel || 'Secteur local'),
          title: String(d.title || "Capsule d'Explorateur"),
          riddleHint: String(d.riddleHint || ''),
          giftKind: gKind,
          giftId: String(d.giftId || 'jeton_arpenteur'),
          giftName: String(d.giftName || 'Jeton de Guilde'),
          giftDomain: gDom,
          createdAtIso: createdIso,
        };
      });
      list.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      onCaches(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'geocaches');
    }
  );
}

export async function upsertExplorerGeocacheInCloud(params: {
  uidRaw: string;
  authorCallsign: string;
  authorAppearance?: ExplorerAppearance;
  sectorKey: string;
  placementMode: GeocachePlacementMode;
  anchorEntry?: UnlockedEntry | null;
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
  specimenToSync?: CollectedSpecimen | null;
}): Promise<string> {
  await assertCloudSessionHealthy();
  const uid = sanitizeFirestoreId(params.uidRaw);
  const cacheId = buildGeocacheDocId(uid, params.lat, params.lng);
  const docPath = `geocaches/${cacheId}`;
  const docRef = doc(db, 'geocaches', cacheId);

  // Ensure parent relational prerequisites exist in Firestore before create
  if (params.placementMode === 'unlocked_poi' && params.anchorEntry) {
    await createDiscoveryInCloud(uid, params.anchorEntry);
  }
  if (params.giftKind === 'specimen' && params.specimenToSync) {
    await upsertSpecimenInCloud(uid, params.specimenToSync);
  }

  const safeSector = clampStr(sanitizeFirestoreId(params.sectorKey), 3, 32, 'S_0_0');
  const safeCallsign = clampStr(params.authorCallsign.trim(), 1, 60, 'Éclaireur');
  const safeTitle = clampStr(params.title.trim(), 3, 100, "Capsule d'Éclaireur");
  const safeRiddle = clampStr(
    params.riddleHint.trim(),
    5,
    320,
    'Cherchez au pied du repère topographique le plus proche.'
  );
  const safeRegion = clampStr(params.regionLabel.trim(), 1, 140, 'Secteur local');
  const safeGiftId = sanitizeFirestoreId(params.giftId).slice(0, 64);
  const safeGiftName = clampStr(params.giftName.trim(), 1, 160, 'Souvenir de Guilde');
  const safeGiftKind: GeocacheGiftKind = params.giftKind === 'specimen' ? 'specimen' : 'relic';
  const safeGiftDomain: GeocacheGiftDomain = (
    ['relique', 'botanique', 'geologie'] as GeocacheGiftDomain[]
  ).includes(params.giftDomain)
    ? params.giftDomain
    : 'relique';

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
    const createPayload: Record<string, unknown> = {
      authorId: uid,
      authorCallsign: safeCallsign,
      ...avatarFields,
      sectorKey: safeSector,
      placementMode: params.placementMode === 'unlocked_poi' ? 'unlocked_poi' : 'gps_live',
      lat: clampNum(params.lat, -90, 90),
      lng: clampNum(params.lng, -180, 180),
      isSubterranean: Boolean(params.isSubterranean),
      regionLabel: safeRegion,
      title: safeTitle,
      riddleHint: safeRiddle,
      giftKind: safeGiftKind,
      giftId: safeGiftId,
      giftName: safeGiftName,
      giftDomain: safeGiftDomain,
      visibility: 'public',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (params.placementMode === 'unlocked_poi' && params.anchorEntry) {
      createPayload.anchorPoiId = sanitizeFirestoreId(params.anchorEntry.poiId);
    }
    try {
      await setDoc(docRef, createPayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docPath);
    }
  } else {
    try {
      await updateDoc(docRef, {
        authorCallsign: safeCallsign,
        ...avatarFields,
        title: safeTitle,
        riddleHint: safeRiddle,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docPath);
    }
  }

  return cacheId;
}

export async function deleteExplorerGeocacheInCloud(
  _uidRaw: string,
  cacheIdRaw: string
): Promise<void> {
  await assertCloudSessionHealthy();
  const cacheId = sanitizeFirestoreId(cacheIdRaw);
  const docPath = `geocaches/${cacheId}`;
  try {
    await deleteDoc(doc(db, 'geocaches', cacheId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export function subscribeToGeocacheLogs(
  cacheIdRaw: string,
  onLogs: (logs: GeocacheLogRecord[]) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !db) {
    onLogs([]);
    return () => {};
  }
  const cacheId = sanitizeFirestoreId(cacheIdRaw);
  const logsPath = `geocaches/${cacheId}/logs`;
  const q = query(
    collection(db, 'geocaches', cacheId, 'logs'),
    where('cacheId', '==', cacheId),
    where('visibility', '==', 'public'),
    limit(30)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: GeocacheLogRecord[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const ts = d.foundAt as { toDate?: () => Date } | undefined;
        return {
          id: docSnap.id,
          cacheId: String(d.cacheId || cacheId),
          finderId: String(d.finderId || docSnap.id),
          finderCallsign: String(d.finderCallsign || 'Explorateur'),
          finderGender: d.finderGender ? sanitizeGender(String(d.finderGender)) : undefined,
          finderAvatarPreset: d.finderAvatarPreset
            ? sanitizeAvatarPreset(String(d.finderAvatarPreset))
            : undefined,
          finderSkinTone: d.finderSkinTone ? sanitizeSkinTone(String(d.finderSkinTone)) : undefined,
          finderHeadgearId: d.finderHeadgearId
            ? sanitizeHeadgear(String(d.finderHeadgearId))
            : undefined,
          finderOutfitId: d.finderOutfitId ? sanitizeOutfit(String(d.finderOutfitId)) : undefined,
          note: String(d.note || ''),
          foundAtIso:
            ts && typeof ts.toDate === 'function'
              ? ts.toDate().toISOString()
              : new Date().toISOString(),
        };
      });
      list.sort((a, b) => b.foundAtIso.localeCompare(a.foundAtIso));
      onLogs(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, logsPath);
    }
  );
}

export async function signGeocacheLogbookInCloud(params: {
  uidRaw: string;
  cacheIdRaw: string;
  finderCallsign: string;
  finderAppearance?: ExplorerAppearance;
  note: string;
}): Promise<void> {
  await assertCloudSessionHealthy();
  const uid = sanitizeFirestoreId(params.uidRaw);
  const cacheId = sanitizeFirestoreId(params.cacheIdRaw);
  const docPath = `geocaches/${cacheId}/logs/${uid}`;
  const docRef = doc(db, 'geocaches', cacheId, 'logs', uid);

  const safeCallsign = clampStr(params.finderCallsign.trim(), 1, 60, 'Explorateur');
  const safeNote = clampStr(params.note.trim(), 3, 240, 'Capsule repérée et saluée sur le terrain !');
  const avatarFields = params.finderAppearance
    ? {
        finderGender: sanitizeGender(params.finderAppearance.gender),
        finderAvatarPreset: sanitizeAvatarPreset(params.finderAppearance.avatarPreset),
        finderSkinTone: sanitizeSkinTone(params.finderAppearance.skinTone),
        finderHeadgearId: sanitizeHeadgear(params.finderAppearance.headgearId),
        finderOutfitId: sanitizeOutfit(params.finderAppearance.outfitId),
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
        cacheId,
        finderId: uid,
        finderCallsign: safeCallsign,
        ...avatarFields,
        note: safeNote,
        visibility: 'public',
        foundAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docPath);
    }
  } else {
    try {
      await updateDoc(docRef, {
        finderCallsign: safeCallsign,
        ...avatarFields,
        note: safeNote,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docPath);
    }
  }
}

export async function deleteGeocacheLogInCloud(
  uidRaw: string,
  cacheIdRaw: string
): Promise<void> {
  await assertCloudSessionHealthy();
  const uid = sanitizeFirestoreId(uidRaw);
  const cacheId = sanitizeFirestoreId(cacheIdRaw);
  const docPath = `geocaches/${cacheId}/logs/${uid}`;
  try {
    await deleteDoc(doc(db, 'geocaches', cacheId, 'logs', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function resetExplorerCharacterInCloud(
  uidRaw: string,
  initialProgress: ExplorerProgress
): Promise<void> {
  await assertCloudSessionHealthy();
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

  // 2c. Delete all opened Archivist Chests in /explorers/{uid}/archivistChests
  const chestsPath = `explorers/${uid}/archivistChests`;
  try {
    const chestQuery = query(
      collection(db, 'explorers', uid, 'archivistChests'),
      where('ownerId', '==', uid)
    );
    const chestSnap = await getDocs(chestQuery);
    const BATCH = 10;
    for (let i = 0; i < chestSnap.docs.length; i += BATCH) {
      const slice = chestSnap.docs.slice(i, i + BATCH);
      await Promise.all(
        slice.map(async (d) => {
          try {
            await deleteDoc(d.ref);
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `${chestsPath}/${d.id}`);
          }
        })
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, chestsPath);
  }

  // 2d. Delete all public Explorer Geocaches authored by this explorer
  try {
    const geoQuery = query(
      collection(db, 'geocaches'),
      where('authorId', '==', uid),
      where('visibility', '==', 'public')
    );
    const geoSnap = await getDocs(geoQuery);
    const BATCH = 10;
    for (let i = 0; i < geoSnap.docs.length; i += BATCH) {
      const slice = geoSnap.docs.slice(i, i + BATCH);
      await Promise.all(
        slice.map(async (d) => {
          try {
            await deleteDoc(d.ref);
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `geocaches/${d.id}`);
          }
        })
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'geocaches');
  }

  // 2e. Delete all public Community Challenge leaderboard entries authored by this explorer
  try {
    const chQuery = query(
      collection(db, 'challengeEntries'),
      where('explorerId', '==', uid),
      where('visibility', '==', 'public')
    );
    const chSnap = await getDocs(chQuery);
    const BATCH = 10;
    for (let i = 0; i < chSnap.docs.length; i += BATCH) {
      const slice = chSnap.docs.slice(i, i + BATCH);
      await Promise.all(
        slice.map(async (d) => {
          try {
            await deleteDoc(d.ref);
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `challengeEntries/${d.id}`);
          }
        })
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'challengeEntries');
  }

  // 2f. Delete public Pantheon leaderboard entry for this explorer before resetting master profile
  const pantheonPath = `pantheonEntries/${uid}`;
  const pantheonRef = doc(db, 'pantheonEntries', uid);
  let pantheonSnap;
  try {
    pantheonSnap = await getDoc(pantheonRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, pantheonPath);
  }
  if (pantheonSnap && pantheonSnap.exists()) {
    try {
      await deleteDoc(pantheonRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, pantheonPath);
    }
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
    familiarId: sanitizeFamiliar(initialProgress.familiarId),
    pinnedTrophyId: '',
    walkedMeters: 0,
    nightFeatsCount: 0,
    stormFeatsCount: 0,
    completedContractsCount: 0,
    solvedRiddlesCount: 0,
    completedHuntsCount: 0,
    claimedAlmanacCount: 0,
    completedNarrativesCount: 0,
    claimedCommunityChallengesCount: 0,
    claimedLiveEventsCount: 0,
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

// ============================================================================
// DÉFIS COMMUNAUTAIRES & CLASSEMENTS (/challengeEntries/{entryId})
// ============================================================================

const VALID_CHALLENGE_CADENCES: ChallengeCadence[] = ['quotidien', 'hebdomadaire', 'mensuel'];

function sanitizeChallengeCadence(raw?: string): ChallengeCadence {
  return VALID_CHALLENGE_CADENCES.includes(raw as ChallengeCadence)
    ? (raw as ChallengeCadence)
    : 'quotidien';
}

function sanitizePeriodKey(raw?: string): string {
  const cleaned = String(raw || '').trim();
  if (/^[0-9]{4}-[0-9]{2}$/.test(cleaned)) return cleaned;
  const now = new Date();
  const m = now.getUTCMonth() + 1;
  return `${now.getUTCFullYear()}-${m < 10 ? `0${m}` : m}`;
}

export async function upsertCommunityChallengeEntryInCloud(params: {
  uidRaw: string;
  challengeId: string;
  cadence: ChallengeCadence;
  periodKey: string;
  contributionCount: number;
  points: number;
  regionLabel: string;
  progress: ExplorerProgress;
}): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  if (params.contributionCount < 1 || params.points < 1) return;
  await assertCloudSessionHealthy();

  const uid = sanitizeFirestoreId(params.uidRaw);
  const safeChallengeId = sanitizeFirestoreId(params.challengeId).slice(0, 60);
  const entryId = sanitizeFirestoreId(`${safeChallengeId}_${uid.slice(0, 64)}`);
  const entryPath = `challengeEntries/${entryId}`;
  const entryRef = doc(db, 'challengeEntries', entryId);

  let existingSnap;
  try {
    existingSnap = await getDoc(entryRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, entryPath);
  }

  const safeCallsign = clampStr(params.progress.displayName || 'Explorateur', 1, 60, 'Explorateur');
  const safeRegion = clampStr(params.regionLabel || 'Secteur exploré', 1, 100, 'Secteur exploré');
  const safeCount = clampNum(Math.round(params.contributionCount), 1, 10000);
  const safePoints = clampNum(Math.round(params.points), 1, 1000000);

  if (!existingSnap.exists()) {
    try {
      await setDoc(entryRef, {
        challengeId: safeChallengeId,
        cadence: sanitizeChallengeCadence(params.cadence),
        periodKey: sanitizePeriodKey(params.periodKey),
        explorerId: uid,
        explorerCallsign: safeCallsign,
        explorerGender: sanitizeGender(params.progress.gender),
        explorerAvatarPreset: sanitizeAvatarPreset(params.progress.avatarPreset),
        explorerSkinTone: sanitizeSkinTone(params.progress.skinTone),
        explorerHeadgearId: sanitizeHeadgear(params.progress.headgearId),
        explorerOutfitId: sanitizeOutfit(params.progress.outfitId),
        explorerFamiliarId: sanitizeFamiliar(params.progress.familiarId),
        explorerPinnedTrophyId: sanitizePinnedTrophyId(params.progress.pinnedTrophyId),
        contributionCount: safeCount,
        points: safePoints,
        regionLabel: safeRegion,
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, entryPath);
    }
  } else {
    const prev = existingSnap.data();
    const prevCount = Number(prev.contributionCount || 0);
    const prevPoints = Number(prev.points || 0);
    const nextCount = Math.max(prevCount, safeCount);
    const nextPoints = Math.max(prevPoints, safePoints);
    const sameCallsign = String(prev.explorerCallsign || '') === safeCallsign;
    const sameOutfit = String(prev.explorerOutfitId || '') === sanitizeOutfit(params.progress.outfitId);
    const sameHeadgear = String(prev.explorerHeadgearId || '') === sanitizeHeadgear(params.progress.headgearId);
    const sameFamiliar = String(prev.explorerFamiliarId || '') === sanitizeFamiliar(params.progress.familiarId);
    if (
      nextCount <= prevCount &&
      nextPoints <= prevPoints &&
      sameCallsign &&
      sameOutfit &&
      sameHeadgear &&
      sameFamiliar
    ) {
      return;
    }
    try {
      await updateDoc(entryRef, {
        explorerCallsign: safeCallsign,
        explorerGender: sanitizeGender(params.progress.gender),
        explorerAvatarPreset: sanitizeAvatarPreset(params.progress.avatarPreset),
        explorerSkinTone: sanitizeSkinTone(params.progress.skinTone),
        explorerHeadgearId: sanitizeHeadgear(params.progress.headgearId),
        explorerOutfitId: sanitizeOutfit(params.progress.outfitId),
        explorerFamiliarId: sanitizeFamiliar(params.progress.familiarId),
        explorerPinnedTrophyId: sanitizePinnedTrophyId(params.progress.pinnedTrophyId),
        contributionCount: nextCount,
        points: nextPoints,
        regionLabel: safeRegion,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, entryPath);
    }
  }
}

function mapDocToChallengeRow(id: string, d: Record<string, unknown>): CommunityChallengeLeaderboardRow {
  return {
    entryId: id,
    challengeId: String(d.challengeId || ''),
    cadence: sanitizeChallengeCadence(String(d.cadence || 'quotidien')),
    periodKey: sanitizePeriodKey(String(d.periodKey || '')),
    explorerId: String(d.explorerId || ''),
    explorerCallsign: clampStr(String(d.explorerCallsign || 'Éclaireur'), 1, 60, 'Éclaireur'),
    contributionCount: Math.max(0, Number(d.contributionCount || 0)),
    points: Math.max(0, Number(d.points || 0)),
    regionLabel: clampStr(String(d.regionLabel || 'Secteur exploré'), 1, 100, 'Secteur exploré'),
    explorerGender: sanitizeGender(String(d.explorerGender || 'masculin')),
    explorerAvatarPreset: sanitizeAvatarPreset(String(d.explorerAvatarPreset || 'cartographe')),
    explorerSkinTone: sanitizeSkinTone(String(d.explorerSkinTone || 'hale')),
    explorerHeadgearId: sanitizeHeadgear(String(d.explorerHeadgearId || 'tricorne_fauve')),
    explorerOutfitId: sanitizeOutfit(String(d.explorerOutfitId || 'arpenteur')),
    explorerFamiliarId: sanitizeFamiliar(String(d.explorerFamiliarId || 'aucun')),
    explorerPinnedTrophyId: sanitizePinnedTrophyId(String(d.explorerPinnedTrophyId || '')),
  };
}

export function subscribeToChallengeLeaderboard(
  challengeIdRaw: string,
  onRows: (rows: CommunityChallengeLeaderboardRow[]) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !db) return () => {};
  const safeChallengeId = sanitizeFirestoreId(challengeIdRaw).slice(0, 60);
  const q = query(
    collection(db, 'challengeEntries'),
    where('challengeId', '==', safeChallengeId),
    where('visibility', '==', 'public'),
    limit(80)
  );
  return onSnapshot(
    q,
    (snap) => {
      onRows(snap.docs.map((docSnap) => mapDocToChallengeRow(docSnap.id, docSnap.data())));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'challengeEntries');
    }
  );
}

export function subscribeToPeriodChallengeLeaderboard(
  periodKeyRaw: string,
  onRows: (rows: CommunityChallengeLeaderboardRow[]) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !db) return () => {};
  const safePeriodKey = sanitizePeriodKey(periodKeyRaw);
  const q = query(
    collection(db, 'challengeEntries'),
    where('periodKey', '==', safePeriodKey),
    where('visibility', '==', 'public'),
    limit(150)
  );
  return onSnapshot(
    q,
    (snap) => {
      onRows(snap.docs.map((docSnap) => mapDocToChallengeRow(docSnap.id, docSnap.data())));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'challengeEntries');
    }
  );
}

// ============================================================================
// PANTHÉON MULTIJOUEUR GLOBAL (/pantheonEntries/{explorerId})
// ============================================================================

export async function upsertPantheonEntryInCloud(params: {
  uidRaw: string;
  regionLabel: string;
  progress: ExplorerProgress;
  metrics: PantheonMetrics;
}): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  if (params.metrics.pantheonScore <= 0 && params.metrics.discoveriesCount <= 0) return;
  await assertCloudSessionHealthy();

  const uid = sanitizeFirestoreId(params.uidRaw);
  const entryPath = `pantheonEntries/${uid}`;
  const entryRef = doc(db, 'pantheonEntries', uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(entryRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, entryPath);
  }

  const safeCallsign = clampStr(params.progress.displayName || 'Explorateur', 1, 60, 'Explorateur');
  const safeRegion = clampStr(params.regionLabel || 'Secteur exploré', 1, 100, 'Secteur exploré');
  const safeGender = sanitizeGender(params.progress.gender);
  const safeAvatar = sanitizeAvatarPreset(params.progress.avatarPreset);
  const safeSkin = sanitizeSkinTone(params.progress.skinTone);
  const safeHeadgear = sanitizeHeadgear(params.progress.headgearId);
  const safeOutfit = sanitizeOutfit(params.progress.outfitId);
  const safeFamiliar = sanitizeFamiliar(params.progress.familiarId);
  const safeTrophy = sanitizePinnedTrophyId(params.progress.pinnedTrophyId);

  const safePantheonScore = clampNum(Math.round(params.metrics.pantheonScore), 0, 50000000);
  const safeTotalXp = clampNum(Math.round(params.metrics.totalXp), 0, 10000000);
  const safeDiversityScore = clampNum(Math.round(params.metrics.diversityScore), 0, 1000000);
  const safeRarityScore = clampNum(Math.round(params.metrics.rarityScore), 0, 5000000);
  const safeDiscoveriesCount = clampNum(Math.round(params.metrics.discoveriesCount), 0, 100000);
  const safeCategoriesCount = clampNum(Math.round(params.metrics.categoriesCount), 0, 5);
  const safeStrataCount = clampNum(Math.round(params.metrics.strataCount), 0, 7);
  const safeSourcesCount = clampNum(Math.round(params.metrics.sourcesCount), 0, 50);
  const safeSecretCount = clampNum(Math.round(params.metrics.secretArchivesCount), 0, 10000);
  const safeOfficialCount = clampNum(Math.round(params.metrics.officialHeritageCount), 0, 100000);
  const safeLiveEventsCount = clampNum(Math.round(params.metrics.liveEventsCount), 0, 100000);

  if (!existingSnap || !existingSnap.exists()) {
    try {
      await setDoc(entryRef, {
        explorerId: uid,
        explorerCallsign: safeCallsign,
        regionLabel: safeRegion,
        explorerGender: safeGender,
        explorerAvatarPreset: safeAvatar,
        explorerSkinTone: safeSkin,
        explorerHeadgearId: safeHeadgear,
        explorerOutfitId: safeOutfit,
        explorerFamiliarId: safeFamiliar,
        explorerPinnedTrophyId: safeTrophy,
        pantheonScore: safePantheonScore,
        totalXp: safeTotalXp,
        diversityScore: safeDiversityScore,
        rarityScore: safeRarityScore,
        discoveriesCount: safeDiscoveriesCount,
        categoriesCount: safeCategoriesCount,
        strataCount: safeStrataCount,
        sourcesCount: safeSourcesCount,
        secretArchivesCount: safeSecretCount,
        officialHeritageCount: safeOfficialCount,
        liveEventsCount: safeLiveEventsCount,
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, entryPath);
    }
  } else {
    const prev = existingSnap.data();
    const prevPantheon = Number(prev.pantheonScore || 0);
    const prevXp = Number(prev.totalXp || 0);
    const prevDisc = Number(prev.discoveriesCount || 0);

    const nextPantheon = Math.max(prevPantheon, safePantheonScore);
    const nextXp = Math.max(prevXp, safeTotalXp);
    const nextDisc = Math.max(prevDisc, safeDiscoveriesCount);
    const nextDiversity = Math.max(Number(prev.diversityScore || 0), safeDiversityScore);
    const nextRarity = Math.max(Number(prev.rarityScore || 0), safeRarityScore);
    const nextCategories = clampNum(Math.max(Number(prev.categoriesCount || 0), safeCategoriesCount), 0, 5);
    const nextStrata = clampNum(Math.max(Number(prev.strataCount || 0), safeStrataCount), 0, 7);
    const nextSources = clampNum(Math.max(Number(prev.sourcesCount || 0), safeSourcesCount), 0, 50);
    const nextSecrets = clampNum(Math.max(Number(prev.secretArchivesCount || 0), safeSecretCount), 0, 10000);
    const nextOfficial = clampNum(Math.max(Number(prev.officialHeritageCount || 0), safeOfficialCount), 0, 100000);
    const nextLiveEvents = clampNum(Math.max(Number(prev.liveEventsCount || 0), safeLiveEventsCount), 0, 100000);

    const unchanged =
      nextPantheon <= prevPantheon &&
      nextXp <= prevXp &&
      nextDisc <= prevDisc &&
      nextDiversity <= Number(prev.diversityScore || 0) &&
      nextRarity <= Number(prev.rarityScore || 0) &&
      nextLiveEvents <= Number(prev.liveEventsCount || 0) &&
      String(prev.explorerCallsign || '') === safeCallsign &&
      String(prev.regionLabel || '') === safeRegion &&
      String(prev.explorerOutfitId || '') === safeOutfit &&
      String(prev.explorerHeadgearId || '') === safeHeadgear &&
      String(prev.explorerFamiliarId || '') === safeFamiliar &&
      String(prev.explorerPinnedTrophyId || '') === safeTrophy;

    if (unchanged) return;

    try {
      await updateDoc(entryRef, {
        explorerCallsign: safeCallsign,
        regionLabel: safeRegion,
        explorerGender: safeGender,
        explorerAvatarPreset: safeAvatar,
        explorerSkinTone: safeSkin,
        explorerHeadgearId: safeHeadgear,
        explorerOutfitId: safeOutfit,
        explorerFamiliarId: safeFamiliar,
        explorerPinnedTrophyId: safeTrophy,
        pantheonScore: nextPantheon,
        totalXp: nextXp,
        diversityScore: nextDiversity,
        rarityScore: nextRarity,
        discoveriesCount: nextDisc,
        categoriesCount: nextCategories,
        strataCount: nextStrata,
        sourcesCount: nextSources,
        secretArchivesCount: nextSecrets,
        officialHeritageCount: nextOfficial,
        liveEventsCount: nextLiveEvents,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, entryPath);
    }
  }
}

function mapDocToPantheonRow(id: string, d: Record<string, unknown>): PantheonLeaderboardRow {
  return {
    explorerId: String(d.explorerId || id),
    explorerCallsign: clampStr(String(d.explorerCallsign || 'Éclaireur'), 1, 60, 'Éclaireur'),
    regionLabel: clampStr(String(d.regionLabel || 'Secteur exploré'), 1, 100, 'Secteur exploré'),
    pantheonScore: Math.max(0, Number(d.pantheonScore || 0)),
    totalXp: Math.max(0, Number(d.totalXp || 0)),
    diversityScore: Math.max(0, Number(d.diversityScore || 0)),
    rarityScore: Math.max(0, Number(d.rarityScore || 0)),
    discoveriesCount: Math.max(0, Number(d.discoveriesCount || 0)),
    categoriesCount: clampNum(Number(d.categoriesCount || 0), 0, 5),
    strataCount: clampNum(Number(d.strataCount || 0), 0, 7),
    sourcesCount: clampNum(Number(d.sourcesCount || 0), 0, 50),
    secretArchivesCount: Math.max(0, Number(d.secretArchivesCount || 0)),
    officialHeritageCount: Math.max(0, Number(d.officialHeritageCount || 0)),
    liveEventsCount: Math.max(0, Number(d.liveEventsCount || 0)),
    explorerGender: sanitizeGender(String(d.explorerGender || 'masculin')),
    explorerAvatarPreset: sanitizeAvatarPreset(String(d.explorerAvatarPreset || 'cartographe')),
    explorerSkinTone: sanitizeSkinTone(String(d.explorerSkinTone || 'hale')),
    explorerHeadgearId: sanitizeHeadgear(String(d.explorerHeadgearId || 'tricorne_fauve')),
    explorerOutfitId: sanitizeOutfit(String(d.explorerOutfitId || 'arpenteur')),
    explorerFamiliarId: sanitizeFamiliar(String(d.explorerFamiliarId || 'aucun')),
    explorerPinnedTrophyId: sanitizePinnedTrophyId(String(d.explorerPinnedTrophyId || '')),
  };
}

export function subscribeToPantheonLeaderboard(
  onRows: (rows: PantheonLeaderboardRow[]) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !db) return () => {};
  const q = query(
    collection(db, 'pantheonEntries'),
    where('visibility', '==', 'public'),
    limit(120)
  );
  return onSnapshot(
    q,
    (snap) => {
      onRows(snap.docs.map((docSnap) => mapDocToPantheonRow(docSnap.id, docSnap.data())));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'pantheonEntries');
    }
  );
}



