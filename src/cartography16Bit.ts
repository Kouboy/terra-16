import {
  ElevationGrid,
  HeritageMicroSpriteKind,
  LieuDitBanner,
  LieuDitKind,
  OrientationTableNode,
  PoiItem,
  TerrainFeature,
  TrailNetwork,
  sampleElevationMeters,
} from './types';

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearingDegrees(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dLam = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLam) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLam);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function cardinalFrFromBearing(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return dirs[idx];
}

// ============================================================================
// 1. AUTO-TILED 16-BIT BIOME TRANSITIONS (8-Neighbor Bitmask & Inner Corners)
// ============================================================================
export interface AutoTileGridIds {
  T_MEADOW: number;
  T_FARMLAND: number;
  T_PARK: number;
  T_FOREST: number;
  T_WATER: number;
  T_PATH: number;
  T_STREET: number;
  T_MAIN_ROAD: number;
  T_SAND: number;
  T_SCRUB: number;
  T_WETLAND: number;
  T_SCREE: number;
}

/**
 * Renders 16-bit SNES neighbor-aware auto-tiling transitions (scalloped woodland edges,
 * bocage hedgerows, sand/marsh/scree dithered fringes, concave river-bank promontories,
 * and rounded path/street corner kerbs + stone crossroads medallions).
 */
