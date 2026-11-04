import React, { useState } from 'react';
import {
  DiscoveredSecretEntryRecord,
  getCollectedCluesCountForSite,
  getSecretCollectibleById,
  isSecretSiteRevealedOnMap,
  SECRET_COLLECTIBLES_CATALOG,
  SecretArchivesState,
  SecretClueFragment,
  SecretCollectibleCanvas,
  SecretHiddenSite,
} from '../secretArchives';
import { playSecretClueChimeSfx, playStampSfx } from '../sound';
import {
  CATEGORY_META,
  haversineMeters,
  inferOfficialStateLabel,
  OFFICIAL_STATE_LABEL_META,
  UnlockedEntry,
} from '../types';
import { PixelCornerRivets, PixelGuildIcon, PixelUiIcon } from './PixelIcons';

// ============================================================================
// 1. INLINE SYMPATHETIC-INK CLUE BANNER (ON ENTRY DETAIL & MAP POI CARD)
// ============================================================================

export const SympatheticInkClueBanner: React.FC<{
  site: SecretHiddenSite;
  clue: SecretClueFragment;
  secretState: SecretArchivesState;
  unlockedIds: ReadonlySet<string>;
  onOpenDecipherModal: (site: SecretHiddenSite) => void;
  onFocusSecretOnMap?: (lat: number, lng: number, isSubterranean: boolean) => void;
  compact?: boolean;
}> = ({
  site,
  clue,
  secretState,
  unlockedIds,
  onOpenDecipherModal,
  onFocusSecretOnMap,
  compact = false,
}) => {
  const isAlreadyDiscovered = unlockedIds.has(site.secretPoiId);
  const isRevealed = isSecretSiteRevealedOnMap(site, secretState, unlockedIds);
  const cluesFound = getCollectedCluesCountForSite(site, secretState, unlockedIds);
  const collectible = getSecretCollectibleById(site.collectibleId);

  return (
    <div
      className={`relative bg-[#1e102b] border-2 border-[#c084fc] text-[#fef3c7] jrpg-shadow ${
        compact ? 'p-3 space-y-2' : 'p-4 space-y-3'
      }`}
    >
      <PixelCornerRivets className="bg-[#c084fc]" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#e9d5ff]">
          <PixelUiIcon name="quill" className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>Note à l’Encre Sympathique · {site.archiveCote}</span>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#3b0764] text-amber-300 border border-[#a855f7]">
          Indices {cluesFound}/2
        </span>
      </div>

      <div className="space-y-1">
        <div className="text-xs font-bold text-amber-300">
          {clue.titleFr} — vers « {site.codenameFr} »
        </div>
        <p className="text-xs text-[#f5d0fe] leading-relaxed italic break-words">
          {clue.marginaliaTextFr}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#581c87]">
        <div className="inline-flex items-center gap-2 min-w-0">
          <SecretCollectibleCanvas collectible={collectible} unlocked size={28} />
          <div className="min-w-0 text-[11px]">
            <div className="font-bold text-amber-200 truncate">
              Butin secret : +{site.bonusXpTotal} XP & {collectible.name}
            </div>
          </div>
        </div>

        {isAlreadyDiscovered ? (
          <span className="px-2.5 py-1 text-[11px] font-bold bg-emerald-900 text-emerald-200 border border-emerald-400">
            ✦ Archive Secrète déjà dévoilée
          </span>
        ) : isRevealed && onFocusSecretOnMap ? (
          <button
            type="button"
            onClick={() =>
              onFocusSecretOnMap(site.poi.lat, site.poi.lng, Boolean(site.poi.isSubterranean))
            }
            className="min-h-[36px] px-3 py-1.5 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-1.5"
          >
            <PixelUiIcon name="gps" className="w-3.5 h-3.5" />
            <span>Viser le Sceau Secret révélé</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onOpenDecipherModal(site)}
            className="min-h-[36px] px-3 py-1.5 text-xs font-bold bg-[#9333ea] hover:bg-[#a855f7] text-[#fffbeb] border-2 border-[#fde047] jrpg-shadow inline-flex items-center gap-1.5"
          >
            <PixelUiIcon name="lantern" className="w-3.5 h-3.5" />
            <span>Déchiffrer l’énigme (+40 XP)</span>
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 2. MODAL DE DÉCHIFFREMENT D'ÉNIGME D'ARCHIVE SECRÈTE
// ============================================================================

export const SecretRiddleDecipherModal: React.FC<{
  site: SecretHiddenSite;
  secretState: SecretArchivesState;
  unlockedIds: ReadonlySet<string>;
  muted: boolean;
  onClose: () => void;
  onDecipherSuccess: (site: SecretHiddenSite) => void;
  onFocusSecretOnMap: (lat: number, lng: number, isSubterranean: boolean) => void;
}> = ({
  site,
  secretState,
  unlockedIds,
  muted,
  onClose,
  onDecipherSuccess,
  onFocusSecretOnMap,
}) => {
  const alreadyDeciphered = secretState.decipheredSecretIds.includes(site.secretPoiId);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(
    alreadyDeciphered ? site.correctOptionIndex : null
  );
  const [wrongFeedback, setWrongFeedback] = useState('');
  const [solvedNow, setSolvedNow] = useState(alreadyDeciphered);

  const collectible = getSecretCollectibleById(site.collectibleId);

  const handleChoose = (idx: number) => {
    setSelectedIdx(idx);
    setWrongFeedback('');
    if (idx === site.correctOptionIndex) {
      playSecretClueChimeSfx(muted);
      setSolvedNow(true);
      if (!alreadyDeciphered) {
        onDecipherSuccess(site);
      }
    } else {
      playStampSfx(muted);
      setWrongFeedback(
        'La triangulation ne concorde pas avec l’encre sympathique. Relisez les marges ci-dessus et réessayez !'
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Déchiffrement ${site.codenameFr}`}
    >
      <div className="relative w-full max-w-xl bg-[#1b0f26] border-4 border-[#fde047] text-[#fef3c7] p-4 sm:p-6 space-y-4 jrpg-shadow my-auto">
        <PixelCornerRivets className="bg-[#fde047]" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la table de déchiffrement"
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center bg-[#3b0764] text-amber-300 hover:bg-[#991b1b] hover:text-white border border-[#fde047]"
        >
          <PixelUiIcon name="close" className="w-3.5 h-3.5" />
        </button>

        <div className="space-y-1 pr-10">
          <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#e9d5ff] flex items-center gap-1.5">
            <PixelUiIcon name="lantern" className="w-4 h-4 text-amber-300" />
            <span>Table de Déchiffrement · Cote {site.archiveCote}</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold font-display text-amber-300">
            ✦ {site.codenameFr}
          </h3>
          <p className="text-xs text-[#d8b4fe]">
            Recoupez les notes marginales du secteur pour faire apparaître ce lieu d’intérêt caché sur votre carte.
          </p>
        </div>

        {/* Clues summary */}
        <div className="space-y-2 bg-[#2a143d] border-2 border-[#7e22ce] p-3">
          {site.clues.map((c) => {
            const unlockedClue =
              secretState.collectedClueKeys.includes(c.clueKey) || unlockedIds.has(c.anchorPoiId);
            return (
              <div key={c.clueKey} className="text-xs space-y-0.5">
                <div className="font-bold text-amber-200 flex items-center justify-between gap-2">
                  <span>{c.titleFr}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#3b0764] border border-[#a855f7] text-[#e9d5ff]">
                    {unlockedClue ? 'Révélé' : `Porteur : ${c.anchorPoiName.slice(0, 26)}`}
                  </span>
                </div>
                {unlockedClue ? (
                  <p className="text-[#f5d0fe] italic leading-relaxed">{c.marginaliaTextFr}</p>
                ) : (
                  <p className="text-[#a78bfa] leading-relaxed">
                    Indice encore voilé — débloquez « {c.anchorPoiName} » sur le terrain pour révéler cette marge, ou déduisez par logique cartographique !
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Riddle */}
        <div className="space-y-2.5">
          <div className="text-sm font-bold text-[#fef3c7] leading-snug">
            {site.riddleQuestionFr}
          </div>
          <div className="space-y-2">
            {site.riddleOptionsFr.map((opt, idx) => {
              const isChosen = selectedIdx === idx;
              const isRight = idx === site.correctOptionIndex;
              const btnClass = solvedNow
                ? isRight
                  ? 'bg-emerald-900 border-emerald-400 text-emerald-100'
                  : 'bg-[#261636] border-[#4c1d95] text-[#a78bfa] opacity-65'
                : isChosen
                ? 'bg-[#7f1d1d] border-rose-400 text-rose-100'
                : 'bg-[#2e1065] hover:bg-[#4c1d95] border-[#c084fc] text-[#fef3c7]';

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={solvedNow}
                  onClick={() => handleChoose(idx)}
                  className={`w-full text-left p-3 text-xs font-bold border-2 jrpg-shadow transition-colors flex items-center justify-between gap-2 ${btnClass}`}
                >
                  <span>
                    {String.fromCharCode(65 + idx)}. {opt}
                  </span>
                  {solvedNow && isRight && <span className="text-amber-300 shrink-0">✦ EXACT</span>}
                </button>
              );
            })}
          </div>

          {wrongFeedback && (
            <div className="p-2.5 bg-[#450a0a] border border-rose-400 text-xs text-rose-200 font-semibold">
              {wrongFeedback}
            </div>
          )}
        </div>

        {solvedNow && (
          <div className="p-3.5 bg-[#11261f] border-2 border-emerald-400 space-y-2.5">
            <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
              ✦ Emplacement Secret Révélé sur la Carte 16-Bit !
            </div>
            <p className="text-xs text-emerald-100 leading-relaxed">{site.decipherLoreFr}</p>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="inline-flex items-center gap-2 text-xs text-amber-200 font-bold">
                <SecretCollectibleCanvas collectible={collectible} unlocked size={32} />
                <span>
                  À la découverte sur place : +{site.bonusXpTotal} XP & {collectible.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onFocusSecretOnMap(
                    site.poi.lat,
                    site.poi.lng,
                    Boolean(site.poi.isSubterranean)
                  );
                  onClose();
                }}
                className="min-h-[40px] px-3.5 py-2 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-1.5"
              >
                <PixelUiIcon name="gps" className="w-4 h-4" />
                <span>Tracer vers le Lieu Caché</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 3. ONGLET COMPLET DU CARNET : « ARCHIVES SECRÈTES & LIEUX CACHÉS »
// ============================================================================

export const SecretArchivesCarnetView: React.FC<{
  sectorSecrets: SecretHiddenSite[];
  secretState: SecretArchivesState;
  entries: UnlockedEntry[];
  unlockedIds: ReadonlySet<string>;
  playerLat: number;
  playerLng: number;
  onOpenDecipherModal: (site: SecretHiddenSite) => void;
  onFocusLocationOnMap: (lat: number, lng: number, isSubterranean: boolean) => void;
  onSelectPoiOnMap: (poiId: string) => void;
  onOpenJournalEntry: (poiId: string) => void;
}> = ({
  sectorSecrets,
  secretState,
  entries,
  unlockedIds,
  playerLat,
  playerLng,
  onOpenDecipherModal,
  onFocusLocationOnMap,
  onSelectPoiOnMap,
  onOpenJournalEntry,
}) => {
  const [subSection, setSubSection] = useState<'enquetes' | 'feuillets' | 'collectibles'>(
    'enquetes'
  );

  const unlockedCollectibleSet = new Set(secretState.unlockedCollectibleIds);
  const discoveredRecords: DiscoveredSecretEntryRecord[] = secretState.discoveredSecretRecords;

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="relative bg-[#1b0f26] border-4 border-[#2b1a0e] p-4 sm:p-5 text-[#fef3c7] jrpg-shadow space-y-3">
        <PixelCornerRivets className="bg-[#c084fc]" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#e9d5ff] flex items-center gap-1.5">
              <PixelUiIcon name="quill" className="w-4 h-4 text-amber-300" />
              <span>Chapitre Confidentiel du Grimoire · Encre Sympathique</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-display text-amber-300">
              Archives Secrètes & Lieux d’Intérêt Cachés
            </h2>
            <p className="text-xs text-[#e9d5ff] leading-relaxed max-w-3xl">
              Certains joyaux du patrimoine (Monuments Historiques, Maisons des Illustres, Jardins Remarquables, sources et curiosités) demeurent invisibles sur la carte tant que vous n’avez pas recueilli leurs indices en marge d’autres lieux ou résolu leur énigme de triangulation.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 shrink-0 text-center font-mono">
            <div className="bg-[#2e1065] border-2 border-[#a855f7] px-3 py-2">
              <div className="text-base font-bold text-amber-300">
                {discoveredRecords.length}
              </div>
              <div className="text-[10px] font-sans text-[#e9d5ff]">Lieux dévoilés</div>
            </div>
            <div className="bg-[#2e1065] border-2 border-[#a855f7] px-3 py-2">
              <div className="text-base font-bold text-emerald-300">
                {unlockedCollectibleSet.size}/{SECRET_COLLECTIBLES_CATALOG.length}
              </div>
              <div className="text-[10px] font-sans text-[#e9d5ff]">Collectibles</div>
            </div>
            <div className="bg-[#2e1065] border-2 border-[#a855f7] px-3 py-2">
              <div className="text-base font-bold text-[#f0abfc]">
                {secretState.collectedClueKeys.length}
              </div>
              <div className="text-[10px] font-sans text-[#e9d5ff]">Indices lus</div>
            </div>
          </div>
        </div>

        {/* Sub-navigation */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-[#581c87]">
          {(
            [
              {
                id: 'enquetes' as const,
                label: `Enquêtes du secteur (${sectorSecrets.length})`,
                icon: 'lantern' as const,
              },
              {
                id: 'feuillets' as const,
                label: `Feuillets Secrets (${discoveredRecords.length})`,
                icon: 'book' as const,
              },
              {
                id: 'collectibles' as const,
                label: `Collectibles Rares (${unlockedCollectibleSet.size}/${SECRET_COLLECTIBLES_CATALOG.length})`,
                icon: 'relic' as const,
              },
            ]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubSection(tab.id)}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-bold border-2 jrpg-shadow inline-flex items-center gap-1.5 transition-colors ${
                subSection === tab.id
                  ? 'bg-amber-300 text-[#24160c] border-[#2b1a0e]'
                  : 'bg-[#2e1065] text-[#fef3c7] border-[#a855f7] hover:bg-[#4c1d95]'
              }`}
            >
              <PixelUiIcon name={tab.icon} className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 1: ACTIVE SECTOR INVESTIGATIONS */}
      {subSection === 'enquetes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sectorSecrets.length === 0 ? (
            <div className="grimoire-folio p-6 text-center text-xs font-bold text-[#54361d] lg:col-span-2">
              Sondez un secteur riche en points d’intérêt pour détecter des signaux d’Archives Secrètes.
            </div>
          ) : (
            sectorSecrets.map((site) => {
              const isDiscovered = unlockedIds.has(site.secretPoiId);
              const isRevealed = isSecretSiteRevealedOnMap(site, secretState, unlockedIds);
              const cluesCount = getCollectedCluesCountForSite(site, secretState, unlockedIds);
              const collectible = getSecretCollectibleById(site.collectibleId);
              const distNow = Math.round(
                haversineMeters(playerLat, playerLng, site.poi.lat, site.poi.lng)
              );
              const catMeta = CATEGORY_META[site.poi.category];
              const official = inferOfficialStateLabel(
                site.poi.source,
                site.poi.subType,
                site.poi.officialLabel
              );

              return (
                <div
                  key={site.secretPoiId}
                  className="relative grimoire-folio p-4 sm:p-5 space-y-3.5 text-[#24160c] border-2 border-[#2b1a0e]"
                >
                  <PixelCornerRivets className="bg-[#9333ea]" />

                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                        <span className="px-2 py-0.5 bg-[#2e1065] text-amber-300 border border-[#2b1a0e] font-mono">
                          {site.archiveCote}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[#54361d]">
                          <PixelGuildIcon category={site.poi.category} className="w-3.5 h-3.5" />
                          <span>{catMeta.shortLabel}</span>
                        </span>
                        {official && (
                          <span
                            className={`px-2 py-0.5 text-[10px] border ${OFFICIAL_STATE_LABEL_META[official].badgeClass}`}
                          >
                            {OFFICIAL_STATE_LABEL_META[official].shortBadge}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold font-display text-[#24160c] break-words">
                        {isDiscovered ? site.poi.name : `✦ ${site.codenameFr}`}
                      </h3>
                    </div>

                    <span
                      className={`px-2.5 py-1 text-[11px] font-bold border-2 border-[#2b1a0e] shrink-0 ${
                        isDiscovered
                          ? 'bg-emerald-700 text-white'
                          : isRevealed
                          ? 'bg-amber-300 text-[#24160c]'
                          : 'bg-[#3b0764] text-[#f5d0fe]'
                      }`}
                    >
                      {isDiscovered
                        ? 'Dévoilé ✓'
                        : isRevealed
                        ? `Révélé (${distNow} m)`
                        : `Voilé (${cluesCount}/2 indices)`}
                    </span>
                  </div>

                  {/* Clues list */}
                  <div className="space-y-2 bg-[#f5e4c3] border-2 border-[#8c653b] p-3">
                    {site.clues.map((cl) => {
                      const hasClue =
                        secretState.collectedClueKeys.includes(cl.clueKey) ||
                        unlockedIds.has(cl.anchorPoiId);
                      return (
                        <div key={cl.clueKey} className="text-xs space-y-1">
                          <div className="flex items-center justify-between gap-2 font-bold text-[#3b2312]">
                            <span>{cl.titleFr}</span>
                            {!hasClue && (
                              <button
                                type="button"
                                onClick={() => onSelectPoiOnMap(cl.anchorPoiId)}
                                className="px-2 py-0.5 text-[10px] bg-[#28160d] text-amber-300 hover:bg-[#991b1b] border border-[#2b1a0e]"
                              >
                                Viser porteur d’indice
                              </button>
                            )}
                          </div>
                          {hasClue ? (
                            <p className="text-[#4a1d6e] font-semibold italic leading-relaxed">
                              {cl.marginaliaTextFr}
                            </p>
                          ) : (
                            <p className="text-[#6b4928]">
                              Inspectez le lieu voisin « <strong>{cl.anchorPoiName}</strong> » pour révéler cette marge à l’encre sympathique.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Reward & Action */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="inline-flex items-center gap-2">
                      <SecretCollectibleCanvas
                        collectible={collectible}
                        unlocked={isDiscovered || unlockedCollectibleSet.has(collectible.id)}
                        size={36}
                      />
                      <div className="text-xs">
                        <div className="font-bold text-[#24160c]">+{site.bonusXpTotal} XP</div>
                        <div className="text-[11px] text-[#6b4928]">{collectible.name}</div>
                      </div>
                    </div>

                    {isDiscovered ? (
                      <button
                        type="button"
                        onClick={() => onOpenJournalEntry(site.secretPoiId)}
                        className="min-h-[40px] px-3.5 py-2 text-xs font-bold bg-[#991b1b] text-white border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-1.5"
                      >
                        <PixelUiIcon name="book" className="w-3.5 h-3.5" />
                        <span>Lire le feuillet secret</span>
                      </button>
                    ) : isRevealed ? (
                      <button
                        type="button"
                        onClick={() =>
                          onFocusLocationOnMap(
                            site.poi.lat,
                            site.poi.lng,
                            Boolean(site.poi.isSubterranean)
                          )
                        }
                        className="min-h-[40px] px-3.5 py-2 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-1.5"
                      >
                        <PixelUiIcon name="gps" className="w-3.5 h-3.5" />
                        <span>Se rendre au Sceau Secret</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenDecipherModal(site)}
                        className="min-h-[40px] px-3.5 py-2 text-xs font-bold bg-[#7e22ce] hover:bg-[#9333ea] text-white border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-1.5"
                      >
                        <PixelUiIcon name="lantern" className="w-3.5 h-3.5" />
                        <span>Résoudre l’énigme</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SECTION 2: SPECIAL SECRET JOURNAL ENTRIES */}
      {subSection === 'feuillets' && (
        <div className="space-y-3">
          {discoveredRecords.length === 0 ? (
            <div className="grimoire-folio p-6 text-center text-xs font-bold text-[#54361d]">
              Aucun Lieu d’Intérêt Caché n’a encore été dévoilé. Recueillez des indices à l’encre sympathique sur les monuments voisins ou résolvez une énigme de triangulation !
            </div>
          ) : (
            discoveredRecords.map((rec) => {
              const collectible = getSecretCollectibleById(rec.collectibleId);
              const hasFullEntry = entries.some((e) => e.poiId === rec.secretPoiId);
              return (
                <div
                  key={rec.secretPoiId}
                  className="relative bg-[#241334] border-2 border-[#fde047] p-4 sm:p-5 text-[#fef3c7] jrpg-shadow space-y-2.5"
                >
                  <PixelCornerRivets className="bg-[#fde047]" />
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="text-[11px] font-mono text-[#e9d5ff] font-bold">
                        ✦ ARCHIVE SECRÈTE {rec.archiveCote} · « {rec.codenameFr} » · +{rec.bonusXpAwarded} XP
                      </div>
                      <h3 className="text-lg font-bold font-display text-amber-300">
                        {rec.name}
                      </h3>
                      <div className="text-xs text-[#d8b4fe]">
                        {rec.eraLabel} · {rec.source} · Découvert le{' '}
                        {new Date(rec.discoveredAtIso).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-2 bg-[#3b0764] border border-[#c084fc] px-2.5 py-1.5">
                      <SecretCollectibleCanvas collectible={collectible} unlocked size={30} />
                      <span className="text-xs font-bold text-amber-200">{collectible.name}</span>
                    </div>
                  </div>

                  <p className="text-xs text-[#f5d0fe] italic leading-relaxed">
                    {rec.decipherLoreFr}
                  </p>
                  <p className="text-xs text-[#fef3c7]/90 leading-relaxed line-clamp-4">
                    {rec.summary}
                  </p>

                  {hasFullEntry && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenJournalEntry(rec.secretPoiId)}
                        className="min-h-[36px] px-3 py-1.5 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-1.5"
                      >
                        <PixelUiIcon name="book" className="w-3.5 h-3.5" />
                        <span>Ouvrir la fiche complète & annoter</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SECTION 3: 8 RARE COLLECTIBLES SHOWCASE */}
      {subSection === 'collectibles' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {SECRET_COLLECTIBLES_CATALOG.map((item) => {
            const isUnlocked = unlockedCollectibleSet.has(item.id);
            return (
              <div
                key={item.id}
                className={`relative p-4 border-2 border-[#2b1a0e] jrpg-shadow space-y-2.5 ${
                  isUnlocked
                    ? 'bg-[#f8edd6] text-[#24160c]'
                    : 'bg-[#2a211b] text-[#a8a29e] opacity-85'
                }`}
              >
                <div className="flex items-center gap-3">
                  <SecretCollectibleCanvas collectible={item} unlocked={isUnlocked} size={48} />
                  <div className="min-w-0">
                    <div
                      className={`text-[10px] font-mono font-bold uppercase ${
                        isUnlocked ? 'text-purple-900' : 'text-stone-400'
                      }`}
                    >
                      {isUnlocked ? item.rarityLabel : 'Collectible Scellé'}
                    </div>
                    <h4 className="text-sm font-bold font-display leading-tight break-words">
                      {isUnlocked ? item.name : '??? Artefact Voilé'}
                    </h4>
                  </div>
                </div>
                <p className="text-xs leading-relaxed">
                  {isUnlocked
                    ? item.lore
                    : `Débusquez un lieu d’intérêt caché (${CATEGORY_META[item.category].shortLabel}) pour obtenir ce collectible rare.`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
