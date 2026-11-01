import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { drawExplorerSprite16Bit } from '../explorerAvatar';
import { fogCoordsFromLatLng, fogKeyFromCoords } from '../fogAndOffline';
import {
  buildNpcRumorOffer,
  drawNpcSprite16Bit,
  getNpcAnimatedOffsetPx,
  isNpcActiveInConditions,
  NpcPortraitCanvas,
  NpcRumorDraft,
  spawnWorldNpcs,
  WorldNpc,
} from '../npcs';
import { playNpcVoiceSfx, playPortalSfx, playRumorPinSfx } from '../sound';
import {
  drawSpecimenSprite16Bit,
  spawnWorldSpecimens,
  WorldSpecimenNode,
} from '../specimens';
import {
  BedrockInfo,
  BuildingArchetype,
  ElevationGrid,
  ExplorationCategory,
  ExplorerAppearance,
  ExplorerOutfitId,
  haversineMeters,
  HistoricalStratum,
  LandmarkStyle,
  PoiItem,
  resolveEffectiveTimeOfDay,
  RumorLead,
  sampleElevationMeters,
  SubterraneanFeature,
  SurfaceType,
  TerrainFeature,
  TimeOfDayMode,
  WeatherInfo,
  ZOOM_META,
  ZoomLevel,
} from '../types';
import { PixelUiIcon } from './PixelIcons';

interface PixelMapCanvasProps {
  playerLat: number;
  playerLng: number;
  pois: PoiItem[];
  surfacePois?: PoiItem[];
  subterraneanPois?: PoiItem[];
  terrain: TerrainFeature[];
  subterranean?: SubterraneanFeature[];
  bedrock?: BedrockInfo | null;
  subterraneanMode?: boolean;
  onToggleSubterraneanMode?: () => void;
  elevation: ElevationGrid | null;
  reliefEnabled: boolean;
  unlockedIds: Set<string>;
  selectedPoiId: string | null;
  simulationMode: boolean;
  isWalking: boolean;
  facingDir: 'down' | 'up' | 'left' | 'right';
  zoomLevel: ZoomLevel;
  subtleBuildings: boolean;
  categoryFilter: ExplorationCategory | 'all';
  stratumFilter: HistoricalStratum | 'all';
  immersiveFullscreen?: boolean;
  weather?: WeatherInfo | null;
  timeMode?: TimeOfDayMode;
  fogEnabled?: boolean;
  fogSet?: Set<string>;
  fogVisionMeters?: number;
  outfitId?: ExplorerOutfitId;
  explorerAppearance?: ExplorerAppearance;
  chroniqueurThreads?: boolean;
  dashedTracesEnabled?: boolean;
  spectralLanternMeters?: number;
  breadcrumbTrail?: Array<{ lat: number; lng: number }>;
  plannedRoute?: Array<{ lat: number; lng: number }>;
  routeRequest?: {
    id: number;
    lat: number;
    lng: number;
    stops?: Array<{ lat: number; lng: number }>;
  } | null;
  muted?: boolean;
  fillContainer?: boolean;
  uiCollapsed?: boolean;
  onToggleUiCollapsed?: () => void;
  onToggleFullscreen?: () => void;
  onChangeZoom: (next: ZoomLevel) => void;
  onSelectPoi: (poi: PoiItem) => void;
  onMapDestinationClick: (targetLat: number, targetLng: number) => void;
  onPlanWalkRoute?: (waypoints: Array<{ lat: number; lng: number }>) => void;
  onPlayerSurfaceChange?: (surface: SurfaceType, nearWater: boolean) => void;
  rumorLeads?: RumorLead[];
  onNpcInteract?: (npc: WorldNpc) => void;
  onAcceptRumor?: (rumorDraft: NpcRumorDraft) => void;
  harvestedNodeIds?: Set<string>;
  onHarvestSpecimen?: (node: WorldSpecimenNode) => void;
  onOpenNpcPostcard?: (npc: WorldNpc) => void;
}

// Tile IDs in the World Topological Ground Grid
// Note: Bridges & Viaducts live in an upper vector overlay (bridgeModeGrid) above T_WATER!
const T_MEADOW = 0;
const T_RESIDENTIAL = 1;
const T_FARMLAND = 2;
const T_PARK = 3;
const T_FOREST = 4;
const T_PLAZA = 5;
const T_WATER = 6;
const T_PATH = 7;
const T_STREET = 8;
const T_MAIN_ROAD = 9;
const T_STEPS = 10;
const T_RAIL = 11;
const T_BUILDING = 12;
const T_PIER = 13;
const T_INDUSTRIAL = 14;
const T_COMMERCIAL = 15;
const T_CEMETERY = 16;

// Settlement morphological tissue codes (scale-invariant via physical-meter integral windows)
const SETTLE_RURAL = 0;
const SETTLE_CITY_CENTER = 1;
const SETTLE_SUBURB = 2;
const SETTLE_VILLAGE = 3;
const SETTLE_HAMLET = 4;
const SETTLE_INDUSTRIAL = 5;

// Real-world building archetype codes
const BC_NONE = 0;
const BC_URBAN_MIDRISE = 1;
const BC_COMMERCIAL = 2;
const BC_INDUSTRIAL = 3;
const BC_SUBURBAN = 4;
const BC_VILLAGE = 5;
const BC_FARM = 6;
const BC_CIVIC = 7;

function encodeBuildingArchetype(a?: BuildingArchetype): number {
  switch (a) {
    case 'urban_midrise':
      return BC_URBAN_MIDRISE;
    case 'commercial_shop':
      return BC_COMMERCIAL;
    case 'industrial':
      return BC_INDUSTRIAL;
    case 'suburban_house':
      return BC_SUBURBAN;
    case 'village_cottage':
      return BC_VILLAGE;
    case 'rural_farm':
      return BC_FARM;
    case 'civic_school':
      return BC_CIVIC;
    default:
      return BC_NONE;
  }
}

function bldgArchetypePriority(code: number): number {
  if (code === BC_INDUSTRIAL || code === BC_CIVIC || code === BC_COMMERCIAL) return 3;
  if (code === BC_URBAN_MIDRISE || code === BC_FARM) return 2;
  if (code === BC_SUBURBAN || code === BC_VILLAGE) return 1;
  return 0;
}

// Bridge overlay modes (rendered above continuous T_WATER)
const B_NONE = 0;
const B_ROAD = 1;
const B_FOOTBRIDGE = 2;
const B_RAIL_VIADUCT = 3;

// Subterranean "Sous-sol / Donjon" 16-bit layer tile codes
const D_ROCK = 0;
const D_GALLERY = 1;
const D_METRO_RAIL = 2;
const D_SUB_WATER = 3;
const D_CELLAR = 4;
const D_QUARRY_HALL = 5;
const D_NATURAL_CAVERN = 6;
const D_CRYPT = 7;
const D_STAIRS = 8;

// Bridge vector axes
const AXIS_HORIZ = 0; // East-West
const AXIS_VERT = 1; // North-South
const AXIS_DIAG_NESW = 2; // '/'
const AXIS_DIAG_NWSE = 3; // '\'

interface LandmarkStamp {
  kind: LandmarkStyle;
  gx: number;
  gy: number;
  w: number;
  h: number;
  name: string;
}

function tileHash(tx: number, ty: number): number {
  let h = (tx * 374761393 + ty * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) >>> 0;
}

function poiPhaseHash(id: string): number {
  let acc = 0;
  for (let i = 0; i < id.length; i++) {
    acc = (acc * 31 + id.charCodeAt(i)) >>> 0;
  }
  return acc % 8;
}

const CAT_SPRITE_PAL: Record<
  ExplorationCategory,
  { main: string; light: string; dark: string; rim: string }
> = {
  histoire: { main: '#f59e0b', light: '#fef08a', dark: '#92400e', rim: '#fde68a' },
  geographie: { main: '#0284c7', light: '#bae6fd', dark: '#0c4a6e', rim: '#7dd3fc' },
  legende: { main: '#9333ea', light: '#e9d5ff', dark: '#581c87', rim: '#d8b4fe' },
  etrange: { main: '#e11d48', light: '#fecdd3', dark: '#881337', rim: '#fda4af' },
  ecosysteme: { main: '#059669', light: '#a7f3d0', dark: '#064e3b', rim: '#6ee7b7' },
};

function isWaterLike(t: number): boolean {
  return t === T_WATER || t === T_PIER;
}

function isUrbanBankTile(t: number): boolean {
  return (
    t === T_MAIN_ROAD ||
    t === T_STREET ||
    t === T_PLAZA ||
    t === T_RESIDENTIAL ||
    t === T_INDUSTRIAL ||
    t === T_COMMERCIAL ||
    t === T_BUILDING ||
    t === T_STEPS ||
    t === T_PIER
  );
}

function isRoadLike(t: number): boolean {
  return (
    t === T_STREET ||
    t === T_MAIN_ROAD ||
    t === T_PLAZA ||
    t === T_PATH ||
    t === T_STEPS ||
    t === T_PIER
  );
}

function isProtectedFromBuilding(t: number): boolean {
  return (
    t === T_WATER ||
    t === T_PIER ||
    t === T_MAIN_ROAD ||
    t === T_STREET ||
    t === T_PATH ||
    t === T_STEPS ||
    t === T_RAIL ||
    t === T_PARK ||
    t === T_CEMETERY ||
    t === T_PLAZA
  );
}

// ============================================================================
// PRE-BAKED 16-BIT SNES / GBA TILE ATLAS (16x16 MULTI-SHADE DITHERED TILES)
// ============================================================================
const ATLAS_TILE = 16;
const ATLAS_ROW_MEADOW = 0; // 4 cols: 0..3
const ATLAS_ROW_ELEVATED = 1; // 0..1: sunlit high grass, 2..3: shaded valley grass
const ATLAS_ROW_COURTYARD = 2; // 0..3: suburban / village residential garden turf
const ATLAS_ROW_PARK = 3; // 0..3: lush manicured garden lawn + flowerbeds
const ATLAS_ROW_FOREST = 4; // 0..3: mossy woodland floor + ferns + mushrooms
const ATLAS_ROW_FARMLAND = 5; // 0..1: golden wheat, 2..3: French vineyard rows
const ATLAS_ROW_MAIN_ROAD = 6; // 0..3: arched limestone Haussmannian pavés
const ATLAS_ROW_STREET = 7; // 0..3: warm ochre village cobblestones
const ATLAS_ROW_PLAZA = 8; // 0..3: cut ashlar parvis flagstones
const ATLAS_ROW_HILLSHADE = 9; // 0: gentle NW sun, 1: strong NW sun, 2: gentle SE shade, 3: deep gorge shade
const ATLAS_ROW_URBAN_STONE = 10; // 0..3: mineral city-center inner courtyards & retail forecourts
const ATLAS_ROW_INDUSTRIAL = 11; // 0..3: tarmac & poured-concrete freight yard with safety markings
const ATLAS_ROW_VILLAGE_EARTH = 12; // 0..3: warm ochre rural hamlet / farmyard beaten earth & cobbles

let cachedSnesAtlas: HTMLCanvasElement | null = null;

function getOrCreateSnesAtlas(): HTMLCanvasElement {
  if (cachedSnesAtlas) return cachedSnesAtlas;
  const atlas = document.createElement('canvas');
  atlas.width = ATLAS_TILE * 4;
  atlas.height = ATLAS_TILE * 13;
  const g = atlas.getContext('2d');
  if (!g) return atlas;
  g.imageSmoothingEnabled = false;

  const dot = (ox: number, oy: number, x: number, y: number, color: string, w = 1, h = 1) => {
    g.fillStyle = color;
    g.fillRect(ox + x, oy + y, w, h);
  };

  // Helper: multi-tone dithered grass base (SNES Secret of Mana / Chrono Trigger style)
  const paintRichGrassBase = (
    ox: number,
    oy: number,
    cDark: string,
    cMid: string,
    cLight: string,
    cSun: string,
    seed: number
  ) => {
    dot(ox, oy, 0, 0, cMid, 16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const n = tileHash(x + seed * 17, y + seed * 31) % 16;
        if ((x + y) % 2 === 0 && n < 4) {
          dot(ox, oy, x, y, cLight);
        } else if (n === 5 || n === 6) {
          dot(ox, oy, x, y, cDark);
        } else if (n === 15) {
          dot(ox, oy, x, y, cSun);
        }
      }
    }
    // Delicate 16-bit grass blade clusters (3-pixel V-tufts with shadow base)
    const tx = 2 + ((seed * 5) % 9);
    const ty = 3 + ((seed * 7) % 8);
    dot(ox, oy, tx, ty + 2, cDark, 3, 1);
    dot(ox, oy, tx, ty + 1, cLight, 1, 1);
    dot(ox, oy, tx + 2, ty + 1, cLight, 1, 1);
    dot(ox, oy, tx + 1, ty, cSun, 1, 2);
  };

  for (let v = 0; v < 4; v++) {
    // Row 0: Standard Lush Meadow
    const mx = v * 16;
    const my = ATLAS_ROW_MEADOW * 16;
    paintRichGrassBase(mx, my, '#3a8238', '#4da142', '#64ba4c', '#98e063', v + 1);
    if (v === 1) {
      // Wild daisy + buttercup cluster
      dot(mx, my, 10, 10, '#2e6b2d', 3, 2);
      dot(mx, my, 10, 9, '#ffffff', 3, 2);
      dot(mx, my, 11, 9, '#facc15', 1, 1);
    } else if (v === 2) {
      // Clover patch + warm limestone pebble
      dot(mx, my, 4, 11, '#2d6e32', 3, 2);
      dot(mx, my, 5, 10, '#86efac', 2, 2);
      dot(mx, my, 12, 5, '#a8a29e', 2, 1);
      dot(mx, my, 12, 4, '#e7e5e4', 1, 1);
    } else if (v === 3) {
      // Poppy + golden wildflower
      dot(mx, my, 11, 12, '#dc2626', 2, 2);
      dot(mx, my, 11, 11, '#fca5a5', 1, 1);
      dot(mx, my, 4, 4, '#fde047', 2, 1);
    }

    // Row 1: Sunlit Hilltop (v=0,1) & Cool Shaded Valley (v=2,3)
    const ex = v * 16;
    const ey = ATLAS_ROW_ELEVATED * 16;
    if (v < 2) {
      paintRichGrassBase(ex, ey, '#49993f', '#5eb548', '#78cc54', '#bef264', v + 10);
    } else {
      paintRichGrassBase(ex, ey, '#2d6b34', '#3c853d', '#4fa148', '#7ad15e', v + 20);
    }

    // Row 2: Village Courtyard / Residential Green
    const cx = v * 16;
    const cy = ATLAS_ROW_COURTYARD * 16;
    paintRichGrassBase(cx, cy, '#5f8f49', '#74a659', '#88ba6a', '#add685', v + 30);
    if (v % 2 === 0) {
      dot(cx, cy, 9, 11, '#b8a68e', 2, 1);
      dot(cx, cy, 9, 10, '#dfd3c0', 1, 1);
    }

    // Row 3: Manicured French Park Lawn & Flowerbeds
    const px = v * 16;
    const py = ATLAS_ROW_PARK * 16;
    paintRichGrassBase(px, py, '#2f8c3d', '#43b049', '#59c956', '#9ef07a', v + 40);
    if (v === 0 || v === 2) {
      // Ornamental rose / tulip parterre
      dot(px, py, 5, 6, '#166534', 6, 4);
      dot(px, py, 6, 5, v === 0 ? '#f43f5e' : '#facc15', 2, 2);
      dot(px, py, 9, 6, '#ffffff', 2, 2);
      dot(px, py, 7, 7, '#fb7185', 2, 1);
    }

    // Row 4: Deep Woodland Moss Floor
    const fx = v * 16;
    const fy = ATLAS_ROW_FOREST * 16;
    paintRichGrassBase(fx, fy, '#14381d', '#1d4d27', '#296633', '#499449', v + 50);
    if (v === 1) {
      // 16-bit red spotted mushroom
      dot(fx, fy, 9, 12, '#fef3c7', 2, 2);
      dot(fx, fy, 8, 10, '#dc2626', 4, 2);
      dot(fx, fy, 9, 10, '#ffffff', 1, 1);
    } else if (v === 3) {
      // Fallen autumn oak leaves & fern frond
      dot(fx, fy, 4, 11, '#d97706', 2, 1);
      dot(fx, fy, 6, 12, '#f59e0b', 1, 1);
      dot(fx, fy, 11, 5, '#4ade80', 3, 1);
      dot(fx, fy, 12, 4, '#86efac', 1, 3);
    }

    // Row 5: French Farmland (v=0,1 Golden Wheat; v=2,3 Vineyard Rows)
    const agx = v * 16;
    const agy = ATLAS_ROW_FARMLAND * 16;
    dot(agx, agy, 0, 0, '#784f2b', 16, 16);
    if (v < 2) {
      // Rich golden wheat furrows
      for (let ry = 1; ry < 16; ry += 4) {
        dot(agx, agy, 0, ry, '#5c3a1d', 16, 1);
        dot(agx, agy, 0, ry + 1, '#ca8a04', 16, 2);
        for (let rx = (v + ry) % 3; rx < 15; rx += 3) {
          dot(agx, agy, rx, ry + 1, '#facc15', 2, 1);
          dot(agx, agy, rx + 1, ry, '#fef08a', 1, 1);
        }
      }
    } else {
      // French vineyard trellises on plowed warm earth
      for (let rx = 2; rx < 15; rx += 5) {
        dot(agx, agy, rx, 0, '#4a2e16', 2, 16);
        for (let ry = 1; ry < 15; ry += 4) {
          dot(agx, agy, rx - 1, ry, '#166534', 4, 3);
          dot(agx, agy, rx, ry, '#4ade80', 2, 2);
          if ((rx + ry + v) % 2 === 0) {
            dot(agx, agy, rx + 1, ry + 2, '#7e22ce', 1, 1);
          }
        }
      }
    }

    // Row 6: Haussmannian / Main Road Fan-Pattern Limestone Cobblestones (Pavés)
    const mrx = v * 16;
    const mry = ATLAS_ROW_MAIN_ROAD * 16;
    dot(mrx, mry, 0, 0, '#9c8669', 16, 16); // warm mortar base
    for (let row = 0; row < 4; row++) {
      const yy = row * 4;
      const shift = (row % 2) * 2 + (v % 2);
      for (let col = -1; col < 4; col++) {
        const xx = col * 5 + shift;
        const stoneShade =
          (row + col + v) % 3 === 0
            ? '#eadbc2'
            : (row + col + v) % 3 === 1
            ? '#dfd0b4'
            : '#d2c0a1';
        if (xx + 4 > 0 && xx < 16) {
          const sx0 = Math.max(0, xx);
          const sw = Math.min(16, xx + 4) - sx0;
          dot(mrx, mry, sx0, yy, stoneShade, sw, 3);
          dot(mrx, mry, sx0, yy, '#f7efe0', Math.max(1, sw - 1), 1);
        }
      }
    }

    // Row 7: Charming Village Cobblestone Lane (Irregular Warm Ochre Stones)
    const stx = v * 16;
    const sty = ATLAS_ROW_STREET * 16;
    dot(stx, sty, 0, 0, '#856a4b', 16, 16);
    const cobbles = [
      [1, 1, 4, 3, '#d9c3a3'],
      [6, 1, 5, 3, '#cbb28e'],
      [12, 1, 3, 3, '#e3d1b6'],
      [0, 5, 3, 3, '#cbb28e'],
      [4, 5, 5, 3, '#e3d1b6'],
      [10, 5, 5, 3, '#d4bc99'],
      [1, 9, 5, 3, '#dfccb0'],
      [7, 9, 4, 3, '#c7ad88'],
      [12, 9, 3, 3, '#d9c3a3'],
      [0, 13, 4, 2, '#d4bc99'],
      [5, 13, 5, 2, '#e5d4ba'],
      [11, 13, 4, 2, '#cbb28e'],
    ] as const;
    for (const [cx0, cy0, cw, ch, col] of cobbles) {
      const jx = (cx0 + v * 4) % 13;
      dot(stx, sty, jx, cy0, col, cw, ch);
      dot(stx, sty, jx, cy0, '#f3e7d3', Math.max(1, cw - 1), 1);
    }
    if (v === 2) {
      // Tiny moss tuft between cobbles
      dot(stx, sty, 6, 8, '#4d9c42', 2, 1);
    }

    // Row 8: Ornate Limestone Parvis Flagstones (Plazas & Squares)
    const plx = v * 16;
    const ply = ATLAS_ROW_PLAZA * 16;
    dot(plx, ply, 0, 0, '#bba889', 16, 16);
    dot(plx, ply, 1, 1, '#efe4ce', 6, 6);
    dot(plx, ply, 1, 1, '#fbf6ea', 5, 1);
    dot(plx, ply, 9, 1, '#e6d8be', 6, 6);
    dot(plx, ply, 9, 1, '#f7efe0', 5, 1);
    dot(plx, ply, 1, 9, '#e6d8be', 6, 6);
    dot(plx, ply, 1, 9, '#f7efe0', 5, 1);
    dot(plx, ply, 9, 9, '#efe4ce', 6, 6);
    dot(plx, ply, 9, 9, '#fbf6ea', 5, 1);
    // Ornamental diamond medallion at center joint
    dot(plx, ply, 7, 7, '#9c7c54', 2, 2);

    // Row 10: Mineral City-Center Courtyard & Retail Forecourt Flagstones
    const usx = v * 16;
    const usy = ATLAS_ROW_URBAN_STONE * 16;
    dot(usx, usy, 0, 0, '#9e9585', 16, 16);
    for (let ry = 0; ry < 16; ry += 4) {
      const off = ((ry >> 2) + v) % 2 === 0 ? 0 : 3;
      for (let rx = -2; rx < 16; rx += 6) {
        const x0 = Math.max(0, rx + off);
        const w0 = Math.min(16, rx + off + 5) - x0;
        if (w0 > 0) {
          dot(usx, usy, x0, ry, (rx + ry + v) % 2 === 0 ? '#cfc5b4' : '#c2b7a3', w0, 3);
          dot(usx, usy, x0, ry, '#dfd7c8', Math.max(1, w0 - 1), 1);
        }
      }
    }
    if (v === 3) {
      // Cast-iron courtyard drain grate
      dot(usx, usy, 6, 6, '#334155', 4, 4);
      dot(usx, usy, 7, 7, '#64748b', 1, 2);
      dot(usx, usy, 9, 7, '#64748b', 1, 2);
    }

    // Row 11: Industrial Concrete / Tarmac Freight Yard
    const inx = v * 16;
    const iny = ATLAS_ROW_INDUSTRIAL * 16;
    dot(inx, iny, 0, 0, '#5b6675', 16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const n = tileHash(x + v * 19, y + v * 29) % 16;
        if (n < 3) dot(inx, iny, x, y, '#6b7787');
        else if (n === 4) dot(inx, iny, x, y, '#4a5462');
      }
    }
    // Concrete slab expansion joints
    dot(inx, iny, 0, 7, '#434c59', 16, 1);
    dot(inx, iny, 8, 0, '#434c59', 1, 16);
    dot(inx, iny, 0, 8, '#778496', 16, 1);
    if (v === 1) {
      // Yellow safety logistics bay line
      dot(inx, iny, 2, 13, '#eab308', 5, 1);
      dot(inx, iny, 9, 13, '#eab308', 5, 1);
    }

    // Row 12: Rural Hamlet / Farmyard Beaten Earth & Meadow Edge
    const vex = v * 16;
    const vey = ATLAS_ROW_VILLAGE_EARTH * 16;
    dot(vex, vey, 0, 0, '#9c805c', 16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const n = tileHash(x + v * 23, y + v * 37) % 16;
        if (n < 3) dot(vex, vey, x, y, '#b3966f');
        else if (n === 4 || n === 5) dot(vex, vey, x, y, '#826847');
        else if (n === 14 && (x < 3 || x > 12 || y < 3 || y > 12)) {
          dot(vex, vey, x, y, '#5c9642');
        }
      }
    }
    if (v % 2 === 0) {
      dot(vex, vey, 5 + v, 9, '#cbb597', 3, 2);
      dot(vex, vey, 10 - v, 4, '#5c9642', 2, 2);
    }
  }

  // Row 9: Pure 16-Bit Pixel-Art Bayer / Checkerboard Hillshading Overlays (No blurry gradients!)
  const hsy = ATLAS_ROW_HILLSHADE * 16;
  for (let py = 0; py < 16; py++) {
    for (let px = 0; px < 16; px++) {
      const check50 = (px + py) % 2 === 0;
      const bayer25 = (px & 1) === 0 && (py & 1) === (px & 2 ? 1 : 0);
      // Col 0: Gentle NW Sunlit Slope (25% warm ivory-gold pixel dither)
      if (bayer25) {
        dot(0, hsy, px, py, 'rgba(254, 249, 195, 0.24)');
      }
      // Col 1: Strong NW Sunlit Crest (50% checkerboard sunlit gold dither)
      if (check50) {
        dot(16, hsy, px, py, 'rgba(254, 240, 138, 0.26)');
      }
      // Col 2: Gentle SE Shaded Slope / Hollow (25% cool slate-indigo pixel dither)
      if (bayer25) {
        dot(32, hsy, px, py, 'rgba(15, 29, 52, 0.22)');
      }
      // Col 3: Deep Gorge / North-East Escarpment Shadow (50% checkerboard indigo-forest dither)
      if (check50) {
        dot(48, hsy, px, py, 'rgba(11, 22, 42, 0.30)');
      }
    }
  }

  cachedSnesAtlas = atlas;
  return atlas;
}

/**
 * Dual-Axis Guaranteed Hydrography Polygon Rasterizer:
 * Preserves narrow rivers/canals at ALL zoom levels (even when polygon width < 1 tile)
 * so river channels never break or vanish when zooming out!
 */
function fillWaterPolygonGuaranteed(
  waterMask: Uint8Array,
  gridSize: number,
  pts: Array<{ gx: number; gy: number }>
) {
  if (pts.length < 3) return;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of pts) {
    if (p.gx < minX) minX = p.gx;
    if (p.gx > maxX) maxX = p.gx;
    if (p.gy < minY) minY = p.gy;
    if (p.gy > maxY) maxY = p.gy;
  }

  const yStart = Math.max(0, Math.floor(minY));
  const yEnd = Math.min(gridSize - 1, Math.ceil(maxY));
  const intersections: number[] = [];

  for (let y = yStart; y <= yEnd; y++) {
    const sampleY = y + 0.5;
    intersections.length = 0;

    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const yi = pts[i].gy;
      const yj = pts[j].gy;
      if ((yi <= sampleY && yj > sampleY) || (yj <= sampleY && yi > sampleY)) {
        const t = (sampleY - yi) / (yj - yi);
        intersections.push(pts[i].gx + t * (pts[j].gx - pts[i].gx));
      }
    }

    intersections.sort((a, b) => a - b);

    for (let k = 0; k < intersections.length - 1; k += 2) {
      const xLeft = intersections[k];
      const xRight = intersections[k + 1];
      const x0 = Math.max(0, Math.floor(xLeft + 0.5));
      const x1 = Math.min(gridSize - 1, Math.floor(xRight - 0.5));
      if (x0 <= x1) {
        for (let x = x0; x <= x1; x++) {
          waterMask[y * gridSize + x] = 1;
        }
      } else if (xRight - xLeft >= 0.14) {
        const xMid = Math.floor((xLeft + xRight) * 0.5);
        if (xMid >= 0 && xMid < gridSize) {
          waterMask[y * gridSize + xMid] = 1;
        }
      }
    }
  }

  // Complementary X-scanline pass so horizontal thin river bends never skip columns
  const xStart = Math.max(0, Math.floor(minX));
  const xEnd = Math.min(gridSize - 1, Math.ceil(maxX));
  for (let x = xStart; x <= xEnd; x++) {
    const sampleX = x + 0.5;
    intersections.length = 0;

    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].gx;
      const xj = pts[j].gx;
      if ((xi <= sampleX && xj > sampleX) || (xj <= sampleX && xi > sampleX)) {
        const t = (sampleX - xi) / (xj - xi);
        intersections.push(pts[i].gy + t * (pts[j].gy - pts[i].gy));
      }
    }

    intersections.sort((a, b) => a - b);

    for (let k = 0; k < intersections.length - 1; k += 2) {
      const yTop = intersections[k];
      const yBot = intersections[k + 1];
      const y0 = Math.max(0, Math.floor(yTop + 0.5));
      const y1 = Math.min(gridSize - 1, Math.floor(yBot - 0.5));
      if (y0 > y1 && yBot - yTop >= 0.14) {
        const yMid = Math.floor((yTop + yBot) * 0.5);
        if (yMid >= 0 && yMid < gridSize) {
          waterMask[yMid * gridSize + x] = 1;
        }
      }
    }
  }
}

/**
 * Carves real river/lake islands (MVT interior hole rings) back out of waterMask
 * while keeping a 0.65-tile margin so narrow river arms on both sides remain 100% open!
 */
function carveIslandInterior(
  waterMask: Uint8Array,
  islandGroundMask: Uint8Array,
  gridSize: number,
  pts: Array<{ gx: number; gy: number }>
) {
  if (pts.length < 3) return;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.gy < minY) minY = p.gy;
    if (p.gy > maxY) maxY = p.gy;
  }
  if (maxY - minY < 1.5) return;

  const yStart = Math.max(1, Math.ceil(minY + 0.65));
  const yEnd = Math.min(gridSize - 2, Math.floor(maxY - 0.65));
  const intersections: number[] = [];

  for (let y = yStart; y <= yEnd; y++) {
    const sampleY = y + 0.5;
    intersections.length = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const yi = pts[i].gy;
      const yj = pts[j].gy;
      if ((yi <= sampleY && yj > sampleY) || (yj <= sampleY && yi > sampleY)) {
        const t = (sampleY - yi) / (yj - yi);
        intersections.push(pts[i].gx + t * (pts[j].gx - pts[i].gx));
      }
    }
    intersections.sort((a, b) => a - b);

    for (let k = 0; k < intersections.length - 1; k += 2) {
      const x0 = Math.max(1, Math.ceil(intersections[k] + 0.65));
      const x1 = Math.min(gridSize - 2, Math.floor(intersections[k + 1] - 0.65));
      for (let x = x0; x <= x1; x++) {
        const idx = y * gridSize + x;
        waterMask[idx] = 0;
        islandGroundMask[idx] = 1;
      }
    }
  }
}

/**
 * Rasterizes 4-connected waterway centerlines directly into waterMask
 */
function rasterizeWaterwaySegment(
  waterMask: Uint8Array,
  islandGroundMask: Uint8Array,
  gridSize: number,
  x0f: number,
  y0f: number,
  x1f: number,
  y1f: number,
  brushMode: 0 | 1 | 2
) {
  let x0 = Math.round(x0f);
  let y0 = Math.round(y0f);
  const x1 = Math.round(x1f);
  const y1 = Math.round(y1f);

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  if (dx > gridSize * 2 || dy > gridSize * 2) return;

  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  const offsets =
    brushMode === 2
      ? [
          [0, 0],
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]
      : brushMode === 1
      ? [
          [0, 0],
          [1, 0],
          [0, 1],
        ]
      : [[0, 0]];

  const stamp = (gx: number, gy: number) => {
    for (let k = 0; k < offsets.length; k++) {
      const ox = offsets[k][0];
      const oy = offsets[k][1];
      const tx = gx + ox;
      const ty = gy + oy;
      if (tx < 0 || tx >= gridSize || ty < 0 || ty >= gridSize) continue;
      const idx = ty * gridSize + tx;
      // Wide brush offsets do not chew into carved river islands; centerline [0,0] always flows!
      if (k > 0 && islandGroundMask[idx] === 1) continue;
      waterMask[idx] = 1;
    }
  };

  let guard = 0;
  while (guard++ < 1600) {
    stamp(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy && e2 < dx) {
      stamp(x0 + sx, y0);
    }
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/**
 * Ensures diagonal-only water pixels are stitched into continuous 4-connected channels
 */
function stitchDiagonalWaterChannels(waterMask: Uint8Array, gridSize: number) {
  for (let y = 0; y < gridSize - 1; y++) {
    const r0 = y * gridSize;
    const r1 = (y + 1) * gridSize;
    for (let x = 0; x < gridSize - 1; x++) {
      const a = waterMask[r0 + x];
      const b = waterMask[r0 + x + 1];
      const c = waterMask[r1 + x];
      const d = waterMask[r1 + x + 1];
      if (a === 1 && d === 1 && b === 0 && c === 0) {
        waterMask[r0 + x + 1] = 1;
      } else if (b === 1 && c === 1 && a === 0 && d === 0) {
        waterMask[r0 + x] = 1;
      }
    }
  }
}

/**
 * Scanline polygon rasterizer onto our local [0..gridSize-1] Uint8Array.
 * Strictly respects sanctuarized T_WATER!
 */
function fillPolygonGrid(
  grid: Uint8Array,
  gridSize: number,
  pts: Array<{ gx: number; gy: number }>,
  tileValue: number,
  protectOpenSpaces: boolean,
  allowSmallCentroidFallback = true,
  bldgClassGrid?: Uint8Array,
  bldgClassCode = 0,
  bldgLevelsGrid?: Uint8Array,
  bldgLevels = 0
) {
  if (pts.length < 3) return;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let sumX = 0;
  let sumY = 0;

  for (const p of pts) {
    if (p.gx < minX) minX = p.gx;
    if (p.gx > maxX) maxX = p.gx;
    if (p.gy < minY) minY = p.gy;
    if (p.gy > maxY) maxY = p.gy;
    sumX += p.gx;
    sumY += p.gy;
  }

  // Filter microscopic building fragments at wide zooms so urban blocks stay clean
  if (tileValue === T_BUILDING && !allowSmallCentroidFallback) {
    const bboxArea = (maxX - minX) * (maxY - minY);
    if (bboxArea < 0.38) return;
  }

  const yStart = Math.max(0, Math.floor(minY));
  const yEnd = Math.min(gridSize - 1, Math.ceil(maxY));
  const intersections: number[] = [];

  let paintedAny = false;

  for (let y = yStart; y <= yEnd; y++) {
    const sampleY = y + 0.5;
    intersections.length = 0;

    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const yi = pts[i].gy;
      const yj = pts[j].gy;
      if ((yi <= sampleY && yj > sampleY) || (yj <= sampleY && yi > sampleY)) {
        const t = (sampleY - yi) / (yj - yi);
        intersections.push(pts[i].gx + t * (pts[j].gx - pts[i].gx));
      }
    }

    intersections.sort((a, b) => a - b);

    for (let k = 0; k < intersections.length - 1; k += 2) {
      const xStart = Math.max(0, Math.floor(intersections[k] + 0.5));
      const xEnd = Math.min(gridSize - 1, Math.floor(intersections[k + 1] - 0.5));
      for (let x = xStart; x <= xEnd; x++) {
        const idx = y * gridSize + x;
        const cur = grid[idx];
        // Sanctuarized T_WATER is never overwritten except by explicit T_PIER
        if (cur === T_WATER && tileValue !== T_PIER) continue;
        if (protectOpenSpaces && isProtectedFromBuilding(cur)) {
          continue;
        }
        grid[idx] = tileValue;
        if (tileValue === T_BUILDING) {
          if (
            bldgClassGrid &&
            bldgClassCode !== 0 &&
            bldgArchetypePriority(bldgClassCode) >= bldgArchetypePriority(bldgClassGrid[idx])
          ) {
            bldgClassGrid[idx] = bldgClassCode;
          }
          if (bldgLevelsGrid && bldgLevels > bldgLevelsGrid[idx]) {
            bldgLevelsGrid[idx] = Math.min(25, bldgLevels);
          }
        }
        paintedAny = true;
      }
    }
  }

  if (!paintedAny && tileValue === T_BUILDING && allowSmallCentroidFallback) {
    const cx = Math.round(sumX / pts.length);
    const cy = Math.round(sumY / pts.length);
    if (cx >= 0 && cx < gridSize && cy >= 0 && cy < gridSize) {
      const idx = cy * gridSize + cx;
      if (!isProtectedFromBuilding(grid[idx])) {
        grid[idx] = T_BUILDING;
        if (
          bldgClassGrid &&
          bldgClassCode !== 0 &&
          bldgArchetypePriority(bldgClassCode) >= bldgArchetypePriority(bldgClassGrid[idx])
        ) {
          bldgClassGrid[idx] = bldgClassCode;
        }
        if (bldgLevelsGrid && bldgLevels > bldgLevelsGrid[idx]) {
          bldgLevelsGrid[idx] = Math.min(25, bldgLevels);
        }
      }
    }
  }
}

function classifySegmentAxis(dx: number, dy: number): 0 | 1 | 2 | 3 {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx > ady * 1.85) return AXIS_HORIZ;
  if (ady > adx * 1.85) return AXIS_VERT;
  return dx * dy < 0 ? AXIS_DIAG_NESW : AXIS_DIAG_NWSE;
}

interface ChainCell {
  gx: number;
  gy: number;
  idx: number;
  axis: 0 | 1 | 2 | 3;
  dx: number;
  dy: number;
}

/**
 * Traces an ordered 4-connected supercover chain along a polyline in grid space,
 * preserving local vector direction for true bridges, piers, and railways.
 */
function traceSupercoverChain(
  pts: Array<{ gx: number; gy: number }>,
  gridSize: number
): ChainCell[] {
  const out: ChainCell[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const x0f = pts[i].gx;
    const y0f = pts[i].gy;
    const x1f = pts[i + 1].gx;
    const y1f = pts[i + 1].gy;
    const segDx = x1f - x0f;
    const segDy = y1f - y0f;
    const segLen = Math.hypot(segDx, segDy);
    if (segLen < 0.001) continue;
    const ux = segDx / segLen;
    const uy = segDy / segLen;
    const axis = classifySegmentAxis(segDx, segDy);

    let x0 = Math.round(x0f);
    let y0 = Math.round(y0f);
    const x1 = Math.round(x1f);
    const y1 = Math.round(y1f);

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    if (dx > gridSize * 2 || dy > gridSize * 2) continue;

    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    const pushCell = (gx: number, gy: number) => {
      if (gx < 0 || gx >= gridSize || gy < 0 || gy >= gridSize) return;
      const last = out.length > 0 ? out[out.length - 1] : null;
      if (last && last.gx === gx && last.gy === gy) return;
      out.push({ gx, gy, idx: gy * gridSize + gx, axis, dx: ux, dy: uy });
    };

    let guard = 0;
    while (guard++ < 1600) {
      pushCell(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy && e2 < dx) {
        pushCell(x0 + sx, y0);
      }
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  return out;
}

function polylineSpanTiles(pts: Array<{ gx: number; gy: number }>): number {
  if (pts.length < 2) return 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.gx < minX) minX = p.gx;
    if (p.gx > maxX) maxX = p.gx;
    if (p.gy < minY) minY = p.gy;
    if (p.gy > maxY) maxY = p.gy;
  }
  return Math.hypot(maxX - minX, maxY - minY);
}

function popcount16(v: number): number {
  let x = v & 0xffff;
  x -= (x >> 1) & 0x5555;
  x = (x & 0x3333) + ((x >> 2) & 0x3333);
  return (((x + (x >> 4)) & 0x0f0f) * 0x0101) >> 8;
}

function polygonAreaTiles2(pts: Array<{ gx: number; gy: number }>): number {
  if (pts.length < 3) return 0;
  let area2 = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area2 += pts[j].gx * pts[i].gy - pts[i].gx * pts[j].gy;
  }
  return Math.abs(area2) * 0.5;
}

/**
 * Supersamples real building footprints onto a 4x4 sub-grid bitmask per world cell (0..16 subpixels)
 * BEFORE road & block generalization. Accurately separates sparse detached-house subdivisions
 * ("lotissements" / villages, CES ~ 10-28%) from dense continuous city blocks (CES >= 38%).
 */
function accumulateBuildingMorphology(
  subMaskGrid: Uint16Array,
  centroidCountGrid: Uint8Array,
  maxAreaGrid: Float32Array,
  bldgClassGrid: Uint8Array,
  bldgLevelsGrid: Uint8Array,
  waterMask: Uint8Array,
  gridSize: number,
  pts: Array<{ gx: number; gy: number }>,
  areaTiles2: number,
  isLandmark: boolean,
  bldgClassCode: number,
  bldgLevels: number
) {
  if (pts.length < 3) return;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let sumX = 0;
  let sumY = 0;

  for (const p of pts) {
    if (p.gx < minX) minX = p.gx;
    if (p.gx > maxX) maxX = p.gx;
    if (p.gy < minY) minY = p.gy;
    if (p.gy > maxY) maxY = p.gy;
    sumX += p.gx;
    sumY += p.gy;
  }

  const subLimit = gridSize * 4 - 1;
  const syStart = Math.max(0, Math.floor(minY * 4));
  const syEnd = Math.min(subLimit, Math.ceil(maxY * 4));
  const intersections: number[] = [];
  let hitAny = false;

  for (let sy = syStart; sy <= syEnd; sy++) {
    const sampleY = (sy + 0.5) * 0.25;
    intersections.length = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const yi = pts[i].gy;
      const yj = pts[j].gy;
      if ((yi <= sampleY && yj > sampleY) || (yj <= sampleY && yi > sampleY)) {
        const t = (sampleY - yi) / (yj - yi);
        intersections.push(pts[i].gx + t * (pts[j].gx - pts[i].gx));
      }
    }
    intersections.sort((a, b) => a - b);
    const gyCell = sy >> 2;
    const subRowShift = (sy & 3) << 2;

    for (let k = 0; k < intersections.length - 1; k += 2) {
      const sxStart = Math.max(0, Math.floor(intersections[k] * 4 + 0.5));
      const sxEnd = Math.min(subLimit, Math.floor(intersections[k + 1] * 4 - 0.5));
      for (let sx = sxStart; sx <= sxEnd; sx++) {
        const gxCell = sx >> 2;
        const idx = gyCell * gridSize + gxCell;
        if (waterMask[idx] === 1) continue;
        subMaskGrid[idx] |= 1 << (subRowShift | (sx & 3));
        if (areaTiles2 > maxAreaGrid[idx]) {
          maxAreaGrid[idx] = areaTiles2;
        }
        if (
          bldgClassCode !== 0 &&
          bldgArchetypePriority(bldgClassCode) >= bldgArchetypePriority(bldgClassGrid[idx])
        ) {
          bldgClassGrid[idx] = bldgClassCode;
        }
        if (bldgLevels > bldgLevelsGrid[idx]) {
          bldgLevelsGrid[idx] = Math.min(25, bldgLevels);
        }
        hitAny = true;
      }
    }
  }

  const meanGx = sumX / pts.length;
  const meanGy = sumY / pts.length;
  const cx = Math.floor(meanGx);
  const cy = Math.floor(meanGy);

  if (cx >= 0 && cx < gridSize && cy >= 0 && cy < gridSize) {
    const cIdx = cy * gridSize + cx;
    if (waterMask[cIdx] === 0) {
      if (centroidCountGrid[cIdx] < 255) {
        centroidCountGrid[cIdx]++;
      }
      if (areaTiles2 > maxAreaGrid[cIdx]) {
        maxAreaGrid[cIdx] = areaTiles2;
      }
      if (
        bldgClassCode !== 0 &&
        bldgArchetypePriority(bldgClassCode) >= bldgArchetypePriority(bldgClassGrid[cIdx])
      ) {
        bldgClassGrid[cIdx] = bldgClassCode;
      }
      if (bldgLevels > bldgLevelsGrid[cIdx]) {
        bldgLevelsGrid[cIdx] = Math.min(25, bldgLevels);
      }
      if (isLandmark) {
        subMaskGrid[cIdx] = 0xffff;
      } else if (!hitAny) {
        const subX = Math.max(0, Math.min(3, Math.floor((meanGx - cx) * 4)));
        const subY = Math.max(0, Math.min(3, Math.floor((meanGy - cy) * 4)));
        subMaskGrid[cIdx] |= 1 << ((subY << 2) | subX);
      }
    }
  }
}

/**
 * Traces a crisp 1-tile 8-connected Bresenham chain without supercover elbow bloat,
 * preventing angled streets from ballooning to 60–100m wide at zoomed-out scales (0.5x–1.3x).
 */
function traceThinChain(
  pts: Array<{ gx: number; gy: number }>,
  gridSize: number
): ChainCell[] {
  const out: ChainCell[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const x0f = pts[i].gx;
    const y0f = pts[i].gy;
    const x1f = pts[i + 1].gx;
    const y1f = pts[i + 1].gy;
    const segDx = x1f - x0f;
    const segDy = y1f - y0f;
    const segLen = Math.hypot(segDx, segDy);
    if (segLen < 0.001) continue;
    const ux = segDx / segLen;
    const uy = segDy / segLen;
    const axis = classifySegmentAxis(segDx, segDy);

    let x0 = Math.round(x0f);
    let y0 = Math.round(y0f);
    const x1 = Math.round(x1f);
    const y1 = Math.round(y1f);

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    if (dx > gridSize * 2 || dy > gridSize * 2) continue;

    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    const pushCell = (gx: number, gy: number) => {
      if (gx < 0 || gx >= gridSize || gy < 0 || gy >= gridSize) return;
      const last = out.length > 0 ? out[out.length - 1] : null;
      if (last && last.gx === gx && last.gy === gy) return;
      out.push({ gx, gy, idx: gy * gridSize + gx, axis, dx: ux, dy: uy });
    };

    let guard = 0;
    while (guard++ < 1600) {
      pushCell(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  return out;
}

function hasParallelAdjacentRoad(
  grid: Uint8Array,
  gridSize: number,
  gx: number,
  gy: number,
  axis: 0 | 1 | 2 | 3,
  onlyCheckMajor: boolean
): boolean {
  if (gx < 1 || gx >= gridSize - 1 || gy < 1 || gy >= gridSize - 1) return false;
  const isTargetRoad = (t: number) =>
    onlyCheckMajor ? t === T_MAIN_ROAD : t === T_MAIN_ROAD || t === T_STREET;

  if (axis === AXIS_HORIZ) {
    for (const dy of [-1, 1]) {
      const nIdx = (gy + dy) * gridSize + gx;
      if (
        isTargetRoad(grid[nIdx]) &&
        (isTargetRoad(grid[nIdx - 1]) || isTargetRoad(grid[nIdx + 1]))
      ) {
        return true;
      }
    }
    return false;
  }

  if (axis === AXIS_VERT) {
    for (const dx of [-1, 1]) {
      const nIdx = gy * gridSize + (gx + dx);
      if (
        isTargetRoad(grid[nIdx]) &&
        (isTargetRoad(grid[nIdx - gridSize]) || isTargetRoad(grid[nIdx + gridSize]))
      ) {
        return true;
      }
    }
    return false;
  }

  // Diagonal road: only suppress genuine parallel twin diagonal carriageways (2x2 diagonal blocks),
  // without breaking T-junctions where a street meets a perpendicular lane!
  const rN = isTargetRoad(grid[(gy - 1) * gridSize + gx]);
  const rS = isTargetRoad(grid[(gy + 1) * gridSize + gx]);
  const rW = isTargetRoad(grid[gy * gridSize + (gx - 1)]);
  const rE = isTargetRoad(grid[gy * gridSize + (gx + 1)]);
  const rNW = isTargetRoad(grid[(gy - 1) * gridSize + (gx - 1)]);
  const rNE = isTargetRoad(grid[(gy - 1) * gridSize + (gx + 1)]);
  const rSW = isTargetRoad(grid[(gy + 1) * gridSize + (gx - 1)]);
  const rSE = isTargetRoad(grid[(gy + 1) * gridSize + (gx + 1)]);
  return (rN && rW && rNW) || (rN && rE && rNE) || (rS && rW && rSW) || (rS && rE && rSE);
}

/**
 * Stamps road/path/steps/rail strictly onto DRY LAND (never overwriting T_WATER or turning banks into bridges!),
 * with morphology-aware generalization at zoomed-out scales so dense urban blocks keep their architecture
 * while suburban subdivisions ("lotissements") and villages keep their residential lanes intact.
 */
function stampDryLinearChain(
  grid: Uint8Array,
  railMaskGrid: Uint8Array,
  gridSize: number,
  chain: ChainCell[],
  tileValue: number,
  brushMode: 0 | 1 | 2,
  zoomLevel: ZoomLevel = 4,
  denseUrbanMask?: Uint8Array
) {
  const offsets =
    brushMode === 2
      ? [
          [0, 0],
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]
      : brushMode === 1
      ? [
          [0, 0],
          [1, 0],
          [0, 1],
        ]
      : [[0, 0]];

  for (const c of chain) {
    if (tileValue === T_RAIL) {
      if (grid[c.idx] !== T_WATER && grid[c.idx] !== T_PIER) {
        railMaskGrid[c.idx] = 1;
        if (grid[c.idx] !== T_MAIN_ROAD && grid[c.idx] !== T_STREET && grid[c.idx] !== T_STEPS) {
          grid[c.idx] = T_RAIL;
        }
      }
      continue;
    }

    if (tileValue === T_PIER) {
      grid[c.idx] = T_PIER;
      continue;
    }

    for (const [ox, oy] of offsets) {
      const tx = c.gx + ox;
      const ty = c.gy + oy;
      if (tx < 0 || tx >= gridSize || ty < 0 || ty >= gridSize) continue;
      const idx = ty * gridSize + tx;
      const existing = grid[idx];
      // Sanctuarized Hydrography: NEVER overwrite T_WATER or T_PIER!
      if (existing === T_WATER || existing === T_PIER) continue;

      const isDenseUrban = denseUrbanMask ? denseUrbanMask[idx] === 1 : false;

      if (tileValue === T_MAIN_ROAD) {
        // Collapse twin boulevard carriageways into 1 crisp avenue tile at wide zooms (0.5x & 0.8x)
        if (
          zoomLevel <= 2 &&
          hasParallelAdjacentRoad(grid, gridSize, tx, ty, c.axis, true)
        ) {
          continue;
        }
        grid[idx] = T_MAIN_ROAD;
      } else if (tileValue === T_STREET) {
        if (existing === T_MAIN_ROAD) continue;
        // In dense city cores, keep at least 1 urban block row between parallel streets;
        // in low-density lotissements/villages, only collapse service lanes stuck right against a major road!
        if (zoomLevel <= 3) {
          if (isDenseUrban && hasParallelAdjacentRoad(grid, gridSize, tx, ty, c.axis, zoomLevel === 3)) {
            continue;
          }
          if (!isDenseUrban && zoomLevel <= 2 && hasParallelAdjacentRoad(grid, gridSize, tx, ty, c.axis, true)) {
            continue;
          }
        }
        grid[idx] = T_STREET;
      } else if (tileValue === T_STEPS) {
        if (existing !== T_MAIN_ROAD && existing !== T_STREET) grid[idx] = T_STEPS;
      } else if (tileValue === T_PATH) {
        if (zoomLevel <= 3) {
          // At wide/medium-wide zooms, footpaths only appear in parks, forests & meadows — never over city blocks!
          const isOpenNatural =
            existing === T_MEADOW ||
            existing === T_PARK ||
            existing === T_FOREST ||
            existing === T_FARMLAND;
          if (!isOpenNatural || isDenseUrban) continue;
        }
        if (
          existing !== T_MAIN_ROAD &&
          existing !== T_STREET &&
          existing !== T_STEPS &&
          existing !== T_RAIL
        ) {
          grid[idx] = T_PATH;
        }
      }
    }
  }
}

/**
 * Detects genuine transverse crossings over T_WATER when MVT omitted `is_bridge`
 * (e.g., village lane or footpath crossing straight from one riverbank to the opposite bank).
 * Rejects riverside quays that merely graze water along the same bank!
 */
function detectImplicitTransverseBridges(
  grid: Uint8Array,
  bridgeModeGrid: Uint8Array,
  bridgeAxisGrid: Uint8Array,
  railMaskGrid: Uint8Array,
  gridSize: number,
  chain: ChainCell[],
  modeCode: number,
  maxSpanTiles: number
) {
  let i = 0;
  while (i < chain.length) {
    if (grid[chain[i].idx] !== T_WATER) {
      i++;
      continue;
    }
    const start = i;
    while (i < chain.length && grid[chain[i].idx] === T_WATER) {
      i++;
    }
    const end = i - 1;
    const spanLen = end - start + 1;

    // Must enter from dry land on one side and exit onto dry land on the opposite side
    if (start === 0 || end >= chain.length - 1) continue;
    if (spanLen < 1 || spanLen > maxSpanTiles) continue;

    const entry = chain[start - 1];
    const exit = chain[end + 1];
    const chord = Math.hypot(exit.gx - entry.gx, exit.gy - entry.gy);
    // Reject parallel riverside grazes that curve back onto the same bank
    if (chord < Math.max(1.85, spanLen * 0.76)) continue;

    // Perpendicular check at midpoint: water channel must extend transversely to the crossing!
    const mid = chain[(start + end) >> 1];
    const px = Math.round(-mid.dy);
    const py = Math.round(mid.dx);
    let hasTransverseWater = false;
    for (const sign of [-1, 1]) {
      const wx = mid.gx + px * sign;
      const wy = mid.gy + py * sign;
      if (wx >= 0 && wx < gridSize && wy >= 0 && wy < gridSize) {
        if (grid[wy * gridSize + wx] === T_WATER) {
          hasTransverseWater = true;
          break;
        }
      }
    }
    if (!hasTransverseWater) continue;

    for (let k = start; k <= end; k++) {
      const c = chain[k];
      if (bridgeModeGrid[c.idx] === B_NONE || modeCode === B_ROAD) {
        bridgeModeGrid[c.idx] = modeCode;
        bridgeAxisGrid[c.idx] = c.axis;
      }
      if (modeCode === B_RAIL_VIADUCT) {
        railMaskGrid[c.idx] = 1;
      }
    }
  }
}

/**
 * Lush 16-bit Multi-Cluster SNES Tree Sprite (Oak, Cypress/Poplar, or Forest Pine)
 */
function draw16BitTreeCanopy(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  variant: number,
  sway: number
) {
  const species = variant % 5; // 0,1,2 = Majestic Oak; 3 = Cypress/Poplar; 4 = Pine

  // Soft dappled ground shadow
  ctx.fillStyle = 'rgba(14, 28, 15, 0.38)';
  ctx.fillRect(sx - 2, sy + 11, 20, 5);
  ctx.fillRect(sx, sy + 10, 16, 6);

  // Gnarled 16-bit shaded trunk & roots
  ctx.fillStyle = '#3b1f0e';
  ctx.fillRect(sx + 6, sy + 8, 5, 6);
  ctx.fillRect(sx + 5, sy + 13, 7, 1);
  ctx.fillStyle = '#6e3f1d';
  ctx.fillRect(sx + 6, sy + 8, 3, 6);
  ctx.fillStyle = '#9a5b2d';
  ctx.fillRect(sx + 6, sy + 9, 1, 4);

  if (species === 4) {
    // 16-bit Layered Mountain Pine / Conifer
    ctx.fillStyle = '#0e3622';
    ctx.fillRect(sx + 1, sy + 4, 14, 6);
    ctx.fillRect(sx + 3, sy - 1, 10, 6);
    ctx.fillRect(sx + 5, sy - 5, 6, 5);

    ctx.fillStyle = '#1b5e36';
    ctx.fillRect(sx + 2, sy + 3, 12, 5);
    ctx.fillRect(sx + 4, sy - 2, 8, 5);
    ctx.fillRect(sx + 6, sy - 6 + sway, 4, 4);

    ctx.fillStyle = '#389c53';
    ctx.fillRect(sx + 3, sy + 3, 7, 3);
    ctx.fillRect(sx + 5, sy - 2, 5, 3);
    ctx.fillRect(sx + 6, sy - 5 + sway, 3, 2);

    ctx.fillStyle = '#86efac';
    ctx.fillRect(sx + 6, sy - 6 + sway, 2, 2);
    ctx.fillRect(sx + 4, sy + 3, 3, 1);
    return;
  }

  if (species === 3) {
    // 16-bit French Poplar / Park Cypress
    ctx.fillStyle = '#144524';
    ctx.fillRect(sx + 3, sy - 6, 10, 16);
    ctx.fillRect(sx + 4, sy - 8, 8, 18);
    ctx.fillStyle = '#257335';
    ctx.fillRect(sx + 4, sy - 7, 7, 15);
    ctx.fillStyle = '#4cb548';
    ctx.fillRect(sx + 4, sy - 6 + sway, 5, 11);
    ctx.fillStyle = '#a3e635';
    ctx.fillRect(sx + 5, sy - 7 + sway, 3, 5);
    return;
  }

  // Majestic Multi-Sphere SNES Broadleaf Oak (5 shaded foliage tones + real calendar-month seasonal accents!)
  const calMonth = new Date().getMonth(); // 0=Jan..11=Dec
  const isSpring = calMonth >= 2 && calMonth <= 4;
  const isAutumn = calMonth >= 8 && calMonth <= 10;
  const isWinter = calMonth === 11 || calMonth <= 1;

  const autumnTint = isAutumn ? variant % 5 <= 1 : variant % 19 === 0;
  const cOutline = '#0f2e17';
  const cDeep = autumnTint ? '#7c2d12' : '#184d25';
  const cMid = autumnTint ? '#c2410c' : '#2a7a36';
  const cBright = autumnTint ? '#f59e0b' : '#4fb346';
  const cSun = autumnTint ? '#fde047' : '#9be858';

  // Outer pixel silhouette (3 overlapping foliage spheres: left, right, crown)
  ctx.fillStyle = cOutline;
  ctx.fillRect(sx - 2, sy - 1, 20, 10);
  ctx.fillRect(sx, sy - 5, 16, 14);
  ctx.fillRect(sx + 2, sy - 7, 12, 13);

  // Deep underside leaf shadow
  ctx.fillStyle = cDeep;
  ctx.fillRect(sx - 1, sy, 18, 8);
  ctx.fillRect(sx + 1, sy - 4, 14, 12);

  // Mid leaf clusters
  ctx.fillStyle = cMid;
  ctx.fillRect(sx - 1, sy - 1, 17, 6);
  ctx.fillRect(sx + 1, sy - 5, 14, 9);
  ctx.fillRect(sx + 3, sy - 6, 10, 8);

  // Sunlit upper-left & crown leaf puffs (sways gently in breeze!)
  ctx.fillStyle = cBright;
  ctx.fillRect(sx + sway, sy - 2, 9, 5);
  ctx.fillRect(sx + 3 + sway, sy - 6, 9, 6);
  ctx.fillRect(sx + 8, sy - 1, 6, 4);

  // Crisp golden-green rim highlights + individual leaf pixels
  ctx.fillStyle = cSun;
  ctx.fillRect(sx + 4 + sway, sy - 6, 6, 2);
  ctx.fillRect(sx + 1 + sway, sy - 2, 4, 2);
  ctx.fillRect(sx + 9, sy, 3, 1);

  if (isSpring && !autumnTint && variant % 4 === 0) {
    // Delicate spring blossom clusters (cherry/apple pink & ivory)
    ctx.fillStyle = '#fbcfe8';
    ctx.fillRect(sx + 2 + sway, sy - 4, 2, 2);
    ctx.fillRect(sx + 9 + sway, sy - 3, 2, 2);
    ctx.fillStyle = '#fff1f2';
    ctx.fillRect(sx + 6 + sway, sy - 6, 2, 1);
  } else if (isWinter && variant % 3 === 0) {
    // Subtle winter rime/frost glint along upper canopy crown
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(sx + 4 + sway, sy - 6, 5, 1);
    ctx.fillRect(sx + 1 + sway, sy - 2, 3, 1);
  }
}

/**
 * 16-bit Wrought-Iron Streetlamp (Réverbère) with Warm Golden Glow
 */
function draw16BitStreetLamp(ctx: CanvasRenderingContext2D, sx: number, sy: number, pulse: boolean) {
  ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
  ctx.fillRect(sx - 3, sy - 9, 10, 10);
  if (pulse) {
    ctx.fillStyle = 'rgba(254, 240, 138, 0.16)';
    ctx.fillRect(sx - 5, sy - 11, 14, 13);
  }
  ctx.fillStyle = 'rgba(20, 12, 7, 0.35)';
  ctx.fillRect(sx + 1, sy + 5, 5, 2);
  // Iron post
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(sx + 1, sy - 5, 2, 11);
  ctx.fillRect(sx, sy + 5, 4, 1);
  // Lantern head
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(sx, sy - 8, 4, 3);
  ctx.fillStyle = '#fde047';
  ctx.fillRect(sx + 1, sy - 7, 2, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(sx + 1, sy - 7, 1, 1);
}

/**
 * Renders 6 Distinct Real-World 16-Bit Architectural Families:
 *  - BC_URBAN_MIDRISE: Multi-story Haussmannian / brick / historic city-center buildings (mansard zinc/slate, wrought-iron balconies, 2 window tiers)
 *  - BC_COMMERCIAL: Boutiques, market halls & retail buildings (vibrant striped shopfront awnings & wide lit vitrines)
 *  - BC_INDUSTRIAL: Corrugated steel warehouses & sawtooth factory sheds (loading bay shutters, safety chevrons, skylights, vents/smokestack)
 *  - BC_CIVIC: Symmetrical institutional stone & rose-brick schools / public buildings (pediment + clock)
 *  - BC_SUBURBAN: Detached & semi-detached suburban pavilions (white/cream/brick render, garage doors, wide bay windows)
 *  - BC_VILLAGE: Traditional French maisons de bourg (stone or colombages, colored shutters, flowerboxes, smoking chimney)
 *  - BC_FARM: Rural hamlet stone longères & timber barns (weathered beams, double hayloft/barn doors)
 */
function draw16BitTypedBuildingTile(
  pctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  sx: number,
  sy: number,
  archCode: number,
  levels: number,
  settlement: number,
  nB: boolean,
  sB: boolean,
  wB: boolean,
  eB: boolean,
  rawNB: boolean,
  rawSB: boolean,
  sameW: boolean,
  sameE: boolean,
  blockedNorth: boolean,
  onCliffEdge: boolean,
  facesStreetSouth: boolean,
  h: number,
  envTick: number
) {
  // Grounded drop shadows & cliff foundations
  if (!sB) {
    if (onCliffEdge) {
      pctx.fillStyle = '#241911';
      pctx.fillRect(sx, sy + 16, 16, 4);
      pctx.fillStyle = '#b89f78';
      pctx.fillRect(sx + 1, sy + 16, 14, 3);
      pctx.fillStyle = '#e7d8be';
      pctx.fillRect(sx + 2, sy + 16, 5, 2);
      pctx.fillRect(sx + 9, sy + 16, 4, 2);
      pctx.fillStyle = 'rgba(18, 12, 8, 0.38)';
      pctx.fillRect(sx + 1, sy + 20, 16, 3);
    } else if (!rawSB) {
      pctx.fillStyle = 'rgba(22, 14, 8, 0.34)';
      pctx.fillRect(sx + 1, sy + 16, 16, 3);
    }
  }
  if (!eB) {
    pctx.fillStyle = 'rgba(22, 14, 8, 0.24)';
    pctx.fillRect(sx + 16, sy + 2, 2, 14);
  }

  // ==========================================================================
  // 1. INDUSTRIAL WAREHOUSE & SAWTOOTH FACTORY SHED
  // ==========================================================================
  if (archCode === BC_INDUSTRIAL) {
    const topLift = blockedNorth || (!nB && rawNB) ? 0 : -3;
    const isBlueClad = ((wx >> 1) + (wy >> 1)) % 3 === 0;
    const outline = '#182230';
    const roofDark = '#334155';
    const roofMid = '#475569';
    const roofLight = '#64748b';
    const wallMain = isBlueClad ? '#93adc2' : '#cbd5e1';
    const wallRib = isBlueClad ? '#6d8ba3' : '#94a3b8';

    if (!sB) {
      const roofH = 7 - topLift;
      pctx.fillStyle = roofMid;
      pctx.fillRect(sx, sy + topLift, 16, roofH);

      // Corrugated steel / sawtooth factory roof ribs + cyan industrial skylights
      for (let rx = 1; rx < 15; rx += 3) {
        pctx.fillStyle = roofLight;
        pctx.fillRect(sx + rx, sy + topLift + 1, 1, roofH - 2);
        pctx.fillStyle = roofDark;
        pctx.fillRect(sx + rx + 1, sy + topLift + 1, 1, roofH - 2);
      }
      // Factory sawtooth skylight strip
      pctx.fillStyle = '#0f172a';
      pctx.fillRect(sx + 2, sy + topLift + 2, 12, 2);
      pctx.fillStyle = '#7dd3fc';
      pctx.fillRect(sx + 3, sy + topLift + 2, 4, 1);
      pctx.fillRect(sx + 9, sy + topLift + 2, 4, 1);

      if (!nB) {
        pctx.fillStyle = outline;
        pctx.fillRect(sx, sy + topLift, 16, 1);
        pctx.fillStyle = '#94a3b8';
        pctx.fillRect(sx + 1, sy + topLift + 1, 14, 1);
      }

      // Cladding wall with horizontal corrugated ribs
      pctx.fillStyle = outline;
      pctx.fillRect(sx, sy + 6, 16, 1);
      pctx.fillStyle = wallMain;
      pctx.fillRect(sx, sy + 7, 16, 8);
      for (let ry = 8; ry <= 13; ry += 2) {
        pctx.fillStyle = wallRib;
        pctx.fillRect(sx, sy + ry, 16, 1);
      }
      pctx.fillStyle = outline;
      pctx.fillRect(sx, sy + 15, 16, 1);

      // Wide steel rolling cargo bay door + yellow/black safety frame
      if ((wx + wy) % 2 === 0) {
        pctx.fillStyle = '#eab308';
        pctx.fillRect(sx + 3, sy + 8, 10, 7);
        pctx.fillStyle = '#1e293b';
        pctx.fillRect(sx + 4, sy + 9, 8, 6);
        for (let syRib = 10; syRib <= 13; syRib += 2) {
          pctx.fillStyle = '#64748b';
          pctx.fillRect(sx + 5, sy + syRib, 6, 1);
        }
        // Hazard ticks on pillars
        pctx.fillStyle = '#18181b';
        pctx.fillRect(sx + 3, sy + 10, 1, 1);
        pctx.fillRect(sx + 3, sy + 13, 1, 1);
        pctx.fillRect(sx + 12, sy + 10, 1, 1);
        pctx.fillRect(sx + 12, sy + 13, 1, 1);
      } else {
        // High industrial clerestory windows + personnel steel door
        pctx.fillStyle = '#1e293b';
        pctx.fillRect(sx + 2, sy + 8, 12, 3);
        pctx.fillStyle = '#bae6fd';
        pctx.fillRect(sx + 3, sy + 9, 4, 1);
        pctx.fillRect(sx + 9, sy + 9, 4, 1);
        pctx.fillStyle = '#334155';
        pctx.fillRect(sx + 10, sy + 11, 3, 4);
      }

      // Occasional factory smokestack or HVAC unit
      if (!nB && !rawNB && h % 5 === 0) {
        pctx.fillStyle = '#7c2d12';
        pctx.fillRect(sx + 11, sy + topLift - 5, 3, 6);
        pctx.fillStyle = '#c2410c';
        pctx.fillRect(sx + 11, sy + topLift - 4, 2, 5);
        pctx.fillStyle = '#1e293b';
        pctx.fillRect(sx + 11, sy + topLift - 5, 3, 1);
        const puff = (envTick + wx) % 4;
        pctx.fillStyle = 'rgba(241, 245, 249, 0.78)';
        pctx.fillRect(sx + 12 + (puff >> 1), sy + topLift - 7 - puff, 3, 2);
      }
    } else {
      // Deep multi-tile warehouse roof with skylights & HVAC vents
      pctx.fillStyle = roofMid;
      pctx.fillRect(sx, sy + topLift, 16, 16 - topLift);
      for (let rx = 1; rx < 15; rx += 4) {
        pctx.fillStyle = roofLight;
        pctx.fillRect(sx + rx, sy + topLift + 1, 2, 15 - topLift);
        pctx.fillStyle = roofDark;
        pctx.fillRect(sx + rx + 2, sy + topLift + 1, 1, 15 - topLift);
      }
      if (!nB) {
        pctx.fillStyle = outline;
        pctx.fillRect(sx, sy + topLift, 16, 1);
        pctx.fillStyle = '#94a3b8';
        pctx.fillRect(sx + 1, sy + topLift + 1, 14, 1);
      }
      if ((wx + wy) % 2 === 0) {
        pctx.fillStyle = '#0f172a';
        pctx.fillRect(sx + 3, sy + 6, 10, 4);
        pctx.fillStyle = '#7dd3fc';
        pctx.fillRect(sx + 4, sy + 7, 3, 2);
        pctx.fillRect(sx + 9, sy + 7, 3, 2);
      } else if (h % 3 === 0) {
        // Metallic HVAC box
        pctx.fillStyle = '#1e293b';
        pctx.fillRect(sx + 5, sy + 6, 6, 5);
        pctx.fillStyle = '#cbd5e1';
        pctx.fillRect(sx + 6, sy + 6, 4, 4);
        pctx.fillStyle = '#475569';
        pctx.fillRect(sx + 7, sy + 7, 2, 2);
      }
    }

    if (!sameW) {
      pctx.fillStyle = outline;
      pctx.fillRect(sx, sy + topLift, 1, 16 - topLift);
    }
    if (!sameE) {
      pctx.fillStyle = outline;
      pctx.fillRect(sx + 15, sy + topLift, 1, 16 - topLift);
    }
    return;
  }

  // ==========================================================================
  // 2. CIVIC / SCHOOL / INSTITUTIONAL EDIFICE
  // ==========================================================================
  if (archCode === BC_CIVIC) {
    const topLift = blockedNorth || (!nB && rawNB) ? -1 : -4;
    const outline = '#1e1b2e';
    if (!sB) {
      const roofH = 6 - topLift;
      pctx.fillStyle = '#334155';
      pctx.fillRect(sx, sy + topLift, 16, roofH);
      pctx.fillStyle = '#64748b';
      pctx.fillRect(sx + 1, sy + topLift + 1, 14, 2);
      if (!nB) {
        pctx.fillStyle = outline;
        pctx.fillRect(sx, sy + topLift, 16, 1);
        pctx.fillStyle = '#cbd5e1';
        pctx.fillRect(sx + 1, sy + topLift + 1, 14, 1);
      }
      // Rose-brick & dressed limestone quoin facade
      pctx.fillStyle = outline;
      pctx.fillRect(sx, sy + 5, 16, 1);
      pctx.fillStyle = '#f7efe0'; // Stone cornice
      pctx.fillRect(sx, sy + 6, 16, 1);
      pctx.fillStyle = '#c8644b'; // Institutional brick
      pctx.fillRect(sx, sy + 7, 16, 8);
      // Stone corner quoins
      pctx.fillStyle = '#f5ebd6';
      pctx.fillRect(sx + 1, sy + 7, 1, 7);
      pctx.fillRect(sx + 14, sy + 7, 1, 7);
      pctx.fillStyle = outline;
      pctx.fillRect(sx, sy + 15, 16, 1);

      // Symmetrical windows + central clock/pediment on alternate modules
      pctx.fillStyle = '#1e293b';
      pctx.fillRect(sx + 3, sy + 8, 2, 3);
      pctx.fillRect(sx + 11, sy + 8, 2, 3);
      pctx.fillStyle = '#fef08a';
      pctx.fillRect(sx + 3, sy + 9, 2, 2);
      pctx.fillRect(sx + 11, sy + 9, 2, 2);

      if ((wx + wy) % 2 === 0) {
        // Pediment + clock + double entrance
        pctx.fillStyle = '#f7efe0';
        pctx.fillRect(sx + 6, sy + 4, 4, 3);
        pctx.fillStyle = '#ffffff';
        pctx.fillRect(sx + 7, sy + 5, 2, 2);
        pctx.fillStyle = '#3b1f0e';
        pctx.fillRect(sx + 6, sy + 11, 4, 4);
        pctx.fillStyle = '#92400e';
        pctx.fillRect(sx + 7, sy + 11, 2, 4);
      } else {
        pctx.fillStyle = '#1e293b';
        pctx.fillRect(sx + 7, sy + 8, 2, 3);
        pctx.fillRect(sx + 3, sy + 12, 2, 2);
        pctx.fillRect(sx + 7, sy + 12, 2, 2);
        pctx.fillRect(sx + 11, sy + 12, 2, 2);
        pctx.fillStyle = '#fde68a';
        pctx.fillRect(sx + 7, sy + 9, 2, 2);
      }
    } else {
      pctx.fillStyle = '#334155';
      pctx.fillRect(sx, sy + topLift, 16, 16 - topLift);
      for (let ry = sy + topLift + 2; ry < sy + 15; ry += 3) {
        pctx.fillStyle = '#64748b';
        pctx.fillRect(sx + 1, ry, 14, 1);
      }
      if (!nB) {
        pctx.fillStyle = outline;
        pctx.fillRect(sx, sy + topLift, 16, 1);
        pctx.fillStyle = '#cbd5e1';
        pctx.fillRect(sx + 1, sy + topLift + 1, 14, 1);
      }
    }
    if (!sameW) {
      pctx.fillStyle = outline;
      pctx.fillRect(sx, sy + topLift, 1, 16 - topLift);
    }
    if (!sameE) {
      pctx.fillStyle = outline;
      pctx.fillRect(sx + 15, sy + topLift, 1, 16 - topLift);
    }
    return;
  }

  // ==========================================================================
  // 3. COMMERCIAL HALL / BOUTIQUE & CITY-CENTER MULTI-STORY HAUSSMANNIAN
  // ==========================================================================
  if (archCode === BC_URBAN_MIDRISE || archCode === BC_COMMERCIAL) {
    const isPureRetailHall = archCode === BC_COMMERCIAL && settlement !== SETTLE_CITY_CENTER && levels < 3;
    if (isPureRetailHall) {
      // Modern Commercial / Market Hall with flat parapet cornice, striped awning & wide display vitrines
      const topLift = blockedNorth || (!nB && rawNB) ? 0 : -2;
      const outline = '#1e293b';
      const awningPal =
        (wx + wy) % 3 === 0 ? '#dc2626' : (wx + wy) % 3 === 1 ? '#0284c7' : '#059669';

      if (!sB) {
        pctx.fillStyle = '#64748b';
        pctx.fillRect(sx, sy + topLift, 16, 6 - topLift);
        pctx.fillStyle = '#94a3b8';
        pctx.fillRect(sx + 1, sy + topLift + 1, 14, 3);
        if (!nB) {
          pctx.fillStyle = outline;
          pctx.fillRect(sx, sy + topLift, 16, 1);
        }
        // Parapet & cream commercial fascia
        pctx.fillStyle = '#f8fafc';
        pctx.fillRect(sx, sy + 6, 16, 2);
        pctx.fillStyle = '#e2e8f0';
        pctx.fillRect(sx, sy + 8, 16, 7);
        // Striped shopfront awning
        for (let ax = 1; ax < 15; ax += 2) {
          pctx.fillStyle = awningPal;
          pctx.fillRect(sx + ax, sy + 8, 1, 3);
          pctx.fillStyle = '#fffbeb';
          pctx.fillRect(sx + ax + 1, sy + 8, 1, 3);
        }
        // Illuminated glass vitrines
        pctx.fillStyle = '#0f172a';
        pctx.fillRect(sx + 2, sy + 11, 12, 4);
        pctx.fillStyle = '#7dd3fc';
        pctx.fillRect(sx + 3, sy + 11, 4, 3);
        pctx.fillRect(sx + 9, sy + 11, 4, 3);
        pctx.fillStyle = '#fef08a';
        pctx.fillRect(sx + 4, sy + 12, 2, 2);
        pctx.fillRect(sx + 10, sy + 12, 2, 2);
        pctx.fillStyle = outline;
        pctx.fillRect(sx, sy + 15, 16, 1);
      } else {
        pctx.fillStyle = '#64748b';
        pctx.fillRect(sx, sy + topLift, 16, 16 - topLift);
        pctx.fillStyle = '#94a3b8';
        pctx.fillRect(sx + 2, sy + 4, 12, 8);
        pctx.fillStyle = '#bae6fd';
        pctx.fillRect(sx + 4, sy + 6, 8, 4);
        if (!nB) {
          pctx.fillStyle = outline;
          pctx.fillRect(sx, sy + topLift, 16, 1);
        }
      }
      if (!sameW) {
        pctx.fillStyle = outline;
        pctx.fillRect(sx, sy + topLift, 1, 16 - topLift);
      }
      if (!sameE) {
        pctx.fillStyle = outline;
        pctx.fillRect(sx + 15, sy + topLift, 1, 16 - topLift);
      }
      return;
    }

    // Multi-story City-Center Haussmannian / Historic Townhouse (2 window rows + mansard + optional street shopfront!)
    const topLift = blockedNorth || (!nB && rawNB) ? -1 : -5;
    const urbanStyle = tileHash(wx >> 1, wy >> 1) % 3;
    const pal =
      urbanStyle === 0
        ? {
            // Parisian Haussmannian Limestone & Zinc Mansard
            outline: '#17202e',
            roofShadow: '#1e293b',
            roofMid: '#3b4c63',
            roofLight: '#64748b',
            roofRidge: '#cbd5e1',
            wall: '#f6eedc',
            wallShade: '#dfd1b4',
            cornice: '#ffffff',
          }
        : urbanStyle === 1
        ? {
            // Historic Rose-Brick & Slate Townhouse (Toulouse / Lille / Place Royale)
            outline: '#291512',
            roofShadow: '#262f40',
            roofMid: '#3f4d63',
            roofLight: '#64748b',
            roofRidge: '#cbd5e1',
            wall: '#cf6a53',
            wallShade: '#ab4e3a',
            cornice: '#f5ebd6',
          }
        : {
            // Golden Ochre & Roman Tile Historic Quarter (Lyon / Bordeaux / Aix)
            outline: '#2b180e',
            roofShadow: '#6e2c1e',
            roofMid: '#9e432e',
            roofLight: '#c96044',
            roofRidge: '#f2a384',
            wall: '#f2ddb6',
            wallShade: '#d4b887',
            cornice: '#fbf6ea',
          };

    const hasGroundShop =
      archCode === BC_COMMERCIAL || (facesStreetSouth && (wx + wy * 3) % 3 === 0);

    if (!sB) {
      const roofH = 5 - topLift;
      pctx.fillStyle = pal.roofMid;
      pctx.fillRect(sx, sy + topLift, 16, roofH);

      for (let ry = sy + topLift + 2; ry < sy + 4; ry += 2) {
        pctx.fillStyle = pal.roofLight;
        for (let rx = (ry & 2) ? 1 : 0; rx < 15; rx += 4) {
          pctx.fillRect(sx + rx, ry, 3, 1);
        }
        pctx.fillStyle = pal.roofShadow;
        pctx.fillRect(sx, ry + 1, 16, 1);
      }

      // Mansard dormer window (lucarne) on tall roof
      if (topLift <= -4) {
        pctx.fillStyle = pal.outline;
        pctx.fillRect(sx + 6, sy, 4, 4);
        pctx.fillStyle = pal.cornice;
        pctx.fillRect(sx + 6, sy, 4, 1);
        pctx.fillStyle = '#fde047';
        pctx.fillRect(sx + 7, sy + 1, 2, 2);
      }

      if (!nB) {
        pctx.fillStyle = pal.outline;
        pctx.fillRect(sx, sy + topLift, 16, 1);
        pctx.fillStyle = pal.roofRidge;
        pctx.fillRect(sx + 1, sy + topLift + 1, 14, 1);
      }

      // Multi-story cut-stone/brick facade (sy + 5 .. sy + 15 = 11px tall!)
      pctx.fillStyle = pal.outline;
      pctx.fillRect(sx, sy + 4, 16, 1);
      pctx.fillStyle = pal.cornice;
      pctx.fillRect(sx, sy + 5, 16, 1);
      pctx.fillStyle = pal.wall;
      pctx.fillRect(sx, sy + 6, 16, 9);
      pctx.fillStyle = pal.wallShade;
      pctx.fillRect(sx, sy + 10, 16, 1); // Haussmannian balcony belt course!
      pctx.fillRect(sx, sy + 14, 16, 1);
      pctx.fillStyle = pal.outline;
      pctx.fillRect(sx, sy + 15, 16, 1);

      // Upper story windows + wrought-iron balcony railing
      const upperGlow = h % 3 === 0 ? '#fef08a' : '#fbbf24';
      pctx.fillStyle = '#1e293b';
      pctx.fillRect(sx + 2, sy + 6, 3, 4);
      pctx.fillRect(sx + 7, sy + 6, 2, 4);
      pctx.fillRect(sx + 11, sy + 6, 3, 4);
      pctx.fillStyle = upperGlow;
      pctx.fillRect(sx + 3, sy + 7, 1, 2);
      pctx.fillRect(sx + 7, sy + 7, 2, 2);
      pctx.fillRect(sx + 12, sy + 7, 1, 2);
      // Wrought-iron balcony guardrail
      pctx.fillStyle = '#0f172a';
      pctx.fillRect(sx + 2, sy + 9, 12, 1);

      // Ground floor: Striped bistro/boutique shopfront OR arched carriage portal & tall windows
      if (hasGroundShop) {
        const awningCol = h % 3 === 0 ? '#b91c1c' : h % 3 === 1 ? '#1d4ed8' : '#047857';
        for (let ax = 1; ax < 15; ax += 2) {
          pctx.fillStyle = awningCol;
          pctx.fillRect(sx + ax, sy + 10, 1, 2);
          pctx.fillStyle = '#fffbeb';
          pctx.fillRect(sx + ax + 1, sy + 10, 1, 2);
        }
        pctx.fillStyle = '#1e293b';
        pctx.fillRect(sx + 2, sy + 12, 7, 3);
        pctx.fillRect(sx + 10, sy + 12, 4, 3);
        pctx.fillStyle = '#fef08a';
        pctx.fillRect(sx + 3, sy + 12, 5, 2);
        pctx.fillStyle = '#7dd3fc';
        pctx.fillRect(sx + 11, sy + 12, 2, 3);
      } else {
        pctx.fillStyle = '#3b1f0e';
        pctx.fillRect(sx + 6, sy + 11, 4, 4);
        pctx.fillStyle = '#6e3f1d';
        pctx.fillRect(sx + 7, sy + 11, 2, 4);
        pctx.fillStyle = '#1e293b';
        pctx.fillRect(sx + 2, sy + 11, 3, 3);
        pctx.fillRect(sx + 11, sy + 11, 3, 3);
        pctx.fillStyle = '#fde68a';
        pctx.fillRect(sx + 3, sy + 12, 1, 2);
        pctx.fillRect(sx + 12, sy + 12, 1, 2);
      }
    } else {
      // Mansard roof slope with dormer lucarnes & chimney pots
      pctx.fillStyle = pal.roofMid;
      pctx.fillRect(sx, sy + topLift, 16, 16 - topLift);
      for (let ry = sy + topLift + 2; ry < sy + 16; ry += 3) {
        pctx.fillStyle = pal.roofLight;
        for (let rx = (ry & 1) * 2; rx < 15; rx += 4) {
          pctx.fillRect(sx + rx, ry, 3, 1);
        }
        pctx.fillStyle = pal.roofShadow;
        pctx.fillRect(sx, ry + 1, 16, 1);
      }
      if (!nB) {
        pctx.fillStyle = pal.outline;
        pctx.fillRect(sx, sy + topLift, 16, 1);
        pctx.fillStyle = pal.roofRidge;
        pctx.fillRect(sx + 1, sy + topLift + 1, 14, 1);
        // Orange terracotta Parisian chimney pots (mitrons)
        if (h % 3 === 0) {
          pctx.fillStyle = '#9a3412';
          pctx.fillRect(sx + 4, sy + topLift - 1, 2, 2);
          pctx.fillRect(sx + 7, sy + topLift - 1, 2, 2);
        }
      }
      if (h % 4 === 0) {
        pctx.fillStyle = pal.outline;
        pctx.fillRect(sx + 6, sy + 6, 4, 5);
        pctx.fillStyle = pal.cornice;
        pctx.fillRect(sx + 6, sy + 5, 4, 1);
        pctx.fillStyle = '#fde047';
        pctx.fillRect(sx + 7, sy + 7, 2, 3);
      }
    }

    if (!sameW) {
      pctx.fillStyle = pal.outline;
      pctx.fillRect(sx, sy + topLift, 1, 16 - topLift);
    }
    if (!sameE) {
      pctx.fillStyle = pal.outline;
      pctx.fillRect(sx + 15, sy + topLift, 1, 16 - topLift);
    }
    return;
  }

  // ==========================================================================
  // 4. RURAL HAMLET FARMHOUSE (LONGÈRE) & TIMBER BARN (GRANGE)
  // ==========================================================================
  if (archCode === BC_FARM) {
    const topLift = blockedNorth || (!nB && rawNB) ? 0 : -2;
    const isTimberBarn = (wx + wy) % 2 === 1;
    const outline = '#24160b';
    const roofMid = isTimberBarn ? '#6b4c2b' : '#7c4a2d';
    const roofLight = isTimberBarn ? '#8c663e' : '#a3633e';
    const roofDark = '#472f18';
    const wall = isTimberBarn ? '#8c5832' : '#d6c3a3';
    const wallShade = isTimberBarn ? '#694022' : '#b59e7a';

    if (!sB) {
      const roofH = 8 - topLift;
      pctx.fillStyle = roofMid;
      pctx.fillRect(sx, sy + topLift, 16, roofH);
      for (let ry = sy + topLift + 2; ry < sy + 7; ry += 2) {
        pctx.fillStyle = roofLight;
        for (let rx = (ry & 2) ? 1 : 0; rx < 15; rx += 4) {
          pctx.fillRect(sx + rx, ry, 3, 1);
        }
        pctx.fillStyle = roofDark;
        pctx.fillRect(sx, ry + 1, 16, 1);
      }
      // Subtle moss tuft on old rural roof
      if (h % 3 === 0) {
        pctx.fillStyle = '#4d9c42';
        pctx.fillRect(sx + 3, sy + 5, 3, 1);
      }
      if (!nB) {
        pctx.fillStyle = outline;
        pctx.fillRect(sx, sy + topLift, 16, 1);
        pctx.fillStyle = '#c9a677';
        pctx.fillRect(sx + 1, sy + topLift + 1, 14, 1);
      }

      // Hayloft dormer (lucarne à foin) in roof center
      if (isTimberBarn) {
        pctx.fillStyle = outline;
        pctx.fillRect(sx + 6, sy + 3, 4, 4);
        pctx.fillStyle = '#eab308'; // golden hay inside loft!
        pctx.fillRect(sx + 7, sy + 4, 2, 2);
      }

      pctx.fillStyle = outline;
      pctx.fillRect(sx, sy + 7, 16, 1);
      pctx.fillStyle = wall;
      pctx.fillRect(sx, sy + 8, 16, 7);
      pctx.fillStyle = wallShade;
      pctx.fillRect(sx, sy + 14, 16, 1);
      pctx.fillStyle = outline;
      pctx.fillRect(sx, sy + 15, 16, 1);

      if (isTimberBarn) {
        // Wide double timber barn doors with cross-bracing
        pctx.fillStyle = '#3b1f0e';
        pctx.fillRect(sx + 4, sy + 9, 8, 6);
        pctx.fillStyle = '#6e3f1d';
        pctx.fillRect(sx + 5, sy + 9, 3, 6);
        pctx.fillRect(sx + 9, sy + 9, 2, 6);
        pctx.fillStyle = '#b8864b';
        pctx.fillRect(sx + 5, sy + 11, 6, 1);
      } else {
        // Stone longère: low arched oak door + small warm window + stacked firewood
        pctx.fillStyle = '#3b1f0e';
        pctx.fillRect(sx + 3, sy + 10, 4, 5);
        pctx.fillStyle = '#784421';
        pctx.fillRect(sx + 4, sy + 10, 2, 5);
        pctx.fillStyle = '#2b1d12';
        pctx.fillRect(sx + 9, sy + 10, 3, 3);
        pctx.fillStyle = '#fbbf24';
        pctx.fillRect(sx + 10, sy + 11, 1, 1);
        // Tiny firewood stack against stone wall
        pctx.fillStyle = '#5c3419';
        pctx.fillRect(sx + 12, sy + 13, 3, 2);
        pctx.fillStyle = '#d9a46c';
        pctx.fillRect(sx + 13, sy + 13, 1, 1);
      }
    } else {
      pctx.fillStyle = roofMid;
      pctx.fillRect(sx, sy + topLift, 16, 16 - topLift);
      for (let ry = sy + topLift + 2; ry < sy + 16; ry += 3) {
        pctx.fillStyle = roofLight;
        pctx.fillRect(sx + 1, ry, 14, 1);
        pctx.fillStyle = roofDark;
        pctx.fillRect(sx, ry + 1, 16, 1);
      }
      if (!nB) {
        pctx.fillStyle = outline;
        pctx.fillRect(sx, sy + topLift, 16, 1);
      }
    }
    if (!sameW) {
      pctx.fillStyle = outline;
      pctx.fillRect(sx, sy + topLift, 1, 16 - topLift);
    }
    if (!sameE) {
      pctx.fillStyle = outline;
      pctx.fillRect(sx + 15, sy + topLift, 1, 16 - topLift);
    }
    return;
  }

  // ==========================================================================
  // 5. SUBURBAN PAVILION (BANLIEUE / LOTISSEMENT PAVILLONNAIRE)
  // ==========================================================================
  if (archCode === BC_SUBURBAN) {
    const topLift = blockedNorth || (!nB && rawNB) ? 0 : -2;
    const subStyle = (wx * 3 + wy * 5) % 3;
    const pal =
      subStyle === 0
        ? {
            // Crisp white modern pavilion with terracotta tile roof
            outline: '#2b1810',
            roofShadow: '#8c3523',
            roofMid: '#bd4b33',
            roofLight: '#e06b4f',
            roofRidge: '#f7b29c',
            wall: '#faf8f2',
            wallShade: '#e2ddd1',
          }
        : subStyle === 1
        ? {
            // Contemporary cream pavilion with anthracite slate-tile roof
            outline: '#1e293b',
            roofShadow: '#263142',
            roofMid: '#3b495e',
            roofLight: '#576982',
            roofRidge: '#94a3b8',
            wall: '#f5efe2',
            wallShade: '#dbd1be',
          }
        : {
            // Warm sand/brick suburban house with brown tile roof
            outline: '#291c12',
            roofShadow: '#573d28',
            roofMid: '#7d593b',
            roofLight: '#a17652',
            roofRidge: '#d1ad88',
            wall: '#f2dec4',
            wallShade: '#d6bc9c',
          };

    if (!sB) {
      const roofH = 7 - topLift;
      pctx.fillStyle = pal.roofMid;
      pctx.fillRect(sx, sy + topLift, 16, roofH);
      for (let ry = sy + topLift + 2; ry < sy + 6; ry += 2) {
        pctx.fillStyle = pal.roofLight;
        for (let rx = (ry & 2) ? 1 : 0; rx < 15; rx += 4) {
          pctx.fillRect(sx + rx, ry, 3, 1);
        }
        pctx.fillStyle = pal.roofShadow;
        pctx.fillRect(sx, ry + 1, 16, 1);
      }
      if (!nB) {
        pctx.fillStyle = pal.outline;
        pctx.fillRect(sx, sy + topLift, 16, 1);
        pctx.fillStyle = pal.roofRidge;
        pctx.fillRect(sx + 1, sy + topLift + 1, 14, 1);
      }

      pctx.fillStyle = pal.outline;
      pctx.fillRect(sx, sy + 6, 16, 1);
      pctx.fillStyle = pal.wall;
      pctx.fillRect(sx, sy + 7, 16, 8);
      pctx.fillStyle = pal.wallShade;
      pctx.fillRect(sx, sy + 7, 16, 1);
      pctx.fillRect(sx, sy + 14, 16, 1);
      pctx.fillStyle = pal.outline;
      pctx.fillRect(sx, sy + 15, 16, 1);

      if ((wx + wy) % 2 === 0) {
        // Pavilion with ribbed light-grey garage door + front door / lit window
        pctx.fillStyle = '#475569';
        pctx.fillRect(sx + 2, sy + 9, 6, 6);
        pctx.fillStyle = '#cbd5e1';
        pctx.fillRect(sx + 3, sy + 10, 4, 5);
        pctx.fillStyle = '#94a3b8';
        pctx.fillRect(sx + 3, sy + 11, 4, 1);
        pctx.fillRect(sx + 3, sy + 13, 4, 1);

        pctx.fillStyle = '#1e293b';
        pctx.fillRect(sx + 10, sy + 9, 4, 4);
        pctx.fillStyle = '#fef08a';
        pctx.fillRect(sx + 11, sy + 10, 2, 2);
      } else {
        // Pavilion with front door + wide sliding glass bay window (baie vitrée)
        pctx.fillStyle = '#451a03';
        pctx.fillRect(sx + 2, sy + 10, 3, 5);
        pctx.fillStyle = '#92400e';
        pctx.fillRect(sx + 3, sy + 10, 1, 5);

        pctx.fillStyle = '#1e293b';
        pctx.fillRect(sx + 7, sy + 9, 7, 5);
        pctx.fillStyle = '#7dd3fc';
        pctx.fillRect(sx + 8, sy + 10, 2, 3);
        pctx.fillStyle = '#fef08a';
        pctx.fillRect(sx + 11, sy + 10, 2, 3);
      }
    } else {
      pctx.fillStyle = pal.roofMid;
      pctx.fillRect(sx, sy + topLift, 16, 16 - topLift);
      for (let ry = sy + topLift + 2; ry < sy + 16; ry += 3) {
        pctx.fillStyle = pal.roofLight;
        for (let rx = (ry & 1) * 2; rx < 15; rx += 4) {
          pctx.fillRect(sx + rx, ry, 3, 1);
        }
        pctx.fillStyle = pal.roofShadow;
        pctx.fillRect(sx, ry + 1, 16, 1);
      }
      if (!nB) {
        pctx.fillStyle = pal.outline;
        pctx.fillRect(sx, sy + topLift, 16, 1);
        pctx.fillStyle = pal.roofRidge;
        pctx.fillRect(sx + 1, sy + topLift + 1, 14, 1);
      }
    }

    if (!sameW) {
      pctx.fillStyle = pal.outline;
      pctx.fillRect(sx, sy + topLift, 1, 16 - topLift);
    }
    if (!sameE) {
      pctx.fillStyle = pal.outline;
      pctx.fillRect(sx + 15, sy + topLift, 1, 16 - topLift);
    }
    return;
  }

  // ==========================================================================
  // 6. TRADITIONAL VILLAGE HOUSE (MAISON DE BOURG — STONE, COLOMBAGES & SHUTTERS)
  // ==========================================================================
  const topLift = blockedNorth || (!nB && rawNB) ? 0 : -3;
  const style = tileHash(wx >> 1, wy >> 1) % 3;
  const pal =
    style === 0
      ? {
          outline: '#2b150e',
          roofShadow: '#6e2c1e',
          roofMid: '#9e432e',
          roofLight: '#c96044',
          roofRidge: '#f2a384',
          wall: '#f2e2c4',
          wallShade: '#d4be98',
          timber: '#6e4226',
          shutter: '#1d4ed8', // French blue shutters
        }
      : style === 1
      ? {
          outline: '#17202e',
          roofShadow: '#334155',
          roofMid: '#475569',
          roofLight: '#64748b',
          roofRidge: '#cbd5e1',
          wall: '#f0e4cc',
          wallShade: '#d1c2a5',
          timber: '#64748b',
          shutter: '#15803d', // Village sage/forest green shutters
        }
      : {
          outline: '#261a10',
          roofShadow: '#4f3b27',
          roofMid: '#73573b',
          roofLight: '#967452',
          roofRidge: '#cbb08c',
          wall: '#ebd9b7',
          wallShade: '#cbb38a',
          timber: '#54341d',
          shutter: '#991b1b', // Burgundy shutters + colombages
        };

  if (!sB) {
    const roofH = 8 - topLift;
    pctx.fillStyle = pal.roofMid;
    pctx.fillRect(sx, sy + topLift, 16, roofH);

    for (let ry = sy + topLift + 2; ry < sy + 7; ry += 2) {
      pctx.fillStyle = pal.roofLight;
      for (let rx = (ry & 2) ? 1 : 0; rx < 15; rx += 4) {
        pctx.fillRect(sx + rx, ry, 3, 1);
      }
      pctx.fillStyle = pal.roofShadow;
      pctx.fillRect(sx, ry + 1, 16, 1);
    }

    if (!nB) {
      pctx.fillStyle = pal.outline;
      pctx.fillRect(sx, sy + topLift, 16, 1);
      pctx.fillStyle = pal.roofRidge;
      pctx.fillRect(sx + 1, sy + topLift + 1, 14, 1);
    }

    pctx.fillStyle = pal.outline;
    pctx.fillRect(sx, sy + 7, 16, 1);
    pctx.fillStyle = pal.wall;
    pctx.fillRect(sx, sy + 8, 16, 8);
    pctx.fillStyle = pal.wallShade;
    pctx.fillRect(sx, sy + 8, 16, 1);
    pctx.fillRect(sx, sy + 14, 16, 1);
    pctx.fillStyle = pal.outline;
    pctx.fillRect(sx, sy + 15, 16, 1);

    // Half-timbered colombage beams on style 2!
    if (style === 2) {
      pctx.fillStyle = pal.timber;
      pctx.fillRect(sx + 7, sy + 8, 1, 7);
      pctx.fillRect(sx + 1, sy + 11, 14, 1);
    }

    const hasDoor = (wx + wy) % 2 === 0;
    if (hasDoor) {
      pctx.fillStyle = '#3b1f0e';
      pctx.fillRect(sx + 3, sy + 10, 4, 5);
      pctx.fillStyle = '#6e3f1d';
      pctx.fillRect(sx + 4, sy + 10, 2, 5);
      pctx.fillStyle = '#fbbf24';
      pctx.fillRect(sx + 5, sy + 12, 1, 1);

      // Window with colored wooden shutters & geranium flowerbox
      pctx.fillStyle = pal.shutter;
      pctx.fillRect(sx + 9, sy + 9, 1, 4);
      pctx.fillRect(sx + 14, sy + 9, 1, 4);
      pctx.fillStyle = '#2b1d12';
      pctx.fillRect(sx + 10, sy + 9, 4, 4);
      pctx.fillStyle = h % 5 === 0 ? '#fde047' : '#f59e0b';
      pctx.fillRect(sx + 11, sy + 10, 2, 2);
      pctx.fillStyle = '#166534';
      pctx.fillRect(sx + 10, sy + 13, 4, 1);
      pctx.fillStyle = '#ef4444';
      pctx.fillRect(sx + 11, sy + 12, 2, 1);
    } else {
      const winGlow = h % 4 === 0 ? '#fef08a' : '#fbbf24';
      pctx.fillStyle = pal.shutter;
      pctx.fillRect(sx + 1, sy + 9, 1, 4);
      pctx.fillRect(sx + 6, sy + 9, 1, 4);
      pctx.fillRect(sx + 9, sy + 9, 1, 4);
      pctx.fillRect(sx + 14, sy + 9, 1, 4);
      pctx.fillStyle = '#2b1d12';
      pctx.fillRect(sx + 2, sy + 9, 4, 4);
      pctx.fillRect(sx + 10, sy + 9, 4, 4);
      pctx.fillStyle = winGlow;
      pctx.fillRect(sx + 3, sy + 10, 2, 2);
      pctx.fillRect(sx + 11, sy + 10, 2, 2);
    }

    if (!nB && !rawNB && h % 3 === 0) {
      pctx.fillStyle = '#451a03';
      pctx.fillRect(sx + 11, sy + topLift - 3, 3, 4);
      pctx.fillStyle = '#9a3412';
      pctx.fillRect(sx + 11, sy + topLift - 2, 2, 3);
      const smokeStep = (envTick + wx) % 4;
      pctx.fillStyle = 'rgba(255, 251, 235, 0.75)';
      pctx.fillRect(sx + 12 + (smokeStep >> 1), sy + topLift - 5 - smokeStep, 2, 2);
    }
  } else {
    pctx.fillStyle = pal.roofMid;
    pctx.fillRect(sx, sy + topLift, 16, 16 - topLift);
    for (let ry = sy + topLift + 2; ry < sy + 16; ry += 3) {
      pctx.fillStyle = pal.roofLight;
      for (let rx = (ry & 1) * 2; rx < 15; rx += 4) {
        pctx.fillRect(sx + rx, ry, 3, 1);
      }
      pctx.fillStyle = pal.roofShadow;
      pctx.fillRect(sx, ry + 1, 16, 1);
    }
    if (!nB) {
      pctx.fillStyle = pal.outline;
      pctx.fillRect(sx, sy + topLift, 16, 1);
      pctx.fillStyle = pal.roofRidge;
      pctx.fillRect(sx + 1, sy + topLift + 1, 14, 1);
    }
    if (h % 6 === 0) {
      pctx.fillStyle = pal.outline;
      pctx.fillRect(sx + 6, sy + 6, 4, 5);
      pctx.fillStyle = pal.roofRidge;
      pctx.fillRect(sx + 6, sy + 5, 4, 1);
      pctx.fillStyle = '#fde047';
      pctx.fillRect(sx + 7, sy + 7, 2, 3);
    }
  }

  if (!sameW) {
    pctx.fillStyle = pal.outline;
    pctx.fillRect(sx, sy + topLift, 1, 16 - topLift);
  }
  if (!sameE) {
    pctx.fillStyle = pal.outline;
    pctx.fillRect(sx + 15, sy + topLift, 1, 16 - topLift);
  }
}

/**
 * Renders Connected-Tile Orthogonal 16-Bit Bridges, Footbridges & Viaducts (`AXIS_HORIZ` & `AXIS_VERT`)
 * in an upper pass over continuous animated T_WATER. Suppresses internal parapets and water gaps
 * across multi-tile bridge widths so wide urban bridges fuse into one cohesive architectural span!
 */
function draw16BitOrthoBridgeTile(
  pctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  sx: number,
  sy: number,
  mode: number,
  isHoriz: boolean,
  bN: boolean,
  bS: boolean,
  bW: boolean,
  bE: boolean,
  landN: boolean,
  landS: boolean,
  landW: boolean,
  landE: boolean
) {
  const isFoot = mode === B_FOOTBRIDGE;
  const isRail = mode === B_RAIL_VIADUCT;

  if (isHoriz) {
    // HORIZONTAL (EAST-WEST) SPAN OVER NORTH-SOUTH RIVER
    const openN = !bN;
    const openS = !bS;

    if (isFoot) {
      const y0 = openN ? 4 : 0;
      const y1 = openS ? 11 : 15;
      if (openS) {
        pctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
        pctx.fillRect(sx, sy + 12, 16, 2);
      }
      pctx.fillStyle = '#5c3419';
      pctx.fillRect(sx, sy + y0, 16, y1 - y0 + 1);
      const plankTop = openN ? 5 : 0;
      const plankH = (openS ? 10 : 15) - plankTop + 1;
      for (let px = 0; px < 16; px += 4) {
        pctx.fillStyle = ((wx * 16 + px) & 4) === 0 ? '#c88d53' : '#ad733c';
        pctx.fillRect(sx + px, sy + plankTop, 3, plankH);
        pctx.fillStyle = '#d9a46c';
        pctx.fillRect(sx + px, sy + plankTop, 1, plankH);
      }
      if (openN) {
        pctx.fillStyle = '#1e293b';
        pctx.fillRect(sx, sy + 3, 16, 1);
        for (let rx = 1; rx < 16; rx += 5) {
          pctx.fillStyle = '#94a3b8';
          pctx.fillRect(sx + rx, sy + 3, 1, 2);
        }
      }
      if (openS) {
        pctx.fillStyle = '#1e293b';
        pctx.fillRect(sx, sy + 11, 16, 1);
        for (let rx = 1; rx < 16; rx += 5) {
          pctx.fillStyle = '#94a3b8';
          pctx.fillRect(sx + rx, sy + 10, 1, 2);
        }
      }
      return;
    }

    if (isRail) {
      const y0 = openN ? 2 : 0;
      const y1 = openS ? 12 : 15;
      if (openS) {
        pctx.fillStyle = 'rgba(15, 23, 42, 0.48)';
        pctx.fillRect(sx, sy + 13, 16, 3);
        if (!landW && !landE) {
          pctx.fillStyle = '#6e5c44';
          pctx.fillRect(sx + 6, sy + 12, 4, 4);
        }
      }
      pctx.fillStyle = '#334155';
      pctx.fillRect(sx, sy + y0, 16, y1 - y0 + 1);
      if (openN) {
        pctx.fillStyle = '#64748b';
        pctx.fillRect(sx, sy + 2, 16, 2);
      }
      if (openS) {
        pctx.fillStyle = '#64748b';
        pctx.fillRect(sx, sy + 11, 16, 2);
      }
      const tieTop = openN ? 4 : 1;
      const tieH = (openS ? 10 : 14) - tieTop + 1;
      for (let tx = 1; tx < 16; tx += 4) {
        pctx.fillStyle = '#4a2c13';
        pctx.fillRect(sx + tx, sy + tieTop, 2, tieH);
      }
      pctx.fillStyle = '#e2e8f0';
      pctx.fillRect(sx, sy + (openN ? 5 : 4), 16, 1);
      pctx.fillRect(sx, sy + (openS ? 9 : 11), 16, 1);
      return;
    }

    // Majestic Connected French Cut-Stone Arched Road Bridge (Horizontal)
    const deckTop = openN ? 3 : 0;
    const deckBot = openS ? 9 : 15;

    if (openS) {
      pctx.fillStyle = 'rgba(12, 20, 44, 0.44)';
      pctx.fillRect(sx, sy + 13, 16, 3);
      // 3/4-view stone arch spandrel & cutwater pier (pile en bec) on outer South face only
      pctx.fillStyle = '#6e5a42';
      pctx.fillRect(sx, sy + 12, 16, 1);
      if (!landW && !landE) {
        pctx.fillStyle = '#8c7558';
        pctx.fillRect(sx + 6, sy + 12, 4, 3);
        pctx.fillStyle = '#e0f2fe';
        pctx.fillRect(sx + 5, sy + 14, 6, 1);
      }
    }

    // Seamless staggered limestone cobble roadway deck
    pctx.fillStyle = '#d4c19f';
    pctx.fillRect(sx, sy + deckTop, 16, deckBot - deckTop + 1);
    for (let cy = deckTop; cy <= deckBot - 1; cy += 3) {
      const rowIdx = Math.floor((wy * 16 + cy) / 3);
      const shift = (rowIdx & 1) * 3;
      pctx.fillStyle = '#b59d79';
      if (cy + 2 <= deckBot) {
        pctx.fillRect(sx, sy + cy + 2, 16, 1);
      }
      for (let cx = 0; cx < 16; cx += 6) {
        const bx = (cx + shift) & 15;
        const bw = Math.min(4, 16 - bx);
        pctx.fillStyle = ((rowIdx + cx) & 1) === 0 ? '#eadbc2' : '#dfd0b4';
        pctx.fillRect(sx + bx, sy + cy, bw, Math.min(2, deckBot - cy + 1));
      }
    }

    // Outer North & South sculpted stone parapets (never drawn across interior lanes!)
    if (openN) {
      pctx.fillStyle = '#3b2b1d';
      pctx.fillRect(sx, sy + 1, 16, 2);
      pctx.fillStyle = '#fbf6ea';
      for (let bx = 0; bx < 16; bx += 4) {
        pctx.fillRect(sx + bx, sy + 2, 3, 1);
      }
    }
    if (openS) {
      pctx.fillStyle = '#3b2b1d';
      pctx.fillRect(sx, sy + 10, 16, 2);
      pctx.fillStyle = '#efe2c6';
      for (let bx = 0; bx < 16; bx += 4) {
        pctx.fillRect(sx + bx, sy + 10, 3, 1);
      }
    }

    // Sculpted bank abutment pilasters (dés de culée) ONLY on outer parapets so roadway flows freely
    if (landW) {
      if (openN) {
        pctx.fillStyle = '#3b2b1d';
        pctx.fillRect(sx, sy, 3, 3);
        pctx.fillStyle = '#fbf6ea';
        pctx.fillRect(sx, sy + 1, 2, 2);
      }
      if (openS) {
        pctx.fillStyle = '#3b2b1d';
        pctx.fillRect(sx, sy + 10, 3, 3);
        pctx.fillStyle = '#f5ebd6';
        pctx.fillRect(sx, sy + 10, 2, 2);
      }
    }
    if (landE) {
      if (openN) {
        pctx.fillStyle = '#3b2b1d';
        pctx.fillRect(sx + 13, sy, 3, 3);
        pctx.fillStyle = '#fbf6ea';
        pctx.fillRect(sx + 14, sy + 1, 2, 2);
      }
      if (openS) {
        pctx.fillStyle = '#3b2b1d';
        pctx.fillRect(sx + 13, sy + 10, 3, 3);
        pctx.fillStyle = '#f5ebd6';
        pctx.fillRect(sx + 14, sy + 10, 2, 2);
      }
    }
    return;
  }

  // VERTICAL (NORTH-SOUTH) SPAN OVER EAST-WEST RIVER
  const openW = !bW;
  const openE = !bE;

  if (isFoot) {
    const x0 = openW ? 4 : 0;
    const x1 = openE ? 11 : 15;
    if (openE) {
      pctx.fillStyle = 'rgba(15, 23, 42, 0.38)';
      pctx.fillRect(sx + 12, sy, 2, 16);
    }
    pctx.fillStyle = '#5c3419';
    pctx.fillRect(sx + x0, sy, x1 - x0 + 1, 16);
    const plankLeft = openW ? 5 : 0;
    const plankW = (openE ? 10 : 15) - plankLeft + 1;
    for (let py = 0; py < 16; py += 4) {
      pctx.fillStyle = ((wy * 16 + py) & 4) === 0 ? '#c88d53' : '#ad733c';
      pctx.fillRect(sx + plankLeft, sy + py, plankW, 3);
      pctx.fillStyle = '#d9a46c';
      pctx.fillRect(sx + plankLeft, sy + py, plankW, 1);
    }
    if (openW) {
      pctx.fillStyle = '#1e293b';
      pctx.fillRect(sx + 3, sy, 1, 16);
      for (let ry = 1; ry < 16; ry += 5) {
        pctx.fillStyle = '#94a3b8';
        pctx.fillRect(sx + 3, sy + ry, 2, 1);
      }
    }
    if (openE) {
      pctx.fillStyle = '#1e293b';
      pctx.fillRect(sx + 12, sy, 1, 16);
      for (let ry = 1; ry < 16; ry += 5) {
        pctx.fillStyle = '#94a3b8';
        pctx.fillRect(sx + 11, sy + ry, 2, 1);
      }
    }
    return;
  }

  if (isRail) {
    const x0 = openW ? 2 : 0;
    const x1 = openE ? 12 : 15;
    if (openE) {
      pctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
      pctx.fillRect(sx + 13, sy, 3, 16);
    }
    pctx.fillStyle = '#334155';
    pctx.fillRect(sx + x0, sy, x1 - x0 + 1, 16);
    if (openW) {
      pctx.fillStyle = '#64748b';
      pctx.fillRect(sx + 2, sy, 2, 16);
    }
    if (openE) {
      pctx.fillStyle = '#64748b';
      pctx.fillRect(sx + 11, sy, 2, 16);
    }
    const tieLeft = openW ? 4 : 1;
    const tieW = (openE ? 10 : 14) - tieLeft + 1;
    for (let ty = 1; ty < 16; ty += 4) {
      pctx.fillStyle = '#4a2c13';
      pctx.fillRect(sx + tieLeft, sy + ty, tieW, 2);
    }
    pctx.fillStyle = '#e2e8f0';
    pctx.fillRect(sx + (openW ? 5 : 4), sy, 1, 16);
    pctx.fillRect(sx + (openE ? 9 : 11), sy, 1, 16);
    return;
  }

  // Majestic Connected French Cut-Stone Arched Road Bridge (Vertical)
  const deckLeft = openW ? 3 : 0;
  const deckRight = openE ? 11 : 15;

  if (openE) {
    pctx.fillStyle = 'rgba(12, 20, 44, 0.42)';
    pctx.fillRect(sx + 14, sy, 2, 16);
  }

  // Seamless staggered limestone cobble roadway deck
  pctx.fillStyle = '#d4c19f';
  pctx.fillRect(sx + deckLeft, sy, deckRight - deckLeft + 1, 16);
  for (let cy = 0; cy < 16; cy += 4) {
    const rowIdx = Math.floor((wy * 16 + cy) / 4);
    const shift = (rowIdx & 1) * 3;
    pctx.fillStyle = '#b59d79';
    if (cy + 3 < 16) {
      pctx.fillRect(sx + deckLeft, sy + cy + 3, deckRight - deckLeft + 1, 1);
    }
    for (let cx = deckLeft; cx <= deckRight; cx += 5) {
      const bw = Math.min(4, deckRight - cx + 1);
      const bxShift = Math.min(deckRight - bw + 1, cx + (shift & 1));
      pctx.fillStyle = ((rowIdx + cx) & 1) === 0 ? '#eadbc2' : '#dfd0b4';
      pctx.fillRect(sx + bxShift, sy + cy, bw, 3);
    }
  }

  // Outer West & East cut-stone parapets only
  if (openW) {
    pctx.fillStyle = '#3b2b1d';
    pctx.fillRect(sx + 1, sy, 2, 16);
    pctx.fillStyle = '#fbf6ea';
    for (let by = 0; by < 16; by += 4) {
      pctx.fillRect(sx + 2, sy + by, 1, 3);
    }
  }
  if (openE) {
    pctx.fillStyle = '#3b2b1d';
    pctx.fillRect(sx + 12, sy, 2, 16);
    pctx.fillStyle = '#efe2c6';
    for (let by = 0; by < 16; by += 4) {
      pctx.fillRect(sx + 12, sy + by, 1, 3);
    }
  }

  // Sculpted bank entry pilasters ONLY on outer parapets (never barring the roadway!)
  if (landN) {
    if (openW) {
      pctx.fillStyle = '#3b2b1d';
      pctx.fillRect(sx, sy, 3, 3);
      pctx.fillStyle = '#fbf6ea';
      pctx.fillRect(sx + 1, sy, 2, 2);
    }
    if (openE) {
      pctx.fillStyle = '#3b2b1d';
      pctx.fillRect(sx + 12, sy, 3, 3);
      pctx.fillStyle = '#f5ebd6';
      pctx.fillRect(sx + 12, sy, 2, 2);
    }
  }
  if (landS) {
    if (openW) {
      pctx.fillStyle = '#3b2b1d';
      pctx.fillRect(sx, sy + 13, 3, 3);
      pctx.fillStyle = '#fbf6ea';
      pctx.fillRect(sx + 1, sy + 14, 2, 2);
    }
    if (openE) {
      pctx.fillStyle = '#3b2b1d';
      pctx.fillRect(sx + 12, sy + 13, 3, 3);
      pctx.fillStyle = '#f5ebd6';
      pctx.fillRect(sx + 12, sy + 14, 2, 2);
    }
  }
}

interface DiagonalBridgeCell {
  wx: number;
  wy: number;
  sx: number;
  sy: number;
  mode: number;
  isNESW: boolean;
  rDeck: number;
  rParapet: number;
  dMin: number;
  dMax: number;
  abutStart: boolean;
  abutEnd: boolean;
}

/**
 * 3-Pass Continuous World-Space Diagonal Bridge Renderer (`AXIS_DIAG_NESW` '/' & `AXIS_DIAG_NWSE` '\'):
 * 1) Casts 3/4-view arch spandrels & water shadow onto open river water only.
 * 2) Stamps sculpted stone parapets / wrought-iron handrails across tile boundaries (zero sawtooth clipping).
 * 3) Stamps seamless world-locked masonry / oak plank / rail decking ON TOP of internal parapets,
 *    fusing multi-lane & supercover strips with zero 4x4 water holes and zero internal dividing walls!
 */
function render16BitDiagonalBridgePass(
  pctx: CanvasRenderingContext2D,
  cells: DiagonalBridgeCell[],
  vw: number,
  vh: number,
  getTileAt: (wx: number, wy: number) => number
) {
  if (cells.length === 0) return;

  const canPaintAtWorldPx = (
    twx: number,
    twy: number,
    inX: number,
    inY: number,
    allowRoadAbutment: boolean
  ): boolean => {
    const tPx = getTileAt(twx, twy);
    if (tPx === T_WATER || tPx === T_PIER) return true;
    if (!allowRoadAbutment) return false;
    if (!isRoadLike(tPx) && tPx !== T_PLAZA) return false;

    // Allow a crisp 3px stone threshold overlap onto dry approach roads/paths right at the bank edge
    if (inY <= 2 && isWaterLike(getTileAt(twx, twy - 1))) return true;
    if (inY >= 13 && isWaterLike(getTileAt(twx, twy + 1))) return true;
    if (inX <= 2 && isWaterLike(getTileAt(twx - 1, twy))) return true;
    if (inX >= 13 && isWaterLike(getTileAt(twx + 1, twy))) return true;
    if (inX <= 2 && inY <= 2 && isWaterLike(getTileAt(twx - 1, twy - 1))) return true;
    if (inX >= 13 && inY <= 2 && isWaterLike(getTileAt(twx + 1, twy - 1))) return true;
    if (inX <= 2 && inY >= 13 && isWaterLike(getTileAt(twx - 1, twy + 1))) return true;
    if (inX >= 13 && inY >= 13 && isWaterLike(getTileAt(twx + 1, twy + 1))) return true;
    return false;
  };

  // MICRO-PASS 1: 3/4-View Downstream Water Shadow & Cutwater Arch Hint
  for (const c of cells) {
    const sMin = c.rDeck;
    const sMax = c.rParapet + (c.mode === B_FOOTBRIDGE ? 2 : 4);
    const pyMin = -10;
    const pyMax = 26;

    for (let py = pyMin; py <= pyMax; py++) {
      const screenY = c.sy + py;
      if (screenY < 0 || screenY >= vh) continue;

      const pxStart = c.isNESW
        ? Math.max(15 - py + sMin, py + c.dMin)
        : Math.max(py - sMax, 15 - py + c.dMin);
      const pxEnd = c.isNESW
        ? Math.min(15 - py + sMax, py + c.dMax)
        : Math.min(py - sMin, 15 - py + c.dMax);
      if (pxStart > pxEnd) continue;

      const twy = c.wy + Math.floor(py / 16);
      const inY = ((py % 16) + 16) % 16;

      for (let px = pxStart; px <= pxEnd; px++) {
        const screenX = c.sx + px;
        if (screenX < 0 || screenX >= vw) continue;
        const twx = c.wx + Math.floor(px / 16);
        const inX = ((px % 16) + 16) % 16;
        if (!canPaintAtWorldPx(twx, twy, inX, inY, false)) continue;

        const s = c.isNESW ? px + py - 15 : py - px;
        const texX = ((c.wx & 255) << 4) + px;
        const texY = ((c.wy & 255) << 4) + py;
        const gV = c.isNESW ? texX - texY : texX + texY;

        if (c.mode !== B_FOOTBRIDGE && s <= c.rParapet + 2) {
          // Dressed stone arch spandrel & cutwater pier in river
          const isPier = (gV & 31) >= 12 && (gV & 31) <= 18;
          if (s === c.rParapet + 2 && isPier) {
            pctx.fillStyle = '#bae6fd';
          } else {
            pctx.fillStyle = isPier ? '#8c7558' : '#63503a';
          }
          pctx.fillRect(screenX, screenY, 1, 1);
        } else {
          pctx.fillStyle = 'rgba(12, 20, 44, 0.38)';
          pctx.fillRect(screenX, screenY, 1, 1);
        }
      }
    }
  }

  // MICRO-PASS 2: Outer Stone Parapets / Wrought-Iron Handrails / Steel Flanges
  for (const c of cells) {
    const sMin = -c.rParapet;
    const sMax = c.rParapet;
    const pyMin = -11;
    const pyMax = 26;

    for (let py = pyMin; py <= pyMax; py++) {
      const screenY = c.sy + py;
      if (screenY < 0 || screenY >= vh) continue;

      const pxStart = c.isNESW
        ? Math.max(15 - py + sMin, py + c.dMin)
        : Math.max(py - sMax, 15 - py + c.dMin);
      const pxEnd = c.isNESW
        ? Math.min(15 - py + sMax, py + c.dMax)
        : Math.min(py - sMin, 15 - py + c.dMax);
      if (pxStart > pxEnd) continue;

      const twy = c.wy + Math.floor(py / 16);
      const inY = ((py % 16) + 16) % 16;

      for (let px = pxStart; px <= pxEnd; px++) {
        const screenX = c.sx + px;
        if (screenX < 0 || screenX >= vw) continue;
        const twx = c.wx + Math.floor(px / 16);
        const inX = ((px % 16) + 16) % 16;
        if (!canPaintAtWorldPx(twx, twy, inX, inY, true)) continue;

        const s = c.isNESW ? px + py - 15 : py - px;
        if (Math.abs(s) <= c.rDeck) continue; // Interior painted in Micro-Pass 3

        const d = c.isNESW ? px - py : px + py - 15;
        const texX = ((c.wx & 255) << 4) + px;
        const texY = ((c.wy & 255) << 4) + py;
        const gV = c.isNESW ? texX - texY : texX + texY;
        const isOuterEdge = Math.abs(s) === c.rParapet;
        const isAbutPilaster =
          c.mode === B_ROAD &&
          ((c.abutStart && d <= c.dMin + 5) || (c.abutEnd && d >= c.dMax - 5));

        if (c.mode === B_FOOTBRIDGE) {
          if (isOuterEdge) {
            pctx.fillStyle = (gV & 7) === 0 ? '#cbd5e1' : '#1e293b';
          } else {
            pctx.fillStyle = (gV & 7) === 0 ? '#94a3b8' : '#3b2313';
          }
        } else if (c.mode === B_RAIL_VIADUCT) {
          pctx.fillStyle = isOuterEdge
            ? '#1e293b'
            : (gV & 3) === 0
            ? '#94a3b8'
            : '#64748b';
        } else {
          // Chiseled 16-bit French cut-stone balustrade + coping blocks + bank pilasters
          if (isOuterEdge) {
            pctx.fillStyle = '#2b1d12';
          } else if (isAbutPilaster) {
            pctx.fillStyle = '#ffffff';
          } else if (s < 0) {
            pctx.fillStyle = (gV & 7) === 0 ? '#cbb694' : '#fbf6ea';
          } else {
            pctx.fillStyle = (gV & 7) === 0 ? '#a89274' : '#efe2c6';
          }
        }
        pctx.fillRect(screenX, screenY, 1, 1);
      }
    }
  }

  // MICRO-PASS 3: Seamless World-Locked Interior Bridge Deck (Erases all internal parapets & gaps!)
  for (const c of cells) {
    const sMin = -c.rDeck;
    const sMax = c.rDeck;
    const pyMin = -9;
    const pyMax = 24;

    for (let py = pyMin; py <= pyMax; py++) {
      const screenY = c.sy + py;
      if (screenY < 0 || screenY >= vh) continue;

      const pxStart = c.isNESW
        ? Math.max(15 - py + sMin, py + c.dMin)
        : Math.max(py - sMax, 15 - py + c.dMin);
      const pxEnd = c.isNESW
        ? Math.min(15 - py + sMax, py + c.dMax)
        : Math.min(py - sMin, 15 - py + c.dMax);
      if (pxStart > pxEnd) continue;

      const twy = c.wy + Math.floor(py / 16);
      const inY = ((py % 16) + 16) % 16;

      for (let px = pxStart; px <= pxEnd; px++) {
        const screenX = c.sx + px;
        if (screenX < 0 || screenX >= vw) continue;
        const twx = c.wx + Math.floor(px / 16);
        const inX = ((px % 16) + 16) % 16;
        if (!canPaintAtWorldPx(twx, twy, inX, inY, true)) continue;

        const texX = ((c.wx & 255) << 4) + px;
        const texY = ((c.wy & 255) << 4) + py;
        const gU = c.isNESW ? texX + texY : texY - texX;
        const gV = c.isNESW ? texX - texY : texX + texY;

        if (c.mode === B_FOOTBRIDGE) {
          // Transverse weathered oak planks oriented strictly perpendicular to the diagonal span
          const plankStep = gV & 3;
          if (plankStep === 0) {
            pctx.fillStyle = '#5c3419';
          } else if (plankStep === 1) {
            pctx.fillStyle = '#d9a46c';
          } else {
            pctx.fillStyle = ((gV >> 2) & 1) === 0 ? '#be844c' : '#a8703b';
          }
        } else if (c.mode === B_RAIL_VIADUCT) {
          // Crushed granite ballast, oak sleepers & twin gleaming steel rails
          const sLocal = c.isNESW ? px + py - 15 : py - px;
          const isRailLine = Math.abs(sLocal + 3) === 0 || Math.abs(sLocal - 3) === 0;
          if (isRailLine) {
            pctx.fillStyle = '#e2e8f0';
          } else if ((gV & 5) < 2) {
            pctx.fillStyle = '#4a2c13';
          } else {
            pctx.fillStyle = ((texX ^ texY) & 1) === 0 ? '#57534e' : '#475569';
          }
        } else {
          // World-locked 45° staggered French ashlar / limestone cobblestone courses
          const course = gU >> 2;
          const stagger = (course & 1) * 4;
          const vShift = gV + stagger;
          const isCourseSeam = (gU & 3) === 0 && (vShift & 1) === 0;
          const isBlockJoint = (vShift & 7) === 0 && (gU & 3) !== 2;

          if (isCourseSeam || isBlockJoint) {
            pctx.fillStyle = '#b39a76';
          } else {
            const blockTone = ((course * 37) ^ ((vShift >> 3) * 19)) & 3;
            if (blockTone === 0) {
              pctx.fillStyle = '#ece0c8';
            } else if (blockTone === 1) {
              pctx.fillStyle = '#e2d3b7';
            } else if (blockTone === 2) {
              pctx.fillStyle = '#d6c4a4';
            } else {
              pctx.fillStyle = (gU & 3) === 1 ? '#f7efe0' : '#e6d8be';
            }
          }
        }
        pctx.fillRect(screenX, screenY, 1, 1);
      }
    }
  }
}

/**
 * Oriented 16-Bit Railway Renderer (N-S, E-W, Curves, Diagonals & Level Crossings!)
 */
function draw16BitOrientedRail(
  pctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  rN: boolean,
  rS: boolean,
  rW: boolean,
  rE: boolean,
  rNW: boolean,
  rNE: boolean,
  rSW: boolean,
  rSE: boolean,
  onRoad: boolean
) {
  const cardCount = (rN ? 1 : 0) + (rS ? 1 : 0) + (rW ? 1 : 0) + (rE ? 1 : 0);

  if (onRoad) {
    // 16-Bit Planked Level Crossing (Passage à niveau) over street/avenue!
    const horiz = (rW || rE) && !rN && !rS;
    if (horiz) {
      pctx.fillStyle = '#4a2e16';
      pctx.fillRect(sx, sy + 3, 16, 10);
      pctx.fillStyle = '#9a6b3e';
      pctx.fillRect(sx, sy + 4, 16, 8);
      pctx.fillStyle = '#cbd5e1';
      pctx.fillRect(sx, sy + 5, 16, 1);
      pctx.fillRect(sx, sy + 10, 16, 1);
      pctx.fillStyle = '#334155';
      pctx.fillRect(sx, sy + 6, 16, 1);
      pctx.fillRect(sx, sy + 11, 16, 1);
    } else {
      pctx.fillStyle = '#4a2e16';
      pctx.fillRect(sx + 3, sy, 10, 16);
      pctx.fillStyle = '#9a6b3e';
      pctx.fillRect(sx + 4, sy, 8, 16);
      pctx.fillStyle = '#cbd5e1';
      pctx.fillRect(sx + 5, sy, 1, 16);
      pctx.fillRect(sx + 10, sy, 1, 16);
      pctx.fillStyle = '#334155';
      pctx.fillRect(sx + 6, sy, 1, 16);
      pctx.fillRect(sx + 11, sy, 1, 16);
    }
    // Tiny red & white St. Andrew's cross signal post at upper-left corner!
    pctx.fillStyle = '#1e293b';
    pctx.fillRect(sx + 1, sy + 1, 1, 5);
    pctx.fillStyle = '#ffffff';
    pctx.fillRect(sx, sy, 3, 3);
    pctx.fillStyle = '#ef4444';
    pctx.fillRect(sx, sy, 1, 1);
    pctx.fillRect(sx + 2, sy, 1, 1);
    pctx.fillRect(sx + 1, sy + 1, 1, 1);
    pctx.fillRect(sx, sy + 2, 1, 1);
    pctx.fillRect(sx + 2, sy + 2, 1, 1);
    return;
  }

  // Pure East-West Railway
  if ((rW || rE) && !rN && !rS) {
    pctx.fillStyle = '#57534e';
    pctx.fillRect(sx, sy + 2, 16, 12);
    pctx.fillStyle = '#78716c';
    pctx.fillRect(sx, sy + 3, 16, 10);
    for (let rx = 1; rx < 16; rx += 4) {
      pctx.fillStyle = '#3b1f0e';
      pctx.fillRect(sx + rx, sy + 2, 2, 12);
      pctx.fillStyle = '#6e3f1d';
      pctx.fillRect(sx + rx, sy + 3, 1, 10);
    }
    pctx.fillStyle = '#475569';
    pctx.fillRect(sx, sy + 4, 16, 2);
    pctx.fillRect(sx, sy + 10, 16, 2);
    pctx.fillStyle = '#e2e8f0';
    pctx.fillRect(sx, sy + 4, 16, 1);
    pctx.fillRect(sx, sy + 10, 16, 1);
    return;
  }

  // Pure North-South Railway
  if ((rN || rS) && !rW && !rE) {
    pctx.fillStyle = '#57534e';
    pctx.fillRect(sx + 2, sy, 12, 16);
    pctx.fillStyle = '#78716c';
    pctx.fillRect(sx + 3, sy, 10, 16);
    for (let ry = 1; ry < 16; ry += 4) {
      pctx.fillStyle = '#3b1f0e';
      pctx.fillRect(sx + 2, sy + ry, 12, 2);
      pctx.fillStyle = '#6e3f1d';
      pctx.fillRect(sx + 3, sy + ry, 10, 1);
    }
    pctx.fillStyle = '#475569';
    pctx.fillRect(sx + 4, sy, 2, 16);
    pctx.fillRect(sx + 10, sy, 2, 16);
    pctx.fillStyle = '#e2e8f0';
    pctx.fillRect(sx + 4, sy, 1, 16);
    pctx.fillRect(sx + 10, sy, 1, 16);
    return;
  }

  // Curved / Elbow / Junction Railway (connects active N/S/W/E arms smoothly!)
  if (cardCount >= 2) {
    pctx.fillStyle = '#6b655f';
    pctx.fillRect(sx + 3, sy + 3, 10, 10);
    if (rN) pctx.fillRect(sx + 3, sy, 10, 6);
    if (rS) pctx.fillRect(sx + 3, sy + 10, 10, 6);
    if (rW) pctx.fillRect(sx, sy + 3, 6, 10);
    if (rE) pctx.fillRect(sx + 10, sy + 3, 6, 10);

    // Center sleeper cross-ties
    pctx.fillStyle = '#4a2a14';
    pctx.fillRect(sx + 4, sy + 7, 8, 2);
    pctx.fillRect(sx + 7, sy + 4, 2, 8);

    // Curved steel rail connections
    pctx.fillStyle = '#e2e8f0';
    if (rN) {
      pctx.fillRect(sx + 4, sy, 1, 6);
      pctx.fillRect(sx + 10, sy, 1, 6);
    }
    if (rS) {
      pctx.fillRect(sx + 4, sy + 10, 1, 6);
      pctx.fillRect(sx + 10, sy + 10, 1, 6);
    }
    if (rW) {
      pctx.fillRect(sx, sy + 4, 6, 1);
      pctx.fillRect(sx, sy + 10, 6, 1);
    }
    if (rE) {
      pctx.fillRect(sx + 10, sy + 4, 6, 1);
      pctx.fillRect(sx + 10, sy + 10, 6, 1);
    }
    // Smooth inner & outer curve arcs
    pctx.fillRect(sx + 5, sy + 5, 6, 1);
    pctx.fillRect(sx + 5, sy + 10, 6, 1);
    pctx.fillRect(sx + 5, sy + 5, 1, 6);
    pctx.fillRect(sx + 10, sy + 5, 1, 6);
    return;
  }

  // Diagonal fallback (if isolated diagonal step)
  const diagNESW = (rNE || rSW) && !rNW && !rSE;
  for (let i = 0; i < 16; i++) {
    const cx = diagNESW ? 15 - i : i;
    pctx.fillStyle = '#6b655f';
    pctx.fillRect(sx + Math.max(0, cx - 3), sy + i, 7, 1);
    if (i % 3 === 0) {
      pctx.fillStyle = '#3b1f0e';
      pctx.fillRect(sx + Math.max(0, cx - 2), sy + i, 5, 1);
    }
    pctx.fillStyle = '#e2e8f0';
    pctx.fillRect(sx + Math.max(0, cx - 2), sy + i, 1, 1);
    pctx.fillRect(sx + Math.min(15, cx + 2), sy + i, 1, 1);
  }
}

/**
 * Bespoke 16-Bit JRPG Architectural Set-Pieces ("Monuments Unifiés")
 * Replaces generic cottage roof clusters with iconic French & JRPG landmarks!
 */
function draw16BitLandmarkSetPiece(
  pctx: CanvasRenderingContext2D,
  kind: LandmarkStyle,
  sx: number,
  sy: number,
  envTick: number
) {
  if (kind === 'fountain') {
    // 16x16 Monumental Tiered Limestone Fountain with Animated Sparkling Plumes!
    pctx.fillStyle = 'rgba(18, 12, 8, 0.35)';
    pctx.fillRect(sx + 1, sy + 13, 14, 3);
    // Octagonal stone basin
    pctx.fillStyle = '#2b1d12';
    pctx.fillRect(sx + 1, sy + 7, 14, 8);
    pctx.fillStyle = '#efe4ce';
    pctx.fillRect(sx + 2, sy + 8, 12, 6);
    // Azure water pool
    pctx.fillStyle = '#0284c7';
    pctx.fillRect(sx + 3, sy + 9, 10, 4);
    pctx.fillStyle = '#7dd3fc';
    pctx.fillRect(sx + 4, sy + 10, 8, 2);
    // Central carved pedestal + golden finial
    pctx.fillStyle = '#d6c3a3';
    pctx.fillRect(sx + 6, sy + 3, 4, 8);
    pctx.fillStyle = '#fde047';
    pctx.fillRect(sx + 7, sy + 1, 2, 2);
    // Animated water arcs!
    const splash = envTick % 2;
    pctx.fillStyle = '#e0f2fe';
    pctx.fillRect(sx + 4 - splash, sy + 4 + splash, 2, 4);
    pctx.fillRect(sx + 10 + splash, sy + 4 + splash, 2, 4);
    pctx.fillStyle = '#ffffff';
    pctx.fillRect(sx + 6, sy + 2, 4, 2);
    return;
  }

  if (kind === 'tower') {
    // 16x28 Medieval Stone Watchtower / Belfry / Historic Mill rising heroically!
    pctx.fillStyle = 'rgba(18, 12, 8, 0.38)';
    pctx.fillRect(sx + 2, sy + 14, 14, 3);
    pctx.fillStyle = '#1e140c';
    pctx.fillRect(sx + 2, sy - 9, 12, 24);
    // Tapered dressed-stone shaft
    pctx.fillStyle = '#d6c3a3';
    pctx.fillRect(sx + 3, sy - 5, 10, 19);
    pctx.fillStyle = '#f5ebd6';
    pctx.fillRect(sx + 3, sy - 5, 4, 18); // NW sun highlight
    pctx.fillStyle = '#9c8669';
    pctx.fillRect(sx + 10, sy - 5, 3, 18); // SE shade
    // Conical slate spire / crenelated crown
    pctx.fillStyle = '#334155';
    pctx.fillRect(sx + 2, sy - 8, 12, 4);
    pctx.fillRect(sx + 4, sy - 11, 8, 3);
    pctx.fillRect(sx + 6, sy - 14, 4, 3);
    pctx.fillStyle = '#fde047';
    pctx.fillRect(sx + 7, sy - 16, 2, 2);
    // Arrow slits & arched oak door
    pctx.fillStyle = '#291a0d';
    pctx.fillRect(sx + 7, sy - 1, 2, 4);
    pctx.fillRect(sx + 6, sy + 9, 4, 5);
    pctx.fillStyle = '#fef08a';
    pctx.fillRect(sx + 7, sy, 1, 2);
    return;
  }

  // Remaining Set-Pieces occupy a 2x2 tile footprint (32x32 base, sx..sx+32, sy..sy+32)!
  pctx.fillStyle = 'rgba(18, 12, 8, 0.38)';
  pctx.fillRect(sx + 2, sy + 30, 30, 4);

  if (kind === 'church') {
    // 32x38 16-Bit Cathedral / Church (Soaring Belltower, Slate Nave, Stained-Glass Rose Window!)
    // Nave body
    pctx.fillStyle = '#1a120b';
    pctx.fillRect(sx + 2, sy + 4, 28, 27);
    // Pitched slate-blue cathedral roof
    pctx.fillStyle = '#334155';
    pctx.fillRect(sx + 3, sy + 5, 26, 11);
    pctx.fillStyle = '#64748b';
    pctx.fillRect(sx + 4, sy + 6, 24, 5);
    pctx.fillStyle = '#cbd5e1';
    pctx.fillRect(sx + 4, sy + 5, 24, 1);
    // Limestone facade & flying buttresses
    pctx.fillStyle = '#f5ebd6';
    pctx.fillRect(sx + 3, sy + 16, 26, 14);
    pctx.fillStyle = '#cbb694';
    pctx.fillRect(sx + 3, sy + 16, 3, 14);
    pctx.fillRect(sx + 26, sy + 16, 3, 14);
    // Soaring central belltower & spire (rising to sy - 8!)
    pctx.fillStyle = '#1a120b';
    pctx.fillRect(sx + 10, sy - 5, 12, 24);
    pctx.fillStyle = '#efe2c6';
    pctx.fillRect(sx + 11, sy + 2, 10, 17);
    pctx.fillStyle = '#334155';
    pctx.fillRect(sx + 11, sy - 4, 10, 6);
    pctx.fillRect(sx + 13, sy - 8, 6, 4);
    pctx.fillRect(sx + 15, sy - 11, 2, 3);
    // Gleaming golden cross atop spire
    pctx.fillStyle = '#fde047';
    pctx.fillRect(sx + 15, sy - 14, 2, 4);
    pctx.fillRect(sx + 14, sy - 13, 4, 1);
    // Radiant stained-glass rose window (Rosace gothique!)
    pctx.fillStyle = '#1e1b4b';
    pctx.fillRect(sx + 13, sy + 12, 6, 6);
    pctx.fillStyle = '#f43f5e';
    pctx.fillRect(sx + 14, sy + 13, 2, 2);
    pctx.fillStyle = '#38bdf8';
    pctx.fillRect(sx + 16, sy + 13, 2, 2);
    pctx.fillStyle = '#fde047';
    pctx.fillRect(sx + 15, sy + 15, 2, 2);
    // Side lancet stained-glass windows & grand arched portal
    pctx.fillStyle = '#38bdf8';
    pctx.fillRect(sx + 7, sy + 19, 2, 5);
    pctx.fillRect(sx + 23, sy + 19, 2, 5);
    pctx.fillStyle = '#3b1f0e';
    pctx.fillRect(sx + 13, sy + 22, 6, 8);
    pctx.fillStyle = '#78350f';
    pctx.fillRect(sx + 14, sy + 23, 4, 7);
    return;
  }

  if (kind === 'castle') {
    // 32x36 16-Bit Fortified Château / Medieval Citadel (Twin Turrets, Crenellations & Portcullis!)
    pctx.fillStyle = '#1a120b';
    pctx.fillRect(sx + 1, sy + 2, 30, 29);
    // Curtain wall & central keep
    pctx.fillStyle = '#b8a382';
    pctx.fillRect(sx + 7, sy + 8, 18, 22);
    pctx.fillStyle = '#e7d8be';
    pctx.fillRect(sx + 9, sy + 4, 14, 10);
    // Crenelated battlements along curtain wall
    for (let cx = 8; cx < 24; cx += 4) {
      pctx.fillStyle = '#fbf6ea';
      pctx.fillRect(sx + cx, sy + 3, 2, 3);
    }
    // Left & Right Round Corner Towers with Conical Royal Slate Roofs!
    for (const tx of [2, 22]) {
      pctx.fillStyle = '#d6c3a3';
      pctx.fillRect(sx + tx, sy + 7, 8, 23);
      pctx.fillStyle = '#f5ebd6';
      pctx.fillRect(sx + tx, sy + 7, 3, 22);
      // Conical turret roof
      pctx.fillStyle = '#1e293b';
      pctx.fillRect(sx + tx - 1, sy + 4, 10, 4);
      pctx.fillStyle = '#3b82f6';
      pctx.fillRect(sx + tx + 1, sy + 1, 6, 3);
      pctx.fillRect(sx + tx + 3, sy - 2, 2, 3);
      // Fluttering crimson pennant!
      const wave = envTick % 2;
      pctx.fillStyle = '#ef4444';
      pctx.fillRect(sx + tx + 4, sy - 3, 4, 2 + wave);
    }
    // Arched gatehouse & iron portcullis (herse)
    pctx.fillStyle = '#1c1917';
    pctx.fillRect(sx + 12, sy + 20, 8, 10);
    pctx.fillStyle = '#78716c';
    for (let gx = 13; gx <= 19; gx += 2) {
      pctx.fillRect(sx + gx, sy + 21, 1, 6);
    }
    pctx.fillRect(sx + 12, sy + 23, 8, 1);
    return;
  }

  if (kind === 'station') {
    // 32x34 19th-Century French Train Station (Verrière Métallique & Horloge de Gare!)
    pctx.fillStyle = '#17202e';
    pctx.fillRect(sx + 1, sy + 4, 30, 27);
    // Arched iron-and-glass grand hall roof (Verrière)
    pctx.fillStyle = '#0369a1';
    pctx.fillRect(sx + 3, sy + 5, 26, 9);
    pctx.fillStyle = '#7dd3fc';
    for (let gx = 4; gx < 27; gx += 4) {
      pctx.fillRect(sx + gx, sy + 6, 2, 7);
    }
    // Beaux-Arts limestone facade
    pctx.fillStyle = '#f5ebd6';
    pctx.fillRect(sx + 2, sy + 14, 28, 16);
    pctx.fillStyle = '#d6c3a3';
    pctx.fillRect(sx + 2, sy + 14, 28, 2);
    // Central clock pediment!
    pctx.fillStyle = '#2b1d12';
    pctx.fillRect(sx + 11, sy + 9, 10, 8);
    pctx.fillStyle = '#fbf6ea';
    pctx.fillRect(sx + 12, sy + 10, 8, 6);
    pctx.fillStyle = '#fef08a';
    pctx.fillRect(sx + 14, sy + 11, 4, 4);
    pctx.fillStyle = '#1e293b';
    pctx.fillRect(sx + 15, sy + 12, 2, 2);
    // Triple grand arched glass portals
    for (const ax of [5, 13, 21]) {
      pctx.fillStyle = '#1e293b';
      pctx.fillRect(sx + ax, sy + 20, 6, 10);
      pctx.fillStyle = '#fde68a';
      pctx.fillRect(sx + ax + 1, sy + 21, 4, 5);
    }
    return;
  }

  if (kind === 'arena') {
    // 32x32 Gallo-Roman Amphitheatre / Arena (Arènes de Lutèce / Nîmes / Fourvière!)
    pctx.fillStyle = '#291a0d';
    pctx.fillRect(sx + 3, sy + 3, 26, 26);
    pctx.fillRect(sx + 1, sy + 6, 30, 20);
    // Outer stone tier (gradins)
    pctx.fillStyle = '#d6c3a3';
    pctx.fillRect(sx + 4, sy + 4, 24, 24);
    pctx.fillRect(sx + 2, sy + 7, 28, 18);
    // Stepped inner seating ring
    pctx.fillStyle = '#b89f78';
    pctx.fillRect(sx + 6, sy + 7, 20, 18);
    // Warm golden-ochre central arena sand!
    pctx.fillStyle = '#eab308';
    pctx.fillRect(sx + 9, sy + 10, 14, 12);
    pctx.fillStyle = '#fef08a';
    pctx.fillRect(sx + 10, sy + 11, 11, 9);
    // Southern arched vomitoria arcades
    for (const vx of [6, 12, 18, 24]) {
      pctx.fillStyle = '#3b2614';
      pctx.fillRect(sx + vx, sy + 25, 2, 3);
    }
    return;
  }

  // 'civic' — Neoclassical Monument / Panthéon / Hôtel de Ville / Musée (Dome, Pediment & Colonnade!)
  pctx.fillStyle = '#1a120b';
  pctx.fillRect(sx + 2, sy + 6, 28, 25);
  // Oxidized verdigris/slate cupola dome rising above pediment!
  pctx.fillStyle = '#1e293b';
  pctx.fillRect(sx + 10, sy, 12, 7);
  pctx.fillStyle = '#0d9488';
  pctx.fillRect(sx + 11, sy + 1, 10, 5);
  pctx.fillStyle = '#5eead4';
  pctx.fillRect(sx + 12, sy + 1, 4, 4);
  pctx.fillStyle = '#fde047';
  pctx.fillRect(sx + 15, sy - 3, 2, 3);
  // Triangular classical pediment (Fronton sculpté)
  pctx.fillStyle = '#fbf6ea';
  pctx.fillRect(sx + 3, sy + 9, 26, 3);
  pctx.fillRect(sx + 7, sy + 7, 18, 2);
  pctx.fillRect(sx + 11, sy + 5, 10, 2);
  pctx.fillStyle = '#d6c3a3';
  pctx.fillRect(sx + 9, sy + 9, 14, 2);
  // Colonnade facade + grand steps
  pctx.fillStyle = '#3b2614';
  pctx.fillRect(sx + 4, sy + 13, 24, 13);
  for (let cx = 5; cx <= 25; cx += 4) {
    pctx.fillStyle = '#f5ebd6';
    pctx.fillRect(sx + cx, sy + 13, 2, 13);
  }
  // Monumental stone perron steps
  pctx.fillStyle = '#efe4ce';
  pctx.fillRect(sx + 3, sy + 26, 26, 4);
  pctx.fillStyle = '#cbb694';
  pctx.fillRect(sx + 3, sy + 28, 26, 1);
}

interface EdgeIndicatorHit {
  poi: PoiItem;
  ex: number;
  ey: number;
}

export const PixelMapCanvas: React.FC<PixelMapCanvasProps> = ({
  playerLat,
  playerLng,
  pois,
  surfacePois,
  subterraneanPois = [],
  terrain,
  elevation,
  reliefEnabled,
  unlockedIds,
  selectedPoiId,
  simulationMode,
  isWalking,
  facingDir,
  zoomLevel,
  subtleBuildings,
  categoryFilter,
  stratumFilter,
  subterranean = [],
  bedrock = null,
  subterraneanMode = false,
  onToggleSubterraneanMode,
  immersiveFullscreen = false,
  weather = null,
  timeMode = 'auto',
  fogEnabled = true,
  fogSet,
  fogVisionMeters = 100,
  outfitId = 'arpenteur',
  explorerAppearance,
  chroniqueurThreads = false,
  dashedTracesEnabled = false,
  spectralLanternMeters = 0,
  breadcrumbTrail = [],
  plannedRoute = [],
  routeRequest = null,
  muted = false,
  fillContainer = false,
  uiCollapsed = false,
  onToggleUiCollapsed,
  onToggleFullscreen,
  onChangeZoom,
  onSelectPoi,
  onMapDestinationClick,
  onPlanWalkRoute,
  onPlayerSurfaceChange,
  rumorLeads = [],
  onNpcInteract,
  onAcceptRumor,
  harvestedNodeIds,
  onHarvestSpecimen,
  onOpenNpcPostcard,
}) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldLayerKeyRef = useRef<{ mapRef: unknown; key: string }>({ mapRef: null, key: '' });
  const layerAnchorRef = useRef<{ wx: number; wy: number; initialized: boolean }>({
    wx: 0,
    wy: 0,
    initialized: false,
  });
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const shadeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const vignetteCanvasRef = useRef<{
    canvas: HTMLCanvasElement;
    w: number;
    h: number;
    sub: boolean;
  } | null>(null);
  const topoAnchorRef = useRef<{
    wx: number;
    wy: number;
    tileMeters: number;
    cosRef: number;
    initialized: boolean;
  }>({ wx: 0, wy: 0, tileMeters: 0, cosRef: 0, initialized: false });
  const prevSubModeRef = useRef<boolean>(subterraneanMode);
  const stratumBannerTimerRef = useRef<number | null>(null);
  const edgeHitsRef = useRef<EdgeIndicatorHit[]>([]);
  const rumorEdgeHitsRef = useRef<Array<{ lead: RumorLead; ex: number; ey: number }>>([]);
  const lastWheelAtRef = useRef<number>(0);
  const lastSurfaceRef = useRef<{ surface: SurfaceType; nearWater: boolean }>({
    surface: 'stone',
    nearWater: false,
  });
  const handledRouteReqRef = useRef<number>(0);
  const zoomRef = useRef<ZoomLevel>(zoomLevel);
  zoomRef.current = zoomLevel;

  const [animTick, setAnimTick] = useState(0);
  const [hoveredPoiId, setHoveredPoiId] = useState<string | null>(null);
  const [hoveredNpcId, setHoveredNpcId] = useState<string | null>(null);
  const [hoveredSpecimenId, setHoveredSpecimenId] = useState<string | null>(null);
  const [activeNpcDialogue, setActiveNpcDialogue] = useState<{
    npc: WorldNpc;
    lineIndex: number;
  } | null>(null);
  const [stratumBanner, setStratumBanner] = useState<{ label: string; sub: boolean } | null>(null);
  const [panMeters, setPanMeters] = useState<{ east: number; north: number }>({ east: 0, north: 0 });
  const [isDraggingMap, setIsDraggingMap] = useState(false);

  // Smooth 60fps Visual Position & Camera Glide State (eliminates step teleportation while keeping crisp pixels!)
  const visualStateRef = useRef<{
    lat: number;
    lng: number;
    panEast: number;
    panNorth: number;
    strideAccum: number;
    teleportFade: number;
  }>({
    lat: playerLat,
    lng: playerLng,
    panEast: 0,
    panNorth: 0,
    strideAccum: 0,
    teleportFade: 0,
  });
  const [visualCam, setVisualCam] = useState<{
    lat: number;
    lng: number;
    panEast: number;
    panNorth: number;
    isGliding: boolean;
    strideTick: number;
    teleportFade: number;
  }>({
    lat: playerLat,
    lng: playerLng,
    panEast: 0,
    panNorth: 0,
    isGliding: false,
    strideTick: 0,
    teleportFade: 0,
  });

  // Dynamic Square-Pixel 16-Bit SNES/GBA Resolution (adapts seamlessly to portrait smartphones & 16:9 fullscreen!)
  const [virtualDims, setVirtualDims] = useState<{ vw: number; vh: number }>({ vw: 504, vh: 324 });
  const VW = virtualDims.vw;
  const VH = virtualDims.vh;
  const TILE = 16;
  const SCALE = 2;

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 80 || rect.height < 80) return;
      // Chunky, crisp 16-bit pixel density on smartphones (~1.55 CSS px/vpx) & desktop (~1.75 CSS px/vpx)
      const cssPerVpx = rect.width < 640 ? 1.55 : 1.75;
      const nextVw = Math.max(208, Math.min(736, Math.round(rect.width / cssPerVpx / 2) * 2));
      const nextVh = Math.max(
        180,
        Math.min(736, Math.round((nextVw * (rect.height / rect.width)) / 2) * 2)
      );
      setVirtualDims((prev) =>
        prev.vw === nextVw && prev.vh === nextVh ? prev : { vw: nextVw, vh: nextVh }
      );
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('orientationchange', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', measure);
    };
  }, [immersiveFullscreen, fillContainer, uiCollapsed]);

  // Smoothly recenter pan offset when walking or teleporting
  const prevPlayerRef = useRef<{ lat: number; lng: number }>({ lat: playerLat, lng: playerLng });
  useEffect(() => {
    const jumped = haversineMeters(
      prevPlayerRef.current.lat,
      prevPlayerRef.current.lng,
      playerLat,
      playerLng
    );
    prevPlayerRef.current = { lat: playerLat, lng: playerLng };
    if (isWalking || jumped > 8) {
      setPanMeters((prev) => (prev.east === 0 && prev.north === 0 ? prev : { east: 0, north: 0 }));
    }
  }, [playerLat, playerLng, isWalking]);

  const currentZoomMeta = ZOOM_META[zoomLevel];
  // Preserve exact real-world viewport scale while giving 2.25x finer pixel detail
  const metersPerVirtualPx = currentZoomMeta.metersPerPx / 1.5;
  const tileMeters = TILE * metersPerVirtualPx;

  // Reset overscan tile anchor when zoom scale changes
  useEffect(() => {
    layerAnchorRef.current.initialized = false;
  }, [zoomLevel, VW, VH]);

  // 60fps Continuous Position & Camera Glide Interpolator (runs ONLY while moving or fading — 0% idle CPU!)
  useEffect(() => {
    const state = visualStateRef.current;
    if (isDraggingMap) {
      state.panEast = panMeters.east;
      state.panNorth = panMeters.north;
    }

    const initialDistM = haversineMeters(state.lat, state.lng, playerLat, playerLng);
    // Long-distance regional jump (>= 420m via search/presets): snap coordinates & play a soft 260ms map fade!
    if (initialDistM >= 420) {
      state.lat = playerLat;
      state.lng = playerLng;
      state.panEast = panMeters.east;
      state.panNorth = panMeters.north;
      state.teleportFade = 1;
      layerAnchorRef.current.initialized = false;
    }

    const panDiff0 = isDraggingMap
      ? 0
      : Math.hypot(panMeters.east - state.panEast, panMeters.north - state.panNorth);

    if (initialDistM <= 0.14 && panDiff0 <= 0.22 && state.teleportFade <= 0.01) {
      state.lat = playerLat;
      state.lng = playerLng;
      if (!isDraggingMap) {
        state.panEast = panMeters.east;
        state.panNorth = panMeters.north;
      }
      setVisualCam((prev) =>
        prev.lat === state.lat &&
        prev.lng === state.lng &&
        prev.panEast === state.panEast &&
        prev.panNorth === state.panNorth &&
        !prev.isGliding &&
        prev.teleportFade === 0
          ? prev
          : {
              lat: state.lat,
              lng: state.lng,
              panEast: state.panEast,
              panNorth: state.panNorth,
              isGliding: false,
              strideTick: Math.floor(state.strideAccum) % 360,
              teleportFade: 0,
            }
      );
      return;
    }

    let rafId = 0;
    let lastTs = performance.now();

    const stepFrame = (now: number) => {
      const dtSec = Math.min(0.05, Math.max(0.004, (now - lastTs) / 1000));
      lastTs = now;

      const remDistM = haversineMeters(state.lat, state.lng, playerLat, playerLng);
      const ease = 1 - Math.exp(-dtSec * 14.5);
      const minGlideM = metersPerVirtualPx * 46 * dtSec;

      if (remDistM <= 0.14) {
        state.lat = playerLat;
        state.lng = playerLng;
      } else {
        const moveM = Math.min(remDistM, Math.max(remDistM * ease, minGlideM));
        const ratio = moveM / remDistM;
        state.lat += (playerLat - state.lat) * ratio;
        state.lng += (playerLng - state.lng) * ratio;
        state.strideAccum = (state.strideAccum + dtSec * 12) % 360;
      }

      let remPanM = 0;
      if (isDraggingMap) {
        state.panEast = panMeters.east;
        state.panNorth = panMeters.north;
      } else {
        const dEast = panMeters.east - state.panEast;
        const dNorth = panMeters.north - state.panNorth;
        remPanM = Math.hypot(dEast, dNorth);
        if (remPanM <= 0.22) {
          state.panEast = panMeters.east;
          state.panNorth = panMeters.north;
          remPanM = 0;
        } else {
          const panEase = 1 - Math.exp(-dtSec * 15);
          const panStep = Math.min(remPanM, Math.max(remPanM * panEase, minGlideM * 1.2));
          const pRatio = panStep / remPanM;
          state.panEast += dEast * pRatio;
          state.panNorth += dNorth * pRatio;
        }
      }

      if (state.teleportFade > 0) {
        state.teleportFade = Math.max(0, state.teleportFade - dtSec * 3.9);
      }

      const postDistM = haversineMeters(state.lat, state.lng, playerLat, playerLng);
      const stillMoving = postDistM > 0.14 || remPanM > 0.22 || state.teleportFade > 0.01;

      if (!stillMoving) {
        state.lat = playerLat;
        state.lng = playerLng;
        if (!isDraggingMap) {
          state.panEast = panMeters.east;
          state.panNorth = panMeters.north;
        }
        state.teleportFade = 0;
      }

      setVisualCam({
        lat: state.lat,
        lng: state.lng,
        panEast: state.panEast,
        panNorth: state.panNorth,
        isGliding: postDistM > 0.14,
        strideTick: Math.floor(state.strideAccum) % 360,
        teleportFade: state.teleportFade,
      });

      if (stillMoving) {
        rafId = window.requestAnimationFrame(stepFrame);
      }
    };

    rafId = window.requestAnimationFrame(stepFrame);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [playerLat, playerLng, panMeters, isDraggingMap, metersPerVirtualPx, subterraneanMode]);

  // Adaptive 16-bit animation loop: 95ms during movement/precipitation, 250ms when idle to save battery!
  const needsFastTick =
    isWalking ||
    visualCam.isGliding ||
    isDraggingMap ||
    weather?.condition === 'rain' ||
    weather?.condition === 'storm' ||
    weather?.condition === 'snow';

  useEffect(() => {
    let intervalId: number | null = null;
    const delayMs = needsFastTick ? 95 : 250;
    const startLoop = () => {
      if (intervalId !== null) return;
      intervalId = window.setInterval(() => {
        setAnimTick((t) => (t + 1) % 360);
      }, delayMs);
    };
    const stopLoop = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stopLoop();
      } else {
        startLoop();
      }
    };
    if (document.visibilityState !== 'hidden') {
      startLoop();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stopLoop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [needsFastTick]);

  // Unified Surface <-> Sous-sol transition: dismisses mismatched NPC dialogue, plays stone-stair SFX,
  // triggers a smooth 240ms torchlight/daylight veil fade, and flashes a brief stratum cartouche!
  useEffect(() => {
    setActiveNpcDialogue(null);
    setHoveredNpcId(null);
    setHoveredSpecimenId(null);
    if (prevSubModeRef.current !== subterraneanMode) {
      prevSubModeRef.current = subterraneanMode;
      playPortalSfx(muted, subterraneanMode);
      visualStateRef.current.teleportFade = 0.88;
      setStratumBanner({
        label: subterraneanMode
          ? '▼ Strate souterraine · Cavités & Galeries'
          : '▲ Retour en Surface',
        sub: subterraneanMode,
      });
      if (stratumBannerTimerRef.current !== null) {
        window.clearTimeout(stratumBannerTimerRef.current);
      }
      stratumBannerTimerRef.current = window.setTimeout(() => {
        setStratumBanner(null);
        stratumBannerTimerRef.current = null;
      }, 1750);
    }
  }, [subterraneanMode, muted]);

  useEffect(() => {
    return () => {
      if (stratumBannerTimerRef.current !== null) {
        window.clearTimeout(stratumBannerTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheelAtRef.current < 115) return;
      if (Math.abs(e.deltaY) < 4) return;
      lastWheelAtRef.current = now;

      const cur = zoomRef.current;
      if (e.deltaY < 0 && cur < 6) {
        onChangeZoom((cur + 1) as ZoomLevel);
      } else if (e.deltaY > 0 && cur > 1) {
        onChangeZoom((cur - 1) as ZoomLevel);
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [onChangeZoom]);

  const sectorLatRef = Math.round(playerLat * 20) / 20;
  const cosRef = Math.max(0.15, Math.cos((sectorLatRef * Math.PI) / 180));
  const playerTileWx = (playerLng * 111320 * cosRef) / tileMeters;
  const playerTileWy = (-playerLat * 110540) / tileMeters;
  // 96-tile hysteresis on topological 416x416 grid center: eliminates boundary thrashing
  // and cuts full-grid rasterizations by 3x while leaving >110 tiles of margin in every direction!
  if (
    !topoAnchorRef.current.initialized ||
    topoAnchorRef.current.tileMeters !== tileMeters ||
    Math.abs(topoAnchorRef.current.cosRef - cosRef) > 1e-4 ||
    Math.abs(playerTileWx - topoAnchorRef.current.wx) > 96 ||
    Math.abs(playerTileWy - topoAnchorRef.current.wy) > 96
  ) {
    topoAnchorRef.current = {
      wx: Math.round(playerTileWx / 32) * 32,
      wy: Math.round(playerTileWy / 32) * 32,
      tileMeters,
      cosRef,
      initialized: true,
    };
  }
  const anchorChunkWx = topoAnchorRef.current.wx;
  const anchorChunkWy = topoAnchorRef.current.wy;

  const worldMapData = useMemo(() => {
    const GRID_SIZE = 416;
    const HALF = Math.floor(GRID_SIZE / 2);

    const originWx = anchorChunkWx - HALF;
    const originWy = anchorChunkWy - HALF;

    const toGridFloat = (lat: number, lng: number) => ({
      gx: (lng * 111320 * cosRef) / tileMeters - originWx,
      gy: (-lat * 110540) / tileMeters - originWy,
    });

    // Fast O(N) lat/lng bounding-box pre-cull with 24-tile margin around the active 416x416 grid
    const minGridLat = -((originWy + GRID_SIZE + 24) * tileMeters) / 110540;
    const maxGridLat = -((originWy - 24) * tileMeters) / 110540;
    const minGridLng = ((originWx - 24) * tileMeters) / (111320 * cosRef);
    const maxGridLng = ((originWx + GRID_SIZE + 24) * tileMeters) / (111320 * cosRef);

    const activeTerrain = terrain.filter((feat) => {
      const pts = feat.points;
      if (pts.length === 0) return false;
      let fMinLat = pts[0].lat;
      let fMaxLat = pts[0].lat;
      let fMinLng = pts[0].lng;
      let fMaxLng = pts[0].lng;
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i];
        if (p.lat < fMinLat) fMinLat = p.lat;
        else if (p.lat > fMaxLat) fMaxLat = p.lat;
        if (p.lng < fMinLng) fMinLng = p.lng;
        else if (p.lng > fMaxLng) fMaxLng = p.lng;
      }
      return (
        fMaxLat >= minGridLat &&
        fMinLat <= maxGridLat &&
        fMaxLng >= minGridLng &&
        fMinLng <= maxGridLng
      );
    });

    const grid = new Uint8Array(GRID_SIZE * GRID_SIZE);
    const bridgeModeGrid = new Uint8Array(GRID_SIZE * GRID_SIZE);
    const bridgeAxisGrid = new Uint8Array(GRID_SIZE * GRID_SIZE);
    const railMaskGrid = new Uint8Array(GRID_SIZE * GRID_SIZE);
    const landmarkCellMask = new Uint8Array(GRID_SIZE * GRID_SIZE);
    const landmarkAnchorIndex = new Int16Array(GRID_SIZE * GRID_SIZE);
    const landmarkStamps: LandmarkStamp[] = [];
    const bldgClassGrid = new Uint8Array(GRID_SIZE * GRID_SIZE);
    const bldgLevelsGrid = new Uint8Array(GRID_SIZE * GRID_SIZE);
    const settlementGrid = new Uint8Array(GRID_SIZE * GRID_SIZE);

    if (activeTerrain.length > 0) {
      // ======================================================================
      // STEP 1: SANCTUARIZED HYDROGRAPHY (Continuous Rivers + River Islands!)
      // ======================================================================
      const waterMask = new Uint8Array(GRID_SIZE * GRID_SIZE);
      const islandGroundMask = new Uint8Array(GRID_SIZE * GRID_SIZE);

      for (const feat of activeTerrain) {
        if (feat.kind !== 'water') continue;
        const pts = feat.points.map((p) => toGridFloat(p.lat, p.lng));
        fillWaterPolygonGuaranteed(waterMask, GRID_SIZE, pts);
      }

      for (const feat of activeTerrain) {
        if (feat.kind !== 'island') continue;
        const pts = feat.points.map((p) => toGridFloat(p.lat, p.lng));
        carveIslandInterior(waterMask, islandGroundMask, GRID_SIZE, pts);
      }

      for (const feat of activeTerrain) {
        if (feat.kind !== 'waterway') continue;
        const isMajorRiver =
          feat.waterwayRank === 'river' ||
          /fleuve|seine|loire|rhône|saône|garonne|marne|oise|vezère|vézère|rhin|meuse|moselle|isère|doubs/i.test(
            feat.name
          );
        const isCanal = feat.waterwayRank === 'canal' || /canal|rivière/i.test(feat.name);
        const waterBrush: 0 | 1 | 2 = isMajorRiver
          ? zoomLevel >= 5
            ? 2
            : zoomLevel >= 3
            ? 1
            : 0
          : isCanal
          ? zoomLevel >= 5
            ? 1
            : 0
          : zoomLevel >= 6
          ? 1
          : 0;

        for (let i = 0; i < feat.points.length - 1; i++) {
          const a = toGridFloat(feat.points[i].lat, feat.points[i].lng);
          const b = toGridFloat(feat.points[i + 1].lat, feat.points[i + 1].lng);
          rasterizeWaterwaySegment(
            waterMask,
            islandGroundMask,
            GRID_SIZE,
            a.gx,
            a.gy,
            b.gx,
            b.gy,
            waterBrush
          );
        }
      }

      stitchDiagonalWaterChannels(waterMask, GRID_SIZE);

      for (let i = 0; i < grid.length; i++) {
        if (waterMask[i] === 1) {
          grid[i] = T_WATER;
        } else if (islandGroundMask[i] === 1) {
          grid[i] = T_RESIDENTIAL;
        }
      }

      // ======================================================================
      // STEP 2: LANDUSE BIOMES & PIERS (Never overwrites sanctuarized T_WATER!)
      // ======================================================================
      const polyOrder: Array<{ kind: TerrainFeature['kind']; code: number }> = [
        { kind: 'residential', code: T_RESIDENTIAL },
        { kind: 'industrial', code: T_INDUSTRIAL },
        { kind: 'commercial', code: T_COMMERCIAL },
        { kind: 'farmland', code: T_FARMLAND },
        { kind: 'forest', code: T_FOREST },
        { kind: 'park', code: T_PARK },
        { kind: 'cemetery', code: T_CEMETERY },
        { kind: 'plaza', code: T_PLAZA },
        { kind: 'pier', code: T_PIER },
      ];

      for (const layerSpec of polyOrder) {
        for (const feat of activeTerrain) {
          if (feat.kind !== layerSpec.kind) continue;
          if (feat.kind === 'pier' && !feat.isPolygon) continue;
          const pts = feat.points.map((p) => toGridFloat(p.lat, p.lng));
          fillPolygonGrid(grid, GRID_SIZE, pts, layerSpec.code, false, true);
        }
      }

      // ======================================================================
      // STEP 2B: PRE-COMPUTE SUB-TILE BUILDING COVERAGE & SETTLEMENT TISSUES
      // Separates City Centers, Suburbs/Lotissements, Villages, Hamlets & Industrial Zones!
      // ======================================================================
      const bldgSubMask = new Uint16Array(GRID_SIZE * GRID_SIZE);
      const bldgCov16 = new Uint8Array(GRID_SIZE * GRID_SIZE);
      const bldgCentroidCount = new Uint8Array(GRID_SIZE * GRID_SIZE);
      const bldgMaxArea = new Float32Array(GRID_SIZE * GRID_SIZE);
      const localCesPermille = new Uint16Array(GRID_SIZE * GRID_SIZE);
      const denseUrbanMask = new Uint8Array(GRID_SIZE * GRID_SIZE);

      const tileAreaM2 = tileMeters * tileMeters;
      const minBldgAreaM2 =
        zoomLevel <= 2 ? 42 : zoomLevel === 3 ? 30 : zoomLevel === 4 ? 22 : 10;

      for (const feat of activeTerrain) {
        if (feat.kind !== 'building') continue;
        const pts = feat.points.map((p) => toGridFloat(p.lat, p.lng));
        const areaTiles2 = polygonAreaTiles2(pts);
        if (!feat.landmark && areaTiles2 * tileAreaM2 < minBldgAreaM2) continue;
        accumulateBuildingMorphology(
          bldgSubMask,
          bldgCentroidCount,
          bldgMaxArea,
          bldgClassGrid,
          bldgLevelsGrid,
          waterMask,
          GRID_SIZE,
          pts,
          areaTiles2,
          Boolean(feat.landmark),
          encodeBuildingArchetype(feat.bldgClass),
          feat.levels || 0
        );
      }

      for (let i = 0; i < bldgSubMask.length; i++) {
        bldgCov16[i] = popcount16(bldgSubMask[i]);
      }

      for (let gy = 1; gy < GRID_SIZE - 1; gy++) {
        const rOff = gy * GRID_SIZE;
        for (let gx = 1; gx < GRID_SIZE - 1; gx++) {
          const idx = rOff + gx;
          if (waterMask[idx] === 1) continue;
          let covSum = 0;
          let urbanCells = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const nr = (gy + dy) * GRID_SIZE;
            for (let dx = -1; dx <= 1; dx++) {
              const nIdx = nr + gx + dx;
              if (waterMask[nIdx] === 1) continue;
              const nt = grid[nIdx];
              const nc = bldgCov16[nIdx];
              if (
                nc === 0 &&
                (nt === T_FOREST || nt === T_FARMLAND || nt === T_PARK || nt === T_CEMETERY)
              ) {
                continue;
              }
              covSum += nc;
              urbanCells++;
            }
          }
          const ces = urbanCells > 0 ? Math.round((covSum * 1000) / (urbanCells * 16)) : 0;
          localCesPermille[idx] = ces;
          const cov = bldgCov16[idx];
          if (
            cov >= 7 ||
            bldgMaxArea[idx] >= 1.15 ||
            (cov >= 4 && ces >= 350) ||
            (cov >= 2 && ces >= 430)
          ) {
            denseUrbanMask[idx] = 1;
          }
        }
      }

      // O(1) Physical-Meter 2D Integral Image Classification into 5 Settlement Tissues
      const W1 = GRID_SIZE + 1;
      const satLen = W1 * W1;
      const satDry = new Int32Array(satLen);
      const satCov = new Int32Array(satLen);
      const satInd = new Int32Array(satLen);
      const satUrban = new Int32Array(satLen);

      for (let gy = 0; gy < GRID_SIZE; gy++) {
        const gRow = gy * GRID_SIZE;
        const sPrev = gy * W1;
        const sCur = (gy + 1) * W1;
        let rowDry = 0;
        let rowCov = 0;
        let rowInd = 0;
        let rowUrb = 0;
        for (let gx = 0; gx < GRID_SIZE; gx++) {
          const idx = gRow + gx;
          const dry = waterMask[idx] === 0 ? 1 : 0;
          const t = grid[idx];
          const bc = bldgClassGrid[idx];
          rowDry += dry;
          rowCov += bldgCov16[idx];
          if (t === T_INDUSTRIAL || bc === BC_INDUSTRIAL) rowInd += 1;
          if (
            t === T_COMMERCIAL ||
            t === T_PLAZA ||
            bc === BC_URBAN_MIDRISE ||
            bc === BC_COMMERCIAL ||
            bldgLevelsGrid[idx] >= 3
          ) {
            rowUrb += 1;
          }
          const sIdx = sCur + gx + 1;
          satDry[sIdx] = satDry[sPrev + gx + 1] + rowDry;
          satCov[sIdx] = satCov[sPrev + gx + 1] + rowCov;
          satInd[sIdx] = satInd[sPrev + gx + 1] + rowInd;
          satUrban[sIdx] = satUrban[sPrev + gx + 1] + rowUrb;
        }
      }

      const rectSum = (sat: Int32Array, x0: number, y0: number, x1: number, y1: number) =>
        sat[(y1 + 1) * W1 + (x1 + 1)] -
        sat[y0 * W1 + (x1 + 1)] -
        sat[(y1 + 1) * W1 + x0] +
        sat[y0 * W1 + x0];

      const rLocal = Math.max(2, Math.min(48, Math.round(115 / tileMeters)));
      const rMacro = Math.max(5, Math.min(95, Math.round(310 / tileMeters)));

      for (let gy = 0; gy < GRID_SIZE; gy++) {
        const ly0 = Math.max(0, gy - rLocal);
        const ly1 = Math.min(GRID_SIZE - 1, gy + rLocal);
        const my0 = Math.max(0, gy - rMacro);
        const my1 = Math.min(GRID_SIZE - 1, gy + rMacro);
        const rOff = gy * GRID_SIZE;

        for (let gx = 0; gx < GRID_SIZE; gx++) {
          const idx = rOff + gx;
          if (waterMask[idx] === 1) continue;

          const lx0 = Math.max(0, gx - rLocal);
          const lx1 = Math.min(GRID_SIZE - 1, gx + rLocal);
          const mx0 = Math.max(0, gx - rMacro);
          const mx1 = Math.min(GRID_SIZE - 1, gx + rMacro);

          const lDry = Math.max(1, rectSum(satDry, lx0, ly0, lx1, ly1));
          const mDry = Math.max(1, rectSum(satDry, mx0, my0, mx1, my1));
          const lCes = rectSum(satCov, lx0, ly0, lx1, ly1) / (lDry * 16);
          const mCes = rectSum(satCov, mx0, my0, mx1, my1) / (mDry * 16);
          const lInd = rectSum(satInd, lx0, ly0, lx1, ly1) / lDry;
          const lUrb = rectSum(satUrban, lx0, ly0, lx1, ly1) / lDry;
          const mUrb = rectSum(satUrban, mx0, my0, mx1, my1) / mDry;

          const t = grid[idx];
          const bc = bldgClassGrid[idx];

          if (t === T_INDUSTRIAL || bc === BC_INDUSTRIAL || lInd >= 0.16) {
            settlementGrid[idx] = SETTLE_INDUSTRIAL;
          } else if (
            lCes >= 0.28 ||
            (lCes >= 0.19 && (mCes >= 0.16 || lUrb >= 0.07)) ||
            (denseUrbanMask[idx] === 1 && mCes >= 0.13)
          ) {
            settlementGrid[idx] = SETTLE_CITY_CENTER;
          } else if (mCes >= 0.072 || (lCes >= 0.12 && mUrb >= 0.025)) {
            settlementGrid[idx] = SETTLE_SUBURB;
          } else if (mCes >= 0.017 || lCes >= 0.06) {
            settlementGrid[idx] = SETTLE_VILLAGE;
          } else if (bldgCov16[idx] > 0 || lCes >= 0.004 || t === T_RESIDENTIAL) {
            settlementGrid[idx] = SETTLE_HAMLET;
          } else {
            settlementGrid[idx] = SETTLE_RURAL;
          }
        }
      }

      // ======================================================================
      // STEP 3: SCALE-AWARE LINEAR NETWORKS & TRUE VECTOR BRIDGES / VIADUCTS
      // ======================================================================
      const majorBrush: 0 | 1 | 2 = zoomLevel >= 6 ? 2 : zoomLevel >= 4 ? 1 : 0;
      const minorBrush: 0 | 1 | 2 = zoomLevel >= 5 ? 1 : 0;
      const useThinDryLines = zoomLevel <= 3;

      const inspectChainUrbanContext = (chain: ChainCell[]) => {
        if (chain.length === 0) {
          return { isMostlyDenseUrban: false, servesBuildings: false };
        }
        let denseHits = 0;
        let servesBuildings = false;
        for (const c of chain) {
          if (denseUrbanMask[c.idx] === 1) denseHits++;
          if (!servesBuildings) {
            if (
              bldgCov16[c.idx] > 0 ||
              (c.gx > 0 && bldgCov16[c.idx - 1] > 0) ||
              (c.gx < GRID_SIZE - 1 && bldgCov16[c.idx + 1] > 0) ||
              (c.gy > 0 && bldgCov16[c.idx - GRID_SIZE] > 0) ||
              (c.gy < GRID_SIZE - 1 && bldgCov16[c.idx + GRID_SIZE] > 0)
            ) {
              servesBuildings = true;
            }
          }
        }
        return {
          isMostlyDenseUrban: denseHits * 2 >= chain.length,
          servesBuildings,
        };
      };

      // 3A. Piers (lines), Railways, Footpaths, Pedestrian Steps, Minor & Major Roads
      // Major roads are stamped BEFORE minor streets at wide zooms so boulevards claim primary corridors cleanly!
      const drySpecs: Array<{
        kind: TerrainFeature['kind'];
        code: number;
        brush: 0 | 1 | 2;
        implicitBridgeMode: number;
        maxSpan: number;
      }> =
        zoomLevel <= 3
          ? [
              { kind: 'pier', code: T_PIER, brush: 0, implicitBridgeMode: B_NONE, maxSpan: 0 },
              { kind: 'rail', code: T_RAIL, brush: 0, implicitBridgeMode: B_RAIL_VIADUCT, maxSpan: 7 },
              { kind: 'major_road', code: T_MAIN_ROAD, brush: majorBrush, implicitBridgeMode: B_ROAD, maxSpan: 6 },
              { kind: 'minor_road', code: T_STREET, brush: minorBrush, implicitBridgeMode: B_ROAD, maxSpan: 5 },
              { kind: 'steps', code: T_STEPS, brush: 0, implicitBridgeMode: B_FOOTBRIDGE, maxSpan: 3 },
              { kind: 'path', code: T_PATH, brush: 0, implicitBridgeMode: B_FOOTBRIDGE, maxSpan: 4 },
            ]
          : [
              { kind: 'pier', code: T_PIER, brush: 0, implicitBridgeMode: B_NONE, maxSpan: 0 },
              { kind: 'rail', code: T_RAIL, brush: 0, implicitBridgeMode: B_RAIL_VIADUCT, maxSpan: 7 },
              { kind: 'path', code: T_PATH, brush: 0, implicitBridgeMode: B_FOOTBRIDGE, maxSpan: 4 },
              { kind: 'steps', code: T_STEPS, brush: 0, implicitBridgeMode: B_FOOTBRIDGE, maxSpan: 3 },
              { kind: 'minor_road', code: T_STREET, brush: minorBrush, implicitBridgeMode: B_ROAD, maxSpan: 5 },
              { kind: 'major_road', code: T_MAIN_ROAD, brush: majorBrush, implicitBridgeMode: B_ROAD, maxSpan: 6 },
            ];

      for (const spec of drySpecs) {
        for (const feat of activeTerrain) {
          if (feat.kind !== spec.kind) continue;
          if (spec.kind === 'pier' && feat.isPolygon) continue;
          const pts = feat.points.map((p) => toGridFloat(p.lat, p.lng));

          // Always check transverse water crossings so rivers keep all bridges at every zoom!
          // Footpaths & steps use crisp 1-strip chains so narrow passerelles never bloat over water.
          const superChain = traceSupercoverChain(pts, GRID_SIZE);
          const thinChain =
            spec.implicitBridgeMode === B_FOOTBRIDGE || (useThinDryLines && spec.kind !== 'pier')
              ? traceThinChain(pts, GRID_SIZE)
              : null;
          const waterCrossingChain =
            spec.implicitBridgeMode === B_FOOTBRIDGE && thinChain ? thinChain : superChain;
          if (spec.implicitBridgeMode !== B_NONE) {
            detectImplicitTransverseBridges(
              grid,
              bridgeModeGrid,
              bridgeAxisGrid,
              railMaskGrid,
              GRID_SIZE,
              waterCrossingChain,
              spec.implicitBridgeMode,
              spec.maxSpan
            );
          }

          const dryChain = useThinDryLines && spec.kind !== 'pier' && thinChain ? thinChain : superChain;

          // Scale-dependent cartographic generalization for dry land roads/paths/steps
          if (zoomLevel === 1) {
            if (spec.kind === 'steps') continue;
            if (spec.kind === 'path' && polylineSpanTiles(pts) < 4.0) continue;
            if (spec.kind === 'minor_road') {
              const span = polylineSpanTiles(pts);
              const hasStreetName = feat.name.trim().length > 0;
              const ctxInfo = inspectChainUrbanContext(dryChain);
              if (
                ctxInfo.isMostlyDenseUrban ||
                !hasStreetName ||
                !ctxInfo.servesBuildings ||
                span < 1.9
              ) {
                continue;
              }
            }
          } else if (zoomLevel === 2) {
            if (spec.kind === 'steps') continue;
            if (spec.kind === 'path' && polylineSpanTiles(pts) < 2.2) continue;
            if (spec.kind === 'minor_road') {
              const span = polylineSpanTiles(pts);
              const hasStreetName = feat.name.trim().length > 0;
              const ctxInfo = inspectChainUrbanContext(dryChain);
              if (ctxInfo.isMostlyDenseUrban) {
                if (!hasStreetName || span < 1.6) continue;
              } else {
                // In lotissements & villages, keep named street segments (even across T-junction splits!)
                // and residential cul-de-sacs serving houses so subdivisions stay readable!
                if (hasStreetName) {
                  if (span < 0.55) continue;
                } else if (span < (ctxInfo.servesBuildings ? 0.85 : 1.35)) {
                  continue;
                }
              }
            }
          } else if (zoomLevel === 3) {
            if (spec.kind === 'steps' && polylineSpanTiles(pts) < 0.85) continue;
            if (spec.kind === 'minor_road' && feat.name.trim().length === 0) {
              const span = polylineSpanTiles(pts);
              const ctxInfo = inspectChainUrbanContext(dryChain);
              if (span < (ctxInfo.servesBuildings ? 0.75 : 1.35)) {
                continue;
              }
            }
          }

          stampDryLinearChain(
            grid,
            railMaskGrid,
            GRID_SIZE,
            dryChain,
            spec.code,
            spec.brush,
            zoomLevel,
            denseUrbanMask
          );
        }
      }

      // 3B. Explicit Vector Bridges (Only render water-bridges where they genuinely span T_WATER!)
      for (const feat of activeTerrain) {
        if (feat.kind !== 'bridge') continue;
        const pts = feat.points.map((p) => toGridFloat(p.lat, p.lng));
        const bMode =
          feat.bridgeMode === 'rail'
            ? B_RAIL_VIADUCT
            : feat.bridgeMode === 'path'
            ? B_FOOTBRIDGE
            : B_ROAD;

        const useThinBridgeSpan = bMode === B_FOOTBRIDGE || useThinDryLines;
        const chain = useThinBridgeSpan
          ? traceThinChain(pts, GRID_SIZE)
          : traceSupercoverChain(pts, GRID_SIZE);
        if (chain.length === 0) continue;

        const touchesWater = chain.some((c) => grid[c.idx] === T_WATER);

        const dryTile =
          feat.bridgeMode === 'rail'
            ? T_RAIL
            : feat.bridgeMode === 'path'
            ? T_PATH
            : feat.bridgeMode === 'minor'
            ? T_STREET
            : T_MAIN_ROAD;
        const dryBrush: 0 | 1 | 2 =
          feat.bridgeMode === 'road' || !feat.bridgeMode
            ? majorBrush
            : feat.bridgeMode === 'minor'
            ? minorBrush
            : 0;

        const shouldStampDryApproach =
          touchesWater ||
          zoomLevel >= 3 ||
          (zoomLevel === 2 && dryTile !== T_PATH) ||
          (zoomLevel === 1 && (dryTile === T_MAIN_ROAD || dryTile === T_RAIL));

        if (shouldStampDryApproach) {
          const dryBridgeChain =
            useThinDryLines && !useThinBridgeSpan ? traceThinChain(pts, GRID_SIZE) : chain;
          stampDryLinearChain(
            grid,
            railMaskGrid,
            GRID_SIZE,
            dryBridgeChain,
            dryTile,
            dryBrush,
            zoomLevel,
            denseUrbanMask
          );
        }

        if (touchesWater) {
          for (const c of chain) {
            if (grid[c.idx] !== T_WATER) continue;
            if (bridgeModeGrid[c.idx] === B_NONE || bMode === B_ROAD || bMode === B_RAIL_VIADUCT) {
              bridgeModeGrid[c.idx] = bMode;
              bridgeAxisGrid[c.idx] = c.axis;
            }
            if (bMode === B_RAIL_VIADUCT) {
              railMaskGrid[c.idx] = 1;
            }
          }
        }
      }

      // 3C. Bridge Topology Pinhole Closure & Connected-Component Material/Axis Harmonization
      // 1) Close 1-tile interior median gaps inside multi-lane road bridges over water
      for (let pass = 0; pass < 2; pass++) {
        const fills: Array<{ idx: number; mode: number; axis: number }> = [];
        for (let gy = 1; gy < GRID_SIZE - 1; gy++) {
          const rOff = gy * GRID_SIZE;
          for (let gx = 1; gx < GRID_SIZE - 1; gx++) {
            const idx = rOff + gx;
            if (grid[idx] !== T_WATER || bridgeModeGrid[idx] !== B_NONE) continue;
            const nM = bridgeModeGrid[idx - GRID_SIZE];
            const sM = bridgeModeGrid[idx + GRID_SIZE];
            const wM = bridgeModeGrid[idx - 1];
            const eM = bridgeModeGrid[idx + 1];
            const orthoCount =
              (nM !== B_NONE ? 1 : 0) +
              (sM !== B_NONE ? 1 : 0) +
              (wM !== B_NONE ? 1 : 0) +
              (eM !== B_NONE ? 1 : 0);

            if (orthoCount >= 3) {
              const pickIdx =
                nM === B_ROAD
                  ? idx - GRID_SIZE
                  : sM === B_ROAD
                  ? idx + GRID_SIZE
                  : wM === B_ROAD
                  ? idx - 1
                  : eM === B_ROAD
                  ? idx + 1
                  : nM !== B_NONE
                  ? idx - GRID_SIZE
                  : sM !== B_NONE
                  ? idx + GRID_SIZE
                  : idx - 1;
              fills.push({
                idx,
                mode: bridgeModeGrid[pickIdx],
                axis: bridgeAxisGrid[pickIdx],
              });
            } else if (zoomLevel >= 4 && ((nM === B_ROAD && sM === B_ROAD) || (wM === B_ROAD && eM === B_ROAD))) {
              let ringCount = orthoCount;
              if (bridgeModeGrid[idx - GRID_SIZE - 1] !== B_NONE) ringCount++;
              if (bridgeModeGrid[idx - GRID_SIZE + 1] !== B_NONE) ringCount++;
              if (bridgeModeGrid[idx + GRID_SIZE - 1] !== B_NONE) ringCount++;
              if (bridgeModeGrid[idx + GRID_SIZE + 1] !== B_NONE) ringCount++;
              if (ringCount >= 5) {
                const pickIdx = nM === B_ROAD ? idx - GRID_SIZE : idx - 1;
                fills.push({ idx, mode: B_ROAD, axis: bridgeAxisGrid[pickIdx] });
              }
            }
          }
        }
        for (const f of fills) {
          bridgeModeGrid[f.idx] = f.mode;
          bridgeAxisGrid[f.idx] = f.axis;
        }
      }

      // 2) Unify parallel OSM sidewalks (`B_FOOTBRIDGE`) touching a road bridge (`B_ROAD`) into one stone bridge,
      //    and harmonize `bridgeAxisGrid` per connected bridge component so bank-end cells never twist!
      const visitedBridge = new Uint8Array(GRID_SIZE * GRID_SIZE);
      const compQueue: number[] = [];
      for (let startIdx = 0; startIdx < bridgeModeGrid.length; startIdx++) {
        if (bridgeModeGrid[startIdx] === B_NONE || visitedBridge[startIdx] === 1) continue;
        compQueue.length = 0;
        compQueue.push(startIdx);
        visitedBridge[startIdx] = 1;

        let head = 0;
        let hasRoad = false;
        const axisWeights = [0, 0, 0, 0];

        while (head < compQueue.length) {
          const curIdx = compQueue[head++];
          const curMode = bridgeModeGrid[curIdx];
          if (curMode === B_ROAD) hasRoad = true;

          const cx = curIdx % GRID_SIZE;
          const cy = Math.floor(curIdx / GRID_SIZE);
          const midRiver =
            cx > 0 &&
            cx < GRID_SIZE - 1 &&
            cy > 0 &&
            cy < GRID_SIZE - 1 &&
            grid[curIdx - GRID_SIZE] === T_WATER &&
            grid[curIdx + GRID_SIZE] === T_WATER &&
            grid[curIdx - 1] === T_WATER &&
            grid[curIdx + 1] === T_WATER;

          const modeW = curMode === B_ROAD || curMode === B_RAIL_VIADUCT ? 2 : 1;
          const w = modeW * (midRiver ? 3 : 1);
          axisWeights[bridgeAxisGrid[curIdx] & 3] += w;

          for (let dy = -1; dy <= 1; dy++) {
            const ny = cy + dy;
            if (ny < 0 || ny >= GRID_SIZE) continue;
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = cx + dx;
              if (nx < 0 || nx >= GRID_SIZE) continue;
              const nIdx = ny * GRID_SIZE + nx;
              if (bridgeModeGrid[nIdx] !== B_NONE && visitedBridge[nIdx] === 0) {
                visitedBridge[nIdx] = 1;
                compQueue.push(nIdx);
              }
            }
          }
        }

        let domAxis = 0;
        for (let a = 1; a < 4; a++) {
          if (axisWeights[a] > axisWeights[domAxis]) {
            domAxis = a;
          }
        }

        for (let k = 0; k < compQueue.length; k++) {
          const cIdx = compQueue[k];
          if (hasRoad && bridgeModeGrid[cIdx] === B_FOOTBRIDGE) {
            bridgeModeGrid[cIdx] = B_ROAD;
          }
          if (compQueue.length <= 96) {
            bridgeAxisGrid[cIdx] = domAxis;
          }
        }
      }

      // ======================================================================
      // STEP 4: MORPHOLOGY-AWARE BUILDINGS (URBAN BLOCKS vs. PAVILLONNAIRE VILLAGES)
      // ======================================================================
      if (zoomLevel >= 4) {
        // Close zooms (2x, 3x, 4.5x): render true individual footprints (excluding micro garden sheds)
        for (let i = 0; i < grid.length; i++) {
          if (bldgCov16[i] > 0 && grid[i] === T_MEADOW) {
            grid[i] =
              settlementGrid[i] === SETTLE_INDUSTRIAL ? T_INDUSTRIAL : T_RESIDENTIAL;
          }
        }
        for (const feat of terrain) {
          if (feat.kind !== 'building') continue;
          const pts = feat.points.map((p) => toGridFloat(p.lat, p.lng));
          const areaTiles2 = polygonAreaTiles2(pts);
          if (!feat.landmark && areaTiles2 * tileAreaM2 < minBldgAreaM2) continue;
          fillPolygonGrid(
            grid,
            GRID_SIZE,
            pts,
            T_BUILDING,
            true,
            true,
            bldgClassGrid,
            encodeBuildingArchetype(feat.bldgClass),
            bldgLevelsGrid,
            feat.levels || 0
          );
        }
      } else {
        // Wide & medium-wide zooms (0.5x, 0.8x, 1.3x):
        // 1) Ensure inhabited parcels sit on appropriate yard turf/tarmac even when OSM omitted landuse
        for (let gy = 1; gy < GRID_SIZE - 1; gy++) {
          const rOff = gy * GRID_SIZE;
          for (let gx = 1; gx < GRID_SIZE - 1; gx++) {
            const idx = rOff + gx;
            if (bldgCov16[idx] > 0 && grid[idx] === T_MEADOW) {
              grid[idx] =
                settlementGrid[idx] === SETTLE_INDUSTRIAL ? T_INDUSTRIAL : T_RESIDENTIAL;
            }
          }
        }

        // 2) Stamp genuinely large edifices (warehouses, halls, churches, big urban footprints) directly
        for (const feat of terrain) {
          if (feat.kind !== 'building') continue;
          const pts = feat.points.map((p) => toGridFloat(p.lat, p.lng));
          const areaTiles2 = polygonAreaTiles2(pts);
          const bcCode = encodeBuildingArchetype(feat.bldgClass);
          const minWideTiles2 =
            bcCode === BC_INDUSTRIAL || bcCode === BC_COMMERCIAL ? 0.45 : 0.75;
          if (!feat.landmark && areaTiles2 < minWideTiles2) continue;
          fillPolygonGrid(
            grid,
            GRID_SIZE,
            pts,
            T_BUILDING,
            true,
            false,
            bldgClassGrid,
            bcCode,
            bldgLevelsGrid,
            feat.levels || 0
          );
        }

        // 3) Promote genuinely high-coverage urban cells (Regime A: city centers & continuous street-walls)
        for (let i = 0; i < grid.length; i++) {
          if (denseUrbanMask[i] === 1 && !isProtectedFromBuilding(grid[i])) {
            grid[i] = T_BUILDING;
          }
        }

        // 4) Thin 2x2 cobblestone junction blobs ONLY inside genuinely dense urban quarters (never in lotissements!)
        for (let gy = 1; gy < GRID_SIZE - 2; gy++) {
          const r0 = gy * GRID_SIZE;
          const r1 = (gy + 1) * GRID_SIZE;
          for (let gx = 1; gx < GRID_SIZE - 2; gx++) {
            const i00 = r0 + gx;
            const i10 = r0 + gx + 1;
            const i01 = r1 + gx;
            const i11 = r1 + gx + 1;
            const isPaved = (t: number) => t === T_MAIN_ROAD || t === T_STREET;
            if (
              isPaved(grid[i00]) &&
              isPaved(grid[i10]) &&
              isPaved(grid[i01]) &&
              isPaved(grid[i11])
            ) {
              const candidates = [i11, i01, i10, i00];
              for (const cIdx of candidates) {
                if (
                  grid[cIdx] === T_STREET &&
                  bridgeModeGrid[cIdx] === B_NONE &&
                  denseUrbanMask[cIdx] === 1
                ) {
                  grid[cIdx] = T_BUILDING;
                  break;
                }
              }
            }
          }
        }

        // 5) Synthesize enclosed Haussmannian/medieval block interiors ONLY in dense urban cores (CES >= 37%)
        if (zoomLevel <= 2) {
          const nextBuildings: number[] = [];
          for (let gy = 2; gy < GRID_SIZE - 2; gy++) {
            const rOff = gy * GRID_SIZE;
            for (let gx = 2; gx < GRID_SIZE - 2; gx++) {
              const idx = rOff + gx;
              if (grid[idx] !== T_RESIDENTIAL || localCesPermille[idx] < 370) continue;
              const nT = grid[idx - GRID_SIZE];
              const sT = grid[idx + GRID_SIZE];
              const wT = grid[idx - 1];
              const eT = grid[idx + 1];
              const urbanNeighbors =
                (nT === T_MAIN_ROAD || nT === T_STREET || nT === T_BUILDING ? 1 : 0) +
                (sT === T_MAIN_ROAD || sT === T_STREET || sT === T_BUILDING ? 1 : 0) +
                (wT === T_MAIN_ROAD || wT === T_STREET || wT === T_BUILDING ? 1 : 0) +
                (eT === T_MAIN_ROAD || eT === T_STREET || eT === T_BUILDING ? 1 : 0);
              const adjDenseBldg =
                denseUrbanMask[idx - GRID_SIZE] === 1 ||
                denseUrbanMask[idx + GRID_SIZE] === 1 ||
                denseUrbanMask[idx - 1] === 1 ||
                denseUrbanMask[idx + 1] === 1;
              if (urbanNeighbors >= 3 && adjDenseBldg) {
                nextBuildings.push(idx);
              }
            }
          }
          for (const bIdx of nextBuildings) {
            grid[bIdx] = T_BUILDING;
          }
        }

        // 6) Typify Pavillonnaire / Lotissement / Village Houses (Regime B):
        //    Place individual 16-bit cottages with green garden breathing room along residential lanes,
        //    preserving true detached-village character instead of fusing parcels into giant solid blocks!
        interface CottageCandidate {
          idx: number;
          gx: number;
          gy: number;
          score: number;
        }
        const cottageCandidates: CottageCandidate[] = [];
        for (let gy = 2; gy < GRID_SIZE - 2; gy++) {
          const rOff = gy * GRID_SIZE;
          for (let gx = 2; gx < GRID_SIZE - 2; gx++) {
            const idx = rOff + gx;
            if (denseUrbanMask[idx] === 1) continue;
            if (bldgCov16[idx] === 0 && bldgCentroidCount[idx] === 0) continue;
            if (grid[idx] === T_BUILDING || isProtectedFromBuilding(grid[idx])) continue;

            const nT = grid[idx - GRID_SIZE];
            const sT = grid[idx + GRID_SIZE];
            const wT = grid[idx - 1];
            const eT = grid[idx + 1];
            const adjPaved =
              nT === T_STREET ||
              sT === T_STREET ||
              wT === T_STREET ||
              eT === T_STREET ||
              nT === T_MAIN_ROAD ||
              sT === T_MAIN_ROAD ||
              wT === T_MAIN_ROAD ||
              eT === T_MAIN_ROAD;

            const wx = originWx + gx;
            const wy = originWy + gy;
            const score =
              bldgCov16[idx] * 22 +
              Math.min(3, bldgCentroidCount[idx]) * 14 +
              (adjPaved ? 28 : 0) +
              (tileHash(wx, wy) & 15);

            cottageCandidates.push({ idx, gx, gy, score });
          }
        }

        cottageCandidates.sort((a, b) => b.score - a.score || a.idx - b.idx);

        for (const cand of cottageCandidates) {
          const { idx, gx } = cand;
          if (grid[idx] === T_BUILDING || isProtectedFromBuilding(grid[idx])) continue;

          const nB = grid[idx - GRID_SIZE] === T_BUILDING;
          const sB = grid[idx + GRID_SIZE] === T_BUILDING;
          // Never merge pavillonnaire houses North-to-South into multi-tile roof slabs!
          if (nB || sB) continue;

          const wB = grid[idx - 1] === T_BUILDING;
          const eB = grid[idx + 1] === T_BUILDING;
          const ces = localCesPermille[idx];

          if (zoomLevel <= 2) {
            if (wB || eB) continue;
            if (ces < 260) {
              const diagB =
                grid[idx - GRID_SIZE - 1] === T_BUILDING ||
                grid[idx - GRID_SIZE + 1] === T_BUILDING ||
                grid[idx + GRID_SIZE - 1] === T_BUILDING ||
                grid[idx + GRID_SIZE + 1] === T_BUILDING;
              if (diagB) continue;
            }
          } else {
            // zoomLevel === 3 (1.3x Bourg): pure detached 1x1 pavilions in airy lotissements (CES < 23%),
            // and at most 2x1 semi-detached pairs ("maisons jumelées") in moderate suburbs!
            if (ces < 230) {
              if (wB || eB) continue;
            } else {
              if (wB && eB) continue;
              if (wB && gx >= 2 && grid[idx - 2] === T_BUILDING) continue;
              if (eB && gx < GRID_SIZE - 2 && grid[idx + 2] === T_BUILDING) continue;
            }
          }

          grid[idx] = T_BUILDING;
        }
      }

      // ======================================================================
      // STEP 5: 16-BIT JRPG ARCHITECTURAL SET-PIECES (LANDMARKS & MONUMENTS)
      // ======================================================================
      interface LandmarkCandidate {
        kind: LandmarkStyle;
        gx: number;
        gy: number;
        rank: number;
        name: string;
      }
      const candidates: LandmarkCandidate[] = [];

      const rankOf = (k: LandmarkStyle): number =>
        k === 'church'
          ? 1
          : k === 'castle'
          ? 2
          : k === 'arena'
          ? 3
          : k === 'station'
          ? 4
          : k === 'civic'
          ? 5
          : k === 'tower'
          ? 6
          : 7;

      for (const feat of activeTerrain) {
        if (feat.kind !== 'building' || !feat.landmark || feat.points.length === 0) continue;
        let sx = 0;
        let sy = 0;
        for (const p of feat.points) {
          const gp = toGridFloat(p.lat, p.lng);
          sx += gp.gx;
          sy += gp.gy;
        }
        candidates.push({
          kind: feat.landmark,
          gx: Math.round(sx / feat.points.length),
          gy: Math.round(sy / feat.points.length),
          rank: rankOf(feat.landmark),
          name: feat.name,
        });
      }

      for (const poi of surfacePois || pois) {
        if (poi.isSubterranean) continue;
        const text = `${poi.name} ${poi.subType}`.toLowerCase();
        let lKind: LandmarkStyle | null = null;
        if (/\b(cathédrale|basilique|abbatiale|collégiale|sacré-cœur|notre-dame|église\s+saint|église\s+notre)\b/.test(text)) {
          lKind = 'church';
        } else if (/\b(château|donjon|citadelle|forteresse)\b/.test(text)) {
          lKind = 'castle';
        } else if (/\b(arènes|amphithéâtre|théâtre\s+antique)\b/.test(text)) {
          lKind = 'arena';
        } else if (/\b(gare\s+)\b/.test(text)) {
          lKind = 'station';
        } else if (/\b(panthéon|hôtel\s+de\s+ville|opéra|palais\s+de\s+justice|sorbonne)\b/.test(text)) {
          lKind = 'civic';
        } else if (/\b(beffroi|phare\s+|moulin\s+|tour\s+saint|tour\s+médiévale)\b/.test(text)) {
          lKind = 'tower';
        } else if (/\b(fontaine\s+)\b/.test(text)) {
          lKind = 'fountain';
        }
        if (!lKind) continue;
        const gp = toGridFloat(poi.lat, poi.lng);
        candidates.push({
          kind: lKind,
          gx: Math.round(gp.gx),
          gy: Math.round(gp.gy),
          rank: rankOf(lKind),
          name: poi.name,
        });
      }

      candidates.sort((a, b) => a.rank - b.rank);

      const searchShifts = [
        [0, 0],
        [-1, 0],
        [0, -1],
        [-1, -1],
        [1, 0],
        [0, 1],
      ];

      for (const cand of candidates) {
        if (landmarkStamps.length >= 28) break;
        const isSmall = cand.kind === 'fountain' || cand.kind === 'tower';
        const w = isSmall ? 1 : 2;
        const h = isSmall ? 1 : 2;

        // Avoid overlapping or crowding adjacent set-pieces
        const tooClose = landmarkStamps.some(
          (s) => Math.hypot(s.gx - cand.gx, s.gy - cand.gy) < (isSmall ? 3.2 : 5.0)
        );
        if (tooClose) continue;

        let bestGx = -1;
        let bestGy = -1;
        let bestPenalty = 999;

        for (const [dx, dy] of searchShifts) {
          const tx = cand.gx + dx - (w === 2 ? 1 : 0);
          const ty = cand.gy + dy - (h === 2 ? 1 : 0);
          if (tx < 2 || ty < 2 || tx + w >= GRID_SIZE - 2 || ty + h >= GRID_SIZE - 2) continue;

          let hitsWaterOrLandmark = false;
          let penalty = Math.abs(dx) + Math.abs(dy);
          for (let yy = ty; yy < ty + h; yy++) {
            for (let xx = tx; xx < tx + w; xx++) {
              const idx = yy * GRID_SIZE + xx;
              const t = grid[idx];
              if (t === T_WATER || t === T_PIER || landmarkCellMask[idx] !== 0) {
                hitsWaterOrLandmark = true;
                break;
              }
              if (t === T_MAIN_ROAD || t === T_RAIL) penalty += 3;
            }
            if (hitsWaterOrLandmark) break;
          }
          if (!hitsWaterOrLandmark && penalty < bestPenalty) {
            bestPenalty = penalty;
            bestGx = tx;
            bestGy = ty;
            if (penalty === 0) break;
          }
        }

        if (bestGx < 0) continue;

        const stampIdx = landmarkStamps.length;
        landmarkStamps.push({
          kind: cand.kind,
          gx: bestGx,
          gy: bestGy,
          w,
          h,
          name: cand.name,
        });

        for (let yy = bestGy; yy < bestGy + h; yy++) {
          for (let xx = bestGx; xx < bestGx + w; xx++) {
            const idx = yy * GRID_SIZE + xx;
            landmarkCellMask[idx] = 1;
            // Seat monumental landmarks on a clean cut-stone parvis (T_PLAZA)
            if (grid[idx] === T_BUILDING || grid[idx] === T_RESIDENTIAL || grid[idx] === T_MEADOW) {
              grid[idx] = T_PLAZA;
            }
          }
        }
        // Y-sort anchor at bottom-left tile of the set-piece footprint!
        landmarkAnchorIndex[(bestGy + h - 1) * GRID_SIZE + bestGx] = stampIdx + 1;
      }
    }

    // Build Real-World Bilinear Elevation Grid + Cellular-Smoothed SNES Terrace Tiers!
    let elevGrid: Float32Array | null = null;
    let terraceGrid: Int16Array | null = null;
    let hasTerraces = false;
    let elevMin = 0;
    let elevSpan = 0;

    if (
      elevation &&
      elevation.elevDm &&
      elevation.elevDm.length >= elevation.cols * elevation.rows
    ) {
      elevGrid = new Float32Array(GRID_SIZE * GRID_SIZE);
      elevMin = elevation.minMeters;
      elevSpan = Math.max(0, elevation.maxMeters - elevation.minMeters);

      const eCols = elevation.cols;
      const eRows = elevation.rows;
      const halfEC = (eCols - 1) / 2;
      const halfER = (eRows - 1) / 2;
      const elevCos = Math.max(0.15, Math.cos((elevation.centerLat * Math.PI) / 180));

      // Separable fast 1D lookup tables for world tile -> DEM sample coordinates
      const fxTable = new Float32Array(GRID_SIZE);
      const fyTable = new Float32Array(GRID_SIZE);

      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const wx = originWx + gx + 0.5;
        const lng = (wx * tileMeters) / (111320 * cosRef);
        const dxM = (lng - elevation.centerLng) * 111320 * elevCos;
        fxTable[gx] = Math.max(0, Math.min(eCols - 1.001, halfEC + dxM / elevation.stepMeters));
      }
      for (let gy = 0; gy < GRID_SIZE; gy++) {
        const wy = originWy + gy + 0.5;
        const lat = -(wy * tileMeters) / 110540;
        const dyM = (elevation.centerLat - lat) * 110540;
        fyTable[gy] = Math.max(0, Math.min(eRows - 1.001, halfER + dyM / elevation.stepMeters));
      }

      const dm = elevation.elevDm;
      for (let gy = 0; gy < GRID_SIZE; gy++) {
        const fy = fyTable[gy];
        const y0 = Math.floor(fy);
        const y1 = Math.min(eRows - 1, y0 + 1);
        const ty = fy - y0;
        const row0 = y0 * eCols;
        const row1 = y1 * eCols;
        const dstRow = gy * GRID_SIZE;

        for (let gx = 0; gx < GRID_SIZE; gx++) {
          const fx = fxTable[gx];
          const x0 = Math.floor(fx);
          const x1 = Math.min(eCols - 1, x0 + 1);
          const tx = fx - x0;

          const top = dm[row0 + x0] + (dm[row0 + x1] - dm[row0 + x0]) * tx;
          const bot = dm[row1 + x0] + (dm[row1 + x1] - dm[row1 + x0]) * tx;
          elevGrid[dstRow + gx] = (top + (bot - top) * ty) * 0.1;
        }
      }

      if (elevSpan >= 4.0) {
        hasTerraces = true;
        const stepM = Math.max(4, elevation.contourStepMeters || 10);
        let curT = new Int16Array(GRID_SIZE * GRID_SIZE);
        let nextT = new Int16Array(GRID_SIZE * GRID_SIZE);

        for (let i = 0; i < curT.length; i++) {
          curT[i] = Math.floor(elevGrid[i] / stepM);
        }

        // 2 passes of 3x3 cellular majority smoothing so plateaus sweep cleanly like Zelda: ALttP!
        for (let pass = 0; pass < 2; pass++) {
          nextT.set(curT);
          for (let gy = 1; gy < GRID_SIZE - 1; gy++) {
            const rOff = gy * GRID_SIZE;
            for (let gx = 1; gx < GRID_SIZE - 1; gx++) {
              const idx = rOff + gx;
              const cVal = curT[idx];
              let above = 0;
              let below = 0;

              const n0 = curT[idx - GRID_SIZE - 1];
              const n1 = curT[idx - GRID_SIZE];
              const n2 = curT[idx - GRID_SIZE + 1];
              const n3 = curT[idx - 1];
              const n4 = curT[idx + 1];
              const n5 = curT[idx + GRID_SIZE - 1];
              const n6 = curT[idx + GRID_SIZE];
              const n7 = curT[idx + GRID_SIZE + 1];

              if (n0 > cVal) above++;
              else if (n0 < cVal) below++;
              if (n1 > cVal) above++;
              else if (n1 < cVal) below++;
              if (n2 > cVal) above++;
              else if (n2 < cVal) below++;
              if (n3 > cVal) above++;
              else if (n3 < cVal) below++;
              if (n4 > cVal) above++;
              else if (n4 < cVal) below++;
              if (n5 > cVal) above++;
              else if (n5 < cVal) below++;
              if (n6 > cVal) above++;
              else if (n6 < cVal) below++;
              if (n7 > cVal) above++;
              else if (n7 < cVal) below++;

              if (above >= 5) nextT[idx] = cVal + 1;
              else if (below >= 5) nextT[idx] = cVal - 1;
            }
          }
          const tmp = curT;
          curT = nextT;
          nextT = tmp;
        }

        terraceGrid = curT;
      }
    }

    // ========================================================================
    // STEP 8: 16-BIT SUBTERRANEAN "SOUS-SOL / DONJON" CARTOGRAPHIC MATRIX
    // Anchored to real BDCavités, Z15 MVT tunnels/metro/culverts, BSS aquifers & foundations!
    // ========================================================================
    const dungeonGrid = new Uint8Array(GRID_SIZE * GRID_SIZE);

    const carveDungeonCell = (cx: number, cy: number, code: number, overwrite = true) => {
      if (cx < 1 || cx >= GRID_SIZE - 1 || cy < 1 || cy >= GRID_SIZE - 1) return;
      const idx = cy * GRID_SIZE + cx;
      if (!overwrite && dungeonGrid[idx] !== D_ROCK) return;
      dungeonGrid[idx] = code;
    };

    const carveDungeonLine = (
      ax: number,
      ay: number,
      bx: number,
      by: number,
      code: number,
      halfWidth: number,
      borderCode = D_ROCK
    ) => {
      const dist = Math.hypot(bx - ax, by - ay);
      const steps = Math.max(1, Math.ceil(dist * 2.2));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const cx = Math.round(ax + (bx - ax) * t);
        const cy = Math.round(ay + (by - ay) * t);
        if (cx < 2 || cx >= GRID_SIZE - 2 || cy < 2 || cy >= GRID_SIZE - 2) continue;
        if (borderCode !== D_ROCK) {
          for (let dy = -halfWidth - 1; dy <= halfWidth + 1; dy++) {
            for (let dx = -halfWidth - 1; dx <= halfWidth + 1; dx++) {
              carveDungeonCell(cx + dx, cy + dy, borderCode, false);
            }
          }
        }
        for (let dy = -halfWidth; dy <= halfWidth; dy++) {
          for (let dx = -halfWidth; dx <= halfWidth; dx++) {
            if (Math.abs(dx) + Math.abs(dy) <= halfWidth + 1) {
              carveDungeonCell(cx + dx, cy + dy, code, true);
            }
          }
        }
      }
    };

    const carveOrganicChamber = (
      cx: number,
      cy: number,
      rx: number,
      ry: number,
      code: number,
      seed: number
    ) => {
      const minX = Math.max(2, cx - rx - 1);
      const maxX = Math.min(GRID_SIZE - 3, cx + rx + 1);
      const minY = Math.max(2, cy - ry - 1);
      const maxY = Math.min(GRID_SIZE - 3, cy + ry + 1);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const nx = (x - cx) / Math.max(1.2, rx);
          const ny = (y - cy) / Math.max(1.2, ry);
          const wobble = ((tileHash(x + seed, y - seed) % 7) - 3) * 0.085;
          if (nx * nx + ny * ny <= 1.05 + wobble) {
            carveDungeonCell(x, y, code, true);
          }
        }
      }
    };

    const connectChamberToNearestGallery = (cx: number, cy: number, maxRangeTiles: number) => {
      if (cx < 2 || cx >= GRID_SIZE - 2 || cy < 2 || cy >= GRID_SIZE - 2) return;
      let bestGx = -1;
      let bestGy = -1;
      let bestD2 = maxRangeTiles * maxRangeTiles + 1;
      const r = Math.min(maxRangeTiles, 12);
      for (let dy = -r; dy <= r; dy++) {
        const y = cy + dy;
        if (y < 2 || y >= GRID_SIZE - 2) continue;
        for (let dx = -r; dx <= r; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 >= bestD2 || d2 < 9) continue;
          const x = cx + dx;
          if (x < 2 || x >= GRID_SIZE - 2) continue;
          const dt = dungeonGrid[y * GRID_SIZE + x];
          if (dt === D_GALLERY || dt === D_METRO_RAIL || dt === D_CRYPT) {
            bestD2 = d2;
            bestGx = x;
            bestGy = y;
          }
        }
      }
      if (bestGx !== -1) {
        // Carve an orthogonal L-shaped dungeon drift connecting chamber to collector gallery!
        carveDungeonLine(cx, cy, bestGx, cy, D_GALLERY, 0);
        carveDungeonLine(bestGx, cy, bestGx, bestGy, D_GALLERY, 0);
      }
    };

    // 8A. Base foundation cellars, collector galleries beneath urban/village streets & landmark crypts
    for (let gy = 2; gy < GRID_SIZE - 2; gy++) {
      const rowOff = gy * GRID_SIZE;
      for (let gx = 2; gx < GRID_SIZE - 2; gx++) {
        const idx = rowOff + gx;
        const t = grid[idx];
        const settle = settlementGrid[idx];
        const isInhabited = settle !== SETTLE_RURAL;

        if (t === T_BUILDING) {
          dungeonGrid[idx] = D_CELLAR;
        } else if (t === T_STEPS) {
          dungeonGrid[idx] = D_STAIRS;
        } else if (t === T_MAIN_ROAD && isInhabited) {
          dungeonGrid[idx] = D_GALLERY;
        } else if ((t === T_STREET || t === T_PLAZA) && isInhabited) {
          // Collector galleries follow inhabited streets & town squares
          dungeonGrid[idx] = D_GALLERY;
        }
      }
    }

    // Stamp sacred crypts / casemates beneath real architectural landmarks
    for (const st of landmarkStamps) {
      const chamberCode =
        st.kind === 'church' || st.kind === 'castle' || st.kind === 'arena'
          ? D_CRYPT
          : st.kind === 'station'
          ? D_METRO_RAIL
          : D_CELLAR;
      const rx = Math.max(1, Math.ceil(st.w * 0.5));
      const ry = Math.max(1, Math.ceil(st.h * 0.5));
      for (let y = st.gy - ry; y <= st.gy + ry; y++) {
        for (let x = st.gx - rx; x <= st.gx + rx; x++) {
          carveDungeonCell(x, y, chamberCode, true);
        }
      }
      carveDungeonCell(st.gx, Math.min(GRID_SIZE - 3, st.gy + ry), D_STAIRS, true);
    }

    // 8B. Stamp REAL Subterranean Vector Lines (MVT road tunnels, subway lines, culverted rivers/canals)
    for (const sf of subterranean) {
      if (!sf.isLine || sf.points.length < 2) continue;
      const pts = sf.points.map((p) => toGridFloat(p.lat, p.lng));
      const lineCode =
        sf.kind === 'underground_water'
          ? D_SUB_WATER
          : sf.kind === 'subway'
          ? D_METRO_RAIL
          : D_GALLERY;
      const borderCode = sf.kind === 'underground_water' ? D_GALLERY : D_ROCK;
      const halfW = tileMeters <= 15 ? 1 : 0;
      for (let i = 0; i < pts.length - 1; i++) {
        carveDungeonLine(
          pts[i].gx,
          pts[i].gy,
          pts[i + 1].gx,
          pts[i + 1].gy,
          lineCode,
          halfW,
          borderCode
        );
      }
      // Stamp tunnel portals (stairs/archways) at start & end of road/pedestrian tunnels
      if (sf.kind === 'tunnel_road') {
        carveDungeonCell(Math.round(pts[0].gx), Math.round(pts[0].gy), D_STAIRS, true);
        const last = pts[pts.length - 1];
        carveDungeonCell(Math.round(last.gx), Math.round(last.gy), D_STAIRS, true);
      }
    }

    // 8C. Stamp REAL Mapped Cavities (BRGM BDCavités, IGN caves/chasms, BSS aquifers, OSM quarries/mines/portals)
    for (let sIdx = 0; sIdx < subterranean.length; sIdx++) {
      const sf = subterranean[sIdx];
      if (sf.isLine || sf.points.length === 0) continue;
      const gp = toGridFloat(sf.points[0].lat, sf.points[0].lng);
      const cx = Math.round(gp.gx);
      const cy = Math.round(gp.gy);
      if (cx < 3 || cx >= GRID_SIZE - 3 || cy < 3 || cy >= GRID_SIZE - 3) continue;

      if (sf.kind === 'quarry' || sf.kind === 'mine') {
        const rad = Math.max(2, Math.min(5, Math.round(28 / tileMeters)));
        carveOrganicChamber(cx, cy, rad + 1, rad, D_QUARRY_HALL, sIdx * 13 + 7);
        connectChamberToNearestGallery(cx, cy, 11);
        if (sf.kind === 'mine') {
          carveDungeonCell(cx, cy, D_STAIRS, true);
        }
      } else if (sf.kind === 'natural_cave') {
        const rad = Math.max(2, Math.min(5, Math.round(25 / tileMeters)));
        carveOrganicChamber(cx, cy, rad, rad + 1, D_NATURAL_CAVERN, sIdx * 19 + 3);
        carveDungeonCell(cx - 1, cy, D_SUB_WATER, true);
        carveDungeonCell(cx, cy + 1, D_STAIRS, true);
        connectChamberToNearestGallery(cx, cy, 9);
      } else if (sf.kind === 'crypt' || sf.kind === 'military') {
        const rad = Math.max(2, Math.min(4, Math.round(20 / tileMeters)));
        for (let dy = -rad; dy <= rad; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            carveDungeonCell(cx + dx, cy + dy, D_CRYPT, true);
          }
        }
        carveDungeonCell(cx, cy + rad, D_STAIRS, true);
        connectChamberToNearestGallery(cx, cy, 10);
      } else if (sf.kind === 'well_aquifer') {
        const rad = Math.max(1, Math.min(3, Math.round(16 / tileMeters)));
        carveOrganicChamber(cx, cy, rad + 1, rad + 1, D_GALLERY, sIdx * 11);
        carveOrganicChamber(cx, cy, Math.max(1, rad - 1), Math.max(1, rad - 1), D_SUB_WATER, sIdx * 7);
        connectChamberToNearestGallery(cx, cy, 8);
      } else if (sf.kind === 'portal') {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            carveDungeonCell(cx + dx, cy + dy, D_GALLERY, false);
          }
        }
        carveDungeonCell(cx, cy, D_STAIRS, true);
      } else {
        // cave_cellar
        const rad = Math.max(1, Math.min(3, Math.round(16 / tileMeters)));
        carveOrganicChamber(cx, cy, rad, rad, D_CELLAR, sIdx * 23);
        connectChamberToNearestGallery(cx, cy, 8);
      }
    }

    // 8D. Ensure every Subterranean POI sits inside a walkable carved chamber connected to the gallery network!
    for (let pIdx = 0; pIdx < subterraneanPois.length; pIdx++) {
      const sp = subterraneanPois[pIdx];
      const gp = toGridFloat(sp.lat, sp.lng);
      const cx = Math.round(gp.gx);
      const cy = Math.round(gp.gy);
      if (cx < 3 || cx >= GRID_SIZE - 3 || cy < 3 || cy >= GRID_SIZE - 3) continue;
      const chamberCode =
        sp.category === 'histoire'
          ? D_CRYPT
          : sp.nearWaterway
          ? D_NATURAL_CAVERN
          : sp.category === 'geographie'
          ? D_NATURAL_CAVERN
          : D_QUARRY_HALL;
      carveOrganicChamber(cx, cy, 2, 2, chamberCode, pIdx * 17 + 5);
      connectChamberToNearestGallery(cx, cy, 14);
    }

    return {
      grid,
      dungeonGrid,
      bridgeModeGrid,
      bridgeAxisGrid,
      railMaskGrid,
      landmarkCellMask,
      landmarkAnchorIndex,
      landmarkStamps,
      bldgClassGrid,
      bldgLevelsGrid,
      settlementGrid,
      elevGrid,
      terraceGrid,
      hasRealElevation: elevGrid !== null,
      hasTerraces,
      elevMin,
      elevSpan,
      gridSize: GRID_SIZE,
      originWx,
      originWy,
      cosRef,
      hasRealTopology: terrain.length > 0,
    };
  }, [
    terrain,
    subterranean,
    surfacePois,
    subterraneanPois,
    pois,
    elevation,
    tileMeters,
    zoomLevel,
    anchorChunkWx,
    anchorChunkWy,
    cosRef,
  ]);

  // ==========================================================================
  // TOPOLOGICAL A* PATHFINDING (Follows real streets/bridges OR dungeon galleries!)
  // ==========================================================================
  const computeTopologicalWalkPath = useCallback(
    (
      destLat: number,
      destLng: number,
      startLatOverride?: number,
      startLngOverride?: number
    ): Array<{ lat: number; lng: number }> => {
      const sLat = startLatOverride ?? playerLat;
      const sLng = startLngOverride ?? playerLng;
      const {
        grid,
        dungeonGrid,
        bridgeModeGrid,
        gridSize,
        originWx,
        originWy,
        cosRef: cRef,
        hasRealTopology,
      } = worldMapData;
      if (!hasRealTopology && !subterraneanMode) return [{ lat: destLat, lng: destLng }];

      const sx = Math.round((sLng * 111320 * cRef) / tileMeters - originWx);
      const sy = Math.round((-sLat * 110540) / tileMeters - originWy);
      const tx = Math.round((destLng * 111320 * cRef) / tileMeters - originWx);
      const ty = Math.round((-destLat * 110540) / tileMeters - originWy);

      if (
        sx < 2 ||
        sx >= gridSize - 2 ||
        sy < 2 ||
        sy >= gridSize - 2 ||
        tx < 2 ||
        tx >= gridSize - 2 ||
        ty < 2 ||
        ty >= gridSize - 2 ||
        (sx === tx && sy === ty)
      ) {
        return [{ lat: destLat, lng: destLng }];
      }

      const cellCount = gridSize * gridSize;
      const gScore = new Float32Array(cellCount);
      gScore.fill(1e9);
      const cameFrom = new Int32Array(cellCount);
      cameFrom.fill(-1);
      const closed = new Uint8Array(cellCount);

      // Compact binary min-heap on fScore
      const heapNodes: number[] = [];
      const heapPriorities: number[] = [];
      const heapPush = (node: number, prio: number) => {
        heapNodes.push(node);
        heapPriorities.push(prio);
        let idx = heapNodes.length - 1;
        while (idx > 0) {
          const parent = (idx - 1) >> 1;
          if (heapPriorities[parent] <= heapPriorities[idx]) break;
          const tn = heapNodes[parent];
          const tp = heapPriorities[parent];
          heapNodes[parent] = heapNodes[idx];
          heapPriorities[parent] = heapPriorities[idx];
          heapNodes[idx] = tn;
          heapPriorities[idx] = tp;
          idx = parent;
        }
      };
      const heapPop = (): number => {
        const top = heapNodes[0];
        const lastN = heapNodes.pop()!;
        const lastP = heapPriorities.pop()!;
        if (heapNodes.length > 0) {
          heapNodes[0] = lastN;
          heapPriorities[0] = lastP;
          let idx = 0;
          const len = heapNodes.length;
          while (true) {
            const left = idx * 2 + 1;
            const right = left + 1;
            let smallest = idx;
            if (left < len && heapPriorities[left] < heapPriorities[smallest]) smallest = left;
            if (right < len && heapPriorities[right] < heapPriorities[smallest]) smallest = right;
            if (smallest === idx) break;
            const tn = heapNodes[smallest];
            const tp = heapPriorities[smallest];
            heapNodes[smallest] = heapNodes[idx];
            heapPriorities[smallest] = heapPriorities[idx];
            heapNodes[idx] = tn;
            heapPriorities[idx] = tp;
            idx = smallest;
          }
        }
        return top;
      };

      const startIdx = sy * gridSize + sx;
      const goalIdx = ty * gridSize + tx;
      gScore[startIdx] = 0;
      heapPush(startIdx, Math.hypot(tx - sx, ty - sy));

      const dirs = [
        [1, 0, 1],
        [-1, 0, 1],
        [0, 1, 1],
        [0, -1, 1],
        [1, 1, 1.414],
        [-1, 1, 1.414],
        [1, -1, 1.414],
        [-1, -1, 1.414],
      ];

      let bestFallbackIdx = startIdx;
      let bestFallbackDist = Math.hypot(tx - sx, ty - sy);
      let expanded = 0;
      const MAX_EXPANDED = 7500;
      let reached = false;

      while (heapNodes.length > 0 && expanded < MAX_EXPANDED) {
        const cur = heapPop();
        if (closed[cur]) continue;
        closed[cur] = 1;
        expanded++;

        if (cur === goalIdx) {
          reached = true;
          break;
        }

        const cx = cur % gridSize;
        const cy = Math.floor(cur / gridSize);
        const remDist = Math.hypot(tx - cx, ty - cy);
        if (remDist < bestFallbackDist) {
          bestFallbackDist = remDist;
          bestFallbackIdx = cur;
        }
        if (remDist <= 1.5) {
          bestFallbackIdx = cur;
          reached = true;
          break;
        }

        for (let d = 0; d < 8; d++) {
          const nx = cx + dirs[d][0];
          const ny = cy + dirs[d][1];
          if (nx < 1 || nx >= gridSize - 1 || ny < 1 || ny >= gridSize - 1) continue;
          const nIdx = ny * gridSize + nx;
          if (closed[nIdx]) continue;

          const nearEndpoints =
            Math.hypot(nx - sx, ny - sy) <= 1.8 || Math.hypot(nx - tx, ny - ty) <= 1.8;

          let weight = 1.85;
          if (subterraneanMode) {
            const dt = dungeonGrid[nIdx];
            if (
              dt === D_GALLERY ||
              dt === D_STAIRS ||
              dt === D_CRYPT ||
              dt === D_QUARRY_HALL ||
              dt === D_NATURAL_CAVERN
            ) {
              weight = 1.0;
            } else if (dt === D_METRO_RAIL || dt === D_CELLAR) {
              weight = 1.35;
            } else if (dt === D_SUB_WATER) {
              weight = nearEndpoints ? 3.5 : 8.5;
            } else {
              // Unexcavated geological rock
              weight = nearEndpoints ? 3.2 : 16.5;
            }
          } else {
            const tile = grid[nIdx];
            const bridge = bridgeModeGrid[nIdx];
            if (bridge !== B_NONE) {
              weight = 0.95; // Bridges & footbridges cross rivers effortlessly!
            } else if (tile === T_WATER) {
              if (!nearEndpoints) continue; // Open water is impassable without a bridge!
              weight = 6.0;
            } else if (
              tile === T_PATH ||
              tile === T_STREET ||
              tile === T_MAIN_ROAD ||
              tile === T_PLAZA ||
              tile === T_STEPS ||
              tile === T_PIER
            ) {
              weight = 1.0; // Streets, paths, plazas & stairs are preferred!
            } else if (tile === T_FOREST || tile === T_RAIL) {
              weight = 2.75;
            } else if (tile === T_BUILDING) {
              weight = nearEndpoints ? 2.5 : 19.0; // Route around buildings unless entering target monument
            }
          }

          const tentativeG = gScore[cur] + dirs[d][2] * weight;
          if (tentativeG < gScore[nIdx]) {
            cameFrom[nIdx] = cur;
            gScore[nIdx] = tentativeG;
            const h = Math.hypot(tx - nx, ty - ny) * 0.98;
            heapPush(nIdx, tentativeG + h);
          }
        }
      }

      const endIdx = reached && closed[goalIdx] ? goalIdx : bestFallbackIdx;
      if (endIdx === startIdx) {
        return [{ lat: destLat, lng: destLng }];
      }

      const rawCells: Array<{ gx: number; gy: number }> = [];
      let trace = endIdx;
      let guard = 0;
      while (trace !== -1 && trace !== startIdx && guard < 1200) {
        rawCells.push({ gx: trace % gridSize, gy: Math.floor(trace / gridSize) });
        trace = cameFrom[trace];
        guard++;
      }
      rawCells.reverse();

      const gridToLatLng = (gx: number, gy: number) => ({
        lat: -((originWy + gy + 0.5) * tileMeters) / 110540,
        lng: ((originWx + gx + 0.5) * tileMeters) / (111320 * cRef),
      });

      // Zoom-proportional waypoint spacing so tight 4.5x alleys and wide 0.5x valleys both flow naturally!
      const minStepMeters = Math.max(8, Math.min(88, Math.round(tileMeters * 1.45)));
      const tailSnapMeters = Math.max(4, Math.round(tileMeters * 0.65));

      const waypoints: Array<{ lat: number; lng: number }> = [];
      let lastKept = { lat: playerLat, lng: playerLng };
      for (let i = 0; i < rawCells.length; i++) {
        const pt = gridToLatLng(rawCells[i].gx, rawCells[i].gy);
        const stepDist = haversineMeters(lastKept.lat, lastKept.lng, pt.lat, pt.lng);
        if (stepDist >= minStepMeters || i === rawCells.length - 1) {
          waypoints.push(pt);
          lastKept = pt;
        }
      }

      if (
        waypoints.length === 0 ||
        haversineMeters(
          waypoints[waypoints.length - 1].lat,
          waypoints[waypoints.length - 1].lng,
          destLat,
          destLng
        ) > tailSnapMeters
      ) {
        waypoints.push({ lat: destLat, lng: destLng });
      }
      return waypoints;
    },
    [worldMapData, playerLat, playerLng, tileMeters, subterraneanMode]
  );

  // Handle programmatic walk route requests (single POI OR multi-stop chained expedition loop!)
  useEffect(() => {
    if (!routeRequest || routeRequest.id === handledRouteReqRef.current) return;
    handledRouteReqRef.current = routeRequest.id;
    const stops =
      routeRequest.stops && routeRequest.stops.length > 0
        ? routeRequest.stops
        : [{ lat: routeRequest.lat, lng: routeRequest.lng }];

    if (onPlanWalkRoute) {
      const chained: Array<{ lat: number; lng: number }> = [];
      let curLat = playerLat;
      let curLng = playerLng;
      for (const stop of stops) {
        const leg = computeTopologicalWalkPath(stop.lat, stop.lng, curLat, curLng);
        for (const pt of leg) {
          chained.push(pt);
        }
        curLat = stop.lat;
        curLng = stop.lng;
      }
      onPlanWalkRoute(chained);
    } else {
      onMapDestinationClick(routeRequest.lat, routeRequest.lng);
    }
  }, [routeRequest, playerLat, playerLng, computeTopologicalWalkPath, onPlanWalkRoute, onMapDestinationClick]);

  // Session-persistent registry so discovered NPCs NEVER vanish, jump, or swap places
  // when crossing chunk boundaries, additive sector fetches, or zoom levels!
  const persistentNpcsRef = useRef<Map<string, WorldNpc>>(new Map());
  const npcRegistryAnchorRef = useRef<{ lat: number; lng: number } | null>(null);

  const currentEffectiveTime = useMemo(
    () => resolveEffectiveTimeOfDay(timeMode, weather),
    [timeMode, weather]
  );

  // Spawn living 16-bit Humans, Animals & Insects inside fixed world-coordinate macro-blocks
  const chunkedWorldNpcs = useMemo(() => {
    const chunkCenterLat = -((worldMapData.originWy + worldMapData.gridSize * 0.5) * tileMeters) / 110540;
    const chunkCenterLng =
      ((worldMapData.originWx + worldMapData.gridSize * 0.5) * tileMeters) /
      (111320 * worldMapData.cosRef);
    return spawnWorldNpcs({
      grid: worldMapData.grid,
      dungeonGrid: worldMapData.dungeonGrid,
      settlementGrid: worldMapData.settlementGrid,
      elevGrid: worldMapData.elevGrid,
      elevMin: worldMapData.elevMin,
      elevSpan: worldMapData.elevSpan,
      gridSize: worldMapData.gridSize,
      originWx: worldMapData.originWx,
      originWy: worldMapData.originWy,
      tileMeters,
      cosRef: worldMapData.cosRef,
      centerLat: chunkCenterLat,
      centerLng: chunkCenterLng,
      pois: surfacePois || pois,
      subterraneanPois,
      terrain,
      subterranean,
      bedrock: bedrock || null,
      elevation,
      weather,
      effectiveTime: currentEffectiveTime,
    });
  }, [
    worldMapData,
    tileMeters,
    surfacePois,
    subterraneanPois,
    pois,
    terrain,
    subterranean,
    bedrock,
    elevation,
    weather,
    currentEffectiveTime,
  ]);

  const worldNpcs = useMemo(() => {
    const registry = persistentNpcsRef.current;
    const prevAnchor = npcRegistryAnchorRef.current;
    // Only reset registry on long-distance teleport to another town/region (>= 2.8 km)
    if (prevAnchor && haversineMeters(prevAnchor.lat, prevAnchor.lng, playerLat, playerLng) >= 2800) {
      registry.clear();
    }
    npcRegistryAnchorRef.current = { lat: playerLat, lng: playerLng };

    // Prune very distant entries (> 3.4 km) or fauna inactive under current weather/circadian phase
    for (const [id, existing] of registry.entries()) {
      if (
        haversineMeters(playerLat, playerLng, existing.lat, existing.lng) > 3400 ||
        !isNpcActiveInConditions(existing.kind, existing.isSubterranean, currentEffectiveTime, weather)
      ) {
        registry.delete(id);
      }
    }

    for (const npc of chunkedWorldNpcs) {
      const existing = registry.get(npc.id);
      if (existing) {
        // Keep exact coordinates, identity & sprite facing locked; refresh dialogues for weather/evening shifts
        if (npc.dialogues.length > 0) {
          registry.set(npc.id, { ...existing, dialogues: npc.dialogues });
        }
        continue;
      }

      const minClearanceM = npc.id.startsWith('npc_surf_duo_') ? 12 : 72;
      let tooClose = false;
      for (const kept of registry.values()) {
        if (kept.isSubterranean !== npc.isSubterranean) continue;
        if (haversineMeters(kept.lat, kept.lng, npc.lat, npc.lng) < minClearanceM) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) {
        registry.set(npc.id, npc);
      }
    }

    return Array.from(registry.values());
  }, [chunkedWorldNpcs, playerLat, playerLng, currentEffectiveTime, weather]);

  const layerNpcs = useMemo(
    () => worldNpcs.filter((n) => n.isSubterranean === subterraneanMode),
    [worldNpcs, subterraneanMode]
  );

  // World-locked Botanical Herbarium Tufts & Real-Bedrock Geological Hand-Specimens
  const worldSpecimens = useMemo(() => {
    return spawnWorldSpecimens({
      grid: worldMapData.grid,
      dungeonGrid: worldMapData.dungeonGrid,
      elevGrid: worldMapData.elevGrid,
      elevMin: worldMapData.elevMin,
      elevSpan: worldMapData.elevSpan,
      gridSize: worldMapData.gridSize,
      originWx: worldMapData.originWx,
      originWy: worldMapData.originWy,
      tileMeters,
      cosRef: worldMapData.cosRef,
      pois: surfacePois || pois,
      subterraneanPois,
      terrain,
      bedrock: bedrock || null,
      elevation,
    });
  }, [
    worldMapData,
    tileMeters,
    surfacePois,
    subterraneanPois,
    pois,
    terrain,
    bedrock,
    elevation,
  ]);

  const layerSpecimens = useMemo(
    () =>
      worldSpecimens.filter(
        (s) => s.isSubterranean === subterraneanMode && !harvestedNodeIds?.has(s.nodeId)
      ),
    [worldSpecimens, subterraneanMode, harvestedNodeIds]
  );

  // Real Surface <-> Sous-sol stairwell portals derived from real subterranean entrances & landmarks
  const portalAnchors = useMemo(() => {
    const out: Array<{ id: string; name: string; lat: number; lng: number }> = [];
    for (const sf of subterranean) {
      if (sf.points.length === 0) continue;
      if (
        sf.kind === 'portal' ||
        sf.kind === 'natural_cave' ||
        sf.kind === 'crypt' ||
        sf.kind === 'quarry' ||
        sf.kind === 'mine' ||
        sf.kind === 'tunnel_road'
      ) {
        const pt = sf.points[0];
        if (!out.some((p) => haversineMeters(p.lat, p.lng, pt.lat, pt.lng) < 95)) {
          out.push({ id: `portal_${sf.id}`, name: sf.name || 'Accès souterrain', lat: pt.lat, lng: pt.lng });
        }
      }
      if (out.length >= 10) break;
    }
    return out;
  }, [subterranean]);

  const nearestPortal = useMemo(() => {
    let best: { id: string; name: string; lat: number; lng: number; dist: number } | null = null;
    for (const p of portalAnchors) {
      const d = haversineMeters(playerLat, playerLng, p.lat, p.lng);
      if (d <= 54 && (!best || d < best.dist)) {
        best = { ...p, dist: Math.round(d) };
      }
    }
    return best;
  }, [portalAnchors, playerLat, playerLng]);

  const activeLayerRumors = useMemo(
    () =>
      rumorLeads.filter(
        (r) => !r.verified && Boolean(r.isSubterranean) === Boolean(subterraneanMode)
      ),
    [rumorLeads, subterraneanMode]
  );

  const activeDialogueRumor = useMemo(() => {
    if (!activeNpcDialogue?.npc || !activeNpcDialogue.npc.isHuman) return null;
    return buildNpcRumorOffer(activeNpcDialogue.npc, {
      surfacePois: surfacePois || pois.filter((p) => !p.isSubterranean),
      subterraneanPois: subterraneanPois || pois.filter((p) => p.isSubterranean),
      portalAnchors,
      unlockedIds,
    });
  }, [activeNpcDialogue, surfacePois, subterraneanPois, pois, portalAnchors, unlockedIds]);

  const activeDialogueRumorExisting = useMemo(() => {
    if (!activeDialogueRumor) return null;
    return rumorLeads.find((r) => r.id === activeDialogueRumor.id) || null;
  }, [activeDialogueRumor, rumorLeads]);

  // Discrete parchment micro-labels for real named rivers, forests, parks & plazas
  const namedPlaceLabels = useMemo(() => {
    const seen = new Set<string>();
    const items: Array<{ name: string; kind: TerrainFeature['kind']; lat: number; lng: number }> = [];
    for (const f of terrain) {
      if (
        f.kind !== 'water' &&
        f.kind !== 'waterway' &&
        f.kind !== 'forest' &&
        f.kind !== 'park' &&
        f.kind !== 'plaza'
      ) {
        continue;
      }
      const n = (f.name || '').trim();
      if (n.length < 3 || n.length > 28 || seen.has(n.toLowerCase()) || f.points.length === 0) continue;
      const mid = f.points[Math.floor(f.points.length / 2)];
      if (items.some((it) => haversineMeters(it.lat, it.lng, mid.lat, mid.lng) < 180)) continue;
      seen.add(n.toLowerCase());
      items.push({ name: n, kind: f.kind, lat: mid.lat, lng: mid.lng });
      if (items.length >= 6) break;
    }
    return items;
  }, [terrain]);

  // Detect current ground surface & nearby water for authentic 16-bit footstep audio
  useEffect(() => {
    if (!onPlayerSurfaceChange) return;
    const { grid, dungeonGrid, bridgeModeGrid, gridSize, originWx, originWy, cosRef: cRef } =
      worldMapData;
    const gx = Math.round((playerLng * 111320 * cRef) / tileMeters - originWx);
    const gy = Math.round((-playerLat * 110540) / tileMeters - originWy);
    let surface: SurfaceType = 'stone';
    let nearWater = false;

    if (gx >= 1 && gx < gridSize - 1 && gy >= 1 && gy < gridSize - 1) {
      const idx = gy * gridSize + gx;
      if (subterraneanMode) {
        const dt = dungeonGrid[idx];
        surface = dt === D_NATURAL_CAVERN || dt === D_QUARRY_HALL ? 'gravel' : 'stone';
        for (let dy = -1; dy <= 1 && !nearWater; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ndt = dungeonGrid[(gy + dy) * gridSize + (gx + dx)];
            if (ndt === D_SUB_WATER || ndt === D_NATURAL_CAVERN) {
              nearWater = true;
              break;
            }
          }
        }
      } else {
        const t = grid[idx];
        const b = bridgeModeGrid[idx];
        if (b !== B_NONE || t === T_PIER) {
          surface = 'wood';
        } else if (t === T_PATH || t === T_CEMETERY) {
          surface = 'gravel';
        } else if (
          t === T_STREET ||
          t === T_MAIN_ROAD ||
          t === T_PLAZA ||
          t === T_INDUSTRIAL ||
          t === T_COMMERCIAL ||
          t === T_STEPS ||
          t === T_BUILDING
        ) {
          surface = 'stone';
        } else {
          surface = 'grass';
        }

        for (let dy = -1; dy <= 1 && !nearWater; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (grid[(gy + dy) * gridSize + (gx + dx)] === T_WATER) {
              nearWater = true;
              break;
            }
          }
        }
      }
    }

    if (
      lastSurfaceRef.current.surface !== surface ||
      lastSurfaceRef.current.nearWater !== nearWater
    ) {
      lastSurfaceRef.current = { surface, nearWater };
      onPlayerSurfaceChange(surface, nearWater);
    }
  }, [playerLat, playerLng, worldMapData, tileMeters, subterraneanMode, onPlayerSurfaceChange]);

  const effectivePlayerLat = visualCam.lat;
  const effectivePlayerLng = visualCam.lng;
  const effectivePanEast = isDraggingMap ? panMeters.east : visualCam.panEast;
  const effectivePanNorth = isDraggingMap ? panMeters.north : visualCam.panNorth;
  const camLat = effectivePlayerLat + effectivePanNorth / 110540;
  const camLng = effectivePlayerLng + effectivePanEast / (111320 * worldMapData.cosRef);
  const isPannedAway = Math.hypot(panMeters.east, panMeters.north) > 12;

  const poiById = useMemo(() => {
    const map = new Map<string, PoiItem>();
    for (const p of pois) map.set(p.id, p);
    return map;
  }, [pois]);

  const projectToVirtual = useCallback(
    (lat: number, lng: number): { vx: number; vy: number } => {
      const dxMeters = (lng - camLng) * 111320 * worldMapData.cosRef;
      const dyMeters = (camLat - lat) * 110540;
      return {
        vx: Math.round(VW / 2 + dxMeters / metersPerVirtualPx),
        vy: Math.round(VH / 2 + dyMeters / metersPerVirtualPx),
      };
    },
    [camLat, camLng, worldMapData.cosRef, VW, VH, metersPerVirtualPx]
  );

  const unprojectFromScreen = useCallback(
    (
      clientX: number,
      clientY: number
    ): { lat: number; lng: number; vx: number; vy: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const vx = ((clientX - rect.left) / rect.width) * VW;
      const vy = ((clientY - rect.top) / rect.height) * VH;
      const dxMeters = (vx - VW / 2) * metersPerVirtualPx;
      const dyMeters = (vy - VH / 2) * metersPerVirtualPx;
      return {
        lat: camLat - dyMeters / 110540,
        lng: camLng + dxMeters / (111320 * worldMapData.cosRef),
        vx,
        vy,
      };
    },
    [VW, VH, metersPerVirtualPx, camLat, camLng, worldMapData.cosRef]
  );

  const filteredPois = useMemo(() => {
    const list = pois.filter(
      (p) =>
        (categoryFilter === 'all' || p.category === categoryFilter) &&
        (stratumFilter === 'all' || p.stratum === stratumFilter)
    );
    return [...list].sort((a, b) => {
      const aTop = a.id === selectedPoiId ? 1 : 0;
      const bTop = b.id === selectedPoiId ? 1 : 0;
      if (aTop !== bTop) return aTop - bTop;

      const aUndisc = unlockedIds.has(a.id) ? 0 : 1;
      const bUndisc = unlockedIds.has(b.id) ? 0 : 1;
      if (aUndisc !== bUndisc) return aUndisc - bUndisc;

      return b.lat - a.lat;
    });
  }, [pois, categoryFilter, stratumFilter, selectedPoiId, unlockedIds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const atlas = getOrCreateSnesAtlas();

    let offscreen = frameCanvasRef.current;
    if (!offscreen) {
      offscreen = document.createElement('canvas');
      frameCanvasRef.current = offscreen;
    }
    if (offscreen.width !== VW) offscreen.width = VW;
    if (offscreen.height !== VH) offscreen.height = VH;
    const pctx = offscreen.getContext('2d');
    if (!pctx) return;
    pctx.imageSmoothingEnabled = false;

    const {
      grid,
      dungeonGrid,
      bridgeModeGrid,
      bridgeAxisGrid,
      railMaskGrid,
      landmarkCellMask,
      landmarkAnchorIndex,
      landmarkStamps,
      bldgClassGrid,
      bldgLevelsGrid,
      settlementGrid,
      elevGrid,
      terraceGrid,
      hasRealElevation,
      hasTerraces,
      elevMin,
      elevSpan,
      gridSize,
      originWx,
      originWy,
      hasRealTopology,
    } = worldMapData;

    const worldPxX = Math.round((camLng * 111320 * worldMapData.cosRef) / metersPerVirtualPx);
    const worldPxY = Math.round((-camLat * 110540) / metersPerVirtualPx);

    const offsetX = worldPxX - Math.floor(VW / 2);
    const offsetY = worldPxY - Math.floor(VH / 2);

    const startWx = Math.floor(offsetX / TILE) - 2;
    const endWx = Math.ceil((offsetX + VW) / TILE) + 2;
    const startWy = Math.floor(offsetY / TILE) - 2;
    const endWy = Math.ceil((offsetY + VH) / TILE) + 3;

    const getTileAt = (wx: number, wy: number): number => {
      const gx = wx - originWx;
      const gy = wy - originWy;
      if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize) {
        return grid[gy * gridSize + gx];
      }
      if (!hasRealTopology) {
        const wave = Math.sin(wx * 0.15) + Math.cos(wy * 0.14);
        if (wave > 1.42) return T_FOREST;
        if (wave < -1.42) return T_FARMLAND;
      }
      return T_MEADOW;
    };

    const getSettlementAt = (wx: number, wy: number): number => {
      const gx = wx - originWx;
      const gy = wy - originWy;
      if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize) {
        return settlementGrid[gy * gridSize + gx];
      }
      return SETTLE_RURAL;
    };

    const getBldgClassAt = (wx: number, wy: number): number => {
      const gx = wx - originWx;
      const gy = wy - originWy;
      if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize) {
        return bldgClassGrid[gy * gridSize + gx];
      }
      return BC_NONE;
    };

    const getBldgLevelsAt = (wx: number, wy: number): number => {
      const gx = wx - originWx;
      const gy = wy - originWy;
      if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize) {
        return bldgLevelsGrid[gy * gridSize + gx];
      }
      return 0;
    };

    const getBridgeModeAt = (wx: number, wy: number): number => {
      const gx = wx - originWx;
      const gy = wy - originWy;
      if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize) {
        return bridgeModeGrid[gy * gridSize + gx];
      }
      return B_NONE;
    };

    const getBridgeAxisAt = (wx: number, wy: number): number => {
      const gx = wx - originWx;
      const gy = wy - originWy;
      if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize) {
        return bridgeAxisGrid[gy * gridSize + gx];
      }
      return AXIS_HORIZ;
    };

    const hasRailAt = (wx: number, wy: number): boolean => {
      const gx = wx - originWx;
      const gy = wy - originWy;
      if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize) {
        return railMaskGrid[gy * gridSize + gx] === 1;
      }
      return false;
    };

    const isLandmarkCellAt = (wx: number, wy: number): boolean => {
      const gx = wx - originWx;
      const gy = wy - originWy;
      if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize) {
        return landmarkCellMask[gy * gridSize + gx] === 1;
      }
      return false;
    };

    const getLandmarkAnchorAt = (wx: number, wy: number): LandmarkStamp | null => {
      const gx = wx - originWx;
      const gy = wy - originWy;
      if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize) {
        const idx1 = landmarkAnchorIndex[gy * gridSize + gx];
        if (idx1 > 0 && idx1 - 1 < landmarkStamps.length) {
          return landmarkStamps[idx1 - 1];
        }
      }
      return null;
    };

    const getElevAt = (wx: number, wy: number): number => {
      if (!elevGrid) return 0;
      const gx = Math.max(0, Math.min(gridSize - 1, wx - originWx));
      const gy = Math.max(0, Math.min(gridSize - 1, wy - originWy));
      return elevGrid[gy * gridSize + gx];
    };

    const getTerraceAt = (wx: number, wy: number): number => {
      if (!terraceGrid) return 0;
      const gx = Math.max(0, Math.min(gridSize - 1, wx - originWx));
      const gy = Math.max(0, Math.min(gridSize - 1, wy - originWy));
      return terraceGrid[gy * gridSize + gx];
    };

    const getDungeonAt = (wx: number, wy: number): number => {
      const gx = wx - originWx;
      const gy = wy - originWy;
      if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize) {
        return dungeonGrid[gy * gridSize + gx];
      }
      return D_ROCK;
    };

    const envTick = Math.floor(animTick / 4);
    const sway = envTick % 6 < 3 ? 0 : 1;

    let worldLayer = worldLayerCanvasRef.current;
    if (!worldLayer) {
      worldLayer = document.createElement('canvas');
      worldLayerCanvasRef.current = worldLayer;
    }

    // Overscan 6-tile (96 virtual px) margin around viewport so 60fps smooth camera glides
    // slice `worldLayer` in <0.1ms without re-rasterizing 1,000+ tiles on every pixel!
    const LAYER_PAD_TILES = 6;
    const LAYER_PAD_PX = LAYER_PAD_TILES * TILE;
    const layerW = VW + LAYER_PAD_PX * 2;
    const layerH = VH + LAYER_PAD_PX * 2;
    const currentBaseWx = Math.floor(offsetX / TILE);
    const currentBaseWy = Math.floor(offsetY / TILE);
    if (
      !layerAnchorRef.current.initialized ||
      Math.abs(currentBaseWx - layerAnchorRef.current.wx) > LAYER_PAD_TILES - 2 ||
      Math.abs(currentBaseWy - layerAnchorRef.current.wy) > LAYER_PAD_TILES - 2
    ) {
      layerAnchorRef.current = { wx: currentBaseWx, wy: currentBaseWy, initialized: true };
    }
    const anchorWx = layerAnchorRef.current.wx;
    const anchorWy = layerAnchorRef.current.wy;
    const layerOriginPxX = anchorWx * TILE - LAYER_PAD_PX;
    const layerOriginPxY = anchorWy * TILE - LAYER_PAD_PX;
    const layerStartWx = Math.floor(layerOriginPxX / TILE) - 2;
    const layerEndWx = Math.ceil((layerOriginPxX + layerW) / TILE) + 2;
    const layerStartWy = Math.floor(layerOriginPxY / TILE) - 2;
    const layerEndWy = Math.ceil((layerOriginPxY + layerH) / TILE) + 3;

    const lithoKey = bedrock?.lithology ? bedrock.lithology.slice(0, 18) : 'std';
    const staticCacheKey = `${layerW}_${layerH}_${anchorWx}_${anchorWy}_${
      subterraneanMode ? 'sub' : 'surf'
    }_${lithoKey}_${reliefEnabled ? 1 : 0}_${subtleBuildings ? 1 : 0}_${envTick}`;

    if (
      worldLayer.width !== layerW ||
      worldLayer.height !== layerH ||
      worldLayerKeyRef.current.mapRef !== worldMapData ||
      worldLayerKeyRef.current.key !== staticCacheKey
    ) {
      if (worldLayer.width !== layerW) worldLayer.width = layerW;
      if (worldLayer.height !== layerH) worldLayer.height = layerH;
      const wctx = worldLayer.getContext('2d');
      if (wctx) {
        wctx.imageSmoothingEnabled = false;
        const pctx = wctx;
        const blitAtlas = (row: number, col: number, dx: number, dy: number) => {
          pctx.drawImage(atlas, (col & 3) * 16, row * 16, 16, 16, dx, dy, 16, 16);
        };

        // Pure 16-bit Bayer/Checkerboard NW (315°) Hillshading Stamp
        const applyDitheredHillshade = (wx: number, wy: number, sx: number, sy: number): number => {
          if (!reliefEnabled || !hasRealElevation) return 0;
          const dzdx = (getElevAt(wx + 1, wy) - getElevAt(wx - 1, wy)) / (2 * tileMeters);
          const dzdy = (getElevAt(wx, wy + 1) - getElevAt(wx, wy - 1)) / (2 * tileMeters);
          const sunDot = 0.7071 * (dzdx + dzdy);
          if (sunDot > 0.085) {
            blitAtlas(ATLAS_ROW_HILLSHADE, 1, sx, sy);
          } else if (sunDot > 0.028) {
            blitAtlas(ATLAS_ROW_HILLSHADE, 0, sx, sy);
          } else if (sunDot < -0.085) {
            blitAtlas(ATLAS_ROW_HILLSHADE, 3, sx, sy);
          } else if (sunDot < -0.028) {
            blitAtlas(ATLAS_ROW_HILLSHADE, 2, sx, sy);
          }
          return Math.hypot(dzdx, dzdy);
        };

        if (subterraneanMode) {
          // ==================================================================
          // SUBTERRANEAN "SOUS-SOL / DONJON" 16-BIT CARTOGRAPHIC RENDERER
          // ==================================================================
          const lithoText = `${bedrock?.lithology || ''} ${bedrock?.environment || ''}`.toLowerCase();
          const rockTheme = /granit|gneiss|schist|basalt|volcan|cristal|métamorph/.test(lithoText)
            ? {
                base: '#19212e',
                dark: '#0f151f',
                mid: '#263245',
                wallFace: '#38475e',
                wallTop: '#64748b',
                vein: '#94a3b8',
              }
            : /gr[èe]s|sable|quartzit|ferrug/.test(lithoText)
            ? {
                base: '#2b1913',
                dark: '#190d09',
                mid: '#42261d',
                wallFace: '#633829',
                wallTop: '#9a5b42',
                vein: '#d97706',
              }
            : {
                // Default Lutetian limestone / karst / chalk / marl ochre-stone
                base: '#251c13',
                dark: '#140e09',
                mid: '#382a1c',
                wallFace: '#57422c',
                wallTop: '#8a6d4b',
                vein: '#b8976c',
              };

          for (let wy = layerStartWy; wy <= layerEndWy; wy++) {
            for (let wx = layerStartWx; wx <= layerEndWx; wx++) {
              const sx = wx * TILE - layerOriginPxX;
              const sy = wy * TILE - layerOriginPxY;
              const dt = getDungeonAt(wx, wy);
              const h = tileHash(wx, wy);
              const surfT = getTileAt(wx, wy);

              if (dt === D_ROCK) {
                // Solid geological bedrock matrix with stratified joints & mineral flecks
                pctx.fillStyle = rockTheme.base;
                pctx.fillRect(sx, sy, TILE, TILE);

                if ((wx + wy) % 2 === 0) {
                  pctx.fillStyle = rockTheme.mid;
                  pctx.fillRect(sx + (h % 5), sy + ((h >> 3) % 6), 6, 3);
                  pctx.fillRect(sx + 7, sy + 9 + (h % 4), 7, 3);
                } else {
                  pctx.fillStyle = rockTheme.dark;
                  pctx.fillRect(sx + 2, sy + 4, 8, 2);
                  pctx.fillRect(sx + 5, sy + 12, 7, 2);
                }
                if (h % 13 === 0) {
                  // Subtle fossil ammonite / quartz crystal glint inside unexcavated rock
                  pctx.fillStyle = rockTheme.vein;
                  pctx.fillRect(sx + 5 + (h % 5), sy + 5 + ((h >> 2) % 5), 2, 2);
                }

                // Faint hydrographic seepage trace when a surface river flows overhead
                if (surfT === T_WATER) {
                  pctx.fillStyle = 'rgba(14, 116, 144, 0.24)';
                  pctx.fillRect(sx, sy, TILE, TILE);
                  if ((wx + wy + envTick) % 5 === 0) {
                    pctx.fillStyle = '#38bdf8';
                    pctx.fillRect(sx + 7, sy + 7, 2, 2);
                  }
                }

                const nDt = getDungeonAt(wx, wy - 1);
                const sDt = getDungeonAt(wx, wy + 1);
                const wDt = getDungeonAt(wx - 1, wy);
                const eDt = getDungeonAt(wx + 1, wy);

                // 3/4 Perspective Chiseled Stone Dungeon Wall Face when open chamber/gallery lies South!
                if (sDt !== D_ROCK) {
                  pctx.fillStyle = rockTheme.wallTop;
                  pctx.fillRect(sx, sy, TILE, 3);
                  pctx.fillStyle = rockTheme.wallFace;
                  pctx.fillRect(sx, sy + 3, TILE, 10);
                  // Ashlar mortar courses
                  pctx.fillStyle = rockTheme.dark;
                  pctx.fillRect(sx, sy + 7, TILE, 1);
                  pctx.fillRect(sx, sy + 11, TILE, 1);
                  pctx.fillRect(sx + 7, sy + 3, 1, 4);
                  pctx.fillRect(sx + 3, sy + 8, 1, 3);
                  pctx.fillRect(sx + 12, sy + 8, 1, 3);
                  // Deep basal wall shadow
                  pctx.fillStyle = '#0d0805';
                  pctx.fillRect(sx, sy + 13, TILE, 3);

                  // Animated 16-bit Wall Torch Sconce along dungeon corridors!
                  if ((wx * 5 + wy * 3) % 6 === 0) {
                    const flicker = (envTick + wx) % 2 === 0;
                    pctx.fillStyle = '#29180d';
                    pctx.fillRect(sx + 7, sy + 7, 2, 4);
                    pctx.fillStyle = flicker ? '#fb923c' : '#f59e0b';
                    pctx.fillRect(sx + 6, sy + 4, 4, 3);
                    pctx.fillStyle = '#fef08a';
                    pctx.fillRect(sx + 7, sy + (flicker ? 3 : 4), 2, 2);
                  }
                } else {
                  if (nDt !== D_ROCK) {
                    pctx.fillStyle = '#0d0805';
                    pctx.fillRect(sx, sy, TILE, 2);
                    pctx.fillStyle = rockTheme.wallTop;
                    pctx.fillRect(sx, sy + 2, TILE, 2);
                  }
                  if (wDt !== D_ROCK) {
                    pctx.fillStyle = '#0d0805';
                    pctx.fillRect(sx, sy, 2, TILE);
                    pctx.fillStyle = rockTheme.wallTop;
                    pctx.fillRect(sx + 2, sy, 2, TILE);
                  }
                  if (eDt !== D_ROCK) {
                    pctx.fillStyle = '#0d0805';
                    pctx.fillRect(sx + TILE - 2, sy, 2, TILE);
                    pctx.fillStyle = rockTheme.wallTop;
                    pctx.fillRect(sx + TILE - 4, sy, 2, TILE);
                  }
                }
                continue;
              }

              // ==============================================================
              // EXCAVATED DUNGEON FLOORS, TUNNELS, CAVITIES & CRYPTS
              // ==============================================================
              if (dt === D_SUB_WATER) {
                // Subterranean river, vaulted canal or phreatic aquifer pool
                pctx.fillStyle = '#082f49';
                pctx.fillRect(sx, sy, TILE, TILE);
                pctx.fillStyle = '#0c4a6e';
                pctx.fillRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
                const rip = (wx * 3 + wy * 5 + envTick) % 4;
                pctx.fillStyle = '#0284c7';
                pctx.fillRect(sx + 2 + rip, sy + 4, 6, 2);
                pctx.fillRect(sx + 6 - rip, sy + 11, 6, 2);
                pctx.fillStyle = '#7dd3fc';
                pctx.fillRect(sx + 3 + rip, sy + 4, 3, 1);

                // Masonry canal curbs against dry dungeon tiles
                if (getDungeonAt(wx, wy - 1) !== D_SUB_WATER) {
                  pctx.fillStyle = '#78716c';
                  pctx.fillRect(sx, sy, TILE, 2);
                }
                if (getDungeonAt(wx, wy + 1) !== D_SUB_WATER) {
                  pctx.fillStyle = '#57534e';
                  pctx.fillRect(sx, sy + TILE - 2, TILE, 2);
                }
              } else if (dt === D_METRO_RAIL) {
                // Iron-railed underground metro / railway gallery
                pctx.fillStyle = '#292524';
                pctx.fillRect(sx, sy, TILE, TILE);
                pctx.fillStyle = '#44403c';
                pctx.fillRect(sx + 1, sy + 1, TILE - 2, TILE - 2);

                const hasEW =
                  getDungeonAt(wx - 1, wy) === D_METRO_RAIL ||
                  getDungeonAt(wx + 1, wy) === D_METRO_RAIL;
                const hasNS =
                  getDungeonAt(wx, wy - 1) === D_METRO_RAIL ||
                  getDungeonAt(wx, wy + 1) === D_METRO_RAIL;

                pctx.fillStyle = '#57361a';
                if (hasNS && !hasEW) {
                  for (let ry = 1; ry < 15; ry += 4) pctx.fillRect(sx + 3, sy + ry, 10, 2);
                  pctx.fillStyle = '#cbd5e1';
                  pctx.fillRect(sx + 4, sy, 2, TILE);
                  pctx.fillRect(sx + 10, sy, 2, TILE);
                } else {
                  for (let rx = 1; rx < 15; rx += 4) pctx.fillRect(sx + rx, sy + 3, 2, 10);
                  pctx.fillStyle = '#cbd5e1';
                  pctx.fillRect(sx, sy + 4, TILE, 2);
                  pctx.fillRect(sx, sy + 10, TILE, 2);
                }
              } else if (dt === D_QUARRY_HALL) {
                // Pillared limestone quarry / mine gallery (BRGM BDCavités)
                pctx.fillStyle = '#8c7456';
                pctx.fillRect(sx, sy, TILE, TILE);
                pctx.fillStyle = '#a68b67';
                pctx.fillRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
                pctx.fillStyle = '#6e583f';
                pctx.fillRect(sx, sy + 7, TILE, 1);
                pctx.fillRect(sx + 8, sy, 1, TILE);

                // Chunky 16-bit square stone quarry support pillar every 2x2 interior grid!
                const surrounded =
                  getDungeonAt(wx, wy - 1) === D_QUARRY_HALL &&
                  getDungeonAt(wx, wy + 1) === D_QUARRY_HALL &&
                  getDungeonAt(wx - 1, wy) === D_QUARRY_HALL &&
                  getDungeonAt(wx + 1, wy) === D_QUARRY_HALL;
                if (surrounded && (wx & 1) === 0 && (wy & 1) === 0) {
                  pctx.fillStyle = '#1c130c';
                  pctx.fillRect(sx + 3, sy + 2, 10, 12);
                  pctx.fillStyle = '#d6c3a5';
                  pctx.fillRect(sx + 4, sy + 3, 8, 3);
                  pctx.fillStyle = '#9c8260';
                  pctx.fillRect(sx + 4, sy + 6, 8, 6);
                } else if (h % 9 === 0) {
                  // Hewn limestone block / mine timber prop
                  pctx.fillStyle = '#452712';
                  pctx.fillRect(sx + 4, sy + 5, 7, 5);
                  pctx.fillStyle = '#e7d8be';
                  pctx.fillRect(sx + 5, sy + 6, 5, 3);
                }
              } else if (dt === D_NATURAL_CAVERN) {
                // Organic karstic cavern / grotto with stalagmites & calcite crystals
                pctx.fillStyle = '#4a3b2c';
                pctx.fillRect(sx, sy, TILE, TILE);
                pctx.fillStyle = '#5e4c3a';
                pctx.fillRect(sx + 1, sy + 1, 14, 14);
                if ((wx + wy) % 2 === 0) {
                  pctx.fillStyle = '#3b2e22';
                  pctx.fillRect(sx + 3, sy + 9, 5, 3);
                }
                if (h % 5 === 0) {
                  // 16-bit conical stalagmite!
                  pctx.fillStyle = '#1f160f';
                  pctx.fillRect(sx + 5, sy + 11, 6, 2);
                  pctx.fillStyle = '#a89070';
                  pctx.fillRect(sx + 6, sy + 6, 4, 6);
                  pctx.fillStyle = '#e7d8c3';
                  pctx.fillRect(sx + 7, sy + 3, 2, 4);
                } else if (h % 11 === 0) {
                  // Luminescent turquoise rimstone / calcite crystal cluster
                  pctx.fillStyle = '#06b6d4';
                  pctx.fillRect(sx + 6, sy + 7, 4, 4);
                  pctx.fillStyle = '#cffafe';
                  pctx.fillRect(sx + 7, sy + 6, 2, 3);
                }
              } else if (dt === D_CRYPT) {
                // Ornate sacred crypt / casemate beneath historic monuments
                const checker = (wx + wy) & 1;
                pctx.fillStyle = checker ? '#4c4359' : '#3a3245';
                pctx.fillRect(sx, sy, TILE, TILE);
                pctx.fillStyle = '#241e2b';
                pctx.fillRect(sx, sy, TILE, 1);
                pctx.fillRect(sx, sy, 1, TILE);
                if (h % 11 === 0) {
                  // Carved stone sarcophagus / reliquary plinth
                  pctx.fillStyle = '#1b1521';
                  pctx.fillRect(sx + 3, sy + 4, 10, 8);
                  pctx.fillStyle = '#cbd5e1';
                  pctx.fillRect(sx + 4, sy + 5, 8, 6);
                  pctx.fillStyle = '#fbbf24';
                  pctx.fillRect(sx + 7, sy + 7, 2, 2);
                }
              } else if (dt === D_CELLAR) {
                // Vaulted cellar beneath real building footprints
                pctx.fillStyle = '#473325';
                pctx.fillRect(sx, sy, TILE, TILE);
                pctx.fillStyle = '#5c4230';
                pctx.fillRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
                pctx.fillStyle = '#36251a';
                pctx.fillRect(sx, sy + 8, TILE, 1);
                pctx.fillRect(sx + 8, sy, 1, TILE);
                if (h % 10 === 0) {
                  // Oak barrel / cellar crate
                  pctx.fillStyle = '#291509';
                  pctx.fillRect(sx + 4, sy + 5, 7, 6);
                  pctx.fillStyle = '#92400e';
                  pctx.fillRect(sx + 5, sy + 6, 5, 4);
                  pctx.fillStyle = '#d97706';
                  pctx.fillRect(sx + 6, sy + 6, 1, 4);
                }
              } else if (dt === D_STAIRS) {
                // 16-bit Descending / Ascending Dungeon Stone Staircase Portal!
                pctx.fillStyle = '#1c140d';
                pctx.fillRect(sx, sy, TILE, TILE);
                pctx.fillStyle = '#fbbf24';
                pctx.fillRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
                pctx.fillStyle = '#292018';
                pctx.fillRect(sx + 2, sy + 2, TILE - 4, TILE - 4);
                const stepColors = ['#d6d3d1', '#a8a29e', '#78716c', '#57534e'];
                for (let st = 0; st < 4; st++) {
                  pctx.fillStyle = stepColors[st];
                  pctx.fillRect(sx + 3, sy + 3 + st * 3, 10, 2);
                }
              } else {
                // D_GALLERY: Vaulted stone collector gallery / subterranean street passage
                pctx.fillStyle = '#5c4d3c';
                pctx.fillRect(sx, sy, TILE, TILE);
                pctx.fillStyle = '#73614d';
                pctx.fillRect(sx + 1, sy + 1, 6, 6);
                pctx.fillRect(sx + 9, sy + 1, 6, 6);
                pctx.fillRect(sx + 1, sy + 9, 6, 6);
                pctx.fillRect(sx + 9, sy + 9, 6, 6);
                // Central drainage rigole
                pctx.fillStyle = '#3d3226';
                pctx.fillRect(sx + 7, sy, 2, TILE);
                pctx.fillRect(sx, sy + 7, TILE, 2);
                if (surfT === T_WATER) {
                  // Vaulted gallery passing directly underneath a river!
                  pctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
                  pctx.fillRect(sx + 6, sy + 6, 4, 4);
                }
              }

              // Subtle top-shadow under northern rock wall for 3D depth!
              if (getDungeonAt(wx, wy - 1) === D_ROCK) {
                pctx.fillStyle = 'rgba(12, 7, 4, 0.36)';
                pctx.fillRect(sx, sy, TILE, 3);
              }
            }
          }
          worldLayerKeyRef.current = { mapRef: worldMapData, key: staticCacheKey };
        } else {
    // ========================================================================
    // PASS 1: SANCTUARIZED RIVERS, MASONRY QUAYS, SLOPED ROADS & GROUND BIOMES
    // ========================================================================
    for (let wy = layerStartWy; wy <= layerEndWy; wy++) {
      for (let wx = layerStartWx; wx <= layerEndWx; wx++) {
        const sx = wx * TILE - layerOriginPxX;
        const sy = wy * TILE - layerOriginPxY;
        const t = getTileAt(wx, wy);
        const h = tileHash(wx, wy);

        if (t === T_WATER) {
          const nTile = getTileAt(wx, wy - 1);
          const sTile = getTileAt(wx, wy + 1);
          const wTile = getTileAt(wx - 1, wy);
          const eTile = getTileAt(wx + 1, wy);
          const hasBridgeHere = getBridgeModeAt(wx, wy) !== B_NONE;

          const nW = isWaterLike(nTile);
          const sW = isWaterLike(sTile);
          const wW = isWaterLike(wTile);
          const eW = isWaterLike(eTile);

          const nUrban = !nW && (hasBridgeHere || isUrbanBankTile(nTile));
          const sUrban = !sW && (hasBridgeHere || isUrbanBankTile(sTile));
          const wUrban = !wW && (hasBridgeHere || isUrbanBankTile(wTile));
          const eUrban = !eW && (hasBridgeHere || isUrbanBankTile(eTile));

          // Multi-band 16-bit SNES water depth gradient
          pctx.fillStyle = '#1b4d9e';
          pctx.fillRect(sx, sy, 16, 16);
          pctx.fillStyle = '#2563eb';
          pctx.fillRect(sx + 1, sy + 1, 14, 14);
          if (nW && sW && wW && eW) {
            pctx.fillStyle = '#1d4ed8';
            pctx.fillRect(sx + 3, sy + 4, 10, 8);
          }

          const foamShift = (envTick + wx + wy) % 3;

          // NORTH BANK: Cut-Stone Masonry Quay (Urban) vs. Natural Mossy Earth Bank (Rural)
          if (!nW) {
            if (hasBridgeHere && isRoadLike(nTile)) {
              pctx.fillStyle = '#73644d';
              pctx.fillRect(sx, sy, 16, 2);
            } else if (nUrban) {
              // Authentic 16-Bit French Dressed-Stone Masonry Quay (Quai de pierre & parapet!)
              pctx.fillStyle = '#2b1d12';
              pctx.fillRect(sx, sy, 16, 1);
              pctx.fillStyle = '#fbf6ea'; // Sunlit parapet coping
              pctx.fillRect(sx, sy + 1, 16, 2);
              for (let qx = 3; qx < 16; qx += 4) {
                pctx.fillStyle = '#b8a382';
                pctx.fillRect(sx + qx, sy + 1, 1, 2);
              }
              // Vertical ashlar stone quay wall + iron mooring ring
              pctx.fillStyle = '#9e8c70';
              pctx.fillRect(sx, sy + 3, 16, 2);
              pctx.fillStyle = '#73644d';
              pctx.fillRect(sx, sy + 5, 16, 1);
              if (!hasBridgeHere && (wx + wy) % 3 === 0) {
                pctx.fillStyle = '#1e293b';
                pctx.fillRect(sx + 7, sy + 4, 2, 2); // Iron mooring ring!
              }
              pctx.fillStyle = '#172554';
              pctx.fillRect(sx, sy + 6, 16, 1);
              pctx.fillStyle = '#93c5fd';
              pctx.fillRect(sx + 1 + foamShift, sy + 7, 5, 1);
            } else {
              pctx.fillStyle = '#3f2a18';
              pctx.fillRect(sx, sy, 16, 2);
              pctx.fillStyle = '#855a37';
              pctx.fillRect(sx, sy + 2, 16, 2);
              pctx.fillStyle = '#b88b5a';
              pctx.fillRect(sx + 1, sy + 3, 14, 1);
              pctx.fillStyle = '#60a5fa';
              pctx.fillRect(sx, sy + 4, 16, 2);
              pctx.fillStyle = '#e0f2fe';
              pctx.fillRect(sx + foamShift, sy + 4, 5, 1);
              pctx.fillRect(sx + 9 + foamShift, sy + 5, 4, 1);
            }
          }

          // SOUTH BANK: Stone Quay Parapet (Urban) vs. Shallow Turquoise & Grass Lip (Rural)
          if (!sW) {
            if (hasBridgeHere && isRoadLike(sTile)) {
              pctx.fillStyle = '#73644d';
              pctx.fillRect(sx, sy + 14, 16, 2);
            } else if (sUrban) {
              pctx.fillStyle = '#60a5fa';
              pctx.fillRect(sx, sy + 12, 16, 1);
              pctx.fillStyle = '#f5ebd6';
              pctx.fillRect(sx, sy + 13, 16, 2);
              pctx.fillStyle = '#3b2b1d';
              pctx.fillRect(sx, sy + 15, 16, 1);
            } else {
              pctx.fillStyle = '#60a5fa';
              pctx.fillRect(sx, sy + 12, 16, 2);
              pctx.fillStyle = '#bae6fd';
              pctx.fillRect(sx + 2 - foamShift, sy + 13, 6, 1);
              pctx.fillStyle = '#a67b51';
              pctx.fillRect(sx, sy + 14, 16, 1);
              pctx.fillStyle = '#438f3d';
              pctx.fillRect(sx, sy + 15, 16, 1);
            }
          }

          // WEST BANK
          if (!wW) {
            if (hasBridgeHere && isRoadLike(wTile)) {
              pctx.fillStyle = '#73644d';
              pctx.fillRect(sx, sy, 2, 16);
            } else if (wUrban) {
              pctx.fillStyle = '#2b1d12';
              pctx.fillRect(sx, sy, 1, 16);
              pctx.fillStyle = '#f5ebd6';
              pctx.fillRect(sx + 1, sy, 2, 16);
              pctx.fillStyle = '#73644d';
              pctx.fillRect(sx + 3, sy, 1, 16);
            } else {
              pctx.fillStyle = '#4a321d';
              pctx.fillRect(sx, sy, 1, 16);
              pctx.fillStyle = '#9c6e44';
              pctx.fillRect(sx + 1, sy, 2, 16);
              pctx.fillStyle = '#7dd3fc';
              pctx.fillRect(sx + 3, sy, 1, 16);
            }
          }

          // EAST BANK
          if (!eW) {
            if (hasBridgeHere && isRoadLike(eTile)) {
              pctx.fillStyle = '#73644d';
              pctx.fillRect(sx + 14, sy, 2, 16);
            } else if (eUrban) {
              pctx.fillStyle = '#73644d';
              pctx.fillRect(sx + 12, sy, 1, 16);
              pctx.fillStyle = '#dfd0b4';
              pctx.fillRect(sx + 13, sy, 2, 16);
              pctx.fillStyle = '#2b1d12';
              pctx.fillRect(sx + 15, sy, 1, 16);
            } else {
              pctx.fillStyle = '#7dd3fc';
              pctx.fillRect(sx + 12, sy, 1, 16);
              pctx.fillStyle = '#9c6e44';
              pctx.fillRect(sx + 13, sy, 2, 16);
              pctx.fillStyle = '#4a321d';
              pctx.fillRect(sx + 15, sy, 1, 16);
            }
          }

          // Soft diagonal grass corners ONLY on rural natural banks (and ONLY when wide enough that channel never closes!)
          const wideEnoughForCorners = !hasBridgeHere && (nW || sW) && (wW || eW);
          if (wideEnoughForCorners) {
            if (!nW && !wW && !nUrban && !wUrban) {
              pctx.fillStyle = '#4da142';
              pctx.fillRect(sx, sy, 4, 4);
              pctx.fillStyle = '#855a37';
              pctx.fillRect(sx + 3, sy + 3, 2, 2);
            }
            if (!nW && !eW && !nUrban && !eUrban) {
              pctx.fillStyle = '#4da142';
              pctx.fillRect(sx + 12, sy, 4, 4);
              pctx.fillStyle = '#855a37';
              pctx.fillRect(sx + 11, sy + 3, 2, 2);
            }
            if (!sW && !wW && !sUrban && !wUrban) {
              pctx.fillStyle = '#4da142';
              pctx.fillRect(sx, sy + 12, 4, 4);
            }
            if (!sW && !eW && !sUrban && !eUrban) {
              pctx.fillStyle = '#4da142';
              pctx.fillRect(sx + 12, sy + 12, 4, 4);
            }
          }

          // Animated shimmering water ripples, lilypads & natural reeds (rural open water only!)
          const wavePhase = (wx * 3 + wy * 5 + envTick) % 8;
          if (!hasBridgeHere && (wavePhase === 0 || wavePhase === 1)) {
            pctx.fillStyle = '#93c5fd';
            pctx.fillRect(sx + 5, sy + 8, 5, 1);
            pctx.fillStyle = '#f0f9ff';
            pctx.fillRect(sx + 6 + (wavePhase % 2), sy + 8, 2, 1);
          } else if (!hasBridgeHere && wavePhase === 4) {
            pctx.fillStyle = '#60a5fa';
            pctx.fillRect(sx + 8, sy + 10, 4, 1);
          }

          if (!hasBridgeHere && nW && sW && wW && eW && h % 15 === 0) {
            pctx.fillStyle = '#15803d';
            pctx.fillRect(sx + 6, sy + 8, 5, 4);
            pctx.fillStyle = '#4ade80';
            pctx.fillRect(sx + 7, sy + 8, 3, 3);
            if (h % 30 === 0) {
              pctx.fillStyle = '#fbcfe8';
              pctx.fillRect(sx + 8, sy + 7, 2, 2);
            }
          } else if (!hasBridgeHere && ((!wW && !wUrban) || (!eW && !eUrban)) && h % 7 === 0) {
            const rx = !wW && !wUrban ? sx + 4 : sx + 10;
            pctx.fillStyle = '#166534';
            pctx.fillRect(rx, sy + 6, 1, 6);
            pctx.fillRect(rx + 2, sy + 7, 1, 5);
            pctx.fillStyle = '#78350f';
            pctx.fillRect(rx + sway, sy + 4, 1, 3);
          }
          continue;
        }

        if (t === T_PIER) {
          // 16-Bit Weathered Oak Jetty / Embarkation Pontoon over Pilings in Water!
          pctx.fillStyle = '#1d4ed8';
          pctx.fillRect(sx, sy, 16, 16);
          const pVert = getTileAt(wx, wy - 1) === T_PIER || getTileAt(wx, wy + 1) === T_PIER;
          // Timber pilings + water ripples
          pctx.fillStyle = '#29170a';
          pctx.fillRect(sx + 2, sy + 12, 2, 4);
          pctx.fillRect(sx + 12, sy + 12, 2, 4);
          pctx.fillStyle = '#93c5fd';
          pctx.fillRect(sx + 1, sy + 15, 4, 1);
          pctx.fillRect(sx + 11, sy + 15, 4, 1);
          // Oak boardwalk deck
          if (pVert) {
            pctx.fillStyle = '#4a2c13';
            pctx.fillRect(sx + 2, sy, 12, 16);
            for (let py = 0; py < 16; py += 3) {
              pctx.fillStyle = py % 6 === 0 ? '#c2884f' : '#a8703b';
              pctx.fillRect(sx + 3, sy + py, 10, 2);
            }
          } else {
            pctx.fillStyle = '#4a2c13';
            pctx.fillRect(sx, sy + 2, 16, 11);
            for (let px = 0; px < 16; px += 3) {
              pctx.fillStyle = px % 6 === 0 ? '#c2884f' : '#a8703b';
              pctx.fillRect(sx + px, sy + 3, 2, 9);
            }
          }
          continue;
        }

        if (t === T_MAIN_ROAD || t === T_STREET || t === T_PATH || t === T_STEPS) {
          const nTile = getTileAt(wx, wy - 1);
          const sTile = getTileAt(wx, wy + 1);
          const wTile = getTileAt(wx - 1, wy);
          const eTile = getTileAt(wx + 1, wy);

          const nR = isRoadLike(nTile) || getBridgeModeAt(wx, wy - 1) !== B_NONE;
          const sR = isRoadLike(sTile) || getBridgeModeAt(wx, wy + 1) !== B_NONE;
          const wR = isRoadLike(wTile) || getBridgeModeAt(wx - 1, wy) !== B_NONE;
          const eR = isRoadLike(eTile) || getBridgeModeAt(wx + 1, wy) !== B_NONE;

          // DISAMBIGUATED STAIRS vs. VEHICULAR ROAD RAMPS:
          // Sculpted stone staircases are reserved STRICTLY for real `highway=steps` (T_STEPS)
          // or narrow isolated footpaths (T_PATH) climbing a sharp cliff terrace orthogonally!
          const adjCarRoad =
            nTile === T_MAIN_ROAD ||
            sTile === T_MAIN_ROAD ||
            wTile === T_MAIN_ROAD ||
            eTile === T_MAIN_ROAD ||
            nTile === T_STREET ||
            sTile === T_STREET ||
            wTile === T_STREET ||
            eTile === T_STREET;

          const steepPathNS =
            t === T_PATH &&
            reliefEnabled &&
            hasTerraces &&
            !adjCarRoad &&
            !wR &&
            !eR &&
            getTerraceAt(wx, wy - 1) !== getTerraceAt(wx, wy + 1);
          const steepPathEW =
            t === T_PATH &&
            reliefEnabled &&
            hasTerraces &&
            !adjCarRoad &&
            !nR &&
            !sR &&
            getTerraceAt(wx - 1, wy) !== getTerraceAt(wx + 1, wy);

          const isTrueSteps = t === T_STEPS || steepPathNS || steepPathEW;

          if (isTrueSteps) {
            const dzNS = Math.abs(getElevAt(wx, wy - 1) - getElevAt(wx, wy + 1));
            const dzEW = Math.abs(getElevAt(wx - 1, wy) - getElevAt(wx + 1, wy));
            const orientEW =
              steepPathEW ||
              (!steepPathNS &&
                (((wR || eR) && !nR && !sR) || (dzEW > dzNS * 1.25 && !(nR && sR))));

            if (!orientEW) {
              // True North-South 16-Bit Carved Limestone Stairway (Montmartre / Fourvière!)
              pctx.fillStyle = '#4a3520';
              pctx.fillRect(sx, sy, 16, 16);
              for (let stepY = 0; stepY < 16; stepY += 4) {
                pctx.fillStyle = '#fbf6ea';
                pctx.fillRect(sx + 2, sy + stepY, 12, 1);
                pctx.fillStyle = stepY % 8 === 0 ? '#e3d3b6' : '#d6c19e';
                pctx.fillRect(sx + 2, sy + stepY + 1, 12, 2);
                pctx.fillStyle = '#3b2614';
                pctx.fillRect(sx + 2, sy + stepY + 3, 12, 1);
              }
              pctx.fillStyle = '#cbb694';
              pctx.fillRect(sx, sy, 2, 16);
              pctx.fillRect(sx + 14, sy, 2, 16);
              pctx.fillStyle = '#fbf6ea';
              for (let by = 1; by < 16; by += 5) {
                pctx.fillRect(sx + 1, sy + by, 1, 2);
                pctx.fillRect(sx + 14, sy + by, 1, 2);
              }
            } else {
              // True East-West 16-Bit Carved Stone Stairway
              pctx.fillStyle = '#4a3520';
              pctx.fillRect(sx, sy, 16, 16);
              for (let stepX = 0; stepX < 16; stepX += 4) {
                pctx.fillStyle = '#fbf6ea';
                pctx.fillRect(sx + stepX, sy + 2, 1, 12);
                pctx.fillStyle = stepX % 8 === 0 ? '#e3d3b6' : '#d6c19e';
                pctx.fillRect(sx + stepX + 1, sy + 2, 2, 12);
                pctx.fillStyle = '#3b2614';
                pctx.fillRect(sx + stepX + 3, sy + 2, 1, 12);
              }
              pctx.fillStyle = '#fbf6ea';
              pctx.fillRect(sx, sy, 16, 2);
              pctx.fillStyle = '#b89f78';
              pctx.fillRect(sx, sy + 14, 16, 2);
            }
            continue;
          }

          if (t === T_MAIN_ROAD || t === T_STREET) {
            blitAtlas(
              t === T_MAIN_ROAD ? ATLAS_ROW_MAIN_ROAD : ATLAS_ROW_STREET,
              h & 3,
              sx,
              sy
            );

            // Bevelled granite sidewalk curbs along non-road edges (leaving diagonal joints open on thin wide-zoom avenues!)
            const nwR = isRoadLike(getTileAt(wx - 1, wy - 1)) || getBridgeModeAt(wx - 1, wy - 1) !== B_NONE;
            const neR = isRoadLike(getTileAt(wx + 1, wy - 1)) || getBridgeModeAt(wx + 1, wy - 1) !== B_NONE;
            const swR = isRoadLike(getTileAt(wx - 1, wy + 1)) || getBridgeModeAt(wx - 1, wy + 1) !== B_NONE;
            const seR = isRoadLike(getTileAt(wx + 1, wy + 1)) || getBridgeModeAt(wx + 1, wy + 1) !== B_NONE;
            const curbDark = t === T_MAIN_ROAD ? '#4a3826' : '#5c432b';
            const curbLight = t === T_MAIN_ROAD ? '#f7f1e3' : '#ead9be';
            if (!nR) {
              const cx0 = !wR && nwR ? 4 : 0;
              const cx1 = !eR && neR ? 12 : 16;
              if (cx1 > cx0) {
                pctx.fillStyle = curbDark;
                pctx.fillRect(sx + cx0, sy, cx1 - cx0, 1);
                pctx.fillStyle = curbLight;
                pctx.fillRect(sx + cx0, sy + 1, cx1 - cx0, 2);
              }
            }
            if (!sR) {
              const cx0 = !wR && swR ? 4 : 0;
              const cx1 = !eR && seR ? 12 : 16;
              if (cx1 > cx0) {
                pctx.fillStyle = '#a89274';
                pctx.fillRect(sx + cx0, sy + 14, cx1 - cx0, 1);
                pctx.fillStyle = curbDark;
                pctx.fillRect(sx + cx0, sy + 15, cx1 - cx0, 1);
              }
            }
            if (!wR) {
              const cy0 = !nR && nwR ? 4 : 0;
              const cy1 = !sR && swR ? 12 : 16;
              if (cy1 > cy0) {
                pctx.fillStyle = curbDark;
                pctx.fillRect(sx, sy + cy0, 1, cy1 - cy0);
                pctx.fillStyle = curbLight;
                pctx.fillRect(sx + 1, sy + cy0, 1, cy1 - cy0);
              }
            }
            if (!eR) {
              const cy0 = !nR && neR ? 4 : 0;
              const cy1 = !sR && seR ? 12 : 16;
              if (cy1 > cy0) {
                pctx.fillStyle = '#a89274';
                pctx.fillRect(sx + 14, sy + cy0, 1, cy1 - cy0);
                pctx.fillStyle = curbDark;
                pctx.fillRect(sx + 15, sy + cy0, 1, cy1 - cy0);
              }
            }

            // Planked Level Crossing if a railway crosses this road!
            if (hasRailAt(wx, wy)) {
              draw16BitOrientedRail(
                pctx,
                sx,
                sy,
                hasRailAt(wx, wy - 1),
                hasRailAt(wx, wy + 1),
                hasRailAt(wx - 1, wy),
                hasRailAt(wx + 1, wy),
                hasRailAt(wx - 1, wy - 1),
                hasRailAt(wx + 1, wy - 1),
                hasRailAt(wx - 1, wy + 1),
                hasRailAt(wx + 1, wy + 1),
                true
              );
            }
          } else {
            // Organic Winding Dirt & Pebble Woodland Trail (over lush grass base!)
            const nearPark = nTile === T_PARK || sTile === T_PARK;
            blitAtlas(nearPark ? ATLAS_ROW_PARK : ATLAS_ROW_MEADOW, h & 3, sx, sy);

            pctx.fillStyle = '#7c5330';
            pctx.fillRect(sx + 3, sy + 3, 10, 10);
            if (nR) pctx.fillRect(sx + 3, sy, 10, 4);
            if (sR) pctx.fillRect(sx + 3, sy + 12, 10, 4);
            if (wR) pctx.fillRect(sx, sy + 3, 4, 10);
            if (eR) pctx.fillRect(sx + 12, sy + 3, 4, 10);

            pctx.fillStyle = '#c49662';
            pctx.fillRect(sx + 4, sy + 4, 8, 8);
            if (nR) pctx.fillRect(sx + 4, sy, 8, 5);
            if (sR) pctx.fillRect(sx + 4, sy + 11, 8, 5);
            if (wR) pctx.fillRect(sx, sy + 4, 5, 8);
            if (eR) pctx.fillRect(sx + 11, sy + 4, 5, 8);

            pctx.fillStyle = '#e6c697';
            pctx.fillRect(sx + 6, sy + 6, 4, 3);
            if (h % 3 === 0) {
              pctx.fillStyle = '#f5efe4';
              pctx.fillRect(sx + 9, sy + 9, 2, 1);
            }
          }
          applyDitheredHillshade(wx, wy, sx, sy);
          continue;
        }

        if (t === T_RAIL) {
          blitAtlas(ATLAS_ROW_MEADOW, h & 3, sx, sy);
          draw16BitOrientedRail(
            pctx,
            sx,
            sy,
            hasRailAt(wx, wy - 1),
            hasRailAt(wx, wy + 1),
            hasRailAt(wx - 1, wy),
            hasRailAt(wx + 1, wy),
            hasRailAt(wx - 1, wy - 1),
            hasRailAt(wx + 1, wy - 1),
            hasRailAt(wx - 1, wy + 1),
            hasRailAt(wx + 1, wy + 1),
            false
          );
          applyDitheredHillshade(wx, wy, sx, sy);
          continue;
        }

        if (t === T_PLAZA) {
          blitAtlas(ATLAS_ROW_PLAZA, h & 3, sx, sy);
          applyDitheredHillshade(wx, wy, sx, sy);
          continue;
        }

        if (t === T_FARMLAND) {
          const parcelKind = ((wx >> 2) ^ (wy >> 2)) & 1;
          blitAtlas(ATLAS_ROW_FARMLAND, parcelKind * 2 + (h & 1), sx, sy);
          if (getTileAt(wx, wy - 1) !== T_FARMLAND) {
            pctx.fillStyle = 'rgba(25, 15, 8, 0.35)';
            pctx.fillRect(sx, sy + 4, 16, 1);
            pctx.fillStyle = '#5c3419';
            pctx.fillRect(sx, sy + 1, 16, 1);
            pctx.fillRect(sx, sy + 3, 16, 1);
            pctx.fillStyle = '#9a6234';
            pctx.fillRect(sx, sy + 1, 16, 1);
            pctx.fillStyle = '#45230e';
            pctx.fillRect(sx + 2, sy, 2, 5);
            pctx.fillRect(sx + 11, sy, 2, 5);
            pctx.fillStyle = '#fde68a';
            pctx.fillRect(sx + 2, sy, 2, 1);
            pctx.fillRect(sx + 11, sy, 2, 1);
          }
          applyDitheredHillshade(wx, wy, sx, sy);
          continue;
        }

        if (t === T_PARK) {
          blitAtlas(ATLAS_ROW_PARK, h & 3, sx, sy);
          const nP = getTileAt(wx, wy - 1) === T_PARK;
          const sP = getTileAt(wx, wy + 1) === T_PARK;
          const wP = getTileAt(wx - 1, wy) === T_PARK;
          const eP = getTileAt(wx + 1, wy) === T_PARK;

          if (!nP) {
            pctx.fillStyle = '#0f3d1e';
            pctx.fillRect(sx, sy, 16, 3);
            pctx.fillStyle = '#228b3b';
            pctx.fillRect(sx + 1, sy, 14, 2);
            pctx.fillStyle = '#86efac';
            pctx.fillRect(sx + 2, sy, 5, 1);
            pctx.fillRect(sx + 10, sy, 4, 1);
            // Ornamental wrought-iron & stone park gate posts every few tiles
            if ((wx + wy) % 5 === 0) {
              pctx.fillStyle = '#f5ebd6';
              pctx.fillRect(sx + 6, sy, 2, 4);
              pctx.fillRect(sx + 10, sy, 2, 4);
              pctx.fillStyle = '#fde047';
              pctx.fillRect(sx + 6, sy, 1, 1);
              pctx.fillRect(sx + 10, sy, 1, 1);
            }
          }
          if (!sP) {
            pctx.fillStyle = '#0f3d1e';
            pctx.fillRect(sx, sy + 14, 16, 2);
            pctx.fillStyle = '#228b3b';
            pctx.fillRect(sx, sy + 13, 16, 1);
          }
          if (!wP) {
            pctx.fillStyle = '#14532d';
            pctx.fillRect(sx, sy, 2, 16);
          }
          if (!eP) {
            pctx.fillStyle = '#14532d';
            pctx.fillRect(sx + 14, sy, 2, 16);
          }
          // 16-bit wooden & cast-iron park bench on manicured interior lawn
          if (nP && sP && h % 13 === 2) {
            pctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
            pctx.fillRect(sx + 4, sy + 12, 8, 2);
            pctx.fillStyle = '#1e293b';
            pctx.fillRect(sx + 4, sy + 9, 1, 4);
            pctx.fillRect(sx + 11, sy + 9, 1, 4);
            pctx.fillStyle = '#92400e';
            pctx.fillRect(sx + 4, sy + 9, 8, 2);
            pctx.fillStyle = '#d97706';
            pctx.fillRect(sx + 5, sy + 9, 6, 1);
          }
          applyDitheredHillshade(wx, wy, sx, sy);
          continue;
        }

        if (t === T_CEMETERY) {
          blitAtlas(ATLAS_ROW_COURTYARD, h & 3, sx, sy);
          const nC = getTileAt(wx, wy - 1) === T_CEMETERY;
          const sC = getTileAt(wx, wy + 1) === T_CEMETERY;
          if (!nC) {
            pctx.fillStyle = '#334155';
            pctx.fillRect(sx, sy, 16, 3);
            pctx.fillStyle = '#cbd5e1';
            pctx.fillRect(sx, sy + 1, 16, 1);
          }
          if (!sC) {
            pctx.fillStyle = '#334155';
            pctx.fillRect(sx, sy + 14, 16, 2);
          }
          // Quiet rows of carved limestone steles
          if (h % 3 !== 0) {
            pctx.fillStyle = '#475569';
            pctx.fillRect(sx + 3, sy + 5, 3, 4);
            pctx.fillRect(sx + 10, sy + 9, 3, 4);
            pctx.fillStyle = '#e2e8f0';
            pctx.fillRect(sx + 3, sy + 5, 2, 3);
            pctx.fillRect(sx + 10, sy + 9, 2, 3);
          }
          applyDitheredHillshade(wx, wy, sx, sy);
          continue;
        }

        if (t === T_INDUSTRIAL) {
          blitAtlas(ATLAS_ROW_INDUSTRIAL, h & 3, sx, sy);
          if (getTileAt(wx, wy - 1) !== T_INDUSTRIAL && getTileAt(wx, wy - 1) !== T_BUILDING) {
            // Industrial perimeter chain-link & steel post fence
            pctx.fillStyle = '#1e293b';
            pctx.fillRect(sx, sy, 16, 2);
            for (let fx = 1; fx < 16; fx += 4) {
              pctx.fillStyle = '#94a3b8';
              pctx.fillRect(sx + fx, sy, 1, 3);
            }
          }
          // Stacked freight crates / pallets in open logistics yards
          if (h % 11 === 0) {
            pctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
            pctx.fillRect(sx + 3, sy + 11, 9, 2);
            pctx.fillStyle = '#78350f';
            pctx.fillRect(sx + 3, sy + 7, 4, 5);
            pctx.fillStyle = '#d97706';
            pctx.fillRect(sx + 4, sy + 8, 2, 3);
            pctx.fillStyle = '#1d4ed8';
            pctx.fillRect(sx + 8, sy + 8, 4, 4);
            pctx.fillStyle = '#60a5fa';
            pctx.fillRect(sx + 9, sy + 8, 2, 2);
          }
          applyDitheredHillshade(wx, wy, sx, sy);
          continue;
        }

        if (t === T_COMMERCIAL) {
          blitAtlas(ATLAS_ROW_URBAN_STONE, h & 3, sx, sy);
          applyDitheredHillshade(wx, wy, sx, sy);
          continue;
        }

        if (t === T_FOREST) {
          blitAtlas(ATLAS_ROW_FOREST, h & 3, sx, sy);
          const slopeMag = applyDitheredHillshade(wx, wy, sx, sy);
          if (slopeMag > 0.15 && h % 4 === 0) {
            pctx.fillStyle = '#292524';
            pctx.fillRect(sx + 4, sy + 10, 6, 4);
            pctx.fillStyle = '#78716c';
            pctx.fillRect(sx + 5, sy + 9, 4, 4);
            pctx.fillStyle = '#4ade80';
            pctx.fillRect(sx + 5, sy + 9, 3, 1);
          }
          continue;
        }

        if (t === T_RESIDENTIAL || t === T_BUILDING) {
          const settle = getSettlementAt(wx, wy);
          if (settle === SETTLE_CITY_CENTER) {
            // Mineral paved courtyards & urban alleys in city centers!
            blitAtlas(ATLAS_ROW_URBAN_STONE, h & 3, sx, sy);
          } else if (settle === SETTLE_INDUSTRIAL) {
            blitAtlas(ATLAS_ROW_INDUSTRIAL, h & 3, sx, sy);
          } else if (settle === SETTLE_HAMLET) {
            // Warm rustic beaten-earth & cobble farmyard in rural hamlets!
            blitAtlas(ATLAS_ROW_VILLAGE_EARTH, h & 3, sx, sy);
            if (t === T_RESIDENTIAL && h % 9 === 0) {
              // Golden cylindrical hay bale in farmyard!
              pctx.fillStyle = 'rgba(28, 18, 8, 0.32)';
              pctx.fillRect(sx + 5, sy + 11, 6, 2);
              pctx.fillStyle = '#a16207';
              pctx.fillRect(sx + 5, sy + 7, 5, 5);
              pctx.fillStyle = '#eab308';
              pctx.fillRect(sx + 6, sy + 7, 3, 4);
              pctx.fillStyle = '#fef08a';
              pctx.fillRect(sx + 6, sy + 7, 2, 1);
            }
          } else {
            // Suburban gardens & village courtyards
            blitAtlas(ATLAS_ROW_COURTYARD, h & 3, sx, sy);
            if (t === T_RESIDENTIAL) {
              if (h % 8 === 0) {
                pctx.fillStyle = '#14532d';
                pctx.fillRect(sx + 3, sy + 11, 10, 3);
                pctx.fillStyle = '#228b3b';
                pctx.fillRect(sx + 4, sy + 10, 8, 3);
                pctx.fillStyle = h % 16 === 0 ? '#fde047' : '#fb7185';
                pctx.fillRect(sx + 5, sy + 11, 2, 1);
                pctx.fillRect(sx + 9, sy + 11, 2, 1);
              } else if (settle === SETTLE_SUBURB && h % 13 === 0) {
                // Neat suburban stepping stones
                pctx.fillStyle = '#e7e5e4';
                pctx.fillRect(sx + 5, sy + 6, 2, 2);
                pctx.fillRect(sx + 9, sy + 9, 2, 2);
              } else if (settle === SETTLE_VILLAGE && h % 11 === 0) {
                // Low dry-stone village garden wall (muret de pierre sèche)
                pctx.fillStyle = '#574635';
                pctx.fillRect(sx + 2, sy + 12, 12, 2);
                pctx.fillStyle = '#cbb89d';
                pctx.fillRect(sx + 3, sy + 12, 4, 1);
                pctx.fillRect(sx + 9, sy + 12, 4, 1);
              }
            }
          }
          applyDitheredHillshade(wx, wy, sx, sy);
        } else {
          if (reliefEnabled && hasRealElevation) {
            const zCur = getElevAt(wx, wy);
            const relNorm = elevSpan > 2 ? (zCur - elevMin) / elevSpan : 0.5;
            if (relNorm > 0.66) {
              blitAtlas(ATLAS_ROW_ELEVATED, h & 1, sx, sy);
            } else if (relNorm < 0.30) {
              blitAtlas(ATLAS_ROW_ELEVATED, 2 + (h & 1), sx, sy);
            } else {
              blitAtlas(ATLAS_ROW_MEADOW, h & 3, sx, sy);
            }
            const slopeMag = applyDitheredHillshade(wx, wy, sx, sy);
            if (slopeMag > 0.13 && h % 3 === 0) {
              pctx.fillStyle = '#44403c';
              pctx.fillRect(sx + 3, sy + 9, 6, 4);
              pctx.fillStyle = '#a8a29e';
              pctx.fillRect(sx + 3, sy + 8, 5, 4);
              pctx.fillStyle = '#f5f5f4';
              pctx.fillRect(sx + 4, sy + 8, 3, 2);
              pctx.fillStyle = '#d6d3d1';
              pctx.fillRect(sx + 10, sy + 11, 3, 2);
            }
          } else {
            const relief = Math.sin(wx * 0.16) + Math.cos(wy * 0.15);
            if (relief > 1.1) {
              blitAtlas(ATLAS_ROW_ELEVATED, h & 1, sx, sy);
            } else if (relief < -1.1) {
              blitAtlas(ATLAS_ROW_ELEVATED, 2 + (h & 1), sx, sy);
            } else {
              blitAtlas(ATLAS_ROW_MEADOW, h & 3, sx, sy);
            }
          }
        }
      }
    }

    // ========================================================================
    // PASS 1B: 16-BIT 3/4-VIEW STEPPED CLIFFS, BELVEDERES & PLATEAU CRESTS
    // ========================================================================
    if (reliefEnabled && hasRealElevation && hasTerraces) {
      for (let wy = layerStartWy; wy <= layerEndWy; wy++) {
        for (let wx = layerStartWx; wx <= layerEndWx; wx++) {
          const t = getTileAt(wx, wy);
          if (
            t === T_WATER ||
            t === T_PIER ||
            t === T_MAIN_ROAD ||
            t === T_STREET ||
            t === T_PATH ||
            t === T_STEPS ||
            t === T_RAIL ||
            t === T_BUILDING ||
            isLandmarkCellAt(wx, wy)
          ) {
            continue;
          }

          const tCur = getTerraceAt(wx, wy);
          const dropS = tCur - getTerraceAt(wx, wy + 1);
          const dropN = tCur - getTerraceAt(wx, wy - 1);
          const dropW = tCur - getTerraceAt(wx - 1, wy);
          const dropE = tCur - getTerraceAt(wx + 1, wy);

          if (dropS <= 0 && dropN <= 0 && dropW <= 0 && dropE <= 0) continue;

          const sx = wx * TILE - layerOriginPxX;
          const sy = wy * TILE - layerOriginPxY;
          const h = tileHash(wx, wy);
          const isUrbanTerrace =
            t === T_PLAZA || t === T_RESIDENTIAL || t === T_INDUSTRIAL || t === T_COMMERCIAL;
          const wNeighbor = getTileAt(wx - 1, wy);
          const eNeighbor = getTileAt(wx + 1, wy);
          const nNeighbor = getTileAt(wx, wy - 1);

          // 1. Back-Facing Northern Plateau Rim (when ground drops away to the North, not onto a graded street)
          if (dropN > 0 && dropS <= 0 && !isRoadLike(nNeighbor)) {
            pctx.fillStyle = '#241911';
            pctx.fillRect(sx, sy, 16, 1);
            pctx.fillStyle = isUrbanTerrace ? '#fbf6ea' : '#d9f99d';
            pctx.fillRect(sx, sy + 1, 16, 2);
            pctx.fillStyle = isUrbanTerrace ? '#cbb694' : '#65a30d';
            pctx.fillRect(sx, sy + 3, 16, 1);
          }

          // 2. Lateral Western Cliff Ledge (Sunlit by NW sun — skipped along graded streets!)
          if (dropW > 0 && dropS <= 0 && !isRoadLike(wNeighbor)) {
            pctx.fillStyle = '#241911';
            pctx.fillRect(sx, sy, 1, 16);
            pctx.fillStyle = isUrbanTerrace ? '#fbf6ea' : '#efe0c2';
            pctx.fillRect(sx + 1, sy, 2, 16);
            pctx.fillStyle = isUrbanTerrace ? '#bba889' : '#84cc16';
            pctx.fillRect(sx + 3, sy, 1, 16);
          }

          // 3. Lateral Eastern Cliff Ledge (Shaded away from NW sun — skipped along graded streets!)
          if (dropE > 0 && dropS <= 0 && !isRoadLike(eNeighbor)) {
            pctx.fillStyle = isUrbanTerrace ? '#9c8669' : '#4d7c0f';
            pctx.fillRect(sx + 12, sy, 1, 16);
            pctx.fillStyle = '#785a3a';
            pctx.fillRect(sx + 13, sy, 2, 16);
            pctx.fillStyle = '#241911';
            pctx.fillRect(sx + 15, sy, 1, 16);
            pctx.fillStyle = 'rgba(14, 22, 36, 0.28)';
            pctx.fillRect(sx + 16, sy + 1, 2, 15);
          }

          // 4. Heroic 3/4-View Front-Facing Southern Escarpment (dropS > 0)!
          if (dropS > 0) {
            const x0 = dropW > 0 ? 1 : 0;
            const x1 = dropE > 0 ? 15 : 16;
            const cw = x1 - x0;

            if (isUrbanTerrace) {
              // Carved Dressed-Stone Urban Belvedere / Retaining Rampart (Lyon / Montmartre / Citadels)
              pctx.fillStyle = '#241911';
              pctx.fillRect(sx + x0, sy + 4, cw, 12);
              // Sunlit stone parapet coping
              pctx.fillStyle = '#fbf6ea';
              pctx.fillRect(sx + x0, sy + 4, cw, 2);
              for (let bx = x0 + 1; bx < x1 - 1; bx += 4) {
                pctx.fillStyle = '#d6c3a3';
                pctx.fillRect(sx + bx + 2, sy + 4, 1, 2);
              }
              // Staggered ashlar masonry courses
              pctx.fillStyle = '#b89f78';
              pctx.fillRect(sx + x0, sy + 6, cw, 5);
              pctx.fillStyle = '#8f7553';
              pctx.fillRect(sx + x0, sy + 11, cw, 4);
              for (let rowY = 6; rowY <= 12; rowY += 3) {
                pctx.fillStyle = '#5c452d';
                pctx.fillRect(sx + x0, sy + rowY + 2, cw, 1);
                const shift = rowY % 2 === 0 ? 0 : 2;
                for (let jx = x0 + shift; jx < x1 - 1; jx += 5) {
                  pctx.fillStyle = '#e7d8be';
                  pctx.fillRect(sx + jx, sy + rowY, Math.min(3, x1 - jx), 2);
                }
              }
              // Ambient shadow at base of rampart
              pctx.fillStyle = 'rgba(16, 12, 8, 0.36)';
              pctx.fillRect(sx + x0, sy + 16, cw, 3);
            } else {
              // Natural Stratified 16-Bit Limestone/Ochre & Turf Cliff Wall (A Link to the Past style!)
              const isGorge = dropS >= 2;
              const cliffTop = isGorge ? 2 : 4;
              const rockTop = cliffTop + 2;
              const rockH = 15 - rockTop;

              // Scalloped overhanging grass lip + sunlit rim
              pctx.fillStyle = '#bef264';
              pctx.fillRect(sx + x0, sy + cliffTop - 1, cw, 1);
              pctx.fillStyle = t === T_FOREST ? '#228b3b' : '#4da142';
              pctx.fillRect(sx + x0, sy + cliffTop, cw, 2);
              pctx.fillStyle = '#143318';
              pctx.fillRect(sx + x0, sy + cliffTop + 1, cw, 1);
              // Jagged grass tuft teeth overhanging rock face
              for (let tx = x0 + (h & 1); tx < x1 - 1; tx += 3) {
                pctx.fillStyle = '#3a8238';
                pctx.fillRect(sx + tx, sy + cliffTop + 1, 2, 1);
                pctx.fillStyle = '#1b2e1b';
                pctx.fillRect(sx + tx, sy + cliffTop + 2, 2, 1);
              }

              // 4-Tone Stratified Rock Wall
              pctx.fillStyle = '#9c784c'; // mid ochre-limestone body
              pctx.fillRect(sx + x0, sy + rockTop, cw, rockH);
              pctx.fillStyle = '#ead7b3'; // sunlit upper rock shelf
              pctx.fillRect(sx + x0, sy + rockTop + 1, cw, 2);
              pctx.fillStyle = '#c9a677'; // upper-mid warm stratum
              pctx.fillRect(sx + x0, sy + rockTop + 3, cw, Math.max(2, rockH - 6));
              pctx.fillStyle = '#6e4e30'; // lower cool undercut stratum
              pctx.fillRect(sx + x0, sy + 12, cw, 3);
              pctx.fillStyle = '#291a0d'; // crisp 16-bit dark basal crevice
              pctx.fillRect(sx + x0, sy + 15, cw, 1);

              // Vertical geological fissures & sunlit bevelled rock facets
              const f1 = x0 + 2 + (h % 4);
              const f2 = x0 + 9 + ((h >> 3) % 4);
              if (f1 < x1 - 1) {
                pctx.fillStyle = '#4a321c';
                pctx.fillRect(sx + f1, sy + rockTop + 1, 1, rockH - 1);
                pctx.fillStyle = '#f7ebd2';
                pctx.fillRect(sx + f1 + 1, sy + rockTop + 2, Math.min(3, x1 - f1 - 1), 3);
              }
              if (f2 < x1 - 1) {
                pctx.fillStyle = '#4a321c';
                pctx.fillRect(sx + f2, sy + rockTop + 2, 1, rockH - 2);
              }

              // Trailing emerald cliff ivy on steep gorges or mossy cliffs!
              if (isGorge || h % 5 === 0) {
                const vx = x0 + 4 + ((h >> 2) % Math.max(1, cw - 6));
                pctx.fillStyle = '#14532d';
                pctx.fillRect(sx + vx, sy + rockTop, 3, isGorge ? 8 : 5);
                pctx.fillStyle = '#4ade80';
                pctx.fillRect(sx + vx, sy + rockTop, 2, isGorge ? 6 : 3);
              }

              // Corner outlines when plateau ends on West or East
              if (dropW > 0) {
                pctx.fillStyle = '#291a0d';
                pctx.fillRect(sx, sy + cliffTop, 1, 16 - cliffTop);
              }
              if (dropE > 0) {
                pctx.fillStyle = '#291a0d';
                pctx.fillRect(sx + 15, sy + cliffTop, 1, 16 - cliffTop);
              }

              // Grounded ambient cliff shadow cast onto the lower tier!
              pctx.fillStyle = 'rgba(14, 22, 36, 0.34)';
              pctx.fillRect(sx + x0, sy + 16, cw, isGorge ? 4 : 3);
            }
          }
        }
      }
    }

    // ========================================================================
    // PASS 1C: UPPER VECTOR BRIDGES, FOOTBRIDGES & VIADUCTS OVER WATER
    // (Rendered above continuous T_WATER in connected multi-tile & 3-pass diagonal mode!)
    // ========================================================================
    const diagBridgeCells: DiagonalBridgeCell[] = [];
    for (let wy = layerStartWy - 1; wy <= layerEndWy + 1; wy++) {
      for (let wx = layerStartWx - 1; wx <= layerEndWx + 1; wx++) {
        const bMode = getBridgeModeAt(wx, wy);
        if (bMode === B_NONE) continue;
        const sx = wx * TILE - layerOriginPxX;
        const sy = wy * TILE - layerOriginPxY;
        const axis = getBridgeAxisAt(wx, wy);

        const bN = getBridgeModeAt(wx, wy - 1) !== B_NONE;
        const bS = getBridgeModeAt(wx, wy + 1) !== B_NONE;
        const bW = getBridgeModeAt(wx - 1, wy) !== B_NONE;
        const bE = getBridgeModeAt(wx + 1, wy) !== B_NONE;

        const landN = !isWaterLike(getTileAt(wx, wy - 1));
        const landS = !isWaterLike(getTileAt(wx, wy + 1));
        const landW = !isWaterLike(getTileAt(wx - 1, wy));
        const landE = !isWaterLike(getTileAt(wx + 1, wy));

        if (axis === AXIS_DIAG_NESW || axis === AXIS_DIAG_NWSE) {
          const isNESW = axis === AXIS_DIAG_NESW;
          const hasOrthoBridge = bN || bS || bW || bE;
          const rDeck = hasOrthoBridge ? 8 : bMode === B_FOOTBRIDGE ? 4 : 6;
          const rParapet = rDeck + 2;

          if (isNESW) {
            const bSW = getBridgeModeAt(wx - 1, wy + 1) !== B_NONE;
            const bNE = getBridgeModeAt(wx + 1, wy - 1) !== B_NONE;
            const abutStart =
              !bSW && (landS || landW || !isWaterLike(getTileAt(wx - 1, wy + 1)));
            const abutEnd =
              !bNE && (landN || landE || !isWaterLike(getTileAt(wx + 1, wy - 1)));
            diagBridgeCells.push({
              wx,
              wy,
              sx,
              sy,
              mode: bMode,
              isNESW: true,
              rDeck,
              rParapet,
              dMin: abutStart ? -26 : -16,
              dMax: abutEnd ? 26 : 16,
              abutStart,
              abutEnd,
            });
          } else {
            const bNW = getBridgeModeAt(wx - 1, wy - 1) !== B_NONE;
            const bSE = getBridgeModeAt(wx + 1, wy + 1) !== B_NONE;
            const abutStart =
              !bNW && (landN || landW || !isWaterLike(getTileAt(wx - 1, wy - 1)));
            const abutEnd =
              !bSE && (landS || landE || !isWaterLike(getTileAt(wx + 1, wy + 1)));
            diagBridgeCells.push({
              wx,
              wy,
              sx,
              sy,
              mode: bMode,
              isNESW: false,
              rDeck,
              rParapet,
              dMin: abutStart ? -26 : -16,
              dMax: abutEnd ? 26 : 16,
              abutStart,
              abutEnd,
            });
          }
          continue;
        }

        if (wx < layerStartWx || wx > layerEndWx || wy < layerStartWy || wy > layerEndWy) continue;

        const isHoriz =
          axis === AXIS_HORIZ || ((bW || bE || landW || landE) && !bN && !bS && axis !== AXIS_VERT);
        draw16BitOrthoBridgeTile(
          pctx,
          wx,
          wy,
          sx,
          sy,
          bMode,
          isHoriz,
          bN,
          bS,
          bW,
          bE,
          landN,
          landS,
          landW,
          landE
        );
      }
    }

    if (diagBridgeCells.length > 0) {
      render16BitDiagonalBridgePass(pctx, diagBridgeCells, layerW, layerH, getTileAt);
    }

    // ========================================================================
    // PASS 2: Y-SORTED 16-BIT LANDMARK SET-PIECES, ARCHITECTURE, LAMPS & TREES
    // ========================================================================
    for (let wy = layerStartWy; wy <= layerEndWy; wy++) {
      for (let wx = layerStartWx; wx <= layerEndWx; wx++) {
        const sx = wx * TILE - layerOriginPxX;
        const sy = wy * TILE - layerOriginPxY;

        // Render unified 16-bit JRPG Landmark Set-Piece at its Y-sorted bottom-left anchor!
        const anchorStamp = getLandmarkAnchorAt(wx, wy);
        if (anchorStamp) {
          const topSy = (wy - (anchorStamp.h - 1)) * TILE - layerOriginPxY;
          draw16BitLandmarkSetPiece(pctx, anchorStamp.kind, sx, topSy, envTick);
          continue;
        }
        if (isLandmarkCellAt(wx, wy)) {
          continue;
        }

        const t = getTileAt(wx, wy);
        const h = tileHash(wx, wy);

        if (t === T_BUILDING) {
          const isPlainBldg = (tx: number, ty: number) =>
            getTileAt(tx, ty) === T_BUILDING && !isLandmarkCellAt(tx, ty);

          const resolveArchAt = (tx: number, ty: number): number => {
            const explicit = getBldgClassAt(tx, ty);
            if (explicit !== BC_NONE) return explicit;
            const settle = getSettlementAt(tx, ty);
            if (settle === SETTLE_INDUSTRIAL) return BC_INDUSTRIAL;
            if (
              getTileAt(tx, ty + 1) === T_COMMERCIAL ||
              getTileAt(tx, ty - 1) === T_COMMERCIAL ||
              getTileAt(tx - 1, ty) === T_COMMERCIAL ||
              getTileAt(tx + 1, ty) === T_COMMERCIAL
            ) {
              return BC_COMMERCIAL;
            }
            if (settle === SETTLE_CITY_CENTER) return BC_URBAN_MIDRISE;
            if (settle === SETTLE_SUBURB) return BC_SUBURBAN;
            if (settle === SETTLE_HAMLET) return BC_FARM;
            return BC_VILLAGE;
          };

          const archCode = resolveArchAt(wx, wy);
          const northTile = getTileAt(wx, wy - 1);
          const southTile = getTileAt(wx, wy + 1);
          const rawNB = isPlainBldg(wx, wy - 1);
          const rawSB = isPlainBldg(wx, wy + 1);
          const wB = isPlainBldg(wx - 1, wy);
          const eB = isPlainBldg(wx + 1, wy);

          // Industrial & commercial halls allow deeper 3-tile roof spans; residential/urban blocks tier every 2 rows
          const maxSlopeSpan = archCode === BC_INDUSTRIAL || archCode === BC_COMMERCIAL ? 3 : 2;
          let northRun = 0;
          if (rawNB) {
            for (let d = 1; d <= 9; d++) {
              if (isPlainBldg(wx, wy - d)) {
                northRun++;
              } else {
                break;
              }
            }
          }
          const nB = rawNB && northRun % maxSlopeSpan !== 0;
          const sB = rawSB && (northRun + 1) % maxSlopeSpan !== 0;

          if (subtleBuildings) {
            const baseCol =
              archCode === BC_INDUSTRIAL
                ? '#94a3b8'
                : archCode === BC_URBAN_MIDRISE
                ? '#bfb29c'
                : '#c2b193';
            const innerCol =
              archCode === BC_INDUSTRIAL
                ? '#cbd5e1'
                : archCode === BC_URBAN_MIDRISE
                ? '#ddd2be'
                : '#dfd1b8';
            pctx.fillStyle = baseCol;
            pctx.fillRect(sx, sy, 16, 16);
            pctx.fillStyle = innerCol;
            pctx.fillRect(sx + 1, sy + 1, 14, 14);
            pctx.fillStyle = '#786246';
            if (!nB) pctx.fillRect(sx, sy, 16, 1);
            if (!sB) pctx.fillRect(sx, sy + 15, 16, 1);
            if (!wB) pctx.fillRect(sx, sy, 1, 16);
            if (!eB) pctx.fillRect(sx + 15, sy, 1, 16);
          } else {
            const styleGroup = (tx: number, ty: number) =>
              (resolveArchAt(tx, ty) << 3) | (tileHash(tx >> 1, ty >> 1) % 3);
            const myGroup = styleGroup(wx, wy);
            const sameW = wB && styleGroup(wx - 1, wy) === myGroup;
            const sameE = eB && styleGroup(wx + 1, wy) === myGroup;
            const onCliffEdge =
              !sB &&
              reliefEnabled &&
              hasTerraces &&
              getTerraceAt(wx, wy) > getTerraceAt(wx, wy + 1);
            const facesStreetSouth =
              southTile === T_MAIN_ROAD || southTile === T_STREET || southTile === T_PLAZA;

            draw16BitTypedBuildingTile(
              pctx,
              wx,
              wy,
              sx,
              sy,
              archCode,
              getBldgLevelsAt(wx, wy),
              getSettlementAt(wx, wy),
              nB,
              sB,
              wB,
              eB,
              rawNB,
              rawSB,
              sameW,
              sameE,
              isProtectedFromBuilding(northTile),
              onCliffEdge,
              facesStreetSouth,
              h,
              envTick
            );
          }
        } else if (t === T_FOREST) {
          // Dense, untamed multi-species woodland canopy with slight organic jitter
          if ((wx + wy) % 2 === 0 || h % 3 !== 0) {
            const jx = ((h >> 4) % 3) - 1;
            const jy = ((h >> 7) % 3) - 1;
            draw16BitTreeCanopy(pctx, sx + jx, sy + jy, h, sway);
          }
        } else if (t === T_PARK && h % 9 === 0) {
          // Airy, manicured park trees (broadleaf oaks & ornamental cypress/poplar — never dark mountain pines!)
          draw16BitTreeCanopy(pctx, sx, sy, h % 4 === 0 ? 3 : (h % 3) * 5, sway);
        } else if (t === T_CEMETERY && h % 7 === 0) {
          // Solemn slender cypresses in cemeteries
          draw16BitTreeCanopy(pctx, sx, sy, 3, sway);
        } else if (
          t === T_RESIDENTIAL &&
          getSettlementAt(wx, wy) !== SETTLE_CITY_CENTER &&
          getSettlementAt(wx, wy) !== SETTLE_INDUSTRIAL &&
          h % 19 === 0 &&
          getTileAt(wx, wy - 1) !== T_BUILDING &&
          !isLandmarkCellAt(wx, wy - 1)
        ) {
          draw16BitTreeCanopy(pctx, sx, sy, h, sway);
        } else if (t === T_MEADOW && h % 37 === 0) {
          draw16BitTreeCanopy(pctx, sx, sy, h, sway);
        } else if (
          (t === T_MAIN_ROAD || t === T_PLAZA) &&
          h % 19 === 0 &&
          !isRoadLike(getTileAt(wx, wy - 1)) &&
          getBridgeModeAt(wx, wy) === B_NONE
        ) {
          draw16BitStreetLamp(pctx, sx + 2, sy + 2, envTick % 2 === 0);
        }
      }
    }
          worldLayerKeyRef.current = { mapRef: worldMapData, key: staticCacheKey };
        }
      }
    }

    const layerSubX = offsetX - layerOriginPxX;
    const layerSubY = offsetY - layerOriginPxY;
    pctx.drawImage(worldLayer, layerSubX, layerSubY, VW, VH, 0, 0, VW, VH);

    // ========================================================================
    // PASS 2B: LIVING 16-BIT FAUNA + TERRA INCOGNITA FOG OF WAR
    // ========================================================================
    const effectiveTime = currentEffectiveTime;
    const isPrecipitating =
      weather?.condition === 'rain' ||
      weather?.condition === 'storm' ||
      weather?.condition === 'snow';

    if (!subterraneanMode) {
      if (effectiveTime !== 'night' && !isPrecipitating) {
        const butterflyCount = effectiveTime === 'dusk' ? 2 : 5;
        for (let bIdx = 0; bIdx < butterflyCount; bIdx++) {
          const bxBase = ((bIdx * 103 + Math.floor(worldPxX * 0.25)) % (VW - 40)) + 20;
          const byBase = ((bIdx * 67 + Math.floor(worldPxY * 0.25)) % (VH - 40)) + 20;
          const flutterX = bxBase + Math.round(Math.sin((animTick + bIdx * 19) * 0.18) * 9);
          const flutterY = byBase + Math.round(Math.cos((animTick + bIdx * 23) * 0.22) * 6);
          const wingOpen = (animTick + bIdx) % 2 === 0;
          const bColor = bIdx % 3 === 0 ? '#fde047' : bIdx % 3 === 1 ? '#7dd3fc' : '#fbcfe8';

          pctx.fillStyle = 'rgba(20, 12, 7, 0.28)';
          pctx.fillRect(flutterX, flutterY + 4, 2, 1);
          pctx.fillStyle = bColor;
          if (wingOpen) {
            pctx.fillRect(flutterX - 1, flutterY, 1, 2);
            pctx.fillRect(flutterX + 2, flutterY, 1, 2);
            pctx.fillStyle = '#ffffff';
            pctx.fillRect(flutterX, flutterY + 1, 2, 1);
          } else {
            pctx.fillRect(flutterX, flutterY - 1, 2, 2);
          }
        }
      }
      if ((effectiveTime === 'dusk' || effectiveTime === 'night') && !isPrecipitating) {
        // Dusk & Nocturnal Bioluminescent Fireflies!
        const fireflyCount = effectiveTime === 'night' ? 8 : 4;
        for (let fIdx = 0; fIdx < fireflyCount; fIdx++) {
          const fxBase = ((fIdx * 89 + Math.floor(worldPxX * 0.2)) % (VW - 36)) + 18;
          const fyBase = ((fIdx * 59 + Math.floor(worldPxY * 0.2)) % (VH - 36)) + 18;
          const fx = fxBase + Math.round(Math.sin((animTick + fIdx * 17) * 0.14) * 7);
          const fy = fyBase + Math.round(Math.cos((animTick + fIdx * 13) * 0.16) * 5);
          if ((animTick + fIdx * 3) % 6 < 4) {
            pctx.fillStyle = 'rgba(190, 242, 100, 0.34)';
            pctx.fillRect(fx - 1, fy - 1, 4, 4);
            pctx.fillStyle = '#fef08a';
            pctx.fillRect(fx, fy, 2, 2);
          }
        }
      }

      // Gliding 16-bit Songbird + Ground Shadow
      const birdX = ((animTick * 2) % (VW + 120)) - 60;
      const birdY = 46 + Math.round(Math.sin(animTick * 0.08) * 10);
      const wingUp = Math.floor(animTick / 2) % 2 === 0;
      pctx.fillStyle = 'rgba(20, 12, 7, 0.22)';
      pctx.fillRect(birdX + 4, birdY + 18, 4, 2);
      pctx.fillStyle = '#1e293b';
      pctx.fillRect(birdX + 1, birdY, 3, 1);
      pctx.fillStyle = '#f8fafc';
      if (wingUp) {
        pctx.fillRect(birdX, birdY - 2, 2, 2);
        pctx.fillRect(birdX + 3, birdY - 2, 2, 2);
      } else {
        pctx.fillRect(birdX, birdY + 1, 2, 1);
        pctx.fillRect(birdX + 3, birdY + 1, 2, 1);
      }

      // Soft Organic SNES Cloud Shadows
      const cloudDrift = (envTick * 2) % (VW + 220);
      pctx.fillStyle = 'rgba(20, 32, 46, 0.075)';
      pctx.fillRect(cloudDrift - 130, 38, 96, 26);
      pctx.fillRect(cloudDrift - 112, 30, 62, 42);
      pctx.fillRect(cloudDrift - 94, 26, 34, 48);
    } else {
      // Subterranean luminescent dust motes & mineral spores!
      for (let mIdx = 0; mIdx < 8; mIdx++) {
        const mxBase = ((mIdx * 97 + Math.floor(worldPxX * 0.18)) % Math.max(40, VW - 32)) + 16;
        const myBase = ((mIdx * 61 + Math.floor(worldPxY * 0.18)) % Math.max(40, VH - 32)) + 16;
        const mx = mxBase + Math.round(Math.sin((animTick + mIdx * 13) * 0.12) * 5);
        const my = myBase + Math.round(Math.cos((animTick + mIdx * 17) * 0.14) * 4);
        if ((animTick + mIdx * 2) % 5 < 3) {
          pctx.fillStyle = mIdx % 3 === 0 ? 'rgba(103, 232, 249, 0.55)' : 'rgba(253, 224, 71, 0.45)';
          pctx.fillRect(mx, my, 2, 2);
        }
      }
    }

    // ========================================================================
    // PASS 2C: TERRA INCOGNITA PARCHMENT FOG OF WAR ON UNEXPLORED WORLD CELLS
    // ========================================================================
    if (fogEnabled && fogSet) {
      const clearR = Math.max(70, fogVisionMeters);
      for (let wy = startWy; wy <= endWy; wy++) {
        const sy = wy * TILE - offsetY;
        const tLat = -((wy + 0.5) * tileMeters) / 110540;
        for (let wx = startWx; wx <= endWx; wx++) {
          const sx = wx * TILE - offsetX;
          const tLng = ((wx + 0.5) * tileMeters) / (111320 * worldMapData.cosRef);
          const distToPlayer = haversineMeters(effectivePlayerLat, effectivePlayerLng, tLat, tLng);
          if (distToPlayer <= clearR) continue;

          const fc = fogCoordsFromLatLng(tLat, tLng);
          if (fogSet.has(fogKeyFromCoords(fc.fx, fc.fy))) continue;

          const edgeFade = distToPlayer < clearR + 28 ? 0.52 : 0.8;
          pctx.fillStyle = subterraneanMode
            ? `rgba(18, 12, 9, ${edgeFade * 0.88})`
            : `rgba(222, 200, 160, ${edgeFade})`;
          pctx.fillRect(sx, sy, TILE, TILE);

          // Subtle cartographic parchment grain & graticule lines
          if ((wx & 3) === 0) {
            pctx.fillStyle = subterraneanMode
              ? 'rgba(180, 130, 76, 0.14)'
              : 'rgba(138, 99, 56, 0.22)';
            pctx.fillRect(sx, sy, 1, TILE);
          }
          if ((wy & 3) === 0) {
            pctx.fillStyle = subterraneanMode
              ? 'rgba(180, 130, 76, 0.14)'
              : 'rgba(138, 99, 56, 0.22)';
            pctx.fillRect(sx, sy, TILE, 1);
          }
          if (!subterraneanMode && ((wx * 7 + wy * 13) & 7) === 0) {
            pctx.fillStyle = 'rgba(120, 82, 44, 0.28)';
            pctx.fillRect(sx + 6, sy + 7, 3, 1);
          }
        }
      }
    }

    // ========================================================================
    // PASS 2D: DYNAMIC TIME-OF-DAY, SUBTERRANEAN TORCHLIGHT & WEATHER PARTICLES
    // ========================================================================
    const explorerVirtual = projectToVirtual(effectivePlayerLat, effectivePlayerLng);
    const exPx = explorerVirtual.vx;
    const eyPx = explorerVirtual.vy;

    if (subterraneanMode) {
      // Warm 16-bit Dungeon Torchlight Halo & Readable Subterranean Shadow Veil
      let shadeCanvas = shadeCanvasRef.current;
      if (!shadeCanvas) {
        shadeCanvas = document.createElement('canvas');
        shadeCanvasRef.current = shadeCanvas;
      }
      if (shadeCanvas.width !== VW) shadeCanvas.width = VW;
      if (shadeCanvas.height !== VH) shadeCanvas.height = VH;
      const sctx = shadeCanvas.getContext('2d');
      if (sctx) {
        sctx.globalCompositeOperation = 'source-over';
        sctx.clearRect(0, 0, VW, VH);
        sctx.fillStyle = 'rgba(10, 7, 5, 0.42)';
        sctx.fillRect(0, 0, VW, VH);

        sctx.globalCompositeOperation = 'destination-out';
        const torchJitter = (animTick % 4 === 0 ? 2 : 0) - (animTick % 5 === 0 ? 1 : 0);
        const torchR = 92 + torchJitter;
        const lGrad = sctx.createRadialGradient(exPx, eyPx, 12, exPx, eyPx, torchR);
        lGrad.addColorStop(0, 'rgba(0, 0, 0, 0.98)');
        lGrad.addColorStop(0.62, 'rgba(0, 0, 0, 0.62)');
        lGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        sctx.fillStyle = lGrad;
        sctx.beginPath();
        sctx.arc(exPx, eyPx, torchR, 0, Math.PI * 2);
        sctx.fill();

        // Subtle brazier / crystal glow on real mapped subterranean cavities!
        for (let i = 0; i < subterranean.length; i++) {
          const sf = subterranean[i];
          if (sf.isLine || !sf.points[0]) continue;
          const pv = projectToVirtual(sf.points[0].lat, sf.points[0].lng);
          if (pv.vx < -40 || pv.vx > VW + 40 || pv.vy < -40 || pv.vy > VH + 40) continue;
          const cGrad = sctx.createRadialGradient(pv.vx, pv.vy, 3, pv.vx, pv.vy, 32);
          cGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
          cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          sctx.fillStyle = cGrad;
          sctx.beginPath();
          sctx.arc(pv.vx, pv.vy, 32, 0, Math.PI * 2);
          sctx.fill();
        }

        pctx.drawImage(shadeCanvas, 0, 0);
      }

      const torchHalo = pctx.createRadialGradient(exPx, eyPx, 4, exPx, eyPx, 72);
      torchHalo.addColorStop(0, 'rgba(251, 191, 36, 0.25)');
      torchHalo.addColorStop(0.6, 'rgba(234, 88, 12, 0.1)');
      torchHalo.addColorStop(1, 'rgba(234, 88, 12, 0)');
      pctx.fillStyle = torchHalo;
      pctx.beginPath();
      pctx.arc(exPx, eyPx, 72, 0, Math.PI * 2);
      pctx.fill();
    } else if (effectiveTime === 'day') {
      const sunGrad = pctx.createRadialGradient(40, 24, 10, 80, 60, 260);
      sunGrad.addColorStop(0, 'rgba(254, 243, 199, 0.16)');
      sunGrad.addColorStop(1, 'rgba(254, 243, 199, 0)');
      pctx.fillStyle = sunGrad;
      pctx.fillRect(0, 0, VW, VH);
    } else if (effectiveTime === 'dawn') {
      pctx.fillStyle = 'rgba(251, 146, 60, 0.13)';
      pctx.fillRect(0, 0, VW, VH);
      const dawnGrad = pctx.createLinearGradient(0, 0, VW, VH);
      dawnGrad.addColorStop(0, 'rgba(253, 186, 116, 0.18)');
      dawnGrad.addColorStop(1, 'rgba(56, 189, 248, 0.08)');
      pctx.fillStyle = dawnGrad;
      pctx.fillRect(0, 0, VW, VH);
    } else if (effectiveTime === 'dusk' || effectiveTime === 'night') {
      let shadeCanvas = shadeCanvasRef.current;
      if (!shadeCanvas) {
        shadeCanvas = document.createElement('canvas');
        shadeCanvasRef.current = shadeCanvas;
      }
      if (shadeCanvas.width !== VW) shadeCanvas.width = VW;
      if (shadeCanvas.height !== VH) shadeCanvas.height = VH;
      const sctx = shadeCanvas.getContext('2d');
      if (sctx) {
        sctx.globalCompositeOperation = 'source-over';
        sctx.clearRect(0, 0, VW, VH);
        sctx.fillStyle =
          effectiveTime === 'night' ? 'rgba(11, 18, 46, 0.56)' : 'rgba(124, 45, 18, 0.26)';
        sctx.fillRect(0, 0, VW, VH);

        // Carve warm lantern light pool around the explorer + discovered monuments!
        sctx.globalCompositeOperation = 'destination-out';
        const lanternR = effectiveTime === 'night' ? 74 : 56;
        const lGrad = sctx.createRadialGradient(exPx, eyPx, 10, exPx, eyPx, lanternR);
        lGrad.addColorStop(0, 'rgba(0, 0, 0, 0.96)');
        lGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.55)');
        lGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        sctx.fillStyle = lGrad;
        sctx.beginPath();
        sctx.arc(exPx, eyPx, lanternR, 0, Math.PI * 2);
        sctx.fill();

        for (const p of filteredPois) {
          if (!unlockedIds.has(p.id)) continue;
          const pv = projectToVirtual(p.lat, p.lng);
          if (pv.vx < -40 || pv.vx > VW + 40 || pv.vy < -40 || pv.vy > VH + 40) continue;
          const mGrad = sctx.createRadialGradient(pv.vx, pv.vy - 8, 4, pv.vx, pv.vy - 8, 34);
          mGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
          mGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          sctx.fillStyle = mGrad;
          sctx.beginPath();
          sctx.arc(pv.vx, pv.vy - 8, 34, 0, Math.PI * 2);
          sctx.fill();
        }

        pctx.drawImage(shadeCanvas, 0, 0);
      }

      // Warm golden lantern tint around explorer
      const warmHalo = pctx.createRadialGradient(exPx, eyPx, 4, exPx, eyPx, 58);
      warmHalo.addColorStop(0, 'rgba(253, 224, 71, 0.22)');
      warmHalo.addColorStop(1, 'rgba(251, 191, 36, 0)');
      pctx.fillStyle = warmHalo;
      pctx.beginPath();
      pctx.arc(exPx, eyPx, 58, 0, Math.PI * 2);
      pctx.fill();
    }

    // Real-Time Local Weather Particles (Open-Meteo — surface only!)
    const wCond = weather?.condition || 'clear';
    if (!subterraneanMode && (wCond === 'rain' || wCond === 'storm')) {
      const dropCount = wCond === 'storm' ? 48 : 30;
      for (let i = 0; i < dropCount; i++) {
        const rx = ((i * 73 + animTick * 7) % (VW + 32)) - 16;
        const ry = ((i * 47 + animTick * 13) % (VH + 32)) - 16;
        pctx.fillStyle = i % 3 === 0 ? 'rgba(224, 242, 254, 0.82)' : 'rgba(125, 211, 252, 0.68)';
        pctx.fillRect(rx, ry, 1, 4);
        pctx.fillRect(rx - 1, ry + 3, 1, 3);
        if ((i + animTick) % 9 === 0) {
          pctx.fillStyle = 'rgba(224, 242, 254, 0.72)';
          pctx.fillRect(rx - 2, ry + 6, 3, 1);
        }
      }
      if (wCond === 'storm' && animTick % 53 === 0) {
        pctx.fillStyle = 'rgba(240, 249, 255, 0.22)';
        pctx.fillRect(0, 0, VW, VH);
      }
    } else if (!subterraneanMode && wCond === 'snow') {
      for (let i = 0; i < 34; i++) {
        const sxFlake =
          (((i * 61 + animTick * 2 + Math.round(Math.sin((animTick + i * 7) * 0.15) * 6)) %
            (VW + 20)) +
            (VW + 20)) %
            (VW + 20) -
          10;
        const syFlake = ((i * 43 + animTick * 3) % (VH + 20)) - 10;
        pctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        pctx.fillRect(sxFlake, syFlake, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
      }
    } else if (!subterraneanMode && (wCond === 'fog' || effectiveTime === 'dawn')) {
      for (let m = 0; m < 4; m++) {
        const mx = ((m * 140 + envTick * 2) % (VW + 180)) - 90;
        const my = 44 + m * 68;
        pctx.fillStyle = wCond === 'fog' ? 'rgba(241, 245, 249, 0.22)' : 'rgba(254, 243, 199, 0.12)';
        pctx.fillRect(mx, my, 130, 14);
        pctx.fillRect(mx + 18, my - 5, 92, 24);
      }
    }

    if (!subterraneanMode && (weather?.windKmh || 0) >= 15 && wCond !== 'snow') {
      for (let l = 0; l < 7; l++) {
        const lx = ((l * 83 + animTick * 4) % (VW + 24)) - 12;
        const ly = ((l * 53 + animTick * 2 + Math.round(Math.sin(animTick * 0.2 + l) * 4)) % VH);
        pctx.fillStyle = l % 2 === 0 ? '#84cc16' : '#f59e0b';
        pctx.fillRect(lx, ly, 2, 1);
      }
    }

    // Blit crisp 16-bit world to main high-res canvas (2x virtual pixel scale)
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);

    const px = (vx: number, vy: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(
        Math.round(vx * SCALE),
        Math.round(vy * SCALE),
        Math.round(w * SCALE),
        Math.round(h * SCALE)
      );
    };

    const strokePxRect = (vx: number, vy: number, w: number, h: number, color: string) => {
      px(vx, vy, w, 1, color);
      px(vx, vy + h - 1, w, 1, color);
      px(vx, vy, 1, h, color);
      px(vx + w - 1, vy, 1, h, color);
    };

    // ========================================================================
    // PASS 2E: OPTIONAL DASHED TRACES (BREADCRUMBS, ROUTE, ARCHIVE THREADS & AURA)
    // Cleanly toggleable via `dashedTracesEnabled` so the 16-bit map stays pure!
    // ========================================================================
    if (dashedTracesEnabled && breadcrumbTrail.length > 1) {
      for (let i = 0; i < breadcrumbTrail.length; i++) {
        const bp = projectToVirtual(breadcrumbTrail[i].lat, breadcrumbTrail[i].lng);
        if (bp.vx < -8 || bp.vx > VW + 8 || bp.vy < -8 || bp.vy > VH + 8) continue;
        px(bp.vx - 1, bp.vy - 1, 2, 2, 'rgba(120, 53, 15, 0.55)');
        px(bp.vx, bp.vy, 1, 1, '#fde68a');
      }
    }

    if (plannedRoute.length > 0) {
      if (dashedTracesEnabled) {
        ctx.save();
        ctx.strokeStyle = '#140b05';
        ctx.lineWidth = 3 * SCALE;
        ctx.setLineDash([4 * SCALE, 3 * SCALE]);
        ctx.lineDashOffset = -(animTick % 7) * SCALE;
        ctx.beginPath();
        ctx.moveTo(exPx * SCALE, eyPx * SCALE);
        for (const wp of plannedRoute) {
          const vp = projectToVirtual(wp.lat, wp.lng);
          ctx.lineTo(vp.vx * SCALE, vp.vy * SCALE);
        }
        ctx.stroke();

        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.5 * SCALE;
        ctx.stroke();
        ctx.restore();
      }

      const destWp = plannedRoute[plannedRoute.length - 1];
      const dv = projectToVirtual(destWp.lat, destWp.lng);
      if (dv.vx >= -12 && dv.vx <= VW + 12 && dv.vy >= -12 && dv.vy <= VH + 12) {
        strokePxRect(dv.vx - 4, dv.vy - 4, 9, 9, '#140b05');
        strokePxRect(dv.vx - 3, dv.vy - 3, 7, 7, '#fde047');
      }
    }

    if (dashedTracesEnabled && chroniqueurThreads) {
      const focusId = selectedPoiId || hoveredPoiId;
      const drawnPairs = new Set<string>();
      for (const srcPoi of filteredPois) {
        const isFocus = focusId === srcPoi.id;
        // When a POI is selected/hovered, show only its historical links cleanly;
        // otherwise only whisper subtle links between already-unlocked monuments (no red clutter!)
        if (focusId && !isFocus) continue;
        const srcUnlocked = unlockedIds.has(srcPoi.id);
        if (!isFocus && !srcUnlocked) continue;
        if (!srcPoi.relatedPoiIds || srcPoi.relatedPoiIds.length === 0) continue;

        const sv = projectToVirtual(srcPoi.lat, srcPoi.lng);
        for (const relId of srcPoi.relatedPoiIds) {
          const targetPoi = poiById.get(relId);
          if (!targetPoi) continue;
          const bothUnl = srcUnlocked && unlockedIds.has(relId);
          if (!isFocus && !bothUnl) continue;

          const pairKey = [srcPoi.id, relId].sort().join('__');
          if (drawnPairs.has(pairKey)) continue;
          drawnPairs.add(pairKey);

          const tv = projectToVirtual(targetPoi.lat, targetPoi.lng);
          ctx.save();
          ctx.strokeStyle = isFocus
            ? bothUnl
              ? '#fde047'
              : 'rgba(251, 113, 133, 0.78)'
            : 'rgba(251, 191, 36, 0.42)';
          ctx.lineWidth = (isFocus ? 1.75 : 1) * SCALE;
          ctx.setLineDash([4 * SCALE, 4 * SCALE]);
          ctx.lineDashOffset = -(animTick % 8) * SCALE;
          ctx.beginPath();
          ctx.moveTo(sv.vx * SCALE, (sv.vy - 10) * SCALE);
          ctx.lineTo(tv.vx * SCALE, (tv.vy - 10) * SCALE);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Ornate Dashed Golden Discovery Aura around Explorer (only when dashed traces are enabled!)
    if (dashedTracesEnabled) {
      const ringPx = Math.max(15, Math.round(90 / metersPerVirtualPx));
      if (
        exPx + ringPx > -8 &&
        exPx - ringPx < VW + 8 &&
        eyPx + ringPx > -8 &&
        eyPx - ringPx < VH + 8
      ) {
        ctx.save();
        ctx.strokeStyle = 'rgba(254, 243, 199, 0.72)';
        ctx.lineWidth = SCALE;
        ctx.setLineDash([5 * SCALE, 4 * SCALE]);
        ctx.lineDashOffset = -(animTick % 9) * SCALE;
        ctx.strokeRect(
          (exPx - ringPx) * SCALE,
          (eyPx - ringPx) * SCALE,
          ringPx * 2 * SCALE,
          ringPx * 2 * SCALE
        );
        ctx.restore();
      }
    }

    const offscreenCandidates: Array<{ poi: PoiItem; vx: number; vy: number; dist: number }> = [];

    // Screen-space bounding-box anti-collision (in physical canvas pixels)
    // Ensures named place cartouches & non-selected distance tags never overlap the Explorer, POIs, Portals or NPCs!
    const occupiedLabelRects: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
    const occupiedTagRects: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
    const hasRectCollision = (
      list: Array<{ x0: number; y0: number; x1: number; y1: number }>,
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      pad = 4
    ): boolean => {
      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        if (x0 - pad < r.x1 && x1 + pad > r.x0 && y0 - pad < r.y1 && y1 + pad > r.y0) {
          return true;
        }
      }
      return false;
    };

    // Reserve Explorer sprite space
    occupiedLabelRects.push({
      x0: (exPx - 11) * SCALE,
      y0: (eyPx - 18) * SCALE,
      x1: (exPx + 11) * SCALE,
      y1: (eyPx + 10) * SCALE,
    });

    // ========================================================================
    // PASS 2F: SURFACE <-> SOUS-SOL STAIRWELL PORTALS & TOPONYM BANNERS
    // ========================================================================
    for (const portal of portalAnchors) {
      const pv = projectToVirtual(portal.lat, portal.lng);
      if (pv.vx < -16 || pv.vx > VW + 16 || pv.vy < -16 || pv.vy > VH + 16) continue;
      occupiedLabelRects.push({
        x0: (pv.vx - 8) * SCALE,
        y0: (pv.vy - 7) * SCALE,
        x1: (pv.vx + 8) * SCALE,
        y1: (pv.vy + 7) * SCALE,
      });
      px(pv.vx - 6, pv.vy - 5, 13, 10, '#140b05');
      px(pv.vx - 5, pv.vy - 4, 11, 8, subterraneanMode ? '#38bdf8' : '#78716c');
      px(pv.vx - 4, pv.vy - 3, 9, 6, '#1c1917');
      px(pv.vx - 3, pv.vy - 2, 7, 1, '#d6d3d1');
      px(pv.vx - 2, pv.vy, 6, 1, '#a8a29e');
      px(pv.vx - 1, pv.vy + 2, 5, 1, '#78716c');
      px(pv.vx - 5, pv.vy - 4, 2, 2, '#fde047');
      px(pv.vx + 4, pv.vy - 4, 2, 2, '#fde047');
    }

    // Pre-compute visible NPCs & POIs once so named place banners respect their screen boxes while staying underneath sprites!
    const npcClearR = Math.max(70, fogVisionMeters) + 26;
    const visibleNpcsForFrame: Array<{
      npc: WorldNpc;
      cx: number;
      cy: number;
      facing: 'left' | 'right';
      showBubble: boolean;
      isSelected: boolean;
    }> = [];

    for (const npc of layerNpcs) {
      const nv = projectToVirtual(npc.lat, npc.lng);
      if (nv.vx < -28 || nv.vx > VW + 28 || nv.vy < -28 || nv.vy > VH + 28) continue;
      const distNpc = haversineMeters(effectivePlayerLat, effectivePlayerLng, npc.lat, npc.lng);
      if (fogEnabled && fogSet && !subterraneanMode && distNpc > npcClearR) {
        const fc = fogCoordsFromLatLng(npc.lat, npc.lng);
        if (!fogSet.has(fogKeyFromCoords(fc.fx, fc.fy))) continue;
      }
      const isSelectedNpc = activeNpcDialogue?.npc.id === npc.id;
      const isHoveredNpc = hoveredNpcId === npc.id;
      const animOff = getNpcAnimatedOffsetPx(npc, animTick);
      const cxNpc = nv.vx + animOff.dx;
      const cyNpc = nv.vy + animOff.dy;
      const showBubble = distNpc <= 38 || isHoveredNpc || isSelectedNpc;
      visibleNpcsForFrame.push({
        npc,
        cx: cxNpc,
        cy: cyNpc,
        facing: animOff.facing,
        showBubble,
        isSelected: isSelectedNpc || isHoveredNpc,
      });
      occupiedLabelRects.push({
        x0: (cxNpc - 9) * SCALE,
        y0: (cyNpc - (showBubble ? 28 : 20)) * SCALE,
        x1: (cxNpc + 9) * SCALE,
        y1: (cyNpc + 3) * SCALE,
      });
    }

    const poisForRender =
      hoveredPoiId && hoveredPoiId !== selectedPoiId
        ? [
            ...filteredPois.filter((p) => p.id !== hoveredPoiId),
            ...filteredPois.filter((p) => p.id === hoveredPoiId),
          ]
        : filteredPois;

    const projectedPois: Array<{
      poi: PoiItem;
      vx: number;
      vy: number;
      isUnlocked: boolean;
      distMeters: number;
    }> = [];

    for (const poi of poisForRender) {
      const { vx, vy } = projectToVirtual(poi.lat, poi.lng);
      const isUnlocked = unlockedIds.has(poi.id);
      const distMeters = haversineMeters(playerLat, playerLng, poi.lat, poi.lng);

      if (vx < 14 || vx > VW - 14 || vy < 24 || vy > VH - 12) {
        if (!isUnlocked) {
          offscreenCandidates.push({ poi, vx, vy, dist: distMeters });
        }
        if (vx < -32 || vx > VW + 32 || vy < -32 || vy > VH + 34) continue;
      }
      projectedPois.push({ poi, vx, vy, isUnlocked, distMeters });
      occupiedLabelRects.push({
        x0: (vx - 15) * SCALE,
        y0: (vy - 29) * SCALE,
        x1: (vx + 15) * SCALE,
        y1: (vy + 14) * SCALE,
      });
    }

    if (!subterraneanMode && !uiCollapsed && zoomLevel >= 2 && zoomLevel <= 5) {
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const lbl of namedPlaceLabels) {
        const lv = projectToVirtual(lbl.lat, lbl.lng);
        if (lv.vx < 36 || lv.vx > VW - 36 || lv.vy < 28 || lv.vy > VH - 28) continue;
        const text = lbl.name;
        const tw = Math.ceil(ctx.measureText(text).width) + 12;
        const tx = Math.round(lv.vx * SCALE - tw / 2);
        const ty = Math.round(lv.vy * SCALE - 8);
        if (hasRectCollision(occupiedLabelRects, tx - 2, ty - 2, tx + tw + 2, ty + 16, 4)) {
          continue;
        }
        occupiedLabelRects.push({ x0: tx - 2, y0: ty - 2, x1: tx + tw + 2, y1: ty + 16 });
        ctx.fillStyle = 'rgba(20, 11, 5, 0.72)';
        ctx.fillRect(tx - 1, ty - 1, tw + 2, 16);
        ctx.fillStyle =
          lbl.kind === 'water' || lbl.kind === 'waterway'
            ? 'rgba(224, 242, 254, 0.88)'
            : lbl.kind === 'forest' || lbl.kind === 'park'
            ? 'rgba(220, 252, 231, 0.88)'
            : 'rgba(251, 242, 220, 0.88)';
        ctx.fillRect(tx, ty, tw, 14);
        ctx.fillStyle = '#1e1209';
        ctx.fillText(text, Math.round(lv.vx * SCALE), ty + 7);
      }
    }

    // ========================================================================
    // PASS 2G: HERBIER & ÉCHANTILLONS GÉOLOGIQUES DU VRAI SOUS-SOL
    // ========================================================================
    for (const spec of layerSpecimens) {
      const sv = projectToVirtual(spec.lat, spec.lng);
      if (sv.vx < -20 || sv.vx > VW + 20 || sv.vy < -20 || sv.vy > VH + 20) continue;
      const distSpec = haversineMeters(effectivePlayerLat, effectivePlayerLng, spec.lat, spec.lng);
      if (fogEnabled && fogSet && !subterraneanMode && distSpec > npcClearR) {
        const fc = fogCoordsFromLatLng(spec.lat, spec.lng);
        if (!fogSet.has(fogKeyFromCoords(fc.fx, fc.fy))) continue;
      }
      const isHoveredSpec = hoveredSpecimenId === spec.nodeId || distSpec <= 28;
      drawSpecimenSprite16Bit(ctx, {
        cx: sv.vx,
        cy: sv.vy,
        scale: SCALE,
        specimenId: spec.specimenId,
        animTick,
        isHovered: isHoveredSpec,
      });
    }

    // ========================================================================
    // PASS 3A: LIVING 16-BIT NPCS (HUMAINS, ANIMAUX & INSECTES — ATLAS CACHED)
    // ========================================================================
    for (const item of visibleNpcsForFrame) {
      if (item.npc.kind === 'luciole' && (effectiveTime === 'dusk' || effectiveTime === 'night')) {
        const glowPulse = (animTick + (item.npc.seed % 5)) % 4 < 3;
        if (glowPulse) {
          ctx.fillStyle = 'rgba(190, 242, 100, 0.24)';
          ctx.fillRect(
            Math.round((item.cx - 8) * SCALE),
            Math.round((item.cy - 14) * SCALE),
            16 * SCALE,
            14 * SCALE
          );
        }
      }
      drawNpcSprite16Bit(ctx, {
        cx: item.cx,
        cy: item.cy,
        scale: SCALE,
        npc: item.facing === item.npc.facing ? item.npc : { ...item.npc, facing: item.facing },
        animTick,
        showSpeechBubble: item.showBubble,
        isSelected: item.isSelected,
      });
    }

    // ========================================================================
    // PASS 3: 16-BIT MINIATURE MONUMENTS (DISCOVERED) & RELIQUARY SEALS (MYSTERY)
    // ========================================================================
    for (const { poi, vx, vy, isUnlocked, distMeters } of projectedPois) {

      const isSelected = selectedPoiId === poi.id || hoveredPoiId === poi.id;
      const isHotProximity = !isUnlocked && distMeters <= poi.unlockRadiusMeters * 1.65;
      const isSpectralRevealed =
        !isUnlocked && spectralLanternMeters > 0 && distMeters <= spectralLanternMeters;
      const pal = CAT_SPRITE_PAL[poi.category] || CAT_SPRITE_PAL.histoire;
      const phase = (animTick + poiPhaseHash(poi.id)) % 8;

      if (isUnlocked) {
        // ====================================================================
        // DISCOVERED POI: BESPOKE 16-BIT MINIATURE MONUMENT SPRITE!
        // ====================================================================
        px(vx - 10, vy - 1, 21, 5, 'rgba(20, 12, 7, 0.45)');
        if (isSelected) {
          strokePxRect(vx - 13, vy - 25, 27, 29, subterraneanMode ? '#38bdf8' : '#fde047');
        }

        px(vx - 9, vy - 5, 19, 6, '#140b05');
        px(vx - 8, vy - 4, 17, 4, subterraneanMode ? '#334155' : '#d6c7ad');
        px(vx - 8, vy - 4, 17, 1, subterraneanMode ? '#94a3b8' : '#fbf6e8');
        px(vx - 6, vy - 2, 13, 1, pal.main);

        if (poi.category === 'histoire') {
          px(vx - 7, vy - 19, 15, 15, '#1a1008');
          px(vx - 6, vy - 18, 3, 3, '#fde68a');
          px(vx - 1, vy - 18, 3, 3, '#fde68a');
          px(vx + 4, vy - 18, 3, 3, '#d97706');
          px(vx - 5, vy - 15, 11, 11, '#d97706');
          px(vx - 5, vy - 15, 5, 11, '#fbbf24');
          px(vx - 4, vy - 14, 2, 9, '#fef08a');
          px(vx - 2, vy - 9, 5, 5, '#3b1f0e');
          px(vx - 1, vy - 13, 3, 2, '#fef9c3');
        } else if (poi.category === 'geographie') {
          px(vx - 7, vy - 18, 15, 14, '#0c2e47');
          px(vx - 2, vy - 20, 5, 16, '#0c2e47');
          px(vx - 1, vy - 19, 3, 14, '#38bdf8');
          px(vx - 1, vy - 19, 1, 12, '#ffffff');
          px(vx - 6, vy - 14, 4, 9, '#0284c7');
          px(vx - 5, vy - 14, 2, 7, '#bae6fd');
          px(vx + 3, vy - 15, 4, 10, '#0369a1');
          px(vx + 3, vy - 15, 2, 7, '#7dd3fc');
        } else if (poi.category === 'legende') {
          px(vx - 5, vy - 20, 11, 16, '#240b36');
          px(vx - 4, vy - 19, 9, 15, '#7e22ce');
          px(vx - 4, vy - 19, 4, 14, '#a855f7');
          px(vx - 3, vy - 18, 2, 8, '#e9d5ff');
          px(vx - 1, vy - 15, 3, 1, '#fde047');
          px(vx - 2, vy - 12, 5, 1, '#fef08a');
          px(vx - 1, vy - 9, 3, 1, '#fde047');
          const wxOff = phase < 4 ? -8 : 7;
          px(vx + wxOff, vy - 16, 2, 2, '#f0abfc');
          px(vx + wxOff, vy - 16, 1, 1, '#ffffff');
        } else if (poi.category === 'etrange') {
          px(vx - 7, vy - 18, 15, 14, '#1a1008');
          px(vx - 6, vy - 17, 13, 13, '#78716c');
          px(vx - 5, vy - 16, 11, 3, '#a8a29e');
          px(vx - 3, vy - 13, 7, 9, '#0f0a07');
          px(vx + 4, vy - 12, 2, 4, '#78350f');
          px(vx + 4, vy - 15, 3, 3, phase % 2 === 0 ? '#f43f5e' : '#fb923c');
          px(vx + 4, vy - 14, 2, 2, '#fde047');
        } else {
          px(vx - 3, vy - 10, 7, 6, '#3b1f0e');
          px(vx - 2, vy - 10, 3, 6, '#78350f');
          px(vx - 8, vy - 20, 17, 12, '#063321');
          px(vx - 7, vy - 19, 15, 10, '#059669');
          px(vx - 6, vy - 19, 10, 7, '#34d399');
          px(vx - 4, vy - 18, 6, 3, '#a7f3d0');
          px(vx + 3, vy - 14, 2, 2, '#fde047');
        }

        px(vx - 2, vy - 24, 5, 4, '#1a1008');
        px(vx - 1, vy - 23, 3, 2, '#fde047');
        px(vx, vy - 23, 1, 1, '#ffffff');
      } else {
        // ====================================================================
        // UNDISCOVERED MYSTERY POI: 16-BIT ORNATE FLOATING RELIQUARY SEAL!
        // ====================================================================
        const bobTable = isHotProximity
          ? [0, -2, -4, -3, -1, -2, -4, -2]
          : [0, -1, -2, -3, -2, -1, 0, -1];
        const bob = bobTable[phase];
        const py = vy + bob;

        if (phase === 0 || phase === 1) {
          strokePxRect(vx - 5, vy - 2, 11, 5, '#fde047');
        } else if (phase === 2 || phase === 3 || phase === 4) {
          strokePxRect(vx - 9, vy - 4, 19, 8, isHotProximity ? '#ef4444' : '#fbbf24');
        } else if (phase === 5 || phase === 6) {
          strokePxRect(vx - 13, vy - 5, 27, 10, 'rgba(253, 224, 71, 0.72)');
        }

        px(vx - 14, py - 27, 29, 25, 'rgba(18, 10, 6, 0.52)');
        px(vx - 6, vy - 1, 13, 4, 'rgba(18, 10, 6, 0.72)');

        px(vx - 1, py - 3, 3, vy - py + 4, '#140b05');
        px(vx, py - 3, 1, vy - py + 3, '#fde047');

        const auraColor = isHotProximity
          ? phase % 2 === 0
            ? '#fde047'
            : '#ef4444'
          : isSpectralRevealed
          ? phase % 2 === 0
            ? '#67e8f9'
            : '#c084fc'
          : phase === 0 || phase === 4
          ? '#ffffff'
          : '#fbbf24';
        strokePxRect(vx - 13, py - 27, 27, 23, auraColor);

        px(vx - 11, py - 26, 23, 21, '#140b05');
        px(vx - 12, py - 24, 25, 17, '#140b05');
        px(vx - 5, py - 5, 11, 3, '#140b05');
        px(vx - 2, py - 2, 5, 3, '#140b05');

        const frameMain = subterraneanMode ? '#0369a1' : '#d97706';
        const frameTip = subterraneanMode ? '#0ea5e9' : '#f59e0b';
        const goldBright =
          phase === 1 || phase === 5 || isSelected
            ? '#ffffff'
            : subterraneanMode
            ? '#bae6fd'
            : '#fef08a';
        px(vx - 10, py - 25, 21, 19, frameMain);
        px(vx - 11, py - 23, 23, 15, frameMain);
        px(vx - 10, py - 25, 20, 2, goldBright);
        px(vx - 11, py - 23, 2, 14, goldBright);
        px(vx - 4, py - 6, 9, 3, frameTip);
        px(vx - 1, py - 3, 3, 2, goldBright);

        const rubyDark = subterraneanMode ? '#0f172a' : '#881337';
        const rubyMid = subterraneanMode
          ? isHotProximity && phase % 2 === 0
            ? '#0284c7'
            : '#1e3a8a'
          : isHotProximity && phase % 2 === 0
          ? '#e11d48'
          : '#be123c';
        const rubyLight = subterraneanMode ? '#38bdf8' : '#fb7185';
        px(vx - 9, py - 23, 19, 15, rubyMid);
        px(vx - 9, py - 12, 19, 4, rubyDark);
        px(vx - 8, py - 22, 4, 3, rubyLight);

        px(vx - 9, py - 23, 19, 4, pal.dark);
        px(vx - 9, py - 23, 19, 3, pal.main);
        px(vx - 4, py - 23, 9, 1, pal.light);
        px(vx - 9, py - 19, 19, 1, '#140b05');

        const qShadow = subterraneanMode ? '#082f49' : '#450a0a';
        px(vx - 3, py - 17, 8, 2, qShadow);
        px(vx + 3, py - 15, 2, 3, qShadow);
        px(vx - 1, py - 13, 5, 2, qShadow);
        px(vx - 1, py - 9, 3, 2, qShadow);

        const qFace = phase % 2 === 0 ? '#ffffff' : '#fef9c3';
        px(vx - 4, py - 18, 8, 2, qFace);
        px(vx - 5, py - 17, 2, 2, qFace);
        px(vx + 2, py - 17, 3, 3, qFace);
        px(vx - 1, py - 14, 4, 2, qFace);
        px(vx - 1, py - 12, 2, 1, '#fde047');
        px(vx - 1, py - 10, 3, 2, '#fde047');
        px(vx - 1, py - 10, 2, 1, '#ffffff');

        if (phase < 4) {
          px(vx - 16, py - 24, 5, 1, '#fde047');
          px(vx - 14, py - 26, 1, 5, '#ffffff');
        } else {
          px(vx + 13, py - 21, 5, 1, '#fde047');
          px(vx + 15, py - 23, 1, 5, '#ffffff');
        }

        if (isSelected) {
          const pulse = phase % 2 === 0 ? 0 : 1;
          px(vx - 16 - pulse, py - 29 - pulse, 6, 2, '#140b05');
          px(vx - 16 - pulse, py - 29 - pulse, 2, 6, '#140b05');
          px(vx - 15 - pulse, py - 28 - pulse, 5, 1, '#fde047');
          px(vx - 15 - pulse, py - 28 - pulse, 1, 5, '#fde047');

          px(vx + 11 + pulse, py - 29 - pulse, 6, 2, '#140b05');
          px(vx + 15 + pulse, py - 29 - pulse, 2, 6, '#140b05');
          px(vx + 11 + pulse, py - 28 - pulse, 5, 1, '#fde047');
          px(vx + 15 + pulse, py - 28 - pulse, 1, 5, '#fde047');
        }

        if (isHotProximity || isSelected || isSpectralRevealed) {
          const spectralHint = isSpectralRevealed
            ? `${(poi.eraLabel || poi.subType).slice(0, 14)} · `
            : '';
          const distLabel = `${spectralHint}${Math.round(distMeters)} m`;
          const tagW = distLabel.length * 8 + 16;
          const tagX = Math.round(vx * SCALE - tagW / 2);
          const tagY = Math.round((vy + 4) * SCALE);
          const tagCollides =
            !isSelected && hasRectCollision(occupiedTagRects, tagX - 2, tagY - 2, tagX + tagW + 2, tagY + 20, 2);
          if (!tagCollides) {
            occupiedTagRects.push({ x0: tagX - 2, y0: tagY - 2, x1: tagX + tagW + 2, y1: tagY + 20 });
            ctx.fillStyle = '#140b05';
            ctx.fillRect(tagX - 2, tagY - 2, tagW + 4, 22);
            ctx.fillStyle = isHotProximity
              ? '#fde047'
              : isSpectralRevealed
              ? '#e0f2fe'
              : '#fbf2dc';
            ctx.fillRect(tagX, tagY, tagW, 18);
            ctx.fillStyle = isSpectralRevealed ? '#0284c7' : '#b45309';
            ctx.fillRect(tagX, tagY, 3, 18);
            ctx.fillRect(tagX + tagW - 3, tagY, 3, 18);
            ctx.fillStyle = '#140b05';
            ctx.font = 'bold 11px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(distLabel, Math.round(vx * SCALE), tagY + 9);
          }
        }
      }
    }

    // ========================================================================
    // PASS 3B: OFF-SCREEN UNDISCOVERED EDGE COMPASS SEALS
    // ========================================================================
    offscreenCandidates.sort((a, b) => a.dist - b.dist);
    const nextEdgeHits: EdgeIndicatorHit[] = [];
    const cx = Math.floor(VW / 2);
    const cy = Math.floor(VH / 2);

    for (const item of offscreenCandidates.slice(0, 6)) {
      const dx = item.vx - cx;
      const dy = item.vy - cy;
      if (dx === 0 && dy === 0) continue;

      const marginX = 20;
      const marginY = 24;
      const maxX = VW / 2 - marginX;
      const maxY = VH / 2 - marginY;
      const scaleEdge = Math.min(maxX / Math.max(1, Math.abs(dx)), maxY / Math.max(1, Math.abs(dy)));

      const ex = Math.round(cx + dx * scaleEdge);
      const ey = Math.round(cy + dy * scaleEdge);
      const pal = CAT_SPRITE_PAL[item.poi.category] || CAT_SPRITE_PAL.histoire;
      const blink = (animTick + poiPhaseHash(item.poi.id)) % 4 < 2;

      px(ex - 8, ey - 8, 17, 17, '#140b05');
      px(ex - 7, ey - 7, 15, 15, blink ? '#fde047' : '#f59e0b');
      px(ex - 6, ey - 6, 13, 13, '#9f1239');
      px(ex - 6, ey - 6, 13, 3, pal.main);
      px(ex - 2, ey - 2, 5, 2, '#ffffff');
      px(ex + 1, ey, 2, 2, '#ffffff');
      px(ex, ey + 3, 2, 2, '#fde047');

      nextEdgeHits.push({ poi: item.poi, ex, ey });
    }
    edgeHitsRef.current = nextEdgeHits;

    // ========================================================================
    // PASS 3C: ACTIVE NPC RUMOR / LEAD MARKERS & OFFSCREEN PARCHMENT CLUES
    // ========================================================================
    const nextRumorEdgeHits: Array<{ lead: RumorLead; ex: number; ey: number }> = [];
    for (const lead of activeLayerRumors) {
      const { vx: rvx, vy: rvy } = projectToVirtual(lead.lat, lead.lng);
      const rDist = Math.round(haversineMeters(playerLat, playerLng, lead.lat, lead.lng));
      const pulse = (animTick % 6) < 3 ? 0 : 1;

      if (rvx < 16 || rvx > VW - 16 || rvy < 24 || rvy > VH - 14) {
        if (rDist <= 2200) {
          const dx = rvx - cx;
          const dy = rvy - cy;
          if (dx !== 0 || dy !== 0) {
            const scaleEdge = Math.min(
              (VW / 2 - 22) / Math.max(1, Math.abs(dx)),
              (VH / 2 - 26) / Math.max(1, Math.abs(dy))
            );
            const ex = Math.round(cx + dx * scaleEdge);
            const ey = Math.round(cy + dy * scaleEdge);
            px(ex - 8, ey - 8, 17, 17, '#140b05');
            px(ex - 7, ey - 7, 15, 15, pulse === 0 ? '#fde047' : '#d97706');
            px(ex - 6, ey - 6, 13, 13, '#fef3c7');
            px(ex - 6, ey - 6, 13, 3, '#991b1b');
            px(ex - 1, ey - 2, 3, 5, '#991b1b');
            px(ex - 1, ey + 4, 3, 2, '#991b1b');
            nextRumorEdgeHits.push({ lead, ex, ey });
          }
        }
        continue;
      }

      // Animated golden parchment investigation corners around rumored site or portal
      const ringR = 14 + pulse;
      const ringColor = pulse === 0 ? '#fde047' : '#f59e0b';
      const anchorY = lead.targetType === 'portal' ? rvy : rvy - 11;
      px(rvx - ringR, anchorY - ringR, 5, 2, ringColor);
      px(rvx - ringR, anchorY - ringR, 2, 5, ringColor);
      px(rvx + ringR - 4, anchorY - ringR, 5, 2, ringColor);
      px(rvx + ringR - 1, anchorY - ringR, 2, 5, ringColor);
      px(rvx - ringR, anchorY + ringR - 1, 5, 2, ringColor);
      px(rvx - ringR, anchorY + ringR - 4, 2, 5, ringColor);
      px(rvx + ringR - 4, anchorY + ringR - 1, 5, 2, ringColor);
      px(rvx + ringR - 1, anchorY + ringR - 4, 2, 5, ringColor);

      // Dedicated wax-sealed parchment scroll sprite when pointing to a hidden portal or filtered-out POI
      const isAlreadyDrawnPoi =
        lead.targetType === 'poi' && projectedPois.some((p) => p.poi.id === lead.targetId);
      if (!isAlreadyDrawnPoi) {
        px(rvx - 7, anchorY - 7, 15, 15, '#140b05');
        px(rvx - 6, anchorY - 6, 13, 13, '#fef3c7');
        px(rvx - 5, anchorY - 4, 8, 1, '#78350f');
        px(rvx - 5, anchorY - 2, 7, 1, '#78350f');
        px(rvx + 1, anchorY, 5, 5, '#991b1b');
        px(rvx + 2, anchorY + 1, 3, 3, '#ef4444');
      }

      // Compact parchment clue tag underneath
      if (!uiCollapsed) {
        const clueText = `Piste · ${rDist} m`;
        const tagW = clueText.length * 7 + 16;
        const tagX = Math.round(rvx * SCALE - tagW / 2);
        const tagY = Math.round((rvy + 6) * SCALE);
        if (!hasRectCollision(occupiedTagRects, tagX - 2, tagY - 2, tagX + tagW + 2, tagY + 20, 1)) {
          occupiedTagRects.push({ x0: tagX - 2, y0: tagY - 2, x1: tagX + tagW + 2, y1: tagY + 20 });
          ctx.fillStyle = '#140b05';
          ctx.fillRect(tagX - 2, tagY - 2, tagW + 4, 20);
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(tagX, tagY, tagW, 16);
          ctx.fillStyle = '#991b1b';
          ctx.fillRect(tagX, tagY, 3, 16);
          ctx.fillRect(tagX + tagW - 3, tagY, 3, 16);
          ctx.fillStyle = '#1c120b';
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(clueText, Math.round(rvx * SCALE), tagY + 8);
        }
      }
    }
    rumorEdgeHitsRef.current = nextRumorEdgeHits;

    // ========================================================================
    // PASS 4: ANIMATED 16-BIT EXPLORER SPRITE WITH FULL AVATAR & COSMETIC GEAR
    // ========================================================================
    if (exPx > -28 && exPx < VW + 28 && eyPx > -28 && eyPx < VH + 28) {
      const resolvedAppearance: ExplorerAppearance = explorerAppearance || {
        gender: 'masculin',
        avatarPreset: 'cartographe',
        skinTone: 'clair',
        headgearId: 'tricorne_fauve',
        outfitId: outfitId || 'arpenteur',
        toolId: 'lanterne_laiton',
        packId: 'besace_cuir',
      };
      const effectiveWalking = isWalking || visualCam.isGliding;
      const explorerAnimTick = effectiveWalking
        ? (visualCam.strideTick + animTick) % 360
        : animTick;
      drawExplorerSprite16Bit(ctx, {
        cx: exPx,
        cy: eyPx + 9,
        scale: SCALE,
        facingDir,
        isWalking: effectiveWalking,
        animTick: explorerAnimTick,
        appearance: resolvedAppearance,
        drawAura: true,
        isNight: subterraneanMode || effectiveTime === 'night',
      });
    }

    // Cached Warm Antiqued Tabletop Vignette (rebuilt only on resize or layer switch!)
    let vig = vignetteCanvasRef.current;
    if (!vig || vig.w !== canvas.width || vig.h !== canvas.height || vig.sub !== subterraneanMode) {
      const vCanvas = vig ? vig.canvas : document.createElement('canvas');
      vCanvas.width = canvas.width;
      vCanvas.height = canvas.height;
      const vCtx = vCanvas.getContext('2d');
      if (vCtx) {
        const maxDim = Math.max(canvas.width, canvas.height);
        const edgeGrad = vCtx.createRadialGradient(
          canvas.width / 2,
          canvas.height / 2,
          maxDim * 0.34,
          canvas.width / 2,
          canvas.height / 2,
          maxDim * 0.64
        );
        edgeGrad.addColorStop(0, 'rgba(36, 23, 16, 0)');
        edgeGrad.addColorStop(
          1,
          subterraneanMode ? 'rgba(12, 7, 4, 0.42)' : 'rgba(36, 23, 16, 0.24)'
        );
        vCtx.fillStyle = edgeGrad;
        vCtx.fillRect(0, 0, canvas.width, canvas.height);
      }
      vig = { canvas: vCanvas, w: canvas.width, h: canvas.height, sub: subterraneanMode };
      vignetteCanvasRef.current = vig;
    }
    ctx.drawImage(vig.canvas, 0, 0);

    // Gentle cartographic / torchlight veil fade on regional jumps (>= 420m) or Surface <-> Sous-sol transitions!
    if (visualCam.teleportFade > 0.01) {
      const alpha = Math.min(0.72, visualCam.teleportFade * 0.72);
      ctx.fillStyle = subterraneanMode
        ? `rgba(18, 12, 7, ${alpha})`
        : `rgba(244, 232, 206, ${alpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [
    playerLat,
    playerLng,
    effectivePlayerLat,
    effectivePlayerLng,
    camLat,
    camLng,
    VW,
    VH,
    projectToVirtual,
    filteredPois,
    poiById,
    subterranean,
    bedrock,
    subterraneanMode,
    worldMapData,
    unlockedIds,
    selectedPoiId,
    hoveredPoiId,
    isWalking,
    visualCam.isGliding,
    visualCam.strideTick,
    visualCam.teleportFade,
    facingDir,
    subtleBuildings,
    reliefEnabled,
    animTick,
    metersPerVirtualPx,
    tileMeters,
    weather,
    timeMode,
    currentEffectiveTime,
    fogEnabled,
    fogSet,
    fogVisionMeters,
    outfitId,
    explorerAppearance,
    chroniqueurThreads,
    dashedTracesEnabled,
    spectralLanternMeters,
    breadcrumbTrail,
    plannedRoute,
    portalAnchors,
    namedPlaceLabels,
    layerSpecimens,
    hoveredSpecimenId,
    layerNpcs,
    hoveredNpcId,
    activeNpcDialogue,
    activeLayerRumors,
    uiCollapsed,
    zoomLevel,
  ]);

  const interactWithNpc = useCallback(
    (npc: WorldNpc) => {
      playNpcVoiceSfx(muted, npc.voice);
      const isContinuingSameNpc =
        activeNpcDialogue !== null && activeNpcDialogue.npc.id === npc.id;
      if (isContinuingSameNpc) {
        setActiveNpcDialogue({
          npc,
          lineIndex: (activeNpcDialogue.lineIndex + 1) % Math.max(1, npc.dialogues.length),
        });
        return;
      }
      // Always start a coherent 3-beat conversation or naturalist observation at Beat 1 (index 0)
      setActiveNpcDialogue({ npc, lineIndex: 0 });
      onNpcInteract?.(npc);
    },
    [activeNpcDialogue, muted, onNpcInteract]
  );

  // Close open NPC dialogue when the explorer explicitly selects a map POI so bottom sheets never overlap
  useEffect(() => {
    if (selectedPoiId) {
      setActiveNpcDialogue(null);
    }
  }, [selectedPoiId]);

  // Keyboard shortcuts: 'E' to talk/advance nearby NPC trivia, 'C' to recenter camera, 'Escape' to close NPC box
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (ev.key === 'Escape' && activeNpcDialogue) {
        setActiveNpcDialogue(null);
        return;
      }
      if ((ev.key === 'c' || ev.key === 'C') && isPannedAway) {
        setPanMeters({ east: 0, north: 0 });
        return;
      }
      if (ev.key === 'e' || ev.key === 'E') {
        if (activeNpcDialogue) {
          interactWithNpc(activeNpcDialogue.npc);
          return;
        }
        let closest: WorldNpc | null = null;
        let bestD = 90;
        for (const n of layerNpcs) {
          const d = haversineMeters(playerLat, playerLng, n.lat, n.lng);
          if (d < bestD) {
            bestD = d;
            closest = n;
          }
        }
        if (closest) {
          ev.preventDefault();
          interactWithNpc(closest);
          return;
        }
        if (onHarvestSpecimen) {
          let closestSpec: WorldSpecimenNode | null = null;
          let bestSpecD = 75;
          for (const s of layerSpecimens) {
            const d = haversineMeters(playerLat, playerLng, s.lat, s.lng);
            if (d < bestSpecD) {
              bestSpecD = d;
              closestSpec = s;
            }
          }
          if (closestSpec) {
            ev.preventDefault();
            onHarvestSpecimen(closestSpec);
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeNpcDialogue,
    isPannedAway,
    layerNpcs,
    layerSpecimens,
    onHarvestSpecimen,
    playerLat,
    playerLng,
    interactWithNpc,
  ]);

  // Unified Tap, Drag-Pan & 2-Finger Pinch-to-Zoom Interaction State
  const gestureRef = useRef<{
    active: boolean;
    moved: boolean;
    isTouch: boolean;
    startX: number;
    startY: number;
    startEast: number;
    startNorth: number;
    pinchStartDist: number | null;
    pinchStartZoom: ZoomLevel;
  }>({
    active: false,
    moved: false,
    isTouch: false,
    startX: 0,
    startY: 0,
    startEast: 0,
    startNorth: 0,
    pinchStartDist: null,
    pinchStartZoom: zoomLevel,
  });

  const resolveTapAtScreen = (clientX: number, clientY: number, isTouch: boolean) => {
    const unproj = unprojectFromScreen(clientX, clientY);
    if (!unproj) return;

    const hitRadius = isTouch ? 30 : 22;
    let closestPoi: PoiItem | null = null;
    let bestDistPx = hitRadius;
    for (const poi of filteredPois) {
      const { vx, vy } = projectToVirtual(poi.lat, poi.lng);
      const d = Math.hypot(vx - unproj.vx, vy - 13 - unproj.vy);
      if (d < bestDistPx) {
        bestDistPx = d;
        closestPoi = poi;
      }
    }

    if (!closestPoi) {
      const edgeRadius = isTouch ? 18 : 13;
      for (const edgeHit of edgeHitsRef.current) {
        const d = Math.hypot(edgeHit.ex - unproj.vx, edgeHit.ey - unproj.vy);
        if (d < edgeRadius) {
          closestPoi = edgeHit.poi;
          break;
        }
      }
    }

    if (closestPoi) {
      onSelectPoi(closestPoi);
      return;
    }

    // Check tap/click on a living 16-bit NPC (human, animal, bird, amphibian or insect!)
    const npcHitRadius = isTouch ? 26 : 20;
    let closestNpc: WorldNpc | null = null;
    let bestNpcDist = npcHitRadius;
    for (const npc of layerNpcs) {
      const nv = projectToVirtual(npc.lat, npc.lng);
      const animOff = getNpcAnimatedOffsetPx(npc, animTick);
      const d = Math.hypot(
        nv.vx + animOff.dx - unproj.vx,
        nv.vy + animOff.dy - 9 - unproj.vy
      );
      if (d < bestNpcDist) {
        bestNpcDist = d;
        closestNpc = npc;
      }
    }
    if (closestNpc) {
      interactWithNpc(closestNpc);
      return;
    }

    // Check tap/click on a botanical herbarium tuft or real-bedrock geological specimen!
    if (onHarvestSpecimen) {
      const specHitRadius = isTouch ? 24 : 18;
      let closestSpec: WorldSpecimenNode | null = null;
      let bestSpecPx = specHitRadius;
      for (const spec of layerSpecimens) {
        const sv = projectToVirtual(spec.lat, spec.lng);
        const d = Math.hypot(sv.vx - unproj.vx, sv.vy - 6 - unproj.vy);
        if (d < bestSpecPx) {
          bestSpecPx = d;
          closestSpec = spec;
        }
      }
      if (closestSpec) {
        const distM = haversineMeters(playerLat, playerLng, closestSpec.lat, closestSpec.lng);
        if (distM <= 145 || !simulationMode) {
          onHarvestSpecimen(closestSpec);
        } else {
          setPanMeters({ east: 0, north: 0 });
          const waypoints = computeTopologicalWalkPath(closestSpec.lat, closestSpec.lng);
          if (onPlanWalkRoute) onPlanWalkRoute(waypoints);
          else onMapDestinationClick(closestSpec.lat, closestSpec.lng);
        }
        return;
      }
    }

    // Check tap on an active Rumor marker or offscreen Rumor compass seal!
    for (const lead of activeLayerRumors) {
      const rv = projectToVirtual(lead.lat, lead.lng);
      const anchorY = lead.targetType === 'portal' ? rv.vy : rv.vy - 11;
      if (Math.hypot(rv.vx - unproj.vx, anchorY - unproj.vy) < (isTouch ? 24 : 18)) {
        const matchedPoi = lead.targetType === 'poi' ? poiById.get(lead.targetId) : undefined;
        if (matchedPoi) {
          onSelectPoi(matchedPoi);
        } else if (simulationMode) {
          setPanMeters({ east: 0, north: 0 });
          const waypoints = computeTopologicalWalkPath(lead.lat, lead.lng);
          if (onPlanWalkRoute) onPlanWalkRoute(waypoints);
          else onMapDestinationClick(lead.lat, lead.lng);
        }
        return;
      }
    }
    for (const rEdge of rumorEdgeHitsRef.current) {
      if (Math.hypot(rEdge.ex - unproj.vx, rEdge.ey - unproj.vy) < (isTouch ? 18 : 13)) {
        const matchedPoi =
          rEdge.lead.targetType === 'poi' ? poiById.get(rEdge.lead.targetId) : undefined;
        if (matchedPoi) {
          onSelectPoi(matchedPoi);
        } else if (simulationMode) {
          setPanMeters({ east: 0, north: 0 });
          const waypoints = computeTopologicalWalkPath(rEdge.lead.lat, rEdge.lead.lng);
          if (onPlanWalkRoute) onPlanWalkRoute(waypoints);
          else onMapDestinationClick(rEdge.lead.lat, rEdge.lead.lng);
        }
        return;
      }
    }

    // Check tap on a Surface <-> Sous-sol stairwell portal!
    if (onToggleSubterraneanMode) {
      for (const portal of portalAnchors) {
        const pv = projectToVirtual(portal.lat, portal.lng);
        if (Math.hypot(pv.vx - unproj.vx, pv.vy - unproj.vy) < (isTouch ? 18 : 13)) {
          playPortalSfx(muted, !subterraneanMode);
          onToggleSubterraneanMode();
          return;
        }
      }
    }

    if (simulationMode) {
      setPanMeters({ east: 0, north: 0 });
      const waypoints = computeTopologicalWalkPath(unproj.lat, unproj.lng);
      if (onPlanWalkRoute) {
        onPlanWalkRoute(waypoints);
      } else {
        onMapDestinationClick(unproj.lat, unproj.lng);
      }
    }
  };

  const applyPanDelta = (dxCss: number, dyCss: number, baseEast: number, baseNorth: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dEast = -dxCss * (VW / rect.width) * metersPerVirtualPx;
    const dNorth = dyCss * (VH / rect.height) * metersPerVirtualPx;
    const maxPan = 1450;
    setPanMeters({
      east: Math.max(-maxPan, Math.min(maxPan, baseEast + dEast)),
      north: Math.max(-maxPan, Math.min(maxPan, baseNorth + dNorth)),
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    gestureRef.current = {
      active: true,
      moved: false,
      isTouch: false,
      startX: e.clientX,
      startY: e.clientY,
      startEast: panMeters.east,
      startNorth: panMeters.north,
      pinchStartDist: null,
      pinchStartZoom: zoomRef.current,
    };
  };

  const handleCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const g = gestureRef.current;
    if (g.active && !g.isTouch) {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (!g.moved && Math.hypot(dx, dy) > 7) {
        g.moved = true;
        setIsDraggingMap(true);
      }
      if (g.moved) {
        applyPanDelta(dx, dy, g.startEast, g.startNorth);
        return;
      }
    }

    const unproj = unprojectFromScreen(e.clientX, e.clientY);
    if (!unproj) return;
    let found: string | null = null;
    let bestDist = 22;
    for (const poi of filteredPois) {
      const { vx, vy } = projectToVirtual(poi.lat, poi.lng);
      const d = Math.hypot(vx - unproj.vx, vy - 13 - unproj.vy);
      if (d < bestDist) {
        bestDist = d;
        found = poi.id;
      }
    }
    if (!found) {
      for (const edgeHit of edgeHitsRef.current) {
        if (Math.hypot(edgeHit.ex - unproj.vx, edgeHit.ey - unproj.vy) < 13) {
          found = edgeHit.poi.id;
          break;
        }
      }
    }
    setHoveredPoiId((prev) => (prev === found ? prev : found));

    let foundNpc: string | null = null;
    if (!found) {
      let bestN = 20;
      for (const npc of layerNpcs) {
        const nv = projectToVirtual(npc.lat, npc.lng);
        const animOff = getNpcAnimatedOffsetPx(npc, animTick);
        const d = Math.hypot(
          nv.vx + animOff.dx - unproj.vx,
          nv.vy + animOff.dy - 9 - unproj.vy
        );
        if (d < bestN) {
          bestN = d;
          foundNpc = npc.id;
        }
      }
    }
    setHoveredNpcId((prev) => (prev === foundNpc ? prev : foundNpc));

    let foundSpec: string | null = null;
    if (!found && !foundNpc) {
      let bestS = 18;
      for (const spec of layerSpecimens) {
        const sv = projectToVirtual(spec.lat, spec.lng);
        const d = Math.hypot(sv.vx - unproj.vx, sv.vy - 6 - unproj.vy);
        if (d < bestS) {
          bestS = d;
          foundSpec = spec.nodeId;
        }
      }
    }
    setHoveredSpecimenId((prev) => (prev === foundSpec ? prev : foundSpec));
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const g = gestureRef.current;
    if (!g.active || g.isTouch) return;
    g.active = false;
    setIsDraggingMap(false);
    if (!g.moved) {
      resolveTapAtScreen(e.clientX, e.clientY, false);
    }
  };

  const handleMouseLeave = () => {
    if (gestureRef.current.active && !gestureRef.current.isTouch) {
      gestureRef.current.active = false;
      setIsDraggingMap(false);
    }
    setHoveredPoiId((prev) => (prev === null ? prev : null));
    setHoveredNpcId((prev) => (prev === null ? prev : null));
    setHoveredSpecimenId((prev) => (prev === null ? prev : null));
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      gestureRef.current.pinchStartDist = Math.max(20, d);
      gestureRef.current.pinchStartZoom = zoomRef.current;
      gestureRef.current.moved = true;
      setIsDraggingMap(false);
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      gestureRef.current = {
        active: true,
        moved: false,
        isTouch: true,
        startX: t.clientX,
        startY: t.clientY,
        startEast: panMeters.east,
        startNorth: panMeters.north,
        pinchStartDist: null,
        pinchStartZoom: zoomRef.current,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const g = gestureRef.current;
    if (e.touches.length === 2 && g.pinchStartDist !== null) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = d / g.pinchStartDist;
      let deltaLevels = 0;
      if (ratio > 1.24) deltaLevels = Math.min(3, Math.floor((ratio - 1) / 0.24));
      else if (ratio < 0.8) deltaLevels = -Math.min(3, Math.floor((1 - ratio) / 0.18));

      const targetZoom = Math.max(1, Math.min(6, g.pinchStartZoom + deltaLevels)) as ZoomLevel;
      if (targetZoom !== zoomRef.current) {
        onChangeZoom(targetZoom);
      }
      return;
    }

    if (e.touches.length === 1 && g.active) {
      const t = e.touches[0];
      const dx = t.clientX - g.startX;
      const dy = t.clientY - g.startY;
      if (!g.moved && Math.hypot(dx, dy) > 9) {
        g.moved = true;
        setIsDraggingMap(true);
      }
      if (g.moved) {
        applyPanDelta(dx, dy, g.startEast, g.startNorth);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const g = gestureRef.current;
    if (e.touches.length < 2) {
      g.pinchStartDist = null;
    }
    if (e.touches.length === 0 && g.active) {
      g.active = false;
      setIsDraggingMap(false);
      if (!g.moved && e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        resolveTapAtScreen(t.clientX, t.clientY, true);
      }
    }
  };

  const hoveredPoi = hoveredPoiId ? filteredPois.find((p) => p.id === hoveredPoiId) : null;
  const hoveredNpc = hoveredNpcId ? layerNpcs.find((n) => n.id === hoveredNpcId) || null : null;
  const hoveredSpecimen = hoveredSpecimenId
    ? layerSpecimens.find((s) => s.nodeId === hoveredSpecimenId) || null
    : null;
  const livePlayerAlt = useMemo(
    () => sampleElevationMeters(elevation, playerLat, playerLng),
    [elevation, playerLat, playerLng]
  );
  const hoveredPoiDeltaAlt = useMemo(() => {
    if (!hoveredPoi || livePlayerAlt === null) return null;
    const pAlt = sampleElevationMeters(elevation, hoveredPoi.lat, hoveredPoi.lng);
    if (pAlt === null) return null;
    return Math.round(pAlt - livePlayerAlt);
  }, [hoveredPoi, elevation, livePlayerAlt]);

  return (
    <div
      className={
        immersiveFullscreen
          ? 'relative w-full h-full flex flex-col bg-[#2a190f] p-1 sm:p-1.5 select-none'
          : fillContainer
          ? 'relative w-full max-lg:h-full max-lg:flex-1 max-lg:min-h-0 flex flex-col p-1 sm:p-1.5 bg-[#2a190f] border-2 border-[#1c1009] jrpg-shadow select-none'
          : 'relative p-1.5 bg-[#2a190f] border-2 border-[#1c1009] jrpg-shadow select-none'
      }
    >
      {/* Ornate Brass Corner Clasps on the Cartographer Tabletop Frame */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 w-3 h-3 bg-[#f59e0b] border-r-2 border-b-2 border-[#1c1009] z-10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 w-3 h-3 bg-[#f59e0b] border-l-2 border-b-2 border-[#1c1009] z-10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 w-3 h-3 bg-[#f59e0b] border-r-2 border-t-2 border-[#1c1009] z-10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 w-3 h-3 bg-[#f59e0b] border-l-2 border-t-2 border-[#1c1009] z-10"
      />

      <div
        ref={frameRef}
        className={
          immersiveFullscreen
            ? 'relative w-full h-full flex-1 min-h-0 bg-[#1e120b] border-2 border-[#b47b38] overflow-hidden'
            : fillContainer
            ? 'relative w-full max-lg:h-full max-lg:flex-1 max-lg:min-h-[240px] lg:h-[calc(100dvh-12.5rem)] lg:min-h-[480px] lg:max-h-[780px] bg-[#1e120b] border-2 border-[#b47b38] overflow-hidden'
            : 'relative w-full h-[58dvh] min-h-[360px] sm:h-[64dvh] lg:h-[calc(100dvh-13.5rem)] lg:min-h-[460px] lg:max-h-[760px] bg-[#1e120b] border-2 border-[#b47b38] overflow-hidden'
        }
      >
        <canvas
          ref={canvasRef}
          width={VW * SCALE}
          height={VH * SCALE}
          onMouseDown={handleMouseDown}
          onMouseMove={handleCanvasMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`w-full h-full pixelated block touch-none ${
            isDraggingMap
              ? 'cursor-grabbing'
              : hoveredPoiId || hoveredNpcId
              ? 'cursor-pointer'
              : simulationMode
              ? 'cursor-crosshair'
              : 'cursor-grab'
          }`}
        />

        {/* Top-Left Illuminated Cartouche: Compass, Scale Name, Width, Altimeter & Subsoil/Weather */}
        {!uiCollapsed && (
          <div
            className={`pointer-events-none absolute left-2 sm:left-2.5 border-2 border-[#2b1d12] px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-mono tabular-nums jrpg-shadow flex items-center gap-1.5 sm:gap-2 max-w-[calc(100%-255px)] sm:max-w-[calc(100%-365px)] ${
              subterraneanMode
                ? 'bg-[#21160f]/95 text-amber-100 border-amber-600'
                : 'bg-[#f7ebd2]/95 text-[#23170e]'
            } ${
              immersiveFullscreen ? 'top-[max(0.5rem,env(safe-area-inset-top))]' : 'top-2 sm:top-2.5'
            }`}
          >
            <span
              className={`font-bold shrink-0 ${
                subterraneanMode ? 'text-amber-300' : 'text-rose-800'
              }`}
            >
              {subterraneanMode ? '▼ Sous-sol' : 'N▲'}
            </span>
            <span className="text-[#8c6d46] hidden xs:inline">|</span>
            <span
              className={`font-sans font-bold truncate ${
                subterraneanMode ? 'text-amber-200' : 'text-amber-900'
              }`}
            >
              {subterraneanMode
                ? bedrock?.lithology
                  ? bedrock.lithology.split(/[,;]/)[0]
                  : currentZoomMeta.label
                : currentZoomMeta.label}
            </span>
            {subterraneanMode ? (
              <span className="font-bold text-cyan-300 hidden sm:inline shrink-0">
                · {subterranean.length} {subterranean.length > 1 ? 'cavités & tunnels' : 'cavité'}
              </span>
            ) : (
              <>
                <span className="text-[#8c6d46] hidden sm:inline">·</span>
                <span className="font-bold hidden sm:inline shrink-0">
                  {Math.round(VW * metersPerVirtualPx)} m
                </span>
                {livePlayerAlt !== null && (
                  <>
                    <span className="text-[#8c6d46] shrink-0">|</span>
                    <span className="font-bold text-emerald-900 shrink-0">
                      {Math.round(livePlayerAlt)} m
                    </span>
                  </>
                )}
                {weather && (
                  <>
                    <span className="text-[#8c6d46] hidden md:inline shrink-0">|</span>
                    <span className="font-bold text-sky-900 hidden md:inline-flex items-center gap-1 shrink-0">
                      <PixelUiIcon
                        name={
                          weather.condition === 'rain' || weather.condition === 'storm'
                            ? 'rain'
                            : weather.condition === 'snow'
                            ? 'snow'
                            : weather.isDay
                            ? 'sun-cloud'
                            : 'moon-stars'
                        }
                        className="w-3.5 h-3.5"
                      />
                      <span>{Math.round(weather.tempC)}°C</span>
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Top-Right Direct Zoom +/-, Surface/Sous-sol Toggle (mobile/fullscreen/folded), Fold/Unfold UI & Fullscreen */}
        <div
          className={`absolute right-2 sm:right-2.5 flex items-center gap-1.5 z-20 ${
            immersiveFullscreen ? 'top-[max(0.5rem,env(safe-area-inset-top))]' : 'top-2 sm:top-2.5'
          }`}
        >
          {onToggleSubterraneanMode && !uiCollapsed && (
            <button
              type="button"
              onClick={onToggleSubterraneanMode}
              title={
                subterraneanMode
                  ? 'Remonter à la carte de Surface (G)'
                  : 'Explorer la strate Sous-sol & Cavités en mode Donjon 16-bit (G)'
              }
              aria-label={subterraneanMode ? 'Afficher la surface' : 'Afficher le sous-sol'}
              className={`${
                !immersiveFullscreen ? 'lg:hidden ' : ''
              }h-11 min-w-[44px] sm:h-8 sm:min-w-0 px-2.5 border-2 jrpg-shadow inline-flex items-center justify-center gap-1.5 text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                subterraneanMode
                  ? 'bg-[#1c130d] text-amber-300 border-amber-400 hover:bg-[#2e2016]'
                  : 'bg-[#f7ebd2]/95 text-[#23170e] border-[#2b1d12] hover:bg-amber-200'
              }`}
            >
              <PixelUiIcon name={subterraneanMode ? 'map' : 'dungeon'} className="w-4 h-4" />
              <span className="hidden md:inline">
                {subterraneanMode ? 'Surface' : 'Sous-sol'}
              </span>
            </button>
          )}

          <div
            className={`bg-[#f7ebd2]/95 border-2 border-[#2b1d12] jrpg-shadow items-center ${
              uiCollapsed ? 'hidden sm:flex' : 'flex'
            }`}
          >
            <button
              type="button"
              onClick={() => zoomLevel > 1 && onChangeZoom((zoomLevel - 1) as ZoomLevel)}
              disabled={zoomLevel <= 1}
              aria-label="Dézoomer la carte"
              className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center text-base sm:text-sm font-mono font-bold text-[#23170e] hover:bg-amber-300 active:bg-amber-400 disabled:opacity-40 transition-colors"
            >
              −
            </button>
            <span className="px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs font-mono tabular-nums font-bold text-[#23170e] border-x-2 border-[#2b1d12] bg-[#ead5af]">
              {currentZoomMeta.scaleTag}
            </span>
            <button
              type="button"
              onClick={() => zoomLevel < 6 && onChangeZoom((zoomLevel + 1) as ZoomLevel)}
              disabled={zoomLevel >= 6}
              aria-label="Zoomer la carte"
              className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center text-base sm:text-sm font-mono font-bold text-[#23170e] hover:bg-amber-300 active:bg-amber-400 disabled:opacity-40 transition-colors"
            >
              +
            </button>
          </div>

          {onToggleUiCollapsed && (
            <button
              type="button"
              onClick={onToggleUiCollapsed}
              title={uiCollapsed ? 'Déplier l’UI' : 'Replier l’UI'}
              aria-label={uiCollapsed ? 'Déplier l’UI' : 'Replier l’UI'}
              className={`h-11 min-w-[44px] sm:h-8 sm:min-w-0 px-2.5 border-2 border-[#2b1d12] jrpg-shadow inline-flex items-center justify-center gap-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                uiCollapsed
                  ? 'bg-amber-300 text-[#24160c] hover:bg-amber-200'
                  : 'bg-[#f7ebd2]/95 text-[#23170e] hover:bg-amber-200'
              }`}
            >
              <PixelUiIcon
                name={uiCollapsed ? 'ui-unfold' : 'ui-fold'}
                className="w-4 h-4"
              />
              <span className={uiCollapsed ? 'inline' : 'hidden xl:inline'}>
                {uiCollapsed ? 'Déplier l’UI' : 'Replier l’UI'}
              </span>
            </button>
          )}

          {onToggleFullscreen && (!uiCollapsed || immersiveFullscreen) && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              title={
                immersiveFullscreen
                  ? 'Quitter le plein écran (Échap)'
                  : 'Explorer en plein écran (F)'
              }
              aria-label={
                immersiveFullscreen
                  ? 'Quitter le plein écran'
                  : 'Activer le mode plein écran'
              }
              className={`h-11 min-w-[44px] sm:h-8 sm:min-w-0 px-2.5 border-2 border-[#2b1d12] jrpg-shadow inline-flex items-center justify-center gap-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                immersiveFullscreen
                  ? 'bg-[#991b1b] text-[#fffbeb] hover:bg-[#b91c1c]'
                  : 'bg-[#28160d] text-amber-300 hover:bg-[#3f2416]'
              }`}
            >
              <PixelUiIcon
                name={immersiveFullscreen ? 'fullscreen-exit' : 'fullscreen-enter'}
                className="w-4 h-4"
              />
              <span className="hidden md:inline">
                {immersiveFullscreen ? 'Réduire' : 'Plein écran'}
              </span>
            </button>
          )}
        </div>

        {/* Camera Panned Indicator -> 1-Tap Recenter onto Explorer */}
        {isPannedAway && (
          <button
            type="button"
            onClick={() => setPanMeters({ east: 0, north: 0 })}
            className="absolute top-14 sm:top-12 right-2 sm:right-2.5 min-h-[40px] sm:min-h-0 bg-amber-300 hover:bg-amber-200 text-[#24160c] border-2 border-[#2b1d12] px-2.5 py-1.5 text-xs font-bold jrpg-shadow inline-flex items-center gap-1.5 z-10 transition-colors whitespace-nowrap"
          >
            <PixelUiIcon name="gps" className="w-3.5 h-3.5" />
            <span>Recentrer</span>
          </button>
        )}

        {/* Bottom-Left 16-Bit Cartographic Legend Strip (Desktop when UI is expanded & no active bottom prompt/dialogue) */}
        {!immersiveFullscreen && !uiCollapsed && !activeNpcDialogue && !nearestPortal && (
          <div
            className={`pointer-events-none hidden xl:flex absolute bottom-2.5 left-2.5 border-2 px-2.5 py-1 text-[11px] font-semibold jrpg-shadow items-center gap-3 ${
              subterraneanMode
                ? 'bg-[#21160f]/95 text-amber-100 border-amber-600'
                : 'bg-[#f7ebd2]/95 text-[#23170e] border-[#2b1d12]'
            }`}
          >
            {subterraneanMode ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#73614d] border border-[#d6c3a5] inline-block" />
                  <span>Galeries & Tunnels</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#a68b67] border border-[#fde047] inline-block" />
                  <span>Carrières & Grottes (BRGM)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#4c4359] border border-[#cbd5e1] inline-block" />
                  <span>Cryptes & Caves</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#0284c7] border border-[#7dd3fc] inline-block" />
                  <span>Nappes & Canaux voûtés</span>
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#be123c] border border-[#fde047] inline-block" />
                  <span className="font-bold text-rose-900">? Sceau voilé</span>
                </span>
                {reliefEnabled && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-[#c9a677] border-t-2 border-t-[#84cc16] border border-[#291a0d] inline-block" />
                    <span>Coteaux & Degrés</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#2563eb] border-t-2 border-t-[#fbf6ea] border border-[#2b1d12] inline-block" />
                  <span>Fleuves & Ponts</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#dfd0b4] border border-[#5c4732] inline-block" />
                  <span>Pavés & Monuments</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#4da142] border border-[#166534] inline-block" />
                  <span>Parcs & Futaies</span>
                </span>
              </>
            )}
          </div>
        )}

        {/* Brief 16-Bit Stratum Transition Cartouche when crossing Surface <-> Sous-sol */}
        {stratumBanner && (
          <div
            aria-live="polite"
            className={`pointer-events-none absolute top-14 sm:top-12 left-1/2 -translate-x-1/2 px-3 py-1 border-2 text-xs font-bold jrpg-shadow whitespace-nowrap z-20 ${
              stratumBanner.sub
                ? 'bg-[#1c120b]/95 text-amber-300 border-amber-400'
                : 'bg-[#fbf2dc]/95 text-[#23170e] border-[#2b1d12]'
            }`}
          >
            {stratumBanner.label}
          </div>
        )}

        {/* Contextual Surface <-> Sous-sol Stairwell Prompt when Explorer stands near a real portal! */}
        {nearestPortal && onToggleSubterraneanMode && !activeNpcDialogue && (
          <button
            type="button"
            onClick={onToggleSubterraneanMode}
            className={`absolute left-1/2 -translate-x-1/2 min-h-[44px] px-3.5 py-2 bg-[#1c120b]/95 hover:bg-[#2d1d12] text-amber-300 border-2 border-amber-400 jrpg-shadow inline-flex items-center gap-2 text-xs font-bold whitespace-nowrap shrink-0 z-20 transition-colors ${
              uiCollapsed
                ? 'bottom-3'
                : immersiveFullscreen
                ? 'bottom-[calc(4.6rem+env(safe-area-inset-bottom))]'
                : 'max-lg:bottom-16 lg:bottom-3.5'
            }`}
          >
            <PixelUiIcon name={subterraneanMode ? 'map' : 'dungeon'} className="w-4 h-4" />
            <span>
              {subterraneanMode
                ? `▲ Remonter en Surface (${nearestPortal.dist} m)`
                : `▼ Descendre : ${nearestPortal.name.slice(0, 26)} (${nearestPortal.dist} m)`}
            </span>
          </button>
        )}

        {/* 16-Bit JRPG Regional Trivia Dialogue Box (Humans, Animals & Insects) */}
        {activeNpcDialogue && (
          <div
            role="dialog"
            aria-label={`Dialogue avec ${activeNpcDialogue.npc.name}`}
            className={`absolute left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[min(92%,650px)] bg-[#1c120b]/97 text-[#fef3c7] border-2 border-[#f59e0b] p-3 sm:p-4 jrpg-shadow z-30 flex items-start gap-3 sm:gap-4 ${
              uiCollapsed
                ? 'bottom-3'
                : immersiveFullscreen
                ? 'bottom-[calc(4.6rem+env(safe-area-inset-bottom))]'
                : 'max-lg:bottom-16 lg:bottom-3.5'
            }`}
          >
            <NpcPortraitCanvas
              npc={activeNpcDialogue.npc}
              animTick={animTick}
              className="w-12 h-12 sm:w-16 sm:h-16"
            />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-baseline justify-between gap-2 border-b border-amber-500/30 pb-1.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
                  <span className="font-display font-bold text-sm sm:text-base text-amber-300 truncate">
                    {activeNpcDialogue.npc.name}
                  </span>
                  <span className="text-xs text-amber-200/80 font-medium truncate">
                    {activeNpcDialogue.npc.roleLabel}
                    <span className="mx-1.5 text-amber-500/60" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-emerald-300 font-semibold">Consigné au Carnet ✓</span>
                  </span>
                </div>
                <div
                  className="inline-flex items-center gap-1.5 shrink-0"
                  aria-label={`Réplique ${activeNpcDialogue.lineIndex + 1} sur ${activeNpcDialogue.npc.dialogues.length}`}
                >
                  <span className="hidden xs:inline-flex items-center gap-1" aria-hidden="true">
                    {activeNpcDialogue.npc.dialogues.map((_, beatIdx) => (
                      <span
                        key={beatIdx}
                        className={`w-1.5 h-1.5 border border-amber-400 ${
                          beatIdx === activeNpcDialogue.lineIndex
                            ? 'bg-amber-300'
                            : beatIdx < activeNpcDialogue.lineIndex
                            ? 'bg-amber-500/50'
                            : 'bg-transparent'
                        }`}
                      />
                    ))}
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-amber-400/90">
                    {activeNpcDialogue.lineIndex + 1}/{activeNpcDialogue.npc.dialogues.length}
                  </span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-[#fffbeb] leading-relaxed select-text">
                {activeNpcDialogue.npc.dialogues[activeNpcDialogue.lineIndex] ||
                  activeNpcDialogue.npc.dialogues[0]}
              </p>

              {/* Informant Rumor / Local Lead Callout */}
              {activeDialogueRumor && onAcceptRumor && (
                <div className="pt-2 border-t border-amber-500/35 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-bold text-amber-300">
                      <PixelUiIcon name="rumor" className="w-3.5 h-3.5" />
                      <span>
                        {activeDialogueRumor.targetType === 'portal'
                          ? 'Confidence · Accès souterrain proche'
                          : 'Rumeur locale · Curiosité encore voilée'}
                      </span>
                    </span>
                    {activeDialogueRumorExisting && (
                      <span className="text-[11px] font-semibold text-emerald-300 shrink-0">
                        {activeDialogueRumorExisting.verified
                          ? 'Piste vérifiée ✓'
                          : 'Notée sur la carte ✓'}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                    <p className="text-xs italic text-amber-100/90 leading-snug select-text flex-1">
                      {activeDialogueRumor.rumorText}
                    </p>
                    {!activeDialogueRumorExisting ? (
                      <button
                        type="button"
                        onClick={() => {
                          playRumorPinSfx(muted);
                          onAcceptRumor(activeDialogueRumor);
                        }}
                        className="min-h-[36px] px-3 py-1.5 bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border border-amber-400 text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                      >
                        <PixelUiIcon name="rumor" className="w-3.5 h-3.5" />
                        <span>Noter sur la carte ▸</span>
                      </button>
                    ) : !activeDialogueRumorExisting.verified && simulationMode ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveNpcDialogue(null);
                          setPanMeters({ east: 0, north: 0 });
                          const waypoints = computeTopologicalWalkPath(
                            activeDialogueRumor.lat,
                            activeDialogueRumor.lng
                          );
                          if (onPlanWalkRoute) onPlanWalkRoute(waypoints);
                          else
                            onMapDestinationClick(
                              activeDialogueRumor.lat,
                              activeDialogueRumor.lng
                            );
                        }}
                        className="min-h-[36px] px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-[#fffbeb] border border-amber-300 text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                      >
                        <PixelUiIcon name="boot" className="w-3.5 h-3.5" />
                        <span>Marcher vers la piste ▸</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-amber-200/70 truncate hidden sm:inline">
                  {activeNpcDialogue.npc.habitatLabel} · Touche E pour continuer
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  {onOpenNpcPostcard && (
                    <button
                      type="button"
                      onClick={() => onOpenNpcPostcard(activeNpcDialogue.npc)}
                      title="Créer une carte postale souvenir 16-bit de cette rencontre"
                      className="min-h-[40px] sm:min-h-[36px] px-3 py-1.5 bg-[#991b1b] hover:bg-[#b91c1c] text-[#fffbeb] border-2 border-amber-400 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                    >
                      <PixelUiIcon name="postcard" className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">Carte postale</span>
                    </button>
                  )}
                  {activeNpcDialogue.npc.dialogues.length > 1 && (
                    <button
                      type="button"
                      onClick={() => interactWithNpc(activeNpcDialogue.npc)}
                      className="min-h-[40px] sm:min-h-[36px] px-3.5 py-1.5 bg-amber-300 hover:bg-amber-200 text-[#1c120b] border-2 border-[#140b05] text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
                    >
                      {activeNpcDialogue.lineIndex + 1 < activeNpcDialogue.npc.dialogues.length
                        ? activeNpcDialogue.npc.isHuman
                          ? 'Continuer ▸'
                          : 'Observer encore ▸'
                        : activeNpcDialogue.npc.isHuman
                        ? 'Reprendre ↺'
                        : 'Relire la note ↺'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveNpcDialogue(null)}
                    className="min-h-[40px] sm:min-h-[36px] px-3 py-1.5 bg-[#332014] hover:bg-[#472d1c] text-amber-200 border-2 border-[#92400e] text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hover Tooltip in Illuminated Parchment Cartouche (POIs, NPCs or Specimens!) */}
        {!activeNpcDialogue && hoveredPoi && !uiCollapsed && (
          <div
            className={`pointer-events-none hidden sm:flex absolute right-2.5 bg-[#fbf2dc] text-[#23170e] border-2 border-[#2b1d12] px-3 py-1.5 text-xs jrpg-shadow-crimson items-center gap-2 max-w-sm z-10 ${
              immersiveFullscreen
                ? 'bottom-[calc(4.6rem+env(safe-area-inset-bottom))]'
                : 'max-lg:bottom-16 lg:bottom-2.5'
            }`}
          >
            <span className="font-bold font-display truncate">
              {unlockedIds.has(hoveredPoi.id) ? hoveredPoi.name : `? ${hoveredPoi.mysteryTitle}`}
            </span>
            <span className="text-rose-800 font-mono tabular-nums font-bold shrink-0">
              {Math.round(haversineMeters(playerLat, playerLng, hoveredPoi.lat, hoveredPoi.lng))} m
            </span>
            {hoveredPoiDeltaAlt !== null && Math.abs(hoveredPoiDeltaAlt) >= 2 && (
              <span
                className={`font-mono tabular-nums font-bold shrink-0 ${
                  hoveredPoiDeltaAlt > 0 ? 'text-amber-900' : 'text-sky-900'
                }`}
              >
                {hoveredPoiDeltaAlt > 0 ? `+${hoveredPoiDeltaAlt} m ▲` : `${hoveredPoiDeltaAlt} m ▼`}
              </span>
            )}
          </div>
        )}

        {!activeNpcDialogue && !hoveredPoi && hoveredNpc && !uiCollapsed && (
          <div
            className={`pointer-events-none hidden sm:flex absolute right-2.5 bg-[#1c120b] text-amber-200 border-2 border-[#f59e0b] px-3 py-1.5 text-xs jrpg-shadow items-center gap-2 max-w-sm z-10 ${
              immersiveFullscreen
                ? 'bottom-[calc(4.6rem+env(safe-area-inset-bottom))]'
                : 'max-lg:bottom-16 lg:bottom-2.5'
            }`}
          >
            <span className="font-bold font-display text-amber-300 truncate">
              {hoveredNpc.name}
            </span>
            <span className="text-[11px] text-amber-100/85 truncate">
              · {hoveredNpc.isHuman ? 'Cliquer pour discuter' : 'Cliquer pour observer'}
            </span>
          </div>
        )}

        {!activeNpcDialogue && !hoveredPoi && !hoveredNpc && hoveredSpecimen && !uiCollapsed && (
          <div
            className={`pointer-events-none hidden sm:flex absolute right-2.5 bg-[#1c120b] text-emerald-200 border-2 border-emerald-500 px-3 py-1.5 text-xs jrpg-shadow items-center gap-2 max-w-sm z-10 ${
              immersiveFullscreen
                ? 'bottom-[calc(4.6rem+env(safe-area-inset-bottom))]'
                : 'max-lg:bottom-16 lg:bottom-2.5'
            }`}
          >
            <PixelUiIcon
              name={hoveredSpecimen.domain === 'botanique' ? 'leaf' : 'mineral'}
              className="w-3.5 h-3.5 text-amber-300 shrink-0"
            />
            <span className="font-bold font-display text-amber-300 truncate">
              {hoveredSpecimen.name}
            </span>
            <span className="text-[11px] text-amber-100/85 truncate">
              ·{' '}
              {haversineMeters(playerLat, playerLng, hoveredSpecimen.lat, hoveredSpecimen.lng) <=
              145
                ? hoveredSpecimen.domain === 'botanique'
                  ? 'Cliquer pour croquer'
                  : 'Cliquer pour prélever'
                : 'Cliquer pour s’approcher'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
