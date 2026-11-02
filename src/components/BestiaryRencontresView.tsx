import React, { useEffect, useMemo, useState } from 'react';
import {
  BESTIARY_SPECIES_CATALOG,
  NpcKind,
  NpcPortraitCanvas,
  NpcVoiceKind,
  WorldNpc,
} from '../npcs';
import { playNpcVoiceSfx } from '../sound';
import {
  CATEGORY_META,
  haversineMeters,
  NpcEncounterRecord,
  PostcardSubject,
  RumorLead,
} from '../types';
import { PixelCornerRivets, PixelGuildIcon, PixelUiIcon } from './PixelIcons';

type SubTabMode = 'bestiaire' | 'habitants' | 'rumeurs';

function encounterToPreviewNpc(rec: NpcEncounterRecord): WorldNpc {
  const voice: NpcVoiceKind = rec.isHuman
    ? rec.kind === 'puisatier' || rec.kind === 'erudit'
      ? 'human_low'
      : rec.kind === 'colporteur'
      ? 'human_bright'
      : 'human_mid'
    : rec.kind === 'chouette' || rec.kind === 'martin_pecheur'
    ? 'bird'
    : rec.kind === 'grenouille' || rec.kind === 'salamandre'
    ? 'amphibian'
    : rec.kind === 'abeille' ||
      rec.kind === 'papillon' ||
      rec.kind === 'lucane' ||
      rec.kind === 'luciole' ||
      rec.kind === 'libellule'
    ? 'insect'
    : 'beast';

  return {
    id: rec.id,
    kind: rec.kind as NpcKind,
    voice,
    isHuman: rec.isHuman,
    isSubterranean: rec.isSubterranean,
    name: rec.name,
    roleLabel: rec.roleLabel,
    habitatLabel: rec.habitatLabel,
    lat: rec.lat,
    lng: rec.lng,
    facing: 'right',
    seed: rec.seed || 7,
    dialogues: rec.dialogues,
  };
}

