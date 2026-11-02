import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ActiveCalendarEvent,
  AlmanacQuestEvalContext,
  ClueTreasureHunt,
  computeHotColdReading,
  ContextualRiddle,
  formatDayMonthFr,
  resolveCalendarEventsForNow,
  resolveSeasonForDate,
  SEASON_META,
  SEASONAL_QUESTS_CATALOG,
  SeasonId,
  SectorAlmanacPayload,
} from '../almanacAndQuests';
import { RegionalTheme } from '../regionalBiomes';
import { playJournalOpenSfx, playMissionFanfare, playStampSfx } from '../sound';
import { CATEGORY_META, ExplorationCategory } from '../types';
import { PixelCornerRivets, PixelGuildIcon, PixelUiIcon } from './PixelIcons';

// ============================================================================
// 1. CRISP 16x16 PIXEL SEASONAL CRESTS
// ============================================================================

export const SeasonCrestSvg: React.FC<{ season: SeasonId; className?: string }> = ({
  season,
  className = 'w-8 h-8',
}) => {
  switch (season) {
    case 'printemps':
      // Blossom & Crystal Spring Droplet
      return (
        <svg
          viewBox="0 0 16 16"
          shapeRendering="crispEdges"
          className={`pixelated shrink-0 ${className}`}
          aria-hidden="true"
        >
          <rect x="1" y="1" width="14" height="14" fill="#14381d" />
          <rect x="6" y="2" width="4" height="2" fill="#f9a8d4" />
          <rect x="4" y="4" width="8" height="3" fill="#f472b6" />
          <rect x="7" y="5" width="2" height="2" fill="#fef08a" />
          <rect x="7" y="7" width="2" height="5" fill="#4ade80" />
          <rect x="4" y="9" width="3" height="2" fill="#22c55e" />
          <rect x="9" y="8" width="3" height="2" fill="#22c55e" />
          <rect x="3" y="12" width="10" height="2" fill="#38bdf8" />
        </svg>
      );
    case 'ete':
      // Radiant Solstice Sun & Standing Menhir
      return (
        <svg
          viewBox="0 0 16 16"
          shapeRendering="crispEdges"
          className={`pixelated shrink-0 ${className}`}
          aria-hidden="true"
        >
          <rect x="1" y="1" width="14" height="14" fill="#451a03" />
          <rect x="6" y="2" width="4" height="1" fill="#fef08a" />
          <rect x="5" y="3" width="6" height="4" fill="#fbbf24" />
          <rect x="6" y="4" width="4" height="2" fill="#fef9c3" />
          <rect x="3" y="4" width="1" height="2" fill="#f59e0b" />
          <rect x="12" y="4" width="1" height="2" fill="#f59e0b" />
          <rect x="7" y="8" width="2" height="5" fill="#d6d3d1" />
          <rect x="2" y="12" width="12" height="2" fill="#65a30d" />
        </svg>
      );
    case 'automne':
      // Amber Oak Leaf & Morning Mist
      return (
        <svg
          viewBox="0 0 16 16"
          shapeRendering="crispEdges"
          className={`pixelated shrink-0 ${className}`}
          aria-hidden="true"
        >
          <rect x="1" y="1" width="14" height="14" fill="#3b150c" />
          <rect x="7" y="2" width="3" height="2" fill="#fde047" />
          <rect x="5" y="4" width="7" height="3" fill="#fb923c" />
          <rect x="4" y="7" width="7" height="3" fill="#ea580c" />
          <rect x="6" y="10" width="2" height="3" fill="#78350f" />
          <rect x="2" y="12" width="5" height="1" fill="#fed7aa" opacity="0.75" />
          <rect x="9" y="13" width="5" height="1" fill="#fed7aa" opacity="0.75" />
        </svg>
      );
    case 'hiver':
      // Starry Frost Crystal & Warm Lantern Arch
      return (
        <svg
          viewBox="0 0 16 16"
          shapeRendering="crispEdges"
          className={`pixelated shrink-0 ${className}`}
          aria-hidden="true"
        >
          <rect x="1" y="1" width="14" height="14" fill="#0f172a" />
          <rect x="7" y="2" width="2" height="10" fill="#bae6fd" />
          <rect x="3" y="6" width="10" height="2" fill="#bae6fd" />
          <rect x="5" y="4" width="2" height="2" fill="#38bdf8" />
          <rect x="9" y="4" width="2" height="2" fill="#38bdf8" />
          <rect x="5" y="8" width="2" height="2" fill="#38bdf8" />
          <rect x="9" y="8" width="2" height="2" fill="#38bdf8" />
          <rect x="7" y="6" width="2" height="2" fill="#fef08a" />
          <rect x="2" y="13" width="12" height="1" fill="#e2e8f0" />
        </svg>
      );
  }
};

// ============================================================================
// 2. ALMANACH DES SAISONS, FÊTES & ÉPHÉMÉRIDES (GLOBALES + LOCALES)
// ============================================================================

