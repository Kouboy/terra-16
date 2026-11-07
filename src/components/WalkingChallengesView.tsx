import React, { useMemo, useState } from 'react';
import { PixelUiIcon } from './PixelIcons';
import {
  formatDistanceKm,
  getDistanceForPeriod,
  isWalkingChallengeCompleted,
  WALKING_CHALLENGES_CATALOG,
  WalkingChallengeDef,
  WalkingChallengePeriod,
  WalkingChallengesState,
} from '../walkingChallenges';
import { ExplorerAppearance, ExplorerProgress } from '../types';

interface WalkingChallengesViewProps {
  walkingState: WalkingChallengesState;
  progress: ExplorerProgress;
  onClaimReward: (challengeId: string) => void;
  onEquipCosmetic?: (slot: keyof ExplorerAppearance, itemId: string) => void;
  onSimulateWalkStep?: (addedMeters: number) => void;
  isSimulatedLocation?: boolean;
}

type PeriodFilter = 'all' | WalkingChallengePeriod;

const PERIOD_TABS: Array<{ id: PeriodFilter; label: string }> = [
  { id: 'all', label: 'Tous les Défis' },
  { id: 'daily', label: 'Quotidiens' },
  { id: 'weekly', label: 'Hebdos' },
  { id: 'monthly', label: 'Mensuels' },
  { id: 'annual', label: 'Annuels' },
  { id: 'event', label: 'Événements' },
];

