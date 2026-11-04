import { createClient, type SupabaseClient, type User as SupabaseNativeUser } from '@supabase/supabase-js';
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

// Default project credentials identified from Supabase dashboard
const DEFAULT_SUPABASE_URL = 'https://iiuavileukbczktzqdbs.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_LvefQjGqsWeE9sLtspBhLQ_cWKgzZu-';

// Environment variables or fallback local storage overrides (helpful for mobile testing)
const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

function getStoredUrl(): string {
  if (typeof window === 'undefined') return '';
  const val = (window.localStorage.getItem('terra16_supabase_url') || '').trim();
  return val.startsWith('http') ? val : '';
}

function getStoredKey(): string {
  if (typeof window === 'undefined') return '';
  const val = (window.localStorage.getItem('terra16_supabase_anon_key') || '').trim();
  return val.length > 20 ? val : '';
}

export const SUPABASE_URL = envUrl || getStoredUrl() || DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY = envKey || getStoredKey() || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  SUPABASE_URL.startsWith('http') &&
  SUPABASE_ANON_KEY.length > 20
);
export const isFirebaseConfigured = isSupabaseConfigured;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function configureSupabaseRuntimeCredentials(url: string, anonKey: string): boolean {
  if (typeof window === 'undefined') return false;
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();
  if (cleanUrl.startsWith('http') && cleanKey.length > 20) {
    window.localStorage.setItem('terra16_supabase_url', cleanUrl);
    window.localStorage.setItem('terra16_supabase_anon_key', cleanKey);
    window.location.reload();
    return true;
  }
  return false;
}

export function clearSupabaseRuntimeCredentials(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('terra16_supabase_url');
  window.localStorage.removeItem('terra16_supabase_anon_key');
  window.location.reload();
}

// Normalized user interface compatible with app components
export interface ExplorerAuthUser {
  id: string;
  uid: string; // alias to ease migration from Firebase's user.uid
  email?: string | null;
  displayName?: string | null;
  emailVerified?: boolean;
  isAnonymous?: boolean;
}

export type User = ExplorerAuthUser;

export function normalizeSupabaseUser(u: SupabaseNativeUser | null): ExplorerAuthUser | null {
  if (!u) return null;
  const name =
    u.user_metadata?.full_name ||
    u.user_metadata?.name ||
    u.user_metadata?.display_name ||
    (u.email ? u.email.split('@')[0] : 'Explorateur');

  return {
    id: u.id,
    uid: u.id,
    email: u.email ?? null,
    displayName: name,
    emailVerified: Boolean(u.email_confirmed_at || u.confirmed_at || true), // In Supabase or OAuth, user is verified
    isAnonymous: u.is_anonymous ?? false,
  };
}

export function isTransientCloudOfflineError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('CLOUD_OFFLINE') ||
    msg.includes('the client is offline') ||
    msg.includes('unavailable') ||
    msg.includes('network-request-failed') ||
    msg.includes('Failed to fetch') ||
    msg.includes('SUPABASE_NOT_CONFIGURED')
  );
}

export function formatSupabaseAuthErrorFr(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('SUPABASE_NOT_CONFIGURED')) {
    return 'Mode Sauvegarde Locale actif : les variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY ne sont pas encore configurées.';
  }
  if (raw.includes('popup-closed') || raw.includes('cancelled')) {
    return 'La fenêtre de connexion a été refermée avant validation.';
  }
  if (raw.includes('Failed to fetch') || raw.includes('network')) {
    return 'Réseau momentanément indisponible : votre Grimoire conserve toutes vos découvertes sur cet appareil.';
  }
  if (raw.includes('Email not confirmed')) {
    return 'Veuillez confirmer votre adresse email en cliquant sur le lien reçu par courriel.';
  }
  if (raw.includes('Invalid login credentials')) {
    return 'Identifiants ou code magique invalide.';
  }
  return 'Synchronisation Cloud Supabase momentanément indisponible. Vos découvertes restent sauvegardées sur cet appareil.';
}
export { formatSupabaseAuthErrorFr as formatFirebaseAuthErrorFr };

export interface AuthSessionPreflightResult {
  validUser: ExplorerAuthUser | null;
  cloudReachable: boolean;
  warningMessage: string;
}

export async function validateExplorerAuthSession(
  candidateUser?: ExplorerAuthUser | null
): Promise<AuthSessionPreflightResult> {
  if (!supabase || !isSupabaseConfigured) {
    return { validUser: null, cloudReachable: false, warningMessage: '' };
  }
  const browserOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
  if (!browserOnline) {
    return { validUser: candidateUser || null, cloudReachable: false, warningMessage: '' };
  }

  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      return { validUser: null, cloudReachable: true, warningMessage: '' };
    }
    const normalized = normalizeSupabaseUser(session.user);
    return { validUser: normalized, cloudReachable: true, warningMessage: '' };
  } catch (err) {
    return { validUser: null, cloudReachable: false, warningMessage: formatSupabaseAuthErrorFr(err) };
  }
}

// ----------------------------------------------------------------------------
// AUTHENTICATION FLOWS (Mobile PWA Friendly: Native Redirect or Magic Link OTP)
// ----------------------------------------------------------------------------

export async function signInExplorerWithGoogle(): Promise<void> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(formatSupabaseAuthErrorFr(new Error('SUPABASE_NOT_CONFIGURED')));
  }
  const redirectOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectOrigin,
    },
  });
  if (error) {
    throw new Error(formatSupabaseAuthErrorFr(error));
  }
}

export async function signInExplorerWithEmailOtp(email: string): Promise<void> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(formatSupabaseAuthErrorFr(new Error('SUPABASE_NOT_CONFIGURED')));
  }
  const redirectOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectOrigin,
    },
  });
  if (error) {
    throw new Error(formatSupabaseAuthErrorFr(error));
  }
}

export async function verifyExplorerEmailOtp(email: string, token: string): Promise<ExplorerAuthUser> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(formatSupabaseAuthErrorFr(new Error('SUPABASE_NOT_CONFIGURED')));
  }
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error || !data.user) {
    throw new Error(formatSupabaseAuthErrorFr(error || new Error('Erreur de vérification du code.')));
  }
  return normalizeSupabaseUser(data.user)!;
}

