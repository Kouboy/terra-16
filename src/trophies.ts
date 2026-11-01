import React, { useEffect, useRef } from 'react';
import { computeExplorerHonorificTitle } from './explorerAvatar';
import {
  CollectedSpecimen,
  ExplorerGender,
  ExplorerProgress,
  LithologyAffinity,
  NpcEncounterRecord,
  OpenedArchivistChestRecord,
  TrophyId,
  UnlockedEntry,
} from './types';

export type TrophyTier = 'bronze' | 'silver' | 'gold' | 'obsidian';

export interface TrophyEvalContext {
  progress: ExplorerProgress;
  entries: UnlockedEntry[];
  specimens: CollectedSpecimen[];
  encounters: NpcEncounterRecord[];
  openedChests: OpenedArchivistChestRecord[];
  foundGeocacheIdsCount: number;
  fogCellsCount: number;
  claimedContractsCount: number;
}

export interface TrophyDefinition {
  id: TrophyId;
  name: string;
  tier: TrophyTier;
  titles: Record<ExplorerGender, string>;
  description: string;
  howToHint: string;
  unitLabel: string;
  target: number;
  evaluateCurrent: (ctx: TrophyEvalContext) => number;
}

export interface EvaluatedTrophy {
  trophy: TrophyDefinition;
  current: number;
  target: number;
  unlocked: boolean;
  ratio: number;
}

const ALL_SEVEN_ROCKS: LithologyAffinity[] = [
  'calcaire',
  'granit',
  'schiste',
  'gres',
  'alluvions',
  'volcanique',
  'souterrain',
];

function countNocturnalEntries(entries: UnlockedEntry[]): number {
  let count = 0;
  for (const e of entries) {
    if (!e.discoveredAtIso) continue;
    const d = new Date(e.discoveredAtIso);
    if (Number.isNaN(d.getTime())) continue;
    const h = d.getHours();
    if (h >= 21 || h < 6) count++;
  }
  return count;
}

function countSubterraneanFeats(
  entries: UnlockedEntry[],
  openedChests: OpenedArchivistChestRecord[],
  specimens: CollectedSpecimen[]
): number {
  let count = 0;
  for (const e of entries) {
    if (
      e.poiId.startsWith('subpoi_') ||
      /cavité|grotte|gouffre|aven|souterrain|crypte|hypogée|carrière|mine|aqueduc|ruisseau busé|cours enterré|canalisation|tunnel/i.test(
        `${e.subType} ${e.name} ${e.source}`
      )
    ) {
      count++;
    }
  }
  for (const ch of openedChests) {
    if (ch.isSubterranean || ch.archetype === 'bouche_souterraine') count++;
  }
  for (const sp of specimens) {
    if (sp.isSubterranean || sp.affinity === 'souterrain') count++;
  }
  return count;
}

function countGeodesicBenchmarks(entries: UnlockedEntry[]): number {
  let count = 0;
  for (const e of entries) {
    if (
      e.poiId.startsWith('ign_rn_') ||
      e.poiId.startsWith('ign_rdf_') ||
      /nivellement|géodésique|repère ign|borne géodésique|canevas ign/i.test(
        `${e.subType} ${e.name} ${e.source}`
      )
    ) {
      count++;
    }
  }
  return count;
}

function countVernacularHeritage(entries: UnlockedEntry[]): number {
  let count = 0;
  for (const e of entries) {
    if (
      /lavoir|four à pain|four banal|moulin|calvaire|croix de chemin|oratoire|fontaine|pigeonnier|colombier|puits ancien|halle ancienne|petit patrimoine/i.test(
        `${e.subType} ${e.name}`
      )
    ) {
      count++;
    }
  }
  return count;
}

function countDistinctRockAffinities(specimens: CollectedSpecimen[]): number {
  const seen = new Set<LithologyAffinity>();
  for (const sp of specimens) {
    if (ALL_SEVEN_ROCKS.includes(sp.affinity)) {
      seen.add(sp.affinity);
    }
  }
  return seen.size;
}