export function drawAutoTiledBiomeTransitions16Bit(
  pctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  sx: number,
  sy: number,
  t: number,
  h: number,
  envTick: number,
  getTileAt: (tx: number, ty: number) => number,
  ids: AutoTileGridIds
): void {
  const n = getTileAt(wx, wy - 1);
  const s = getTileAt(wx, wy + 1);
  const w = getTileAt(wx - 1, wy);
  const e = getTileAt(wx + 1, wy);
  const nw = getTileAt(wx - 1, wy - 1);
  const ne = getTileAt(wx + 1, wy - 1);
  const sw = getTileAt(wx - 1, wy + 1);
  const se = getTileAt(wx + 1, wy + 1);

  // A. Concave Water Inner-Bank Promontories + Foam (when 2 cardinal neighbors are land & diagonal is land)
  if (t === ids.T_WATER) {
    const nLand = n !== ids.T_WATER;
    const sLand = s !== ids.T_WATER;
    const wLand = w !== ids.T_WATER;
    const eLand = e !== ids.T_WATER;
    const foamShift = envTick % 2;

    // Outer convex corner nibs where water meets diagonal land while cardinals are water!
    if (!nLand && !wLand && nw !== ids.T_WATER) {
      pctx.fillStyle = '#3d2817';
      pctx.fillRect(sx, sy, 4, 4);
      pctx.fillStyle = '#4da142';
      pctx.fillRect(sx, sy, 3, 3);
      pctx.fillStyle = '#e0f2fe';
      pctx.fillRect(sx + 3 + foamShift, sy + 2, 2, 1);
      pctx.fillRect(sx + 2, sy + 3 + foamShift, 1, 2);
    }
    if (!nLand && !eLand && ne !== ids.T_WATER) {
      pctx.fillStyle = '#3d2817';
      pctx.fillRect(sx + 12, sy, 4, 4);
      pctx.fillStyle = '#4da142';
      pctx.fillRect(sx + 13, sy, 3, 3);
      pctx.fillStyle = '#e0f2fe';
      pctx.fillRect(sx + 11 - foamShift, sy + 2, 2, 1);
      pctx.fillRect(sx + 13, sy + 3 + foamShift, 1, 2);
    }
    if (!sLand && !wLand && sw !== ids.T_WATER) {
      pctx.fillStyle = '#241911';
      pctx.fillRect(sx, sy + 13, 4, 3);
      pctx.fillStyle = '#3a8238';
      pctx.fillRect(sx, sy + 14, 3, 2);
      pctx.fillStyle = '#bae6fd';
      pctx.fillRect(sx + 3, sy + 12 - foamShift, 2, 1);
    }
    if (!sLand && !eLand && se !== ids.T_WATER) {
      pctx.fillStyle = '#241911';
      pctx.fillRect(sx + 12, sy + 13, 4, 3);
      pctx.fillStyle = '#3a8238';
      pctx.fillRect(sx + 13, sy + 14, 3, 2);
      pctx.fillStyle = '#bae6fd';
      pctx.fillRect(sx + 11, sy + 12 - foamShift, 2, 1);
    }
    // Concave cove bevels when two adjacent cardinal banks meet
    if (nLand && wLand) {
      pctx.fillStyle = '#3d2817';
      pctx.fillRect(sx, sy, 5, 5);
      pctx.fillStyle = '#e0f2fe';
      pctx.fillRect(sx + 4, sy + 4, 2, 2);
    }
    if (nLand && eLand) {
      pctx.fillStyle = '#3d2817';
      pctx.fillRect(sx + 11, sy, 5, 5);
      pctx.fillStyle = '#e0f2fe';
      pctx.fillRect(sx + 10, sy + 4, 2, 2);
    }
    return;
  }

  // B. Woodland / Forest Scalloped Undergrowth Fringe & Cast Edge Shadow onto Open Ground
  if (
    t === ids.T_MEADOW ||
    t === ids.T_PARK ||
    t === ids.T_FARMLAND ||
    t === ids.T_SCRUB
  ) {
    // Woodland border encroaching from adjacent T_FOREST
    if (n === ids.T_FOREST) {
      pctx.fillStyle = 'rgba(10, 28, 16, 0.34)';
      pctx.fillRect(sx, sy, 16, 4);
      for (let bx = (h & 1); bx < 15; bx += 4) {
        pctx.fillStyle = '#14532d';
        pctx.fillRect(sx + bx, sy, 3, 3);
        pctx.fillStyle = '#22c55e';
        pctx.fillRect(sx + bx + 1, sy, 2, 2);
      }
      if (h % 5 === 0) {
        // Woodland edge wild berry bush or fern
        pctx.fillStyle = '#dc2626';
        pctx.fillRect(sx + 6, sy + 1, 1, 1);
      }
    }
    if (s === ids.T_FOREST) {
      for (let bx = ((h >> 1) & 1); bx < 15; bx += 5) {
        pctx.fillStyle = '#14532d';
        pctx.fillRect(sx + bx, sy + 14, 3, 2);
        pctx.fillStyle = '#4ade80';
        pctx.fillRect(sx + bx + 1, sy + 14, 2, 1);
      }
    }
    if (w === ids.T_FOREST) {
      pctx.fillStyle = 'rgba(10, 28, 16, 0.26)';
      pctx.fillRect(sx, sy, 3, 16);
      for (let by = (h & 3); by < 14; by += 5) {
        pctx.fillStyle = '#14532d';
        pctx.fillRect(sx, sy + by, 3, 3);
        pctx.fillStyle = '#22c55e';
        pctx.fillRect(sx, sy + by, 2, 2);
      }
    }
    if (e === ids.T_FOREST) {
      for (let by = ((h >> 2) & 3); by < 14; by += 5) {
        pctx.fillStyle = '#14532d';
        pctx.fillRect(sx + 14, sy + by, 2, 3);
        pctx.fillStyle = '#22c55e';
        pctx.fillRect(sx + 14, sy + by, 1, 2);
      }
    }

    // Inner forest corner nibs
    if (n !== ids.T_FOREST && w !== ids.T_FOREST && nw === ids.T_FOREST) {
      pctx.fillStyle = '#14532d';
      pctx.fillRect(sx, sy, 3, 3);
      pctx.fillStyle = '#22c55e';
      pctx.fillRect(sx, sy, 2, 2);
    }
    if (n !== ids.T_FOREST && e !== ids.T_FOREST && ne === ids.T_FOREST) {
      pctx.fillStyle = '#14532d';
      pctx.fillRect(sx + 13, sy, 3, 3);
      pctx.fillStyle = '#22c55e';
      pctx.fillRect(sx + 14, sy, 2, 2);
    }
  }

  // C. Farmland Bocage Hedgerow / Dry-Stone Low Wall Transitions (Haies bocagères & murets)
  if (t === ids.T_FARMLAND) {
    if (n !== ids.T_FARMLAND && n !== ids.T_WATER) {
      pctx.fillStyle = '#365314';
      pctx.fillRect(sx, sy, 16, 2);
      for (let hx = 1; hx < 15; hx += 4) {
        pctx.fillStyle = '#65a30d';
        pctx.fillRect(sx + hx, sy, 2, 1);
      }
    }
    if (w !== ids.T_FARMLAND && w !== ids.T_WATER) {
      pctx.fillStyle = '#365314';
      pctx.fillRect(sx, sy, 2, 16);
      for (let hy = 1; hy < 15; hy += 4) {
        pctx.fillStyle = '#65a30d';
        pctx.fillRect(sx, sy + hy, 1, 2);
      }
    }
  }

  // D. Sand / Beach, Wetland / Marsh & Scree Dithered Auto-Borders
  if (t === ids.T_SAND || t === ids.T_WETLAND || t === ids.T_SCREE) {
    const isOuter = (nb: number) => nb !== t && nb !== ids.T_WATER;
    const rimLight =
      t === ids.T_SAND ? '#fef3c7' : t === ids.T_WETLAND ? '#5eead4' : '#e7e5e4';
    const rimGrass = '#4da142';
    if (isOuter(n)) {
      for (let dx = wx & 1; dx < 16; dx += 2) {
        pctx.fillStyle = rimGrass;
        pctx.fillRect(sx + dx, sy, 1, 2);
      }
      pctx.fillStyle = rimLight;
      pctx.fillRect(sx + 2, sy + 2, 4, 1);
    }
    if (isOuter(s)) {
      for (let dx = (wx + 1) & 1; dx < 16; dx += 2) {
        pctx.fillStyle = rimGrass;
        pctx.fillRect(sx + dx, sy + 14, 1, 2);
      }
    }
    if (isOuter(w)) {
      for (let dy = wy & 1; dy < 16; dy += 2) {
        pctx.fillStyle = rimGrass;
        pctx.fillRect(sx, sy + dy, 2, 1);
      }
    }
    if (isOuter(e)) {
      for (let dy = (wy + 1) & 1; dy < 16; dy += 2) {
        pctx.fillStyle = rimGrass;
        pctx.fillRect(sx + 14, sy + dy, 2, 1);
      }
    }
  }

  // E. Dirt/Cobble Path & Street Auto-Tiled Rounded Corners & Crossroads Medallion
  if (t === ids.T_PATH) {
    const isPath = (nb: number) =>
      nb === ids.T_PATH || nb === ids.T_STREET || nb === ids.T_MAIN_ROAD;
    const pN = isPath(n);
    const pS = isPath(s);
    const pW = isPath(w);
    const pE = isPath(e);
    const deg = (pN ? 1 : 0) + (pS ? 1 : 0) + (pW ? 1 : 0) + (pE ? 1 : 0);

    // Bevel outer grass corners on 90-degree bends so paths curve organically!
    if (!pN && !pW) {
      pctx.fillStyle = '#3a8238';
      pctx.fillRect(sx, sy, 3, 2);
      pctx.fillRect(sx, sy + 2, 2, 1);
    }
    if (!pN && !pE) {
      pctx.fillStyle = '#3a8238';
      pctx.fillRect(sx + 13, sy, 3, 2);
      pctx.fillRect(sx + 14, sy + 2, 2, 1);
    }
    if (!pS && !pW) {
      pctx.fillStyle = '#3a8238';
      pctx.fillRect(sx, sy + 14, 3, 2);
      pctx.fillRect(sx, sy + 13, 2, 1);
    }
    if (!pS && !pE) {
      pctx.fillStyle = '#3a8238';
      pctx.fillRect(sx + 13, sy + 14, 3, 2);
      pctx.fillRect(sx + 14, sy + 13, 2, 1);
    }
    // Crossroads stone Stepping-Medallion at 3-way or 4-way trail junctions
    if (deg >= 3) {
      pctx.fillStyle = '#786852';
      pctx.fillRect(sx + 5, sy + 5, 6, 6);
      pctx.fillStyle = '#d6c7ad';
      pctx.fillRect(sx + 6, sy + 6, 4, 4);
    }
  } else if (t === ids.T_STREET || t === ids.T_MAIN_ROAD) {
    const isRoad = (nb: number) => nb === ids.T_STREET || nb === ids.T_MAIN_ROAD;
    const rN = isRoad(n);
    const rS = isRoad(s);
    const rW = isRoad(w);
    const rE = isRoad(e);
    // Inner kerb corner stones at 4-way or T intersections
    if (rN && rW && !isRoad(nw)) {
      pctx.fillStyle = '#2b1d12';
      pctx.fillRect(sx, sy, 2, 2);
      pctx.fillStyle = '#fbf6ea';
      pctx.fillRect(sx + 1, sy + 1, 2, 1);
    }
    if (rN && rE && !isRoad(ne)) {
      pctx.fillStyle = '#2b1d12';
      pctx.fillRect(sx + 14, sy, 2, 2);
      pctx.fillStyle = '#fbf6ea';
      pctx.fillRect(sx + 13, sy + 1, 2, 1);
    }
    if (rS && rW && !isRoad(sw)) {
      pctx.fillStyle = '#2b1d12';
      pctx.fillRect(sx, sy + 14, 2, 2);
    }
    if (rS && rE && !isRoad(se)) {
      pctx.fillStyle = '#2b1d12';
      pctx.fillRect(sx + 14, sy + 14, 2, 2);
    }
  }
}

