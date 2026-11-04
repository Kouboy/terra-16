import React, { useEffect, useRef } from 'react';
import { LocalFestivalItem } from './almanacAndQuests';
import {
  computeRealMoonPhase,
  getUpcomingOrActiveMeteorShower,
  MoonPhaseInfo,
} from './astronomyAndSeasons';
import { isEntryFromSecretArchive, SecretArchivesState } from './secretArchives';
import {
  CollectedSpecimen,
  EffectiveTimeOfDay,
  ExplorationCategory,
  ExplorerAvatarPreset,
  ExplorerFamiliarId,
  ExplorerGender,
  ExplorerHeadgearId,
  ExplorerOutfitId,
  ExplorerProgress,
  ExplorerSkinTone,
  HistoricalStratum,
  inferOfficialStateLabel,
  OpenedArchivistChestRecord,
  PoiItem,
  TrophyId,
  UnlockedEntry,
  WeatherInfo,
} from './types';

// ============================================================================
// 1. PANTHÉON MULTIJOUEUR (XP + DIVERSITÉ + RARETÉ)
// ============================================================================

export type PantheonSortKey = 'pantheon' | 'xp' | 'diversity' | 'rarity' | 'discoveries';

export interface PantheonMetrics {
  pantheonScore: number;
  totalXp: number;
  diversityScore: number;
  rarityScore: number;
  discoveriesCount: number;
  categoriesCount: number;
  strataCount: number;
  sourcesCount: number;
  affinitiesCount: number;
  subTypesCount: number;
  secretArchivesCount: number;
  officialHeritageCount: number;
  subterraneanCount: number;
  archivistChestsCount: number;
  liveEventsCount: number;
  riddlesCount: number;
}

export interface PantheonLeaderboardRow {
  explorerId: string;
  explorerCallsign: string;
  regionLabel: string;
  pantheonScore: number;
  totalXp: number;
  diversityScore: number;
  rarityScore: number;
  discoveriesCount: number;
  categoriesCount: number;
  strataCount: number;
  sourcesCount: number;
  secretArchivesCount: number;
  officialHeritageCount: number;
  liveEventsCount: number;
  explorerGender?: ExplorerGender;
  explorerAvatarPreset?: ExplorerAvatarPreset;
  explorerSkinTone?: ExplorerSkinTone;
  explorerHeadgearId?: ExplorerHeadgearId;
  explorerOutfitId?: ExplorerOutfitId;
  explorerFamiliarId?: ExplorerFamiliarId;
  explorerPinnedTrophyId?: TrophyId | '';
  isLocalSelf?: boolean;
}

export interface RankedPantheonExplorer extends PantheonLeaderboardRow {
  rank: number;
}

function inferStratumBucketFromEraLabel(eraLabel: string): HistoricalStratum {
  const s = (eraLabel || '').toLowerCase();
  if (/ma\b|jurassique|crétacé|trias|paléozo|cénozo|karst|temps profond|géolog/i.test(s)) {
    return 'temps_profond';
  }
  if (/préhistoire|néolithique|paléolithique|mégalithe|âge du bronze|âge du fer/i.test(s)) {
    return 'prehistoire';
  }
  if (/antiquit|gallo-romain|romain|gaulois/i.test(s)) {
    return 'antiquite';
  }
  if (/moyen âge|médiéval|féodal|roman|gothique|xiie|xiiie|xive|xve/i.test(s)) {
    return 'moyen_age';
  }
  if (/moderne|renaissance|xvie|xviie|xviiie|classique/i.test(s)) {
    return 'moderne';
  }
  if (/folklore|légende|mythe|vivant|biodiversité|sanctuaire/i.test(s)) {
    return 'vivant_folklore';
  }
  return 'contemporain';
}

export function isEntryFromLiveEvent(entry: Pick<UnlockedEntry, 'poiId' | 'subType' | 'source'>): boolean {
  return (
    entry.poiId.startsWith('live_evt_') ||
    entry.subType.startsWith('✦ Événement Vivant') ||
    entry.source === 'Chronique des Phénomènes Réels'
  );
}

export function computeExplorerPantheonMetrics(params: {
  progress: ExplorerProgress;
  entries: UnlockedEntry[];
  specimens: CollectedSpecimen[];
  openedChests: OpenedArchivistChestRecord[];
  secretState: SecretArchivesState;
  solvedRiddleIds: ReadonlySet<string>;
  claimedLiveEventIds: ReadonlySet<string>;
}): PantheonMetrics {
  const {
    progress,
    entries,
    specimens,
    openedChests,
    secretState,
    solvedRiddleIds,
    claimedLiveEventIds,
  } = params;

  const realFieldEntries = entries.filter((e) => !isEntryFromLiveEvent(e));

  const categories = new Set<ExplorationCategory>();
  const strata = new Set<HistoricalStratum>();
  const sources = new Set<string>();
  const subTypes = new Set<string>();
  let officialHeritageCount = 0;
  let subterraneanCount = 0;

  for (const e of realFieldEntries) {
    categories.add(e.category);
    strata.add(inferStratumBucketFromEraLabel(e.eraLabel));
    if (e.source) sources.add(e.source.trim().toLowerCase());
    if (e.subType) subTypes.add(e.subType.trim().toLowerCase());

    if (inferOfficialStateLabel(e.source, e.subType)) {
      officialHeritageCount += 1;
    }
    if (
      e.poiId.startsWith('subpoi_') ||
      /cavité|grotte|gouffre|souterrain|crypte|hypogée|carrière|mine|aqueduc|cours enterré|tunnel/i.test(
        `${e.subType} ${e.name} ${e.source}`
      )
    ) {
      subterraneanCount += 1;
    }
  }

  for (const ch of openedChests) {
    if (ch.isSubterranean || ch.archetype === 'bouche_souterraine') {
      subterraneanCount += 1;
    }
  }

  const affinities = new Set(specimens.map((s) => s.affinity));

  // Count secret archives from both state and Carnet entries
  const secretIds = new Set<string>(
    secretState.discoveredSecretRecords.map((r) => r.secretPoiId)
  );
  for (const e of realFieldEntries) {
    if (isEntryFromSecretArchive(e, secretState)) {
      secretIds.add(e.poiId);
    }
  }

  const secretArchivesCount = secretIds.size;
  const archivistChestsCount = openedChests.length;
  const liveEventEntriesCount = entries.filter((e) => isEntryFromLiveEvent(e)).length;
  const liveEventsCount = Math.max(
    Math.round(progress.claimedLiveEventsCount || 0),
    claimedLiveEventIds.size,
    liveEventEntriesCount
  );
  const riddlesCount = Math.max(
    Math.round(progress.solvedRiddlesCount || 0),
    solvedRiddleIds.size
  );

  const categoriesCount = Math.min(5, categories.size);
  const strataCount = Math.min(7, strata.size);
  const sourcesCount = Math.min(20, sources.size);
  const affinitiesCount = Math.min(7, affinities.size);
  const subTypesCount = Math.min(35, subTypes.size);

  // Pillar 1: Experience Points
  const totalXp = Math.max(0, Math.round(progress.totalXp));

  // Pillar 2: Discovery Diversity (Branches, Historical Strata, Open-Data Archives, Bedrock Affinities, Typologies)
  const diversityScore =
    categoriesCount * 120 +
    strataCount * 90 +
    sourcesCount * 55 +
    affinitiesCount * 70 +
    subTypesCount * 20;

  // Pillar 3: Discovery Rarity (Secret Hidden Archives, State Monuments/Labels, Subterranean, Archivist Chests, Live Phenomena, Scholar Seals)
  const rarityScore =
    secretArchivesCount * 350 +
    officialHeritageCount * 140 +
    subterraneanCount * 130 +
    archivistChestsCount * 160 +
    liveEventsCount * 220 +
    riddlesCount * 90;

  const pantheonScore = totalXp + diversityScore + rarityScore;
  const discoveriesCount = Math.max(
    Math.round(progress.discoveriesCount || 0),
    realFieldEntries.length
  );

  return {
    pantheonScore,
    totalXp,
    diversityScore,
    rarityScore,
    discoveriesCount,
    categoriesCount,
    strataCount,
    sourcesCount,
    affinitiesCount,
    subTypesCount,
    secretArchivesCount,
    officialHeritageCount,
    subterraneanCount,
    archivistChestsCount,
    liveEventsCount,
    riddlesCount,
  };
}

