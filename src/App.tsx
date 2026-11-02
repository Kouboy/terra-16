import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { AnimatePresence, motion } from 'motion/react';
import { ExplorerSpriteCanvas } from './components/ExplorerAvatarCanvas';
import {
  ElevationProfileStrip,
  PixelOutfitSpritePreview,
} from './components/GrimoireViews';
import { ParchmentScrollStrip } from './components/ParchmentScrollStrip';
import {
  PixelCornerRivets,
  PixelGuildIcon,
  PixelStratumIcon,
  PixelUiIcon,
  UiPixelIconName,
} from './components/PixelIcons';
import { PixelMapCanvas } from './components/PixelMapCanvas';
import { ResilientPixelImage } from './components/ResilientPixelImage';
import {
  getCosmeticRewardsForMission,
  getNewlyUnlockedCosmetics,
  resolveExplorerAppearance,
} from './explorerAvatar';
import {
  auth,
  createDiscoveryInCloud,
  ensureExplorerProfileInCloud,
  formatFirebaseAuthErrorFr,
  isTransientCloudOfflineError,
  recordOpenedArchivistChestInCloud,
  resetExplorerCharacterInCloud,
  signInExplorerWithGoogle,
  signOutExplorer,
  subscribeToCloudExplorer,
  subscribeToNearbyGeocaches,
  syncMissingArchivistChestsToCloud,
  syncMissingDiscoveriesToCloud,
  syncMissingSpecimensToCloud,
  syncProgressToCloud,
  updateDiscoveryJournalInCloud,
  updateExplorerIdentityInCloud,
  upsertSpecimenInCloud,
  validateExplorerAuthSession,
} from './firebase';
import {
  CachedSectorRecord,
  computeLocalSectorExplorationPct,
  deleteBesaceSector,
  exportGrimoireArchiveJson,
  findNearestBesaceSector,
  listBesaceSectors,
  loadRevealedFogSet,
  loadSavedEncounters,
  loadSavedRumorLeads,
  loadSavedSpecimens,
  revealFogAroundPlayer,
  saveEncountersToStorage,
  saveRevealedFogSet,
  saveRumorLeadsToStorage,
  saveSpecimensToStorage,
  scheduleSaveRevealedFogSet,
  saveSectorToBesace,
} from './fogAndOffline';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useScreenWakeLock } from './hooks/useWakeLock';
import {
  isVibrationSupported,
  loadHapticsPreference,
  saveHapticsPreference,
  vibrateBuriedTreasureHot,
  vibrateBuriedTreasureWarm,
  vibrateMysterySealNearby,
  vibrateRumorLeadNearby,
  vibrateToggleTap,
  vibrateUnlockCelebration,
} from './mobileHaptics';
import {
  BESTIARY_SPECIES_CATALOG,
  NpcRumorDraft,
  WorldNpc,
} from './npcs';
import { clearAllStoredPhotos } from './photoStore';

const LazyEntryDetailPanel = React.lazy(() =>
  import('./components/EntryDetailPanel').then((m) => ({ default: m.EntryDetailPanel }))
);
const LazyBestiaryRencontresView = React.lazy(() =>
  import('./components/BestiaryRencontresView').then((m) => ({
    default: m.BestiaryRencontresView,
  }))
);
const LazyHerbariumLithothequeView = React.lazy(() =>
  import('./components/HerbariumLithothequeView').then((m) => ({
    default: m.HerbariumLithothequeView,
  }))
);
const LazyPostcardStudioModal = React.lazy(() =>
  import('./components/PostcardStudioModal').then((m) => ({
    default: m.PostcardStudioModal,
  }))
);
const LazyBesaceAndBackupView = React.lazy(() =>
  import('./components/GrimoireViews').then((m) => ({ default: m.BesaceAndBackupView }))
);
const LazyConstellationEchoesView = React.lazy(() =>
  import('./components/GrimoireViews').then((m) => ({ default: m.ConstellationEchoesView }))
);
const LazyStratigraphicFriezeView = React.lazy(() =>
  import('./components/GrimoireViews').then((m) => ({ default: m.StratigraphicFriezeView }))
);
const LazyExplorerProfileView = React.lazy(() =>
  import('./components/ExplorerProfileView').then((m) => ({ default: m.ExplorerProfileView }))
);
const LazyTreasuresAndGeocachesView = React.lazy(() =>
  import('./components/TreasuresAndGeocachesView').then((m) => ({
    default: m.TreasuresAndGeocachesView,
  }))
);
const LazyGeocacheModal = React.lazy(() =>
  import('./components/TreasuresAndGeocachesView').then((m) => ({
    default: m.GeocacheModal,
  }))
);
import {
  ActiveHuntMapBanner,
  AlmanacSeasonalPanel,
  ClueTreasureHuntPanel,
  ContextualRiddleModal,
} from './components/AlmanacAndHuntsView';
import {
  AlmanacQuestEvalContext,
  ContextualRiddle,
  generateContextualRiddleForEntry,
  generateSectorTreasureHunt,
  loadClaimedAlmanacQuestIds,
  loadCompletedHuntIds,
  loadHuntVisitedStepMap,
  loadSolvedRiddleIds,
  resolveSeasonForDate,
  saveClaimedAlmanacQuestIds,
  saveCompletedHuntIds,
  saveHuntVisitedStepMap,
  saveSolvedRiddleIds,
  SEASON_META,
  SectorAlmanacPayload,
} from './almanacAndQuests';
import type { ProfileSectionTab, WorkshopSlotTab } from './components/ExplorerProfileView';
import { TelluricDetectorCard } from './components/TreasuresAndGeocachesView';
import { isMissionUnlocked, MISSIONS_CATALOG } from './missions';
import { resolveRegionalTheme } from './regionalBiomes';
import {
  computeGuildPerks,
  DynamicContractStep,
  DynamicSectorContract,
  evaluateDynamicContract,
  generateDynamicSectorContracts,
  GUILD_PERK_DESCRIPTIONS,
  isOutfitUnlocked,
  loadClaimedSectorContracts,
  loadVisitedContractSteps,
  OUTFITS_CATALOG,
  saveClaimedSectorContracts,
  saveVisitedContractSteps,
} from './rpgExtras';
import {
  playChestOpenSfx,
  playDiscoveryFanfare,
  playJournalOpenSfx,
  playMissionFanfare,
  playProximityChimeSfx,
  playRumorResolvedSfx,
  playSpecimenHarvestSfx,
  playStampSfx,
  playStepSfx,
  syncBiomeSoundscape,
} from './sound';
import { SPECIMENS_CATALOG, WorldSpecimenNode } from './specimens';
import {
  computeGeocacheSectorKey,
  getNearbyGeocacheSectorKeys,
  loadFoundGeocacheIds,
  loadLocalFallbackGeocaches,
  loadOpenedArchivistChests,
  saveFoundGeocacheIds,
  saveLocalFallbackGeocaches,
  saveOpenedArchivistChests,
  spawnWorldArchivistChests,
  WorldArchivistChestNode,
} from './treasures';
import {
  evaluateAllTrophies,
  getGenderedTrophyTitle,
  resolveExplorerDisplayTitle,
  TROPHIES_CATALOG,
  TrophyBadgeCanvas,
} from './trophies';
import {
  ActiveTab,
  BedrockInfo,
  CarnetViewMode,
  CATEGORY_META,
  CATEGORY_ORDER,
  CollectedSpecimen,
  computeLevelFromXp,
  ElevationGrid,
  ExplorationCategory,
  ExplorerAppearance,
  ExplorerGeocacheRecord,
  ExplorerOutfitId,
  ExplorerProgress,
  getCategoryXp,
  getZoomWalkStepMeters,
  haversineMeters,
  HERO_BANNER_SRC,
  HistoricalStratum,
  minDistancePointToSegmentMeters,
  NpcEncounterRecord,
  OpenedArchivistChestRecord,
  partitionSurfaceAndSubterraneanPois,
  PoiItem,
  PostcardSubject,
  PRESET_LOCATIONS,
  resolveEffectiveTimeOfDay,
  RumorLead,
  sampleElevationMeters,
  SectorPayloadData,
  STRATUM_META,
  SubterraneanFeature,
  SurfaceType,
  TerrainFeature,
  TimeOfDayMode,
  TrophyId,
  UnlockedEntry,
  WeatherInfo,
  ZOOM_LEVELS,
  ZOOM_META,
  ZoomLevel,
} from './types';

const LOCAL_PROGRESS_KEY = 'terra16_local_progress_v2';
const LOCAL_ENTRIES_KEY = 'terra16_local_entries_v2';

const INITIAL_PROGRESS: ExplorerProgress = {
  displayName: 'Explorateur',
  gender: 'masculin',
  avatarPreset: 'cartographe',
  skinTone: 'hale',
  headgearId: 'tricorne_fauve',
  outfitId: 'arpenteur',
  toolId: 'lanterne_laiton',
  packId: 'besace_cuir',
  familiarId: 'aucun',
  walkedMeters: 0,
  totalXp: 0,
  xpHistoire: 0,
  xpGeographie: 0,
  xpEcosysteme: 0,
  xpEtrange: 0,
  xpLegende: 0,
  discoveriesCount: 0,
  solvedRiddlesCount: 0,
  completedHuntsCount: 0,
  claimedAlmanacCount: 0,
  completedMissions: [],
};

const TIME_MODES_ORDER: TimeOfDayMode[] = ['auto', 'dawn', 'day', 'dusk', 'night'];
const TIME_MODE_LABELS: Record<TimeOfDayMode, { label: string; short: string; icon: UiPixelIconName }> = {
  auto: { label: 'Heure réelle', short: 'Auto', icon: 'sun-cloud' },
  dawn: { label: 'Aube dorée', short: 'Aube', icon: 'sun-cloud' },
  day: { label: 'Plein jour', short: 'Jour', icon: 'sun-cloud' },
  dusk: { label: 'Crépuscule', short: 'Soir', icon: 'lantern' },
  night: { label: 'Veillée nocturne', short: 'Nuit', icon: 'moon-stars' },
};

interface CutInAlert {
  id: string;
  kind: 'discovery' | 'mission';
  kicker: string;
  title: string;
  subtitle: string;
  emblemSrc?: string;
  poiId?: string;
  unlockedCosmeticName?: string;
  unlockedCosmeticSlot?: WorkshopSlotTab;
  unlockedTrophyId?: TrophyId;
  openReliquary?: boolean;
}

type MobileDrawerMode = 'none' | 'filters' | 'travel' | 'signals' | 'install-app';

function computeBearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function cardinalLabelFr(deg: number): string {
  const dirs = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest'];
  return dirs[Math.round(deg / 45) % 8];
}

function cardinalShortFr(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(deg / 45) % 8];
}

function getDaytimeMood(mode: TimeOfDayMode, weather: WeatherInfo | null): { label: string; icon: UiPixelIconName } {
  if (mode !== 'auto') {
    return { label: TIME_MODE_LABELS[mode].label, icon: TIME_MODE_LABELS[mode].icon };
  }
  const h = new Date().getHours();
  if (weather && !weather.isDay && h >= 7 && h <= 18) {
    return { label: 'Ciel crépusculaire', icon: 'moon-stars' };
  }
  if (h >= 6 && h < 10) return { label: 'Aube dorée', icon: 'sun-cloud' };
  if (h >= 10 && h < 17) return { label: 'Clarté du jour', icon: 'sun-cloud' };
  if (h >= 17 && h < 21) return { label: 'Heure dorée', icon: 'lantern' };
  return { label: 'Veillée à la lanterne', icon: 'moon-stars' };
}

function computeAtmosphereLabel(terrain: TerrainFeature[], elevation: ElevationGrid | null): string {
  const hasWater = terrain.some((t) => t.kind === 'water' || t.kind === 'waterway');
  const forestCount = terrain.filter((t) => t.kind === 'forest').length;
  const parkCount = terrain.filter((t) => t.kind === 'park').length;
  const sandCount = terrain.filter((t) => t.kind === 'sand').length;
  const scrubCount = terrain.filter((t) => t.kind === 'scrub').length;
  const wetlandCount = terrain.filter((t) => t.kind === 'wetland').length;
  const screeCount = terrain.filter((t) => t.kind === 'scree').length;
  const industrialCount = terrain.filter(
    (t) => t.kind === 'industrial' || (t.kind === 'building' && t.bldgClass === 'industrial')
  ).length;
  const commercialCount = terrain.filter((t) => t.kind === 'commercial').length;
  const farmCount = terrain.filter(
    (t) => t.kind === 'farmland' || (t.kind === 'building' && t.bldgClass === 'rural_farm')
  ).length;
  const buildingCount = terrain.filter((t) => t.kind === 'building').length;
  const midriseCount = terrain.filter(
    (t) =>
      t.kind === 'building' &&
      (t.bldgClass === 'urban_midrise' || t.bldgClass === 'commercial_shop' || (t.levels ?? 0) >= 4)
  ).length;
  const reliefSpan = elevation ? elevation.maxMeters - elevation.minMeters : 0;

  if (screeCount >= 2 || (screeCount >= 1 && reliefSpan >= 65)) {
    return 'Éboulis, pierriers & crêtes rocheuses';
  }
  if (reliefSpan >= 85 && hasWater) return 'Gorges, coteaux & falaises';
  if (reliefSpan >= 85) return 'Buttes escarpées & promontoires';
  if (industrialCount >= 3 && buildingCount < 220) return 'Zone industrielle & entrepôts';
  if (buildingCount > 240 || midriseCount > 35) {
    if (sandCount >= 2 && hasWater) return 'Cité maritime, grèves & remparts';
    if (hasWater) return 'Centre-ville & quais pavés';
    if (parkCount >= 3) return 'Centre-ville & parcs urbains';
    return 'Centre-ville dense & avenues';
  }
  if (buildingCount > 110) {
    if (sandCount >= 2 && hasWater) return 'Port, plages & quartier côtier';
    if (commercialCount >= 2) return 'Quartier marchand & faubourgs';
    if (reliefSpan >= 35) return 'Faubourgs en pente & escaliers';
    return 'Banlieue pavillonnaire & jardins';
  }
  if (buildingCount >= 28) {
    if (sandCount >= 1 && hasWater) return 'Village côtier, dunes & grèves';
    if (scrubCount >= 3) return 'Village perché & garrigue';
    if (farmCount >= 3) return 'Village & terres agricoles';
    if (hasWater) return 'Village de rivière & ponts';
    return 'Bourg & maisons de village';
  }
  if (buildingCount >= 5) {
    if (wetlandCount >= 2) return 'Hameau des marais & roselières';
    if (scrubCount >= 2) return 'Hameau, landes & maquis';
    return 'Hameau & fermes isolées';
  }
  if (wetlandCount >= 2) return 'Marais, roselières & tourbières';
  if (sandCount >= 2 && hasWater) return 'Plages, dunes & rivages';
  if (scrubCount >= 3) return 'Landes, maquis & garrigues';
  if (forestCount > 4 && hasWater) return 'Vallée boisée & eaux vives';
  if (parkCount >= 2 && forestCount <= 2) return 'Parc arboré & allées';
  if (forestCount > 4) return 'Forêt profonde & futaies';
  if (reliefSpan >= 35) return 'Collines, talus & vallons';
  if (hasWater) return 'Terres d’eau & rivages';
  if (farmCount >= 2) return 'Champs, bocage & cultures';
  return 'Chemins & campagne';
}

/**
 * Interactive 16-bit Pixel-Art Brass & Ruby Compass Rose Dial
 */
