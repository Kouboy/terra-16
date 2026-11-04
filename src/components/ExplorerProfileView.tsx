import React, { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ALL_COSMETIC_ITEMS,
  AVATAR_PRESETS,
  computeExplorerHonorificTitle,
  CosmeticItemDef,
  EXPLORER_GENDERS,
  FAMILIAR_CATALOG,
  getCosmeticRewardsForMission,
  getCosmeticUnlockStatus,
  HEADGEAR_CATALOG,
  isCosmeticUnlocked,
  OUTFIT_COSMETICS_CATALOG,
  PACK_CATALOG,
  resolveExplorerAppearance,
  SKIN_TONES,
  TOOL_CATALOG,
} from '../explorerAvatar';
import { isMissionUnlocked, MISSIONS_CATALOG } from '../missions';
import { playStampSfx } from '../sound';
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  computeLevelFromXp,
  ExplorationCategory,
  ExplorerAppearance,
  ExplorerAvatarPreset,
  ExplorerFamiliarId,
  ExplorerGender,
  ExplorerHeadgearId,
  ExplorerOutfitId,
  ExplorerPackId,
  ExplorerProgress,
  ExplorerSkinTone,
  ExplorerToolId,
  getCategoryXp,
  PoiItem,
  STRATUM_META,
  STRATUM_ORDER,
  TimeOfDayMode,
  TrophyId,
  UnlockedEntry,
} from '../types';
import {
  EvaluatedTrophy,
  getGenderedTrophyTitle,
  resolveExplorerDisplayTitle,
  TROPHIES_CATALOG,
  TROPHY_TIER_META,
  TrophyBadgeCanvas,
} from '../trophies';
import { ExplorerSpriteCanvas } from './ExplorerAvatarCanvas';
import { ParchmentScrollStrip } from './ParchmentScrollStrip';
import { PixelCornerRivets, PixelGuildIcon, PixelStratumIcon, PixelUiIcon } from './PixelIcons';

export type ProfileSectionTab = 'atelier' | 'trophees' | 'historique' | 'hauts_faits';
export type WorkshopSlotTab = 'visage' | 'familiar' | 'headgear' | 'outfit' | 'tool' | 'pack';
type TrophyFilterMode = 'all' | 'unlocked' | 'locked';

interface ExplorerProfileViewProps {
  progress: ExplorerProgress;
  entries: UnlockedEntry[];
  sectorPois: PoiItem[];
  fogCellsCount: number;
  sessionMeters: number;
  sessionElevGainM: number;
  timeMode: TimeOfDayMode;
  muted: boolean;
  user: User | null;
  evaluatedTrophies: EvaluatedTrophy[];
  initialSectionTab?: ProfileSectionTab;
  initialWorkshopSlot?: WorkshopSlotTab;
  onPinTrophy: (trophyId: TrophyId | '') => void;
  onUpdateAppearance: (patch: Partial<ExplorerAppearance>) => void;
  onSaveCallsign: (newName: string) => void;
  onAuthAction: () => void;
  onOpenJournalEntry: (poiId: string) => void;
  onLocatePoiOnMap: (entry: UnlockedEntry) => void;
  onNavigateToMissions: () => void;
  onNavigateToActivity?: (
    activity: 'almanach' | 'chasse' | 'enigmes' | 'guildes' | 'narratives' | 'defis'
  ) => void;
  onResetCharacter: () => Promise<void>;
  onExportBackup: () => Promise<void>;
}

function formatFrenchDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Date inconnue';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return 'Date inconnue';
  }
}