// ============================================================================
// 2. SENTIERS GR / GRP / PR BALISÉS (FFRP Blazes & Trail Fingerposts)
// ============================================================================
export const TRAIL_NONE = 0;
export const TRAIL_GR = 1; // Blanc sur Rouge (Grande Randonnée)
export const TRAIL_GRP = 2; // Jaune sur Rouge (GR de Pays)
export const TRAIL_PR = 3; // Jaune (Promenade & Randonnée)

export function encodeTrailNetwork(net?: TrailNetwork): number {
  if (net === 'gr') return TRAIL_GR;
  if (net === 'grp') return TRAIL_GRP;
  if (net === 'pr') return TRAIL_PR;
  return TRAIL_NONE;
}

/**
 * Renders an authentic French FFRP hiking blaze on a wayside stone cairn / oak post
 * or a full 16-bit wooden directional fingerpost (`poteau directionnel`) at trail junctions!
 */
export function drawTrailBlazeOnTile16Bit(
  pctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  sx: number,
  sy: number,
  trailCode: number,
  getTrailAt: (tx: number, ty: number) => number
): void {
  if (trailCode === TRAIL_NONE) return;

  const tN = getTrailAt(wx, wy - 1) !== TRAIL_NONE;
  const tS = getTrailAt(wx, wy + 1) !== TRAIL_NONE;
  const tW = getTrailAt(wx - 1, wy) !== TRAIL_NONE;
  const tE = getTrailAt(wx + 1, wy) !== TRAIL_NONE;
  const deg = (tN ? 1 : 0) + (tS ? 1 : 0) + (tW ? 1 : 0) + (tE ? 1 : 0);

  const topStripe =
    trailCode === TRAIL_GR ? '#ffffff' : '#fde047';
  const botStripe =
    trailCode === TRAIL_PR ? '#eab308' : '#dc2626';

  // At trail junctions (deg >= 3) or trailheads (deg === 1), plant a 16-bit wooden directional fingerpost!
  if ((deg >= 3 && (wx + wy) % 2 === 0) || deg === 1) {
    const px = sx + 2;
    const py = sy + 1;
    // Shadow
    pctx.fillStyle = 'rgba(14, 9, 4, 0.42)';
    pctx.fillRect(px - 1, py + 11, 6, 2);
    // Dark outline + oak post
    pctx.fillStyle = '#1c1008';
    pctx.fillRect(px, py + 1, 4, 12);
    pctx.fillStyle = '#92400e';
    pctx.fillRect(px + 1, py + 2, 2, 10);
    // Directional blade (flèche directionnelle crème/bois)
    pctx.fillStyle = '#1c1008';
    pctx.fillRect(px - 1, py + 1, 9, 5);
    pctx.fillStyle = '#fef3c7';
    pctx.fillRect(px, py + 2, 7, 3);
    // Blaze tip on blade
    pctx.fillStyle = topStripe;
    pctx.fillRect(px + 5, py + 2, 2, 1);
    pctx.fillStyle = botStripe;
    pctx.fillRect(px + 5, py + 3, 2, 2);
    return;
  }

  // Regular interval FFRP painted blaze along the trail (every ~3 tiles so paths stay clean & readable!)
  if ((wx * 3 + wy * 5) % 4 !== 0) return;

  // Offset to the shoulder of the path
  const bx = tN || tS ? sx + 1 : sx + 5;
  const by = tN || tS ? sy + 5 : sy + 1;

  pctx.fillStyle = '#1c1008';
  pctx.fillRect(bx, by, 6, 6);
  if (trailCode === TRAIL_PR) {
    // Single crisp yellow PR blaze on granite marker
    pctx.fillStyle = '#a8a29e';
    pctx.fillRect(bx + 1, by + 1, 4, 4);
    pctx.fillStyle = '#fde047';
    pctx.fillRect(bx + 1, by + 2, 4, 2);
  } else {
    // Double horizontal FFRP stripe: White/Red (GR) or Yellow/Red (GRP)
    pctx.fillStyle = topStripe;
    pctx.fillRect(bx + 1, by + 1, 4, 2);
    pctx.fillStyle = botStripe;
    pctx.fillRect(bx + 1, by + 3, 4, 2);
  }
}

