import {
  ExplorationCategory,
  ExplorerAvatarPreset,
  ExplorerFamiliarId,
  ExplorerGender,
  ExplorerHeadgearId,
  ExplorerOutfitId,
  ExplorerProgress,
  ExplorerSkinTone,
  PoiItem,
  TrophyId,
  UnlockedEntry,
} from './types';

export type ChallengeCadence = 'quotidien' | 'hebdomadaire' | 'mensuel';

export type ChallengePoiFilterKind =
  | 'waterway'
  | 'histoire'
  | 'geographie'
  | 'ecosysteme'
  | 'legende'
  | 'etrange'
  | 'vernacular'
  | 'geodesic_or_rock'
  | 'subterranean_or_etrange'
  | 'any_poi';

export type ChallengeTierKey = 'bronze' | 'silver' | 'gold';

export interface ChallengePersonalTier {
  key: ChallengeTierKey;
  labelFr: string;
  targetCount: number;
  xpReward: number;
  bonusPoints: number;
}

export interface CommunityChallengeDefinition {
  id: string;
  cadence: ChallengeCadence;
  cadenceLabelFr: string;
  periodKey: string;
  title: string;
  subtitle: string;
  description: string;
  poiRequirementLabelFr: string;
  filterKind: ChallengePoiFilterKind;
  focusCategory: ExplorationCategory;
  startsAtMs: number;
  endsAtMs: number;
  communityTargetCount: number;
  pointsPerDiscovery: number;
  personalTiers: [ChallengePersonalTier, ChallengePersonalTier, ChallengePersonalTier];
}

export interface CommunityChallengeLeaderboardRow {
  entryId: string;
  challengeId: string;
  cadence: ChallengeCadence;
  periodKey: string;
  explorerId: string;
  explorerCallsign: string;
  contributionCount: number;
  points: number;
  regionLabel: string;
  explorerGender?: ExplorerGender;
  explorerAvatarPreset?: ExplorerAvatarPreset;
  explorerSkinTone?: ExplorerSkinTone;
  explorerHeadgearId?: ExplorerHeadgearId;
  explorerOutfitId?: ExplorerOutfitId;
  explorerFamiliarId?: ExplorerFamiliarId;
  explorerPinnedTrophyId?: TrophyId | '';
  isLocalExplorer?: boolean;
}

export interface RankedChallengeRow extends CommunityChallengeLeaderboardRow {
  rank: number;
}

export interface RankedGeneralExplorerRow {
  rank: number;
  explorerId: string;
  explorerCallsign: string;
  totalContributions: number;
  totalPoints: number;
  challengesJoined: number;
  regionLabel: string;
  explorerGender?: ExplorerGender;
  explorerAvatarPreset?: ExplorerAvatarPreset;
  explorerSkinTone?: ExplorerSkinTone;
  explorerHeadgearId?: ExplorerHeadgearId;
  explorerOutfitId?: ExplorerOutfitId;
  explorerFamiliarId?: ExplorerFamiliarId;
  explorerPinnedTrophyId?: TrophyId | '';
  isLocalExplorer?: boolean;
}

export const CLAIMED_COMMUNITY_TIERS_STORAGE_KEY = 'terra16_claimed_community_tiers_v1';

