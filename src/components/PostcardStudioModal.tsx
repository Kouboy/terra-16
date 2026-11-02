import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  canvasToPngBlob,
  PostcardMood,
  renderPostcard16BitToCanvas,
} from '../postcardSketch';
import { playStampSfx } from '../sound';
import {
  BedrockInfo,
  EffectiveTimeOfDay,
  ExplorerAppearance,
  ExplorerProgress,
  PostcardSubject,
  TrophyId,
  WeatherInfo,
} from '../types';
import { getGenderedTrophyTitle, TROPHIES_CATALOG } from '../trophies';
import { PixelCornerRivets, PixelUiIcon } from './PixelIcons';

function getInitialPostcardMood(
  subject: PostcardSubject,
  effectiveTime: EffectiveTimeOfDay,
  weather: WeatherInfo | null
): PostcardMood {
  const isSub =
    (subject.kind === 'poi' && Boolean(subject.entry.nearWaterway === false && /souterrain|carrière|grotte|crypte/i.test(subject.entry.subType))) ||
    (subject.kind === 'encounter' && subject.encounter.isSubterranean) ||
    (subject.kind === 'specimen' && subject.specimen.isSubterranean);
  if (isSub) return 'cavern';
  if (weather?.condition === 'rain' || weather?.condition === 'storm') return 'rain';
  if (effectiveTime === 'night') return 'night';
  if (effectiveTime === 'dusk') return 'dusk';
  return 'day';
}

const MOOD_OPTIONS: Array<{ id: PostcardMood; label: string }> = [
  { id: 'day', label: 'Plein jour' },
  { id: 'dusk', label: 'Crépuscule' },
  { id: 'night', label: 'Nuit étoilée' },
  { id: 'rain', label: 'Averse' },
  { id: 'cavern', label: 'Sous-sol' },
];