export function buildPantheonLeaderboard(params: {
  cloudRows: PantheonLeaderboardRow[];
  localExplorerId: string | null;
  localCallsign: string;
  localRegionLabel: string;
  localMetrics: PantheonMetrics;
  localProgress: ExplorerProgress;
  sortBy: PantheonSortKey;
}): RankedPantheonExplorer[] {
  const {
    cloudRows,
    localExplorerId,
    localCallsign,
    localRegionLabel,
    localMetrics,
    localProgress,
    sortBy,
  } = params;

  const byExplorer = new Map<string, PantheonLeaderboardRow>();
  for (const r of cloudRows) {
    if (!r.explorerId) continue;
    byExplorer.set(r.explorerId, {
      ...r,
      isLocalSelf: Boolean(localExplorerId && r.explorerId === localExplorerId),
    });
  }

  const selfKey = localExplorerId || 'local_self_explorer';
  const existingCloud = byExplorer.get(selfKey);

  // Merge local explorer's real-time metrics so their live progress is always reflected accurately
  if (localMetrics.pantheonScore > 0 || localMetrics.discoveriesCount > 0 || existingCloud) {
    byExplorer.set(selfKey, {
      explorerId: selfKey,
      explorerCallsign: localCallsign || existingCloud?.explorerCallsign || 'Explorateur',
      regionLabel: localRegionLabel || existingCloud?.regionLabel || 'Contrée explorée',
      pantheonScore: Math.max(existingCloud?.pantheonScore || 0, localMetrics.pantheonScore),
      totalXp: Math.max(existingCloud?.totalXp || 0, localMetrics.totalXp),
      diversityScore: Math.max(existingCloud?.diversityScore || 0, localMetrics.diversityScore),
      rarityScore: Math.max(existingCloud?.rarityScore || 0, localMetrics.rarityScore),
      discoveriesCount: Math.max(
        existingCloud?.discoveriesCount || 0,
        localMetrics.discoveriesCount
      ),
      categoriesCount: Math.max(
        existingCloud?.categoriesCount || 0,
        localMetrics.categoriesCount
      ),
      strataCount: Math.max(existingCloud?.strataCount || 0, localMetrics.strataCount),
      sourcesCount: Math.max(existingCloud?.sourcesCount || 0, localMetrics.sourcesCount),
      secretArchivesCount: Math.max(
        existingCloud?.secretArchivesCount || 0,
        localMetrics.secretArchivesCount
      ),
      officialHeritageCount: Math.max(
        existingCloud?.officialHeritageCount || 0,
        localMetrics.officialHeritageCount
      ),
      liveEventsCount: Math.max(
        existingCloud?.liveEventsCount || 0,
        localMetrics.liveEventsCount
      ),
      explorerGender: localProgress.gender || existingCloud?.explorerGender,
      explorerAvatarPreset: localProgress.avatarPreset || existingCloud?.explorerAvatarPreset,
      explorerSkinTone: localProgress.skinTone || existingCloud?.explorerSkinTone,
      explorerHeadgearId: localProgress.headgearId || existingCloud?.explorerHeadgearId,
      explorerOutfitId: localProgress.outfitId || existingCloud?.explorerOutfitId,
      explorerFamiliarId: localProgress.familiarId || existingCloud?.explorerFamiliarId,
      explorerPinnedTrophyId:
        localProgress.pinnedTrophyId !== undefined
          ? localProgress.pinnedTrophyId
          : existingCloud?.explorerPinnedTrophyId,
      isLocalSelf: true,
    });
  }

  const list = Array.from(byExplorer.values());
  list.sort((a, b) => {
    let diff = 0;
    switch (sortBy) {
      case 'xp':
        diff = b.totalXp - a.totalXp;
        break;
      case 'diversity':
        diff = b.diversityScore - a.diversityScore;
        break;
      case 'rarity':
        diff = b.rarityScore - a.rarityScore;
        break;
      case 'discoveries':
        diff = b.discoveriesCount - a.discoveriesCount;
        break;
      case 'pantheon':
      default:
        diff = b.pantheonScore - a.pantheonScore;
        break;
    }
    if (diff !== 0) return diff;
    if (b.pantheonScore !== a.pantheonScore) return b.pantheonScore - a.pantheonScore;
    return a.explorerCallsign.localeCompare(b.explorerCallsign, 'fr');
  });

  return list.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}

