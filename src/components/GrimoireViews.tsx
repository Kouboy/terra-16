import React, { useMemo, useState } from 'react';
import {
  CachedSectorRecord,
  exportGrimoireArchiveJson,
  parseAndRestoreGrimoireArchive,
} from '../fogAndOffline';
import { OutfitDefinition } from '../rpgExtras';
import { playStampSfx } from '../sound';
import {
  CATEGORY_META,
  CollectedSpecimen,
  ElevationGrid,
  ExplorerAppearance,
  ExplorerProgress,
  HistoricalStratum,
  NpcEncounterRecord,
  PoiItem,
  RumorLead,
  sampleElevationMeters,
  STRATUM_META,
  STRATUM_ORDER,
  UnlockedEntry,
} from '../types';
import { ExplorerSpriteCanvas } from './ExplorerAvatarCanvas';
import { PixelCornerRivets, PixelGuildIcon, PixelStratumIcon, PixelUiIcon } from './PixelIcons';

// ============================================================================
// 1. 16-BIT PIXEL OUTFIT SPRITE PREVIEW (FOR GARDE-ROBE IN GUILDES TAB)
// ============================================================================
export const PixelOutfitSpritePreview: React.FC<{
  outfit: OutfitDefinition;
  baseAppearance?: ExplorerAppearance;
  animated?: boolean;
  className?: string;
}> = ({ outfit, baseAppearance, animated = false, className = 'w-14 h-[60px]' }) => {
  const previewAppearance: ExplorerAppearance = {
    gender: baseAppearance?.gender || 'masculin',
    avatarPreset: baseAppearance?.avatarPreset || 'cartographe',
    skinTone: baseAppearance?.skinTone || 'clair',
    headgearId: baseAppearance?.headgearId || 'tricorne_fauve',
    outfitId: outfit.id,
    toolId: baseAppearance?.toolId || 'lanterne_laiton',
    packId: baseAppearance?.packId || 'besace_cuir',
  };
  return (
    <ExplorerSpriteCanvas
      appearance={previewAppearance}
      facingDir="down"
      isWalking={animated}
      animated={animated}
      pixelScale={2}
      className={className}
    />
  );
};