function countNaturalistFeats(
  entries: UnlockedEntry[],
  encounters: NpcEncounterRecord[]
): number {
  const wildSpecies = new Set<string>();
  for (const enc of encounters) {
    if (!enc.isHuman) wildSpecies.add(enc.kind);
  }
  let ecoSanctuaries = 0;
  for (const e of entries) {
    if (
      e.category === 'ecosysteme' ||
      /znieff|arbre remarquable|réserve naturelle|zone humide/i.test(`${e.subType} ${e.source}`)
    ) {
      ecoSanctuaries++;
    }
  }
  return wildSpecies.size + ecoSanctuaries;
}

export const TROPHIES_CATALOG: TrophyDefinition[] = [
  {
    id: 'oiseau_de_nuit',
    name: 'Oiseau de Nuit',
    tier: 'obsidian',
    titles: {
      feminin: 'Veilleuse Nocturne',
      masculin: 'Oiseau de Nuit',
      neutre: 'Sentinelle Nocturne',
    },
    description:
      'Briser des sceaux ou ouvrir des coffres à la lueur de la lanterne entre 21 h et l’aube.',
    howToHint: 'Explorez de nuit (21 h – 6 h) ou en ambiance nocturne sur le terrain.',
    unitLabel: 'exploits nocturnes',
    target: 5,
    evaluateCurrent: (ctx) =>
      Math.max(ctx.progress.nightFeatsCount || 0, countNocturnalEntries(ctx.entries)),
  },
  {
    id: 'marcheur_orage',
    name: 'Marcheur d’Orage',
    tier: 'silver',
    titles: {
      feminin: 'Marcheuse d’Orage',
      masculin: 'Marcheur d’Orage',
      neutre: 'Franchisseur d’Orage',
    },
    description:
      'Braver la pluie, l’orage, le brouillard épais ou la neige pour révéler des archives et coffres sur le terrain.',
    howToHint: 'Débloquez des lieux ou coffres lorsque la météo réelle indique pluie, orage, neige ou brume.',
    unitLabel: 'sorties sous intempéries',
    target: 4,
    evaluateCurrent: (ctx) => ctx.progress.stormFeatsCount || 0,
  },
  {
    id: 'speleologue',
    name: 'Spéléologue des Profondeurs',
    tier: 'obsidian',
    titles: {
      feminin: 'Spéléologue des Abysses',
      masculin: 'Spéléologue des Abysses',
      neutre: 'Sondeur des Abysses',
    },
    description:
      'Cartographier cavités karstiques, cryptes, galeries minières, rivières enterrées et reliques du Monde Souterrain.',
    howToHint: 'Basculez en vue Sous-sol et révélez cavités BRGM, cryptes, ruisseaux busés ou coffres d’abîme.',
    unitLabel: 'archives souterraines',
    target: 6,
    evaluateCurrent: (ctx) =>
      countSubterraneanFeats(ctx.entries, ctx.openedChests, ctx.specimens),
  },
  {
    id: 'arpenteur_10km',
    name: 'Semelles de Vent (10 km)',
    tier: 'bronze',
    titles: {
      feminin: 'Arpenteuse aux Semelles de Vent',
      masculin: 'Arpenteur aux Semelles de Vent',
      neutre: 'Marche-Vent des Chemins',
    },
    description:
      'Franchir le cap des 10 kilomètres cumulés à pied à travers bourgs, sentiers forestiers et vallées.',
    howToHint: 'Marchez en GPS réel ou en exploration pas-à-pas jusqu’à totaliser 10 000 m.',
    unitLabel: 'm parcourus',
    target: 10000,
    evaluateCurrent: (ctx) => Math.round(ctx.progress.walkedMeters || 0),
  },
  {
    id: 'grand_randonneur_50km',
    name: 'Grand Randonneur (50 km)',
    tier: 'gold',
    titles: {
      feminin: 'Grande Randonneuse des Contrées',
      masculin: 'Grand Randonneur des Contrées',
      neutre: 'Grand Randonneur des Contrées',
    },
    description:
      'Totaliser 50 kilomètres d’exploration pédestre attestée au podomètre du Grimoire.',
    howToHint: 'Poursuivez vos expéditions au long cours jusqu’à atteindre 50 000 m cumulés.',
    unitLabel: 'm parcourus',
    target: 50000,
    evaluateCurrent: (ctx) => Math.round(ctx.progress.walkedMeters || 0),
  },
  {
    id: 'maitre_7_roches',
    name: 'Maître des 7 Roches',
    tier: 'gold',
    titles: {
      feminin: 'Maîtresse des Sept Roches',
      masculin: 'Maître des Sept Roches',
      neutre: 'Sage des Sept Roches',
    },
    description:
      'Réunir dans l’Herbier & Lithothèque au moins un spécimen issu de chacune des 7 affinités lithologiques (Calcaire, Granit, Schiste, Grès, Alluvions, Volcanique, Souterrain).',
    howToHint: 'Voyagez sur différents socles géologiques et sous terre pour récolter les 7 familles de roches.',
    unitLabel: 'socles rocheux maîtrisés',
    target: 7,
    evaluateCurrent: (ctx) => countDistinctRockAffinities(ctx.specimens),
  },
  {
    id: 'chasseur_geodesique',
    name: 'Chasseur de Bornes Géodésiques',
    tier: 'silver',
    titles: {
      feminin: 'Chasseuse de Bornes IGN',
      masculin: 'Chasseur de Bornes IGN',
      neutre: 'Traqueur du Canevas IGN',
    },
    description:
      'Débusquer sur les façades, ponts et sommets les médaillons en bronze du Nivellement Général et les bornes géodésiques IGN.',
    howToHint: 'Repérez et débloquez les sceaux Géologie issus du Réseau Géodésique & Nivellement IGN.',
    unitLabel: 'repères IGN relevés',
    target: 4,
    evaluateCurrent: (ctx) => countGeodesicBenchmarks(ctx.entries),
  },
  {
    id: 'gardien_petit_patrimoine',
    name: 'Passeur du Petit Patrimoine',
    tier: 'bronze',
    titles: {
      feminin: 'Gardienne du Petit Patrimoine',
      masculin: 'Gardien du Petit Patrimoine',
      neutre: 'Passeur du Petit Patrimoine',
    },
    description:
      'Sauvegarder la mémoire des lavoirs, fours à pain, moulins à eau ou à vent, calvaires et fontaines miraculeuses.',
    howToHint: 'Explorez villages et vallons pour consigner lavoirs, fours banaux, moulins et fontaines.',
    unitLabel: 'joyaux ruraux consignés',
    target: 5,
    evaluateCurrent: (ctx) => countVernacularHeritage(ctx.entries),
  },
  {
    id: 'ouvreur_reliques',
    name: 'Découvreur de Coffres & Caches',
    tier: 'gold',
    titles: {
      feminin: 'Chercheuse de Reliques & Caches',
      masculin: 'Chercheur de Reliques & Caches',
      neutre: 'Découvreur de Reliques & Caches',
    },
    description:
      'Déterrer des Coffres d’Archiviste aux points géographiques remarquables ou localiser les Caches laissées par d’autres explorateurs.',
    howToHint: 'Suivez le détecteur de trésors vers les sommets, confluences, clairières et capsules joueurs.',
    unitLabel: 'trésors exhumés',
    target: 5,
    evaluateCurrent: (ctx) => ctx.openedChests.length + ctx.foundGeocacheIdsCount,
  },
  {
    id: 'leveur_brumes',
    name: 'Dissipateur de Terra Incognita',
    tier: 'silver',
    titles: {
      feminin: 'Éclaireuse de Terra Incognita',
      masculin: 'Éclaireur de Terra Incognita',
      neutre: 'Dissipateur des Brumes',
    },
    description:
      'Repousser le brouillard de guerre cartographique sur une vaste étendue de territoires vierges.',
    howToHint: 'Arpentez des rues et sentiers inexplorés pour dissiper 120 cellules de Terra Incognita.',
    unitLabel: 'cellules dévoilées',
    target: 120,
    evaluateCurrent: (ctx) => ctx.fogCellsCount,
  },
  {
    id: 'naturaliste_complet',
    name: 'Ami du Vivant & des Sanctuaires',
    tier: 'bronze',
    titles: {
      feminin: 'Naturaliste des Sanctuaires',
      masculin: 'Naturaliste des Sanctuaires',
      neutre: 'Naturaliste des Sanctuaires',
    },
    description:
      'Observer la faune sauvage du Bestiaire et consigner arbres remarquables ou zones naturelles ZNIEFF.',
    howToHint: 'Approchez la faune sur la carte et révélez des sanctuaires Écosystème / ZNIEFF.',
    unitLabel: 'espèces & sanctuaires',
    target: 8,
    evaluateCurrent: (ctx) => countNaturalistFeats(ctx.entries, ctx.encounters),
  },
  {
    id: 'champion_contrats',
    name: 'Éclaireur Assermenté',
    tier: 'gold',
    titles: {
      feminin: 'Éclaireuse Assermentée',
      masculin: 'Éclaireur Assermenté',
      neutre: 'Éclaireur Assermenté',
    },
    description:
      'Accomplir des Contrats de Terrain générés dynamiquement sur les reliefs, eaux et archives de votre secteur réel.',
    howToHint: 'Ouvrez l’onglet Quêtes et validez des Contrats de Terrain locaux (Triangulation, Coffre, Terroir).',
    unitLabel: 'contrats locaux validés',
    target: 3,
    evaluateCurrent: (ctx) =>
      Math.max(ctx.progress.completedContractsCount || 0, ctx.claimedContractsCount),
  },
];