export const PostcardStudioModal: React.FC<{
  subject: PostcardSubject | null;
  appearance: ExplorerAppearance;
  progress: ExplorerProgress;
  localityName: string;
  bedrock: BedrockInfo | null;
  altitudeMeters: number | null;
  effectiveTime: EffectiveTimeOfDay;
  weather: WeatherInfo | null;
  muted: boolean;
  unlockedTrophyIds?: ReadonlySet<TrophyId>;
  onPinTrophy?: (trophyId: TrophyId | '') => void;
  onClose: () => void;
}> = ({
  subject,
  appearance,
  progress,
  localityName,
  bedrock,
  altitudeMeters,
  effectiveTime,
  weather,
  muted,
  unlockedTrophyIds,
  onPinTrophy,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mood, setMood] = useState<PostcardMood>('day');
  const [customNote, setCustomNote] = useState('');
  const [selectedTrophyId, setSelectedTrophyId] = useState<TrophyId | ''>(
    progress.pinnedTrophyId || ''
  );
  const [statusMsg, setStatusMsg] = useState('');
  const [animTick, setAnimTick] = useState(0);

  const unlockedTrophies = useMemo(() => {
    if (!unlockedTrophyIds) return [];
    return TROPHIES_CATALOG.filter((t) => unlockedTrophyIds.has(t.id));
  }, [unlockedTrophyIds]);

  useEffect(() => {
    if (!subject) return;
    setMood(getInitialPostcardMood(subject, effectiveTime, weather));
    setCustomNote('');
    setSelectedTrophyId(
      progress.pinnedTrophyId && (!unlockedTrophyIds || unlockedTrophyIds.has(progress.pinnedTrophyId))
        ? progress.pinnedTrophyId
        : ''
    );
    setStatusMsg('');
  }, [subject, effectiveTime, weather, progress.pinnedTrophyId, unlockedTrophyIds]);

  useEffect(() => {
    if (!subject) return;
    const id = window.setInterval(() => {
      setAnimTick((t) => (t + 1) % 120);
    }, 650);
    return () => window.clearInterval(id);
  }, [subject]);

  useEffect(() => {
    if (!subject) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [subject, onClose]);

  useEffect(() => {
    if (!subject || !canvasRef.current) return;
    renderPostcard16BitToCanvas(canvasRef.current, {
      subject,
      appearance,
      progress,
      localityName,
      bedrock,
      altitudeMeters,
      mood,
      customNote,
      animTick,
      overrideTrophyId: selectedTrophyId,
    });
  }, [
    subject,
    appearance,
    progress,
    localityName,
    bedrock,
    altitudeMeters,
    mood,
    customNote,
    animTick,
    selectedTrophyId,
  ]);

  const slugName = useMemo(() => {
    if (!subject) return 'souvenir';
    const raw =
      subject.kind === 'poi'
        ? subject.entry.name
        : subject.kind === 'encounter'
        ? subject.encounter.name
        : subject.specimen.name;
    return (
      raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 38) || 'souvenir'
    );
  }, [subject]);

  const canNativeShare = useMemo(() => {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  }, []);

  if (!subject) return null;

  const flashStatus = (msg: string) => {
    setStatusMsg(msg);
    window.setTimeout(() => setStatusMsg(''), 3400);
  };

  const handleDownloadPng = async () => {
    if (!canvasRef.current) return;
    try {
      const blob = await canvasToPngBlob(canvasRef.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `terra16-carte-postale-${slugName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      playStampSfx(muted);
      flashStatus('Carte postale 16-bit enregistrée (.png) !');
    } catch {
      flashStatus('Impossible d’enregistrer l’image.');
    }
  };

  const handleNativeShare = async () => {
    if (!canvasRef.current || !navigator.share) return;
    try {
      const blob = await canvasToPngBlob(canvasRef.current);
      const file = new File([blob], `terra16-carte-postale-${slugName}.png`, {
        type: 'image/png',
      });
      const navWithCanShare = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      if (navWithCanShare.canShare && !navWithCanShare.canShare({ files: [file] })) {
        await handleDownloadPng();
        return;
      }
      await navigator.share({
        title: `Carte postale Terra 16 — ${localityName}`,
        text: customNote.trim() || `Souvenir d’exploration 16-bit à ${localityName}.`,
        files: [file],
      });
      playStampSfx(muted);
      flashStatus('Carte postale partagée !');
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        await handleDownloadPng();
      }
    }
  };

  const handleCopyClipboard = async () => {
    if (!canvasRef.current) return;
    try {
      const blob = await canvasToPngBlob(canvasRef.current);
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        playStampSfx(muted);
        flashStatus('Vignette copiée dans le presse-papiers !');
      } else {
        await handleDownloadPng();
      }
    } catch {
      await handleDownloadPng();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Atelier de Carte postale 16-bit"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl max-h-[92dvh] overflow-y-auto overscroll-contain grimoire-folio-gold p-4 sm:p-6 space-y-4 my-auto">
        <PixelCornerRivets className="bg-[#d97706]" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b-2 border-[#c89d62] pb-3">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <PixelUiIcon name="postcard" className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-bold font-display text-[#24160c] leading-snug break-words">
                Carnet de croquis & Carte postale 16-bit
              </h2>
              <p className="text-xs text-[#54361d] leading-snug break-words mt-0.5">
                Vignette souvenir avec votre explorateur et le tampon de {localityName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l’atelier de carte postale"
            className="min-h-[40px] px-3 py-1.5 text-xs font-bold bg-[#ecd8b1] hover:bg-[#fffbeb] text-[#24160c] border-2 border-[#2b1a0e] whitespace-nowrap shrink-0"
          >
            Fermer
          </button>
        </div>

        {/* Live 16-Bit Postcard Preview */}
        <div className="bg-[#1b1109] p-2 sm:p-3 border-2 border-[#2b1a0e] flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={960}
            height={600}
            className="w-full h-auto max-h-[54vh] object-contain border border-[#6b4928]"
          />
        </div>

        {/* Customization Controls: Ambiance + Trophy Medallion + Handwritten Dedication */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5 space-y-1.5">
            <div className="text-xs font-bold text-[#24160c]">Lumière & ciel du croquis</div>
            <div className="flex flex-wrap gap-1.5">
              {MOOD_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMood(opt.id)}
                  className={`min-h-[38px] px-2.5 py-1.5 text-xs font-bold border-2 border-[#2b1a0e] whitespace-nowrap shrink-0 ${
                    mood === opt.id
                      ? 'bg-[#28160d] text-amber-300 jrpg-shadow'
                      : 'bg-[#ecd8b1] text-[#3d2512] hover:bg-[#fffbeb]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-3 space-y-1.5">
            <label
              htmlFor="postcard-trophy-select"
              className="block text-xs font-bold text-[#24160c]"
            >
              Médaille & titre gravés
            </label>
            <select
              id="postcard-trophy-select"
              value={selectedTrophyId}
              onChange={(e) => {
                const nextId = e.target.value as TrophyId | '';
                setSelectedTrophyId(nextId);
                if (onPinTrophy) onPinTrophy(nextId);
              }}
              className="w-full min-h-[40px] px-2.5 py-2 text-xs font-bold bg-[#fffbeb] text-[#24160c] border-2 border-[#6b4928] focus:outline-none focus:border-[#991b1b]"
            >
              <option value="">Titre de Guilde (sans médaille)</option>
              {unlockedTrophies.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {getGenderedTrophyTitle(t, progress.gender)}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <label htmlFor="postcard-note-input" className="block text-xs font-bold text-[#24160c]">
              Dédicace manuscrite (optionnelle)
            </label>
            <input
              id="postcard-note-input"
              type="text"
              maxLength={110}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Ex. : Halte au crépuscule…"
              className="w-full min-h-[40px] px-3 py-2 text-xs sm:text-sm bg-[#fffbeb] text-[#24160c] border-2 border-[#6b4928] focus:outline-none focus:border-[#991b1b]"
            />
          </div>
        </div>

        {/* Share / Export Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[#c89d62]">
          <div className="text-xs font-bold text-emerald-900 min-h-[20px]">
            {statusMsg || 'Format 960×600 PNG net · Prêt à partager ou archiver'}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyClipboard}
              className="min-h-[42px] px-3.5 py-2 text-xs font-bold bg-[#ecd8b1] hover:bg-[#fffbeb] text-[#24160c] border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 jrpg-shadow"
            >
              <PixelUiIcon name="scroll" className="w-4 h-4" />
              <span>Copier l’image</span>
            </button>

            {canNativeShare && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="min-h-[42px] px-3.5 py-2 text-xs font-bold bg-[#28160d] hover:bg-[#3f2416] text-amber-300 border-2 border-[#d97706] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 jrpg-shadow"
              >
                <PixelUiIcon name="postcard" className="w-4 h-4" />
                <span>Partager</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadPng}
              className="min-h-[42px] px-4 py-2 text-xs font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 jrpg-shadow"
            >
              <PixelUiIcon name="stamp" className="w-4 h-4" />
              <span>Télécharger PNG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
