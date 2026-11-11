import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  configureSupabaseRuntimeCredentials,
  signInExplorerWithEmailOtp,
  verifyExplorerEmailOtp,
  signInExplorerWithPassword,
  signUpExplorerWithPassword,
  resetExplorerPasswordWithEmail,
  type ExplorerAuthUser as User,
} from '../supabase';
import {
  AVATAR_PRESETS,
  EXPLORER_GENDERS,
  FAMILIAR_CATALOG,
  HEADGEAR_CATALOG,
  OUTFIT_COSMETICS_CATALOG,
  SKIN_TONES,
  drawExplorerSprite16Bit,
} from '../explorerAvatar';
import {
  computeRealMoonPhase,
  drawPixelMoon16Bit,
  resolveCalendarSeasonVisuals,
} from '../astronomyAndSeasons';
import { playTitleEmbarkSfx, playTitleSelectSfx } from '../sound';
import { resolveEffectiveTimeOfDay, type ExplorerAppearance, type ExplorerOutfitId, type TimeOfDayMode, type WeatherInfo } from '../types';
import { PixelCornerRivets, PixelUiIcon } from './PixelIcons';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface TitleScreenViewProps {
  user: User | null;
  authReady: boolean;
  cloudOnline: boolean;
  authError: string;
  onClearAuthError: () => void;
  onGoogleAuth: () => Promise<void> | void;
  onEnterExpedition: () => void;
  skipTitleNextTime: boolean;
  onToggleSkipTitleNextTime: (next: boolean) => void;
  muted: boolean;
  onToggleMuted: () => void;
  explorerCallsign: string;
  onUpdateCallsign: (name: string) => void;
  appearance: ExplorerAppearance;
  onUpdateAppearance: (patch: Partial<ExplorerAppearance>) => void;
  unlockedHeadgearIds: Set<string>;
  unlockedOutfitIds: Set<string>;
  unlockedFamiliarIds: Set<string>;
  explorerLevel: number;
  explorerRankTitle: string;
  discoveriesCount: number;
  regionLabel: string;
  weather: WeatherInfo | null;
  onResetCharacter?: () => void;
}

function resolveTitlePhase(
  mode: TimeOfDayMode,
  weather: WeatherInfo | null
): 'dawn' | 'day' | 'dusk' | 'night' {
  return resolveEffectiveTimeOfDay(mode, weather);
}

