import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { motion } from 'motion/react';
import { computeArchiveSealCode, downloadCollectibleCardPng } from '../collectibleCard';
import {
  deletePoiCairnInCloud,
  subscribeToPoiCairns,
  upsertPoiCairnInCloud,
} from '../firebase';
import { addPhotoForPoi, deletePhotoById, getPhotosForPoi, StoredFieldPhoto } from '../photoStore';
import { playStampSfx } from '../sound';
import {
  CAIRN_TAG_META,
  CairnTag,
  CATEGORY_META,
  ExplorerAppearance,
  ExplorerCairn,
  PostcardSubject,
  UnlockedEntry,
} from '../types';
import { ExplorerSpriteCanvas } from './ExplorerAvatarCanvas';
import { PixelCornerRivets, PixelGuildIcon, PixelUiIcon } from './PixelIcons';
import { ResilientPixelImage } from './ResilientPixelImage';

interface EntryDetailPanelProps {
  entry: UnlockedEntry;
  unlockedIds: Set<string>;
  explorerCallsign?: string;
  explorerAppearance?: ExplorerAppearance;
  altitudeMeters?: number | null;
  currentUser?: User | null;
  muted?: boolean;
  onRequestCloudSignIn?: () => void;
  onSaveJournalAnnotation: (poiId: string, note: string, photoCount: number) => Promise<void>;
  onNavigateToRelatedPoi: (relatedPoiId: string) => void;
  onOpenPostcard?: (subject: PostcardSubject) => void;
  onBackToList?: () => void;
  backLabel?: string;
}

