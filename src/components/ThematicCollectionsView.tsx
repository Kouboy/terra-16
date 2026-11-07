import React, { useMemo, useState } from 'react';
import {
  EvaluatedThematicCollection,
  evaluateThematicCollections,
  HeraldicMotif,
  ThematicCollection,
} from '../thematicCollections';
import { CollectedSpecimen, ExplorationCategory, UnlockedEntry } from '../types';
import { PixelCornerRivets, PixelGuildIcon, PixelUiIcon } from './PixelIcons';

export const HeraldicMotifSvg: React.FC<{
  motif: HeraldicMotif;
  color: string;
  size?: number;
}> = ({ motif, color, size = 32 }) => {
  switch (motif) {
    case 'roman_eagle':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2L8 6h8l-4-4z" />
          <path d="M3 10l5-3 4 5 4-5 5 3-3 8-7 4-7-4-3-8z" />
          <path d="M12 12v6" />
          <circle cx="12" cy="7" r="1.5" fill={color} />
        </svg>
      );
    case 'oak_leaf':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 20c-2.5 0-6-1.5-6-6 0-3 2-4 3-6-1-2 0-5 3-6 2 2 3 3 5 3 2 0 4 2 4 5 0 3-2 5-3 7 1 2 0 3-3 3z" />
          <path d="M11 20v2" />
          <path d="M11 12l2-2" />
          <path d="M10 16l3-2" />
        </svg>
      );
    case 'rail_wheel':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2" fill={color} />
          <path d="M12 5v2M12 17v2M5 12h2M17 12h2" />
          <path d="M5 8l-3-2M19 8l3-2M5 16l-3 2M19 16l3 2" />
        </svg>
      );
    case 'millstone':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 4v5M12 15v5M4 12h5M15 12h5" />
          <path d="M6.3 6.3l3.5 3.5M14.2 14.2l3.5 3.5" />
        </svg>
      );
    case 'fountain':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3v8" />
          <path d="M8 7c0-2 4-4 4-4s4 2 4 4" />
          <path d="M5 14h14v2a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-2z" />
          <path d="M9 20v2M15 20v2" />
        </svg>
      );
    case 'megalith':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 8h16l-2-3H6L4 8z" fill={color} fillOpacity="0.2" />
          <path d="M6 8v12M18 8v12" />
          <path d="M11 11v9M13 11v9" />
          <circle cx="12" cy="4" r="1" fill={color} />
        </svg>
      );
    case 'fortress':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 21V9l2-2v2h2V7l2 2v2h4V7l2 2v-2h2v2l2 2v12H4z" />
          <path d="M10 21v-4a2 2 0 0 1 4 0v4" fill={color} fillOpacity="0.3" />
          <circle cx="12" cy="11" r="1.5" fill={color} />
        </svg>
      );
    case 'rose_window':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="6" r="2" />
          <circle cx="12" cy="18" r="2" />
          <circle cx="6" cy="12" r="2" />
          <circle cx="18" cy="12" r="2" />
        </svg>
      );
    case 'cavern_key':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 21h18" />
          <path d="M4 21c1-6 4-13 8-13s7 7 8 13" />
          <circle cx="12" cy="13" r="2" fill={color} />
          <path d="M12 15v3M10 17h4" />
        </svg>
      );
    case 'heron':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 20h16" />
          <path d="M12 12c2-4 4-6 7-6-2 3-1 6-4 8l-2 6" />
          <path d="M8 12c-2 2-3 4-3 6h6" />
          <circle cx="18" cy="7" r="1" fill={color} />
        </svg>
      );
    case 'golden_bough':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 20c8-4 12-10 16-16" />
          <path d="M9 14c1-3 4-4 6-3-1 3-3 4-6 3z" fill={color} fillOpacity="0.3" />
          <path d="M14 9c1-3 4-4 6-3-1 3-3 4-6 3z" fill={color} fillOpacity="0.3" />
          <circle cx="7" cy="17" r="1.5" fill={color} />
        </svg>
      );
    case 'ammonite':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 1 9 9 7 7 0 0 1-7 7 5 5 0 0 1-5-5 3 3 0 0 1 3-3 1 1 0 0 1 1 1" />
        </svg>
      );
    case 'borehole_derrick':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2L6 22h12L12 2z" />
          <path d="M8 15h8M9 9h6" />
          <path d="M12 2v20" />
          <circle cx="12" cy="18" r="1.5" fill={color} />
        </svg>
      );
    case 'hydro_gauge':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 3v18" />
          <path d="M6 6h4M6 10h3M6 14h4M6 18h3" />
          <path d="M13 10c2-2 4-2 6 0s4 2 5 0" />
          <path d="M13 14c2-2 4-2 6 0s4 2 5 0" />
          <path d="M13 18c2-2 4-2 6 0s4 2 5 0" />
        </svg>
      );
    case 'pioneer_factory':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 20h20" />
          <path d="M3 20V9l4 4V9l4 4V4h4v16" />
          <path d="M17 20c1-3 3-5 5-5" />
          <path d="M20 15c0-2 2-3 2-3s-1 3 0 4" />
        </svg>
      );
  }
};

