export type SeasonKey = 'printemps' | 'ete' | 'automne' | 'hiver';

export interface MoonPhaseInfo {
  /** 0 = New, 1 = Waxing Crescent, 2 = First Quarter, 3 = Waxing Gibbous, 4 = Full, 5 = Waning Gibbous, 6 = Last Quarter, 7 = Waning Crescent */
  phaseIndex: number;
  /** 0.0 to 1.0 lunation progress */
  lunationProgress: number;
  /** 0 to 100 % illuminated disk */
  illuminationPct: number;
  phaseNameFr: string;
  shortNameFr: string;
  isMeteorShowerNight: boolean;
  meteorShowerNameFr: string | null;
}

const SYNODIC_MONTH_DAYS = 29.53058867;
// Reference Astronomical New Moon: 2000-01-06 18:14 UTC
const REF_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

export interface MeteorShowerDefinition {
  id: string;
  nameFr: string;
  constellationFr: string;
  zhrEstimate: number;
  month: number; // 1..12
  startDay: number;
  endDay: number;
}

export const METEOR_SHOWERS: MeteorShowerDefinition[] = [
  {
    id: 'quadrantides',
    nameFr: 'Quadrantides d’Hiver',
    constellationFr: 'Bouvier (Quadrans)',
    zhrEstimate: 80,
    month: 1,
    startDay: 1,
    endDay: 6,
  },
  {
    id: 'lyrides',
    nameFr: 'Lyrides de Printemps',
    constellationFr: 'Lyre (Véga)',
    zhrEstimate: 18,
    month: 4,
    startDay: 18,
    endDay: 25,
  },
  {
    id: 'eta_aquarides',
    nameFr: 'Êta Aquarides (Comète de Halley)',
    constellationFr: 'Verseau',
    zhrEstimate: 45,
    month: 5,
    startDay: 3,
    endDay: 9,
  },
  {
    id: 'delta_aquarides',
    nameFr: 'Delta Aquarides d’Été',
    constellationFr: 'Verseau austral',
    zhrEstimate: 20,
    month: 7,
    startDay: 25,
    endDay: 31,
  },
  {
    id: 'perseides',
    nameFr: 'Perséides d’Août',
    constellationFr: 'Persée',
    zhrEstimate: 100,
    month: 8,
    startDay: 9,
    endDay: 16,
  },
  {
    id: 'draconides',
    nameFr: 'Draconides d’Octobre',
    constellationFr: 'Dragon',
    zhrEstimate: 15,
    month: 10,
    startDay: 6,
    endDay: 10,
  },
  {
    id: 'orionides',
    nameFr: 'Orionides d’Automne',
    constellationFr: 'Orion',
    zhrEstimate: 22,
    month: 10,
    startDay: 18,
    endDay: 24,
  },
  {
    id: 'taurides',
    nameFr: 'Taurides d’Automne (Bolides d’Encke)',
    constellationFr: 'Taureau (Pléiades)',
    zhrEstimate: 12,
    month: 11,
    startDay: 1,
    endDay: 12,
  },
  {
    id: 'leonides',
    nameFr: 'Léonides de Novembre',
    constellationFr: 'Lion',
    zhrEstimate: 18,
    month: 11,
    startDay: 14,
    endDay: 21,
  },
  {
    id: 'geminides',
    nameFr: 'Géminides d’Hiver',
    constellationFr: 'Gémeaux (Castor)',
    zhrEstimate: 120,
    month: 12,
    startDay: 10,
    endDay: 17,
  },
  {
    id: 'ursides',
    nameFr: 'Ursides du Solstice',
    constellationFr: 'Petite Ourse',
    zhrEstimate: 10,
    month: 12,
    startDay: 21,
    endDay: 26,
  },
];

