import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  buildChallengeLeaderboard,
  buildPeriodGeneralLeaderboard,
  ChallengeCadence,
  ChallengePersonalTier,
  ChallengeTierKey,
  CommunityChallengeDefinition,
  CommunityChallengeLeaderboardRow,
  evaluatePersonalChallengeProgress,
  formatChallengeCountdownFr,
  getCurrentPeriodKey,
  makeClaimedTierId,
} from '../communityChallenges';
import {
  isFirebaseConfigured,
  subscribeToChallengeLeaderboard,
  subscribeToPeriodChallengeLeaderboard,
} from '../firebase';
import { playJournalOpenSfx, playMissionFanfare } from '../sound';
import { TrophyBadgeCanvas } from '../trophies';
import {
  CATEGORY_META,
  ExplorationCategory,
  ExplorerAppearance,
  ExplorerProgress,
  PoiItem,
  UnlockedEntry,
} from '../types';
import { ExplorerSpriteCanvas } from './ExplorerAvatarCanvas';
import { PixelCornerRivets, PixelGuildIcon, PixelUiIcon } from './PixelIcons';

interface CommunityChallengesViewProps {
  challenges: CommunityChallengeDefinition[];
  entries: UnlockedEntry[];
  sectorPois: PoiItem[];
  progress: ExplorerProgress;
  localAppearance: ExplorerAppearance;
  user: User | null;
  localRegionLabel: string;
  claimedTierIds: ReadonlySet<string>;
  muted: boolean;
  onClaimTier: (
    challenge: CommunityChallengeDefinition,
    tier: ChallengePersonalTier
  ) => void;
  onFocusChallengeOnMap: (challenge: CommunityChallengeDefinition) => void;
  onAuthAction: () => void;
  onOpenWorkshopCosmetics: () => void;
  onOpenTrophyHall: () => void;
}

type LeaderboardMode = 'challenge' | 'period';