export const TROPHY_TIER_META: Record<
  TrophyTier,
  {
    label: string;
    rimDark: string;
    rimMid: string;
    rimLight: string;
    coreBg: string;
    ribbonHex: string;
    textAccentClass: string;
  }
> = {
  bronze: {
    label: 'Bronze ciselé',
    rimDark: '#451a03',
    rimMid: '#b45309',
    rimLight: '#fbbf24',
    coreBg: '#291509',
    ribbonHex: '#991b1b',
    textAccentClass: 'text-amber-300',
  },
  silver: {
    label: 'Argent poli',
    rimDark: '#1e293b',
    rimMid: '#94a3b8',
    rimLight: '#f8fafc',
    coreBg: '#0f172a',
    ribbonHex: '#0369a1',
    textAccentClass: 'text-sky-200',
  },
  gold: {
    label: 'Or d’Archiviste',
    rimDark: '#713f12',
    rimMid: '#eab308',
    rimLight: '#fef08a',
    coreBg: '#271a05',
    ribbonHex: '#7e22ce',
    textAccentClass: 'text-yellow-300',
  },
  obsidian: {
    label: 'Obsidienne étoilée',
    rimDark: '#090d16',
    rimMid: '#4338ca',
    rimLight: '#a5b4fc',
    coreBg: '#111827',
    ribbonHex: '#be123c',
    textAccentClass: 'text-indigo-200',
  },
};

