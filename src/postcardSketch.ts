import { drawExplorerSprite16Bit } from './explorerAvatar';
import { drawNpcSprite16Bit, NpcKind, NpcVoiceKind, WorldNpc } from './npcs';
import {
  classifySectorLithology,
  drawSpecimenSprite16Bit,
  LITHOLOGY_AFFINITY_META,
  translateBedrockPeriodFr,
  translateLithologyLabelFr,
} from './specimens';
import {
  BedrockInfo,
  CATEGORY_META,
  computeLevelFromXp,
  ExplorerAppearance,
  ExplorerProgress,
  LithologyAffinity,
  NpcEncounterRecord,
  PostcardSubject,
  TrophyId,
  UnlockedEntry,
} from './types';
import {
  drawTrophyMedallion16Bit,
  getGenderedTrophyTitle,
  getTrophyById,
  resolveExplorerDisplayTitle,
} from './trophies';

export type PostcardMood = 'day' | 'dusk' | 'night' | 'rain' | 'cavern';

export interface RenderPostcardOptions {
  subject: PostcardSubject;
  appearance: ExplorerAppearance;
  progress: ExplorerProgress;
  localityName: string;
  bedrock: BedrockInfo | null;
  altitudeMeters: number | null;
  mood: PostcardMood;
  customNote: string;
  animTick?: number;
  overrideTrophyId?: TrophyId | '';
}

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const words = cleaned.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length + 4) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.,;:!?]+$/, '')}…`;
  }
  return lines;
}

function encounterRecordToWorldNpc(rec: NpcEncounterRecord): WorldNpc {
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
    facing: 'left',
    seed: rec.seed || 7,
    dialogues: rec.dialogues,
  };
}

function draw16BitPoiLandmark(
  pctx: CanvasRenderingContext2D,
  entry: UnlockedEntry,
  cx: number,
  groundY: number
) {
  const px = (dx: number, dy: number, w: number, h: number, color: string) => {
    pctx.fillStyle = color;
    pctx.fillRect(Math.round(cx + dx), Math.round(groundY + dy), w, h);
  };
  const out = '#140b05';

  if (entry.category === 'legende') {
    // Carved standing menhir + glowing rune + floating wisp
    px(-9, -2, 18, 3, 'rgba(20, 11, 5, 0.35)');
    px(-7, -26, 14, 26, out);
    px(-5, -28, 10, 2, out);
    px(-6, -25, 12, 24, '#6b7280');
    px(-5, -26, 8, 22, '#9ca3af');
    px(-4, -25, 4, 18, '#d1d5db');
    // Glowing violet/gold runes
    px(-2, -19, 4, 2, '#c084fc');
    px(-1, -15, 2, 5, '#fde047');
    px(-3, -13, 6, 1, '#fde047');
    // Fairy wisp
    px(9, -22, 4, 4, 'rgba(240, 171, 252, 0.5)');
    px(10, -21, 2, 2, '#fef08a');
    return;
  }

  if (entry.category === 'ecosysteme') {
    // Ancient venerable oak + wildflower base
    px(-12, -2, 24, 3, 'rgba(20, 11, 5, 0.35)');
    px(-4, -15, 8, 15, out);
    px(-3, -14, 6, 13, '#78350f');
    px(-2, -14, 2, 12, '#92400e');
    // Lush 3-tier crown
    px(-14, -27, 28, 14, out);
    px(-11, -32, 22, 7, out);
    px(-13, -26, 26, 12, '#15803d');
    px(-10, -31, 20, 6, '#16a34a');
    px(-9, -29, 13, 6, '#22c55e');
    px(-7, -30, 8, 3, '#86efac');
    // Wildflowers at roots
    px(-8, -3, 2, 2, '#fde047');
    px(6, -3, 2, 2, '#f472b6');
    return;
  }

  if (entry.category === 'geographie') {
    // Stratified rock belvedere + cascade / cairn
    px(-13, -2, 26, 3, 'rgba(20, 11, 5, 0.35)');
    px(-12, -22, 24, 22, out);
    px(-11, -21, 22, 20, '#9c784c');
    px(-11, -21, 22, 4, '#4ade80');
    px(-11, -17, 22, 4, '#ead7b3');
    px(-3, -17, 6, 16, '#38bdf8');
    px(-2, -17, 2, 15, '#e0f2fe');
    px(-4, -2, 8, 2, '#bae6fd');
    return;
  }

  if (entry.category === 'etrange') {
    // Mysterious stone arch portal + glowing subterranean lantern
    px(-11, -2, 22, 3, 'rgba(20, 11, 5, 0.35)');
    px(-10, -24, 20, 24, out);
    px(-9, -23, 18, 22, '#57534e');
    px(-7, -25, 14, 3, '#a8a29e');
    px(-5, -17, 10, 16, '#0c0a09');
    px(-1, -13, 3, 4, '#f59e0b');
    px(0, -12, 1, 2, '#fef08a');
    return;
  }

  // Default: 'histoire' — Dressed-stone heritage belfry / monument
  px(-12, -2, 24, 3, 'rgba(20, 11, 5, 0.35)');
  px(-9, -25, 18, 25, out);
  px(-8, -24, 16, 23, '#d6c3a3');
  px(-8, -24, 6, 22, '#efe2c6');
  // Slate spire roof
  px(-11, -28, 22, 4, out);
  px(-10, -27, 20, 3, '#334155');
  px(-7, -32, 14, 5, out);
  px(-6, -31, 12, 4, '#475569');
  px(-3, -36, 6, 5, out);
  px(-2, -35, 4, 4, '#64748b');
  px(-1, -39, 2, 4, '#fbbf24');
  // Rose window & arched portal
  px(-3, -19, 6, 5, '#1e293b');
  px(-2, -18, 4, 3, '#38bdf8');
  px(-3, -9, 6, 8, '#451a03');
  px(-2, -8, 4, 7, '#78350f');
}

function draw16BitDiorama(
  targetCtx: CanvasRenderingContext2D,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  opts: RenderPostcardOptions,
  affinity: LithologyAffinity
) {
  const VW = 130;
  const VH = 136;
  const off = document.createElement('canvas');
  off.width = VW;
  off.height = VH;
  const p = off.getContext('2d');
  if (!p) return;
  p.imageSmoothingEnabled = false;

  const { subject, appearance, mood, animTick = 0 } = opts;
  const isNight = mood === 'night' || mood === 'cavern';
  const isDusk = mood === 'dusk';
  const isRain = mood === 'rain';
  const isCavern = mood === 'cavern';

  // 1. Sky / Cavern Vault Backdrop (banded 16-bit SNES palette)
  const skyBands = isCavern
    ? ['#140f0d', '#1c1613', '#29211d', '#362c26']
    : mood === 'night'
    ? ['#090d24', '#11193d', '#1b2859', '#27386e']
    : isDusk
    ? ['#3b1d5e', '#7c2d58', '#c2413b', '#f59e0b']
    : isRain
    ? ['#334155', '#475569', '#64748b', '#94a3b8']
    : ['#0284c7', '#38bdf8', '#7dd3fc', '#bae6fd'];

  const horizonY = 88;
  const bandH = Math.ceil(horizonY / skyBands.length);
  for (let i = 0; i < skyBands.length; i++) {
    p.fillStyle = skyBands[i];
    p.fillRect(0, i * bandH, VW, bandH + 1);
  }

  // Celestial body or cavern stalactites
  if (isCavern) {
    p.fillStyle = '#0c0a09';
    for (let x = 0; x < VW; x += 9) {
      const len = 7 + ((x * 7) % 11);
      p.fillRect(x, 0, 6, len);
      p.fillRect(x + 2, len, 2, 4);
    }
    // Glowing ceiling crystals
    p.fillStyle = '#22d3ee';
    p.fillRect(24, 9, 2, 4);
    p.fillRect(88, 11, 2, 5);
    p.fillStyle = '#cffafe';
    p.fillRect(24, 10, 1, 2);
  } else if (mood === 'night') {
    // Pixel crescent moon & twinkling stars
    p.fillStyle = '#fef9c3';
    p.fillRect(98, 14, 10, 10);
    p.fillStyle = skyBands[0];
    p.fillRect(102, 13, 8, 8);
    const stars = [
      [14, 12],
      [34, 20],
      [56, 10],
      [74, 24],
      [22, 34],
      [114, 30],
    ];
    p.fillStyle = '#ffffff';
    for (const [sx, sy] of stars) {
      p.fillRect(sx, sy, 1, 1);
    }
  } else if (isDusk) {
    // Setting golden-crimson sun near horizon
    p.fillStyle = '#fde047';
    p.fillRect(88, 56, 16, 12);
    p.fillStyle = '#fef9c3';
    p.fillRect(91, 58, 10, 6);
  } else if (!isRain) {
    // Crisp sunlit clouds & sun
    p.fillStyle = '#fef08a';
    p.fillRect(98, 13, 12, 12);
    p.fillStyle = '#ffffff';
    p.fillRect(18, 18, 22, 6);
    p.fillRect(22, 15, 14, 4);
    p.fillRect(62, 26, 18, 5);
  } else {
    // Heavy rain clouds
    p.fillStyle = '#1e293b';
    p.fillRect(10, 10, 42, 9);
    p.fillRect(66, 14, 48, 9);
  }

  // 2. Distant Regional Hills Silhouette
  p.fillStyle = isCavern
    ? '#231d19'
    : isNight
    ? '#17253b'
    : isDusk
    ? '#4c2646'
    : isRain
    ? '#334e58'
    : '#2d6a4f';
  for (let x = 0; x < VW; x++) {
    const hillH = Math.round(9 + Math.sin(x * 0.065) * 5 + Math.cos(x * 0.03) * 3);
    p.fillRect(x, horizonY - hillH, 1, hillH);
  }

  // 3. Meadow / Cavern Ground Plane (y: 88..116)
  const groundTop = horizonY;
  const strataTop = 116;
  p.fillStyle = isCavern
    ? '#44403c'
    : isNight
    ? '#143829'
    : isDusk
    ? '#3f6212'
    : '#4da142';
  p.fillRect(0, groundTop, VW, strataTop - groundTop);

  // Subtle path / clearing under explorer and subject
  p.fillStyle = isCavern ? '#57534e' : isNight ? '#3e3529' : '#c9a677';
  p.fillRect(18, 101, 94, 9);
  p.fillStyle = isCavern ? '#78716c' : isNight ? '#524637' : '#e2c799';
  p.fillRect(22, 103, 86, 5);

  // 4. Real Geological Bedrock Cutaway Band at Bottom (y: 116..136)
  const affMeta = LITHOLOGY_AFFINITY_META[affinity] || LITHOLOGY_AFFINITY_META.calcaire;
  p.fillStyle = '#140b05';
  p.fillRect(0, strataTop, VW, 2);
  p.fillStyle = affMeta.rockColor;
  p.fillRect(0, strataTop + 2, VW, VH - strataTop - 2);
  // Lithology texture details inside strata cutaway
  for (let sx = 2; sx < VW - 4; sx += 10) {
    if (affinity === 'calcaire') {
      p.fillStyle = '#c6b08d';
      p.fillRect(sx, strataTop + 8, 8, 1);
      p.fillRect(sx + 4, strataTop + 3, 1, 5);
    } else if (affinity === 'granit') {
      p.fillStyle = '#f8fafc';
      p.fillRect(sx + 1, strataTop + 5, 2, 2);
      p.fillStyle = '#1e293b';
      p.fillRect(sx + 5, strataTop + 10, 2, 2);
    } else if (affinity === 'schiste') {
      p.fillStyle = '#334155';
      p.fillRect(sx, strataTop + 6, 9, 1);
      p.fillRect(sx + 1, strataTop + 12, 8, 1);
    } else if (affinity === 'volcanique') {
      p.fillStyle = '#18181b';
      p.fillRect(sx, strataTop + 2, 1, 18);
      p.fillStyle = '#84cc16';
      p.fillRect(sx + 4, strataTop + 9, 2, 2);
    } else {
      p.fillStyle = 'rgba(20, 11, 5, 0.22)';
      p.fillRect(sx + 2, strataTop + 7, 4, 3);
    }
  }

  // 5. Customized 16-Bit Explorer Sprite on the left (facing right toward discovery!)
  drawExplorerSprite16Bit(p, {
    cx: 38,
    cy: 105,
    scale: 1,
    facingDir: 'right',
    isWalking: false,
    animTick,
    appearance,
    drawAura: isNight || isDusk,
    isNight,
  });

  // 6. Subject Focal Sprite on the right
  if (subject.kind === 'poi') {
    draw16BitPoiLandmark(p, subject.entry, 88, 105);
  } else if (subject.kind === 'encounter') {
    const npc = encounterRecordToWorldNpc(subject.encounter);
    drawNpcSprite16Bit(p, {
      cx: 86,
      cy: 105,
      scale: 1.35,
      npc,
      animTick,
      showSpeechBubble: npc.isHuman,
      isSelected: false,
    });
  } else {
    // Specimen mounted on a natural field outcrop
    p.fillStyle = '#140b05';
    p.fillRect(75, 98, 26, 9);
    p.fillStyle = affMeta.rockColor;
    p.fillRect(77, 99, 22, 6);
    drawSpecimenSprite16Bit(p, {
      cx: 88,
      cy: 100,
      scale: 1.6,
      specimenId: subject.specimen.specimenId,
      animTick,
    });
  }

  // 7. Ambient Weather / Circadian Foreground Particles (Raindrops or Dusk/Night Fireflies!)
  if (isRain) {
    p.fillStyle = 'rgba(186, 230, 253, 0.72)';
    for (let i = 0; i < 18; i++) {
      const rx = (i * 19 + animTick * 3) % (VW - 4);
      const ry = (i * 23 + animTick * 5) % (strataTop - 6);
      p.fillRect(rx, ry, 1, 5);
    }
  } else if (mood === 'dusk' || mood === 'night') {
    const glowSpots = [
      [18, 82],
      [62, 76],
      [108, 84],
      [74, 92],
    ];
    for (const [gx, gy] of glowSpots) {
      p.fillStyle = 'rgba(190, 242, 100, 0.38)';
      p.fillRect(gx - 1, gy - 1, 4, 4);
      p.fillStyle = '#fef08a';
      p.fillRect(gx, gy, 2, 2);
    }
  }

  targetCtx.save();
  targetCtx.imageSmoothingEnabled = false;
  targetCtx.drawImage(off, 0, 0, VW, VH, dx, dy, dw, dh);
  targetCtx.restore();
}

function drawPostmarkStamp(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  locality: string,
  dateStr: string,
  altLabel: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.16);

  const ink = 'rgba(153, 27, 27, 0.84)';
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;

  // Wavy postal cancellation lines extending left
  ctx.lineWidth = 2;
  for (let row = -18; row <= 18; row += 12) {
    ctx.beginPath();
    for (let x = -118; x <= -46; x += 4) {
      const y = row + Math.sin(x * 0.22) * 3.2;
      if (x === -118) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Outer & inner circular postmark rings
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, 0, 48, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, 41, 0, Math.PI * 2);
  ctx.stroke();

  // Horizontal date bridge inside stamp
  ctx.beginPath();
  ctx.moveTo(-39, -9);
  ctx.lineTo(39, -9);
  ctx.moveTo(-39, 9);
  ctx.lineTo(39, 9);
  ctx.stroke();

  const shortLoc = locality.toUpperCase().slice(0, 16);
  ctx.textAlign = 'center';
  ctx.font = 'bold 9.5px "IBM Plex Mono", monospace';
  ctx.fillText(shortLoc, 0, -17);
  ctx.font = 'bold 10.5px "IBM Plex Mono", monospace';
  ctx.fillText(dateStr, 0, 3.5);
  ctx.font = 'bold 8.5px "IBM Plex Mono", monospace';
  ctx.fillText(altLabel, 0, 23);

  ctx.restore();
}

/**
 * Renders a crisp 960x600 16-bit Pixel-Art Souvenir Postcard onto the given `<canvas>`.
 */
export function renderPostcard16BitToCanvas(
  canvas: HTMLCanvasElement,
  opts: RenderPostcardOptions
): void {
  const W = 960;
  const H = 600;
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { subject, progress, localityName, bedrock, altitudeMeters, customNote } = opts;

  const affinity: LithologyAffinity =
    subject.kind === 'specimen'
      ? subject.specimen.affinity
      : classifySectorLithology(bedrock, []);
  const lithoFr =
    subject.kind === 'specimen'
      ? subject.specimen.lithologyLabel
      : translateLithologyLabelFr(bedrock, affinity);
  const periodFr =
    subject.kind === 'specimen'
      ? subject.specimen.bedrockPeriod
      : translateBedrockPeriodFr(bedrock?.period);

  // 1. Outer Vintage Vellum Postcard Stock + Ornate Double Frame
  ctx.fillStyle = '#24150b';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#d97706';
  ctx.fillRect(8, 8, W - 16, H - 16);
  ctx.fillStyle = '#f8eed5';
  ctx.fillRect(14, 14, W - 28, H - 28);

  // Subtle parchment rules
  ctx.strokeStyle = '#c89d62';
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, W - 44, H - 44);

  // Corner brass rivets
  const corners = [
    [18, 18],
    [W - 28, 18],
    [18, H - 28],
    [W - 28, H - 28],
  ];
  for (const [rx, ry] of corners) {
    ctx.fillStyle = '#24150b';
    ctx.fillRect(rx, ry, 10, 10);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(rx + 2, ry + 2, 6, 6);
  }

  // 2. Left 16-Bit Diorama Frame (520 x 544 -> exact 4x integer scale of 130x136!)
  const dioX = 32;
  const dioY = 28;
  const dioW = 520;
  const dioH = 544;
  ctx.fillStyle = '#1f1209';
  ctx.fillRect(dioX - 4, dioY - 4, dioW + 8, dioH + 8);
  draw16BitDiorama(ctx, dioX, dioY, dioW, dioH, opts, affinity);

  // Small pixel caption ribbon at bottom-left of diorama
  ctx.fillStyle = 'rgba(24, 14, 7, 0.84)';
  ctx.fillRect(dioX + 10, dioY + dioH - 34, dioW - 20, 24);
  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 12px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(
    `SOCLE : ${lithoFr.toUpperCase().slice(0, 28)} · ${periodFr.toUpperCase().slice(0, 16)}`,
    dioX + 18,
    dioY + dioH - 18
  );

  // 3. Classic Postcard Vertical Divider
  const rightX = 576;
  const rightW = W - rightX - 34;
  ctx.strokeStyle = '#bfa074';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(564, 38);
  ctx.lineTo(564, H - 38);
  ctx.stroke();

  // 4. Top-Right Perforated 16-Bit Postage Stamp + Locality Postmark
  const stampX = W - 106;
  const stampY = 38;
  ctx.fillStyle = '#e5d3b3';
  ctx.fillRect(stampX - 4, stampY - 4, 68, 80);
  ctx.strokeStyle = '#78532f';
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(stampX - 4, stampY - 4, 68, 80);
  ctx.setLineDash([]);
  ctx.fillStyle = '#991b1b';
  ctx.fillRect(stampX + 2, stampY + 2, 56, 68);
  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 10px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TERRA 16', stampX + 30, stampY + 18);
  ctx.fillStyle = '#fde047';
  ctx.fillRect(stampX + 18, stampY + 26, 24, 22);
  ctx.fillStyle = '#991b1b';
  ctx.fillRect(stampX + 24, stampY + 31, 12, 12);
  ctx.fillStyle = '#fef3c7';
  ctx.fillText('16 BIT', stampX + 30, stampY + 62);

  // Derive subject texts & coordinates
  let kicker = '';
  let title = '';
  let subtitle = '';
  let bodyExcerpt = '';
  let lat = 0;
  let lng = 0;
  let dateIso = new Date().toISOString();
  let effectiveLoc = localityName || 'Contrée explorée';
  let altVal = altitudeMeters;

  if (subject.kind === 'poi') {
    const meta = CATEGORY_META[subject.entry.category];
    kicker = `LIEU DÉCOUVERT · ${meta.shortLabel.toUpperCase()}`;
    title = subject.entry.name;
    subtitle = `${subject.entry.subType} · ${subject.entry.eraLabel}`;
    bodyExcerpt = subject.entry.personalNote?.trim() || subject.entry.summary;
    lat = subject.entry.lat;
    lng = subject.entry.lng;
    dateIso = subject.entry.discoveredAtIso || dateIso;
  } else if (subject.kind === 'encounter') {
    kicker = subject.encounter.isHuman
      ? 'RENCONTRE LOCALE · CARNET'
      : 'OBSERVATION RARE · BESTIAIRE';
    title = subject.encounter.name;
    subtitle = `${subject.encounter.roleLabel} · ${subject.encounter.habitatLabel}`;
    bodyExcerpt = subject.encounter.dialogues[0] || '';
    lat = subject.encounter.lat;
    lng = subject.encounter.lng;
    dateIso = subject.encounter.lastMetIso || dateIso;
    effectiveLoc = subject.encounter.regionLabel || effectiveLoc;
  } else {
    kicker =
      subject.specimen.domain === 'botanique'
        ? 'CROQUIS D’HERBIER · FLORE'
        : 'ÉCHANTILLON · LITHOTHÈQUE';
    title = subject.specimen.name;
    subtitle = `${subject.specimen.latinOrMineralName} · ${subject.specimen.lithologyLabel}`;
    bodyExcerpt = subject.specimen.description;
    lat = subject.specimen.lat;
    lng = subject.specimen.lng;
    dateIso = subject.specimen.lastCollectedIso || dateIso;
    effectiveLoc = subject.specimen.regionLabel || effectiveLoc;
    if (subject.specimen.altitudeMeters !== null) {
      altVal = subject.specimen.altitudeMeters;
    }
  }

  const dateFr = new Date(dateIso).toLocaleDateString('fr-FR');
  const altStampStr =
    altVal !== null && Number.isFinite(altVal) ? `ALT. ${Math.round(altVal)} M` : 'CARNET 16-BIT';

  // Inked circular postmark overlapping stamp!
  drawPostmarkStamp(ctx, stampX - 22, stampY + 48, effectiveLoc, dateFr, altStampStr);

  // 5. Right-Side Cartographic & Literary Content
  ctx.textAlign = 'left';
  ctx.fillStyle = '#991b1b';
  ctx.font = 'bold 12px "IBM Plex Mono", monospace';
  ctx.fillText('CARTE POSTALE D’EXPLORATION', rightX, 58);

  ctx.fillStyle = '#78350f';
  ctx.font = 'bold 11px "IBM Plex Mono", monospace';
  ctx.fillText(kicker, rightX, 146);

  // Title (1-2 lines)
  ctx.fillStyle = '#24150b';
  ctx.font = 'bold 24px "Cinzel", Georgia, serif';
  const titleLines = wrapCanvasLines(ctx, title, rightW, 2);
  let cursorY = 178;
  for (const line of titleLines) {
    ctx.fillText(line, rightX, cursorY);
    cursorY += 29;
  }

  // Subtitle
  ctx.fillStyle = '#5c3b1e';
  ctx.font = 'italic 14px Georgia, serif';
  const subLines = wrapCanvasLines(ctx, subtitle, rightW, 2);
  for (const line of subLines) {
    ctx.fillText(line, rightX, cursorY - 4);
    cursorY += 20;
  }

  // Decorative brass rule
  ctx.fillStyle = '#c89d62';
  ctx.fillRect(rightX, cursorY + 2, rightW, 2);
  cursorY += 26;

  // Main field note / observation excerpt
  ctx.fillStyle = '#2d1c10';
  ctx.font = '15px "Plus Jakarta Sans", system-ui, sans-serif';
  const bodyLines = wrapCanvasLines(ctx, bodyExcerpt, rightW, customNote.trim() ? 4 : 6);
  for (const line of bodyLines) {
    ctx.fillText(line, rightX, cursorY);
    cursorY += 23;
  }

  // Optional Explorer Personal Dedication Box
  if (customNote.trim()) {
    cursorY += 8;
    ctx.fillStyle = '#efe2c6';
    ctx.fillRect(rightX, cursorY - 16, rightW, 68);
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rightX, cursorY - 16, rightW, 68);
    ctx.fillStyle = '#451a03';
    ctx.font = 'italic 14px Georgia, serif';
    const noteLines = wrapCanvasLines(ctx, `« ${customNote.trim()} »`, rightW - 20, 2);
    let ny = cursorY + 8;
    for (const nl of noteLines) {
      ctx.fillText(nl, rightX + 10, ny);
      ny += 21;
    }
  }

  // 6. Signature, Pinned Trophy Medallion & Geodesic Footer
  const lvl = computeLevelFromXp(progress.totalXp || 0).level;
  const footerY = H - 78;
  ctx.fillStyle = '#c89d62';
  ctx.fillRect(rightX, footerY - 14, rightW, 1.5);

  const effectiveTrophyId =
    opts.overrideTrophyId !== undefined ? opts.overrideTrophyId : progress.pinnedTrophyId;
  const activeTrophy = getTrophyById(effectiveTrophyId);
  const resolvedTitle = activeTrophy
    ? getGenderedTrophyTitle(activeTrophy, progress.gender)
    : resolveExplorerDisplayTitle(progress).title;

  const textMaxW = activeTrophy ? rightW - 54 : rightW;

  ctx.fillStyle = '#24150b';
  ctx.font = 'bold 14px "Cinzel", Georgia, serif';
  ctx.fillText(
    `${(progress.displayName || 'Explorateur').slice(0, 22)} · Niv. ${lvl}`,
    rightX,
    footerY + 4
  );

  ctx.fillStyle = '#991b1b';
  ctx.font = 'italic bold 12px Georgia, serif';
  const titleLine = wrapCanvasLines(ctx, resolvedTitle, textMaxW, 1)[0] || resolvedTitle;
  ctx.fillText(titleLine, rightX, footerY + 22);

  ctx.fillStyle = '#6b4928';
  ctx.font = '11px "IBM Plex Mono", monospace';
  ctx.fillText(
    `${effectiveLoc.slice(0, 24)} · ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`,
    rightX,
    footerY + 39
  );

  if (activeTrophy) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    drawTrophyMedallion16Bit(
      ctx,
      activeTrophy.id,
      rightX + rightW - 48,
      footerY - 6,
      2,
      true,
      opts.animTick || 0
    );
    ctx.restore();
  }
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Impossible de générer l’image PNG.'));
    }, 'image/png');
  });
}