// ============================================================================
// 2. MÉDAILLONS 16-BIT D'ÉVÉNEMENTS VIVANTS (8 INSIGNES PIXEL-ART)
// ============================================================================

export type LiveEventMedallionId =
  | 'medaille_pluie_meteores'
  | 'medaille_syzygie_lunaire'
  | 'medaille_eaux_vives_pluie'
  | 'medaille_bourrasque_orage'
  | 'medaille_voile_brumes'
  | 'medaille_cristal_givre'
  | 'medaille_cadran_solaire'
  | 'medaille_festival_vivant';

export interface LiveEventMedallionDef {
  id: LiveEventMedallionId;
  name: string;
  phenomenonLabel: string;
  lore: string;
  palette: {
    rim: string;
    bg: string;
    primary: string;
    highlight: string;
    accent: string;
  };
}

export const LIVE_EVENT_MEDALLIONS_CATALOG: LiveEventMedallionDef[] = [
  {
    id: 'medaille_pluie_meteores',
    name: 'Médaillon des Pluies d’Étoiles',
    phenomenonLabel: 'Essaim météoritique astronomique',
    lore: 'Frappé dans un alliage d’obsidienne et de laiton céleste en souvenir d’une exploration menée sous le passage d’un essaim de météores.',
    palette: {
      rim: '#f59e0b',
      bg: '#0f172a',
      primary: '#38bdf8',
      highlight: '#fef08a',
      accent: '#f97316',
    },
  },
  {
    id: 'medaille_syzygie_lunaire',
    name: 'Médaillon de Syzygie Lunaire',
    phenomenonLabel: 'Phase lunaire & veillée astrale',
    lore: 'Gravé selon les tables d’éphémérides lunaires pour saluer les veilleurs qui arpentent les reliefs sous le disque d’argent ou le ciel profond.',
    palette: {
      rim: '#a5b4fc',
      bg: '#1e1b4b',
      primary: '#e2e8f0',
      highlight: '#ffffff',
      accent: '#fde047',
    },
  },
  {
    id: 'medaille_eaux_vives_pluie',
    name: 'Médaillon des Gargouilles & Ondées',
    phenomenonLabel: 'Pluie active en temps réel',
    lore: 'Décerné aux marcheurs qui sortent sous l’averse réelle lorsque chantent les chéneaux, lavoirs, fontaines et ruisseaux gonflés.',
    palette: {
      rim: '#38bdf8',
      bg: '#0c4a6e',
      primary: '#7dd3fc',
      highlight: '#e0f2fe',
      accent: '#fbbf24',
    },
  },
  {
    id: 'medaille_bourrasque_orage',
    name: 'Médaillon des Marcheurs de Bourrasque',
    phenomenonLabel: 'Orage ou vent soutenu en direct',
    lore: 'Ciselé pour celles et ceux qui tiennent le cap face aux rafales et ciels électriques relevés sur leur secteur.',
    palette: {
      rim: '#fbbf24',
      bg: '#1e293b',
      primary: '#facc15',
      highlight: '#fef9c3',
      accent: '#38bdf8',
    },
  },
  {
    id: 'medaille_voile_brumes',
    name: 'Médaillon du Voile des Brumes',
    phenomenonLabel: 'Brouillard & brume atmosphérique',
    lore: 'Scelle la mémoire d’une reconnaissance menée lorsque les brumes estompent les clochers, les combes et les mégalithes.',
    palette: {
      rim: '#cbd5e1',
      bg: '#334155',
      primary: '#94a3b8',
      highlight: '#f8fafc',
      accent: '#c084fc',
    },
  },
  {
    id: 'medaille_cristal_givre',
    name: 'Médaillon des Pierres Givrées',
    phenomenonLabel: 'Neige ou gelée vive en direct',
    lore: 'Immortalisé dans l’émail bleu glacier pour les explorateurs bravant les morsures du gel ou les flocons sur les vieilles pierres.',
    palette: {
      rim: '#bae6fd',
      bg: '#0f172a',
      primary: '#38bdf8',
      highlight: '#ffffff',
      accent: '#a5b4fc',
    },
  },
  {
    id: 'medaille_cadran_solaire',
    name: 'Médaillon Héliographique',
    phenomenonLabel: 'Fenêtre météo claire & ombres portées',
    lore: 'Célèbre le relevé topographique par ciel dégagé ou lumineux, lorsque les cadrans solaires et frontons sculptés livrent chaque détail.',
    palette: {
      rim: '#d97706',
      bg: '#451a03',
      primary: '#f59e0b',
      highlight: '#fef08a',
      accent: '#38bdf8',
    },
  },
  {
    id: 'medaille_festival_vivant',
    name: 'Médaillon des Scènes & Festivals',
    phenomenonLabel: 'Festival culturel local référencé',
    lore: 'Relie l’arpentage patrimonial à l’effervescence vivante des festivals et rencontres culturelles recensés sur le territoire.',
    palette: {
      rim: '#f43f5e',
      bg: '#4c0519',
      primary: '#fb7185',
      highlight: '#fef08a',
      accent: '#c084fc',
    },
  },
];

export function getLiveEventMedallionById(id: LiveEventMedallionId): LiveEventMedallionDef {
  return (
    LIVE_EVENT_MEDALLIONS_CATALOG.find((m) => m.id === id) || LIVE_EVENT_MEDALLIONS_CATALOG[0]
  );
}