export async function signOutExplorer(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function onSupabaseAuthStateChange(
  callback: (user: ExplorerAuthUser | null) => void
): () => void {
  if (!supabase || !isSupabaseConfigured) {
    callback(null);
    return () => {};
  }

  // Initial session check
  supabase.auth.getSession().then(({ data: { session } }) => {
    callback(normalizeSupabaseUser(session?.user ?? null));
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(normalizeSupabaseUser(session?.user ?? null));
  });

  return () => {
    subscription.unsubscribe();
  };
}

// ----------------------------------------------------------------------------
// SANITIZERS & HELPERS
// ----------------------------------------------------------------------------

export function sanitizeFirestoreId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned.length >= 1 ? cleaned : 'id_fallback';
}

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
const VALID_CHEST_ARCHETYPES: ArchivistChestArchetype[] = [
  'sommet_colline',
  'confluence_eaux',
  'cul_de_sac_forestier',
  'clairiere_sylvestre',
  'bouche_souterraine',
];

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

// ----------------------------------------------------------------------------
// 1. EXPLORER PROFILE CRUD & SYNC
// ----------------------------------------------------------------------------

export async function ensureExplorerProfileInCloud(
  user: ExplorerAuthUser,
  localProgress: ExplorerProgress
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const uid = user.id;

  const { data: existing } = await supabase
    .from('explorers')
    .select('*')
    .eq('owner_id', uid)
    .maybeSingle();

  const fallbackName = clampStr(
    user.displayName || localProgress.displayName || 'Explorateur',
    1,
    60,
    'Explorateur'
  );

  if (!existing) {
    await supabase.from('explorers').insert({
      owner_id: uid,
      display_name: fallbackName,
      total_xp: clampNum(Math.round(localProgress.totalXp), 0, 10000000),
      xp_histoire: clampNum(Math.round(localProgress.xpHistoire), 0, 10000000),
      xp_geographie: clampNum(Math.round(localProgress.xpGeographie), 0, 10000000),
      xp_ecosysteme: clampNum(Math.round(localProgress.xpEcosysteme), 0, 10000000),
      xp_etrange: clampNum(Math.round(localProgress.xpEtrange), 0, 10000000),
      xp_legende: clampNum(Math.round(localProgress.xpLegende || 0), 0, 10000000),
      gender: sanitizeGender(localProgress.gender),
      avatar_preset: sanitizeAvatarPreset(localProgress.avatarPreset),
      skin_tone: sanitizeSkinTone(localProgress.skinTone),
      headgear_id: sanitizeHeadgear(localProgress.headgearId),
      outfit_id: sanitizeOutfit(localProgress.outfitId),
      tool_id: sanitizeTool(localProgress.toolId),
      pack_id: sanitizePack(localProgress.packId),
      familiar_id: sanitizeFamiliar(localProgress.familiarId),
      pinned_trophy_id: sanitizePinnedTrophyId(localProgress.pinnedTrophyId),
      walked_meters: clampNum(Math.round(localProgress.walkedMeters || 0), 0, 100000000),
      night_feats_count: clampNum(Math.round(localProgress.nightFeatsCount || 0), 0, 100000),
      storm_feats_count: clampNum(Math.round(localProgress.stormFeatsCount || 0), 0, 100000),
      completed_contracts_count: clampNum(Math.round(localProgress.completedContractsCount || 0), 0, 100000),
      solved_riddles_count: clampNum(Math.round(localProgress.solvedRiddlesCount || 0), 0, 100000),
      completed_hunts_count: clampNum(Math.round(localProgress.completedHuntsCount || 0), 0, 100000),
      claimed_almanac_count: clampNum(Math.round(localProgress.claimedAlmanacCount || 0), 0, 100000),
      completed_narratives_count: clampNum(Math.round(localProgress.completedNarrativesCount || 0), 0, 100000),
      claimed_community_challenges_count: clampNum(Math.round(localProgress.claimedCommunityChallengesCount || 0), 0, 100000),
      claimed_live_events_count: clampNum(Math.round(localProgress.claimedLiveEventsCount || 0), 0, 100000),
      discoveries_count: clampNum(Math.round(localProgress.discoveriesCount), 0, 100000),
      completed_missions: sanitizeStringArray(localProgress.completedMissions, 50),
      updated_at: new Date().toISOString(),
    });
  } else {
    const mergedTotalXp = Math.max(Number(existing.total_xp || 0), Math.round(localProgress.totalXp));
    const mergedDiscoveries = Math.max(Number(existing.discoveries_count || 0), Math.round(localProgress.discoveriesCount));
    const mergedMissions = Array.from(
      new Set([
        ...(Array.isArray(existing.completed_missions) ? existing.completed_missions : []),
        ...localProgress.completedMissions,
      ])
    );

    await supabase
      .from('explorers')
      .update({
        total_xp: clampNum(mergedTotalXp, 0, 10000000),
        discoveries_count: clampNum(mergedDiscoveries, 0, 100000),
        completed_missions: sanitizeStringArray(mergedMissions, 50),
        updated_at: new Date().toISOString(),
      })
      .eq('owner_id', uid);
  }
}