export function loadClaimedCommunityTiers(): string[] {
  try {
    const raw = localStorage.getItem(CLAIMED_COMMUNITY_TIERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string' && x.length <= 160);
  } catch {
    return [];
  }
}

export function saveClaimedCommunityTiers(tierIds: string[]): void {
  try {
    localStorage.setItem(CLAIMED_COMMUNITY_TIERS_STORAGE_KEY, JSON.stringify(tierIds));
  } catch {
    // ignore storage quota errors
  }
}

export function makeClaimedTierId(challengeId: string, tierKey: ChallengeTierKey): string {
  return `${challengeId}__${tierKey}`;
}

interface DailyArchetype {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  poiRequirementLabelFr: string;
  filterKind: ChallengePoiFilterKind;
  focusCategory: ExplorationCategory;
  communityTargetCount: number;
  targets: [number, number, number];
}

const DAILY_ARCHETYPES: DailyArchetype[] = [
  {
    slug: 'ondes',
    title: 'Veilleurs des Eaux Vives',
    subtitle: 'Défi 24h · Rivières, rus, ponts, moulins & fontaines',
    description:
      'La Guilde cartographie aujourd’hui les lieux façonnés par l’eau courante. Découvrez des points d’intérêt situés au fil d’un cours d’eau ou liés au patrimoine hydraulique avant minuit UTC.',
    poiRequirementLabelFr: 'Lieux proches d’un cours d’eau ou hydrauliques',
    filterKind: 'waterway',
    focusCategory: 'geographie',
    communityTargetCount: 18,
    targets: [1, 2, 4],
  },
  {
    slug: 'memoire',
    title: 'Sentinelles des Pierres d’Histoire',
    subtitle: 'Défi 24h · Monuments, archéologie & édifices anciens',
    description:
      'Pendant vingt-quatre heures, les éclaireurs unissent leurs relevés pour consigner les témoins bâtis des siècles passés dans chaque commune.',
    poiRequirementLabelFr: 'Points d’intérêt de catégorie Histoire',
    filterKind: 'histoire',
    focusCategory: 'histoire',
    communityTargetCount: 22,
    targets: [1, 3, 5],
  },
  {
    slug: 'vivant',
    title: 'Recensement des Sanctuaires du Vivant',
    subtitle: 'Défi 24h · Arbres remarquables, parcs & zones naturelles',
    description:
      'Relevez collectivement les refuges écologiques, futaies anciennes et corridors de biodiversité autour de votre position.',
    poiRequirementLabelFr: 'Points d’intérêt de catégorie Écosystème',
    filterKind: 'ecosysteme',
    focusCategory: 'ecosysteme',
    communityTargetCount: 18,
    targets: [1, 2, 4],
  },
  {
    slug: 'socle',
    title: 'Sondeurs du Socle & des Reliefs',
    subtitle: 'Défi 24h · Géologie, repères de nivellement & belvédères',
    description:
      'Mettez au jour les affleurements rocheux, bornes géodésiques IGN et lignes de crête avant la fin du sablier quotidien.',
    poiRequirementLabelFr: 'Points d’intérêt de catégorie Géologie',
    filterKind: 'geographie',
    focusCategory: 'geographie',
    communityTargetCount: 20,
    targets: [1, 2, 4],
  },
  {
    slug: 'contes',
    title: 'Collecteurs de Contes & Lieux-Dits',
    subtitle: 'Défi 24h · Légendes locales, toponymes & mémoires orales',
    description:
      'Partez sur les traces des récits populaires, pierres à légendes et toponymes anciens qui habitent nos contrées.',
    poiRequirementLabelFr: 'Points d’intérêt de catégorie Légendes',
    filterKind: 'legende',
    focusCategory: 'legende',
    communityTargetCount: 16,
    targets: [1, 2, 4],
  },
  {
    slug: 'profondeurs',
    title: 'Éclaireurs de l’Insolite & des Souterrains',
    subtitle: 'Défi 24h · Cavités, carrières, friches & curiosités cachées',
    description:
      'Explorez la face secrète du territoire : vestiges souterrains, ouvrages oubliés et lieux singuliers hors des sentiers battus.',
    poiRequirementLabelFr: 'Lieux Souterrains ou de catégorie Insolite',
    filterKind: 'subterranean_or_etrange',
    focusCategory: 'etrange',
    communityTargetCount: 16,
    targets: [1, 2, 4],
  },
  {
    slug: 'ronde',
    title: 'La Grande Ronde Fraternelle',
    subtitle: 'Défi 24h · Tous types de lieux sur le terrain',
    description:
      'Journée de cartographie ouverte : chaque sceau révélé sur le terrain, quelle que soit sa nature, fait progresser le compteur commun de la Guilde.',
    poiRequirementLabelFr: 'Tous types de points d’intérêt découverts',
    filterKind: 'any_poi',
    focusCategory: 'histoire',
    communityTargetCount: 30,
    targets: [2, 4, 7],
  },
];

interface WeeklyArchetype {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  poiRequirementLabelFr: string;
  filterKind: ChallengePoiFilterKind;
  focusCategory: ExplorationCategory;
  communityTargetCount: number;
  targets: [number, number, number];
}

const WEEKLY_ARCHETYPES: WeeklyArchetype[] = [
  {
    slug: 'petit_patrimoine',
    title: 'Expédition du Petit Patrimoine & des Eaux',
    subtitle: 'Défi Hebdomadaire (7 jours) · Lavoirs, moulins, fontaines, calvaires & rivières',
    description:
      'Cette semaine, la communauté sauvegarde la mémoire vernaculaire des bourgs et vallons : lavoirs, fontaines, moulins, ponts anciens et rives habitées.',
    poiRequirementLabelFr: 'Petit patrimoine rural ou lieux liés à l’eau',
    filterKind: 'vernacular',
    focusCategory: 'histoire',
    communityTargetCount: 45,
    targets: [2, 5, 9],
  },
  {
    slug: 'canevas_ign',
    title: 'Campagne Géodésique & Lithologique',
    subtitle: 'Défi Hebdomadaire (7 jours) · Bornes IGN, roches & reliefs',
    description:
      'Sept jours pour dresser le profil minéral et topographique des régions explorées en relevant bornes géodésiques, sommets et curiosités géologiques.',
    poiRequirementLabelFr: 'Repères IGN, reliefs et sites Géologie',
    filterKind: 'geodesic_or_rock',
    focusCategory: 'geographie',
    communityTargetCount: 50,
    targets: [2, 5, 9],
  },
  {
    slug: 'arche_vivante',
    title: 'L’Arche des Sanctuaires Naturels',
    subtitle: 'Défi Hebdomadaire (7 jours) · Écosystèmes, futaies & biodiversité',
    description:
      'Une semaine entière dédiée aux arbres vénérables, zones humides et sanctuaires naturels inventoriés à travers le territoire.',
    poiRequirementLabelFr: 'Sites Écosystème & corridors humides',
    filterKind: 'ecosysteme',
    focusCategory: 'ecosysteme',
    communityTargetCount: 45,
    targets: [2, 5, 8],
  },
  {
    slug: 'ombres_mythes',
    title: 'Semaine des Mythes & Souterrains',
    subtitle: 'Défi Hebdomadaire (7 jours) · Légendes locales & monde d’en bas',
    description:
      'Croisez les mystères du sous-sol et la mémoire des contes anciens en révélant cavités, carrières, vestiges insolites et hauts lieux légendaires.',
    poiRequirementLabelFr: 'Sites Légendes, Insolite ou Souterrains',
    filterKind: 'subterranean_or_etrange',
    focusCategory: 'legende',
    communityTargetCount: 45,
    targets: [2, 5, 8],
  },
];

const FRENCH_MONTHS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function getCurrentPeriodKey(nowMs = Date.now()): string {
  const d = new Date(nowMs);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

/**
 * Generates the 3 deterministic active community challenges (Daily 24h, Weekly 7d, Monthly)
 * for the given timestamp so all explorers share identical IDs and deadlines.
 */
export function getActiveCommunityChallenges(nowMs = Date.now()): CommunityChallengeDefinition[] {
  const now = new Date(nowMs);
  const year = now.getUTCFullYear();
  const monthIdx = now.getUTCMonth();
  const date = now.getUTCDate();
  const periodKey = `${year}-${pad2(monthIdx + 1)}`;

  // 1. Daily window (00:00:00 UTC -> 23:59:59.999 UTC)
  const dayStartMs = Date.UTC(year, monthIdx, date, 0, 0, 0, 0);
  const dayEndMs = Date.UTC(year, monthIdx, date + 1, 0, 0, 0, 0) - 1;
  const epochDayIndex = Math.floor(dayStartMs / 86_400_000);
  const dailyArch = DAILY_ARCHETYPES[((epochDayIndex % DAILY_ARCHETYPES.length) + DAILY_ARCHETYPES.length) % DAILY_ARCHETYPES.length];
  const dailyId = `ch_daily_${year}${pad2(monthIdx + 1)}${pad2(date)}_${dailyArch.slug}`;

  const dailyChallenge: CommunityChallengeDefinition = {
    id: dailyId,
    cadence: 'quotidien',
    cadenceLabelFr: 'Défi Quotidien · 24h',
    periodKey,
    title: dailyArch.title,
    subtitle: dailyArch.subtitle,
    description: dailyArch.description,
    poiRequirementLabelFr: dailyArch.poiRequirementLabelFr,
    filterKind: dailyArch.filterKind,
    focusCategory: dailyArch.focusCategory,
    startsAtMs: dayStartMs,
    endsAtMs: dayEndMs,
    communityTargetCount: dailyArch.communityTargetCount,
    pointsPerDiscovery: 25,
    personalTiers: [
      { key: 'bronze', labelFr: 'Échelon Bronze', targetCount: dailyArch.targets[0], xpReward: 45, bonusPoints: 15 },
      { key: 'silver', labelFr: 'Échelon Argent', targetCount: dailyArch.targets[1], xpReward: 85, bonusPoints: 35 },
      { key: 'gold', labelFr: 'Échelon Or', targetCount: dailyArch.targets[2], xpReward: 140, bonusPoints: 70 },
    ],
  };

  // 2. Weekly window (Monday 00:00 UTC -> Sunday 23:59:59.999 UTC)
  const utcDayOfWeek = now.getUTCDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const diffToMonday = utcDayOfWeek === 0 ? -6 : 1 - utcDayOfWeek;
  const weekStartMs = Date.UTC(year, monthIdx, date + diffToMonday, 0, 0, 0, 0);
  const weekEndMs = weekStartMs + 7 * 86_400_000 - 1;
  const weekStartDate = new Date(weekStartMs);
  const epochWeekIndex = Math.floor(weekStartMs / (7 * 86_400_000));
  const weeklyArch = WEEKLY_ARCHETYPES[((epochWeekIndex % WEEKLY_ARCHETYPES.length) + WEEKLY_ARCHETYPES.length) % WEEKLY_ARCHETYPES.length];
  const weeklyId = `ch_weekly_${weekStartDate.getUTCFullYear()}${pad2(weekStartDate.getUTCMonth() + 1)}${pad2(weekStartDate.getUTCDate())}_${weeklyArch.slug}`;

  const weeklyChallenge: CommunityChallengeDefinition = {
    id: weeklyId,
    cadence: 'hebdomadaire',
    cadenceLabelFr: 'Expédition 7 Jours',
    periodKey,
    title: weeklyArch.title,
    subtitle: weeklyArch.subtitle,
    description: weeklyArch.description,
    poiRequirementLabelFr: weeklyArch.poiRequirementLabelFr,
    filterKind: weeklyArch.filterKind,
    focusCategory: weeklyArch.focusCategory,
    startsAtMs: weekStartMs,
    endsAtMs: weekEndMs,
    communityTargetCount: weeklyArch.communityTargetCount,
    pointsPerDiscovery: 30,
    personalTiers: [
      { key: 'bronze', labelFr: 'Échelon Bronze', targetCount: weeklyArch.targets[0], xpReward: 70, bonusPoints: 25 },
      { key: 'silver', labelFr: 'Échelon Argent', targetCount: weeklyArch.targets[1], xpReward: 130, bonusPoints: 60 },
      { key: 'gold', labelFr: 'Échelon Or', targetCount: weeklyArch.targets[2], xpReward: 220, bonusPoints: 120 },
    ],
  };

  // 3. Monthly Grand Atlas Challenge (1st of month 00:00 UTC -> last day 23:59:59.999 UTC)
  const monthStartMs = Date.UTC(year, monthIdx, 1, 0, 0, 0, 0);
  const monthEndMs = Date.UTC(year, monthIdx + 1, 1, 0, 0, 0, 0) - 1;
  const monthNameFr = FRENCH_MONTHS[monthIdx] || 'Mois';
  const monthlyId = `ch_monthly_${year}_${pad2(monthIdx + 1)}`;

  const monthlyChallenge: CommunityChallengeDefinition = {
    id: monthlyId,
    cadence: 'mensuel',
    cadenceLabelFr: `Grand Atlas · ${monthNameFr}`,
    periodKey,
    title: `Grand Relevé Communautaire de ${monthNameFr}`,
    subtitle: `Défi Mensuel · Objectif de nombre sur tous les sceaux du territoire`,
    description: `Tout au long du mois de ${monthNameFr.toLowerCase()}, chaque point d’intérêt révélé par un éclaireur enrichit le Grand Atlas collectif et élève votre rang au classement général.`,
    poiRequirementLabelFr: 'Nombre total de lieux découverts durant le mois',
    filterKind: 'any_poi',
    focusCategory: 'histoire',
    startsAtMs: monthStartMs,
    endsAtMs: monthEndMs,
    communityTargetCount: 120,
    pointsPerDiscovery: 20,
    personalTiers: [
      { key: 'bronze', labelFr: 'Échelon Bronze', targetCount: 4, xpReward: 90, bonusPoints: 40 },
      { key: 'silver', labelFr: 'Échelon Argent', targetCount: 10, xpReward: 180, bonusPoints: 90 },
      { key: 'gold', labelFr: 'Échelon Or', targetCount: 20, xpReward: 320, bonusPoints: 180 },
    ],
  };

  return [dailyChallenge, weeklyChallenge, monthlyChallenge];
}

const VERNACULAR_REGEX =
  /lavoir|fontaine|moulin|four|calvaire|croix|puits|source|pont|écluse|ecluse|chapelle|pigeonnier|halle/i;
const GEODESIC_REGEX =
  /géodés|geodes|nivellement|ign|borne|sommet|belvédère|belvedere|crête|crete|roche|falaise|carrière|carriere|bloc/i;
const SUBTERRANEAN_REGEX =
  /souterrain|grotte|cavité|cavite|cave|carrière|carriere|mine|tunnel|aqueduc|crypte|puits|gouffre/i;

function matchesFilterFields(
  filterKind: ChallengePoiFilterKind,
  item: {
    category: ExplorationCategory;
    name: string;
    subType: string;
    summary: string;
    source: string;
    nearWaterway: boolean;
    isSubterranean?: boolean;
  }
): boolean {
  const haystack = `${item.name} ${item.subType} ${item.summary} ${item.source}`;
  switch (filterKind) {
    case 'any_poi':
      return true;
    case 'waterway':
      return Boolean(item.nearWaterway) || /fontaine|lavoir|moulin|pont|rivière|riviere|ruisseau|canal|source/i.test(haystack);
    case 'histoire':
      return item.category === 'histoire';
    case 'geographie':
      return item.category === 'geographie';
    case 'ecosysteme':
      return item.category === 'ecosysteme';
    case 'legende':
      return item.category === 'legende';
    case 'etrange':
      return item.category === 'etrange';
    case 'vernacular':
      return Boolean(item.nearWaterway) || VERNACULAR_REGEX.test(haystack);
    case 'geodesic_or_rock':
      return item.category === 'geographie' || GEODESIC_REGEX.test(haystack);
    case 'subterranean_or_etrange':
      return (
        Boolean(item.isSubterranean) ||
        item.category === 'etrange' ||
        item.category === 'legende' ||
        SUBTERRANEAN_REGEX.test(haystack)
      );
  }
}

export function matchesChallengeUnlockedEntry(
  challenge: CommunityChallengeDefinition,
  entry: UnlockedEntry
): boolean {
  return matchesFilterFields(challenge.filterKind, entry);
}

export function matchesChallengePoiItem(
  challenge: CommunityChallengeDefinition,
  poi: PoiItem
): boolean {
  return matchesFilterFields(challenge.filterKind, poi);
}

export interface PersonalChallengeEvaluation {
  qualifyingEntries: UnlockedEntry[];
  count: number;
  points: number;
  unlockedTiers: ChallengePersonalTier[];
  nextTier: ChallengePersonalTier | null;
}

/**
 * Computes the player's personal contribution strictly within [startsAtMs, endsAtMs].
 */
export function evaluatePersonalChallengeProgress(
  challenge: CommunityChallengeDefinition,
  entries: UnlockedEntry[]
): PersonalChallengeEvaluation {
  const seenPoiIds = new Set<string>();
  const qualifyingEntries: UnlockedEntry[] = [];

  for (const entry of entries) {
    if (!entry.discoveredAtIso || seenPoiIds.has(entry.poiId)) continue;
    const ts = Date.parse(entry.discoveredAtIso);
    if (!Number.isFinite(ts)) continue;
    if (ts < challenge.startsAtMs || ts > challenge.endsAtMs) continue;
    if (!matchesChallengeUnlockedEntry(challenge, entry)) continue;
    seenPoiIds.add(entry.poiId);
    qualifyingEntries.push(entry);
  }

  const count = qualifyingEntries.length;
  const unlockedTiers = challenge.personalTiers.filter((t) => count >= t.targetCount);
  const nextTier = challenge.personalTiers.find((t) => count < t.targetCount) || null;
  const tierBonusSum = unlockedTiers.reduce((acc, t) => acc + t.bonusPoints, 0);
  const points = count * challenge.pointsPerDiscovery + tierBonusSum;

  return {
    qualifyingEntries,
    count,
    points,
    unlockedTiers,
    nextTier,
  };
}

/**
 * Merges real Firestore challenge entries with the local explorer's live progress
 * (zero fake bots or mock accounts) and computes both individual rankings and collective total.
 */
export function buildChallengeLeaderboard(params: {
  challenge: CommunityChallengeDefinition;
  cloudEntries: CommunityChallengeLeaderboardRow[];
  localExplorerId: string;
  localProgress: ExplorerProgress;
  localEval: PersonalChallengeEvaluation;
  localRegionLabel: string;
}): {
  rows: RankedChallengeRow[];
  communityTotalCount: number;
  participantsCount: number;
  localRank: number | null;
} {
  const {
    challenge,
    cloudEntries,
    localExplorerId,
    localProgress,
    localEval,
    localRegionLabel,
  } = params;

  const byExplorer = new Map<string, CommunityChallengeLeaderboardRow>();

  for (const item of cloudEntries) {
    if (item.challengeId !== challenge.id) continue;
    if (item.contributionCount <= 0 && item.points <= 0) continue;
    const prev = byExplorer.get(item.explorerId);
    if (!prev || item.points > prev.points || item.contributionCount > prev.contributionCount) {
      byExplorer.set(item.explorerId, {
        ...item,
        isLocalExplorer: item.explorerId === localExplorerId,
      });
    }
  }

  if (localEval.count > 0) {
    const existingCloud = byExplorer.get(localExplorerId);
    const mergedCount = Math.max(localEval.count, existingCloud?.contributionCount || 0);
    const mergedPoints = Math.max(localEval.points, existingCloud?.points || 0);
    byExplorer.set(localExplorerId, {
      entryId: existingCloud?.entryId || `${challenge.id}_${localExplorerId}`,
      challengeId: challenge.id,
      cadence: challenge.cadence,
      periodKey: challenge.periodKey,
      explorerId: localExplorerId,
      explorerCallsign: (localProgress.displayName || 'Éclaireur').slice(0, 40),
      contributionCount: mergedCount,
      points: mergedPoints,
      regionLabel: (localRegionLabel || existingCloud?.regionLabel || 'Secteur local').slice(0, 80),
      explorerGender: localProgress.gender,
      explorerAvatarPreset: localProgress.avatarPreset,
      explorerSkinTone: localProgress.skinTone,
      explorerHeadgearId: localProgress.headgearId,
      explorerOutfitId: localProgress.outfitId,
      explorerFamiliarId: localProgress.familiarId,
      explorerPinnedTrophyId: localProgress.pinnedTrophyId,
      isLocalExplorer: true,
    });
  }

  const sorted = Array.from(byExplorer.values()).sort((a, b) => {
    if (b.contributionCount !== a.contributionCount) {
      return b.contributionCount - a.contributionCount;
    }
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    return a.explorerCallsign.localeCompare(b.explorerCallsign, 'fr');
  });

  const rows: RankedChallengeRow[] = sorted.map((row, idx) => ({
    ...row,
    rank: idx + 1,
  }));

  const communityTotalCount = rows.reduce((sum, r) => sum + r.contributionCount, 0);
  const localRow = rows.find((r) => r.explorerId === localExplorerId);

  return {
    rows,
    communityTotalCount,
    participantsCount: rows.length,
    localRank: localRow ? localRow.rank : null,
  };
}

/**
 * Aggregates all challenge participations across the current calendar month (`periodKey`)
 * to form the General Community Leaderboard (`Classement Général de la Période`).
 */
export function buildPeriodGeneralLeaderboard(params: {
  periodKey: string;
  periodCloudEntries: CommunityChallengeLeaderboardRow[];
  activeChallenges: CommunityChallengeDefinition[];
  localExplorerId: string;
  localProgress: ExplorerProgress;
  entries: UnlockedEntry[];
  localRegionLabel: string;
}): RankedGeneralExplorerRow[] {
  const {
    periodKey,
    periodCloudEntries,
    activeChallenges,
    localExplorerId,
    localProgress,
    entries,
    localRegionLabel,
  } = params;

  // Deduplicate by (challengeId, explorerId) first
  const perChallengeExplorer = new Map<string, CommunityChallengeLeaderboardRow>();
  for (const row of periodCloudEntries) {
    if (row.periodKey !== periodKey) continue;
    if (row.contributionCount <= 0 && row.points <= 0) continue;
    const key = `${row.challengeId}__${row.explorerId}`;
    const prev = perChallengeExplorer.get(key);
    if (!prev || row.points > prev.points) {
      perChallengeExplorer.set(key, row);
    }
  }

  // Merge live local evaluations for active challenges in the same period
  for (const ch of activeChallenges) {
    if (ch.periodKey !== periodKey) continue;
    const ev = evaluatePersonalChallengeProgress(ch, entries);
    if (ev.count <= 0) continue;
    const key = `${ch.id}__${localExplorerId}`;
    const prev = perChallengeExplorer.get(key);
    perChallengeExplorer.set(key, {
      entryId: prev?.entryId || `${ch.id}_${localExplorerId}`,
      challengeId: ch.id,
      cadence: ch.cadence,
      periodKey: ch.periodKey,
      explorerId: localExplorerId,
      explorerCallsign: (localProgress.displayName || 'Éclaireur').slice(0, 40),
      contributionCount: Math.max(ev.count, prev?.contributionCount || 0),
      points: Math.max(ev.points, prev?.points || 0),
      regionLabel: (localRegionLabel || prev?.regionLabel || 'Secteur local').slice(0, 80),
      explorerGender: localProgress.gender,
      explorerAvatarPreset: localProgress.avatarPreset,
      explorerSkinTone: localProgress.skinTone,
      explorerHeadgearId: localProgress.headgearId,
      explorerOutfitId: localProgress.outfitId,
      explorerFamiliarId: localProgress.familiarId,
      explorerPinnedTrophyId: localProgress.pinnedTrophyId,
      isLocalExplorer: true,
    });
  }

  // Sum points and contributions per explorer across challenges in the period
  const byExplorer = new Map<string, Omit<RankedGeneralExplorerRow, 'rank'>>();
  for (const item of perChallengeExplorer.values()) {
    const existing = byExplorer.get(item.explorerId);
    if (!existing) {
      byExplorer.set(item.explorerId, {
        explorerId: item.explorerId,
        explorerCallsign: item.explorerCallsign,
        totalContributions: item.contributionCount,
        totalPoints: item.points,
        challengesJoined: 1,
        regionLabel: item.regionLabel,
        explorerGender: item.explorerGender,
        explorerAvatarPreset: item.explorerAvatarPreset,
        explorerSkinTone: item.explorerSkinTone,
        explorerHeadgearId: item.explorerHeadgearId,
        explorerOutfitId: item.explorerOutfitId,
        explorerFamiliarId: item.explorerFamiliarId,
        explorerPinnedTrophyId: item.explorerPinnedTrophyId,
        isLocalExplorer: item.explorerId === localExplorerId,
      });
    } else {
      existing.totalContributions += item.contributionCount;
      existing.totalPoints += item.points;
      existing.challengesJoined += 1;
      if (item.explorerId === localExplorerId) {
        existing.isLocalExplorer = true;
        existing.explorerCallsign = (localProgress.displayName || existing.explorerCallsign).slice(0, 40);
      }
    }
  }

  return Array.from(byExplorer.values())
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.totalContributions !== a.totalContributions) return b.totalContributions - a.totalContributions;
      return a.explorerCallsign.localeCompare(b.explorerCallsign, 'fr');
    })
    .map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
}

export function formatChallengeCountdownFr(endsAtMs: number, nowMs = Date.now()): string {
  const remainingSec = Math.max(0, Math.floor((endsAtMs - nowMs) / 1000));
  if (remainingSec <= 0) return 'Échéance atteinte';
  const days = Math.floor(remainingSec / 86400);
  const hours = Math.floor((remainingSec % 86400) / 3600);
  const minutes = Math.floor((remainingSec % 3600) / 60);
  const seconds = remainingSec % 60;
  if (days > 0) {
    return `${days}j ${pad2(hours)}h ${pad2(minutes)}m`;
  }
  return `${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`;
}