export const WalkingChallengesView: React.FC<WalkingChallengesViewProps> = ({
  walkingState,
  progress,
  onClaimReward,
  onEquipCosmetic,
  onSimulateWalkStep,
  isSimulatedLocation,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('all');

  const filteredChallenges = useMemo(() => {
    if (selectedPeriod === 'all') {
      return WALKING_CHALLENGES_CATALOG;
    }
    return WALKING_CHALLENGES_CATALOG.filter((c) => c.period === selectedPeriod);
  }, [selectedPeriod]);

  // Overall statistics summary
  const totalCompleted = useMemo(() => {
    return WALKING_CHALLENGES_CATALOG.filter((c) =>
      isWalkingChallengeCompleted(c, walkingState.metrics)
    ).length;
  }, [walkingState.metrics]);

  const totalClaimed = useMemo(() => {
    return walkingState.claimedChallengeIds.length;
  }, [walkingState.claimedChallengeIds]);

  return (
    <div className="space-y-4 text-amber-950 font-serif">
      {/* 16-Bit Header Cartouche */}
      <div className="relative p-4 bg-gradient-to-br from-amber-50 to-amber-100/90 border-2 border-amber-900/60 shadow-[inset_0_0_8px_rgba(120,53,15,0.15)]">
        {/* Pixel Corner Rivets */}
        <span className="absolute top-1 left-1 w-1.5 h-1.5 bg-amber-900/70" />
        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-900/70" />
        <span className="absolute bottom-1 left-1 w-1.5 h-1.5 bg-amber-900/70" />
        <span className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-amber-900/70" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 bg-amber-900 text-amber-100 border border-amber-950 shadow-sm">
                <PixelUiIcon name="boot" className="w-4 h-4 text-amber-300" />
              </span>
              <h2 className="text-base sm:text-lg font-bold tracking-wide uppercase text-amber-950">
                Défis de Marche de l’Arpenteur
              </h2>
            </div>
            <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
              Arpentez le monde réel pour débloquer des parures, coiffes, reliques et compagnons exclusifs.
            </p>
          </div>

          {/* Aggregate Odometer Stats Cartouche */}
          <div className="flex items-center gap-2 bg-amber-900/10 border border-amber-900/30 px-3 py-2 text-xs">
            <div className="text-center px-2 border-r border-amber-900/20">
              <div className="text-[10px] uppercase font-bold text-amber-800">Total Marche</div>
              <div className="text-sm font-extrabold text-amber-950">
                {formatDistanceKm(progress.walkedMeters || walkingState.metrics.totalLifetimeMeters || 0)}
              </div>
            </div>
            <div className="text-center px-2">
              <div className="text-[10px] uppercase font-bold text-amber-800">Objectifs</div>
              <div className="text-sm font-extrabold text-amber-900">
                {totalClaimed} / {WALKING_CHALLENGES_CATALOG.length}
              </div>
            </div>
          </div>
        </div>

        {/* Live Period Odometer Breakdown (Unboxed, dot-separated metadata) */}
        <div className="mt-3 pt-2 border-t border-amber-900/20 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-amber-900/80">
          <span>
            Aujourd’hui : <strong className="text-amber-950">{formatDistanceKm(walkingState.metrics.dailyMeters)}</strong>
          </span>
          <span className="text-amber-700/60 font-bold">·</span>
          <span>
            Cette semaine : <strong className="text-amber-950">{formatDistanceKm(walkingState.metrics.weeklyMeters)}</strong>
          </span>
          <span className="text-amber-700/60 font-bold">·</span>
          <span>
            Ce mois : <strong className="text-amber-950">{formatDistanceKm(walkingState.metrics.monthlyMeters)}</strong>
          </span>
          <span className="text-amber-700/60 font-bold">·</span>
          <span>
            Cette année : <strong className="text-amber-950">{formatDistanceKm(walkingState.metrics.annualMeters)}</strong>
          </span>

          {/* Quick test stepper in simulation mode to test distance & claim flows */}
          {isSimulatedLocation && onSimulateWalkStep && (
            <div className="ml-auto flex items-center gap-1.5 pt-1 sm:pt-0">
              <button
                type="button"
                onClick={() => onSimulateWalkStep(500)}
                className="px-2 py-1 text-[11px] font-sans font-semibold bg-amber-200/90 hover:bg-amber-300 text-amber-950 border border-amber-900/40 active:translate-y-px transition-colors min-h-[32px]"
                title="Ajouter 500 mètres de marche pour tester la jauge"
              >
                +500 m test
              </button>
              <button
                type="button"
                onClick={() => onSimulateWalkStep(2500)}
                className="px-2 py-1 text-[11px] font-sans font-semibold bg-amber-300 hover:bg-amber-400 text-amber-950 border border-amber-900/50 active:translate-y-px transition-colors min-h-[32px]"
                title="Ajouter 2,5 km pour tester le franchissement de palier"
              >
                +2,5 km test
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Segmented Period Selector (Interactive buttons, 44px safe touch height) */}
      <div className="flex flex-wrap gap-1 p-1 bg-amber-900/10 border border-amber-900/30">
        {PERIOD_TABS.map((tab) => {
          const isSelected = selectedPeriod === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedPeriod(tab.id)}
              className={`flex-1 min-w-[90px] min-h-[44px] px-3 py-2 text-xs font-bold tracking-wide transition-colors ${
                isSelected
                  ? 'bg-amber-900 text-amber-100 shadow-sm border border-amber-950'
                  : 'bg-amber-100/70 hover:bg-amber-200/80 text-amber-900 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Challenge Cards Grid */}
      <div className="space-y-3">
        {filteredChallenges.map((ch) => {
          const currentMeters = getDistanceForPeriod(walkingState.metrics, ch.period);
          const isCompleted = currentMeters >= ch.targetMeters;
          const isClaimed = walkingState.claimedChallengeIds.includes(ch.id);
          const percent = Math.min(100, Math.floor((currentMeters / ch.targetMeters) * 100));
          const remainingMeters = Math.max(0, ch.targetMeters - currentMeters);
          const cosmetic = ch.exclusiveCosmetic;
          const isCurrentlyEquipped =
            cosmetic &&
            ((cosmetic.slot === 'headgear' && progress.headgearId === cosmetic.id) ||
              (cosmetic.slot === 'outfit' && progress.outfitId === cosmetic.id) ||
              (cosmetic.slot === 'tool' && progress.toolId === cosmetic.id) ||
              (cosmetic.slot === 'pack' && progress.packId === cosmetic.id) ||
              (cosmetic.slot === 'familiar' && progress.familiarId === cosmetic.id));

          return (
            <div
              key={ch.id}
              className={`relative p-3.5 border transition-all ${
                isClaimed
                  ? 'bg-amber-50/80 border-amber-900/30'
                  : isCompleted
                  ? 'bg-gradient-to-br from-amber-100 via-amber-50 to-amber-200/60 border-amber-800 shadow-md ring-1 ring-amber-600/30'
                  : 'bg-amber-50/90 border-amber-900/40 hover:border-amber-900/60'
              }`}
            >
              {/* Corner Rivet */}
              <span className="absolute top-1 left-1 w-1 h-1 bg-amber-900/50" />
              <span className="absolute top-1 right-1 w-1 h-1 bg-amber-900/50" />

              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                {/* Challenge Info & Metadata */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-amber-800">
                      {ch.periodBadgeLabel}
                    </span>
                    <span className="text-amber-700/60 font-bold">·</span>
                    <h3 className="text-sm font-bold text-amber-950 truncate">
                      {ch.title}
                    </h3>
                    <span className="text-amber-700/60 font-bold">·</span>
                    <span className="text-xs font-semibold text-amber-900">
                      Objectif : {formatDistanceKm(ch.targetMeters)}
                    </span>
                  </div>

                  <p className="text-xs text-amber-900/80 mt-1 leading-snug">
                    {ch.description}
                  </p>

                  {/* 16-Bit Pixel Progress Gauge */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] mb-1 font-mono text-amber-900">
                      <span>
                        {formatDistanceKm(currentMeters)} / {formatDistanceKm(ch.targetMeters)}
                      </span>
                      <span className="font-bold">
                        {isCompleted ? '100 % (Atteint !)' : `${percent} %`}
                      </span>
                    </div>

                    {/* Gauge Track */}
                    <div className="w-full h-3 bg-amber-950/20 border border-amber-900/50 p-0.5 relative overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isCompleted
                            ? 'bg-gradient-to-r from-emerald-600 to-amber-500'
                            : 'bg-gradient-to-r from-amber-700 to-amber-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    {!isCompleted && remainingMeters > 0 && (
                      <div className="text-[11px] text-amber-800/80 mt-0.5">
                        Reste à parcourir : <strong className="text-amber-950">{formatDistanceKm(remainingMeters)}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Exclusive Cosmetic Reward Preview & Actions */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-900/20 shrink-0">
                  {cosmetic ? (
                    <div className="flex items-center gap-2 text-right">
                      <div className="text-left sm:text-right">
                        <div className="text-[10px] uppercase font-bold text-amber-800">
                          Récompense Exclusive
                        </div>
                        <div className="text-xs font-bold text-amber-950 flex items-center gap-1">
                          <PixelUiIcon
                            name={cosmetic.icon}
                            className="w-3.5 h-3.5 text-amber-700"
                          />
                          <span>{cosmetic.name}</span>
                        </div>
                        <div className="text-[10px] text-amber-800/70 truncate max-w-[190px]">
                          +{ch.xpReward} XP · {cosmetic.slot}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs font-bold text-amber-900">
                      +{ch.xpReward} XP d’Exploration
                    </div>
                  )}

                  {/* Action Button: Claim / Equip / In Progress */}
                  <div className="mt-1">
                    {isClaimed ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-emerald-600 inline-block" />
                          Obtenu
                        </span>
                        {cosmetic && onEquipCosmetic && (
                          <button
                            type="button"
                            onClick={() => {
                              const slotKey =
                                cosmetic.slot === 'headgear'
                                  ? 'headgearId'
                                  : cosmetic.slot === 'outfit'
                                  ? 'outfitId'
                                  : cosmetic.slot === 'tool'
                                  ? 'toolId'
                                  : cosmetic.slot === 'pack'
                                  ? 'packId'
                                  : 'familiarId';
                              onEquipCosmetic(slotKey, cosmetic.id);
                            }}
                            disabled={isCurrentlyEquipped}
                            className={`min-h-[44px] px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors border ${
                              isCurrentlyEquipped
                                ? 'bg-amber-900/10 text-amber-900/50 border-amber-900/20 cursor-default'
                                : 'bg-amber-800 hover:bg-amber-900 text-amber-100 border-amber-950 active:translate-y-px shadow-sm'
                            }`}
                          >
                            {isCurrentlyEquipped ? 'Équipé' : 'Équiper'}
                          </button>
                        )}
                      </div>
                    ) : isCompleted ? (
                      <button
                        type="button"
                        onClick={() => onClaimReward(ch.id)}
                        className="min-h-[44px] px-4 py-2 text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 hover:from-amber-800 hover:to-amber-800 text-amber-100 border border-amber-950 shadow-md active:translate-y-px transition-all flex items-center gap-1.5 animate-pulse"
                      >
                        <PixelUiIcon name="trophy" className="w-3.5 h-3.5 text-amber-300" />
                        <span>Réclamer (+{ch.xpReward} XP)</span>
                      </button>
                    ) : (
                      <div className="min-h-[44px] flex items-center justify-center px-3 py-1 text-xs text-amber-800/70 border border-amber-900/20 bg-amber-900/5">
                        En cours de marche
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