// ============================================================================
// 3. MICRO-SPRITES PATRIMONIAUX FRANÇAIS (14 Bespoke 16-Bit Pixel Archetypes)
// ============================================================================
export function classifyHeritageMicroSprite(
  poi: Pick<PoiItem, 'name' | 'subType' | 'category'>
): HeritageMicroSpriteKind | null {
  const hay = `${poi.subType} ${poi.name}`.toLowerCase();
  if (/table d['’]orientation|belvédère|belvedere|panorama|point de vue|vue panoramique/.test(hay)) {
    return 'table_orientation';
  }
  if (/nivellement|géodésique|geodesique|médaillon ign|triangulation|\brbf\b|\brdf\b|borne ign/.test(hay)) {
    return 'borne_ign';
  }
  if (/\blavoir\b/.test(hay)) return 'lavoir';
  if (/four à pain|four banal|fournil|bakehouse/.test(hay)) return 'four_pain';
  if (/pigeonnier|colombier|dovecote/.test(hay)) return 'pigeonnier';
  if (/menhir|dolmen|mégalith|megalith|allée couverte|cromlech|pierre levée|tumulus/.test(hay)) {
    return 'menhir';
  }
  if (/\bphare\b|amer maritime|sémaphore|semaphore/.test(hay)) return 'phare';
  if (/moulin à eau|moulin hydraulique|bief/.test(hay)) return 'moulin_eau';
  if (/\bmoulin\b/.test(hay)) return 'moulin_vent';
  if (/calvaire|croix de|croix des|oratoire/.test(hay)) return 'calvaire';
  if (/\bpuits\b|citerne/.test(hay)) return 'puits';
  if (/fontaine|source|résurgence|resurgence/.test(hay)) return 'fontaine';
  if (/chapelle|église|eglise|abbaye|prieuré|prieure|cathédrale|cathedrale|basilique|collégiale/.test(hay)) {
    return 'chapelle';
  }
  if (/ruine|vestige|château|chateau|donjon|rempart|tour|fort|citadelle/.test(hay)) {
    return 'ruine';
  }
  return null;
}

/**
 * Draws a crisp 16-bit French heritage micro-sprite centered at (vx, vy) in virtual pixel coordinates.
 * Works both for discovered POI monuments (`scale = SCALE`) and subtle overworld terrain micro-sprites!
 */
export function drawHeritageMicroSprite16Bit(
  ctx: CanvasRenderingContext2D,
  vx: number,
  vy: number,
  scale: number,
  kind: HeritageMicroSpriteKind,
  phase: number
): void {
  const px = (x: number, y: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x * scale), Math.round(y * scale), Math.ceil(w * scale), Math.ceil(h * scale));
  };

  switch (kind) {
    case 'borne_ign': {
      px(vx - 5, vy - 19, 11, 15, '#1c1917');
      px(vx - 4, vy - 18, 9, 13, '#cbd5e1');
      px(vx - 4, vy - 18, 4, 13, '#f1f5f9');
      px(vx - 4, vy - 14, 9, 7, '#78350f');
      px(vx - 3, vy - 13, 7, 5, '#d97706');
      px(vx - 2, vy - 12, 5, 3, '#fbbf24');
      px(vx, vy - 12, 1, 3, '#fffbeb');
      px(vx - 1, vy - 11, 3, 1, '#fffbeb');
      break;
    }
    case 'lavoir': {
      px(vx - 8, vy - 19, 17, 6, '#291509');
      px(vx - 7, vy - 18, 15, 4, '#c2410c');
      px(vx - 6, vy - 18, 13, 2, '#ea580c');
      px(vx - 6, vy - 13, 2, 5, '#78350f');
      px(vx + 5, vy - 13, 2, 5, '#78350f');
      px(vx - 7, vy - 9, 15, 5, '#d6c3a3');
      px(vx - 5, vy - 8, 11, 3, '#0284c7');
      px(vx - 4 + (phase % 3), vy - 8, 5, 1, '#bae6fd');
      break;
    }
    case 'four_pain': {
      px(vx + 3, vy - 21, 4, 6, '#291a0d');
      px(vx + 4, vy - 20, 2, 5, '#a8a29e');
      px(vx - 7, vy - 16, 15, 12, '#291a0d');
      px(vx - 6, vy - 15, 13, 10, '#d6c3a3');
      px(vx - 5, vy - 16, 11, 3, '#b45309');
      px(vx - 3, vy - 11, 7, 6, '#7c2d12');
      px(vx - 2, vy - 10, 5, 5, '#1c1008');
      px(vx - 1, vy - 7, 3, 2, phase % 2 === 0 ? '#f97316' : '#fde047');
      break;
    }
    case 'pigeonnier': {
      // Cylindrical stone dovecote tower, pepper-pot slate roof & white flight-holes (boulins)
      px(vx - 5, vy - 18, 11, 14, '#1c1917');
      px(vx - 4, vy - 17, 9, 12, '#e7d8be');
      px(vx - 4, vy - 17, 3, 12, '#fbf6ea');
      // Conical slate roof + finial
      px(vx - 6, vy - 20, 13, 3, '#1e293b');
      px(vx - 4, vy - 22, 9, 2, '#334155');
      px(vx - 2, vy - 23, 5, 1, '#475569');
      px(vx, vy - 25, 1, 2, '#fbbf24');
      // Randière cornice + boulins holes
      px(vx - 5, vy - 13, 11, 1, '#ffffff');
      px(vx - 3, vy - 15, 1, 1, '#1c1917');
      px(vx, vy - 15, 1, 1, '#1c1917');
      px(vx + 2, vy - 15, 1, 1, '#1c1917');
      break;
    }
    case 'menhir': {
      // Standing granite menhir + mossy trilithon / dolmen stone with subtle prehistoric rune
      px(vx - 5, vy - 9, 11, 5, '#292524');
      px(vx - 4, vy - 21, 9, 17, '#1c1917');
      px(vx - 3, vy - 20, 7, 15, '#78716c');
      px(vx - 3, vy - 20, 3, 14, '#d6d3d1');
      px(vx - 2, vy - 22, 5, 2, '#a8a29e');
      // Lichen & spiral engraving
      px(vx + 1, vy - 10, 2, 3, '#65a30d');
      px(vx - 1, vy - 15, 3, 3, '#fef08a');
      px(vx, vy - 14, 1, 1, '#78716c');
      break;
    }
    case 'phare': {
      // Striped coastal lighthouse with rotating golden Fresnel beam!
      px(vx - 4, vy - 21, 9, 17, '#1c1917');
      px(vx - 3, vy - 20, 7, 15, '#f8fafc');
      px(vx - 3, vy - 17, 7, 3, '#dc2626');
      px(vx - 3, vy - 11, 7, 3, '#dc2626');
      // Lantern gallery
      px(vx - 4, vy - 23, 9, 2, '#1e293b');
      px(vx - 2, vy - 25, 5, 2, '#fde047');
      if (phase % 2 === 0) {
        px(vx - 8, vy - 25, 5, 2, 'rgba(253, 224, 71, 0.75)');
        px(vx + 4, vy - 25, 5, 2, 'rgba(253, 224, 71, 0.75)');
      }
      break;
    }
    case 'moulin_eau': {
      px(vx - 5, vy - 18, 11, 14, '#291a0d');
      px(vx - 4, vy - 17, 9, 12, '#efe2c6');
      px(vx - 5, vy - 20, 11, 4, '#9a3412');
      px(vx + 3, vy - 13, 6, 8, '#451a03');
      px(vx + 4, vy - 12, 4, 6, '#b45309');
      px(vx + 3, vy - 6, 6, 2, phase % 2 === 0 ? '#38bdf8' : '#bae6fd');
      break;
    }
    case 'moulin_vent': {
      const rot = phase % 2;
      px(vx - 5, vy - 18, 11, 14, '#291a0d');
      px(vx - 4, vy - 17, 9, 12, '#efe2c6');
      px(vx - 5, vy - 20, 11, 4, '#334155');
      px(vx - 8, vy - 18 + rot, 5, 2, '#f8fafc');
      px(vx + 4, vy - 12 - rot, 5, 2, '#f8fafc');
      px(vx - 1 + rot, vy - 22, 2, 5, '#f8fafc');
      px(vx - 1 - rot, vy - 11, 2, 5, '#f8fafc');
      px(vx - 1, vy - 15, 3, 3, '#fde047');
      break;
    }
    case 'calvaire': {
      px(vx - 5, vy - 9, 11, 5, '#44403c');
      px(vx - 4, vy - 8, 9, 3, '#a8a29e');
      px(vx - 2, vy - 22, 5, 14, '#1c1917');
      px(vx - 5, vy - 18, 11, 4, '#1c1917');
      px(vx - 1, vy - 21, 3, 13, '#e7e5e4');
      px(vx - 4, vy - 17, 9, 2, '#e7e5e4');
      break;
    }
    case 'puits': {
      // Circular stone village well with wrought-iron arch & wooden bucket
      px(vx - 6, vy - 12, 13, 8, '#1c1917');
      px(vx - 5, vy - 11, 11, 6, '#a8a29e');
      px(vx - 3, vy - 11, 7, 2, '#0284c7');
      px(vx - 4, vy - 18, 1, 7, '#1c1917');
      px(vx + 4, vy - 18, 1, 7, '#1c1917');
      px(vx - 5, vy - 20, 11, 3, '#78350f');
      px(vx, vy - 17, 2, 3, '#b45309');
      break;
    }
    case 'fontaine': {
      px(vx - 6, vy - 18, 13, 14, '#1e293b');
      px(vx - 5, vy - 17, 11, 12, '#cbd5e1');
      px(vx - 3, vy - 14, 7, 9, '#0369a1');
      px(vx - 2, vy - 13, 5, 7, '#38bdf8');
      px(vx - 1, vy - 12 + (phase % 2), 3, 4, '#e0f2fe');
      px(vx - 2, vy - 19, 5, 2, '#fde047');
      break;
    }
    case 'chapelle': {
      // Romanesque chapel with bellcote gable & stained-glass rose dot
      px(vx - 6, vy - 16, 13, 12, '#1c1008');
      px(vx - 5, vy - 15, 11, 10, '#e7d8be');
      px(vx - 7, vy - 18, 15, 3, '#9a3412');
      px(vx - 2, vy - 22, 5, 5, '#1c1008');
      px(vx - 1, vy - 21, 3, 4, '#fbf6ea');
      px(vx, vy - 24, 1, 3, '#fbbf24');
      px(vx - 1, vy - 13, 3, 2, '#38bdf8');
      px(vx - 1, vy - 9, 3, 4, '#451a03');
      break;
    }
    case 'ruine': {
      // Crenellated medieval stone keep ruin with ivy
      px(vx - 7, vy - 18, 15, 14, '#1c1917');
      px(vx - 6, vy - 19, 3, 3, '#a8a29e');
      px(vx - 1, vy - 19, 3, 3, '#d6d3d1');
      px(vx + 4, vy - 17, 2, 2, '#78716c');
      px(vx - 6, vy - 16, 12, 11, '#a8a29e');
      px(vx - 6, vy - 16, 4, 11, '#d6d3d1');
      px(vx + 2, vy - 15, 3, 5, '#15803d'); // climbing ivy
      px(vx - 2, vy - 10, 4, 5, '#1c1008');
      break;
    }
    case 'table_orientation': {
      drawOrientationTableSprite16Bit(ctx, vx, vy - 3, scale, false, false, phase);
      break;
    }
  }
}

