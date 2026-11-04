import React, { useEffect, useMemo, useState } from 'react';
import {
  ALCHEMY_RECIPES,
  AlchemyRecipe,
  canCraftAlchemyRecipe,
  computeAlchemyFieldBonuses,
  FamiliarAuraId,
  PassportStampCanvas,
  RegionalPassportStamp,
} from '../alchemyAndPassport';
import { playSpecimenHarvestSfx, playStampSfx } from '../sound';
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
export type HerbariumSectionTab = 'planches' | 'alchimie' | 'passeport';

const AURA_LABELS: Record<FamiliarAuraId, { label: string; desc: string }> = {
  aucune: { label: 'Aucune aura', desc: 'Allure naturelle du familier' },
  solaire: { label: 'Aura Solaire', desc: 'Lucioles dorées autour du familier' },
  sylvestre: { label: 'Aura Sylvestre', desc: 'Éclats émeraude des landes' },
  astrale: { label: 'Aura Astrale', desc: 'Halo cyan phosphorescent' },
};

export const HerbariumLithothequeView: React.FC<{
  specimens: CollectedSpecimen[];
  bedrock: BedrockInfo | null;
  terrain: TerrainFeature[];
  currentRegionLabel: string;
  muted: boolean;
  craftedAlchemyIds?: ReadonlySet<string>;
  activeFamiliarAura?: FamiliarAuraId;
  passportStamps?: RegionalPassportStamp[];
  initialSection?: HerbariumSectionTab;
  onCraftAlchemyRecipe?: (recipe: AlchemyRecipe) => void;
  onSelectFamiliarAura?: (aura: FamiliarAuraId) => void;
  onFocusLocationOnMap: (lat: number, lng: number, isSubterranean: boolean) => void;
  onOpenPostcard?: (subject: PostcardSubject) => void;
}> = ({
  specimens,
  bedrock,
  terrain,
  currentRegionLabel,
  muted,
  craftedAlchemyIds = new Set<string>(),
  activeFamiliarAura = 'aucune',
  passportStamps = [],
  initialSection = 'planches',
  onCraftAlchemyRecipe,
  onSelectFamiliarAura,
  onFocusLocationOnMap,
  onOpenPostcard,
}) => {
  const [section, setSection] = useState<HerbariumSectionTab>(initialSection);
  const [domainFilter, setDomainFilter] = useState<DomainFilter>('all');
  const [selectedId, setSelectedId] = useState<string>(SPECIMENS_CATALOG[0].id);
  const [animTick, setAnimTick] = useState(0);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

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

  const catalogById = useMemo(
    () => new Map(SPECIMENS_CATALOG.map((item) => [item.id, item])),
    []
  );

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

  const alchemyBonuses = useMemo(
    () => computeAlchemyFieldBonuses(craftedAlchemyIds),
    [craftedAlchemyIds]
  );

  const readyToCraftCount = useMemo(
    () =>
      ALCHEMY_RECIPES.filter(
        (r) => !craftedAlchemyIds.has(r.id) && canCraftAlchemyRecipe(r, specimens).canCraft
      ).length,
    [craftedAlchemyIds, specimens]
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
          <div className="text-sm sm:text-base font-bold font-display text-[#24160c] break-words">
            {currentLithoFr} · {currentPeriodFr}
            {bedrock?.ageRangeMa ? ` (${bedrock.ageRangeMa})` : ''}
          </div>
          <p className="text-xs text-[#54361d] leading-relaxed break-words">
            {currentMeta.soilNoteFr}. Combinez vos trouvailles botaniques et minérales à l’Atelier
            d’Alchimie ou collectionnez les tampons d’encre régionaux de votre Passeport.
          </p>
        </div>

        <div className="shrink-0 flex flex-wrap items-center gap-4 border-t md:border-t-0 md:border-l border-[#c89d62] pt-2.5 md:pt-0 md:pl-4">
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
          <div className="text-left md:text-right">
            <div className="text-[11px] font-semibold text-[#6b4928]">Alchimie</div>
            <div className="text-base font-bold font-mono tabular-nums text-rose-950">
              {craftedAlchemyIds.size}/{ALCHEMY_RECIPES.length}
            </div>
          </div>
          <div className="text-left md:text-right">
            <div className="text-[11px] font-semibold text-[#6b4928]">Tampons</div>
            <div className="text-base font-bold font-mono tabular-nums text-[#24160c]">
              {passportStamps.length}
            </div>
          </div>
        </div>
      </div>

      {/* Top Section Switcher: Planches · Atelier d'Alchimie · Passeport & Tampons */}
      <ParchmentScrollStrip fadeColorFrom="vellum">
        <div className="flex items-center gap-2 min-w-max">
          <button
            type="button"
            onClick={() => setSection('planches')}
            className={`min-h-[42px] px-3.5 py-2 text-xs font-bold border-2 border-[#2b1a0e] inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
              section === 'planches'
                ? 'bg-[#28160d] text-amber-300 jrpg-shadow'
                : 'bg-[#ecd8b1] text-[#3d2512] hover:bg-[#fffbeb]'
            }`}
          >
            <PixelUiIcon name="leaf" className="w-4 h-4" />
            <span>Planches (Herbier & Roches)</span>
            <span className="font-mono tabular-nums opacity-85">
              {botCount + geoCount}/{SPECIMENS_CATALOG.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSection('alchimie')}
            className={`min-h-[42px] px-3.5 py-2 text-xs font-bold border-2 border-[#2b1a0e] inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
              section === 'alchimie'
                ? 'bg-[#7c2d12] text-[#fffbeb] jrpg-shadow'
                : 'bg-[#ecd8b1] text-[#3d2512] hover:bg-[#fffbeb]'
            }`}
          >
            <PixelUiIcon name="star" className="w-4 h-4" />
            <span>Atelier d’Alchimie</span>
            <span className="font-mono tabular-nums opacity-90">
              {craftedAlchemyIds.size}/{ALCHEMY_RECIPES.length}
              {readyToCraftCount > 0 ? ` (+${readyToCraftCount} prête)` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSection('passeport')}
            className={`min-h-[42px] px-3.5 py-2 text-xs font-bold border-2 border-[#2b1a0e] inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
              section === 'passeport'
                ? 'bg-[#991b1b] text-[#fffbeb] jrpg-shadow'
                : 'bg-[#ecd8b1] text-[#3d2512] hover:bg-[#fffbeb]'
            }`}
          >
            <PixelUiIcon name="stamp" className="w-4 h-4" />
            <span>Passeport & Tampons régionaux</span>
            <span className="font-mono tabular-nums opacity-90">{passportStamps.length}</span>
          </button>
        </div>
      </ParchmentScrollStrip>

      {/* ====================================================================
          SECTION 1 : PLANCHES (HERBIER & LITHOTHÈQUE)
          ==================================================================== */}
      {section === 'planches' && (
        <>
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
                        {isCollected
                          ? item.name
                          : item.domain === 'botanique'
                          ? 'Croquis à relever'
                          : 'Roche à prélever'}
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
                  <h3 className="text-lg font-bold font-display text-[#24160c] break-words">
                    {selectedCollected ? selectedMeta.name : `? ${selectedMeta.familyLabel}`}
                  </h3>
                  <div className="text-xs italic text-[#54361d] break-words">
                    {selectedCollected
                      ? selectedMeta.latinOrMineralName
                      : LITHOLOGY_AFFINITY_META[selectedMeta.affinity].labelFr}
                  </div>
                </div>
              </div>

              {selectedCollected ? (
                <>
                  <div className="text-xs text-[#54361d] leading-relaxed break-words">
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
                    <div className="text-xs font-bold text-[#24160c] break-words">
                      {selectedCollected.lithologyLabel} · {selectedCollected.bedrockPeriod}
                      {selectedCollected.bedrockAgeMa ? ` (${selectedCollected.bedrockAgeMa})` : ''}
                    </div>
                    <div className="text-[11px] text-[#54361d] break-words">
                      {selectedCollected.habitatLabel}
                    </div>
                  </div>

                  <div className="space-y-2 border-y border-[#c89d62] py-3.5">
                    <div className="text-xs font-bold text-amber-950">Observation de terrain</div>
                    <p className="text-xs sm:text-sm text-[#24160c] leading-relaxed break-words">
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
                  <p className="text-xs sm:text-sm text-[#3b2312] leading-relaxed break-words">
                    {selectedMeta.domain === 'botanique'
                      ? 'Cette feuille d’herbier est encore vierge. Arpentez une région au sous-sol correspondant et cliquez sur une touffe botanique sur la carte.'
                      : 'Ce casier minéralogique attend son premier échantillon. Explorez un affleurement sur le socle géologique correspondant.'}
                  </p>
                  <div className="pt-3 border-t border-[#c89d62] space-y-1">
                    <div className="text-xs font-bold text-amber-950">
                      Indice lithologique ({LITHOLOGY_AFFINITY_META[selectedMeta.affinity].labelFr})
                    </div>
                    <p className="text-xs text-[#3b2312] leading-relaxed break-words">
                      {selectedMeta.clueHint}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ====================================================================
          SECTION 2 : ATELIER D'ALCHIMIE NATURALISTE (ENCRES & TALISMANS)
          ==================================================================== */}
      {section === 'alchimie' && (
        <div className="space-y-4">
          <div className="grimoire-folio p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#c89d62] pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold font-display text-[#24160c]">
                  Mortier & Alambic du Naturaliste
                </h3>
                <p className="text-xs text-[#54361d] leading-relaxed">
                  Associez une plante de votre Herbier et une roche de votre Lithothèque pour
                  préparer des encres d’enluminure et des talismans d’aura pour votre familier.
                </p>
              </div>
              <div className="text-xs font-mono font-bold text-emerald-950 shrink-0">
                Bonus actifs : +{alchemyBonuses.xpBonusPct}% XP · +{alchemyBonuses.fogBonusMeters} m
                brume · +{alchemyBonuses.lanternSenseBonusMeters} m lanterne
              </div>
            </div>

            {/* Active Familiar Aura Selector */}
            {onSelectFamiliarAura && (
              <div className="grimoire-well p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-[#24160c] flex items-center gap-1.5">
                    <PixelUiIcon name="paw" className="w-4 h-4" />
                    <span>Aura alchimique équipée sur votre Familier</span>
                  </div>
                  <div className="text-[11px] text-[#54361d]">
                    {AURA_LABELS[activeFamiliarAura]?.desc}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {alchemyBonuses.unlockedFamiliarAuras.map((auraId) => (
                    <button
                      key={auraId}
                      type="button"
                      onClick={() => {
                        onSelectFamiliarAura(auraId);
                        playSpecimenHarvestSfx(muted, false);
                      }}
                      className={`min-h-[38px] px-3 py-1.5 text-xs font-bold border-2 border-[#2b1a0e] whitespace-nowrap ${
                        activeFamiliarAura === auraId
                          ? 'bg-[#28160d] text-amber-300 jrpg-shadow'
                          : 'bg-[#fffbeb] text-[#24160c] hover:bg-amber-100'
                      }`}
                    >
                      {AURA_LABELS[auraId].label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 6 Naturalist Recipes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ALCHEMY_RECIPES.map((recipe) => {
              const isCrafted = craftedAlchemyIds.has(recipe.id);
              const check = canCraftAlchemyRecipe(recipe, specimens);
              const botNames = recipe.botanicalOptions
                .map((id) => catalogById.get(id)?.name || id)
                .join(' ou ');
              const geoNames = recipe.geologicalOptions
                .map((id) => catalogById.get(id)?.name || id)
                .join(' ou ');

              return (
                <div
                  key={recipe.id}
                  className={`relative p-4 flex flex-col justify-between gap-3 ${
                    isCrafted ? 'grimoire-folio-gold' : 'grimoire-folio'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-9 h-9 shrink-0 border-2 border-[#2b1a0e] flex items-center justify-center jrpg-shadow"
                          style={{ backgroundColor: recipe.swatchPrimary }}
                        >
                          <div
                            className="w-3.5 h-3.5 border border-[#140b05]"
                            style={{ backgroundColor: recipe.swatchSecondary }}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-[#6b4928]">
                            {recipe.category === 'encre_carte'
                              ? 'Encre d’enluminure · Carte postale'
                              : 'Talisman de terrain · Aura de familier'}
                          </div>
                          <h4 className="text-sm font-bold font-display text-[#24160c] break-words">
                            {recipe.nameFr}
                          </h4>
                        </div>
                      </div>

                      <div
                        className={`text-[11px] font-bold font-mono shrink-0 ${
                          isCrafted
                            ? 'text-emerald-900'
                            : check.canCraft
                            ? 'text-amber-900'
                            : 'text-[#78532f]'
                        }`}
                      >
                        {isCrafted ? 'Préparé' : check.canCraft ? 'Prêt' : 'À récolter'}
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-emerald-950 leading-snug break-words">
                      {recipe.effectSummaryFr}
                    </p>
                    <p className="text-xs italic text-[#54361d] leading-relaxed break-words">
                      {recipe.loreFr}
                    </p>

                    <div className="grimoire-well p-2.5 space-y-1 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[#54361d] break-words">
                          <strong className="text-[#24160c]">Flore :</strong> {botNames}
                        </span>
                        <span
                          className={`font-mono font-bold shrink-0 ${
                            check.matchedBotanical ? 'text-emerald-900' : 'text-rose-900'
                          }`}
                        >
                          {check.matchedBotanical ? 'OK' : 'Manquant'}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[#54361d] break-words">
                          <strong className="text-[#24160c]">Minéral :</strong> {geoNames}
                        </span>
                        <span
                          className={`font-mono font-bold shrink-0 ${
                            check.matchedGeological ? 'text-emerald-900' : 'text-rose-900'
                          }`}
                        >
                          {check.matchedGeological ? 'OK' : 'Manquant'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-end gap-2">
                    {isCrafted ? (
                      recipe.unlocksFamiliarAura && onSelectFamiliarAura ? (
                        <button
                          type="button"
                          onClick={() => onSelectFamiliarAura(recipe.unlocksFamiliarAura!)}
                          className={`min-h-[40px] px-3.5 py-2 text-xs font-bold border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 whitespace-nowrap jrpg-shadow ${
                            activeFamiliarAura === recipe.unlocksFamiliarAura
                              ? 'bg-emerald-900 text-[#fffbeb]'
                              : 'bg-[#ecd8b1] text-[#24160c] hover:bg-[#fffbeb]'
                          }`}
                        >
                          <PixelUiIcon name="paw" className="w-3.5 h-3.5" />
                          <span>
                            {activeFamiliarAura === recipe.unlocksFamiliarAura
                              ? 'Aura équipée'
                              : 'Équiper cette aura'}
                          </span>
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-emerald-900">
                          Disponible dans l’Atelier de Carte postale
                        </span>
                      )
                    ) : (
                      <button
                        type="button"
                        disabled={!check.canCraft || !onCraftAlchemyRecipe}
                        onClick={() => {
                          if (!onCraftAlchemyRecipe || !check.canCraft) return;
                          playStampSfx(muted);
                          onCraftAlchemyRecipe(recipe);
                        }}
                        className={`min-h-[40px] px-4 py-2 text-xs font-bold border-2 border-[#2b1a0e] inline-flex items-center gap-1.5 whitespace-nowrap ${
                          check.canCraft
                            ? 'bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] jrpg-shadow'
                            : 'bg-[#d6c3a3]/60 text-[#78532f] cursor-not-allowed'
                        }`}
                      >
                        <PixelUiIcon name="star" className="w-3.5 h-3.5" />
                        <span>
                          {check.canCraft ? 'Préparer au mortier' : 'Ingrédients requis'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ====================================================================
          SECTION 3 : PASSEPORT D'ÉCLAIREUR & TAMPONS D'ENCRE RÉGIONAUX 16-BIT
          ==================================================================== */}
      {section === 'passeport' && (
        <div className="space-y-4">
          <div className="grimoire-folio-gold p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-bold font-display text-[#24160c] flex items-center gap-2">
                <PixelUiIcon name="stamp" className="w-4 h-4" />
                <span>Passeport d’Éclaireur · Visas Géologiques & Communaux</span>
              </h3>
              <p className="text-xs text-[#54361d] leading-relaxed">
                Chaque commune ou contrée arpentée appose dans votre carnet un cachet d’encre 16-bit
                teinté selon le socle rocheux local (calcaire, granit, schiste, basalte ou alluvions).
              </p>
            </div>
            <div className="text-xs font-mono font-bold text-[#24160c] shrink-0">
              {passportStamps.length}{' '}
              {passportStamps.length > 1 ? 'contrées tamponnées' : 'contrée tamponnée'}
            </div>
          </div>

          {passportStamps.length === 0 ? (
            <div className="grimoire-folio p-6 text-center space-y-2">
              <div className="text-sm font-bold font-display text-[#24160c]">
                Première page du Passeport prête à être encrée
              </div>
              <p className="text-xs text-[#54361d] max-w-md mx-auto leading-relaxed">
                Explorez un secteur sur la carte ou révélez un lieu d’intérêt pour recevoir
                automatiquement le tampon postal et géologique de la commune.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {passportStamps.map((stamp) => (
                <div
                  key={stamp.stampKey}
                  className="grimoire-folio p-4 flex items-center gap-3.5 justify-between"
                >
                  <PassportStampCanvas stamp={stamp} className="w-24 h-24" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-sm font-bold font-display text-[#24160c] break-words">
                      {stamp.localityName}
                    </div>
                    {stamp.regionSubtitle && (
                      <div className="text-[11px] text-[#54361d] break-words">
                        {stamp.regionSubtitle}
                      </div>
                    )}
                    <div className="text-[11px] font-semibold text-amber-950 break-words">
                      {stamp.lithologyLabelFr}
                      {stamp.altitudeMeters !== null ? ` · Alt. ${stamp.altitudeMeters} m` : ''}
                    </div>
                    <div className="text-[11px] font-mono text-[#6b4928]">
                      Visé le {new Date(stamp.firstStampedIso).toLocaleDateString('fr-FR')} ·{' '}
                      {stamp.discoveriesHere}{' '}
                      {stamp.discoveriesHere > 1 ? 'découvertes' : 'découverte'}
                    </div>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onFocusLocationOnMap(stamp.lat, stamp.lng, false)}
                        className="min-h-[36px] px-2.5 py-1 text-[11px] font-bold bg-[#ecd8b1] hover:bg-[#fffbeb] text-[#24160c] border-2 border-[#2b1a0e] inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <PixelUiIcon name="map" className="w-3.5 h-3.5" />
                        <span>Revoir sur la carte</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