export async function syncProgressToCloud(
  uidRaw: string,
  progress: ExplorerProgress
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const uid = uidRaw.trim();

  await supabase
    .from('explorers')
    .update({
      total_xp: clampNum(Math.round(progress.totalXp), 0, 10000000),
      xp_histoire: clampNum(Math.round(progress.xpHistoire), 0, 10000000),
      xp_geographie: clampNum(Math.round(progress.xpGeographie), 0, 10000000),
      xp_ecosysteme: clampNum(Math.round(progress.xpEcosysteme), 0, 10000000),
      xp_etrange: clampNum(Math.round(progress.xpEtrange), 0, 10000000),
      xp_legende: clampNum(Math.round(progress.xpLegende || 0), 0, 10000000),
      gender: sanitizeGender(progress.gender),
      avatar_preset: sanitizeAvatarPreset(progress.avatarPreset),
      skin_tone: sanitizeSkinTone(progress.skinTone),
      headgear_id: sanitizeHeadgear(progress.headgearId),
      outfit_id: sanitizeOutfit(progress.outfitId),
      tool_id: sanitizeTool(progress.toolId),
      pack_id: sanitizePack(progress.packId),
      familiar_id: sanitizeFamiliar(progress.familiarId),
      pinned_trophy_id: sanitizePinnedTrophyId(progress.pinnedTrophyId),
      walked_meters: clampNum(Math.round(progress.walkedMeters || 0), 0, 100000000),
      night_feats_count: clampNum(Math.round(progress.nightFeatsCount || 0), 0, 100000),
      storm_feats_count: clampNum(Math.round(progress.stormFeatsCount || 0), 0, 100000),
      completed_contracts_count: clampNum(Math.round(progress.completedContractsCount || 0), 0, 100000),
      solved_riddles_count: clampNum(Math.round(progress.solvedRiddlesCount || 0), 0, 100000),
      completed_hunts_count: clampNum(Math.round(progress.completedHuntsCount || 0), 0, 100000),
      claimed_almanac_count: clampNum(Math.round(progress.claimedAlmanacCount || 0), 0, 100000),
      completed_narratives_count: clampNum(Math.round(progress.completedNarrativesCount || 0), 0, 100000),
      claimed_community_challenges_count: clampNum(Math.round(progress.claimedCommunityChallengesCount || 0), 0, 100000),
      claimed_live_events_count: clampNum(Math.round(progress.claimedLiveEventsCount || 0), 0, 100000),
      discoveries_count: clampNum(Math.round(progress.discoveriesCount), 0, 100000),
      completed_missions: sanitizeStringArray(progress.completedMissions, 50),
      updated_at: new Date().toISOString(),
    })
    .eq('owner_id', uid);
}

export async function updateExplorerIdentityInCloud(
  uidRaw: string,
  displayName: string,
  appearance?: Partial<ExplorerAppearance>,
  pinnedTrophyId?: TrophyId | ''
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const uid = uidRaw.trim();
  const patch: Record<string, unknown> = {
    display_name: clampStr(displayName, 1, 60, 'Explorateur'),
    updated_at: new Date().toISOString(),
  };
  if (appearance?.gender) patch.gender = sanitizeGender(appearance.gender);
  if (appearance?.avatarPreset) patch.avatar_preset = sanitizeAvatarPreset(appearance.avatarPreset);
  if (appearance?.skinTone) patch.skin_tone = sanitizeSkinTone(appearance.skinTone);
  if (appearance?.headgearId) patch.headgear_id = sanitizeHeadgear(appearance.headgearId);
  if (appearance?.outfitId) patch.outfit_id = sanitizeOutfit(appearance.outfitId);
  if (appearance?.toolId) patch.tool_id = sanitizeTool(appearance.toolId);
  if (appearance?.packId) patch.pack_id = sanitizePack(appearance.packId);
  if (appearance?.familiarId) patch.familiar_id = sanitizeFamiliar(appearance.familiarId);
  if (pinnedTrophyId !== undefined) {
    patch.pinned_trophy_id = sanitizePinnedTrophyId(pinnedTrophyId);
  }

  await supabase.from('explorers').update(patch).eq('owner_id', uid);
}

// ----------------------------------------------------------------------------
// 2. DISCOVERIES CRUD & SYNC
// ----------------------------------------------------------------------------