export function drawLiveEventMedallion16Bit(
  ctx: CanvasRenderingContext2D,
  id: LiveEventMedallionId,
  pixelScale = 2,
  unlocked = true
): void {
  const def = getLiveEventMedallionById(id);
  const s = Math.max(1, Math.round(pixelScale));
  ctx.clearRect(0, 0, 20 * s, 20 * s);

  const rim = unlocked ? def.palette.rim : '#57534e';
  const bg = unlocked ? def.palette.bg : '#1c1917';
  const pri = unlocked ? def.palette.primary : '#78716c';
  const hi = unlocked ? def.palette.highlight : '#a8a29e';
  const acc = unlocked ? def.palette.accent : '#52525b';

  const p = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * s, y * s, w * s, h * s);
  };

  // Octagonal border & recessed enamel core (20x20 grid)
  p(5, 1, 10, 18, '#1b1109');
  p(3, 2, 14, 16, '#1b1109');
  p(2, 3, 16, 14, '#1b1109');
  p(1, 5, 18, 10, '#1b1109');

  p(5, 2, 10, 16, rim);
  p(3, 3, 14, 14, rim);
  p(2, 5, 16, 10, rim);

  p(5, 4, 10, 12, bg);
  p(4, 5, 12, 10, bg);

  switch (id) {
    case 'medaille_pluie_meteores': {
      p(12, 5, 3, 3, hi);
      p(10, 7, 2, 2, acc);
      p(8, 9, 2, 2, pri);
      p(6, 11, 2, 1, pri);
      p(6, 6, 2, 2, hi);
      p(13, 12, 1, 1, hi);
      break;
    }
    case 'medaille_syzygie_lunaire': {
      p(7, 6, 6, 8, pri);
      p(6, 7, 8, 6, pri);
      p(8, 7, 4, 5, hi);
      p(11, 8, 2, 2, acc);
      p(5, 5, 1, 1, acc);
      p(14, 13, 1, 1, acc);
      break;
    }
    case 'medaille_eaux_vives_pluie': {
      p(6, 5, 8, 3, pri);
      p(5, 6, 10, 2, hi);
      p(6, 10, 2, 3, pri);
      p(10, 9, 2, 4, hi);
      p(13, 11, 2, 3, acc);
      break;
    }
    case 'medaille_bourrasque_orage': {
      p(10, 5, 3, 2, hi);
      p(9, 7, 3, 2, pri);
      p(8, 9, 5, 2, hi);
      p(10, 11, 2, 2, pri);
      p(9, 13, 2, 2, acc);
      break;
    }
    case 'medaille_voile_brumes': {
      p(5, 6, 9, 2, hi);
      p(7, 9, 8, 2, pri);
      p(4, 12, 10, 2, acc);
      break;
    }
    case 'medaille_cristal_givre': {
      p(9, 5, 2, 10, hi);
      p(5, 9, 10, 2, hi);
      p(7, 7, 6, 6, pri);
      p(9, 9, 2, 2, '#ffffff');
      break;
    }
    case 'medaille_cadran_solaire': {
      p(7, 7, 6, 6, pri);
      p(8, 8, 4, 4, hi);
      p(9, 4, 2, 2, hi);
      p(9, 14, 2, 2, hi);
      p(4, 9, 2, 2, hi);
      p(14, 9, 2, 2, hi);
      break;
    }
    case 'medaille_festival_vivant': {
      p(5, 6, 10, 2, hi);
      p(6, 8, 8, 6, pri);
      p(8, 9, 4, 5, acc);
      p(9, 4, 2, 2, hi);
      break;
    }
  }
}

export const LiveEventMedallionCanvas: React.FC<{
  medallionId: LiveEventMedallionId;
  unlocked?: boolean;
  pixelScale?: number;
  className?: string;
}> = ({ medallionId, unlocked = true, pixelScale = 2, className = '' }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const size = 20 * pixelScale;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    drawLiveEventMedallion16Bit(ctx, medallionId, pixelScale, unlocked);
  }, [medallionId, unlocked, pixelScale]);

  return React.createElement('canvas', {
    ref,
    width: size,
    height: size,
    className: `shrink-0 [image-rendering:pixelated] ${className}`,
    'aria-hidden': 'true',
  });
};

// ============================================================================
// 3. MOTEUR D'ÉVÉNEMENTS VIVANTS & PHÉNOMÈNES RÉELS TEMPORISÉS
// ============================================================================

export type LiveWorldPhenomenonKind = 'astronomie' | 'meteo_direct' | 'festival_local' | 'crepuscule';

export interface LiveWorldEventChallenge {
  id: string;
  kind: LiveWorldPhenomenonKind;
  status: 'active' | 'upcoming';
  kickerFr: string;
  titleFr: string;
  phenomenonTelemetryFr: string;
  loreFr: string;
  goalLabelFr: string;
  targetCount: number;
  xpReward: number;
  rewardCategory: ExplorationCategory;
  medallionId: LiveEventMedallionId;
  chronicleTitleFr: string;
  chronicleEraLabelFr: string;
  startsAtMs: number;
  endsAtMs: number;
  focusCoords?: { lat: number; lng: number; label: string } | null;
  externalUrl?: string;
  suggestedCategoryFilter?: ExplorationCategory | 'all';
  matchesEntry: (entry: UnlockedEntry) => boolean;
}

export interface EvaluatedLiveWorldEvent {
  event: LiveWorldEventChallenge;
  currentCount: number;
  qualifyingEntries: UnlockedEntry[];
  isCompleted: boolean;
  isClaimed: boolean;
}

const LIVE_EVENTS_STORAGE_KEY = 'terra16_live_events_v1';

export interface LiveEventsPersistenceState {
  claimedEventIds: string[];
  unlockedMedallionIds: LiveEventMedallionId[];
}

const VALID_MEDALLION_SET = new Set<string>(LIVE_EVENT_MEDALLIONS_CATALOG.map((m) => m.id));

export function loadLiveEventsState(): LiveEventsPersistenceState {
  try {
    const raw = localStorage.getItem(LIVE_EVENTS_STORAGE_KEY);
    if (!raw) return { claimedEventIds: [], unlockedMedallionIds: [] };
    const parsed = JSON.parse(raw) as Partial<LiveEventsPersistenceState>;
    const claimedEventIds = Array.isArray(parsed.claimedEventIds)
      ? parsed.claimedEventIds.filter((x): x is string => typeof x === 'string').slice(0, 300)
      : [];
    const unlockedMedallionIds = Array.isArray(parsed.unlockedMedallionIds)
      ? parsed.unlockedMedallionIds.filter(
          (x): x is LiveEventMedallionId => typeof x === 'string' && VALID_MEDALLION_SET.has(x)
        )
      : [];
    return { claimedEventIds, unlockedMedallionIds };
  } catch {
    return { claimedEventIds: [], unlockedMedallionIds: [] };
  }
}