export const HeraldicShieldBadge: React.FC<{
  collection: ThematicCollection;
  isComplete: boolean;
  isClaimed: boolean;
  size?: 'sm' | 'md' | 'lg';
}> = ({ collection, isComplete, isClaimed, size = 'md' }) => {
  const { crest } = collection;

  const wClass = size === 'lg' ? 'w-20 h-24' : size === 'sm' ? 'w-12 h-14' : 'w-16 h-20';
  const iconSize = size === 'lg' ? 40 : size === 'sm' ? 22 : 30;

  return (
    <div className={`relative ${wClass} shrink-0 select-none flex items-center justify-center`}>
      {/* 16-bit Shield silhouette */}
      <svg viewBox="0 0 64 76" className="w-full h-full drop-shadow-md">
        <defs>
          <linearGradient id={`crest-grad-${collection.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={crest.primaryColor} />
            <stop offset="100%" stopColor={crest.secondaryColor} />
          </linearGradient>
        </defs>
        {/* Outer shield rim */}
        <path
          d="M32 4 L58 10 L58 42 C58 58 32 72 32 72 C32 72 6 58 6 42 L6 10 Z"
          fill={isComplete ? crest.bgColor : '#1c1917'}
          stroke={isComplete ? (isClaimed ? '#f59e0b' : crest.shieldBorder) : '#44403c'}
          strokeWidth="3"
        />
        {/* Inner shield inset */}
        <path
          d="M32 9 L53 14 L53 40 C53 53 32 65 32 65 C32 65 11 53 11 40 L11 14 Z"
          fill={isComplete ? `url(#crest-grad-${collection.id})` : '#292524'}
          fillOpacity={isComplete ? 0.35 : 0.6}
          stroke={isComplete ? crest.primaryColor : '#57534e'}
          strokeWidth="1.5"
          strokeDasharray={isComplete ? undefined : '3,2'}
        />
        {/* 16-bit Rivets on shield head */}
        <rect x="14" y="16" width="3" height="3" fill={isComplete ? crest.primaryColor : '#78716c'} />
        <rect x="47" y="16" width="3" height="3" fill={isComplete ? crest.primaryColor : '#78716c'} />
        <rect x="30" y="60" width="4" height="4" fill={isComplete ? '#fde047' : '#78716c'} />
      </svg>

      {/* Center Motif */}
      <div className="absolute inset-0 flex items-center justify-center pb-2">
        <HeraldicMotifSvg
          motif={crest.motif}
          color={isComplete ? crest.primaryColor : '#78716c'}
          size={iconSize}
        />
      </div>

      {/* Claimed Wax Seal or Star */}
      {isClaimed && (
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#991b1b] border-2 border-[#fef08a] flex items-center justify-center text-amber-200 shadow-lg text-[10px] font-bold">
          ✦
        </div>
      )}
    </div>
  );
};

export const ThematicCollectionsView: React.FC<{
  entries: UnlockedEntry[];
  specimens: CollectedSpecimen[];
  claimedCollectionIds: string[];
  onClaimReward: (collection: ThematicCollection) => void;
  onOpenJournalPoi: (poiId: string) => void;
}> = ({
  entries,
  specimens,
  claimedCollectionIds,
  onClaimReward,
  onOpenJournalPoi,
}) => {
  const [filterCategory, setFilterCategory] = useState<ExplorationCategory | 'tous' | 'completes'>(
    'tous'
  );
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null);

  const evaluatedCollections = useMemo(
    () => evaluateThematicCollections(entries, specimens, claimedCollectionIds),
    [entries, specimens, claimedCollectionIds]
  );

  const stats = useMemo(() => {
    let completedCount = 0;
    let claimedCount = 0;
    let totalXpEarnable = 0;
    let totalXpClaimed = 0;

    for (const ec of evaluatedCollections) {
      totalXpEarnable += ec.collection.bonusXp;
      if (ec.isComplete) completedCount++;
      if (ec.isClaimed) {
        claimedCount++;
        totalXpClaimed += ec.collection.bonusXp;
      }
    }

    return {
      total: evaluatedCollections.length,
      completedCount,
      claimedCount,
      totalXpEarnable,
      totalXpClaimed,
    };
  }, [evaluatedCollections]);

  const filteredCollections = useMemo(() => {
    if (filterCategory === 'tous') return evaluatedCollections;
    if (filterCategory === 'completes') {
      return evaluatedCollections.filter((ec) => ec.isComplete);
    }
    return evaluatedCollections.filter((ec) => ec.collection.category === filterCategory);
  }, [evaluatedCollections, filterCategory]);

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12">
      {/* 1. Folio Title & Blasons Honorifiques Header */}
      <div className="relative bg-[#25150e] border-2 border-[#854d0e] p-4 text-[#fef3c7] jrpg-shadow space-y-3">
        <PixelCornerRivets className="bg-[#fbbf24]" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
              <PixelUiIcon name="shield" className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Ensembles & Collections Thématiques</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-amber-100 font-serif tracking-tight">
              L’Armorial des Terroirs & Curiosités
            </h2>
            <p className="text-xs text-[#fde68a] max-w-xl leading-relaxed">
              Associez les découvertes de vos périples par centres d’intérêt patrimoniaux, écologiques
              ou géologiques. Rassemblez chaque ensemble complet pour forger son blason 16-bit,
              revendiquer des pièces cosmétiques et empocher une prime d’expérience.
            </p>
          </div>

          {/* Quick Counter Badge */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center p-2.5 bg-[#170c07] border border-[#a16207] shrink-0">
            <span className="text-[10px] uppercase font-bold text-[#fde047]">
              Blasons Ciselés
            </span>
            <div className="text-base sm:text-xl font-mono font-bold text-amber-200">
              {stats.claimedCount} <span className="text-xs text-[#d97706]">/ {stats.total}</span>
            </div>
            <span className="text-[10px] text-amber-400 font-mono">
              +{stats.totalXpClaimed} XP acquis
            </span>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="space-y-1 pt-1 border-t border-[#78350f]">
          <div className="flex justify-between text-[11px] text-[#fef08a] font-mono">
            <span>Complétion du Médaillier Thématique</span>
            <span>
              {stats.completedCount}/{stats.total} achevés ({Math.round((stats.completedCount / stats.total) * 100)}%)
            </span>
          </div>
          <div className="h-2 w-full bg-[#1c1917] border border-[#78350f] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-300 transition-all duration-300"
              style={{ width: `${(stats.completedCount / stats.total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Filter Strip */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#1e1008] border border-[#522504]">
        <button
          type="button"
          onClick={() => setFilterCategory('tous')}
          className={`px-2.5 py-1 text-xs font-bold transition-colors ${
            filterCategory === 'tous'
              ? 'bg-[#991b1b] text-[#fffbeb] border border-[#fef08a]'
              : 'text-[#fde68a] hover:bg-[#34180a]'
          }`}
        >
          Tous ({evaluatedCollections.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterCategory('completes')}
          className={`px-2.5 py-1 text-xs font-bold transition-colors ${
            filterCategory === 'completes'
              ? 'bg-amber-500 text-stone-950 border border-[#fef08a]'
              : 'text-amber-300 hover:bg-[#34180a]'
          }`}
        >
          Complets ({stats.completedCount})
        </button>
        <button
          type="button"
          onClick={() => setFilterCategory('histoire')}
          className={`px-2.5 py-1 text-xs font-bold transition-colors ${
            filterCategory === 'histoire'
              ? 'bg-amber-600 text-amber-950 border border-amber-300'
              : 'text-[#fde68a] hover:bg-[#34180a]'
          }`}
        >
          Histoire
        </button>
        <button
          type="button"
          onClick={() => setFilterCategory('ecosysteme')}
          className={`px-2.5 py-1 text-xs font-bold transition-colors ${
            filterCategory === 'ecosysteme'
              ? 'bg-emerald-700 text-emerald-100 border border-emerald-300'
              : 'text-emerald-300 hover:bg-[#34180a]'
          }`}
        >
          Écosystème
        </button>
        <button
          type="button"
          onClick={() => setFilterCategory('geographie')}
          className={`px-2.5 py-1 text-xs font-bold transition-colors ${
            filterCategory === 'geographie'
              ? 'bg-sky-700 text-sky-100 border border-sky-300'
              : 'text-sky-300 hover:bg-[#34180a]'
          }`}
        >
          Géographie
        </button>
        <button
          type="button"
          onClick={() => setFilterCategory('legende')}
          className={`px-2.5 py-1 text-xs font-bold transition-colors ${
            filterCategory === 'legende'
              ? 'bg-purple-800 text-purple-100 border border-purple-300'
              : 'text-purple-300 hover:bg-[#34180a]'
          }`}
        >
          Légendes
        </button>
      </div>

      {/* 3. Catalog of Thematic Collections */}
      <div className="space-y-3">
        {filteredCollections.map((evaluated) => {
          const { collection, discoveredEntries, discoveredSpecimens, currentCount, targetCount, isComplete, isClaimed, progressPct } =
            evaluated;
          const isExpanded = expandedCollectionId === collection.id;

          return (
            <div
              key={collection.id}
              className={`relative border-2 jrpg-shadow transition-colors ${
                isClaimed
                  ? 'bg-[#1b1510] border-amber-600 text-[#fef3c7]'
                  : isComplete
                  ? 'bg-[#29170e] border-amber-400 text-[#fffbeb] ring-2 ring-amber-400/40'
                  : 'bg-[#1f130b] border-[#5c381c] text-[#fde68a]'
              }`}
            >
              <PixelCornerRivets
                className={isComplete ? (isClaimed ? 'bg-amber-400' : 'bg-yellow-300') : 'bg-[#78350f]'}
              />

              <div className="p-3.5 sm:p-4 space-y-3">
                {/* Header row: Shield + Title + Action */}
                <div className="flex items-start gap-3.5">
                  <HeraldicShieldBadge
                    collection={collection}
                    isComplete={isComplete}
                    isClaimed={isClaimed}
                    size="md"
                  />

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#3f2214] text-amber-300 border border-[#78350f]">
                        {collection.regionFocus}
                      </span>
                      <span className="text-[10px] font-mono text-amber-400 font-bold">
                        +{collection.bonusXp} XP
                      </span>
                      {isClaimed ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[#713f12] text-amber-200 border border-amber-400">
                          ✦ Blason Ciselé & Récompensé
                        </span>
                      ) : isComplete ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[#991b1b] text-yellow-200 border border-yellow-300 animate-pulse">
                          ★ Ensemble Complet à Réclamer
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-[#d6d3d1]">
                          En cours : {currentCount}/{targetCount}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-amber-100 font-serif leading-snug">
                      {collection.title}
                    </h3>
                    <p className="text-xs text-[#fed7aa] line-clamp-1">{collection.subtitle}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-mono text-amber-200">
                    <span>
                      Progression : {currentCount} / {targetCount} élément{targetCount > 1 ? 's' : ''} attesté{targetCount > 1 ? 's' : ''}
                    </span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="h-2 w-full bg-[#170d07] border border-[#5c381c]">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isComplete
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-300'
                          : 'bg-gradient-to-r from-amber-700 to-amber-500'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Claim Reward Button (when complete and unclaimed) */}
                {isComplete && !isClaimed && (
                  <div className="p-3 bg-[#451a03] border-2 border-[#f59e0b] flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
                    <div className="text-xs text-amber-100 space-y-0.5 text-center sm:text-left">
                      <div className="font-bold text-yellow-300">
                        Ensemble accompli ! Réclamez votre Blason & Titre :
                      </div>
                      <div className="text-[11px] text-amber-200">
                        « {collection.crest.badgeName} » · {collection.reward.honorificTitle} · Cosmétique « {collection.reward.cosmeticName} »
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onClaimReward(collection)}
                      className="w-full sm:w-auto px-4 py-2 text-xs font-bold uppercase tracking-wider bg-amber-400 text-stone-950 border-2 border-[#78350f] hover:bg-yellow-300 active:scale-95 transition-transform jrpg-shadow shrink-0"
                    >
                      Réclamer l’Insigne (+{collection.bonusXp} XP)
                    </button>
                  </div>
                )}

                {/* Toggle details button */}
                <div className="flex items-center justify-between pt-1 border-t border-[#5c381c]/60">
                  <div className="text-[11px] text-[#fbbf24] font-serif italic truncate pr-2">
                    {collection.crest.badgeTitle}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCollectionId(isExpanded ? null : collection.id)
                    }
                    className="text-xs font-bold text-amber-300 hover:text-amber-100 flex items-center gap-1 shrink-0"
                  >
                    <span>{isExpanded ? 'Replier l’inventaire' : 'Détails & indices'}</span>
                    <span className="text-[10px]">{isExpanded ? '▲' : '▼'}</span>
                  </button>
                </div>

                {/* Expanded details: Lore + Item Slots + Rewards */}
                {isExpanded && (
                  <div className="space-y-3 pt-2 border-t border-[#78350f] text-xs">
                    {/* Lore text */}
                    <div className="p-2.5 bg-[#170c07] border border-[#78350f] text-[#fde68a] italic leading-relaxed">
                      {collection.loreBlurb}
                    </div>

                    {/* Discovered Items List */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                        Éléments de l’ensemble ({currentCount}/{targetCount}) :
                      </div>

                      {/* Discovered POIs */}
                      {discoveredEntries.map((entry) => (
                        <div
                          key={entry.poiId}
                          className="p-2 bg-[#2a170e] border border-[#a16207] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-amber-100 truncate">{entry.name}</div>
                            <div className="text-[10px] text-amber-300/80 truncate">
                              {entry.subType} · {entry.eraLabel}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpenJournalPoi(entry.poiId)}
                            className="px-2 py-1 text-[10px] font-bold bg-[#78350f] text-amber-100 hover:bg-[#92400e] border border-[#d97706] shrink-0"
                          >
                            Consulter au Grimoire
                          </button>
                        </div>
                      ))}

                      {/* Discovered Specimens */}
                      {discoveredSpecimens.map((specimen) => (
                        <div
                          key={specimen.specimenId}
                          className="p-2 bg-[#1b2716] border border-[#22c55e] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-emerald-200 truncate">
                              🌿 {specimen.name}
                            </div>
                            <div className="text-[10px] text-emerald-300/80 truncate">
                              {specimen.latinOrMineralName} · {specimen.affinity}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 text-[10px] font-mono bg-[#052e16] text-emerald-300 border border-emerald-700">
                            {specimen.domain === 'geologie' ? 'Lithothèque' : 'Herbier'}
                          </span>
                        </div>
                      ))}

                      {/* Missing slots with hints */}
                      {collection.itemSlots.slice(currentCount).map((slot, idx) => (
                        <div
                          key={idx}
                          className="p-2 bg-[#140b07] border border-[#442310] border-dashed flex items-start gap-2.5 text-[#a8a29e]"
                        >
                          <div className="w-5 h-5 rounded bg-[#29170e] border border-[#5c381c] flex items-center justify-center text-[10px] text-amber-400 shrink-0">
                            ?
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <div className="font-semibold text-amber-200/80 text-[11px]">
                              {slot.label}
                            </div>
                            <div className="text-[10px] text-[#d6d3d1]/70 leading-normal">
                              Indice d’exploration : {slot.hint}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Reward preview bar */}
                    <div className="p-2.5 bg-[#1a0e08] border border-[#a16207] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-bold">Récompense de collection :</span>
                        <span className="text-amber-100 font-semibold">
                          « {collection.reward.cosmeticName} » ({collection.reward.cosmeticSlot})
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-yellow-300">
                        +{collection.bonusXp} XP · Titre : {collection.reward.honorificTitle}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