export const CommunityChallengesView: React.FC<CommunityChallengesViewProps> = ({
  challenges,
  entries,
  sectorPois,
  progress,
  localAppearance,
  user,
  localRegionLabel,
  claimedTierIds,
  muted,
  onClaimTier,
  onFocusChallengeOnMap,
  onAuthAction,
  onOpenWorkshopCosmetics,
  onOpenTrophyHall,
}) => {
  const [selectedCadence, setSelectedCadence] = useState<ChallengeCadence>('quotidien');
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>('challenge');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [cloudChallengeRows, setCloudChallengeRows] = useState<CommunityChallengeLeaderboardRow[]>([]);
  const [cloudPeriodRows, setCloudPeriodRows] = useState<CommunityChallengeLeaderboardRow[]>([]);

  // Live 1-second countdown ticker
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeChallenge = useMemo(() => {
    return (
      challenges.find((c) => c.cadence === selectedCadence) ||
      challenges[0]
    );
  }, [challenges, selectedCadence]);

  const periodKey = useMemo(() => getCurrentPeriodKey(nowMs), [nowMs]);

  // Real-time Firestore leaderboard subscription for active challenge (when signed in)
  useEffect(() => {
    if (!user || !user.emailVerified || !isFirebaseConfigured || !activeChallenge) {
      setCloudChallengeRows([]);
      return;
    }
    const unsub = subscribeToChallengeLeaderboard(activeChallenge.id, (rows) => {
      setCloudChallengeRows(rows);
    });
    return () => unsub();
  }, [user, activeChallenge]);

  // Real-time Firestore period general leaderboard subscription (when signed in)
  useEffect(() => {
    if (!user || !user.emailVerified || !isFirebaseConfigured) {
      setCloudPeriodRows([]);
      return;
    }
    const unsub = subscribeToPeriodChallengeLeaderboard(periodKey, (rows) => {
      setCloudPeriodRows(rows);
    });
    return () => unsub();
  }, [user, periodKey]);

  const localExplorerId = user?.uid || 'local_explorer';

  const evaluationsByChallengeId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof evaluatePersonalChallengeProgress>>();
    for (const ch of challenges) {
      map.set(ch.id, evaluatePersonalChallengeProgress(ch, entries));
    }
    return map;
  }, [challenges, entries]);

  const activeEval = useMemo(() => {
    if (!activeChallenge) {
      return {
        qualifyingEntries: [],
        count: 0,
        points: 0,
        unlockedTiers: [],
        nextTier: null,
      };
    }
    return (
      evaluationsByChallengeId.get(activeChallenge.id) ||
      evaluatePersonalChallengeProgress(activeChallenge, entries)
    );
  }, [activeChallenge, evaluationsByChallengeId, entries]);

  const matchingAvailableInSectorCount = useMemo(() => {
    if (!activeChallenge) return 0;
    const unlockedIds = new Set(entries.map((e) => e.poiId));
    return sectorPois.filter((poi) => {
      if (unlockedIds.has(poi.id)) return false;
      const hay = `${poi.name} ${poi.subType} ${poi.summary} ${poi.source}`;
      switch (activeChallenge.filterKind) {
        case 'any_poi':
          return true;
        case 'waterway':
          return Boolean(poi.nearWaterway) || /fontaine|lavoir|moulin|pont|rivière|riviere|ruisseau|canal|source/i.test(hay);
        case 'histoire':
        case 'geographie':
        case 'ecosysteme':
        case 'legende':
        case 'etrange':
          return poi.category === activeChallenge.filterKind;
        case 'vernacular':
          return Boolean(poi.nearWaterway) || /lavoir|fontaine|moulin|four|calvaire|croix|puits|source|pont|chapelle/i.test(hay);
        case 'geodesic_or_rock':
          return poi.category === 'geographie' || /géodés|geodes|nivellement|ign|borne|sommet|belvédère|roche|carrière/i.test(hay);
        case 'subterranean_or_etrange':
          return Boolean(poi.isSubterranean) || poi.category === 'etrange' || poi.category === 'legende';
      }
    }).length;
  }, [activeChallenge, sectorPois, entries]);

  const challengeBoard = useMemo(() => {
    if (!activeChallenge) {
      return { rows: [], communityTotalCount: 0, participantsCount: 0, localRank: null };
    }
    return buildChallengeLeaderboard({
      challenge: activeChallenge,
      cloudEntries: cloudChallengeRows,
      localExplorerId,
      localProgress: progress,
      localEval: activeEval,
      localRegionLabel,
    });
  }, [
    activeChallenge,
    cloudChallengeRows,
    localExplorerId,
    progress,
    activeEval,
    localRegionLabel,
  ]);

  const periodBoard = useMemo(() => {
    return buildPeriodGeneralLeaderboard({
      periodKey,
      periodCloudEntries: cloudPeriodRows,
      activeChallenges: challenges,
      localExplorerId,
      localProgress: progress,
      entries,
      localRegionLabel,
    });
  }, [
    periodKey,
    cloudPeriodRows,
    challenges,
    localExplorerId,
    progress,
    entries,
    localRegionLabel,
  ]);

  if (!activeChallenge) return null;

  const communityRatioPct = Math.min(
    100,
    Math.round(
      (challengeBoard.communityTotalCount / Math.max(1, activeChallenge.communityTargetCount)) * 100
    )
  );
  const goldTarget = activeChallenge.personalTiers[2].targetCount;
  const personalRatioPct = Math.min(
    100,
    Math.round((activeEval.count / Math.max(1, goldTarget)) * 100)
  );
  const countdownText = formatChallengeCountdownFr(activeChallenge.endsAtMs, nowMs);
  const focusMeta = CATEGORY_META[activeChallenge.focusCategory as ExplorationCategory];

  const renderExplorerPortrait = (row: {
    explorerGender?: ExplorerAppearance['gender'];
    explorerAvatarPreset?: ExplorerAppearance['avatarPreset'];
    explorerSkinTone?: ExplorerAppearance['skinTone'];
    explorerHeadgearId?: ExplorerAppearance['headgearId'];
    explorerOutfitId?: ExplorerAppearance['outfitId'];
    explorerFamiliarId?: ExplorerAppearance['familiarId'];
    isLocalExplorer?: boolean;
  }) => {
    const app: ExplorerAppearance = row.isLocalExplorer
      ? localAppearance
      : {
          gender: row.explorerGender || 'masculin',
          avatarPreset: row.explorerAvatarPreset || 'cartographe',
          skinTone: row.explorerSkinTone || 'hale',
          headgearId: row.explorerHeadgearId || 'tricorne_fauve',
          outfitId: row.explorerOutfitId || 'arpenteur',
          toolId: 'lanterne_laiton',
          packId: 'besace_cuir',
          familiarId: row.explorerFamiliarId || 'aucun',
        };
    return (
      <div className="p-1 bg-[#24140b] border border-[#d97706] shrink-0 flex items-center justify-center">
        <ExplorerSpriteCanvas
          appearance={app}
          facingDir="down"
          isWalking={false}
          animated={false}
          pixelScale={1.5}
          className="w-[46px] h-[42px]"
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ====================================================================
          1. CADENCE SELECTOR + EXCLUSIVE COMMUNITY REWARDS OVERVIEW
          ==================================================================== */}
      <div className="parchment-panel p-4 sm:p-5 relative space-y-4">
        <PixelCornerRivets />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="text-xs text-[#6b4928] font-semibold">
              Expéditions collectives à durée limitée · Progression individuelle &amp; communautaire
            </div>
            <h2 className="text-lg sm:text-2xl font-bold font-display text-[#24160c]">
              Défis Communautaires de la Guilde
            </h2>
            <p className="text-xs sm:text-sm text-[#4a321d] leading-relaxed max-w-3xl">
              Relevez les défis quotidiens, hebdomadaires et mensuels avant la fin du compte à
              rebours. Chaque découverte qualifiante fait grimper votre échelon personnel ainsi que
              l’objectif commun des éclaireurs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenTrophyHall}
              className="min-h-[42px] px-3.5 py-2 text-xs font-bold bg-[#28160d] hover:bg-[#3b2214] text-amber-200 border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-2"
            >
              <TrophyBadgeCanvas trophyId="heraut_communaute" unlocked pixelScale={1} />
              <span>Héraut de la Guilde ({progress.claimedCommunityChallengesCount || 0}/2)</span>
            </button>
            <button
              type="button"
              onClick={onOpenWorkshopCosmetics}
              className="min-h-[42px] px-3.5 py-2 text-xs font-bold bg-[#f8edd6] hover:bg-[#fffbeb] text-[#24160c] border-2 border-[#6b4928] inline-flex items-center gap-2"
            >
              <PixelUiIcon name="paw" className="w-4 h-4 text-rose-900" />
              <span>Bandeau &amp; Loutre des Rivières</span>
            </button>
          </div>
        </div>

        {/* Interactive Cadence Tabs */}
        <div
          role="tablist"
          aria-label="Cadence des défis communautaires"
          className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1"
        >
          {challenges.map((ch) => {
            const isSelected = ch.cadence === activeChallenge.cadence;
            const ev = evaluationsByChallengeId.get(ch.id);
            const hasUnclaimed =
              ev?.unlockedTiers.some(
                (t) => !claimedTierIds.has(makeClaimedTierId(ch.id, t.key))
              ) || false;
            return (
              <button
                key={ch.id}
                role="tab"
                aria-selected={isSelected}
                type="button"
                onClick={() => {
                  playJournalOpenSfx(muted);
                  setSelectedCadence(ch.cadence);
                }}
                className={`min-h-[54px] px-3.5 py-2.5 text-left border-2 transition-colors flex flex-col justify-between gap-1 ${
                  isSelected
                    ? 'bg-[#28160d] text-amber-200 border-[#d97706] jrpg-shadow'
                    : 'bg-[#f8edd6] hover:bg-[#fffbeb] text-[#24160c] border-[#6b4928]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                  <span className={isSelected ? 'text-amber-300 font-bold' : 'text-[#6b4928] font-semibold'}>
                    {ch.cadenceLabelFr}
                  </span>
                  <span>{formatChallengeCountdownFr(ch.endsAtMs, nowMs)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-bold font-display truncate">
                    {ch.title}
                  </span>
                  <span className="text-xs font-mono tabular-nums shrink-0">
                    {hasUnclaimed ? 'À réclamer !' : `${ev?.count || 0}/${ch.personalTiers[2].targetCount}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ====================================================================
          2. ACTIVE CHALLENGE HERO: TIMER + COLLECTIVE & PERSONAL PROGRESS
          ==================================================================== */}
      <div className="parchment-panel p-4 sm:p-5 relative space-y-5">
        <PixelCornerRivets />

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-[#8c653b]/40">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#6b4928]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#24160c]">
                <PixelGuildIcon category={activeChallenge.focusCategory} className="w-4 h-4" />
                <span>{focusMeta.shortLabel}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>{activeChallenge.poiRequirementLabelFr}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {matchingAvailableInSectorCount} piste{matchingAvailableInSectorCount > 1 ? 's' : ''} à découvrir dans ce secteur
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-bold font-display text-[#24160c]">
              {activeChallenge.title}
            </h3>
            <p className="text-xs sm:text-sm text-[#4a321d] leading-relaxed">
              {activeChallenge.description}
            </p>
          </div>

          <div className="p-3 bg-[#24140b] text-amber-200 border-2 border-[#d97706] shrink-0 min-w-[205px] space-y-1">
            <div className="text-[11px] text-amber-300/90">Temps restant imparti</div>
            <div className="text-base sm:text-lg font-mono font-bold tabular-nums text-[#fef08a]">
              {countdownText}
            </div>
            <div className="text-[11px] text-amber-200/80 font-mono tabular-nums">
              +{activeChallenge.pointsPerDiscovery} pts par lieu validé
            </div>
          </div>
        </div>

        {/* Dual Gauges: Community Scale vs Individual Explorer Scale */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Collective Community Progress */}
          <div className="p-4 bg-[#f8edd6] border border-[#8c653b] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs sm:text-sm font-bold font-display text-[#24160c]">
                Objectif Collectif de la Communauté
              </div>
              <div className="text-xs font-mono font-bold tabular-nums text-[#24160c]">
                {challengeBoard.communityTotalCount} / {activeChallenge.communityTargetCount} lieux ({communityRatioPct}%)
              </div>
            </div>

            <div className="w-full h-3 pixel-gauge-track overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  communityRatioPct >= 100 ? 'bg-emerald-600' : 'bg-[#0284c7]'
                }`}
                style={{ width: `${communityRatioPct}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#54361d]">
              <span className="tabular-nums">
                {challengeBoard.participantsCount} éclaireur{challengeBoard.participantsCount > 1 ? 's' : ''} actif{challengeBoard.participantsCount > 1 ? 's' : ''} sur ce défi
              </span>
              {!user ? (
                <button
                  type="button"
                  onClick={onAuthAction}
                  className="font-bold text-rose-900 hover:text-rose-700 underline underline-offset-4"
                >
                  Connecter le Cloud pour synchroniser vos points
                </button>
              ) : (
                <span className="text-emerald-900 font-semibold">
                  Synchronisation communautaire active
                </span>
              )}
            </div>
          </div>

          {/* Individual Explorer Progress */}
          <div className="p-4 bg-[#f8edd6] border border-[#8c653b] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs sm:text-sm font-bold font-display text-[#24160c]">
                Votre Progression Individuelle
              </div>
              <div className="text-xs font-mono font-bold tabular-nums text-rose-900">
                {activeEval.count} / {goldTarget} lieux · {activeEval.points} pts
              </div>
            </div>

            <div className="w-full h-3 pixel-gauge-track overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  personalRatioPct >= 100 ? 'bg-emerald-600' : 'bg-[#d97706]'
                }`}
                style={{ width: `${personalRatioPct}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#54361d]">
              <span className="tabular-nums">
                {challengeBoard.localRank
                  ? `Votre rang actuel sur ce défi : #${challengeBoard.localRank}`
                  : 'Découvrez 1 lieu qualifiant pour entrer au classement'}
              </span>
              <button
                type="button"
                onClick={() => onFocusChallengeOnMap(activeChallenge)}
                className="font-bold text-[#991b1b] hover:text-[#b91c1c] underline underline-offset-4 inline-flex items-center gap-1"
              >
                <PixelUiIcon name="map" className="w-3.5 h-3.5" />
                <span>Cibler sur la carte</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3 Personal Reward Tiers (Bronze / Argent / Or) */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold font-display text-[#24160c]">
              Échelons individuels &amp; récompenses du défi
            </h4>
            <span className="text-xs text-[#54361d]">
              1er palier réclamé : Bandeau d’Éclaireur · 2e palier : Trophée Héraut &amp; Loutre des Rivières
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {activeChallenge.personalTiers.map((tier) => {
              const tierClaimId = makeClaimedTierId(activeChallenge.id, tier.key as ChallengeTierKey);
              const isClaimed = claimedTierIds.has(tierClaimId);
              const isReached = activeEval.count >= tier.targetCount;
              return (
                <div
                  key={tier.key}
                  className={`p-3.5 border-2 flex flex-col justify-between gap-3 ${
                    isClaimed
                      ? 'bg-amber-200/80 border-[#991b1b]'
                      : isReached
                      ? 'bg-[#fffbeb] border-emerald-700 jrpg-shadow'
                      : 'bg-[#ecd8b1]/75 border-[#8c653b]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs font-mono tabular-nums">
                      <span className="font-sans font-bold text-[#24160c]">{tier.labelFr}</span>
                      <span className="font-bold text-rose-900">
                        {Math.min(activeEval.count, tier.targetCount)}/{tier.targetCount}
                      </span>
                    </div>
                    <p className="text-xs text-[#4a321d]">
                      Découvrir {tier.targetCount} lieu{tier.targetCount > 1 ? 'x' : ''} qualifiant{tier.targetCount > 1 ? 's' : ''} dans le délai imparti.
                    </p>
                    <div className="text-[11px] font-mono tabular-nums text-[#6b4928]">
                      +{tier.xpReward} XP · +{tier.bonusPoints} pts classement
                    </div>
                  </div>

                  {isClaimed ? (
                    <div className="text-xs font-bold text-[#991b1b]">
                      Récompense scellée au Grimoire ✓
                    </div>
                  ) : isReached ? (
                    <button
                      type="button"
                      onClick={() => {
                        playMissionFanfare(muted);
                        onClaimTier(activeChallenge, tier);
                      }}
                      className="min-h-[42px] px-4 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center justify-center gap-2"
                    >
                      <PixelUiIcon name="stamp" className="w-4 h-4" />
                      <span>Réclamer (+{tier.xpReward} XP)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onFocusChallengeOnMap(activeChallenge)}
                      className="min-h-[42px] px-3.5 py-2 text-xs font-bold bg-[#f8edd6] hover:bg-[#fffbeb] text-[#24160c] border border-[#6b4928] inline-flex items-center justify-center gap-1.5"
                    >
                      <PixelUiIcon name="pocket-compass" className="w-4 h-4 text-rose-900" />
                      <span>Explorer sur la carte</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ====================================================================
          3. INDIVIDUAL & COMMUNITY LEADERBOARDS (CLASSEMENTS)
          ==================================================================== */}
      <div className="parchment-panel p-4 sm:p-5 relative space-y-4">
        <PixelCornerRivets />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold font-display text-[#24160c]">
              Classements des Éclaireurs
            </h3>
            <p className="text-xs text-[#54361d]">
              Suivez les contributions individuelles sur ce défi ou au cumul général du mois ({periodKey}).
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-[#e3cfa6] border border-[#8c653b] self-start">
            <button
              type="button"
              onClick={() => setLeaderboardMode('challenge')}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-bold transition-colors ${
                leaderboardMode === 'challenge'
                  ? 'bg-[#28160d] text-amber-200'
                  : 'text-[#3b2312] hover:text-[#24160c]'
              }`}
            >
              Ce défi ({challengeBoard.rows.length})
            </button>
            <button
              type="button"
              onClick={() => setLeaderboardMode('period')}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-bold transition-colors ${
                leaderboardMode === 'period'
                  ? 'bg-[#28160d] text-amber-200'
                  : 'text-[#3b2312] hover:text-[#24160c]'
              }`}
            >
              Classement du mois ({periodBoard.length})
            </button>
          </div>
        </div>

        {leaderboardMode === 'challenge' ? (
          challengeBoard.rows.length === 0 ? (
            <div className="p-5 bg-[#f8edd6] border border-[#8c653b] text-center space-y-2.5">
              <p className="text-sm font-bold font-display text-[#24160c]">
                Aucune découverte enregistrée pour cet intervalle
              </p>
              <p className="text-xs text-[#54361d] max-w-xl mx-auto">
                Soyez le premier éclaireur à inaugurer le tableau d’honneur de « {activeChallenge.title} » en découvrant un lieu qualifiant sur la carte avant la fin du délai imparti.
              </p>
              <div className="pt-1 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onFocusChallengeOnMap(activeChallenge)}
                  className="min-h-[42px] px-4 py-2 text-xs font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-2"
                >
                  <PixelUiIcon name="map" className="w-4 h-4" />
                  <span>Partir en reconnaissance</span>
                </button>
                {!user && (
                  <button
                    type="button"
                    onClick={onAuthAction}
                    className="min-h-[42px] px-4 py-2 text-xs font-bold bg-[#f8edd6] hover:bg-[#fffbeb] text-[#24160c] border-2 border-[#6b4928]"
                  >
                    Activer le classement Cloud multi-joueurs
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#8c653b]/35 border border-[#8c653b] bg-[#f8edd6]">
              {challengeBoard.rows.map((row) => (
                <div
                  key={row.entryId}
                  className={`p-3 sm:px-4 flex items-center justify-between gap-3 ${
                    row.isLocalExplorer ? 'bg-amber-200/70' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 text-center font-mono font-bold tabular-nums text-sm text-[#24160c] shrink-0">
                      #{row.rank}
                    </div>
                    {renderExplorerPortrait(row)}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold font-display text-[#24160c]">
                        <span className="truncate">{row.explorerCallsign}</span>
                        {row.isLocalExplorer && (
                          <span className="text-xs font-sans font-semibold text-[#991b1b]">
                            · Vous
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#54361d] truncate">
                        {row.regionLabel}
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="text-sm font-bold text-[#24160c]">
                      {row.contributionCount} lieu{row.contributionCount > 1 ? 'x' : ''}
                    </div>
                    <div className="text-xs text-rose-900 font-semibold">
                      {row.points} pts
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : periodBoard.length === 0 ? (
          <div className="p-5 bg-[#f8edd6] border border-[#8c653b] text-center space-y-2">
            <p className="text-sm font-bold font-display text-[#24160c]">
              Le registre mensuel ({periodKey}) attend ses premiers relevés
            </p>
            <p className="text-xs text-[#54361d] max-w-lg mx-auto">
              Participez à n’importe quel défi quotidien, hebdomadaire ou mensuel pour inscrire votre rang au classement général du mois.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#8c653b]/35 border border-[#8c653b] bg-[#f8edd6]">
            {periodBoard.map((row) => (
              <div
                key={row.explorerId}
                className={`p-3 sm:px-4 flex items-center justify-between gap-3 ${
                  row.isLocalExplorer ? 'bg-amber-200/70' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 text-center font-mono font-bold tabular-nums text-sm text-[#24160c] shrink-0">
                    #{row.rank}
                  </div>
                  {renderExplorerPortrait(row)}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold font-display text-[#24160c]">
                      <span className="truncate">{row.explorerCallsign}</span>
                      {row.isLocalExplorer && (
                        <span className="text-xs font-sans font-semibold text-[#991b1b]">
                          · Vous
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#54361d] truncate">
                      {row.regionLabel} · {row.challengesJoined} défi{row.challengesJoined > 1 ? 's' : ''} relevé{row.challengesJoined > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono tabular-nums shrink-0">
                  <div className="text-sm font-bold text-rose-900">
                    {row.totalPoints} pts
                  </div>
                  <div className="text-xs text-[#54361d]">
                    {row.totalContributions} découverte{row.totalContributions > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