export function saveLiveEventsState(state: LiveEventsPersistenceState): void {
  try {
    localStorage.setItem(LIVE_EVENTS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota restrictions
  }
}

function formatDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function deriveLiveWorldEvents(params: {
  nowMs?: number;
  weather?: WeatherInfo | null;
  effectiveTimeOfDay: EffectiveTimeOfDay;
  moonInfo?: MoonPhaseInfo;
  localFestivals?: LocalFestivalItem[];
  communeName?: string;
  departementName?: string;
  localAtmosphereLabel: string;
  sectorPois?: PoiItem[];
}): LiveWorldEventChallenge[] {
  const nowMs = params.nowMs ?? Date.now();
  const nowDate = new Date(nowMs);
  const moon = params.moonInfo || computeRealMoonPhase(nowDate);
  const showerInfo = getUpcomingOrActiveMeteorShower(nowDate);
  const dayKey = formatDayKey(nowDate);
  const year = nowDate.getFullYear();
  const month = nowDate.getMonth() + 1;
  const monthKey = `${year}${String(month).padStart(2, '0')}`;

  const events: LiveWorldEventChallenge[] = [];

  // --------------------------------------------------------------------------
  // 1. ASTRONOMICAL PHENOMENON (Active Meteor Shower OR Lunar Phase + Upcoming Shower)
  // --------------------------------------------------------------------------
  if (showerInfo.status === 'active') {
    const sh = showerInfo.shower;
    events.push({
      id: `astro_meteor_${year}_${sh.id}`,
      kind: 'astronomie',
      status: 'active',
      kickerFr: 'Phénomène Astronomique Réel · Essaim Météoritique',
      titleFr: `Pluie de météores : ${sh.nameFr}`,
      phenomenonTelemetryFr: `Radiant : ${sh.constellationFr} · ZHR ~${sh.zhrEstimate} météores/h · Lune illuminée à ${moon.illuminationPct}% (${moon.phaseNameFr})`,
      loreFr: `La Terre traverse actuellement le courant de poussières cométaires des ${sh.nameFr}. Relevez des points d’intérêt géodésiques, mégalithiques ou panoramiques durant le passage de l’essaim pour consigner cette fenêtre céleste dans votre Grimoire.`,
      goalLabelFr:
        'Découvrir 2 lieux d’intérêt (dont au moins un repère Géologie, Légendes ou Histoire) durant le passage de l’essaim',
      targetCount: 2,
      xpReward: 240,
      rewardCategory: 'geographie',
      medallionId: 'medaille_pluie_meteores',
      chronicleTitleFr: `Chronique Céleste — Sous l’essaim des ${sh.nameFr}`,
      chronicleEraLabelFr: `Éphéméride céleste (${sh.constellationFr})`,
      startsAtMs: showerInfo.startsAtMs,
      endsAtMs: showerInfo.endsAtMs,
      suggestedCategoryFilter: 'geographie',
      matchesEntry: (entry) => {
        if (isEntryFromLiveEvent(entry)) return false;
        const ts = Date.parse(entry.discoveredAtIso);
        return Number.isFinite(ts) && ts >= showerInfo.startsAtMs && ts <= showerInfo.endsAtMs;
      },
    });
  } else {
    // Active Lunar Phase 48h Window + Upcoming Meteor Shower preview
    const dayStart = new Date(year, nowDate.getMonth(), nowDate.getDate(), 0, 0, 0, 0).getTime();
    const dayEnd = dayStart + 2 * 86_400_000 - 1;
    const isFullOrNew = moon.phaseIndex === 0 || moon.phaseIndex === 4;
    events.push({
      id: `astro_moon_${dayKey}_p${moon.phaseIndex}`,
      kind: 'astronomie',
      status: 'active',
      kickerFr: 'Éphéméride Lunaire Réelle',
      titleFr:
        moon.phaseIndex === 4
          ? 'Veillée de Pleine Lune d’Argent'
          : moon.phaseIndex === 0
          ? 'Ciel Noir de Nouvelle Lune'
          : `Observation sous ${moon.phaseNameFr}`,
      phenomenonTelemetryFr: `${moon.phaseNameFr} (${moon.illuminationPct}% d’illumination) · Prochain essaim : ${showerInfo.shower.nameFr} dans ${showerInfo.daysUntilStart} j`,
      loreFr: isFullOrNew
        ? `La syzygie lunaire actuelle (${moon.phaseNameFr}) transforme la lecture des reliefs et des pierres anciennes. Profitez de cette fenêtre de 48 heures pour révéler deux archives sur le terrain.`
        : `Sous la phase « ${moon.phaseNameFr} » (${moon.illuminationPct}%), les géographes et chroniqueurs relèvent les repères du secteur en attendant l’essaim des ${showerInfo.shower.nameFr}.`,
      goalLabelFr: 'Découvrir 2 lieux d’intérêt durant cette phase lunaire',
      targetCount: 2,
      xpReward: isFullOrNew ? 210 : 175,
      rewardCategory: 'legende',
      medallionId: 'medaille_syzygie_lunaire',
      chronicleTitleFr: `Chronique Sélénite — ${moon.phaseNameFr}`,
      chronicleEraLabelFr: `Lunaison (${moon.illuminationPct}%)`,
      startsAtMs: dayStart - 86_400_000,
      endsAtMs: dayEnd,
      suggestedCategoryFilter: 'legende',
      matchesEntry: (entry) => {
        if (isEntryFromLiveEvent(entry)) return false;
        const ts = Date.parse(entry.discoveredAtIso);
        return Number.isFinite(ts) && ts >= dayStart - 86_400_000 && ts <= dayEnd;
      },
    });
  }

  // --------------------------------------------------------------------------
  // 2. LIVE REAL-WORLD WEATHER PHENOMENON (Open-Meteo Real Telemetry, 6h Window)
  // --------------------------------------------------------------------------
  const sixHourSlot = Math.floor(nowDate.getHours() / 6);
  const slotStartMs = new Date(
    year,
    nowDate.getMonth(),
    nowDate.getDate(),
    sixHourSlot * 6,
    0,
    0,
    0
  ).getTime();
  const slotEndMs = slotStartMs + 6 * 3_600_000 - 1;
  const w = params.weather;

  if (w) {
    if (w.condition === 'storm' || w.windKmh >= 28) {
      events.push({
        id: `meteo_storm_${dayKey}_s${sixHourSlot}`,
        kind: 'meteo_direct',
        status: 'active',
        kickerFr: 'Météo Temps Réel · Alerte Éolienne / Orageuse',
        titleFr: 'Les Marcheurs de Bourrasque',
        phenomenonTelemetryFr: `${w.labelFr} · ${Math.round(w.tempC)}°C · Vent ${Math.round(
          w.windKmh
        )} km/h sur ${params.communeName || params.localAtmosphereLabel}`,
        loreFr:
          'Les rafales balaient actuellement votre secteur réel. Les anciens arpenteurs profitaient de ces ciels tourmentés pour vérifier les crêtes, moulins, tours et belvédères.',
        goalLabelFr: 'Révéler 1 lieu d’intérêt durant ce créneau de bourrasque',
        targetCount: 1,
        xpReward: 215,
        rewardCategory: 'geographie',
        medallionId: 'medaille_bourrasque_orage',
        chronicleTitleFr: `Relevé de Bourrasque (${Math.round(w.windKmh)} km/h)`,
        chronicleEraLabelFr: `Météo vive · ${w.labelFr}`,
        startsAtMs: slotStartMs,
        endsAtMs: slotEndMs,
        suggestedCategoryFilter: 'all',
        matchesEntry: (entry) => {
          if (isEntryFromLiveEvent(entry)) return false;
          const ts = Date.parse(entry.discoveredAtIso);
          return Number.isFinite(ts) && ts >= slotStartMs && ts <= slotEndMs;
        },
      });
    } else if (w.condition === 'rain') {
      events.push({
        id: `meteo_rain_${dayKey}_s${sixHourSlot}`,
        kind: 'meteo_direct',
        status: 'active',
        kickerFr: 'Météo Temps Réel · Précipitations Actives',
        titleFr: 'Le Chant des Gargouilles & Eaux Vives',
        phenomenonTelemetryFr: `${w.labelFr} · ${Math.round(w.tempC)}°C · Vent ${Math.round(
          w.windKmh
        )} km/h sur ${params.communeName || params.localAtmosphereLabel}`,
        loreFr:
          'La pluie réelle fait chanter les descentes en pierre, les lavoirs, les fontaines et les rivières du secteur. Sortez consigner une archive sous l’ondée pour sceller cette chronique humide.',
        goalLabelFr: 'Découvrir 1 lieu d’intérêt pendant cet épisode pluvieux',
        targetCount: 1,
        xpReward: 205,
        rewardCategory: 'geographie',
        medallionId: 'medaille_eaux_vives_pluie',
        chronicleTitleFr: `Chronique d’Ondée — ${w.labelFr}`,
        chronicleEraLabelFr: `Pluie réelle (${Math.round(w.tempC)}°C)`,
        startsAtMs: slotStartMs,
        endsAtMs: slotEndMs,
        suggestedCategoryFilter: 'geographie',
        matchesEntry: (entry) => {
          if (isEntryFromLiveEvent(entry)) return false;
          const ts = Date.parse(entry.discoveredAtIso);
          return Number.isFinite(ts) && ts >= slotStartMs && ts <= slotEndMs;
        },
      });
    } else if (w.condition === 'fog') {
      events.push({
        id: `meteo_fog_${dayKey}_s${sixHourSlot}`,
        kind: 'meteo_direct',
        status: 'active',
        kickerFr: 'Météo Temps Réel · Brume & Brouillard',
        titleFr: 'Reconnaissance sous le Voile des Brumes',
        phenomenonTelemetryFr: `${w.labelFr} · ${Math.round(w.tempC)}°C sur ${
          params.communeName || params.localAtmosphereLabel
        }`,
        loreFr:
          'Un manteau de brume enveloppe actuellement le territoire. C’est l’heure privilégiée des légendes locales, des souterrains et des silhouettes estompées.',
        goalLabelFr: 'Découvrir 1 lieu d’intérêt dans la brume',
        targetCount: 1,
        xpReward: 210,
        rewardCategory: 'legende',
        medallionId: 'medaille_voile_brumes',
        chronicleTitleFr: 'Chronique Brumeuse — Silhouettes dans le Brouillard',
        chronicleEraLabelFr: `Brume réelle (${Math.round(w.tempC)}°C)`,
        startsAtMs: slotStartMs,
        endsAtMs: slotEndMs,
        suggestedCategoryFilter: 'legende',
        matchesEntry: (entry) => {
          if (isEntryFromLiveEvent(entry)) return false;
          const ts = Date.parse(entry.discoveredAtIso);
          return Number.isFinite(ts) && ts >= slotStartMs && ts <= slotEndMs;
        },
      });
    } else if (w.condition === 'snow' || w.tempC <= 3) {
      events.push({
        id: `meteo_frost_${dayKey}_s${sixHourSlot}`,
        kind: 'meteo_direct',
        status: 'active',
        kickerFr: 'Météo Temps Réel · Gelée ou Neige',
        titleFr: 'L’Archive des Pierres Givrées',
        phenomenonTelemetryFr: `${w.labelFr} · ${Math.round(w.tempC)}°C sur ${
          params.communeName || params.localAtmosphereLabel
        }`,
        loreFr:
          'Le froid vif saisit la pierre et les sentiers. Relevez un point d’intérêt malgré la morsure thermique pour graver le Médaillon des Pierres Givrées.',
        goalLabelFr: 'Découvrir 1 lieu d’intérêt par froid vif ou neige',
        targetCount: 1,
        xpReward: 215,
        rewardCategory: 'ecosysteme',
        medallionId: 'medaille_cristal_givre',
        chronicleTitleFr: `Chronique Glacée — Relevé à ${Math.round(w.tempC)}°C`,
        chronicleEraLabelFr: `Froid vif · ${w.labelFr}`,
        startsAtMs: slotStartMs,
        endsAtMs: slotEndMs,
        suggestedCategoryFilter: 'all',
        matchesEntry: (entry) => {
          if (isEntryFromLiveEvent(entry)) return false;
          const ts = Date.parse(entry.discoveredAtIso);
          return Number.isFinite(ts) && ts >= slotStartMs && ts <= slotEndMs;
        },
      });
    } else {
      events.push({
        id: `meteo_clear_${dayKey}_s${sixHourSlot}`,
        kind: 'meteo_direct',
        status: 'active',
        kickerFr: 'Météo Temps Réel · Fenêtre de Visibilité',
        titleFr: 'Relevé Héliographique & Pierres Claires',
        phenomenonTelemetryFr: `${w.labelFr} · ${Math.round(w.tempC)}°C · Vent ${Math.round(
          w.windKmh
        )} km/h sur ${params.communeName || params.localAtmosphereLabel}`,
        loreFr:
          'L’accalmie actuelle offre une visibilité franche sur les façades sculptées, parcs et repères topographiques. Profitez de ce créneau de 6 heures pour enrichir le Carnet.',
        goalLabelFr: 'Découvrir 2 lieux d’intérêt durant cette fenêtre météo',
        targetCount: 2,
        xpReward: 185,
        rewardCategory: 'histoire',
        medallionId: 'medaille_cadran_solaire',
        chronicleTitleFr: `Relevé Héliographique — ${w.labelFr} (${Math.round(w.tempC)}°C)`,
        chronicleEraLabelFr: `Fenêtre météo · ${w.labelFr}`,
        startsAtMs: slotStartMs,
        endsAtMs: slotEndMs,
        suggestedCategoryFilter: 'histoire',
        matchesEntry: (entry) => {
          if (isEntryFromLiveEvent(entry)) return false;
          const ts = Date.parse(entry.discoveredAtIso);
          return Number.isFinite(ts) && ts >= slotStartMs && ts <= slotEndMs;
        },
      });
    }
  }

  // --------------------------------------------------------------------------
  // 3. LOCAL CULTURAL FESTIVAL (Ministère de la Culture — Panorama des Festivals)
  // --------------------------------------------------------------------------
  const festivals = params.localFestivals || [];
  const primaryFestival = festivals[0] || null;
  const monthStartMs = new Date(year, nowDate.getMonth(), 1, 0, 0, 0, 0).getTime();
  const monthEndMs = new Date(year, nowDate.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

  if (primaryFestival) {
    const distTag =
      primaryFestival.distanceKm !== null ? ` · à ${primaryFestival.distanceKm} km` : '';
    events.push({
      id: `fest_${monthKey}_${primaryFestival.id.slice(0, 36)}`,
      kind: 'festival_local',
      status: 'active',
      kickerFr: primaryFestival.isCurrentMonth
        ? 'Ministère de la Culture · Festival Local du Mois'
        : 'Ministère de la Culture · Saison Culturelle Départementale',
      titleFr: `Effervescence Locale : ${primaryFestival.name}`,
      phenomenonTelemetryFr: `${primaryFestival.commune}${distTag} · Domaine : ${primaryFestival.domain}`,
      loreFr: `Le répertoire officiel « Panorama des Festivals » du Ministère de la Culture recense « ${primaryFestival.name} » à ${primaryFestival.commune} (${primaryFestival.domain}). En écho à cette manifestation culturelle, explorez le patrimoine historique, artistique ou vivant des environs !`,
      goalLabelFr:
        'Découvrir 2 lieux d’intérêt (Histoire, Légendes ou Écosystème) en résonance avec la vie culturelle locale',
      targetCount: 2,
      xpReward: 230,
      rewardCategory: 'histoire',
      medallionId: 'medaille_festival_vivant',
      chronicleTitleFr: `Chronique Culturelle — Autour de « ${primaryFestival.name} »`,
      chronicleEraLabelFr: `Festival · ${primaryFestival.commune}`,
      startsAtMs: monthStartMs,
      endsAtMs: monthEndMs,
      focusCoords:
        primaryFestival.lat !== null && primaryFestival.lng !== null
          ? {
              lat: primaryFestival.lat,
              lng: primaryFestival.lng,
              label: `${primaryFestival.name} (${primaryFestival.commune})`,
            }
          : null,
      externalUrl: primaryFestival.website,
      suggestedCategoryFilter: 'histoire',
      matchesEntry: (entry) => {
        if (isEntryFromLiveEvent(entry)) return false;
        const ts = Date.parse(entry.discoveredAtIso);
        const inWindow = Number.isFinite(ts) && ts >= monthStartMs && ts <= monthEndMs;
        return (
          inWindow &&
          (entry.category === 'histoire' ||
            entry.category === 'legende' ||
            entry.category === 'ecosysteme')
        );
      },
    });
  } else {
    events.push({
      id: `fest_terroir_${monthKey}`,
      kind: 'festival_local',
      status: 'active',
      kickerFr: 'Saison Culturelle & Terroir Vivant',
      titleFr: `Rencontres Patrimoniales · ${params.communeName || params.localAtmosphereLabel}`,
      phenomenonTelemetryFr: `${
        params.departementName || params.localAtmosphereLabel
      } · Programmation culturelle mensuelle`,
      loreFr:
        'Chaque mois, musées, jardins remarquables et lieux de mémoire animent le territoire. Révélez deux archives culturelles ou patrimoniales durant le mois en cours pour obtenir le Médaillon des Scènes & Festivals.',
      goalLabelFr: 'Découvrir 2 lieux d’intérêt Histoire ou Légendes ce mois-ci',
      targetCount: 2,
      xpReward: 195,
      rewardCategory: 'histoire',
      medallionId: 'medaille_festival_vivant',
      chronicleTitleFr: `Chronique Culturelle — ${params.communeName || params.localAtmosphereLabel}`,
      chronicleEraLabelFr: 'Vie culturelle locale',
      startsAtMs: monthStartMs,
      endsAtMs: monthEndMs,
      suggestedCategoryFilter: 'histoire',
      matchesEntry: (entry) => {
        if (isEntryFromLiveEvent(entry)) return false;
        const ts = Date.parse(entry.discoveredAtIso);
        return (
          Number.isFinite(ts) &&
          ts >= monthStartMs &&
          ts <= monthEndMs &&
          (entry.category === 'histoire' || entry.category === 'legende')
        );
      },
    });
  }

  // --------------------------------------------------------------------------
  // 4. TWILIGHT / NOCTURNAL WINDOW ("L'Heure Bleue & la Lanterne")
  // --------------------------------------------------------------------------
  const hour = nowDate.getHours();
  const isNocturnalNow =
    params.effectiveTimeOfDay === 'dusk' ||
    params.effectiveTimeOfDay === 'night' ||
    hour >= 18 ||
    hour < 6;

  const eveningStart =
    hour < 6
      ? new Date(year, nowDate.getMonth(), nowDate.getDate() - 1, 18, 0, 0, 0).getTime()
      : new Date(year, nowDate.getMonth(), nowDate.getDate(), 18, 0, 0, 0).getTime();
  const eveningEnd = eveningStart + 12 * 3_600_000 - 1;

  events.push({
    id: `twilight_${formatDayKey(new Date(eveningStart))}`,
    kind: 'crepuscule',
    status: isNocturnalNow ? 'active' : 'upcoming',
    kickerFr: 'Fenêtre Quotidienne · Crépuscule & Lanterne (18 h – 06 h)',
    titleFr: 'L’Heure Bleue & les Archives d’Ombre',
    phenomenonTelemetryFr: isNocturnalNow
      ? 'Fenêtre crépusculaire/nocturne OUVERTE en ce moment'
      : 'Ouvre à 18 h 00 (ou en ambiance Crépuscule / Nuit)',
    loreFr:
      'Lorsque le jour décline, les souterrains, passages voûtés et pierres à légendes se révèlent sous un tout autre jour à la lueur de la lanterne.',
    goalLabelFr: 'Découvrir 1 lieu d’intérêt entre 18 h et 06 h (ou durant la fenêtre active)',
    targetCount: 1,
    xpReward: 190,
    rewardCategory: 'etrange',
    medallionId: 'medaille_syzygie_lunaire',
    chronicleTitleFr: 'Chronique de l’Heure Bleue — Lanterne & Ombres',
    chronicleEraLabelFr: 'Veillée crépusculaire',
    startsAtMs: eveningStart,
    endsAtMs: eveningEnd,
    suggestedCategoryFilter: 'etrange',
    matchesEntry: (entry) => {
      if (isEntryFromLiveEvent(entry)) return false;
      const ts = Date.parse(entry.discoveredAtIso);
      return Number.isFinite(ts) && ts >= eveningStart && ts <= eveningEnd;
    },
  });

  // Also include upcoming meteor shower card if not currently active so players can anticipate it
  if (showerInfo.status === 'upcoming') {
    const sh = showerInfo.shower;
    events.push({
      id: `astro_upcoming_${year}_${sh.id}`,
      kind: 'astronomie',
      status: 'upcoming',
      kickerFr: `À venir dans ${showerInfo.daysUntilStart} jour${
        showerInfo.daysUntilStart > 1 ? 's' : ''
      } · Pluie de Météores`,
      titleFr: `Prochain Essaim : ${sh.nameFr}`,
      phenomenonTelemetryFr: `Radiant : ${sh.constellationFr} · Pic ZHR ~${sh.zhrEstimate}/h · Ouverture le ${new Date(
        showerInfo.startsAtMs
      ).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`,
      loreFr: `Préparez vos repérages vers les tables d’orientation et collines dégagées : l’essaim météoritique des ${sh.nameFr} illuminera prochainement la voûte céleste.`,
      goalLabelFr: 'Découvrir 2 lieux d’intérêt dès l’ouverture de la fenêtre astronomique',
      targetCount: 2,
      xpReward: 240,
      rewardCategory: 'geographie',
      medallionId: 'medaille_pluie_meteores',
      chronicleTitleFr: `Chronique Céleste — ${sh.nameFr}`,
      chronicleEraLabelFr: `Éphéméride (${sh.constellationFr})`,
      startsAtMs: showerInfo.startsAtMs,
      endsAtMs: showerInfo.endsAtMs,
      suggestedCategoryFilter: 'geographie',
      matchesEntry: () => false,
    });
  }

  return events;
}

export function evaluateLiveWorldEvents(
  events: LiveWorldEventChallenge[],
  entries: UnlockedEntry[],
  claimedEventIds: ReadonlySet<string>
): EvaluatedLiveWorldEvent[] {
  return events.map((event) => {
    const qualifyingEntries = entries.filter((e) => event.matchesEntry(e));
    const currentCount = qualifyingEntries.length;
    const isClaimed = claimedEventIds.has(event.id);
    const isCompleted = event.status === 'active' && currentCount >= event.targetCount;
    return {
      event,
      currentCount,
      qualifyingEntries,
      isCompleted,
      isClaimed,
    };
  });
}

export function formatEventCountdownFr(targetMs: number, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  if (days > 0) {
    return `${days}j ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
  }
  return `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(
    secs
  ).padStart(2, '0')}s`;
}

/**
 * Builds the special permanent Carnet d'Exploration entry unlocked when claiming a Live Phenomenon Event.
 * Strictly conforms to JournalDiscovery Firestore validation bounds!
 */
export function buildLiveEventJournalEntry(params: {
  event: LiveWorldEventChallenge;
  qualifyingEntries: UnlockedEntry[];
  playerLat: number;
  playerLng: number;
  localityLabel: string;
}): UnlockedEntry {
  const { event, qualifyingEntries, playerLat, playerLng, localityLabel } = params;
  const safeId = `live_evt_${event.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96)}`;
  const medallion = getLiveEventMedallionById(event.medallionId);
  const anchorEntry = qualifyingEntries[0] || null;
  const lat = anchorEntry ? anchorEntry.lat : playerLat;
  const lng = anchorEntry ? anchorEntry.lng : playerLng;

  const landmarksList = qualifyingEntries
    .slice(0, 4)
    .map((e) => `« ${e.name} »`)
    .join(', ');

  const kindLabel =
    event.kind === 'astronomie'
      ? 'Astronomie'
      : event.kind === 'meteo_direct'
      ? 'Météo Vive'
      : event.kind === 'festival_local'
      ? 'Festival Local'
      : 'Crépuscule';

  const summary = [
    `Chronique spéciale d’Événement Vivant scellée sur le secteur de ${localityLabel}.`,
    `Phénomène observé en temps réel : ${event.phenomenonTelemetryFr}.`,
    event.loreFr,
    landmarksList
      ? `Lieux explorés durant la fenêtre du phénomène : ${landmarksList}.`
      : '',
    `Insigne ciselé remis au Grimoire : ${medallion.name} (${medallion.phenomenonLabel}).`,
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 2400);

  return {
    poiId: safeId,
    name: event.chronicleTitleFr.slice(0, 195),
    category: event.rewardCategory,
    subType: `✦ Événement Vivant · ${kindLabel}`.slice(0, 78),
    eraLabel: event.chronicleEraLabelFr.slice(0, 95),
    source: 'Chronique des Phénomènes Réels',
    lat,
    lng,
    summary,
    nearWaterway: Boolean(anchorEntry?.nearWaterway),
    waterwayName: (anchorEntry?.waterwayName || '').slice(0, 115),
    safetyNotice: '',
    externalUrl: (event.externalUrl || '').slice(0, 490),
    xpAwarded: Math.min(5000, Math.max(0, Math.round(event.xpReward))),
    relatedPoiIds: qualifyingEntries.slice(0, 6).map((e) => e.poiId),
    relatedPoiTitles: qualifyingEntries.slice(0, 6).map((e) => e.name.slice(0, 180)),
    personalNote: '',
    photoCount: 0,
    discoveredAtIso: new Date().toISOString(),
  };
}
