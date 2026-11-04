import React, { useEffect, useRef } from 'react';
import { SeasonKey } from './astronomyAndSeasons';
import { LITHOLOGY_AFFINITY_META } from './specimens';
import { CollectedSpecimen, LithologyAffinity } from './types';

export type PostcardInkThemeId =
  | 'classique_or'
  | 'saphir_pyrite'
  | 'pourpre_orchidee'
  | 'emeraude_caverne';

export type FamiliarAuraId = 'aucune' | 'solaire' | 'sylvestre' | 'astrale';

export interface PostcardInkThemeMeta {
  id: PostcardInkThemeId;
  nameFr: string;
  outerBorder: string;
  trimAccent: string;
  paperFill: string;
  ruleStroke: string;
  rivetFill: string;
  stampBg: string;
  postmarkInk: string;
}

export const POSTCARD_INK_THEMES: Record<PostcardInkThemeId, PostcardInkThemeMeta> = {
  classique_or: {
    id: 'classique_or',
    nameFr: 'Or & Cire Écarlate',
    outerBorder: '#24150b',
    trimAccent: '#d97706',
    paperFill: '#f8eed5',
    ruleStroke: '#c89d62',
    rivetFill: '#fbbf24',
    stampBg: '#991b1b',
    postmarkInk: 'rgba(153, 27, 27, 0.84)',
  },
  saphir_pyrite: {
    id: 'saphir_pyrite',
    nameFr: 'Bleu de Prusse & Pyrite',
    outerBorder: '#0f172a',
    trimAccent: '#0284c7',
    paperFill: '#f4f1ea',
    ruleStroke: '#64748b',
    rivetFill: '#fde047',
    stampBg: '#1e3a8a',
    postmarkInk: 'rgba(30, 58, 138, 0.84)',
  },
  pourpre_orchidee: {
    id: 'pourpre_orchidee',
    nameFr: 'Pourpre d’Orchidée & Calcite',
    outerBorder: '#2e1026',
    trimAccent: '#be185d',
    paperFill: '#fdf4f5',
    ruleStroke: '#b87a96',
    rivetFill: '#fde68a',
    stampBg: '#831843',
    postmarkInk: 'rgba(131, 24, 67, 0.84)',
  },
  emeraude_caverne: {
    id: 'emeraude_caverne',
    nameFr: 'Émeraude du Karst & Olivine',
    outerBorder: '#082218',
    trimAccent: '#059669',
    paperFill: '#f2f7f0',
    ruleStroke: '#5b8a72',
    rivetFill: '#6ee7b7',
    stampBg: '#065f46',
    postmarkInk: 'rgba(6, 95, 70, 0.84)',
  },
};

export interface AlchemyRecipe {
  id: string;
  nameFr: string;
  category: 'encre_carte' | 'aura_familier';
  botanicalOptions: string[]; // Any 1 of these botanical specimen IDs
  geologicalOptions: string[]; // Any 1 of these geological specimen IDs
  effectSummaryFr: string;
  loreFr: string;
  swatchPrimary: string;
  swatchSecondary: string;
  unlocksPostcardInk?: PostcardInkThemeId;
  unlocksFamiliarAura?: FamiliarAuraId;
  fogBonusMeters?: number;
  lanternSenseBonusMeters?: number;
  xpBonusPct?: number;
}