/**
 * Draws an interactive 16-bit French semi-circular Enameled Lava-Stone Orientation Table
 * (`Table d'orientation panoramique en pierre de Volvic émaillée & laiton`).
 */
export function drawOrientationTableSprite16Bit(
  ctx: CanvasRenderingContext2D,
  vx: number,
  vy: number,
  scale: number,
  isHovered: boolean,
  isInspected: boolean,
  animTick: number
): void {
  const px = (x: number, y: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x * scale), Math.round(y * scale), Math.ceil(w * scale), Math.ceil(h * scale));
  };

  // Ground shadow
  px(vx - 10, vy - 1, 20, 4, 'rgba(16, 10, 5, 0.45)');

  if (isHovered) {
    px(vx - 12, vy - 17, 24, 20, 'rgba(253, 224, 71, 0.32)');
  }

  // Cylindrical dressed-stone pedestal
  px(vx - 5, vy - 8, 10, 9, '#1c1917');
  px(vx - 4, vy - 7, 8, 7, '#a8987e');
  px(vx - 4, vy - 7, 3, 7, '#e7d8be');

  // Semi-circular tilted enameled viewing dial (Pierre de Volvic + plaque émaillée bleue/crème + cercle de laiton)
  px(vx - 9, vy - 14, 18, 7, '#1c1008');
  px(vx - 8, vy - 15, 16, 2, '#1c1008');
  // Brass rim
  px(vx - 8, vy - 13, 16, 5, '#d97706');
  px(vx - 7, vy - 14, 14, 2, '#fbbf24');
  // Enameled panoramic horizon dial
  px(vx - 7, vy - 13, 14, 3, '#0284c7');
  px(vx - 6, vy - 14, 12, 1, '#bae6fd');
  // Tiny mountain ridge & red azimuth sight-line on the enamel dial
  px(vx - 6, vy - 11, 12, 2, '#fef3c7');
  px(vx - 1, vy - 13, 2, 4, '#dc2626');

  // Subtle brass glint or inspected emerald star
  if (isInspected) {
    px(vx + 6, vy - 17, 3, 3, '#10b981');
    px(vx + 7, vy - 16, 1, 1, '#ffffff');
  } else if (animTick % 8 < 2 || isHovered) {
    px(vx - 5, vy - 16, 2, 2, '#fef08a');
    px(vx - 4, vy - 16, 1, 1, '#ffffff');
  }
}

// ============================================================================
// 4. LIEUX-DITS SUR BANNIÈRES (16-Bit Scrolled Vellum Cartouches)
// ============================================================================
/**
 * Draws an ornate 16-bit scrolled vellum banner with swallowtail notched ends,
 * brass corner studs, and a tiny pixel crest icon for French Lieux-dits, Hameaux,
 * Quartiers, Sommets & Rivières.
 */