export function getTrophyById(id?: TrophyId | '' | null): TrophyDefinition | null {
  if (!id) return null;
  return TROPHIES_CATALOG.find((t) => t.id === id) || null;
}

export function evaluateAllTrophies(ctx: TrophyEvalContext): EvaluatedTrophy[] {
  return TROPHIES_CATALOG.map((trophy) => {
    const current = Math.max(0, trophy.evaluateCurrent(ctx));
    const unlocked = current >= trophy.target;
    const ratio = Math.min(1, trophy.target > 0 ? current / trophy.target : 1);
    return {
      trophy,
      current,
      target: trophy.target,
      unlocked,
      ratio,
    };
  });
}

export function getGenderedTrophyTitle(
  trophy: TrophyDefinition,
  gender?: ExplorerGender
): string {
  const g: ExplorerGender = gender || 'masculin';
  return trophy.titles[g] || trophy.titles.masculin;
}

/**
 * Resolves the explorer's active honorific title:
 * Uses the pinned trophy's gendered title if pinned & unlocked (or if unlockedSet is omitted),
 * otherwise falls back to the guild-based honorific title.
 */
export function resolveExplorerDisplayTitle(
  progress: ExplorerProgress,
  unlockedTrophyIds?: ReadonlySet<TrophyId>
): { title: string; pinnedTrophy: TrophyDefinition | null } {
  const candidate = getTrophyById(progress.pinnedTrophyId);
  if (candidate && (!unlockedTrophyIds || unlockedTrophyIds.has(candidate.id))) {
    return {
      title: getGenderedTrophyTitle(candidate, progress.gender),
      pinnedTrophy: candidate,
    };
  }
  return {
    title: computeExplorerHonorificTitle(progress),
    pinnedTrophy: null,
  };
}