export const ALCHEMY_RECIPES: AlchemyRecipe[] = [
  {
    id: 'alc_encre_saphir_pyrite',
    nameFr: 'Encre Bleu de Prusse & Pyrite',
    category: 'encre_carte',
    botanicalOptions: ['bot_iris_marais', 'bot_doradille_nord'],
    geologicalOptions: ['geo_schiste_pyrite', 'geo_galet_alluvial'],
    effectSummaryFr: 'Débloque l’enluminure « Bleu de Prusse & Pyrite » pour vos Cartes Postales 16-bit.',
    loreFr:
      'Broyée au mortier à partir d’éclats cubiques de pyrite et de sucs rivulaires, cette encre profonde rehausse vos souvenirs d’un filet saphir et or.',
    swatchPrimary: '#1e3a8a',
    swatchSecondary: '#fde047',
    unlocksPostcardInk: 'saphir_pyrite',
  },
  {
    id: 'alc_encre_pourpre_calcite',
    nameFr: 'Encre Pourpre d’Orchidée & Calcite',
    category: 'encre_carte',
    botanicalOptions: ['bot_ophrys_abeille', 'bot_digitale_pourpre'],
    geologicalOptions: ['geo_calcaire_fossile', 'geo_rognon_silex'],
    effectSummaryFr:
      'Débloque l’enluminure « Pourpre d’Orchidée & Calcite » pour vos Cartes Postales 16-bit.',
    loreFr:
      'Liée à la poudre blanche de calcaire coquillier, la teinture florale donne un carmin impérial digne des manuscrits médiévaux.',
    swatchPrimary: '#831843',
    swatchSecondary: '#fde68a',
    unlocksPostcardInk: 'pourpre_orchidee',
  },
  {
    id: 'alc_encre_emeraude_olivine',
    nameFr: 'Pigment Émeraude du Karst & Olivine',
    category: 'encre_carte',
    botanicalOptions: ['bot_mousse_luminescente', 'bot_joubarbe_volcan'],
    geologicalOptions: ['geo_basalte_olivine', 'geo_druse_calcite'],
    effectSummaryFr:
      'Débloque l’enluminure « Émeraude du Karst & Olivine » pour vos Cartes Postales 16-bit.',
    loreFr:
      'Un pigment minéral aux reflets vert bouteille mêlant cristaux d’olivine volcanique et poussière lumineuse des cavités.',
    swatchPrimary: '#065f46',
    swatchSecondary: '#6ee7b7',
    unlocksPostcardInk: 'emeraude_caverne',
  },
  {
    id: 'alc_talisman_ambre_solaire',
    nameFr: 'Talisman d’Ambre & Serpolet',
    category: 'aura_familier',
    botanicalOptions: ['bot_thym_serpolet', 'bot_ophrys_abeille'],
    geologicalOptions: ['geo_rognon_silex', 'geo_gres_oblique'],
    effectSummaryFr:
      'Aura Solaire Dorée autour de votre Familier + bonus passif +10 % d’XP sur chaque lieu découvert.',
    loreFr:
      'Chauffé par l’essence aromatique des coteaux pierreux et l’étincelle du silex blond, ce talisman entoure votre compagnon de lucioles d’or.',
    swatchPrimary: '#d97706',
    swatchSecondary: '#fef08a',
    unlocksFamiliarAura: 'solaire',
    xpBonusPct: 10,
  },
  {
    id: 'alc_elixir_landes_granit',
    nameFr: 'Élixir des Landes & Quartz',
    category: 'aura_familier',
    botanicalOptions: ['bot_bruyere_cendree', 'bot_digitale_pourpre', 'bot_doradille_nord'],
    geologicalOptions: ['geo_granite_feldspath', 'geo_galet_alluvial'],
    effectSummaryFr:
      'Aura Sylvestre Émeraude autour de votre Familier + dissipation du Brouillard étendue de +22 m.',
    loreFr:
      'Distillé à partir de bruyères des sables et de cristaux de quartz clair, il aiguise le flair de votre familier à travers la brume.',
    swatchPrimary: '#15803d',
    swatchSecondary: '#86efac',
    unlocksFamiliarAura: 'sylvestre',
    fogBonusMeters: 22,
  },
  {
    id: 'alc_liqueur_cristalline_karst',
    nameFr: 'Liqueur Cristalline des Profondeurs',
    category: 'aura_familier',
    botanicalOptions: ['bot_mousse_luminescente', 'bot_iris_marais'],
    geologicalOptions: ['geo_druse_calcite', 'geo_schiste_pyrite', 'geo_basalte_olivine'],
    effectSummaryFr:
      'Aura Astrale Cyan autour de votre Familier + résonance de la Lanterne Spectrale étendue de +20 m.',
    loreFr:
      'Née sous les voûtes karstiques, cette fiole phosphorescente fait scintiller votre compagnon dans l’obscurité des souterrains et des nuits claires.',
    swatchPrimary: '#0e7490',
    swatchSecondary: '#67e8f9',
    unlocksFamiliarAura: 'astrale',
    lanternSenseBonusMeters: 20,
  },
];