export const TitleScreenView: React.FC<TitleScreenViewProps> = ({
  user,
  authReady,
  cloudOnline,
  authError,
  onClearAuthError,
  onGoogleAuth,
  onEnterExpedition,
  skipTitleNextTime,
  onToggleSkipTitleNextTime,
  muted,
  onToggleMuted,
  explorerCallsign,
  onUpdateCallsign,
  appearance,
  onUpdateAppearance,
  unlockedHeadgearIds,
  unlockedOutfitIds,
  unlockedFamiliarIds,
  explorerLevel,
  explorerRankTitle,
  discoveriesCount,
  regionLabel,
  weather,
  onResetCharacter,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [animTick, setAnimTick] = useState(0);
  const [previewAtmo, setPreviewAtmo] = useState<TimeOfDayMode>('auto');
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [callsignDraft, setCallsignDraft] = useState(explorerCallsign || 'Éclaireur');
  const [isEmbarking, setIsEmbarking] = useState(false);

  // In-App PWA Install State
  const { isInstallable, isInstalled, isIOS, isAndroid, promptInstall } = usePWAInstall();
  const [installGuideOpen, setInstallGuideOpen] = useState(false);

  // Open-Source Supabase Direct Authentication
  const [supabaseModalOpen, setSupabaseModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'otp' | 'password'>('password');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authOtpCode, setAuthOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  useEffect(() => {
    setCallsignDraft(explorerCallsign || 'Éclaireur');
  }, [explorerCallsign]);

  useEffect(() => {
    if (user && supabaseModalOpen) {
      setAuthFeedback({
        text: `✨ Connexion réussie (${user.email || user.displayName || 'Éclaireur'}) ! Synchronisation en cours…`,
      });
      const timer = window.setTimeout(() => {
        setSupabaseModalOpen(false);
        setOtpSent(false);
        setAuthOtpCode('');
      }, 850);
      return () => window.clearTimeout(timer);
    }
  }, [user, supabaseModalOpen]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setAnimTick((t) => (t + 1) % 720);
    }, 110);
    return () => window.clearInterval(id);
  }, []);

  const effectivePhase = useMemo(
    () => resolveTitlePhase(previewAtmo, weather),
    [previewAtmo, weather]
  );

  const moonInfo = useMemo(() => computeRealMoonPhase(new Date()), []);
  const seasonVis = useMemo(() => resolveCalendarSeasonVisuals(new Date()), []);

  const availableOutfits = useMemo(
    () => OUTFIT_COSMETICS_CATALOG.filter((o) => unlockedOutfitIds.has(o.id) || o.id === 'arpenteur'),
    [unlockedOutfitIds]
  );
  const availableHeadgear = useMemo(
    () => HEADGEAR_CATALOG.filter((h) => unlockedHeadgearIds.has(h.id)),
    [unlockedHeadgearIds]
  );
  const availableFamiliars = useMemo(
    () => FAMILIAR_CATALOG.filter((f) => unlockedFamiliarIds.has(f.id)),
    [unlockedFamiliarIds]
  );

  // ==========================================================================
  // LIVE 16-BIT PARALLAX CAMPFIRE DIORAMA RENDERER
  // ==========================================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = Math.max(320, window.innerWidth);
    const cssH = Math.max(480, window.innerHeight);

    // Chunky, crisp 16-bit virtual resolution (~3.2 CSS px per virtual pixel)
    const pixelScale = cssW < 640 ? 3 : 4;
    const vw = Math.max(120, Math.ceil(cssW / pixelScale));
    const vh = Math.max(160, Math.ceil(cssH / pixelScale));

    const targetW = Math.round(vw * pixelScale * (dpr > 1.5 ? 1 : 1));
    const targetH = Math.round(vh * pixelScale * (dpr > 1.5 ? 1 : 1));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const s = pixelScale;
    const px = (x: number, y: number, w: number, h: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x * s), Math.round(y * s), Math.ceil(w * s), Math.ceil(h * s));
    };

    // 1. Stepped 16-Bit SNES Sky Bands (zero CSS blur — authentic pixel banding!)
    const skyBands =
      effectivePhase === 'night'
        ? ['#060b1e', '#0b1536', '#13224e', '#1c3166', '#253d73']
        : effectivePhase === 'dusk'
        ? ['#1d1135', '#4a1d4a', '#8c2d3e', '#c85a32', '#f59e0b']
        : effectivePhase === 'dawn'
        ? ['#1e2952', '#3f3d70', '#865375', '#d97e6a', '#fcd385']
        : ['#1d63b8', '#2b7de0', '#4fa0f7', '#7ec0fc', '#bae6fd'];

    const horizonY = Math.floor(vh * 0.62);
    const bandH = Math.ceil(horizonY / skyBands.length);
    for (let b = 0; b < skyBands.length; b++) {
      px(0, b * bandH, vw, bandH + 1, skyBands[b]);
      // Subtle 16-bit checkerboard dither seam between sky bands
      if (b > 0) {
        const seamY = b * bandH;
        for (let dx = (seamY & 1); dx < vw; dx += 2) {
          px(dx, seamY, 1, 1, skyBands[b - 1]);
        }
      }
    }

    // 2. Celestial Bodies: Stars + Real Astronomical Moon OR Golden Sun + SNES Clouds
    if (effectivePhase === 'night' || effectivePhase === 'dusk') {
      const starCount = effectivePhase === 'night' ? 42 : 16;
      for (let i = 0; i < starCount; i++) {
        const sx = (i * 53 + 17) % vw;
        const sy = (i * 29 + 7) % Math.max(24, horizonY - 18);
        const twinkle = (animTick + i * 5) % 9 === 0;
        px(sx, sy, 1, 1, twinkle ? '#fde047' : i % 3 === 0 ? '#bae6fd' : '#f8fafc');
      }

      // Occasional shooting star across the nocturnal sky
      if (effectivePhase === 'night' && animTick % 48 < 5) {
        const step = animTick % 5;
        const msx = Math.floor(vw * 0.22) + step * 9;
        const msy = 14 + step * 4;
        px(msx - 5, msy - 2, 4, 1, 'rgba(186, 230, 253, 0.7)');
        px(msx, msy, 2, 1, '#ffffff');
      }

      const moonX = Math.round(vw * 0.78) * s;
      const moonY = Math.round(Math.max(16, horizonY * 0.22)) * s;
      drawPixelMoon16Bit(ctx, moonX, moonY, Math.max(2, Math.round(s * 1.15)), moonInfo.phaseIndex, true);
    } else {
      // Sun / Dawn orb
      const sunVx = effectivePhase === 'dawn' ? Math.round(vw * 0.76) : Math.round(vw * 0.78);
      const sunVy = effectivePhase === 'dawn' ? horizonY - 22 : Math.max(18, Math.round(horizonY * 0.24));
      px(sunVx - 7, sunVy - 7, 14, 14, 'rgba(254, 240, 138, 0.35)');
      px(sunVx - 5, sunVy - 5, 10, 10, '#fde047');
      px(sunVx - 3, sunVy - 3, 6, 6, '#fffbeb');
    }

    // Drifting 16-bit parallax clouds
    const cloudPal =
      effectivePhase === 'night'
        ? { top: '#334155', bot: '#1e293b' }
        : effectivePhase === 'dusk'
        ? { top: '#fda4af', bot: '#9f1239' }
        : effectivePhase === 'dawn'
        ? { top: '#fde68a', bot: '#f472b6' }
        : { top: '#ffffff', bot: '#cbd5e1' };

    for (let c = 0; c < 4; c++) {
      const cw = 22 + (c % 2) * 10;
      const cx = (((c * 67 + Math.floor(animTick * 0.25)) % (vw + 48)) - 24);
      const cy = 14 + c * 13;
      if (cy < horizonY - 14) {
        px(cx + 3, cy - 2, cw - 6, 3, cloudPal.top);
        px(cx, cy, cw, 3, cloudPal.top);
        px(cx + 2, cy + 2, cw - 3, 2, cloudPal.bot);
      }
    }

    // 3. Far Mountain Ridge Silhouette with Sunlit Facets & Snow/Slate Caps (Parallax Layer 1)
    const farMtnCol =
      effectivePhase === 'night'
        ? '#111c3a'
        : effectivePhase === 'dusk'
        ? '#451a2b'
        : effectivePhase === 'dawn'
        ? '#4c355c'
        : '#4b6b94';
    const farMtnLit =
      effectivePhase === 'night'
        ? '#1d2d57'
        : effectivePhase === 'dusk'
        ? '#6e2841'
        : effectivePhase === 'dawn'
        ? '#6d4b7d'
        : '#6588b3';
    const farMtnCap =
      seasonVis.season === 'hiver'
        ? '#f1f5f9'
        : effectivePhase === 'night'
        ? '#334155'
        : effectivePhase === 'dusk'
        ? '#be4b58'
        : '#cbd5e1';

    for (let x = 0; x < vw; x++) {
      const ridge =
        Math.sin(x * 0.045 + 0.8) * 12 +
        Math.sin(x * 0.11 + 2.1) * 5.5 +
        Math.cos(x * 0.025) * 6.5;
      const nextRidge =
        Math.sin((x + 1) * 0.045 + 0.8) * 12 +
        Math.sin((x + 1) * 0.11 + 2.1) * 5.5 +
        Math.cos((x + 1) * 0.025) * 6.5;
      const topY = Math.round(horizonY - 17 - Math.max(0, ridge));
      px(x, topY, 1, horizonY - topY + 4, farMtnCol);
      // Sunlit western slope facet
      if (nextRidge > ridge && ridge > 3) {
        px(x, topY + 1, 1, Math.min(8, Math.max(2, Math.round(ridge * 0.45))), farMtnLit);
      }
      if (ridge > 9.5) {
        px(x, topY, 1, 2 + (ridge > 14 ? 1 : 0), farMtnCap);
      }
    }

    // 4. Rolling Woodland Hills, Distant Village Spire, Windmill & Valley River Bridge (Parallax Layer 2)
    const hillCol =
      effectivePhase === 'night'
        ? '#0d1b24'
        : effectivePhase === 'dusk'
        ? '#2d1c1e'
        : seasonVis.season === 'automne'
        ? '#5c3419'
        : seasonVis.season === 'hiver'
        ? '#475569'
        : '#1e4d38';
    const hillRim =
      effectivePhase === 'night'
        ? '#152c38'
        : effectivePhase === 'dusk'
        ? '#4d2c28'
        : seasonVis.season === 'automne'
        ? '#854d0e'
        : seasonVis.season === 'hiver'
        ? '#64748b'
        : '#2b6e4f';

    for (let x = 0; x < vw; x++) {
      const hOff = Math.round(Math.sin(x * 0.06 + 1.9) * 5 + Math.cos(x * 0.14) * 2);
      const y0 = horizonY - 5 - hOff;
      px(x, y0, 1, vh - y0, hillCol);
      if (x % 2 === 0) px(x, y0, 1, 1, hillRim);
    }

    // Distant 16-bit village spire & cottages on the left hillcrest
    const villageX = Math.max(14, Math.floor(vw * 0.18));
    const villageY = horizonY - 12;
    const silCol = effectivePhase === 'night' ? '#091019' : '#24160c';
    const roofSil = effectivePhase === 'night' ? '#172033' : '#5c2b18';
    px(villageX, villageY - 9, 3, 10, silCol); // belltower spire
    px(villageX + 1, villageY - 12, 1, 3, silCol);
    px(villageX - 5, villageY - 3, 12, 5, silCol); // nave + cottages
    px(villageX - 5, villageY - 4, 12, 1, roofSil);
    px(villageX + 9, villageY - 2, 6, 4, silCol);
    px(villageX + 9, villageY - 3, 6, 1, roofSil);
    px(villageX - 11, villageY - 1, 5, 3, silCol);
    if (effectivePhase === 'night' || effectivePhase === 'dusk') {
      px(villageX + 1, villageY - 5, 1, 2, '#fde047');
      px(villageX - 3, villageY - 1, 1, 1, '#fbbf24');
      px(villageX + 11, villageY - 1, 2, 1, '#fde047');
      px(villageX - 9, villageY, 1, 1, '#fbbf24');
    }

    // Distant hilltop Moulin à Vent + ruined watchtower silhouette on the right crest
    const millX = Math.min(vw - 18, Math.floor(vw * 0.81));
    const millY = horizonY - 10;
    px(millX - 2, millY - 6, 5, 7, silCol);
    px(millX - 1, millY - 8, 3, 2, roofSil);
    const sailPhase = Math.floor(animTick / 3) % 2;
    const sailCol = effectivePhase === 'night' ? '#64748b' : '#e2e8f0';
    if (sailPhase === 0) {
      px(millX - 5, millY - 6, 3, 1, sailCol);
      px(millX + 3, millY - 4, 3, 1, sailCol);
      px(millX, millY - 10, 1, 3, sailCol);
      px(millX, millY - 3, 1, 3, sailCol);
    } else {
      px(millX - 4, millY - 8, 2, 2, sailCol);
      px(millX + 2, millY - 3, 2, 2, sailCol);
      px(millX + 2, millY - 8, 2, 2, sailCol);
      px(millX - 4, millY - 3, 2, 2, sailCol);
    }
    // Small stone watchtower ruin next to the windmill
    px(millX - 12, millY - 4, 4, 5, silCol);
    px(millX - 12, millY - 5, 1, 1, silCol);
    px(millX - 9, millY - 5, 1, 1, silCol);

    // Shimmering mid-valley river ribbon & 2-arch stone bridge just above foreground terrace
    const riverY = horizonY - 2;
    const waterCol =
      effectivePhase === 'night'
        ? '#0c4a6e'
        : effectivePhase === 'dusk'
        ? '#9a3412'
        : '#0284c7';
    const waterGlint =
      effectivePhase === 'night'
        ? '#38bdf8'
        : effectivePhase === 'dusk'
        ? '#fde047'
        : '#bae6fd';
    const riverStartX = Math.floor(vw * 0.24);
    const riverEndX = Math.floor(vw * 0.76);
    for (let rx = riverStartX; rx < riverEndX; rx++) {
      const ryOff = Math.round(Math.sin(rx * 0.08) * 1.2);
      px(rx, riverY + ryOff, 1, 3, waterCol);
      if ((rx + Math.floor(animTick / 2)) % 9 === 0) {
        px(rx, riverY + ryOff + 1, 2, 1, waterGlint);
      }
    }
    // Miniature 2-arch stone bridge spanning the valley stream
    const brX = Math.floor(vw * 0.5) - 7;
    px(brX, riverY - 2, 14, 3, effectivePhase === 'night' ? '#44403c' : '#d6c3a3');
    px(brX, riverY - 2, 14, 1, effectivePhase === 'night' ? '#78716c' : '#fbf6ea');
    px(brX + 3, riverY, 3, 2, '#1c1008');
    px(brX + 8, riverY, 3, 2, '#1c1008');

    // 5. Foreground Stratified Meadow Terrace, Wildflowers & Cobble Expedition Camp
    const grassDark =
      effectivePhase === 'night'
        ? '#0a1f1c'
        : effectivePhase === 'dusk'
        ? '#282316'
        : seasonVis.season === 'hiver'
        ? '#cbd5e1'
        : seasonVis.season === 'automne'
        ? '#6b421b'
        : '#1b5e3a';
    const grassMid =
      effectivePhase === 'night'
        ? '#112e28'
        : effectivePhase === 'dusk'
        ? '#3b301c'
        : seasonVis.season === 'hiver'
        ? '#e2e8f0'
        : seasonVis.season === 'automne'
        ? '#8c531e'
        : '#27794b';
    const grassRim =
      effectivePhase === 'night'
        ? '#1d4d44'
        : effectivePhase === 'dusk'
        ? '#6b4f28'
        : seasonVis.season === 'hiver'
        ? '#f8fafc'
        : seasonVis.season === 'automne'
        ? '#b46924'
        : '#4ade80';

    const groundY = horizonY + 2;
    px(0, groundY, vw, vh - groundY, grassDark);
    px(0, groundY, vw, 5, grassMid);
    // Scalloped sunlit grass lip + exposed limestone cliff teeth along terrace edge
    for (let gx = 0; gx < vw; gx += 3) {
      px(gx, groundY, 2, 1, grassRim);
      if (gx % 9 === 0) {
        px(gx + 1, groundY + 4, 2, 2, effectivePhase === 'night' ? '#334155' : '#a8987e');
      }
    }

    // Foreground meadow tufts, wildflowers & woodland mushrooms scattered across the clearing
    for (let fi = 0; fi < 18; fi++) {
      const fx = ((fi * 43 + 11) % Math.max(20, vw - 16)) + 8;
      const fy = groundY + 6 + ((fi * 17) % Math.max(8, vh - groundY - 12));
      if (Math.abs(fx - Math.floor(vw * 0.5)) < 28 && Math.abs(fy - Math.floor(vh * 0.81)) < 12) {
        continue;
      }
      px(fx, fy, 2, 1, grassMid);
      px(fx, fy - 1, 1, 1, grassRim);
      if (seasonVis.season !== 'hiver') {
        if (fi % 4 === 0) {
          // Wildflower (buttercup / poppy / lavender)
          px(fx + 1, fy - 1, 1, 1, fi % 8 === 0 ? '#f43f5e' : '#fde047');
        } else if (fi % 7 === 0) {
          // Tiny 16-bit red-capped woodland mushroom
          px(fx + 2, fy, 1, 1, '#fef3c7');
          px(fx + 1, fy - 1, 3, 1, '#dc2626');
        }
      }
    }

    // Swaying multi-tiered 16-bit oaks & pines framing left & right edges
    const treePositions = [
      { x: Math.floor(vw * 0.05), yOff: 2, pine: true },
      { x: Math.floor(vw * 0.12), yOff: 6, pine: false },
      { x: Math.floor(vw * 0.2), yOff: 4, pine: true },
      { x: Math.floor(vw * 0.8), yOff: 4, pine: true },
      { x: Math.floor(vw * 0.88), yOff: 7, pine: false },
      { x: Math.floor(vw * 0.95), yOff: 2, pine: true },
    ];
    const sway = Math.floor(animTick / 6) % 2;
    for (let ti = 0; ti < treePositions.length; ti++) {
      const { x: tx, yOff, pine } = treePositions[ti];
      const ty = groundY + yOff;
      const trunkCol = effectivePhase === 'night' ? '#1c120b' : '#4a2c13';
      const trunkLit = effectivePhase === 'night' ? '#2e1d12' : '#784721';
      const leafShadow =
        effectivePhase === 'night'
          ? '#061714'
          : seasonVis.season === 'automne'
          ? '#451a03'
          : seasonVis.season === 'hiver'
          ? '#1e293b'
          : '#0c3b20';
      const leafDark =
        effectivePhase === 'night'
          ? '#09221d'
          : seasonVis.season === 'automne'
          ? '#7c2d12'
          : seasonVis.season === 'hiver'
          ? '#334155'
          : '#14532d';
      const leafLight =
        effectivePhase === 'night'
          ? '#134e4a'
          : seasonVis.season === 'automne'
          ? '#d97706'
          : seasonVis.season === 'hiver'
          ? '#f1f5f9'
          : '#22c55e';
      const sOff = ti % 2 === 0 ? sway : 0;
      px(tx - 2, ty, 5, 2, 'rgba(10, 8, 6, 0.35)');
      px(tx - 1, ty - 7, 3, 8, trunkCol);
      px(tx - 1, ty - 6, 1, 6, trunkLit);
      if (pine) {
        px(tx - 6 + sOff, ty - 12, 13, 6, leafShadow);
        px(tx - 5 + sOff, ty - 16, 11, 6, leafDark);
        px(tx - 3 + sOff, ty - 20, 7, 5, leafLight);
        px(tx - 1 + sOff, ty - 22, 3, 3, leafLight);
      } else {
        px(tx - 7 + sOff, ty - 16, 15, 10, leafShadow);
        px(tx - 6 + sOff, ty - 18, 13, 10, leafDark);
        px(tx - 4 + sOff, ty - 20, 9, 7, leafLight);
      }
    }

    // Winding stone cartographer trail leading into the horizon
    const campCx = Math.floor(vw * 0.5);
    const campCy = Math.min(vh - 18, Math.max(groundY + 18, Math.floor(vh * 0.81)));
    const stoneShadow = effectivePhase === 'night' ? '#1c1917' : '#786852';
    const stoneBase = effectivePhase === 'night' ? '#292524' : '#a8987e';
    const stoneLight = effectivePhase === 'night' ? '#44403c' : '#d6c7ad';

    for (let y = groundY; y <= campCy + 6; y += 2) {
      const t = (y - groundY) / Math.max(1, campCy + 6 - groundY);
      const pathX = Math.round(campCx + Math.sin(t * 3.1) * 8);
      const pathW = Math.round(4 + t * 14);
      px(pathX - Math.floor(pathW / 2) - 1, y, pathW + 2, 2, stoneShadow);
      px(pathX - Math.floor(pathW / 2), y, pathW, 2, stoneBase);
      px(pathX - Math.floor(pathW / 3), y, Math.max(2, Math.floor(pathW / 2)), 1, stoneLight);
    }

    // Circular cobbled camp clearing around the Explorer & Campfire with individual flagstones
    px(campCx - 25, campCy - 4, 50, 11, stoneShadow);
    px(campCx - 23, campCy - 5, 46, 11, stoneBase);
    px(campCx - 19, campCy - 7, 38, 14, stoneBase);
    px(campCx - 16, campCy - 5, 32, 10, stoneLight);
    for (let ci = -14; ci <= 12; ci += 5) {
      px(campCx + ci, campCy + (ci % 2 === 0 ? -3 : 2), 3, 2, stoneBase);
    }

    // Pitched 16-Bit Canvas Scout Tent on the left-rear of the camp clearing
    const tentX = campCx - 28;
    const tentY = campCy - 5;
    const tentDark = effectivePhase === 'night' ? '#3f2e1e' : '#92400e';
    const tentMain = effectivePhase === 'night' ? '#78552b' : '#d97706';
    const tentLit = effectivePhase === 'night' ? '#a17339' : '#fcd34d';
    px(tentX - 8, tentY, 16, 2, 'rgba(12, 8, 4, 0.45)');
    px(tentX - 7, tentY - 6, 14, 7, '#140b05');
    px(tentX - 6, tentY - 5, 12, 5, tentDark);
    px(tentX - 5, tentY - 8, 10, 4, tentMain);
    px(tentX - 3, tentY - 10, 6, 3, tentLit);
    // Tent flap & warm interior lantern glow
    px(tentX - 2, tentY - 5, 4, 5, '#1c1008');
    if (effectivePhase === 'night' || effectivePhase === 'dusk') {
      px(tentX - 1, tentY - 4, 2, 4, '#fde047');
    }

    // Authentic French GR Hiking Fingerpost (Poteau directionnel + balise Blanc/Rouge) at trailhead
    const postX = campCx + 24;
    const postY = campCy - 5;
    px(postX, postY - 11, 2, 12, '#140b05');
    px(postX, postY - 10, 1, 10, '#92400e');
    // Directional blade pointing toward the valley
    px(postX - 5, postY - 10, 7, 3, '#140b05');
    px(postX - 4, postY - 9, 5, 1, '#fef3c7');
    // FFRP GR White-over-Red painted blaze on the post!
    px(postX, postY - 6, 2, 1, '#ffffff');
    px(postX, postY - 5, 2, 1, '#dc2626');

    // Carved 16-bit IGN Geodesic Stele + Folding Cartographer Map-Stool on the left of the clearing
    const steleX = campCx - 16;
    const steleY = campCy - 1;
    px(steleX - 2, steleY - 7, 5, 8, '#140b05');
    px(steleX - 1, steleY - 6, 3, 6, effectivePhase === 'night' ? '#64748b' : '#cbd5e1');
    px(steleX, steleY - 4, 1, 2, '#f59e0b');

    // Small wooden camp table with unrolled parchment map & brass compass
    const tblX = campCx - 11;
    const tblY = campCy + 3;
    px(tblX - 3, tblY - 2, 7, 4, '#451a03');
    px(tblX - 2, tblY - 3, 5, 2, '#fef3c7');
    px(tblX + 1, tblY - 3, 1, 1, '#dc2626'); // red wax seal / compass dot on map

    // 6. Crackling 16-Bit Campfire & Kettle Tripod on the right of the Explorer
    const fireX = campCx + 10;
    const fireY = campCy + 1;
    const flicker = animTick % 4;

    // Warm flickering firelight pool on the cobbles (stronger at dusk/night)
    const glowR = (effectivePhase === 'night' || effectivePhase === 'dusk' ? 28 : 14) + (flicker % 2);
    const fireGrad = ctx.createRadialGradient(
      fireX * s,
      (fireY - 2) * s,
      2 * s,
      fireX * s,
      (fireY - 2) * s,
      glowR * s
    );
    fireGrad.addColorStop(
      0,
      effectivePhase === 'night' || effectivePhase === 'dusk'
        ? 'rgba(253, 224, 71, 0.42)'
        : 'rgba(251, 191, 36, 0.18)'
    );
    fireGrad.addColorStop(0.55, 'rgba(234, 88, 12, 0.16)');
    fireGrad.addColorStop(1, 'rgba(234, 88, 12, 0)');
    ctx.fillStyle = fireGrad;
    ctx.beginPath();
    ctx.arc(fireX * s, (fireY - 2) * s, glowR * s, 0, Math.PI * 2);
    ctx.fill();

    // Stone ring, crossed oak logs & leather explorer rucksack resting nearby
    px(fireX + 7, fireY - 2, 4, 4, '#451a03');
    px(fireX + 8, fireY - 3, 2, 2, '#b45309');
    px(fireX + 8, fireY - 1, 1, 1, '#fbbf24');
    px(fireX - 5, fireY, 10, 3, '#140b05');
    px(fireX - 4, fireY - 1, 8, 2, '#78350f');
    px(fireX - 5, fireY + 1, 2, 2, '#78716c');
    px(fireX - 2, fireY + 2, 4, 2, '#a8a29e');
    px(fireX + 3, fireY + 1, 2, 2, '#78716c');

    // Animated pixel flames + rising sparks
    const flameH = flicker === 0 ? 6 : flicker === 2 ? 7 : 5;
    px(fireX - 3, fireY - flameH + 1, 6, flameH - 1, '#ea580c');
    px(fireX - 2, fireY - flameH, 4, flameH, '#f59e0b');
    px(fireX - 1, fireY - flameH + 2, 2, Math.max(2, flameH - 2), '#fef08a');
    const sparkY = fireY - 8 - (animTick % 7);
    const sparkX = fireX + ((animTick % 3) - 1);
    px(sparkX, sparkY, 1, 1, '#fde047');

    // 7. Live 16-Bit Explorer + Familiar Sprite!
    const embarkStride = isEmbarking ? Math.min(10, (animTick % 20)) : 0;
    const wCond = weather?.condition || 'clear';
    drawExplorerSprite16Bit(ctx, {
      cx: campCx - 4,
      cy: campCy + 2 + (isEmbarking ? Math.round(embarkStride * 0.4) : 0),
      scale: s,
      facingDir: isEmbarking ? 'up' : 'down',
      isWalking: isEmbarking,
      animTick,
      appearance,
      drawAura: true,
      isNight: effectivePhase === 'night' || effectivePhase === 'dusk',
      coldBreath: seasonVis.season === 'hiver' || (typeof weather?.tempC === 'number' && weather.tempC <= 5),
      surfaceType: 'stone',
      isWet: wCond === 'rain' || wCond === 'storm',
      isSnowy: wCond === 'snow',
    });

    // 8. Ambient Fireflies / Seasonal Petals / Local Weather Particles
    if (wCond === 'rain' || wCond === 'storm') {
      for (let r = 0; r < 26; r++) {
        const rx = (r * 37 + animTick * 4) % vw;
        const ry = (r * 23 + animTick * 8) % vh;
        px(rx, ry, 1, 3, 'rgba(186, 230, 253, 0.72)');
      }
    } else if (wCond === 'snow') {
      for (let fl = 0; fl < 24; fl++) {
        const fx = (fl * 41 + animTick + Math.round(Math.sin(animTick * 0.2 + fl) * 3) + vw) % vw;
        const fy = (fl * 29 + animTick * 2) % vh;
        px(fx, fy, 1, 1, '#ffffff');
      }
    } else if (effectivePhase === 'night' || effectivePhase === 'dusk') {
      for (let f = 0; f < 9; f++) {
        const fx = ((f * 31 + 12) % (vw - 16)) + 8 + Math.round(Math.sin((animTick + f * 9) * 0.15) * 4);
        const fy = groundY - 6 + ((f * 13) % Math.max(12, vh - groundY)) + Math.round(Math.cos((animTick + f * 7) * 0.15) * 2);
        if ((animTick + f * 2) % 6 < 4) {
          px(fx, fy, 1, 1, '#fef08a');
        }
      }
    } else if (seasonVis.particleKind === 'blossom_petals' || seasonVis.particleKind === 'autumn_leaves') {
      for (let p = 0; p < 10; p++) {
        const lx = (p * 37 + animTick * 2) % vw;
        const ly = (p * 19 + animTick) % vh;
        px(
          lx,
          ly,
          1,
          1,
          seasonVis.particleKind === 'blossom_petals' ? '#fbcfe8' : p % 2 === 0 ? '#f59e0b' : '#ea580c'
        );
      }
    }
  }, [animTick, effectivePhase, moonInfo.phaseIndex, seasonVis, weather, appearance, isEmbarking]);

  const commitCallsign = () => {
    const trimmed = callsignDraft.trim().slice(0, 26);
    if (trimmed && trimmed !== explorerCallsign) {
      onUpdateCallsign(trimmed);
    }
  };

  const handleStart = () => {
    if (isEmbarking) return;
    commitCallsign();
    playTitleEmbarkSfx(muted);
    setIsEmbarking(true);
    window.setTimeout(() => {
      onEnterExpedition();
    }, 340);
  };

  const handleSendEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || isSubmittingAuth) return;
    setIsSubmittingAuth(true);
    setAuthFeedback(null);
    try {
      await signInExplorerWithEmailOtp(authEmail.trim());
      setOtpSent(true);
      setAuthFeedback({
        text: '✉️ Email envoyé à ' + authEmail.trim() + ' ! Cliquez directement sur le lien "Sign In" dans le courriel reçu pour vous connecter.',
      });
      playTitleSelectSfx(muted);
    } catch (err) {
      setAuthFeedback({
        text: err instanceof Error ? err.message : 'Impossible d’envoyer le lien par courriel.',
        isError: true,
      });
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authOtpCode.trim() || isSubmittingAuth) return;
    setIsSubmittingAuth(true);
    setAuthFeedback(null);
    try {
      await verifyExplorerEmailOtp(authEmail.trim(), authOtpCode.trim());
      playTitleSelectSfx(muted);
      setAuthFeedback({ text: 'Connexion réussie ! Chargement de votre Grimoire…' });
      window.setTimeout(() => {
        setSupabaseModalOpen(false);
      }, 900);
    } catch (err) {
      setAuthFeedback({
        text: err instanceof Error ? err.message : 'Code magique invalide ou expiré.',
        isError: true,
      });
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword || isSubmittingAuth) return;
    setIsSubmittingAuth(true);
    setAuthFeedback(null);
    try {
      await signInExplorerWithPassword(authEmail.trim(), authPassword);
      playTitleSelectSfx(muted);
      setAuthFeedback({ text: 'Connexion réussie ! Bienvenue explorateur.' });
      window.setTimeout(() => {
        setSupabaseModalOpen(false);
      }, 900);
    } catch (err) {
      setAuthFeedback({
        text: err instanceof Error ? err.message : 'Email ou mot de passe incorrect.',
        isError: true,
      });
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handlePasswordSignUp = async () => {
    if (!authEmail.trim() || !authPassword || isSubmittingAuth) return;
    if (authPassword.length < 6) {
      setAuthFeedback({ text: 'Le mot de passe doit comporter au moins 6 caractères.', isError: true });
      return;
    }
    setIsSubmittingAuth(true);
    setAuthFeedback(null);
    try {
      const res = await signUpExplorerWithPassword(authEmail.trim(), authPassword, callsignDraft);
      playTitleSelectSfx(muted);
      if (res.requiresEmailConfirmation) {
        setAuthFeedback({
          text: 'Compte créé ! Veuillez confirmer votre adresse en cliquant sur le lien reçu par email.',
        });
      } else {
        setAuthFeedback({ text: 'Compte explorateur créé avec succès !' });
        window.setTimeout(() => {
          setSupabaseModalOpen(false);
        }, 900);
      }
    } catch (err) {
      setAuthFeedback({
        text: err instanceof Error ? err.message : 'Erreur lors de la création du compte.',
        isError: true,
      });
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleResetPassword = async () => {
    if (!authEmail.trim() || isSubmittingAuth) {
      setAuthFeedback({
        text: 'Veuillez d’abord renseigner votre adresse email ci-dessus pour recevoir le lien de réinitialisation.',
        isError: true,
      });
      return;
    }
    setIsSubmittingAuth(true);
    setAuthFeedback(null);
    try {
      await resetExplorerPasswordWithEmail(authEmail.trim());
      playTitleSelectSfx(muted);
      setAuthFeedback({
        text: `Un courriel avec un lien pour réinitialiser votre mot de passe a été envoyé à ${authEmail.trim()}. Consultez votre boîte de réception.`,
        isError: false,
      });
    } catch (err) {
      setAuthFeedback({
        text: err instanceof Error ? err.message : 'Impossible d’envoyer le lien de réinitialisation.',
        isError: true,
      });
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const hasSavedProgress = discoveriesCount > 0 || explorerLevel > 1;

  return (
    <div
      className={`fixed inset-0 z-[90] flex flex-col justify-between overflow-y-auto select-none transition-opacity duration-300 ${
        isEmbarking ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Écran-titre Terra 16 — Seuil d’Expédition"
    >
      {/* Full-Viewport Crisp 16-Bit Pixel Diorama */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full pointer-events-none"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Subtle Vignette for Crisp Typography Contrast Over Any Sky Phase */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(14,8,4,0.62) 0%, rgba(14,8,4,0.18) 42%, rgba(14,8,4,0.52) 100%)',
        }}
      />

      {/* Top Bar: Real Atmosphere Controls & Audio Toggle */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-3 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] flex flex-wrap items-center justify-between gap-2">
        <div
          className="inline-flex items-center bg-[#28160d]/95 border-2 border-[#d97706] jrpg-shadow overflow-x-auto max-w-full"
          role="group"
          aria-label="Aperçu de l’heure sur le diorama"
        >
          {(
            [
              { id: 'auto', label: 'Réel' },
              { id: 'dawn', label: 'Aube' },
              { id: 'day', label: 'Jour' },
              { id: 'dusk', label: 'Crépuscule' },
              { id: 'night', label: 'Nuit' },
            ] as const
          ).map((item) => {
            const active = previewAtmo === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  playTitleSelectSfx(muted);
                  setPreviewAtmo(item.id);
                }}
                className={`min-h-[38px] px-2.5 py-1 text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-amber-300 text-[#24160c]'
                    : 'text-amber-200/85 hover:bg-[#3f2416] hover:text-amber-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onToggleMuted}
          aria-label={muted ? 'Activer le son 16-bit' : 'Couper le son'}
          className="min-h-[38px] px-3 py-1.5 bg-[#28160d]/95 hover:bg-[#3f2416] text-amber-200 border-2 border-[#d97706] jrpg-shadow inline-flex items-center gap-1.5 text-xs font-bold shrink-0"
        >
          <PixelUiIcon name={muted ? 'sound-off' : 'sound-on'} className="w-4 h-4" />
          <span>{muted ? 'Son coupé' : 'Son 16-bit'}</span>
        </button>
      </div>

      {/* Hero Title Crest */}
      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 pt-3 sm:pt-5 text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#28160d]/90 border border-[#d97706] text-amber-300 text-[11px] sm:text-xs font-mono">
          <span>{seasonVis.labelFr}</span>
          <span aria-hidden="true">·</span>
          <span>{moonInfo.phaseNameFr}</span>
          {weather && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                {Math.round(weather.tempC)}°C {weather.labelFr}
              </span>
            </>
          )}
        </div>

        <h1
          className="font-display font-bold text-4xl sm:text-6xl tracking-wider text-amber-300 drop-shadow-[0_4px_0_#140b05]"
          style={{ textShadow: '0 3px 0 #2b1a0e, 0 6px 14px rgba(0,0,0,0.65)' }}
        >
          TERRA 16
        </h1>
        <p className="font-display text-sm sm:text-lg text-[#fffbeb] font-semibold drop-shadow-[0_2px_0_#140b05]">
          Grimoire Cartographique &amp; Exploration ludique du Monde Réel
        </p>
      </div>

      {/* Bottom Expedition Portal Folio (Leaves Center Diorama Campfire & Explorer Visible!) */}
      <div className="relative z-10 w-full max-w-xl mx-auto px-3 sm:px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-24 sm:pt-28">
        <div className="relative grimoire-folio p-3.5 sm:p-5 space-y-3 text-[#24160c] shadow-2xl">
          <PixelCornerRivets className="bg-[#d97706]" />

          {/* Explorer Summary Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b-2 border-[#c89d62]">
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#6b4928]">
                {user
                  ? `Compte Cloud connecté · ${user.displayName || user.email || 'Éclaireur'}`
                  : hasSavedProgress
                  ? 'Carnet local détecté sur cet appareil'
                  : 'Nouvelle expédition cartographique'}
              </div>
              <div className="text-sm sm:text-base font-bold font-display text-[#24160c] truncate">
                {explorerCallsign || 'Éclaireur'} · Niv. {explorerLevel} ({explorerRankTitle})
              </div>
              <div className="text-[11px] font-mono text-[#54361d] truncate">
                {discoveriesCount} lieu{discoveriesCount > 1 ? 'x' : ''} consigné
                {discoveriesCount > 1 ? 's' : ''} · {regionLabel}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {hasSavedProgress && onResetCharacter && (
                <button
                  type="button"
                  onClick={() => {
                    playTitleSelectSfx(muted);
                    setResetConfirmOpen(true);
                  }}
                  className="min-h-[42px] px-2.5 py-2 text-xs font-bold bg-[#7f1d1d] hover:bg-[#991b1b] text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-1 shrink-0 transition-colors"
                  title="Réinitialiser l'expédition et repartir au niveau 1"
                >
                  <PixelUiIcon name="trash" className="w-4 h-4 shrink-0" />
                  <span>Réinitialiser</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  playTitleSelectSfx(muted);
                  setCustomizerOpen((v) => !v);
                }}
                aria-expanded={customizerOpen}
                className={`min-h-[42px] px-3 py-2 text-xs font-bold border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-1.5 shrink-0 transition-colors ${
                  customizerOpen
                    ? 'bg-[#28160d] text-amber-300'
                    : 'bg-[#ecd8b1] hover:bg-amber-200 text-[#24160c]'
                }`}
              >
                <PixelUiIcon name="user-profile" className="w-4 h-4 shrink-0" />
                <span>{customizerOpen ? 'Fermer l’atelier' : 'Personnaliser'}</span>
              </button>
            </div>
          </div>

          {authError && (
            <div className="grimoire-folio-crimson p-3 text-xs text-rose-950 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold leading-snug">{authError}</span>
                <button
                  type="button"
                  onClick={onClearAuthError}
                  className="min-h-[30px] px-2 py-0.5 bg-[#991b1b] text-[#fffbeb] text-[11px] font-bold border border-[#2b1a0e] shrink-0"
                >
                  Fermer
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-rose-300/40">
                <button
                  type="button"
                  onClick={() => {
                    configureSupabaseRuntimeCredentials(
                      'https://iiuavileukbczktzqdbs.supabase.co',
                      'sb_publishable_LvefQjGqsWeE9sLtspBhLQ_cWKgzZu-'
                    );
                  }}
                  className="min-h-[36px] px-3 py-1 bg-amber-400 hover:bg-amber-300 text-[#24160c] font-bold text-xs border border-[#2b1a0e] jrpg-shadow inline-flex items-center gap-1"
                >
                  <PixelUiIcon name="star" className="w-3.5 h-3.5" />
                  <span>⚡ Activer Supabase immédiatement</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
                      const regs = await navigator.serviceWorker.getRegistrations();
                      for (const reg of regs) {
                        await reg.unregister();
                      }
                    }
                    if (typeof caches !== 'undefined') {
                      const keys = await caches.keys();
                      for (const k of keys) {
                        await caches.delete(k);
                      }
                    }
                    window.location.reload();
                  }}
                  className="min-h-[36px] px-3 py-1 bg-[#28160d] hover:bg-[#3f2416] text-amber-200 font-bold text-xs border border-[#d97706] jrpg-shadow inline-flex items-center gap-1"
                >
                  <PixelUiIcon name="pocket-compass" className="w-3.5 h-3.5" />
                  <span>🔄 Vider le cache &amp; actualiser</span>
                </button>
              </div>
            </div>
          )}

          {/* Reset Confirmation Modal */}
          {resetConfirmOpen && onResetCharacter && (
            <div className="fixed inset-0 z-[120] bg-black/75 flex items-center justify-center p-4">
              <div className="grimoire-folio-crimson max-w-sm w-full p-4 space-y-3 text-rose-950 border-2 border-rose-900 shadow-2xl">
                <h3 className="font-bold font-display text-base text-rose-950 flex items-center gap-2">
                  <PixelUiIcon name="trash" className="w-5 h-5 text-rose-900" />
                  <span>Réinitialiser la progression ?</span>
                </h3>
                <p className="text-xs leading-relaxed text-rose-900">
                  Cette action effacera vos découvertes, votre XP, votre niveau et vos statistiques locales pour recommencer une aventure neuve au niveau 1.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-rose-300">
                  <button
                    type="button"
                    onClick={() => setResetConfirmOpen(false)}
                    className="min-h-[38px] px-3 py-1.5 bg-[#ecd8b1] hover:bg-amber-100 text-[#24160c] font-bold text-xs border border-[#2b1a0e]"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResetConfirmOpen(false);
                      onResetCharacter();
                    }}
                    className="min-h-[38px] px-3 py-1.5 bg-[#991b1b] hover:bg-rose-800 text-[#fffbeb] font-bold text-xs border border-[#2b1a0e]"
                  >
                    Oui, réinitialiser
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* OpenSource Supabase Auth Modal (Zero Google Cloud friction) */}
          {supabaseModalOpen && (
            <div className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-3 sm:p-4">
              <div className="bg-[#f5e6cb] border-4 border-[#2b1a0e] max-w-md w-full p-4 space-y-3.5 text-[#24160c] shadow-2xl jrpg-shadow relative">
                <div className="flex items-center justify-between border-b-2 border-[#8c653b] pb-2">
                  <div className="flex items-center gap-2">
                    <PixelUiIcon name="star" className="w-5 h-5 text-amber-600" />
                    <div>
                      <h3 className="font-bold text-sm sm:text-base leading-tight text-[#24160c]">
                        Sauvegarde Cloud Supabase
                      </h3>
                      <p className="text-[10px] sm:text-xs text-[#6b4928]">
                        Solution Open-Source clé en main sans compte Google Cloud
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSupabaseModalOpen(false);
                      setAuthFeedback(null);
                    }}
                    className="w-8 h-8 flex items-center justify-center bg-[#ecd8b1] hover:bg-rose-200 text-[#24160c] font-bold text-sm border-2 border-[#2b1a0e]"
                    aria-label="Fermer"
                  >
                    ✕
                  </button>
                </div>

                {/* Tabs: Mot de passe (instantané) vs Lien Magique */}
                <div className="grid grid-cols-2 gap-1.5 bg-[#dfcaa5] p-1 border-2 border-[#8c653b]">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('password');
                      setAuthFeedback(null);
                    }}
                    className={`min-h-[34px] text-xs font-bold py-1 px-2 border ${
                      authMode === 'password'
                        ? 'bg-[#991b1b] text-[#fffbeb] border-[#2b1a0e]'
                        : 'bg-[#ecd8b1] text-[#24160c] border-transparent hover:bg-amber-100'
                    }`}
                  >
                    🔑 Email &amp; Mot de passe
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('otp');
                      setAuthFeedback(null);
                    }}
                    className={`min-h-[34px] text-xs font-bold py-1 px-2 border ${
                      authMode === 'otp'
                        ? 'bg-[#991b1b] text-[#fffbeb] border-[#2b1a0e]'
                        : 'bg-[#ecd8b1] text-[#24160c] border-transparent hover:bg-amber-100'
                    }`}
                  >
                    ✉️ Lien Magique Email
                  </button>
                </div>

                {authFeedback && (
                  <div
                    className={`p-2.5 text-xs border-2 font-medium leading-relaxed ${
                      authFeedback.isError
                        ? 'bg-rose-100 text-rose-950 border-rose-700'
                        : 'bg-emerald-100 text-emerald-950 border-emerald-700'
                    }`}
                  >
                    {authFeedback.text}
                  </div>
                )}

                {/* Tab 1: Email Magic Link / OTP */}
                {authMode === 'otp' && (
                  <div className="space-y-3">
                    {!otpSent ? (
                      <form onSubmit={handleSendEmailOtp} className="space-y-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-[#3b2312] mb-1">
                            Votre adresse email
                          </label>
                          <input
                            type="email"
                            required
                            value={authEmail}
                            onChange={(e) => setAuthEmail(e.target.value)}
                            placeholder="ex: explorateur@domaine.fr"
                            className="w-full min-h-[40px] px-3 py-1.5 bg-[#fffdf7] border-2 border-[#6b4928] text-xs font-semibold text-[#24160c] focus:outline-none focus:border-[#2b1a0e]"
                          />
                        </div>
                        <div className="p-2 bg-[#ecd8b1] border border-[#8c653b] text-[11px] text-[#422510] space-y-1">
                          <p className="font-bold flex items-center gap-1 text-[#24160c]">
                            <span>✨</span>
                            <span>Connexion rapide en 1 clic :</span>
                          </p>
                          <p className="leading-tight text-[10.5px]">
                            Supabase vous envoie un courriel contenant un bouton <strong className="text-[#991b1b]">« Sign In »</strong>. Cliquez simplement dessus dans votre boîte mail pour vous connecter sans mot de passe !
                          </p>
                        </div>
                        <button
                          type="submit"
                          disabled={isSubmittingAuth || !authEmail.trim()}
                          className="w-full min-h-[42px] px-4 py-2 font-bold text-xs bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow flex items-center justify-center gap-2"
                        >
                          <PixelUiIcon name="scroll" className="w-4 h-4 shrink-0" />
                          <span>{isSubmittingAuth ? 'Envoi en cours…' : 'M’envoyer le lien de connexion'}</span>
                        </button>
                      </form>
                    ) : (
                      <div className="space-y-3">
                        {/* Primary path: Click Sign In link in email */}
                        <div className="p-3 bg-amber-100/90 border-2 border-amber-600 text-[#2b1a0e] space-y-2">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-[#991b1b]">
                            <span>📬</span>
                            <span className="truncate">Courriel envoyé à {authEmail}</span>
                          </div>
                          <p className="text-[11px] leading-relaxed">
                            👉 <strong>Cliquez directement sur le bouton « Sign In » (ou le lien)</strong> dans l’email que vous venez de recevoir.
                          </p>
                          <p className="text-[10px] text-[#6b4928] italic leading-tight">
                            Pas besoin de code ! Dès votre clic dans le courriel, votre session sera validée automatiquement et cette fenêtre se fermera toute seule.
                          </p>
                        </div>

                        {/* Fallback path: Numeric code if template configured */}
                        <form onSubmit={handleVerifyEmailOtp} className="space-y-2 pt-1 border-t border-[#8c653b]/40">
                          <div>
                            <label className="block text-[10px] font-bold text-[#5c3717] mb-1">
                              (Optionnel) Saisir un code numérique à 6 chiffres :
                            </label>
                            <input
                              type="text"
                              maxLength={8}
                              value={authOtpCode}
                              onChange={(e) => setAuthOtpCode(e.target.value)}
                              placeholder="123456"
                              className="w-full min-h-[38px] px-3 py-1 bg-[#fffdf7] border-2 border-[#6b4928] text-center tracking-widest text-base font-bold text-[#24160c] focus:outline-none focus:border-[#2b1a0e]"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setOtpSent(false);
                                setAuthFeedback(null);
                                setAuthOtpCode('');
                              }}
                              className="min-h-[38px] px-2 py-1 bg-[#ecd8b1] hover:bg-amber-100 text-[#24160c] font-bold text-xs border border-[#2b1a0e]"
                            >
                              Changer d’email
                            </button>
                            <button
                              type="submit"
                              disabled={isSubmittingAuth || !authOtpCode.trim()}
                              className="min-h-[38px] px-3 py-1 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-[#24160c] font-bold text-xs border-2 border-[#2b1a0e] jrpg-shadow"
                            >
                              {isSubmittingAuth ? 'Vérification…' : 'Valider le code'}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Classic Email & Password */}
                {authMode === 'password' && (
                  <form onSubmit={handlePasswordSignIn} className="space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-[#3b2312] mb-1">
                        Adresse email
                      </label>
                      <input
                        type="email"
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="ex: explorateur@domaine.fr"
                        className="w-full min-h-[38px] px-3 py-1.5 bg-[#fffdf7] border-2 border-[#6b4928] text-xs font-semibold text-[#24160c] focus:outline-none focus:border-[#2b1a0e]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#3b2312] mb-1">
                        Mot de passe
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full min-h-[38px] px-3 py-1.5 bg-[#fffdf7] border-2 border-[#6b4928] text-xs font-semibold text-[#24160c] focus:outline-none focus:border-[#2b1a0e]"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <button
                        type="button"
                        onClick={handleResetPassword}
                        disabled={isSubmittingAuth}
                        className="text-[#78350f] hover:text-[#991b1b] underline font-medium cursor-pointer"
                      >
                        Mot de passe oublié ?
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('otp');
                          setAuthFeedback(null);
                        }}
                        className="text-[#6b4928] hover:text-[#24160c] font-bold cursor-pointer"
                      >
                        Ou sans mot de passe ▸
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={isSubmittingAuth || !authEmail.trim() || !authPassword}
                        className="min-h-[42px] px-3 py-1 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-[#24160c] font-bold text-xs border-2 border-[#2b1a0e] jrpg-shadow"
                      >
                        {isSubmittingAuth ? 'Connexion…' : 'Se connecter'}
                      </button>
                      <button
                        type="button"
                        onClick={handlePasswordSignUp}
                        disabled={isSubmittingAuth || !authEmail.trim() || !authPassword}
                        className="min-h-[42px] px-3 py-1 bg-[#28160d] hover:bg-[#3f2416] disabled:opacity-60 text-amber-200 font-bold text-xs border-2 border-[#d97706] jrpg-shadow"
                      >
                        Créer mon compte
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Inline Quick Character Customizer (Updates Live Campfire Sprite Above!) */}
          {customizerOpen && (
            <div className="bg-[#ecd8b1] border-2 border-[#6b4928] p-3 space-y-2.5 max-h-[38dvh] overflow-y-auto">
              <div className="space-y-1">
                <label
                  htmlFor="title-callsign-input"
                  className="block text-[11px] font-bold text-[#3b2312]"
                >
                  Nom d’Éclaireur (affiché au Carnet &amp; Classements)
                </label>
                <input
                  id="title-callsign-input"
                  type="text"
                  maxLength={26}
                  value={callsignDraft}
                  onChange={(e) => setCallsignDraft(e.target.value)}
                  onBlur={commitCallsign}
                  placeholder="Ex. Camille l’Arpenteur"
                  className="w-full min-h-[42px] bg-[#fffdf7] border-2 border-[#6b4928] px-3 py-1.5 text-sm font-semibold text-[#24160c] focus:outline-none focus:border-[#2b1a0e]"
                />
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-bold text-[#3b2312]">Silhouette</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {EXPLORER_GENDERS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        playTitleSelectSfx(muted);
                        onUpdateAppearance({ gender: g.id });
                      }}
                      className={`min-h-[40px] px-2 py-1 text-xs font-bold border-2 border-[#2b1a0e] ${
                        appearance.gender === g.id
                          ? 'bg-[#991b1b] text-[#fffbeb]'
                          : 'bg-[#f8edd6] text-[#24160c] hover:bg-amber-200'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-bold text-[#3b2312]">Visage &amp; Coiffure</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {AVATAR_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        playTitleSelectSfx(muted);
                        onUpdateAppearance({ avatarPreset: preset.id });
                      }}
                      className={`min-h-[40px] px-2 py-1 text-xs font-bold border-2 border-[#2b1a0e] truncate ${
                        appearance.avatarPreset === preset.id
                          ? 'bg-amber-300 text-[#24160c]'
                          : 'bg-[#f8edd6] text-[#24160c] hover:bg-amber-100'
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-bold text-[#3b2312]">Carnation</div>
                <div className="grid grid-cols-5 gap-1.5">
                  {SKIN_TONES.map((tone) => (
                    <button
                      key={tone.id}
                      type="button"
                      onClick={() => {
                        playTitleSelectSfx(muted);
                        onUpdateAppearance({ skinTone: tone.id });
                      }}
                      className={`min-h-[40px] px-1.5 py-1 text-[11px] font-bold border-2 flex items-center justify-center gap-1 ${
                        appearance.skinTone === tone.id
                          ? 'border-[#991b1b] bg-amber-200 text-[#24160c]'
                          : 'border-[#6b4928] bg-[#f8edd6] text-[#3b2312]'
                      }`}
                    >
                      <span
                        className="w-3 h-3 border border-[#2b1a0e] shrink-0"
                        style={{ backgroundColor: tone.base }}
                      />
                      <span className="truncate">{tone.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-[#3b2312]">Couvre-chef</label>
                  <select
                    value={appearance.headgearId}
                    onChange={(e) => {
                      playTitleSelectSfx(muted);
                      onUpdateAppearance({ headgearId: e.target.value as ExplorerAppearance['headgearId'] });
                    }}
                    className="w-full min-h-[40px] bg-[#fffdf7] border-2 border-[#6b4928] px-2 text-xs font-bold text-[#24160c]"
                  >
                    {availableHeadgear.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-[#3b2312]">Tenue</label>
                  <select
                    value={appearance.outfitId}
                    onChange={(e) => {
                      playTitleSelectSfx(muted);
                      onUpdateAppearance({ outfitId: e.target.value as ExplorerOutfitId });
                    }}
                    className="w-full min-h-[40px] bg-[#fffdf7] border-2 border-[#6b4928] px-2 text-xs font-bold text-[#24160c]"
                  >
                    {availableOutfits.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-[#3b2312]">Familier</label>
                  <select
                    value={appearance.familiarId || 'aucun'}
                    onChange={(e) => {
                      playTitleSelectSfx(muted);
                      onUpdateAppearance({ familiarId: e.target.value as ExplorerAppearance['familiarId'] });
                    }}
                    className="w-full min-h-[40px] bg-[#fffdf7] border-2 border-[#6b4928] px-2 text-xs font-bold text-[#24160c]"
                  >
                    {availableFamiliars.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Primary Portal CTAs (Ergonomic >= 46px Mobile Touch Targets) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
            <button
              type="button"
              onClick={handleStart}
              className="min-h-[48px] px-4 py-2.5 text-sm font-bold bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center justify-center gap-2 transition-transform duration-150 active:translate-y-0.5 sm:col-span-2"
            >
              <PixelUiIcon name="map" className="w-4 h-4 shrink-0" />
              <span>
                {hasSavedProgress || user
                  ? 'Reprendre l’Expédition sur la Carte'
                  : 'Commencer l’Expédition'}
              </span>
            </button>

            {!isInstalled && (
              <button
                type="button"
                onClick={async () => {
                  playTitleSelectSfx(muted);
                  if (isInstallable) {
                    await promptInstall();
                  } else {
                    setInstallGuideOpen(true);
                  }
                }}
                className="min-h-[44px] px-3.5 py-2 text-xs sm:text-sm font-bold bg-[#382012] hover:bg-[#4d2c19] text-amber-200 border-2 border-[#d97706] jrpg-shadow inline-flex items-center justify-center gap-2 sm:col-span-2 transition-transform duration-150 active:translate-y-0.5"
              >
                <PixelUiIcon name="install" className="w-4 h-4 shrink-0 text-amber-300" />
                <span>Installer l’App Terra 16 (Plein écran &amp; Écran éveillé)</span>
              </button>
            )}

            {!user ? (
              <button
                type="button"
                onClick={() => {
                  playTitleSelectSfx(muted);
                  setSupabaseModalOpen(true);
                }}
                className="min-h-[44px] px-3.5 py-2 text-xs sm:text-sm font-bold bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1a0e] jrpg-shadow inline-flex items-center justify-center gap-2 sm:col-span-2"
              >
                <PixelUiIcon name="star" className="w-4 h-4 shrink-0 text-amber-800" />
                <span>Connexion Cloud Grimoire (Sauvegarde &amp; Défis)</span>
              </button>
            ) : (
              <div className="sm:col-span-2 flex items-center justify-between gap-2 px-3 py-2 bg-[#ecd8b1] border-2 border-[#8c653b] text-xs">
                <span className="font-semibold text-emerald-950 truncate">
                  {cloudOnline
                    ? `Synchronisation Cloud active (${user.displayName || user.email})`
                    : 'Mode hors-ligne (reprise Cloud auto)'}
                </span>
                <button
                  type="button"
                  onClick={onGoogleAuth}
                  className="min-h-[34px] px-2.5 py-1 font-bold bg-[#28160d] text-amber-300 border border-[#d97706] shrink-0"
                >
                  Déconnexion
                </button>
              </div>
            )}
          </div>

          {/* Fast-Resume Preference Toggle */}
          <label className="flex items-center justify-between gap-3 pt-1 text-xs text-[#54361d] cursor-pointer">
            <span>Ouvrir directement la carte au prochain lancement</span>
            <input
              type="checkbox"
              checked={skipTitleNextTime}
              onChange={(e) => onToggleSkipTitleNextTime(e.target.checked)}
              className="w-4 h-4 accent-[#991b1b] shrink-0"
            />
          </label>

          {/* In-App PWA Install Modal Guide (iOS Safari, Android Chrome, Desktop) */}
          {installGuideOpen && (
            <div className="fixed inset-0 z-[130] bg-black/80 flex items-center justify-center p-3 sm:p-4">
              <div className="bg-[#f5e6cb] border-4 border-[#2b1a0e] max-w-md w-full p-4 space-y-3.5 text-[#24160c] shadow-2xl jrpg-shadow relative">
                <div className="flex items-center justify-between border-b-2 border-[#8c653b] pb-2">
                  <div className="flex items-center gap-2">
                    <PixelUiIcon name="install" className="w-5 h-5 text-amber-800" />
                    <div>
                      <h3 className="font-bold text-sm sm:text-base leading-tight text-[#24160c]">
                        Installer l’Application Terra 16
                      </h3>
                      <p className="text-[10px] sm:text-xs text-[#6b4928]">
                        Expérience native 100 % plein écran, écran éveillé &amp; GPS fluide
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInstallGuideOpen(false)}
                    className="w-8 h-8 flex items-center justify-center bg-[#ecd8b1] hover:bg-rose-200 text-[#24160c] font-bold text-sm border-2 border-[#2b1a0e]"
                    aria-label="Fermer"
                  >
                    ✕
                  </button>
                </div>

                {isIOS ? (
                  <div className="p-3 bg-[#ecd8b1] border-2 border-[#6b4928] space-y-2 text-xs">
                    <div className="font-bold text-sm text-[#991b1b] flex items-center gap-1.5">
                      <span>🍎</span>
                      <span>Sur iPhone / iPad (Safari) :</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 font-medium leading-relaxed text-[#24160c]">
                      <li>
                        Appuyez sur le bouton <strong>Partager</strong> (icône carré avec flèche vers le haut) dans la barre de Safari.
                      </li>
                      <li>
                        Faites défiler le menu vers le bas et touchez <strong>« Sur l'écran d'accueil »</strong>.
                      </li>
                      <li>
                        Touchez <strong>« Ajouter »</strong> en haut à droite.
                      </li>
                    </ol>
                    <p className="text-[11px] text-[#6b4928] italic pt-1 border-t border-[#8c653b]/40">
                      L’icône Terra 16 apparaîtra directement sur votre écran d’accueil et se lancera en plein écran sans les barres du navigateur !
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-[#ecd8b1] border-2 border-[#6b4928] space-y-2 text-xs">
                    <div className="font-bold text-sm text-[#991b1b] flex items-center gap-1.5">
                      <span>🤖</span>
                      <span>Sur Android ou Ordinateur (Chrome / Edge / Brave) :</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 font-medium leading-relaxed text-[#24160c]">
                      <li>
                        Ouvrez le menu du navigateur (les <strong>trois petits points ⋮</strong> en haut à droite).
                      </li>
                      <li>
                        Sélectionnez <strong>« Installer l’application »</strong> ou <strong>« Ajouter à l’écran d’accueil »</strong>.
                      </li>
                      <li>
                        Confirmez en touchant <strong>« Installer »</strong>.
                      </li>
                    </ol>
                    <p className="text-[11px] text-[#6b4928] italic pt-1 border-t border-[#8c653b]/40">
                      L'application sera installée localement et accessible directement comme une application mobile native.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setInstallGuideOpen(false)}
                  className="w-full min-h-[40px] px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-[#24160c] font-bold text-xs border-2 border-[#2b1a0e] jrpg-shadow"
                >
                  Compris, fermer le guide
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
