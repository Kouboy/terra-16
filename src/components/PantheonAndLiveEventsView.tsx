import React, { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { LocalFestivalItem } from '../almanacAndQuests';
import {
  computeRealMoonPhase,
  getUpcomingOrActiveMeteorShower,
  MoonPhaseInfo,
} from '../astronomyAndSeasons';
import { subscribeToPantheonLeaderboard } from '../firebase';
import {
  buildPantheonLeaderboard,
  EvaluatedLiveWorldEvent,
  formatEventCountdownFr,
  getLiveEventMedallionById,
  LIVE_EVENT_MEDALLIONS_CATALOG,
  LiveEventMedallionCanvas,
  LiveEventMedallionId,
  PantheonLeaderboardRow,
  PantheonMetrics,
  PantheonSortKey,
  RankedPantheonExplorer,
} from '../pantheonAndLiveEvents';
import { playStampSfx } from '../sound';
import { TrophyBadgeCanvas } from '../trophies';
import {
  CATEGORY_META,
  ExplorationCategory,
  ExplorerAppearance,
  ExplorerProgress,
  UnlockedEntry,
  WeatherInfo,
} from '../types';
import { ExplorerSpriteCanvas } from './ExplorerAvatarCanvas';
import { ParchmentScrollStrip } from './ParchmentScrollStrip';
import { PixelCornerRivets, PixelGuildIcon, PixelUiIcon } from './PixelIcons';

interface PantheonAndLiveEventsViewProps {
  evaluatedEvents: EvaluatedLiveWorldEvent[];
  unlockedMedallionIds: ReadonlySet<LiveEventMedallionId>;
  localMetrics: PantheonMetrics;
  progress: ExplorerProgress;
  localAppearance: ExplorerAppearance;
  entries: UnlockedEntry[];
  user: User | null;
  cloudOnline: boolean;
  localRegionLabel: string;
  weather: WeatherInfo | null;
  moonInfo?: MoonPhaseInfo;
  localFestivals?: LocalFestivalItem[];
  muted: boolean;
  onClaimLiveEvent: (ev: EvaluatedLiveWorldEvent) => void;
  onFocusEventOnMap: (params: {
    focusCoords?: { lat: number; lng: number; label: string } | null;
    categoryFilter?: ExplorationCategory | 'all';
  }) => void;
  onOpenJournalEntry: (poiId: string) => void;
  onAuthAction: () => void;
  onOpenTrophyHall: () => void;
}

const SORT_OPTIONS: Array<{ id: PantheonSortKey; label: string }> = [
  { id: 'pantheon', label: 'Indice Panthéon' },
  { id: 'xp', label: 'Points XP' },
  { id: 'diversity', label: 'Diversité' },
  { id: 'rarity', label: 'Rareté' },
  { id: 'discoveries', label: 'Lieux Découverts' },
];

function safeHttpUrl(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

function formatSignedDelta(mine: number, rival: number): string {
  const diff = mine - rival;
  if (diff > 0) return `+${diff.toLocaleString('fr-FR')}`;
  if (diff < 0) return diff.toLocaleString('fr-FR');
  return '=';
}

export const PantheonAndLiveEventsView: React.FC<PantheonAndLiveEventsViewProps> = ({
  evaluatedEvents,
  unlockedMedallionIds,
  localMetrics,
  progress,
  localAppearance,
  entries,
  user,
  cloudOnline,
  localRegionLabel,
  weather,
  moonInfo,
  localFestivals = [],
  muted,
  onClaimLiveEvent,
  onFocusEventOnMap,
  onOpenJournalEntry,
  onAuthAction,
  onOpenTrophyHall,
}) => {
  const claimableCount = useMemo(
    () => evaluatedEvents.filter((ev) => ev.isCompleted && !ev.isClaimed).length,
    [evaluatedEvents]
  );

  const [section, setSection] = useState<'evenements' | 'pantheon'>(() =>
    claimableCount > 0 ? 'evenements' : 'evenements'
  );
  const [sortBy, setSortBy] = useState<PantheonSortKey>('pantheon');
  const [cloudRows, setCloudRows] = useState<PantheonLeaderboardRow[]>([]);
  const [compareExplorerId, setCompareExplorerId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const isVerifiedUser = Boolean(user && user.emailVerified && cloudOnline);

  // Live 1-second clock for time-limited real-world phenomenon windows
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Real-time Firestore Pantheon Leaderboard subscription (only when verified & online)
  useEffect(() => {
    if (!isVerifiedUser) {
      setCloudRows([]);
      return;
    }
    const unsub = subscribeToPantheonLeaderboard((rows) => {
      setCloudRows(rows);
    });
    return () => unsub();
  }, [isVerifiedUser]);

  const rankedExplorers: RankedPantheonExplorer[] = useMemo(
    () =>
      buildPantheonLeaderboard({
        cloudRows,
        localExplorerId: isVerifiedUser && user ? user.uid : null,
        localCallsign: progress.displayName || 'Explorateur',
        localRegionLabel: localRegionLabel || 'Contrée explorée',
        localMetrics,
        localProgress: progress,
        sortBy,
      }),
    [cloudRows, isVerifiedUser, user, progress, localRegionLabel, localMetrics, sortBy]
  );

  const selfRanked = useMemo(
    () => rankedExplorers.find((r) => r.isLocalSelf) || null,
    [rankedExplorers]
  );

  const rivalCandidates = useMemo(
    () => rankedExplorers.filter((r) => !r.isLocalSelf),
    [rankedExplorers]
  );

  const selectedRival = useMemo(() => {
    if (compareExplorerId) {
      const found = rivalCandidates.find((r) => r.explorerId === compareExplorerId);
      if (found) return found;
    }
    return rivalCandidates[0] || null;
  }, [compareExplorerId, rivalCandidates]);

  const moon = useMemo(() => moonInfo || computeRealMoonPhase(new Date(nowMs)), [moonInfo, nowMs]);
  const showerInfo = useMemo(() => getUpcomingOrActiveMeteorShower(new Date(nowMs)), [nowMs]);

  const entryIdsSet = useMemo(() => new Set(entries.map((e) => e.poiId)), [entries]);

  return (
    <div className="space-y-6">
      {/* Top 2-Mode Selector: Événements Vivants & Phénomènes | Panthéon Multijoueur */}
      <div className="grimoire-folio p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2
              className="text-lg sm:text-2xl font-bold font-display text-[#24160c]"
              style={{ textWrap: 'balance' }}
            >
              Panthéon des Explorateurs &amp; Phénomènes Vivants
            </h2>
            <p className="text-xs sm:text-sm text-[#54361d] max-w-3xl">
              Relevez des défis temporaires calés sur l’astronomie réelle, la météo en direct et les
              festivals culturels locaux, et comparez votre rang sur les trois piliers du Panthéon.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                playStampSfx(muted);
                setSection('evenements');
              }}
              className={`min-h-[44px] px-4 py-2 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                section === 'evenements'
                  ? 'bg-[#991b1b] text-[#fffbeb]'
                  : 'bg-[#f8edd6] text-[#24160c] hover:bg-amber-200'
              }`}
            >
              <PixelUiIcon name="moon-stars" className="w-4 h-4" />
              <span>
                {claimableCount > 0
                  ? `Événements Vivants · ${claimableCount} à sceller`
                  : `Événements Vivants (${evaluatedEvents.filter((e) => e.event.status === 'active').length})`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                playStampSfx(muted);
                setSection('pantheon');
              }}
              className={`min-h-[44px] px-4 py-2 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                section === 'pantheon'
                  ? 'bg-[#28160d] text-amber-300 border-[#d97706]'
                  : 'bg-[#f8edd6] text-[#24160c] hover:bg-amber-200'
              }`}
            >
              <PixelUiIcon name="star" className="w-4 h-4" />
              <span>
                Panthéon Multijoueur · {localMetrics.pantheonScore.toLocaleString('fr-FR')} pts
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 1 : ÉVÉNEMENTS VIVANTS & PHÉNOMÈNES RÉELS                    */}
      {/* ==================================================================== */}
      {section === 'evenements' && (
        <div className="space-y-6">
          {/* Real-World Telemetry Strip */}
          <div className="relative grimoire-folio-gold p-4 sm:p-5 space-y-3">
            <PixelCornerRivets className="bg-[#d97706]" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#b98b4e] pb-3">
              <div className="text-sm font-bold font-display text-[#24160c]">
                Conditions Réelles Relevées sur {localRegionLabel}
              </div>
              <div className="text-xs font-mono tabular-nums text-[#5c3d1e]">
                {unlockedMedallionIds.size}/{LIVE_EVENT_MEDALLIONS_CATALOG.length} médaillons ciselés ·{' '}
                {localMetrics.liveEventsCount} chronique
                {localMetrics.liveEventsCount > 1 ? 's' : ''} scellée
                {localMetrics.liveEventsCount > 1 ? 's' : ''}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#3b2513]">
              <div className="space-y-1">
                <div className="font-bold text-[#24160c] flex items-center gap-1.5">
                  <PixelUiIcon name="moon-stars" className="w-3.5 h-3.5" />
                  <span>Voûte Céleste &amp; Météores</span>
                </div>
                <div className="font-mono tabular-nums text-[#54361d]">
                  {moon.phaseNameFr} · {moon.illuminationPct}%
                </div>
                <div className="text-[#5c3d1e]">
                  {showerInfo.status === 'active'
                    ? `Essaim actif : ${showerInfo.shower.nameFr} (~${showerInfo.shower.zhrEstimate}/h)`
                    : `Prochain essaim : ${showerInfo.shower.nameFr} dans ${showerInfo.daysUntilStart} j`}
                </div>
              </div>

              <div className="space-y-1">
                <div className="font-bold text-[#24160c] flex items-center gap-1.5">
                  <PixelUiIcon name="sun-cloud" className="w-3.5 h-3.5" />
                  <span>Météo Locale en Direct</span>
                </div>
                <div className="font-mono tabular-nums text-[#54361d]">
                  {weather
                    ? `${weather.labelFr} · ${Math.round(weather.tempC)}°C · Vent ${Math.round(
                        weather.windKmh
                      )} km/h`
                    : 'Relevé atmosphérique en cours de synchronisation'}
                </div>
                <div className="text-[#5c3d1e]">
                  Créneaux météo renouvelés toutes les 6 heures selon Open-Meteo
                </div>
              </div>

              <div className="space-y-1">
                <div className="font-bold text-[#24160c] flex items-center gap-1.5">
                  <PixelUiIcon name="archive" className="w-3.5 h-3.5" />
                  <span>Panorama Culturel Local</span>
                </div>
                <div className="font-mono tabular-nums text-[#54361d]">
                  {localFestivals.length > 0
                    ? `${localFestivals.length} manifestation${
                        localFestivals.length > 1 ? 's' : ''
                      } recensée${localFestivals.length > 1 ? 's' : ''} à proximité`
                    : 'Saison patrimoniale du territoire active'}
                </div>
                <div className="text-[#5c3d1e] truncate">
                  {localFestivals[0]
                    ? `${localFestivals[0].name} (${localFestivals[0].commune})`
                    : 'Répertoire ouvert du Ministère de la Culture'}
                </div>
              </div>
            </div>
          </div>

          {/* Active & Upcoming Time-Limited Phenomenon Cards */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {evaluatedEvents.map((ev) => {
              const { event, currentCount, qualifyingEntries, isCompleted, isClaimed } = ev;
              const medallion = getLiveEventMedallionById(event.medallionId);
              const catMeta = CATEGORY_META[event.rewardCategory] || CATEGORY_META.histoire;
              const ratio = Math.min(1, currentCount / Math.max(1, event.targetCount));
              const countdownText =
                event.status === 'active'
                  ? `Fermeture dans ${formatEventCountdownFr(event.endsAtMs, nowMs)}`
                  : `Ouverture dans ${formatEventCountdownFr(event.startsAtMs, nowMs)}`;

              const safeJournalPoiId = `live_evt_${event.id
                .replace(/[^a-zA-Z0-9_-]/g, '_')
                .slice(0, 96)}`;
              const hasJournalEntry = entryIdsSet.has(safeJournalPoiId);
              const validExternalUrl = safeHttpUrl(event.externalUrl);

              return (
                <article
                  key={event.id}
                  className={`relative p-4 sm:p-5 border-2 border-[#2b1a0e] jrpg-shadow flex flex-col justify-between gap-4 ${
                    isCompleted && !isClaimed
                      ? 'bg-[#fffbeb]'
                      : event.status === 'upcoming'
                      ? 'bg-[#efe4cc]'
                      : 'bg-[#f8edd6]'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Unboxed Clean Kicker + Countdown */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6b4928]">
                      <span className="font-semibold">{event.kickerFr}</span>
                      <span className="font-mono tabular-nums font-bold text-[#24160c]">
                        {isClaimed ? 'Chronique scellée ✓' : countdownText}
                      </span>
                    </div>

                    {/* Title + 16-bit Event Medallion */}
                    <div className="flex items-start gap-3.5">
                      <div className="p-1.5 bg-[#1e120a] border-2 border-[#92400e] shrink-0">
                        <LiveEventMedallionCanvas
                          medallionId={event.medallionId}
                          unlocked={isClaimed || isCompleted || unlockedMedallionIds.has(event.medallionId)}
                          pixelScale={2}
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="text-base sm:text-lg font-bold font-display text-[#24160c] leading-snug">
                          {event.titleFr}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#54361d]">
                          <span className={`inline-flex items-center gap-1 font-bold ${catMeta.mapTextClass}`}>
                            <PixelGuildIcon category={event.rewardCategory} className="w-3.5 h-3.5" />
                            <span>{catMeta.shortLabel}</span>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums font-bold text-emerald-900">
                            +{event.xpReward} XP
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{medallion.name}</span>
                        </div>
                      </div>
                    </div>

                    {/* Phenomenon Live Telemetry */}
                    <div className="text-xs font-mono tabular-nums text-[#3b2513] bg-[#ead9b7] px-3 py-2 border border-[#b98b4e]">
                      {event.phenomenonTelemetryFr}
                    </div>

                    <p className="text-xs sm:text-sm text-[#3f2916] leading-relaxed">
                      {event.loreFr}
                    </p>
                  </div>

                  {/* Objective Progress & Actions */}
                  <div className="space-y-3 pt-3 border-t border-[#c8a36b]">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#24160c]">{event.goalLabelFr}</span>
                        <span className="font-mono tabular-nums font-bold text-[#24160c] shrink-0">
                          {Math.min(currentCount, event.targetCount)}/{event.targetCount}
                        </span>
                      </div>
                      <div className="h-2.5 bg-[#24160c] p-0.5">
                        <div
                          className={`h-full transition-opacity duration-150 ${
                            isCompleted || isClaimed ? 'bg-emerald-500' : 'bg-amber-400'
                          }`}
                          style={{ width: `${Math.round(ratio * 100)}%` }}
                        />
                      </div>
                    </div>

                    {qualifyingEntries.length > 0 && (
                      <div className="text-xs text-[#54361d] truncate">
                        Relevés validés :{' '}
                        <span className="font-semibold text-[#24160c]">
                          {qualifyingEntries
                            .slice(0, 3)
                            .map((q) => q.name)
                            .join(' · ')}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {isCompleted && !isClaimed && (
                        <button
                          type="button"
                          onClick={() => onClaimLiveEvent(ev)}
                          className="min-h-[44px] px-4 py-2 text-xs font-bold bg-emerald-800 hover:bg-emerald-700 text-[#fffbeb] border-2 border-[#1b1109] jrpg-shadow inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
                        >
                          <PixelUiIcon name="stamp" className="w-4 h-4" />
                          <span>Sceller Chronique &amp; Médaillon (+{event.xpReward} XP)</span>
                        </button>
                      )}

                      {isClaimed && hasJournalEntry && (
                        <button
                          type="button"
                          onClick={() => onOpenJournalEntry(safeJournalPoiId)}
                          className="min-h-[44px] px-3.5 py-2 text-xs font-bold bg-[#28160d] hover:bg-[#3f2416] text-amber-300 border-2 border-[#d97706] jrpg-shadow inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
                        >
                          <PixelUiIcon name="book" className="w-4 h-4" />
                          <span>Lire la Chronique au Carnet</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          onFocusEventOnMap({
                            focusCoords: event.focusCoords,
                            categoryFilter: event.suggestedCategoryFilter,
                          })
                        }
                        className="min-h-[44px] px-3.5 py-2 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
                      >
                        <PixelUiIcon name="map" className="w-4 h-4" />
                        <span>
                          {event.focusCoords ? 'Cibler le lieu sur la carte' : 'Explorer sur la carte'}
                        </span>
                      </button>

                      {validExternalUrl && (
                        <a
                          href={validExternalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[44px] px-3 py-2 text-xs font-bold bg-[#f8edd6] hover:bg-amber-100 text-[#24160c] border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                        >
                          <PixelUiIcon name="link" className="w-3.5 h-3.5" />
                          <span>Site officiel</span>
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* 16-Bit Phenomenon Medallion Cabinet (8 Collectibles) */}
          <div className="grimoire-folio p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#c89d62] pb-3">
              <div className="space-y-0.5">
                <h3 className="text-base sm:text-xl font-bold font-display text-[#24160c]">
                  Médaillier 16-Bit des Phénomènes Vivants
                </h3>
                <p className="text-xs text-[#54361d]">
                  Chaque phénomène réel accompli grave un médaillon d’émail dans votre collection et
                  accroît votre pilier Rareté au Panthéon (+220 pts par chronique scellée).
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenTrophyHall}
                className="min-h-[42px] px-3.5 py-2 text-xs font-bold bg-[#28160d] hover:bg-[#3f2416] text-amber-300 border-2 border-[#d97706] jrpg-shadow inline-flex items-center gap-2 whitespace-nowrap shrink-0 self-start sm:self-center transition-colors"
              >
                <PixelUiIcon name="shield" className="w-4 h-4" />
                <span>Salle des Trophées</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {LIVE_EVENT_MEDALLIONS_CATALOG.map((med) => {
                const isUnlocked = unlockedMedallionIds.has(med.id);
                return (
                  <div
                    key={med.id}
                    className={`p-3.5 border-2 flex items-start gap-3 ${
                      isUnlocked
                        ? 'bg-[#fffbeb] border-[#92400e]'
                        : 'bg-[#eadbc0]/75 border-[#8c653b] opacity-80'
                    }`}
                  >
                    <div className="p-1.5 bg-[#1b1109] border border-[#78350f] shrink-0">
                      <LiveEventMedallionCanvas
                        medallionId={med.id}
                        unlocked={isUnlocked}
                        pixelScale={2}
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="text-xs font-bold text-[#24160c] leading-snug">
                        {med.name}
                      </div>
                      <div className="text-[11px] text-[#6b4928]">
                        {med.phenomenonLabel} · {isUnlocked ? 'Obtenu ✓' : 'À ciseler'}
                      </div>
                      <p className="text-[11px] text-[#54361d] leading-snug">{med.lore}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 2 : PANTHÉON MULTIJOUEUR (XP + DIVERSITÉ + RARETÉ)           */}
      {/* ==================================================================== */}
      {section === 'pantheon' && (
        <div className="space-y-6">
          {/* Local Explorer 3-Pillar Breakdown Card */}
          <div className="relative grimoire-folio-gold p-4 sm:p-6 space-y-5">
            <PixelCornerRivets className="bg-[#d97706]" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 border-[#b98b4e] pb-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="p-1.5 bg-[#1e120a] border-2 border-[#d97706] shrink-0">
                  <ExplorerSpriteCanvas
                    appearance={localAppearance}
                    animated={false}
                    pixelScale={3}
                  />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#6b4928]">
                    <span className="font-bold text-[#24160c]">
                      {selfRanked ? `Rang #${selfRanked.rank}` : 'Indice Personnel'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{localRegionLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {localMetrics.discoveriesCount} lieu
                      {localMetrics.discoveriesCount > 1 ? 'x' : ''} découvert
                      {localMetrics.discoveriesCount > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-lg sm:text-2xl font-bold font-display text-[#24160c] truncate">
                      {progress.displayName || 'Explorateur'}
                    </h3>
                    {progress.pinnedTrophyId && (
                      <TrophyBadgeCanvas
                        trophyId={progress.pinnedTrophyId}
                        unlocked={true}
                        pixelScale={1}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 shrink-0">
                <div className="text-left lg:text-right">
                  <div className="text-xs text-[#6b4928] font-semibold">Indice Panthéon Total</div>
                  <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#24160c]">
                    {localMetrics.pantheonScore.toLocaleString('fr-FR')} pts
                  </div>
                </div>

                {!isVerifiedUser ? (
                  <button
                    type="button"
                    onClick={onAuthAction}
                    className="min-h-[44px] px-4 py-2 text-xs font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <PixelUiIcon name="user-profile" className="w-4 h-4" />
                    <span>Synchroniser au Panthéon Cloud</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenTrophyHall}
                    className="min-h-[44px] px-3.5 py-2 text-xs font-bold bg-[#28160d] hover:bg-[#3f2416] text-amber-300 border-2 border-[#d97706] jrpg-shadow inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <PixelUiIcon name="shield" className="w-4 h-4" />
                    <span>Épingler un Trophée</span>
                  </button>
                )}
              </div>
            </div>

            {/* The Three Pillars Transparency Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 bg-[#f8edd6] border border-[#b98b4e] space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-bold text-[#24160c]">
                    01. Pilier Expérience (XP)
                  </span>
                  <span className="text-base font-bold font-mono tabular-nums text-amber-950">
                    {localMetrics.totalXp.toLocaleString('fr-FR')} pts
                  </span>
                </div>
                <p className="text-xs text-[#54361d]">
                  Points d’expérience cumulés par vos découvertes de terrain, contrats, récits en
                  trois actes et défis accomplis.
                </p>
              </div>

              <div className="p-3.5 bg-[#f8edd6] border border-[#b98b4e] space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-bold text-[#24160c]">02. Pilier Diversité</span>
                  <span className="text-base font-bold font-mono tabular-nums text-emerald-900">
                    {localMetrics.diversityScore.toLocaleString('fr-FR')} pts
                  </span>
                </div>
                <div className="text-xs font-mono tabular-nums text-[#54361d]">
                  {localMetrics.categoriesCount}/5 branches · {localMetrics.strataCount}/7 strates ·{' '}
                  {localMetrics.sourcesCount} sources · {localMetrics.affinitiesCount}/7 roches ·{' '}
                  {localMetrics.subTypesCount} typologies
                </div>
              </div>

              <div className="p-3.5 bg-[#f8edd6] border border-[#b98b4e] space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-bold text-[#24160c]">03. Pilier Rareté</span>
                  <span className="text-base font-bold font-mono tabular-nums text-[#6b21a8]">
                    {localMetrics.rarityScore.toLocaleString('fr-FR')} pts
                  </span>
                </div>
                <div className="text-xs font-mono tabular-nums text-[#54361d]">
                  {localMetrics.secretArchivesCount} secret
                  {localMetrics.secretArchivesCount > 1 ? 's' : ''} ·{' '}
                  {localMetrics.officialHeritageCount} label
                  {localMetrics.officialHeritageCount > 1 ? 's' : ''} d’État ·{' '}
                  {localMetrics.subterraneanCount} souterrain
                  {localMetrics.subterraneanCount > 1 ? 's' : ''} ·{' '}
                  {localMetrics.archivistChestsCount} coffre
                  {localMetrics.archivistChestsCount > 1 ? 's' : ''} ·{' '}
                  {localMetrics.liveEventsCount} phénomène
                  {localMetrics.liveEventsCount > 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>

          {/* 16-Bit Podium (Top 1 to 3 Real Explorers) */}
          {rankedExplorers.length > 0 && (
            <div className="grimoire-folio p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-base sm:text-xl font-bold font-display text-[#24160c]">
                    Classement Multijoueur du Panthéon
                  </h3>
                  <p className="text-xs text-[#54361d]">
                    {isVerifiedUser
                      ? `${rankedExplorers.length} explorateur${
                          rankedExplorers.length > 1 ? 's' : ''
                        } synchronisé${rankedExplorers.length > 1 ? 's' : ''} en temps réel sur Firestore`
                      : 'Mode local actif — connectez un compte Google vérifié pour publier votre score et voir les autres explorateurs.'}
                  </p>
                </div>

                {/* Sort Segmented Controls */}
                <ParchmentScrollStrip fadeColorFrom="vellum" innerClassName="gap-1.5 py-0.5">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        playStampSfx(muted);
                        setSortBy(opt.id);
                      }}
                      className={`min-h-[40px] px-3 py-1.5 text-xs font-bold border-2 border-[#2b1a0e] whitespace-nowrap shrink-0 transition-colors ${
                        sortBy === opt.id
                          ? 'bg-[#991b1b] text-[#fffbeb]'
                          : 'bg-[#f8edd6] text-[#24160c] hover:bg-amber-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </ParchmentScrollStrip>
              </div>

              {/* Top 3 Podium Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {rankedExplorers.slice(0, 3).map((row) => {
                  const rowAppearance: ExplorerAppearance = row.isLocalSelf
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
                    <div
                      key={row.explorerId}
                      className={`p-4 border-2 border-[#2b1a0e] jrpg-shadow flex items-center gap-3.5 ${
                        row.rank === 1
                          ? 'bg-[#fef3c7]'
                          : row.rank === 2
                          ? 'bg-[#f8edd6]'
                          : 'bg-[#efe4cc]'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <span className="text-xs font-mono tabular-nums font-bold text-[#78350f]">
                          #{row.rank}
                        </span>
                        <div className="p-1 bg-[#1e120a] border border-[#92400e]">
                          <ExplorerSpriteCanvas
                            appearance={rowAppearance}
                            animated={false}
                            pixelScale={2}
                          />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-[#24160c] truncate">
                            {row.explorerCallsign}
                          </span>
                          {row.explorerPinnedTrophyId && (
                            <TrophyBadgeCanvas
                              trophyId={row.explorerPinnedTrophyId}
                              unlocked={true}
                              pixelScale={1}
                            />
                          )}
                        </div>
                        <div className="text-xs text-[#6b4928] truncate">
                          {row.regionLabel}
                          {row.isLocalSelf ? ' · Vous' : ''}
                        </div>
                        <div className="text-xs font-mono tabular-nums font-bold text-[#24160c]">
                          {row.pantheonScore.toLocaleString('fr-FR')} pts · {row.discoveriesCount}{' '}
                          lieu{row.discoveriesCount > 1 ? 'x' : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Complete Leaderboard Table */}
              <div className="overflow-x-auto border-2 border-[#8c653b] bg-[#fbf3e2]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#28160d] text-amber-200 border-b-2 border-[#8c653b]">
                      <th className="py-2.5 px-3 font-bold whitespace-nowrap">Rang</th>
                      <th className="py-2.5 px-3 font-bold whitespace-nowrap">Explorateur</th>
                      <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">
                        Indice Panthéon
                      </th>
                      <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">XP</th>
                      <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">
                        Diversité
                      </th>
                      <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">Rareté</th>
                      <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">Lieux</th>
                      <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">
                        Comparaison
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#d8bf94]">
                    {rankedExplorers.map((row) => {
                      const isCompared =
                        selectedRival && selectedRival.explorerId === row.explorerId;
                      return (
                        <tr
                          key={row.explorerId}
                          className={
                            row.isLocalSelf
                              ? 'bg-amber-100/90 font-semibold'
                              : isCompared
                              ? 'bg-[#f3e5c3]'
                              : 'hover:bg-[#f6ebd3]'
                          }
                        >
                          <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-[#24160c]">
                            #{row.rank}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-bold text-[#24160c] truncate max-w-[180px]">
                                {row.explorerCallsign}
                              </span>
                              {row.explorerPinnedTrophyId && (
                                <TrophyBadgeCanvas
                                  trophyId={row.explorerPinnedTrophyId}
                                  unlocked={true}
                                  pixelScale={1}
                                />
                              )}
                              <span className="text-[#6b4928] truncate max-w-[140px]">
                                · {row.regionLabel}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-[#24160c]">
                            {row.pantheonScore.toLocaleString('fr-FR')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-950">
                            {row.totalXp.toLocaleString('fr-FR')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-900">
                            {row.diversityScore.toLocaleString('fr-FR')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#6b21a8]">
                            {row.rarityScore.toLocaleString('fr-FR')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#3b2513]">
                            {row.discoveriesCount.toLocaleString('fr-FR')}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {row.isLocalSelf ? (
                              <span className="text-[#6b4928] whitespace-nowrap">Votre profil</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  playStampSfx(muted);
                                  setCompareExplorerId(row.explorerId);
                                }}
                                className={`min-h-[36px] px-2.5 py-1 text-xs font-bold border border-[#2b1a0e] whitespace-nowrap shrink-0 transition-colors ${
                                  isCompared
                                    ? 'bg-[#28160d] text-amber-300'
                                    : 'bg-[#f8edd6] hover:bg-amber-200 text-[#24160c]'
                                }`}
                              >
                                {isCompared ? 'Comparé ✓' : 'Comparer'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Side-by-Side Explorer Comparison ("Comparateur Face-à-Face") */}
          <div className="grimoire-folio p-4 sm:p-6 space-y-4">
            <div className="space-y-1 border-b border-[#c89d62] pb-3">
              <h3 className="text-base sm:text-lg font-bold font-display text-[#24160c]">
                Comparateur Face-à-Face des Explorateurs
              </h3>
              <p className="text-xs text-[#54361d]">
                Comparez point par point votre progression, vos découvertes rares et votre diversité
                cartographique avec un autre membre du Panthéon.
              </p>
            </div>

            {selectedRival ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-bold text-[#24160c]">
                  <span>
                    Vous : {progress.displayName || 'Explorateur'} ({localRegionLabel})
                  </span>
                  <span className="text-[#78350f]">face à</span>
                  <span>
                    #{selectedRival.rank} {selectedRival.explorerCallsign} (
                    {selectedRival.regionLabel})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {[
                    {
                      label: 'Indice Panthéon',
                      mine: localMetrics.pantheonScore,
                      rival: selectedRival.pantheonScore,
                    },
                    {
                      label: 'Points d’Expérience (XP)',
                      mine: localMetrics.totalXp,
                      rival: selectedRival.totalXp,
                    },
                    {
                      label: 'Score de Diversité',
                      mine: localMetrics.diversityScore,
                      rival: selectedRival.diversityScore,
                    },
                    {
                      label: 'Score de Rareté',
                      mine: localMetrics.rarityScore,
                      rival: selectedRival.rarityScore,
                    },
                    {
                      label: 'Lieux d’Intérêt Découverts',
                      mine: localMetrics.discoveriesCount,
                      rival: selectedRival.discoveriesCount,
                    },
                    {
                      label: 'Archives Secrètes Dévoilées',
                      mine: localMetrics.secretArchivesCount,
                      rival: selectedRival.secretArchivesCount,
                    },
                    {
                      label: 'Monuments & Labels d’État',
                      mine: localMetrics.officialHeritageCount,
                      rival: selectedRival.officialHeritageCount,
                    },
                    {
                      label: 'Phénomènes Vivants Scellés',
                      mine: localMetrics.liveEventsCount,
                      rival: selectedRival.liveEventsCount,
                    },
                  ].map((item) => {
                    const delta = formatSignedDelta(item.mine, item.rival);
                    const ahead = item.mine > item.rival;
                    const behind = item.mine < item.rival;
                    return (
                      <div
                        key={item.label}
                        className="p-3 bg-[#f8edd6] border border-[#b98b4e] space-y-1"
                      >
                        <div className="text-[#54361d] font-semibold">{item.label}</div>
                        <div className="flex items-baseline justify-between gap-2 font-mono tabular-nums">
                          <span className="text-sm font-bold text-[#24160c]">
                            {item.mine.toLocaleString('fr-FR')} vs{' '}
                            {item.rival.toLocaleString('fr-FR')}
                          </span>
                          <span
                            className={`font-bold ${
                              ahead
                                ? 'text-emerald-800'
                                : behind
                                ? 'text-rose-800'
                                : 'text-[#6b4928]'
                            }`}
                          >
                            {delta}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#f8edd6] border border-[#b98b4e] text-xs sm:text-sm text-[#54361d]">
                {isVerifiedUser
                  ? 'Vous êtes actuellement le premier explorateur inscrit sur ce Panthéon Firestore ! Dès qu’un autre éclaireur synchronisera ses découvertes, vous pourrez comparer vos trois piliers face-à-face ici.'
                  : 'Connectez-vous avec Google pour charger les explorateurs du Panthéon Cloud et activer le comparateur face-à-face en temps réel.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