export function drawLieuDitBanner16Bit(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  topY: number,
  text: string,
  kind: LieuDitKind,
  altitudeMeters?: number
): { x0: number; y0: number; x1: number; y1: number } {
  const fullLabel =
    kind === 'col_sommet' && typeof altitudeMeters === 'number'
      ? `${text} · ${Math.round(altitudeMeters)}m`
      : text;

  ctx.font = 'bold 10px "Cinzel", Georgia, serif';
  const textW = Math.ceil(ctx.measureText(fullLabel).width);
  const iconSpace = 12;
  const bodyW = textW + iconSpace + 14;
  const bodyH = 16;
  const x = Math.round(centerX - bodyW / 2);
  const y = Math.round(topY);

  const pal =
    kind === 'ville'
      ? { bg: '#fef3c7', top: '#fffbeb', bot: '#fde68a', ribbon: '#991b1b', ink: '#451a03' }
      : kind === 'village'
      ? { bg: '#fbf2dc', top: '#fffbeb', bot: '#ead5af', ribbon: '#c2410c', ink: '#24160c' }
      : kind === 'hydronyme'
      ? { bg: '#e0f2fe', top: '#f0f9ff', bot: '#bae6fd', ribbon: '#0369a1', ink: '#0c4a6e' }
      : kind === 'bois_vallee'
      ? { bg: '#dcfce7', top: '#f0fdf4', bot: '#bbf7d0', ribbon: '#15803d', ink: '#14532d' }
      : kind === 'col_sommet'
      ? { bg: '#fef3c7', top: '#fffbeb', bot: '#fde68a', ribbon: '#b45309', ink: '#451a03' }
      : { bg: '#fbf2dc', top: '#fffbeb', bot: '#ead5af', ribbon: '#78350f', ink: '#24160c' };

  // Swallowtail notched ribbon tails (left & right)
  ctx.fillStyle = '#1c1008';
  ctx.fillRect(x - 6, y + 2, 7, bodyH - 2);
  ctx.fillRect(x + bodyW - 1, y + 2, 7, bodyH - 2);

  ctx.fillStyle = pal.ribbon;
  ctx.fillRect(x - 5, y + 3, 5, bodyH - 4);
  ctx.fillRect(x + bodyW, y + 3, 5, bodyH - 4);
  // Swallowtail V-notch cutout pixels
  ctx.fillStyle = '#1c1008';
  ctx.fillRect(x - 5, y + Math.floor(bodyH / 2), 2, 2);
  ctx.fillRect(x + bodyW + 3, y + Math.floor(bodyH / 2), 2, 2);

  // Main vellum scroll shadow + border + body
  ctx.fillStyle = 'rgba(16, 9, 4, 0.45)';
  ctx.fillRect(x - 1, y + 2, bodyW + 2, bodyH);
  ctx.fillStyle = '#1c1008';
  ctx.fillRect(x - 1, y - 1, bodyW + 2, bodyH + 2);
  ctx.fillStyle = pal.bg;
  ctx.fillRect(x, y, bodyW, bodyH);
  ctx.fillStyle = pal.top;
  ctx.fillRect(x, y, bodyW, 2);
  ctx.fillStyle = pal.bot;
  ctx.fillRect(x, y + bodyH - 2, bodyW, 2);

  // Rolled parchment curl edges on left & right of main body
  ctx.fillStyle = '#8c653b';
  ctx.fillRect(x, y + 1, 2, bodyH - 2);
  ctx.fillRect(x + bodyW - 2, y + 1, 2, bodyH - 2);

  // Tiny 16-bit crest icon on the left of the banner
  const ix = x + 6;
  const iy = y + 4;
  if (kind === 'ville') {
    // Fortified medieval town mural crown & ramparts
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ix, iy + 4, 8, 4);
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(ix + 1, iy + 1, 2, 3);
    ctx.fillRect(ix + 5, iy + 1, 2, 3);
    ctx.fillRect(ix + 3, iy + 2, 2, 2);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(ix + 3, iy + 5, 2, 2);
  } else if (kind === 'village') {
    // Church bell steeple & village roof
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ix + 1, iy + 3, 3, 5);
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(ix + 2, iy + 1, 1, 2);
    ctx.fillStyle = '#c2410c';
    ctx.fillRect(ix + 4, iy + 4, 4, 4);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(ix + 2, iy + 4, 1, 2);
  } else if (kind === 'hameau' || kind === 'quartier') {
    // Tiny gabled cottage roof + chimney
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(ix, iy + 2, 7, 3);
    ctx.fillRect(ix + 2, iy, 3, 2);
    ctx.fillStyle = '#78532f';
    ctx.fillRect(ix + 1, iy + 5, 5, 3);
  } else if (kind === 'col_sommet') {
    // Twin mountain peak
    ctx.fillStyle = '#78532f';
    ctx.fillRect(ix, iy + 5, 8, 3);
    ctx.fillRect(ix + 1, iy + 3, 6, 2);
    ctx.fillStyle = '#24160c';
    ctx.fillRect(ix + 3, iy + 1, 2, 2);
  } else if (kind === 'bois_vallee') {
    // Oak leaf / pine crest
    ctx.fillStyle = '#15803d';
    ctx.fillRect(ix + 1, iy + 1, 5, 5);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ix + 3, iy + 6, 1, 2);
  } else if (kind === 'hydronyme') {
    // Rippling water wave
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(ix, iy + 2, 7, 2);
    ctx.fillRect(ix + 1, iy + 5, 6, 2);
  } else {
    // Lieu-dit stone milestone / compass diamond
    ctx.fillStyle = '#b45309';
    ctx.fillRect(ix + 2, iy + 1, 3, 6);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(ix + 3, iy + 2, 1, 2);
  }

  // Crisp Ink Label
  ctx.fillStyle = pal.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(fullLabel, ix + 10, y + Math.round(bodyH / 2) + 0.5);

  return { x0: x - 7, y0: y - 2, x1: x + bodyW + 7, y1: y + bodyH + 3 };
}

// ============================================================================
// 5. TABLES D'ORIENTATION SOLVER & 360° DEM PANORAMIC RAY-MARCHER
// ============================================================================
export interface PanoramicLandmarkPin {
  id: string;
  label: string;
  subLabel: string;
  bearingDeg: number;
  cardinal: string;
  distanceMeters: number;
  altitudeMeters: number | null;
  deltaAltMeters: number | null;
  elevationAngleDeg: number;
  kind: 'poi_unlocked' | 'poi_mystery' | 'lieu_dit' | 'summit' | 'waterway';
  poi?: PoiItem;
  lat: number;
  lng: number;
}

export interface PanoramicSkylineData {
  observerAltMeters: number;
  /** 180 samples (every 2° from 0° North clockwise to 358°) */
  nearHorizonDeg: number[];
  midHorizonDeg: number[];
  farHorizonDeg: number[];
  pins: PanoramicLandmarkPin[];
}

/**
 * Derives 1–3 interactive Orientation Tables in the active sector:
 * 1) Real OSM / IGN viewpoints & orientation tables (`belvédère`, `table d'orientation`, `panorama`, `sommet`),
 * 2) Plus deterministic high-prominence DEM crests from `ElevationGrid` when fewer than 2 real viewpoints exist,
 *    ensuring every sector has an authentic playable panoramic table on dry accessible ground!
 */
