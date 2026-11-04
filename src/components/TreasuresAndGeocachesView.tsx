import React, { useEffect, useMemo, useState } from 'react';
import {
  buildGeocacheDocId,
  deleteExplorerGeocacheInCloud,
  deleteGeocacheLogInCloud,
  sanitizeFirestoreId,
  signGeocacheLogbookInCloud,
  subscribeToGeocacheLogs,
  upsertExplorerGeocacheInCloud,
  type ExplorerAuthUser as User,
} from '../supabase';
import { playCapsuleBurySfx, playDetectorPingSfx, playJournalOpenSfx } from '../sound';
import { SPECIMENS_CATALOG, SpecimenPlateCanvas } from '../specimens';
import {
  ARCHIVIST_RELICS_CATALOG,
  CHEST_ARCHETYPE_META,
  computeGeocacheSectorKey,
  getRelicById,
  RelicIconCanvas,
  type WorldArchivistChestNode,
} from '../treasures';
import {
  CATEGORY_META,
  type CollectedSpecimen,
  type ExplorerAppearance,
  type ExplorerGeocacheRecord,
  type GeocacheGiftDomain,
  type GeocacheGiftKind,
  type GeocacheLogRecord,
  type GeocachePlacementMode,
  haversineMeters,
  type OpenedArchivistChestRecord,
  type UnlockedEntry,
} from '../types';
import { ExplorerSpriteCanvas } from './ExplorerAvatarCanvas';
import { ParchmentScrollStrip } from './ParchmentScrollStrip';
import { PixelCornerRivets, PixelUiIcon } from './PixelIcons';

function formatCompassBearingFr(fromLat: number, fromLng: number, toLat: number, toLng: number): string {
  const dLat = toLat - fromLat;
  const cosLat = Math.max(0.2, Math.cos((fromLat * Math.PI) / 180));
  const dLng = (toLng - fromLng) * cosLat;
  const deg = ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;
  const dirs = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest'];
  return dirs[Math.round(deg / 45) % 8];
}