/**
 * Draws a crisp 24x24 16-bit pixel-art medallion at (ox, oy) with integer pixel size `px`.
 * Total width/height = 24 * px.
 */
export function drawTrophyMedallion16Bit(
  ctx: CanvasRenderingContext2D,
  trophyId: TrophyId,
  ox: number,
  oy: number,
  px = 2,
  unlocked = true,
  shimmerPhase = 0
): void {
  const def = getTrophyById(trophyId) || TROPHIES_CATALOG[0];
  const tierMeta = TROPHY_TIER_META[def.tier];

  const rimDark = unlocked ? tierMeta.rimDark : '#1c1917';
  const rimMid = unlocked ? tierMeta.rimMid : '#44403c';
  const rimLight = unlocked ? tierMeta.rimLight : '#78716c';
  const coreBg = unlocked ? tierMeta.coreBg : '#18181b';
  const ribbonMain = unlocked ? tierMeta.ribbonHex : '#3f3f46';
  const ribbonDark = '#09090b';

  const p = (gx: number, gy: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(ox + gx * px), Math.round(oy + gy * px), Math.round(w * px), Math.round(h * px));
  };

  // 1. Top hanging silk ribbon (y = 0..5)
  p(7, 0, 10, 2, ribbonDark);
  p(8, 1, 8, 4, ribbonMain);
  p(11, 1, 2, 4, unlocked ? rimLight : '#52525b');
  p(9, 5, 6, 1, rimMid);

  // 2. Octagonal chiseled metallic medallion body (x = 3..20, y = 5..22)
  p(7, 5, 10, 18, rimDark);
  p(5, 6, 14, 16, rimDark);
  p(4, 7, 16, 14, rimDark);
  p(3, 9, 18, 10, rimDark);

  // Bevel ring
  p(7, 6, 10, 16, rimMid);
  p(5, 7, 14, 14, rimMid);
  p(4, 9, 16, 10, rimMid);

  // Specular top-left highlight
  p(7, 6, 6, 1, rimLight);
  p(5, 7, 3, 1, rimLight);
  p(4, 9, 1, 5, rimLight);

  // Inner recessed enamel core (center around 12, 14)
  p(7, 8, 10, 12, coreBg);
  p(6, 9, 12, 10, coreBg);
  p(5, 10, 14, 8, coreBg);

  // 3. Bespoke 16-bit Pixel Emblem inside core (x = 6..17, y = 9..19)
  const ink = (c: string) => (unlocked ? c : '#57534e');
  const hi = (c: string) => (unlocked ? c : '#a8a29e');

  switch (trophyId) {
    case 'oiseau_de_nuit': {
      // Crescent moon + golden lantern star
      p(8, 10, 5, 1, hi('#fef08a'));
      p(7, 11, 4, 2, hi('#fde047'));
      p(7, 13, 3, 3, hi('#facc15'));
      p(8, 16, 4, 2, hi('#eab308'));
      p(10, 17, 4, 1, hi('#fef08a'));
      // Twinkling stars
      p(14, 11, 2, 2, hi('#ffffff'));
      p(15, 15, 1, 1, ink('#93c5fd'));
      p(12, 13, 1, 1, ink('#fde68a'));
      break;
    }
    case 'marcheur_orage': {
      // Storm cloud + jagged golden lightning bolt
      p(7, 10, 9, 2, ink('#64748b'));
      p(6, 11, 11, 2, hi('#94a3b8'));
      p(12, 13, 3, 1, hi('#fef08a'));
      p(11, 14, 3, 1, hi('#fde047'));
      p(10, 15, 4, 1, hi('#facc15'));
      p(11, 16, 2, 1, hi('#fef08a'));
      p(10, 17, 2, 2, hi('#eab308'));
      // Raindrops
      p(7, 15, 1, 2, ink('#38bdf8'));
      p(15, 15, 1, 2, ink('#38bdf8'));
      break;
    }
    case 'speleologue': {
      // Stalactites + glowing amethyst/cyan crystal cluster
      p(7, 9, 2, 3, ink('#64748b'));
      p(15, 9, 2, 2, ink('#64748b'));
      p(11, 11, 2, 7, hi('#38bdf8'));
      p(11, 11, 1, 4, hi('#e0f2fe'));
      p(8, 13, 2, 5, ink('#a855f7'));
      p(14, 13, 2, 5, ink('#06b6d4'));
      p(7, 18, 10, 1, ink('#475569'));
      break;
    }
    case 'arpenteur_10km': {
      // Winged leather walker boot
      p(8, 11, 4, 5, ink('#b45309'));
      p(9, 11, 3, 2, hi('#f59e0b'));
      p(8, 15, 8, 3, ink('#92400e'));
      p(7, 18, 10, 1, hi('#fbbf24'));
      // White feather wing
      p(13, 11, 4, 1, hi('#f8fafc'));
      p(12, 12, 4, 1, hi('#e2e8f0'));
      p(12, 13, 3, 1, ink('#94a3b8'));
      break;
    }
    case 'grand_randonneur_50km': {
      // Twin mountain peaks + golden sun + winding trail
      p(14, 10, 3, 3, hi('#fde047'));
      p(6, 15, 7, 4, ink('#475569'));
      p(8, 12, 4, 3, ink('#64748b'));
      p(9, 11, 2, 2, hi('#f8fafc'));
      p(12, 14, 6, 5, ink('#334155'));
      p(14, 13, 2, 1, hi('#e2e8f0'));
      p(10, 16, 2, 3, hi('#fbbf24'));
      break;
    }
    case 'maitre_7_roches': {
      // Heptagonal prism / 7 colored mineral gems crown
      p(11, 10, 2, 2, hi('#f8fafc')); // Calcaire
      p(8, 11, 2, 2, hi('#fb7185')); // Granit
      p(14, 11, 2, 2, hi('#94a3b8')); // Schiste
      p(7, 14, 2, 2, hi('#fbbf24')); // Grès
      p(15, 14, 2, 2, hi('#38bdf8')); // Alluvions
      p(9, 17, 2, 2, hi('#f97316')); // Volcanique
      p(13, 17, 2, 2, hi('#c084fc')); // Souterrain
      p(10, 13, 4, 3, hi('#fef08a'));
      break;
    }
    case 'chasseur_geodesique': {
      // Bronze IGN benchmark disc + triangulation crosshair
      p(8, 10, 8, 8, ink('#b45309'));
      p(9, 11, 6, 6, hi('#f59e0b'));
      p(11, 10, 2, 8, ink('#451a03'));
      p(8, 13, 8, 2, ink('#451a03'));
      p(11, 13, 2, 2, hi('#fef08a'));
      break;
    }
    case 'gardien_petit_patrimoine': {
      // Stone fountain / lavoir arch with flowing azure water
      p(7, 10, 10, 2, hi('#d6d3d1'));
      p(7, 12, 2, 6, ink('#78716c'));
      p(15, 12, 2, 6, ink('#78716c'));
      p(11, 12, 2, 4, hi('#7dd3fc'));
      p(8, 16, 8, 2, hi('#0284c7'));
      p(9, 17, 6, 1, hi('#bae6fd'));
      break;
    }
    case 'ouvreur_reliques': {
      // Ornate golden Archivist Chest with glowing keyhole
      p(7, 11, 10, 3, hi('#f59e0b'));
      p(7, 14, 10, 5, ink('#92400e'));
      p(7, 13, 10, 1, hi('#fef08a'));
      p(11, 13, 2, 3, hi('#fef08a'));
      p(8, 11, 1, 8, hi('#fbbf24'));
      p(15, 11, 1, 8, hi('#fbbf24'));
      break;
    }
    case 'leveur_brumes': {
      // Compass rose parting silver clouds
      p(11, 9, 2, 10, hi('#fde047'));
      p(7, 13, 10, 2, hi('#fde047'));
      p(10, 12, 4, 4, ink('#0284c7'));
      p(11, 13, 2, 2, hi('#ffffff'));
      p(6, 10, 3, 2, ink('#94a3b8'));
      p(15, 17, 3, 2, ink('#94a3b8'));
      break;
    }
    case 'naturaliste_complet': {
      // Emerald oak leaf + golden acorn
      p(11, 10, 4, 2, hi('#4ade80'));
      p(9, 11, 6, 3, ink('#16a34a'));
      p(8, 13, 6, 3, hi('#22c55e'));
      p(9, 16, 4, 1, ink('#15803d'));
      p(8, 17, 2, 2, ink('#b45309'));
      p(11, 12, 1, 5, hi('#bbf7d0'));
      break;
    }
    case 'champion_contrats': {
      // Wax-sealed parchment scroll + golden star
      p(8, 10, 8, 8, hi('#fef3c7'));
      p(7, 10, 10, 1, ink('#d97706'));
      p(7, 18, 10, 1, ink('#d97706'));
      p(9, 12, 6, 1, ink('#78350f'));
      p(9, 14, 5, 1, ink('#78350f'));
      p(13, 15, 3, 3, hi('#e11d48'));
      p(14, 16, 1, 1, hi('#fecdd3'));
      break;
    }
  }

  // Optional subtle shimmer pixel on unlocked gold/obsidian badges
  if (unlocked && shimmerPhase > 0) {
    const sx = 6 + (Math.floor(shimmerPhase) % 11);
    p(sx, 7, 1, 1, '#ffffff');
  }
}

export const TrophyBadgeCanvas: React.FC<{
  trophyId: TrophyId;
  unlocked?: boolean;
  pixelScale?: number;
  className?: string;
}> = ({ trophyId, unlocked = true, pixelScale = 2, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const size = 24 * pixelScale;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    drawTrophyMedallion16Bit(ctx, trophyId, 0, 0, pixelScale, unlocked, 0);
  }, [trophyId, unlocked, pixelScale, size]);

  return React.createElement('canvas', {
    ref: canvasRef,
    width: size,
    height: size,
    className: `shrink-0 [image-rendering:pixelated] ${className}`,
    'aria-hidden': 'true',
  });
};