const BrassPixelCompass: React.FC<{ bearingDeg: number; hot: boolean; compact?: boolean }> = ({
  bearingDeg,
  hot,
  compact = false,
}) => (
  <div
    className={`relative ${
      compact ? 'w-11 h-11' : 'w-14 h-14'
    } shrink-0 flex items-center justify-center bg-[#28160d] border-2 border-[#d97706] jrpg-shadow`}
  >
    <span
      aria-hidden="true"
      className="absolute top-0.5 text-[8px] font-mono font-bold text-amber-300 leading-none"
    >
      N
    </span>
    {!compact && (
      <>
        <span
          aria-hidden="true"
          className="absolute bottom-0.5 text-[8px] font-mono font-bold text-[#c89d62] leading-none"
        >
          S
        </span>
        <span
          aria-hidden="true"
          className="absolute left-1 text-[8px] font-mono font-bold text-[#c89d62] leading-none"
        >
          O
        </span>
        <span
          aria-hidden="true"
          className="absolute right-1 text-[8px] font-mono font-bold text-[#c89d62] leading-none"
        >
          E
        </span>
      </>
    )}
    <svg
      viewBox="0 0 24 24"
      shapeRendering="crispEdges"
      className={`${
        compact ? 'w-7 h-7' : 'w-9 h-9'
      } pixelated transition-transform duration-200 ease-out`}
      style={{ transform: `rotate(${Math.round(bearingDeg)}deg)` }}
      aria-hidden="true"
    >
      <rect x="6" y="6" width="12" height="12" fill="#f8edd6" />
      <rect x="8" y="5" width="8" height="14" fill="#f8edd6" />
      <rect x="5" y="8" width="14" height="8" fill="#f8edd6" />
      <rect x="11" y="3" width="2" height="8" fill={hot ? '#ef4444' : '#dc2626'} />
      <rect x="10" y="6" width="4" height="3" fill={hot ? '#fde047' : '#ef4444'} />
      <rect x="11" y="13" width="2" height="7" fill="#1d4ed8" />
      <rect x="10" y="10" width="4" height="4" fill="#2b1a0e" />
      <rect x="11" y="11" width="2" height="2" fill="#fde047" />
    </svg>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (typeof window === 'undefined') return 'carte';
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (
      tabParam === 'carte' ||
      tabParam === 'carnet' ||
      tabParam === 'missions' ||
      tabParam === 'branches' ||
      tabParam === 'profil'
    ) {
      return tabParam;
    }
    return 'carte';
  });
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudOnline, setCloudOnline] = useState<boolean>(
    () => typeof navigator === 'undefined' || navigator.onLine !== false
  );
  const [authError, setAuthError] = useState('');

  const handleCloudSyncError = useCallback((err: unknown) => {
    if (isTransientCloudOfflineError(err)) {
      setCloudOnline(false);
      return;
    }
    console.warn('Synchronisation Cloud interrompue :', err);
  }, []);

  // Fullscreen, Collapsible UI ("Replier / Déplier l’UI"), Mobile Ergonomics & PWA Install
  const [isFullscreenMap, setIsFullscreenMap] = useState(false);
  const [uiCollapsed, setUiCollapsed] = useState(false);
  const [dpadOpen, setDpadOpen] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState<MobileDrawerMode>('none');
  const [mobileCompanionExpanded, setMobileCompanionExpanded] = useState(false);
  const [desktopCompanionCollapsed, setDesktopCompanionCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('terra16_desktop_companion_collapsed_v1');
      return saved === null ? true : saved === '1';
    } catch {
      return true;
    }
  });
  const [desktopToolbarPanel, setDesktopToolbarPanel] = useState<'none' | 'filters' | 'travel'>(
    'none'
  );
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('terra16_desktop_sidebar_collapsed_v1') === '1';
    } catch {
      return false;
    }
  });
  const [mobileJournalDetailOpen, setMobileJournalDetailOpen] = useState(false);
  const [fullscreenModalPoiId, setFullscreenModalPoiId] = useState<string | null>(null);
  const {
    isInstallable,
    isInstalled,
    isAndroid,
    isIOS,
    isEmbeddedIframe,
    promptInstall,
  } = usePWAInstall();
  const {
    wakeLockSupported,
    wakeLockWanted,
    wakeLockActive,
    setWakeLockWanted,
    toggleWakeLock,
  } = useScreenWakeLock();
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(() => loadHapticsPreference());
  const [urlCopiedNotice, setUrlCopiedNotice] = useState<boolean>(false);

  // Geolocation, Topological A* Walk Queue, Weather & Living World State
  const [playerPos, setPlayerPos] = useState<{ lat: number; lng: number }>({
    lat: PRESET_LOCATIONS[0].lat,
    lng: PRESET_LOCATIONS[0].lng,
  });
  const [simulationMode, setSimulationMode] = useState<boolean>(true);
  const [gpsStatus, setGpsStatus] = useState<string>('Marche Simulée active');
  const [walkQueue, setWalkQueue] = useState<Array<{ lat: number; lng: number }>>([]);
  const [expeditionStops, setExpeditionStops] = useState<PoiItem[]>([]);
  const [routeRequest, setRouteRequest] = useState<{
    id: number;
    lat: number;
    lng: number;
    stops?: Array<{ lat: number; lng: number }>;
  } | null>(null);
  const [facingDir, setFacingDir] = useState<'down' | 'up' | 'left' | 'right'>('down');
  const [manualWalkPulse, setManualWalkPulse] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(4);
  const [subterraneanMode, setSubterraneanMode] = useState<boolean>(false);
  const [reliefEnabled, setReliefEnabled] = useState<boolean>(true);
  const [subtleBuildings, setSubtleBuildings] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [timeMode, setTimeMode] = useState<TimeOfDayMode>('auto');
  const [fogEnabled, setFogEnabled] = useState<boolean>(true);
  const [fogSet, setFogSet] = useState<Set<string>>(() => loadRevealedFogSet());
  const [dashedTracesEnabled, setDashedTracesEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('terra16_dashed_traces_v1') === '1';
    } catch {
      return false;
    }
  });
  const [pocketCompassMode, setPocketCompassMode] = useState<boolean>(false);
  const [carnetView, setCarnetView] = useState<CarnetViewMode>('liste');
  const [bestiaryInitialSubTab, setBestiaryInitialSubTab] = useState<
    'bestiaire' | 'habitants' | 'rumeurs'
  >('bestiaire');

  // Session Trail, Distance & Elevation Gain + Surface Audio Ref
  const [breadcrumbTrail, setBreadcrumbTrail] = useState<Array<{ lat: number; lng: number }>>([
    { lat: PRESET_LOCATIONS[0].lat, lng: PRESET_LOCATIONS[0].lng },
  ]);
  const [sessionMeters, setSessionMeters] = useState<number>(0);
  const [sessionElevGainM, setSessionElevGainM] = useState<number>(0);
  const lastStepMetricRef = useRef<{ lat: number; lng: number; alt: number | null }>({
    lat: PRESET_LOCATIONS[0].lat,
    lng: PRESET_LOCATIONS[0].lng,
    alt: null,
  });
  const prevUnlockPosRef = useRef<{ lat: number; lng: number }>({
    lat: PRESET_LOCATIONS[0].lat,
    lng: PRESET_LOCATIONS[0].lng,
  });
  const playerSurfaceRef = useRef<{ surface: SurfaceType; nearWater: boolean }>({
    surface: 'stone',
    nearWater: false,
  });
  const hapticSealIdsRef = useRef<Set<string>>(new Set());
  const hapticRumorIdsRef = useRef<Set<string>>(new Set());
  const hapticTreasureStageRef = useRef<Map<string, 'warm' | 'hot'>>(new Map());

  // Multi-Source Sector, Real Z15 Topology, Subterranean Cavities, DEM Elevation, Weather & Offline Besace
  const [pois, setPois] = useState<PoiItem[]>([]);
  const [terrain, setTerrain] = useState<TerrainFeature[]>([]);
  const [subterranean, setSubterranean] = useState<SubterraneanFeature[]>([]);
  const [elevation, setElevation] = useState<ElevationGrid | null>(null);
  const [bedrock, setBedrock] = useState<BedrockInfo | null>(null);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [sourcesActive, setSourcesActive] = useState<string[]>([]);
  const [loadingSector, setLoadingSector] = useState<boolean>(false);
  const [sectorError, setSectorError] = useState<string>('');
  const [cachedSectors, setCachedSectors] = useState<CachedSectorRecord[]>([]);
  const [besaceToast, setBesaceToast] = useState<string>('');
  const lastFetchedAnchorRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastSectorPayloadRef = useRef<SectorPayloadData | null>(null);
  const sectorAbortRef = useRef<AbortController | null>(null);
  const sectorReqSeqRef = useRef<number>(0);

  // Guild, Stratigraphic Time & Archive Filters
  const [categoryFilter, setCategoryFilter] = useState<ExplorationCategory | 'all'>('all');
  const [stratumFilter, setStratumFilter] = useState<HistoricalStratum | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [selectedJournalPoiId, setSelectedJournalPoiId] = useState<string | null>(null);

  // Place Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ label: string; lat: number; lng: number }>
  >([]);
  const [searchingPlace, setSearchingPlace] = useState(false);

  // Persistent Progress, Carnet & Claimed Sector Contracts
  const [progress, setProgress] = useState<ExplorerProgress>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_PROGRESS_KEY);
      return saved ? { ...INITIAL_PROGRESS, ...JSON.parse(saved) } : INITIAL_PROGRESS;
    } catch {
      return INITIAL_PROGRESS;
    }
  });
  const [callsignDraft, setCallsignDraft] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_PROGRESS_KEY);
      const parsed = saved ? (JSON.parse(saved) as Partial<ExplorerProgress>) : null;
      return parsed?.displayName || INITIAL_PROGRESS.displayName;
    } catch {
      return INITIAL_PROGRESS.displayName;
    }
  });
  const [callsignSavedNotice, setCallsignSavedNotice] = useState(false);

  const [entries, setEntries] = useState<UnlockedEntry[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_ENTRIES_KEY);
      return saved ? (JSON.parse(saved) as UnlockedEntry[]) : [];
    } catch {
      return [];
    }
  });
  const [claimedContracts, setClaimedContracts] = useState<Set<string>>(() =>
    loadClaimedSectorContracts()
  );
  const [visitedContractSteps, setVisitedContractSteps] = useState<Set<string>>(() =>
    loadVisitedContractSteps()
  );
  const [profileInitialTab, setProfileInitialTab] = useState<ProfileSectionTab>('atelier');
  const [profileInitialWorkshopSlot, setProfileInitialWorkshopSlot] =
    useState<WorkshopSlotTab>('familiar');
  const [encounters, setEncounters] = useState<NpcEncounterRecord[]>(() =>
    loadSavedEncounters()
  );
  const [rumorLeads, setRumorLeads] = useState<RumorLead[]>(() => loadSavedRumorLeads());
  const [specimens, setSpecimens] = useState<CollectedSpecimen[]>(() => loadSavedSpecimens());
  const [harvestedSpecimenNodes, setHarvestedSpecimenNodes] = useState<Set<string>>(
    () => new Set()
  );
  const [openedChests, setOpenedChests] = useState<OpenedArchivistChestRecord[]>(() =>
    loadOpenedArchivistChests()
  );
  const [cloudGeocaches, setCloudGeocaches] = useState<ExplorerGeocacheRecord[]>([]);
  const [localFallbackGeocaches, setLocalFallbackGeocaches] = useState<ExplorerGeocacheRecord[]>(
    () => loadLocalFallbackGeocaches()
  );
  const [foundGeocacheIds, setFoundGeocacheIds] = useState<Set<string>>(() =>
    loadFoundGeocacheIds()
  );
  const [geocacheModal, setGeocacheModal] = useState<
    { mode: 'bury' } | { mode: 'inspect'; cache: ExplorerGeocacheRecord } | null
  >(null);
  const [postcardSubject, setPostcardSubject] = useState<PostcardSubject | null>(null);
  const [missionsSubTab, setMissionsSubTab] = useState<
    'almanach' | 'chasse' | 'contrats' | 'guildes'
  >('almanach');
  const [almanacData, setAlmanacData] = useState<SectorAlmanacPayload | null>(null);
  const [loadingAlmanac, setLoadingAlmanac] = useState<boolean>(false);
  const [almanacPreviewDate, setAlmanacPreviewDate] = useState<{
    month: number;
    day: number;
  } | null>(null);
  const [solvedRiddleIds, setSolvedRiddleIds] = useState<Set<string>>(() => loadSolvedRiddleIds());
  const [claimedAlmanacQuests, setClaimedAlmanacQuests] = useState<Set<string>>(() =>
    loadClaimedAlmanacQuestIds()
  );
  const [completedHuntIds, setCompletedHuntIds] = useState<Set<string>>(() =>
    loadCompletedHuntIds()
  );
  const [huntStepMap, setHuntStepMap] = useState<Record<string, number>>(() =>
    loadHuntVisitedStepMap()
  );
  const [trackingHuntOnMap, setTrackingHuntOnMap] = useState<boolean>(false);
  const [activeRiddleEntry, setActiveRiddleEntry] = useState<UnlockedEntry | null>(null);
  const hapticHuntStageRef = useRef<Map<string, 'warm' | 'hot'>>(new Map());
  const [soundscapeEnabled, setSoundscapeEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('terra16_soundscape_v1') !== '0';
    } catch {
      return true;
    }
  });
  const [playerSurfaceState, setPlayerSurfaceState] = useState<{
    surface: SurfaceType;
    nearWater: boolean;
  }>({ surface: 'stone', nearWater: false });

  const [cutIn, setCutIn] = useState<CutInAlert | null>(null);
  const knownUnlockedTrophiesRef = useRef<Set<TrophyId> | null>(null);
  const unlockingGuardRef = useRef<Set<string>>(new Set());
  const suppressedPoiIdsUntilMoveRef = useRef<Set<string>>(new Set());
  const resetSuppressionAnchorRef = useRef<{ lat: number; lng: number } | null>(null);

  // Dual Fullscreen Engine: Native Browser Fullscreen (when permitted) + 100dvh Immersive Viewport
  const hadNativeFullscreenRef = useRef(false);

  const enterFullscreenMap = useCallback(async () => {
    setActiveTab('carte');
    setIsFullscreenMap(true);
    try {
      const rootEl = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (!document.fullscreenElement) {
        if (rootEl.requestFullscreen) {
          await rootEl.requestFullscreen();
          hadNativeFullscreenRef.current = true;
        } else if (rootEl.webkitRequestFullscreen) {
          await rootEl.webkitRequestFullscreen();
          hadNativeFullscreenRef.current = true;
        }
      }
    } catch {
      // Gracefully fall back to 100vw x 100dvh immersive fullscreen inside iframes / iOS Safari
    }
  }, []);

  const exitFullscreenMap = useCallback(async () => {
    setIsFullscreenMap(false);
    setFullscreenModalPoiId(null);
    setMobileDrawer('none');
    try {
      const docWithWebkit = document as Document & {
        webkitFullscreenElement?: Element | null;
        webkitExitFullscreen?: () => Promise<void>;
      };
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (docWithWebkit.webkitFullscreenElement && docWithWebkit.webkitExitFullscreen) {
        await docWithWebkit.webkitExitFullscreen();
      }
    } catch {
      // Ignore exit errors
    } finally {
      hadNativeFullscreenRef.current = false;
    }
  }, []);

  const toggleFullscreenMap = useCallback(() => {
    if (isFullscreenMap) {
      exitFullscreenMap();
    } else {
      enterFullscreenMap();
    }
  }, [isFullscreenMap, enterFullscreenMap, exitFullscreenMap]);

  const openWorkshopAtSlot = useCallback(
    (slot: WorkshopSlotTab = 'familiar') => {
      setActiveRiddleEntry(null);
      setUiCollapsed(false);
      if (isFullscreenMap) exitFullscreenMap();
      setProfileInitialTab('atelier');
      setProfileInitialWorkshopSlot(slot);
      setActiveTab('profil');
    },
    [isFullscreenMap, exitFullscreenMap]
  );

  useEffect(() => {
    const onFsChange = () => {
      const docWithWebkit = document as Document & { webkitFullscreenElement?: Element | null };
      const activeNative = Boolean(
        document.fullscreenElement || docWithWebkit.webkitFullscreenElement
      );
      if (activeNative) {
        hadNativeFullscreenRef.current = true;
      } else if (hadNativeFullscreenRef.current) {
        hadNativeFullscreenRef.current = false;
        setIsFullscreenMap(false);
        setFullscreenModalPoiId(null);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeRiddleEntry) {
          setActiveRiddleEntry(null);
        } else if (geocacheModal) {
          setGeocacheModal(null);
        } else if (postcardSubject) {
          setPostcardSubject(null);
        } else if (fullscreenModalPoiId) {
          setFullscreenModalPoiId(null);
        } else if (mobileDrawer !== 'none') {
          setMobileDrawer('none');
        } else if (mobileCompanionExpanded) {
          setMobileCompanionExpanded(false);
        } else if (desktopToolbarPanel !== 'none') {
          setDesktopToolbarPanel('none');
        } else if (uiCollapsed) {
          setUiCollapsed(false);
        } else if (isFullscreenMap) {
          exitFullscreenMap();
        }
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [
    activeRiddleEntry,
    geocacheModal,
    postcardSubject,
    fullscreenModalPoiId,
    mobileDrawer,
    mobileCompanionExpanded,
    desktopToolbarPanel,
    uiCollapsed,
    isFullscreenMap,
    exitFullscreenMap,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'terra16_desktop_companion_collapsed_v1',
        desktopCompanionCollapsed ? '1' : '0'
      );
    } catch {
      // Ignore quota
    }
  }, [desktopCompanionCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'terra16_desktop_sidebar_collapsed_v1',
        desktopSidebarCollapsed ? '1' : '0'
      );
    } catch {
      // Ignore quota
    }
  }, [desktopSidebarCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(progress));
    } catch {
      // Ignore quota
    }
  }, [progress]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify(entries));
    } catch {
      // Ignore quota
    }
  }, [entries]);

  useEffect(() => {
    try {
      localStorage.setItem('terra16_dashed_traces_v1', dashedTracesEnabled ? '1' : '0');
    } catch {
      // Ignore quota
    }
  }, [dashedTracesEnabled]);

  useEffect(() => {
    saveEncountersToStorage(encounters);
  }, [encounters]);

  useEffect(() => {
    saveRumorLeadsToStorage(rumorLeads);
  }, [rumorLeads]);

  useEffect(() => {
    saveSpecimensToStorage(specimens);
  }, [specimens]);

  useEffect(() => {
    saveOpenedArchivistChests(openedChests);
  }, [openedChests]);

  useEffect(() => {
    saveLocalFallbackGeocaches(localFallbackGeocaches);
  }, [localFallbackGeocaches]);

  useEffect(() => {
    saveFoundGeocacheIds(foundGeocacheIds);
  }, [foundGeocacheIds]);

  useEffect(() => {
    saveVisitedContractSteps(visitedContractSteps);
  }, [visitedContractSteps]);

  useEffect(() => {
    saveSolvedRiddleIds(solvedRiddleIds);
  }, [solvedRiddleIds]);

  useEffect(() => {
    saveClaimedAlmanacQuestIds(claimedAlmanacQuests);
  }, [claimedAlmanacQuests]);

  useEffect(() => {
    saveCompletedHuntIds(completedHuntIds);
  }, [completedHuntIds]);

  useEffect(() => {
    saveHuntVisitedStepMap(huntStepMap);
  }, [huntStepMap]);

  useEffect(() => {
    try {
      localStorage.setItem('terra16_soundscape_v1', soundscapeEnabled ? '1' : '0');
    } catch {
      // Ignore quota
    }
  }, [soundscapeEnabled]);

  useEffect(() => {
    saveHapticsPreference(hapticsEnabled);
  }, [hapticsEnabled]);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setCloudOnline(false);
      setAuthReady(true);
      return;
    }

    let active = true;
    const authInstance = auth;
    const unsubAuth = onAuthStateChanged(authInstance, async (currentUser) => {
      if (!currentUser) {
        if (!active) return;
        setUser(null);
        setAuthReady(true);
        return;
      }
      const check = await validateExplorerAuthSession(currentUser);
      if (!active) return;
      if (check.warningMessage) {
        setAuthError(check.warningMessage);
      }
      setCloudOnline(check.cloudReachable);
      setUser(check.validUser);
      setAuthReady(true);
    });

    const handleOnline = async () => {
      const check = await validateExplorerAuthSession(authInstance.currentUser);
      if (!active) return;
      setCloudOnline(check.cloudReachable);
      setUser(check.validUser);
    };
    const handleOffline = () => {
      if (!active) return;
      setCloudOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      active = false;
      unsubAuth();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!authReady || !user || !cloudOnline) return;
    let unsubCloud: (() => void) | null = null;
    let cancelled = false;

    const bootstrapCloud = async () => {
      try {
        await ensureExplorerProfileInCloud(user, progress);
        await Promise.all([
          syncMissingDiscoveriesToCloud(user.uid, entries),
          syncMissingSpecimensToCloud(user.uid, specimens),
          syncMissingArchivistChestsToCloud(user.uid, openedChests),
        ]);
        if (cancelled) return;
        unsubCloud = subscribeToCloudExplorer(
          user.uid,
          (cloudProfile) =>
            setProgress((prev) => ({
              ...cloudProfile,
              walkedMeters: Math.max(cloudProfile.walkedMeters || 0, prev.walkedMeters || 0),
              solvedRiddlesCount: Math.max(
                cloudProfile.solvedRiddlesCount || 0,
                prev.solvedRiddlesCount || 0
              ),
              completedHuntsCount: Math.max(
                cloudProfile.completedHuntsCount || 0,
                prev.completedHuntsCount || 0
              ),
              claimedAlmanacCount: Math.max(
                cloudProfile.claimedAlmanacCount || 0,
                prev.claimedAlmanacCount || 0
              ),
            })),
          (cloudEntries) => setEntries(cloudEntries),
          (cloudSpecimens) => setSpecimens(cloudSpecimens),
          (cloudChests) =>
            setOpenedChests((prev) => {
              const merged = new Map<string, OpenedArchivistChestRecord>();
              for (const c of prev) merged.set(c.chestId, c);
              for (const c of cloudChests) merged.set(c.chestId, c);
              return Array.from(merged.values()).sort((a, b) =>
                b.openedAtIso.localeCompare(a.openedAtIso)
              );
            })
        );
      } catch (err) {
        handleCloudSyncError(err);
      }
    };

    bootstrapCloud();
    return () => {
      cancelled = true;
      if (unsubCloud) unsubCloud();
    };
  }, [authReady, user, cloudOnline, handleCloudSyncError]);

  const activeGeocacheSectorCenterKey = useMemo(
    () => computeGeocacheSectorKey(playerPos.lat, playerPos.lng),
    [playerPos.lat, playerPos.lng]
  );

  useEffect(() => {
    if (!authReady || !user || !cloudOnline) {
      setCloudGeocaches([]);
      return;
    }
    const sectorKeys = getNearbyGeocacheSectorKeys(playerPos.lat, playerPos.lng);
    const unsubGeo = subscribeToNearbyGeocaches(sectorKeys, (list) => {
      setCloudGeocaches(list);
    });
    return () => unsubGeo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user, cloudOnline, activeGeocacheSectorCenterKey]);

  // Load cached offline sectors on mount
  useEffect(() => {
    listBesaceSectors()
      .then((list) => setCachedSectors(list))
      .catch(() => {});
  }, []);

  const guildPerks = useMemo(() => computeGuildPerks(progress), [progress]);
  const explorerAppearance = useMemo(() => resolveExplorerAppearance(progress), [progress]);

  // Keep progress counters reconciled with local sets for existing saves
  useEffect(() => {
    const targetRiddles = Math.max(progress.solvedRiddlesCount || 0, solvedRiddleIds.size);
    const targetHunts = Math.max(progress.completedHuntsCount || 0, completedHuntIds.size);
    const targetAlmanac = Math.max(progress.claimedAlmanacCount || 0, claimedAlmanacQuests.size);
    if (
      targetRiddles !== (progress.solvedRiddlesCount || 0) ||
      targetHunts !== (progress.completedHuntsCount || 0) ||
      targetAlmanac !== (progress.claimedAlmanacCount || 0)
    ) {
      const synced: ExplorerProgress = {
        ...progress,
        solvedRiddlesCount: targetRiddles,
        completedHuntsCount: targetHunts,
        claimedAlmanacCount: targetAlmanac,
      };
      setProgress(synced);
      if (user && cloudOnline) {
        syncProgressToCloud(user.uid, synced).catch(handleCloudSyncError);
      }
    }
  }, [
    progress,
    solvedRiddleIds.size,
    completedHuntIds.size,
    claimedAlmanacQuests.size,
    user,
    cloudOnline,
    handleCloudSyncError,
  ]);

  // Sync callsign input when cloud profile loads
  useEffect(() => {
    setCallsignDraft(progress.displayName);
  }, [progress.displayName]);

  // Reveal Terra Incognita Fog of War cells around explorer (debounced persistence!)
  useEffect(() => {
    setFogSet((prev) => {
      const updated = revealFogAroundPlayer(
        playerPos.lat,
        playerPos.lng,
        95 + guildPerks.fogVisionBonusMeters,
        prev
      );
      if (!updated) return prev;
      scheduleSaveRevealedFogSet(updated);
      return updated;
    });
  }, [playerPos.lat, playerPos.lng, guildPerks.fogVisionBonusMeters]);

  const localExplorationPct = useMemo(
    () => computeLocalSectorExplorationPct(playerPos.lat, playerPos.lng, fogSet),
    [playerPos.lat, playerPos.lng, fogSet]
  );

  // Track session breadcrumb trail, cumulative walked distance & D+ elevation gain
  useEffect(() => {
    const prev = lastStepMetricRef.current;
    const curAlt = sampleElevationMeters(elevation, playerPos.lat, playerPos.lng);
    const d = haversineMeters(prev.lat, prev.lng, playerPos.lat, playerPos.lng);

    if (d >= 9 && d <= 650) {
      const roundedStep = Math.round(d);
      setSessionMeters((m) => m + roundedStep);
      setProgress((p) => ({
        ...p,
        walkedMeters: (p.walkedMeters || 0) + roundedStep,
      }));
      if (prev.alt !== null && curAlt !== null && curAlt > prev.alt + 0.6) {
        setSessionElevGainM((g) => g + Math.round(curAlt - prev.alt!));
      }
      setBreadcrumbTrail((trail) => {
        const next = [...trail, { lat: playerPos.lat, lng: playerPos.lng }];
        return next.length > 90 ? next.slice(next.length - 90) : next;
      });
      lastStepMetricRef.current = { lat: playerPos.lat, lng: playerPos.lng, alt: curAlt };
    } else if (d > 650) {
      lastStepMetricRef.current = { lat: playerPos.lat, lng: playerPos.lng, alt: curAlt };
    } else if (prev.alt === null && curAlt !== null) {
      lastStepMetricRef.current = { ...prev, alt: curAlt };
    }
  }, [playerPos.lat, playerPos.lng, elevation]);

  // Automatically activate Screen Wake Lock when "Boussole en poche" is switched on
  useEffect(() => {
    if (pocketCompassMode && !wakeLockWanted) {
      setWakeLockWanted(true);
    }
  }, [pocketCompassMode, wakeLockWanted, setWakeLockWanted]);

  const handleToggleScreenAwake = useCallback(async () => {
    vibrateToggleTap(hapticsEnabled);
    await toggleWakeLock();
  }, [hapticsEnabled, toggleWakeLock]);

  const handleToggleHaptics = useCallback(() => {
    setHapticsEnabled((prev) => {
      const next = !prev;
      if (next) {
        vibrateToggleTap(true);
      }
      return next;
    });
  }, []);

  const prevAppliedSectorCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const sectorClientCacheRef = useRef<
    Map<string, { expires: number; payload: SectorPayloadData }>
  >(new Map());

  // Fetch Z15 vector topology + 15 heritage/archaeology/INPN/geology/folklore/toponymy sources + Open-Meteo weather
  const fetchSector = useCallback(async (lat: number, lng: number, force = false) => {
    if (!force && lastFetchedAnchorRef.current) {
      const moved = haversineMeters(
        lastFetchedAnchorRef.current.lat,
        lastFetchedAnchorRef.current.lng,
        lat,
        lng
      );
      if (moved < 680) return;
    }

    const clientCellKey = `${(Math.round(lat * 350) / 350).toFixed(4)}_${(
      Math.round(lng * 350) / 350
    ).toFixed(4)}`;

    const rememberClientSector = (key: string, payload: SectorPayloadData) => {
      const store = sectorClientCacheRef.current;
      if (store.has(key)) store.delete(key);
      while (store.size >= 48) {
        const oldest = store.keys().next().value;
        if (oldest === undefined) break;
        store.delete(oldest);
      }
      store.set(key, { expires: Date.now() + 20 * 60 * 1000, payload });
    };

    const applySectorPayload = (payload: SectorPayloadData, reqSeqCheck?: number) => {
      if (reqSeqCheck !== undefined && reqSeqCheck !== sectorReqSeqRef.current) return;
      lastSectorPayloadRef.current = payload;

      const prevCenter = prevAppliedSectorCenterRef.current;
      const isLocalWalk =
        !force &&
        prevCenter !== null &&
        haversineMeters(prevCenter.lat, prevCenter.lng, lat, lng) < 2800;
      prevAppliedSectorCenterRef.current = { lat, lng };

      if (!isLocalWalk) {
        setPois(payload.pois);
        setTerrain(payload.terrain);
        setSubterranean(payload.subterranean || []);
        setSourceFilter('all');
      } else {
        // Additive local merge with gentle upper bounds for multi-kilometer treks:
        // preserves every nearby POI at its exact coordinates without unbounded RAM growth!
        setPois((prev) => {
          const kept = prev.filter((p) => haversineMeters(lat, lng, p.lat, p.lng) <= 3600);
          const seenIds = new Set(kept.map((p) => p.id));
          const merged = [...kept];
          for (const incoming of payload.pois) {
            if (seenIds.has(incoming.id)) continue;
            const duplicateNearby = merged.some(
              (ex) => haversineMeters(ex.lat, ex.lng, incoming.lat, incoming.lng) < 20
            );
            if (duplicateNearby) continue;
            seenIds.add(incoming.id);
            merged.push(incoming);
          }
          if (merged.length > 240) {
            merged.sort(
              (a, b) =>
                haversineMeters(lat, lng, a.lat, a.lng) - haversineMeters(lat, lng, b.lat, b.lng)
            );
            return merged.slice(0, 240);
          }
          return merged;
        });

        setTerrain((prev) => {
          const kept = prev.filter(
            (f) => f.points.length > 0 && haversineMeters(lat, lng, f.points[0].lat, f.points[0].lng) <= 3800
          );
          const seenIds = new Set(kept.map((f) => f.id));
          const merged = [...kept];
          for (const f of payload.terrain) {
            if (seenIds.has(f.id)) continue;
            seenIds.add(f.id);
            merged.push(f);
          }
          if (merged.length > 2800) {
            merged.sort(
              (a, b) =>
                haversineMeters(lat, lng, a.points[0].lat, a.points[0].lng) -
                haversineMeters(lat, lng, b.points[0].lat, b.points[0].lng)
            );
            return merged.slice(0, 2800);
          }
          return merged;
        });

        setSubterranean((prev) => {
          const incomingSub = payload.subterranean || [];
          const kept = prev.filter(
            (s) => s.points.length > 0 && haversineMeters(lat, lng, s.points[0].lat, s.points[0].lng) <= 3800
          );
          const seenIds = new Set(kept.map((s) => s.id));
          const merged = [...kept];
          for (const s of incomingSub) {
            if (seenIds.has(s.id)) continue;
            seenIds.add(s.id);
            merged.push(s);
          }
          if (merged.length > 260) {
            merged.sort(
              (a, b) =>
                haversineMeters(lat, lng, a.points[0].lat, a.points[0].lng) -
                haversineMeters(lat, lng, b.points[0].lat, b.points[0].lng)
            );
            return merged.slice(0, 260);
          }
          return merged;
        });
      }

      setBedrock((prev) => payload.bedrock || prev);
      setElevation((prev) => payload.elevation || prev || null);
      setWeather((prev) => payload.weather || prev || null);
      setSourcesActive(payload.sourcesActive);
    };

    // Instant 0ms backtracking when revisiting a sector cell explored earlier in the session!
    if (!force) {
      const warmClient = sectorClientCacheRef.current.get(clientCellKey);
      if (warmClient && warmClient.expires > Date.now()) {
        // Promote LRU
        sectorClientCacheRef.current.delete(clientCellKey);
        sectorClientCacheRef.current.set(clientCellKey, warmClient);
        lastFetchedAnchorRef.current = { lat, lng };
        setSectorError('');
        applySectorPayload(warmClient.payload);
        return;
      }
    }

    if (sectorAbortRef.current) {
      sectorAbortRef.current.abort();
    }
    const controller = new AbortController();
    sectorAbortRef.current = controller;
    const reqSeq = ++sectorReqSeqRef.current;

    const prevFetchAnchor = lastFetchedAnchorRef.current;
    lastFetchedAnchorRef.current = { lat, lng };
    setLoadingSector(true);
    setSectorError('');

    try {
      const resp = await fetch(`/api/explore?lat=${lat}&lng=${lng}&radius=1800`, {
        signal: controller.signal,
      });
      if (!resp.ok) throw new Error('Impossible de sonder les strates du secteur.');
      const data = (await resp.json()) as SectorPayloadData;
      if (reqSeq !== sectorReqSeqRef.current) return;

      if (data.pois.length < 4) {
        const wideResp = await fetch(`/api/explore?lat=${lat}&lng=${lng}&radius=4200`, {
          signal: controller.signal,
        });
        if (reqSeq !== sectorReqSeqRef.current) return;
        if (wideResp.ok) {
          const wideData = (await wideResp.json()) as SectorPayloadData;
          const resolvedWide: SectorPayloadData = {
            center: wideData.center || { lat, lng },
            radiusMeters: wideData.radiusMeters || 4200,
            pois: wideData.pois,
            terrain: wideData.terrain.length > 0 ? wideData.terrain : data.terrain,
            subterranean:
              (wideData.subterranean?.length || 0) > 0
                ? wideData.subterranean
                : data.subterranean || [],
            bedrock: wideData.bedrock || data.bedrock,
            elevation: wideData.elevation || data.elevation || null,
            weather: wideData.weather || data.weather || null,
            sourcesActive: wideData.sourcesActive,
            fetchedAt: wideData.fetchedAt || new Date().toISOString(),
          };
          rememberClientSector(clientCellKey, resolvedWide);
          applySectorPayload(resolvedWide, reqSeq);
          return;
        }
      }

      const resolvedPayload: SectorPayloadData = {
        center: data.center || { lat, lng },
        radiusMeters: data.radiusMeters || 1800,
        pois: data.pois,
        terrain: data.terrain,
        subterranean: data.subterranean || [],
        bedrock: data.bedrock,
        elevation: data.elevation || null,
        weather: data.weather || null,
        sourcesActive: data.sourcesActive,
        fetchedAt: data.fetchedAt || new Date().toISOString(),
      };
      rememberClientSector(clientCellKey, resolvedPayload);
      applySectorPayload(resolvedPayload, reqSeq);
    } catch (err) {
      if (controller.signal.aborted || reqSeq !== sectorReqSeqRef.current) return;
      const offlineHit = await findNearestBesaceSector(lat, lng);
      if (reqSeq !== sectorReqSeqRef.current) return;
      if (offlineHit) {
        applySectorPayload(offlineHit.payload, reqSeq);
        setSectorError(`Mode hors-ligne : carte « ${offlineHit.label} » ouverte depuis la Besace.`);
      } else if (!force && lastSectorPayloadRef.current !== null) {
        // Quietly keep the active sector alive on transient background hiccups and retry on next move
        lastFetchedAnchorRef.current = prevFetchAnchor;
      } else {
        setSectorError(err instanceof Error ? err.message : 'Erreur de lecture cartographique.');
      }
    } finally {
      if (reqSeq === sectorReqSeqRef.current) {
        setLoadingSector(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchSector(playerPos.lat, playerPos.lng, false);
  }, [playerPos.lat, playerPos.lng, fetchSector]);

  useEffect(() => {
    return () => {
      sectorAbortRef.current?.abort();
    };
  }, []);

  // Real GPS Watch
  useEffect(() => {
    if (simulationMode) {
      setGpsStatus('Marche Simulée (rues/ponts au clic, D-Pad ou ZQSD)');
      return;
    }
    if (!('geolocation' in navigator)) {
      setGpsStatus('GPS non disponible — retour en Marche Simulée');
      setSimulationMode(true);
      return;
    }

    setGpsStatus('Acquisition du signal satellite GPS…');
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setWalkQueue([]);
        setPlayerPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus(`GPS verrouillé (±${Math.round(pos.coords.accuracy)} m)`);
      },
      () => {
        setGpsStatus('Signal GPS indisponible — passez en Marche Simulée');
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 12000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [simulationMode]);

  const handlePlayerSurfaceChange = useCallback((surface: SurfaceType, nearWater: boolean) => {
    playerSurfaceRef.current = { surface, nearWater };
    setPlayerSurfaceState((prev) =>
      prev.surface === surface && prev.nearWater === nearWater ? prev : { surface, nearWater }
    );
  }, []);

  const lastStepSfxAtRef = useRef<number>(0);
  const manualPulseTimeoutRef = useRef<number | null>(null);
  const pressedMoveKeysRef = useRef<Set<string>>(new Set());

  const triggerRhythmicStepSfx = useCallback(() => {
    const now = performance.now();
    if (now - lastStepSfxAtRef.current < 255) return;
    lastStepSfxAtRef.current = now;
    playStepSfx(
      muted,
      playerSurfaceRef.current.surface,
      playerSurfaceRef.current.nearWater,
      subterraneanMode
    );
  }, [muted, subterraneanMode]);

  const stepExplorerByMeters = useCallback(
    (northMeters: number, eastMeters: number, dir: 'up' | 'down' | 'left' | 'right') => {
      setFacingDir(dir);
      setManualWalkPulse(true);
      if (manualPulseTimeoutRef.current !== null) {
        window.clearTimeout(manualPulseTimeoutRef.current);
      }
      manualPulseTimeoutRef.current = window.setTimeout(() => {
        setManualWalkPulse(false);
        manualPulseTimeoutRef.current = null;
      }, 280);
      setPlayerPos((prev) => {
        const cosLat = Math.max(0.1, Math.cos((prev.lat * Math.PI) / 180));
        return {
          lat: prev.lat + northMeters / 110540,
          lng: prev.lng + eastMeters / (111320 * cosLat),
        };
      });
      triggerRhythmicStepSfx();
    },
    [triggerRhythmicStepSfx]
  );

  // Zoom-proportional step distances for simulated walking (keyboard, D-Pad & A* walk queue)
  const zoomWalkSteps = useMemo(() => getZoomWalkStepMeters(zoomLevel), [zoomLevel]);

  // Keyboard controls (continuous smooth walk while held + +/- zoom + F fullscreen + U fold UI + G Sous-sol)
  useEffect(() => {
    if (activeTab !== 'carte' && !isFullscreenMap) {
      pressedMoveKeysRef.current.clear();
      return;
    }

    let holdIntervalId: number | null = null;
    const normalizeMoveDir = (key: string): 'up' | 'down' | 'left' | 'right' | null => {
      if (key === 'ArrowUp' || key === 'z' || key === 'Z' || key === 'w' || key === 'W') return 'up';
      if (key === 'ArrowDown' || key === 's' || key === 'S') return 'down';
      if (key === 'ArrowLeft' || key === 'q' || key === 'Q' || key === 'a' || key === 'A') return 'left';
      if (key === 'ArrowRight' || key === 'd' || key === 'D') return 'right';
      return null;
    };

    const advanceHeldMovement = (strideScale: number) => {
      if (!simulationMode) return;
      const held = pressedMoveKeysRef.current;
      let ny = 0;
      let nx = 0;
      if (held.has('up')) ny += 1;
      if (held.has('down')) ny -= 1;
      if (held.has('right')) nx += 1;
      if (held.has('left')) nx -= 1;
      if (nx === 0 && ny === 0) return;

      const norm = nx !== 0 && ny !== 0 ? Math.SQRT1_2 : 1;
      const dist = zoomWalkSteps.manualStepMeters * strideScale;
      const primaryDir: 'up' | 'down' | 'left' | 'right' =
        Math.abs(ny) >= Math.abs(nx) ? (ny > 0 ? 'up' : 'down') : nx > 0 ? 'right' : 'left';
      setWalkQueue([]);
      stepExplorerByMeters(ny * norm * dist, nx * norm * dist, primaryDir);
    };

    const stopHoldLoopIfIdle = () => {
      if (pressedMoveKeysRef.current.size === 0 && holdIntervalId !== null) {
        window.clearInterval(holdIntervalId);
        holdIntervalId = null;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoomLevel((z) => (z < 6 ? ((z + 1) as ZoomLevel) : z));
        return;
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoomLevel((z) => (z > 1 ? ((z - 1) as ZoomLevel) : z));
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreenMap();
        return;
      }
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        setUiCollapsed((v) => !v);
        return;
      }
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        setSubterraneanMode((v) => !v);
        return;
      }

      if (!simulationMode) return;
      const moveDir = normalizeMoveDir(e.key);
      if (moveDir) {
        e.preventDefault();
        if (e.repeat) return; // Smooth interval handles continuous stride without OS repeat stutter!
        pressedMoveKeysRef.current.add(moveDir);
        advanceHeldMovement(0.72);
        if (holdIntervalId === null) {
          holdIntervalId = window.setInterval(() => {
            advanceHeldMovement(0.56);
          }, 95);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const moveDir = normalizeMoveDir(e.key);
      if (moveDir) {
        pressedMoveKeysRef.current.delete(moveDir);
        stopHoldLoopIfIdle();
      }
    };

    const onWindowBlur = () => {
      pressedMoveKeysRef.current.clear();
      stopHoldLoopIfIdle();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      if (holdIntervalId !== null) window.clearInterval(holdIntervalId);
      pressedMoveKeysRef.current.clear();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [
    simulationMode,
    activeTab,
    isFullscreenMap,
    zoomWalkSteps.manualStepMeters,
    stepExplorerByMeters,
    toggleFullscreenMap,
  ]);

  // Topological Multi-Waypoint Walk Loop (fine sub-steps for silky 60fps camera & sprite gliding!)
  const activeWaypoint = walkQueue.length > 0 ? walkQueue[0] : null;
  useEffect(() => {
    if (!simulationMode || !activeWaypoint) return;
    const subStepMeters = zoomWalkSteps.tickStepMeters * 0.48;
    const subSnapMeters = Math.max(2, zoomWalkSteps.snapMeters * 0.6);
    const timer = window.setInterval(() => {
      triggerRhythmicStepSfx();
      setPlayerPos((prev) => {
        const dist = haversineMeters(prev.lat, prev.lng, activeWaypoint.lat, activeWaypoint.lng);
        const dLat = activeWaypoint.lat - prev.lat;
        const dLng = activeWaypoint.lng - prev.lng;
        if (Math.abs(dLat) > Math.abs(dLng)) {
          setFacingDir(dLat > 0 ? 'up' : 'down');
        } else {
          setFacingDir(dLng > 0 ? 'right' : 'left');
        }
        if (dist <= subSnapMeters) {
          setWalkQueue((q) => q.slice(1));
          return { lat: activeWaypoint.lat, lng: activeWaypoint.lng };
        }
        const ratio = Math.min(subStepMeters, dist) / dist;
        return {
          lat: prev.lat + dLat * ratio,
          lng: prev.lng + dLng * ratio,
        };
      });
    }, 75);
    return () => window.clearInterval(timer);
  }, [simulationMode, activeWaypoint, zoomWalkSteps, triggerRhythmicStepSfx]);

  const unlockedIds = useMemo(() => {
    const s = new Set<string>(entries.map((e) => e.poiId));
    for (const id of unlockingGuardRef.current) s.add(id);
    return s;
  }, [entries]);

  // Strictly separate Surface POIs vs Sous-sol POIs so the two world layers never show duplicate markers!
  const sectorAnchorLat = Math.round(playerPos.lat * 100) / 100;
  const sectorAnchorLng = Math.round(playerPos.lng * 100) / 100;
  const { surfacePois, subterraneanPois } = useMemo(
    () =>
      partitionSurfaceAndSubterraneanPois({
        rawPois: pois,
        subterranean,
        terrain,
        bedrock,
        centerLat: sectorAnchorLat,
        centerLng: sectorAnchorLng,
      }),
    [pois, subterranean, terrain, bedrock, sectorAnchorLat, sectorAnchorLng]
  );

  const activeLayerPois = subterraneanMode ? subterraneanPois : surfacePois;

  // Clear active walk path when switching between Surface and Sous-sol layers
  useEffect(() => {
    setWalkQueue([]);
  }, [subterraneanMode]);

  useEffect(() => {
    setSelectedPoiId((cur) => {
      if (!cur) return null;
      return activeLayerPois.some((p) => p.id === cur) ? cur : null;
    });
  }, [activeLayerPois]);

  const evaluateMissionsWithEntries = useCallback(
    (currentEntries: UnlockedEntry[], baseProgress: ExplorerProgress): ExplorerProgress => {
      const updated: ExplorerProgress = {
        ...baseProgress,
        completedMissions: [...baseProgress.completedMissions],
      };
      let newlyCompletedTitle = '';
      let newlyCompletedBonus = 0;
      let newlyCompletedRewardName = '';
      let newlyCompletedRewardSlot: WorkshopSlotTab | undefined;
      let newlyCompletedHasFamiliar = false;

      for (const mission of MISSIONS_CATALOG) {
        if (updated.completedMissions.includes(mission.id)) continue;
        if (!isMissionUnlocked(mission, updated)) continue;

        const { current, target } = mission.evaluate(currentEntries);
        if (current >= target) {
          updated.completedMissions.push(mission.id);
          updated.totalXp += mission.xpBonus;
          if (mission.category === 'histoire') updated.xpHistoire += mission.xpBonus;
          if (mission.category === 'geographie') updated.xpGeographie += mission.xpBonus;
          if (mission.category === 'ecosysteme') updated.xpEcosysteme += mission.xpBonus;
          if (mission.category === 'etrange') updated.xpEtrange += mission.xpBonus;
          if (mission.category === 'legende') {
            updated.xpLegende = (updated.xpLegende || 0) + mission.xpBonus;
          }
          newlyCompletedTitle = mission.title;
          newlyCompletedBonus = mission.xpBonus;
          const rewards = getCosmeticRewardsForMission(mission.id);
          newlyCompletedRewardName = rewards.map((r) => r.name).join(' & ');
          newlyCompletedHasFamiliar = rewards.some((r) => r.slot === 'familiar');
          const familiarReward = rewards.find((r) => r.slot === 'familiar');
          newlyCompletedRewardSlot = familiarReward
            ? 'familiar'
            : rewards[0]?.slot;
        }
      }

      if (newlyCompletedTitle) {
        playMissionFanfare(muted);
        setCutIn({
          id: `mission_${Date.now()}`,
          kind: 'mission',
          kicker: newlyCompletedRewardName
            ? newlyCompletedHasFamiliar
              ? 'Quête scellée · Familier & Cosmétique débloqués !'
              : 'Quête scellée · Nouvel équipement cosmétique débloqué !'
            : 'Quête scellée au Grimoire !',
          title: newlyCompletedTitle,
          subtitle: newlyCompletedRewardName
            ? `+${newlyCompletedBonus} XP · Débloqué : « ${newlyCompletedRewardName} »`
            : `Récompense de maîtrise accordée : +${newlyCompletedBonus} XP`,
          unlockedCosmeticName: newlyCompletedRewardName || undefined,
          unlockedCosmeticSlot: newlyCompletedRewardSlot,
        });
      }

      return updated;
    },
    [muted]
  );

  // Proximity Unlocking Engine (strictly unlocks active layer POIs: Surface OR Sous-sol!)
  useEffect(() => {
    const prevPos = prevUnlockPosRef.current;
    prevUnlockPosRef.current = { lat: playerPos.lat, lng: playerPos.lng };
    if (activeLayerPois.length === 0) return;

    if (resetSuppressionAnchorRef.current) {
      const movedSinceReset = haversineMeters(
        resetSuppressionAnchorRef.current.lat,
        resetSuppressionAnchorRef.current.lng,
        playerPos.lat,
        playerPos.lng
      );
      if (movedSinceReset >= 8) {
        resetSuppressionAnchorRef.current = null;
        suppressedPoiIdsUntilMoveRef.current.clear();
      }
    }

    const stepMoved = haversineMeters(prevPos.lat, prevPos.lng, playerPos.lat, playerPos.lng);
    const useSegmentSweep = stepMoved > 1 && stepMoved <= 240;

    const newlyUnlockedPois: PoiItem[] = [];
    for (const poi of activeLayerPois) {
      if (
        unlockedIds.has(poi.id) ||
        unlockingGuardRef.current.has(poi.id) ||
        suppressedPoiIdsUntilMoveRef.current.has(poi.id)
      ) {
        continue;
      }
      const dist = useSegmentSweep
        ? minDistancePointToSegmentMeters(
            poi.lat,
            poi.lng,
            prevPos.lat,
            prevPos.lng,
            playerPos.lat,
            playerPos.lng
          )
        : haversineMeters(playerPos.lat, playerPos.lng, poi.lat, poi.lng);
      const effRadius =
        poi.unlockRadiusMeters + (poi.nearWaterway ? guildPerks.waterwayBonusMeters : 0);
      if (dist <= effRadius) {
        unlockingGuardRef.current.add(poi.id);
        newlyUnlockedPois.push(poi);
      }
    }

    if (newlyUnlockedPois.length === 0) return;

    const hour = new Date().getHours();
    const effectiveTod = resolveEffectiveTimeOfDay(timeMode, weather);
    const isNocturnalOrDusk =
      timeMode === 'dusk' ||
      timeMode === 'night' ||
      (timeMode === 'auto' && ((weather && !weather.isDay) || hour >= 18 || hour < 7));
    const isTrueNightFeat = effectiveTod === 'night' || hour >= 21 || hour < 6;
    const isInclementWeather =
      weather !== null && weather.condition !== 'clear' && weather.condition !== 'cloudy';
    const applyAtmosphereBonus = isNocturnalOrDusk || isInclementWeather;

    const nowIso = new Date().toISOString();
    const newEntries: UnlockedEntry[] = newlyUnlockedPois.map((poi) => {
      const awardedXp = applyAtmosphereBonus
        ? Math.round(poi.xpReward * (1 + guildPerks.atmosphereXpBonusPct / 100))
        : poi.xpReward;
      return {
        poiId: poi.id,
        name: poi.name,
        category: poi.category,
        subType: poi.subType,
        eraLabel: poi.eraLabel || 'Strate locale',
        source: poi.source,
        lat: poi.lat,
        lng: poi.lng,
        summary: poi.summary,
        nearWaterway: poi.nearWaterway,
        waterwayName: poi.waterwayName,
        safetyNotice: poi.safetyNotice,
        externalUrl: poi.externalUrl,
        xpAwarded: awardedXp,
        relatedPoiIds: poi.relatedPoiIds,
        relatedPoiTitles: poi.relatedPoiTitles,
        personalNote: '',
        photoCount: 0,
        discoveredAtIso: nowIso,
      };
    });

    playDiscoveryFanfare(muted);
    vibrateUnlockCelebration(hapticsEnabled);

    const combinedEntries = [...newEntries, ...entries];
    setEntries(combinedEntries);

    const nextBase: ExplorerProgress = { ...progress };
    if (isTrueNightFeat) {
      nextBase.nightFeatsCount = (nextBase.nightFeatsCount || 0) + newEntries.length;
    }
    if (isInclementWeather) {
      nextBase.stormFeatsCount = (nextBase.stormFeatsCount || 0) + newEntries.length;
    }
    for (const e of newEntries) {
      nextBase.totalXp += e.xpAwarded;
      nextBase.discoveriesCount += 1;
      if (e.category === 'histoire') nextBase.xpHistoire += e.xpAwarded;
      if (e.category === 'geographie') nextBase.xpGeographie += e.xpAwarded;
      if (e.category === 'ecosysteme') nextBase.xpEcosysteme += e.xpAwarded;
      if (e.category === 'etrange') nextBase.xpEtrange += e.xpAwarded;
      if (e.category === 'legende') nextBase.xpLegende = (nextBase.xpLegende || 0) + e.xpAwarded;
    }

    const finalProgress = evaluateMissionsWithEntries(combinedEntries, nextBase);
    setProgress(finalProgress);

    const primary = newEntries[0];
    const catMeta = CATEGORY_META[primary.category];
    setSelectedPoiId(primary.poiId);
    setSelectedJournalPoiId(primary.poiId);
    setCutIn({
      id: `disc_${primary.poiId}`,
      kind: 'discovery',
      kicker: `Nouveau feuillet enluminé · ${primary.eraLabel}`,
      title: primary.name,
      subtitle: `${catMeta.label} · +${primary.xpAwarded} XP${
        applyAtmosphereBonus ? ` (Bonus d’ambiance +${guildPerks.atmosphereXpBonusPct}%)` : ''
      }`,
      emblemSrc: catMeta.emblemSrc,
      poiId: primary.poiId,
    });

    if (user && cloudOnline) {
      Promise.all([
        ...newEntries.map((entry) => createDiscoveryInCloud(user.uid, entry)),
        syncProgressToCloud(user.uid, finalProgress),
      ]).catch(handleCloudSyncError);
    }
  }, [
    playerPos,
    activeLayerPois,
    unlockedIds,
    entries,
    progress,
    evaluateMissionsWithEntries,
    muted,
    hapticsEnabled,
    user,
    cloudOnline,
    handleCloudSyncError,
    guildPerks,
    timeMode,
    weather,
  ]);

  const handleSaveJournalAnnotation = async (poiId: string, note: string, photoCount: number) => {
    const updatedEntries = entries.map((e) =>
      e.poiId === poiId ? { ...e, personalNote: note, photoCount } : e
    );
    setEntries(updatedEntries);
    const evaluatedProgress = evaluateMissionsWithEntries(updatedEntries, progress);
    setProgress(evaluatedProgress);

    if (user && cloudOnline) {
      try {
        await updateDiscoveryJournalInCloud(user.uid, poiId, note, photoCount);
        await syncProgressToCloud(user.uid, evaluatedProgress);
      } catch (err) {
        handleCloudSyncError(err);
      }
    }
  };

  const openJournalEntry = (poiId: string) => {
    playJournalOpenSfx(muted);
    if (isFullscreenMap) {
      setFullscreenModalPoiId(poiId);
      return;
    }
    setCarnetView('liste');
    setSelectedJournalPoiId(poiId);
    setMobileJournalDetailOpen(true);
    setActiveTab('carnet');
  };

  const handleNavigateToRelatedPoi = (relatedId: string) => {
    if (unlockedIds.has(relatedId)) {
      openJournalEntry(relatedId);
    } else {
      setFullscreenModalPoiId(null);
      setSelectedPoiId(relatedId);
      setActiveTab('carte');
    }
  };

  const handlePlaceSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length < 2) return;
    setSearchingPlace(true);
    try {
      const resp = await fetch(`/api/geocode?q=${encodeURIComponent(searchQuery.trim())}`);
      if (resp.ok) {
        const data = (await resp.json()) as {
          results: Array<{ label: string; lat: number; lng: number }>;
        };
        setSearchResults(data.results || []);
      }
    } finally {
      setSearchingPlace(false);
    }
  };

  const teleportToLocation = (lat: number, lng: number) => {
    setSimulationMode(true);
    setWalkQueue([]);
    setExpeditionStops([]);
    setSelectedPoiId(null);
    setSearchResults([]);
    setMobileDrawer('none');
    setDesktopToolbarPanel('none');
    setBreadcrumbTrail([{ lat, lng }]);
    lastStepMetricRef.current = { lat, lng, alt: null };
    lastFetchedAnchorRef.current = null;
    setPlayerPos({ lat, lng });
    fetchSector(lat, lng, true);
  };

  const handleSaveCurrentSectorToBesace = useCallback(async () => {
    const payload: SectorPayloadData = lastSectorPayloadRef.current || {
      center: { lat: playerPos.lat, lng: playerPos.lng },
      radiusMeters: 1800,
      pois,
      terrain,
      bedrock,
      elevation,
      weather,
      sourcesActive,
      fetchedAt: new Date().toISOString(),
    };
    const label = `${computeAtmosphereLabel(terrain, elevation)} (${playerPos.lat.toFixed(
      3
    )}°N, ${playerPos.lng.toFixed(3)}°E)`;
    const updatedList = await saveSectorToBesace(label, payload);
    setCachedSectors(updatedList);
    setBesaceToast('Secteur mis en besace hors-ligne !');
    window.setTimeout(() => setBesaceToast(''), 2800);
  }, [playerPos.lat, playerPos.lng, pois, terrain, bedrock, elevation, weather, sourcesActive]);

  const handleDeleteBesaceSector = useCallback(async (id: string) => {
    const updatedList = await deleteBesaceSector(id);
    setCachedSectors(updatedList);
  }, []);

  const handleRestoreGrimoireArchive = useCallback(
    (restored: {
      progress: ExplorerProgress;
      entries: UnlockedEntry[];
      fogCells: string[];
      encounters: NpcEncounterRecord[];
      rumors: RumorLead[];
      specimens?: CollectedSpecimen[];
      importedPhotosCount: number;
    }) => {
      setProgress(restored.progress);
      setEntries(restored.entries);
      setEncounters(restored.encounters || []);
      setRumorLeads(restored.rumors || []);
      setSpecimens(restored.specimens || []);
      const nextFog = new Set(restored.fogCells);
      setFogSet(nextFog);
      saveRevealedFogSet(nextFog);
      if (user && cloudOnline) {
        Promise.all([
          syncProgressToCloud(user.uid, restored.progress),
          syncMissingDiscoveriesToCloud(user.uid, restored.entries),
          syncMissingSpecimensToCloud(user.uid, restored.specimens || []),
        ]).catch(handleCloudSyncError);
      }
    },
    [user, cloudOnline, handleCloudSyncError]
  );

  const handleUpdateAppearance = async (patch: Partial<ExplorerAppearance>) => {
    playStampSfx(muted);
    const nextProgress: ExplorerProgress = {
      ...progress,
      ...patch,
    };
    setProgress(nextProgress);
    if (user && cloudOnline) {
      try {
        await updateExplorerIdentityInCloud(
          user.uid,
          nextProgress.displayName,
          resolveExplorerAppearance(nextProgress),
          nextProgress.pinnedTrophyId || ''
        );
      } catch (err) {
        handleCloudSyncError(err);
      }
    }
  };

  const handleResetCharacter = useCallback(async () => {
    // Suppress immediate auto-unlock on POIs currently overlapping playerPos until player steps >= 8m
    const overlapping = new Set<string>();
    for (const poi of [...surfacePois, ...subterraneanPois]) {
      const dist = haversineMeters(playerPos.lat, playerPos.lng, poi.lat, poi.lng);
      if (dist <= poi.unlockRadiusMeters + 60) {
        overlapping.add(poi.id);
      }
    }
    suppressedPoiIdsUntilMoveRef.current = overlapping;
    resetSuppressionAnchorRef.current = { lat: playerPos.lat, lng: playerPos.lng };

    // Stop active movement & reset transient guards
    setWalkQueue([]);
    setExpeditionStops([]);
    unlockingGuardRef.current.clear();
    hapticSealIdsRef.current.clear();
    hapticRumorIdsRef.current.clear();
    hapticTreasureStageRef.current.clear();
    knownUnlockedTrophiesRef.current = new Set();
    setCutIn(null);
    setSelectedPoiId(null);
    setSelectedJournalPoiId(null);
    setPostcardSubject(null);
    setGeocacheModal(null);

    // Reset local character state, Carnet, Bestiary, Herbarium, Reliquary, Rumors, contracts, session trail & fog of war
    const freshProgress: ExplorerProgress = { ...INITIAL_PROGRESS, completedMissions: [] };
    setProgress(freshProgress);
    setCallsignDraft(freshProgress.displayName);
    setEntries([]);
    setEncounters([]);
    setRumorLeads([]);
    setSpecimens([]);
    setHarvestedSpecimenNodes(new Set());
    setOpenedChests([]);
    setLocalFallbackGeocaches([]);
    setFoundGeocacheIds(new Set());
    saveEncountersToStorage([]);
    saveRumorLeadsToStorage([]);
    saveSpecimensToStorage([]);
    saveOpenedArchivistChests([]);
    saveLocalFallbackGeocaches([]);
    saveFoundGeocacheIds(new Set());
    const emptyContracts = new Set<string>();
    setClaimedContracts(emptyContracts);
    saveClaimedSectorContracts(emptyContracts);
    const emptyVisitedSteps = new Set<string>();
    setVisitedContractSteps(emptyVisitedSteps);
    saveVisitedContractSteps(emptyVisitedSteps);
    const emptyRiddles = new Set<string>();
    setSolvedRiddleIds(emptyRiddles);
    saveSolvedRiddleIds(emptyRiddles);
    const emptyAlmanacQuests = new Set<string>();
    setClaimedAlmanacQuests(emptyAlmanacQuests);
    saveClaimedAlmanacQuestIds(emptyAlmanacQuests);
    const emptyHunts = new Set<string>();
    setCompletedHuntIds(emptyHunts);
    saveCompletedHuntIds(emptyHunts);
    setHuntStepMap({});
    saveHuntVisitedStepMap({});
    setTrackingHuntOnMap(false);
    setActiveRiddleEntry(null);
    hapticHuntStageRef.current.clear();
    setSessionMeters(0);
    setSessionElevGainM(0);
    setBreadcrumbTrail([{ lat: playerPos.lat, lng: playerPos.lng }]);
    lastStepMetricRef.current = { lat: playerPos.lat, lng: playerPos.lng, alt: null };
    prevUnlockPosRef.current = { lat: playerPos.lat, lng: playerPos.lng };

    const freshFog =
      revealFogAroundPlayer(playerPos.lat, playerPos.lng, 95, new Set<string>()) ||
      new Set<string>();
    setFogSet(freshFog);
    saveRevealedFogSet(freshFog);

    try {
      localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(freshProgress));
      localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify([]));
    } catch {
      // Ignore storage quota
    }

    await clearAllStoredPhotos();

    if (user && cloudOnline) {
      try {
        await resetExplorerCharacterInCloud(user.uid, freshProgress);
      } catch (err) {
        handleCloudSyncError(err);
      }
    }
  }, [
    surfacePois,
    subterraneanPois,
    playerPos.lat,
    playerPos.lng,
    user,
    cloudOnline,
    handleCloudSyncError,
  ]);

  const handleEquipOutfit = async (outfitId: ExplorerOutfitId) => {
    await handleUpdateAppearance({ outfitId });
  };

  const handleSaveCallsignDirect = async (rawName: string) => {
    const cleaned = rawName.trim().slice(0, 60) || 'Explorateur';
    playStampSfx(muted);
    const nextProgress: ExplorerProgress = { ...progress, displayName: cleaned };
    setProgress(nextProgress);
    setCallsignDraft(cleaned);
    setCallsignSavedNotice(true);
    window.setTimeout(() => setCallsignSavedNotice(false), 2400);
    if (user && cloudOnline) {
      try {
        await updateExplorerIdentityInCloud(
          user.uid,
          cleaned,
          resolveExplorerAppearance(nextProgress),
          nextProgress.pinnedTrophyId || ''
        );
      } catch (err) {
        handleCloudSyncError(err);
      }
    }
  };

  const handleSaveCallsign = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSaveCallsignDirect(callsignDraft);
  };

  const cycleTimeMode = () => {
    setTimeMode((cur) => {
      const idx = TIME_MODES_ORDER.indexOf(cur);
      return TIME_MODES_ORDER[(idx + 1) % TIME_MODES_ORDER.length];
    });
  };

  const handleAuthAction = async () => {
    setAuthError('');
    try {
      if (user) {
        await signOutExplorer();
      } else {
        await signInExplorerWithGoogle();
        setCloudOnline(true);
      }
    } catch (err) {
      setAuthError(
        err instanceof Error && !err.message.startsWith('Firebase:')
          ? err.message
          : formatFirebaseAuthErrorFr(err)
      );
    }
  };

  const handleInstallClick = async () => {
    vibrateToggleTap(hapticsEnabled);
    if (isInstallable) {
      const accepted = await promptInstall();
      if (!accepted) {
        setMobileDrawer('install-app');
      }
    } else {
      setMobileDrawer('install-app');
    }
  };

  const handleCopyDirectAppUrl = async () => {
    try {
      const targetUrl = window.location.origin;
      await navigator.clipboard.writeText(targetUrl);
      vibrateToggleTap(hapticsEnabled);
      setUrlCopiedNotice(true);
      window.setTimeout(() => setUrlCopiedNotice(false), 2800);
    } catch {
      // Ignore clipboard permission restrictions
    }
  };

  const globalLevelInfo = useMemo(() => computeLevelFromXp(progress.totalXp), [progress.totalXp]);
  const daytimeMood = useMemo(() => getDaytimeMood(timeMode, weather), [timeMode, weather]);

  // Filter active-layer POIs (Surface OR Sous-sol) by optional Archive Bookmark as well
  const archiveFilteredPois = useMemo(() => {
    if (sourceFilter === 'all') return activeLayerPois;
    const token = sourceFilter.split('·')[0].split('(')[0].trim().toLowerCase();
    return activeLayerPois.filter((p) => p.source.toLowerCase().includes(token));
  }, [activeLayerPois, sourceFilter]);

  const selectedMapPoi = useMemo(
    () => activeLayerPois.find((p) => p.id === selectedPoiId) || null,
    [activeLayerPois, selectedPoiId]
  );

  const selectedMapPoiEntry = useMemo(
    () => (selectedPoiId ? entries.find((e) => e.poiId === selectedPoiId) || null : null),
    [entries, selectedPoiId]
  );

  const fullscreenModalEntry = useMemo(
    () =>
      fullscreenModalPoiId ? entries.find((e) => e.poiId === fullscreenModalPoiId) || null : null,
    [entries, fullscreenModalPoiId]
  );

  const sortedNearbyPois = useMemo(() => {
    return archiveFilteredPois
      .filter(
        (p) =>
          (categoryFilter === 'all' || p.category === categoryFilter) &&
          (stratumFilter === 'all' || p.stratum === stratumFilter)
      )
      .map((poi) => ({
        poi,
        distance: Math.round(haversineMeters(playerPos.lat, playerPos.lng, poi.lat, poi.lng)),
        unlocked: unlockedIds.has(poi.id),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [archiveFilteredPois, categoryFilter, stratumFilter, playerPos.lat, playerPos.lng, unlockedIds]);

  const nearestUndiscovered = useMemo(
    () => sortedNearbyPois.find((item) => !item.unlocked) || null,
    [sortedNearbyPois]
  );

  // Tactile Proximity Haptics + Crystalline Chime when walking near an undiscovered '?' seal (<= 135 m) or active NPC rumor (<= 150 m)
  useEffect(() => {
    // Re-arm seal haptics if explorer walked > 220 m away or unlocked the POI
    for (const armedId of Array.from(hapticSealIdsRef.current)) {
      if (unlockedIds.has(armedId)) {
        hapticSealIdsRef.current.delete(armedId);
        continue;
      }
      const match = activeLayerPois.find((p) => p.id === armedId);
      if (
        !match ||
        haversineMeters(playerPos.lat, playerPos.lng, match.lat, match.lng) > 220
      ) {
        hapticSealIdsRef.current.delete(armedId);
      }
    }

    if (nearestUndiscovered && nearestUndiscovered.distance <= 135) {
      const pid = nearestUndiscovered.poi.id;
      if (!hapticSealIdsRef.current.has(pid)) {
        hapticSealIdsRef.current.add(pid);
        vibrateMysterySealNearby(hapticsEnabled);
        if (pocketCompassMode) {
          playProximityChimeSfx(muted);
        }
      }
    }

    // Re-arm & trigger active NPC rumor proximity pulses (<= 150 m)
    for (const armedLeadId of Array.from(hapticRumorIdsRef.current)) {
      const lead = rumorLeads.find((l) => l.id === armedLeadId);
      if (
        !lead ||
        lead.verified ||
        haversineMeters(playerPos.lat, playerPos.lng, lead.lat, lead.lng) > 230
      ) {
        hapticRumorIdsRef.current.delete(armedLeadId);
      }
    }

    for (const lead of rumorLeads) {
      if (lead.verified) continue;
      if (Boolean(lead.isSubterranean) !== subterraneanMode) continue;
      if (hapticRumorIdsRef.current.has(lead.id)) continue;
      const dist = haversineMeters(playerPos.lat, playerPos.lng, lead.lat, lead.lng);
      if (dist <= 150) {
        hapticRumorIdsRef.current.add(lead.id);
        vibrateRumorLeadNearby(hapticsEnabled);
        if (pocketCompassMode) {
          playProximityChimeSfx(muted);
        }
        break;
      }
    }
  }, [
    nearestUndiscovered,
    activeLayerPois,
    unlockedIds,
    rumorLeads,
    subterraneanMode,
    playerPos.lat,
    playerPos.lng,
    hapticsEnabled,
    pocketCompassMode,
    muted,
  ]);

  const toggleExpeditionStop = useCallback((poi: PoiItem) => {
    setExpeditionStops((prev) => {
      if (prev.some((p) => p.id === poi.id)) {
        return prev.filter((p) => p.id !== poi.id);
      }
      if (prev.length >= 5) {
        return [...prev.slice(0, 4), poi];
      }
      return [...prev, poi];
    });
  }, []);

  const expeditionSummary = useMemo(() => {
    if (expeditionStops.length === 0) {
      return { totalMeters: 0, estMinutes: 0, elevGainM: 0 };
    }
    let totalDirect = 0;
    let elevGain = 0;
    let curLat = playerPos.lat;
    let curLng = playerPos.lng;
    let prevAlt = sampleElevationMeters(elevation, curLat, curLng);

    for (const stop of expeditionStops) {
      totalDirect += haversineMeters(curLat, curLng, stop.lat, stop.lng);
      const nextAlt = sampleElevationMeters(elevation, stop.lat, stop.lng);
      if (prevAlt !== null && nextAlt !== null && nextAlt > prevAlt) {
        elevGain += nextAlt - prevAlt;
      }
      if (nextAlt !== null) prevAlt = nextAlt;
      curLat = stop.lat;
      curLng = stop.lng;
    }

    const totalMeters = Math.max(15, Math.round(totalDirect * 1.26));
    const estMinutes = Math.max(1, Math.round(totalMeters / 74));
    return {
      totalMeters,
      estMinutes,
      elevGainM: Math.round(elevGain),
    };
  }, [expeditionStops, playerPos.lat, playerPos.lng, elevation]);

  const launchExpeditionLoop = useCallback(() => {
    if (expeditionStops.length === 0) return;
    const stops = expeditionStops.map((s) => ({ lat: s.lat, lng: s.lng }));
    setSimulationMode(true);
    setDashedTracesEnabled(true);
    setRouteRequest({
      id: Date.now(),
      lat: stops[0].lat,
      lng: stops[0].lng,
      stops,
    });
    setMobileDrawer('none');
  }, [expeditionStops]);

  // Target for the live Brass Compass Rose: selected POI if any, else nearest undiscovered mystery
  const compassTarget = useMemo(() => {
    if (selectedMapPoi) {
      const d = Math.round(
        haversineMeters(playerPos.lat, playerPos.lng, selectedMapPoi.lat, selectedMapPoi.lng)
      );
      const deg = computeBearingDeg(
        playerPos.lat,
        playerPos.lng,
        selectedMapPoi.lat,
        selectedMapPoi.lng
      );
      return {
        poi: selectedMapPoi,
        distance: d,
        bearingDeg: deg,
        unlocked: unlockedIds.has(selectedMapPoi.id),
      };
    }
    if (nearestUndiscovered) {
      const deg = computeBearingDeg(
        playerPos.lat,
        playerPos.lng,
        nearestUndiscovered.poi.lat,
        nearestUndiscovered.poi.lng
      );
      return {
        poi: nearestUndiscovered.poi,
        distance: nearestUndiscovered.distance,
        bearingDeg: deg,
        unlocked: false,
      };
    }
    return null;
  }, [selectedMapPoi, nearestUndiscovered, playerPos.lat, playerPos.lng, unlockedIds]);

  const playerAltitude = useMemo(
    () => sampleElevationMeters(elevation, playerPos.lat, playerPos.lng),
    [elevation, playerPos.lat, playerPos.lng]
  );

  const compassDeltaAlt = useMemo(() => {
    if (!compassTarget || playerAltitude === null) return null;
    const targetAlt = sampleElevationMeters(
      elevation,
      compassTarget.poi.lat,
      compassTarget.poi.lng
    );
    if (targetAlt === null) return null;
    return Math.round(targetAlt - playerAltitude);
  }, [compassTarget, elevation, playerAltitude]);

  const selectedPoiDeltaAlt = useMemo(() => {
    if (!selectedMapPoi || playerAltitude === null) return null;
    const targetAlt = sampleElevationMeters(elevation, selectedMapPoi.lat, selectedMapPoi.lng);
    if (targetAlt === null) return null;
    return Math.round(targetAlt - playerAltitude);
  }, [selectedMapPoi, elevation, playerAltitude]);

  // Ambient local biome & relief mood + regional 16-bit architectural tradition
  const localAtmosphereLabel = useMemo(
    () => computeAtmosphereLabel(terrain, elevation),
    [terrain, elevation]
  );

  const regionalTheme = useMemo(
    () =>
      resolveRegionalTheme({
        lat: playerPos.lat,
        lng: playerPos.lng,
        elevation,
        bedrock,
        terrain,
      }),
    [playerPos.lat, playerPos.lng, elevation, bedrock, terrain]
  );

  const observedBestiaryCount = useMemo(() => {
    const seen = new Set<string>();
    for (const e of encounters) {
      if (!e.isHuman) seen.add(e.kind);
    }
    return seen.size;
  }, [encounters]);

  // Synchronize Procedural Biome Soundscape (wind on crests, river murmur, woodland birds, cavern droplets)
  useEffect(() => {
    const isNight =
      timeMode === 'night' ||
      (timeMode === 'auto' &&
        (weather ? !weather.isDay : new Date().getHours() < 6 || new Date().getHours() >= 21));
    const isRaining = weather?.condition === 'rain' || weather?.condition === 'storm';
    const reliefSpan = elevation ? elevation.maxMeters - elevation.minMeters : 0;
    const isHighCrest =
      elevation !== null &&
      playerAltitude !== null &&
      reliefSpan >= 42 &&
      playerAltitude >= elevation.minMeters + reliefSpan * 0.64;
    const isCrestOrWindy = isHighCrest || (weather?.windKmh ?? 0) >= 19;

    syncBiomeSoundscape({
      enabled: soundscapeEnabled,
      muted,
      subterranean: subterraneanMode,
      surface: playerSurfaceState.surface,
      nearWater: playerSurfaceState.nearWater,
      isCrestOrWindy,
      isNight,
      isRaining,
    });
  }, [
    soundscapeEnabled,
    muted,
    subterraneanMode,
    playerSurfaceState.surface,
    playerSurfaceState.nearWater,
    timeMode,
    weather,
    elevation,
    playerAltitude,
  ]);

  const encountersRef = useRef<NpcEncounterRecord[]>(encounters);
  encountersRef.current = encounters;

  // Record wild species observations & local inhabitant conversations into the Codex
  const handleNpcInteract = useCallback(
    (npc: WorldNpc) => {
      // Dismiss floating bottom POI sheet on mobile, fullscreen, or collapsed sidebar so panels never stack
      if (isFullscreenMap || desktopSidebarCollapsed || window.innerWidth < 1024) {
        setSelectedPoiId(null);
      }
      const nowIso = new Date().toISOString();
      const recId = npc.isHuman ? `human_${npc.id}` : `species_${npc.kind}`;
      const alreadyRecorded = encountersRef.current.some((item) => item.id === recId);
      const isNewSpecies = !alreadyRecorded && !npc.isHuman;
      const isNewHuman = !alreadyRecorded && npc.isHuman;

      setEncounters((prev) => {
        const idx = prev.findIndex((item) => item.id === recId);
        if (idx >= 0) {
          const cur = prev[idx];
          const nextRegions = cur.regionsVisited.includes(localAtmosphereLabel)
            ? cur.regionsVisited
            : [...cur.regionsVisited, localAtmosphereLabel].slice(-8);
          const updated: NpcEncounterRecord = {
            ...cur,
            regionLabel: localAtmosphereLabel,
            regionsVisited: nextRegions,
            lat: npc.lat,
            lng: npc.lng,
            dialogues: npc.dialogues.length > 0 ? npc.dialogues : cur.dialogues,
            sightingsCount: cur.sightingsCount + 1,
            lastMetIso: nowIso,
          };
          const copy = [...prev];
          copy[idx] = updated;
          return copy;
        }

        const catMeta = !npc.isHuman
          ? BESTIARY_SPECIES_CATALOG.find((s) => s.kind === npc.kind)
          : undefined;

        const created: NpcEncounterRecord = {
          id: recId,
          kind: npc.kind,
          isHuman: npc.isHuman,
          isSubterranean: npc.isSubterranean,
          name: catMeta ? catMeta.name : npc.name,
          roleLabel: catMeta ? catMeta.familyLabel : npc.roleLabel,
          habitatLabel: npc.habitatLabel,
          regionLabel: localAtmosphereLabel,
          regionsVisited: [localAtmosphereLabel],
          lat: npc.lat,
          lng: npc.lng,
          seed: npc.seed,
          dialogues: npc.dialogues,
          sightingsCount: 1,
          firstMetIso: nowIso,
          lastMetIso: nowIso,
        };
        return [created, ...prev];
      });

      if (isNewSpecies) {
        const catMeta = BESTIARY_SPECIES_CATALOG.find((s) => s.kind === npc.kind);
        playStampSfx(muted);
        setProgress((prev) => {
          const next: ExplorerProgress = {
            ...prev,
            totalXp: prev.totalXp + 15,
            xpEcosysteme: prev.xpEcosysteme + 15,
          };
          if (user && cloudOnline) {
            syncProgressToCloud(user.uid, next).catch(handleCloudSyncError);
          }
          return next;
        });
        setCutIn({
          id: `bestiary_${npc.kind}_${Date.now()}`,
          kind: 'discovery',
          kicker: 'Nouvelle espèce consignée au Bestiaire !',
          title: catMeta ? catMeta.name : npc.name,
          subtitle: `+15 XP Écosystème · ${localAtmosphereLabel}`,
          emblemSrc: CATEGORY_META.ecosysteme.emblemSrc,
        });
      } else if (isNewHuman) {
        setProgress((prev) => {
          const next: ExplorerProgress = {
            ...prev,
            totalXp: prev.totalXp + 5,
            xpLegende: (prev.xpLegende || 0) + 5,
          };
          if (user && cloudOnline) {
            syncProgressToCloud(user.uid, next).catch(handleCloudSyncError);
          }
          return next;
        });
      }
    },
    [
      cloudOnline,
      desktopSidebarCollapsed,
      handleCloudSyncError,
      isFullscreenMap,
      localAtmosphereLabel,
      muted,
      user,
    ]
  );

  // Pin an informant's rumor/lead onto the explorer's map
  const handleAcceptRumor = useCallback(
    (draft: NpcRumorDraft) => {
      setRumorLeads((prev) => {
        if (prev.some((r) => r.id === draft.id)) return prev;
        const created: RumorLead = {
          ...draft,
          regionLabel: localAtmosphereLabel,
          verified: false,
          createdAtIso: new Date().toISOString(),
        };
        return [created, ...prev];
      });
    },
    [localAtmosphereLabel]
  );

  // Harvest a real-bedrock botanical sketch or geological hand-specimen on the 16-bit map
  const handleHarvestSpecimen = useCallback(
    (node: WorldSpecimenNode) => {
      if (harvestedSpecimenNodes.has(node.nodeId)) return;
      setHarvestedSpecimenNodes((prev) => {
        const next = new Set(prev);
        next.add(node.nodeId);
        return next;
      });

      playSpecimenHarvestSfx(muted, node.domain === 'geologie');
      const nowIso = new Date().toISOString();
      const lithologyDisplay = node.bedrockPeriod
        ? `${node.lithologyLabel} (${node.bedrockPeriod})`
        : node.lithologyLabel;

      const existing = specimens.find((s) => s.specimenId === node.specimenId);
      const isFirstSpecimenPlate = !existing;
      const syncedSpecimen: CollectedSpecimen = existing
        ? {
            ...existing,
            lithologyLabel: node.lithologyLabel,
            bedrockPeriod: node.bedrockPeriod,
            bedrockAgeMa: node.bedrockAgeMa,
            regionLabel: localAtmosphereLabel,
            habitatLabel: node.habitatLabel,
            lat: node.lat,
            lng: node.lng,
            altitudeMeters: node.altitudeMeters,
            isSubterranean: node.isSubterranean,
            harvestCount: existing.harvestCount + 1,
            lastCollectedIso: nowIso,
          }
        : {
            specimenId: node.specimenId,
            domain: node.domain,
            affinity: node.affinity,
            name: node.name,
            latinOrMineralName: node.latinOrMineralName,
            familyLabel: node.familyLabel,
            lithologyLabel: node.lithologyLabel,
            bedrockPeriod: node.bedrockPeriod,
            bedrockAgeMa: node.bedrockAgeMa,
            regionLabel: localAtmosphereLabel,
            habitatLabel: node.habitatLabel,
            lat: node.lat,
            lng: node.lng,
            altitudeMeters: node.altitudeMeters,
            isSubterranean: node.isSubterranean,
            harvestCount: 1,
            firstCollectedIso: nowIso,
            lastCollectedIso: nowIso,
            description: node.description,
          };

      setSpecimens((prev) => [
        syncedSpecimen,
        ...prev.filter((s) => s.specimenId !== node.specimenId),
      ]);

      const xpGain = isFirstSpecimenPlate ? 20 : 8;
      setProgress((prev) => {
        const next: ExplorerProgress = {
          ...prev,
          totalXp: prev.totalXp + xpGain,
          xpEcosysteme: prev.xpEcosysteme + (node.domain === 'botanique' ? xpGain : 0),
          xpGeographie: prev.xpGeographie + (node.domain === 'geologie' ? xpGain : 0),
        };
        if (user && cloudOnline) {
          syncProgressToCloud(user.uid, next).catch(handleCloudSyncError);
        }
        return next;
      });

      if (user && cloudOnline) {
        upsertSpecimenInCloud(user.uid, syncedSpecimen).catch(handleCloudSyncError);
      }

      if (isFirstSpecimenPlate) {
        setCutIn({
          id: `spec_${node.specimenId}_${Date.now()}`,
          kind: 'discovery',
          kicker:
            node.domain === 'botanique'
              ? 'Nouveau croquis consigné à l’Herbier !'
              : 'Nouvel échantillon scellé à la Lithothèque !',
          title: node.name,
          subtitle: `+${xpGain} XP ${
            node.domain === 'botanique' ? 'Écosystème' : 'Géographie'
          } · ${lithologyDisplay}`,
          emblemSrc:
            node.domain === 'botanique'
              ? CATEGORY_META.ecosysteme.emblemSrc
              : CATEGORY_META.geographie.emblemSrc,
        });
      }
    },
    [harvestedSpecimenNodes, specimens, muted, localAtmosphereLabel, user, cloudOnline, handleCloudSyncError]
  );

  // Deterministic World Archivist Chests for the active real-world sector
  const sectorAnchorQuantKey = `${Math.round(playerPos.lat * 100)}_${Math.round(playerPos.lng * 100)}`;
  const worldChests = useMemo(() => {
    return spawnWorldArchivistChests({
      centerLat: playerPos.lat,
      centerLng: playerPos.lng,
      terrain,
      subterranean,
      elevation,
      bedrock,
      pois: [...surfacePois, ...subterraneanPois],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectorAnchorQuantKey, terrain, subterranean, elevation, bedrock, surfacePois, subterraneanPois]);

  const openedChestIdSet = useMemo(
    () => new Set(openedChests.map((c) => c.chestId)),
    [openedChests]
  );

  const mergedNearbyGeocaches = useMemo(() => {
    const byId = new Map<string, ExplorerGeocacheRecord>();
    for (const loc of localFallbackGeocaches) {
      byId.set(loc.id, loc);
    }
    for (const cl of cloudGeocaches) {
      byId.set(cl.id, cl);
    }
    return Array.from(byId.values());
  }, [localFallbackGeocaches, cloudGeocaches]);

  // Tactile Telluric Detector Haptics when walking near buried Archivist Chests or Explorer Geocaches
  useEffect(() => {
    const activeTargets: Array<{ key: string; lat: number; lng: number }> = [];
    for (const ch of worldChests) {
      if (openedChestIdSet.has(ch.chestId)) continue;
      if (Boolean(ch.isSubterranean) !== subterraneanMode) continue;
      activeTargets.push({ key: `chest_${ch.chestId}`, lat: ch.lat, lng: ch.lng });
    }
    for (const gc of mergedNearbyGeocaches) {
      if (foundGeocacheIds.has(gc.id)) continue;
      if (user && gc.authorId === user.uid) continue;
      if (Boolean(gc.isSubterranean) !== subterraneanMode) continue;
      activeTargets.push({ key: `cache_${gc.id}`, lat: gc.lat, lng: gc.lng });
    }

    const activeKeyMap = new Map(activeTargets.map((t) => [t.key, t]));
    for (const [key] of Array.from(hapticTreasureStageRef.current.entries())) {
      const target = activeKeyMap.get(key);
      if (
        !target ||
        haversineMeters(playerPos.lat, playerPos.lng, target.lat, target.lng) > 235
      ) {
        hapticTreasureStageRef.current.delete(key);
      }
    }

    let triggeredHot = false;
    let triggeredWarm = false;
    for (const t of activeTargets) {
      const dist = haversineMeters(playerPos.lat, playerPos.lng, t.lat, t.lng);
      const prevStage = hapticTreasureStageRef.current.get(t.key);
      if (dist <= 55 && prevStage !== 'hot') {
        hapticTreasureStageRef.current.set(t.key, 'hot');
        triggeredHot = true;
      } else if (dist <= 160 && !prevStage) {
        hapticTreasureStageRef.current.set(t.key, 'warm');
        triggeredWarm = true;
      }
    }

    if (triggeredHot) {
      vibrateBuriedTreasureHot(hapticsEnabled);
      if (pocketCompassMode) {
        playProximityChimeSfx(muted);
      }
    } else if (triggeredWarm) {
      vibrateBuriedTreasureWarm(hapticsEnabled);
    }
  }, [
    worldChests,
    openedChestIdSet,
    mergedNearbyGeocaches,
    foundGeocacheIds,
    user,
    subterraneanMode,
    playerPos.lat,
    playerPos.lng,
    hapticsEnabled,
    pocketCompassMode,
    muted,
  ]);

  const handleOpenArchivistChest = useCallback(
    (chest: WorldArchivistChestNode) => {
      if (openedChestIdSet.has(chest.chestId)) {
        setCarnetView('tresors');
        setActiveTab('carnet');
        if (isFullscreenMap) exitFullscreenMap();
        return;
      }

      playChestOpenSfx(muted);
      vibrateUnlockCelebration(hapticsEnabled);
      const record: OpenedArchivistChestRecord = {
        chestId: chest.chestId,
        archetype: chest.archetype,
        title: chest.title,
        placeNote: chest.placeNote,
        relicId: chest.relic.id,
        relicName: chest.relic.name,
        category: chest.category,
        regionLabel: localAtmosphereLabel || 'Secteur local',
        lat: chest.lat,
        lng: chest.lng,
        altitudeMeters: chest.altitudeMeters,
        isSubterranean: chest.isSubterranean,
        xpAwarded: chest.xpReward,
        openedAtIso: new Date().toISOString(),
      };

      setOpenedChests((prev) => [
        record,
        ...prev.filter((r) => r.chestId !== chest.chestId),
      ]);

      setProgress((prev) => {
        const hour = new Date().getHours();
        const isNight =
          resolveEffectiveTimeOfDay(timeMode, weather) === 'night' || hour >= 21 || hour < 6;
        const isStorm =
          weather !== null && weather.condition !== 'clear' && weather.condition !== 'cloudy';
        const next: ExplorerProgress = {
          ...prev,
          totalXp: prev.totalXp + chest.xpReward,
          xpHistoire: prev.xpHistoire + (chest.category === 'histoire' ? chest.xpReward : 0),
          xpGeographie: prev.xpGeographie + (chest.category === 'geographie' ? chest.xpReward : 0),
          xpEcosysteme: prev.xpEcosysteme + (chest.category === 'ecosysteme' ? chest.xpReward : 0),
          xpEtrange: prev.xpEtrange + (chest.category === 'etrange' ? chest.xpReward : 0),
          xpLegende: (prev.xpLegende || 0) + (chest.category === 'legende' ? chest.xpReward : 0),
          nightFeatsCount: (prev.nightFeatsCount || 0) + (isNight ? 1 : 0),
          stormFeatsCount: (prev.stormFeatsCount || 0) + (isStorm ? 1 : 0),
        };
        if (user && cloudOnline) {
          syncProgressToCloud(user.uid, next).catch(handleCloudSyncError);
        }
        return next;
      });

      if (user && cloudOnline) {
        recordOpenedArchivistChestInCloud(user.uid, record).catch(handleCloudSyncError);
      }

      const catMeta = CATEGORY_META[chest.category] || CATEGORY_META.geographie;
      setCutIn({
        id: `chest_${chest.chestId}_${Date.now()}`,
        kind: 'discovery',
        kicker: `Coffre d’Archiviste descellé · +${chest.xpReward} XP ${catMeta.shortLabel}`,
        title: chest.relic.name,
        subtitle: `${chest.title} · ${localAtmosphereLabel}`,
        emblemSrc: catMeta.emblemSrc,
        openReliquary: true,
      });
    },
    [
      openedChestIdSet,
      muted,
      hapticsEnabled,
      localAtmosphereLabel,
      user,
      cloudOnline,
      handleCloudSyncError,
      isFullscreenMap,
      exitFullscreenMap,
      timeMode,
      weather,
    ]
  );

  const handleClaimGeocacheDiscovery = useCallback(
    (cache: ExplorerGeocacheRecord) => {
      if (foundGeocacheIds.has(cache.id)) return;
      playChestOpenSfx(muted);
      vibrateUnlockCelebration(hapticsEnabled);
      setFoundGeocacheIds((prev) => {
        const next = new Set(prev);
        next.add(cache.id);
        return next;
      });

      const xpBonus = 90;
      setProgress((prev) => {
        const next: ExplorerProgress = {
          ...prev,
          totalXp: prev.totalXp + xpBonus,
          xpGeographie: prev.xpGeographie + 45,
          xpLegende: (prev.xpLegende || 0) + 45,
        };
        if (user && cloudOnline) {
          syncProgressToCloud(user.uid, next).catch(handleCloudSyncError);
        }
        return next;
      });

      setCutIn({
        id: `geocache_${cache.id}_${Date.now()}`,
        kind: 'discovery',
        kicker: 'Capsule d’Explorateur découverte !',
        title: `${cache.title} (${cache.giftName})`,
        subtitle: `+${xpBonus} XP · Cachée par ${cache.authorCallsign}`,
        emblemSrc: CATEGORY_META.legende.emblemSrc,
        openReliquary: true,
      });
    },
    [foundGeocacheIds, muted, hapticsEnabled, user, cloudOnline, handleCloudSyncError]
  );

  const handleFocusTreasureTargetOnMap = useCallback(
    (lat: number, lng: number, isSub: boolean) => {
      setSubterraneanMode(isSub);
      const dist = haversineMeters(playerPos.lat, playerPos.lng, lat, lng);
      if (dist <= 1800 && simulationMode) {
        setDashedTracesEnabled(true);
        setRouteRequest({ id: Date.now(), lat, lng });
      } else if (simulationMode) {
        teleportToLocation(lat, lng);
      } else {
        setDashedTracesEnabled(true);
      }
      setActiveTab('carte');
      setMobileDrawer('none');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playerPos.lat, playerPos.lng, simulationMode]
  );

  // ==========================================================================
  // PACK D : 3 CONTRATS DE TERRAIN LOCAUX DYNAMIQUES & SALLE DES TROPHÉES 16-BIT
  // ==========================================================================
  const effectiveTimeForContracts = useMemo(
    () => resolveEffectiveTimeOfDay(timeMode, weather),
    [timeMode, weather]
  );

  const dynamicContracts = useMemo(
    () =>
      generateDynamicSectorContracts({
        centerLat: playerPos.lat,
        centerLng: playerPos.lng,
        surfacePois,
        subterraneanPois,
        terrain,
        elevation,
        bedrock,
        worldChests,
        weather,
        effectiveTime: effectiveTimeForContracts,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      sectorAnchorQuantKey,
      surfacePois,
      subterraneanPois,
      terrain,
      elevation,
      bedrock,
      worldChests,
      weather,
      effectiveTimeForContracts,
    ]
  );

  // Validate topographic summit / waypoint steps when the explorer physically reaches them
  useEffect(() => {
    if (dynamicContracts.length === 0) return;
    let newlyVisitedStep: DynamicContractStep | null = null;
    for (const contract of dynamicContracts) {
      if (claimedContracts.has(contract.id)) continue;
      for (const step of contract.steps) {
        if (step.kind !== 'summit' || visitedContractSteps.has(step.id)) continue;
        if (Boolean(step.isSubterranean) !== subterraneanMode) continue;
        const dist = haversineMeters(playerPos.lat, playerPos.lng, step.lat, step.lng);
        if (dist <= step.reachRadiusMeters) {
          newlyVisitedStep = step;
          break;
        }
      }
      if (newlyVisitedStep) break;
    }

    if (!newlyVisitedStep) return;
    const hitStep = newlyVisitedStep;
    setVisitedContractSteps((prev) => {
      const next = new Set(prev);
      next.add(hitStep.id);
      return next;
    });
    playProximityChimeSfx(muted);
    setCutIn({
      id: `summit_step_${hitStep.id}`,
      kind: 'discovery',
      kicker: 'Étape de Triangulation validée',
      title: hitStep.label,
      subtitle: `${hitStep.shortTag} atteint sur le terrain réel`,
      emblemSrc: CATEGORY_META.geographie.emblemSrc,
    });
  }, [
    playerPos.lat,
    playerPos.lng,
    subterraneanMode,
    dynamicContracts,
    claimedContracts,
    visitedContractSteps,
    muted,
  ]);

  // Auto-claim completed Dynamic Sector Contracts
  useEffect(() => {
    if (dynamicContracts.length === 0) return;
    let newlyClaimed: {
      title: string;
      totalXp: number;
      weatherBonusApplied: boolean;
      category: ExplorationCategory;
    } | null = null;
    const nextClaimed = new Set(claimedContracts);

    for (const c of dynamicContracts) {
      if (nextClaimed.has(c.id)) continue;
      const ev = evaluateDynamicContract(c, {
        entries,
        openedChests,
        visitedStepIds: visitedContractSteps,
      });
      if (ev.current >= ev.target) {
        nextClaimed.add(c.id);
        const totalXp = c.xpBonus + (c.isWeatherBonusActive ? c.weatherBonusXp : 0);
        newlyClaimed = {
          title: c.title,
          totalXp,
          weatherBonusApplied: c.isWeatherBonusActive && c.weatherBonusXp > 0,
          category: c.category,
        };
        break;
      }
    }

    if (!newlyClaimed) return;
    setClaimedContracts(nextClaimed);
    saveClaimedSectorContracts(nextClaimed);

    const isStormNow =
      weather !== null && weather.condition !== 'clear' && weather.condition !== 'cloudy';
    const updatedProgress: ExplorerProgress = {
      ...progress,
      totalXp: progress.totalXp + newlyClaimed.totalXp,
      xpHistoire:
        progress.xpHistoire + (newlyClaimed.category === 'histoire' ? newlyClaimed.totalXp : 0),
      xpGeographie:
        progress.xpGeographie + (newlyClaimed.category === 'geographie' ? newlyClaimed.totalXp : 0),
      xpEcosysteme:
        progress.xpEcosysteme + (newlyClaimed.category === 'ecosysteme' ? newlyClaimed.totalXp : 0),
      xpEtrange:
        progress.xpEtrange + (newlyClaimed.category === 'etrange' ? newlyClaimed.totalXp : 0),
      xpLegende:
        (progress.xpLegende || 0) +
        (newlyClaimed.category === 'legende' ? newlyClaimed.totalXp : 0),
      completedContractsCount: (progress.completedContractsCount || 0) + 1,
      stormFeatsCount: (progress.stormFeatsCount || 0) + (isStormNow ? 1 : 0),
    };
    setProgress(updatedProgress);
    playMissionFanfare(muted);
    setCutIn({
      id: `contract_${Date.now()}`,
      kind: 'mission',
      kicker: 'Contrat de Terrain accompli !',
      title: newlyClaimed.title,
      subtitle: `Prime d’exploration locale : +${newlyClaimed.totalXp} XP${
        newlyClaimed.weatherBonusApplied ? ' (prime météo / nocturne incluse)' : ''
      }`,
    });

    if (user && cloudOnline) {
      syncProgressToCloud(user.uid, updatedProgress).catch(handleCloudSyncError);
    }
  }, [
    dynamicContracts,
    entries,
    openedChests,
    visitedContractSteps,
    claimedContracts,
    progress,
    weather,
    muted,
    user,
    cloudOnline,
    handleCloudSyncError,
  ]);

  const handleTargetContractStep = useCallback(
    (step: DynamicContractStep, contractCategory: ExplorationCategory) => {
      setSubterraneanMode(Boolean(step.isSubterranean));
      setCategoryFilter('all');
      if (step.poiId) {
        setSelectedPoiId(step.poiId);
      } else {
        setSelectedPoiId(null);
      }
      setDashedTracesEnabled(true);
      const dist = haversineMeters(playerPos.lat, playerPos.lng, step.lat, step.lng);
      if (simulationMode && dist <= 2400) {
        setRouteRequest({ id: Date.now(), lat: step.lat, lng: step.lng });
      } else if (simulationMode && dist > 2400) {
        teleportToLocation(step.lat, step.lng);
      } else if (!step.poiId) {
        setCategoryFilter(contractCategory);
      }
      setActiveTab('carte');
      setMobileDrawer('none');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playerPos.lat, playerPos.lng, simulationMode]
  );

  const handleLaunchContractLoop = useCallback(
    (contract: DynamicSectorContract, completedStepIds: ReadonlySet<string>) => {
      const remainingSteps = contract.steps.filter((s) => !completedStepIds.has(s.id));
      const orderedSteps = remainingSteps.length > 0 ? remainingSteps : contract.steps;
      if (orderedSteps.length === 0) {
        setCategoryFilter(contract.category);
        setActiveTab('carte');
        return;
      }
      const first = orderedSteps[0];
      setSubterraneanMode(Boolean(first.isSubterranean));
      setCategoryFilter('all');
      if (first.poiId) {
        setSelectedPoiId(first.poiId);
      }
      const matchingPois = orderedSteps
        .map((st) =>
          st.poiId
            ? [...surfacePois, ...subterraneanPois].find((p) => p.id === st.poiId) || null
            : null
        )
        .filter((p): p is PoiItem => p !== null);
      if (matchingPois.length > 0) {
        setExpeditionStops(matchingPois.slice(0, 5));
      }
      setDashedTracesEnabled(true);
      if (simulationMode) {
        const sameLayerStops = orderedSteps
          .filter((s) => Boolean(s.isSubterranean) === Boolean(first.isSubterranean))
          .map((s) => ({ lat: s.lat, lng: s.lng }));
        setRouteRequest({
          id: Date.now(),
          lat: first.lat,
          lng: first.lng,
          stops: sameLayerStops.length > 0 ? sameLayerStops : [{ lat: first.lat, lng: first.lng }],
        });
      }
      setActiveTab('carte');
      setMobileDrawer('none');
    },
    [simulationMode, surfacePois, subterraneanPois]
  );

  // ==========================================================================
  // PACK E : ALMANACH CALENDAIRE (GLOBAL + LOCAL), ÉNIGMES & CHASSES AUX TRÉSORS
  // ==========================================================================
  const almanacGeoKey = `${Math.round(playerPos.lat * 25) / 25}_${Math.round(playerPos.lng * 25) / 25}`;
  const almanacDateKey = almanacPreviewDate
    ? `${almanacPreviewDate.month}_${almanacPreviewDate.day}`
    : 'today';

  useEffect(() => {
    const controller = new AbortController();
    setLoadingAlmanac(true);
    const params = new URLSearchParams({
      lat: playerPos.lat.toFixed(4),
      lng: playerPos.lng.toFixed(4),
    });
    if (almanacPreviewDate) {
      params.set('month', String(almanacPreviewDate.month));
      params.set('day', String(almanacPreviewDate.day));
    }
    fetch(`/api/almanac?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: SectorAlmanacPayload | null) => {
        if (payload && !controller.signal.aborted) {
          setAlmanacData(payload);
        }
      })
      .catch(() => {
        // Offline graceful fallback
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingAlmanac(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [almanacGeoKey, almanacDateKey]);

  const almanacEvalContext = useMemo<AlmanacQuestEvalContext>(() => {
    const hour = new Date().getHours();
    const isNightOrDusk =
      effectiveTimeForContracts === 'dusk' ||
      effectiveTimeForContracts === 'night' ||
      hour >= 18 ||
      hour < 7;
    return {
      entries,
      solvedRiddleIds,
      completedHuntIds,
      weather,
      isNightOrDusk,
    };
  }, [entries, solvedRiddleIds, completedHuntIds, weather, effectiveTimeForContracts]);

  const handleClaimAlmanacReward = useCallback(
    (questId: string, title: string, category: ExplorationCategory, xpBonus: number) => {
      if (claimedAlmanacQuests.has(questId)) return;
      const nextSetSize = claimedAlmanacQuests.size + 1;
      setClaimedAlmanacQuests((prev) => {
        const next = new Set(prev);
        next.add(questId);
        return next;
      });
      vibrateUnlockCelebration(hapticsEnabled);

      const nextAlmanacCount = Math.max((progress.claimedAlmanacCount || 0) + 1, nextSetSize);
      const nextProgress: ExplorerProgress = {
        ...progress,
        totalXp: progress.totalXp + xpBonus,
        xpHistoire: progress.xpHistoire + (category === 'histoire' ? xpBonus : 0),
        xpGeographie: progress.xpGeographie + (category === 'geographie' ? xpBonus : 0),
        xpEcosysteme: progress.xpEcosysteme + (category === 'ecosysteme' ? xpBonus : 0),
        xpEtrange: progress.xpEtrange + (category === 'etrange' ? xpBonus : 0),
        xpLegende: (progress.xpLegende || 0) + (category === 'legende' ? xpBonus : 0),
        claimedAlmanacCount: nextAlmanacCount,
      };
      const newlyUnlocked = getNewlyUnlockedCosmetics(progress, nextProgress, entries, entries);
      setProgress(nextProgress);
      if (user && cloudOnline) {
        syncProgressToCloud(user.uid, nextProgress).catch(handleCloudSyncError);
      }

      const hasFamiliar = newlyUnlocked.some((item) => item.slot === 'familiar');
      const rewardNames = newlyUnlocked.map((item) => item.name).join(' & ');
      const primarySlot: WorkshopSlotTab | undefined =
        newlyUnlocked.find((item) => item.slot === 'familiar')?.slot || newlyUnlocked[0]?.slot;

      setCutIn({
        id: `almanac_${questId}_${Date.now()}`,
        kind: 'mission',
        kicker: rewardNames
          ? hasFamiliar
            ? 'Quête de l’Almanach · Nouveau Familier débloqué !'
            : 'Quête de l’Almanach · Nouvel équipement débloqué !'
          : 'Quête de l’Almanach scellée !',
        title,
        subtitle: rewardNames
          ? `+${xpBonus} XP ${CATEGORY_META[category].shortLabel} · Récompense : « ${rewardNames} »`
          : `+${xpBonus} XP ${CATEGORY_META[category].shortLabel} accordés au Grimoire`,
        unlockedCosmeticName: rewardNames || undefined,
        unlockedCosmeticSlot: primarySlot,
      });
    },
    [claimedAlmanacQuests, progress, entries, hapticsEnabled, user, cloudOnline, handleCloudSyncError]
  );

  const activeRiddle = useMemo(() => {
    if (!activeRiddleEntry) return null;
    const matchedPoi =
      [...surfacePois, ...subterraneanPois].find((p) => p.id === activeRiddleEntry.poiId) || null;
    return generateContextualRiddleForEntry({
      entry: activeRiddleEntry,
      sectorPoi: matchedPoi,
      bedrock,
      elevation,
    });
  }, [activeRiddleEntry, surfacePois, subterraneanPois, bedrock, elevation]);

  const handleSolveContextualRiddle = useCallback(
    (riddle: ContextualRiddle, firstTry: boolean) => {
      if (solvedRiddleIds.has(riddle.poiId)) return;
      const earnedXp = firstTry ? riddle.xpBonus : Math.max(15, Math.round(riddle.xpBonus * 0.6));
      const nextSolvedSize = solvedRiddleIds.size + 1;
      setSolvedRiddleIds((prev) => {
        const next = new Set(prev);
        next.add(riddle.poiId);
        return next;
      });
      vibrateUnlockCelebration(hapticsEnabled);

      const nextSolvedCount = Math.max((progress.solvedRiddlesCount || 0) + 1, nextSolvedSize);
      const nextProgress: ExplorerProgress = {
        ...progress,
        totalXp: progress.totalXp + earnedXp,
        xpHistoire: progress.xpHistoire + (riddle.category === 'histoire' ? earnedXp : 0),
        xpGeographie: progress.xpGeographie + (riddle.category === 'geographie' ? earnedXp : 0),
        xpEcosysteme: progress.xpEcosysteme + (riddle.category === 'ecosysteme' ? earnedXp : 0),
        xpEtrange: progress.xpEtrange + (riddle.category === 'etrange' ? earnedXp : 0),
        xpLegende: (progress.xpLegende || 0) + (riddle.category === 'legende' ? earnedXp : 0),
        solvedRiddlesCount: nextSolvedCount,
      };
      const newlyUnlocked = getNewlyUnlockedCosmetics(progress, nextProgress, entries, entries);
      setProgress(nextProgress);
      if (user && cloudOnline) {
        syncProgressToCloud(user.uid, nextProgress).catch(handleCloudSyncError);
      }

      if (newlyUnlocked.length > 0) {
        const hasFamiliar = newlyUnlocked.some((item) => item.slot === 'familiar');
        const rewardNames = newlyUnlocked.map((item) => item.name).join(' & ');
        const primarySlot: WorkshopSlotTab =
          newlyUnlocked.find((item) => item.slot === 'familiar')?.slot || newlyUnlocked[0].slot;
        setCutIn({
          id: `riddle_unlock_${riddle.poiId}_${Date.now()}`,
          kind: 'mission',
          kicker: hasFamiliar
            ? 'Sceau d’Érudition · Nouveau Familier débloqué !'
            : 'Sceau d’Érudition · Cosmétique débloqué !',
          title: rewardNames,
          subtitle: `+${earnedXp} XP · Énigme de « ${riddle.poiName} » percée (${nextSolvedCount} résolue${
            nextSolvedCount > 1 ? 's' : ''
          })`,
          unlockedCosmeticName: rewardNames,
          unlockedCosmeticSlot: primarySlot,
        });
      }
    },
    [solvedRiddleIds, progress, entries, hapticsEnabled, user, cloudOnline, handleCloudSyncError]
  );

  const currentSectorHunt = useMemo(
    () =>
      generateSectorTreasureHunt({
        centerLat: sectorAnchorLat,
        centerLng: sectorAnchorLng,
        surfacePois,
        subterraneanPois,
        terrain,
        elevation,
        localityName: almanacData?.locality.commune || undefined,
      }),
    [
      sectorAnchorLat,
      sectorAnchorLng,
      surfacePois,
      subterraneanPois,
      terrain,
      elevation,
      almanacData?.locality.commune,
    ]
  );

  const currentHuntStepIdx = currentSectorHunt
    ? huntStepMap[currentSectorHunt.huntId] || 0
    : 0;
  const isCurrentHuntCompleted = Boolean(
    currentSectorHunt && completedHuntIds.has(currentSectorHunt.huntId)
  );

  const handleAdvanceCurrentHuntStep = useCallback(() => {
    if (!currentSectorHunt || isCurrentHuntCompleted) return;
    const stepIdx = huntStepMap[currentSectorHunt.huntId] || 0;
    const step = currentSectorHunt.steps[stepIdx];
    if (!step) return;

    if (stepIdx + 1 < currentSectorHunt.steps.length) {
      playDiscoveryFanfare(muted);
      vibrateUnlockCelebration(hapticsEnabled);
      setHuntStepMap((prev) => ({
        ...prev,
        [currentSectorHunt.huntId]: stepIdx + 1,
      }));
      setCutIn({
        id: `hunt_step_${currentSectorHunt.huntId}_${stepIdx}`,
        kind: 'discovery',
        kicker: `Piste au Trésor · Jalon ${stepIdx + 1}/${currentSectorHunt.steps.length} trouvé !`,
        title: step.trueName,
        subtitle: 'La strophe suivante du parchemin vient de se révéler !',
        emblemSrc: CATEGORY_META[step.category].emblemSrc,
      });
      return;
    }

    // Final step reached!
    playMissionFanfare(muted);
    vibrateUnlockCelebration(hapticsEnabled);
    setHuntStepMap((prev) => ({
      ...prev,
      [currentSectorHunt.huntId]: currentSectorHunt.steps.length,
    }));
    const nextHuntsSize = completedHuntIds.size + 1;
    setCompletedHuntIds((prev) => {
      const next = new Set(prev);
      next.add(currentSectorHunt.huntId);
      return next;
    });
    setTrackingHuntOnMap(false);

    const xpBonus = currentSectorHunt.xpReward;
    const nextHuntsCount = Math.max((progress.completedHuntsCount || 0) + 1, nextHuntsSize);
    const nextProgress: ExplorerProgress = {
      ...progress,
      totalXp: progress.totalXp + xpBonus,
      xpGeographie: progress.xpGeographie + Math.round(xpBonus * 0.5),
      xpHistoire: progress.xpHistoire + Math.round(xpBonus * 0.5),
      completedHuntsCount: nextHuntsCount,
    };
    const newlyUnlocked = getNewlyUnlockedCosmetics(progress, nextProgress, entries, entries);
    setProgress(nextProgress);
    if (user && cloudOnline) {
      syncProgressToCloud(user.uid, nextProgress).catch(handleCloudSyncError);
    }

    const hasFamiliar = newlyUnlocked.some((item) => item.slot === 'familiar');
    const rewardNames = newlyUnlocked.map((item) => item.name).join(' & ');
    const primarySlot: WorkshopSlotTab | undefined =
      newlyUnlocked.find((item) => item.slot === 'familiar')?.slot || newlyUnlocked[0]?.slot;

    setCutIn({
      id: `hunt_done_${currentSectorHunt.huntId}`,
      kind: 'mission',
      kicker: rewardNames
        ? hasFamiliar
          ? 'Chasse au Trésor · Familier compagnon débloqué !'
          : 'Chasse au Trésor · Butin cosmétique débloqué !'
        : `Chasse au Trésor accomplie · +${xpBonus} XP !`,
      title: currentSectorHunt.relicTitle,
      subtitle: rewardNames
        ? `+${xpBonus} XP · Récompense débloquée : « ${rewardNames} »`
        : `${currentSectorHunt.title} — tous les jalons secrets ont été percés !`,
      unlockedCosmeticName: rewardNames || undefined,
      unlockedCosmeticSlot: primarySlot,
    });
  }, [
    currentSectorHunt,
    isCurrentHuntCompleted,
    huntStepMap,
    completedHuntIds.size,
    progress,
    entries,
    muted,
    hapticsEnabled,
    user,
    cloudOnline,
    handleCloudSyncError,
  ]);

  // Auto-advance active clue hunt step on physical arrival + tactile hot/cold pulses when tracking
  useEffect(() => {
    if (!currentSectorHunt || isCurrentHuntCompleted) return;
    const stepIdx = huntStepMap[currentSectorHunt.huntId] || 0;
    const step = currentSectorHunt.steps[stepIdx];
    if (!step) return;
    if (Boolean(step.isSubterranean) !== subterraneanMode) return;

    const dist = haversineMeters(playerPos.lat, playerPos.lng, step.lat, step.lng);
    if (dist <= step.reachRadiusMeters) {
      handleAdvanceCurrentHuntStep();
      return;
    }

    if (trackingHuntOnMap) {
      const stageKey = `${currentSectorHunt.huntId}_${stepIdx}`;
      const prevStage = hapticHuntStageRef.current.get(stageKey);
      if (dist <= 115 && prevStage !== 'hot') {
        hapticHuntStageRef.current.set(stageKey, 'hot');
        vibrateBuriedTreasureHot(hapticsEnabled);
      } else if (dist <= 240 && !prevStage) {
        hapticHuntStageRef.current.set(stageKey, 'warm');
        vibrateBuriedTreasureWarm(hapticsEnabled);
      }
    }
  }, [
    currentSectorHunt,
    isCurrentHuntCompleted,
    huntStepMap,
    subterraneanMode,
    playerPos.lat,
    playerPos.lng,
    trackingHuntOnMap,
    hapticsEnabled,
    handleAdvanceCurrentHuntStep,
  ]);

  // 16-Bit Trophy Medallion Evaluation & Unlock Celebration
  const evaluatedTrophies = useMemo(
    () =>
      evaluateAllTrophies({
        progress,
        entries,
        specimens,
        encounters,
        openedChests,
        foundGeocacheIdsCount: foundGeocacheIds.size,
        fogCellsCount: fogSet.size,
        claimedContractsCount: claimedContracts.size,
      }),
    [
      progress,
      entries,
      specimens,
      encounters,
      openedChests,
      foundGeocacheIds.size,
      fogSet.size,
      claimedContracts.size,
    ]
  );

  const unlockedTrophyIds = useMemo(
    () => new Set(evaluatedTrophies.filter((t) => t.unlocked).map((t) => t.trophy.id)),
    [evaluatedTrophies]
  );

  const explorerTitleInfo = useMemo(
    () => resolveExplorerDisplayTitle(progress, unlockedTrophyIds),
    [progress, unlockedTrophyIds]
  );

  useEffect(() => {
    if (knownUnlockedTrophiesRef.current === null) {
      knownUnlockedTrophiesRef.current = new Set(unlockedTrophyIds);
      return;
    }
    const prevKnown = knownUnlockedTrophiesRef.current;
    let newlyUnlockedId: TrophyId | null = null;
    for (const id of unlockedTrophyIds) {
      if (!prevKnown.has(id)) {
        prevKnown.add(id);
        if (!newlyUnlockedId) newlyUnlockedId = id;
      }
    }
    if (!newlyUnlockedId) return;
    const trophyDef = TROPHIES_CATALOG.find((t) => t.id === newlyUnlockedId);
    if (!trophyDef) return;
    playMissionFanfare(muted);
    vibrateUnlockCelebration(hapticsEnabled);
    const genderedTitle = getGenderedTrophyTitle(trophyDef, progress.gender);
    setCutIn({
      id: `trophy_${trophyDef.id}_${Date.now()}`,
      kind: 'mission',
      kicker: 'Nouveau Trophée 16-bit ciselé au Médaillier !',
      title: trophyDef.name,
      subtitle: `Titre débloqué : « ${genderedTitle} »`,
      unlockedTrophyId: trophyDef.id,
    });
  }, [unlockedTrophyIds, progress.gender, muted, hapticsEnabled]);

  const handlePinTrophy = useCallback(
    async (trophyId: TrophyId | '') => {
      if (trophyId && !unlockedTrophyIds.has(trophyId)) return;
      playStampSfx(muted);
      const nextProgress: ExplorerProgress = {
        ...progress,
        pinnedTrophyId: trophyId,
      };
      setProgress(nextProgress);
      if (user && cloudOnline) {
        try {
          await Promise.all([
            updateExplorerIdentityInCloud(
              user.uid,
              nextProgress.displayName,
              resolveExplorerAppearance(nextProgress),
              trophyId
            ),
            syncProgressToCloud(user.uid, nextProgress),
          ]);
        } catch (err) {
          handleCloudSyncError(err);
        }
      }
    },
    [unlockedTrophyIds, muted, progress, user, cloudOnline, handleCloudSyncError]
  );

  const handleOpenNpcPostcard = useCallback(
    (npc: WorldNpc) => {
      const recId = npc.isHuman ? npc.id : `species_${npc.kind}`;
      const existing = encounters.find((e) => e.id === recId);
      if (existing) {
        setPostcardSubject({ kind: 'encounter', encounter: existing });
        return;
      }
      const catMeta = !npc.isHuman
        ? BESTIARY_SPECIES_CATALOG.find((s) => s.kind === npc.kind)
        : undefined;
      const nowIso = new Date().toISOString();
      setPostcardSubject({
        kind: 'encounter',
        encounter: {
          id: recId,
          kind: npc.kind,
          isHuman: npc.isHuman,
          isSubterranean: npc.isSubterranean,
          name: catMeta ? catMeta.name : npc.name,
          roleLabel: catMeta ? catMeta.familyLabel : npc.roleLabel,
          habitatLabel: npc.habitatLabel,
          regionLabel: localAtmosphereLabel,
          regionsVisited: [localAtmosphereLabel],
          lat: npc.lat,
          lng: npc.lng,
          seed: npc.seed,
          dialogues: npc.dialogues,
          sightingsCount: 1,
          firstMetIso: nowIso,
          lastMetIso: nowIso,
        },
      });
    },
    [encounters, localAtmosphereLabel]
  );

  // Automatically verify active rumors when the explorer reaches the site, unlocks the POI, or enters the portal
  useEffect(() => {
    if (rumorLeads.length === 0) return;

    const nowIso = new Date().toISOString();
    let changed = false;
    let firstNewlyVerified: RumorLead | null = null;

    const nextLeads = rumorLeads.map((lead) => {
      if (lead.verified) return lead;
      const dist = haversineMeters(playerPos.lat, playerPos.lng, lead.lat, lead.lng);
      const isPoiVerified =
        lead.targetType === 'poi' &&
        (unlockedIds.has(lead.targetId) ||
          (Boolean(lead.isSubterranean) === subterraneanMode && dist <= 46));
      const isPortalVerified =
        lead.targetType === 'portal' &&
        (dist <= 44 || (subterraneanMode && dist <= 105));

      if (isPoiVerified || isPortalVerified) {
        changed = true;
        const updated: RumorLead = { ...lead, verified: true, verifiedAtIso: nowIso };
        if (!firstNewlyVerified) firstNewlyVerified = updated;
        return updated;
      }
      return lead;
    });

    if (!changed || !firstNewlyVerified) return;

    const resolvedLead = firstNewlyVerified as RumorLead;
    const prevVerifiedCount = rumorLeads.filter((l) => l.verified).length;
    const nextVerifiedCount = nextLeads.filter((l) => l.verified).length;
    const xpGain = Math.max(1, nextVerifiedCount - prevVerifiedCount) * 25;

    setRumorLeads(nextLeads);
    playRumorResolvedSfx(muted);
    setProgress((prev) => {
      const bonusCat = resolvedLead.category || 'geographie';
      const next: ExplorerProgress = {
        ...prev,
        totalXp: prev.totalXp + xpGain,
        xpHistoire: prev.xpHistoire + (bonusCat === 'histoire' ? xpGain : 0),
        xpGeographie: prev.xpGeographie + (bonusCat === 'geographie' ? xpGain : 0),
        xpEcosysteme: prev.xpEcosysteme + (bonusCat === 'ecosysteme' ? xpGain : 0),
        xpEtrange: prev.xpEtrange + (bonusCat === 'etrange' ? xpGain : 0),
        xpLegende: (prev.xpLegende || 0) + (bonusCat === 'legende' ? xpGain : 0),
      };
      if (user) {
        syncProgressToCloud(user.uid, next).catch(() => {});
      }
      return next;
    });
    setCutIn((cur) =>
      cur
        ? cur
        : {
            id: `rumor_done_${resolvedLead.id}`,
            kind: 'mission',
            kicker: 'Piste d’habitant vérifiée sur place !',
            title: resolvedLead.title,
            subtitle: `+${xpGain} XP · Rumeur confiée par ${resolvedLead.giverName} confirmée`,
          }
    );
  }, [playerPos.lat, playerPos.lng, unlockedIds, subterraneanMode, rumorLeads, muted, user]);

  const companionWhisper = useMemo(() => {
    if (loadingSector && pois.length === 0) {
      return '« Je déplie les cartes d’État-Major, mesure le relief et interroge les archives du territoire… »';
    }
    if (nearestUndiscovered && nearestUndiscovered.distance <= 170) {
      const dir = cardinalLabelFr(
        computeBearingDeg(
          playerPos.lat,
          playerPos.lng,
          nearestUndiscovered.poi.lat,
          nearestUndiscovered.poi.lng
        )
      );
      const guild = CATEGORY_META[nearestUndiscovered.poi.category].shortLabel;
      const pAlt =
        playerAltitude !== null
          ? sampleElevationMeters(elevation, nearestUndiscovered.poi.lat, nearestUndiscovered.poi.lng)
          : null;
      const dAlt = pAlt !== null && playerAltitude !== null ? Math.round(pAlt - playerAltitude) : 0;
      const slopeHint =
        dAlt >= 6 ? ` (${dAlt} m plus haut)` : dAlt <= -6 ? ` (${Math.abs(dAlt)} m en contrebas)` : '';
      return `« L’aiguille frémit ! Un sceau de la guilde ${guild} (« ${nearestUndiscovered.poi.mysteryTitle} ») résonne à ${nearestUndiscovered.distance} m vers le ${dir}${slopeHint}. »`;
    }
    if (nearestUndiscovered) {
      const veiledCount = sortedNearbyPois.filter((x) => !x.unlocked).length;
      const bedNote = bedrock ? `Sous nos pas dort le ${bedrock.period} ; ` : '';
      return `« ${bedNote}${veiledCount} lieu${veiledCount > 1 ? 'x' : ''} voilé${
        veiledCount > 1 ? 's' : ''
      } issu${veiledCount > 1 ? 's' : ''} de ${Math.max(
        1,
        sourcesActive.length
      )} archives locales nous entourent. Le plus proche murmure à ${nearestUndiscovered.distance} m. »`;
    }
    if (pois.length > 0) {
      return '« Tous les sceaux visibles de ce filtre ont livré leurs secrets ! Explorez une nouvelle contrée ou changez de strate. »';
    }
    return '« Marchons quelques pas ou choisissons une contrée pour éveiller les échos du Grimoire. »';
  }, [
    loadingSector,
    pois.length,
    nearestUndiscovered,
    playerPos.lat,
    playerPos.lng,
    playerAltitude,
    elevation,
    sortedNearbyPois,
    bedrock,
    sourcesActive.length,
  ]);

  const activeJournalEntry = useMemo(() => {
    if (selectedJournalPoiId) {
      const found = entries.find((e) => e.poiId === selectedJournalPoiId);
      if (found) return found;
    }
    return entries[0] || null;
  }, [entries, selectedJournalPoiId]);

  const activeRumorsCount = useMemo(
    () => rumorLeads.filter((r) => !r.verified).length,
    [rumorLeads]
  );

  const navItems: Array<{ id: ActiveTab; label: string; shortLabel: string; icon: UiPixelIconName }> = [
    { id: 'carte', label: 'Carte 16-Bit', shortLabel: 'Carte', icon: 'map' },
    {
      id: 'carnet',
      label: `Carnet · ${entries.length}`,
      shortLabel: 'Carnet',
      icon: 'book',
    },
    { id: 'missions', label: 'Missions', shortLabel: 'Quêtes', icon: 'scroll' },
    { id: 'branches', label: 'Guildes', shortLabel: 'Guildes', icon: 'shield' },
    { id: 'profil', label: 'Profil', shortLabel: 'Profil', icon: 'user-profile' },
  ];

  const interactiveArchiveSources = useMemo(
    () =>
      sourcesActive.filter(
        (s) =>
          !s.startsWith('Topologie OSM') &&
          !s.startsWith('Macrostrat') &&
          !s.startsWith('Relief Altimétrique') &&
          !s.startsWith('Modèle Numérique de Terrain')
      ),
    [sourcesActive]
  );

  const activeFilterCount =
    (categoryFilter !== 'all' ? 1 : 0) +
    (stratumFilter !== 'all' ? 1 : 0) +
    (sourceFilter !== 'all' ? 1 : 0) +
    (subtleBuildings ? 1 : 0) +
    (!reliefEnabled ? 1 : 0) +
    (!fogEnabled ? 1 : 0) +
    (timeMode !== 'auto' ? 1 : 0);

  // Reusable Selected POI Card Content (used in Desktop Right Folio, Mobile Bottom Sheet & Fullscreen Overlay)
  const renderSelectedPoiCard = (compactSheet = false) => {
    if (!selectedMapPoi) return null;
    const distNow = Math.round(
      haversineMeters(playerPos.lat, playerPos.lng, selectedMapPoi.lat, selectedMapPoi.lng)
    );
    const effectiveRadius =
      selectedMapPoi.unlockRadiusMeters +
      (selectedMapPoi.nearWaterway ? guildPerks.waterwayBonusMeters : 0);
    const isSpectrallyPierced =
      !selectedMapPoiEntry && distNow <= guildPerks.spectralLanternMeters;

    const expeditionStopIndex = expeditionStops.findIndex((s) => s.id === selectedMapPoi.id);
    const isExpeditionStop = expeditionStopIndex !== -1;

    return (
      <div
        className={`relative grimoire-folio-crimson text-[#24160c] ${
          compactSheet
            ? 'p-3.5 sm:p-4 space-y-2.5 max-h-[56dvh] overflow-y-auto overscroll-contain'
            : 'p-5 space-y-4'
        }`}
      >
        <PixelCornerRivets className="bg-[#b91c1c]" />
        <button
          type="button"
          onClick={() => setSelectedPoiId(null)}
          aria-label="Fermer ce signal"
          className="absolute top-2.5 right-2.5 w-9 h-9 flex items-center justify-center bg-[#28160d] text-amber-300 hover:bg-[#991b1b] hover:text-[#fffbeb] border border-[#d97706] transition-colors z-10"
        >
          <PixelUiIcon name="close" className="w-3.5 h-3.5" />
        </button>

        {selectedMapPoiEntry ? (
          <>
            <div className="flex items-start gap-3 pr-10">
              <ResilientPixelImage
                src={CATEGORY_META[selectedMapPoi.category].emblemSrc}
                alt={CATEGORY_META[selectedMapPoi.category].label}
                className={`${
                  compactSheet ? 'w-12 h-12' : 'w-14 h-14'
                } border-2 border-[#2b1a0e] shrink-0`}
              />
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="text-xs font-bold text-rose-900 flex items-center gap-1.5 min-w-0">
                  <PixelGuildIcon category={selectedMapPoi.category} className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {CATEGORY_META[selectedMapPoi.category].shortLabel} · {selectedMapPoi.eraLabel}
                  </span>
                </div>
                <h2
                  className={`${
                    compactSheet ? 'text-base' : 'text-lg'
                  } font-bold font-display text-[#24160c] leading-snug break-words`}
                >
                  {selectedMapPoi.name}
                </h2>
                <div className="text-[11px] text-[#6b4928] font-semibold break-words">
                  Archive : {selectedMapPoi.source}
                </div>
              </div>
            </div>
            <p
              className={`text-xs text-[#3b2312] leading-relaxed break-words ${
                compactSheet ? 'line-clamp-4' : 'line-clamp-5'
              }`}
            >
              {selectedMapPoi.summary}
            </p>
            {!compactSheet && guildPerks.elevationProfileUnlocked && distNow >= 25 && (
              <ElevationProfileStrip
                elevation={elevation}
                fromLat={playerPos.lat}
                fromLng={playerPos.lng}
                toLat={selectedMapPoi.lat}
                toLng={selectedMapPoi.lng}
                distanceMeters={distNow}
              />
            )}
            <div className="flex flex-wrap items-stretch gap-2">
              <button
                type="button"
                onClick={() => openJournalEntry(selectedMapPoi.id)}
                className="flex-1 min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-bold bg-[#991b1b] text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow hover:bg-[#b91c1c] transition-transform duration-150 active:translate-y-0.5 text-center whitespace-nowrap"
              >
                <PixelUiIcon name="book" className="w-4 h-4 shrink-0" />
                <span>Lire au Carnet</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveRiddleEntry(selectedMapPoiEntry)}
                className={`min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow transition-colors text-center whitespace-nowrap ${
                  solvedRiddleIds.has(selectedMapPoiEntry.poiId)
                    ? 'bg-[#ecfdf5] text-emerald-950 border-emerald-800 hover:bg-emerald-100'
                    : 'bg-[#28160d] text-amber-300 border-[#d97706] hover:bg-[#3f2416]'
                }`}
              >
                <PixelUiIcon name="star" className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {solvedRiddleIds.has(selectedMapPoiEntry.poiId)
                    ? 'Sceau d’Or ✓'
                    : 'Énigme (+XP)'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => toggleExpeditionStop(selectedMapPoi)}
                className={`min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow transition-colors text-center whitespace-nowrap ${
                  isExpeditionStop
                    ? 'bg-emerald-800 text-[#fffbeb] hover:bg-emerald-700'
                    : 'bg-[#ecd8b1] text-[#24160c] hover:bg-amber-200'
                }`}
              >
                <PixelUiIcon name="constellation" className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isExpeditionStop
                    ? `Étape ${expeditionStopIndex + 1}/${expeditionStops.length}`
                    : '+ Étape parcours'}
                </span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1 pr-10">
              <div className="text-xs font-bold text-rose-900 flex items-center gap-1.5 min-w-0">
                <PixelGuildIcon category={selectedMapPoi.category} className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {CATEGORY_META[selectedMapPoi.category].shortLabel} · Sceau voilé
                </span>
              </div>
              <h2
                className={`${
                  compactSheet ? 'text-base sm:text-lg' : 'text-xl'
                } font-bold font-display text-[#24160c] leading-snug break-words`}
              >
                ? {selectedMapPoi.mysteryTitle}
              </h2>
              <div className="text-xs font-bold text-amber-900 break-words">
                {selectedMapPoi.eraLabel} · {selectedMapPoi.source}
              </div>
              {isSpectrallyPierced && (
                <div className="text-[11px] font-bold text-sky-900 break-words">
                  Lanterne Spectrale · {selectedMapPoi.subType}
                </div>
              )}
            </div>

            {!compactSheet && (
              <p className="text-xs text-[#3b2312] leading-relaxed break-words">
                Approchez-vous à moins de{' '}
                <strong className="font-mono tabular-nums text-rose-800">{effectiveRadius} m</strong>
                {selectedMapPoi.nearWaterway
                  ? ` (dont +${guildPerks.waterwayBonusMeters} m de résonance hydrologique)`
                  : ''}{' '}
                pour briser le sceau de cire et révéler l’histoire complète au Grimoire.
              </p>
            )}

            {!compactSheet && guildPerks.elevationProfileUnlocked && distNow >= 25 && (
              <ElevationProfileStrip
                elevation={elevation}
                fromLat={playerPos.lat}
                fromLng={playerPos.lng}
                toLat={selectedMapPoi.lat}
                toLng={selectedMapPoi.lng}
                distanceMeters={distNow}
              />
            )}

            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs py-1.5 border-y-2 border-[#c89d62] font-mono tabular-nums">
              <span className="text-[#24160c] font-bold">
                Distance : <span className="text-rose-800">{distNow} m</span> (sceau &lt;{' '}
                {effectiveRadius} m)
              </span>
              {selectedPoiDeltaAlt !== null && Math.abs(selectedPoiDeltaAlt) >= 2 && (
                <span
                  className={`font-bold ${
                    selectedPoiDeltaAlt > 0 ? 'text-amber-900' : 'text-sky-900'
                  }`}
                >
                  {selectedPoiDeltaAlt > 0
                    ? `+${selectedPoiDeltaAlt} m ▲`
                    : `${selectedPoiDeltaAlt} m ▼`}
                </span>
              )}
              <span className="text-emerald-800 font-bold">+{selectedMapPoi.xpReward} XP</span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              {simulationMode && (
                <button
                  type="button"
                  onClick={() => {
                    setRouteRequest({
                      id: Date.now(),
                      lat: selectedMapPoi.lat,
                      lng: selectedMapPoi.lng,
                    });
                    if (compactSheet) setSelectedPoiId(null);
                  }}
                  className="flex-1 min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-bold bg-amber-300 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow hover:bg-amber-200 transition-transform duration-150 active:translate-y-0.5 text-center"
                >
                  <PixelUiIcon name="boot" className="w-4 h-4 shrink-0" />
                  <span>
                    {subterraneanMode ? 'Y marcher (galeries)' : 'Y marcher (rues & ponts)'}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => toggleExpeditionStop(selectedMapPoi)}
                className={`${
                  simulationMode ? '' : 'w-full'
                } min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow transition-colors text-center ${
                  isExpeditionStop
                    ? 'bg-emerald-800 text-[#fffbeb] hover:bg-emerald-700'
                    : 'bg-[#ecd8b1] text-[#24160c] hover:bg-amber-200'
                }`}
              >
                <PixelUiIcon name="constellation" className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isExpeditionStop
                    ? `Étape ${expeditionStopIndex + 1}/${expeditionStops.length}`
                    : '+ Étape parcours'}
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderExpeditionLoopCard = () => {
    if (expeditionStops.length === 0) return null;
    const distLabel =
      expeditionSummary.totalMeters >= 1000
        ? `${(expeditionSummary.totalMeters / 1000).toFixed(1)} km`
        : `${expeditionSummary.totalMeters} m`;

    return (
      <div className="relative grimoire-folio p-3.5 space-y-2.5 text-[#24160c]">
        <PixelCornerRivets className="bg-[#d97706]" />
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-bold font-display inline-flex items-center gap-1.5 min-w-0">
            <PixelUiIcon name="constellation" className="w-4 h-4 shrink-0" />
            <span className="truncate">Parcours multi-étapes ({expeditionStops.length}/5)</span>
          </div>
          <span className="text-[11px] font-mono tabular-nums text-[#54361d] shrink-0">
            {distLabel} · ~{expeditionSummary.estMinutes} min
            {expeditionSummary.elevGainM > 0 ? ` · D+ ${expeditionSummary.elevGainM} m` : ''}
          </span>
        </div>

        <ol className="space-y-1 text-[11px] text-[#3b2312]">
          {expeditionStops.map((stop, idx) => {
            const isKnown = unlockedIds.has(stop.id);
            return (
              <li key={stop.id} className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPoiId(stop.id)}
                  className="text-left font-semibold hover:text-[#991b1b] truncate min-w-0"
                >
                  {idx + 1}. {isKnown ? stop.name : `? ${stop.mysteryTitle}`}
                </button>
                <button
                  type="button"
                  onClick={() => toggleExpeditionStop(stop)}
                  aria-label="Retirer cette étape"
                  className="text-[#6b4928] hover:text-[#991b1b] px-1 py-0.5 shrink-0"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ol>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={launchExpeditionLoop}
            className="flex-1 min-h-[42px] px-3 py-2 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <PixelUiIcon name="boot" className="w-3.5 h-3.5" />
            <span>Lancer le parcours</span>
          </button>
          <button
            type="button"
            onClick={() => setExpeditionStops([])}
            className="min-h-[42px] px-3 py-2 text-xs font-bold bg-[#ecd8b1] hover:bg-[#fffbeb] text-[#24160c] border-2 border-[#6b4928] whitespace-nowrap shrink-0"
          >
            Vider
          </button>
        </div>
      </div>
    );
  };

  // Reusable Tactile 16-Bit D-Pad (zoom-proportional strides + comfortable 44x44px hitboxes on touch!)
  const renderTactileDPad = (compactOverlay = false) => (
    <div
      className={`flex items-center gap-1.5 shrink-0 ${
        compactOverlay ? 'bg-[#28160d]/90 p-1.5 border-2 border-[#d97706] jrpg-shadow' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => {
          setWalkQueue([]);
          stepExplorerByMeters(0, -zoomWalkSteps.manualStepMeters, 'left');
        }}
        aria-label="Marcher vers l’Ouest"
        className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center bg-[#28160d] border-2 border-[#d97706] hover:bg-[#3f2416] active:bg-amber-400 active:text-[#24160c] text-amber-300 jrpg-shadow transition-colors"
      >
        <PixelUiIcon name="arrow-left" className="w-4 h-4" />
      </button>
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => {
            setWalkQueue([]);
            stepExplorerByMeters(zoomWalkSteps.manualStepMeters, 0, 'up');
          }}
          aria-label="Marcher vers le Nord"
          className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center bg-[#28160d] border-2 border-[#d97706] hover:bg-[#3f2416] active:bg-amber-400 active:text-[#24160c] text-amber-300 jrpg-shadow transition-colors"
        >
          <PixelUiIcon name="arrow-up" className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setWalkQueue([]);
            stepExplorerByMeters(-zoomWalkSteps.manualStepMeters, 0, 'down');
          }}
          aria-label="Marcher vers le Sud"
          className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center bg-[#28160d] border-2 border-[#d97706] hover:bg-[#3f2416] active:bg-amber-400 active:text-[#24160c] text-amber-300 jrpg-shadow transition-colors"
        >
          <PixelUiIcon name="arrow-down" className="w-4 h-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          setWalkQueue([]);
          stepExplorerByMeters(0, zoomWalkSteps.manualStepMeters, 'right');
        }}
        aria-label="Marcher vers l’Est"
        className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center bg-[#28160d] border-2 border-[#d97706] hover:bg-[#3f2416] active:bg-amber-400 active:text-[#24160c] text-amber-300 jrpg-shadow transition-colors"
      >
        <PixelUiIcon name="arrow-right" className="w-4 h-4" />
      </button>
    </div>
  );

  // Reusable Mobile & Fullscreen Bottom-Sheet Drawers (Filters, Travel/Search, Signals, iOS Install)
  const renderOverlayDrawers = () => (
    <AnimatePresence>
      {mobileDrawer !== 'none' && (
        <motion.div
          key="overlay-drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={() => setMobileDrawer('none')}
          className="fixed inset-0 z-[70] bg-[#140b05]/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 48, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-xl max-h-[86dvh] grimoire-folio flex flex-col overflow-hidden pb-safe"
          >
            <PixelCornerRivets className="bg-[#f59e0b]" />
            <div className="pixel-frieze w-full shrink-0" aria-hidden="true" />

            {/* Sheet Header */}
            <div className="px-4 py-3 bg-[#ecd8b1] border-b-2 border-[#2b1a0e] flex items-center justify-between gap-3 shrink-0">
              <h2 className="text-sm sm:text-lg font-bold font-display text-[#24160c] flex items-center gap-2 min-w-0 leading-snug">
                <PixelUiIcon
                  name={
                    mobileDrawer === 'filters'
                      ? 'sliders'
                      : mobileDrawer === 'travel'
                      ? 'search'
                      : mobileDrawer === 'signals'
                      ? 'lantern'
                      : 'install'
                  }
                  className="w-4 h-4 shrink-0"
                />
                <span className="break-words">
                  {mobileDrawer === 'filters' && 'Filtres, Guildes & Confort Terrain'}
                  {mobileDrawer === 'travel' && 'Voyage Rapide & Recherche de Lieu'}
                  {mobileDrawer === 'signals' && `Signaux à portée (${sortedNearbyPois.length})`}
                  {mobileDrawer === 'install-app' &&
                    'Installation Android / Mobile (Plein écran)'}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setMobileDrawer('none')}
                aria-label="Fermer le panneau"
                className="w-10 h-10 flex items-center justify-center bg-[#28160d] text-amber-300 hover:bg-[#991b1b] hover:text-[#fffbeb] border-2 border-[#d97706] transition-colors shrink-0"
              >
                <PixelUiIcon name="close" className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Sheet Body */}
            <div className="p-4 overflow-y-auto space-y-4">
              {mobileDrawer === 'filters' && (
                <>
                  {/* Map Rendering, Fog of War, Lighting & Pocket Compass Options */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold font-display text-[#24160c]">
                      Options de la carte 16-bit & confort terrain
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setReliefEnabled((r) => !r)}
                        className={`min-h-[44px] px-2.5 py-2 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center justify-center gap-1.5 text-center leading-tight ${
                          reliefEnabled
                            ? 'bg-amber-300 text-[#24160c]'
                            : 'bg-[#ecd8b1] text-[#54361d]'
                        }`}
                      >
                        <PixelUiIcon name="mountain" className="w-4 h-4 shrink-0" />
                        <span>Relief 16-Bit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubtleBuildings((s) => !s)}
                        className={`min-h-[44px] px-2.5 py-2 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center justify-center gap-1.5 text-center leading-tight ${
                          subtleBuildings
                            ? 'bg-[#28160d] text-amber-300'
                            : 'bg-[#ecd8b1] text-[#54361d]'
                        }`}
                      >
                        <PixelUiIcon name="map" className="w-4 h-4 shrink-0" />
                        <span>Bâti discret</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFogEnabled((f) => !f)}
                        className={`min-h-[44px] px-2.5 py-2 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center justify-center gap-1.5 text-center leading-tight ${
                          fogEnabled
                            ? 'bg-amber-300 text-[#24160c]'
                            : 'bg-[#ecd8b1] text-[#54361d]'
                        }`}
                      >
                        <PixelUiIcon name="map" className="w-4 h-4 shrink-0" />
                        <span>Brouillard ({localExplorationPct}%)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPocketCompassMode((p) => !p)}
                        className={`min-h-[44px] px-2.5 py-2 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center justify-center gap-1.5 text-center leading-tight ${
                          pocketCompassMode
                            ? 'bg-emerald-700 text-[#fffbeb]'
                            : 'bg-[#ecd8b1] text-[#54361d]'
                        }`}
                      >
                        <PixelUiIcon name="pocket-compass" className="w-4 h-4 shrink-0" />
                        <span>Boussole poche</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleScreenAwake}
                        aria-pressed={wakeLockWanted}
                        className={`min-h-[44px] px-2.5 py-2 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center justify-center gap-1.5 text-center leading-tight ${
                          wakeLockWanted
                            ? 'bg-emerald-800 text-amber-200'
                            : 'bg-[#ecd8b1] text-[#54361d]'
                        }`}
                      >
                        <PixelUiIcon name="screen-awake" className="w-4 h-4 shrink-0" />
                        <span>
                          {wakeLockWanted
                            ? wakeLockActive
                              ? 'Écran éveillé ✓'
                              : 'Écran éveillé'
                            : 'Écran éveillé'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleHaptics}
                        aria-pressed={hapticsEnabled}
                        className={`min-h-[44px] px-2.5 py-2 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center justify-center gap-1.5 text-center leading-tight ${
                          hapticsEnabled
                            ? 'bg-emerald-800 text-amber-200'
                            : 'bg-[#ecd8b1] text-[#54361d]'
                        }`}
                      >
                        <PixelUiIcon name="haptic" className="w-4 h-4 shrink-0" />
                        <span>{hapticsEnabled ? 'Haptique actif' : 'Haptique coupé'}</span>
                      </button>
                      {isVibrationSupported() && (
                        <button
                          type="button"
                          onClick={() => vibrateBuriedTreasureHot(true)}
                          className="col-span-2 min-h-[40px] px-3 py-1.5 text-xs font-bold bg-[#f8edd6] hover:bg-amber-200 text-[#24160c] border-2 border-[#6b4928] inline-flex items-center justify-center gap-1.5 text-center leading-snug"
                        >
                          <PixelUiIcon name="haptic" className="w-4 h-4 shrink-0" />
                          <span>Tester la vibration haptique de proximité</span>
                        </button>
                      )}
                      {!isInstalled && (
                        <button
                          type="button"
                          onClick={handleInstallClick}
                          className="col-span-2 min-h-[44px] px-3 py-2 text-xs font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center justify-center gap-1.5 text-center leading-snug"
                        >
                          <PixelUiIcon name="install" className="w-4 h-4 shrink-0" />
                          <span>Installer sur Android / Mobile (Plein écran)</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSubterraneanMode((v) => !v)}
                        className={`col-span-2 min-h-[44px] px-3 py-2 text-xs font-bold border-2 jrpg-shadow inline-flex items-center justify-center gap-1.5 text-center leading-snug ${
                          subterraneanMode
                            ? 'bg-[#1c130d] text-amber-300 border-amber-400'
                            : 'bg-[#ecd8b1] text-[#54361d] border-[#2b1a0e]'
                        }`}
                      >
                        <PixelUiIcon name="dungeon" className="w-4 h-4 shrink-0" />
                        <span>
                          {subterraneanMode
                            ? `Strate Sous-sol active (${subterranean.length} cavités/galeries)`
                            : 'Explorer la strate Sous-sol & Cavités (Donjon 16-bit)'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDashedTracesEnabled((d) => !d)}
                        className={`col-span-2 min-h-[44px] px-3 py-2 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center justify-center gap-1.5 text-center leading-snug ${
                          dashedTracesEnabled
                            ? 'bg-amber-300 text-[#24160c]'
                            : 'bg-[#ecd8b1] text-[#54361d]'
                        }`}
                      >
                        <PixelUiIcon name="constellation" className="w-4 h-4 shrink-0" />
                        <span>
                          {dashedTracesEnabled
                            ? 'Tracés pointillés : Activés'
                            : 'Tracés pointillés : Masqués'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSoundscapeEnabled((s) => !s)}
                        className={`col-span-2 min-h-[44px] px-3 py-2 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center justify-center gap-1.5 text-center leading-snug ${
                          soundscapeEnabled && !muted
                            ? 'bg-emerald-800 text-[#fffbeb]'
                            : 'bg-[#ecd8b1] text-[#54361d]'
                        }`}
                      >
                        <PixelUiIcon
                          name={soundscapeEnabled && !muted ? 'ambience-on' : 'ambience-off'}
                          className="w-4 h-4 shrink-0"
                        />
                        <span>
                          {soundscapeEnabled
                            ? 'Paysage sonore de biome : Activé'
                            : 'Paysage sonore de biome : Coupé'}
                        </span>
                      </button>
                    </div>

                    <div className="pt-1 grid grid-cols-5 gap-1.5">
                      {TIME_MODES_ORDER.map((tm) => (
                        <button
                          key={tm}
                          type="button"
                          onClick={() => setTimeMode(tm)}
                          className={`min-h-[40px] px-1.5 py-1.5 text-[11px] font-bold border-2 border-[#2b1a0e] flex flex-col items-center justify-center gap-0.5 ${
                            timeMode === tm
                              ? 'bg-[#28160d] text-amber-300 jrpg-shadow'
                              : 'bg-[#ecd8b1] text-[#54361d]'
                          }`}
                        >
                          <PixelUiIcon name={TIME_MODE_LABELS[tm].icon} className="w-3.5 h-3.5" />
                          <span>{TIME_MODE_LABELS[tm].short}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Zoom Scale Selector */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold font-display text-[#24160c]">
                      Échelle cartographique
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {ZOOM_LEVELS.map((z) => (
                        <button
                          key={z}
                          type="button"
                          onClick={() => setZoomLevel(z)}
                          className={`min-h-[44px] px-2 py-2 text-xs font-mono font-bold border-2 border-[#2b1a0e] flex flex-col items-center justify-center ${
                            zoomLevel === z
                              ? 'bg-amber-300 text-[#24160c] jrpg-shadow'
                              : 'bg-[#ecd8b1] text-[#54361d]'
                          }`}
                        >
                          <span>{ZOOM_META[z].scaleTag}</span>
                          <span className="text-[10px] font-sans font-semibold truncate max-w-full">
                            {ZOOM_META[z].label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Guild Filter */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold font-display text-[#24160c]">
                      Filtrer par Guilde
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setCategoryFilter('all')}
                        className={`min-h-[44px] px-3 py-2 text-xs font-bold border-2 border-[#2b1a0e] ${
                          categoryFilter === 'all'
                            ? 'bg-[#991b1b] text-[#fffbeb] jrpg-shadow'
                            : 'bg-[#ecd8b1] text-[#54361d]'
                        }`}
                      >
                        Toutes ({archiveFilteredPois.length})
                      </button>
                      {CATEGORY_ORDER.map((catKey) => (
                        <button
                          key={catKey}
                          type="button"
                          onClick={() => setCategoryFilter(catKey)}
                          className={`min-h-[44px] px-3 py-2 text-xs font-bold border-2 border-[#2b1a0e] inline-flex items-center justify-center gap-1.5 ${
                            categoryFilter === catKey
                              ? `bg-amber-300 ${CATEGORY_META[catKey].mapTextClass} jrpg-shadow`
                              : 'bg-[#ecd8b1] text-[#54361d]'
                          }`}
                        >
                          <PixelGuildIcon category={catKey} className="w-4 h-4" />
                          <span className="truncate">{CATEGORY_META[catKey].shortLabel}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stratigraphic Filter */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold font-display text-[#24160c]">
                      Strates temporelles
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setStratumFilter('all')}
                        className={`min-h-[44px] px-3 py-2 text-xs font-bold border-2 ${
                          stratumFilter === 'all'
                            ? 'bg-[#991b1b] text-[#fffbeb] border-[#2b1a0e] jrpg-shadow'
                            : 'bg-[#ecd8b1] text-[#54361d] border-[#8c653b]'
                        }`}
                      >
                        Toutes les époques
                      </button>
                      {(Object.keys(STRATUM_META) as HistoricalStratum[]).map((stKey) => (
                        <button
                          key={stKey}
                          type="button"
                          onClick={() => setStratumFilter(stKey)}
                          className={`min-h-[44px] px-3 py-2 text-xs font-semibold border-2 inline-flex items-center justify-center gap-1.5 ${
                            stratumFilter === stKey
                              ? 'bg-amber-300 text-[#24160c] font-bold border-[#2b1a0e] jrpg-shadow'
                              : 'bg-[#ecd8b1] text-[#54361d] border-[#8c653b]'
                          }`}
                        >
                          <PixelStratumIcon stratum={stKey} className="w-4 h-4" />
                          <span className="truncate">{STRATUM_META[stKey].short}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Archive Sources */}
                  {interactiveArchiveSources.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold font-display text-[#24160c]">
                        Sources patrimoniales & scientifiques ({sourcesActive.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSourceFilter('all')}
                          className={`min-h-[38px] px-3 py-1.5 text-xs font-bold border-2 ${
                            sourceFilter === 'all'
                              ? 'bg-[#991b1b] text-[#fffbeb] border-[#2b1a0e]'
                              : 'bg-[#ecd8b1] text-[#54361d] border-[#8c653b]'
                          }`}
                        >
                          Toutes les sources
                        </button>
                        {interactiveArchiveSources.map((srcName) => (
                          <button
                            key={srcName}
                            type="button"
                            onClick={() =>
                              setSourceFilter((cur) => (cur === srcName ? 'all' : srcName))
                            }
                            className={`min-h-[38px] px-2.5 py-1.5 text-xs font-semibold border-2 ${
                              sourceFilter === srcName
                                ? 'bg-amber-300 text-[#24160c] font-bold border-[#2b1a0e]'
                                : 'bg-[#ecd8b1] text-[#54361d] border-[#8c653b]'
                            }`}
                          >
                            {srcName}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between gap-3 border-t-2 border-[#c89d62]">
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryFilter('all');
                        setStratumFilter('all');
                        setSourceFilter('all');
                        setSubtleBuildings(false);
                        setReliefEnabled(true);
                        setDashedTracesEnabled(false);
                      }}
                      className="min-h-[44px] px-3.5 py-2 text-xs font-bold bg-[#ecd8b1] text-[#24160c] border-2 border-[#6b4928]"
                    >
                      Réinitialiser
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileDrawer('none')}
                      className="min-h-[44px] px-5 py-2 text-xs font-bold bg-[#991b1b] text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow"
                    >
                      Appliquer ({sortedNearbyPois.length} signaux)
                    </button>
                  </div>
                </>
              )}

              {mobileDrawer === 'travel' && (
                <>
                  <form onSubmit={handlePlaceSearch} className="flex items-stretch gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rue, ville, village, rivière, forêt…"
                      className="flex-1 min-h-[44px] bg-[#ecd8b1] border-2 border-[#6b4928] px-3 py-2 text-sm text-[#24160c] placeholder:text-[#78532f] focus:outline-none focus:bg-[#fffdf7] focus:border-[#2b1a0e]"
                    />
                    <button
                      type="submit"
                      disabled={searchingPlace}
                      className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow whitespace-nowrap shrink-0"
                    >
                      <PixelUiIcon name="search" className="w-4 h-4" />
                      <span>{searchingPlace ? '…' : 'Chercher'}</span>
                    </button>
                  </form>

                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      {searchResults.map((res, idx) => (
                        <button
                          key={`${res.lat}_${res.lng}_${idx}`}
                          type="button"
                          onClick={() => teleportToLocation(res.lat, res.lng)}
                          className="w-full min-h-[46px] text-left px-3 py-2.5 text-xs bg-[#ecd8b1] border-2 border-[#6b4928] hover:bg-[#fffbeb] text-[#24160c] font-semibold flex items-center justify-between gap-2"
                        >
                          <span className="line-clamp-2">{res.label}</span>
                          <PixelUiIcon name="cursor" className="w-4 h-4 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2 pt-2 border-t-2 border-[#c89d62]">
                    <div className="text-xs font-bold font-display text-[#24160c]">
                      Contrées d’exploration suggérées
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PRESET_LOCATIONS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => teleportToLocation(preset.lat, preset.lng)}
                          className="min-h-[44px] text-left px-3 py-2 text-xs font-semibold bg-[#ecd8b1] border-2 border-[#8c653b] hover:bg-amber-200 hover:border-[#2b1a0e] text-[#24160c] flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{preset.label}</span>
                          <PixelUiIcon name="map" className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t-2 border-[#c89d62] flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveCurrentSectorToBesace()}
                      className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-[#ecd8b1] hover:bg-[#fffbeb] border-2 border-[#2b1a0e] text-[#24160c] jrpg-shadow"
                    >
                      <PixelUiIcon name="backpack" className="w-4 h-4" />
                      <span>Mettre en besace hors-ligne</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        fetchSector(playerPos.lat, playerPos.lng, true);
                        setMobileDrawer('none');
                      }}
                      disabled={loadingSector}
                      className="min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold bg-amber-300 border-2 border-[#2b1a0e] text-[#24160c] jrpg-shadow"
                    >
                      <PixelUiIcon name="radar" className="w-4 h-4" />
                      <span>{loadingSector ? 'Sondage…' : 'Sonder le secteur'}</span>
                    </button>
                  </div>
                  {besaceToast && (
                    <div className="p-2 bg-emerald-100 border-2 border-emerald-800 text-xs font-bold text-emerald-950">
                      {besaceToast}
                    </div>
                  )}
                </>
              )}

              {mobileDrawer === 'signals' && (
                <div className="space-y-2.5">
                  <TelluricDetectorCard
                    playerLat={playerPos.lat}
                    playerLng={playerPos.lng}
                    subterraneanMode={subterraneanMode}
                    simulationMode={simulationMode}
                    muted={muted}
                    worldChests={worldChests}
                    openedChestIds={openedChestIdSet}
                    nearbyGeocaches={mergedNearbyGeocaches}
                    foundGeocacheIds={foundGeocacheIds}
                    unlockedEntries={entries}
                    currentUserId={user ? user.uid : null}
                    onOpenArchivistChest={(ch) => {
                      setMobileDrawer('none');
                      handleOpenArchivistChest(ch);
                    }}
                    onFocusMapTarget={handleFocusTreasureTargetOnMap}
                    onOpenBuryModal={() => {
                      setMobileDrawer('none');
                      setGeocacheModal({ mode: 'bury' });
                    }}
                    onInspectGeocache={(c) => {
                      setMobileDrawer('none');
                      setGeocacheModal({ mode: 'inspect', cache: c });
                    }}
                    onOpenReliquaryTab={() => {
                      setMobileDrawer('none');
                      if (isFullscreenMap) exitFullscreenMap();
                      setCarnetView('tresors');
                      setActiveTab('carnet');
                    }}
                  />
                  {renderExpeditionLoopCard()}
                  {sortedNearbyPois.length === 0 ? (
                    <p className="text-xs text-[#6b4928] py-6 text-center">
                      Aucun signal pour cette combinaison de filtre.
                    </p>
                  ) : (
                    sortedNearbyPois.slice(0, 26).map(({ poi, distance, unlocked }) => {
                      const cat = CATEGORY_META[poi.category];
                      const isSel = selectedPoiId === poi.id;
                      const isHot = !unlocked && distance <= poi.unlockRadiusMeters * 1.7;
                      return (
                        <button
                          key={poi.id}
                          type="button"
                          onClick={() => {
                            setSelectedPoiId(poi.id);
                            setMobileDrawer('none');
                          }}
                          className={`w-full min-h-[54px] text-left px-3 py-2.5 border-2 space-y-1 ${
                            isSel
                              ? 'bg-amber-200/90 border-[#991b1b]'
                              : 'bg-[#ecd8b1] border-[#8c653b] hover:bg-[#fffbeb]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <PixelGuildIcon category={poi.category} className="w-4 h-4" />
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-[#24160c] truncate">
                                  {unlocked ? poi.name : `? ${poi.mysteryTitle}`}
                                </div>
                                <div className="text-[11px] text-[#54361d] truncate">
                                  <span className={`font-bold ${cat.mapTextClass}`}>
                                    {cat.shortLabel}
                                  </span>{' '}
                                  · {poi.source}
                                </div>
                              </div>
                            </div>
                            <span
                              className={`text-xs font-mono tabular-nums font-bold shrink-0 ${
                                unlocked
                                  ? 'text-emerald-800'
                                  : isHot
                                  ? 'text-rose-800'
                                  : 'text-[#3b2312]'
                              }`}
                            >
                              {distance} m
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {mobileDrawer === 'install-app' && (
                <div className="space-y-3.5 text-sm text-[#2b1a0e]">
                  <p className="text-xs sm:text-sm leading-relaxed">
                    Installez <strong>Terra 16</strong> comme application native plein écran sans
                    barre d’adresse, avec gestion propre des encoches Android, mode{' '}
                    <strong>Écran Éveillé</strong> et <strong>vibrations haptiques</strong> en
                    marchant.
                  </p>

                  {isInstallable && (
                    <button
                      type="button"
                      onClick={async () => {
                        const accepted = await promptInstall();
                        if (accepted) setMobileDrawer('none');
                      }}
                      className="w-full min-h-[48px] px-4 py-2.5 text-sm font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center justify-center gap-2"
                    >
                      <PixelUiIcon name="install" className="w-4 h-4" />
                      <span>Installer Terra 16 maintenant (1 clic)</span>
                    </button>
                  )}

                  {isEmbeddedIframe && (
                    <div className="p-3 bg-amber-100 border-2 border-[#d97706] space-y-2 text-xs">
                      <p className="font-semibold text-[#24160c]">
                        Vous consultez actuellement l’aperçu intégré : ouvrez le lien direct dans{' '}
                        <strong>Chrome sur Android</strong> pour déclencher l’installation native en
                        un clic.
                      </p>
                      <button
                        type="button"
                        onClick={handleCopyDirectAppUrl}
                        className="min-h-[42px] px-3.5 py-2 font-bold bg-[#28160d] text-amber-300 hover:bg-[#3f2416] border-2 border-[#d97706] inline-flex items-center gap-2"
                      >
                        <PixelUiIcon name="install" className="w-3.5 h-3.5" />
                        <span>
                          {urlCopiedNotice
                            ? 'Lien direct copié dans le presse-papiers ✓'
                            : 'Copier le lien direct de l’application'}
                        </span>
                      </button>
                    </div>
                  )}

                  {!isIOS ? (
                    <div className="space-y-2 bg-[#ecd8b1] border-2 border-[#6b4928] p-3.5 text-xs">
                      <div className="font-bold font-display text-sm text-[#24160c]">
                        Sur Android (Chrome ou APK PWABuilder)
                      </div>
                      <ol className="space-y-1.5 font-semibold list-decimal list-inside">
                        <li>
                          Dans Chrome Android, touchez le bouton <strong>Installer</strong> ci-dessus
                          ou le menu <strong>⋮ → Installer l’application</strong>.
                        </li>
                        <li>
                          Lancez <strong>Terra 16</strong> depuis votre tiroir d’applications :
                          affichage 100 % plein écran sans barre d’adresse et encoches respectées.
                        </li>
                        <li>
                          Pour générer un paquet <strong>APK / AAB Google Play</strong>, collez
                          simplement l’URL publique de l’application dans{' '}
                          <span className="font-mono font-bold">pwabuilder.com</span> (manifeste et
                          captures calibrés).
                        </li>
                      </ol>
                    </div>
                  ) : (
                    <div className="space-y-2 bg-[#ecd8b1] border-2 border-[#6b4928] p-3.5 text-xs">
                      <div className="font-bold font-display text-sm text-[#24160c]">
                        Sur iPhone ou iPad (Safari)
                      </div>
                      <ol className="space-y-1.5 font-semibold list-decimal list-inside">
                        <li>
                          Touchez le bouton <strong>Partager</strong> dans la barre de Safari.
                        </li>
                        <li>
                          Choisissez <strong>« Sur l’écran d’accueil »</strong> puis validez{' '}
                          <strong>Ajouter</strong>.
                        </li>
                        <li>
                          Ouvrez l’icône 16-bit <strong>Terra 16</strong> en plein écran intégral.
                        </li>
                      </ol>
                    </div>
                  )}

                  <div className="pt-2 border-t-2 border-[#c89d62] space-y-2">
                    <div className="text-xs font-bold font-display text-[#24160c]">
                      Réglages rapides « Confort Terrain Mobile »
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleToggleScreenAwake}
                        aria-pressed={wakeLockWanted}
                        className={`min-h-[44px] px-3 py-2 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center justify-center gap-1.5 ${
                          wakeLockWanted
                            ? 'bg-emerald-800 text-amber-200'
                            : 'bg-[#ecd8b1] text-[#54361d]'
                        }`}
                      >
                        <PixelUiIcon name="screen-awake" className="w-4 h-4" />
                        <span>
                          {wakeLockWanted
                            ? 'Écran éveillé : Activé'
                            : wakeLockSupported
                            ? 'Activer Écran éveillé'
                            : 'Écran éveillé (selon navigateur)'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleHaptics}
                        aria-pressed={hapticsEnabled}
                        className={`min-h-[44px] px-3 py-2 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center justify-center gap-1.5 ${
                          hapticsEnabled
                            ? 'bg-emerald-800 text-amber-200'
                            : 'bg-[#ecd8b1] text-[#54361d]'
                        }`}
                      >
                        <PixelUiIcon name="haptic" className="w-4 h-4" />
                        <span>
                          {hapticsEnabled
                            ? 'Vibrations proximité : Activées'
                            : 'Activer vibrations haptiques'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderPostcardModal = () =>
    postcardSubject ? (
      <Suspense fallback={null}>
        <LazyPostcardStudioModal
          subject={postcardSubject}
          appearance={explorerAppearance}
          progress={progress}
          localityName={localAtmosphereLabel}
          bedrock={bedrock}
          altitudeMeters={sampleElevationMeters(elevation, playerPos.lat, playerPos.lng)}
          effectiveTime={resolveEffectiveTimeOfDay(timeMode, weather)}
          weather={weather}
          muted={muted}
          unlockedTrophyIds={unlockedTrophyIds}
          onPinTrophy={handlePinTrophy}
          onClose={() => setPostcardSubject(null)}
        />
      </Suspense>
    ) : null;

  const renderGeocacheModal = () =>
    geocacheModal ? (
      <Suspense fallback={null}>
        <LazyGeocacheModal
          mode={geocacheModal.mode}
          cache={geocacheModal.mode === 'inspect' ? geocacheModal.cache : null}
          playerLat={playerPos.lat}
          playerLng={playerPos.lng}
          subterraneanMode={subterraneanMode}
          simulationMode={simulationMode}
          currentRegionLabel={localAtmosphereLabel}
          muted={muted}
          currentUser={cloudOnline ? user : null}
          cloudOnline={cloudOnline}
          explorerCallsign={progress.displayName}
          explorerAppearance={explorerAppearance}
          openedChests={openedChests}
          specimens={specimens}
          unlockedEntries={entries}
          foundGeocacheIds={foundGeocacheIds}
          onClose={() => setGeocacheModal(null)}
          onRequestGoogleSignIn={handleAuthAction}
          onFocusMapTarget={handleFocusTreasureTargetOnMap}
          onClaimGeocacheDiscovery={handleClaimGeocacheDiscovery}
          onLocalCacheUpserted={(savedCache) => {
            if (savedCache.id.startsWith('local_')) {
              setLocalFallbackGeocaches((prev) => [
                savedCache,
                ...prev.filter((c) => c.id !== savedCache.id),
              ]);
            } else {
              setCloudGeocaches((prev) => [
                savedCache,
                ...prev.filter((c) => c.id !== savedCache.id),
              ]);
            }
          }}
          onLocalCacheDeleted={(cacheId) => {
            setLocalFallbackGeocaches((prev) => prev.filter((c) => c.id !== cacheId));
            setCloudGeocaches((prev) => prev.filter((c) => c.id !== cacheId));
          }}
        />
      </Suspense>
    ) : null;

  const renderRiddleModal = () => (
    <AnimatePresence>
      {activeRiddle && (
        <ContextualRiddleModal
          key={activeRiddle.riddleId}
          riddle={activeRiddle}
          alreadySolved={solvedRiddleIds.has(activeRiddle.poiId)}
          solvedRiddlesTotal={Math.max(progress.solvedRiddlesCount || 0, solvedRiddleIds.size)}
          muted={muted}
          onSolve={handleSolveContextualRiddle}
          onOpenCosmeticWorkshop={(slot) => openWorkshopAtSlot(slot || 'familiar')}
          onClose={() => setActiveRiddleEntry(null)}
        />
      )}
    </AnimatePresence>
  );

  // ==========================================================================
  // IMMERSIVE 100dvh FULLSCREEN MAP MODE (Desktop, Smartphone & AI Studio Iframe)
  // ==========================================================================
  if (isFullscreenMap) {
    return (
      <div className="fixed inset-0 z-50 w-screen h-[100dvh] bg-[#1c1009] flex flex-col overflow-hidden">
        <div className="relative flex-1 min-h-0 w-full">
          <PixelMapCanvas
            playerLat={playerPos.lat}
            playerLng={playerPos.lng}
            pois={archiveFilteredPois}
            surfacePois={surfacePois}
            subterraneanPois={subterraneanPois}
            terrain={terrain}
            subterranean={subterranean}
            bedrock={bedrock}
            subterraneanMode={subterraneanMode}
            onToggleSubterraneanMode={() => setSubterraneanMode((v) => !v)}
            elevation={elevation}
            reliefEnabled={reliefEnabled}
            unlockedIds={unlockedIds}
            selectedPoiId={selectedPoiId}
            simulationMode={simulationMode}
            isWalking={walkQueue.length > 0 || manualWalkPulse}
            facingDir={facingDir}
            zoomLevel={zoomLevel}
            subtleBuildings={subtleBuildings}
            categoryFilter={categoryFilter}
            stratumFilter={stratumFilter}
            immersiveFullscreen
            uiCollapsed={uiCollapsed}
            onToggleUiCollapsed={() => setUiCollapsed((v) => !v)}
            weather={weather}
            timeMode={timeMode}
            fogEnabled={fogEnabled}
            fogSet={fogSet}
            fogVisionMeters={95 + guildPerks.fogVisionBonusMeters}
            outfitId={progress.outfitId || 'arpenteur'}
            explorerAppearance={explorerAppearance}
            chroniqueurThreads={guildPerks.chroniqueurThreads}
            dashedTracesEnabled={dashedTracesEnabled}
            spectralLanternMeters={guildPerks.spectralLanternMeters}
            breadcrumbTrail={breadcrumbTrail}
            plannedRoute={walkQueue}
            routeRequest={routeRequest}
            muted={muted}
            onToggleFullscreen={toggleFullscreenMap}
            onChangeZoom={setZoomLevel}
            onSelectPoi={(poi) => setSelectedPoiId(poi.id)}
            onMapDestinationClick={(lat, lng) => setWalkQueue([{ lat, lng }])}
            onPlanWalkRoute={(waypoints) => setWalkQueue(waypoints)}
            onPlayerSurfaceChange={handlePlayerSurfaceChange}
            rumorLeads={rumorLeads}
            onNpcInteract={handleNpcInteract}
            onAcceptRumor={handleAcceptRumor}
            harvestedNodeIds={harvestedSpecimenNodes}
            onHarvestSpecimen={handleHarvestSpecimen}
            onOpenNpcPostcard={handleOpenNpcPostcard}
            worldChests={worldChests}
            openedChestIds={openedChestIdSet}
            onOpenArchivistChest={handleOpenArchivistChest}
            nearbyGeocaches={mergedNearbyGeocaches}
            foundGeocacheIds={foundGeocacheIds}
            currentUserId={user ? user.uid : null}
            onInspectGeocache={(cache) => setGeocacheModal({ mode: 'inspect', cache })}
          />

          {/* Discovery Cut-In Banner inside Fullscreen */}
          <AnimatePresence>
            {cutIn && (
              <motion.div
                key={cutIn.id}
                initial={{ opacity: 0, y: -24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -24 }}
                className="absolute top-[3.5rem] left-2.5 right-2.5 sm:left-auto sm:right-4 sm:w-[440px] z-30 grimoire-folio-crimson p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-2.5"
              >
                <PixelCornerRivets className="bg-[#b91c1c]" />
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  {cutIn.unlockedTrophyId && (
                    <div className="p-1 bg-[#28160d] border-2 border-[#d97706] shrink-0">
                      <TrophyBadgeCanvas
                        trophyId={cutIn.unlockedTrophyId}
                        unlocked
                        pixelScale={2}
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-rose-800 break-words">{cutIn.kicker}</div>
                    <div className="text-sm sm:text-base font-bold font-display text-[#24160c] leading-snug break-words">
                      {cutIn.title}
                    </div>
                    <div className="text-xs font-semibold text-[#5c4028] break-words">{cutIn.subtitle}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5 w-full sm:w-auto shrink-0">
                  {cutIn.poiId && (
                    <button
                      type="button"
                      onClick={() => {
                        const pid = cutIn.poiId!;
                        setCutIn(null);
                        openJournalEntry(pid);
                      }}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-bold bg-[#991b1b] text-[#fffbeb] border-2 border-[#2b1a0e] whitespace-nowrap"
                    >
                      Lire
                    </button>
                  )}
                  {cutIn.unlockedTrophyId && (
                    <button
                      type="button"
                      onClick={() => {
                        setCutIn(null);
                        exitFullscreenMap();
                        setProfileInitialTab('trophees');
                        setActiveTab('profil');
                      }}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-bold bg-amber-300 text-[#24160c] border-2 border-[#2b1a0e] whitespace-nowrap"
                    >
                      Médaillier
                    </button>
                  )}
                  {cutIn.unlockedCosmeticName && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetSlot = cutIn.unlockedCosmeticSlot || 'familiar';
                        setCutIn(null);
                        openWorkshopAtSlot(targetSlot);
                      }}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-bold bg-amber-300 text-[#24160c] border-2 border-[#2b1a0e] whitespace-nowrap"
                    >
                      {cutIn.unlockedCosmeticSlot === 'familiar' ? 'Adopter' : 'Équiper'}
                    </button>
                  )}
                  {cutIn.openReliquary && (
                    <button
                      type="button"
                      onClick={() => {
                        setCutIn(null);
                        exitFullscreenMap();
                        setCarnetView('tresors');
                        setActiveTab('carnet');
                      }}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-bold bg-amber-300 text-[#24160c] border-2 border-[#2b1a0e] whitespace-nowrap"
                    >
                      Reliquaire
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCutIn(null)}
                    aria-label="Fermer l’alerte"
                    className="w-10 h-10 flex items-center justify-center bg-[#28160d] text-amber-300 border-2 border-[#2b1a0e]"
                  >
                    <PixelUiIcon name="close" className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Selected POI Sheet floating cleanly above the Fullscreen Bottom HUD */}
          <AnimatePresence>
            {selectedMapPoi && (
              <motion.div
                key={selectedMapPoi.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.16 }}
                className={`absolute left-2.5 right-2.5 sm:left-4 sm:right-auto sm:w-[400px] z-20 ${
                  uiCollapsed
                    ? 'bottom-[max(0.75rem,env(safe-area-inset-bottom))]'
                    : 'bottom-[calc(4.5rem+env(safe-area-inset-bottom))]'
                }`}
              >
                {renderSelectedPoiCard(true)}
              </motion.div>
            )}
          </AnimatePresence>

          {/* On-Demand Tactile D-Pad in Bottom-Right Thumb Corner when unfolded */}
          {!uiCollapsed && simulationMode && dpadOpen && !selectedMapPoi && (
            <div className="absolute right-2.5 sm:right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20">
              {renderTactileDPad(true)}
            </div>
          )}

          {/* Fullscreen Bottom 16-Bit HUD Strip (Hidden when UI is folded!) */}
          {!uiCollapsed && (
            <div className="absolute inset-x-0 bottom-0 z-20 grimoire-bottom-dock px-2 sm:px-4 py-1.5 sm:py-2 pb-safe flex items-center justify-between gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSimulationMode((s) => !s)}
                  aria-label={simulationMode ? 'Passer en GPS Réel' : 'Passer en Marche Simulée'}
                  className={`min-h-[42px] min-w-[42px] px-2 sm:px-3 py-1.5 text-xs font-bold border-2 border-[#2b1a0e] inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                    simulationMode
                      ? 'bg-amber-300 text-[#24160c]'
                      : 'bg-[#991b1b] text-[#fffbeb]'
                  }`}
                >
                  <PixelUiIcon name={simulationMode ? 'boot' : 'gps'} className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">
                    {simulationMode ? 'Simulé' : 'GPS Réel'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMobileDrawer('filters')}
                  className="min-h-[42px] px-2 sm:px-3 py-1.5 text-xs font-bold bg-[#f8edd6] hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <PixelUiIcon name="sliders" className="w-4 h-4 shrink-0" />
                  <span>Filtres</span>
                  {activeFilterCount > 0 && (
                    <span className="px-1 py-0.5 text-[10px] font-mono bg-[#991b1b] text-[#fffbeb]">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setMobileDrawer('travel')}
                  aria-label="Voyage rapide et recherche"
                  className="min-h-[42px] min-w-[42px] sm:min-w-0 px-2 sm:px-3 py-1.5 text-xs font-bold bg-[#f8edd6] hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <PixelUiIcon name="search" className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Voyage</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMobileDrawer('signals')}
                  aria-label={`Signaux à portée (${sortedNearbyPois.length})`}
                  className="min-h-[42px] px-2 sm:px-3 py-1.5 text-xs font-bold bg-[#f8edd6] hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <PixelUiIcon name="lantern" className="w-4 h-4 shrink-0" />
                  <span className="font-mono">{sortedNearbyPois.length}</span>
                </button>

                {simulationMode && (
                  <button
                    type="button"
                    onClick={() => setDpadOpen((v) => !v)}
                    title={dpadOpen ? 'Replier le D-Pad' : 'Déplier le D-Pad'}
                    aria-label={dpadOpen ? 'Replier le D-Pad' : 'Déplier le D-Pad'}
                    className={`min-h-[42px] min-w-[42px] sm:min-w-0 px-2 sm:px-2.5 py-1.5 text-xs font-bold border-2 border-[#2b1a0e] inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                      dpadOpen
                        ? 'bg-amber-300 text-[#24160c]'
                        : 'bg-[#f8edd6] hover:bg-amber-200 text-[#24160c]'
                    }`}
                  >
                    <PixelUiIcon name="dpad" className="w-4 h-4 shrink-0" />
                    <span className="hidden md:inline">D-Pad</span>
                  </button>
                )}
              </div>

              {/* Live Compass Target Pill on Fullscreen HUD */}
              {compassTarget && (
                <button
                  type="button"
                  onClick={() => setSelectedPoiId(compassTarget.poi.id)}
                  className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 bg-[#f8edd6] border-2 border-[#d97706] text-xs text-[#24160c] min-w-0 max-w-xs"
                >
                  <span className="font-mono font-bold text-rose-900 shrink-0">
                    {cardinalShortFr(compassTarget.bearingDeg)} · {compassTarget.distance} m
                  </span>
                  <span className="font-bold truncate">
                    {compassTarget.unlocked
                      ? compassTarget.poi.name
                      : `? ${compassTarget.poi.mysteryTitle}`}
                  </span>
                </button>
              )}

              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleToggleScreenAwake}
                  aria-pressed={wakeLockWanted}
                  title={
                    wakeLockWanted
                      ? 'Mode Écran Éveillé actif (empêche le verrouillage en marche) — cliquer pour désactiver'
                      : 'Activer le Mode Écran Éveillé (Screen Wake Lock)'
                  }
                  aria-label="Basculer le mode Écran Éveillé"
                  className={`hidden md:flex w-10 h-10 items-center justify-center border-2 border-[#2b1a0e] transition-colors ${
                    wakeLockWanted
                      ? 'bg-emerald-900 text-amber-200'
                      : 'bg-[#f8edd6] text-[#24160c] hover:bg-amber-200'
                  }`}
                >
                  <PixelUiIcon name="screen-awake" className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={cycleTimeMode}
                  title={`Lumière : ${TIME_MODE_LABELS[timeMode].label}`}
                  className="hidden md:flex w-10 h-10 items-center justify-center bg-[#f8edd6] border-2 border-[#2b1a0e] text-[#24160c]"
                >
                  <PixelUiIcon name={TIME_MODE_LABELS[timeMode].icon} className="w-4 h-4" />
                </button>
                <div
                  className="flex items-center border-2 border-[#2b1a0e] bg-[#f8edd6]"
                  role="group"
                  aria-label="Contrôles audio"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (muted && !soundscapeEnabled) setMuted(false);
                      setSoundscapeEnabled((s) => !s);
                    }}
                    title={
                      soundscapeEnabled
                        ? 'Couper le paysage sonore d’ambiance'
                        : 'Activer le paysage sonore d’ambiance par biome'
                    }
                    aria-label="Basculer l’ambiance sonore par biome"
                    className={`hidden md:flex w-10 h-10 items-center justify-center transition-colors ${
                      soundscapeEnabled && !muted
                        ? 'bg-emerald-900 text-amber-200'
                        : 'text-[#24160c] hover:bg-amber-200'
                    }`}
                  >
                    <PixelUiIcon
                      name={soundscapeEnabled && !muted ? 'ambience-on' : 'ambience-off'}
                      className="w-4 h-4"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMuted((m) => !m)}
                    title={muted ? 'Activer les effets sonores' : 'Couper tout l’audio'}
                    aria-label={muted ? 'Activer le son' : 'Couper le son'}
                    className={`w-[42px] h-[42px] md:w-10 md:h-10 flex items-center justify-center md:border-l-2 border-[#2b1a0e] transition-colors ${
                      muted
                        ? 'bg-[#3f2416] text-amber-300/75'
                        : 'text-[#24160c] hover:bg-amber-200'
                    }`}
                  >
                    <PixelUiIcon name={muted ? 'sound-off' : 'sound-on'} className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={exitFullscreenMap}
                  aria-label="Quitter le mode plein écran"
                  className="min-h-[42px] min-w-[42px] px-2.5 sm:px-3 py-1.5 text-xs font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-amber-400 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <PixelUiIcon name="fullscreen-exit" className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Quitter</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Fullscreen Journal Entry Codex Modal (read & annotate without leaving fullscreen!) */}
        <AnimatePresence>
          {fullscreenModalEntry && (
            <motion.div
              key="fullscreen-codex-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFullscreenModalPoiId(null)}
              className="fixed inset-0 z-[75] bg-[#140b05]/80 flex items-center justify-center p-2 sm:p-6 overflow-y-auto"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-3xl max-h-[92dvh] overflow-y-auto"
              >
                <Suspense
                  fallback={
                    <div className="grimoire-folio p-6 text-center text-xs font-bold text-[#24160c]">
                      Ouverture du feuillet enluminé…
                    </div>
                  }
                >
                  <LazyEntryDetailPanel
                    entry={fullscreenModalEntry}
                    unlockedIds={unlockedIds}
                    explorerCallsign={progress.displayName}
                    explorerAppearance={explorerAppearance}
                    pinnedTrophyId={progress.pinnedTrophyId}
                    altitudeMeters={sampleElevationMeters(
                      elevation,
                      fullscreenModalEntry.lat,
                      fullscreenModalEntry.lng
                    )}
                    currentUser={cloudOnline ? user : null}
                    muted={muted}
                    onRequestCloudSignIn={handleAuthAction}
                    onSaveJournalAnnotation={handleSaveJournalAnnotation}
                    onNavigateToRelatedPoi={handleNavigateToRelatedPoi}
                    onOpenPostcard={setPostcardSubject}
                    isRiddleSolved={solvedRiddleIds.has(fullscreenModalEntry.poiId)}
                    onOpenRiddle={(entry) => setActiveRiddleEntry(entry)}
                    onBackToList={() => setFullscreenModalPoiId(null)}
                    backLabel="Retour à la carte plein écran"
                  />
                </Suspense>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {renderOverlayDrawers()}
        {renderPostcardModal()}
        {renderGeocacheModal()}
        {renderRiddleModal()}
      </div>
    );
  }

  const isMapUiFolded = activeTab === 'carte' && uiCollapsed;

  return (
    <div
      className={`min-h-[100dvh] flex flex-col ${
        activeTab === 'carte' ? 'max-lg:h-[100dvh] max-lg:overflow-hidden' : ''
      } ${isMapUiFolded ? 'h-[100dvh] overflow-hidden' : ''}`}
    >
      {/* Top Embossed Mahogany Leather Grimoire Spine (Hidden when UI is folded on Map!) */}
      {!isMapUiFolded && (
        <>
          <header className="grimoire-spine sticky top-0 z-30 flex items-center justify-between gap-2 sm:gap-6 px-2.5 sm:px-6 py-2 sm:py-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('carte')}
              className="inline-flex items-center gap-1.5 sm:gap-2 text-base sm:text-2xl font-bold font-display tracking-wide text-amber-300 hover:text-amber-200 transition-colors whitespace-nowrap shrink-0"
            >
              <PixelUiIcon name="lantern" className="w-5 h-5 lantern-breathe shrink-0" />
              <span>Terra 16</span>
            </button>

            {/* Desktop 5-Tab Navigation */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#f3dfc1]">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.id === 'carnet') playJournalOpenSfx(muted);
                      setActiveTab(item.id);
                    }}
                    className={`relative py-1 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                      isActive ? 'text-amber-300' : 'hover:text-[#fffbeb]'
                    }`}
                  >
                    <PixelUiIcon name={item.icon} className="w-4 h-4" />
                    <span className="font-display text-base">{item.label}</span>
                    {isActive && (
                      <motion.span
                        layoutId="activeNavUnderline"
                        transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                        className="absolute left-0 right-0 -bottom-1 h-0.5 bg-[#f59e0b]"
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right Actions: Consolidated Segmented Audio [Ambiance | Son], Install App (if eligible), Cloud Auth */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div
                className="flex items-center border-2 border-[#d97706] bg-[#3f2416] jrpg-shadow shrink-0"
                role="group"
                aria-label="Réglages audio"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (muted && !soundscapeEnabled) setMuted(false);
                    setSoundscapeEnabled((s) => !s);
                  }}
                  title={
                    soundscapeEnabled && !muted
                      ? 'Paysage sonore de biome activé (vent, eau vive, oiseaux, grottes) — cliquer pour couper'
                      : 'Activer le paysage sonore d’ambiance par biome'
                  }
                  aria-label="Basculer le paysage sonore d’ambiance"
                  className={`hidden sm:flex min-h-[38px] px-2.5 items-center justify-center gap-1.5 text-xs font-bold transition-colors ${
                    soundscapeEnabled && !muted
                      ? 'bg-emerald-900 text-amber-200 hover:bg-emerald-800'
                      : 'text-amber-300/75 hover:bg-[#54301d] hover:text-amber-200'
                  }`}
                >
                  <PixelUiIcon
                    name={soundscapeEnabled && !muted ? 'ambience-on' : 'ambience-off'}
                    className="w-4 h-4"
                  />
                  <span className="hidden xl:inline">Ambiance</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  title={muted ? 'Réactiver l’audio' : 'Couper tout l’audio'}
                  aria-label={muted ? 'Activer les effets sonores' : 'Couper le son'}
                  className={`min-h-[36px] min-w-[36px] sm:min-h-[38px] sm:min-w-[38px] px-2 flex items-center justify-center sm:border-l-2 border-[#d97706] transition-colors ${
                    muted
                      ? 'bg-[#28160d] text-amber-300/60 hover:text-amber-200'
                      : 'text-amber-300 hover:bg-[#54301d]'
                  }`}
                >
                  <PixelUiIcon name={muted ? 'sound-off' : 'sound-on'} className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleToggleScreenAwake}
                aria-pressed={wakeLockWanted}
                title={
                  wakeLockWanted
                    ? wakeLockActive
                      ? 'Mode Écran Éveillé actif (Screen Wake Lock engagé) — cliquer pour relâcher'
                      : 'Mode Écran Éveillé armé (se réactive dès que l’onglet est au premier plan)'
                    : 'Activer le Mode Écran Éveillé en 1 clic pour marcher sans verrouillage d’écran'
                }
                aria-label="Basculer le mode Écran Éveillé"
                className={`min-h-[36px] min-w-[36px] sm:min-h-[38px] sm:min-w-[38px] px-2 sm:px-2.5 py-1.5 text-xs font-bold border-2 border-[#d97706] inline-flex items-center justify-center gap-1.5 jrpg-shadow whitespace-nowrap shrink-0 transition-colors ${
                  wakeLockWanted
                    ? 'bg-emerald-900 text-amber-200 hover:bg-emerald-800'
                    : 'bg-[#3f2416] text-amber-300/85 hover:bg-[#54301d] hover:text-amber-200'
                }`}
              >
                <PixelUiIcon name="screen-awake" className="w-4 h-4" />
                <span className="hidden xl:inline">
                  {wakeLockWanted ? 'Écran éveillé' : 'Veille auto'}
                </span>
              </button>

              {!isInstalled && (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  title="Installer Terra 16 sur Android / Mobile en plein écran"
                  aria-label="Installer l’application sur Android ou Mobile"
                  className={`min-h-[36px] min-w-[36px] sm:min-h-[38px] px-2 sm:px-2.5 py-1.5 text-xs font-bold border-2 border-[#d97706] inline-flex items-center justify-center gap-1.5 jrpg-shadow whitespace-nowrap shrink-0 transition-colors ${
                    isInstallable || isAndroid
                      ? 'bg-amber-300 text-[#24160c] hover:bg-amber-200'
                      : 'bg-[#3f2416] text-amber-300 hover:bg-[#54301d]'
                  }`}
                >
                  <PixelUiIcon name="install" className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">
                    {isAndroid ? 'Installer Android' : 'Installer'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleAuthAction}
                className="min-h-[36px] sm:min-h-[38px] px-2.5 sm:px-3.5 py-1.5 text-xs font-bold bg-[#991b1b] text-[#fffbeb] border-2 border-amber-400 hover:bg-[#b91c1c] transition-transform duration-150 active:translate-y-0.5 jrpg-shadow whitespace-nowrap shrink-0"
              >
                <span className="sm:hidden">{user ? 'Cloud ✓' : 'Cloud'}</span>
                <span className="hidden sm:inline">
                  {user ? 'Déconnexion Cloud' : 'Connexion Google'}
                </span>
              </button>
            </div>
          </header>

          <div className="pixel-frieze w-full shrink-0" aria-hidden="true" />
        </>
      )}

      <main
        className={
          isMapUiFolded
            ? 'flex-1 min-h-0 w-full p-0 flex flex-col overflow-hidden'
            : activeTab === 'carte'
            ? 'flex-1 min-h-0 w-full max-w-[1440px] mx-auto px-1.5 sm:px-5 py-1.5 sm:py-3.5 pb-[calc(3.65rem+env(safe-area-inset-bottom))] md:pb-4 flex flex-col gap-2 sm:gap-3.5 max-lg:overflow-hidden'
            : 'flex-1 w-full max-w-[1400px] mx-auto px-2.5 sm:px-6 py-3 sm:py-5 pb-24 md:pb-6 space-y-3.5 sm:space-y-5'
        }
      >
        {authError && !isMapUiFolded && (
          <div className="grimoire-folio-crimson px-4 py-2.5 text-xs text-rose-950 flex items-center justify-between gap-4 shrink-0">
            <span className="inline-flex items-center gap-2 font-semibold">
              <PixelUiIcon name="warning" className="w-4 h-4" />
              <span>{authError}</span>
            </span>
            <button
              type="button"
              onClick={() => setAuthError('')}
              className="min-h-[36px] px-3 py-1 bg-[#991b1b] text-[#fffbeb] font-bold border border-[#2b1a0e] whitespace-nowrap shrink-0"
            >
              Fermer
            </button>
          </div>
        )}

        {/* ULTRA-SLIM COLLAPSIBLE MOBILE COMPANION & COMPASS STRIP (< lg) */}
        {!isMapUiFolded && (
          <section className="lg:hidden relative shrink-0 z-25">
            <div className="relative grimoire-folio-gold px-2.5 py-1.5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setMobileCompanionExpanded((v) => !v)}
                aria-expanded={mobileCompanionExpanded}
                aria-label={
                  mobileCompanionExpanded
                    ? 'Replier le bandeau explorateur'
                    : 'Déplier le bandeau explorateur'
                }
                className="min-h-[38px] flex items-center gap-2 min-w-0 flex-1 text-left"
              >
                <div className="w-7 h-7 border border-[#2b1a0e] bg-[#28160d] overflow-hidden shrink-0 flex items-center justify-center">
                  <ExplorerSpriteCanvas
                    appearance={explorerAppearance}
                    facingDir="down"
                    isWalking={walkQueue.length > 0 || manualWalkPulse}
                    pixelScale={1.05}
                    className="w-7 h-7 block"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#24160c] truncate">
                    <span className="truncate text-amber-950">{localAtmosphereLabel}</span>
                    <span className="text-[#8c653b] shrink-0">·</span>
                    <span className="font-mono text-emerald-900 shrink-0">
                      {localExplorationPct}%
                    </span>
                  </div>
                  <div className="w-full max-w-[140px] h-1.5 pixel-gauge-track overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#991b1b] via-[#d97706] to-[#fde047]"
                      style={{ width: `${Math.max(6, globalLevelInfo.progressPct)}%` }}
                    />
                  </div>
                </div>
                <PixelUiIcon
                  name={mobileCompanionExpanded ? 'chevron-up' : 'chevron-down'}
                  className="w-3.5 h-3.5 text-[#54361d] shrink-0"
                />
              </button>

              {compassTarget && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPoiId(compassTarget.poi.id);
                    setActiveTab('carte');
                  }}
                  className="min-h-[38px] pl-2 border-l-2 border-[#c89d62] flex items-center gap-1.5 shrink-0 text-left"
                >
                  <span className="text-[11px] font-mono tabular-nums font-bold text-rose-900 whitespace-nowrap">
                    {cardinalShortFr(compassTarget.bearingDeg)} · {compassTarget.distance} m
                  </span>
                </button>
              )}
            </div>

            {/* Floating Accordion Overlay on Mobile so expanding never squashes the Map Canvas! */}
            <AnimatePresence>
              {mobileCompanionExpanded && (
                <motion.div
                  key="mobile-companion-popover"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.14 }}
                  className="absolute left-0 right-0 top-full mt-1.5 z-30 grimoire-folio-gold p-3 space-y-2.5 text-xs shadow-xl"
                >
                  <PixelCornerRivets className="bg-[#f59e0b]" />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-[#54361d] min-w-0">
                      <span className="font-sans font-bold text-[#24160c] truncate max-w-[160px]">
                        {progress.displayName}
                      </span>
                      <span>·</span>
                      <span className="text-rose-900 font-bold">
                        {progress.totalXp}/{globalLevelInfo.nextLevelXp} XP
                      </span>
                      {weather && (
                        <>
                          <span>·</span>
                          <span className="text-sky-900 font-bold">
                            {Math.round(weather.tempC)}°C ({weather.labelFr})
                          </span>
                        </>
                      )}
                      {sessionMeters >= 15 && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-900 font-bold">
                            {sessionMeters} m
                            {sessionElevGainM >= 2 ? ` (D+ ${sessionElevGainM} m)` : ''}
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setMobileCompanionExpanded(false)}
                      className="min-h-[34px] px-2.5 py-1 bg-[#28160d] text-amber-300 border border-[#d97706] text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <PixelUiIcon name="chevron-up" className="w-3 h-3" />
                      <span>Replier</span>
                    </button>
                  </div>
                  {bedrock && (
                    <div className="text-[#54361d] flex items-center gap-1.5">
                      <PixelUiIcon name="bedrock" className="w-3.5 h-3.5" />
                      <span className="truncate">
                        Socle : <strong>{bedrock.lithology}</strong> · {bedrock.period} (
                        {bedrock.ageRangeMa})
                      </span>
                    </div>
                  )}
                  <ParchmentScrollStrip fadeColorFrom="vellum" innerClassName="gap-2">
                    {CATEGORY_ORDER.map((catKey) => {
                      const catMeta = CATEGORY_META[catKey];
                      const lvlInfo = computeLevelFromXp(getCategoryXp(progress, catKey));
                      return (
                        <button
                          key={catKey}
                          type="button"
                          onClick={() => {
                            setMobileCompanionExpanded(false);
                            setActiveTab('branches');
                          }}
                          className="min-h-[38px] px-2.5 py-1.5 bg-[#ecd8b1] border-2 border-[#6b4928] flex items-center gap-1.5 shrink-0"
                        >
                          <PixelGuildIcon category={catKey} className="w-3.5 h-3.5" />
                          <span className={`font-bold ${catMeta.mapTextClass}`}>
                            {catMeta.shortLabel}
                          </span>
                          <span className="font-mono font-bold">Niv.{lvlInfo.level}</span>
                        </button>
                      );
                    })}
                  </ParchmentScrollStrip>
                  <div className="grimoire-whisper px-3 py-2 text-[11px] italic text-[#3b2312]">
                    {companionWhisper}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        {/* COLLAPSIBLE DESKTOP EXPLORER COMPANION FOLIO (lg+) */}
        {!isMapUiFolded && (
          <section className="hidden lg:block relative grimoire-folio-gold px-4 py-2.5 shrink-0">
            <PixelCornerRivets className="bg-[#f59e0b]" />

            {desktopCompanionCollapsed ? (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab('profil')}
                    title="Ouvrir le Profil & l’Atelier cosmétique"
                    className="flex items-center gap-2 shrink-0 hover:opacity-90 transition-opacity"
                  >
                    <div className="w-9 h-9 border-2 border-[#2b1a0e] bg-[#28160d] overflow-hidden flex items-center justify-center">
                      <ExplorerSpriteCanvas
                        appearance={explorerAppearance}
                        facingDir="down"
                        isWalking={walkQueue.length > 0 || manualWalkPulse}
                        pixelScale={1.3}
                        className="w-9 h-9 block"
                      />
                    </div>
                    <span className="px-1.5 py-0.5 bg-[#991b1b] text-amber-200 border border-[#2b1a0e] text-[11px] font-mono tabular-nums font-bold">
                      Niv.{globalLevelInfo.level}
                    </span>
                  </button>

                  <div className="w-36 h-2.5 pixel-gauge-track overflow-hidden shrink-0">
                  <div
                    className="h-full bg-gradient-to-r from-[#991b1b] via-[#d97706] to-[#fde047]"
                    style={{ width: `${Math.max(5, globalLevelInfo.progressPct)}%` }}
                  />
                </div>

                <span className="font-mono tabular-nums text-rose-900 font-bold shrink-0">
                  {progress.totalXp}/{globalLevelInfo.nextLevelXp} XP
                </span>
                <span className="text-[#8c653b]">·</span>
                <span className="font-bold text-amber-950 truncate">{localAtmosphereLabel}</span>
                <span className="text-[#8c653b]">·</span>
                <span className="font-mono tabular-nums text-emerald-900 font-bold shrink-0">
                  {localExplorationPct}% exploré
                </span>
                {weather && (
                  <>
                    <span className="text-[#8c653b] hidden xl:inline">·</span>
                    <span className="hidden xl:inline font-mono font-bold text-sky-900 shrink-0">
                      {Math.round(weather.tempC)}°C · {weather.labelFr}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {nearestUndiscovered && activeTab === 'carte' && (
                  <button
                    type="button"
                    onClick={() => setSelectedPoiId(nearestUndiscovered.poi.id)}
                    className="px-2.5 py-1 bg-[#ecd8b1] hover:bg-amber-200 text-[#24160c] border border-[#6b4928] text-xs font-mono font-bold whitespace-nowrap"
                  >
                    Écho proche : {nearestUndiscovered.distance} m
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDesktopCompanionCollapsed(false)}
                  className="px-2.5 py-1 bg-[#28160d] hover:bg-[#3f2416] text-amber-300 border border-[#d97706] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <PixelUiIcon name="chevron-down" className="w-3.5 h-3.5" />
                  <span>Déplier le bandeau</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-1.5 space-y-3">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('profil')}
                    title="Ouvrir le Profil & personnaliser votre avatar"
                    className="relative shrink-0 hover:scale-[1.03] transition-transform"
                  >
                    <div className="w-16 h-16 border-2 border-[#2b1a0e] jrpg-shadow overflow-hidden bg-[#28160d] flex items-center justify-center">
                      <ExplorerSpriteCanvas
                        appearance={explorerAppearance}
                        facingDir="down"
                        isWalking={walkQueue.length > 0 || manualWalkPulse}
                        stageBackdrop
                        timeMode={timeMode}
                        pixelScale={2.15}
                        className="w-16 h-16 block"
                      />
                    </div>
                    <span className="absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 bg-[#991b1b] text-amber-200 border-2 border-[#2b1a0e] text-[10px] font-mono tabular-nums font-bold">
                      Niv.{globalLevelInfo.level}
                    </span>
                  </button>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#54361d] font-semibold">
                        <span className="font-bold text-[#24160c] truncate max-w-[200px]">
                          {progress.displayName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileInitialTab('trophees');
                            setActiveTab('profil');
                          }}
                          title="Ouvrir la Salle des Trophées 16-bit & épingler votre titre"
                          className="inline-flex items-center gap-1.5 font-bold text-rose-900 hover:text-rose-700 underline decoration-[#c89d62] underline-offset-4 transition-colors"
                        >
                          {explorerTitleInfo.pinnedTrophy ? (
                            <TrophyBadgeCanvas
                              trophyId={explorerTitleInfo.pinnedTrophy.id}
                              unlocked
                              pixelScale={1}
                            />
                          ) : (
                            <PixelUiIcon name="trophy" className="w-3.5 h-3.5" />
                          )}
                          <span className="truncate max-w-[210px]">{explorerTitleInfo.title}</span>
                        </button>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1.5 font-bold text-amber-950">
                          <PixelUiIcon name={daytimeMood.icon} className="w-4 h-4 lantern-breathe" />
                          <span>{daytimeMood.label}</span>
                        </span>
                        {weather && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-sky-900">
                              <PixelUiIcon
                                name={
                                  weather.condition === 'rain' || weather.condition === 'storm'
                                    ? 'rain'
                                    : weather.condition === 'snow'
                                    ? 'snow'
                                    : 'sun-cloud'
                                }
                                className="w-3.5 h-3.5"
                              />
                              <span>
                                {Math.round(weather.tempC)}°C · {weather.labelFr}
                              </span>
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="text-[#6b4928] font-bold">{localAtmosphereLabel}</span>
                        {playerAltitude !== null && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums text-emerald-900 font-bold">
                              Alt. {Math.round(playerAltitude)} m
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-emerald-900 font-bold">
                          Secteur {localExplorationPct}% exploré
                        </span>
                        {sessionMeters >= 15 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums text-amber-950 font-bold">
                              {sessionMeters} m parcourus
                              {sessionElevGainM >= 2 ? ` (D+ ${sessionElevGainM} m)` : ''}
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-rose-900 font-bold">
                          {progress.totalXp} / {globalLevelInfo.nextLevelXp} XP
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{entries.length} découvertes</span>
                      </div>

                      <div className="relative w-full max-w-xs h-2.5 pixel-gauge-track overflow-hidden">
                        <motion.div
                          initial={false}
                          animate={{ scaleX: Math.max(0.04, globalLevelInfo.progressPct / 100) }}
                          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                          className="h-full bg-gradient-to-r from-[#991b1b] via-[#d97706] to-[#fde047] origin-left"
                        />
                        <div className="pointer-events-none absolute inset-0 pixel-gauge-segments" />
                      </div>

                      {bedrock ? (
                        <div className="text-xs text-[#54361d] flex items-center gap-1.5 truncate max-w-2xl">
                          <PixelUiIcon name="bedrock" className="w-3.5 h-3.5" />
                          <span className="text-sky-900 font-bold shrink-0">Socle & bâti :</span>
                          <span className="truncate">
                            {bedrock.lithology} ·{' '}
                            <strong className="text-amber-950">{bedrock.period}</strong> (
                            {bedrock.ageRangeMa}) · {regionalTheme.shortLabel}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-[#54361d] flex items-center gap-1.5 truncate max-w-2xl">
                          <PixelUiIcon name="map" className="w-3.5 h-3.5" />
                          <span className="text-amber-950 font-bold shrink-0">Bâti régional :</span>
                          <span className="truncate">{regionalTheme.fullLabel}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 5 Tactile Guild Wax/Brass Medals + Fold Button */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {CATEGORY_ORDER.map((catKey) => {
                      const catMeta = CATEGORY_META[catKey];
                      const xp = getCategoryXp(progress, catKey);
                      const lvlInfo = computeLevelFromXp(xp);
                      return (
                        <button
                          key={catKey}
                          type="button"
                          onClick={() => setActiveTab('branches')}
                          className="px-2.5 py-1.5 bg-[#ecd8b1] border-2 border-[#6b4928] hover:bg-[#fffbeb] hover:border-[#2b1a0e] flex flex-col gap-1 text-[#24160c] transition-transform duration-150 hover:-translate-y-0.5 jrpg-shadow whitespace-nowrap shrink-0"
                        >
                          <span className="flex items-center gap-1.5">
                            <PixelGuildIcon category={catKey} className="w-4 h-4" />
                            <span className={`font-bold ${catMeta.mapTextClass}`}>
                              {catMeta.shortLabel}
                            </span>
                            <span className="text-[#8c653b]">·</span>
                            <span className="font-mono tabular-nums font-bold text-[#24160c]">
                              Niv.{lvlInfo.level}
                            </span>
                          </span>
                          <span className="w-full h-1 bg-[#28160d] block overflow-hidden">
                            <span
                              className={`block h-full ${catMeta.accentBgClass}`}
                              style={{ width: `${Math.max(8, lvlInfo.progressPct)}%` }}
                            />
                          </span>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setDesktopCompanionCollapsed(true)}
                      className="px-2.5 py-1.5 bg-[#28160d] hover:bg-[#3f2416] text-amber-300 border-2 border-[#d97706] font-bold inline-flex items-center gap-1.5 jrpg-shadow whitespace-nowrap shrink-0"
                    >
                      <PixelUiIcon name="chevron-up" className="w-3.5 h-3.5" />
                      <span>Replier</span>
                    </button>
                  </div>
                </div>

                <div className="grimoire-whisper px-3.5 py-2 text-xs text-[#3b2312] flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 min-w-0 italic font-medium">
                    <PixelUiIcon name="quill" className="w-3.5 h-3.5 shrink-0" />
                    <span>{companionWhisper}</span>
                  </span>
                  {nearestUndiscovered && activeTab === 'carte' && (
                    <button
                      type="button"
                      onClick={() => setSelectedPoiId(nearestUndiscovered.poi.id)}
                      className="px-2.5 py-1 bg-[#28160d] text-amber-300 hover:text-amber-200 border border-[#6b4928] font-sans not-italic font-bold text-[11px] whitespace-nowrap shrink-0 transition-colors"
                    >
                      Viser ce sceau
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Illuminated Parchment Discovery Cut-In Banner */}
        <AnimatePresence>
          {cutIn && (
            <motion.div
              key={cutIn.id}
              initial={{ opacity: 0, x: -36, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 36, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 460, damping: 30 }}
              className={`${
                isMapUiFolded
                  ? 'fixed top-[3.5rem] left-3 right-3 sm:left-auto sm:right-4 sm:w-[460px] z-40'
                  : 'relative shrink-0'
              } grimoire-folio-crimson text-[#24160c] p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3`}
            >
              <PixelCornerRivets className="bg-[#b91c1c]" />
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {cutIn.unlockedTrophyId ? (
                  <div className="p-1.5 bg-[#28160d] border-2 border-[#d97706] shrink-0">
                    <TrophyBadgeCanvas
                      trophyId={cutIn.unlockedTrophyId}
                      unlocked
                      pixelScale={2}
                    />
                  </div>
                ) : (
                  cutIn.emblemSrc && (
                    <ResilientPixelImage
                      src={cutIn.emblemSrc}
                      alt={cutIn.title}
                      className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-[#2b1a0e] shrink-0"
                    />
                  )
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-rose-800 flex items-center gap-1.5 min-w-0">
                    <PixelUiIcon
                      name={cutIn.unlockedTrophyId ? 'trophy' : 'star'}
                      className="w-3.5 h-3.5 shrink-0"
                    />
                    <span className="truncate">{cutIn.kicker}</span>
                  </div>
                  <p className="text-base sm:text-lg font-bold font-display text-[#24160c] leading-snug break-words">
                    {cutIn.title}
                  </p>
                  <p className="text-xs font-semibold text-[#5c4028] break-words">{cutIn.subtitle}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto shrink-0">
                {cutIn.poiId && (
                  <button
                    type="button"
                    onClick={() => {
                      const pid = cutIn.poiId!;
                      setCutIn(null);
                      openJournalEntry(pid);
                    }}
                    className="min-h-[40px] sm:min-h-0 inline-flex items-center gap-2 px-3 py-1.5 sm:py-2 text-xs font-bold bg-[#991b1b] text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow hover:bg-[#b91c1c] transition-transform duration-150 active:translate-y-0.5 whitespace-nowrap shrink-0"
                  >
                    <PixelUiIcon name="book" className="w-4 h-4 shrink-0" />
                    <span>Ouvrir au Carnet</span>
                  </button>
                )}
                {cutIn.unlockedTrophyId && (
                  <button
                    type="button"
                    onClick={() => {
                      setCutIn(null);
                      setUiCollapsed(false);
                      setProfileInitialTab('trophees');
                      setActiveTab('profil');
                    }}
                    className="min-h-[40px] sm:min-h-0 inline-flex items-center gap-2 px-3 py-1.5 sm:py-2 text-xs font-bold bg-amber-300 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow hover:bg-amber-200 transition-transform duration-150 active:translate-y-0.5 whitespace-nowrap shrink-0"
                  >
                    <PixelUiIcon name="trophy" className="w-4 h-4 shrink-0" />
                    <span>Voir & Épingler</span>
                  </button>
                )}
                {cutIn.unlockedCosmeticName && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetSlot = cutIn.unlockedCosmeticSlot || 'familiar';
                      setCutIn(null);
                      openWorkshopAtSlot(targetSlot);
                    }}
                    className="min-h-[40px] sm:min-h-0 inline-flex items-center gap-2 px-3 py-1.5 sm:py-2 text-xs font-bold bg-amber-300 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow hover:bg-amber-200 transition-transform duration-150 active:translate-y-0.5 whitespace-nowrap shrink-0"
                  >
                    <PixelUiIcon name="user-profile" className="w-4 h-4 shrink-0" />
                    <span>
                      {cutIn.unlockedCosmeticSlot === 'familiar'
                        ? 'Adopter au Profil'
                        : 'Équiper au Profil'}
                    </span>
                  </button>
                )}
                {cutIn.openReliquary && (
                  <button
                    type="button"
                    onClick={() => {
                      setCutIn(null);
                      setUiCollapsed(false);
                      setCarnetView('tresors');
                      setActiveTab('carnet');
                    }}
                    className="min-h-[40px] sm:min-h-0 inline-flex items-center gap-2 px-3 py-1.5 sm:py-2 text-xs font-bold bg-amber-300 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow hover:bg-amber-200 transition-transform duration-150 active:translate-y-0.5 whitespace-nowrap shrink-0"
                  >
                    <PixelUiIcon name="chest" className="w-4 h-4 shrink-0" />
                    <span>Voir au Reliquaire</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCutIn(null)}
                  className="min-h-[40px] sm:min-h-0 px-3 py-1.5 sm:py-2 text-xs font-bold bg-[#28160d] text-amber-300 border-2 border-[#2b1a0e] whitespace-nowrap shrink-0"
                >
                  Continuer
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ==================== TAB VIEWS ==================== */}
        <AnimatePresence mode="wait">
          {activeTab === 'carte' && (
            <motion.div
              key="view-carte"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              className="flex-1 min-h-0 flex flex-col gap-2.5 sm:gap-3"
            >
              {/* SINGLE-ROW CONSOLIDATED DESKTOP COMMAND BAR + COLLAPSIBLE PANELS (lg+) */}
              {!uiCollapsed && (
                <div className="hidden lg:block space-y-2.5 shrink-0">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center bg-[#f8edd6] border-2 border-[#2b1a0e] jrpg-shadow">
                        <button
                          type="button"
                          onClick={() => setSimulationMode(false)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                            !simulationMode
                              ? 'bg-[#991b1b] text-[#fffbeb]'
                              : 'text-[#54361d] hover:bg-[#ecd8b1]'
                          }`}
                        >
                          <PixelUiIcon name="gps" className="w-3.5 h-3.5" />
                          <span>GPS Réel</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSimulationMode(true)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border-l-2 border-[#2b1a0e] transition-colors whitespace-nowrap shrink-0 ${
                            simulationMode
                              ? 'bg-amber-300 text-[#24160c]'
                              : 'text-[#54361d] hover:bg-[#ecd8b1]'
                          }`}
                        >
                          <PixelUiIcon name="boot" className="w-3.5 h-3.5" />
                          <span>Marche Simulée</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSubterraneanMode((v) => !v)}
                        title="Basculer entre la carte de Surface et la couche Sous-sol / Donjon (G)"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border-2 jrpg-shadow transition-colors whitespace-nowrap shrink-0 ${
                          subterraneanMode
                            ? 'bg-[#1c130d] text-amber-300 border-amber-400 hover:bg-[#2e2016]'
                            : 'bg-[#f8edd6] text-[#24160c] border-[#2b1a0e] hover:bg-[#ecd8b1]'
                        }`}
                      >
                        <PixelUiIcon
                          name={subterraneanMode ? 'map' : 'dungeon'}
                          className="w-3.5 h-3.5"
                        />
                        <span>{subterraneanMode ? 'Surface' : 'Sous-sol'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setDesktopToolbarPanel((cur) => (cur === 'filters' ? 'none' : 'filters'))
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow transition-colors whitespace-nowrap shrink-0 ${
                          desktopToolbarPanel === 'filters' || activeFilterCount > 0
                            ? 'bg-amber-300 text-[#24160c]'
                            : 'bg-[#f8edd6] text-[#24160c] hover:bg-[#ecd8b1]'
                        }`}
                      >
                        <PixelUiIcon name="sliders" className="w-3.5 h-3.5" />
                        <span>Filtres & Strates</span>
                        {activeFilterCount > 0 && (
                          <span className="font-mono tabular-nums text-[#991b1b]">
                            ({activeFilterCount})
                          </span>
                        )}
                        <PixelUiIcon
                          name={desktopToolbarPanel === 'filters' ? 'chevron-up' : 'chevron-down'}
                          className="w-3 h-3"
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setDesktopToolbarPanel((cur) => (cur === 'travel' ? 'none' : 'travel'))
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow transition-colors whitespace-nowrap shrink-0 ${
                          desktopToolbarPanel === 'travel'
                            ? 'bg-amber-300 text-[#24160c]'
                            : 'bg-[#f8edd6] text-[#24160c] hover:bg-[#ecd8b1]'
                        }`}
                      >
                        <PixelUiIcon name="search" className="w-3.5 h-3.5" />
                        <span>Voyage & Lieux</span>
                        <PixelUiIcon
                          name={desktopToolbarPanel === 'travel' ? 'chevron-up' : 'chevron-down'}
                          className="w-3 h-3"
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => fetchSector(playerPos.lat, playerPos.lng, true)}
                        disabled={loadingSector}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#f8edd6] border-2 border-[#2b1a0e] text-[#24160c] hover:bg-amber-200 disabled:opacity-50 jrpg-shadow transition-colors whitespace-nowrap shrink-0"
                      >
                        <PixelUiIcon name="radar" className="w-3.5 h-3.5" />
                        <span>{loadingSector ? 'Sondage…' : 'Sonder'}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {activeRumorsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            playJournalOpenSfx(muted);
                            setBestiaryInitialSubTab('rumeurs');
                            setCarnetView('bestiaire');
                            setActiveTab('carnet');
                          }}
                          title="Consulter les pistes et rumeurs confiées par les habitants"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow transition-colors whitespace-nowrap shrink-0"
                        >
                          <PixelUiIcon name="rumor" className="w-3.5 h-3.5" />
                          <span>Pistes · {activeRumorsCount}</span>
                        </button>
                      )}

                      {simulationMode ? (
                        <button
                          type="button"
                          onClick={() => setDpadOpen((v) => !v)}
                          title={dpadOpen ? 'Replier le D-Pad' : 'Déplier le D-Pad sur la carte'}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow transition-colors whitespace-nowrap shrink-0 ${
                            dpadOpen
                              ? 'bg-amber-300 text-[#24160c]'
                              : 'bg-[#f8edd6] text-[#24160c] hover:bg-[#ecd8b1]'
                          }`}
                        >
                          <PixelUiIcon name="dpad" className="w-3.5 h-3.5" />
                          <span>D-Pad</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if ('geolocation' in navigator) {
                              navigator.geolocation.getCurrentPosition((pos) => {
                                setPlayerPos({
                                  lat: pos.coords.latitude,
                                  lng: pos.coords.longitude,
                                });
                              });
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow whitespace-nowrap shrink-0"
                        >
                          <PixelUiIcon name="gps" className="w-3.5 h-3.5" />
                          <span>Recentrer GPS</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setDesktopSidebarCollapsed((v) => !v)}
                        title={
                          desktopSidebarCollapsed
                            ? 'Déplier le panneau Boussole & Signaux'
                            : 'Replier le panneau latéral pour agrandir la carte'
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow transition-colors whitespace-nowrap shrink-0 ${
                          desktopSidebarCollapsed
                            ? 'bg-amber-300 text-[#24160c]'
                            : 'bg-[#f8edd6] text-[#24160c] hover:bg-[#ecd8b1]'
                        }`}
                      >
                        <PixelUiIcon name="sidebar-toggle" className="w-3.5 h-3.5" />
                        <span>
                          {desktopSidebarCollapsed
                            ? `Signaux · ${sortedNearbyPois.length}`
                            : 'Replier le panneau'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Collapsible Desktop Filters / Strates / Map Options Panel */}
                  <AnimatePresence>
                    {desktopToolbarPanel === 'filters' && (
                      <motion.div
                        key="desktop-panel-filters"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.14 }}
                        className="relative grimoire-folio p-3.5 space-y-2.5"
                      >
                        <PixelCornerRivets className="bg-[#f59e0b]" />

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-bold font-display text-[#24160c] pr-1">
                              Guildes :
                            </span>
                            <button
                              type="button"
                              onClick={() => setCategoryFilter('all')}
                              className={`px-2.5 py-1 text-xs font-bold border-2 border-[#2b1a0e] whitespace-nowrap ${
                                categoryFilter === 'all'
                                  ? 'bg-[#991b1b] text-[#fffbeb]'
                                  : 'bg-[#ecd8b1] text-[#54361d] hover:bg-[#fffbeb]'
                              }`}
                            >
                              Toutes ({archiveFilteredPois.length})
                            </button>
                            {CATEGORY_ORDER.map((catKey) => (
                              <button
                                key={catKey}
                                type="button"
                                onClick={() => setCategoryFilter(catKey)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold border-2 border-[#2b1a0e] whitespace-nowrap ${
                                  categoryFilter === catKey
                                    ? `bg-amber-300 ${CATEGORY_META[catKey].mapTextClass}`
                                    : 'bg-[#ecd8b1] text-[#54361d] hover:bg-[#fffbeb]'
                                }`}
                              >
                                <PixelGuildIcon category={catKey} className="w-3.5 h-3.5" />
                                <span>{CATEGORY_META[catKey].shortLabel}</span>
                              </button>
                            ))}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setReliefEnabled((r) => !r)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold border-2 border-[#2b1a0e] whitespace-nowrap ${
                                reliefEnabled
                                  ? 'bg-amber-300 text-[#24160c]'
                                  : 'bg-[#ecd8b1] text-[#54361d]'
                              }`}
                            >
                              <PixelUiIcon name="mountain" className="w-3.5 h-3.5" />
                              <span>Relief</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setFogEnabled((f) => !f)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold border-2 border-[#2b1a0e] whitespace-nowrap ${
                                fogEnabled
                                  ? 'bg-amber-300 text-[#24160c]'
                                  : 'bg-[#ecd8b1] text-[#54361d]'
                              }`}
                            >
                              <PixelUiIcon name="map" className="w-3.5 h-3.5" />
                              <span>Brouillard {localExplorationPct}%</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDashedTracesEnabled((d) => !d)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold border-2 border-[#2b1a0e] whitespace-nowrap ${
                                dashedTracesEnabled
                                  ? 'bg-amber-300 text-[#24160c]'
                                  : 'bg-[#ecd8b1] text-[#54361d]'
                              }`}
                            >
                              <PixelUiIcon name="constellation" className="w-3.5 h-3.5" />
                              <span>Tracés</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSubtleBuildings((s) => !s)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold border-2 border-[#2b1a0e] whitespace-nowrap ${
                                subtleBuildings
                                  ? 'bg-[#28160d] text-amber-300'
                                  : 'bg-[#ecd8b1] text-[#54361d]'
                              }`}
                            >
                              <PixelUiIcon name="map" className="w-3.5 h-3.5" />
                              <span>Bâti discret</span>
                            </button>
                            <button
                              type="button"
                              onClick={cycleTimeMode}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold border-2 border-[#2b1a0e] whitespace-nowrap ${
                                timeMode !== 'auto'
                                  ? 'bg-[#28160d] text-amber-300'
                                  : 'bg-[#ecd8b1] text-[#54361d]'
                              }`}
                            >
                              <PixelUiIcon
                                name={TIME_MODE_LABELS[timeMode].icon}
                                className="w-3.5 h-3.5"
                              />
                              <span>{TIME_MODE_LABELS[timeMode].short}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPocketCompassMode((p) => !p)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold border-2 border-[#2b1a0e] whitespace-nowrap ${
                                pocketCompassMode
                                  ? 'bg-emerald-800 text-[#fffbeb]'
                                  : 'bg-[#ecd8b1] text-[#54361d]'
                              }`}
                            >
                              <PixelUiIcon name="pocket-compass" className="w-3.5 h-3.5" />
                              <span>Poche</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleToggleScreenAwake}
                              aria-pressed={wakeLockWanted}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold border-2 border-[#2b1a0e] whitespace-nowrap ${
                                wakeLockWanted
                                  ? 'bg-emerald-800 text-amber-200'
                                  : 'bg-[#ecd8b1] text-[#54361d]'
                              }`}
                            >
                              <PixelUiIcon name="screen-awake" className="w-3.5 h-3.5" />
                              <span>Écran éveillé</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleToggleHaptics}
                              aria-pressed={hapticsEnabled}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold border-2 border-[#2b1a0e] whitespace-nowrap ${
                                hapticsEnabled
                                  ? 'bg-emerald-800 text-amber-200'
                                  : 'bg-[#ecd8b1] text-[#54361d]'
                              }`}
                            >
                              <PixelUiIcon name="haptic" className="w-3.5 h-3.5" />
                              <span>Haptique</span>
                            </button>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[#c89d62] flex items-center gap-2">
                          <span className="text-xs font-bold font-display text-[#24160c] shrink-0 inline-flex items-center gap-1.5">
                            <PixelUiIcon name="bedrock" className="w-3.5 h-3.5" />
                            <span>Strates :</span>
                          </span>
                          <ParchmentScrollStrip
                            fadeColorFrom="vellum"
                            innerClassName="gap-1.5 py-0.5"
                            className="flex-1 min-w-0"
                          >
                            <button
                              type="button"
                              onClick={() => setStratumFilter('all')}
                              className={`px-2.5 py-1 text-xs font-bold border-2 whitespace-nowrap shrink-0 ${
                                stratumFilter === 'all'
                                  ? 'bg-[#991b1b] text-[#fffbeb] border-[#2b1a0e]'
                                  : 'bg-[#ecd8b1] text-[#54361d] border-[#8c653b] hover:border-[#2b1a0e]'
                              }`}
                            >
                              Toutes les époques
                            </button>
                            {(Object.keys(STRATUM_META) as HistoricalStratum[]).map((stKey) => (
                              <button
                                key={stKey}
                                type="button"
                                onClick={() => setStratumFilter(stKey)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border-2 whitespace-nowrap shrink-0 ${
                                  stratumFilter === stKey
                                    ? 'bg-amber-300 text-[#24160c] font-bold border-[#2b1a0e]'
                                    : 'bg-[#ecd8b1] text-[#54361d] border-[#8c653b] hover:border-[#2b1a0e]'
                                }`}
                              >
                                <PixelStratumIcon stratum={stKey} className="w-3.5 h-3.5" />
                                <span>{STRATUM_META[stKey].short}</span>
                              </button>
                            ))}
                          </ParchmentScrollStrip>
                        </div>

                        {interactiveArchiveSources.length > 0 && (
                          <div className="pt-2 border-t border-[#c89d62] flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#24160c] shrink-0">
                              <PixelUiIcon name="archive" className="w-3.5 h-3.5" />
                              <span>Archives ({sourcesActive.length}) :</span>
                            </span>
                            <ParchmentScrollStrip
                              fadeColorFrom="vellum"
                              innerClassName="gap-1.5 py-0.5"
                              className="flex-1 min-w-0"
                            >
                              <button
                                type="button"
                                onClick={() => setSourceFilter('all')}
                                className={`px-2.5 py-1 text-[11px] font-bold border whitespace-nowrap shrink-0 ${
                                  sourceFilter === 'all'
                                    ? 'bg-[#991b1b] text-[#fffbeb] border-[#2b1a0e]'
                                    : 'bg-[#ecd8b1] text-[#54361d] border-[#8c653b] hover:bg-[#fffbeb]'
                                }`}
                              >
                                Toutes les sources
                              </button>
                              {interactiveArchiveSources.map((srcName) => (
                                <button
                                  key={srcName}
                                  type="button"
                                  onClick={() =>
                                    setSourceFilter((cur) => (cur === srcName ? 'all' : srcName))
                                  }
                                  className={`px-2.5 py-1 text-[11px] font-semibold border whitespace-nowrap shrink-0 ${
                                    sourceFilter === srcName
                                      ? 'bg-amber-300 text-[#24160c] font-bold border-[#2b1a0e]'
                                      : 'bg-[#ecd8b1] text-[#54361d] border-[#8c653b] hover:bg-[#fffbeb]'
                                  }`}
                                >
                                  {srcName}
                                </button>
                              ))}
                            </ParchmentScrollStrip>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {desktopToolbarPanel === 'travel' && (
                      <motion.div
                        key="desktop-panel-travel"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.14 }}
                        className="relative grimoire-folio p-3.5 space-y-3"
                      >
                        <PixelCornerRivets className="bg-[#f59e0b]" />
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#54361d]">
                            <PixelUiIcon name="gps" className="w-3.5 h-3.5" />
                            <span className="font-mono tabular-nums text-rose-900 font-bold">
                              {playerPos.lat.toFixed(5)}° N, {playerPos.lng.toFixed(5)}° E
                            </span>
                            {elevation && (
                              <>
                                <span>·</span>
                                <span className="font-mono tabular-nums text-emerald-900 font-bold">
                                  {Math.round(elevation.minMeters)}–{Math.round(elevation.maxMeters)} m NGF
                                </span>
                              </>
                            )}
                            <span>·</span>
                            <span>{gpsStatus}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <form onSubmit={handlePlaceSearch} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Votre rue, ville, village, forêt…"
                                className="w-60 bg-[#ecd8b1] border-2 border-[#6b4928] px-3 py-1.5 text-xs text-[#24160c] placeholder:text-[#78532f] focus:outline-none focus:bg-[#fffdf7] focus:border-[#2b1a0e]"
                              />
                              <button
                                type="submit"
                                disabled={searchingPlace}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow whitespace-nowrap shrink-0"
                              >
                                <PixelUiIcon name="search" className="w-3.5 h-3.5" />
                                <span>{searchingPlace ? '…' : 'Chercher'}</span>
                              </button>
                            </form>

                            <button
                              type="button"
                              onClick={() => handleSaveCurrentSectorToBesace()}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#ecd8b1] hover:bg-[#fffbeb] border-2 border-[#2b1a0e] text-[#24160c] jrpg-shadow whitespace-nowrap shrink-0"
                            >
                              <PixelUiIcon name="backpack" className="w-3.5 h-3.5" />
                              <span>Mettre en besace</span>
                            </button>
                          </div>
                        </div>

                        {besaceToast && (
                          <div className="p-2 bg-emerald-100 border-2 border-emerald-800 text-xs font-bold text-emerald-950">
                            {besaceToast}
                          </div>
                        )}

                        {searchResults.length > 0 && (
                          <div className="space-y-1.5">
                            {searchResults.map((res, idx) => (
                              <button
                                key={`${res.lat}_${res.lng}_${idx}`}
                                type="button"
                                onClick={() => teleportToLocation(res.lat, res.lng)}
                                className="w-full text-left px-3 py-2 text-xs bg-[#ecd8b1] border-2 border-[#6b4928] hover:bg-[#fffbeb] hover:border-[#2b1a0e] text-[#24160c] font-medium flex items-center justify-between gap-2"
                              >
                                <span className="truncate">{res.label}</span>
                                <PixelUiIcon name="cursor" className="w-3.5 h-3.5" />
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {PRESET_LOCATIONS.map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => teleportToLocation(preset.lat, preset.lng)}
                              className="px-2.5 py-1 text-xs font-semibold bg-[#ecd8b1] border-2 border-[#8c653b] hover:bg-amber-200 hover:border-[#2b1a0e] text-[#24160c] whitespace-nowrap shrink-0"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Sector Error Banner if Offline/Fallback */}
              {sectorError && !uiCollapsed && (
                <div className="grimoire-folio px-3 py-1.5 text-xs font-bold text-rose-900 flex items-center justify-between gap-2 shrink-0">
                  <span className="truncate">{sectorError}</span>
                  <button
                    type="button"
                    onClick={() => setSectorError('')}
                    className="px-2 py-0.5 bg-[#ecd8b1] border border-[#6b4928] text-[11px] shrink-0"
                  >
                    OK
                  </button>
                </div>
              )}

              {/* Live Clue Treasure Hunt Hot/Cold Compass Strip on Map */}
              {!uiCollapsed &&
                trackingHuntOnMap &&
                currentSectorHunt &&
                !isCurrentHuntCompleted && (
                  <ActiveHuntMapBanner
                    hunt={currentSectorHunt}
                    activeStepIdx={currentHuntStepIdx}
                    playerLat={playerPos.lat}
                    playerLng={playerPos.lng}
                    onOpenHuntTab={() => {
                      setMissionsSubTab('chasse');
                      setActiveTab('missions');
                    }}
                    onClaimStepHere={handleAdvanceCurrentHuntStep}
                    onCloseTracker={() => setTrackingHuntOnMap(false)}
                  />
                )}

              {/* Main Map Workspace: Full-Flex Zero-Scroll on Mobile + Expandable 8/12 Cols on Desktop */}
              <div
                className={`flex-1 min-h-0 ${
                  uiCollapsed
                    ? 'flex flex-col'
                    : 'flex flex-col lg:grid lg:grid-cols-12 lg:gap-5 lg:items-start'
                }`}
              >
                <div
                  className={`relative flex-1 min-h-0 flex flex-col ${
                    uiCollapsed
                      ? 'w-full h-full'
                      : desktopSidebarCollapsed
                      ? 'lg:col-span-12'
                      : 'lg:col-span-8'
                  }`}
                >
                  <PixelMapCanvas
                    playerLat={playerPos.lat}
                    playerLng={playerPos.lng}
                    pois={archiveFilteredPois}
                    surfacePois={surfacePois}
                    subterraneanPois={subterraneanPois}
                    terrain={terrain}
                    subterranean={subterranean}
                    bedrock={bedrock}
                    subterraneanMode={subterraneanMode}
                    onToggleSubterraneanMode={() => setSubterraneanMode((v) => !v)}
                    elevation={elevation}
                    reliefEnabled={reliefEnabled}
                    unlockedIds={unlockedIds}
                    selectedPoiId={selectedPoiId}
                    simulationMode={simulationMode}
                    isWalking={walkQueue.length > 0 || manualWalkPulse}
                    facingDir={facingDir}
                    zoomLevel={zoomLevel}
                    subtleBuildings={subtleBuildings}
                    categoryFilter={categoryFilter}
                    stratumFilter={stratumFilter}
                    fillContainer
                    immersiveFullscreen={uiCollapsed}
                    uiCollapsed={uiCollapsed}
                    onToggleUiCollapsed={() => setUiCollapsed((v) => !v)}
                    weather={weather}
                    timeMode={timeMode}
                    fogEnabled={fogEnabled}
                    fogSet={fogSet}
                    fogVisionMeters={95 + guildPerks.fogVisionBonusMeters}
                    outfitId={progress.outfitId || 'arpenteur'}
                    explorerAppearance={explorerAppearance}
                    chroniqueurThreads={guildPerks.chroniqueurThreads}
                    dashedTracesEnabled={dashedTracesEnabled}
                    spectralLanternMeters={guildPerks.spectralLanternMeters}
                    breadcrumbTrail={breadcrumbTrail}
                    plannedRoute={walkQueue}
                    routeRequest={routeRequest}
                    muted={muted}
                    onToggleFullscreen={toggleFullscreenMap}
                    onChangeZoom={setZoomLevel}
                    onSelectPoi={(poi) => setSelectedPoiId(poi.id)}
                    onMapDestinationClick={(lat, lng) => setWalkQueue([{ lat, lng }])}
                    onPlanWalkRoute={(waypoints) => setWalkQueue(waypoints)}
                    onPlayerSurfaceChange={handlePlayerSurfaceChange}
                    rumorLeads={rumorLeads}
                    onNpcInteract={handleNpcInteract}
                    onAcceptRumor={handleAcceptRumor}
                    harvestedNodeIds={harvestedSpecimenNodes}
                    onHarvestSpecimen={handleHarvestSpecimen}
                    onOpenNpcPostcard={handleOpenNpcPostcard}
                    worldChests={worldChests}
                    openedChestIds={openedChestIdSet}
                    onOpenArchivistChest={handleOpenArchivistChest}
                    nearbyGeocaches={mergedNearbyGeocaches}
                    foundGeocacheIds={foundGeocacheIds}
                    currentUserId={user ? user.uid : null}
                    onInspectGeocache={(cache) => setGeocacheModal({ mode: 'inspect', cache })}
                  />

                  {/* Desktop Floating Tactile D-Pad (when unfolded via D-Pad toggle) */}
                  {!uiCollapsed && simulationMode && dpadOpen && (
                    <div className="hidden lg:block absolute right-4 bottom-4 z-20">
                      {renderTactileDPad(true)}
                    </div>
                  )}

                  {/* Desktop Floating Selected POI Card when Right Sidebar is Collapsed or UI is Folded */}
                  <AnimatePresence>
                    {selectedMapPoi && (desktopSidebarCollapsed || uiCollapsed) && (
                      <motion.div
                        key={`desktop-float-poi-${selectedMapPoi.id}`}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 16 }}
                        transition={{ duration: 0.15 }}
                        className="hidden lg:block absolute left-4 bottom-4 w-[390px] z-20"
                      >
                        {renderSelectedPoiCard(true)}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* MOBILE FLOATING ON-MAP CONTROLS (< lg) — Zero Page Scroll & Zero Overlap with POI Sheet! */}
                  {!uiCollapsed && !selectedMapPoi && (
                    <>
                      {/* On-Demand Tactile D-Pad floating above Thumb Bar */}
                      {simulationMode && dpadOpen && (
                        <div className="lg:hidden absolute right-2.5 bottom-16 z-20">
                          {renderTactileDPad(true)}
                        </div>
                      )}

                      {/* Sleek Floating Thumb-Zone Action Strip inside Map Bottom */}
                      <div className="lg:hidden absolute inset-x-2 bottom-2 z-20 grid grid-cols-5 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSimulationMode((s) => !s)}
                          className={`min-h-[46px] px-1 py-1.5 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow flex flex-col items-center justify-center gap-0.5 ${
                            simulationMode
                              ? 'bg-amber-300 text-[#24160c]'
                              : 'bg-[#991b1b] text-[#fffbeb]'
                          }`}
                        >
                          <PixelUiIcon name={simulationMode ? 'boot' : 'gps'} className="w-4 h-4 shrink-0" />
                          <span className="text-[10px] leading-none truncate max-w-full">
                            {simulationMode ? 'Simulé' : 'GPS Réel'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMobileDrawer('filters')}
                          className="relative min-h-[46px] px-1 py-1.5 text-xs font-bold bg-[#f8edd6]/95 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow flex flex-col items-center justify-center gap-0.5"
                        >
                          <PixelUiIcon name="sliders" className="w-4 h-4 shrink-0" />
                          <span className="text-[10px] leading-none truncate max-w-full">Filtres</span>
                          {activeFilterCount > 0 && (
                            <span className="absolute top-0.5 right-0.5 px-1 text-[9px] font-mono bg-[#991b1b] text-[#fffbeb]">
                              {activeFilterCount}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setMobileDrawer('travel')}
                          className="min-h-[46px] px-1 py-1.5 text-xs font-bold bg-[#f8edd6]/95 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow flex flex-col items-center justify-center gap-0.5"
                        >
                          <PixelUiIcon name="search" className="w-4 h-4 shrink-0" />
                          <span className="text-[10px] leading-none truncate max-w-full">Voyage</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMobileDrawer('signals')}
                          className="relative min-h-[46px] px-1 py-1.5 text-xs font-bold bg-[#f8edd6]/95 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow flex flex-col items-center justify-center gap-0.5"
                        >
                          <PixelUiIcon name="lantern" className="w-4 h-4 shrink-0" />
                          <span className="text-[10px] leading-none truncate max-w-full">Signaux</span>
                          <span className="absolute top-0.5 right-0.5 px-1 text-[9px] font-mono bg-[#28160d] text-amber-300">
                            {sortedNearbyPois.length}
                          </span>
                        </button>

                        {simulationMode ? (
                          <button
                            type="button"
                            onClick={() => setDpadOpen((v) => !v)}
                            aria-label={dpadOpen ? 'Replier le D-Pad' : 'Déplier le D-Pad'}
                            className={`min-h-[46px] px-1 py-1.5 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow flex flex-col items-center justify-center gap-0.5 ${
                              dpadOpen
                                ? 'bg-amber-300 text-[#24160c]'
                                : 'bg-[#28160d]/95 text-amber-300'
                            }`}
                          >
                            <PixelUiIcon name="dpad" className="w-4 h-4 shrink-0" />
                            <span className="text-[10px] leading-none truncate max-w-full">D-Pad</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if ('geolocation' in navigator) {
                                navigator.geolocation.getCurrentPosition((pos) => {
                                  setPlayerPos({
                                    lat: pos.coords.latitude,
                                    lng: pos.coords.longitude,
                                  });
                                });
                              }
                            }}
                            aria-label="Recentrer sur ma position GPS"
                            className="min-h-[46px] px-1 py-1.5 text-xs font-bold bg-amber-300 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow flex flex-col items-center justify-center gap-0.5"
                          >
                            <PixelUiIcon name="gps" className="w-4 h-4 shrink-0" />
                            <span className="text-[10px] leading-none truncate max-w-full">Centrer</span>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Right 4 Cols on Desktop: Collapsible Facing Grimoire Page (Compass + Selected Signal + Radar) */}
                {!uiCollapsed && !desktopSidebarCollapsed && (
                  <aside className="hidden lg:block lg:col-span-4 space-y-3.5 max-h-[calc(100dvh-12rem)] overflow-y-auto pr-0.5">
                    <div className="relative grimoire-folio-gold p-3.5 flex items-center gap-3">
                      <PixelCornerRivets className="bg-[#d97706]" />
                      <BrassPixelCompass
                        bearingDeg={compassTarget ? compassTarget.bearingDeg : 0}
                        hot={Boolean(
                          compassTarget && !compassTarget.unlocked && compassTarget.distance <= 170
                        )}
                        compact
                      />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="text-xs font-bold font-display text-[#24160c] flex items-center justify-between gap-2">
                          <span>Boussole d’Échos</span>
                          {compassTarget && (
                            <span className="font-mono tabular-nums text-rose-900">
                              {cardinalShortFr(compassTarget.bearingDeg)} · {compassTarget.distance} m
                              {compassDeltaAlt !== null && Math.abs(compassDeltaAlt) >= 2
                                ? compassDeltaAlt > 0
                                  ? ` · +${compassDeltaAlt} m ▲`
                                  : ` · ${compassDeltaAlt} m ▼`
                                : ''}
                            </span>
                          )}
                        </div>
                        {compassTarget ? (
                          <>
                            <div className="text-xs font-bold text-amber-950 truncate">
                              {compassTarget.unlocked
                                ? compassTarget.poi.name
                                : `? ${compassTarget.poi.mysteryTitle}`}
                            </div>
                            <div className="text-[11px] text-[#54361d] truncate">
                              {compassTarget.poi.source}
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-[#54361d]">
                            En attente d’un écho sur le territoire…
                          </p>
                        )}
                      </div>
                    </div>

                    <TelluricDetectorCard
                      playerLat={playerPos.lat}
                      playerLng={playerPos.lng}
                      subterraneanMode={subterraneanMode}
                      simulationMode={simulationMode}
                      muted={muted}
                      worldChests={worldChests}
                      openedChestIds={openedChestIdSet}
                      nearbyGeocaches={mergedNearbyGeocaches}
                      foundGeocacheIds={foundGeocacheIds}
                      unlockedEntries={entries}
                      currentUserId={user ? user.uid : null}
                      onOpenArchivistChest={handleOpenArchivistChest}
                      onFocusMapTarget={handleFocusTreasureTargetOnMap}
                      onOpenBuryModal={() => setGeocacheModal({ mode: 'bury' })}
                      onInspectGeocache={(c) => setGeocacheModal({ mode: 'inspect', cache: c })}
                      onOpenReliquaryTab={() => {
                        setCarnetView('tresors');
                        setActiveTab('carnet');
                      }}
                    />

                    {renderExpeditionLoopCard()}

                    {selectedMapPoi && (
                      <motion.div
                        key={selectedMapPoi.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.16 }}
                      >
                        {renderSelectedPoiCard(false)}
                      </motion.div>
                    )}

                    {/* Nearby Signals Index with Warm Proximity Resonance Bars */}
                    <div className="relative grimoire-folio p-4 space-y-3">
                      <PixelCornerRivets className="bg-[#f59e0b]" />
                      <div className="flex items-center justify-between pb-2 border-b-2 border-[#c89d62]">
                        <h3 className="text-sm font-bold font-display text-[#24160c] flex items-center gap-2">
                          <PixelUiIcon name="lantern" className="w-4 h-4" />
                          <span>
                            {subterraneanMode
                              ? 'Échos du Sous-sol à portée'
                              : 'Signaux en Surface à portée'}
                          </span>
                        </h3>
                        <span className="text-xs font-mono tabular-nums text-rose-900 font-bold">
                          {sortedNearbyPois.length}
                        </span>
                      </div>

                      {loadingSector && sortedNearbyPois.length === 0 ? (
                        <p className="text-xs text-[#6b4928] py-6 text-center">
                          Sondage de la topologie et des 15 archives patrimoniales…
                        </p>
                      ) : sortedNearbyPois.length === 0 ? (
                        <p className="text-xs text-[#6b4928] py-6 text-center">
                          Aucun signal pour cette combinaison de filtre. Essayez « Toutes les sources ».
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                          {sortedNearbyPois.slice(0, 26).map(({ poi, distance, unlocked }) => {
                            const cat = CATEGORY_META[poi.category];
                            const isSel = selectedPoiId === poi.id;
                            const resonancePct = unlocked
                              ? 100
                              : Math.max(
                                  8,
                                  Math.min(
                                    100,
                                    Math.round(
                                      (1 - Math.max(0, distance - poi.unlockRadiusMeters) / 850) * 100
                                    )
                                  )
                                );
                            const isHot = !unlocked && distance <= poi.unlockRadiusMeters * 1.7;

                            return (
                              <button
                                key={poi.id}
                                type="button"
                                onClick={() => setSelectedPoiId(poi.id)}
                                className={`w-full text-left px-3 py-2 border-2 transition-transform duration-150 hover:-translate-y-0.5 space-y-1.5 ${
                                  isSel
                                    ? 'bg-amber-200/90 border-[#991b1b]'
                                    : 'bg-[#ecd8b1] border-[#8c653b] hover:bg-[#fffbeb] hover:border-[#2b1a0e]'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    {isSel ? (
                                      <PixelUiIcon name="cursor" className="w-3.5 h-3.5" />
                                    ) : (
                                      <PixelGuildIcon category={poi.category} className="w-4 h-4" />
                                    )}
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-[#24160c] truncate">
                                        {unlocked ? poi.name : `? ${poi.mysteryTitle}`}
                                      </div>
                                      <div className="text-[11px] text-[#54361d] mt-0.5 flex items-center gap-1.5 truncate">
                                        <span className={`font-bold ${cat.mapTextClass}`}>
                                          {cat.shortLabel}
                                        </span>
                                        <span aria-hidden="true">·</span>
                                        <span className="truncate">{poi.source}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <span
                                    className={`text-xs font-mono tabular-nums font-bold shrink-0 ${
                                      unlocked
                                        ? 'text-emerald-800'
                                        : isHot
                                        ? 'text-rose-800'
                                        : 'text-[#3b2312]'
                                    }`}
                                  >
                                    {distance} m
                                  </span>
                                </div>

                                <div className="w-full h-1 bg-[#28160d]/25 overflow-hidden">
                                  <div
                                    className={`h-full ${
                                      unlocked
                                        ? 'bg-emerald-600'
                                        : isHot
                                        ? 'bg-[#dc2626]'
                                        : 'bg-[#d97706]'
                                    }`}
                                    style={{ width: `${resonancePct}%` }}
                                  />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </aside>
                )}
              </div>

              {/* MOBILE SELECTED POI FLOATING BOTTOM SHEET (< lg) — Instant Feedback on Tap! */}
              <AnimatePresence>
                {selectedMapPoi && (
                  <motion.div
                    key={`mobile-poi-${selectedMapPoi.id}`}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 24 }}
                    transition={{ duration: 0.16 }}
                    className={`lg:hidden fixed inset-x-2.5 z-30 ${
                      uiCollapsed
                        ? 'bottom-[max(0.75rem,env(safe-area-inset-bottom))]'
                        : 'bottom-[calc(3.8rem+env(safe-area-inset-bottom))] md:bottom-4'
                    }`}
                  >
                    {renderSelectedPoiCard(true)}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ==================== VIEW 2: CARNET D'EXPLORATION ==================== */}
          {activeTab === 'carnet' && (
            <motion.div
              key="view-carnet"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="space-y-5 sm:space-y-6"
            >
              <div className="space-y-3.5 border-b-2 border-[#8c653b] pb-3.5">
                <div className="space-y-1">
                  <h1
                    className="text-xl sm:text-3xl font-bold font-display text-[#24160c] flex items-center gap-2.5"
                    style={{ textWrap: 'balance' }}
                  >
                    <PixelUiIcon name="book" className="w-6 h-6" />
                    <span>Grimoire & Carnet d’Exploration</span>
                  </h1>
                  <p className="text-xs sm:text-sm text-[#54361d] max-w-3xl">
                    Recueil enluminé de vos découvertes : feuillets scellés, bestiaire et récits
                    régionaux, frise stratigraphique, constellation d’échos et besace hors-ligne.
                  </p>
                </div>

                {/* Unified 6-Bookmark Grimoire Strip (zero jagged multi-row wrapping) */}
                <ParchmentScrollStrip fadeColorFrom="vellum" innerClassName="gap-2 py-0.5">
                  {(
                    [
                      { id: 'liste', label: `Feuillets · ${entries.length}`, icon: 'book' },
                      {
                        id: 'bestiaire',
                        label:
                          activeRumorsCount > 0
                            ? `Bestiaire & Récits · ${observedBestiaryCount}/${BESTIARY_SPECIES_CATALOG.length} (${activeRumorsCount} piste${activeRumorsCount > 1 ? 's' : ''})`
                            : `Bestiaire & Récits · ${observedBestiaryCount}/${BESTIARY_SPECIES_CATALOG.length}`,
                        icon: 'paw',
                      },
                      {
                        id: 'herbier',
                        label: `Herbier & Roches · ${specimens.length}/${SPECIMENS_CATALOG.length}`,
                        icon: 'leaf',
                      },
                      {
                        id: 'tresors',
                        label: `Trésors & Caches · ${openedChests.length}`,
                        icon: 'chest',
                      },
                      { id: 'frise', label: 'Frise des Strates', icon: 'bedrock' },
                      { id: 'constellation', label: 'Constellation', icon: 'constellation' },
                      {
                        id: 'besace',
                        label: `Besace · ${cachedSectors.length}`,
                        icon: 'backpack',
                      },
                    ] as Array<{ id: CarnetViewMode; label: string; icon: UiPixelIconName }>
                  ).map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        if (v.id === 'bestiaire' && carnetView !== 'bestiaire') {
                          setBestiaryInitialSubTab('bestiaire');
                        }
                        setCarnetView(v.id);
                        setMobileJournalDetailOpen(false);
                      }}
                      className={`min-h-[40px] px-3.5 py-2 text-xs font-bold border-2 border-[#2b1a0e] inline-flex items-center gap-2 jrpg-shadow whitespace-nowrap shrink-0 transition-colors ${
                        carnetView === v.id
                          ? 'bg-[#991b1b] text-[#fffbeb]'
                          : 'bg-[#f8edd6] text-[#24160c] hover:bg-amber-200'
                      }`}
                    >
                      <PixelUiIcon name={v.icon} className="w-3.5 h-3.5" />
                      <span>{v.label}</span>
                    </button>
                  ))}
                </ParchmentScrollStrip>
              </div>

              {carnetView === 'bestiaire' ? (
                <Suspense
                  fallback={
                    <div className="grimoire-folio p-6 text-center text-xs font-bold text-[#24160c]">
                      Ouverture du Bestiaire & des Récits locaux…
                    </div>
                  }
                >
                  <LazyBestiaryRencontresView
                    encounters={encounters}
                    rumorLeads={rumorLeads}
                    playerLat={playerPos.lat}
                    playerLng={playerPos.lng}
                    muted={muted}
                    initialSubTab={bestiaryInitialSubTab}
                    onFocusLocationOnMap={(lat, lng, isSub) => {
                      setSubterraneanMode(isSub);
                      const dist = haversineMeters(playerPos.lat, playerPos.lng, lat, lng);
                      if (dist <= 1800 && simulationMode) {
                        setDashedTracesEnabled(true);
                        setRouteRequest({ id: Date.now(), lat, lng });
                      } else {
                        teleportToLocation(lat, lng);
                      }
                      setActiveTab('carte');
                    }}
                    onOpenPostcard={setPostcardSubject}
                  />
                </Suspense>
              ) : carnetView === 'herbier' ? (
                <Suspense
                  fallback={
                    <div className="grimoire-folio p-6 text-center text-xs font-bold text-[#24160c]">
                      Ouverture de l’Herbier & de la Lithothèque…
                    </div>
                  }
                >
                  <LazyHerbariumLithothequeView
                    specimens={specimens}
                    bedrock={bedrock}
                    terrain={terrain}
                    currentRegionLabel={localAtmosphereLabel}
                    muted={muted}
                    onFocusLocationOnMap={(lat, lng, isSub) => {
                      setSubterraneanMode(isSub);
                      const dist = haversineMeters(playerPos.lat, playerPos.lng, lat, lng);
                      if (dist <= 1800 && simulationMode) {
                        setDashedTracesEnabled(true);
                        setRouteRequest({ id: Date.now(), lat, lng });
                      } else {
                        teleportToLocation(lat, lng);
                      }
                      setActiveTab('carte');
                    }}
                    onOpenPostcard={setPostcardSubject}
                  />
                </Suspense>
              ) : carnetView === 'tresors' ? (
                <Suspense
                  fallback={
                    <div className="grimoire-folio p-6 text-center text-xs font-bold text-[#24160c]">
                      Ouverture du Reliquaire & des Géocaches…
                    </div>
                  }
                >
                  <LazyTreasuresAndGeocachesView
                    openedChests={openedChests}
                    worldChests={worldChests}
                    nearbyGeocaches={mergedNearbyGeocaches}
                    foundGeocacheIds={foundGeocacheIds}
                    playerLat={playerPos.lat}
                    playerLng={playerPos.lng}
                    simulationMode={simulationMode}
                    muted={muted}
                    currentUserId={user ? user.uid : null}
                    onFocusLocationOnMap={handleFocusTreasureTargetOnMap}
                    onOpenArchivistChest={handleOpenArchivistChest}
                    onOpenBuryModal={() => setGeocacheModal({ mode: 'bury' })}
                    onInspectGeocache={(c) => setGeocacheModal({ mode: 'inspect', cache: c })}
                  />
                </Suspense>
              ) : carnetView === 'besace' ? (
                <Suspense
                  fallback={
                    <div className="grimoire-folio p-6 text-center text-xs font-bold text-[#24160c]">
                      Ouverture de la Besace…
                    </div>
                  }
                >
                  <LazyBesaceAndBackupView
                    progress={progress}
                    entries={entries}
                    fogSet={fogSet}
                    encounters={encounters}
                    rumors={rumorLeads}
                    specimens={specimens}
                    cachedSectors={cachedSectors}
                    muted={muted}
                    onSaveCurrentSector={handleSaveCurrentSectorToBesace}
                    onTeleportToSector={(lat, lng) => {
                      teleportToLocation(lat, lng);
                      setActiveTab('carte');
                    }}
                    onDeleteSector={handleDeleteBesaceSector}
                    onRestoreArchive={handleRestoreGrimoireArchive}
                  />
                </Suspense>
              ) : entries.length === 0 ? (
                <div className="grimoire-folio-gold overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
                  <div className="lg:col-span-5 border-b-2 lg:border-b-0 lg:border-r-2 border-[#2b1a0e]">
                    <ResilientPixelImage
                      src={HERO_BANNER_SRC}
                      alt="Vallée d’exploration JRPG 16-bit"
                      className="w-full h-full min-h-[200px] sm:min-h-[240px] object-cover"
                    />
                  </div>
                  <div className="lg:col-span-7 p-5 sm:p-8 flex flex-col justify-center space-y-4">
                    <h2 className="text-xl sm:text-2xl font-bold font-display text-[#24160c]">
                      Les feuillets vierges du Grimoire attendent vos pas
                    </h2>
                    <p className="text-sm text-[#54361d] leading-relaxed max-w-xl">
                      Approchez-vous d’un sceau « ? » sur la carte 16-bit pour révéler votre
                      première découverte — fouille enfouie, relique classée, voie fantôme ou
                      légende locale. Vous pouvez aussi préparer votre{' '}
                      <strong>Besace hors-ligne</strong> avant de partir en excursion.
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={() => setActiveTab('carte')}
                        className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-[#991b1b] text-[#fffbeb] border-2 border-[#2b1a0e] hover:bg-[#b91c1c] transition-transform duration-150 active:translate-y-0.5 jrpg-shadow whitespace-nowrap shrink-0"
                      >
                        <PixelUiIcon name="map" className="w-4 h-4" />
                        <span>Retourner sur la carte 16-bit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCarnetView('besace')}
                        className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-[#f8edd6] text-[#24160c] border-2 border-[#2b1a0e] hover:bg-amber-200 jrpg-shadow whitespace-nowrap shrink-0"
                      >
                        <PixelUiIcon name="backpack" className="w-4 h-4" />
                        <span>Ouvrir la Besace & Sauvegarde</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : carnetView === 'frise' ? (
                <Suspense
                  fallback={
                    <div className="grimoire-folio p-6 text-center text-xs font-bold text-[#24160c]">
                      Déploiement de la frise stratigraphique…
                    </div>
                  }
                >
                  <LazyStratigraphicFriezeView
                    entries={entries}
                    sectorPois={pois}
                    onSelectEntry={(poiId) => {
                      playJournalOpenSfx(muted);
                      setSelectedJournalPoiId(poiId);
                      setCarnetView('liste');
                      setMobileJournalDetailOpen(true);
                    }}
                    onFilterStratumOnMap={(st) => {
                      setStratumFilter(st);
                      setActiveTab('carte');
                    }}
                  />
                </Suspense>
              ) : carnetView === 'constellation' ? (
                <Suspense
                  fallback={
                    <div className="grimoire-folio p-6 text-center text-xs font-bold text-[#24160c]">
                      Tracé de la constellation d’échos…
                    </div>
                  }
                >
                  <LazyConstellationEchoesView
                    entries={entries}
                    unlockedIds={unlockedIds}
                    onOpenUnlocked={(poiId) => {
                      playJournalOpenSfx(muted);
                      setSelectedJournalPoiId(poiId);
                      setCarnetView('liste');
                      setMobileJournalDetailOpen(true);
                    }}
                    onLocateVeiledOnMap={(poiId) => {
                      setSelectedPoiId(poiId);
                      setActiveTab('carte');
                    }}
                  />
                </Suspense>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Master List (Hidden on mobile when reading an entry!) */}
                  <div
                    className={`${
                      mobileJournalDetailOpen ? 'hidden lg:block' : 'block'
                    } lg:col-span-4 grimoire-folio p-3.5 sm:p-4 space-y-2 lg:max-h-[700px] lg:overflow-y-auto`}
                  >
                    {entries.map((item) => {
                      const cat = CATEGORY_META[item.category] || CATEGORY_META.histoire;
                      const isCurrent = activeJournalEntry?.poiId === item.poiId;
                      return (
                        <button
                          key={item.poiId}
                          type="button"
                          onClick={() => {
                            playJournalOpenSfx(muted);
                            setSelectedJournalPoiId(item.poiId);
                            setMobileJournalDetailOpen(true);
                          }}
                          className={`w-full min-h-[56px] text-left p-3.5 border-2 transition-all duration-150 space-y-1 ${
                            isCurrent
                              ? 'bg-amber-200/85 border-[#991b1b]'
                              : 'bg-[#ecd8b1] border-[#8c653b] hover:bg-[#fffbeb] hover:border-[#2b1a0e]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {isCurrent ? (
                                <PixelUiIcon name="cursor" className="w-3.5 h-3.5" />
                              ) : (
                                <PixelGuildIcon category={item.category} className="w-4 h-4" />
                              )}
                              <div className="text-sm font-bold text-[#24160c] truncate">
                                {item.name}
                              </div>
                            </div>
                            <PixelUiIcon
                              name="arrow-right"
                              className="w-3.5 h-3.5 lg:hidden text-[#6b4928]"
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#54361d] pl-6">
                            <span className={`font-bold ${cat.mapTextClass}`}>{cat.shortLabel}</span>
                            <span aria-hidden="true">·</span>
                            <span>{item.eraLabel || item.subType}</span>
                            {(item.personalNote || item.photoCount > 0) && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-rose-800 font-bold">Annoté</span>
                              </>
                            )}
                            {solvedRiddleIds.has(item.poiId) && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-emerald-800 font-bold">Sceau d’Or ★</span>
                              </>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Detail Folio */}
                  <div
                    className={`${
                      mobileJournalDetailOpen ? 'block' : 'hidden lg:block'
                    } lg:col-span-8`}
                  >
                    {activeJournalEntry && (
                      <Suspense
                        fallback={
                          <div className="grimoire-folio p-6 text-center text-xs font-bold text-[#24160c]">
                            Ouverture du feuillet enluminé…
                          </div>
                        }
                      >
                        <LazyEntryDetailPanel
                          entry={activeJournalEntry}
                          unlockedIds={unlockedIds}
                          explorerCallsign={progress.displayName}
                          explorerAppearance={explorerAppearance}
                          pinnedTrophyId={progress.pinnedTrophyId}
                          altitudeMeters={sampleElevationMeters(
                            elevation,
                            activeJournalEntry.lat,
                            activeJournalEntry.lng
                          )}
                          currentUser={cloudOnline ? user : null}
                          muted={muted}
                          onRequestCloudSignIn={handleAuthAction}
                          onSaveJournalAnnotation={handleSaveJournalAnnotation}
                          onNavigateToRelatedPoi={handleNavigateToRelatedPoi}
                          onOpenPostcard={setPostcardSubject}
                          isRiddleSolved={solvedRiddleIds.has(activeJournalEntry.poiId)}
                          onOpenRiddle={(entry) => setActiveRiddleEntry(entry)}
                          onBackToList={
                            mobileJournalDetailOpen
                              ? () => setMobileJournalDetailOpen(false)
                              : undefined
                          }
                        />
                      </Suspense>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ==================== VIEW 3: ALMANACH CALENDAIRE, CHASSES AUX TRÉSORS, CONTRATS & QUÊTES ==================== */}
          {activeTab === 'missions' && (
            <motion.div
              key="view-missions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="space-y-5 sm:space-y-6"
            >
              <div className="border-b-2 border-[#8c653b] pb-3.5 sm:pb-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div className="space-y-1">
                    <h1
                      className="text-xl sm:text-3xl font-bold font-display text-[#24160c] flex items-center gap-2.5"
                      style={{ textWrap: 'balance' }}
                    >
                      <PixelUiIcon name="scroll" className="w-6 h-6" />
                      <span>Almanach, Pistes aux Trésors & Quêtes</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-[#54361d] max-w-3xl">
                      Saisons astronomiques, fêtes thématiques et anniversaires historiques (globaux
                      & locaux), chasses aux trésors par indices, contrats de secteur et quêtes des
                      cinq Guildes.
                    </p>
                  </div>
                  <div className="text-xs font-mono tabular-nums text-[#54361d] shrink-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-bold text-amber-950">
                      {solvedRiddleIds.size} Sceau{solvedRiddleIds.size > 1 ? 'x' : ''} d’Or
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {Math.max(progress.completedContractsCount || 0, claimedContracts.size)}{' '}
                      contrats
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-bold text-rose-900">
                      {progress.completedMissions.length}/{MISSIONS_CATALOG.length} quêtes
                    </span>
                  </div>
                </div>

                {/* Clean 4-Bookmark Horizontal Selector (Zero Mobile Wrapping!) */}
                <ParchmentScrollStrip fadeColorFrom="vellum" innerClassName="gap-2 py-0.5">
                  {(
                    [
                      {
                        id: 'almanach',
                        label: `Almanach & Calendrier · ${SEASON_META[resolveSeasonForDate()].nameFr}`,
                        icon: 'star',
                      },
                      {
                        id: 'chasse',
                        label: isCurrentHuntCompleted
                          ? 'Chasse au Trésor ✓'
                          : currentSectorHunt
                          ? `Chasse au Trésor · ${currentHuntStepIdx + 1}/${currentSectorHunt.steps.length}`
                          : 'Chasse au Trésor',
                        icon: 'chest',
                      },
                      {
                        id: 'contrats',
                        label: `Contrats du Secteur · ${dynamicContracts.length}`,
                        icon: 'pocket-compass',
                      },
                      {
                        id: 'guildes',
                        label: `Quêtes & Trophées · ${progress.completedMissions.length}/${MISSIONS_CATALOG.length}`,
                        icon: 'trophy',
                      },
                    ] as Array<{
                      id: 'almanach' | 'chasse' | 'contrats' | 'guildes';
                      label: string;
                      icon: UiPixelIconName;
                    }>
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMissionsSubTab(tab.id)}
                      className={`min-h-[44px] px-3.5 py-2 text-xs font-bold border-2 border-[#2b1a0e] inline-flex items-center gap-2 jrpg-shadow whitespace-nowrap shrink-0 transition-colors ${
                        missionsSubTab === tab.id
                          ? 'bg-[#991b1b] text-[#fffbeb]'
                          : 'bg-[#f8edd6] text-[#24160c] hover:bg-amber-200'
                      }`}
                    >
                      <PixelUiIcon name={tab.icon} className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </ParchmentScrollStrip>
              </div>

              {/* SUB-TAB 1: ALMANACH DES SAISONS, FÊTES & ÉPHÉMÉRIDES (GLOBAL + LOCAL) */}
              {missionsSubTab === 'almanach' && (
                <AlmanacSeasonalPanel
                  almanacData={almanacData}
                  loadingAlmanac={loadingAlmanac}
                  previewMonthDay={almanacPreviewDate}
                  onChangePreviewDate={setAlmanacPreviewDate}
                  regionalTheme={regionalTheme}
                  localAtmosphereLabel={localAtmosphereLabel}
                  evalContext={almanacEvalContext}
                  claimedAlmanacQuests={claimedAlmanacQuests}
                  muted={muted}
                  onClaimAlmanacReward={handleClaimAlmanacReward}
                  onOpenCosmeticWorkshop={(slot) => openWorkshopAtSlot(slot || 'familiar')}
                  onFocusLocationOnMap={(lat, lng) => {
                    teleportToLocation(lat, lng);
                    setActiveTab('carte');
                  }}
                  onFilterCategoryOnMap={(cat) => {
                    setCategoryFilter(cat);
                    setActiveTab('carte');
                  }}
                />
              )}

              {/* SUB-TAB 2: CHASSE AU TRÉSOR PAR PISTE D'INDICES */}
              {missionsSubTab === 'chasse' && (
                <ClueTreasureHuntPanel
                  hunt={currentSectorHunt}
                  activeStepIdx={currentHuntStepIdx}
                  isCompleted={isCurrentHuntCompleted}
                  completedHuntsCount={Math.max(
                    progress.completedHuntsCount || 0,
                    completedHuntIds.size
                  )}
                  isTrackingOnMap={trackingHuntOnMap}
                  playerLat={playerPos.lat}
                  playerLng={playerPos.lng}
                  simulationMode={simulationMode}
                  muted={muted}
                  onToggleTrackOnMap={(track) => {
                    setTrackingHuntOnMap(track);
                    if (track) setActiveTab('carte');
                  }}
                  onSimulateWalkTowardStep={(lat, lng, isSub) => {
                    setSubterraneanMode(isSub);
                    setTrackingHuntOnMap(true);
                    setDashedTracesEnabled(true);
                    setRouteRequest({ id: Date.now(), lat, lng });
                    setActiveTab('carte');
                  }}
                  onClaimStepHere={handleAdvanceCurrentHuntStep}
                  onOpenCosmeticWorkshop={(slot) => openWorkshopAtSlot(slot || 'familiar')}
                />
              )}

              {/* SUB-TAB 4 (HEADER): 16-Bit Trophy Showcase Strip */}
              {missionsSubTab === 'guildes' && (
                <div className="relative grimoire-folio-gold p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <PixelCornerRivets className="bg-[#d97706]" />
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#54361d]">
                      <span className="font-bold text-rose-900 inline-flex items-center gap-1.5">
                        <PixelUiIcon name="trophy" className="w-4 h-4" />
                        <span>Médaillier d’Exploits 16-Bit</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums font-bold text-[#24160c]">
                        {unlockedTrophyIds.size} / {TROPHIES_CATALOG.length} ciselées
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Titre porté :{' '}
                        <strong className="text-[#24160c]">{explorerTitleInfo.title}</strong>
                      </span>
                    </div>
                    <p className="text-xs text-[#4a321d]">
                      Débloquez les médailles de marcheur (Oiseau de nuit, Marcheur d’orage,
                      Spéléologue, 10 km / 50 km, Maître des 7 roches, Bornes IGN) et épinglez votre
                      titre sur votre profil et vos cartes postales.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5 bg-[#28160d] border-2 border-[#6b4928] px-2.5 py-1.5">
                      {evaluatedTrophies.slice(0, 6).map((item) => (
                        <div
                          key={item.trophy.id}
                          title={`${item.trophy.name} (${item.current}/${item.target} ${item.trophy.unitLabel})`}
                        >
                          <TrophyBadgeCanvas
                            trophyId={item.trophy.id}
                            unlocked={item.unlocked}
                            pixelScale={1}
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileInitialTab('trophees');
                        setActiveTab('profil');
                      }}
                      className="min-h-[42px] px-4 py-2 text-xs font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-[#2b1a0e] inline-flex items-center gap-2 jrpg-shadow whitespace-nowrap"
                    >
                      <PixelUiIcon name="trophy" className="w-4 h-4" />
                      <span>Ouvrir la Salle des Trophées</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SUB-TAB 3: 3 Dynamic Local Sector Contracts */}
              {missionsSubTab === 'contrats' && dynamicContracts.length === 0 && (
                <div className="grimoire-folio p-6 text-center text-xs font-semibold text-[#54361d]">
                  Chargement des contrats topographiques et patrimoniaux du secteur…
                </div>
              )}
              {missionsSubTab === 'contrats' && dynamicContracts.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base sm:text-lg font-bold font-display text-[#24160c] flex items-center gap-2">
                      <PixelUiIcon name="pocket-compass" className="w-4 h-4" />
                      <span>Contrats de Terrain · {localAtmosphereLabel}</span>
                    </h2>
                    <div className="text-xs text-[#54361d] flex items-center gap-2">
                      <span>Secteur réel</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums font-bold text-rose-900">
                        {weather ? `${Math.round(weather.tempC)}°C · ${weather.labelFr}` : daytimeMood.label}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {dynamicContracts.map((contract) => {
                      const ev = evaluateDynamicContract(contract, {
                        entries,
                        openedChests,
                        visitedStepIds: visitedContractSteps,
                      });
                      const isDone = claimedContracts.has(contract.id) || ev.current >= ev.target;
                      const catMeta = CATEGORY_META[contract.category];
                      const effectiveXp =
                        contract.xpBonus +
                        (contract.isWeatherBonusActive ? contract.weatherBonusXp : 0);

                      return (
                        <div
                          key={contract.id}
                          className={`relative p-4 sm:p-5 flex flex-col justify-between gap-3 ${
                            isDone
                              ? 'bg-[#ecfdf5] border-2 border-emerald-800 jrpg-shadow'
                              : 'grimoire-folio'
                          }`}
                        >
                          <PixelCornerRivets
                            className={isDone ? 'bg-emerald-600' : 'bg-[#d97706]'}
                          />

                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between gap-2 text-xs text-[#54361d]">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <PixelGuildIcon category={contract.category} className="w-4 h-4 shrink-0" />
                                <span className="truncate font-semibold">{contract.kicker}</span>
                                <span aria-hidden="true">·</span>
                                <span className={`font-bold shrink-0 ${catMeta.mapTextClass}`}>
                                  {catMeta.shortLabel}
                                </span>
                              </div>
                              <span className="font-mono tabular-nums font-bold text-emerald-800 shrink-0">
                                +{effectiveXp} XP
                              </span>
                            </div>

                            <h3 className="text-base sm:text-lg font-bold font-display text-[#24160c] leading-snug">
                              {contract.title}
                            </h3>

                            <p className="text-xs text-[#4a321d] leading-relaxed">
                              {contract.description}
                            </p>

                            {contract.weatherConditionLabel && (
                              <div
                                className={`text-[11px] flex items-center gap-1.5 ${
                                  contract.isWeatherBonusActive
                                    ? 'text-emerald-900 font-bold'
                                    : 'text-[#6b4928]'
                                }`}
                              >
                                <PixelUiIcon
                                  name={contract.isWeatherBonusActive ? 'rain' : 'sun-cloud'}
                                  className="w-3.5 h-3.5 shrink-0"
                                />
                                <span>{contract.weatherConditionLabel}</span>
                              </div>
                            )}

                            {/* Step-by-step real-world anchors */}
                            {contract.steps.length > 0 && (
                              <div className="pt-2 border-t border-[#c89d62]/70 space-y-1.5">
                                {contract.steps.map((step, sIdx) => {
                                  const stepDone = isDone || ev.completedStepIds.has(step.id);
                                  const distM = Math.round(
                                    haversineMeters(
                                      playerPos.lat,
                                      playerPos.lng,
                                      step.lat,
                                      step.lng
                                    )
                                  );
                                  return (
                                    <div
                                      key={step.id}
                                      className="flex items-center justify-between gap-2 text-xs py-1"
                                    >
                                      <div className="min-w-0 flex items-baseline gap-1.5">
                                        <span className="font-mono tabular-nums font-bold text-rose-900 shrink-0">
                                          {stepDone ? '✓' : `${String(sIdx + 1).padStart(2, '0')}.`}
                                        </span>
                                        <span
                                          className={`truncate ${
                                            stepDone
                                              ? 'line-through text-emerald-900/80 font-medium'
                                              : 'text-[#24160c] font-semibold'
                                          }`}
                                        >
                                          {step.label}
                                        </span>
                                        <span aria-hidden="true" className="text-[#8c653b]">
                                          ·
                                        </span>
                                        <span className="text-[11px] text-[#6b4928] shrink-0">
                                          {step.shortTag}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="font-mono tabular-nums text-[11px] text-[#54361d]">
                                          {distM >= 1000
                                            ? `${(distM / 1000).toFixed(1)} km`
                                            : `${distM} m`}
                                        </span>
                                        {!stepDone && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleTargetContractStep(step, contract.category)
                                            }
                                            className="px-2 py-0.5 text-[11px] font-bold bg-[#ecd8b1] hover:bg-amber-300 text-[#24160c] border border-[#2b1a0e] transition-colors"
                                          >
                                            Cibler
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-[#c89d62]/70 space-y-2.5">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                                <span
                                  className={
                                    isDone
                                      ? 'text-emerald-800 font-sans font-bold'
                                      : 'text-[#54361d] font-sans font-semibold'
                                  }
                                >
                                  {isDone ? 'Contrat honoré ✓' : 'Avancement sur le secteur'}
                                </span>
                                <span className="font-bold text-[#24160c]">
                                  {ev.current} / {ev.target}
                                </span>
                              </div>
                              <div className="w-full h-2 pixel-gauge-track overflow-hidden">
                                <div
                                  className={`h-full ${isDone ? 'bg-emerald-500' : 'bg-[#d97706]'}`}
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      Math.round((ev.current / Math.max(1, ev.target)) * 100)
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>

                            {!isDone && (
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                {contract.steps.length > 1 ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleLaunchContractLoop(contract, ev.completedStepIds)
                                    }
                                    className="min-h-[38px] px-3 py-1.5 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 jrpg-shadow"
                                  >
                                    <PixelUiIcon name="pocket-compass" className="w-3.5 h-3.5" />
                                    <span>Lancer la boucle</span>
                                  </button>
                                ) : contract.steps.length === 1 ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleTargetContractStep(
                                        contract.steps[0],
                                        contract.category
                                      )
                                    }
                                    className="min-h-[38px] px-3 py-1.5 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 jrpg-shadow"
                                  >
                                    <PixelUiIcon name="cursor" className="w-3.5 h-3.5" />
                                    <span>Localiser sur la carte</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCategoryFilter(contract.category);
                                      setActiveTab('carte');
                                    }}
                                    className="text-xs font-bold text-rose-900 hover:text-rose-700 underline underline-offset-4 inline-flex items-center gap-1"
                                  >
                                    <PixelUiIcon name="cursor" className="w-3 h-3" />
                                    <span>Filtrer sur la carte 16-bit</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {missionsSubTab === 'guildes' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  {MISSIONS_CATALOG.map((mission, idx) => {
                  const unlocked = isMissionUnlocked(mission, progress);
                  const completed = progress.completedMissions.includes(mission.id);
                  const evalState = mission.evaluate(entries);
                  const catLabel =
                    mission.category === 'global'
                      ? 'Guilde Générale'
                      : CATEGORY_META[mission.category].label;
                  const catColor =
                    mission.category === 'global'
                      ? 'text-amber-900'
                      : CATEGORY_META[mission.category].mapTextClass;

                  return (
                    <div
                      key={mission.id}
                      className={`relative p-4 sm:p-5 transition-transform duration-150 hover:-translate-y-0.5 space-y-3 ${
                        completed
                          ? 'bg-[#ecfdf5] border-2 border-emerald-800 jrpg-shadow'
                          : unlocked
                          ? 'grimoire-folio'
                          : 'grimoire-well opacity-75'
                      }`}
                    >
                      <PixelCornerRivets
                        className={completed ? 'bg-emerald-600' : 'bg-[#f59e0b]'}
                      />
                      <div className="flex items-center justify-between gap-2 text-xs text-[#54361d]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {mission.category === 'global' ? (
                            <PixelUiIcon name="star" className="w-4 h-4" />
                          ) : (
                            <PixelGuildIcon category={mission.category} className="w-4 h-4" />
                          )}
                          <span className="font-mono tabular-nums text-rose-800 font-bold">
                            {String(idx + 1).padStart(2, '0')}.
                          </span>
                          <span className="truncate">{mission.arcName}</span>
                          <span aria-hidden="true">·</span>
                          <span className={`font-bold truncate ${catColor}`}>{catLabel}</span>
                        </div>
                        <span className="font-mono tabular-nums font-bold text-emerald-800 shrink-0">
                          +{mission.xpBonus} XP
                        </span>
                      </div>

                      <h2 className="text-base sm:text-lg font-bold font-display text-[#24160c]">
                        {unlocked ? mission.title : 'Parchemin scellé par rang de Guilde'}
                      </h2>

                      <p className="text-xs text-[#4a321d] leading-relaxed">
                        {unlocked
                          ? mission.description
                          : `Atteignez le Niveau ${mission.requiredCategoryLevel} dans la branche ${catLabel} pour desceller cet objectif.`}
                      </p>

                      {unlocked && (
                        <div className="pt-2 space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                            <span
                              className={
                                completed
                                  ? 'text-emerald-800 font-sans font-bold'
                                  : 'text-[#54361d] font-sans font-semibold'
                              }
                            >
                              {completed ? 'Quête accomplie !' : 'Avancement'}
                            </span>
                            <span className="text-[#24160c] font-bold">
                              {evalState.current} / {evalState.target}
                            </span>
                          </div>
                          <div className="w-full h-2.5 pixel-gauge-track overflow-hidden">
                            <div
                              className={`h-full transition-transform duration-200 origin-left ${
                                completed ? 'bg-emerald-500' : 'bg-[#b91c1c]'
                              }`}
                              style={{
                                transform: `scaleX(${Math.min(
                                  1,
                                  evalState.current / Math.max(1, evalState.target)
                                )})`,
                              }}
                            />
                            <div className="pointer-events-none absolute inset-0 pixel-gauge-segments" />
                          </div>
                        </div>
                      )}

                      {(() => {
                        const cosmeticRewards = getCosmeticRewardsForMission(mission.id);
                        if (cosmeticRewards.length === 0) return null;
                        return (
                          <div className="pt-2 border-t border-[#c89d62] space-y-1.5 text-xs">
                            {cosmeticRewards.map((cosmeticReward) => (
                              <div
                                key={`${mission.id}_${cosmeticReward.slot}_${cosmeticReward.id}`}
                                className="flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0 flex items-center gap-1.5 text-[#3b2312]">
                                  <PixelUiIcon
                                    name={cosmeticReward.slot === 'familiar' ? 'star' : 'relic'}
                                    className="w-3.5 h-3.5 shrink-0 text-amber-800"
                                  />
                                  <span className="truncate">
                                    {cosmeticReward.slot === 'familiar' ? 'Familier' : 'Cosmétique'} :{' '}
                                    <strong>{cosmeticReward.name}</strong>
                                  </span>
                                </div>
                                {completed ? (
                                  <button
                                    type="button"
                                    onClick={() => openWorkshopAtSlot(cosmeticReward.slot)}
                                    className="min-h-[34px] px-2.5 py-1 text-[11px] font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border border-[#2b1a0e] whitespace-nowrap shrink-0"
                                  >
                                    {cosmeticReward.slot === 'familiar'
                                      ? 'Adopter au Profil'
                                      : 'Équiper au Profil'}
                                  </button>
                                ) : (
                                  <span className="text-[11px] font-mono text-rose-900 font-semibold shrink-0">
                                    À débloquer
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
                </div>
              )}
            </motion.div>
          )}

          {/* ==================== VIEW 4: GUILDES, TALENTS & GARDE-ROBE 16-BIT ==================== */}
          {activeTab === 'branches' && (
            <motion.div
              key="view-branches"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="space-y-5 sm:space-y-6"
            >
              <div className="grimoire-folio-gold overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
                <div className="lg:col-span-7 p-5 sm:p-8 flex flex-col justify-center space-y-3">
                  <div className="text-xs font-bold text-rose-800 font-mono tabular-nums inline-flex items-center gap-2">
                    <PixelUiIcon name="shield" className="w-4 h-4" />
                    <span>
                      Rang global · Niveau {globalLevelInfo.level} · {progress.totalXp} XP
                    </span>
                  </div>
                  <h1
                    className="text-xl sm:text-3xl font-bold font-display text-[#24160c]"
                    style={{ textWrap: 'balance' }}
                  >
                    Cinq Guildes, Talents de Terrain & Garde-Robe 16-Bit
                  </h1>
                  <p className="text-xs sm:text-sm text-[#54361d] leading-relaxed max-w-2xl">
                    Chaque Guilde éveille des capacités actives sur le terrain (fils d’Ariane,
                    coupe géomancienne, lanterne spectrale, dissipation du brouillard, bonus
                    crépusculaire) et débloque des tenues d’expédition 16-bit.
                  </p>
                </div>
                <div className="lg:col-span-5 border-t-2 lg:border-t-0 lg:border-l-2 border-[#2b1a0e]">
                  <ResilientPixelImage
                    src={HERO_BANNER_SRC}
                    alt="Vallée 16-bit de Terra 16"
                    className="w-full h-full min-h-[180px] sm:min-h-[210px] object-cover"
                  />
                </div>
              </div>

              {/* Explorer Callsign & 6 Unlockable 16-Bit Outfits Wardrobe */}
              <div className="relative grimoire-folio p-4 sm:p-6 space-y-4">
                <PixelCornerRivets className="bg-[#f59e0b]" />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b-2 border-[#c89d62] pb-3.5">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold font-display text-[#24160c] flex items-center gap-2">
                      <PixelUiIcon name="boot" className="w-5 h-5" />
                      <span>Garde-Robe d’Expédition 16-Bit & Nom d’Éclaireur</span>
                    </h2>
                    <p className="text-xs text-[#54361d]">
                      Personnalisez votre sprite sur la carte 16-bit ainsi que la signature gravée
                      sur vos Cartes Souvenir et vos Cairns d’Éclaireurs.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <form onSubmit={handleSaveCallsign} className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={60}
                        value={callsignDraft}
                        onChange={(e) => setCallsignDraft(e.target.value)}
                        placeholder="Surnom d’éclaireur…"
                        className="min-h-[38px] w-40 sm:w-48 bg-[#ecd8b1] border-2 border-[#6b4928] px-3 py-1.5 text-xs font-bold text-[#24160c] focus:outline-none focus:bg-[#fffdf7] focus:border-[#2b1a0e]"
                      />
                      <button
                        type="submit"
                        className="min-h-[38px] px-3 py-1.5 text-xs font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow whitespace-nowrap"
                      >
                        {callsignSavedNotice ? 'Gravé ✓' : 'Signer'}
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => setActiveTab('profil')}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 jrpg-shadow whitespace-nowrap shrink-0"
                    >
                      <PixelUiIcon name="user-profile" className="w-3.5 h-3.5" />
                      <span>Atelier complet & Profil</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {OUTFITS_CATALOG.map((outfit) => {
                    const unlocked = isOutfitUnlocked(outfit, progress);
                    const equipped = (progress.outfitId || 'arpenteur') === outfit.id;
                    return (
                      <div
                        key={outfit.id}
                        className={`p-3.5 border-2 flex items-center gap-3.5 transition-colors ${
                          equipped
                            ? 'bg-amber-200/90 border-[#991b1b] jrpg-shadow'
                            : unlocked
                            ? 'bg-[#ecd8b1] border-[#6b4928] hover:bg-[#fffbeb]'
                            : 'bg-[#e3cfa6]/65 border-[#8c653b] opacity-75'
                        }`}
                      >
                        <div className="p-2 bg-[#28160d] border-2 border-[#d97706] shrink-0">
                          <PixelOutfitSpritePreview
                            outfit={outfit}
                            baseAppearance={explorerAppearance}
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="text-sm font-bold font-display text-[#24160c] truncate">
                            {outfit.name}
                          </div>
                          <p className="text-[11px] text-[#54361d] leading-snug">
                            {outfit.subtitle}
                          </p>
                          <div>
                            {equipped ? (
                              <span className="inline-block px-2.5 py-1 text-[11px] font-bold bg-[#991b1b] text-[#fffbeb] border border-[#2b1a0e]">
                                Tenue équipée
                              </span>
                            ) : unlocked ? (
                              <button
                                type="button"
                                onClick={() => handleEquipOutfit(outfit.id)}
                                className="min-h-[34px] px-3 py-1 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow"
                              >
                                Équiper sur la carte
                              </button>
                            ) : (
                              <span className="text-[11px] font-mono font-bold text-rose-900 break-words">
                                {outfit.lockRequirementLabel
                                  ? `Scellé · ${outfit.lockRequirementLabel}`
                                  : `Scellé · Niv.${outfit.requiredLevel}${
                                      outfit.requiredCategory
                                        ? ` ${CATEGORY_META[outfit.requiredCategory].shortLabel}`
                                        : ''
                                    }`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {CATEGORY_ORDER.map((catKey) => {
                  const meta = CATEGORY_META[catKey];
                  const xp = getCategoryXp(progress, catKey);
                  const lvlInfo = computeLevelFromXp(xp);
                  const catCount = entries.filter((e) => e.category === catKey).length;
                  const perkInfo = GUILD_PERK_DESCRIPTIONS[catKey];

                  return (
                    <div
                      key={catKey}
                      className="relative grimoire-folio p-4 sm:p-6 flex items-start gap-4 sm:gap-5 transition-transform duration-150 hover:-translate-y-0.5"
                    >
                      <PixelCornerRivets className="bg-[#f59e0b]" />
                      <ResilientPixelImage
                        src={meta.emblemSrc}
                        alt={meta.label}
                        fallbackLabel={meta.shortLabel}
                        className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-[#2b1a0e] jrpg-shadow shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span
                              className={`font-bold inline-flex items-center gap-1.5 ${meta.mapTextClass}`}
                            >
                              <PixelGuildIcon category={catKey} className="w-4 h-4" />
                              <span>
                                Niveau {lvlInfo.level} · {meta.guildRankTitle}
                              </span>
                            </span>
                            <span className="font-mono tabular-nums text-[#54361d] font-semibold">
                              {xp} / {lvlInfo.nextLevelXp} XP · {catCount} lieu
                              {catCount > 1 ? 'x' : ''}
                            </span>
                          </div>
                          <h2 className="text-lg sm:text-xl font-bold font-display text-[#24160c]">
                            {meta.label}
                          </h2>
                          <p className="text-xs text-[#4a321d] leading-relaxed">{meta.tagline}</p>
                        </div>

                        {/* Active Field Perk Section */}
                        <div className="pt-2.5 border-t border-[#c89d62] space-y-1 text-xs">
                          <div className="font-bold text-[#24160c] flex items-center justify-between gap-2">
                            <span>Talent : {perkInfo.perkName}</span>
                            <span className="text-emerald-800 font-semibold">Palier actif</span>
                          </div>
                          <p className="text-xs text-[#3b2312] leading-snug">
                            {perkInfo.tier1}
                          </p>
                          <p
                            className={`text-xs font-semibold ${
                              lvlInfo.level >= 2 ? 'text-emerald-800' : 'text-[#6b4928]'
                            }`}
                          >
                            {perkInfo.tier2}
                          </p>
                        </div>

                        <div className="w-full h-3 pixel-gauge-track overflow-hidden">
                          <div
                            className={`h-full ${meta.accentBgClass} transition-transform duration-200 origin-left`}
                            style={{
                              transform: `scaleX(${Math.max(0.03, lvlInfo.progressPct / 100)})`,
                            }}
                          />
                          <div className="pointer-events-none absolute inset-0 pixel-gauge-segments" />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setCategoryFilter(catKey);
                            setActiveTab('carte');
                          }}
                          className="min-h-[40px] sm:min-h-0 inline-flex items-center gap-1.5 text-xs font-bold text-rose-900 hover:text-rose-700 underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
                        >
                          <PixelUiIcon name="cursor" className="w-3.5 h-3.5" />
                          <span>Traquer ces signaux sur la carte 16-bit</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
          {/* ==================== VIEW 5: PROFIL D’ÉCLAIREUR, HISTORIQUE & ATELIER 16-BIT ==================== */}
          {activeTab === 'profil' && (
            <motion.div
              key="view-profil"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              <Suspense
                fallback={
                  <div className="grimoire-folio p-6 text-center text-xs font-bold text-[#24160c]">
                    Ouverture de la Fiche d’Éclaireur & de l’Atelier 16-Bit…
                  </div>
                }
              >
                <LazyExplorerProfileView
                  progress={progress}
                  entries={entries}
                  sectorPois={pois}
                  fogCellsCount={fogSet.size}
                  sessionMeters={sessionMeters}
                  sessionElevGainM={sessionElevGainM}
                  timeMode={timeMode}
                  muted={muted}
                  user={user}
                  evaluatedTrophies={evaluatedTrophies}
                  initialSectionTab={profileInitialTab}
                  initialWorkshopSlot={profileInitialWorkshopSlot}
                  onPinTrophy={handlePinTrophy}
                  onUpdateAppearance={handleUpdateAppearance}
                  onSaveCallsign={handleSaveCallsignDirect}
                  onAuthAction={handleAuthAction}
                  onOpenJournalEntry={openJournalEntry}
                  onLocatePoiOnMap={(entry) => {
                    teleportToLocation(entry.lat, entry.lng);
                    setSelectedPoiId(entry.poiId);
                    setActiveTab('carte');
                  }}
                  onNavigateToMissions={() => setActiveTab('missions')}
                  onNavigateToActivity={(activity) => {
                    if (activity === 'enigmes') {
                      setCarnetView('liste');
                      setActiveTab('carnet');
                      return;
                    }
                    setMissionsSubTab(activity);
                    setActiveTab('missions');
                  }}
                  onResetCharacter={handleResetCharacter}
                  onExportBackup={() =>
                    exportGrimoireArchiveJson(
                      progress,
                      entries,
                      fogSet,
                      encounters,
                      rumorLeads,
                      specimens
                    )
                  }
                />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {!isMapUiFolded && (
        <>
          <div className="hidden lg:block pixel-checker-border w-full mt-2" aria-hidden="true" />
          <footer className="hidden lg:flex py-3 px-6 text-xs text-[#54361d] font-medium flex-wrap items-center justify-between gap-4 max-w-[1440px] w-full mx-auto">
            <span>Terra 16 · Exploration respectueuse du patrimoine, des souterrains et du vivant</span>
            <span>
              OSM Z15 · IGN BD TOPO & Lieux-Dits · Archéologie INRAP · INPN Géosites INPG & ZNIEFF ·
              Mérimée, Palissy & Joconde · Friches & Rails · BRGM Hub’Eau · Folklore, Lettres & Cinéma ·
              Macrostrat, Paleobio DB, iNaturalist & GBIF
            </span>
          </footer>

          {/* FIXED BOTTOM 16-BIT GUILD NAVIGATION DOCK ON SMARTPHONES (< md) */}
          <nav
            aria-label="Navigation principale mobile"
            className="md:hidden fixed bottom-0 left-0 right-0 z-30 grimoire-bottom-dock grid grid-cols-5 items-stretch pb-safe"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'carnet') {
                      playJournalOpenSfx(muted);
                      setMobileJournalDetailOpen(false);
                    }
                    setActiveTab(item.id);
                  }}
                  className={`relative min-h-[54px] px-1 py-1.5 flex flex-col items-center justify-center gap-1 transition-colors ${
                    isActive ? 'text-amber-300 bg-[#3b2113]' : 'text-[#e8d5b5] hover:text-[#fffbeb]'
                  }`}
                >
                  {isActive && (
                    <span
                      className="absolute top-0 left-2 right-2 h-0.5 bg-[#fde047]"
                      aria-hidden="true"
                    />
                  )}
                  <PixelUiIcon name={item.icon} className="w-4 h-4" />
                  <span className="text-[11px] font-display font-bold leading-none truncate max-w-full">
                    {item.shortLabel}
                  </span>
                </button>
              );
            })}
          </nav>
        </>
      )}

      {renderOverlayDrawers()}
      {renderPostcardModal()}
      {renderGeocacheModal()}
      {renderRiddleModal()}
    </div>
  );
}
