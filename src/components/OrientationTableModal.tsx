import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  computePanoramicSkyline,
  PanoramicLandmarkPin,
  cardinalFrFromBearing,
} from '../cartography16Bit';
import {
  computeRealMoonPhase,
  drawPixelMoon16Bit,
  resolveCalendarSeasonVisuals,
} from '../astronomyAndSeasons';
import { playTitleSelectSfx } from '../sound';
import {
  EffectiveTimeOfDay,
  ElevationGrid,
  LieuDitBanner,
  OrientationTableNode,
  PoiItem,
  TerrainFeature,
  WeatherInfo,
} from '../types';
import { PixelCornerRivets, PixelUiIcon } from './PixelIcons';

interface OrientationTableModalProps {
  table: OrientationTableNode;
  pois: PoiItem[];
  unlockedIds: Set<string>;
  lieuxDits: LieuDitBanner[];
  terrain: TerrainFeature[];
  elevation: ElevationGrid | null;
  weather?: WeatherInfo | null;
  effectiveTime: EffectiveTimeOfDay;
  calendarMonth: number;
  muted: boolean;
  firstInspectionXpAwarded?: number;
  onFocusLandmark: (pin: PanoramicLandmarkPin) => void;
  onClose: () => void;
}

function wrapDeg(d: number): number {
  return ((d % 360) + 360) % 360;
}