export const AlmanacSeasonalPanel: React.FC<{
  almanacData: SectorAlmanacPayload | null;
  loadingAlmanac: boolean;
  previewMonthDay: { month: number; day: number } | null;
  onChangePreviewDate: (next: { month: number; day: number } | null) => void;
  regionalTheme: RegionalTheme;
  localAtmosphereLabel: string;
  evalContext: AlmanacQuestEvalContext;
  claimedAlmanacQuests: ReadonlySet<string>;
  muted: boolean;
  onClaimAlmanacReward: (
    questId: string,
    title: string,
    category: ExplorationCategory,
    xpBonus: number
  ) => void;
  onFocusLocationOnMap: (lat: number, lng: number) => void;
  onFilterCategoryOnMap: (category: ExplorationCategory) => void;
  onOpenCosmeticWorkshop?: (slot?: 'familiar' | 'outfit' | 'headgear' | 'tool' | 'pack') => void;
}> = ({
  almanacData,
  loadingAlmanac,
  previewMonthDay,
  onChangePreviewDate,
  regionalTheme,
  localAtmosphereLabel,
  evalContext,
  claimedAlmanacQuests,
  muted,
  onClaimAlmanacReward,
  onFocusLocationOnMap,
  onFilterCategoryOnMap,
  onOpenCosmeticWorkshop,
}) => {
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const realNow = useMemo(() => new Date(), []);
  const inspectedDate = useMemo(() => {
    if (!previewMonthDay) return realNow;
    return new Date(realNow.getFullYear(), previewMonthDay.month - 1, previewMonthDay.day, 12, 0, 0);
  }, [previewMonthDay, realNow]);

  const isPreviewMode = Boolean(
    previewMonthDay &&
      (previewMonthDay.month !== realNow.getMonth() + 1 ||
        previewMonthDay.day !== realNow.getDate())
  );

  const activeSeasonId = resolveSeasonForDate(inspectedDate);
  const seasonMeta = SEASON_META[activeSeasonId];

  const { activeGlobalEvents, upcomingGlobalEvents, regionalTradition } = useMemo(
    () => resolveCalendarEventsForNow(regionalTheme.id, inspectedDate),
    [regionalTheme.id, inspectedDate]
  );

  const seasonalQuests = useMemo(
    () => SEASONAL_QUESTS_CATALOG.filter((q) => q.season === activeSeasonId),
    [activeSeasonId]
  );

  const formattedInspectedDate = inspectedDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const localityDisplay = useMemo(() => {
    if (!almanacData?.locality) return localAtmosphereLabel;
    const { commune, departement, region } = almanacData.locality;
    return [commune, departement, region].filter(Boolean).join(' · ');
  }, [almanacData, localAtmosphereLabel]);

  // Dynamic Local Anniversary Quest when Wikidata finds a real local anniversary in this sector!
  const featuredLocalAnniv = almanacData?.localAnniversaries?.[0] || null;
  const localAnnivQuestId = featuredLocalAnniv
    ? `lq_anniv_${featuredLocalAnniv.id}_${inspectedDate.getMonth() + 1}`
    : '';
  const localAnnivProgress = Math.min(1, evalContext.entries.length);
  const localAnnivClaimed = localAnnivQuestId ? claimedAlmanacQuests.has(localAnnivQuestId) : false;

  const renderCalendarEventCard = (item: ActiveCalendarEvent) => {
    const ev = item.event;
    const catMeta = CATEGORY_META[ev.category];
    const progressCount = ev.evaluateProgress(evalContext);
    const claimed = claimedAlmanacQuests.has(ev.id);
    const canClaim = !isPreviewMode && !claimed && progressCount >= ev.targetCount;

    return (
      <div
        key={ev.id}
        className={`relative p-4 sm:p-5 flex flex-col justify-between gap-3.5 ${
          claimed ? 'bg-[#ecfdf5] border-2 border-emerald-800 jrpg-shadow' : 'grimoire-folio'
        }`}
      >
        <PixelCornerRivets className={claimed ? 'bg-emerald-600' : 'bg-[#d97706]'} />
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#54361d]">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <PixelGuildIcon category={ev.category} className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{ev.kicker}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-bold text-rose-900">{item.dateRangeLabel}</span>
            </div>
            <span className="font-mono tabular-nums font-bold text-emerald-800 shrink-0">
              +{ev.xpBonus} XP
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-bold font-display text-[#24160c] leading-snug break-words">
            {ev.title}
          </h3>
          <div className="text-xs font-bold text-amber-950 break-words">{ev.subtitle}</div>
          <p className="text-xs text-[#4a321d] leading-relaxed break-words">{ev.description}</p>
        </div>

        <div className="pt-2.5 border-t border-[#c89d62]/80 space-y-2.5">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[#24160c] break-words">
                Quête : {ev.questTitle}
              </span>
              <span className="font-mono tabular-nums font-bold text-rose-900 shrink-0">
                {progressCount} / {ev.targetCount}
              </span>
            </div>
            <p className="text-[11px] text-[#54361d] break-words">{ev.questGoalDescription}</p>
            <div className="w-full h-2 pixel-gauge-track overflow-hidden">
              <div
                className={`h-full ${claimed ? 'bg-emerald-500' : 'bg-[#d97706]'}`}
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((progressCount / Math.max(1, ev.targetCount)) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`text-xs font-semibold ${catMeta.mapTextClass}`}>
              Branche {catMeta.shortLabel}
              {item.daysRemaining > 0 && ev.scope === 'global'
                ? ` · encore ${item.daysRemaining} j.`
                : ''}
            </span>

            {claimed ? (
              <span className="text-xs font-bold text-emerald-800">Récompense scellée ✓</span>
            ) : canClaim ? (
              <button
                type="button"
                onClick={() => {
                  playMissionFanfare(muted);
                  onClaimAlmanacReward(ev.id, ev.questTitle, ev.category, ev.xpBonus);
                }}
                className="min-h-[44px] px-3.5 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow whitespace-nowrap shrink-0"
              >
                Réclamer +{ev.xpBonus} XP
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onFilterCategoryOnMap(ev.category)}
                className="min-h-[42px] px-3 py-1.5 text-xs font-bold bg-[#ecd8b1] hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <PixelUiIcon name="map" className="w-3.5 h-3.5" />
                <span>Explorer sur la carte</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* 1. HERO SEASONAL & CALENDAR BANNER */}
      <div className="relative grimoire-folio-gold p-4 sm:p-6 space-y-4">
        <PixelCornerRivets className="bg-[#d97706]" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="p-1 bg-[#28160d] border-2 border-[#2b1a0e] jrpg-shadow shrink-0">
              <SeasonCrestSvg season={activeSeasonId} className="w-12 h-12" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#54361d] font-semibold">
                <span className="capitalize font-bold text-rose-900">{formattedInspectedDate}</span>
                <span aria-hidden="true">·</span>
                <span>{seasonMeta.dateSpanLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-950 font-bold break-words">{localityDisplay}</span>
              </div>
              <h2
                className="text-lg sm:text-2xl font-bold font-display text-[#24160c] leading-snug break-words"
                style={{ textWrap: 'balance' }}
              >
                {seasonMeta.almanacTitle}
              </h2>
              <p className="text-xs sm:text-sm italic text-[#4a321d] break-words">
                « {seasonMeta.motto} »
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isPreviewMode && (
              <button
                type="button"
                onClick={() => {
                  onChangePreviewDate(null);
                  setDatePickerOpen(false);
                }}
                className="min-h-[44px] px-3.5 py-2 text-xs font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow whitespace-nowrap shrink-0"
              >
                Revenir à aujourd’hui
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                playJournalOpenSfx(muted);
                setDatePickerOpen((v) => !v);
              }}
              className="min-h-[44px] px-3.5 py-2 text-xs font-bold bg-[#28160d] hover:bg-[#3f2416] text-amber-300 border-2 border-[#d97706] jrpg-shadow inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <PixelUiIcon name="book" className="w-3.5 h-3.5" />
              <span>{datePickerOpen ? 'Fermer le calendrier' : 'Feuilleter une autre date'}</span>
            </button>
          </div>
        </div>

        {datePickerOpen && (
          <div className="pt-3 border-t-2 border-[#c89d62] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#4a321d]">
              <span className="font-semibold">
                Explorez les fêtes thématiques, saisons et éphémérides d’un autre jour de l’année :
              </span>
              {isPreviewMode && (
                <span className="font-bold text-rose-900">
                  Mode aperçu calendaire (validation des quêtes active à la date réelle)
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { label: 'Aujourd’hui', m: realNow.getMonth() + 1, d: realNow.getDate() },
                  { label: 'Équinoxe Printemps (21 mars)', m: 3, d: 21 },
                  { label: 'Archéologie JEA (15 juin)', m: 6, d: 15 },
                  { label: 'Solstice d’Été (21 juin)', m: 6, d: 21 },
                  { label: 'Nuits des Étoiles (10 août)', m: 8, d: 10 },
                  { label: 'Patrimoine JEP (20 sept.)', m: 9, d: 20 },
                  { label: 'Veillée des Brumes (2 nov.)', m: 11, d: 2 },
                  { label: 'Sainte-Barbe (4 déc.)', m: 12, d: 4 },
                  { label: 'Solstice d’Hiver (21 déc.)', m: 12, d: 21 },
                ] as Array<{ label: string; m: number; d: number }>
              ).map((preset) => {
                const active =
                  inspectedDate.getMonth() + 1 === preset.m &&
                  inspectedDate.getDate() === preset.d;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      preset.m === realNow.getMonth() + 1 && preset.d === realNow.getDate()
                        ? onChangePreviewDate(null)
                        : onChangePreviewDate({ month: preset.m, day: preset.d })
                    }
                    className={`min-h-[40px] px-3 py-1.5 text-xs font-bold border-2 border-[#2b1a0e] whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'bg-[#991b1b] text-[#fffbeb] jrpg-shadow'
                        : 'bg-[#ecd8b1] text-[#24160c] hover:bg-amber-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ALMANAC FAMILIARS & COSMETICS REWARD TRACK */}
      <div className="grimoire-folio p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-rose-900">
            <PixelUiIcon name="paw" className="w-4 h-4 shrink-0" />
            <span>
              Familiers &amp; Cosmétiques de l’Almanach ({claimedAlmanacQuests.size} quête
              {claimedAlmanacQuests.size > 1 ? 's' : ''} validée
              {claimedAlmanacQuests.size > 1 ? 's' : ''})
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#3b2312]">
            <span className={claimedAlmanacQuests.size >= 1 ? 'font-bold text-emerald-800' : ''}>
              {claimedAlmanacQuests.size >= 1 ? '✓ ' : '1 quête : '}Goupil des Saisons &amp; Sablier
              Astral
            </span>
            <span aria-hidden="true">·</span>
            <span className={claimedAlmanacQuests.size >= 2 ? 'font-bold text-emerald-800' : ''}>
              {claimedAlmanacQuests.size >= 2 ? '✓ ' : '2 quêtes : '}Couronne &amp; Manteau Solaire
            </span>
            <span aria-hidden="true">·</span>
            <span className={claimedAlmanacQuests.size >= 3 ? 'font-bold text-emerald-800' : ''}>
              {claimedAlmanacQuests.size >= 3 ? '✓ ' : '3 quêtes : '}Feu-Follet Astral &amp; Grand
              Almanach
            </span>
          </div>
        </div>
        {onOpenCosmeticWorkshop && (
          <button
            type="button"
            onClick={() => onOpenCosmeticWorkshop('familiar')}
            className="min-h-[40px] px-3.5 py-1.5 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start lg:self-center"
          >
            <PixelUiIcon name="paw" className="w-3.5 h-3.5" />
            <span>Atelier &amp; Familiers</span>
          </button>
        )}
      </div>

      {/* 2. ACTIVE GLOBAL FESTIVALS + REGIONAL TERROIR TRADITION */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base sm:text-lg font-bold font-display text-[#24160c] flex items-center gap-2">
            <PixelUiIcon name="star" className="w-4 h-4" />
            <span>Fêtes, Journées Thématiques & Tradition du Terroir</span>
          </h3>
          <span className="text-xs text-[#54361d]">
            Calendrier culturel global & identité régionale ({regionalTheme.shortLabel})
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {activeGlobalEvents.map((ev) => renderCalendarEventCard(ev))}
          {regionalTradition && renderCalendarEventCard(regionalTradition)}
        </div>

        {upcomingGlobalEvents.length > 0 && (
          <div className="grimoire-folio p-4 space-y-2.5">
            <div className="text-xs font-bold font-display text-[#24160c]">
              Prochains rendez-vous à l’Almanach :
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {upcomingGlobalEvents.map((up) => (
                <button
                  key={up.event.id}
                  type="button"
                  onClick={() =>
                    onChangePreviewDate({
                      month: up.event.startMonth,
                      day: up.event.startDay,
                    })
                  }
                  className="text-left p-3 bg-[#ecd8b1] hover:bg-[#fffbeb] border-2 border-[#8c653b] hover:border-[#2b1a0e] space-y-1 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-rose-900 font-bold">
                    <span>{up.dateRangeLabel}</span>
                    <span>dans {up.daysUntilStart} j.</span>
                  </div>
                  <div className="text-xs font-bold text-[#24160c] break-words">
                    {up.event.title}
                  </div>
                  <div className="text-[11px] text-[#54361d] break-words">
                    +{up.event.xpBonus} XP · {CATEGORY_META[up.event.category].shortLabel}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. REAL EPHEMERIDES OF THE DAY: LOCAL TERRITORY (35 KM) + GLOBAL HISTORY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {/* Local Territory Anniversaries (Wikidata Geo-SPARQL + GeoAPI) */}
        <div className="relative grimoire-folio p-4 sm:p-5 space-y-3.5 flex flex-col justify-between">
          <PixelCornerRivets className="bg-[#f59e0b]" />
          <div className="space-y-3">
            <div className="border-b-2 border-[#c89d62] pb-2.5 space-y-0.5">
              <div className="text-xs font-semibold text-rose-900">
                Mémoire Locale · Rayon 35 km autour de vos pas
              </div>
              <h3 className="text-base sm:text-lg font-bold font-display text-[#24160c] break-words">
                Anniversaires & Chroniques en {almanacData?.locality.commune || 'terre locale'}
              </h3>
            </div>

            {loadingAlmanac ? (
              <p className="text-xs text-[#6b4928] py-4">
                Consultation des registres historiques locaux et communaux…
              </p>
            ) : almanacData && almanacData.localAnniversaries.length > 0 ? (
              <div className="space-y-2.5">
                {almanacData.localAnniversaries.map((anniv) => (
                  <div
                    key={anniv.id}
                    className="p-3 bg-[#ecd8b1] border border-[#8c653b] space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#54361d]">
                      <span className="font-bold text-rose-900">
                        {anniv.exactDayMatch
                          ? `Anniversaire exact · ${anniv.dateLabel}`
                          : `Même mois dans la contrée · ${anniv.dateLabel}`}
                      </span>
                      <span className="tabular-nums font-bold text-[#24160c]">
                        à {anniv.distanceKm} km
                      </span>
                    </div>
                    <div className="text-sm font-bold text-[#24160c] break-words">
                      {anniv.label}
                    </div>
                    <p className="text-xs text-[#4a321d] break-words">{anniv.description}</p>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => onFocusLocationOnMap(anniv.lat, anniv.lng)}
                        className="min-h-[38px] px-2.5 py-1 text-xs font-bold bg-[#28160d] hover:bg-[#3f2416] text-amber-300 border border-[#d97706] inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <PixelUiIcon name="cursor" className="w-3 h-3" />
                        <span>Voir ce lieu sur la carte</span>
                      </button>
                      {anniv.articleUrl && (
                        <a
                          href={anniv.articleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-rose-900 hover:text-rose-700 underline underline-offset-4"
                        >
                          Archive Wikipédia
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#54361d] leading-relaxed py-2">
                Aucune commémoration datée précise n’est répertoriée ce mois-ci dans les 35 km sur
                Wikidata, mais les monuments et lieux-dits de{' '}
                <strong>{almanacData?.locality.commune || localAtmosphereLabel}</strong> gardent la
                mémoire de chaque siècle sur la carte 16-bit.
              </p>
            )}
          </div>

          {featuredLocalAnniv && (
            <div className="pt-3 border-t border-[#c89d62] flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#24160c] break-words">
                  Hommage Local : découvrir 1 lieu autour de vous en mémoire de «{' '}
                  {featuredLocalAnniv.label} »
                </div>
                <div className="text-[11px] font-mono text-emerald-800 font-bold">
                  +120 XP Histoire · Progression : {localAnnivProgress}/1
                </div>
              </div>
              {localAnnivClaimed ? (
                <span className="text-xs font-bold text-emerald-800 shrink-0">Honoré ✓</span>
              ) : !isPreviewMode && localAnnivProgress >= 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    playMissionFanfare(muted);
                    onClaimAlmanacReward(
                      localAnnivQuestId,
                      `Hommage : ${featuredLocalAnniv.label}`,
                      'histoire',
                      120
                    );
                  }}
                  className="min-h-[42px] px-3 py-1.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow whitespace-nowrap shrink-0"
                >
                  Réclamer +120 XP
                </button>
              ) : null}
            </div>
          )}
        </div>

        {/* Global Ephemerides ("Ce jour-là dans l'Histoire & les Sciences") */}
        <div className="relative grimoire-folio p-4 sm:p-5 space-y-3.5">
          <PixelCornerRivets className="bg-[#f59e0b]" />
          <div className="border-b-2 border-[#c89d62] pb-2.5 space-y-0.5">
            <div className="text-xs font-semibold text-amber-950">
              Éphéméride Globale ·{' '}
              {formatDayMonthFr(inspectedDate.getMonth() + 1, inspectedDate.getDate())}
            </div>
            <h3 className="text-base sm:text-lg font-bold font-display text-[#24160c]">
              Ce jour-là dans l’Histoire, les Sciences & les Explorations
            </h3>
          </div>

          {loadingAlmanac ? (
            <p className="text-xs text-[#6b4928] py-4">
              Ouverture des éphémérides encyclopédiques du jour…
            </p>
          ) : almanacData && almanacData.globalEphemerides.length > 0 ? (
            <div className="space-y-2.5">
              {almanacData.globalEphemerides.map((eph, idx) => (
                <div
                  key={`${eph.year}_${idx}`}
                  className="p-3 bg-[#ecd8b1] border border-[#8c653b] space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-mono">
                    <span className="font-bold text-rose-900">Année {eph.year}</span>
                    {eph.articleUrl && (
                      <a
                        href={eph.articleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-sans font-bold text-[#24160c] hover:text-rose-900 underline underline-offset-4 truncate max-w-[180px]"
                      >
                        {eph.articleTitle || 'Lire l’archive'}
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-[#2b1a0e] leading-relaxed break-words">{eph.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#54361d] py-3">
              Les éphémérides en ligne sont momentanément hors de portée (mode hors-ligne actif),
              mais toutes vos quêtes saisonnières et calendaires restent disponibles.
            </p>
          )}
        </div>
      </div>

      {/* 4. SEASONAL QUESTS OF THE CURRENT SEASON */}
      <div className="space-y-3">
        <h3 className="text-base sm:text-lg font-bold font-display text-[#24160c] flex items-center gap-2">
          <PixelUiIcon name="scroll" className="w-4 h-4" />
          <span>Quêtes Saisonnières · {seasonMeta.nameFr}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {seasonalQuests.map((sq) => {
            const prog = sq.evaluateProgress(evalContext);
            const claimed = claimedAlmanacQuests.has(sq.id);
            const canClaim = !isPreviewMode && !claimed && prog >= sq.targetCount;
            const catMeta = CATEGORY_META[sq.category];

            return (
              <div
                key={sq.id}
                className={`relative p-4 sm:p-5 flex flex-col justify-between gap-3 ${
                  claimed
                    ? 'bg-[#ecfdf5] border-2 border-emerald-800 jrpg-shadow'
                    : 'grimoire-folio'
                }`}
              >
                <PixelCornerRivets className={claimed ? 'bg-emerald-600' : 'bg-[#f59e0b]'} />
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs text-[#54361d]">
                    <span className="inline-flex items-center gap-1.5 font-semibold min-w-0">
                      <PixelGuildIcon category={sq.category} className="w-4 h-4 shrink-0" />
                      <span className="truncate">{sq.kicker}</span>
                    </span>
                    <span className="font-mono tabular-nums font-bold text-emerald-800 shrink-0">
                      +{sq.xpBonus} XP
                    </span>
                  </div>
                  <h4 className="text-base font-bold font-display text-[#24160c] break-words">
                    {sq.title}
                  </h4>
                  <p className="text-xs text-[#4a321d] leading-relaxed break-words">
                    {sq.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#c89d62]/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className={`font-sans font-bold ${catMeta.mapTextClass}`}>
                      Guilde {catMeta.shortLabel}
                    </span>
                    <span className="font-bold text-[#24160c]">
                      {prog} / {sq.targetCount}
                    </span>
                  </div>
                  <div className="w-full h-2 pixel-gauge-track overflow-hidden">
                    <div
                      className={`h-full ${claimed ? 'bg-emerald-500' : 'bg-[#991b1b]'}`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((prog / Math.max(1, sq.targetCount)) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-end">
                    {claimed ? (
                      <span className="text-xs font-bold text-emerald-800">
                        Quête saisonnière accomplie ✓
                      </span>
                    ) : canClaim ? (
                      <button
                        type="button"
                        onClick={() => {
                          playMissionFanfare(muted);
                          onClaimAlmanacReward(sq.id, sq.title, sq.category, sq.xpBonus);
                        }}
                        className="min-h-[44px] px-3.5 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow whitespace-nowrap"
                      >
                        Réclamer +{sq.xpBonus} XP
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. CHASSE AU TRÉSOR PAR PISTE D'INDICES (3 ÉTAPES + BOUSSOLE CHAUD/FROID)
// ============================================================================

export const ClueTreasureHuntPanel: React.FC<{
  hunt: ClueTreasureHunt | null;
  activeStepIdx: number;
  isCompleted: boolean;
  completedHuntsCount?: number;
  isTrackingOnMap: boolean;
  playerLat: number;
  playerLng: number;
  simulationMode: boolean;
  muted: boolean;
  onToggleTrackOnMap: (track: boolean) => void;
  onSimulateWalkTowardStep: (lat: number, lng: number, isSubterranean: boolean) => void;
  onClaimStepHere: () => void;
  onOpenCosmeticWorkshop?: (slot?: 'familiar' | 'outfit' | 'headgear' | 'tool' | 'pack') => void;
}> = ({
  hunt,
  activeStepIdx,
  isCompleted,
  completedHuntsCount = 0,
  isTrackingOnMap,
  playerLat,
  playerLng,
  simulationMode,
  muted,
  onToggleTrackOnMap,
  onSimulateWalkTowardStep,
  onClaimStepHere,
  onOpenCosmeticWorkshop,
}) => {
  const [archiveHintOpen, setArchiveHintOpen] = useState(false);

  if (!hunt) {
    return (
      <div className="relative grimoire-folio p-6 text-center space-y-2">
        <PixelCornerRivets className="bg-[#d97706]" />
        <h3 className="text-base font-bold font-display text-[#24160c]">
          Sondage d’une piste aux trésors en cours…
        </h3>
        <p className="text-xs text-[#54361d]">
          Dès que le secteur compte au moins deux repères patrimoniaux ou naturels, un parchemin
          codé se déploie automatiquement autour de vous.
        </p>
      </div>
    );
  }

  const currentStep = hunt.steps[Math.min(activeStepIdx, hunt.steps.length - 1)];
  const reading = computeHotColdReading(
    playerLat,
    playerLng,
    currentStep.lat,
    currentStep.lng,
    currentStep.reachRadiusMeters
  );

  const heatBadgeColors: Record<typeof reading.level, string> = {
    glacial: 'text-sky-900',
    froid: 'text-sky-800',
    tiede: 'text-amber-900',
    chaud: 'text-orange-800',
    brulant: 'text-rose-900',
    sur_place: 'text-emerald-800',
  };

  return (
    <div className="space-y-4">
      <div
        className={`relative p-4 sm:p-6 space-y-4 ${
          isCompleted
            ? 'bg-[#ecfdf5] border-2 border-emerald-800 jrpg-shadow'
            : 'grimoire-folio-gold'
        }`}
      >
        <PixelCornerRivets className={isCompleted ? 'bg-emerald-600' : 'bg-[#d97706]'} />

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b-2 border-[#c89d62] pb-3.5">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#54361d] font-semibold">
              <span className="font-bold text-rose-900 inline-flex items-center gap-1.5">
                <PixelUiIcon name="chest" className="w-4 h-4" />
                <span>Chasse au Trésor par Indices</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>{hunt.steps.length} jalons secrets</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-bold text-emerald-800">+{hunt.xpReward} XP</span>
            </div>
            <h2 className="text-lg sm:text-2xl font-bold font-display text-[#24160c] break-words">
              {hunt.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#4a321d] leading-relaxed break-words">
              {hunt.subtitle}
            </p>
          </div>

          <div className="p-2.5 bg-[#28160d] text-amber-200 border-2 border-[#2b1a0e] jrpg-shadow text-xs shrink-0 space-y-0.5">
            <div className="text-[11px] text-amber-400/90 font-semibold">Trésor final scellé</div>
            <div className="font-bold font-display text-amber-200">{hunt.relicTitle}</div>
          </div>
        </div>

        {/* LIVE TELLURIC COMPASS & HOT/COLD BAR FOR CURRENT STEP */}
        {!isCompleted && (
          <div className="p-3.5 sm:p-4 bg-[#f8edd6] border-2 border-[#6b4928] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="font-bold text-[#24160c] flex items-center gap-2">
                <PixelUiIcon name="pocket-compass" className="w-4 h-4 text-rose-900 shrink-0" />
                <span>
                  Étape {activeStepIdx + 1} sur {hunt.steps.length} · Cap{' '}
                  <strong className="text-rose-900">{reading.compassFr}</strong> (
                  {reading.approxBandFr})
                </span>
              </div>
              <span className={`font-mono font-bold ${heatBadgeColors[reading.level]}`}>
                Résonance : {reading.labelFr}
              </span>
            </div>

            <div className="w-full h-2.5 pixel-gauge-track overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  reading.level === 'sur_place'
                    ? 'bg-emerald-500'
                    : reading.level === 'brulant' || reading.level === 'chaud'
                    ? 'bg-[#dc2626]'
                    : reading.level === 'tiede'
                    ? 'bg-[#d97706]'
                    : 'bg-[#0284c7]'
                }`}
                style={{ width: `${reading.heatPct}%` }}
              />
            </div>

            <p className="text-sm font-display font-bold text-[#24160c] leading-relaxed break-words">
              {currentStep.poeticClue}
            </p>

            {archiveHintOpen ? (
              <div className="p-2.5 bg-[#ecd8b1] border border-[#8c653b] text-xs text-[#3b2312] break-words">
                {currentStep.terrainClue}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  playJournalOpenSfx(muted);
                  setArchiveHintOpen(true);
                }}
                className="text-xs font-bold text-rose-900 hover:text-rose-700 underline underline-offset-4"
              >
                Dévoiler un indice d’archive supplémentaire (gratuit)
              </button>
            )}

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {reading.level === 'sur_place' && (
                <button
                  type="button"
                  onClick={onClaimStepHere}
                  className="min-h-[44px] px-4 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <PixelUiIcon name="stamp" className="w-4 h-4" />
                  <span>
                    {activeStepIdx + 1 >= hunt.steps.length
                      ? 'Ouvrir le Coffre Final !'
                      : 'Valider ce jalon sur place !'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onToggleTrackOnMap(!isTrackingOnMap)}
                className={`min-h-[44px] px-4 py-2 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
                  isTrackingOnMap
                    ? 'bg-[#28160d] text-amber-300'
                    : 'bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb]'
                }`}
              >
                <PixelUiIcon name="pocket-compass" className="w-4 h-4" />
                <span>
                  {isTrackingOnMap
                    ? 'Boussole de piste affichée sur la Carte ✓'
                    : 'Afficher le radar Chaud/Froid sur la Carte'}
                </span>
              </button>

              {simulationMode && (
                <button
                  type="button"
                  onClick={() =>
                    onSimulateWalkTowardStep(
                      currentStep.lat,
                      currentStep.lng,
                      currentStep.isSubterranean
                    )
                  }
                  className="min-h-[44px] px-3.5 py-2 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <PixelUiIcon name="boot" className="w-4 h-4" />
                  <span>Marcher vers ce cap (Simulé)</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3 SEALED / UNSEALED STANZAS LIST */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {hunt.steps.map((st, idx) => {
            const stepSolved = isCompleted || idx < activeStepIdx;
            const isCurrent = !isCompleted && idx === activeStepIdx;
            return (
              <div
                key={st.poiId}
                className={`p-3.5 border-2 space-y-1.5 ${
                  stepSolved
                    ? 'bg-[#ecfdf5] border-emerald-800'
                    : isCurrent
                    ? 'bg-amber-100/90 border-[#991b1b]'
                    : 'bg-[#ecd8b1]/70 border-[#8c653b] opacity-80'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs font-mono">
                  <span className="font-bold text-rose-900">
                    {stepSolved ? `✓ Étape ${idx + 1}` : `Étape ${idx + 1}`}
                  </span>
                  <span className="font-sans font-semibold text-[#54361d]">
                    {CATEGORY_META[st.category].shortLabel}
                  </span>
                </div>
                <div className="text-sm font-bold font-display text-[#24160c] break-words">
                  {stepSolved
                    ? st.trueName
                    : isCurrent
                    ? `? ${st.mysteryTitle}`
                    : 'Strophe scellée à la cire'}
                </div>
                <p className="text-xs text-[#4a321d] break-words">
                  {stepSolved
                    ? 'Jalon identifié et consigné sur votre piste.'
                    : isCurrent
                    ? 'Suivez le cap et le thermomètre tellurique pour briser ce sceau.'
                    : 'Atteignez le jalon précédent pour révéler cet indice.'}
                </p>
              </div>
            );
          })}
        </div>

        {/* TREASURE HUNT FAMILIARS & COSMETICS LOOT TRACK */}
        <div className="pt-3 border-t-2 border-[#c89d62] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-rose-900">
              <PixelUiIcon name="paw" className="w-4 h-4 shrink-0" />
              <span>
                Butin des Chasses aux Trésors ({completedHuntsCount} piste
                {completedHuntsCount > 1 ? 's' : ''} percée
                {completedHuntsCount > 1 ? 's' : ''})
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#3b2312]">
              <span className={completedHuntsCount >= 1 ? 'font-bold text-emerald-800' : ''}>
                {completedHuntsCount >= 1 ? '✓ ' : '1 chasse : '}Scarabée Boussole &amp; Bicorne
              </span>
              <span aria-hidden="true">·</span>
              <span className={completedHuntsCount >= 2 ? 'font-bold text-emerald-800' : ''}>
                {completedHuntsCount >= 2 ? '✓ ' : '2 chasses : '}Corbeau Porte-Parchemin &amp; Clef
                d’Or
              </span>
              <span aria-hidden="true">·</span>
              <span className={completedHuntsCount >= 3 ? 'font-bold text-emerald-800' : ''}>
                {completedHuntsCount >= 3 ? '✓ ' : '3 chasses : '}Pelisse de Pisteur &amp; Coffre
                Dorsal
              </span>
            </div>
          </div>
          {onOpenCosmeticWorkshop && (
            <button
              type="button"
              onClick={() => onOpenCosmeticWorkshop('familiar')}
              className="min-h-[40px] px-3.5 py-1.5 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start lg:self-center"
            >
              <PixelUiIcon name="paw" className="w-3.5 h-3.5" />
              <span>Atelier &amp; Familiers</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. COMPACT LIVE CLUE HUNT HUD STRIP ON THE MAP
// ============================================================================

export const ActiveHuntMapBanner: React.FC<{
  hunt: ClueTreasureHunt;
  activeStepIdx: number;
  playerLat: number;
  playerLng: number;
  onOpenHuntTab: () => void;
  onClaimStepHere: () => void;
  onCloseTracker: () => void;
}> = ({
  hunt,
  activeStepIdx,
  playerLat,
  playerLng,
  onOpenHuntTab,
  onClaimStepHere,
  onCloseTracker,
}) => {
  const step = hunt.steps[Math.min(activeStepIdx, hunt.steps.length - 1)];
  const reading = computeHotColdReading(
    playerLat,
    playerLng,
    step.lat,
    step.lng,
    step.reachRadiusMeters
  );

  return (
    <div className="grimoire-folio-gold px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
      <button
        type="button"
        onClick={onOpenHuntTab}
        className="min-h-[36px] flex items-center gap-2 min-w-0 flex-1 text-left"
      >
        <PixelUiIcon name="chest" className="w-4 h-4 text-rose-900 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 font-bold text-[#24160c]">
            <span>
              Piste {activeStepIdx + 1}/{hunt.steps.length}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-rose-900">Cap {reading.compassFr}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{reading.labelFr}</span>
            <span className="text-[#54361d] font-normal hidden sm:inline">
              ({reading.approxBandFr})
            </span>
          </div>
          <div className="text-[11px] text-[#4a321d] truncate">{step.poeticClue}</div>
        </div>
      </button>

      <div className="flex items-center gap-1.5 shrink-0">
        {reading.level === 'sur_place' && (
          <button
            type="button"
            onClick={onClaimStepHere}
            className="min-h-[36px] px-2.5 py-1 bg-emerald-700 text-[#fffbeb] border border-[#2b1a0e] font-bold whitespace-nowrap"
          >
            Desceller !
          </button>
        )}
        <button
          type="button"
          onClick={onCloseTracker}
          aria-label="Masquer le bandeau de piste"
          className="w-9 h-9 flex items-center justify-center bg-[#28160d] text-amber-300 border border-[#d97706]"
        >
          <PixelUiIcon name="close" className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 5. CONTEXTUAL FIELD RIDDLE MODAL (« L'ÉPREUVE DU SCEAU D'OR »)
// ============================================================================

export const ContextualRiddleModal: React.FC<{
  riddle: ContextualRiddle;
  alreadySolved: boolean;
  solvedRiddlesTotal?: number;
  muted: boolean;
  onSolve: (riddle: ContextualRiddle, firstTry: boolean) => void;
  onOpenCosmeticWorkshop?: (slot?: 'familiar' | 'headgear' | 'tool' | 'pack') => void;
  onClose: () => void;
}> = ({
  riddle,
  alreadySolved,
  solvedRiddlesTotal = 0,
  muted,
  onSolve,
  onOpenCosmeticWorkshop,
  onClose,
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(
    alreadySolved ? riddle.correctIndex : null
  );
  const [hadWrongAttempt, setHadWrongAttempt] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [solvedNow, setSolvedNow] = useState(alreadySolved);

  const handlePickOption = (idx: number) => {
    if (solvedNow) return;
    setSelectedIdx(idx);
    if (idx === riddle.correctIndex) {
      playStampSfx(muted);
      setSolvedNow(true);
      onSolve(riddle, !hadWrongAttempt);
    } else {
      setHadWrongAttempt(true);
    }
  };

  const catMeta = CATEGORY_META[riddle.category];
  const earnedXp = hadWrongAttempt ? Math.max(15, Math.round(riddle.xpBonus * 0.6)) : riddle.xpBonus;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[80] bg-[#140b05]/75 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.16 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-lg max-h-[88dvh] grimoire-folio-gold flex flex-col overflow-hidden pb-safe"
      >
        <PixelCornerRivets className="bg-[#d97706]" />
        <div className="pixel-frieze w-full shrink-0" aria-hidden="true" />

        {/* Header */}
        <div className="px-4 py-3 bg-[#ecd8b1] border-b-2 border-[#2b1a0e] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-900">
              <PixelGuildIcon category={riddle.category} className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                Énigme Contextuelle · {riddle.themeLabel}
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-bold font-display text-[#24160c] truncate">
              {riddle.poiName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l’énigme"
            className="w-10 h-10 flex items-center justify-center bg-[#28160d] text-amber-300 hover:bg-[#991b1b] hover:text-[#fffbeb] border-2 border-[#d97706] shrink-0"
          >
            <PixelUiIcon name="close" className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          <p className="text-sm sm:text-base font-bold text-[#24160c] leading-relaxed break-words">
            {riddle.question}
          </p>

          {showHint ? (
            <div className="p-3 bg-[#ecd8b1] border border-[#8c653b] text-xs text-[#3b2312] leading-relaxed break-words">
              <strong>Indice d’observation :</strong> {riddle.fieldObservationHint}
            </div>
          ) : (
            !solvedNow && (
              <button
                type="button"
                onClick={() => {
                  playJournalOpenSfx(muted);
                  setShowHint(true);
                }}
                className="text-xs font-bold text-rose-900 hover:text-rose-700 underline underline-offset-4"
              >
                Besoin d’un indice d’observation sur place ?
              </button>
            )
          )}

          <div className="space-y-2.5">
            {riddle.options.map((opt, idx) => {
              const isSelected = selectedIdx === idx;
              const isRight = idx === riddle.correctIndex;
              let btnStyle =
                'bg-[#f8edd6] hover:bg-amber-200 text-[#24160c] border-[#6b4928] hover:border-[#2b1a0e]';
              let prefix = `${String.fromCharCode(65 + idx)}.`;

              if (solvedNow && isRight) {
                btnStyle = 'bg-[#ecfdf5] text-emerald-950 border-emerald-800 font-bold';
                prefix = '✓';
              } else if (!solvedNow && isSelected && !isRight) {
                btnStyle = 'bg-rose-100 text-rose-950 border-rose-800';
                prefix = '✗';
              }

              return (
                <button
                  key={`${riddle.riddleId}_opt_${idx}`}
                  type="button"
                  disabled={solvedNow}
                  onClick={() => handlePickOption(idx)}
                  className={`w-full min-h-[48px] text-left px-3.5 py-2.5 text-xs sm:text-sm border-2 transition-colors flex items-start gap-2.5 ${btnStyle}`}
                >
                  <span className="font-mono font-bold shrink-0 mt-0.5">{prefix}</span>
                  <span className="break-words leading-snug">{opt}</span>
                </button>
              );
            })}
          </div>

          {!solvedNow && selectedIdx !== null && selectedIdx !== riddle.correctIndex && (
            <p className="text-xs font-bold text-rose-900">
              Ce n’est pas tout à fait cela — observez l’indice et tentez une autre hypothèse !
            </p>
          )}

          {solvedNow && (
            <div className="p-3.5 bg-[#ecfdf5] border-2 border-emerald-800 space-y-2 text-xs text-emerald-950">
              <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                <span className="inline-flex items-center gap-1.5 text-sm font-display">
                  <PixelUiIcon name="stamp" className="w-4 h-4" />
                  <span>Sceau d’Or d’Érudit apposé !</span>
                </span>
                {!alreadySolved && (
                  <span className="font-mono text-emerald-800">
                    +{earnedXp} XP {catMeta.shortLabel}
                  </span>
                )}
              </div>
              <p className="leading-relaxed break-words">{riddle.explanation}</p>
            </div>
          )}

          {/* Scholar Familiar & Cosmetic Rewards Progress */}
          <div className="p-3 bg-[#ecd8b1] border border-[#8c653b] text-[11px] text-[#3b2312] space-y-1">
            <div className="font-bold text-[#24160c] flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5">
                <PixelUiIcon name="paw" className="w-3.5 h-3.5 text-rose-900 shrink-0" />
                <span>Trésors du Sceau d’Or</span>
              </span>
              <span className="font-mono text-rose-900">
                {solvedRiddlesTotal} énigme{solvedRiddlesTotal > 1 ? 's' : ''} résolue
                {solvedRiddlesTotal > 1 ? 's' : ''}
              </span>
            </div>
            <p className="break-words leading-snug">
              1 énigme : <strong>Athéna la Chouette</strong> · 2 :{' '}
              <strong>Loupe d’Or Cisélé</strong> · 3 :{' '}
              <strong>Salamandre des Géodes &amp; Monocle</strong> · 4 :{' '}
              <strong>Sphère Armillaire</strong>
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
            {solvedNow && onOpenCosmeticWorkshop && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCosmeticWorkshop('familiar');
                }}
                className="min-h-[44px] px-4 py-2 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-1.5"
              >
                <PixelUiIcon name="paw" className="w-3.5 h-3.5" />
                <span>Atelier &amp; Familiers</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-5 py-2 text-xs font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow"
            >
              {solvedNow ? 'Continuer l’exploration' : 'Refermer'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