export const BestiaryRencontresView: React.FC<{
  encounters: NpcEncounterRecord[];
  rumorLeads: RumorLead[];
  playerLat: number;
  playerLng: number;
  muted: boolean;
  initialSubTab?: SubTabMode;
  onFocusLocationOnMap: (lat: number, lng: number, isSubterranean: boolean) => void;
  onOpenPostcard?: (subject: PostcardSubject) => void;
}> = ({
  encounters,
  rumorLeads,
  playerLat,
  playerLng,
  muted,
  initialSubTab,
  onFocusLocationOnMap,
  onOpenPostcard,
}) => {
  const [subTab, setSubTab] = useState<SubTabMode>(initialSubTab || 'bestiaire');

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);
  const [selectedSpeciesKind, setSelectedSpeciesKind] = useState<NpcKind>('renard');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [animTick, setAnimTick] = useState(0);

  // Subtle idle portrait animation inside the Codex
  useEffect(() => {
    const id = window.setInterval(() => {
      setAnimTick((t) => (t + 1) % 240);
    }, 520);
    return () => window.clearInterval(id);
  }, []);

  const speciesMap = useMemo(() => {
    const map = new Map<string, NpcEncounterRecord>();
    for (const e of encounters) {
      if (!e.isHuman) {
        map.set(e.kind, e);
      }
    }
    return map;
  }, [encounters]);

  const humanEncounters = useMemo(
    () =>
      encounters
        .filter((e) => e.isHuman)
        .sort((a, b) => b.lastMetIso.localeCompare(a.lastMetIso)),
    [encounters]
  );

  const uniqueRegions = useMemo(() => {
    const set = new Set<string>();
    for (const e of humanEncounters) {
      if (e.regionLabel) set.add(e.regionLabel);
    }
    return Array.from(set);
  }, [humanEncounters]);

  const filteredHumans = useMemo(
    () =>
      regionFilter === 'all'
        ? humanEncounters
        : humanEncounters.filter((h) => h.regionLabel === regionFilter),
    [humanEncounters, regionFilter]
  );

  const activeRumors = useMemo(
    () => rumorLeads.filter((r) => !r.verified),
    [rumorLeads]
  );
  const verifiedRumors = useMemo(
    () => rumorLeads.filter((r) => r.verified),
    [rumorLeads]
  );

  const selectedSpeciesMeta = useMemo(
    () =>
      BESTIARY_SPECIES_CATALOG.find((s) => s.kind === selectedSpeciesKind) ||
      BESTIARY_SPECIES_CATALOG[0],
    [selectedSpeciesKind]
  );
  const selectedSpeciesRecord = speciesMap.get(selectedSpeciesMeta.kind) || null;

  const observedSpeciesCount = speciesMap.size;
  const totalSpeciesCount = BESTIARY_SPECIES_CATALOG.length;

  return (
    <div className="space-y-5">
      {/* Illuminated Summary Strip */}
      <div className="relative grimoire-folio-gold p-4 sm:p-5 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-0 divide-y md:divide-y-0 md:divide-x divide-[#c89d62] items-center">
        <PixelCornerRivets className="bg-[#f59e0b]" />

        <div className="space-y-1.5 md:pr-5">
          <div className="flex items-center justify-between text-xs font-bold text-[#24160c]">
            <span className="inline-flex items-center gap-1.5">
              <PixelUiIcon name="paw" className="w-4 h-4" />
              <span>Bestiaire Sauvage</span>
            </span>
            <span className="font-mono tabular-nums text-emerald-900">
              {observedSpeciesCount} / {totalSpeciesCount} espèces
            </span>
          </div>
          <div className="w-full h-2.5 pixel-gauge-track overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-700 via-emerald-500 to-amber-300"
              style={{
                width: `${Math.max(
                  4,
                  Math.round((observedSpeciesCount / totalSpeciesCount) * 100)
                )}%`,
              }}
            />
          </div>
          <p className="text-[11px] text-[#54361d]">
            Cliquez sur la faune et les insectes croisés dans les bois, prés, rivières ou cavités.
          </p>
        </div>

        <div className="space-y-1 pt-3 md:pt-0 md:px-5">
          <div className="text-xs font-bold text-[#24160c] inline-flex items-center gap-1.5">
            <PixelUiIcon name="quill" className="w-4 h-4" />
            <span>Témoignages & Récits Locaux</span>
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-rose-900">
            {humanEncounters.length}{' '}
            <span className="text-xs font-sans font-semibold text-[#54361d]">
              habitant{humanEncounters.length > 1 ? 's' : ''} interrogé
              {humanEncounters.length > 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-[11px] text-[#54361d]">
            Citadins, villageois, érudits, colporteurs et puisatiers rencontrés en chemin.
          </p>
        </div>

        <div className="space-y-1 pt-3 md:pt-0 md:pl-5">
          <div className="text-xs font-bold text-[#24160c] inline-flex items-center gap-1.5">
            <PixelUiIcon name="rumor" className="w-4 h-4" />
            <span>Pistes & Rumeurs sur Carte</span>
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-amber-950">
            {activeRumors.length} à vérifier{' '}
            <span className="text-xs font-sans font-semibold text-emerald-900">
              · {verifiedRumors.length} résolue{verifiedRumors.length > 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-[11px] text-[#54361d]">
            Érudits, colporteurs et puisatiers crayonnent des curiosités cachées sur votre carte.
          </p>
        </div>
      </div>

      {/* Segmented Grimoire Sub-Navigation */}
      <div
        className="max-w-full overflow-x-auto no-scrollbar inline-flex items-center bg-[#f8edd6] border-2 border-[#2b1a0e] jrpg-shadow"
        role="tablist"
        aria-label="Sections du Bestiaire et des Récits"
      >
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'bestiaire'}
          onClick={() => setSubTab('bestiaire')}
          className={`min-h-[42px] px-3 sm:px-3.5 py-2 text-xs font-bold inline-flex items-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap shrink-0 ${
            subTab === 'bestiaire'
              ? 'bg-[#991b1b] text-[#fffbeb]'
              : 'text-[#24160c] hover:bg-amber-200/80'
          }`}
        >
          <PixelUiIcon name="paw" className="w-4 h-4 shrink-0" />
          <span>Bestiaire</span>
          <span className="font-mono tabular-nums opacity-90">
            {observedSpeciesCount}/{totalSpeciesCount}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'habitants'}
          onClick={() => setSubTab('habitants')}
          className={`min-h-[42px] px-3 sm:px-3.5 py-2 text-xs font-bold border-l-2 border-[#2b1a0e] inline-flex items-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap shrink-0 ${
            subTab === 'habitants'
              ? 'bg-[#991b1b] text-[#fffbeb]'
              : 'text-[#24160c] hover:bg-amber-200/80'
          }`}
        >
          <PixelUiIcon name="quill" className="w-4 h-4 shrink-0" />
          <span>Récits</span>
          <span className="hidden sm:inline">des habitants</span>
          <span className="font-mono tabular-nums opacity-90">{humanEncounters.length}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'rumeurs'}
          onClick={() => setSubTab('rumeurs')}
          className={`min-h-[42px] px-3 sm:px-3.5 py-2 text-xs font-bold border-l-2 border-[#2b1a0e] inline-flex items-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap shrink-0 ${
            subTab === 'rumeurs'
              ? 'bg-[#991b1b] text-[#fffbeb]'
              : 'text-[#24160c] hover:bg-amber-200/80'
          }`}
        >
          <PixelUiIcon name="rumor" className="w-4 h-4 shrink-0" />
          <span>Pistes & Rumeurs</span>
          <span className="font-mono tabular-nums opacity-90">
            {activeRumors.length > 0 ? `${activeRumors.length}` : rumorLeads.length}
          </span>
        </button>
      </div>

      {/* ==================== 1. BESTIAIRE SAUVAGE ==================== */}
      {subTab === 'bestiaire' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* 12-Species Plate Grid */}
          <div className="lg:col-span-7 grimoire-folio p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {BESTIARY_SPECIES_CATALOG.map((sp) => {
              const rec = speciesMap.get(sp.kind);
              const isObserved = Boolean(rec);
              const isSelected = selectedSpeciesMeta.kind === sp.kind;

              return (
                <button
                  key={sp.kind}
                  type="button"
                  onClick={() => {
                    setSelectedSpeciesKind(sp.kind);
                    if (isObserved) {
                      playNpcVoiceSfx(muted, sp.previewNpc.voice);
                    }
                  }}
                  className={`text-left p-3 border-2 transition-transform duration-150 hover:-translate-y-0.5 flex flex-col gap-2 ${
                    isSelected
                      ? 'bg-amber-200/90 border-[#991b1b] jrpg-shadow'
                      : isObserved
                      ? 'bg-[#fbf4e3] border-[#6b4928] hover:bg-[#fffbeb]'
                      : 'bg-[#e6d3b0]/75 border-[#8c653b]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <NpcPortraitCanvas
                      npc={rec ? encounterToPreviewNpc(rec) : sp.previewNpc}
                      animTick={isObserved ? animTick : 0}
                      silhouette={!isObserved}
                      className="w-12 h-12"
                    />
                    <span
                      className={`text-[11px] font-mono tabular-nums font-bold ${
                        isObserved ? 'text-emerald-900' : 'text-[#78532f]'
                      }`}
                    >
                      {isObserved ? `×${rec!.sightingsCount}` : '?'}
                    </span>
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="text-xs font-bold text-[#24160c] truncate">
                      {isObserved ? sp.name : 'Espèce à observer'}
                    </div>
                    <div className="text-[11px] italic text-[#54361d] truncate">
                      {isObserved ? sp.latinName : sp.habitatLabel}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Species Naturalist Plate */}
          <div className="lg:col-span-5 relative grimoire-folio-crimson p-5 space-y-4">
            <PixelCornerRivets className="bg-[#b91c1c]" />

            <div className="flex items-center gap-3.5 border-b border-[#c89d62] pb-3.5">
              <NpcPortraitCanvas
                npc={
                  selectedSpeciesRecord
                    ? encounterToPreviewNpc(selectedSpeciesRecord)
                    : selectedSpeciesMeta.previewNpc
                }
                animTick={selectedSpeciesRecord ? animTick : 0}
                silhouette={!selectedSpeciesRecord}
                className="w-16 h-16"
              />
              <div className="min-w-0 space-y-0.5">
                <div className="text-xs font-bold text-rose-900">
                  {selectedSpeciesMeta.familyLabel}
                  {selectedSpeciesMeta.isSubterranean ? ' · Strate Sous-sol' : ''}
                </div>
                <h3 className="text-lg font-bold font-display text-[#24160c]">
                  {selectedSpeciesRecord
                    ? selectedSpeciesMeta.name
                    : `? ${selectedSpeciesMeta.familyLabel}`}
                </h3>
                <div className="text-xs italic text-[#54361d]">
                  {selectedSpeciesRecord
                    ? selectedSpeciesMeta.latinName
                    : selectedSpeciesMeta.habitatLabel}
                </div>
                <div className="text-[11px] font-semibold text-[#78350f] pt-0.5">
                  Rythme : {selectedSpeciesMeta.rhythmLabel}
                </div>
              </div>
            </div>

            {selectedSpeciesRecord ? (
              <>
                <div className="text-xs text-[#54361d] leading-relaxed">
                  <span className="font-bold text-emerald-900">
                    Observée {selectedSpeciesRecord.sightingsCount} fois
                  </span>
                  {selectedSpeciesRecord.regionsVisited.length > 0 && (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span>{selectedSpeciesRecord.regionsVisited.join(', ')}</span>
                    </>
                  )}
                </div>

                <div className="space-y-2.5 border-y border-[#c89d62] py-3.5">
                  <div className="text-xs font-bold text-amber-950">
                    Notes d’observation · {selectedSpeciesRecord.regionLabel}
                  </div>
                  {selectedSpeciesRecord.dialogues.map((paragraph, idx) => (
                    <p key={idx} className="text-xs sm:text-sm text-[#24160c] leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>

                <div className="space-y-2 pt-0.5">
                  <div className="text-xs font-mono tabular-nums text-[#54361d]">
                    Dernière obs. :{' '}
                    {new Date(selectedSpeciesRecord.lastMetIso).toLocaleDateString('fr-FR')}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onFocusLocationOnMap(
                          selectedSpeciesRecord.lat,
                          selectedSpeciesRecord.lng,
                          selectedSpeciesRecord.isSubterranean
                        )
                      }
                      className="min-h-[40px] px-3 py-2 text-xs font-bold bg-[#28160d] hover:bg-[#3f2416] text-amber-300 border-2 border-[#d97706] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 jrpg-shadow"
                    >
                      <PixelUiIcon name="map" className="w-3.5 h-3.5" />
                      <span>Voir le biotope</span>
                    </button>
                    {onOpenPostcard && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenPostcard({ kind: 'encounter', encounter: selectedSpeciesRecord })
                        }
                        className="min-h-[40px] px-3 py-2 text-xs font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 jrpg-shadow"
                      >
                        <PixelUiIcon name="postcard" className="w-3.5 h-3.5" />
                        <span>Carte postale 16-bit</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3 py-1">
                <p className="text-xs sm:text-sm text-[#3b2312] leading-relaxed">
                  Cette planche naturaliste attend encore votre première observation sur le terrain.
                </p>
                <div className="pt-3 border-t border-[#c89d62] space-y-1">
                  <div className="text-xs font-bold text-amber-950">
                    Indice d’habitat & rythme ({selectedSpeciesMeta.rhythmLabel})
                  </div>
                  <p className="text-xs text-[#3b2312] leading-relaxed">
                    {selectedSpeciesMeta.clueHint}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== 2. RÉCITS DES HABITANTS ==================== */}
      {subTab === 'habitants' && (
        <div className="space-y-4">
          {uniqueRegions.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-[#24160c] pr-1">Contrées visitées :</span>
              <button
                type="button"
                onClick={() => setRegionFilter('all')}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-bold border-2 border-[#2b1a0e] ${
                  regionFilter === 'all'
                    ? 'bg-[#991b1b] text-[#fffbeb]'
                    : 'bg-[#ecd8b1] text-[#54361d] hover:bg-[#fffbeb]'
                }`}
              >
                Toutes ({humanEncounters.length})
              </button>
              {uniqueRegions.map((reg) => (
                <button
                  key={reg}
                  type="button"
                  onClick={() => setRegionFilter(reg)}
                  className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold border-2 border-[#2b1a0e] ${
                    regionFilter === reg
                      ? 'bg-amber-300 text-[#24160c] font-bold'
                      : 'bg-[#ecd8b1] text-[#54361d] hover:bg-[#fffbeb]'
                  }`}
                >
                  {reg}
                </button>
              ))}
            </div>
          )}

          {filteredHumans.length === 0 ? (
            <div className="grimoire-folio p-6 text-center space-y-2">
              <h3 className="text-base font-bold font-display text-[#24160c]">
                Aucun récit local consigné pour l’instant
              </h3>
              <p className="text-xs sm:text-sm text-[#54361d] max-w-lg mx-auto leading-relaxed">
                Approchez-vous des habitants sur les places, dans les villages, le long des chemins
                ou dans les carrières souterraines et cliquez sur eux (ou appuyez sur{' '}
                <strong>E</strong>) pour recueillir leurs histoires du pays.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredHumans.map((rec) => (
                <div
                  key={rec.id}
                  className="relative grimoire-folio p-5 space-y-3.5 flex flex-col justify-between"
                >
                  <PixelCornerRivets className="bg-[#f59e0b]" />
                  <div className="space-y-3.5">
                    <div className="flex items-start gap-3.5">
                      <NpcPortraitCanvas
                        npc={encounterToPreviewNpc(rec)}
                        animTick={animTick}
                        className="w-14 h-14"
                      />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <h3 className="text-base font-bold font-display text-[#24160c] truncate">
                          {rec.name}
                        </h3>
                        <div className="text-xs font-semibold text-rose-900 truncate">
                          {rec.roleLabel} · {rec.regionLabel}
                          {rec.isSubterranean ? ' (Sous-sol)' : ''}
                        </div>
                        <div className="text-[11px] text-[#6b4928] truncate">
                          {rec.habitatLabel} ·{' '}
                          {new Date(rec.lastMetIso).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 border-y border-[#c89d62] py-3">
                      {rec.dialogues.map((line, i) => (
                        <p key={i} className="text-xs sm:text-sm text-[#24160c] leading-relaxed">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <span className="text-xs font-mono tabular-nums text-[#54361d]">
                      À {Math.round(haversineMeters(playerLat, playerLng, rec.lat, rec.lng))} m
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {onOpenPostcard && (
                        <button
                          type="button"
                          onClick={() => onOpenPostcard({ kind: 'encounter', encounter: rec })}
                          className="min-h-[40px] px-3 py-2 text-xs font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 jrpg-shadow"
                        >
                          <PixelUiIcon name="postcard" className="w-3.5 h-3.5" />
                          <span>Carte postale</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          onFocusLocationOnMap(rec.lat, rec.lng, rec.isSubterranean)
                        }
                        className="min-h-[40px] px-3 py-2 text-xs font-bold bg-[#ecd8b1] hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 jrpg-shadow"
                      >
                        <PixelUiIcon name="cursor" className="w-3.5 h-3.5" />
                        <span>Retrouver sur la carte</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== 3. PISTES & RUMEURS ==================== */}
      {subTab === 'rumeurs' && (
        <div className="space-y-4">
          {rumorLeads.length === 0 ? (
            <div className="grimoire-folio p-6 text-center space-y-2">
              <h3 className="text-base font-bold font-display text-[#24160c]">
                Aucune rumeur crayonnée sur votre carte
              </h3>
              <p className="text-xs sm:text-sm text-[#54361d] max-w-lg mx-auto leading-relaxed">
                Discutez avec un <strong>Érudit</strong>, un <strong>Colporteur</strong> ou un{' '}
                <strong>Puisatier</strong> lors de vos haltes : ils connaissent souvent l’emplacement
                d’un sceau encore voilé ou d’une entrée souterraine voisine.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {rumorLeads.map((lead) => {
                const distM = Math.round(
                  haversineMeters(playerLat, playerLng, lead.lat, lead.lng)
                );
                const catMeta = lead.category ? CATEGORY_META[lead.category] : null;
                return (
                  <div
                    key={lead.id}
                    className={`relative p-5 space-y-3.5 flex flex-col justify-between ${
                      lead.verified
                        ? 'bg-[#ecfdf5] border-2 border-emerald-800 jrpg-shadow'
                        : 'grimoire-folio-gold'
                    }`}
                  >
                    <PixelCornerRivets
                      className={lead.verified ? 'bg-emerald-600' : 'bg-[#d97706]'}
                    />
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold inline-flex items-center gap-1.5 text-amber-950">
                          {catMeta ? (
                            <PixelGuildIcon category={lead.category!} className="w-4 h-4" />
                          ) : (
                            <PixelUiIcon
                              name={lead.targetType === 'portal' ? 'dungeon' : 'rumor'}
                              className="w-4 h-4"
                            />
                          )}
                          <span>
                            {lead.targetType === 'portal'
                              ? 'Accès souterrain signalé'
                              : catMeta
                              ? `Piste · ${catMeta.shortLabel}`
                              : 'Rumeur locale'}
                          </span>
                        </span>
                        <span
                          className={`font-mono tabular-nums font-bold ${
                            lead.verified ? 'text-emerald-800' : 'text-rose-900'
                          }`}
                        >
                          {lead.verified ? 'Vérifiée sur place ✓' : `À ${distM} m`}
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-bold font-display text-[#24160c]">
                        {lead.title}
                      </h3>
                      <p className="text-xs sm:text-sm italic text-[#3b2312] leading-relaxed border-y border-[#c89d62] py-2.5">
                        {lead.rumorText}
                      </p>
                      <div className="text-xs text-[#54361d]">
                        Confiée par <strong>{lead.giverName}</strong> · {lead.giverRole} ·{' '}
                        {lead.regionLabel}
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          onFocusLocationOnMap(lead.lat, lead.lng, lead.isSubterranean)
                        }
                        className="min-h-[40px] px-4 py-2 text-xs font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 jrpg-shadow"
                      >
                        <PixelUiIcon name="map" className="w-3.5 h-3.5" />
                        <span>
                          {lead.verified ? 'Revoir sur la carte' : 'Suivre cette piste sur la carte'}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
