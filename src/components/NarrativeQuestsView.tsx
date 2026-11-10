import React, { useMemo } from 'react';
import {
  getSealedActsCount,
  NarrativeProgressState,
  NarrativeQuest,
  NarrativeQuestStage,
} from '../narrativeQuests';
import { playJournalOpenSfx, playMissionFanfare } from '../sound';
import { TrophyBadgeCanvas } from '../trophies';
import {
  CATEGORY_META,
  ExplorerAppearance,
  ExplorerProgress,
  haversineMeters,
  UnlockedEntry,
} from '../types';
import { ExplorerSpriteCanvas } from './ExplorerAvatarCanvas';
import { PixelCornerRivets, PixelGuildIcon, PixelUiIcon } from './PixelIcons';

interface NarrativeQuestsViewProps {
  quests: NarrativeQuest[];
  narrativeState: NarrativeProgressState;
  entries: UnlockedEntry[];
  explorerPos: { lat: number; lng: number };
  isSubterraneanView: boolean;
  progress: ExplorerProgress;
  appearance: ExplorerAppearance;
  muted: boolean;
  onSelectActiveQuest: (questId: string | null, focusStage?: NarrativeQuestStage) => void;
  onSealStage: (quest: NarrativeQuest, stage: NarrativeQuestStage) => void;
  onOpenJournalEntry: (poiId: string) => void;
  onOpenWorkshopCosmetics: () => void;
  onOpenTrophyHall: () => void;
}