export function getUpcomingOrActiveMeteorShower(date: Date = new Date()): {
  shower: MeteorShowerDefinition;
  status: 'active' | 'upcoming';
  startsAtMs: number;
  endsAtMs: number;
  daysUntilStart: number;
} {
  const year = date.getFullYear();
  const nowMs = date.getTime();

  const candidates: Array<{
    shower: MeteorShowerDefinition;
    startsAtMs: number;
    endsAtMs: number;
  }> = [];

  for (const yr of [year, year + 1]) {
    for (const s of METEOR_SHOWERS) {
      const start = new Date(yr, s.month - 1, s.startDay, 0, 0, 0, 0).getTime();
      const end = new Date(yr, s.month - 1, s.endDay, 23, 59, 59, 999).getTime();
      candidates.push({ shower: s, startsAtMs: start, endsAtMs: end });
    }
  }

  const active = candidates.find((c) => nowMs >= c.startsAtMs && nowMs <= c.endsAtMs);
  if (active) {
    return {
      shower: active.shower,
      status: 'active',
      startsAtMs: active.startsAtMs,
      endsAtMs: active.endsAtMs,
      daysUntilStart: 0,
    };
  }

  const upcoming =
    candidates
      .filter((c) => c.startsAtMs > nowMs)
      .sort((a, b) => a.startsAtMs - b.startsAtMs)[0] || candidates[0];

  const daysUntilStart = Math.max(
    1,
    Math.ceil((upcoming.startsAtMs - nowMs) / 86_400_000)
  );
  return {
    shower: upcoming.shower,
    status: 'upcoming',
    startsAtMs: upcoming.startsAtMs,
    endsAtMs: upcoming.endsAtMs,
    daysUntilStart,
  };
}

export function resolveReferenceCalendarDate(
  previewMonthDay?: { month: number; day: number } | null
): Date {
  const now = new Date();
  if (!previewMonthDay) return now;
  return new Date(
    now.getFullYear(),
    Math.max(0, Math.min(11, previewMonthDay.month - 1)),
    Math.max(1, Math.min(31, previewMonthDay.day)),
    now.getHours(),
    now.getMinutes()
  );
}

export function computeRealMoonPhase(date: Date = new Date()): MoonPhaseInfo {
  const elapsedDays = (date.getTime() - REF_NEW_MOON_MS) / 86_400_000;
  const rawMod = ((elapsedDays % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
  const lunationProgress = rawMod / SYNODIC_MONTH_DAYS;

  const illuminationFraction = (1 - Math.cos(lunationProgress * Math.PI * 2)) / 2;
  const illuminationPct = Math.round(illuminationFraction * 100);

  const phaseIndex = Math.floor(((lunationProgress + 1 / 16) % 1) * 8);

  const NAMES: Array<{ full: string; short: string }> = [
    { full: 'Nouvelle Lune', short: 'Nouv. Lune' },
    { full: 'Premier Croissant', short: '1er Croissant' },
    { full: 'Premier Quartier', short: '1er Quartier' },
    { full: 'Lune Gibbeuse Croissante', short: 'Gibbeuse +' },
    { full: 'Pleine Lune', short: 'Pleine Lune' },
    { full: 'Lune Gibbeuse Décroissante', short: 'Gibbeuse −' },
    { full: 'Dernier Quartier', short: 'Dern. Quartier' },
    { full: 'Dernier Croissant', short: 'Dern. Croissant' },
  ];

  const m = date.getMonth() + 1;
  const d = date.getDate();
  const shower =
    METEOR_SHOWERS.find((s) => s.month === m && d >= s.startDay && d <= s.endDay) || null;

  return {
    phaseIndex,
    lunationProgress,
    illuminationPct,
    phaseNameFr: NAMES[phaseIndex]?.full || 'Lune',
    shortNameFr: NAMES[phaseIndex]?.short || 'Lune',
    isMeteorShowerNight: Boolean(shower),
    meteorShowerNameFr: shower ? shower.nameFr : null,
  };
}

/**
 * Draws a crisp 7x7 16-bit Pixel-Art Moon matching the exact astronomical phaseIndex (0..7),
 * with subtle slate earthshine on the unlit limb and warm silver-gold illumination.
 */
export function drawPixelMoon16Bit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  unitPx: number,
  phaseIndex: number,
  drawHalo = true
): void {
  const u = Math.max(1, Math.round(unitPx));
  const diskMask = [
    '0011100',
    '0111110',
    '1111111',
    '1111111',
    '1111111',
    '0111110',
    '0011100',
  ];

  if (drawHalo && phaseIndex !== 0) {
    ctx.fillStyle =
      phaseIndex === 4 ? 'rgba(254, 240, 138, 0.24)' : 'rgba(254, 240, 138, 0.14)';
    ctx.fillRect(x - u, y - u, 9 * u, 9 * u);
  }

  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      if (diskMask[row][col] !== '1') continue;
      // Determine whether this pixel column is sunlit for the given phase (Northern Hemisphere view)
      let lit = false;
      switch (phaseIndex % 8) {
        case 0: // New Moon — faint earthshine rim on right
          lit = false;
          break;
        case 1: // Waxing Crescent (right sliver lit)
          lit = col >= 5 || (col === 4 && (row <= 1 || row >= 5));
          break;
        case 2: // First Quarter (right half lit)
          lit = col >= 3;
          break;
        case 3: // Waxing Gibbous (mostly lit except left sliver)
          lit = col >= 2 || (col === 1 && row >= 2 && row <= 4);
          break;
        case 4: // Full Moon
          lit = true;
          break;
        case 5: // Waning Gibbous (mostly lit except right sliver)
          lit = col <= 4 || (col === 5 && row >= 2 && row <= 4);
          break;
        case 6: // Last Quarter (left half lit)
          lit = col <= 3;
          break;
        case 7: // Waning Crescent (left sliver lit)
          lit = col <= 1 || (col === 2 && (row <= 1 || row >= 5));
          break;
      }

      if (lit) {
        const isCrater =
          phaseIndex === 4 && ((row === 2 && col === 4) || (row === 4 && col === 2));
        const isCore = row >= 2 && row <= 4 && col >= 2 && col <= 4 && !isCrater;
        ctx.fillStyle = isCrater ? '#eab308' : isCore ? '#ffffff' : '#fef08a';
      } else {
        ctx.fillStyle = phaseIndex === 0 && col === 5 ? '#475569' : '#1e293b';
      }
      ctx.fillRect(x + col * u, y + row * u, u, u);
    }
  }
}