// ============================================================================
// 2. 16-BIT TOPOGRAPHIC ELEVATION CROSS-SECTION WIDGET (GEOMANCER PERK)
// ============================================================================
export const ElevationProfileStrip: React.FC<{
  elevation: ElevationGrid | null;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  distanceMeters: number;
}> = ({ elevation, fromLat, fromLng, toLat, toLng, distanceMeters }) => {
  const samples = useMemo(() => {
    if (!elevation) return null;
    const N = 22;
    const vals: number[] = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const lat = fromLat + (toLat - fromLat) * t;
      const lng = fromLng + (toLng - fromLng) * t;
      const h = sampleElevationMeters(elevation, lat, lng);
      if (h === null) return null;
      vals.push(h);
    }
    const minH = Math.min(...vals);
    const maxH = Math.max(...vals);
    let gain = 0;
    for (let i = 1; i < vals.length; i++) {
      if (vals[i] > vals[i - 1]) gain += vals[i] - vals[i - 1];
    }
    return { vals, minH, maxH, gain: Math.round(gain) };
  }, [elevation, fromLat, fromLng, toLat, toLng]);

  if (!samples) return null;
  const span = Math.max(4, samples.maxH - samples.minH);

  return (
    <div className="bg-[#24160c] border-2 border-[#8c653b] p-2.5 space-y-1.5 text-amber-100">
      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
        <span className="text-sky-300 font-bold inline-flex items-center gap-1">
          <PixelUiIcon name="mountain" className="w-3.5 h-3.5" />
          <span>Coupe Géomancienne ({distanceMeters} m)</span>
        </span>
        <span className="text-amber-300 font-bold">
          {Math.round(samples.vals[0])} m → {Math.round(samples.vals[samples.vals.length - 1])} m
          {samples.gain >= 2 ? ` (D+ ${samples.gain} m)` : ''}
        </span>
      </div>
      <div className="h-9 flex items-end gap-[2px] pt-1">
        {samples.vals.map((v, idx) => {
          const pct = Math.max(14, Math.round(((v - samples.minH) / span) * 100));
          const isStart = idx === 0;
          const isEnd = idx === samples.vals.length - 1;
          return (
            <div
              key={idx}
              className={`flex-1 ${
                isStart
                  ? 'bg-emerald-400'
                  : isEnd
                  ? 'bg-rose-400'
                  : 'bg-gradient-to-t from-[#78350f] to-[#f59e0b]'
              }`}
              style={{ height: `${pct}%` }}
            />
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 3. FRISE STRATIGRAPHIQUE DU CARNET
// ============================================================================
function inferEntryStratum(entry: UnlockedEntry, sectorPois: PoiItem[]): HistoricalStratum {
  const match = sectorPois.find((p) => p.id === entry.poiId);
  if (match) return match.stratum;
  const txt = `${entry.eraLabel} ${entry.subType} ${entry.name}`.toLowerCase();
  if (/ma\b|géolog|jurass|crétac|lutétien|oligocène|fossile|substrat/.test(txt)) return 'temps_profond';
  if (/préhist|néolith|paléolith|dolmen|menhir|mégalith/.test(txt)) return 'prehistoire';
  if (/antiqu|gallo|romain|lutèce/.test(txt)) return 'antiquite';
  if (/moyen âge|médiéval|xie|xiie|xiiie|xive|xve/.test(txt)) return 'moyen_age';
  if (/moderne|xvie|xviie|xviiie|renaissance/.test(txt)) return 'moderne';
  if (entry.category === 'ecosysteme' || entry.category === 'legende') return 'vivant_folklore';
  return 'contemporain';
}

export const StratigraphicFriezeView: React.FC<{
  entries: UnlockedEntry[];
  sectorPois: PoiItem[];
  onSelectEntry: (poiId: string) => void;
  onFilterStratumOnMap: (stratum: HistoricalStratum) => void;
}> = ({ entries, sectorPois, onSelectEntry, onFilterStratumOnMap }) => {
  const grouped = useMemo(() => {
    const map = new Map<HistoricalStratum, UnlockedEntry[]>();
    for (const s of STRATUM_ORDER) map.set(s, []);
    for (const e of entries) {
      const st = inferEntryStratum(e, sectorPois);
      map.get(st)!.push(e);
    }
    return map;
  }, [entries, sectorPois]);

  return (
    <div className="space-y-4">
      {STRATUM_ORDER.map((stratum, idx) => {
        const meta = STRATUM_META[stratum];
        const list = grouped.get(stratum) || [];
        const veiledInSector = sectorPois.filter(
          (p) => p.stratum === stratum && !entries.some((e) => e.poiId === p.id)
        ).length;

        return (
          <div key={stratum} className="relative grimoire-folio p-4 sm:p-5 space-y-3">
            <PixelCornerRivets className={list.length > 0 ? 'bg-[#f59e0b]' : 'bg-[#8c653b]'} />
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#c89d62] pb-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="px-2 py-0.5 bg-[#28160d] text-amber-300 font-mono text-xs font-bold">
                  Strate {idx + 1}
                </span>
                <PixelStratumIcon stratum={stratum} className="w-4 h-4" />
                <div>
                  <h3 className="text-base sm:text-lg font-bold font-display text-[#24160c]">
                    {meta.label}
                  </h3>
                  <div className="text-[11px] font-mono text-[#6b4928]">{meta.eraSpan}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono tabular-nums font-bold text-emerald-800">
                  {list.length} révélé{list.length > 1 ? 's' : ''}
                </span>
                {veiledInSector > 0 && (
                  <button
                    type="button"
                    onClick={() => onFilterStratumOnMap(stratum)}
                    className="min-h-[34px] px-2.5 py-1 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow whitespace-nowrap"
                  >
                    +{veiledInSector} voilé{veiledInSector > 1 ? 's' : ''} sur la carte
                  </button>
                )}
              </div>
            </div>

            {list.length === 0 ? (
              <p className="text-xs italic text-[#6b4928]">
                Aucun témoignage de cette strate n’a encore été scellé dans votre Carnet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {list.map((item) => {
                  const cat = CATEGORY_META[item.category];
                  return (
                    <button
                      key={item.poiId}
                      type="button"
                      onClick={() => onSelectEntry(item.poiId)}
                      className="text-left p-3 bg-[#ecd8b1] hover:bg-[#fffbeb] border-2 border-[#6b4928] hover:border-[#2b1a0e] transition-transform duration-150 hover:-translate-y-0.5 jrpg-shadow space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className={`font-bold inline-flex items-center gap-1 ${cat.mapTextClass}`}>
                          <PixelGuildIcon category={item.category} className="w-3.5 h-3.5" />
                          <span>{cat.shortLabel}</span>
                        </span>
                        <span className="font-mono text-[#6b4928]">
                          {new Date(item.discoveredAtIso).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-[#24160c] truncate">{item.name}</div>
                      <div className="text-xs text-[#54361d] truncate">{item.eraLabel || item.subType}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// 4. CONSTELLATION DES ÉCHOS (GRAPHE INTERACTIF DES LIEUX RELIES)
// ============================================================================
export const ConstellationEchoesView: React.FC<{
  entries: UnlockedEntry[];
  unlockedIds: Set<string>;
  onOpenUnlocked: (poiId: string) => void;
  onLocateVeiledOnMap: (poiId: string) => void;
}> = ({ entries, unlockedIds, onOpenUnlocked, onLocateVeiledOnMap }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const graph = useMemo(() => {
    const W = 760;
    const H = 440;
    interface NodeItem {
      id: string;
      label: string;
      unlocked: boolean;
      categoryColor: string;
      x: number;
      y: number;
    }
    const nodeMap = new Map<string, NodeItem>();
    const edges: Array<{ from: string; to: string; bothUnlocked: boolean }> = [];

    const mainEntries = entries.slice(0, 18);
    const count = Math.max(1, mainEntries.length);

    mainEntries.forEach((e, idx) => {
      const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
      const ringR = count <= 4 ? 110 : idx % 2 === 0 ? 145 : 92;
      const x = Math.round(W / 2 + Math.cos(angle) * ringR * 1.35);
      const y = Math.round(H / 2 + Math.sin(angle) * ringR * 0.95);
      nodeMap.set(e.poiId, {
        id: e.poiId,
        label: e.name,
        unlocked: true,
        categoryColor: CATEGORY_META[e.category]?.mapHex || '#f59e0b',
        x,
        y,
      });
    });

    // Add connected satellite nodes (up to 2 per entry)
    let satIndex = 0;
    for (const e of mainEntries) {
      const srcNode = nodeMap.get(e.poiId);
      if (!srcNode) continue;
      e.relatedPoiIds.slice(0, 2).forEach((relId, rIdx) => {
        const isUnl = unlockedIds.has(relId);
        if (!nodeMap.has(relId)) {
          const satAngle = ((satIndex * 137.5) * Math.PI) / 180;
          const sx = Math.max(64, Math.min(W - 64, Math.round(srcNode.x + Math.cos(satAngle) * 78)));
          const sy = Math.max(48, Math.min(H - 48, Math.round(srcNode.y + Math.sin(satAngle) * 64)));
          satIndex++;
          nodeMap.set(relId, {
            id: relId,
            label: isUnl ? e.relatedPoiTitles[rIdx] || 'Lieu découvert' : '? Écho voilé',
            unlocked: isUnl,
            categoryColor: isUnl ? '#fbbf24' : '#e11d48',
            x: sx,
            y: sy,
          });
        }
        const keyA = [e.poiId, relId].sort().join('__');
        if (!edges.some((ed) => [ed.from, ed.to].sort().join('__') === keyA)) {
          edges.push({
            from: e.poiId,
            to: relId,
            bothUnlocked: isUnl,
          });
        }
      });
    }

    return { W, H, nodes: Array.from(nodeMap.values()), edges };
  }, [entries, unlockedIds]);

  const hoveredNode = graph.nodes.find((n) => n.id === hoveredId) || null;

  return (
    <div className="relative grimoire-folio p-4 sm:p-5 space-y-3">
      <PixelCornerRivets className="bg-[#f59e0b]" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base sm:text-lg font-bold font-display text-[#24160c] flex items-center gap-2">
            <PixelUiIcon name="constellation" className="w-4 h-4" />
            <span>Constellation Céleste des Échos</span>
          </h3>
          <p className="text-xs text-[#54361d]">
            Cliquez sur une étoile dorée pour ouvrir son feuillet, ou sur un écho carmin « ? » pour
            le traquer sur la carte 16-bit.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 text-amber-900">
            <span className="w-3 h-3 bg-amber-400 border border-[#24160c] inline-block" />
            <span>Découvert</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-rose-900">
            <span className="w-3 h-3 bg-rose-600 border border-[#24160c] inline-block" />
            <span>? Écho connexe voilé</span>
          </span>
        </div>
      </div>

      <div className="relative w-full bg-[#191024] border-2 border-[#2b1a0e] jrpg-shadow overflow-hidden">
        <svg
          viewBox={`0 0 ${graph.W} ${graph.H}`}
          className="w-full h-[320px] sm:h-[400px] block select-none"
        >
          {/* Starry background specks */}
          {Array.from({ length: 36 }).map((_, i) => (
            <rect
              key={`bgstar_${i}`}
              x={(i * 97) % graph.W}
              y={(i * 53) % graph.H}
              width={i % 3 === 0 ? 3 : 2}
              height={i % 3 === 0 ? 3 : 2}
              fill={i % 4 === 0 ? '#fde68a' : '#475569'}
              opacity={0.55}
            />
          ))}

          {/* Thread Edges */}
          {graph.edges.map((ed, idx) => {
            const a = graph.nodes.find((n) => n.id === ed.from);
            const b = graph.nodes.find((n) => n.id === ed.to);
            if (!a || !b) return null;
            return (
              <line
                key={`edge_${idx}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={ed.bothUnlocked ? '#fbbf24' : '#f43f5e'}
                strokeWidth={ed.bothUnlocked ? 2.5 : 1.75}
                strokeDasharray={ed.bothUnlocked ? undefined : '5 4'}
                opacity={0.85}
              />
            );
          })}

          {/* Nodes */}
          {graph.nodes.map((node) => {
            const isHov = hoveredId === node.id;
            const size = node.unlocked ? 16 : 13;
            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() =>
                  node.unlocked ? onOpenUnlocked(node.id) : onLocateVeiledOnMap(node.id)
                }
              >
                <rect
                  x={node.x - size / 2 - 3}
                  y={node.y - size / 2 - 3}
                  width={size + 6}
                  height={size + 6}
                  fill={isHov ? '#ffffff' : '#0f0a19'}
                />
                <rect
                  x={node.x - size / 2}
                  y={node.y - size / 2}
                  width={size}
                  height={size}
                  fill={node.categoryColor}
                />
                <text
                  x={node.x}
                  y={node.y + size / 2 + 15}
                  textAnchor="middle"
                  fill={node.unlocked ? '#fef3c7' : '#fda4af'}
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {node.label.length > 22 ? `${node.label.slice(0, 20)}…` : node.label}
                </text>
              </g>
            );
          })}
        </svg>

        {hoveredNode && (
          <div className="absolute bottom-2.5 left-2.5 bg-[#f8edd6] border-2 border-[#2b1a0e] px-3 py-1.5 text-xs font-bold text-[#24160c] jrpg-shadow">
            {hoveredNode.label} —{' '}
            <span className="text-rose-800">
              {hoveredNode.unlocked ? 'Cliquer pour ouvrir au Carnet' : 'Cliquer pour viser sur la carte'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 5. BESACE HORS-LIGNE & SAUVEGARDE COMPLÈTE D'ARCHIVE
// ============================================================================
export const BesaceAndBackupView: React.FC<{
  progress: ExplorerProgress;
  entries: UnlockedEntry[];
  fogSet: Set<string>;
  encounters?: NpcEncounterRecord[];
  rumors?: RumorLead[];
  specimens?: CollectedSpecimen[];
  cachedSectors: CachedSectorRecord[];
  muted: boolean;
  onSaveCurrentSector: () => Promise<void>;
  onTeleportToSector: (lat: number, lng: number) => void;
  onDeleteSector: (id: string) => Promise<void>;
  onRestoreArchive: (data: {
    progress: ExplorerProgress;
    entries: UnlockedEntry[];
    fogCells: string[];
    encounters: NpcEncounterRecord[];
    rumors: RumorLead[];
    specimens: CollectedSpecimen[];
    importedPhotosCount: number;
  }) => void;
}> = ({
  progress,
  entries,
  fogSet,
  encounters = [],
  rumors = [],
  specimens = [],
  cachedSectors,
  muted,
  onSaveCurrentSector,
  onTeleportToSector,
  onDeleteSector,
  onRestoreArchive,
}) => {
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSaveSector = async () => {
    setBusy(true);
    setErrorMsg('');
    try {
      await onSaveCurrentSector();
      playStampSfx(muted);
      setStatusMsg('Secteur actuel rangé dans la Besace hors-ligne !');
      window.setTimeout(() => setStatusMsg(''), 3200);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Échec de mise en cache.');
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    setBusy(true);
    setErrorMsg('');
    try {
      await exportGrimoireArchiveJson(progress, entries, fogSet, encounters, rumors, specimens);
      playStampSfx(muted);
      setStatusMsg('Archive complète du Grimoire téléchargée (.json) !');
      window.setTimeout(() => setStatusMsg(''), 3200);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Impossible d’exporter l’archive.');
    } finally {
      setBusy(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErrorMsg('');
    try {
      const restored = await parseAndRestoreGrimoireArchive(file);
      onRestoreArchive(restored);
      playStampSfx(muted);
      setStatusMsg(
        `Grimoire restauré (${restored.entries.length} feuillets, ${restored.importedPhotosCount} clichés) !`
      );
      window.setTimeout(() => setStatusMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Fichier d’archive invalide.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* Offline Sector Satchel */}
      <div className="relative grimoire-folio p-5 space-y-4">
        <PixelCornerRivets className="bg-[#f59e0b]" />
        <div className="space-y-1 border-b-2 border-[#c89d62] pb-3">
          <h3 className="text-lg font-bold font-display text-[#24160c] flex items-center gap-2">
            <PixelUiIcon name="backpack" className="w-5 h-5" />
            <span>Besace Hors-Ligne (Cartes en cache)</span>
          </h3>
          <p className="text-xs text-[#54361d] leading-relaxed">
            Emportez la topologie Z15, le relief NGF et les signaux du secteur courant dans la
            mémoire de votre appareil pour continuer à explorer en forêt ou en vallée blanche.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveSector}
          disabled={busy}
          className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow disabled:opacity-50"
        >
          <PixelUiIcon name="backpack" className="w-4 h-4" />
          <span>Mettre en besace le secteur actuel</span>
        </button>

        {cachedSectors.length === 0 ? (
          <p className="text-xs italic text-[#6b4928] py-3">
            Aucun secteur mis en besace pour le moment.
          </p>
        ) : (
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {cachedSectors.map((sec) => (
              <div
                key={sec.id}
                className="p-3 bg-[#ecd8b1] border-2 border-[#6b4928] flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#24160c] truncate">{sec.label}</div>
                  <div className="text-[11px] font-mono text-[#54361d]">
                    {sec.poiCount} signaux ·{' '}
                    {new Date(sec.savedAtIso).toLocaleDateString('fr-FR')}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onTeleportToSector(sec.centerLat, sec.centerLng)}
                    className="min-h-[36px] px-2.5 py-1 text-xs font-bold bg-[#28160d] text-amber-300 border border-[#d97706]"
                  >
                    Ouvrir
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSector(sec.id)}
                    aria-label="Retirer de la besace"
                    className="w-9 h-9 flex items-center justify-center bg-[#991b1b] text-[#fffbeb] border border-[#2b1a0e]"
                  >
                    <PixelUiIcon name="trash" className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full Grimoire Backup / Restore */}
      <div className="relative grimoire-folio-gold p-5 space-y-4">
        <PixelCornerRivets className="bg-[#d97706]" />
        <div className="space-y-1 border-b-2 border-[#c89d62] pb-3">
          <h3 className="text-lg font-bold font-display text-[#24160c] flex items-center gap-2">
            <PixelUiIcon name="archive" className="w-5 h-5" />
            <span>Malle d’Archive & Sauvegarde Locale</span>
          </h3>
          <p className="text-xs text-[#54361d] leading-relaxed">
            Exportez l’intégralité de votre Grimoire (feuillets découverts, notes manuscrites,
            clichés photo compressés et carte du brouillard dissipé) dans un fichier portable.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={busy}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow whitespace-nowrap"
          >
            <PixelUiIcon name="stamp" className="w-4 h-4" />
            <span>Exporter le Grimoire (.json)</span>
          </button>

          <label className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold bg-[#ecd8b1] hover:bg-[#fffbeb] text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow cursor-pointer whitespace-nowrap">
            <PixelUiIcon name="book" className="w-4 h-4" />
            <span>Importer une archive</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              className="sr-only"
            />
          </label>
        </div>

        {statusMsg && (
          <div className="p-2.5 bg-emerald-100 border-2 border-emerald-800 text-xs font-bold text-emerald-950">
            {statusMsg}
          </div>
        )}
        {errorMsg && (
          <div className="p-2.5 bg-rose-100 border-2 border-rose-800 text-xs font-bold text-rose-950">
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
};