function formatDistanceMetersFr(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2).replace('.', ',')} km`;
}

export const NarrativeQuestsView: React.FC<NarrativeQuestsViewProps> = ({
  quests,
  narrativeState,
  entries,
  explorerPos,
  progress,
  appearance,
  muted,
  onSelectActiveQuest,
  onSealStage,
  onOpenJournalEntry,
  onOpenWorkshopCosmetics,
  onOpenTrophyHall,
}) => {
  const unlockedPoiSet = useMemo(() => new Set(entries.map((e) => e.poiId)), [entries]);

  const selectedQuest = useMemo(() => {
    if (quests.length === 0) return null;
    if (narrativeState.activeQuestId) {
      const found = quests.find((q) => q.id === narrativeState.activeQuestId);
      if (found) return found;
    }
    return quests[0];
  }, [quests, narrativeState.activeQuestId]);

  const completedCount = progress.completedNarrativesCount || 0;

  // Preview explorer sprite wearing the Narrative Chronicler rewards
  const narrativeRewardPreviewAppearance: ExplorerAppearance = useMemo(
    () => ({
      ...appearance,
      headgearId: 'couronne_chroniqueur',
      outfitId: 'conteuse_legende',
      toolId: 'plume_trois_actes',
      familiarId: 'cerf_brumes',
    }),
    [appearance]
  );

  if (quests.length === 0 || !selectedQuest) {
    return (
      <div className="parchment-panel p-6 relative text-center space-y-2">
        <PixelCornerRivets />
        <h2 className="text-lg font-bold font-display text-[#24160c]">
          Quêtes Narratives en préparation
        </h2>
        <p className="text-xs sm:text-sm text-[#4a321d] max-w-lg mx-auto">
          Déplacez la carte ou chargez un secteur comportant au moins trois points d’intérêt pour
          tisser une trilogie narrative complète (Début, Milieu et Dénouement).
        </p>
      </div>
    );
  }

  const actsSealed = getSealedActsCount(narrativeState, selectedQuest.id);
  const isQuestCompleted = actsSealed >= 3;
  const isTrackedOnMap = narrativeState.activeQuestId === selectedQuest.id;

  return (
    <div className="space-y-6">
      {/* ====================================================================
          1. NARRATIVE QUESTS HEADER & REWARDS SHOWCASE (TROPHIES, COSMETICS, FAMILIAR)
          ==================================================================== */}
      <div className="parchment-panel p-4 sm:p-5 relative space-y-4">
        <PixelCornerRivets />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="text-xs text-[#6b4928] font-semibold">
              Trilogies de terrain · Découverte dans un ordre séquentiel strict (Acte I → Acte II → Acte III)
            </div>
            <h2 className="text-lg sm:text-2xl font-bold font-display text-[#24160c]">
              Quêtes Narratives &amp; Chroniques Liées
            </h2>
            <p className="text-xs sm:text-sm text-[#4a321d] leading-relaxed max-w-3xl">
              Chaque récit relie trois lieux réels de votre secteur. Ralliez-les dans l’ordre exact
              pour dévoiler indices et chapitres d’histoire jusqu’au dénouement final.
            </p>
          </div>

          {/* 16-bit Reward Showcase Card */}
          <div className="p-3 bg-[#24140b] text-amber-200 border-2 border-[#d97706] flex items-center gap-3 shrink-0">
            <ExplorerSpriteCanvas
              appearance={narrativeRewardPreviewAppearance}
              facingDir="down"
              isWalking
              animated
              pixelScale={1.75}
              className="w-[58px] h-[54px] shrink-0"
            />
            <div className="space-y-1 text-xs min-w-0">
              <div className="font-bold font-display text-[#fef08a]">
                Trésors des Récits ({completedCount} scellé{completedCount > 1 ? 's' : ''})
              </div>
              <div className="text-[11px] text-amber-200/90 leading-snug">
                1 récit : Trophée, Laurier d’Or, Calame &amp; Cerf Blanc
                <br />2 récits : Manteau Enluminé · 3 récits : Maître des Chroniques
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-0.5">
                <button
                  type="button"
                  onClick={onOpenWorkshopCosmetics}
                  className="text-[11px] font-bold text-amber-300 hover:text-white underline underline-offset-4"
                >
                  Ouvrir l’Atelier
                </button>
                <button
                  type="button"
                  onClick={onOpenTrophyHall}
                  className="text-[11px] font-bold text-amber-300 hover:text-white underline underline-offset-4 inline-flex items-center gap-1"
                >
                  <TrophyBadgeCanvas
                    trophyId="tisserand_recits"
                    unlocked={completedCount >= 1}
                    pixelScale={1}
                  />
                  <span>Salle des Trophées</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quest Selector Tabs */}
        <div
          role="tablist"
          aria-label="Sélection de la quête narrative du secteur"
          className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1"
        >
          {quests.map((q, idx) => {
            const qSealed = getSealedActsCount(narrativeState, q.id);
            const active = q.id === selectedQuest.id;
            return (
              <button
                key={q.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => {
                  playJournalOpenSfx(muted);
                  onSelectActiveQuest(q.id);
                }}
                className={`min-h-[54px] px-3.5 py-2.5 text-left border-2 transition-colors flex flex-col justify-between gap-1 ${
                  active
                    ? 'bg-[#28160d] text-amber-200 border-[#d97706] jrpg-shadow'
                    : 'bg-[#f8edd6] hover:bg-[#fffbeb] text-[#24160c] border-[#6b4928]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                  <span className={active ? 'text-amber-300 font-bold' : 'text-[#6b4928] font-semibold'}>
                    0{idx + 1}. {CATEGORY_META[q.focusCategory].shortLabel}
                  </span>
                  <span>
                    {qSealed >= 3 ? 'Histoire achevée ✓' : `Acte ${qSealed}/3`}
                  </span>
                </div>
                <div className="text-xs sm:text-sm font-bold font-display truncate">
                  {q.title}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ====================================================================
          2. SELECTED QUEST STORY FOLIO (PROLOGUE -> ACTE I -> ACTE II -> ACTE III -> EPILOGUE)
          ==================================================================== */}
      <div className="parchment-panel p-4 sm:p-5 relative space-y-5">
        <PixelCornerRivets />

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-[#8c653b]/40">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#6b4928]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#24160c]">
                <PixelGuildIcon category={selectedQuest.focusCategory} className="w-4 h-4" />
                <span>{selectedQuest.subtitle}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Parcours estimé : {formatDistanceMetersFr(selectedQuest.totalRouteMeters)}
              </span>
            </div>

            <h3 className="text-lg sm:text-2xl font-bold font-display text-[#24160c]">
              {selectedQuest.title}
            </h3>
            <p className="text-xs sm:text-sm text-[#3b2312] leading-relaxed">
              {selectedQuest.prologueFr}
            </p>

            {/* Epistemic disclaimer: distinguish exploratory walking sequences from attested historical lineage */}
            <div className="flex items-start gap-2 p-2.5 bg-[#f8edd6] border border-[#a27a4a]/40 text-[#4a321d] text-xs">
              <span className="font-bold text-[#854d0e] font-mono text-[11px] shrink-0 uppercase tracking-wider">
                Arpentage libre
              </span>
              <span className="text-[11px] leading-snug">
                {selectedQuest.epistemicDisclaimerFr}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {actsSealed !== 3 && (
              <button
                type="button"
                onClick={() => {
                  const currentStage = selectedQuest.stages[actsSealed];
                  if (isTrackedOnMap) {
                    onSelectActiveQuest(null);
                  } else {
                    onSelectActiveQuest(selectedQuest.id, currentStage);
                  }
                }}
                className={`min-h-[44px] px-4 py-2 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-2 ${
                  isTrackedOnMap
                    ? 'bg-[#28160d] text-amber-300'
                    : 'bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb]'
                }`}
              >
                <PixelUiIcon name="map" className="w-4 h-4" />
                <span>
                  {isTrackedOnMap ? 'Suivi actif sur la carte ✓' : 'Suivre ce récit sur la carte'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Sequential 3-Act Chapters */}
        <div className="space-y-4">
          {selectedQuest.stages.map((stage, stageIdx) => {
            const isStageSealed = actsSealed > stageIdx;
            const isCurrentStage = actsSealed === stageIdx && !isQuestCompleted;
            const isFutureLocked = actsSealed < stageIdx;

            const distMeters = haversineMeters(
              explorerPos.lat,
              explorerPos.lng,
              stage.lat,
              stage.lng
            );
            const alreadyDiscoveredInCarnet = unlockedPoiSet.has(stage.poiId);
            const withinPhysicalReach = distMeters <= stage.reachRadiusMeters;
            const canSealRightNow =
              isCurrentStage && (withinPhysicalReach || alreadyDiscoveredInCarnet);

            return (
              <div
                key={`${selectedQuest.id}_act_${stage.actNumber}`}
                className={`p-4 border-2 transition-colors space-y-3 ${
                  isStageSealed
                    ? 'bg-[#f8edd6] border-emerald-800/70'
                    : isCurrentStage
                    ? 'bg-[#fffbeb] border-[#991b1b] jrpg-shadow'
                    : 'bg-[#e3cfa6]/65 border-[#8c653b]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-[#991b1b]">
                      {stage.phaseLabelFr}
                    </span>
                    <span aria-hidden="true" className="text-[#6b4928]">·</span>
                    <span className="text-[#54361d] font-semibold">
                      {CATEGORY_META[stage.category].shortLabel}
                    </span>
                    {stage.isSubterranean && (
                      <>
                        <span aria-hidden="true" className="text-[#6b4928]">·</span>
                        <span className="text-indigo-900 font-semibold">Strate souterraine</span>
                      </>
                    )}
                  </div>

                  <div className="text-xs font-mono tabular-nums">
                    {isStageSealed ? (
                      <span className="font-bold text-emerald-900">
                        Chapitre scellé · +{stage.xpStageReward} XP ✓
                      </span>
                    ) : isCurrentStage ? (
                      <span className="font-bold text-[#24160c]">
                        Distance : {formatDistanceMetersFr(distMeters)} · +{stage.xpStageReward} XP
                      </span>
                    ) : (
                      <span className="text-[#6b4928]">
                        En attente de l’Acte {stageIdx}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stage Content Depending on Strict Sequential State */}
                {isStageSealed ? (
                  <div className="space-y-2">
                    <h4 className="text-sm sm:text-base font-bold font-display text-[#24160c]">
                      {stage.loreChapterTitleFr}
                    </h4>
                    <p className="text-xs sm:text-sm text-[#3b2312] leading-relaxed">
                      {stage.loreParagraphFr}
                    </p>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenJournalEntry(stage.poiId)}
                        className="text-xs font-bold text-rose-900 hover:text-rose-700 underline underline-offset-4 inline-flex items-center gap-1.5"
                      >
                        <PixelUiIcon name="book" className="w-3.5 h-3.5" />
                        <span>Consulter « {stage.poiName} » dans le Carnet</span>
                      </button>
                    </div>
                  </div>
                ) : isCurrentStage ? (
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm sm:text-base font-bold font-display text-[#24160c]">
                        {stage.clueTitleFr} — « {alreadyDiscoveredInCarnet ? stage.poiName : stage.mysteryTitle} »
                      </h4>
                      <p className="text-xs sm:text-sm text-[#3b2312] leading-relaxed mt-1">
                        {stage.clueFr}
                      </p>
                    </div>

                    {alreadyDiscoveredInCarnet && !withinPhysicalReach && (
                      <p className="text-xs text-emerald-900 font-semibold">
                        Vous avez déjà consigné « {stage.poiName} » lors d’une reconnaissance antérieure : vous pouvez sceller cet acte dès maintenant dans l’ordre du récit.
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => onSelectActiveQuest(selectedQuest.id, stage)}
                        className="min-h-[42px] px-4 py-2 text-xs font-bold bg-[#28160d] hover:bg-[#3b2214] text-amber-200 border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-2"
                      >
                        <PixelUiIcon name="pocket-compass" className="w-4 h-4 text-amber-300" />
                        <span>Localiser l’étape sur la carte</span>
                      </button>

                      {canSealRightNow ? (
                        <button
                          type="button"
                          onClick={() => {
                            playMissionFanfare(muted);
                            onSealStage(selectedQuest, stage);
                          }}
                          className="min-h-[42px] px-4 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-2"
                        >
                          <PixelUiIcon name="stamp" className="w-4 h-4" />
                          <span>
                            {stage.actNumber === 3
                              ? 'Sceller le Dénouement Final !'
                              : `Sceller l’Acte ${stage.actNumber} et lire la suite`}
                          </span>
                        </button>
                      ) : (
                        <span className="text-xs text-[#6b4928] font-mono tabular-nums">
                          Approchez à moins de {stage.reachRadiusMeters} m de ce jalon pour révéler ce chapitre.
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold font-display text-[#54361d]">
                      Chapitre scellé par la cire — Ordre séquentiel requis
                    </h4>
                    <p className="text-xs text-[#6b4928]">
                      Accomplissez d’abord l’Acte {actsSealed + 1} pour décacheter l’indice menant à cette étape ({isFutureLocked ? `Étape ${stage.actNumber}/3` : ''}).
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Epilogue & Finale Celebration Box when all 3 Acts are sealed */}
        {isQuestCompleted && (
          <div className="p-4 sm:p-5 bg-[#24140b] text-amber-100 border-2 border-[#d97706] jrpg-shadow space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-mono font-bold text-[#fef08a]">
                Trilogie Narrative Accomplie · +{selectedQuest.rewardPreview.xpFinaleBonus} XP au total
              </div>
              <div className="text-xs text-amber-300">
                {selectedQuest.rewardPreview.trophyLabelFr}
              </div>
            </div>
            <h4 className="text-base sm:text-lg font-bold font-display text-[#fef08a]">
              Épilogue — « {selectedQuest.title} »
            </h4>
            <p className="text-xs sm:text-sm text-amber-100/95 leading-relaxed">
              {selectedQuest.epilogueFr}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onOpenWorkshopCosmetics}
                className="min-h-[42px] px-4 py-2 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] inline-flex items-center gap-2"
              >
                <PixelUiIcon name="hat" className="w-4 h-4" />
                <span>Équiper vos récompenses narratives</span>
              </button>
              <button
                type="button"
                onClick={onOpenTrophyHall}
                className="min-h-[42px] px-4 py-2 text-xs font-bold bg-[#3b2214] hover:bg-[#4e2e1b] text-amber-200 border border-[#d97706] inline-flex items-center gap-2"
              >
                <PixelUiIcon name="trophy" className="w-4 h-4" />
                <span>Voir vos Trophées</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ActiveNarrativeMapBanner: React.FC<{
  quest: NarrativeQuest;
  actsSealed: 0 | 1 | 2 | 3;
  explorerPos: { lat: number; lng: number };
  alreadyDiscoveredInCarnet: boolean;
  onSealCurrentAct: () => void;
  onCenterStageOnMap: (stage: NarrativeQuestStage) => void;
  onOpenNarrativesTab: () => void;
  onStopTracking: () => void;
}> = ({
  quest,
  actsSealed,
  explorerPos,
  alreadyDiscoveredInCarnet,
  onSealCurrentAct,
  onCenterStageOnMap,
  onOpenNarrativesTab,
  onStopTracking,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  if (actsSealed === 3) return null;
  const stage = quest.stages[actsSealed];
  const distMeters = Math.round(
    haversineMeters(explorerPos.lat, explorerPos.lng, stage.lat, stage.lng)
  );
  const canSeal = distMeters <= stage.reachRadiusMeters || alreadyDiscoveredInCarnet;

  if (isCollapsed) {
    return (
      <div className="p-2 bg-[#24140b]/95 text-amber-200 border-2 border-[#d97706] jrpg-shadow flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0 truncate text-[11px]">
          <span className="font-bold text-amber-300 shrink-0">{stage.phaseLabelFr}</span>
          <span className="text-amber-400/60" aria-hidden="true">·</span>
          <span className="truncate text-amber-100">{quest.title}</span>
          <span className="text-amber-400/60" aria-hidden="true">·</span>
          <span className="font-mono tabular-nums shrink-0 text-amber-300">
            {distMeters < 1000 ? `${distMeters} m` : `${(distMeters / 1000).toFixed(1)} km`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {canSeal && (
            <button
              type="button"
              onClick={onSealCurrentAct}
              className="px-2 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white border border-amber-200"
            >
              Sceller
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="px-2 py-1 text-[11px] font-bold bg-[#3b2214] hover:bg-[#4d2d1b] text-amber-200 border border-[#d97706]"
          >
            Déplier
          </button>
          <button
            type="button"
            onClick={onStopTracking}
            aria-label="Arrêter le suivi du récit sur la carte"
            className="px-1.5 py-1 text-xs font-bold text-amber-300 hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2.5 sm:p-3 bg-[#24140b]/95 text-amber-100 border-2 border-[#d97706] jrpg-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono tabular-nums text-amber-300">
          <span className="font-bold">{stage.phaseLabelFr}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate font-sans text-amber-100">{quest.title}</span>
          <span aria-hidden="true">·</span>
          <span>{distMeters < 1000 ? `${distMeters} m` : `${(distMeters / 1000).toFixed(1)} km`}</span>
        </div>
        <p className="text-xs text-amber-50 line-clamp-2 leading-snug">
          {stage.clueFr}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        {canSeal && (
          <button
            type="button"
            onClick={onSealCurrentAct}
            className="min-h-[38px] px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white border border-amber-200 inline-flex items-center gap-1.5"
          >
            <PixelUiIcon name="stamp" className="w-3.5 h-3.5" />
            <span>Sceller l’Acte {stage.actNumber}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => onCenterStageOnMap(stage)}
          className="min-h-[38px] px-2.5 py-1.5 text-xs font-bold bg-[#3b2214] hover:bg-[#4d2d1b] text-amber-200 border border-[#d97706]"
        >
          Viser
        </button>
        <button
          type="button"
          onClick={onOpenNarrativesTab}
          className="min-h-[38px] px-2.5 py-1.5 text-xs font-bold bg-[#3b2214] hover:bg-[#4d2d1b] text-amber-200 border border-[#d97706]"
        >
          Récit
        </button>
        <button
          type="button"
          onClick={() => setIsCollapsed(true)}
          className="min-h-[38px] px-2.5 py-1.5 text-xs font-bold bg-[#3b2214] hover:bg-[#4d2d1b] text-amber-200 border border-[#d97706]"
          title="Réduire le bandeau pour dégager la carte"
        >
          Réduire
        </button>
        <button
          type="button"
          onClick={onStopTracking}
          aria-label="Arrêter le suivi du récit sur la carte"
          className="min-h-[38px] px-2 py-1.5 text-xs font-bold text-amber-300 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