export interface CalendarSeasonVisuals {
  season: SeasonKey;
  labelFr: string;
  hillDark: string;
  hillMid: string;
  meadowBase: string;
  meadowRim: string;
  particleKind: 'blossom_petals' | 'summer_pollen' | 'autumn_leaves' | 'winter_frost';
}

export function resolveCalendarSeasonVisuals(
  monthZeroIndexedOrDate: number | Date = new Date()
): CalendarSeasonVisuals {
  let m: number;
  let d: number | null = null;
  if (monthZeroIndexedOrDate instanceof Date) {
    m = monthZeroIndexedOrDate.getMonth();
    d = monthZeroIndexedOrDate.getDate();
  } else {
    m = ((monthZeroIndexedOrDate % 12) + 12) % 12;
  }

  // Exact astronomical & French calendar seasons
  let isSpring = false;
  let isSummer = false;
  let isAutumn = false;

  if (d !== null) {
    const md = (m + 1) * 100 + d;
    isSpring = md >= 320 && md <= 620;
    isSummer = md >= 621 && md <= 921;
    isAutumn = md >= 922 && md <= 1220;
  } else {
    isSpring = m >= 2 && m <= 4;
    isSummer = m >= 5 && m <= 7;
    isAutumn = m >= 8 && m <= 10;
  }

  if (isSpring) {
    return {
      season: 'printemps',
      labelFr: 'Printemps en fleurs',
      hillDark: '#14532d',
      hillMid: '#15803d',
      meadowBase: '#228b3b',
      meadowRim: '#86efac',
      particleKind: 'blossom_petals',
    };
  }
  if (isSummer) {
    return {
      season: 'ete',
      labelFr: 'Été doré',
      hillDark: '#14532d',
      hillMid: '#166534',
      meadowBase: '#258032',
      meadowRim: '#bef264',
      particleKind: 'summer_pollen',
    };
  }
  if (isAutumn) {
    return {
      season: 'automne',
      labelFr: 'Automne ambré',
      hillDark: '#5c2409',
      hillMid: '#9a3412',
      meadowBase: '#4d6b2a',
      meadowRim: '#f59e0b',
      particleKind: 'autumn_leaves',
    };
  }
  return {
    season: 'hiver',
    labelFr: 'Hiver givré',
    hillDark: '#1e3a3a',
    hillMid: '#335c5c',
    meadowBase: '#2d5a46',
    meadowRim: '#cbd5e1',
    particleKind: 'winter_frost',
  };
}
