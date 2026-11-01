import React, { useEffect, useMemo, useState } from 'react';
import { playSpecimenHarvestSfx } from '../sound';
import {
  classifySectorLithology,
  LITHOLOGY_AFFINITY_META,
  SPECIMENS_CATALOG,
  SpecimenPlateCanvas,
  translateBedrockPeriodFr,
  translateLithologyLabelFr,
} from '../specimens';
import {
  BedrockInfo,
  CollectedSpecimen,
  PostcardSubject,
  SpecimenDomain,
  TerrainFeature,
} from '../types';
import { ParchmentScrollStrip } from './ParchmentScrollStrip';
import { PixelCornerRivets, PixelUiIcon } from './PixelIcons';

type DomainFilter = 'all' | SpecimenDomain;

export const HerbariumLithothequeView: React.FC<{
  specimens: CollectedSpecimen[];
  bedrock: BedrockInfo | null;
  terrain: TerrainFeature[];
  currentRegionLabel: string;
  muted: boolean;
  onFocusLocationOnMap: (lat: number, lng: number, isSubterranean: boolean) => void;
  onOpenPostcard?: (subject: PostcardSubject) => void;
}> = ({
  specimens,
  bedrock,
  terrain,
  currentRegionLabel,
  muted,
  onFocusLocationOnMap,
  onOpenPostcard,
}) => {
  const [domainFilter, setDomainFilter] = useState<DomainFilter>('all');
  const [selectedId, setSelectedId] = useState<string>(SPECIMENS_CATALOG[0].id);
  const [animTick, setAnimTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setAnimTick((t) => (t + 1) % 240);
    }, 520);
    return () => window.clearInterval(id);
  }, []);

  const specimenMap = useMemo(() => {
    const map = new Map<string, CollectedSpecimen>();
    for (const sp of specimens) {
      map.set(sp.specimenId, sp);
    }
    return map;
  }, [specimens]);

  const currentAffinity = useMemo(
    () => classifySectorLithology(bedrock, terrain),
    [bedrock, terrain]
  );
  const currentMeta = LITHOLOGY_AFFINITY_META[currentAffinity];
  const currentLithoFr = translateLithologyLabelFr(bedrock, currentAffinity);
  const currentPeriodFr = translateBedrockPeriodFr(bedrock?.period);

  const botCount = useMemo(
    () =>
      SPECIMENS_CATALOG.filter((c) => c.domain === 'botanique' && specimenMap.has(c.id)).length,
    [specimenMap]
  );
  const geoCount = useMemo(
    () =>
      SPECIMENS_CATALOG.filter((c) => c.domain === 'geologie' && specimenMap.has(c.id)).length,
    [specimenMap]
  );

  const visibleCatalog = useMemo(
    () =>
      SPECIMENS_CATALOG.filter((item) => domainFilter === 'all' || item.domain === domainFilter),
    [domainFilter]
  );

  const selectedMeta = useMemo(
    () =>
      visibleCatalog.find((c) => c.id === selectedId) ||
      SPECIMENS_CATALOG.find((c) => c.id === selectedId) ||
      visibleCatalog[0] ||
      SPECIMENS_CATALOG[0],
    [visibleCatalog, selectedId]
  );

  const selectedCollected = specimenMap.get(selectedMeta.id) || null;

  return (
    <div className="space-y-4">
      {/* Real Bedrock & Soil Diagnostic Banner for Current Sector */}
      <div className="relative grimoire-folio-gold p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <PixelCornerRivets className="bg-[#d97706]" />
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
            <PixelUiIcon name="mineral" className="w-4 h-4" />
            <span>Sous-sol réel du secteur · {currentRegionLabel}</span>
          </div>
          <div className="text-sm sm:text-base font-bold font-display text-[#24160c]">
            {currentLithoFr} · {currentPeriodFr}
            {bedrock?.ageRangeMa ? ` (${bedrock.ageRangeMa})` : ''}
          </div>
          <p className="text-xs text-[#54361d] leading-relaxed">
            {currentMeta.soilNoteFr}. Cliquez sur les touffes botaniques et affleurements rocheux
            visibles sur la carte 16-bit pour prélever croquis et échantillons.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-4 border-t md:border-t-0 md:border-l border-[#c89d62] pt-2.5 md:pt-0 md:pl-4">
          <div className="text-left md:text-right">
            <div className="text-[11px] font-semibold text-[#6b4928]">Herbier</div>
            <div className="text-base font-bold font-mono tabular-nums text-emerald-950">
              {botCount}/8
            </div>
          </div>
          <div className="text-left md:text-right">
            <div className="text-[11px] font-semibold text-[#6b4928]">Lithothèque</div>
            <div className="text-base font-bold font-mono tabular-nums text-amber-950">
              {geoCount}/8
            </div>
          </div>
        </div>
      </div>

      {/* Domain Filter Strip */}
      <ParchmentScrollStrip fadeColorFrom="vellum">
        <div className="flex items-center gap-2 min-w-max">
          <button
            type="button"
            onClick={() => setDomainFilter('all')}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-bold border-2 border-[#2b1a0e] inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
              domainFilter === 'all'
                ? 'bg-[#28160d] text-amber-300 jrpg-shadow'
                : 'bg-[#ecd8b1] text-[#3d2512] hover:bg-[#fffbeb]'
            }`}
          >
            <PixelUiIcon name="book" className="w-4 h-4" />
            <span>Toutes les planches</span>
            <span className="font-mono tabular-nums opacity-85">
              {botCount + geoCount}/{SPECIMENS_CATALOG.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setDomainFilter('botanique')}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-bold border-2 border-[#2b1a0e] inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
              domainFilter === 'botanique'
                ? 'bg-emerald-900 text-[#fffbeb] jrpg-shadow'
                : 'bg-[#ecd8b1] text-[#3d2512] hover:bg-[#fffbeb]'
            }`}
          >
            <PixelUiIcon name="leaf" className="w-4 h-4" />
            <span>Herbier botanique</span>
            <span className="font-mono tabular-nums opacity-85">{botCount}/8</span>
          </button>

          <button
            type="button"
            onClick={() => setDomainFilter('geologie')}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-bold border-2 border-[#2b1a0e] inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
              domainFilter === 'geologie'
                ? 'bg-[#92400e] text-[#fffbeb] jrpg-shadow'
                : 'bg-[#ecd8b1] text-[#3d2512] hover:bg-[#fffbeb]'
            }`}
          >
            <PixelUiIcon name="mineral" className="w-4 h-4" />
            <span>Échantillons géologiques</span>
            <span className="font-mono tabular-nums opacity-85">{geoCount}/8</span>
          </button>
        </div>
      </ParchmentScrollStrip>

      {/* Main Two-Column Plate Grid + Detailed Folio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 grimoire-folio p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {visibleCatalog.map((item) => {
            const rec = specimenMap.get(item.id);
            const isCollected = Boolean(rec);
            const isSelected = selectedMeta.id === item.id;
            const matchesHere =
              item.affinity === currentAffinity ||
              Boolean(item.secondaryAffinities?.includes(currentAffinity));

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedId(item.id);
                  if (isCollected) {
                    playSpecimenHarvestSfx(muted, item.domain === 'geologie');
                  }
                }}
                className={`text-left p-3 border-2 transition-transform duration-150 hover:-translate-y-0.5 flex flex-col gap-2 ${
                  isSelected
                    ? 'bg-amber-200/90 border-[#991b1b] jrpg-shadow'
                    : isCollected
                    ? 'bg-[#fbf4e3] border-[#6b4928] hover:bg-[#fffbeb]'
                    : 'bg-[#e6d3b0]/75 border-[#8c653b]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <SpecimenPlateCanvas
                    specimenId={item.id}
                    affinity={rec?.affinity || item.affinity}
                    isSubterranean={item.isSubterranean}
                    silhouette={!isCollected}
                    animTick={isCollected ? animTick : 0}
                    className="w-12 h-12"
                  />
                  <div className="text-right space-y-0.5">
                    <div
                      className={`text-[11px] font-mono tabular-nums font-bold ${
                        isCollected ? 'text-emerald-900' : 'text-[#78532f]'
                      }`}
                    >
                      {isCollected ? `×${rec!.harvestCount}` : '?'}
                    </div>
                    {!isCollected && matchesHere && !item.isSubterranean && (
                      <div className="text-[10px] font-bold text-amber-900">Ici</div>
                    )}
                  </div>
                </div>

                <div className="min-w-0 space-y-0.5">
                  <div className="text-xs font-bold text-[#24160c] truncate">
                    {isCollected ? item.name : item.domain === 'botanique' ? 'Croquis à relever' : 'Roche à prélever'}
                  </div>
                  <div className="text-[11px] italic text-[#54361d] truncate">
                    {isCollected
                      ? item.latinOrMineralName
                      : LITHOLOGY_AFFINITY_META[item.affinity].labelFr}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Specimen Folio */}
        <div className="lg:col-span-5 relative grimoire-folio-crimson p-5 space-y-4">
          <PixelCornerRivets className="bg-[#b91c1c]" />

          <div className="flex items-center gap-3.5 border-b border-[#c89d62] pb-3.5">
            <SpecimenPlateCanvas
              specimenId={selectedMeta.id}
              affinity={selectedCollected?.affinity || selectedMeta.affinity}
              isSubterranean={selectedMeta.isSubterranean}
              silhouette={!selectedCollected}
              animTick={selectedCollected ? animTick : 0}
              className="w-16 h-16"
            />
            <div className="min-w-0 space-y-0.5">
              <div className="text-xs font-bold text-rose-900">
                {selectedMeta.familyLabel}
                {selectedMeta.isSubterranean ? ' · Sous-sol' : ''}
              </div>
              <h3 className="text-lg font-bold font-display text-[#24160c]">
                {selectedCollected ? selectedMeta.name : `? ${selectedMeta.familyLabel}`}
              </h3>
              <div className="text-xs italic text-[#54361d]">
                {selectedCollected
                  ? selectedMeta.latinOrMineralName
                  : LITHOLOGY_AFFINITY_META[selectedMeta.affinity].labelFr}
              </div>
            </div>
          </div>

          {selectedCollected ? (
            <>
              <div className="text-xs text-[#54361d] leading-relaxed">
                <span className="font-bold text-emerald-900">
                  Prélevé {selectedCollected.harvestCount} fois
                </span>
                <span aria-hidden="true"> · </span>
                <span>{selectedCollected.regionLabel}</span>
                {selectedCollected.altitudeMeters !== null && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono tabular-nums">
                      Alt. {selectedCollected.altitudeMeters} m
                    </span>
                  </>
                )}
              </div>

              <div className="p-3 bg-[#ecd8b1] border-2 border-[#6b4928] space-y-1">
                <div className="text-[11px] font-bold text-[#6b4928]">
                  Substrat géologique d’origine
                </div>
                <div className="text-xs font-bold text-[#24160c]">
                  {selectedCollected.lithologyLabel} · {selectedCollected.bedrockPeriod}
                  {selectedCollected.bedrockAgeMa ? ` (${selectedCollected.bedrockAgeMa})` : ''}
                </div>
                <div className="text-[11px] text-[#54361d]">{selectedCollected.habitatLabel}</div>
              </div>

              <div className="space-y-2 border-y border-[#c89d62] py-3.5">
                <div className="text-xs font-bold text-amber-950">
                  Observation de terrain
                </div>
                <p className="text-xs sm:text-sm text-[#24160c] leading-relaxed">
                  {selectedCollected.description}
                </p>
              </div>

              <div className="space-y-2 pt-0.5">
                <div className="text-xs font-mono tabular-nums text-[#54361d]">
                  Dernier relevé :{' '}
                  {new Date(selectedCollected.lastCollectedIso).toLocaleDateString('fr-FR')}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onFocusLocationOnMap(
                        selectedCollected.lat,
                        selectedCollected.lng,
                        selectedCollected.isSubterranean
                      )
                    }
                    className="min-h-[40px] px-3 py-2 text-xs font-bold bg-[#28160d] hover:bg-[#3f2416] text-amber-300 border-2 border-[#d97706] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 jrpg-shadow"
                  >
                    <PixelUiIcon name="map" className="w-3.5 h-3.5" />
                    <span>Voir le gisement</span>
                  </button>
                  {onOpenPostcard && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenPostcard({ kind: 'specimen', specimen: selectedCollected })
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
                {selectedMeta.domain === 'botanique'
                  ? 'Cette feuille d’herbier est encore vierge. Arpentez une région au sous-sol correspondant et cliquez sur une touffe botanique sur la carte.'
                  : 'Ce casier minéralogique attend son premier échantillon. Explorez un affleurement sur le socle géologique correspondant.'}
              </p>
              <div className="pt-3 border-t border-[#c89d62] space-y-1">
                <div className="text-xs font-bold text-amber-950">
                  Indice lithologique ({LITHOLOGY_AFFINITY_META[selectedMeta.affinity].labelFr})
                </div>
                <p className="text-xs text-[#3b2312] leading-relaxed">{selectedMeta.clueHint}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