export async function createDiscoveryInCloud(
  uidRaw: string,
  entry: UnlockedEntry
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const uid = uidRaw.trim();
  const poiId = sanitizeFirestoreId(entry.poiId);
  const compositeId = `${uid}_${poiId}`;

  const validCategory: ExplorationCategory = [
    'histoire',
    'geographie',
    'ecosysteme',
    'etrange',
    'legende',
  ].includes(entry.category)
    ? entry.category
    : 'histoire';

  await supabase.from('discoveries').upsert({
    id: compositeId,
    owner_id: uid,
    poi_id: poiId,
    name: clampStr(entry.name, 1, 200, 'Lieu découvert'),
    category: validCategory,
    sub_type: clampStr(entry.subType, 1, 80, 'Point remarquable'),
    era_label: (entry.eraLabel || 'Strate locale').slice(0, 100),
    source: clampStr(entry.source, 1, 80, 'OpenStreetMap'),
    lat: clampNum(entry.lat, -90, 90),
    lng: clampNum(entry.lng, -180, 180),
    summary: clampStr(entry.summary, 1, 2500, 'Lieu débloqué sur le terrain.'),
    near_waterway: Boolean(entry.nearWaterway),
    waterway_name: (entry.waterwayName || '').slice(0, 120),
    safety_notice: (entry.safetyNotice || '').slice(0, 400),
    external_url: (entry.externalUrl || '').slice(0, 500),
    xp_awarded: clampNum(Math.round(entry.xpAwarded), 0, 5000),
    related_poi_ids: sanitizeStringArray(entry.relatedPoiIds, 10),
    related_poi_titles: sanitizeStringArray(entry.relatedPoiTitles, 10),
    personal_note: (entry.personalNote || '').slice(0, 2000),
    photo_count: clampNum(Math.round(entry.photoCount), 0, 20),
    discovered_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function syncMissingDiscoveriesToCloud(
  uidRaw: string,
  localEntries: UnlockedEntry[]
): Promise<void> {
  if (!supabase || !isSupabaseConfigured || localEntries.length === 0) return;
  const uid = uidRaw.trim();

  const { data: existing } = await supabase
    .from('discoveries')
    .select('poi_id')
    .eq('owner_id', uid);

  const existingIds = new Set((existing || []).map((d) => d.poi_id));
  const missing = localEntries.filter((e) => !existingIds.has(sanitizeFirestoreId(e.poiId)));
  if (missing.length === 0) return;

  const BATCH_SIZE = 25;
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const slice = missing.slice(i, i + BATCH_SIZE);
    const rows = slice.map((entry) => ({
      id: `${uid}_${sanitizeFirestoreId(entry.poiId)}`,
      owner_id: uid,
      poi_id: sanitizeFirestoreId(entry.poiId),
      name: clampStr(entry.name, 1, 200, 'Lieu découvert'),
      category: entry.category,
      sub_type: clampStr(entry.subType, 1, 80, 'Point remarquable'),
      era_label: (entry.eraLabel || 'Strate locale').slice(0, 100),
      source: clampStr(entry.source, 1, 80, 'OpenStreetMap'),
      lat: clampNum(entry.lat, -90, 90),
      lng: clampNum(entry.lng, -180, 180),
      summary: clampStr(entry.summary, 1, 2500, 'Lieu débloqué sur le terrain.'),
      near_waterway: Boolean(entry.nearWaterway),
      waterway_name: (entry.waterwayName || '').slice(0, 120),
      safety_notice: (entry.safetyNotice || '').slice(0, 400),
      external_url: (entry.externalUrl || '').slice(0, 500),
      xp_awarded: clampNum(Math.round(entry.xpAwarded), 0, 5000),
      related_poi_ids: sanitizeStringArray(entry.relatedPoiIds, 10),
      related_poi_titles: sanitizeStringArray(entry.relatedPoiTitles, 10),
      personal_note: (entry.personalNote || '').slice(0, 2000),
      photo_count: clampNum(Math.round(entry.photoCount), 0, 20),
      discovered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    await supabase.from('discoveries').upsert(rows);
  }
}

export async function updateDiscoveryJournalInCloud(
  uidRaw: string,
  poiIdRaw: string,
  personalNote: string,
  photoCount: number
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const uid = uidRaw.trim();
  const poiId = sanitizeFirestoreId(poiIdRaw);
  const compositeId = `${uid}_${poiId}`;

  await supabase
    .from('discoveries')
    .update({
      personal_note: (personalNote || '').slice(0, 2000),
      photo_count: clampNum(Math.round(photoCount), 0, 20),
      updated_at: new Date().toISOString(),
    })
    .eq('id', compositeId);
}

// ----------------------------------------------------------------------------
// 3. SPECIMENS CRUD & SYNC (Botanique & Géologie)
// ----------------------------------------------------------------------------

export async function upsertSpecimenInCloud(
  uidRaw: string,
  specimen: CollectedSpecimen
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const uid = uidRaw.trim();
  const specId = sanitizeFirestoreId(specimen.specimenId).slice(0, 64);
  const compositeId = `${uid}_${specId}`;

  await supabase.from('specimens').upsert({
    id: compositeId,
    owner_id: uid,
    specimen_id: specId,
    domain: specimen.domain === 'geologie' ? 'geologie' : 'botanique',
    affinity: specimen.affinity || 'calcaire',
    name: clampStr(specimen.name, 1, 160, 'Spécimen'),
    latin_or_mineral_name: clampStr(specimen.latinOrMineralName, 1, 160, 'Species'),
    family_label: clampStr(specimen.familyLabel, 1, 120, 'Herbier'),
    lithology_label: clampStr(specimen.lithologyLabel, 1, 160, 'Socle local'),
    bedrock_period: clampStr(specimen.bedrockPeriod, 1, 100, 'Ère géologique'),
    bedrock_age_ma: (specimen.bedrockAgeMa || '').slice(0, 60),
    region_label: clampStr(specimen.regionLabel, 1, 140, 'Contrée'),
    habitat_label: clampStr(specimen.habitatLabel, 1, 160, 'Terrain'),
    lat: clampNum(specimen.lat, -90, 90),
    lng: clampNum(specimen.lng, -180, 180),
    altitude_meters: specimen.altitudeMeters,
    is_subterranean: Boolean(specimen.isSubterranean),
    harvest_count: clampNum(Math.round(specimen.harvestCount || 1), 1, 100000),
    description: clampStr(specimen.description, 1, 1000, 'Échantillon relevé sur le terrain.'),
    updated_at: new Date().toISOString(),
  });
}

export async function syncMissingSpecimensToCloud(
  uidRaw: string,
  localSpecimens: CollectedSpecimen[]
): Promise<void> {
  if (!supabase || !isSupabaseConfigured || localSpecimens.length === 0) return;
  const uid = uidRaw.trim();

  for (const spec of localSpecimens) {
    await upsertSpecimenInCloud(uid, spec);
  }
}

// ----------------------------------------------------------------------------
// 4. ARCHIVIST CHESTS CRUD & SYNC
// ----------------------------------------------------------------------------

export async function recordOpenedArchivistChestInCloud(
  uidRaw: string,
  chest: OpenedArchivistChestRecord
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const uid = uidRaw.trim();
  const chestId = sanitizeFirestoreId(chest.chestId).slice(0, 80);
  const compositeId = `${uid}_${chestId}`;

  const safeArchetype: ArchivistChestArchetype = VALID_CHEST_ARCHETYPES.includes(chest.archetype)
    ? chest.archetype
    : 'clairiere_sylvestre';

  await supabase.from('archivist_chests').upsert({
    id: compositeId,
    owner_id: uid,
    chest_id: chestId,
    archetype: safeArchetype,
    title: clampStr(chest.title, 1, 160, "Coffre d'Archiviste"),
    place_note: clampStr(chest.placeNote, 1, 240, 'Point topographique remarquable.'),
    relic_id: sanitizeFirestoreId(chest.relicId).slice(0, 64),
    relic_name: clampStr(chest.relicName, 1, 160, "Relique d'Archiviste"),
    category: chest.category || 'geographie',
    region_label: clampStr(chest.regionLabel || 'Secteur local', 1, 140, 'Secteur local'),
    lat: clampNum(chest.lat, -90, 90),
    lng: clampNum(chest.lng, -180, 180),
    altitude_meters: chest.altitudeMeters,
    is_subterranean: Boolean(chest.isSubterranean),
    xp_awarded: Math.round(clampNum(chest.xpAwarded, 0, 5000)),
    opened_at: new Date().toISOString(),
  });
}

export async function syncMissingArchivistChestsToCloud(
  uidRaw: string,
  localChests: OpenedArchivistChestRecord[]
): Promise<void> {
  if (!supabase || !isSupabaseConfigured || localChests.length === 0) return;
  const uid = uidRaw.trim();

  for (const ch of localChests) {
    await recordOpenedArchivistChestInCloud(uid, ch);
  }
}

// ----------------------------------------------------------------------------
// 5. MASTER EXPLORER SUBSCRIPTION (Profile + Discoveries + Specimens + Chests)
// ----------------------------------------------------------------------------

export function subscribeToCloudExplorer(
  uidRaw: string,
  onProfile: (p: ExplorerProgress) => void,
  onDiscoveries: (entries: UnlockedEntry[]) => void,
  onSpecimens?: (specimens: CollectedSpecimen[]) => void,
  onArchivistChests?: (chests: OpenedArchivistChestRecord[]) => void
): () => void {
  if (!supabase || !isSupabaseConfigured) return () => {};
  const uid = uidRaw.trim();

  // Load and subscribe to profile
  const fetchProfile = async () => {
    const { data: d } = await supabase!
      .from('explorers')
      .select('*')
      .eq('owner_id', uid)
      .maybeSingle();

    if (d) {
      onProfile({
        displayName: String(d.display_name || 'Explorateur'),
        totalXp: Number(d.total_xp || 0),
        xpHistoire: Number(d.xp_histoire || 0),
        xpGeographie: Number(d.xp_geographie || 0),
        xpEcosysteme: Number(d.xp_ecosysteme || 0),
        xpEtrange: Number(d.xp_etrange || 0),
        xpLegende: Number(d.xp_legende || 0),
        gender: sanitizeGender(String(d.gender || 'masculin')),
        avatarPreset: sanitizeAvatarPreset(String(d.avatar_preset || 'cartographe')),
        skinTone: sanitizeSkinTone(String(d.skin_tone || 'hale')),
        headgearId: sanitizeHeadgear(String(d.headgear_id || 'tricorne_fauve')),
        outfitId: sanitizeOutfit(String(d.outfit_id || 'arpenteur')),
        toolId: sanitizeTool(String(d.tool_id || 'lanterne_laiton')),
        packId: sanitizePack(String(d.pack_id || 'besace_cuir')),
        familiarId: sanitizeFamiliar(String(d.familiar_id || 'aucun')),
        pinnedTrophyId: sanitizePinnedTrophyId(String(d.pinned_trophy_id || '')),
        walkedMeters: Number(d.walked_meters || 0),
        nightFeatsCount: Number(d.night_feats_count || 0),
        stormFeatsCount: Number(d.storm_feats_count || 0),
        completedContractsCount: Number(d.completed_contracts_count || 0),
        solvedRiddlesCount: Number(d.solved_riddles_count || 0),
        completedHuntsCount: Number(d.completed_hunts_count || 0),
        claimedAlmanacCount: Number(d.claimed_almanac_count || 0),
        completedNarrativesCount: Number(d.completed_narratives_count || 0),
        claimedCommunityChallengesCount: Number(d.claimed_community_challenges_count || 0),
        claimedLiveEventsCount: Number(d.claimed_live_events_count || 0),
        discoveriesCount: Number(d.discoveries_count || 0),
        completedMissions: Array.isArray(d.completed_missions) ? d.completed_missions : [],
      });
    }
  };

  // Load discoveries
  const fetchDiscoveries = async () => {
    const { data: list } = await supabase!
      .from('discoveries')
      .select('*')
      .eq('owner_id', uid)
      .order('discovered_at', { ascending: false });

    if (list) {
      const mapped: UnlockedEntry[] = list.map((d) => ({
        poiId: d.poi_id,
        name: d.name,
        category: d.category as ExplorationCategory,
        subType: d.sub_type,
        eraLabel: d.era_label,
        source: d.source,
        lat: Number(d.lat),
        lng: Number(d.lng),
        summary: d.summary || '',
        nearWaterway: Boolean(d.near_waterway),
        waterwayName: d.waterway_name || '',
        safetyNotice: d.safety_notice || '',
        externalUrl: d.external_url || '',
        xpAwarded: Number(d.xp_awarded || 0),
        relatedPoiIds: Array.isArray(d.related_poi_ids) ? d.related_poi_ids : [],
        relatedPoiTitles: Array.isArray(d.related_poi_titles) ? d.related_poi_titles : [],
        personalNote: d.personal_note || '',
        photoCount: Number(d.photo_count || 0),
        discoveredAtIso: d.discovered_at || new Date().toISOString(),
      }));
      onDiscoveries(mapped);
    }
  };

  // Load specimens
  const fetchSpecimens = async () => {
    if (!onSpecimens) return;
    const { data: list } = await supabase!
      .from('specimens')
      .select('*')
      .eq('owner_id', uid)
      .order('updated_at', { ascending: false });

    if (list) {
      const mapped: CollectedSpecimen[] = list.map((d) => ({
        specimenId: d.specimen_id,
        domain: d.domain as SpecimenDomain,
        affinity: d.affinity as LithologyAffinity,
        name: d.name,
        latinOrMineralName: d.latin_or_mineral_name,
        familyLabel: d.family_label || '',
        lithologyLabel: d.lithology_label || '',
        bedrockPeriod: d.bedrock_period || '',
        bedrockAgeMa: d.bedrock_age_ma || '',
        regionLabel: d.region_label || '',
        habitatLabel: d.habitat_label || '',
        lat: Number(d.lat),
        lng: Number(d.lng),
        altitudeMeters: d.altitude_meters,
        isSubterranean: Boolean(d.is_subterranean),
        harvestCount: Number(d.harvest_count || 1),
        firstCollectedIso: d.first_collected_at || new Date().toISOString(),
        lastCollectedIso: d.updated_at || new Date().toISOString(),
        description: d.description || '',
      }));
      onSpecimens(mapped);
    }
  };

  // Load chests
  const fetchChests = async () => {
    if (!onArchivistChests) return;
    const { data: list } = await supabase!
      .from('archivist_chests')
      .select('*')
      .eq('owner_id', uid)
      .order('opened_at', { ascending: false });

    if (list) {
      const mapped: OpenedArchivistChestRecord[] = list.map((d) => ({
        chestId: d.chest_id,
        archetype: d.archetype as ArchivistChestArchetype,
        title: d.title,
        placeNote: d.place_note || '',
        relicId: d.relic_id,
        relicName: d.relic_name,
        category: d.category as ExplorationCategory,
        regionLabel: d.region_label || '',
        lat: Number(d.lat),
        lng: Number(d.lng),
        altitudeMeters: d.altitude_meters,
        isSubterranean: Boolean(d.is_subterranean),
        xpAwarded: Number(d.xp_awarded || 0),
        openedAtIso: d.opened_at || new Date().toISOString(),
      }));
      onArchivistChests(mapped);
    }
  };

  fetchProfile();
  fetchDiscoveries();
  fetchSpecimens();
  fetchChests();

  // Realtime channel for explorer changes
  const channel = supabase
    .channel(`explorer_${uid}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'explorers', filter: `owner_id=eq.${uid}` },
      () => fetchProfile()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'discoveries', filter: `owner_id=eq.${uid}` },
      () => fetchDiscoveries()
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
}

// ----------------------------------------------------------------------------
// 6. CHARACTER RESET (Purge all tables for this user + reset to Lvl 1)
// ----------------------------------------------------------------------------

export async function resetExplorerCharacterInCloud(
  uidRaw: string,
  initialProgress: ExplorerProgress
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const uid = uidRaw.trim();

  // Purge owned items
  await supabase.from('discoveries').delete().eq('owner_id', uid);
  await supabase.from('specimens').delete().eq('owner_id', uid);
  await supabase.from('archivist_chests').delete().eq('owner_id', uid);
  await supabase.from('cairns').delete().eq('owner_id', uid);
  await supabase.from('geocaches').delete().eq('owner_id', uid);
  await supabase.from('geocache_logs').delete().eq('owner_id', uid);
  await supabase.from('community_challenge_entries').delete().eq('owner_id', uid);
  await supabase.from('pantheon_entries').delete().eq('owner_id', uid);

  // Reset profile in explorers table to level 1
  await supabase.from('explorers').upsert({
    owner_id: uid,
    display_name: clampStr(initialProgress.displayName || 'Explorateur', 1, 60, 'Explorateur'),
    total_xp: 0,
    xp_histoire: 0,
    xp_geographie: 0,
    xp_ecosysteme: 0,
    xp_etrange: 0,
    xp_legende: 0,
    gender: sanitizeGender(initialProgress.gender),
    avatar_preset: sanitizeAvatarPreset(initialProgress.avatarPreset),
    skin_tone: sanitizeSkinTone(initialProgress.skinTone),
    headgear_id: sanitizeHeadgear(initialProgress.headgearId),
    outfit_id: sanitizeOutfit(initialProgress.outfitId),
    tool_id: sanitizeTool(initialProgress.toolId),
    pack_id: sanitizePack(initialProgress.packId),
    familiar_id: sanitizeFamiliar(initialProgress.familiarId),
    pinned_trophy_id: '',
    walked_meters: 0,
    night_feats_count: 0,
    storm_feats_count: 0,
    completed_contracts_count: 0,
    solved_riddles_count: 0,
    completed_hunts_count: 0,
    claimed_almanac_count: 0,
    completed_narratives_count: 0,
    claimed_community_challenges_count: 0,
    claimed_live_events_count: 0,
    discoveries_count: 0,
    completed_missions: [],
    updated_at: new Date().toISOString(),
  });
}

// ----------------------------------------------------------------------------
// 7. CAIRNS DE TERRAIN
// ----------------------------------------------------------------------------

export function subscribeToPoiCairns(
  poiIdRaw: string,
  onCairns: (cairns: ExplorerCairn[]) => void
): () => void {
  if (!supabase || !isSupabaseConfigured) {
    onCairns([]);
    return () => {};
  }
  const poiId = sanitizeFirestoreId(poiIdRaw);

  const fetchCairns = async () => {
    const { data: list } = await supabase!
      .from('cairns')
      .select('*')
      .eq('poi_id', poiId)
      .order('created_at', { ascending: false })
      .limit(25);

    if (list) {
      onCairns(
        list.map((c) => ({
          id: c.id,
          authorId: c.owner_id,
          authorCallsign: c.creator_name,
          poiId: c.poi_id,
          poiName: c.poi_name || '',
          tag: c.tag as CairnTag,
          message: c.message,
          createdAtIso: c.created_at,
        }))
      );
    }
  };

  fetchCairns();

  const channel = supabase
    .channel(`cairns_${poiId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cairns', filter: `poi_id=eq.${poiId}` },
      () => fetchCairns()
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
}

export async function upsertPoiCairnInCloud(params: {
  uidRaw: string;
  authorCallsign: string;
  authorAppearance?: ExplorerAppearance;
  poiEntry: UnlockedEntry;
  tag: CairnTag;
  message: string;
}): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const uid = params.uidRaw.trim();
  const poiId = sanitizeFirestoreId(params.poiEntry.poiId);
  const cairnId = `${uid}_${poiId}`;

  // Ensure parent discovery is in cloud
  await createDiscoveryInCloud(uid, params.poiEntry);

  await supabase.from('cairns').upsert({
    id: cairnId,
    owner_id: uid,
    creator_name: clampStr(params.authorCallsign.trim(), 1, 60, 'Éclaireur'),
    poi_id: poiId,
    tag: params.tag || 'architecture',
    message: clampStr(params.message.trim(), 3, 280, 'Observation sur le terrain.'),
    created_at: new Date().toISOString(),
  });
}

export async function deletePoiCairnInCloud(uidRaw: string, poiIdRaw: string): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const uid = uidRaw.trim();
  const poiId = sanitizeFirestoreId(poiIdRaw);
  const cairnId = `${uid}_${poiId}`;
  await supabase.from('cairns').delete().eq('id', cairnId);
}

// ----------------------------------------------------------------------------
// 8. GÉOCACHES & LOGS
// ----------------------------------------------------------------------------

export function buildGeocacheDocId(uidRaw: string, lat: number, lng: number): string {
  const uidPart = sanitizeFirestoreId(uidRaw).slice(0, 44);
  const latTag = `${lat >= 0 ? 'N' : 'S'}${Math.abs(Math.round(lat * 10000))}`;
  const lngTag = `${lng >= 0 ? 'E' : 'W'}${Math.abs(Math.round(lng * 10000))}`;
  return sanitizeFirestoreId(`gc_${uidPart}_${latTag}_${lngTag}`).slice(0, 110);
}

export function subscribeToNearbyGeocaches(
  sectorKeys: string[],
  onCaches: (caches: ExplorerGeocacheRecord[]) => void
): () => void {
  if (!supabase || !isSupabaseConfigured || sectorKeys.length === 0) {
    onCaches([]);
    return () => {};
  }

  const cleanSectors = Array.from(new Set(sectorKeys.map((s) => s.trim()))).slice(0, 10);

  const fetchCaches = async () => {
    const { data: list } = await supabase!
      .from('geocaches')
      .select('*')
      .in('sector_key', cleanSectors)
      .order('created_at', { ascending: false })
      .limit(40);

    if (list) {
      onCaches(
        list.map((c) => ({
          id: c.id,
          authorId: c.owner_id,
          authorCallsign: 'Éclaireur',
          sectorKey: c.sector_key,
          placementMode: (c.placement_mode === 'unlocked_poi' ? 'unlocked_poi' : 'gps_live') as GeocachePlacementMode,
          lat: Number(c.lat),
          lng: Number(c.lng),
          isSubterranean: false,
          regionLabel: 'Secteur local',
          title: c.title,
          riddleHint: c.clue_hint,
          giftKind: (c.gift_kind === 'specimen' ? 'specimen' : 'relic') as GeocacheGiftKind,
          giftId: 'jeton_arpenteur',
          giftName: c.gift_name,
          giftDomain: (c.gift_domain as GeocacheGiftDomain) || 'relique',
          createdAtIso: c.created_at,
        }))
      );
    }
  };

  fetchCaches();

  const channel = supabase
    .channel('geocaches_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'geocaches' }, () =>
      fetchCaches()
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
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
  if (!supabase || !isSupabaseConfigured) return '';
  const uid = params.uidRaw.trim();
  const cacheId = buildGeocacheDocId(uid, params.lat, params.lng);

  await supabase.from('geocaches').upsert({
    id: cacheId,
    owner_id: uid,
    title: clampStr(params.title.trim(), 3, 100, "Capsule d'Éclaireur"),
    clue_hint: clampStr(params.riddleHint.trim(), 5, 320, 'Cherchez au pied du repère le plus proche.'),
    sector_key: params.sectorKey,
    placement_mode: params.placementMode,
    lat: clampNum(params.lat, -90, 90),
    lng: clampNum(params.lng, -180, 180),
    gift_kind: params.giftKind,
    gift_domain: params.giftDomain,
    gift_name: clampStr(params.giftName.trim(), 1, 160, 'Souvenir de Guilde'),
    gift_tier: 'standard',
    finder_count: 0,
    created_at: new Date().toISOString(),
  });

  return cacheId;
}

export async function deleteExplorerGeocacheInCloud(
  _uidRaw: string,
  cacheIdRaw: string
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  await supabase.from('geocaches').delete().eq('id', cacheIdRaw.trim());
}

export function subscribeToGeocacheLogs(
  cacheIdRaw: string,
  onLogs: (logs: GeocacheLogRecord[]) => void
): () => void {
  if (!supabase || !isSupabaseConfigured) {
    onLogs([]);
    return () => {};
  }
  const cacheId = cacheIdRaw.trim();

  const fetchLogs = async () => {
    const { data: list } = await supabase!
      .from('geocache_logs')
      .select('*')
      .eq('geocache_id', cacheId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (list) {
      onLogs(
        list.map((l) => ({
          id: l.id,
          cacheId: l.geocache_id,
          finderId: l.owner_id,
          finderCallsign: l.finder_name,
          logMessage: l.log_message,
          note: l.log_message,
          foundAtIso: l.created_at,
        }))
      );
    }
  };

  fetchLogs();

  const channel = supabase
    .channel(`logs_${cacheId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'geocache_logs', filter: `geocache_id=eq.${cacheId}` },
      () => fetchLogs()
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
}

export async function signGeocacheLogbookInCloud(params: {
  cacheIdRaw: string;
  uidRaw: string;
  finderCallsign: string;
  finderAppearance?: ExplorerAppearance;
  logMessage?: string;
  note?: string;
}): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const uid = params.uidRaw.trim();
  const cacheId = params.cacheIdRaw.trim();
  const logId = `${cacheId}_${uid}_${Date.now()}`;
  const message = params.note || params.logMessage || 'Visite inscrite sur le carnet.';

  await supabase.from('geocache_logs').insert({
    id: logId,
    geocache_id: cacheId,
    owner_id: uid,
    finder_name: clampStr(params.finderCallsign.trim(), 1, 60, 'Explorateur'),
    log_message: clampStr(message.trim(), 1, 280, 'Visite inscrite sur le carnet.'),
    created_at: new Date().toISOString(),
  });

  // Increment finder_count on geocache
  const { data: cache } = await supabase.from('geocaches').select('finder_count').eq('id', cacheId).single();
  if (cache) {
    await supabase.from('geocaches').update({ finder_count: (cache.finder_count || 0) + 1 }).eq('id', cacheId);
  }
}

export async function deleteGeocacheLogInCloud(
  _cacheIdRaw: string,
  logIdRaw: string
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  await supabase.from('geocache_logs').delete().eq('id', logIdRaw.trim());
}

// ----------------------------------------------------------------------------
// 9. DÉFIS COMMUNAUTAIRES & PANTHÉON MULTIJOUEUR
// ----------------------------------------------------------------------------

export async function upsertCommunityChallengeEntryInCloud(params: {
  periodKey: string;
  challengeId: string;
  cadence: ChallengeCadence;
  uidRaw: string;
  displayName?: string;
  appearance?: ExplorerAppearance;
  contributionCount?: number;
  points?: number;
  score?: number;
  tierReached?: 'bronze' | 'argent' | 'or';
  regionLabel?: string;
  progress?: ExplorerProgress;
}): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const uid = params.uidRaw.trim();
  const entryId = `${params.periodKey}_${params.challengeId}_${uid}`;
  const callsign = params.displayName || params.progress?.displayName || 'Explorateur';
  const scoreVal = params.points ?? params.score ?? params.contributionCount ?? 0;
  const tier = params.tierReached || 'bronze';

  await supabase.from('community_challenge_entries').upsert({
    id: entryId,
    period_key: params.periodKey,
    challenge_id: params.challengeId,
    owner_id: uid,
    display_name: clampStr(callsign, 1, 60, 'Explorateur'),
    avatar_preset: sanitizeAvatarPreset(params.appearance?.avatarPreset || params.progress?.avatarPreset),
    score: Math.max(0, Math.round(scoreVal)),
    tier_reached: tier,
    region_label: (params.regionLabel || '').slice(0, 100),
    updated_at: new Date().toISOString(),
  });
}

export function subscribeToChallengeLeaderboard(
  challengeIdRaw: string,
  onRows: (rows: CommunityChallengeLeaderboardRow[]) => void
): () => void {
  if (!supabase || !isSupabaseConfigured) {
    onRows([]);
    return () => {};
  }
  const cleanId = sanitizeFirestoreId(challengeIdRaw).slice(0, 60);

  const fetchLeaderboard = async () => {
    const { data: list } = await supabase!
      .from('community_challenge_entries')
      .select('*')
      .eq('challenge_id', cleanId)
      .order('score', { ascending: false })
      .limit(80);

    if (list) {
      onRows(
        list.map((r) => ({
          entryId: r.id,
          challengeId: r.challenge_id,
          cadence: 'quotidien' as ChallengeCadence,
          periodKey: r.period_key,
          explorerId: r.owner_id,
          explorerCallsign: r.display_name,
          contributionCount: Number(r.score || 0),
          points: Number(r.score || 0),
          regionLabel: r.region_label || 'Secteur exploré',
          explorerAvatarPreset: r.avatar_preset as ExplorerAvatarPreset,
        }))
      );
    }
  };

  fetchLeaderboard();

  const channel = supabase
    .channel(`challenge_${cleanId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'community_challenge_entries',
        filter: `challenge_id=eq.${cleanId}`,
      },
      () => fetchLeaderboard()
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
}

export function subscribeToPeriodChallengeLeaderboard(
  periodKeyRaw: string,
  onRows: (rows: CommunityChallengeLeaderboardRow[]) => void
): () => void {
  if (!supabase || !isSupabaseConfigured) {
    onRows([]);
    return () => {};
  }
  const cleanPeriod = periodKeyRaw.trim();

  const fetchLeaderboard = async () => {
    const { data: list } = await supabase!
      .from('community_challenge_entries')
      .select('*')
      .eq('period_key', cleanPeriod)
      .order('score', { ascending: false })
      .limit(150);

    if (list) {
      onRows(
        list.map((r) => ({
          entryId: r.id,
          challengeId: r.challenge_id,
          cadence: 'quotidien' as ChallengeCadence,
          periodKey: r.period_key,
          explorerId: r.owner_id,
          explorerCallsign: r.display_name,
          contributionCount: Number(r.score || 0),
          points: Number(r.score || 0),
          regionLabel: r.region_label || 'Secteur exploré',
          explorerAvatarPreset: r.avatar_preset as ExplorerAvatarPreset,
        }))
      );
    }
  };

  fetchLeaderboard();

  const channel = supabase
    .channel(`period_challenge_${cleanPeriod}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'community_challenge_entries',
        filter: `period_key=eq.${cleanPeriod}`,
      },
      () => fetchLeaderboard()
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
}

export async function upsertPantheonEntryInCloud(params: {
  uidRaw: string;
  regionLabel: string;
  progress: ExplorerProgress;
  metrics: PantheonMetrics;
}): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const uid = params.uidRaw.trim();

  await supabase.from('pantheon_entries').upsert({
    owner_id: uid,
    display_name: clampStr(params.progress.displayName || 'Explorateur', 1, 60, 'Explorateur'),
    avatar_preset: sanitizeAvatarPreset(params.progress.avatarPreset),
    total_xp: Math.max(0, Math.round(params.metrics.totalXp)),
    discoveries_count: Math.max(0, Math.round(params.metrics.discoveriesCount)),
    diversity_score: Math.max(0, Math.round(params.metrics.diversityScore)),
    rarity_score: Math.max(0, Math.round(params.metrics.rarityScore)),
    specimens_count: 0,
    chests_count: 0,
    live_events_count: Math.max(0, Math.round(params.metrics.liveEventsCount)),
    pinned_trophy_id: sanitizePinnedTrophyId(params.progress.pinnedTrophyId),
    updated_at: new Date().toISOString(),
  });
}

export function subscribeToPantheonLeaderboard(
  onRows: (rows: PantheonLeaderboardRow[]) => void
): () => void {
  if (!supabase || !isSupabaseConfigured) {
    onRows([]);
    return () => {};
  }

  const fetchLeaderboard = async () => {
    const { data: list } = await supabase!
      .from('pantheon_entries')
      .select('*')
      .order('total_xp', { ascending: false })
      .limit(100);

    if (list) {
      onRows(
        list.map((r) => ({
          explorerId: r.owner_id,
          explorerCallsign: r.display_name,
          regionLabel: 'Secteur exploré',
          pantheonScore: Number(r.total_xp || 0),
          totalXp: Number(r.total_xp || 0),
          diversityScore: Number(r.diversity_score || 0),
          rarityScore: Number(r.rarity_score || 0),
          discoveriesCount: Number(r.discoveries_count || 0),
          categoriesCount: 5,
          strataCount: 6,
          sourcesCount: 15,
          secretArchivesCount: 0,
          officialHeritageCount: 0,
          liveEventsCount: Number(r.live_events_count || 0),
          explorerAvatarPreset: r.avatar_preset as ExplorerAvatarPreset,
          explorerPinnedTrophyId: (r.pinned_trophy_id as TrophyId) || undefined,
        }))
      );
    }
  };

  fetchLeaderboard();

  const channel = supabase
    .channel('pantheon_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pantheon_entries' }, () =>
      fetchLeaderboard()
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
}