export function deriveSectorOrientationTables(params: {
  centerLat: number;
  centerLng: number;
  pois: PoiItem[];
  terrain: TerrainFeature[];
  elevation: ElevationGrid | null;
  lieuxDits?: LieuDitBanner[];
}): OrientationTableNode[] {
  const { centerLat, centerLng, pois, terrain, elevation, lieuxDits = [] } = params;
  const out: OrientationTableNode[] = [];

  // 1. Real viewpoint / belvedere / orientation table POIs
  for (const poi of pois) {
    if (poi.isSubterranean) continue;
    const hay = `${poi.name} ${poi.subType}`.toLowerCase();
    if (/table d['’]orientation|belvédère|belvedere|panorama|point de vue|vue panoramique/.test(hay)) {
      if (out.some((o) => haversineM(o.lat, o.lng, poi.lat, poi.lng) < 220)) continue;
      const alt = sampleElevationMeters(elevation, poi.lat, poi.lng) ?? 120;
      out.push({
        id: `ot_poi_${poi.id}`,
        name: /table d['’]orientation/i.test(poi.name)
          ? poi.name
          : `Table d’orientation · ${poi.name}`,
        lat: poi.lat,
        lng: poi.lng,
        altitudeMeters: Math.round(alt),
        sourceLabel: poi.source || 'Belvédère topographique',
        poiId: poi.id,
      });
      if (out.length >= 3) return out;
    }
  }

  // Helper to ensure synthesized crest is not inside a water polygon
  const waterPolys = terrain.filter((f) => f.kind === 'water' && f.isPolygon && f.points.length >= 4);
  const isInsideWater = (lat: number, lng: number): boolean => {
    for (const wp of waterPolys) {
      let inside = false;
      const pts = wp.points;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i].lng;
        const yi = pts[i].lat;
        const xj = pts[j].lng;
        const yj = pts[j].lat;
        const intersect =
          yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
        if (intersect) inside = !inside;
      }
      if (inside) return true;
    }
    return false;
  };

  // 2. Topographic Prominence Belvedere from Real DEM Grid (`ElevationGrid`)
  if (out.length < 2 && elevation && elevation.elevDm.length >= elevation.cols * elevation.rows) {
    const cosLat = Math.max(0.15, Math.cos((elevation.centerLat * Math.PI) / 180));
    const halfX = (elevation.cols - 1) / 2;
    const halfY = (elevation.rows - 1) / 2;

    const candidates: Array<{ lat: number; lng: number; alt: number; score: number }> = [];
    for (let gy = 2; gy < elevation.rows - 2; gy++) {
      for (let gx = 2; gx < elevation.cols - 2; gx++) {
        const alt = elevation.elevDm[gy * elevation.cols + gx] / 10;
        // Local prominence over 2-cell ring
        let neighborSum = 0;
        let maxNeighbor = -Infinity;
        for (let dy = -2; dy <= 2; dy += 2) {
          for (let dx = -2; dx <= 2; dx += 2) {
            if (dx === 0 && dy === 0) continue;
            const na = elevation.elevDm[(gy + dy) * elevation.cols + (gx + dx)] / 10;
            neighborSum += na;
            if (na > maxNeighbor) maxNeighbor = na;
          }
        }
        const prominence = alt - neighborSum / 8;
        const lat = elevation.centerLat - ((gy - halfY) * elevation.stepMeters) / 110540;
        const lng = elevation.centerLng + ((gx - halfX) * elevation.stepMeters) / (111320 * cosLat);
        const distCenter = haversineM(centerLat, centerLng, lat, lng);
        if (distCenter < 75 || distCenter > 920) continue;
        if (isInsideWater(lat, lng)) continue;
        // Favor genuine local crests within comfortable walking distance
        const score = alt * 0.55 + prominence * 3.4 - distCenter * 0.012 + (alt >= maxNeighbor ? 8 : 0);
        candidates.push({ lat, lng, alt, score });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    for (const cand of candidates) {
      if (out.some((o) => haversineM(o.lat, o.lng, cand.lat, cand.lng) < 380)) continue;
      // Name after closest lieu-dit or park/road if available
      let nearLabel = '';
      let bestD = 360;
      for (const ld of lieuxDits) {
        const d = haversineM(cand.lat, cand.lng, ld.lat, ld.lng);
        if (d < bestD) {
          bestD = d;
          nearLabel = ld.name;
        }
      }
      if (!nearLabel) {
        for (const tf of terrain) {
          if (!tf.name || tf.points.length === 0) continue;
          if (tf.kind === 'park' || tf.kind === 'forest' || tf.kind === 'plaza') {
            const d = haversineM(cand.lat, cand.lng, tf.points[0].lat, tf.points[0].lng);
            if (d < bestD) {
              bestD = d;
              nearLabel = tf.name;
            }
          }
        }
      }

      out.push({
        id: `ot_dem_${cand.lat.toFixed(4)}_${cand.lng.toFixed(4)}`,
        name: nearLabel
          ? `Table d’orientation · Belvédère de ${nearLabel}`
          : `Table d’orientation · Crête (${Math.round(cand.alt)} m NGF)`,
        lat: cand.lat,
        lng: cand.lng,
        altitudeMeters: Math.round(cand.alt),
        sourceLabel: elevation.sourceLabel || 'Crête altimétrique IGN / MNT',
      });
      if (out.length >= 2) break;
    }
  }

  // 3. Fallback single belvedere if DEM hasn't arrived yet
  if (out.length === 0) {
    out.push({
      id: `ot_sec_${centerLat.toFixed(3)}_${centerLng.toFixed(3)}`,
      name: 'Table d’orientation du Secteur',
      lat: centerLat + 0.0014,
      lng: centerLng + 0.0016,
      altitudeMeters: Math.round(sampleElevationMeters(elevation, centerLat, centerLng) ?? 95),
      sourceLabel: 'Repère panoramique local',
    });
  }

  return out;
}

/**
 * Ray-marches the real `ElevationGrid` across all 360° (180 columns at 2° resolution)
 * in 3 distance bands (near 70–340m, mid 340–880m, far 880–1750m) and projects
 * real POIs, Lieux-dits, Summits, and Waterways onto true compass azimuths!
 */
export function computePanoramicSkyline(params: {
  table: OrientationTableNode;
  pois: PoiItem[];
  unlockedIds: Set<string>;
  lieuxDits: LieuDitBanner[];
  terrain: TerrainFeature[];
  elevation: ElevationGrid | null;
}): PanoramicSkylineData {
  const { table, pois, unlockedIds, lieuxDits, terrain, elevation } = params;
  const obsAlt =
    sampleElevationMeters(elevation, table.lat, table.lng) ?? table.altitudeMeters ?? 100;
  const eyeAlt = obsAlt + 1.65;
  const cosLat = Math.max(0.15, Math.cos((table.lat * Math.PI) / 180));

  const nearHorizonDeg = new Array<number>(180).fill(-2.5);
  const midHorizonDeg = new Array<number>(180).fill(-1.6);
  const farHorizonDeg = new Array<number>(180).fill(-0.8);

  for (let i = 0; i < 180; i++) {
    const azDeg = i * 2;
    const azRad = (azDeg * Math.PI) / 180;
    const sinAz = Math.sin(azRad);
    const cosAz = Math.cos(azRad);

    let maxNear = -5;
    let maxMid = -4;
    let maxFar = -3;

    if (elevation && elevation.elevDm.length >= elevation.cols * elevation.rows) {
      for (const d of [80, 150, 230, 320]) {
        const sLat = table.lat + (cosAz * d) / 110540;
        const sLng = table.lng + (sinAz * d) / (111320 * cosLat);
        const h = sampleElevationMeters(elevation, sLat, sLng);
        if (h !== null) {
          const ang = (Math.atan2(h - eyeAlt, d) * 180) / Math.PI;
          if (ang > maxNear) maxNear = ang;
        }
      }
      for (const d of [400, 540, 700, 860]) {
        const sLat = table.lat + (cosAz * d) / 110540;
        const sLng = table.lng + (sinAz * d) / (111320 * cosLat);
        const h = sampleElevationMeters(elevation, sLat, sLng);
        if (h !== null) {
          const ang = (Math.atan2(h - eyeAlt, d) * 180) / Math.PI;
          if (ang > maxMid) maxMid = ang;
        }
      }
      for (const d of [1000, 1220, 1450, 1700]) {
        const sLat = table.lat + (cosAz * d) / 110540;
        const sLng = table.lng + (sinAz * d) / (111320 * cosLat);
        const h = sampleElevationMeters(elevation, sLat, sLng);
        if (h !== null) {
          const ang = (Math.atan2(h - eyeAlt, d) * 180) / Math.PI;
          if (ang > maxFar) maxFar = ang;
        }
      }
    } else {
      // Gentle deterministic relief modulation when sector is flat or offline
      maxNear = -1.6 + Math.sin(azRad * 3 + table.lat * 40) * 1.1;
      maxMid = -0.6 + Math.sin(azRad * 2 + 1.3) * 1.8 + Math.cos(azRad * 5) * 0.6;
      maxFar = 0.8 + Math.sin(azRad * 1.5 + 2.4) * 2.5 + Math.cos(azRad * 4) * 0.9;
    }

    // Add gentle distant horizon relief harmonic beyond the 1.8km MNT grid edge so flat plains still show subtle horizon depth
    const distantUndulation =
      Math.sin(azRad * 3 + table.lng * 30) * 0.65 + Math.cos(azRad * 7 + table.lat * 25) * 0.3;
    nearHorizonDeg[i] = Math.max(-6, Math.min(18, maxNear));
    midHorizonDeg[i] = Math.max(nearHorizonDeg[i] - 0.5, Math.min(20, maxMid));
    farHorizonDeg[i] = Math.max(
      midHorizonDeg[i] + 0.25,
      Math.min(22, Math.max(maxFar, maxMid + 0.4 + distantUndulation))
    );
  }

  const pins: PanoramicLandmarkPin[] = [];

  // Project POIs (both discovered & veiled seals)
  for (const poi of pois) {
    if (poi.isSubterranean) continue;
    const dist = Math.round(haversineM(table.lat, table.lng, poi.lat, poi.lng));
    if (dist < 18 || dist > 3600) continue;
    const brg = bearingDegrees(table.lat, table.lng, poi.lat, poi.lng);
    const alt = sampleElevationMeters(elevation, poi.lat, poi.lng);
    const delta = alt !== null ? Math.round(alt - obsAlt) : null;
    const elevAng =
      alt !== null ? (Math.atan2(alt - eyeAlt, Math.max(30, dist)) * 180) / Math.PI : 0;
    const unlocked = unlockedIds.has(poi.id);

    pins.push({
      id: `pin_poi_${poi.id}`,
      label: unlocked ? poi.name : `? ${poi.mysteryTitle}`,
      subLabel: unlocked ? poi.subType : `Sceau voilé · ${poi.eraLabel}`,
      bearingDeg: brg,
      cardinal: cardinalFrFromBearing(brg),
      distanceMeters: dist,
      altitudeMeters: alt !== null ? Math.round(alt) : null,
      deltaAltMeters: delta,
      elevationAngleDeg: elevAng,
      kind: unlocked ? 'poi_unlocked' : 'poi_mystery',
      poi,
      lat: poi.lat,
      lng: poi.lng,
    });
  }

  // Project Lieux-dits, Hameaux & Sommets
  for (const ld of lieuxDits) {
    const dist = Math.round(haversineM(table.lat, table.lng, ld.lat, ld.lng));
    if (dist < 40 || dist > 3800) continue;
    if (pins.some((p) => haversineM(p.lat, p.lng, ld.lat, ld.lng) < 65)) continue;
    const brg = bearingDegrees(table.lat, table.lng, ld.lat, ld.lng);
    const alt = ld.altitudeMeters ?? sampleElevationMeters(elevation, ld.lat, ld.lng);
    const delta = alt !== null ? Math.round(alt - obsAlt) : null;
    const elevAng =
      alt !== null ? (Math.atan2(alt - eyeAlt, Math.max(40, dist)) * 180) / Math.PI : 0;

    pins.push({
      id: `pin_ld_${ld.id}`,
      label: ld.name,
      subLabel:
        ld.kind === 'hameau'
          ? 'Hameau & écart habité'
          : ld.kind === 'col_sommet'
          ? 'Relief & sommet coté'
          : ld.kind === 'quartier'
          ? 'Quartier historique'
          : ld.kind === 'bois_vallee'
          ? 'Bois & vallon nommé'
          : 'Lieu-dit cadastral',
      bearingDeg: brg,
      cardinal: cardinalFrFromBearing(brg),
      distanceMeters: dist,
      altitudeMeters: alt !== null ? Math.round(alt) : null,
      deltaAltMeters: delta,
      elevationAngleDeg: elevAng,
      kind: ld.kind === 'col_sommet' ? 'summit' : 'lieu_dit',
      lat: ld.lat,
      lng: ld.lng,
    });
  }

  // Project major named Rivers / Waterways
  const seenRivers = new Set<string>();
  for (const tf of terrain) {
    if ((tf.kind !== 'water' && tf.kind !== 'waterway') || !tf.name || tf.points.length === 0) {
      continue;
    }
    const clean = tf.name.trim();
    if (
      clean.length < 3 ||
      /^(rivière|ruisseau|étendue d’eau|canal)$/i.test(clean) ||
      seenRivers.has(clean.toLowerCase())
    ) {
      continue;
    }
    const mid = tf.points[Math.floor(tf.points.length / 2)];
    const dist = Math.round(haversineM(table.lat, table.lng, mid.lat, mid.lng));
    if (dist < 45 || dist > 2600) continue;
    seenRivers.add(clean.toLowerCase());
    const brg = bearingDegrees(table.lat, table.lng, mid.lat, mid.lng);
    const alt = sampleElevationMeters(elevation, mid.lat, mid.lng);
    pins.push({
      id: `pin_wat_${tf.id}`,
      label: clean,
      subLabel: 'Cours d’eau & vallée',
      bearingDeg: brg,
      cardinal: cardinalFrFromBearing(brg),
      distanceMeters: dist,
      altitudeMeters: alt !== null ? Math.round(alt) : null,
      deltaAltMeters: alt !== null ? Math.round(alt - obsAlt) : null,
      elevationAngleDeg:
        alt !== null ? (Math.atan2(alt - eyeAlt, Math.max(45, dist)) * 180) / Math.PI : -1.5,
      kind: 'waterway',
      lat: mid.lat,
      lng: mid.lng,
    });
    if (seenRivers.size >= 3) break;
  }

  // Sort pins so discovered POIs, summits & closer landmarks take priority without crowding
  pins.sort((a, b) => {
    const prio = (k: PanoramicLandmarkPin['kind']) =>
      k === 'summit' ? 0 : k === 'poi_unlocked' ? 1 : k === 'lieu_dit' ? 2 : k === 'waterway' ? 3 : 4;
    if (prio(a.kind) !== prio(b.kind)) return prio(a.kind) - prio(b.kind);
    return a.distanceMeters - b.distanceMeters;
  });

  return {
    observerAltMeters: Math.round(obsAlt),
    nearHorizonDeg,
    midHorizonDeg,
    farHorizonDeg,
    pins: pins.slice(0, 28),
  };
}