function formatDistanceFr(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// ============================================================================
// 1. COMPACT SIDEBAR & MOBILE DRAWER TELLURIC DETECTOR CARD
// ============================================================================
export const TelluricDetectorCard: React.FC<{
  playerLat: number;
  playerLng: number;
  subterraneanMode: boolean;
  simulationMode: boolean;
  muted: boolean;
  worldChests: WorldArchivistChestNode[];
  openedChestIds: Set<string>;
  nearbyGeocaches: ExplorerGeocacheRecord[];
  foundGeocacheIds: Set<string>;
  unlockedEntries: UnlockedEntry[];
  currentUserId: string | null;
  onOpenArchivistChest: (chest: WorldArchivistChestNode) => void;
  onFocusMapTarget: (lat: number, lng: number, isSubterranean: boolean) => void;
  onOpenBuryModal: () => void;
  onInspectGeocache: (cache: ExplorerGeocacheRecord) => void;
  onOpenReliquaryTab: () => void;
}> = ({
  playerLat,
  playerLng,
  subterraneanMode,
  simulationMode,
  muted,
  worldChests,
  openedChestIds,
  nearbyGeocaches,
  foundGeocacheIds,
  unlockedEntries,
  currentUserId,
  onOpenArchivistChest,
  onFocusMapTarget,
  onOpenBuryModal,
  onInspectGeocache,
  onOpenReliquaryTab,
}) => {
  const [pingFlashId, setPingFlashId] = useState<string | null>(null);

  const sanitizedUid = currentUserId ? sanitizeFirestoreId(currentUserId) : null;

  // Nearest unopened deterministic Archivist Chest on current layer (or fallback to other layer)
  const nearestChestInfo = useMemo(() => {
    const unopenedSameLayer = worldChests
      .filter((c) => c.isSubterranean === subterraneanMode && !openedChestIds.has(c.chestId))
      .map((chest) => ({
        chest,
        dist: haversineMeters(playerLat, playerLng, chest.lat, chest.lng),
      }))
      .sort((a, b) => a.dist - b.dist);

    if (unopenedSameLayer.length > 0) return unopenedSameLayer[0];

    const unopenedOther = worldChests
      .filter((c) => !openedChestIds.has(c.chestId))
      .map((chest) => ({
        chest,
        dist: haversineMeters(playerLat, playerLng, chest.lat, chest.lng),
      }))
      .sort((a, b) => a.dist - b.dist);

    return unopenedOther[0] || null;
  }, [worldChests, subterraneanMode, openedChestIds, playerLat, playerLng]);

  // Explorer Geocaches within ~220 m detector range on active layer
  const detectedCaches = useMemo(() => {
    return nearbyGeocaches
      .filter((c) => Boolean(c.isSubterranean) === Boolean(subterraneanMode))
      .map((cache) => ({
        cache,
        dist: haversineMeters(playerLat, playerLng, cache.lat, cache.lng),
        isOwn: Boolean(sanitizedUid && cache.authorId === sanitizedUid),
        isFound: foundGeocacheIds.has(cache.id),
      }))
      .filter((item) => item.dist <= 220 || item.isOwn)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3);
  }, [nearbyGeocaches, subterraneanMode, playerLat, playerLng, sanitizedUid, foundGeocacheIds]);

  const nearestUnlockedAnchor = useMemo(() => {
    let best: { entry: UnlockedEntry; dist: number } | null = null;
    for (const e of unlockedEntries) {
      const d = haversineMeters(playerLat, playerLng, e.lat, e.lng);
      if (d <= 85 && (!best || d < best.dist)) {
        best = { entry: e, dist: d };
      }
    }
    return best;
  }, [unlockedEntries, playerLat, playerLng]);

  const canBuryHere = !simulationMode || Boolean(nearestUnlockedAnchor);

  const triggerSonarPing = (id: string, distMeters: number) => {
    const strength01 = Math.max(0.1, Math.min(1, 1 - distMeters / 220));
    playDetectorPingSfx(muted, strength01);
    setPingFlashId(id);
    window.setTimeout(() => {
      setPingFlashId((curr) => (curr === id ? null : curr));
    }, 650);
  };

  return (
    <div className="p-3 rpg-parchment border-2 border-[#2b1d12] space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-pixel text-[8px] text-[#7c2d12] uppercase flex items-center gap-1.5">
          <PixelUiIcon name="chest" className="w-3.5 h-3.5 shrink-0" /> Détecteur &amp; Caches
        </span>
        <button
          type="button"
          onClick={() => {
            playJournalOpenSfx(muted);
            onOpenReliquaryTab();
          }}
          className="text-[11px] font-bold text-[#78350f] hover:text-[#1c1209] underline underline-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          Reliquaire ({openedChestIds.size})
        </button>
      </div>

      {/* 1. Nearest Deterministic World Archivist Chest */}
      {nearestChestInfo ? (
        <div className="p-2 bg-[#f5e7c6] border-2 border-[#b45309]/50 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-[#2b1d12] truncate">
                {nearestChestInfo.chest.title}
              </div>
              <div className="text-[11px] text-[#5c3a21] tabular-nums">
                {CHEST_ARCHETYPE_META[nearestChestInfo.chest.archetype].shortFr} ·{' '}
                {formatDistanceFr(nearestChestInfo.dist)} ·{' '}
                {formatCompassBearingFr(
                  playerLat,
                  playerLng,
                  nearestChestInfo.chest.lat,
                  nearestChestInfo.chest.lng
                )}
                {nearestChestInfo.chest.isSubterranean !== subterraneanMode
                  ? nearestChestInfo.chest.isSubterranean
                    ? ' · Sous-sol'
                    : ' · Surface'
                  : ''}
              </div>
            </div>

            {nearestChestInfo.chest.isSubterranean === subterraneanMode &&
            (nearestChestInfo.dist <= 95 || !simulationMode) ? (
              <button
                type="button"
                onClick={() => onOpenArchivistChest(nearestChestInfo.chest)}
                className="px-2 py-1 text-[11px] font-bold rpg-gold-btn whitespace-nowrap shrink-0 cursor-pointer"
              >
                Ouvrir
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  playJournalOpenSfx(muted);
                  onFocusMapTarget(
                    nearestChestInfo.chest.lat,
                    nearestChestInfo.chest.lng,
                    nearestChestInfo.chest.isSubterranean
                  );
                }}
                className="px-2 py-1 text-[11px] font-bold bg-[#ead5ac] hover:bg-[#dfc38d] text-[#2b1d12] border border-[#2b1d12] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Repérer
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-[#5c3a21] italic">
          Tous les coffres d’Archiviste de ce secteur ont été ouverts. Déplacez-vous pour sonder un nouveau relief.
        </p>
      )}

      {/* 2. Nearby Player Geocaches (< 220m Telluric Signal) */}
      {detectedCaches.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-[#14532d] tabular-nums">
            Signal Géocache ({detectedCaches.length} à proximité)
          </div>
          {detectedCaches.map(({ cache, dist, isOwn, isFound }) => {
            const bars = dist <= 38 ? 4 : dist <= 85 ? 3 : dist <= 150 ? 2 : 1;
            const canInspect = isOwn || isFound || dist <= 45;
            const bearing = formatCompassBearingFr(playerLat, playerLng, cache.lat, cache.lng);
            return (
              <div
                key={cache.id}
                className={`p-2 border-2 transition-colors space-y-1 ${
                  pingFlashId === cache.id
                    ? 'bg-[#dcfce7] border-[#059669]'
                    : 'bg-[#f8edd6] border-[#78350f]/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-1.5">
                    <PixelUiIcon name="capsule" className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px] font-bold text-[#1c1209] truncate">
                      {cache.title}
                    </span>
                  </div>
                  <div
                    className="flex items-end gap-0.5 shrink-0 h-3"
                    title={`Intensité du signal : ${bars}/4`}
                  >
                    {[1, 2, 3, 4].map((lvl) => (
                      <span
                        key={lvl}
                        className={`w-1 ${
                          lvl === 1
                            ? 'h-1.5'
                            : lvl === 2
                            ? 'h-2'
                            : lvl === 3
                            ? 'h-2.5'
                            : 'h-3'
                        } ${lvl <= bars ? 'bg-[#059669]' : 'bg-[#cbb692]'}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="text-[11px] text-[#5c3a21] tabular-nums">
                  Par {cache.authorCallsign} · {formatDistanceFr(dist)} · {bearing}
                  {isFound ? ' · Signée' : isOwn ? ' · Votre capsule' : ''}
                </div>

                <p className="text-[11px] text-[#3b2614] italic line-clamp-2">
                  « {cache.riddleHint} »
                </p>

                <div className="flex items-center justify-between gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => triggerSonarPing(cache.id, dist)}
                    className="px-2 py-0.5 text-[11px] font-bold bg-[#ead5ac] hover:bg-[#dfc38d] text-[#2b1d12] border border-[#2b1d12] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Sonder
                  </button>

                  {canInspect ? (
                    <button
                      type="button"
                      onClick={() => {
                        playJournalOpenSfx(muted);
                        onInspectGeocache(cache);
                      }}
                      className="px-2 py-0.5 text-[11px] font-bold bg-[#15803d] hover:bg-[#166534] text-[#fefce8] border border-[#140b05] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Ouvrir la capsule
                    </button>
                  ) : (
                    <span className="text-[10px] text-[#78350f] tabular-nums">
                      Approchez à &lt; 40 m
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-[11px] text-[#5c3a21]">
          Aucune capsule d’explorateur captée dans un rayon de 200 m. Soyez le premier à en dissimuler une ici !
        </div>
      )}

      {/* 3. Bury Capsule CTA */}
      <div className="pt-1 border-t border-[#78350f]/25 flex items-center justify-between gap-2">
        <span className="text-[10px] text-[#5c3a21] leading-tight">
          {!simulationMode
            ? 'Position GPS réelle active : dépôt autorisé'
            : nearestUnlockedAnchor
            ? `Ancrage : ${nearestUnlockedAnchor.entry.name}`
            : 'Approchez d’un lieu débloqué (< 85 m) ou activez le GPS'}
        </span>
        <button
          type="button"
          onClick={() => {
            playJournalOpenSfx(muted);
            onOpenBuryModal();
          }}
          className={`px-2.5 py-1 text-[11px] font-bold border-2 border-[#140b05] whitespace-nowrap shrink-0 cursor-pointer ${
            canBuryHere
              ? 'bg-[#047857] hover:bg-[#065f46] text-[#fefce8]'
              : 'bg-[#ead5ac] hover:bg-[#dfc38d] text-[#2b1d12]'
          }`}
        >
          Enterrer une capsule
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 2. GEOCACHE MODAL (BURY A CAPSULE OR INSPECT & SIGN LOGBOOK)
// ============================================================================
export const GeocacheModal: React.FC<{
  mode: 'bury' | 'inspect';
  cache?: ExplorerGeocacheRecord | null;
  playerLat: number;
  playerLng: number;
  subterraneanMode: boolean;
  simulationMode: boolean;
  currentRegionLabel: string;
  muted: boolean;
  currentUser: User | null;
  cloudOnline: boolean;
  explorerCallsign: string;
  explorerAppearance: ExplorerAppearance;
  openedChests: OpenedArchivistChestRecord[];
  specimens: CollectedSpecimen[];
  unlockedEntries: UnlockedEntry[];
  foundGeocacheIds: Set<string>;
  onClose: () => void;
  onRequestGoogleSignIn: () => void;
  onFocusMapTarget: (lat: number, lng: number, isSubterranean: boolean) => void;
  onClaimGeocacheDiscovery: (cache: ExplorerGeocacheRecord) => void;
  onLocalCacheUpserted: (cache: ExplorerGeocacheRecord) => void;
  onLocalCacheDeleted: (cacheId: string) => void;
}> = ({
  mode,
  cache,
  playerLat,
  playerLng,
  subterraneanMode,
  simulationMode,
  currentRegionLabel,
  muted,
  currentUser,
  cloudOnline,
  explorerCallsign,
  explorerAppearance,
  openedChests,
  specimens,
  unlockedEntries,
  foundGeocacheIds,
  onClose,
  onRequestGoogleSignIn,
  onFocusMapTarget,
  onClaimGeocacheDiscovery,
  onLocalCacheUpserted,
  onLocalCacheDeleted,
}) => {
  // --- BURY FORM STATE ---
  const [title, setTitle] = useState('');
  const [riddleHint, setRiddleHint] = useState('');
  const [giftSourceTab, setGiftSourceTab] = useState<'relic' | 'specimen'>('relic');
  const [selectedGiftId, setSelectedGiftId] = useState<string>('token_guilde_arpenteur');
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- INSPECT / LOGBOOK STATE ---
  const [logs, setLogs] = useState<GeocacheLogRecord[]>([]);
  const [logNote, setLogNote] = useState('');
  const [logBusy, setLogBusy] = useState(false);

  const sanitizedUid = currentUser ? sanitizeFirestoreId(currentUser.uid) : null;

  // Unlocked relics + 3 Guild starter tokens so every player can enclose a 16-bit souvenir
  const availableRelics = useMemo(() => {
    const ownedRelicIds = new Set(openedChests.map((c) => c.relicId));
    return ARCHIVIST_RELICS_CATALOG.filter((r) => r.isStarterToken || ownedRelicIds.has(r.id));
  }, [openedChests]);

  useEffect(() => {
    if (giftSourceTab === 'relic') {
      if (!availableRelics.some((r) => r.id === selectedGiftId) && availableRelics.length > 0) {
        setSelectedGiftId(availableRelics[0].id);
      }
    } else if (giftSourceTab === 'specimen') {
      if (!specimens.some((s) => s.specimenId === selectedGiftId) && specimens.length > 0) {
        setSelectedGiftId(specimens[0].specimenId);
      }
    }
  }, [giftSourceTab, availableRelics, specimens, selectedGiftId]);

  // Nearest unlocked POI within 85 m (for unlocked_poi placement mode)
  const anchorCandidate = useMemo(() => {
    let best: { entry: UnlockedEntry; dist: number } | null = null;
    for (const e of unlockedEntries) {
      const d = haversineMeters(playerLat, playerLng, e.lat, e.lng);
      if (d <= 85 && (!best || d < best.dist)) {
        best = { entry: e, dist: d };
      }
    }
    return best;
  }, [unlockedEntries, playerLat, playerLng]);

  const placementMode: GeocachePlacementMode | null = !simulationMode
    ? 'gps_live'
    : anchorCandidate
    ? 'unlocked_poi'
    : null;

  // Subscribe to discoverer logbook when inspecting a public geocache
  useEffect(() => {
    if (mode !== 'inspect' || !cache || !currentUser || !cloudOnline) {
      setLogs([]);
      return;
    }
    if (cache.id.startsWith('local_')) {
      setLogs([]);
      return;
    }
    const unsub = subscribeToGeocacheLogs(cache.id, (list) => {
      setLogs(list);
      if (sanitizedUid) {
        const mine = list.find((l) => l.finderId === sanitizedUid);
        if (mine) {
          setLogNote((prev) => (prev.trim().length === 0 ? mine.note : prev));
        }
      }
    });
    return () => unsub();
  }, [mode, cache, currentUser, cloudOnline, sanitizedUid]);

  const handleBurySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);

    if (!placementMode) {
      setErrorMsg(
        'En Marche Simulée, approchez à moins de 85 m d’un lieu déjà débloqué (ou passez en GPS Réel) pour enterrer une capsule.'
      );
      return;
    }

    const cleanTitle = title.trim();
    const cleanRiddle = riddleHint.trim();
    if (cleanTitle.length < 3) {
      setErrorMsg('Donnez un nom d’au moins 3 caractères à votre capsule.');
      return;
    }
    if (cleanRiddle.length < 5) {
      setErrorMsg('Rédigez un indice ou une énigme d’au moins 5 caractères pour guider les éclaireurs.');
      return;
    }

    let giftKind: GeocacheGiftKind = 'relic';
    let giftId = 'token_guilde_arpenteur';
    let giftName = 'Jeton d’Arpenteur en Laiton';
    let giftDomain: GeocacheGiftDomain = 'relique';
    let specimenToSync: CollectedSpecimen | null = null;

    if (giftSourceTab === 'specimen') {
      const sp = specimens.find((s) => s.specimenId === selectedGiftId);
      if (!sp) {
        setErrorMsg('Sélectionnez un spécimen récolté ou basculez sur une relique.');
        return;
      }
      giftKind = 'specimen';
      giftId = sp.specimenId;
      giftName = sp.name;
      giftDomain = sp.domain === 'geologie' ? 'geologie' : 'botanique';
      specimenToSync = sp;
    } else {
      const rel = getRelicById(selectedGiftId);
      giftKind = 'relic';
      giftId = rel.id;
      giftName = rel.name;
      giftDomain = 'relique';
    }

    const qLat = Math.round(playerLat * 100000) / 100000;
    const qLng = Math.round(playerLng * 100000) / 100000;
    const sectorKey = computeGeocacheSectorKey(qLat, qLng);

    setBusy(true);
    try {
      if (currentUser && cloudOnline) {
        const cloudId = await upsertExplorerGeocacheInCloud({
          uidRaw: currentUser.uid,
          authorCallsign: explorerCallsign || 'Éclaireur',
          authorAppearance: explorerAppearance,
          sectorKey,
          placementMode,
          anchorEntry: placementMode === 'unlocked_poi' ? anchorCandidate?.entry || null : null,
          lat: qLat,
          lng: qLng,
          isSubterranean: subterraneanMode,
          regionLabel: currentRegionLabel || 'Secteur local',
          title: cleanTitle,
          riddleHint: cleanRiddle,
          giftKind,
          giftId,
          giftName,
          giftDomain,
          specimenToSync,
        });

        onLocalCacheUpserted({
          id: cloudId,
          authorId: sanitizeFirestoreId(currentUser.uid),
          authorCallsign: explorerCallsign || 'Éclaireur',
          authorGender: explorerAppearance.gender,
          authorAvatarPreset: explorerAppearance.avatarPreset,
          authorSkinTone: explorerAppearance.skinTone,
          authorHeadgearId: explorerAppearance.headgearId,
          authorOutfitId: explorerAppearance.outfitId,
          sectorKey,
          placementMode,
          anchorPoiId:
            placementMode === 'unlocked_poi' && anchorCandidate
              ? anchorCandidate.entry.poiId
              : undefined,
          lat: qLat,
          lng: qLng,
          isSubterranean: subterraneanMode,
          regionLabel: currentRegionLabel || 'Secteur local',
          title: cleanTitle,
          riddleHint: cleanRiddle,
          giftKind,
          giftId,
          giftName,
          giftDomain,
          createdAtIso: new Date().toISOString(),
        });
        playCapsuleBurySfx(muted);
        onClose();
      } else {
        const fallbackUid = currentUser ? currentUser.uid : 'local_explorer';
        const localId = `local_${buildGeocacheDocId(fallbackUid, qLat, qLng)}`;
        onLocalCacheUpserted({
          id: localId,
          authorId: sanitizeFirestoreId(fallbackUid),
          authorCallsign: explorerCallsign || 'Éclaireur',
          authorGender: explorerAppearance.gender,
          authorAvatarPreset: explorerAppearance.avatarPreset,
          authorSkinTone: explorerAppearance.skinTone,
          authorHeadgearId: explorerAppearance.headgearId,
          authorOutfitId: explorerAppearance.outfitId,
          sectorKey,
          placementMode,
          anchorPoiId:
            placementMode === 'unlocked_poi' && anchorCandidate
              ? anchorCandidate.entry.poiId
              : undefined,
          lat: qLat,
          lng: qLng,
          isSubterranean: subterraneanMode,
          regionLabel: currentRegionLabel || 'Secteur local',
          title: cleanTitle,
          riddleHint: cleanRiddle,
          giftKind,
          giftId,
          giftName,
          giftDomain,
          createdAtIso: new Date().toISOString(),
        });
        playCapsuleBurySfx(muted);
        onClose();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(
        msg.includes('CLOUD_OFFLINE')
          ? 'Connexion nuage indisponible : réessayez dans un instant.'
          : 'Impossible de sceller cette capsule pour le moment. Vérifiez vos champs et réessayez.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSignLogbook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cache || !currentUser || !cloudOnline) return;
    const cleanNote = logNote.trim();
    if (cleanNote.length < 3) {
      setErrorMsg('Écrivez un mot d’au moins 3 caractères dans le registre.');
      return;
    }
    setLogBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await signGeocacheLogbookInCloud({
        uidRaw: currentUser.uid,
        cacheIdRaw: cache.id,
        finderCallsign: explorerCallsign || 'Explorateur',
        finderAppearance: explorerAppearance,
        note: cleanNote,
      });
      onClaimGeocacheDiscovery(cache);
      setStatusMsg('Signature gravée dans le registre des découvreurs !');
    } catch {
      setErrorMsg('Impossible d’enregistrer la signature dans le registre nuage.');
    } finally {
      setLogBusy(false);
    }
  };

  const handleDeleteOwnCache = async () => {
    if (!cache) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      if (!cache.id.startsWith('local_') && currentUser && cloudOnline) {
        await deleteExplorerGeocacheInCloud(currentUser.uid, cache.id);
      }
      onLocalCacheDeleted(cache.id);
      onClose();
    } catch {
      setErrorMsg('Impossible de retirer cette capsule pour le moment.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteOwnLog = async () => {
    if (!cache || !currentUser || !cloudOnline) return;
    setLogBusy(true);
    setErrorMsg(null);
    try {
      await deleteGeocacheLogInCloud(currentUser.uid, cache.id);
      setLogNote('');
      setStatusMsg('Votre note a été effacée du registre.');
    } catch {
      setErrorMsg('Impossible d’effacer cette signature.');
    } finally {
      setLogBusy(false);
    }
  };

  const inspectSpecMeta = useMemo(() => {
    if (!cache || cache.giftKind !== 'specimen') return null;
    return SPECIMENS_CATALOG.find((s) => s.id === cache.giftId) || SPECIMENS_CATALOG[0];
  }, [cache]);

  const isOwnCache = Boolean(
    cache &&
      ((sanitizedUid && cache.authorId === sanitizedUid) || cache.id.startsWith('local_'))
  );
  const isAlreadyClaimed = Boolean(cache && foundGeocacheIds.has(cache.id));
  const myExistingLog = useMemo(
    () => (sanitizedUid ? logs.find((l) => l.finderId === sanitizedUid) || null : null),
    [logs, sanitizedUid]
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl rpg-parchment border-4 border-[#140b05] shadow-[8px_8px_0_#140b05] p-4 sm:p-5 max-h-[90dvh] overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <PixelCornerRivets />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b-2 border-[#78350f]/40 pb-3">
          <div className="min-w-0 flex-1">
            <div className="font-pixel text-[10px] text-[#7c2d12] uppercase flex items-center gap-2">
              <PixelUiIcon name="capsule" className="w-4 h-4 shrink-0" />
              <span className="break-words">
                {mode === 'bury' ? 'Enterrer une Capsule 16-bit' : 'Capsule d’Explorateur'}
              </span>
            </div>
            <p className="text-xs text-[#5c3a21] mt-1 tabular-nums break-words">
              {mode === 'bury'
                ? `${currentRegionLabel || 'Secteur local'} · ${playerLat.toFixed(4)}°N, ${playerLng.toFixed(4)}°E · ${
                    subterraneanMode ? 'Strate souterraine' : 'Surface'
                  }`
                : cache
                ? `${cache.regionLabel} · Déposée par ${cache.authorCallsign}`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] px-2.5 py-1 text-xs font-bold bg-[#ead5ac] hover:bg-[#dfc38d] text-[#2b1d12] border-2 border-[#140b05] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Fermer
          </button>
        </div>

        {errorMsg && (
          <div className="p-2.5 bg-[#fee2e2] border-2 border-[#991b1b] text-xs font-bold text-[#7f1d1d]">
            {errorMsg}
          </div>
        )}
        {statusMsg && (
          <div className="p-2.5 bg-[#dcfce7] border-2 border-[#166534] text-xs font-bold text-[#14532d]">
            {statusMsg}
          </div>
        )}

        {mode === 'bury' ? (
          <form onSubmit={handleBurySubmit} className="space-y-3.5">
            {/* Placement verification status */}
            <div className="p-3 bg-[#f5e7c6] border-2 border-[#78350f]/50 space-y-1.5">
              <div className="text-xs font-bold text-[#2b1d12]">
                 Ancrage Géographique Vérifié
              </div>
              {placementMode === 'gps_live' ? (
                <p className="text-xs text-[#14532d]">
                  Position GPS réelle active : votre capsule sera enterrée exactement sous vos pas et captable à 200 m au détecteur par les autres explorateurs.
                </p>
              ) : placementMode === 'unlocked_poi' && anchorCandidate ? (
                <p className="text-xs text-[#14532d]">
                  Ancrée à proximité du lieu débloqué « {anchorCandidate.entry.name} » ({Math.round(anchorCandidate.dist)} m).
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-[#7c2d12]">
                    En Marche Simulée, vous devez vous tenir à moins de 85 m d’un lieu déjà débloqué dans votre Carnet (ou activer le GPS réel) pour garantir l’authenticité du dépôt.
                  </p>
                  {unlockedEntries.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {unlockedEntries.slice(0, 3).map((e) => (
                        <button
                          key={e.poiId}
                          type="button"
                          onClick={() => {
                            onFocusMapTarget(e.lat, e.lng, subterraneanMode);
                            onClose();
                          }}
                          className="px-2 py-1 text-[11px] font-bold bg-[#ead5ac] hover:bg-[#dfc38d] text-[#2b1d12] border border-[#2b1d12] whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Aller vers {e.name.slice(0, 26)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {!currentUser && (
              <div className="p-2.5 bg-[#fef3c7] border-2 border-[#b45309] flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-[#78350f] flex-1 min-w-[200px] break-words">
                  Connectez-vous pour publier votre capsule dans le monde partagé Firestore (sinon elle sera gardée sur cet appareil).
                </span>
                <button
                  type="button"
                  onClick={onRequestGoogleSignIn}
                  className="min-h-[38px] px-2.5 py-1 text-xs font-bold rpg-gold-btn whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Connexion Google
                </button>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#2b1d12]">
                Nom de la capsule (3 à 100 caractères)
              </label>
              <input
                type="text"
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex. Capsule du Vieux Chêne Creux"
                className="w-full px-3 py-2 text-sm bg-[#fcf6e8] border-2 border-[#2b1d12] text-[#1c1209] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#2b1d12]">
                Indice ou énigme pour le détecteur (5 à 320 caractères)
              </label>
              <textarea
                rows={3}
                maxLength={320}
                value={riddleHint}
                onChange={(e) => setRiddleHint(e.target.value)}
                placeholder="Ex. Là où le sentier bifurque vers le ruisseau, cherchez au pied du muret de pierre sèche côté mousse..."
                className="w-full px-3 py-2 text-sm bg-[#fcf6e8] border-2 border-[#2b1d12] text-[#1c1209] focus:outline-none"
              />
              <div className="text-[11px] text-[#5c3a21] text-right tabular-nums">
                {riddleHint.trim().length} / 320
              </div>
            </div>

            {/* Enclosed Souvenir Picker */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#2b1d12]">
                  Objet scellé dans la capsule
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setGiftSourceTab('relic')}
                    className={`min-h-[36px] px-2.5 py-1 text-xs font-bold border border-[#140b05] whitespace-nowrap shrink-0 cursor-pointer ${
                      giftSourceTab === 'relic'
                        ? 'bg-[#b45309] text-[#fefce8]'
                        : 'bg-[#ead5ac] text-[#2b1d12]'
                    }`}
                  >
                    Reliques &amp; Jetons ({availableRelics.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGiftSourceTab('specimen')}
                    disabled={specimens.length === 0}
                    className={`min-h-[36px] px-2.5 py-1 text-xs font-bold border border-[#140b05] whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 ${
                      giftSourceTab === 'specimen'
                        ? 'bg-[#15803d] text-[#fefce8]'
                        : 'bg-[#ead5ac] text-[#2b1d12]'
                    }`}
                  >
                    Herbier &amp; Minéraux ({specimens.length})
                  </button>
                </div>
              </div>

              {giftSourceTab === 'relic' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1 bg-[#f5e7c6] border-2 border-[#78350f]/40">
                  {availableRelics.map((rel) => {
                    const active = selectedGiftId === rel.id;
                    return (
                      <button
                        key={rel.id}
                        type="button"
                        onClick={() => setSelectedGiftId(rel.id)}
                        className={`flex items-center gap-2.5 p-2 text-left border-2 transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#fef3c7] border-[#b45309]'
                            : 'bg-[#fcf6e8] border-transparent hover:border-[#78350f]/40'
                        }`}
                      >
                        <RelicIconCanvas relicId={rel.id} size={36} />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#1c1209] truncate">
                            {rel.name}
                          </div>
                          <div className="text-[11px] text-[#5c3a21] truncate">
                            {rel.isStarterToken ? 'Jeton de Guilde' : 'Relique d’Archiviste'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1 bg-[#f5e7c6] border-2 border-[#78350f]/40">
                  {specimens.map((sp) => {
                    const active = selectedGiftId === sp.specimenId;
                    return (
                      <button
                        key={sp.specimenId}
                        type="button"
                        onClick={() => setSelectedGiftId(sp.specimenId)}
                        className={`flex items-center gap-2.5 p-2 text-left border-2 transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#dcfce7] border-[#15803d]'
                            : 'bg-[#fcf6e8] border-transparent hover:border-[#78350f]/40'
                        }`}
                      >
                        <SpecimenPlateCanvas
                          specimenId={sp.specimenId}
                          affinity={sp.affinity}
                          isSubterranean={sp.isSubterranean}
                          className="w-9 h-9"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#1c1209] truncate">{sp.name}</div>
                          <div className="text-[11px] text-[#5c3a21] truncate tabular-nums">
                            {sp.domain === 'geologie' ? 'Minéral' : 'Herbier'} · ×{sp.harvestCount}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#78350f]/30">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-bold bg-[#ead5ac] hover:bg-[#dfc38d] text-[#2b1d12] border-2 border-[#140b05] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={busy || !placementMode}
                className="px-4 py-1.5 text-xs font-bold bg-[#047857] hover:bg-[#065f46] text-[#fefce8] border-2 border-[#140b05] whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
              >
                {busy ? 'Scellement…' : 'Enterrer la capsule ici'}
              </button>
            </div>
          </form>
        ) : cache ? (
          <div className="space-y-4">
            {/* Capsule Identity & Author Portrait */}
            <div className="p-3 bg-[#f5e7c6] border-2 border-[#78350f]/50 flex items-start gap-3">
              <ExplorerSpriteCanvas
                appearance={{
                  gender: cache.authorGender || 'masculin',
                  avatarPreset: cache.authorAvatarPreset || 'eclaireur',
                  skinTone: cache.authorSkinTone || 'hale',
                  headgearId: cache.authorHeadgearId || 'tricorne_fauve',
                  outfitId: cache.authorOutfitId || 'arpenteur',
                  toolId: 'boussole_astrale',
                  packId: 'besace_cuir',
                }}
                pixelScale={3}
                animated={false}
                className="border-2 border-[#2b1d12] bg-[#ead5ac] shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-base font-bold text-[#1c1209] break-words">{cache.title}</h3>
                <div className="text-xs text-[#5c3a21] tabular-nums break-words">
                  Cachée par <strong className="text-[#2b1d12]">{cache.authorCallsign}</strong> ·{' '}
                  {cache.isSubterranean ? 'Sous-sol' : 'Surface'} · {cache.lat.toFixed(4)}°N,{' '}
                  {cache.lng.toFixed(4)}°E
                </div>
                <p className="text-xs text-[#2b1d12] italic pt-1 break-words">« {cache.riddleHint} »</p>
              </div>
            </div>

            {/* Enclosed Souvenir Showcase + Discovery Claim */}
            <div className="p-3 bg-[#fcf6e8] border-2 border-[#b45309] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {cache.giftKind === 'specimen' && inspectSpecMeta ? (
                  <SpecimenPlateCanvas
                    specimenId={inspectSpecMeta.id}
                    affinity={inspectSpecMeta.affinity || 'calcaire'}
                    isSubterranean={cache.isSubterranean}
                    className="w-12 h-12"
                  />
                ) : (
                  <RelicIconCanvas relicId={cache.giftId} size={48} />
                )}
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-[#7c2d12] uppercase">
                    Trésor contenu dans la capsule
                  </div>
                  <div className="text-sm font-bold text-[#1c1209] truncate">{cache.giftName}</div>
                  <div className="text-xs text-[#5c3a21]">
                    {cache.giftDomain === 'botanique'
                      ? 'Double d’herbier naturaliste'
                      : cache.giftDomain === 'geologie'
                      ? 'Échantillon minéralogique'
                      : 'Relique & Jeton de la Guilde'}
                  </div>
                </div>
              </div>

              {!isOwnCache && (
                <button
                  type="button"
                  disabled={isAlreadyClaimed}
                  onClick={() => onClaimGeocacheDiscovery(cache)}
                  className={`px-3 py-1.5 text-xs font-bold border-2 border-[#140b05] whitespace-nowrap shrink-0 cursor-pointer ${
                    isAlreadyClaimed
                      ? 'bg-[#dcfce7] text-[#14532d] cursor-default'
                      : 'rpg-gold-btn'
                  }`}
                >
                  {isAlreadyClaimed ? 'Découverte validée (+90 XP)' : 'Valider la découverte (+90 XP)'}
                </button>
              )}
            </div>

            {/* Discoverers Logbook */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-pixel text-[9px] text-[#7c2d12] uppercase">
                  Registre des Découvreurs ({logs.length})
                </h4>
                {isOwnCache && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleDeleteOwnCache}
                    className="min-h-[34px] px-2.5 py-1 text-[11px] font-bold bg-[#fee2e2] hover:bg-[#fecaca] text-[#7f1d1d] border border-[#7f1d1d] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Retirer ma capsule
                  </button>
                )}
              </div>

              {currentUser && cloudOnline && !cache.id.startsWith('local_') ? (
                <form onSubmit={handleSignLogbook} className="space-y-2">
                  <textarea
                    rows={2}
                    maxLength={240}
                    value={logNote}
                    onChange={(e) => setLogNote(e.target.value)}
                    placeholder="Signez le carnet de cette capsule (ex. Trouvée sous la pluie près du vieux frêne, salutations !)"
                    className="w-full px-3 py-2 text-xs bg-[#fcf6e8] border-2 border-[#2b1d12] text-[#1c1209] focus:outline-none"
                  />
                  <div className="flex items-center justify-between gap-2">
                    {myExistingLog ? (
                      <button
                        type="button"
                        disabled={logBusy}
                        onClick={handleDeleteOwnLog}
                        className="text-xs font-bold text-[#991b1b] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Effacer ma signature
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#5c3a21]">
                        Une signature publique par explorateur
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={logBusy}
                      className="px-3 py-1 text-xs font-bold bg-[#15803d] hover:bg-[#166534] text-[#fefce8] border-2 border-[#140b05] whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
                    >
                      {myExistingLog ? 'Mettre à jour ma note' : 'Signer le registre'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-2.5 bg-[#f5e7c6] border border-[#78350f]/40 flex items-center justify-between gap-2">
                  <span className="text-xs text-[#5c3a21]">
                    {cache.id.startsWith('local_')
                      ? 'Capsule locale : connectez-vous à Google avant le dépôt pour ouvrir un registre partagé.'
                      : 'Connectez-vous pour lire et signer le registre partagé des découvreurs.'}
                  </span>
                  {!currentUser && (
                    <button
                      type="button"
                      onClick={onRequestGoogleSignIn}
                      className="px-2.5 py-1 text-xs font-bold rpg-gold-btn whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Connexion
                    </button>
                  )}
                </div>
              )}

              {logs.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {logs.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-2 bg-[#fcf6e8] border border-[#78350f]/40 flex items-start gap-2.5"
                    >
                      <ExplorerSpriteCanvas
                        appearance={{
                          gender: entry.finderGender || 'masculin',
                          avatarPreset: entry.finderAvatarPreset || 'cartographe',
                          skinTone: entry.finderSkinTone || 'hale',
                          headgearId: entry.finderHeadgearId || 'tricorne_fauve',
                          outfitId: entry.finderOutfitId || 'arpenteur',
                          toolId: 'lanterne_laiton',
                          packId: 'besace_cuir',
                        }}
                        pixelScale={2}
                        animated={false}
                        className="border border-[#2b1d12] bg-[#ead5ac] shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[#1c1209] tabular-nums">
                          {entry.finderCallsign} ·{' '}
                          <span className="font-normal text-[#5c3a21]">
                            {new Date(entry.foundAtIso).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                        <p className="text-xs text-[#3b2614] mt-0.5">{entry.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ============================================================================
// 3. CARNET SUB-TAB: RELIQUAIRE D'ARCHIVISTE & GEOCACHING 16-BIT
// ============================================================================
export const TreasuresAndGeocachesView: React.FC<{
  openedChests: OpenedArchivistChestRecord[];
  worldChests: WorldArchivistChestNode[];
  nearbyGeocaches: ExplorerGeocacheRecord[];
  foundGeocacheIds: Set<string>;
  playerLat: number;
  playerLng: number;
  simulationMode: boolean;
  muted: boolean;
  currentUserId: string | null;
  onFocusLocationOnMap: (lat: number, lng: number, isSubterranean: boolean) => void;
  onOpenArchivistChest: (chest: WorldArchivistChestNode) => void;
  onOpenBuryModal: () => void;
  onInspectGeocache: (cache: ExplorerGeocacheRecord) => void;
}> = ({
  openedChests,
  worldChests,
  nearbyGeocaches,
  foundGeocacheIds,
  playerLat,
  playerLng,
  simulationMode,
  muted,
  currentUserId,
  onFocusLocationOnMap,
  onOpenArchivistChest,
  onOpenBuryModal,
  onInspectGeocache,
}) => {
  const [subSection, setSubSection] = useState<'all' | 'archivist' | 'geocaches'>('all');
  const [selectedRelicId, setSelectedRelicId] = useState<string>(ARCHIVIST_RELICS_CATALOG[0].id);

  const sanitizedUid = currentUserId ? sanitizeFirestoreId(currentUserId) : null;

  const relicCountById = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ch of openedChests) {
      counts.set(ch.relicId, (counts.get(ch.relicId) || 0) + 1);
    }
    return counts;
  }, [openedChests]);

  const openedChestIdSet = useMemo(
    () => new Set(openedChests.map((c) => c.chestId)),
    [openedChests]
  );

  const selectedRelic = useMemo(() => getRelicById(selectedRelicId), [selectedRelicId]);
  const selectedRelicOwned =
    Boolean(selectedRelic.isStarterToken) || (relicCountById.get(selectedRelic.id) || 0) > 0;

  const uniqueRelicsUnlockedCount = useMemo(
    () =>
      ARCHIVIST_RELICS_CATALOG.filter(
        (r) => !r.isStarterToken && (relicCountById.get(r.id) || 0) > 0
      ).length,
    [relicCountById]
  );

  const totalArchivistCatalogCount = useMemo(
    () => ARCHIVIST_RELICS_CATALOG.filter((r) => !r.isStarterToken).length,
    []
  );

  const sortedGeocaches = useMemo(() => {
    return nearbyGeocaches
      .map((cache) => ({
        cache,
        dist: haversineMeters(playerLat, playerLng, cache.lat, cache.lng),
        isOwn:
          Boolean(sanitizedUid && cache.authorId === sanitizedUid) ||
          cache.id.startsWith('local_'),
        isFound: foundGeocacheIds.has(cache.id),
      }))
      .sort((a, b) => a.dist - b.dist);
  }, [nearbyGeocaches, playerLat, playerLng, sanitizedUid, foundGeocacheIds]);

  return (
    <div className="space-y-5">
      {/* Top Filter & Summary Bar */}
      <div className="relative p-4 rpg-parchment border-2 border-[#2b1d12] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PixelCornerRivets />
        <div>
          <h3 className="font-pixel text-[10px] text-[#7c2d12] uppercase flex items-center gap-2">
            <PixelUiIcon name="chest" className="w-4 h-4 shrink-0" /> Trésors d’Archiviste &amp; Géocaches 16-bit
          </h3>
          <p className="text-xs text-[#5c3a21] mt-1 tabular-nums">
            {openedChests.length} coffre{openedChests.length > 1 ? 's' : ''} du monde ouvert
            {openedChests.length > 1 ? 's' : ''} · {uniqueRelicsUnlockedCount}/
            {totalArchivistCatalogCount} reliques d’Archiviste · {sortedGeocaches.length} capsule
            {sortedGeocaches.length > 1 ? 's' : ''} dans le secteur
          </p>
        </div>

        <ParchmentScrollStrip className="flex items-center gap-1.5">
          {[
            { id: 'all' as const, label: 'Vue Hybride' },
            { id: 'archivist' as const, label: `Coffres du Monde (${openedChests.length})` },
            { id: 'geocaches' as const, label: `Capsules Joueurs (${sortedGeocaches.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                playJournalOpenSfx(muted);
                setSubSection(tab.id);
              }}
              className={`px-3 py-1.5 text-xs font-bold border-2 border-[#140b05] whitespace-nowrap shrink-0 cursor-pointer ${
                subSection === tab.id
                  ? 'bg-[#7c2d12] text-[#fefce8]'
                  : 'bg-[#ead5ac] hover:bg-[#dfc38d] text-[#2b1d12]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </ParchmentScrollStrip>
      </div>

      {/* SECTION A: DETERMINISTIC WORLD ARCHIVIST CHESTS & RELIQUARY */}
      {(subSection === 'all' || subSection === 'archivist') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Reliquary Grid */}
          <div className="lg:col-span-7 p-4 rpg-parchment border-2 border-[#2b1d12] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-pixel text-[9px] text-[#7c2d12] uppercase">
                Reliquaire de la Guilde
              </h4>
              <span className="text-xs text-[#5c3a21] tabular-nums">
                 Mêmes coffres pour tous aux points remarquables du relief
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {ARCHIVIST_RELICS_CATALOG.map((relic) => {
                const count = relicCountById.get(relic.id) || 0;
                const unlocked = Boolean(relic.isStarterToken) || count > 0;
                const selected = relic.id === selectedRelic.id;
                return (
                  <button
                    key={relic.id}
                    type="button"
                    onClick={() => {
                      playJournalOpenSfx(muted);
                      setSelectedRelicId(relic.id);
                    }}
                    className={`p-2 flex flex-col items-center text-center border-2 transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#fef3c7] border-[#b45309]'
                        : unlocked
                        ? 'bg-[#fcf6e8] border-[#78350f]/50 hover:border-[#2b1d12]'
                        : 'bg-[#e6d5b8]/70 border-[#78350f]/25 opacity-65'
                    }`}
                  >
                    <div className={unlocked ? '' : 'grayscale contrast-75 opacity-60'}>
                      <RelicIconCanvas relicId={relic.id} size={40} />
                    </div>
                    <span className="text-[11px] font-bold text-[#1c1209] line-clamp-1 mt-1">
                      {unlocked ? relic.name : 'Relique scellée'}
                    </span>
                    <span className="text-[10px] text-[#5c3a21] tabular-nums">
                      {relic.isStarterToken
                        ? 'Jeton initial'
                        : count > 0
                        ? `Trouvée ×${count}`
                        : 'À découvrir'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Relic Sheet */}
            <div className="p-3 bg-[#f5e7c6] border-2 border-[#78350f]/50 flex items-start gap-3">
              <div className={selectedRelicOwned ? '' : 'grayscale opacity-55'}>
                <RelicIconCanvas relicId={selectedRelic.id} size={52} />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-sm font-bold text-[#1c1209]">
                  {selectedRelicOwned ? selectedRelic.name : 'Relique d’Archiviste non identifiée'}
                </div>
                <div className="text-xs text-[#78350f]">
                  {selectedRelic.subtitle} · {CATEGORY_META[selectedRelic.category].label}
                </div>
                <p className="text-xs text-[#3b2614] leading-relaxed">
                  {selectedRelicOwned
                    ? selectedRelic.lore
                    : 'Explorez les sommets locaux, confluences de ruisseaux, sentiers forestiers en cul-de-sac, clairières isolées ou bouches souterraines pour desceller cette relique.'}
                </p>
              </div>
            </div>
          </div>

          {/* Active Sector Radar + Opened Chest History */}
          <div className="lg:col-span-5 p-4 rpg-parchment border-2 border-[#2b1d12] space-y-3">
            <h4 className="font-pixel text-[9px] text-[#7c2d12] uppercase">
              Coffres du Secteur Actuel ({worldChests.length})
            </h4>

            {worldChests.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {worldChests.map((ch) => {
                  const isOpened = openedChestIdSet.has(ch.chestId);
                  const dist = haversineMeters(playerLat, playerLng, ch.lat, ch.lng);
                  const bearing = formatCompassBearingFr(playerLat, playerLng, ch.lat, ch.lng);
                  const canOpenNow = !isOpened && (dist <= 95 || !simulationMode);
                  return (
                    <div
                      key={ch.chestId}
                      className={`p-2.5 border-2 flex items-center justify-between gap-2 ${
                        isOpened
                          ? 'bg-[#e9dec6] border-[#78350f]/35'
                          : 'bg-[#fcf6e8] border-[#b45309]/60'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#1c1209] truncate">{ch.title}</div>
                        <div className="text-[11px] text-[#5c3a21] tabular-nums">
                          {CHEST_ARCHETYPE_META[ch.archetype].shortFr} ·{' '}
                          {ch.isSubterranean ? 'Sous-sol' : 'Surface'} · {formatDistanceFr(dist)} ({bearing})
                          {isOpened ? ' · Ouvert' : ` · +${ch.xpReward} XP`}
                        </div>
                      </div>

                      {canOpenNow ? (
                        <button
                          type="button"
                          onClick={() => onOpenArchivistChest(ch)}
                          className="px-2.5 py-1 text-xs font-bold rpg-gold-btn whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Ouvrir
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            playJournalOpenSfx(muted);
                            onFocusLocationOnMap(ch.lat, ch.lng, ch.isSubterranean);
                          }}
                          className="px-2.5 py-1 text-xs font-bold bg-[#ead5ac] hover:bg-[#dfc38d] text-[#2b1d12] border border-[#2b1d12] whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Carte
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[#5c3a21]">
                Chargement des reliefs et cours d’eau du secteur…
              </p>
            )}

            {openedChests.length > 0 && (
              <div className="pt-2 border-t border-[#78350f]/30 space-y-1.5">
                <div className="text-xs font-bold text-[#2b1d12]">
                  Derniers coffres ouverts ({openedChests.length})
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {openedChests.slice(0, 8).map((rec) => (
                    <div
                      key={rec.chestId}
                      className="p-2 bg-[#f5e7c6] border border-[#78350f]/40 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <RelicIconCanvas relicId={rec.relicId} size={28} />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#1c1209] truncate">
                            {rec.relicName}
                          </div>
                          <div className="text-[11px] text-[#5c3a21] truncate tabular-nums">
                            {rec.title} · {rec.regionLabel}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onFocusLocationOnMap(rec.lat, rec.lng, rec.isSubterranean)}
                        className="px-2 py-0.5 text-[11px] font-bold bg-[#ead5ac] hover:bg-[#dfc38d] text-[#2b1d12] border border-[#2b1d12] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Voir
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION B: PLAYER-BURIED EXPLORER GEOCACHES */}
      {(subSection === 'all' || subSection === 'geocaches') && (
        <div className="p-4 rpg-parchment border-2 border-[#2b1d12] space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#78350f]/30 pb-3">
            <div>
              <h4 className="font-pixel text-[9px] text-[#14532d] uppercase flex items-center gap-2">
                <PixelUiIcon name="capsule" className="w-3.5 h-3.5 shrink-0" /> Caches d’Explorateurs (Géocaching 16-bit)
              </h4>
              <p className="text-xs text-[#5c3a21] mt-1">
                Enterrez une capsule à vos coordonnées avec une énigme et un souvenir. Les autres joueurs captent son écho à 200 m et doivent fouiller à moins de 40 m pour la révéler.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                playJournalOpenSfx(muted);
                onOpenBuryModal();
              }}
              className="px-3.5 py-2 text-xs font-bold bg-[#047857] hover:bg-[#065f46] text-[#fefce8] border-2 border-[#140b05] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Enterrer une capsule ici
            </button>
          </div>

          {sortedGeocaches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sortedGeocaches.map(({ cache, dist, isOwn, isFound }) => {
                const canInspect = isOwn || isFound || dist <= 45;
                const bearing = formatCompassBearingFr(playerLat, playerLng, cache.lat, cache.lng);
                return (
                  <div
                    key={cache.id}
                    className="p-3 bg-[#fcf6e8] border-2 border-[#78350f]/55 flex flex-col justify-between gap-2.5"
                  >
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-sm text-[#1c1209]">{cache.title}</div>
                        <span className="text-xs font-bold text-[#14532d] tabular-nums shrink-0">
                          {formatDistanceFr(dist)} · {bearing}
                        </span>
                      </div>
                      <div className="text-xs text-[#5c3a21]">
                        Par {cache.authorCallsign} · {cache.regionLabel} ·{' '}
                        {cache.isSubterranean ? 'Sous-sol' : 'Surface'}
                        {isOwn ? ' · Votre dépôt' : isFound ? ' · Trouvée' : ''}
                      </div>
                      <p className="text-xs text-[#3b2614] italic pt-1">« {cache.riddleHint} »</p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#78350f]/25">
                      <span className="text-[11px] text-[#78350f] truncate">
                        {canInspect
                          ? `Contient : ${cache.giftName}`
                          : dist <= 220
                          ? 'Signal capté : cherchez le point exact (< 40 m)'
                          : 'Rapprochez-vous à < 200 m pour capter le signal'}
                      </span>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {canInspect ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                onFocusLocationOnMap(cache.lat, cache.lng, cache.isSubterranean)
                              }
                              className="px-2 py-1 text-xs font-bold bg-[#ead5ac] hover:bg-[#dfc38d] text-[#2b1d12] border border-[#2b1d12] whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Carte
                            </button>
                            <button
                              type="button"
                              onClick={() => onInspectGeocache(cache)}
                              className="px-2.5 py-1 text-xs font-bold bg-[#15803d] hover:bg-[#166534] text-[#fefce8] border border-[#140b05] whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Ouvrir
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] font-bold text-[#5c3a21] tabular-nums">
                            Cap {bearing}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 bg-[#f5e7c6] border border-[#78350f]/40 text-center space-y-2">
              <p className="text-xs text-[#3b2614]">
                Aucune capsule d’explorateur n’a encore été déposée dans ce secteur de ~12 km.
              </p>
              <p className="text-xs text-[#5c3a21]">
                Inaugurez le géocaching local en cachant une relique ou un spécimen d’herbier/minéral accompagné de votre énigme !
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
