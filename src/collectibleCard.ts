import { CATEGORY_META, UnlockedEntry } from './types';

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let cur = '';

  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth) {
      cur = test;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    }
  }
  if (cur && lines.length < maxLines) {
    lines.push(cur);
  }
  if (lines.length === maxLines && words.length > 0) {
    const last = lines[maxLines - 1];
    if (!last.endsWith('…') && text.length > lines.join(' ').length + 4) {
      lines[maxLines - 1] = `${last.slice(0, Math.max(10, last.length - 2))}…`;
    }
  }
  return lines;
}

/**
 * Generates a Deterministic Archive Serial Code from POI ID
 */
export function computeArchiveSealCode(poiId: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < poiId.length; i++) {
    h ^= poiId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hex = (h >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `T16-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

/**
 * Forges and downloads a crisp 16-bit JRPG Illuminated Souvenir Card PNG (720x960)
 */
export function downloadCollectibleCardPng(
  entry: UnlockedEntry,
  explorerCallsign: string,
  altitudeMeters?: number | null
): void {
  const W = 720;
  const H = 960;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;

  const cat = CATEGORY_META[entry.category] || CATEGORY_META.histoire;

  // 1. Deep Mahogany Leather Outer Frame
  ctx.fillStyle = '#1e110a';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#3b2113';
  ctx.fillRect(12, 12, W - 24, H - 24);

  // Brass double border
  ctx.fillStyle = '#d97706';
  ctx.fillRect(22, 22, W - 44, H - 44);
  ctx.fillStyle = '#28160d';
  ctx.fillRect(28, 28, W - 56, H - 56);

  // Warm Vellum Parchment Body
  ctx.fillStyle = '#f8edd6';
  ctx.fillRect(34, 34, W - 68, H - 68);

  // Subtle parchment grain bands
  ctx.fillStyle = '#f1dfc0';
  for (let y = 46; y < H - 46; y += 16) {
    ctx.fillRect(38, y, W - 76, 4);
  }

  // Ornate Pixel Corner Clasps
  const corners = [
    [22, 22],
    [W - 46, 22],
    [22, H - 46],
    [W - 46, H - 46],
  ];
  for (const [cx, cy] of corners) {
    ctx.fillStyle = '#1e110a';
    ctx.fillRect(cx, cy, 24, 24);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(cx + 4, cy + 4, 16, 16);
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(cx + 8, cy + 8, 8, 8);
  }

  // 2. Top Guild Banner Header
  ctx.fillStyle = '#28160d';
  ctx.fillRect(54, 54, W - 108, 76);
  ctx.fillStyle = cat.mapHex;
  ctx.fillRect(58, 58, W - 116, 8);

  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 18px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`TERRA 16 · FEUILLET D’ARCHIVE`, 78, 92);

  ctx.fillStyle = '#f8edd6';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`${cat.label.toUpperCase()}  ·  +${entry.xpAwarded} XP`, 78, 116);

  const sealCode = computeArchiveSealCode(entry.poiId);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 16px "JetBrains Mono", monospace';
  ctx.fillText(sealCode, W - 76, 92);

  // 3. Procedural 16-Bit Pixel Diorama Crest Box
  const artX = 54;
  const artY = 148;
  const artW = W - 108;
  const artH = 196;
  ctx.fillStyle = '#23140c';
  ctx.fillRect(artX, artY, artW, artH);

  // Sky / backdrop gradient inside diorama
  const skyGrad = ctx.createLinearGradient(0, artY + 6, 0, artY + artH - 6);
  if (entry.category === 'etrange') {
    skyGrad.addColorStop(0, '#1e1b4b');
    skyGrad.addColorStop(1, '#4c0519');
  } else if (entry.category === 'legende') {
    skyGrad.addColorStop(0, '#2e1065');
    skyGrad.addColorStop(1, '#701a75');
  } else if (entry.category === 'geographie') {
    skyGrad.addColorStop(0, '#0c4a6e');
    skyGrad.addColorStop(1, '#0284c7');
  } else if (entry.category === 'ecosysteme') {
    skyGrad.addColorStop(0, '#064e3b');
    skyGrad.addColorStop(1, '#15803d');
  } else {
    skyGrad.addColorStop(0, '#78350f');
    skyGrad.addColorStop(1, '#d97706');
  }
  ctx.fillStyle = skyGrad;
  ctx.fillRect(artX + 6, artY + 6, artW - 12, artH - 12);

  // Pixel stars & landscape silhouettes in diorama
  const P = 8;
  for (let i = 0; i < 18; i++) {
    const sx = artX + 24 + ((i * 97) % (artW - 48));
    const sy = artY + 18 + ((i * 43) % 76);
    ctx.fillStyle = i % 2 === 0 ? '#fef9c3' : '#fde047';
    ctx.fillRect(sx, sy, P / 2, P / 2);
  }
  // Distant pixel hills & horizon
  ctx.fillStyle = '#1c1917';
  for (let x = artX + 6; x < artX + artW - 6; x += 16) {
    const hillH = 28 + Math.round(Math.sin(x * 0.025) * 14 + Math.cos(x * 0.06) * 8);
    ctx.fillRect(x, artY + artH - 6 - hillH, 16, hillH);
  }
  if (entry.nearWaterway) {
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(artX + 6, artY + artH - 22, artW - 12, 16);
    ctx.fillStyle = '#bae6fd';
    for (let wx = artX + 22; wx < artX + artW - 30; wx += 44) {
      ctx.fillRect(wx, artY + artH - 16, 20, 4);
    }
  }

  // Center 16-bit Emblem Medallion
  const mx = Math.floor(W / 2);
  const my = artY + 92;
  ctx.fillStyle = '#1e110a';
  ctx.fillRect(mx - 44, my - 44, 88, 88);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(mx - 40, my - 40, 80, 80);
  ctx.fillStyle = cat.mapHex;
  ctx.fillRect(mx - 34, my - 34, 68, 68);
  ctx.fillStyle = '#fffbeb';
  ctx.font = 'bold 34px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('✦', mx, my + 12);

  // 4. Title & Metadata
  ctx.textAlign = 'left';
  ctx.fillStyle = '#23170e';
  ctx.font = 'bold 28px Georgia, serif';
  const titleLines = wrapCanvasText(ctx, entry.name, W - 116, 2);
  let cursorY = 386;
  for (const line of titleLines) {
    ctx.fillText(line, 58, cursorY);
    cursorY += 34;
  }

  cursorY += 4;
  ctx.fillStyle = '#991b1b';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`${entry.subType}  ·  ${entry.eraLabel || 'Strate locale'}`, 58, cursorY);

  cursorY += 26;
  ctx.fillStyle = '#5c4028';
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  const altTag =
    altitudeMeters !== null && altitudeMeters !== undefined
      ? `  ·  Alt. ${Math.round(altitudeMeters)} m`
      : '';
  ctx.fillText(
    `${entry.lat.toFixed(4)}° N, ${entry.lng.toFixed(4)}° E${altTag}  ·  ${entry.source}`,
    58,
    cursorY
  );

  // Divider line
  cursorY += 18;
  ctx.fillStyle = '#c89d62';
  ctx.fillRect(58, cursorY, W - 116, 3);

  // 5. Encyclopedic Summary
  cursorY += 32;
  ctx.fillStyle = '#2b1d12';
  ctx.font = '17px Georgia, serif';
  const summaryLines = wrapCanvasText(ctx, entry.summary, W - 116, entry.personalNote ? 7 : 10);
  for (const line of summaryLines) {
    ctx.fillText(line, 58, cursorY);
    cursorY += 26;
  }

  // 6. Optional Personal Field Note Box
  if (entry.personalNote && entry.personalNote.trim().length > 0) {
    cursorY += 10;
    ctx.fillStyle = '#ecd8b1';
    ctx.fillRect(58, cursorY, W - 116, 98);
    ctx.fillStyle = '#8c653b';
    ctx.fillRect(58, cursorY, 5, 98);
    ctx.fillStyle = '#5c4028';
    ctx.font = 'italic 15px Georgia, serif';
    const noteLines = wrapCanvasText(
      ctx,
      `« ${entry.personalNote.trim()} » — ${explorerCallsign || 'Explorateur'}`,
      W - 148,
      3
    );
    let ny = cursorY + 28;
    for (const nl of noteLines) {
      ctx.fillText(nl, 74, ny);
      ny += 24;
    }
  }

  // 7. Bottom Crimson Wax / Ink Stamp ("Sceau d'Archive")
  const footerY = H - 108;
  ctx.fillStyle = '#c89d62';
  ctx.fillRect(58, footerY - 18, W - 116, 2);

  const dateFr = new Date(entry.discoveredAtIso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  ctx.fillStyle = '#54361d';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`Découvert sur le terrain le ${dateFr}`, 58, footerY + 14);
  ctx.font = '14px "JetBrains Mono", monospace';
  ctx.fillText(`Cartographe : ${explorerCallsign || 'Explorateur'}`, 58, footerY + 38);

  // Wax Stamp Circle on bottom right
  const sx = W - 122;
  const sy = footerY + 16;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(-0.14);
  ctx.strokeStyle = '#991b1b';
  ctx.lineWidth = 4;
  ctx.strokeRect(-56, -28, 112, 56);
  ctx.strokeStyle = '#be123c';
  ctx.lineWidth = 2;
  ctx.strokeRect(-50, -22, 100, 44);
  ctx.fillStyle = '#991b1b';
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px "JetBrains Mono", monospace';
  ctx.fillText('SCEAU CERTIFIÉ', 0, -4);
  ctx.font = 'bold 12px "JetBrains Mono", monospace';
  ctx.fillText(sealCode, 0, 14);
  ctx.restore();

  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  const slug = entry.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  a.href = dataUrl;
  a.download = `carte-terra16-${slug || 'decouverte'}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
