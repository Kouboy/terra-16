import {
  ExplorationCategory,
  ExplorerFamiliarId,
  ExplorerHeadgearId,
  ExplorerOutfitId,
  ExplorerPackId,
  ExplorerProgress,
  ExplorerToolId,
} from './types';
import { UiPixelIconName } from './components/PixelIcons';

export function formatDistanceKm(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  return `${km.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

export type WalkingChallengePeriod = 'daily' | 'weekly' | 'monthly' | 'annual' | 'event';

export type WalkingCosmeticSlot = 'headgear' | 'outfit' | 'tool' | 'pack' | 'familiar';

export interface WalkingChallengeCosmeticReward {
  id:
    | ExplorerHeadgearId
    | ExplorerOutfitId
    | ExplorerToolId
    | ExplorerPackId
    | ExplorerFamiliarId;
  slot: WalkingCosmeticSlot;
  name: string;
  subtitle: string;
  rarity: 'rare' | 'epique' | 'legendaire';
  icon: UiPixelIconName;
}

export interface WalkingChallengeDef {
  id: string;
  period: WalkingChallengePeriod;
  title: string;
  subtitle: string;
  description: string;
  targetMeters: number;
  xpReward: number;
  categoryAffinity: ExplorationCategory;
  periodBadgeLabel: string;
  exclusiveCosmetic?: WalkingChallengeCosmeticReward;
}

export interface WalkingDistanceMetrics {
  dailyMeters: number;
  weeklyMeters: number;
  monthlyMeters: number;
  annualMeters: number;
  eventMeters: number;
  totalLifetimeMeters: number;
}

export interface WalkingPeriodKeys {
  dailyKey: string; // YYYY-MM-DD
  weeklyKey: string; // YYYY-Www
  monthlyKey: string; // YYYY-MM
  annualKey: string; // YYYY
  eventKey: string; // e.g. "automne_2026"
}

export interface WalkingChallengesState {
  keys: WalkingPeriodKeys;
  metrics: WalkingDistanceMetrics;
  claimedChallengeIds: string[];
  unlockedCosmeticIds: string[];
  historyDays: Record<string, number>;
}

// ----------------------------------------------------------------------------
// CATALOGUE DES DÉFIS DE MARCHE 16-BIT
// ----------------------------------------------------------------------------

export const WALKING_CHALLENGES_CATALOG: WalkingChallengeDef[] = [
  // --- QUOTIDIENS (24h) ---
  {
    id: 'walk_daily_2k',
    period: 'daily',
    title: 'Éveil du Sentier',
    subtitle: 'Parcourir 2 km en une journée',
    description: 'Effectuez une première boucle de marche pour réveiller les énergies telluriques du jour.',
    targetMeters: 2000,
    xpReward: 60,
    categoryAffinity: 'geographie',
    periodBadgeLabel: 'Quotidien · 24h',
  },
  {
    id: 'walk_daily_5k',
    period: 'daily',
    title: 'Ronde des Chemins Creux',
    subtitle: 'Parcourir 5 km en une journée',
    description: 'Arpentez 5 kilomètres complets sur les chemins et sentiers du territoire avant le coucher de l’astre.',
    targetMeters: 5000,
    xpReward: 150,
    categoryAffinity: 'ecosysteme',
    periodBadgeLabel: 'Quotidien · 24h',
    exclusiveCosmetic: {
      id: 'baton_chemins_creux',
      slot: 'tool',
      name: 'Bâton d’If des Chemins Creux',
      subtitle: 'Outil exclusif 5 km · Bâton d’if sculpté orné de runes sylvestres',
      rarity: 'rare',
      icon: 'boot',
    },
  },
  {
    id: 'walk_daily_10k',
    period: 'daily',
    title: 'Grande Boucle du Guetteur',
    subtitle: 'Parcourir 10 km en une journée',
    description: 'Franchissez le seuil des 10 km quotidiens pour marquer l’endurance d’un grand éclaireur.',
    targetMeters: 10000,
    xpReward: 300,
    categoryAffinity: 'histoire',
    periodBadgeLabel: 'Quotidien · 24h',
    exclusiveCosmetic: {
      id: 'chapeau_longues_routes',
      slot: 'headgear',
      name: 'Chapeau d’Ombre des Longues Routes',
      subtitle: 'Couvre-chef exclusif 10 km · Feutre large à ganse de cuir tanné et plume de faucon',
      rarity: 'rare',
      icon: 'hat',
    },
  },

  // --- HEBDOMADAIRES (7 jours) ---
  {
    id: 'walk_weekly_15k',
    period: 'weekly',
    title: 'L’Orée des Sept Lieues',
    subtitle: 'Parcourir 15 km dans la semaine',
    description: 'Cumulez 15 km de marche au fil de vos sorties hebdomadaires.',
    targetMeters: 15000,
    xpReward: 200,
    categoryAffinity: 'geographie',
    periodBadgeLabel: 'Hebdomadaire · 7j',
  },
  {
    id: 'walk_weekly_25k',
    period: 'weekly',
    title: 'Traversée du Bocage & Crêtes',
    subtitle: 'Parcourir 25 km dans la semaine',
    description: 'Reliez vallées et plateaux sur une semaine complète de randonnée continue.',
    targetMeters: 25000,
    xpReward: 400,
    categoryAffinity: 'legende',
    periodBadgeLabel: 'Hebdomadaire · 7j',
    exclusiveCosmetic: {
      id: 'foulard_sept_lieues',
      slot: 'headgear',
      name: 'Foulard Éolien des Sept Lieues',
      subtitle: 'Couvre-chef exclusif 25 km · Écharpe de soie éolienne flottant au vent des crêtes',
      rarity: 'rare',
      icon: 'hat',
    },
  },
  {
    id: 'walk_weekly_40k',
    period: 'weekly',
    title: 'Marche des Bornes Frontières',
    subtitle: 'Parcourir 40 km dans la semaine',
    description: 'Une semaine d’endurance soutenue traquant les limites du territoire.',
    targetMeters: 40000,
    xpReward: 650,
    categoryAffinity: 'histoire',
    periodBadgeLabel: 'Hebdomadaire · 7j',
    exclusiveCosmetic: {
      id: 'boussole_alizes',
      slot: 'tool',
      name: 'Boussole Solaire des Alizés',
      subtitle: 'Outil exclusif 40 km · Astrolabe d’or aux quatre vents d’azur',
      rarity: 'epique',
      icon: 'pocket-compass',
    },
  },

  // --- MENSUELS (30 jours) ---
  {
    id: 'walk_monthly_50k',
    period: 'monthly',
    title: 'Pèlerinage des Sentiers Sacrés',
    subtitle: 'Parcourir 50 km dans le mois',
    description: 'Consacrez un mois régulier aux chemins de traverse et sentiers ruraux.',
    targetMeters: 50000,
    xpReward: 500,
    categoryAffinity: 'legende',
    periodBadgeLabel: 'Mensuel · 30j',
  },
  {
    id: 'walk_monthly_100k',
    period: 'monthly',
    title: 'Le Grand Centième de Contrée',
    subtitle: 'Parcourir 100 km dans le mois',
    description: 'Franchissez la barre mythique des 100 km mensuels pour recevoir la besace sacrée.',
    targetMeters: 100000,
    xpReward: 1000,
    categoryAffinity: 'histoire',
    periodBadgeLabel: 'Mensuel · 30j',
    exclusiveCosmetic: {
      id: 'besace_pelerin_lunes',
      slot: 'pack',
      name: 'Besace du Pèlerin des Lunes',
      subtitle: 'Paquetage exclusif 100 km · Besace brodée d’argent et perles de lune',
      rarity: 'epique',
      icon: 'backpack',
    },
  },
  {
    id: 'walk_monthly_150k',
    period: 'monthly',
    title: 'Odyssée des Lointains Horizons',
    subtitle: 'Parcourir 150 km dans le mois',
    description: 'Le sceau d’or des marcheurs infatigables arpentant les paysages de France.',
    targetMeters: 150000,
    xpReward: 1500,
    categoryAffinity: 'geographie',
    periodBadgeLabel: 'Mensuel · 30j',
  },

  // --- ANNUELS (365 jours) ---
  {
    id: 'walk_annual_365k',
    period: 'annual',
    title: 'Un Kilomètre sous les Étoiles',
    subtitle: 'Parcourir 365 km sur l’année',
    description: 'L’équivalent d’un kilomètre quotidien sur une année entière d’expédition.',
    targetMeters: 365000,
    xpReward: 2500,
    categoryAffinity: 'ecosysteme',
    periodBadgeLabel: 'Annuel · 365j',
    exclusiveCosmetic: {
      id: 'manteau_quatre_saisons',
      slot: 'outfit',
      name: 'Manteau des Quatre Saisons',
      subtitle: 'Tenue exclusive 365 km · Tissage d’or, bourgeons, feuilles d’automne & givre',
      rarity: 'legendaire',
      icon: 'shield',
    },
  },
  {
    id: 'walk_annual_500k',
    period: 'annual',
    title: 'La Grande Diagonale de France',
    subtitle: 'Parcourir 500 km sur l’année',
    description: 'La traversée d’un demi-millier de kilomètres à travers les reliefs et forêts.',
    targetMeters: 500000,
    xpReward: 4000,
    categoryAffinity: 'geographie',
    periodBadgeLabel: 'Annuel · 365j',
    exclusiveCosmetic: {
      id: 'sacoche_astronavigatrice',
      slot: 'pack',
      name: 'Sacoche Astronavigatrice',
      subtitle: 'Paquetage exclusif 500 km · Sacoche céleste sertie de laiton & atlas astral',
      rarity: 'legendaire',
      icon: 'backpack',
    },
  },
  {
    id: 'walk_annual_1000k',
    period: 'annual',
    title: 'Chemin Immortel des Éclaireurs',
    subtitle: 'Parcourir 1 000 km sur l’année',
    description: 'Le sommet légendaire de la marche contemplative : 1 000 km foulés à pied.',
    targetMeters: 1000000,
    xpReward: 10000,
    categoryAffinity: 'histoire',
    periodBadgeLabel: 'Annuel · 365j',
    exclusiveCosmetic: {
      id: 'couronne_grand_arpenteur',
      slot: 'headgear',
      name: 'Couronne Boréale du Grand Arpenteur',
      subtitle: 'Couvre-chef légendaire 1 000 km · Diadème d’or boréal et gemmes d’étoiles',
      rarity: 'legendaire',
      icon: 'star',
    },
  },

  // --- ÉVÉNEMENTIELS ---
  {
    id: 'walk_event_seasonal',
    period: 'event',
    title: 'Transhumance des Équinoxes & Solstices',
    subtitle: 'Parcourir 12 km pendant l’événement saisonnier',
    description: 'Accompagnez le cycle des astres et la bascule de saison le long des sentiers.',
    targetMeters: 12000,
    xpReward: 500,
    categoryAffinity: 'legende',
    periodBadgeLabel: 'Événement Saisonnier',
    exclusiveCosmetic: {
      id: 'lerot_dore',
      slot: 'familiar',
      name: 'Lérot Doré des Sentiers Perdus',
      subtitle: 'Familier exclusif 12 km · Petit lérot ambré portant une noix gravée de runes',
      rarity: 'epique',
      icon: 'paw',
    },
  },
  {
    id: 'walk_event_night_mist',
    period: 'event',
    title: 'Échappée des Brumes Telluriques',
    subtitle: 'Parcourir 8 km en saison voilée',
    description: 'Foulez le sol dans les brumes matinales et le crépuscule des clairières.',
    targetMeters: 8000,
    xpReward: 350,
    categoryAffinity: 'etrange',
    periodBadgeLabel: 'Événement Tellurique',
    exclusiveCosmetic: {
      id: 'lanterne_brumes_marais',
      slot: 'tool',
      name: 'Lanterne Feutrée des Marais',
      subtitle: 'Outil exclusif 8 km · Lanterne en fer forgé à flamme verte tamisée',
      rarity: 'rare',
      icon: 'lantern',
    },
  },
  {
    id: 'walk_event_heritage',
    period: 'event',
    title: 'Circuit des Merveilles Patrimoniales',
    subtitle: 'Parcourir 20 km lors des journées d’expédition',
    description: 'Rejoignez la grande fête des marcheurs du patrimoine et des terroirs.',
    targetMeters: 20000,
    xpReward: 700,
    categoryAffinity: 'histoire',
    periodBadgeLabel: 'Événement Patrimoine',
    exclusiveCosmetic: {
      id: 'tabard_maitres_marcheurs',
      slot: 'outfit',
      name: 'Tabard des Maîtres Marcheurs',
      subtitle: 'Tenue exclusive 20 km · Tabard d’écru orné des cinq sceaux de guilde',
      rarity: 'epique',
      icon: 'shield',
    },
  },
];

// ----------------------------------------------------------------------------
// DATE & PERIOD HELPERS
// ----------------------------------------------------------------------------

function getIsoWeekNumber(d: Date): number {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

export function computePeriodKeys(d: Date = new Date()): WalkingPeriodKeys {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const week = String(getIsoWeekNumber(d)).padStart(2, '0');

  // Event key based on current quarter / astronomical season
  const month = d.getMonth();
  const seasonName =
    month >= 2 && month <= 4
      ? 'printemps'
      : month >= 5 && month <= 7
      ? 'ete'
      : month >= 8 && month <= 10
      ? 'automne'
      : 'hiver';

  return {
    dailyKey: `${yyyy}-${mm}-${dd}`,
    weeklyKey: `${yyyy}-W${week}`,
    monthlyKey: `${yyyy}-${mm}`,
    annualKey: `${yyyy}`,
    eventKey: `event_${seasonName}_${yyyy}`,
  };
}

const STORAGE_KEY = 'terra16_walking_challenges_v1';

export function loadWalkingChallengesState(now: Date = new Date()): WalkingChallengesState {
  const curKeys = computePeriodKeys(now);
  const fallback: WalkingChallengesState = {
    keys: curKeys,
    metrics: {
      dailyMeters: 0,
      weeklyMeters: 0,
      monthlyMeters: 0,
      annualMeters: 0,
      eventMeters: 0,
      totalLifetimeMeters: 0,
    },
    claimedChallengeIds: [],
    unlockedCosmeticIds: [],
    historyDays: {},
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<WalkingChallengesState>;
    const savedKeys = parsed.keys || curKeys;
    const metrics: WalkingDistanceMetrics = {
      dailyMeters: savedKeys.dailyKey === curKeys.dailyKey ? parsed.metrics?.dailyMeters || 0 : 0,
      weeklyMeters: savedKeys.weeklyKey === curKeys.weeklyKey ? parsed.metrics?.weeklyMeters || 0 : 0,
      monthlyMeters: savedKeys.monthlyKey === curKeys.monthlyKey ? parsed.metrics?.monthlyMeters || 0 : 0,
      annualMeters: savedKeys.annualKey === curKeys.annualKey ? parsed.metrics?.annualMeters || 0 : 0,
      eventMeters: savedKeys.eventKey === curKeys.eventKey ? parsed.metrics?.eventMeters || 0 : 0,
      totalLifetimeMeters: parsed.metrics?.totalLifetimeMeters || 0,
    };

    const historyDays = { ...(parsed.historyDays || {}) };
    if (savedKeys.dailyKey !== curKeys.dailyKey && (parsed.metrics?.dailyMeters || 0) > 0) {
      historyDays[savedKeys.dailyKey] = parsed.metrics!.dailyMeters;
    }

    return {
      keys: curKeys,
      metrics,
      claimedChallengeIds: Array.isArray(parsed.claimedChallengeIds) ? parsed.claimedChallengeIds : [],
      unlockedCosmeticIds: Array.isArray(parsed.unlockedCosmeticIds) ? parsed.unlockedCosmeticIds : [],
      historyDays,
    };
  } catch {
    return fallback;
  }
}

export function saveWalkingChallengesState(state: WalkingChallengesState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota restrictions
  }
}

export function getDistanceForPeriod(
  metrics: WalkingDistanceMetrics,
  period: WalkingChallengePeriod
): number {
  switch (period) {
    case 'daily':
      return metrics.dailyMeters;
    case 'weekly':
      return metrics.weeklyMeters;
    case 'monthly':
      return metrics.monthlyMeters;
    case 'annual':
      return metrics.annualMeters;
    case 'event':
      return metrics.eventMeters;
    default:
      return metrics.dailyMeters;
  }
}

export function isWalkingChallengeCompleted(
  challenge: WalkingChallengeDef,
  metrics: WalkingDistanceMetrics
): boolean {
  const currentMeters = getDistanceForPeriod(metrics, challenge.period);
  return currentMeters >= challenge.targetMeters;
}

export function recordStepDistanceInState(
  state: WalkingChallengesState,
  addedMeters: number,
  now: Date = new Date()
): {
  nextState: WalkingChallengesState;
  newlyCompletedChallenges: WalkingChallengeDef[];
} {
  const curKeys = computePeriodKeys(now);
  const sameDaily = state.keys.dailyKey === curKeys.dailyKey;
  const sameWeekly = state.keys.weeklyKey === curKeys.weeklyKey;
  const sameMonthly = state.keys.monthlyKey === curKeys.monthlyKey;
  const sameAnnual = state.keys.annualKey === curKeys.annualKey;
  const sameEvent = state.keys.eventKey === curKeys.eventKey;

  const prevDaily = sameDaily ? state.metrics.dailyMeters : 0;
  const prevWeekly = sameWeekly ? state.metrics.weeklyMeters : 0;
  const prevMonthly = sameMonthly ? state.metrics.monthlyMeters : 0;
  const prevAnnual = sameAnnual ? state.metrics.annualMeters : 0;
  const prevEvent = sameEvent ? state.metrics.eventMeters : 0;
  const prevLifetime = state.metrics.totalLifetimeMeters;

  const nextMetrics: WalkingDistanceMetrics = {
    dailyMeters: prevDaily + addedMeters,
    weeklyMeters: prevWeekly + addedMeters,
    monthlyMeters: prevMonthly + addedMeters,
    annualMeters: prevAnnual + addedMeters,
    eventMeters: prevEvent + addedMeters,
    totalLifetimeMeters: prevLifetime + addedMeters,
  };

  const historyDays = { ...state.historyDays };
  if (!sameDaily && state.metrics.dailyMeters > 0) {
    historyDays[state.keys.dailyKey] = state.metrics.dailyMeters;
  }
  historyDays[curKeys.dailyKey] = nextMetrics.dailyMeters;

  // Detect newly completed challenges that weren't completed before this step
  const prevMetrics: WalkingDistanceMetrics = {
    dailyMeters: prevDaily,
    weeklyMeters: prevWeekly,
    monthlyMeters: prevMonthly,
    annualMeters: prevAnnual,
    eventMeters: prevEvent,
    totalLifetimeMeters: prevLifetime,
  };

  const newlyCompletedChallenges: WalkingChallengeDef[] = [];
  for (const c of WALKING_CHALLENGES_CATALOG) {
    const wasCompleted = isWalkingChallengeCompleted(c, prevMetrics);
    const isNowCompleted = isWalkingChallengeCompleted(c, nextMetrics);
    const isClaimed = state.claimedChallengeIds.includes(c.id);
    if (!wasCompleted && isNowCompleted && !isClaimed) {
      newlyCompletedChallenges.push(c);
    }
  }

  const nextState: WalkingChallengesState = {
    keys: curKeys,
    metrics: nextMetrics,
    claimedChallengeIds: state.claimedChallengeIds,
    unlockedCosmeticIds: state.unlockedCosmeticIds,
    historyDays,
  };

  saveWalkingChallengesState(nextState);
  return { nextState, newlyCompletedChallenges };
}

export function claimWalkingChallengeReward(
  state: WalkingChallengesState,
  challengeId: string,
  progress: ExplorerProgress
): {
  nextState: WalkingChallengesState;
  nextProgress: ExplorerProgress;
  challenge: WalkingChallengeDef;
} {
  const challenge = WALKING_CHALLENGES_CATALOG.find((c) => c.id === challengeId);
  if (!challenge) {
    throw new Error(`Défi de marche introuvable: ${challengeId}`);
  }
  if (state.claimedChallengeIds.includes(challengeId)) {
    return { nextState: state, nextProgress: progress, challenge };
  }

  const nextClaimed = [...state.claimedChallengeIds, challengeId];
  const nextCosmetics = challenge.exclusiveCosmetic
    ? Array.from(new Set([...state.unlockedCosmeticIds, challenge.exclusiveCosmetic.id]))
    : state.unlockedCosmeticIds;

  const nextState: WalkingChallengesState = {
    ...state,
    claimedChallengeIds: nextClaimed,
    unlockedCosmeticIds: nextCosmetics,
  };

  saveWalkingChallengesState(nextState);

  // Update ExplorerProgress with XP and claimed walking challenge ID
  const nextProgress: ExplorerProgress = {
    ...progress,
    totalXp: progress.totalXp + challenge.xpReward,
    claimedWalkingChallengeIds: Array.from(
      new Set([...(progress.claimedWalkingChallengeIds || []), challengeId])
    ),
  };

  // Assign category XP bonus
  if (challenge.categoryAffinity === 'histoire') {
    nextProgress.xpHistoire = (nextProgress.xpHistoire || 0) + challenge.xpReward;
  } else if (challenge.categoryAffinity === 'geographie') {
    nextProgress.xpGeographie = (nextProgress.xpGeographie || 0) + challenge.xpReward;
  } else if (challenge.categoryAffinity === 'ecosysteme') {
    nextProgress.xpEcosysteme = (nextProgress.xpEcosysteme || 0) + challenge.xpReward;
  } else if (challenge.categoryAffinity === 'legende') {
    nextProgress.xpLegende = (nextProgress.xpLegende || 0) + challenge.xpReward;
  } else if (challenge.categoryAffinity === 'etrange') {
    nextProgress.xpEtrange = (nextProgress.xpEtrange || 0) + challenge.xpReward;
  }

  return { nextState, nextProgress, challenge };
}