const CRAFTED_RECIPES_STORAGE_KEY = 'terra16_crafted_alchemy_v1';
const ACTIVE_AURA_STORAGE_KEY = 'terra16_active_familiar_aura_v1';
const PASSPORT_STAMPS_STORAGE_KEY = 'terra16_passport_stamps_v1';

export function loadCraftedAlchemyIds(): Set<string> {
  try {
    const raw = localStorage.getItem(CRAFTED_RECIPES_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x) => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

export function saveCraftedAlchemyIds(ids: ReadonlySet<string>): void {
  try {
    localStorage.setItem(CRAFTED_RECIPES_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Ignore storage quota
  }
}

export function loadActiveFamiliarAura(): FamiliarAuraId {
  try {
    const v = localStorage.getItem(ACTIVE_AURA_STORAGE_KEY);
    if (v === 'solaire' || v === 'sylvestre' || v === 'astrale' || v === 'aucune') return v;
    return 'aucune';
  } catch {
    return 'aucune';
  }
}

export function saveActiveFamiliarAura(aura: FamiliarAuraId): void {
  try {
    localStorage.setItem(ACTIVE_AURA_STORAGE_KEY, aura);
  } catch {
    // Ignore quota
  }
}

export function canCraftAlchemyRecipe(
  recipe: AlchemyRecipe,
  specimens: CollectedSpecimen[]
): {
  canCraft: boolean;
  matchedBotanical: CollectedSpecimen | null;
  matchedGeological: CollectedSpecimen | null;
} {
  const byId = new Map(specimens.map((s) => [s.specimenId, s]));
  let matchedBotanical: CollectedSpecimen | null = null;
  for (const id of recipe.botanicalOptions) {
    const found = byId.get(id);
    if (found) {
      matchedBotanical = found;
      break;
    }
  }
  let matchedGeological: CollectedSpecimen | null = null;
  for (const id of recipe.geologicalOptions) {
    const found = byId.get(id);
    if (found) {
      matchedGeological = found;
      break;
    }
  }
  return {
    canCraft: Boolean(matchedBotanical && matchedGeological),
    matchedBotanical,
    matchedGeological,
  };
}

export function computeAlchemyFieldBonuses(craftedIds: ReadonlySet<string>): {
  fogBonusMeters: number;
  lanternSenseBonusMeters: number;
  xpBonusPct: number;
  unlockedPostcardInks: PostcardInkThemeId[];
  unlockedFamiliarAuras: FamiliarAuraId[];
} {
  let fogBonusMeters = 0;
  let lanternSenseBonusMeters = 0;
  let xpBonusPct = 0;
  const unlockedPostcardInks: PostcardInkThemeId[] = ['classique_or'];
  const unlockedFamiliarAuras: FamiliarAuraId[] = ['aucune'];

  for (const r of ALCHEMY_RECIPES) {
    if (!craftedIds.has(r.id)) continue;
    fogBonusMeters += r.fogBonusMeters || 0;
    lanternSenseBonusMeters += r.lanternSenseBonusMeters || 0;
    xpBonusPct += r.xpBonusPct || 0;
    if (r.unlocksPostcardInk && !unlockedPostcardInks.includes(r.unlocksPostcardInk)) {
      unlockedPostcardInks.push(r.unlocksPostcardInk);
    }
    if (r.unlocksFamiliarAura && !unlockedFamiliarAuras.includes(r.unlocksFamiliarAura)) {
      unlockedFamiliarAuras.push(r.unlocksFamiliarAura);
    }
  }

  return {
    fogBonusMeters,
    lanternSenseBonusMeters,
    xpBonusPct,
    unlockedPostcardInks,
    unlockedFamiliarAuras,
  };
}

// ============================================================================
// PASSEPORT D'ÉCLAIREUR — TAMPONS D'ENCRE RÉGIONAUX 16-BIT
// ============================================================================

export type StampShapeKind = 'circle' | 'octagon' | 'shield' | 'diamond';

export interface RegionalPassportStamp {
  stampKey: string;
  localityName: string;
  regionSubtitle: string;
  affinity: LithologyAffinity;
  lithologyLabelFr: string;
  altitudeMeters: number | null;
  season: SeasonKey;
  shape: StampShapeKind;
  lat: number;
  lng: number;
  discoveriesHere: number;
  firstStampedIso: string;
  lastVisitedIso: string;
}

export function loadPassportStamps(): RegionalPassportStamp[] {
  try {
    const raw = localStorage.getItem(PASSPORT_STAMPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePassportStamps(stamps: RegionalPassportStamp[]): void {
  try {
    localStorage.setItem(PASSPORT_STAMPS_STORAGE_KEY, JSON.stringify(stamps.slice(0, 60)));
  } catch {
    // Ignore storage quota
  }
}

function hashStr(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function buildOrUpdatePassportStamp(
  existing: RegionalPassportStamp[],
  params: {
    localityName: string;
    regionSubtitle: string;
    affinity: LithologyAffinity;
    lithologyLabelFr: string;
    altitudeMeters: number | null;
    season: SeasonKey;
    lat: number;
    lng: number;
    discoveriesHere: number;
  }
): { stamps: RegionalPassportStamp[]; newlyStamped: RegionalPassportStamp | null } {
  const cleanName = params.localityName.trim();
  if (!cleanName || cleanName.length < 2) {
    return { stamps: existing, newlyStamped: null };
  }
  const normalizedKey = cleanName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  if (!normalizedKey) return { stamps: existing, newlyStamped: null };

  const nowIso = new Date().toISOString();
  const idx = existing.findIndex((s) => s.stampKey === normalizedKey);
  if (idx >= 0) {
    const cur = existing[idx];
    const nextDisc = Math.max(cur.discoveriesHere, params.discoveriesHere);
    if (nextDisc === cur.discoveriesHere && cur.altitudeMeters !== null) {
      return { stamps: existing, newlyStamped: null };
    }
    const updated: RegionalPassportStamp = {
      ...cur,
      altitudeMeters: params.altitudeMeters ?? cur.altitudeMeters,
      discoveriesHere: nextDisc,
      lastVisitedIso: nowIso,
    };
    const nextList = [...existing];
    nextList[idx] = updated;
    return { stamps: nextList, newlyStamped: null };
  }

  const shapes: StampShapeKind[] = ['circle', 'octagon', 'shield', 'diamond'];
  const shape = shapes[hashStr(normalizedKey) % shapes.length];
  const created: RegionalPassportStamp = {
    stampKey: normalizedKey,
    localityName: cleanName,
    regionSubtitle: params.regionSubtitle,
    affinity: params.affinity,
    lithologyLabelFr: params.lithologyLabelFr,
    altitudeMeters: params.altitudeMeters !== null ? Math.round(params.altitudeMeters) : null,
    season: params.season,
    shape,
    lat: params.lat,
    lng: params.lng,
    discoveriesHere: Math.max(0, params.discoveriesHere),
    firstStampedIso: nowIso,
    lastVisitedIso: nowIso,
  };
  return { stamps: [created, ...existing].slice(0, 60), newlyStamped: created };
}

const STAMP_INK_BY_AFFINITY: Record<LithologyAffinity, { main: string; light: string }> = {
  calcaire: { main: '#9a3412', light: 'rgba(154, 52, 18, 0.16)' },
  granit: { main: '#831843', light: 'rgba(131, 24, 67, 0.15)' },
  schiste: { main: '#1e3a8a', light: 'rgba(30, 58, 138, 0.15)' },
  gres: { main: '#6b21a8', light: 'rgba(107, 33, 168, 0.15)' },
  alluvions: { main: '#0f766e', light: 'rgba(15, 118, 110, 0.15)' },
  volcanique: { main: '#991b1b', light: 'rgba(153, 27, 27, 0.16)' },
  souterrain: { main: '#155e75', light: 'rgba(21, 94, 117, 0.16)' },
};

/**
 * Renders a crisp 16-bit Wax / Ink Regional Passport Stamp with custom geometry,
 * pixel-art geological crest, altitude, and locality postmark.
 */
export const PassportStampCanvas: React.FC<{
  stamp: RegionalPassportStamp;
  className?: string;
}> = ({ stamp, className = 'w-24 h-24' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = 128;
    const H = 128;
    canvas.width = W;
    canvas.height = H;
    ctx.clearRect(0, 0, W, H);

    const ink = STAMP_INK_BY_AFFINITY[stamp.affinity] || STAMP_INK_BY_AFFINITY.calcaire;
    const h = hashStr(stamp.stampKey);
    const tilt = (((h % 9) - 4) * Math.PI) / 180;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(tilt);

    ctx.strokeStyle = ink.main;
    ctx.fillStyle = ink.light;
    ctx.lineWidth = 3;

    const drawFramePath = (r: number) => {
      ctx.beginPath();
      if (stamp.shape === 'circle') {
        ctx.arc(0, 0, r, 0, Math.PI * 2);
      } else if (stamp.shape === 'octagon') {
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4 + Math.PI / 8;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      } else if (stamp.shape === 'diamond') {
        ctx.moveTo(0, -r * 1.04);
        ctx.lineTo(r * 1.04, 0);
        ctx.lineTo(0, r * 1.04);
        ctx.lineTo(-r * 1.04, 0);
        ctx.closePath();
      } else {
        // Shield crest
        ctx.moveTo(-r * 0.86, -r * 0.88);
        ctx.lineTo(r * 0.86, -r * 0.88);
        ctx.lineTo(r * 0.86, r * 0.08);
        ctx.lineTo(0, r * 1.02);
        ctx.lineTo(-r * 0.86, r * 0.08);
        ctx.closePath();
      }
    };

    drawFramePath(54);
    ctx.fill();
    ctx.stroke();

    ctx.lineWidth = 1.4;
    drawFramePath(47);
    ctx.stroke();

    // Pixel-art central regional crest (4x integer blocks)
    ctx.fillStyle = ink.main;
    const crestKind = h % 4;
    const b = (gx: number, gy: number, gw: number, gh: number) => {
      ctx.fillRect(gx * 3, gy * 3 - 22, gw * 3, gh * 3);
    };
    if (crestKind === 0) {
      // Castle / Tower crest
      b(-4, 0, 2, 5);
      b(-1, 1, 2, 4);
      b(2, 0, 2, 5);
      b(-4, 3, 8, 3);
    } else if (crestKind === 1) {
      // Twin Peaks & Star
      b(-5, 4, 10, 2);
      b(-4, 2, 4, 2);
      b(1, 1, 4, 3);
      b(-1, -1, 2, 2);
    } else if (crestKind === 2) {
      // Oak Leaf / Menhir
      b(-2, 0, 4, 5);
      b(-1, -1, 2, 1);
      b(-4, 5, 8, 1);
    } else {
      // River Bridge Arch
      b(-5, 2, 10, 2);
      b(-5, 4, 2, 2);
      b(3, 4, 2, 2);
      b(-1, 0, 2, 2);
    }

    // Center postal banner
    ctx.strokeStyle = ink.main;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-40, -2);
    ctx.lineTo(40, -2);
    ctx.moveTo(-40, 15);
    ctx.lineTo(40, 15);
    ctx.stroke();

    ctx.fillStyle = ink.main;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
    const upName = stamp.localityName.toUpperCase().slice(0, 13);
    ctx.fillText(upName, 0, 6.5);

    const altStr =
      stamp.altitudeMeters !== null
        ? `ALT.${stamp.altitudeMeters}M`
        : LITHOLOGY_AFFINITY_META[stamp.affinity].labelFr.slice(0, 11).toUpperCase();
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillText(altStr, 0, 25);

    const dateShort = new Date(stamp.firstStampedIso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
    ctx.font = '7.5px "JetBrains Mono", monospace';
    ctx.fillText(dateShort, 0, 36);

    ctx.restore();
  }, [stamp]);

  return React.createElement('canvas', {
    ref: canvasRef,
    className: `pixelated shrink-0 ${className}`,
  });
};
