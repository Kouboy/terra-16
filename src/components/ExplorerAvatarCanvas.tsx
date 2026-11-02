import React, { useEffect, useRef, useState } from 'react';
import { drawExplorerSprite16Bit } from '../explorerAvatar';
import { ExplorerAppearance, TimeOfDayMode } from '../types';

interface ExplorerSpriteCanvasProps {
  appearance: ExplorerAppearance;
  facingDir?: 'down' | 'up' | 'left' | 'right';
  isWalking?: boolean;
  animated?: boolean;
  pixelScale?: number;
  stageBackdrop?: boolean;
  timeMode?: TimeOfDayMode;
  className?: string;
}

/**
 * Crisp 16-bit Canvas Portrait / Stage Renderer sharing the exact same
 * `drawExplorerSprite16Bit` engine as the Overworld Map, rendered at 2x
 * integer sub-pixel density so every half-pixel detail is razor-sharp!
 */
export const ExplorerSpriteCanvas: React.FC<ExplorerSpriteCanvasProps> = ({
  appearance,
  facingDir = 'down',
  isWalking = false,
  animated = true,
  pixelScale = 4,
  stageBackdrop = false,
  timeMode = 'auto',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!animated) return;
    let timer: number | null = null;
    const start = () => {
      if (timer !== null) return;
      timer = window.setInterval(() => {
        setTick((t) => (t + 1) % 360);
      }, 115);
    };
    const stop = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') stop();
      else start();
    };
    if (document.visibilityState !== 'hidden') start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [animated]);

  const vw = stageBackdrop ? 52 : 34;
  const vh = stageBackdrop ? 42 : 30;
  // Ensure even integer scale so `u = renderScale * 0.5` is always a crisp integer pixel!
  const subUnit = Math.max(1, Math.round(pixelScale));
  const renderScale = subUnit * 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const hour = new Date().getHours();
    const effTime =
      timeMode !== 'auto'
        ? timeMode
        : hour >= 21 || hour < 6
        ? 'night'
        : hour >= 18
        ? 'dusk'
        : hour < 9
        ? 'dawn'
        : 'day';
    const isNight = effTime === 'night';

    const p = (x: number, y: number, w: number, h: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(
        Math.round(x * renderScale),
        Math.round(y * renderScale),
        Math.max(1, Math.round(w * renderScale)),
        Math.max(1, Math.round(h * renderScale))
      );
    };

    if (stageBackdrop) {
      // Miniature 16-bit JRPG Overworld Diorama Backdrop (Sky + Distant Hills + Cobblestone Path)
      const skyTop =
        effTime === 'night'
          ? '#0f172a'
          : effTime === 'dusk'
          ? '#7c2d12'
          : effTime === 'dawn'
          ? '#9a3412'
          : '#38bdf8';
      const skyHorizon =
        effTime === 'night'
          ? '#1e293b'
          : effTime === 'dusk'
          ? '#f59e0b'
          : effTime === 'dawn'
          ? '#fde68a'
          : '#bae6fd';

      p(0, 0, vw, 13, skyTop);
      p(0, 13, vw, 9, skyHorizon);

      if (isNight) {
        p(5, 4, 1, 1, '#fef08a');
        p(14, 7, 1, 1, '#ffffff');
        p(28, 3, 1, 1, '#bae6fd');
        p(41, 4, 3, 3, '#fde047');
        p(42, 4, 2, 2, '#ffffff');
      } else {
        p(40, 3, 5, 5, '#fef08a');
        p(41, 4, 3, 3, '#ffffff');
        // Soft pixel cloud
        p(6, 6, 8, 2, 'rgba(255, 255, 255, 0.78)');
        p(8, 5, 4, 1, 'rgba(255, 255, 255, 0.9)');
      }

      // Distant 16-bit evergreen hills & village silhouette
      p(0, 18, 20, 4, '#14532d');
      p(15, 16, 22, 6, '#166534');
      p(33, 18, vw - 33, 4, '#14532d');

      // Lush meadow + cobbled explorer road
      p(0, 22, vw, vh - 22, isNight ? '#14532d' : '#228b3b');
      p(0, 22, vw, 1.5, isNight ? '#166534' : '#4ade80');
      p(7, 28, vw - 14, 10, '#6b4f32');
      p(8, 29, vw - 16, 8, '#d6c3a3');
      for (let bx = 9; bx < vw - 10; bx += 5) {
        p(bx, 30, 3.5, 2, '#fbf6ea');
        p(bx + 1.5, 33, 3.5, 2, '#e7d8be');
      }
      // Wildflowers along verge
      p(3, 26, 1, 1, '#fde047');
      p(vw - 5, 27, 1, 1, '#fb7185');
    }

    drawExplorerSprite16Bit(ctx, {
      cx: Math.floor(vw / 2),
      cy: stageBackdrop ? 34 : 26,
      scale: renderScale,
      facingDir,
      isWalking,
      animTick: tick,
      appearance,
      drawAura: stageBackdrop,
      isNight,
    });
  }, [appearance, facingDir, isWalking, tick, renderScale, stageBackdrop, timeMode, vw, vh]);

  return (
    <canvas
      ref={canvasRef}
      width={vw * renderScale}
      height={vh * renderScale}
      className={`pixelated block select-none ${className}`}
    />
  );
};