export const EntryDetailPanel: React.FC<EntryDetailPanelProps> = ({
  entry,
  unlockedIds,
  explorerCallsign = 'Explorateur',
  explorerAppearance,
  altitudeMeters = null,
  currentUser = null,
  muted = false,
  onRequestCloudSignIn,
  onSaveJournalAnnotation,
  onNavigateToRelatedPoi,
  onOpenPostcard,
  onBackToList,
  backLabel = 'Retour aux feuillets',
}) => {
  const [noteDraft, setNoteDraft] = useState(entry.personalNote);
  const [photos, setPhotos] = useState<StoredFieldPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState('');
  const [photoError, setPhotoError] = useState('');

  // Asynchronous Explorer Cairns State
  const [cairns, setCairns] = useState<ExplorerCairn[]>([]);
  const [cairnTag, setCairnTag] = useState<CairnTag>('architecture');
  const [cairnMessage, setCairnMessage] = useState('');
  const [cairnBusy, setCairnBusy] = useState(false);
  const [cairnFeedback, setCairnFeedback] = useState('');
  const [cairnError, setCairnError] = useState('');

  const cat = CATEGORY_META[entry.category] || CATEGORY_META.histoire;
  const sealCode = computeArchiveSealCode(entry.poiId);
  const isVerifiedUser = Boolean(currentUser && currentUser.emailVerified);

  useEffect(() => {
    setNoteDraft(entry.personalNote);
    setSaveFeedback('');
    setPhotoError('');
    setCairnFeedback('');
    setCairnError('');
    getPhotosForPoi(entry.poiId).then(setPhotos);
  }, [entry.poiId, entry.personalNote]);

  useEffect(() => {
    if (!isVerifiedUser || !currentUser) {
      setCairns([]);
      return;
    }
    const unsub = subscribeToPoiCairns(entry.poiId, (list) => {
      setCairns(list);
      const mine = list.find((c) => c.authorId === currentUser.uid);
      if (mine) {
        setCairnTag(mine.tag);
        setCairnMessage((prev) => (prev === '' ? mine.message : prev));
      }
    });
    return () => unsub();
  }, [entry.poiId, isVerifiedUser, currentUser]);

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveFeedback('');
    try {
      await onSaveJournalAnnotation(entry.poiId, noteDraft, photos.length);
      playStampSfx(muted);
      setSaveFeedback('Consigné au Grimoire !');
      window.setTimeout(() => setSaveFeedback(''), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    setSaving(true);
    try {
      const updated = await addPhotoForPoi(entry.poiId, file);
      setPhotos(updated);
      await onSaveJournalAnnotation(entry.poiId, noteDraft, updated.length);
      playStampSfx(muted);
      setSaveFeedback('Cliché scellé au Carnet !');
      window.setTimeout(() => setSaveFeedback(''), 2500);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Impossible d’ajouter la photo.');
    } finally {
      setSaving(false);
      e.target.value = '';
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    const updated = await deletePhotoById(photoId, entry.poiId);
    setPhotos(updated);
    await onSaveJournalAnnotation(entry.poiId, noteDraft, updated.length);
  };

  const handleExportCard = () => {
    playStampSfx(muted);
    downloadCollectibleCardPng(entry, explorerCallsign, altitudeMeters);
    setSaveFeedback('Carte 16-bit forgée en PNG !');
    window.setTimeout(() => setSaveFeedback(''), 2600);
  };

  const handleSubmitCairn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isVerifiedUser) return;
    if (cairnMessage.trim().length < 3) {
      setCairnError('Écrivez au moins quelques mots pour déposer un cairn (3–280 caractères).');
      return;
    }
    setCairnBusy(true);
    setCairnError('');
    try {
      await upsertPoiCairnInCloud({
        uidRaw: currentUser.uid,
        authorCallsign: explorerCallsign || currentUser.displayName || 'Éclaireur',
        authorAppearance: explorerAppearance,
        poiEntry: entry,
        tag: cairnTag,
        message: cairnMessage,
      });
      playStampSfx(muted);
      setCairnFeedback('Cairn de pierre déposé sur ce lieu !');
      window.setTimeout(() => setCairnFeedback(''), 2800);
    } catch (err) {
      setCairnError(err instanceof Error ? err.message : 'Impossible de déposer le cairn.');
    } finally {
      setCairnBusy(false);
    }
  };

  const handleDeleteMyCairn = async () => {
    if (!currentUser) return;
    setCairnBusy(true);
    setCairnError('');
    try {
      await deletePoiCairnInCloud(currentUser.uid, entry.poiId);
      setCairnMessage('');
      setCairnFeedback('Cairn retiré.');
      window.setTimeout(() => setCairnFeedback(''), 2200);
    } catch (err) {
      setCairnError(err instanceof Error ? err.message : 'Impossible de retirer ce cairn.');
    } finally {
      setCairnBusy(false);
    }
  };

  const formattedDate = new Date(entry.discoveredAtIso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const myExistingCairn = currentUser ? cairns.find((c) => c.authorId === currentUser.uid) : null;

  return (
    <motion.article
      key={entry.poiId}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="relative grimoire-folio-crimson text-[#23170e] p-4 sm:p-7 space-y-5 sm:space-y-6"
    >
      <PixelCornerRivets className="bg-[#f59e0b]" />
      <div className="pixel-frieze -mt-1 sm:-mt-2 mb-3 sm:mb-4" aria-hidden="true" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {onBackToList ? (
          <button
            type="button"
            onClick={onBackToList}
            className="min-h-[42px] px-3.5 py-2 text-xs font-bold bg-[#28160d] text-amber-300 hover:bg-[#3f2416] border-2 border-[#d97706] jrpg-shadow inline-flex items-center gap-2 transition-colors"
          >
            <PixelUiIcon name="arrow-left" className="w-3.5 h-3.5" />
            <span>{backLabel}</span>
          </button>
        ) : (
          <span />
        )}

        {/* Exportable 16-Bit Postcard & Collectible Card Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onOpenPostcard && (
            <button
              type="button"
              onClick={() => onOpenPostcard({ kind: 'poi', entry })}
              className="min-h-[42px] px-3.5 py-2 text-xs font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-2 transition-transform duration-150 active:translate-y-0.5 whitespace-nowrap shrink-0"
            >
              <PixelUiIcon name="postcard" className="w-4 h-4" />
              <span>Carte postale 16-bit</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCard}
            className="min-h-[42px] px-3.5 py-2 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-2 transition-transform duration-150 active:translate-y-0.5 whitespace-nowrap shrink-0"
          >
            <PixelUiIcon name="stamp" className="w-4 h-4" />
            <span>Fiche d’archive (PNG)</span>
          </button>
        </div>
      </div>

      {/* Header with 16-bit Guild Emblem + Procedural Crimson Ink Archive Stamp */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 pb-5 border-b-2 border-[#c89d62]">
        <ResilientPixelImage
          src={cat.emblemSrc}
          alt={cat.label}
          fallbackLabel={cat.shortLabel}
          className="w-20 h-20 border-2 border-[#2b1d12] jrpg-shadow shrink-0"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#5c4028]">
            <span className={`inline-flex items-center gap-1.5 font-bold ${cat.mapTextClass}`}>
              <PixelGuildIcon category={entry.category} className="w-4 h-4" />
              <span>{cat.label}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>{entry.subType}</span>
            {entry.eraLabel && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-900 font-bold">{entry.eraLabel}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-emerald-800 font-bold">
              +{entry.xpAwarded} XP
            </span>
          </div>
          <h3 className="text-2xl font-bold font-display text-[#23170e] leading-tight">
            {entry.name}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#6b4e31] font-mono tabular-nums">
            <span>
              {entry.lat.toFixed(4)}° N, {entry.lng.toFixed(4)}° E
            </span>
            {altitudeMeters !== null && altitudeMeters !== undefined && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-900 font-bold">Alt. {Math.round(altitudeMeters)} m</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="font-sans">Découvert le {formattedDate}</span>
            <span aria-hidden="true">·</span>
            <span className="font-sans">Archive : {entry.source}</span>
          </div>
        </div>

        {/* Procedural Crimson Ink Archive Stamp */}
        <div
          className="self-start sm:self-center shrink-0 px-3 py-2 border-2 border-rose-900/90 bg-rose-50/70 text-rose-900 font-mono text-center -rotate-2 select-none"
          aria-label={`Sceau d’archive ${sealCode}`}
        >
          <div className="text-[9px] font-bold tracking-widest uppercase">Sceau d’Archive</div>
          <div className="text-xs font-bold tabular-nums">{sealCode}</div>
          <div className="text-[9px] font-sans font-semibold">{cat.shortLabel}</div>
        </div>
      </div>

      {/* Waterway Context */}
      {entry.nearWaterway && (
        <div className="text-xs text-sky-950 bg-sky-100/80 border-2 border-sky-800 px-4 py-2.5 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <PixelUiIcon name="water" className="w-4 h-4" />
            <span>
              Relié au réseau hydrologique :{' '}
              <strong>{entry.waterwayName || 'Cours d’eau local'}</strong>
            </span>
          </span>
          <span className="text-sky-900 font-mono tabular-nums font-bold shrink-0">&lt; 185 m</span>
        </div>
      )}

      {/* Safety / Conservation Notice */}
      {entry.safetyNotice && (
        <div className="text-xs text-amber-950 bg-amber-100/90 border-2 border-amber-800 px-4 py-3 flex items-start gap-2.5">
          <PixelUiIcon name="warning" className="w-4 h-4 mt-0.5" />
          <p className="leading-relaxed font-medium">{entry.safetyNotice}</p>
        </div>
      )}

      {/* Encyclopedic Lore */}
      <div className="space-y-3">
        <p className="text-[15px] text-[#2b1d12] leading-relaxed whitespace-pre-line">
          {entry.summary}
        </p>
        {entry.externalUrl && (
          <a
            href={entry.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-bold text-rose-800 hover:text-rose-950 underline underline-offset-4 transition-colors"
          >
            <PixelUiIcon name="link" className="w-3.5 h-3.5 text-rose-800" />
            <span>Consulter le manuscrit source ({entry.source})</span>
          </a>
        )}
      </div>

      {/* Connected POIs */}
      {entry.relatedPoiIds.length > 0 && (
        <div className="pt-4 border-t-2 border-[#c89d62] space-y-3">
          <h4 className="text-base font-bold font-display text-[#23170e] flex items-center gap-2">
            <PixelUiIcon name="radar" className="w-4 h-4" />
            <span>Échos & lieux connexes sur ce territoire</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {entry.relatedPoiIds.map((relId, idx) => {
              const isRelUnlocked = unlockedIds.has(relId);
              const rawTitle = entry.relatedPoiTitles[idx] || 'Point connexe';
              return (
                <button
                  key={relId}
                  type="button"
                  onClick={() => onNavigateToRelatedPoi(relId)}
                  className="text-left p-3 bg-[#ecd8b1] border-2 border-[#2b1d12] hover:bg-[#fff6e3] hover:border-rose-700 hover:-translate-y-0.5 transition-transform duration-150 jrpg-shadow flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#23170e] truncate">
                      {isRelUnlocked ? rawTitle : '? Signal connexe voilé'}
                    </div>
                    <div className="text-xs text-[#6b4e31] mt-0.5">
                      {isRelUnlocked ? 'Ouvrir sa page au Carnet' : 'Localiser sur la carte 16-bit'}
                    </div>
                  </div>
                  <PixelUiIcon name="cursor" className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Explorer's Personal Field Notes & Photos */}
      <div className="pt-4 border-t-2 border-[#c89d62] space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h4 className="text-base font-bold font-display text-[#23170e] flex items-center gap-2">
            <PixelUiIcon name="quill" className="w-4 h-4" />
            <span>Notes personnelles & clichés de terrain</span>
          </h4>
          {saveFeedback && (
            <span className="text-xs text-emerald-800 font-bold">{saveFeedback}</span>
          )}
        </div>

        <form onSubmit={handleSaveNote} className="space-y-3">
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Consignez vos observations personnelles : atmosphère du lieu, strates visibles, détails insolites, accès…"
            className="w-full bg-[#ecd8b1] border-2 border-[#6b4e31] px-3.5 py-2.5 text-sm text-[#23170e] placeholder:text-[#7c5d3b] focus:outline-none focus:bg-[#fffaf0] focus:border-[#2b1d12] transition-colors"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-[#23170e] bg-amber-300 hover:bg-amber-200 border-2 border-[#2b1d12] jrpg-shadow cursor-pointer transition-transform duration-150 active:translate-y-0.5 whitespace-nowrap shrink-0">
              <PixelUiIcon name="camera" className="w-4 h-4" />
              <span>Ajouter une photo</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                className="sr-only"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-[#991b1b] text-[#fffbeb] border-2 border-[#2b1d12] jrpg-shadow hover:bg-[#b91c1c] disabled:opacity-50 transition-transform duration-150 active:translate-y-0.5 whitespace-nowrap shrink-0"
            >
              <PixelUiIcon name="quill" className="w-4 h-4" />
              <span>{saving ? 'Sauvegarde…' : 'Sceller la note'}</span>
            </button>
          </div>
        </form>

        {photoError && <p className="text-xs text-rose-800 font-bold">{photoError}</p>}

        {photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
            {photos.map((ph) => (
              <div
                key={ph.id}
                className="group relative aspect-[4/3] overflow-hidden border-2 border-[#2b1d12] bg-[#241710] jrpg-shadow"
              >
                <img
                  src={ph.dataUrl}
                  alt={`Cliché de terrain — ${entry.name}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleDeletePhoto(ph.id)}
                  aria-label="Supprimer cette photo"
                  className="absolute top-2 right-2 w-9 h-9 sm:w-auto sm:h-auto sm:p-1.5 flex items-center justify-center bg-[#241710]/95 border border-amber-400 text-[#fffbeb] hover:text-rose-300 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                >
                  <PixelUiIcon name="trash" className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Asynchronous Explorer Cairns ("Cairns d'Éclaireurs") */}
      <div className="pt-4 border-t-2 border-[#c89d62] space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-base font-bold font-display text-[#23170e] flex items-center gap-2">
            <PixelUiIcon name="cairn" className="w-4 h-4" />
            <span>Cairns d’Éclaireurs sur ce lieu</span>
          </h4>
          {cairnFeedback && (
            <span className="text-xs font-bold text-emerald-800">{cairnFeedback}</span>
          )}
        </div>

        {!isVerifiedUser ? (
          <div className="p-3.5 bg-[#ecd8b1] border-2 border-[#6b4928] flex flex-wrap items-center justify-between gap-3 text-xs text-[#3b2312]">
            <span>
              Connectez votre compte Cloud pour lire les cairns laissés par d’autres éclaireurs sur
              ce lieu et y déposer votre propre pierre gravée.
            </span>
            {onRequestCloudSignIn && (
              <button
                type="button"
                onClick={onRequestCloudSignIn}
                className="min-h-[38px] px-3.5 py-1.5 font-bold bg-[#991b1b] text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow whitespace-nowrap shrink-0"
              >
                Connexion Google
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {cairns.length === 0 ? (
              <p className="text-xs italic text-[#6b4928]">
                Aucun cairn n’a encore été érigé ici — soyez le premier éclaireur à laisser un
                indice discret pour les prochains marcheurs !
              </p>
            ) : (
              <div className="space-y-2">
                {cairns.map((c) => {
                  const tagMeta = CAIRN_TAG_META[c.tag] || CAIRN_TAG_META.architecture;
                  const isMine = currentUser?.uid === c.authorId;
                  const cairnAuthorAppearance: ExplorerAppearance = {
                    gender: c.authorGender || (isMine && explorerAppearance ? explorerAppearance.gender : 'masculin'),
                    avatarPreset:
                      c.authorAvatarPreset ||
                      (isMine && explorerAppearance ? explorerAppearance.avatarPreset : 'cartographe'),
                    skinTone:
                      c.authorSkinTone ||
                      (isMine && explorerAppearance ? explorerAppearance.skinTone : 'clair'),
                    headgearId:
                      c.authorHeadgearId ||
                      (isMine && explorerAppearance ? explorerAppearance.headgearId : 'tricorne_fauve'),
                    outfitId:
                      c.authorOutfitId ||
                      (isMine && explorerAppearance ? explorerAppearance.outfitId : 'arpenteur'),
                    toolId: 'lanterne_laiton',
                    packId: 'besace_cuir',
                  };
                  return (
                    <div
                      key={c.id}
                      className="p-3 bg-[#ecd8b1] border-2 border-[#6b4928] flex items-start gap-2.5"
                    >
                      <div className="bg-[#f8edd6] border border-[#6b4928] p-0.5 shrink-0">
                        <ExplorerSpriteCanvas
                          appearance={cairnAuthorAppearance}
                          animated={false}
                          pixelScale={1}
                          className="w-8 h-9"
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`px-2 py-0.5 font-bold border ${tagMeta.badgeClass}`}>
                              {tagMeta.label}
                            </span>
                            <span className="font-bold text-[#24160c]">{c.authorCallsign}</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[#6b4928]">
                            <span>{new Date(c.createdAtIso).toLocaleDateString('fr-FR')}</span>
                            {isMine && (
                              <button
                                type="button"
                                onClick={handleDeleteMyCairn}
                                disabled={cairnBusy}
                                className="text-rose-800 hover:text-rose-950 font-sans font-bold underline"
                              >
                                Retirer
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-[#2b1d12] leading-relaxed">{c.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <form
              onSubmit={handleSubmitCairn}
              className="p-3.5 bg-[#f3e1bc] border-2 border-[#6b4928] space-y-2.5"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                {(Object.keys(CAIRN_TAG_META) as CairnTag[]).map((tKey) => (
                  <button
                    key={tKey}
                    type="button"
                    onClick={() => setCairnTag(tKey)}
                    className={`px-2.5 py-1 text-[11px] font-bold border transition-colors ${
                      cairnTag === tKey
                        ? 'bg-[#28160d] text-amber-300 border-[#28160d]'
                        : 'bg-[#f8edd6] text-[#54361d] border-[#8c653b]'
                    }`}
                  >
                    {CAIRN_TAG_META[tKey].label}
                  </button>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={cairnMessage}
                  onChange={(e) => setCairnMessage(e.target.value)}
                  maxLength={280}
                  placeholder="Déposez une observation concise pour les prochains éclaireurs (max 280 car.)…"
                  className="flex-1 min-h-[40px] bg-[#fffaf0] border-2 border-[#6b4e31] px-3 py-1.5 text-xs text-[#23170e] placeholder:text-[#7c5d3b] focus:outline-none focus:border-[#2b1d12]"
                />
                <button
                  type="submit"
                  disabled={cairnBusy}
                  className="min-h-[40px] px-4 py-1.5 text-xs font-bold bg-[#28160d] hover:bg-[#3f2416] text-amber-300 border-2 border-[#d97706] jrpg-shadow whitespace-nowrap shrink-0"
                >
                  {myExistingCairn ? 'Mettre à jour mon cairn' : 'Ériger un cairn'}
                </button>
              </div>
              {cairnError && <p className="text-xs font-bold text-rose-800">{cairnError}</p>}
            </form>
          </div>
        )}
      </div>
    </motion.article>
  );
};