function signedAngleDiff(targetDeg: number, centerDeg: number): number {
  let diff = wrapDeg(targetDeg) - wrapDeg(centerDeg);
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

export const OrientationTableModal: React.FC<OrientationTableModalProps> = ({
  table,
  pois,
  unlockedIds,
  lieuxDits,
  terrain,
  elevation,
  weather,
  effectiveTime,
  calendarMonth,
  muted,
  firstInspectionXpAwarded = 0,
  onFocusLandmark,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const skyline = useMemo(
    () =>
      computePanoramicSkyline({
        table,
        pois,
        unlockedIds,
        lieuxDits,
        terrain,
        elevation,
      }),
    [table, pois, unlockedIds, lieuxDits, terrain, elevation]
  );

  // Center initial azimuth on the richest cluster of landmarks (or South 180° default)
  const initialAzimuth = useMemo(() => {
    if (skyline.pins.length > 0) {
      return Math.round(skyline.pins[0].bearingDeg);
    }
    return 180;
  }, [skyline.pins]);

  const [centerAzimuth, setCenterAzimuth] = useState<number>(initialAzimuth);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(
    skyline.pins[0]?.id ?? null
  );
  const [animTick, setAnimTick] = useState<number>(0);

  const dragRef = useRef<{ active: boolean; startX: number; startAz: number; moved: boolean }>({
    active: false,
    startX: 0,
    startAz: 0,
    moved: false,
  });

  // Hit-boxes of pins rendered in the current 120° FOV frame (in CSS/canvas normalized coordinates)
  const renderedPinBoxesRef = useRef<
    Array<{ pin: PanoramicLandmarkPin; x0: number; y0: number; x1: number; y1: number }>
  >([]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setAnimTick((t) => (t + 1) % 240);
    }, 260);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        setCenterAzimuth((az) => wrapDeg(az - 12));
      } else if (e.key === 'ArrowRight') {
        setCenterAzimuth((az) => wrapDeg(az + 12));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const FOV_DEG = 120;
  const VW = 360;
  const VH = 176;
  const SCALE = 2;

  const moonInfo = useMemo(() => computeRealMoonPhase(new Date()), []);
  const seasonVis = useMemo(() => resolveCalendarSeasonVisuals(calendarMonth), [calendarMonth]);

  // Sample interpolated horizon angle at any continuous azimuth
  const sampleBandDeg = (arr: number[], azDeg: number): number => {
    const norm = wrapDeg(azDeg) / 2;
    const i0 = Math.floor(norm) % 180;
    const i1 = (i0 + 1) % 180;
    const t = norm - Math.floor(norm);
    return arr[i0] * (1 - t) + arr[i1] * t;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const px = (x: number, y: number, w: number, h: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(
        Math.round(x * SCALE),
        Math.round(y * SCALE),
        Math.ceil(w * SCALE),
        Math.ceil(h * SCALE)
      );
    };

    // 1. Stepped 16-Bit Sky Bands
    const skyBands =
      effectiveTime === 'night'
        ? ['#060b1e', '#0c183b', '#152754', '#1f376d', '#2b4982']
        : effectiveTime === 'dusk'
        ? ['#1d1135', '#4a1d4a', '#8c2d3e', '#c85a32', '#f59e0b']
        : effectiveTime === 'dawn'
        ? ['#1e2952', '#3f3d70', '#865375', '#d97e6a', '#fcd385']
        : ['#1d63b8', '#2b7de0', '#4fa0f7', '#84c5fc', '#cdeafe'];

    const baseHorizonY = 114;
    const bandH = Math.ceil(baseHorizonY / skyBands.length);
    for (let b = 0; b < skyBands.length; b++) {
      px(0, b * bandH, VW, bandH + 1, skyBands[b]);
      if (b > 0) {
        const seamY = b * bandH;
        for (let dx = seamY & 1; dx < VW; dx += 2) {
          px(dx, seamY, 1, 1, skyBands[b - 1]);
        }
      }
    }

    // 2. Stars / Sun / Moon positioned at realistic azimuths!
    if (effectiveTime === 'night' || effectiveTime === 'dusk') {
      for (let i = 0; i < 36; i++) {
        const starAz = (i * 47 + 13) % 360;
        const diff = signedAngleDiff(starAz, centerAzimuth);
        if (Math.abs(diff) <= FOV_DEG / 2) {
          const sx = Math.round(((diff + FOV_DEG / 2) / FOV_DEG) * VW);
          const sy = 8 + ((i * 23) % 68);
          px(sx, sy, 1, 1, (animTick + i) % 7 === 0 ? '#fde047' : '#f8fafc');
        }
      }
      const moonDiff = signedAngleDiff(155, centerAzimuth);
      if (Math.abs(moonDiff) <= FOV_DEG / 2 + 8) {
        const mx = Math.round(((moonDiff + FOV_DEG / 2) / FOV_DEG) * VW) * SCALE;
        drawPixelMoon16Bit(ctx, mx, 26 * SCALE, SCALE, moonInfo.phaseIndex, true);
      }
    } else {
      const sunAz = effectiveTime === 'dawn' ? 95 : 175;
      const sunDiff = signedAngleDiff(sunAz, centerAzimuth);
      if (Math.abs(sunDiff) <= FOV_DEG / 2 + 10) {
        const sx = Math.round(((sunDiff + FOV_DEG / 2) / FOV_DEG) * VW);
        const sy = effectiveTime === 'dawn' ? 78 : 28;
        px(sx - 7, sy - 7, 14, 14, 'rgba(254, 240, 138, 0.35)');
        px(sx - 5, sy - 5, 10, 10, '#fde047');
        px(sx - 3, sy - 3, 6, 6, '#fffbeb');
      }
    }

    // 3. Three-Depth DEM-Raymarched Panoramic Ridges (Far -> Mid -> Near)
    const degToPy = (elevDeg: number): number =>
      Math.round(baseHorizonY - Math.max(-12, Math.min(26, elevDeg)) * 2.85);

    const farCol =
      effectiveTime === 'night'
        ? '#152547'
        : effectiveTime === 'dusk'
        ? '#582238'
        : '#5d7ea6';
    const farLit =
      seasonVis.season === 'hiver'
        ? '#e2e8f0'
        : effectiveTime === 'night'
        ? '#263c69'
        : '#83a4cc';

    const midCol =
      effectiveTime === 'night'
        ? '#0f2630'
        : effectiveTime === 'dusk'
        ? '#3b2322'
        : seasonVis.season === 'automne'
        ? '#6b3e1d'
        : '#2b6148';
    const midRim =
      effectiveTime === 'night'
        ? '#1b3f4d'
        : seasonVis.season === 'automne'
        ? '#b45309'
        : '#3e8563';

    const nearCol =
      effectiveTime === 'night'
        ? '#0a1c18'
        : effectiveTime === 'dusk'
        ? '#261f14'
        : seasonVis.season === 'automne'
        ? '#4d2c12'
        : '#19472e';
    const nearRim =
      effectiveTime === 'night'
        ? '#153830'
        : seasonVis.season === 'automne'
        ? '#854d0e'
        : '#2f7a4e';

    // Far Horizon Ridge (880–1750 m)
    for (let x = 0; x < VW; x++) {
      const az = centerAzimuth - FOV_DEG / 2 + (x / VW) * FOV_DEG;
      const deg = sampleBandDeg(skyline.farHorizonDeg, az);
      const yTop = degToPy(deg) - 6;
      px(x, yTop, 1, VH - yTop, farCol);
      if (deg > 2.2) {
        px(x, yTop, 1, 2, farLit);
      }
    }

    // Mid Valley & Hills (340–880 m)
    for (let x = 0; x < VW; x++) {
      const az = centerAzimuth - FOV_DEG / 2 + (x / VW) * FOV_DEG;
      const deg = sampleBandDeg(skyline.midHorizonDeg, az);
      const treeJit = Math.round(Math.sin(az * 1.7) * 1.2);
      const yTop = degToPy(deg) - 2 + treeJit;
      px(x, yTop, 1, VH - yTop, midCol);
      px(x, yTop, 1, 1, midRim);
    }

    // Near Foreground Belvedere Slope (70–340 m)
    for (let x = 0; x < VW; x++) {
      const az = centerAzimuth - FOV_DEG / 2 + (x / VW) * FOV_DEG;
      const deg = sampleBandDeg(skyline.nearHorizonDeg, az);
      const yTop = Math.max(baseHorizonY + 4, degToPy(deg) + 8);
      px(x, yTop, 1, VH - yTop, nearCol);
      if (x % 2 === 0) px(x, yTop, 1, 2, nearRim);
    }

    // Weather particles if raining or snowing
    if (weather?.condition === 'rain' || weather?.condition === 'storm') {
      for (let r = 0; r < 24; r++) {
        const rx = (r * 37 + animTick * 5) % VW;
        const ry = (r * 23 + animTick * 9) % (VH - 28);
        px(rx, ry, 1, 4, 'rgba(186, 230, 253, 0.65)');
      }
    } else if (weather?.condition === 'snow') {
      for (let fl = 0; fl < 22; fl++) {
        const fx = (fl * 41 + animTick * 2) % VW;
        const fy = (fl * 19 + animTick * 3) % (VH - 28);
        px(fx, fy, 1, 1, '#ffffff');
      }
    }

    // 4. Landmark Sightlines & Interactive Callout Badges inside the 120° FOV
    const boxes: Array<{
      pin: PanoramicLandmarkPin;
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    }> = [];
    const occupiedLabelIntervals: Array<{ x0: number; x1: number; row: number }> = [];

    const visiblePins = skyline.pins
      .map((pin) => ({
        pin,
        diff: signedAngleDiff(pin.bearingDeg, centerAzimuth),
      }))
      .filter((item) => Math.abs(item.diff) <= FOV_DEG / 2 - 3);

    for (const { pin, diff } of visiblePins) {
      const vx = Math.round(((diff + FOV_DEG / 2) / FOV_DEG) * VW);
      const ridgeY =
        pin.distanceMeters > 880
          ? degToPy(sampleBandDeg(skyline.farHorizonDeg, pin.bearingDeg)) - 5
          : pin.distanceMeters > 340
          ? degToPy(sampleBandDeg(skyline.midHorizonDeg, pin.bearingDeg)) - 1
          : Math.max(baseHorizonY + 3, degToPy(pin.elevationAngleDeg) + 5);

      const isSel = selectedPinId === pin.id;
      const shortText =
        pin.label.length > 20 ? `${pin.label.slice(0, 19).trim()}…` : pin.label;

      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      const tw = Math.ceil(ctx.measureText(shortText).width) + 12;

      // Pick a non-overlapping label tier (row 0..3) above the horizon
      let chosenRow = -1;
      for (let row = 0; row < 4; row++) {
        const cx0 = vx * SCALE - tw / 2;
        const cx1 = vx * SCALE + tw / 2;
        const collides = occupiedLabelIntervals.some(
          (iv) => iv.row === row && !(cx1 + 6 < iv.x0 || cx0 - 6 > iv.x1)
        );
        if (!collides) {
          chosenRow = row;
          occupiedLabelIntervals.push({ x0: cx0, x1: cx1, row });
          break;
        }
      }

      // Draw tiny 16-bit marker jewel on the ridge itself
      const pinCol =
        pin.kind === 'poi_unlocked'
          ? '#fde047'
          : pin.kind === 'poi_mystery'
          ? '#fb7185'
          : pin.kind === 'summit'
          ? '#fbbf24'
          : pin.kind === 'waterway'
          ? '#38bdf8'
          : '#fef3c7';

      px(vx - 2, ridgeY - 2, 5, 5, '#140b05');
      px(vx - 1, ridgeY - 1, 3, 3, pinCol);

      if (chosenRow === -1 && !isSel) continue;
      const effectiveRow = chosenRow === -1 ? 0 : chosenRow;
      const labelCenterY = Math.max(18, Math.min(ridgeY - 14, 24 + effectiveRow * 18));

      // Crisp vertical brass sight-line from label down to the ridge point
      ctx.fillStyle = isSel ? '#fde047' : 'rgba(254, 243, 199, 0.72)';
      ctx.fillRect(
        Math.round(vx * SCALE),
        Math.round((labelCenterY + 6) * SCALE),
        Math.max(1, SCALE - 1),
        Math.max(2, Math.round((ridgeY - labelCenterY - 7) * SCALE))
      );

      const boxW = tw;
      const boxH = 16;
      const bx = Math.max(4, Math.min(VW * SCALE - boxW - 4, Math.round(vx * SCALE - boxW / 2)));
      const by = Math.round(labelCenterY * SCALE - boxH / 2);

      ctx.fillStyle = '#140b05';
      ctx.fillRect(bx - 2, by - 2, boxW + 4, boxH + 4);
      ctx.fillStyle = isSel
        ? '#fde047'
        : pin.kind === 'poi_mystery'
        ? '#fff1f2'
        : pin.kind === 'waterway'
        ? '#e0f2fe'
        : '#fbf2dc';
      ctx.fillRect(bx, by, boxW, boxH);
      ctx.fillStyle = isSel ? '#991b1b' : '#b45309';
      ctx.fillRect(bx, by, 3, boxH);

      ctx.fillStyle = '#1c1008';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shortText, bx + Math.round(boxW / 2) + 1, by + Math.round(boxH / 2));

      boxes.push({
        pin,
        x0: bx / (VW * SCALE),
        y0: by / (VH * SCALE),
        x1: (bx + boxW) / (VW * SCALE),
        y1: (by + boxH) / (VH * SCALE),
      });
    }

    renderedPinBoxesRef.current = boxes;

    // 5. Enameled Lava-Stone & Brass Azimuth Rim at the Bottom of the Viewfinder (`Pierre de Volvic & Laiton`)
    const rimY = VH - 26;
    px(0, rimY - 2, VW, 2, '#140b05');
    px(0, rimY, VW, 3, '#d97706');
    px(0, rimY, VW, 1, '#fde047');
    px(0, rimY + 3, VW, 23, '#26211d'); // Dark Volvic lava stone
    px(0, rimY + 5, VW, 19, '#f5ebd6'); // Enameled porcelain azimuth band

    // Degree graduations every 10° + Cardinal / Intercardinal plaques
    const startDeg = Math.floor((centerAzimuth - FOV_DEG / 2) / 5) * 5;
    const endDeg = Math.ceil((centerAzimuth + FOV_DEG / 2) / 5) * 5;
    for (let d = startDeg; d <= endDeg; d += 5) {
      const diff = d - centerAzimuth;
      if (Math.abs(diff) > FOV_DEG / 2) continue;
      const tx = Math.round(((diff + FOV_DEG / 2) / FOV_DEG) * VW);
      const normD = wrapDeg(d);
      const isCardinal = normD % 90 === 0;
      const isIntercardinal = normD % 45 === 0;
      const tickH = isCardinal ? 6 : isIntercardinal ? 5 : normD % 10 === 0 ? 4 : 2;
      px(tx, rimY + 5, 1, tickH, isCardinal ? '#991b1b' : '#24160c');

      if (isIntercardinal) {
        const cLabel = cardinalFrFromBearing(normD);
        ctx.font = isCardinal
          ? 'bold 12px "Cinzel", Georgia, serif'
          : 'bold 10px "JetBrains Mono", monospace';
        ctx.fillStyle = isCardinal ? '#991b1b' : '#24160c';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(cLabel, tx * SCALE, (VH - 3) * SCALE);
      } else if (normD % 30 === 0) {
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#6b4928';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${normD}°`, tx * SCALE, (VH - 4) * SCALE);
      }
    }

    // Center Brass Sighting Reticle Needle
    const midX = Math.floor(VW / 2);
    px(midX - 1, rimY - 4, 3, 9, '#140b05');
    px(midX, rimY - 3, 1, 7, '#dc2626');
  }, [
    centerAzimuth,
    skyline,
    selectedPinId,
    effectiveTime,
    weather,
    animTick,
    moonInfo.phaseIndex,
    seasonVis.season,
  ]);

  const selectedPin = useMemo(
    () => skyline.pins.find((p) => p.id === selectedPinId) || skyline.pins[0] || null,
    [skyline.pins, selectedPinId]
  );

  const handlePointerDown = (clientX: number) => {
    dragRef.current = {
      active: true,
      startX: clientX,
      startAz: centerAzimuth,
      moved: false,
    };
  };

  const handlePointerMove = (clientX: number, rectWidth: number) => {
    if (!dragRef.current.active || rectWidth <= 0) return;
    const dx = clientX - dragRef.current.startX;
    if (Math.abs(dx) > 5) dragRef.current.moved = true;
    const deltaDeg = -(dx / rectWidth) * FOV_DEG;
    setCenterAzimuth(wrapDeg(dragRef.current.startAz + deltaDeg));
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current.moved) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    for (const box of renderedPinBoxesRef.current) {
      if (nx >= box.x0 - 0.02 && nx <= box.x1 + 0.02 && ny >= box.y0 - 0.03 && ny <= box.y1 + 0.03) {
        playTitleSelectSfx(muted);
        setSelectedPinId(box.pin.id);
        return;
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/75 flex items-center justify-center p-2.5 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={table.name}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl grimoire-folio p-3.5 sm:p-5 space-y-3.5 text-[#24160c] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <PixelCornerRivets className="bg-[#d97706]" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b-2 border-[#c89d62] pb-2.5">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-amber-900">
              <PixelUiIcon name="mountain" className="w-4 h-4 shrink-0" />
              <span>TABLE D’ORIENTATION PANORAMIQUE 360°</span>
              {firstInspectionXpAwarded > 0 && (
                <span className="px-2 py-0.5 bg-emerald-800 text-[#fffbeb] border border-[#2b1a0e] font-mono">
                  +{firstInspectionXpAwarded} XP Géographie
                </span>
              )}
            </div>
            <h2 className="font-display font-bold text-base sm:text-xl text-[#24160c] leading-snug break-words">
              {table.name}
            </h2>
            <div className="text-[11px] sm:text-xs font-mono text-[#54361d]">
              Altitude du belvédère : <strong>{skyline.observerAltMeters} m NGF</strong> ·{' '}
              {table.sourceLabel} · Azimut visé :{' '}
              <strong className="text-rose-900">
                {Math.round(centerAzimuth)}° ({cardinalFrFromBearing(centerAzimuth)})
              </strong>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la table d’orientation"
            className="w-9 h-9 shrink-0 flex items-center justify-center bg-[#28160d] text-amber-300 hover:bg-[#991b1b] hover:text-[#fffbeb] border-2 border-[#d97706]"
          >
            <PixelUiIcon name="close" className="w-4 h-4" />
          </button>
        </div>

        {/* Cardinal Quick-Turn Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex border-2 border-[#2b1a0e] bg-[#ecd8b1] jrpg-shadow">
            {(
              [
                { label: 'Nord 0°', deg: 0 },
                { label: 'Est 90°', deg: 90 },
                { label: 'Sud 180°', deg: 180 },
                { label: 'Ouest 270°', deg: 270 },
              ] as const
            ).map((dir) => {
              const isNear = Math.abs(signedAngleDiff(dir.deg, centerAzimuth)) <= 22;
              return (
                <button
                  key={dir.label}
                  type="button"
                  onClick={() => {
                    playTitleSelectSfx(muted);
                    setCenterAzimuth(dir.deg);
                  }}
                  className={`min-h-[36px] px-2.5 sm:px-3 py-1 text-xs font-bold border-r last:border-r-0 border-[#8c653b] transition-colors ${
                    isNear
                      ? 'bg-[#28160d] text-amber-300'
                      : 'text-[#24160c] hover:bg-amber-200'
                  }`}
                >
                  {dir.label}
                </button>
              );
            })}
          </div>

          <div className="text-[11px] font-semibold text-[#6b4928]">
            Glissez l’horizon ou touchez un repère sur la plaque émaillée
          </div>
        </div>

        {/* Interactive 16-Bit Panoramic Horizon Canvas */}
        <div className="relative border-2 border-[#2b1a0e] bg-[#140b05] p-1 jrpg-shadow">
          <canvas
            ref={canvasRef}
            width={VW * SCALE}
            height={VH * SCALE}
            onClick={handleCanvasClick}
            onMouseDown={(e) => handlePointerDown(e.clientX)}
            onMouseMove={(e) =>
              handlePointerMove(e.clientX, e.currentTarget.getBoundingClientRect().width)
            }
            onMouseUp={() => {
              dragRef.current.active = false;
            }}
            onMouseLeave={() => {
              dragRef.current.active = false;
            }}
            onTouchStart={(e) => {
              if (e.touches[0]) handlePointerDown(e.touches[0].clientX);
            }}
            onTouchMove={(e) => {
              if (e.touches[0]) {
                handlePointerMove(
                  e.touches[0].clientX,
                  e.currentTarget.getBoundingClientRect().width
                );
              }
            }}
            onTouchEnd={() => {
              dragRef.current.active = false;
            }}
            className="w-full h-[210px] sm:h-[268px] block cursor-grab active:cursor-grabbing touch-none select-none"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        {/* Selected Landmark Inspection Strip + Horizontal All-Bearings Selector */}
        {selectedPin ? (
          <div className="p-3 bg-[#ecd8b1] border-2 border-[#6b4928] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#6b4928]">
                <span className="font-mono text-rose-900">
                  {Math.round(selectedPin.bearingDeg)}° {selectedPin.cardinal}
                </span>
                <span>·</span>
                <span className="font-mono">
                  {selectedPin.distanceMeters >= 1000
                    ? `${(selectedPin.distanceMeters / 1000).toFixed(2)} km`
                    : `${selectedPin.distanceMeters} m`}
                </span>
                {selectedPin.altitudeMeters !== null && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-emerald-900">
                      {selectedPin.altitudeMeters} m NGF (
                      {selectedPin.deltaAltMeters !== null && selectedPin.deltaAltMeters >= 0
                        ? `+${selectedPin.deltaAltMeters} m`
                        : `${selectedPin.deltaAltMeters} m`}
                      )
                    </span>
                  </>
                )}
              </div>
              <div className="font-display font-bold text-sm sm:text-base text-[#24160c] truncate">
                {selectedPin.label}
              </div>
              <div className="text-xs text-[#54361d] truncate">{selectedPin.subLabel}</div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  playTitleSelectSfx(muted);
                  setCenterAzimuth(selectedPin.bearingDeg);
                }}
                className="min-h-[40px] px-3 py-1.5 text-xs font-bold bg-[#fbf2dc] hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e]"
              >
                Centrer la visée
              </button>
              <button
                type="button"
                onClick={() => {
                  playTitleSelectSfx(muted);
                  onFocusLandmark(selectedPin);
                }}
                className="min-h-[40px] px-3.5 py-1.5 text-xs font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-1.5"
              >
                <PixelUiIcon name="cursor" className="w-3.5 h-3.5" />
                <span>Viser sur la carte</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-[#ecd8b1] border-2 border-[#6b4928] text-xs text-[#54361d]">
            Faites pivoter la table d’orientation pour scruter les reliefs alentour.
          </div>
        )}

        {/* Quick Scrollable Azimuth Index of Landmarks around 360° */}
        {skyline.pins.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {skyline.pins.slice(0, 14).map((pin) => {
              const active = selectedPin?.id === pin.id;
              return (
                <button
                  key={pin.id}
                  type="button"
                  onClick={() => {
                    playTitleSelectSfx(muted);
                    setSelectedPinId(pin.id);
                    setCenterAzimuth(pin.bearingDeg);
                  }}
                  className={`min-h-[34px] px-2.5 py-1 text-[11px] font-bold border-2 whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-amber-300 text-[#24160c] border-[#2b1a0e] jrpg-shadow'
                      : 'bg-[#ecd8b1] text-[#54361d] border-[#8c653b] hover:border-[#2b1a0e]'
                  }`}
                >
                  <span className="font-mono mr-1">{pin.cardinal}</span>
                  <span>{pin.label.slice(0, 22)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