function formatDistanceLabel(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2).replace('.', ',')} km`;
  }
  return `${Math.round(meters)} m`;
}

export const ExplorerProfileView: React.FC<ExplorerProfileViewProps> = ({
  progress,
  entries,
  sectorPois,
  fogCellsCount,
  sessionMeters,
  sessionElevGainM,
  timeMode,
  muted,
  user,
  evaluatedTrophies,
  initialSectionTab = 'atelier',
  initialWorkshopSlot = 'familiar',
  onPinTrophy,
  onUpdateAppearance,
  onSaveCallsign,
  onAuthAction,
  onOpenJournalEntry,
  onLocatePoiOnMap,
  onNavigateToMissions,
  onNavigateToActivity,
  onResetCharacter,
  onExportBackup,
}) => {
  const [sectionTab, setSectionTab] = useState<ProfileSectionTab>(initialSectionTab);
  const [trophyFilter, setTrophyFilter] = useState<TrophyFilterMode>('all');
  const [workshopTab, setWorkshopTab] = useState<WorkshopSlotTab>(initialWorkshopSlot);
  const [previewDir, setPreviewDir] = useState<'down' | 'right' | 'up' | 'left'>('down');
  const [previewWalking, setPreviewWalking] = useState<boolean>(true);
  const [nameDraft, setNameDraft] = useState<string>(progress.displayName);
  const [savedBadge, setSavedBadge] = useState<boolean>(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'annotated' | ExplorationCategory>('all');
  const [resetModalOpen, setResetModalOpen] = useState<boolean>(false);
  const [resetConfirmedCheck, setResetConfirmedCheck] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [resetError, setResetError] = useState<string>('');
  const [resetSuccessBanner, setResetSuccessBanner] = useState<boolean>(false);
  const [exportingBackup, setExportingBackup] = useState<boolean>(false);

  useEffect(() => {
    setSectionTab(initialSectionTab);
  }, [initialSectionTab]);

  useEffect(() => {
    setWorkshopTab(initialWorkshopSlot);
    if (initialWorkshopSlot === 'pack') setPreviewDir('up');
    else setPreviewDir('down');
  }, [initialWorkshopSlot]);

  useEffect(() => {
    setNameDraft(progress.displayName);
  }, [progress.displayName]);

  useEffect(() => {
    if (!resetModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !resetting) {
        setResetModalOpen(false);
        setResetConfirmedCheck(false);
        setResetError('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [resetModalOpen, resetting]);

  const appearance = useMemo(() => resolveExplorerAppearance(progress), [progress]);
  const globalLevel = useMemo(() => computeLevelFromXp(progress.totalXp), [progress.totalXp]);
  const guildHonorificTitle = useMemo(() => computeExplorerHonorificTitle(progress), [progress]);

  const unlockedTrophySet = useMemo(
    () => new Set(evaluatedTrophies.filter((t) => t.unlocked).map((t) => t.trophy.id)),
    [evaluatedTrophies]
  );
  const unlockedTrophiesCount = unlockedTrophySet.size;

  const { title: honorificTitle, pinnedTrophy } = useMemo(
    () => resolveExplorerDisplayTitle(progress, unlockedTrophySet),
    [progress, unlockedTrophySet]
  );

  const filteredTrophies = useMemo(() => {
    if (trophyFilter === 'unlocked') return evaluatedTrophies.filter((t) => t.unlocked);
    if (trophyFilter === 'locked') return evaluatedTrophies.filter((t) => !t.unlocked);
    return evaluatedTrophies;
  }, [evaluatedTrophies, trophyFilter]);

  const unlockedCosmeticsCount = useMemo(
    () => ALL_COSMETIC_ITEMS.filter((item) => isCosmeticUnlocked(item, progress, entries)).length,
    [progress, entries]
  );

  const totalWalkedMeters = Math.max(progress.walkedMeters || 0, sessionMeters);
  // Each fog cell is ~35m x 35m (~1225 m² = 0.1225 ha)
  const exploredHectares = Math.max(0.1, (fogCellsCount * 0.1225)).toFixed(1).replace('.', ',');
  const annotatedCount = useMemo(
    () => entries.filter((e) => e.personalNote.trim().length > 0 || e.photoCount > 0).length,
    [entries]
  );

  // Compute distinct historical strata unlocked
  const unlockedStrataSet = useMemo(() => {
    const s = new Set<string>();
    for (const e of entries) {
      const m = sectorPois.find((p) => p.id === e.poiId);
      if (m) {
        s.add(m.stratum);
        continue;
      }
      const txt = `${e.eraLabel} ${e.subType} ${e.name}`.toLowerCase();
      if (/ma\b|géolog|jurass|crétac|lutétien|oligocène|fossile|substrat/.test(txt)) s.add('temps_profond');
      else if (/préhist|néolith|paléolith|dolmen|menhir|mégalith/.test(txt)) s.add('prehistoire');
      else if (/antiqu|gallo|romain|lutèce/.test(txt)) s.add('antiquite');
      else if (/moyen âge|médiéval|xie|xiie|xiiie|xive|xve/.test(txt)) s.add('moyen_age');
      else if (/moderne|xvie|xviie|xviiie|renaissance/.test(txt)) s.add('moderne');
      else if (e.category === 'ecosysteme' || e.category === 'legende') s.add('vivant_folklore');
      else s.add('contemporain');
    }
    return s;
  }, [entries, sectorPois]);

  // Chronicle summary insights
  const chronicleStats = useMemo(() => {
    if (entries.length === 0) {
      return {
        firstDate: 'Aucune découverte',
        latestDate: 'En attente de terrain',
        favoriteGuild: 'À révéler',
        topSource: 'Aucune archive',
      };
    }
    const sortedAsc = [...entries].sort((a, b) => a.discoveredAtIso.localeCompare(b.discoveredAtIso));
    const catCounts = new Map<ExplorationCategory, number>();
    const srcCounts = new Map<string, number>();
    for (const e of entries) {
      catCounts.set(e.category, (catCounts.get(e.category) || 0) + 1);
      srcCounts.set(e.source, (srcCounts.get(e.source) || 0) + 1);
    }
    const bestCat = Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    const bestSrc = Array.from(srcCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    return {
      firstDate: formatFrenchDate(sortedAsc[0].discoveredAtIso),
      latestDate: formatFrenchDate(sortedAsc[sortedAsc.length - 1].discoveredAtIso),
      favoriteGuild: bestCat ? `${CATEGORY_META[bestCat[0]].shortLabel} (${bestCat[1]})` : '—',
      topSource: bestSrc ? `${bestSrc[0]} (${bestSrc[1]})` : '—',
    };
  }, [entries]);

  const filteredHistory = useMemo(() => {
    return entries.filter((e) => {
      if (historyFilter === 'all') return true;
      if (historyFilter === 'annotated') {
        return e.personalNote.trim().length > 0 || e.photoCount > 0;
      }
      return e.category === historyFilter;
    });
  }, [entries, historyFilter]);

  const equippedHeadgear =
    HEADGEAR_CATALOG.find((h) => h.id === appearance.headgearId) || HEADGEAR_CATALOG[0];
  const equippedOutfit =
    OUTFIT_COSMETICS_CATALOG.find((o) => o.id === appearance.outfitId) ||
    OUTFIT_COSMETICS_CATALOG[0];
  const equippedTool = TOOL_CATALOG.find((t) => t.id === appearance.toolId) || TOOL_CATALOG[0];
  const equippedPack = PACK_CATALOG.find((p) => p.id === appearance.packId) || PACK_CATALOG[0];
  const equippedFamiliar =
    FAMILIAR_CATALOG.find((f) => f.id === (appearance.familiarId || 'aucun')) ||
    FAMILIAR_CATALOG[0];

  const specialActivityRewards = useMemo(
    () =>
      ALL_COSMETIC_ITEMS.filter(
        (item) =>
          Boolean(item.minSolvedRiddles) ||
          Boolean(item.minCompletedHunts) ||
          Boolean(item.minClaimedAlmanac)
      ),
    []
  );

  const handleSubmitCallsign = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = nameDraft.trim().slice(0, 60) || 'Explorateur';
    setNameDraft(cleaned);
    onSaveCallsign(cleaned);
    setSavedBadge(true);
    window.setTimeout(() => setSavedBadge(false), 2200);
  };

  const handleEquipCosmetic = (item: CosmeticItemDef) => {
    playStampSfx(muted);
    if (item.slot === 'familiar') {
      onUpdateAppearance({ familiarId: item.id as ExplorerFamiliarId });
      setPreviewDir('down');
    } else if (item.slot === 'headgear') {
      onUpdateAppearance({ headgearId: item.id as ExplorerHeadgearId });
    } else if (item.slot === 'outfit') {
      onUpdateAppearance({ outfitId: item.id as ExplorerOutfitId });
    } else if (item.slot === 'tool') {
      onUpdateAppearance({ toolId: item.id as ExplorerToolId });
    } else if (item.slot === 'pack') {
      onUpdateAppearance({ packId: item.id as ExplorerPackId });
      setPreviewDir('up');
    }
  };

  const renderCosmeticCard = (item: CosmeticItemDef) => {
    const status = getCosmeticUnlockStatus(item, progress, entries);
    const isEquipped =
      (item.slot === 'familiar' && (appearance.familiarId || 'aucun') === item.id) ||
      (item.slot === 'headgear' && appearance.headgearId === item.id) ||
      (item.slot === 'outfit' && appearance.outfitId === item.id) ||
      (item.slot === 'tool' && appearance.toolId === item.id) ||
      (item.slot === 'pack' && appearance.packId === item.id);

    const previewAppearance: ExplorerAppearance = {
      ...appearance,
      ...(item.slot === 'familiar' ? { familiarId: item.id as ExplorerFamiliarId } : {}),
      ...(item.slot === 'headgear' ? { headgearId: item.id as ExplorerHeadgearId } : {}),
      ...(item.slot === 'outfit' ? { outfitId: item.id as ExplorerOutfitId } : {}),
      ...(item.slot === 'tool' ? { toolId: item.id as ExplorerToolId } : {}),
      ...(item.slot === 'pack' ? { packId: item.id as ExplorerPackId } : {}),
    };

    const equippedBadgeLabel =
      item.slot === 'familiar'
        ? item.id === 'aucun'
          ? 'Marche solitaire active ✓'
          : 'Accompagne vos pas sur la carte ✓'
        : 'Équipé sur la carte 16-bit ✓';

    const equipBtnLabel =
      item.slot === 'familiar'
        ? item.id === 'aucun'
          ? 'Marcher seul'
          : 'Adopter à mes côtés'
        : 'Équiper';

    return (
      <div
        key={`${item.slot}_${item.id}`}
        className={`relative min-w-0 overflow-hidden p-3.5 sm:p-4 border-2 flex items-start gap-3 transition-colors ${
          isEquipped
            ? 'bg-amber-200/90 border-[#991b1b] jrpg-shadow'
            : status.unlocked
            ? 'bg-[#f8edd6] border-[#6b4928] hover:bg-[#fffbeb]'
            : 'bg-[#e3cfa6]/70 border-[#8c653b]'
        }`}
      >
        <div
          className={`p-1.5 bg-[#24140b] border-2 shrink-0 flex items-center justify-center ${
            isEquipped ? 'border-[#991b1b]' : 'border-[#d97706]'
          }`}
        >
          <ExplorerSpriteCanvas
            appearance={previewAppearance}
            facingDir={item.slot === 'pack' ? 'up' : 'down'}
            isWalking={isEquipped || item.slot === 'familiar'}
            animated={isEquipped || item.slot === 'familiar'}
            pixelScale={2}
            className="w-[68px] h-[60px]"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="min-w-0">
            <div className="text-sm sm:text-base font-bold font-display text-[#24160c] leading-snug break-words">
              {item.name}
            </div>
            <p className="text-xs text-[#54361d] leading-snug mt-0.5 break-words">{item.subtitle}</p>
          </div>

          {isEquipped ? (
            <div className="text-xs font-bold text-[#991b1b]">{equippedBadgeLabel}</div>
          ) : status.unlocked ? (
            <button
              type="button"
              onClick={() => handleEquipCosmetic(item)}
              className="min-h-[40px] sm:min-h-[36px] px-3.5 py-1.5 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow whitespace-nowrap"
            >
              {equipBtnLabel}
            </button>
          ) : (
            <div className="space-y-1.5 pt-0.5 min-w-0">
              <div
                className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-rose-900 min-w-0"
                title={status.requirementLabel}
              >
                <span className="font-sans font-bold break-words min-w-0">
                  Scellé · {status.requirementLabel}
                </span>
                <span className="font-bold shrink-0">
                  {status.current}/{status.target}
                </span>
              </div>
              <div className="w-full h-1.5 pixel-gauge-track overflow-hidden">
                <div
                  className="h-full bg-[#b91c1c]"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((status.current / Math.max(1, status.target)) * 100)
                    )}%`,
                  }}
                />
              </div>
              {status.sourceKind === 'narrative' && onNavigateToActivity ? (
                <button
                  type="button"
                  onClick={() => onNavigateToActivity('narratives')}
                  className="min-h-[36px] text-xs font-bold text-rose-900 hover:text-rose-700 underline underline-offset-4 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <PixelUiIcon name="quill" className="w-3.5 h-3.5" />
                  <span>Ouvrir les Quêtes Narratives</span>
                </button>
              ) : status.sourceKind === 'communaute' && onNavigateToActivity ? (
                <button
                  type="button"
                  onClick={() => onNavigateToActivity('defis')}
                  className="min-h-[36px] text-xs font-bold text-rose-900 hover:text-rose-700 underline underline-offset-4 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <PixelUiIcon name="trophy" className="w-3.5 h-3.5" />
                  <span>Ouvrir les Défis Communautaires</span>
                </button>
              ) : status.sourceKind === 'almanach' && onNavigateToActivity ? (
                <button
                  type="button"
                  onClick={() => onNavigateToActivity('almanach')}
                  className="min-h-[36px] text-xs font-bold text-rose-900 hover:text-rose-700 underline underline-offset-4 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <PixelUiIcon name="star" className="w-3.5 h-3.5" />
                  <span>Ouvrir l’Almanach</span>
                </button>
              ) : status.sourceKind === 'chasse' && onNavigateToActivity ? (
                <button
                  type="button"
                  onClick={() => onNavigateToActivity('chasse')}
                  className="min-h-[36px] text-xs font-bold text-rose-900 hover:text-rose-700 underline underline-offset-4 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <PixelUiIcon name="chest" className="w-3.5 h-3.5" />
                  <span>Pister une Chasse au Trésor</span>
                </button>
              ) : status.sourceKind === 'enigme' && onNavigateToActivity ? (
                <button
                  type="button"
                  onClick={() => onNavigateToActivity('enigmes')}
                  className="min-h-[36px] text-xs font-bold text-rose-900 hover:text-rose-700 underline underline-offset-4 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <PixelUiIcon name="book" className="w-3.5 h-3.5" />
                  <span>Résoudre une énigme au Carnet</span>
                </button>
              ) : status.missionId ? (
                <button
                  type="button"
                  onClick={() =>
                    onNavigateToActivity ? onNavigateToActivity('guildes') : onNavigateToMissions()
                  }
                  className="min-h-[36px] text-xs font-bold text-rose-900 hover:text-rose-700 underline underline-offset-4 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <PixelUiIcon name="scroll" className="w-3.5 h-3.5" />
                  <span>Voir la quête</span>
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ====================================================================
          HERO CHARACTER SHEET: ANIMATED 16-BIT DIORAMA + DETAILS & STATS
          ==================================================================== */}
      <div className="relative grimoire-folio-gold p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-stretch">
        <PixelCornerRivets className="bg-[#f59e0b]" />

        {/* Left Column (5 cols): Interactive Animated 16-Bit Stage & Equipped Loadout */}
        <div className="lg:col-span-5 min-w-0 overflow-hidden flex flex-col justify-between gap-3 bg-[#24140b] border-2 border-[#2b1a0e] p-3.5 sm:p-4 text-[#f8edd6] jrpg-shadow">
          <div className="space-y-2.5 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-display font-bold text-amber-300 text-sm truncate">
                Aperçu 16-Bit sur Carte
              </span>
              <button
                type="button"
                onClick={() => setPreviewWalking((w) => !w)}
                className={`min-h-[36px] px-2.5 py-1 text-xs font-bold border border-[#d97706] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  previewWalking
                    ? 'bg-amber-300 text-[#24160c]'
                    : 'bg-[#3b2113] text-amber-200 hover:bg-[#54301d]'
                }`}
              >
                <PixelUiIcon name="boot" className="w-3.5 h-3.5 shrink-0" />
                <span>{previewWalking ? 'Marche' : 'Repos'}</span>
              </button>
            </div>

            <div className="relative w-full flex items-center justify-center bg-[#140b05] border-2 border-[#b47b38] overflow-hidden py-2">
              <ExplorerSpriteCanvas
                appearance={appearance}
                facingDir={previewDir}
                isWalking={previewWalking}
                animated
                pixelScale={4}
                stageBackdrop
                timeMode={timeMode}
                className="w-[208px] h-[168px] max-w-full"
              />
            </div>

            {/* 4-Direction Turn Controls (compact labels, zero horizontal overflow) */}
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  { dir: 'down', label: '▼ Face' },
                  { dir: 'right', label: '▶ Est' },
                  { dir: 'up', label: '▲ Dos' },
                  { dir: 'left', label: '◀ Ouest' },
                ] as const
              ).map((btn) => (
                <button
                  key={btn.dir}
                  type="button"
                  onClick={() => setPreviewDir(btn.dir)}
                  className={`min-h-[40px] min-w-0 overflow-hidden px-1 py-1 text-[11px] sm:text-xs font-mono font-bold border transition-colors truncate ${
                    previewDir === btn.dir
                      ? 'bg-amber-300 text-[#24160c] border-[#fffbeb]'
                      : 'bg-[#382012] text-[#e8d5b5] border-[#8c653b] hover:bg-[#4d2c19]'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Quick Gender / Silhouette Selector */}
            <div className="space-y-1 pt-0.5">
              <div className="flex items-center justify-between gap-2 text-[11px] text-amber-200/90">
                <span className="font-semibold">Genre & silhouette</span>
                <button
                  type="button"
                  onClick={() => {
                    setSectionTab('atelier');
                    setWorkshopTab('visage');
                  }}
                  className="text-amber-300 hover:text-amber-100 underline underline-offset-2 font-bold whitespace-nowrap"
                >
                  Visage & coiffure
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {EXPLORER_GENDERS.map((g) => {
                  const isActive = appearance.gender === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        playStampSfx(muted);
                        onUpdateAppearance({ gender: g.id as ExplorerGender });
                      }}
                      className={`min-h-[40px] min-w-0 overflow-hidden px-1.5 py-1 text-xs font-bold border transition-colors truncate ${
                        isActive
                          ? 'bg-amber-300 text-[#24160c] border-[#fffbeb]'
                          : 'bg-[#341d10] text-[#f8edd6] border-[#8c653b] hover:bg-[#4a2917]'
                      }`}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 5-Slot Equipped Summary (Familiar + 4 Cosmetics — Click any slot to open it in the Workshop!) */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#6b4928] text-xs">
            <button
              type="button"
              title={equippedFamiliar.name}
              onClick={() => {
                setSectionTab('atelier');
                setWorkshopTab('familiar');
                setPreviewDir('down');
              }}
              className="col-span-2 min-h-[44px] min-w-0 overflow-hidden px-3 py-1.5 bg-[#382012] hover:bg-[#4d2c19] border border-[#d97706] text-left flex items-center justify-between gap-2 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-[10px] font-mono text-amber-300 flex items-center gap-1">
                  <PixelUiIcon name="paw" className="w-3 h-3 shrink-0" />
                  <span>Familier compagnon</span>
                </div>
                <div className="font-bold text-[#fffbeb] truncate">{equippedFamiliar.name}</div>
              </div>
              <span className="text-[11px] font-bold text-amber-300 shrink-0">Changer ▸</span>
            </button>
            {(
              [
                { slot: 'headgear', label: 'Coiffe', name: equippedHeadgear.name },
                { slot: 'outfit', label: 'Tenue', name: equippedOutfit.name },
                { slot: 'tool', label: 'Outil', name: equippedTool.name },
                { slot: 'pack', label: 'Dos', name: equippedPack.name },
              ] as const
            ).map((eq) => (
              <button
                key={eq.slot}
                type="button"
                title={eq.name}
                onClick={() => {
                  setSectionTab('atelier');
                  setWorkshopTab(eq.slot);
                  if (eq.slot === 'pack') setPreviewDir('up');
                }}
                className="min-h-[44px] min-w-0 overflow-hidden px-2.5 py-1.5 bg-[#341d10] hover:bg-[#4a2917] border border-[#8c653b] text-left transition-colors"
              >
                <div className="text-[10px] font-mono text-amber-300 truncate">{eq.label}</div>
                <div className="font-bold text-[#fffbeb] truncate">{eq.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column (7 cols): Explorer Identity, Global Level, Stats & Guild Mastery */}
        <div className="lg:col-span-7 min-w-0 overflow-hidden flex flex-col justify-between space-y-4">
          <div className="space-y-3 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b-2 border-[#c89d62] pb-3.5 min-w-0">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {pinnedTrophy && (
                  <button
                    type="button"
                    onClick={() => setSectionTab('trophees')}
                    title={`Trophée épinglé : ${pinnedTrophy.name} — Cliquer pour ouvrir la Salle des Trophées`}
                    className="p-1.5 bg-[#1b1109] border-2 border-[#d97706] hover:border-[#991b1b] jrpg-shadow shrink-0 transition-colors"
                  >
                    <TrophyBadgeCanvas trophyId={pinnedTrophy.id} unlocked pixelScale={2} />
                  </button>
                )}
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#54361d] font-semibold">
                    <span className="font-mono tabular-nums font-bold text-rose-900">
                      Niveau {globalLevel.level}
                    </span>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => setSectionTab('trophees')}
                      className="font-bold text-amber-950 hover:text-[#991b1b] underline decoration-[#c89d62] underline-offset-2 text-left"
                    >
                      {honorificTitle}
                    </button>
                    <span aria-hidden="true">·</span>
                    <span>
                      {user ? 'Sauvegarde Cloud active' : 'Sauvegarde locale sur cet appareil'}
                    </span>
                  </div>
                  <h1
                    className="text-2xl sm:text-3xl font-bold font-display text-[#24160c] break-words leading-tight"
                    style={{ textWrap: 'balance' }}
                  >
                    {progress.displayName}
                  </h1>
                  <div className="text-[11px] text-[#5c4028]">
                    {pinnedTrophy ? (
                      <span>
                        Médaille épinglée : <strong>{pinnedTrophy.name}</strong> · Gravée sur vos
                        cartes postales
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSectionTab('trophees')}
                        className="font-semibold text-rose-900 hover:text-rose-700 underline underline-offset-2"
                      >
                        Salle des Trophées ({unlockedTrophiesCount}/{TROPHIES_CATALOG.length}{' '}
                        médailles) — épingler un titre
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onAuthAction}
                className="min-h-[42px] px-3.5 py-2 text-xs font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow whitespace-nowrap shrink-0 self-start"
              >
                {user ? 'Déconnexion Cloud' : 'Synchroniser (Google)'}
              </button>
            </div>

            {/* Editable Explorer Callsign Form */}
            <form
              onSubmit={handleSubmitCallsign}
              className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0"
            >
              <label htmlFor="profile-callsign-input" className="text-xs font-bold text-[#54361d] shrink-0">
                Nom d’éclaireur :
              </label>
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1 min-w-0 max-w-md">
                <input
                  id="profile-callsign-input"
                  type="text"
                  maxLength={60}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Votre nom ou pseudonyme…"
                  className="min-h-[42px] flex-1 min-w-[140px] bg-[#f8edd6] border-2 border-[#6b4928] px-3 py-1.5 text-xs font-bold text-[#24160c] focus:outline-none focus:bg-[#fffdf7] focus:border-[#2b1a0e]"
                />
                <button
                  type="submit"
                  className="min-h-[42px] px-3.5 py-1.5 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow whitespace-nowrap shrink-0"
                >
                  {savedBadge ? 'Enregistré ✓' : 'Renommer'}
                </button>
              </div>
            </form>

            {/* Global XP Bar */}
            <div className="space-y-1.5 pt-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs font-mono tabular-nums">
                <span className="font-sans font-bold text-[#24160c]">
                  Expérience totale d’exploration
                </span>
                <span className="font-bold text-rose-900">
                  {progress.totalXp} / {globalLevel.nextLevelXp} XP ({globalLevel.progressPct}%)
                </span>
              </div>
              <div className="relative w-full h-3 pixel-gauge-track overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#991b1b] via-[#d97706] to-[#fde047]"
                  style={{ width: `${Math.max(4, globalLevel.progressPct)}%` }}
                />
                <div className="pointer-events-none absolute inset-0 pixel-gauge-segments" />
              </div>
            </div>
          </div>

          {/* 6-Metric Field Record Ledger (Tabular Numerals, Clean Hairline Grid, Zero Overflow) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
            <div className="min-w-0 overflow-hidden p-3 bg-[#f8edd6] border border-[#8c653b]">
              <div className="text-[11px] text-[#6b4928] font-semibold truncate">Lieux révélés</div>
              <div className="text-xl font-bold font-mono tabular-nums text-[#24160c] mt-0.5 truncate">
                {entries.length}
              </div>
              <div className="text-[11px] text-[#54361d] mt-0.5 truncate">
                {unlockedStrataSet.size} / {STRATUM_ORDER.length} strates
              </div>
            </div>

            <div className="min-w-0 overflow-hidden p-3 bg-[#f8edd6] border border-[#8c653b]">
              <div className="text-[11px] text-[#6b4928] font-semibold truncate">Quêtes accomplies</div>
              <div className="text-xl font-bold font-mono tabular-nums text-emerald-900 mt-0.5 truncate">
                {progress.completedMissions.length} / {MISSIONS_CATALOG.length}
              </div>
              <div className="text-[11px] text-[#54361d] mt-0.5 truncate">Grimoire des missions</div>
            </div>

            <div className="min-w-0 overflow-hidden p-3 bg-[#f8edd6] border border-[#8c653b]">
              <div className="text-[11px] text-[#6b4928] font-semibold truncate">Équipements acquis</div>
              <div className="text-xl font-bold font-mono tabular-nums text-amber-950 mt-0.5 truncate">
                {unlockedCosmeticsCount} / {ALL_COSMETIC_ITEMS.length}
              </div>
              <div className="text-[11px] text-[#54361d] mt-0.5 truncate">Cosmétiques 16-bit</div>
            </div>

            <div className="min-w-0 overflow-hidden p-3 bg-[#f8edd6] border border-[#8c653b]">
              <div className="text-[11px] text-[#6b4928] font-semibold truncate">Distance parcourue</div>
              <div className="text-xl font-bold font-mono tabular-nums text-[#24160c] mt-0.5 truncate">
                {formatDistanceLabel(totalWalkedMeters)}
              </div>
              <div className="text-[11px] text-[#54361d] mt-0.5 truncate">
                {sessionElevGainM >= 2 ? `D+ session : +${sessionElevGainM} m` : 'Pas sur le terrain'}
              </div>
            </div>

            <div className="min-w-0 overflow-hidden p-3 bg-[#f8edd6] border border-[#8c653b]">
              <div className="text-[11px] text-[#6b4928] font-semibold truncate">Brouillard dissipé</div>
              <div className="text-xl font-bold font-mono tabular-nums text-sky-950 mt-0.5 truncate">
                {exploredHectares} ha
              </div>
              <div className="text-[11px] font-mono tabular-nums text-[#54361d] mt-0.5 truncate">
                {fogCellsCount} parcelles levées
              </div>
            </div>

            <div className="min-w-0 overflow-hidden p-3 bg-[#f8edd6] border border-[#8c653b]">
              <div className="text-[11px] text-[#6b4928] font-semibold truncate">Feuillets annotés</div>
              <div className="text-xl font-bold font-mono tabular-nums text-rose-900 mt-0.5 truncate">
                {annotatedCount}
              </div>
              <div className="text-[11px] text-[#54361d] mt-0.5 truncate">Notes & clichés locaux</div>
            </div>
          </div>

          {/* Compact 5-Guild Mastery Bars (responsive columns so long guild labels never overflow) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2 pt-1">
            {CATEGORY_ORDER.map((cat) => {
              const meta = CATEGORY_META[cat];
              const xp = getCategoryXp(progress, cat);
              const lvl = computeLevelFromXp(xp);
              return (
                <div
                  key={cat}
                  className="min-w-0 overflow-hidden p-2 bg-[#ecd8b1] border border-[#8c653b] space-y-1"
                >
                  <div className="flex items-center justify-between gap-1 text-[11px] min-w-0">
                    <span
                      className={`font-bold inline-flex items-center gap-1 min-w-0 truncate ${meta.mapTextClass}`}
                      title={meta.shortLabel}
                    >
                      <PixelGuildIcon category={cat} className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{meta.shortLabel}</span>
                    </span>
                    <span className="font-mono tabular-nums font-bold text-[#24160c] shrink-0">
                      N.{lvl.level}
                    </span>
                  </div>
                  <div className="w-full h-1.5 pixel-gauge-track overflow-hidden">
                    <div
                      className={`h-full ${meta.accentBgClass}`}
                      style={{ width: `${Math.max(6, lvl.progressPct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ====================================================================
          SUB-NAVIGATION TABS: ATELIER | TROPHÉES 16-BIT | HISTORIQUE | QUÊTES
          ==================================================================== */}
      <div className="grimoire-folio p-2 sm:p-2.5">
        <ParchmentScrollStrip fadeColorFrom="vellum" innerClassName="gap-2">
          <button
            type="button"
            onClick={() => setSectionTab('atelier')}
            className={`min-h-[44px] px-4 py-2 text-xs sm:text-sm font-bold border-2 border-[#2b1a0e] inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
              sectionTab === 'atelier'
                ? 'bg-[#991b1b] text-[#fffbeb] jrpg-shadow'
                : 'bg-[#ecd8b1] text-[#24160c] hover:bg-[#fffbeb]'
            }`}
          >
            <PixelUiIcon name="hat" className="w-4 h-4" />
            <span>
              Avatar & Équipement ({unlockedCosmeticsCount}/{ALL_COSMETIC_ITEMS.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSectionTab('trophees')}
            className={`min-h-[44px] px-4 py-2 text-xs sm:text-sm font-bold border-2 border-[#2b1a0e] inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
              sectionTab === 'trophees'
                ? 'bg-[#991b1b] text-[#fffbeb] jrpg-shadow'
                : 'bg-[#ecd8b1] text-[#24160c] hover:bg-[#fffbeb]'
            }`}
          >
            <PixelUiIcon name="trophy" className="w-4 h-4" />
            <span>
              Salle des Trophées ({unlockedTrophiesCount}/{TROPHIES_CATALOG.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSectionTab('historique')}
            className={`min-h-[44px] px-4 py-2 text-xs sm:text-sm font-bold border-2 border-[#2b1a0e] inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
              sectionTab === 'historique'
                ? 'bg-[#991b1b] text-[#fffbeb] jrpg-shadow'
                : 'bg-[#ecd8b1] text-[#24160c] hover:bg-[#fffbeb]'
            }`}
          >
            <PixelUiIcon name="book" className="w-4 h-4" />
            <span>Historique & Chronique ({entries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSectionTab('hauts_faits')}
            className={`min-h-[44px] px-4 py-2 text-xs sm:text-sm font-bold border-2 border-[#2b1a0e] inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
              sectionTab === 'hauts_faits'
                ? 'bg-[#991b1b] text-[#fffbeb] jrpg-shadow'
                : 'bg-[#ecd8b1] text-[#24160c] hover:bg-[#fffbeb]'
            }`}
          >
            <PixelUiIcon name="paw" className="w-4 h-4" />
            <span>
              Récompenses & Familiers ({unlockedCosmeticsCount}/{ALL_COSMETIC_ITEMS.length})
            </span>
          </button>
        </ParchmentScrollStrip>
      </div>

      {/* ====================================================================
          TAB: SALLE DES TROPHÉES & MÉDAILLIER 16-BIT
          ==================================================================== */}
      {sectionTab === 'trophees' && (
        <div className="relative grimoire-folio p-4 sm:p-6 space-y-5">
          <PixelCornerRivets className="bg-[#f59e0b]" />

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b-2 border-[#c89d62] pb-4">
            <div className="space-y-1.5 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-rose-900 font-bold">
                <PixelUiIcon name="trophy" className="w-4 h-4" />
                <span>
                  {unlockedTrophiesCount} / {TROPHIES_CATALOG.length} médailles ciselées
                </span>
                <span aria-hidden="true">·</span>
                <span>Profil & Cartes postales 16-bit</span>
              </div>
              <h2 className="text-lg sm:text-2xl font-bold font-display text-[#24160c]">
                Médaillier des Exploits de Marcheur
              </h2>
              <p className="text-xs sm:text-sm text-[#54361d] leading-relaxed">
                Chaque trophée récompense un véritable exploit sur le terrain — marche nocturne,
                sortie sous l’averse, spéléologie, géodésie IGN ou maîtrise des sept socles rocheux.
                Épinglez votre médaille favorite pour arborer son titre sur votre profil, vos
                cartes postales et vos fiches d’archive.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {(
                [
                  { id: 'all', label: `Toutes (${TROPHIES_CATALOG.length})` },
                  { id: 'unlocked', label: `Ciselées (${unlockedTrophiesCount})` },
                  {
                    id: 'locked',
                    label: `À conquérir (${TROPHIES_CATALOG.length - unlockedTrophiesCount})`,
                  },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTrophyFilter(f.id)}
                  className={`min-h-[40px] px-3.5 py-1.5 text-xs font-bold border-2 border-[#2b1a0e] whitespace-nowrap ${
                    trophyFilter === f.id
                      ? 'bg-[#28160d] text-amber-300 jrpg-shadow'
                      : 'bg-[#ecd8b1] text-[#3d2512] hover:bg-[#fffbeb]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active Title & Pinned Medallion Banner */}
          <div className="p-3.5 sm:p-4 bg-[#24140b] text-[#f8edd6] border-2 border-[#b47b38] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {pinnedTrophy ? (
                <div className="p-1.5 bg-[#140b05] border border-[#d97706] shrink-0">
                  <TrophyBadgeCanvas trophyId={pinnedTrophy.id} unlocked pixelScale={2} />
                </div>
              ) : (
                <div className="w-12 h-12 bg-[#140b05] border border-[#6b4928] flex items-center justify-center shrink-0">
                  <PixelUiIcon name="trophy" className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0 space-y-0.5">
                <div className="text-xs text-amber-300 font-semibold break-words">
                  {pinnedTrophy
                    ? `Médaille épinglée · ${pinnedTrophy.name}`
                    : 'Aucune médaille épinglée · Titre de Guilde par défaut'}
                </div>
                <div className="text-sm sm:text-base font-bold font-display text-[#fffbeb] leading-snug break-words">
                  {progress.displayName} — {honorificTitle}
                </div>
              </div>
            </div>

            {pinnedTrophy && (
              <button
                type="button"
                onClick={() => {
                  playStampSfx(muted);
                  onPinTrophy('');
                }}
                className="min-h-[40px] max-w-full px-3 py-1.5 text-xs font-bold bg-[#382012] hover:bg-[#54301d] text-amber-200 border border-[#d97706] text-left leading-snug break-words self-start sm:self-center"
              >
                Revenir au titre de Guilde ({guildHonorificTitle})
              </button>
            )}
          </div>

          {/* 12 Chiseled 16-Bit Trophies Grid */}
          {filteredTrophies.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#54361d] space-y-1">
              <p className="font-bold text-sm text-[#24160c]">
                Aucune médaille dans ce filtre pour l’instant.
              </p>
              <p>Chaussez vos bottes sur la carte 16-bit pour accomplir vos premiers exploits !</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTrophies.map(({ trophy, current, target, unlocked, ratio }) => {
                const isPinned = pinnedTrophy?.id === trophy.id;
                const tierMeta = TROPHY_TIER_META[trophy.tier];
                const genderedTitle = getGenderedTrophyTitle(trophy, appearance.gender);
                const formattedCurrent =
                  trophy.target >= 10000
                    ? `${(current / 1000).toFixed(1).replace('.', ',')} km`
                    : String(current);
                const formattedTarget =
                  trophy.target >= 10000 ? `${Math.round(target / 1000)} km` : String(target);

                return (
                  <div
                    key={trophy.id}
                    className={`relative min-w-0 overflow-hidden p-4 border-2 flex flex-col justify-between gap-3.5 transition-colors ${
                      isPinned
                        ? 'bg-amber-200/90 border-[#991b1b] jrpg-shadow'
                        : unlocked
                        ? 'bg-[#f8edd6] border-[#6b4928] hover:bg-[#fffbeb]'
                        : 'bg-[#e6d5b3]/75 border-[#8c653b]'
                    }`}
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={`p-2 bg-[#160d07] border-2 shrink-0 flex items-center justify-center ${
                          isPinned
                            ? 'border-[#991b1b]'
                            : unlocked
                            ? 'border-[#d97706]'
                            : 'border-[#57534e]'
                        }`}
                      >
                        <TrophyBadgeCanvas
                          trophyId={trophy.id}
                          unlocked={unlocked}
                          pixelScale={3}
                          className="w-[72px] h-[72px]"
                        />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-semibold text-[#6b4928]">
                          <span>{tierMeta.label}</span>
                          <span aria-hidden="true">·</span>
                          <span className={unlocked ? 'text-emerald-900 font-bold' : ''}>
                            {unlocked ? 'Ciselée ✓' : 'À conquérir'}
                          </span>
                        </div>
                        <h3 className="text-base font-bold font-display text-[#24160c] leading-snug break-words">
                          {trophy.name}
                        </h3>
                        <div className="text-xs font-bold text-[#991b1b] break-words">
                          Titre : « {genderedTitle} »
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-[#4a321d] leading-relaxed">{trophy.description}</p>

                    <div className="space-y-2 pt-1 border-t border-[#c89d62]">
                      <div className="flex items-center justify-between gap-2 text-xs font-mono tabular-nums">
                        <span className="font-sans text-[11px] font-semibold text-[#54361d] truncate">
                          {trophy.unitLabel}
                        </span>
                        <span className="font-bold text-[#24160c] shrink-0">
                          {formattedCurrent} / {formattedTarget}
                        </span>
                      </div>
                      <div className="w-full h-2 pixel-gauge-track overflow-hidden">
                        <div
                          className={`h-full ${
                            unlocked ? 'bg-emerald-600' : 'bg-[#b45309]'
                          }`}
                          style={{ width: `${Math.max(unlocked ? 100 : 4, Math.round(ratio * 100))}%` }}
                        />
                      </div>

                      {unlocked ? (
                        <div className="pt-1 flex items-center justify-between gap-2">
                          {isPinned ? (
                            <>
                              <span className="text-xs font-bold text-[#991b1b]">
                                Épinglé au profil & cartes ✓
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  playStampSfx(muted);
                                  onPinTrophy('');
                                }}
                                className="min-h-[36px] px-2.5 py-1 text-xs font-bold bg-[#ecd8b1] hover:bg-[#fffbeb] text-[#24160c] border border-[#2b1a0e] whitespace-nowrap shrink-0"
                              >
                                Désépingler
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                playStampSfx(muted);
                                onPinTrophy(trophy.id);
                              }}
                              className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <PixelUiIcon name="trophy" className="w-3.5 h-3.5" />
                              <span>Épingler titre & médaille</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] italic text-[#5c4028] leading-snug pt-0.5">
                          Conseil : {trophy.howToHint}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          TAB 1: AVATAR & COSMETIC EQUIPMENT WORKSHOP
          ==================================================================== */}
      {sectionTab === 'atelier' && (
        <div className="relative grimoire-folio p-4 sm:p-6 space-y-5">
          <PixelCornerRivets className="bg-[#f59e0b]" />

          <div className="space-y-2 border-b-2 border-[#c89d62] pb-4">
            <h2 className="text-lg sm:text-xl font-bold font-display text-[#24160c]">
              Atelier du Cartographe — Familiers, Visage & Équipements Cosmétiques
            </h2>
            <p className="text-xs text-[#54361d] max-w-3xl">
              Chaque familier adopté, couvre-chef, manteau, relique ou paquetage dorsal accompagne
              en direct votre explorateur sur la carte 16-bit. Résolvez des énigmes contextuelles,
              des chasses aux trésors, des quêtes de l’Almanach et du Grimoire pour tout débloquer.
            </p>

            <ParchmentScrollStrip fadeColorFrom="vellum" innerClassName="gap-2 pt-2">
              {(
                [
                  {
                    id: 'familiar',
                    label: `Familiers (${FAMILIAR_CATALOG.length - 1})`,
                    icon: 'paw',
                  },
                  { id: 'visage', label: 'Visage & Allure', icon: 'user-profile' },
                  { id: 'headgear', label: `Couvre-chefs (${HEADGEAR_CATALOG.length})`, icon: 'hat' },
                  {
                    id: 'outfit',
                    label: `Tenues (${OUTFIT_COSMETICS_CATALOG.length})`,
                    icon: 'shield',
                  },
                  { id: 'tool', label: `Outils & Reliques (${TOOL_CATALOG.length})`, icon: 'relic' },
                  { id: 'pack', label: `Paquetages (${PACK_CATALOG.length})`, icon: 'backpack' },
                ] as const
              ).map((slotBtn) => (
                <button
                  key={slotBtn.id}
                  type="button"
                  onClick={() => {
                    setWorkshopTab(slotBtn.id);
                    if (slotBtn.id === 'pack') setPreviewDir('up');
                    else if (previewDir === 'up') setPreviewDir('down');
                  }}
                  className={`min-h-[42px] px-3.5 py-1.5 text-xs font-bold border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    workshopTab === slotBtn.id
                      ? 'bg-amber-300 text-[#24160c] jrpg-shadow'
                      : 'bg-[#ecd8b1] text-[#54361d] hover:bg-[#fffbeb]'
                  }`}
                >
                  <PixelUiIcon name={slotBtn.icon} className="w-3.5 h-3.5" />
                  <span>{slotBtn.label}</span>
                </button>
              ))}
            </ParchmentScrollStrip>
          </div>

          {workshopTab === 'familiar' && (
            <div className="space-y-3">
              <div className="p-3 bg-[#ecd8b1] border border-[#8c653b] text-xs text-[#3b2312] flex flex-wrap items-center justify-between gap-2">
                <span>
                  Votre familier trottine ou volette fidèlement à vos côtés sur la carte 16-bit
                  (Surface &amp; Sous-sol) ainsi que sur vos cartes postales souvenirs.
                </span>
                <span className="font-mono font-bold text-rose-900 shrink-0 tabular-nums">
                  Récits : {progress.completedNarrativesCount || 0} · Défis :{' '}
                  {progress.claimedCommunityChallengesCount || 0} · Énigmes :{' '}
                  {progress.solvedRiddlesCount || 0} · Chasses :{' '}
                  {progress.completedHuntsCount || 0} · Almanach :{' '}
                  {progress.claimedAlmanacCount || 0}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {FAMILIAR_CATALOG.map((item) => renderCosmeticCard(item))}
              </div>
            </div>
          )}

          {workshopTab === 'visage' && (
            <div className="space-y-5">
              {/* Gender & Silhouette Selector */}
              <div className="space-y-2.5">
                <h3 className="text-sm font-bold font-display text-[#24160c]">
                  01. Genre, silhouette & accord des titres
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {EXPLORER_GENDERS.map((g) => {
                    const active = appearance.gender === g.id;
                    const sampleAppearance: ExplorerAppearance = {
                      ...appearance,
                      gender: g.id as ExplorerGender,
                    };
                    return (
                      <div
                        key={g.id}
                        className={`min-w-0 overflow-hidden p-3.5 border-2 flex items-center gap-3 ${
                          active
                            ? 'bg-amber-200/90 border-[#991b1b] jrpg-shadow'
                            : 'bg-[#f8edd6] border-[#6b4928] hover:bg-[#fffbeb]'
                        }`}
                      >
                        <div className="p-1.5 bg-[#24140b] border-2 border-[#d97706] shrink-0">
                          <ExplorerSpriteCanvas
                            appearance={sampleAppearance}
                            facingDir="down"
                            isWalking={active}
                            animated={active}
                            pixelScale={2}
                            className="w-14 h-[60px]"
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="text-sm font-bold font-display text-[#24160c] leading-snug break-words">
                            {g.label}
                          </div>
                          <p className="text-xs text-[#54361d] leading-snug break-words">
                            {g.subtitle}
                          </p>
                          {active ? (
                            <div className="text-xs font-bold text-[#991b1b]">Genre actif ✓</div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                playStampSfx(muted);
                                onUpdateAppearance({ gender: g.id as ExplorerGender });
                              }}
                              className="min-h-[38px] px-3 py-1 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow whitespace-nowrap"
                            >
                              Choisir
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Skin Tone Selector */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold font-display text-[#24160c]">
                  02. Carnation du personnage
                </h3>
                <div className="flex flex-wrap gap-2">
                  {SKIN_TONES.map((tone) => {
                    const active = appearance.skinTone === tone.id;
                    return (
                      <button
                        key={tone.id}
                        type="button"
                        onClick={() => {
                          playStampSfx(muted);
                          onUpdateAppearance({ skinTone: tone.id as ExplorerSkinTone });
                        }}
                        className={`min-h-[44px] px-3.5 py-2 text-xs font-bold border-2 inline-flex items-center gap-2.5 whitespace-nowrap ${
                          active
                            ? 'bg-amber-300 text-[#24160c] border-[#991b1b] jrpg-shadow'
                            : 'bg-[#f8edd6] text-[#24160c] border-[#6b4928] hover:bg-[#fffbeb]'
                        }`}
                      >
                        <span
                          className="w-4 h-4 border border-[#1a1008] shrink-0"
                          style={{ backgroundColor: tone.base }}
                          aria-hidden="true"
                        />
                        <span>{tone.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hairstyle & Silhouette Archetype Selector */}
              <div className="space-y-2.5">
                <h3 className="text-sm font-bold font-display text-[#24160c]">
                  03. Coiffure, traits & besicles
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {AVATAR_PRESETS.map((preset) => {
                    const active = appearance.avatarPreset === preset.id;
                    const sampleAppearance: ExplorerAppearance = {
                      ...appearance,
                      avatarPreset: preset.id as ExplorerAvatarPreset,
                    };
                    return (
                      <div
                        key={preset.id}
                        className={`min-w-0 overflow-hidden p-3.5 border-2 flex items-center gap-3 ${
                          active
                            ? 'bg-amber-200/90 border-[#991b1b] jrpg-shadow'
                            : 'bg-[#f8edd6] border-[#6b4928] hover:bg-[#fffbeb]'
                        }`}
                      >
                        <div className="p-1.5 bg-[#24140b] border-2 border-[#d97706] shrink-0">
                          <ExplorerSpriteCanvas
                            appearance={sampleAppearance}
                            facingDir="down"
                            isWalking={active}
                            animated={active}
                            pixelScale={2}
                            className="w-14 h-[60px]"
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="text-sm font-bold font-display text-[#24160c] leading-snug break-words">
                            {preset.name}
                          </div>
                          <p className="text-xs text-[#54361d] leading-snug break-words">
                            {preset.subtitle}
                          </p>
                          {active ? (
                            <div className="text-xs font-bold text-[#991b1b]">Allure active ✓</div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                playStampSfx(muted);
                                onUpdateAppearance({
                                  avatarPreset: preset.id as ExplorerAvatarPreset,
                                });
                              }}
                              className="min-h-[38px] px-3 py-1 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow whitespace-nowrap"
                            >
                              Choisir ce visage
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {workshopTab === 'headgear' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {HEADGEAR_CATALOG.map((item) => renderCosmeticCard(item))}
            </div>
          )}

          {workshopTab === 'outfit' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {OUTFIT_COSMETICS_CATALOG.map((item) => renderCosmeticCard(item))}
            </div>
          )}

          {workshopTab === 'tool' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {TOOL_CATALOG.map((item) => renderCosmeticCard(item))}
            </div>
          )}

          {workshopTab === 'pack' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {PACK_CATALOG.map((item) => renderCosmeticCard(item))}
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          TAB 2: CHRONOLOGICAL EXPEDITION HISTORY & FIELD TIMELINE
          ==================================================================== */}
      {sectionTab === 'historique' && (
        <div className="space-y-4 sm:space-y-5">
          {/* Summary Milestones Strip */}
          <div className="relative grimoire-folio p-4 sm:p-5 space-y-4">
            <PixelCornerRivets className="bg-[#f59e0b]" />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
              <div className="min-w-0 overflow-hidden p-3 bg-[#f8edd6] border border-[#8c653b]">
                <div className="text-[#6b4928] font-semibold truncate">Première découverte</div>
                <div className="font-mono font-bold text-[#24160c] mt-1 break-words">
                  {chronicleStats.firstDate}
                </div>
              </div>
              <div className="min-w-0 overflow-hidden p-3 bg-[#f8edd6] border border-[#8c653b]">
                <div className="text-[#6b4928] font-semibold truncate">Dernier sceau brisé</div>
                <div className="font-mono font-bold text-[#24160c] mt-1 break-words">
                  {chronicleStats.latestDate}
                </div>
              </div>
              <div className="min-w-0 overflow-hidden p-3 bg-[#f8edd6] border border-[#8c653b]">
                <div className="text-[#6b4928] font-semibold truncate">Guilde de prédilection</div>
                <div className="font-bold text-amber-950 mt-1 break-words">
                  {chronicleStats.favoriteGuild}
                </div>
              </div>
              <div className="min-w-0 overflow-hidden p-3 bg-[#f8edd6] border border-[#8c653b]">
                <div className="text-[#6b4928] font-semibold truncate">Archive la plus explorée</div>
                <div className="font-bold text-[#24160c] truncate mt-1">
                  {chronicleStats.topSource}
                </div>
              </div>
            </div>

            {/* Stratum Coverage Checklist */}
            <div className="pt-1 space-y-2">
              <div className="text-xs font-bold text-[#24160c]">
                Empreinte stratigraphique ({unlockedStrataSet.size} / {STRATUM_ORDER.length} époques
                découvertes)
              </div>
              <ParchmentScrollStrip fadeColorFrom="vellum" innerClassName="gap-2">
                {STRATUM_ORDER.map((st) => {
                  const hasIt = unlockedStrataSet.has(st);
                  return (
                    <div
                      key={st}
                      className={`px-2.5 py-1.5 border text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                        hasIt
                          ? 'bg-[#ecfdf5] border-emerald-800 text-emerald-950 font-bold'
                          : 'bg-[#ecd8b1]/60 border-[#8c653b] text-[#6b4928]'
                      }`}
                    >
                      <PixelStratumIcon stratum={st} className="w-3.5 h-3.5" />
                      <span>{STRATUM_META[st].short}</span>
                      {hasIt && <span>✓</span>}
                    </div>
                  );
                })}
              </ParchmentScrollStrip>
            </div>
          </div>

          {/* Filterable Chronological Log */}
          <div className="relative grimoire-folio p-4 sm:p-6 space-y-4">
            <PixelCornerRivets className="bg-[#f59e0b]" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#c89d62] pb-3.5">
              <h2 className="text-lg sm:text-xl font-bold font-display text-[#24160c]">
                Journal Chronologique des Découvertes ({filteredHistory.length})
              </h2>

              <ParchmentScrollStrip fadeColorFrom="vellum" innerClassName="gap-1.5">
                <button
                  type="button"
                  onClick={() => setHistoryFilter('all')}
                  className={`min-h-[38px] px-3 py-1 text-xs font-bold border-2 border-[#2b1a0e] whitespace-nowrap shrink-0 ${
                    historyFilter === 'all'
                      ? 'bg-[#991b1b] text-[#fffbeb]'
                      : 'bg-[#ecd8b1] text-[#54361d] hover:bg-[#fffbeb]'
                  }`}
                >
                  Tout ({entries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('annotated')}
                  className={`min-h-[38px] px-3 py-1 text-xs font-bold border-2 border-[#2b1a0e] whitespace-nowrap shrink-0 ${
                    historyFilter === 'annotated'
                      ? 'bg-[#991b1b] text-[#fffbeb]'
                      : 'bg-[#ecd8b1] text-[#54361d] hover:bg-[#fffbeb]'
                  }`}
                >
                  Annotés ({annotatedCount})
                </button>
                {CATEGORY_ORDER.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setHistoryFilter(cat)}
                    className={`min-h-[38px] px-2.5 py-1 text-xs font-bold border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      historyFilter === cat
                        ? 'bg-amber-300 text-[#24160c]'
                        : 'bg-[#ecd8b1] text-[#54361d] hover:bg-[#fffbeb]'
                    }`}
                  >
                    <PixelGuildIcon category={cat} className="w-3.5 h-3.5" />
                    <span>{CATEGORY_META[cat].shortLabel}</span>
                  </button>
                ))}
              </ParchmentScrollStrip>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="p-6 text-center space-y-2 text-xs text-[#54361d]">
                <p className="font-bold text-sm text-[#24160c]">
                  Aucune entrée dans cet historique pour le moment.
                </p>
                <p>
                  Marchez vers les sceaux « ? » sur la carte 16-bit pour enrichir votre chronique
                  d’expédition.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#c89d62]">
                {filteredHistory.map((entry, idx) => {
                  const catMeta = CATEGORY_META[entry.category];
                  return (
                    <div
                      key={`${entry.poiId}_${idx}`}
                      className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#54361d]">
                          <span className="font-mono tabular-nums font-bold text-[#24160c]">
                            {formatFrenchDate(entry.discoveredAtIso)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className={`font-bold inline-flex items-center gap-1 ${catMeta.mapTextClass}`}>
                            <PixelGuildIcon category={entry.category} className="w-3.5 h-3.5" />
                            <span>{catMeta.shortLabel}</span>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{entry.eraLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums font-bold text-emerald-800">
                            +{entry.xpAwarded} XP
                          </span>
                        </div>

                        <h3 className="text-base font-bold font-display text-[#24160c] truncate">
                          {entry.name}
                        </h3>

                        <div className="text-xs text-[#54361d] truncate">
                          {entry.subType} · Source : {entry.source}
                          {entry.photoCount > 0 ? ` · ${entry.photoCount} photo(s)` : ''}
                        </div>

                        {entry.personalNote.trim().length > 0 && (
                          <p className="text-xs italic text-[#3b2312] bg-[#f8edd6] border border-[#c89d62] px-2.5 py-1.5 mt-1 line-clamp-2">
                            « {entry.personalNote.trim()} »
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenJournalEntry(entry.poiId)}
                          className="min-h-[40px] px-3 py-1.5 text-xs font-bold bg-[#ecd8b1] hover:bg-[#fffbeb] text-[#24160c] border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <PixelUiIcon name="book" className="w-3.5 h-3.5" />
                          <span>Feuillet</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onLocatePoiOnMap(entry)}
                          className="min-h-[40px] px-3 py-1.5 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <PixelUiIcon name="map" className="w-3.5 h-3.5" />
                          <span>Carte</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 3: ACCOMPLISHMENTS, FAMILIARS & SPECIAL REWARDS
          ==================================================================== */}
      {sectionTab === 'hauts_faits' && (
        <div className="space-y-5">
          {/* Special Rewards from Riddles, Treasure Hunts & Almanac Quests */}
          <div className="relative grimoire-folio-gold p-4 sm:p-6 space-y-4">
            <PixelCornerRivets className="bg-[#d97706]" />
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 border-b-2 border-[#c89d62] pb-3.5">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold text-rose-900">
                  <PixelUiIcon name="paw" className="w-4 h-4" />
                  <span> Énigmes : {progress.solvedRiddlesCount || 0}</span>
                  <span>·</span>
                  <span>Chasses : {progress.completedHuntsCount || 0}</span>
                  <span>·</span>
                  <span>Almanach : {progress.claimedAlmanacCount || 0}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold font-display text-[#24160c]">
                  Familiers &amp; Trésors d’Énigmes, Chasses et Almanach
                </h2>
                <p className="text-xs text-[#4a321d] max-w-3xl">
                  Débloquez des compagnons animés 16-bit et des reliques exclusives en perçant les
                  énigmes du Sceau d’Or, les pistes aux trésors et les fêtes de l’Almanach.
                </p>
              </div>
              {onNavigateToActivity && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onNavigateToActivity('almanach')}
                    className="min-h-[40px] px-3 py-1.5 text-xs font-bold bg-[#ecd8b1] hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <PixelUiIcon name="star" className="w-3.5 h-3.5" />
                    <span>Almanach</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateToActivity('chasse')}
                    className="min-h-[40px] px-3 py-1.5 text-xs font-bold bg-[#ecd8b1] hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <PixelUiIcon name="chest" className="w-3.5 h-3.5" />
                    <span>Chasses</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateToActivity('enigmes')}
                    className="min-h-[40px] px-3 py-1.5 text-xs font-bold bg-[#ecd8b1] hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <PixelUiIcon name="book" className="w-3.5 h-3.5" />
                    <span>Énigmes</span>
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {specialActivityRewards.map((item) => renderCosmeticCard(item))}
            </div>
          </div>

          {/* Guild Missions & Their Cosmetic / Familiar Rewards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MISSIONS_CATALOG.map((mission, idx) => {
              const completed = progress.completedMissions.includes(mission.id);
              const accessible = isMissionUnlocked(mission, progress);
              const ev = mission.evaluate(entries);
              const rewards = getCosmeticRewardsForMission(mission.id);

              return (
                <div
                  key={mission.id}
                  className={`relative min-w-0 overflow-hidden p-4 sm:p-5 space-y-3 ${
                    completed
                      ? 'bg-[#ecfdf5] border-2 border-emerald-800 jrpg-shadow'
                      : accessible
                      ? 'grimoire-folio'
                      : 'grimoire-well opacity-80'
                  }`}
                >
                  <PixelCornerRivets className={completed ? 'bg-emerald-600' : 'bg-[#f59e0b]'} />

                  <div className="flex items-center justify-between gap-2 text-xs text-[#54361d]">
                    <span className="font-mono tabular-nums font-bold text-rose-800">
                      {String(idx + 1).padStart(2, '0')}. {mission.arcName}
                    </span>
                    <span className="font-mono tabular-nums font-bold text-emerald-800">
                      +{mission.xpBonus} XP
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold font-display text-[#24160c]">
                    {mission.title}
                  </h3>

                  <p className="text-xs text-[#4a321d] leading-relaxed">{mission.description}</p>

                  {rewards.map((reward) => {
                    const rewardUnlocked = isCosmeticUnlocked(reward, progress, entries);
                    const rewardEquipped =
                      (reward.slot === 'familiar' &&
                        (appearance.familiarId || 'aucun') === reward.id) ||
                      (reward.slot === 'headgear' && appearance.headgearId === reward.id) ||
                      (reward.slot === 'outfit' && appearance.outfitId === reward.id) ||
                      (reward.slot === 'tool' && appearance.toolId === reward.id) ||
                      (reward.slot === 'pack' && appearance.packId === reward.id);

                    return (
                      <div
                        key={`${mission.id}_${reward.id}`}
                        className="p-2.5 bg-[#f8edd6] border border-[#8c653b] flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-[11px] text-[#6b4928] font-semibold">
                            {reward.slot === 'familiar'
                              ? 'Familier compagnon'
                              : 'Récompense cosmétique'}
                          </div>
                          <div className="text-xs font-bold text-[#24160c] truncate">
                            {reward.name}
                          </div>
                        </div>

                        {rewardEquipped ? (
                          <span className="text-xs font-bold text-[#991b1b] shrink-0">
                            {reward.slot === 'familiar' ? 'Adopté ✓' : 'Équipé ✓'}
                          </span>
                        ) : rewardUnlocked ? (
                          <button
                            type="button"
                            onClick={() => handleEquipCosmetic(reward)}
                            className="min-h-[36px] px-3 py-1 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] whitespace-nowrap shrink-0"
                          >
                            {reward.slot === 'familiar' ? 'Adopter' : 'Équiper'}
                          </button>
                        ) : (
                          <span className="text-xs font-mono tabular-nums font-bold text-[#6b4928] shrink-0">
                            {ev.current}/{ev.target}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ====================================================================
          CHARACTER RESET SECTION + CONFIRMATION DIALOG
          ==================================================================== */}
      <div className="relative grimoire-folio p-4 sm:p-5 space-y-3">
        <PixelCornerRivets className="bg-[#b91c1c]" />

        {resetSuccessBanner && (
          <div
            role="status"
            className="p-3 bg-[#ecfdf5] border border-emerald-800 text-xs font-bold text-emerald-950 flex items-center justify-between gap-2"
          >
            <span>
              Personnage réinitialisé au Niveau 1. Votre aventure repart d’une page vierge.
            </span>
            <button
              type="button"
              onClick={() => setResetSuccessBanner(false)}
              className="px-2 py-1 text-emerald-900 hover:text-emerald-700 underline whitespace-nowrap shrink-0"
            >
              Fermer
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h2 className="text-base sm:text-lg font-bold font-display text-[#24160c]">
              Réinitialisation du personnage
            </h2>
            <p className="text-xs text-[#54361d] leading-relaxed max-w-2xl">
              Remet à zéro votre niveau, vos points d’expérience, vos découvertes du Carnet, vos
              photos locales, vos quêtes, vos cosmétiques débloqués et le brouillard exploré
              {user ? ' (sur cet appareil ainsi que sur votre sauvegarde Cloud).' : ' sur cet appareil.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setResetConfirmedCheck(false);
              setResetError('');
              setResetModalOpen(true);
            }}
            className="min-h-[44px] px-4 py-2 text-xs font-bold bg-[#f8edd6] hover:bg-rose-100 text-rose-950 border-2 border-rose-900 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 self-start sm:self-center transition-colors"
          >
            <PixelUiIcon name="trash" className="w-4 h-4 shrink-0" />
            <span>Réinitialiser le personnage</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {resetModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
          onClick={() => {
            if (!resetting) {
              setResetModalOpen(false);
              setResetConfirmedCheck(false);
              setResetError('');
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-character-dialog-title"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg grimoire-folio-crimson p-5 sm:p-6 space-y-4 text-[#24160c] max-h-[90dvh] overflow-y-auto"
          >
            <PixelCornerRivets className="bg-[#b91c1c]" />

            <div className="flex items-start justify-between gap-3 border-b-2 border-[#c89d62] pb-3">
              <div className="space-y-1 min-w-0">
                <div className="text-xs font-bold text-rose-900 inline-flex items-center gap-1.5">
                  <PixelUiIcon name="warning" className="w-4 h-4 shrink-0" />
                  <span>Action irréversible</span>
                </div>
                <h3
                  id="reset-character-dialog-title"
                  className="text-lg sm:text-xl font-bold font-display text-[#24160c]"
                  style={{ textWrap: 'balance' }}
                >
                  Confirmer la réinitialisation complète de « {progress.displayName} » ?
                </h3>
              </div>

              <button
                type="button"
                disabled={resetting}
                onClick={() => {
                  setResetModalOpen(false);
                  setResetConfirmedCheck(false);
                  setResetError('');
                }}
                aria-label="Fermer la fenêtre de confirmation"
                className="w-9 h-9 flex items-center justify-center bg-[#28160d] text-amber-300 hover:bg-[#991b1b] hover:text-[#fffbeb] border border-[#d97706] shrink-0 disabled:opacity-50"
              >
                <PixelUiIcon name="close" className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3.5 bg-[#f8edd6] border border-[#8c653b] space-y-2 text-xs text-[#3b2312]">
              <div className="font-bold text-[#24160c]">
                Éléments qui seront effacés et remis à l’état initial :
              </div>
              <ul className="space-y-1 font-mono tabular-nums text-[11px] sm:text-xs">
                <li>
                  · Niveau {globalLevel.level} ({progress.totalXp} XP) et maîtrise des 5 Guildes → Niveau 1 (0 XP)
                </li>
                <li>
                  · {entries.length} lieu{entries.length > 1 ? 'x' : ''} révélé{entries.length > 1 ? 's' : ''}, notes personnelles et clichés du Carnet → 0
                </li>
                <li>
                  · {progress.completedMissions.length} quête{progress.completedMissions.length > 1 ? 's' : ''} accomplie{progress.completedMissions.length > 1 ? 's' : ''} et cosmétiques gagnés → Tenue d’arpenteur initiale
                </li>
                <li>
                  · {fogCellsCount} parcelle{fogCellsCount > 1 ? 's' : ''} de brouillard levée{fogCellsCount > 1 ? 's' : ''} et distance marchée ({formatDistanceLabel(totalWalkedMeters)}) → 0
                </li>
                {user && (
                  <li className="text-rose-900 font-bold">
                    · Sauvegarde Cloud associée à votre compte (profil, découvertes et cairns déposés)
                  </li>
                )}
              </ul>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#ecd8b1] border border-[#8c653b] text-xs">
              <span className="text-[#3b2312] font-medium">
                Souhaitez-vous garder une copie avant d’effacer ?
              </span>
              <button
                type="button"
                disabled={exportingBackup || resetting}
                onClick={async () => {
                  try {
                    setExportingBackup(true);
                    await onExportBackup();
                  } finally {
                    setExportingBackup(false);
                  }
                }}
                className="min-h-[40px] px-3 py-1.5 text-xs font-bold bg-[#f8edd6] hover:bg-[#fffbeb] text-[#24160c] border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <PixelUiIcon name="archive" className="w-3.5 h-3.5 shrink-0" />
                <span>{exportingBackup ? 'Export…' : 'Exporter une sauvegarde (.json)'}</span>
              </button>
            </div>

            <label className="min-h-[44px] p-3 bg-[#fffdf7] border-2 border-[#6b4928] flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={resetConfirmedCheck}
                disabled={resetting}
                onChange={(e) => setResetConfirmedCheck(e.target.checked)}
                className="w-5 h-5 accent-[#991b1b] shrink-0 cursor-pointer"
              />
              <span className="text-xs font-bold text-[#24160c] leading-snug">
                Je confirme vouloir remettre mon personnage et toute ma progression à zéro.
              </span>
            </label>

            {resetError && (
              <div className="p-2.5 bg-rose-100 border border-rose-800 text-xs font-bold text-rose-950">
                {resetError}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={resetting}
                onClick={() => {
                  setResetModalOpen(false);
                  setResetConfirmedCheck(false);
                  setResetError('');
                }}
                className="min-h-[44px] px-4 py-2 text-xs font-bold bg-[#ecd8b1] hover:bg-[#fffbeb] text-[#24160c] border-2 border-[#2b1a0e] whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                Annuler
              </button>

              <button
                type="button"
                disabled={!resetConfirmedCheck || resetting}
                onClick={async () => {
                  setResetError('');
                  setResetting(true);
                  try {
                    playStampSfx(muted);
                    await onResetCharacter();
                    setResetModalOpen(false);
                    setResetConfirmedCheck(false);
                    setSectionTab('atelier');
                    setResetSuccessBanner(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } catch {
                    setResetError(
                      'La réinitialisation n’a pas pu aboutir. Vérifiez votre connexion puis réessayez.'
                    );
                  } finally {
                    setResetting(false);
                  }
                }}
                className="min-h-[44px] px-4 py-2 text-xs font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <PixelUiIcon name="trash" className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {resetting ? 'Réinitialisation…' : 'Confirmer la réinitialisation'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

