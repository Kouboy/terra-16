import dns from 'node:dns';
import { gunzipSync, inflateSync } from 'node:zlib';
import { VectorTile } from '@mapbox/vector-tile';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { PbfReader } from 'pbf';
import { fileURLToPath } from 'url';

dns.setDefaultResultOrder('ipv4first');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type CategoryKey = 'histoire' | 'geographie' | 'ecosysteme' | 'etrange' | 'legende';

type HistoricalStratum =
  | 'temps_profond'
  | 'prehistoire'
  | 'antiquite'
  | 'moyen_age'
  | 'moderne'
  | 'contemporain'
  | 'vivant_folklore';

type TerrainKind =
  | 'water'
  | 'island'
  | 'waterway'
  | 'forest'
  | 'park'
  | 'cemetery'
  | 'farmland'
  | 'residential'
  | 'industrial'
  | 'commercial'
  | 'plaza'
  | 'pier'
  | 'building'
  | 'major_road'
  | 'minor_road'
  | 'path'
  | 'steps'
  | 'bridge'
  | 'rail';

type BridgeMode = 'road' | 'minor' | 'path' | 'rail';

type LandmarkStyle =
  | 'church'
  | 'castle'
  | 'station'
  | 'civic'
  | 'arena'
  | 'tower'
  | 'fountain';

type BuildingArchetype =
  | 'urban_midrise'
  | 'commercial_shop'
  | 'industrial'
  | 'suburban_house'
  | 'village_cottage'
  | 'rural_farm'
  | 'civic_school';

interface RawPoi {
  id: string;
  name: string;
  mysteryTitle: string;
  category: CategoryKey;
  subType: string;
  stratum: HistoricalStratum;
  eraLabel: string;
  source: string;
  lat: number;
  lng: number;
  summary: string;
  nearWaterway: boolean;
  waterwayName: string;
  safetyNotice: string;
  externalUrl: string;
  xpReward: number;
  unlockRadiusMeters: number;
  relatedPoiIds: string[];
  relatedPoiTitles: string[];
}

interface TerrainFeature {
  id: string;
  kind: TerrainKind;
  isPolygon?: boolean;
  name: string;
  points: Array<{ lat: number; lng: number }>;
  bridgeMode?: BridgeMode;
  landmark?: LandmarkStyle;
  bldgClass?: BuildingArchetype;
  levels?: number;
  waterwayRank?: 'river' | 'canal' | 'stream';
}

interface BedrockInfo {
  period: string;
  ageRangeMa: string;
  lithology: string;
  environment: string;
}

interface ElevationGrid {
  centerLat: number;
  centerLng: number;
  cols: number;
  rows: number;
  stepMeters: number;
  minMeters: number;
  maxMeters: number;
  contourStepMeters: number;
  sourceLabel: string;
  elevDm: number[];
}

interface WeatherInfo {
  condition: 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'storm';
  tempC: number;
  windKmh: number;
  isDay: boolean;
  labelFr: string;
}

type SubterraneanKind =
  | 'tunnel_road'
  | 'subway'
  | 'underground_water'
  | 'quarry'
  | 'cave_cellar'
  | 'natural_cave'
  | 'mine'
  | 'crypt'
  | 'military'
  | 'well_aquifer'
  | 'portal';

interface SubterraneanFeature {
  id: string;
  kind: SubterraneanKind;
  name: string;
  isLine?: boolean;
  points: Array<{ lat: number; lng: number }>;
  depthLabel?: string;
  source?: string;
}

interface SectorPayload {
  center: { lat: number; lng: number };
  radiusMeters: number;
  pois: RawPoi[];
  terrain: TerrainFeature[];
  subterranean: SubterraneanFeature[];
  bedrock: BedrockInfo | null;
  elevation: ElevationGrid | null;
  weather: WeatherInfo | null;
  sourcesActive: string[];
  fetchedAt: string;
}

class BoundedTtlMap<K, V extends { expires: number }> {
  private readonly store = new Map<K, V>();

  constructor(private readonly maxEntries: number) {}

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expires <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    // Promote to most-recently-used
    this.store.delete(key);
    this.store.set(key, entry);
    return entry;
  }

  set(key: K, value: V): this {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const now = Date.now();
      for (const [k, v] of this.store) {
        if (v.expires <= now) {
          this.store.delete(k);
        }
      }
      while (this.store.size >= this.maxEntries) {
        const oldestKey = this.store.keys().next().value;
        if (oldestKey === undefined) break;
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, value);
    return this;
  }
}

const sectorCache = new BoundedTtlMap<string, { expires: number; data: SectorPayload }>(180);
const weatherCache = new BoundedTtlMap<string, { expires: number; data: WeatherInfo }>(160);
const geologyCache = new BoundedTtlMap<
  string,
  { expires: number; data: { bedrock: BedrockInfo | null; geoPois: RawPoi[] } }
>(160);
const fossilCache = new BoundedTtlMap<string, { expires: number; data: RawPoi[] }>(160);
const geocodeCache = new BoundedTtlMap<
  string,
  { expires: number; results: Array<{ label: string; lat: number; lng: number }> }
>(120);
const inFlightSectorRequests = new Map<string, Promise<SectorPayload>>();

let cachedTileTemplate: { url: string; zoom: number; expires: number } | null = null;
const rawMvtTileCache = new BoundedTtlMap<string, { expires: number; buffer: Buffer }>(220);
const terrariumTileCache = new BoundedTtlMap<string, { expires: number; raster: Float32Array }>(120);

const USER_AGENT = 'Terra16ExplorationJRPG/3.0 (Educational Geo-RPG; contact@terra16.example)';

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || 'poi_unknown';
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5500
): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function inferStratumFromYearOrText(
  year: number | null,
  textRaw: string,
  fallbackCategory: CategoryKey
): { stratum: HistoricalStratum; eraLabel: string } {
  const text = textRaw.toLowerCase();

  if (year !== null && Number.isFinite(year)) {
    if (year < -800) return { stratum: 'prehistoire', eraLabel: `Préhistoire (${Math.abs(year)} av. J.-C.)` };
    if (year < 476)
      return {
        stratum: 'antiquite',
        eraLabel: year < 0 ? `Antiquité (${Math.abs(year)} av. J.-C.)` : `Antiquité (${year})`,
      };
    if (year < 1492) return { stratum: 'moyen_age', eraLabel: `Moyen Âge (${year})` };
    if (year < 1789) return { stratum: 'moderne', eraLabel: `Époque Moderne (${year})` };
    return { stratum: 'contemporain', eraLabel: `Ère Contemporaine (${year})` };
  }

  if (/fossile|jurassique|crétacé|éocène|lutétien|miocène|paléozoïque|karst|géolog|millions d'années/.test(text)) {
    return { stratum: 'temps_profond', eraLabel: 'Temps Géologique Profond' };
  }
  if (/néolithique|paléolithique|préhistoir|cro-magnon|magdalénien|dolmen|menhir|mégalith|tumulus|âge du bronze/.test(text)) {
    return { stratum: 'prehistoire', eraLabel: 'Préhistoire & Mégalithes' };
  }
  if (/gallo-romain|romain|antique|antiquité|gaulois|oppidum|thermes antiques|arènes|aqueduc antique/.test(text)) {
    return { stratum: 'antiquite', eraLabel: 'Antiquité & Gallo-Romain' };
  }
  if (/médiéval|moyen âge|féodal|roman|gothique|xiie siècle|xiiie siècle|xive siècle|xie siècle|abbaye|donjon|rempart|chapelle|église/.test(text)) {
    return { stratum: 'moyen_age', eraLabel: 'Moyen Âge & Patrimoine' };
  }
  if (/renaissance|xvie siècle|xviie siècle|xviiie siècle|vauban|classique|ancien régime/.test(text)) {
    return { stratum: 'moderne', eraLabel: 'Époque Moderne (XVIe–XVIIIe)' };
  }
  if (/xixe siècle|xxe siècle|industriel|friche|bunker|métro|chemin de fer|gare|guerre mondiale|fantôme/.test(text)) {
    return { stratum: 'contemporain', eraLabel: 'Ère Industrielle & Contemporaine' };
  }

  if (fallbackCategory === 'geographie') return { stratum: 'temps_profond', eraLabel: 'Géomorphologie & Eaux' };
  if (fallbackCategory === 'legende') return { stratum: 'vivant_folklore', eraLabel: 'Tradition Orale & Légendes' };
  if (fallbackCategory === 'ecosysteme') return { stratum: 'vivant_folklore', eraLabel: 'Biodiversité Actuelle' };
  if (fallbackCategory === 'etrange') return { stratum: 'contemporain', eraLabel: 'Strate Souterraine & Vestiges' };
  return { stratum: 'moyen_age', eraLabel: 'Strate Patrimoniale' };
}

// ============================================================================
// 1. REAL-WORLD Z15 VECTOR TILE TOPOLOGY ENGINE (CARTO Protomaps + OpenFreeMap)
// Extracts exact rivers, lakes, streams, streets, paths, bridges, rails,
// buildings, parks, forests & farmland fields in ~40ms!
// ============================================================================

async function resolveVectorTileTemplate(): Promise<{ url: string; zoom: number } | null> {
  if (cachedTileTemplate && cachedTileTemplate.expires > Date.now()) {
    return { url: cachedTileTemplate.url, zoom: cachedTileTemplate.zoom };
  }

  // Primary: CARTO Voyager Protomaps Z15 (includes individual village/urban buildings + rich landuse)
  try {
    const resp = await fetchWithTimeout(
      'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      {},
      3000
    );
    if (resp.ok) {
      const styleJson = (await resp.json()) as {
        sources?: { protomaps?: { tiles?: string[]; maxzoom?: number } };
      };
      const tpl = styleJson.sources?.protomaps?.tiles?.[0];
      if (tpl) {
        const zoom = Math.min(15, styleJson.sources?.protomaps?.maxzoom || 15);
        cachedTileTemplate = { url: tpl, zoom, expires: Date.now() + 30 * 60 * 1000 };
        return { url: tpl, zoom };
      }
    }
  } catch {
    // Fallback below
  }

  // Fallback: OpenFreeMap Planet Z14
  try {
    const resp = await fetchWithTimeout('https://tiles.openfreemap.org/planet', {}, 3000);
    if (resp.ok) {
      const meta = (await resp.json()) as { tiles?: string[]; maxzoom?: number };
      const tpl = meta.tiles?.[0];
      if (tpl) {
        const zoom = Math.min(14, meta.maxzoom || 14);
        cachedTileTemplate = { url: tpl, zoom, expires: Date.now() + 30 * 60 * 1000 };
        return { url: tpl, zoom };
      }
    }
  } catch {
    // Ignore
  }

  return null;
}

function latLngToTileXY(lat: number, lng: number, z: number): { x: number; y: number } {
  const n = Math.pow(2, z);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

// ============================================================================
// 1B. REAL-WORLD DIGITAL ELEVATION MODEL (DEM) ENGINE
// Decodes Z14 Terrarium 256x256 RGB PNG tiles (~6.5m native resolution) +
// calibrates exact NGF French datum against IGN Géoplateforme RGE ALTI!
// ============================================================================

function decodePngToTerrariumElevations(buf: Buffer): Float32Array | null {
  if (
    buf.length < 33 ||
    buf[0] !== 0x89 ||
    buf[1] !== 0x50 ||
    buf[2] !== 0x4e ||
    buf[3] !== 0x47
  ) {
    return null;
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks: Buffer[] = [];

  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    if (offset + 12 + length > buf.length) break;
    const data = buf.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR' && length >= 13) {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length;
  }

  if (width !== 256 || height !== 256 || bitDepth !== 8 || interlace !== 0) return null;
  const bpp = colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
  if (bpp === 0 || idatChunks.length === 0) return null;

  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idatChunks));
  } catch {
    return null;
  }

  const stride = width * bpp;
  if (raw.length < height * (1 + stride)) return null;

  const out = new Float32Array(width * height);
  const prevRow = new Uint8Array(stride);
  const curRow = new Uint8Array(stride);

  for (let y = 0; y < height; y++) {
    const rowOff = y * (1 + stride);
    const filter = raw[rowOff];

    for (let i = 0; i < stride; i++) {
      const xByte = raw[rowOff + 1 + i];
      const a = i >= bpp ? curRow[i - bpp] : 0;
      const b = prevRow[i];
      const c = i >= bpp ? prevRow[i - bpp] : 0;

      let val = xByte;
      if (filter === 1) {
        val = (xByte + a) & 0xff;
      } else if (filter === 2) {
        val = (xByte + b) & 0xff;
      } else if (filter === 3) {
        val = (xByte + ((a + b) >> 1)) & 0xff;
      } else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        val = (xByte + pr) & 0xff;
      }
      curRow[i] = val;
    }

    for (let px = 0; px < width; px++) {
      const pOff = px * bpp;
      const r = curRow[pOff];
      const g = curRow[pOff + 1];
      const bl = curRow[pOff + 2];
      out[y * width + px] = r * 256 + g + bl / 256 - 32768;
    }

    prevRow.set(curRow);
  }

  return out;
}

async function fetchTerrariumTile(z: number, x: number, y: number): Promise<Float32Array | null> {
  const key = `${z}_${x}_${y}`;
  const cached = terrariumTileCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.raster;
  }

  try {
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
    const resp = await fetchWithTimeout(url, { headers: { Accept: 'image/png,*/*' } }, 3800);
    if (!resp.ok) return null;
    const ab = await resp.arrayBuffer();
    const raster = decodePngToTerrariumElevations(Buffer.from(ab));
    if (raster) {
      terrariumTileCache.set(key, {
        expires: Date.now() + 30 * 60 * 1000,
        raster,
      });
    }
    return raster;
  } catch {
    return null;
  }
}

async function queryIgnCenterAltitude(lat: number, lng: number): Promise<number | null> {
  // Fast 1m-accurate French NGF benchmark from IGN Géoplateforme RGE ALTI
  if (lat < 41 || lat > 51.5 || lng < -5.5 || lng > 10) return null;
  try {
    const url = `https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?lon=${lng.toFixed(
      5
    )}&lat=${lat.toFixed(5)}&resource=ign_rge_alti_wld`;
    const resp = await fetchWithTimeout(url, {}, 2400);
    if (!resp.ok) return null;
    const json = (await resp.json()) as { elevations?: Array<{ z?: number }> };
    const z = Number(json.elevations?.[0]?.z);
    if (Number.isFinite(z) && z > -400 && z < 6000) {
      return z;
    }
  } catch {
    // Ignore IGN timeout
  }
  return null;
}

async function querySectorElevationGrid(lat: number, lng: number): Promise<ElevationGrid | null> {
  const Z = 14;
  const COLS = 145;
  const ROWS = 145;
  const STEP_METERS = 22; // Covers ±1,584 m (3.17 km x 3.17 km) around center!
  const halfX = (COLS - 1) / 2;
  const halfY = (ROWS - 1) / 2;
  const cosLat = Math.max(0.15, Math.cos((lat * Math.PI) / 180));

  const maxNorthLat = lat + (halfY * STEP_METERS) / 110540;
  const minSouthLat = lat - (halfY * STEP_METERS) / 110540;
  const minWestLng = lng - (halfX * STEP_METERS) / (111320 * cosLat);
  const maxEastLng = lng + (halfX * STEP_METERS) / (111320 * cosLat);

  const tl = latLngToTileXY(maxNorthLat, minWestLng, Z);
  const br = latLngToTileXY(minSouthLat, maxEastLng, Z);

  const tileCoords: Array<{ x: number; y: number }> = [];
  for (let ty = Math.min(tl.y, br.y); ty <= Math.max(tl.y, br.y); ty++) {
    for (let tx = Math.min(tl.x, br.x); tx <= Math.max(tl.x, br.x); tx++) {
      if (tileCoords.length < 16) {
        tileCoords.push({ x: tx, y: ty });
      }
    }
  }

  const [ignCenterZ, ...tileRasters] = await Promise.all([
    queryIgnCenterAltitude(lat, lng),
    ...tileCoords.map((tc) => fetchTerrariumTile(Z, tc.x, tc.y)),
  ]);

  const tileMap = new Map<string, Float32Array>();
  tileCoords.forEach((tc, idx) => {
    const r = tileRasters[idx];
    if (r) tileMap.set(`${tc.x}_${tc.y}`, r);
  });

  if (tileMap.size === 0) return null;

  const worldScale = Math.pow(2, Z) * 256;
  const sampleRawDem = (sLat: number, sLng: number): number | null => {
    const xf = ((sLng + 180) / 360) * worldScale;
    const latRad = (sLat * Math.PI) / 180;
    const yf =
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * worldScale;

    const getPx = (ix: number, iy: number): number | null => {
      const tx = Math.floor(ix / 256);
      const ty = Math.floor(iy / 256);
      const raster = tileMap.get(`${tx}_${ty}`);
      if (!raster) return null;
      const px = ((ix % 256) + 256) % 256;
      const py = ((iy % 256) + 256) % 256;
      return raster[py * 256 + px];
    };

    const ix0 = Math.floor(xf);
    const iy0 = Math.floor(yf);
    const fx = xf - ix0;
    const fy = yf - iy0;

    const v00 = getPx(ix0, iy0);
    if (v00 === null) return null;
    const v10 = getPx(ix0 + 1, iy0) ?? v00;
    const v01 = getPx(ix0, iy0 + 1) ?? v00;
    const v11 = getPx(ix0 + 1, iy0 + 1) ?? v00;

    const top = v00 + (v10 - v00) * fx;
    const bot = v01 + (v11 - v01) * fx;
    return top + (bot - top) * fy;
  };

  const centerDem = sampleRawDem(lat, lng);
  if (centerDem === null) return null;

  // Calibrate vertical NGF datum with IGN RGE ALTI if available (clamped to ±8m to avoid roof/bridge bias)
  const datumOffset =
    ignCenterZ !== null
      ? Math.max(-8, Math.min(8, ignCenterZ - centerDem))
      : 0;

  const rawGrid = new Float32Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++) {
    const sLat = lat - ((r - halfY) * STEP_METERS) / 110540;
    for (let c = 0; c < COLS; c++) {
      const sLng = lng + ((c - halfX) * STEP_METERS) / (111320 * cosLat);
      const val = (sampleRawDem(sLat, sLng) ?? centerDem) + datumOffset;
      rawGrid[r * COLS + c] = Math.max(-420, Math.min(8850, val));
    }
  }

  // Gentle 3x3 [1,2,1] binomial pass removes single-tree canopy noise while preserving real cliffs & valleys
  const smoothed = new Float32Array(COLS * ROWS);
  let minMeters = Infinity;
  let maxMeters = -Infinity;
  const elevDm = new Array<number>(COLS * ROWS);

  for (let r = 0; r < ROWS; r++) {
    const r0 = Math.max(0, r - 1);
    const r2 = Math.min(ROWS - 1, r + 1);
    for (let c = 0; c < COLS; c++) {
      const c0 = Math.max(0, c - 1);
      const c2 = Math.min(COLS - 1, c + 1);
      const acc =
        rawGrid[r0 * COLS + c0] +
        2 * rawGrid[r0 * COLS + c] +
        rawGrid[r0 * COLS + c2] +
        2 * rawGrid[r * COLS + c0] +
        4 * rawGrid[r * COLS + c] +
        2 * rawGrid[r * COLS + c2] +
        rawGrid[r2 * COLS + c0] +
        2 * rawGrid[r2 * COLS + c] +
        rawGrid[r2 * COLS + c2];
      const z = acc / 16;
      smoothed[r * COLS + c] = z;
      if (z < minMeters) minMeters = z;
      if (z > maxMeters) maxMeters = z;
      elevDm[r * COLS + c] = Math.round(z * 10);
    }
  }

  const span = maxMeters - minMeters;
  const contourStepMeters =
    span < 34 ? 6 : span < 82 ? 10 : span < 175 ? 16 : span < 380 ? 28 : 48;

  return {
    centerLat: lat,
    centerLng: lng,
    cols: COLS,
    rows: ROWS,
    stepMeters: STEP_METERS,
    minMeters: Math.round(minMeters * 10) / 10,
    maxMeters: Math.round(maxMeters * 10) / 10,
    contourStepMeters,
    sourceLabel:
      ignCenterZ !== null ? 'Relief Altimétrique (IGN RGE ALTI & MNT)' : 'Modèle Numérique de Terrain (Z14)',
    elevDm,
  };
}

function tilePixelToLatLng(
  tx: number,
  ty: number,
  z: number,
  px: number,
  py: number,
  extent: number
): { lat: number; lng: number } {
  const n = Math.pow(2, z);
  const lng = ((tx + px / extent) / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (ty + py / extent)) / n)));
  const lat = (latRad * 180) / Math.PI;
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
}

async function fetchSingleMvtTile(tpl: string, z: number, x: number, y: number): Promise<Buffer | null> {
  const key = `${z}/${x}/${y}`;
  const cached = rawMvtTileCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.buffer;
  }

  const url = tpl.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
  try {
    const resp = await fetchWithTimeout(url, { headers: { Accept: '*/*' } }, 3500);
    if (!resp.ok) return null;
    const arr = await resp.arrayBuffer();
    let buf: Buffer = Buffer.from(arr);
    if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
      buf = gunzipSync(buf);
    }
    rawMvtTileCache.set(key, { expires: Date.now() + 15 * 60 * 1000, buffer: buf });
    return buf;
  } catch {
    return null;
  }
}

function ringSignedArea(ring: Array<{ x: number; y: number }>): number {
  let area = 0;
  for (let i = 0, len = ring.length; i < len; i++) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % len];
    area += p1.x * p2.y - p2.x * p1.y;
  }
  return area * 0.5;
}

function bboxIntersects(
  pts: Array<{ lat: number; lng: number }>,
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number
): boolean {
  let aMinLat = Infinity;
  let aMaxLat = -Infinity;
  let aMinLng = Infinity;
  let aMaxLng = -Infinity;
  for (const p of pts) {
    if (p.lat < aMinLat) aMinLat = p.lat;
    if (p.lat > aMaxLat) aMaxLat = p.lat;
    if (p.lng < aMinLng) aMinLng = p.lng;
    if (p.lng > aMaxLng) aMaxLng = p.lng;
  }
  return !(aMaxLat < minLat || aMinLat > maxLat || aMaxLng < minLng || aMinLng > maxLng);
}

function simplifyRing(
  pts: Array<{ lat: number; lng: number }>,
  maxPts: number,
  isPolygon: boolean
): Array<{ lat: number; lng: number }> {
  if (pts.length <= maxPts) return pts;
  const step = Math.ceil(pts.length / maxPts);
  const out: Array<{ lat: number; lng: number }> = [];
  for (let i = 0; i < pts.length; i += step) {
    out.push(pts[i]);
  }
  if (isPolygon && out.length >= 3) {
    const first = out[0];
    const last = out[out.length - 1];
    if (first.lat !== last.lat || first.lng !== last.lng) {
      out.push(first);
    }
  } else if (!isPolygon && pts.length > 1) {
    const end = pts[pts.length - 1];
    const last = out[out.length - 1];
    if (last.lat !== end.lat || last.lng !== end.lng) {
      out.push(end);
    }
  }
  return out;
}

function minDistanceMetersToPlayer(
  pts: Array<{ lat: number; lng: number }>,
  lat: number,
  lng: number
): number {
  if (pts.length === 0) return Infinity;
  const cosLat = Math.max(0.15, Math.cos((lat * Math.PI) / 180));
  let bestSq = Infinity;

  for (let i = 0; i < pts.length; i++) {
    const ax = (pts[i].lng - lng) * 111320 * cosLat;
    const ay = (pts[i].lat - lat) * 110540;
    const dVertexSq = ax * ax + ay * ay;
    if (dVertexSq < bestSq) bestSq = dVertexSq;

    if (i + 1 < pts.length) {
      const bx = (pts[i + 1].lng - lng) * 111320 * cosLat;
      const by = (pts[i + 1].lat - lat) * 110540;
      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      if (lenSq > 0.01) {
        const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq));
        const px = ax + t * dx;
        const py = ay + t * dy;
        const dSegSq = px * px + py * py;
        if (dSegSq < bestSq) bestSq = dSegSq;
      }
    }
  }
  return Math.sqrt(bestSq);
}

async function queryVectorTileTopology(
  lat: number,
  lng: number
): Promise<{ terrain: TerrainFeature[]; pois: RawPoi[]; subterranean: SubterraneanFeature[] }> {
  const source = await resolveVectorTileTemplate();
  if (!source) return { terrain: [], pois: [], subterranean: [] };

  const { url: tpl, zoom: z } = source;
  // Cover ~1.25km around player so wide 0.5x Contrée zoom is richly populated
  const dLat = 0.0112;
  const cosLat = Math.max(0.15, Math.cos((lat * Math.PI) / 180));
  const dLng = 0.0112 / cosLat;

  const minTile = latLngToTileXY(lat + dLat, lng - dLng, z);
  const maxTile = latLngToTileXY(lat - dLat, lng + dLng, z);

  const coords: Array<{ tx: number; ty: number }> = [];
  for (let ty = minTile.y; ty <= maxTile.y; ty++) {
    for (let tx = minTile.x; tx <= maxTile.x; tx++) {
      if (coords.length < 16) coords.push({ tx, ty });
    }
  }

  // Sort tiles closest to player's own tile first
  const playerTile = latLngToTileXY(lat, lng, z);
  coords.sort(
    (a, b) =>
      Math.hypot(a.tx - playerTile.x, a.ty - playerTile.y) -
      Math.hypot(b.tx - playerTile.x, b.ty - playerTile.y)
  );
  const selectedCoords = coords.slice(0, 16);

  const buffers = await Promise.all(
    selectedCoords.map((c) => fetchSingleMvtTile(tpl, z, c.tx, c.ty))
  );

  const minLat = lat - dLat;
  const maxLat = lat + dLat;
  const minLng = lng - dLng;
  const maxLng = lng + dLng;

  const bLat = dLat;
  const bLng = dLng;

  const waterBucket: Array<{ dist: number; feat: TerrainFeature }> = [];
  const greenBucket: Array<{ dist: number; feat: TerrainFeature }> = [];
  const urbanGroundBucket: Array<{ dist: number; feat: TerrainFeature }> = [];
  const roadBucket: Array<{ dist: number; roadPrio: number; feat: TerrainFeature }> = [];
  const pathRailBucket: Array<{ dist: number; feat: TerrainFeature }> = [];
  const subterraneanBucket: Array<{ dist: number; feat: SubterraneanFeature }> = [];
  const buildingBucket: Array<{
    dist: number;
    priority: number;
    spanM: number;
    cellKey: string;
    feat: TerrainFeature;
  }> = [];

  const classifyBuildingLandmark = (
    props: Record<string, unknown>,
    bName: string
  ): LandmarkStyle | undefined => {
    const tags = [
      props.kind,
      props['pmap:kind'],
      props.kind_detail,
      props.building,
      props['building:use'],
      props.class,
      props.subclass,
      props.amenity,
      props.historic,
      props.man_made,
      props.tourism,
    ]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase())
      .join(' ');
    const full = `${tags} ${bName.toLowerCase()}`;

    if (
      /\b(cathedral|church|chapel|basilica|abbey|monastery|mosque|synagogue|temple|place_of_worship|shrine|cathédrale|église|basilique|chapelle|abbaye|prieuré|collégiale|abbatiale|sacré-cœur)\b/.test(
        full
      )
    ) {
      return 'church';
    }
    if (
      /\b(castle|fort|fortress|citadel|palace|chateau|keep|city_gate|château|donjon|citadelle|forteresse|rempart)\b/.test(
        full
      )
    ) {
      return 'castle';
    }
    if (/\b(train_station|railway_station|terminus|gare\s+sncf|gare\s+de|gare\s+du|gare\s+saint)\b/.test(full) || /\btrain_station\b/.test(tags)) {
      return 'station';
    }
    if (/\b(stadium|grandstand|amphitheatre|arena|arènes|amphithéâtre|stade|vélodrome)\b/.test(full)) {
      return 'arena';
    }
    if (
      /\b(lighthouse|windmill|watermill|bell_tower|water_tower|ruins|beffroi|phare|moulin)\b/.test(
        full
      ) ||
      /\b(tower|ruins)\b/.test(tags)
    ) {
      return 'tower';
    }
    if (
      /\b(townhall|courthouse|opera|theatre|museum|pantheon|mairie|hôtel\s+de\s+ville|panthéon|opéra|théâtre|préfecture|palais\s+de)\b/.test(
        full
      )
    ) {
      return 'civic';
    }
    return undefined;
  };

  const classifyBuildingArchetype = (
    props: Record<string, unknown>,
    bName: string
  ): { bldgClass?: BuildingArchetype; levels?: number } => {
    const rawLevels = Number(props['building:levels'] ?? props.levels ?? NaN);
    const rawHeight = Number(props.height ?? props['building:height'] ?? NaN);
    let levels: number | undefined;
    if (Number.isFinite(rawLevels) && rawLevels >= 1 && rawLevels <= 40) {
      levels = Math.round(rawLevels);
    } else if (Number.isFinite(rawHeight) && rawHeight >= 3.5 && rawHeight <= 150) {
      levels = Math.max(1, Math.round(rawHeight / 3.2));
    }

    const tags = [
      props.kind,
      props['pmap:kind'],
      props.kind_detail,
      props.building,
      props['building:use'],
      props.class,
      props.subclass,
      props.amenity,
      props.shop,
      props.industrial,
      props.craft,
      props.landuse,
      props.man_made,
    ]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase())
      .join(' ');
    const full = `${tags} ${bName.toLowerCase()}`;

    if (
      /\b(industrial|warehouse|factory|manufacture|works|storage_tank|silo|logistics|hangar|usine|entrepôt|dépôt|fonderie|scierie|atelier\s+industriel)\b/.test(
        full
      )
    ) {
      return { bldgClass: 'industrial', levels };
    }
    if (
      /\b(retail|commercial|supermarket|mall|marketplace|kiosk|shop|department_store|halle|marché|hypermarché|supermarché|centre\s+commercial|galerie\s+marchande)\b/.test(
        full
      )
    ) {
      return { bldgClass: 'commercial_shop', levels };
    }
    if (
      /\b(school|university|college|kindergarten|hospital|clinic|public|civic|government|library|fire_station|police|école|collège|lycée|université|hôpital|clinique|bibliothèque|gendarmerie|caserne)\b/.test(
        full
      )
    ) {
      return { bldgClass: 'civic_school', levels };
    }
    if (
      /\b(barn|farm|farm_auxiliary|cowshed|stable|sty|greenhouse|slurry_tank|grange|ferme|étable|écurie|bergerie|pigeonnier|métairie)\b/.test(
        full
      )
    ) {
      return { bldgClass: 'rural_farm', levels };
    }
    if (
      /\b(apartments|office|dormitory|hotel|immeuble|résidence)\b/.test(full) ||
      (levels !== undefined && levels >= 4)
    ) {
      return { bldgClass: 'urban_midrise', levels };
    }
    if (/\b(detached|semidetached_house|bungalow|terrace|pavillon)\b/.test(full)) {
      return { bldgClass: 'suburban_house', levels };
    }
    if (levels !== undefined && levels >= 3 && /\b(house|residential)\b/.test(full)) {
      return { bldgClass: 'urban_midrise', levels };
    }
    return { levels };
  };

  const pois: RawPoi[] = [];
  const seenPoiKeys = new Set<string>();
  let seq = 0;

  for (let idx = 0; idx < selectedCoords.length; idx++) {
    const buf = buffers[idx];
    if (!buf) continue;
    const { tx, ty } = selectedCoords[idx];

    let vt: VectorTile;
    try {
      vt = new VectorTile(new PbfReader(buf));
    } catch {
      continue;
    }

    // A. LANDUSE / NATURAL / LANDCOVER / PARK / MAN_MADE POLYGONS (Forests, Fields, Parks, Plazas, Piers, Residential)
    for (const layerName of ['landuse', 'natural', 'landcover', 'park', 'leisure', 'earth', 'man_made']) {
      const layer = vt.layers[layerName];
      if (!layer) continue;
      const extent = layer.extent || 4096;

      for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i);
        const props = feat.properties || {};
        const rawKind = String(
          props.kind || props['pmap:kind'] || props.kind_detail || props.class || props.subclass || ''
        ).toLowerCase();
        const detailKind = String(props.kind_detail || props.subclass || '').toLowerCase();

        // Extract piers / jetties / breakwaters (polygons or lines)
        if (/^(pier|breakwater|groyne|jetty|pontoon)$/.test(rawKind) || /^(pier|breakwater|jetty)$/.test(detailKind)) {
          const geom = feat.loadGeometry();
          for (const ring of geom) {
            if (ring.length < 2) continue;
            const geoPts = ring.map((pt) => tilePixelToLatLng(tx, ty, z, pt.x, pt.y, extent));
            if (!bboxIntersects(geoPts, minLat, maxLat, minLng, maxLng)) continue;
            const isPoly = feat.type === 3 && ring.length >= 4;
            const simplified = simplifyRing(geoPts, 36, isPoly);
            pathRailBucket.push({
              dist: minDistanceMetersToPlayer(simplified, lat, lng),
              feat: {
                id: `vt_pr_${seq++}`,
                kind: 'pier',
                isPolygon: isPoly,
                name: String(props['name:fr'] || props.name || 'Jetée'),
                points: simplified,
              },
            });
          }
          continue;
        }

        if (feat.type !== 3) continue;
        if (layerName === 'earth' && rawKind !== 'cliff') continue;
        if (layerName === 'earth') continue;

        let mappedKind: TerrainKind | null = null;
        if (
          /^(forest|wood|nature_reserve|scrub|national_park|protected_area|tree_row|wetland|heath)$/.test(rawKind) ||
          /^(forest|wood|scrub|nature_reserve)$/.test(detailKind)
        ) {
          mappedKind = 'forest';
        } else if (
          /^(farmland|orchard|vineyard|allotments|plant_nursery|meadow|farm|grassland|farmyard)$/.test(rawKind)
        ) {
          mappedKind = 'farmland';
        } else if (
          /^(cemetery|grave_yard)$/.test(rawKind) ||
          /^(cemetery|grave_yard)$/.test(detailKind)
        ) {
          mappedKind = 'cemetery';
        } else if (
          /^(park|urban_park|garden|playground|village_green|grass|pitch|golf_course|dog_park|recreation_ground|zoo|stadium)$/.test(
            rawKind
          ) ||
          /^(park|garden|playground|grass|pitch)$/.test(detailKind)
        ) {
          mappedKind = 'park';
        } else if (/^(pedestrian|plaza|square|courtyard)$/.test(rawKind)) {
          mappedKind = 'plaza';
        } else if (
          /^(industrial|warehouse|railway|quarry|garages|port|brownfield|works|wastewater_plant|landfill|depot|plant)$/.test(
            rawKind
          ) ||
          /^(industrial|warehouse|quarry|railway|works)$/.test(detailKind)
        ) {
          mappedKind = 'industrial';
        } else if (
          /^(commercial|retail|market|marketplace)$/.test(rawKind) ||
          /^(commercial|retail|marketplace)$/.test(detailKind)
        ) {
          mappedKind = 'commercial';
        } else if (
          /^(residential|suburb|quarter|neighbourhood|school|university|college|hospital|civic|institutional)$/.test(
            rawKind
          )
        ) {
          mappedKind = 'residential';
        }

        if (!mappedKind) continue;

        const geom = feat.loadGeometry();
        for (let r = 0; r < geom.length; r++) {
          const ring = geom[r];
          if (ring.length < 4) continue;
          if (r > 0 && ringSignedArea(ring) <= 0) continue;

          const geoPts = ring.map((pt) => tilePixelToLatLng(tx, ty, z, pt.x, pt.y, extent));
          if (!bboxIntersects(geoPts, minLat, maxLat, minLng, maxLng)) continue;

          const simplified = simplifyRing(geoPts, 64, true);
          const dist = minDistanceMetersToPlayer(simplified, lat, lng);
          const item = {
            dist,
            feat: {
              id: `vt_lu_${seq++}`,
              kind: mappedKind,
              isPolygon: true,
              name: String(props['name:fr'] || props.name || ''),
              points: simplified,
            },
          };

          if (
            mappedKind === 'park' ||
            mappedKind === 'forest' ||
            mappedKind === 'farmland' ||
            mappedKind === 'cemetery'
          ) {
            greenBucket.push(item);
          } else {
            urbanGroundBucket.push(item);
          }
        }
      }
    }

    // B. WATER POLYGONS, RIVER ISLANDS (HOLE RINGS) & WATERWAY STREAMS / RIVERS
    for (const layerName of ['water', 'waterway', 'physical_line']) {
      const layer = vt.layers[layerName];
      if (!layer) continue;
      const extent = layer.extent || 4096;

      for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i);
        const props = feat.properties || {};
        const rawKind = String(props.kind || props['pmap:kind'] || props.class || '').toLowerCase();
        const detailKind = String(props.kind_detail || props.subclass || '').toLowerCase();
        if (rawKind === 'swimming_pool') continue;
        if (
          layerName === 'physical_line' &&
          !/^(river|stream|canal|drain|ditch|waterway)$/.test(rawKind)
        ) {
          continue;
        }

        const waterName = String(props['name:fr'] || props.name || '');

        if (props.is_tunnel === true || props.brunnel === 'tunnel') {
          if (feat.type === 2) {
            const geom = feat.loadGeometry();
            for (const line of geom) {
              if (line.length < 2) continue;
              const geoPts = line.map((pt) => tilePixelToLatLng(tx, ty, z, pt.x, pt.y, extent));
              if (!bboxIntersects(geoPts, minLat, maxLat, minLng, maxLng)) continue;
              const simplified = simplifyRing(geoPts, 48, false);
              subterraneanBucket.push({
                dist: minDistanceMetersToPlayer(simplified, lat, lng),
                feat: {
                  id: `vt_subw_${seq++}`,
                  kind: 'underground_water',
                  isLine: true,
                  name: waterName || 'Cours d’eau ou canal voûté',
                  points: simplified,
                  source: 'OpenStreetMap (Z15)',
                },
              });
            }
          }
          continue;
        }

        if (feat.type === 3) {
          const geom = feat.loadGeometry();
          for (let r = 0; r < geom.length; r++) {
            const ring = geom[r];
            if (ring.length < 4) continue;
            const signedArea = ringSignedArea(ring);
            const isHoleIsland = r > 0 && signedArea < 0;

            const geoPts = ring.map((pt) => tilePixelToLatLng(tx, ty, z, pt.x, pt.y, extent));
            if (!bboxIntersects(geoPts, minLat, maxLat, minLng, maxLng)) continue;

            if (isHoleIsland) {
              // Preserve genuine river/lake islands (e.g. Île de la Cité, Île Saint-Louis)
              let iMinLat = Infinity;
              let iMaxLat = -Infinity;
              let iMinLng = Infinity;
              let iMaxLng = -Infinity;
              for (const p of geoPts) {
                if (p.lat < iMinLat) iMinLat = p.lat;
                if (p.lat > iMaxLat) iMaxLat = p.lat;
                if (p.lng < iMinLng) iMinLng = p.lng;
                if (p.lng > iMaxLng) iMaxLng = p.lng;
              }
              const spanMeters = Math.hypot(
                (iMaxLat - iMinLat) * 110540,
                (iMaxLng - iMinLng) * 111320 * cosLat
              );
              if (spanMeters < 22) continue;

              const simplifiedIsland = simplifyRing(geoPts, 64, true);
              waterBucket.push({
                dist: minDistanceMetersToPlayer(simplifiedIsland, lat, lng),
                feat: {
                  id: `vt_isl_${seq++}`,
                  kind: 'island',
                  isPolygon: true,
                  name: 'Île',
                  points: simplifiedIsland,
                },
              });
              continue;
            }

            if (r > 0 && signedArea <= 0) continue;

            const simplified = simplifyRing(geoPts, 84, true);
            waterBucket.push({
              dist: minDistanceMetersToPlayer(simplified, lat, lng),
              feat: {
                id: `vt_wt_${seq++}`,
                kind: 'water',
                isPolygon: true,
                name: waterName || 'Étendue d’eau',
                points: simplified,
              },
            });
          }
        } else if (feat.type === 2) {
          const geom = feat.loadGeometry();
          const wwRank: 'river' | 'canal' | 'stream' =
            rawKind === 'river' || detailKind === 'river'
              ? 'river'
              : rawKind === 'canal' || detailKind === 'canal'
              ? 'canal'
              : 'stream';
          for (const line of geom) {
            if (line.length < 2) continue;
            const geoPts = line.map((pt) => tilePixelToLatLng(tx, ty, z, pt.x, pt.y, extent));
            if (!bboxIntersects(geoPts, minLat, maxLat, minLng, maxLng)) continue;

            const simplified = simplifyRing(geoPts, 64, false);
            waterBucket.push({
              dist: minDistanceMetersToPlayer(simplified, lat, lng),
              feat: {
                id: `vt_ww_${seq++}`,
                kind: 'waterway',
                isPolygon: false,
                name:
                  waterName ||
                  (wwRank === 'river' ? 'Rivière' : wwRank === 'canal' ? 'Canal' : 'Ruisseau'),
                points: simplified,
                waterwayRank: wwRank,
              },
            });
          }
        }
      }
    }

    // C. ROADS, STREETS, AVENUES, REAL STEPS, PIERS, TYPED BRIDGES & RAILWAYS
    for (const layerName of ['roads', 'transportation']) {
      const layer = vt.layers[layerName];
      if (!layer) continue;
      const extent = layer.extent || 4096;

      for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i);
        if (feat.type !== 2 && feat.type !== 3) continue;
        const props = feat.properties || {};

        const rawKind = String(props.kind || props['pmap:kind'] || props.class || '').toLowerCase();
        const detail = String(props.kind_detail || props.subclass || '').toLowerCase();
        if (rawKind === 'ferry' || rawKind === 'aerialway') continue;
        if (detail === 'crossing') continue;

        const isSubwayLine = detail === 'subway' || rawKind === 'subway';
        const isTunnelWay = props.is_tunnel === true || props.brunnel === 'tunnel';
        if (isSubwayLine || isTunnelWay || detail === 'corridor') {
          if (feat.type === 2) {
            const geom = feat.loadGeometry();
            const isRailOrMetro = isSubwayLine || rawKind === 'rail' || rawKind === 'transit';
            const subName = String(props['name:fr'] || props.name || '').trim();
            for (const line of geom) {
              if (line.length < 2) continue;
              const geoPts = line.map((pt) => tilePixelToLatLng(tx, ty, z, pt.x, pt.y, extent));
              if (!bboxIntersects(geoPts, minLat, maxLat, minLng, maxLng)) continue;
              const simplified = simplifyRing(geoPts, 48, false);
              subterraneanBucket.push({
                dist: minDistanceMetersToPlayer(simplified, lat, lng),
                feat: {
                  id: `vt_subt_${seq++}`,
                  kind: isRailOrMetro ? 'subway' : 'tunnel_road',
                  isLine: true,
                  name:
                    subName ||
                    (isSubwayLine
                      ? 'Galerie de métro'
                      : isRailOrMetro
                      ? 'Tunnel ferroviaire'
                      : 'Passage ou tunnel souterrain'),
                  points: simplified,
                  source: 'OpenStreetMap (Z15)',
                },
              });
            }
          }
          continue;
        }

        if (rawKind === 'pier' || detail === 'pier') {
          const geom = feat.loadGeometry();
          for (const ring of geom) {
            if (ring.length < 2) continue;
            const geoPts = ring.map((pt) => tilePixelToLatLng(tx, ty, z, pt.x, pt.y, extent));
            if (!bboxIntersects(geoPts, minLat, maxLat, minLng, maxLng)) continue;
            const isPoly = feat.type === 3 && ring.length >= 4;
            const simplified = simplifyRing(geoPts, 36, isPoly);
            pathRailBucket.push({
              dist: minDistanceMetersToPlayer(simplified, lat, lng),
              feat: {
                id: `vt_pr2_${seq++}`,
                kind: 'pier',
                isPolygon: isPoly,
                name: String(props['name:fr'] || props.name || 'Jetée'),
                points: simplified,
              },
            });
          }
          continue;
        }

        if (feat.type !== 2) continue;

        const isBridge = props.is_bridge === true || props.brunnel === 'bridge';
        const isRail = rawKind === 'rail' || rawKind === 'transit';
        const isSteps = rawKind === 'steps' || detail === 'steps';
        const isMajor =
          rawKind === 'highway' ||
          rawKind === 'major_road' ||
          rawKind === 'medium_road' ||
          /^(motorway|trunk|primary|secondary|tertiary)$/.test(rawKind) ||
          /^(motorway|trunk|primary|secondary|tertiary)$/.test(detail);
        const isMinor =
          rawKind === 'minor_road' ||
          rawKind === 'other' ||
          /^(minor|street|residential|living_street|service|unclassified|pedestrian|road|alley)$/.test(
            rawKind
          ) ||
          /^(residential|living_street|pedestrian|service|unclassified|alley)$/.test(detail);
        const isPath =
          rawKind === 'path' ||
          rawKind === 'track' ||
          /^(path|footway|cycleway|bridleway|track)$/.test(detail);

        let roadKind: TerrainKind | null = null;
        let bridgeMode: BridgeMode | undefined;

        if (isBridge) {
          if (isRail && detail === 'subway') continue;
          roadKind = 'bridge';
          bridgeMode = isRail
            ? 'rail'
            : isPath || isSteps
            ? 'path'
            : isMinor && !isMajor
            ? 'minor'
            : 'road';
        } else if (isRail) {
          if (detail === 'subway') continue;
          roadKind = 'rail';
        } else if (isSteps) {
          roadKind = 'steps';
        } else if (isMajor) {
          roadKind = 'major_road';
        } else if (isMinor) {
          roadKind = 'minor_road';
        } else if (isPath) {
          roadKind = 'path';
        }

        if (!roadKind) continue;

        const isTinyServiceAlley =
          !isBridge &&
          roadKind === 'minor_road' &&
          /^(service|alley)$/.test(detail || rawKind);

        const geom = feat.loadGeometry();
        for (const line of geom) {
          if (line.length < 2) continue;
          const geoPts = line.map((pt) => tilePixelToLatLng(tx, ty, z, pt.x, pt.y, extent));
          if (!bboxIntersects(geoPts, minLat, maxLat, minLng, maxLng)) continue;

          const simplified = simplifyRing(geoPts, 52, false);
          const dist = minDistanceMetersToPlayer(simplified, lat, lng);
          if (isTinyServiceAlley && dist > 380) continue;

          const roadName = String(props['name:fr'] || props.name || '');
          const roadPrio =
            roadKind === 'bridge'
              ? 0
              : roadKind === 'major_road'
              ? 1
              : roadName.length > 0
              ? 2
              : 3;

          const entry = {
            dist,
            roadPrio,
            feat: {
              id: `vt_rd_${seq++}`,
              kind: roadKind,
              isPolygon: false,
              name: roadName,
              points: simplified,
              ...(bridgeMode ? { bridgeMode } : {}),
            },
          };

          if (roadKind === 'major_road' || roadKind === 'minor_road' || roadKind === 'bridge') {
            roadBucket.push(entry);
          } else {
            pathRailBucket.push({ dist, feat: entry.feat });
          }
        }
      }
    }

    // D. REAL BUILDING FOOTPRINTS & ARCHITECTURAL LANDMARK CLASSIFICATION
    for (const layerName of ['buildings', 'building']) {
      const layer = vt.layers[layerName];
      if (!layer) continue;
      const extent = layer.extent || 4096;

      for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i);
        if (feat.type !== 3) continue;
        const props = (feat.properties || {}) as Record<string, unknown>;
        const bName = String(props['name:fr'] || props.name || '').trim();
        const landmark = classifyBuildingLandmark(props, bName);

        const geom = feat.loadGeometry();
        const ring = geom[0];
        if (!ring || ring.length < 4) continue;

        const p0 = tilePixelToLatLng(tx, ty, z, ring[0].x, ring[0].y, extent);
        if (Math.abs(p0.lat - lat) > bLat || Math.abs(p0.lng - lng) > bLng) {
          continue;
        }

        const geoPts = ring.map((pt) => tilePixelToLatLng(tx, ty, z, pt.x, pt.y, extent));
        let minBLat = Infinity;
        let maxBLat = -Infinity;
        let minBLng = Infinity;
        let maxBLng = -Infinity;
        for (const gp of geoPts) {
          if (gp.lat < minBLat) minBLat = gp.lat;
          if (gp.lat > maxBLat) maxBLat = gp.lat;
          if (gp.lng < minBLng) minBLng = gp.lng;
          if (gp.lng > maxBLng) maxBLng = gp.lng;
        }
        const cLat = (minBLat + maxBLat) * 0.5;
        const cLng = (minBLng + maxBLng) * 0.5;
        const spanM = Math.hypot(
          (maxBLng - minBLng) * 111320 * cosLat,
          (maxBLat - minBLat) * 110540
        );
        const dist = haversineMeters(lat, lng, cLat, cLng);
        const cellX = Math.floor(((cLng - lng) * 111320 * cosLat) / 55);
        const cellY = Math.floor(((cLat - lat) * 110540) / 55);
        const arch = classifyBuildingArchetype(props, bName);

        buildingBucket.push({
          dist,
          priority: landmark ? 0 : 1,
          spanM,
          cellKey: `${cellX}_${cellY}`,
          feat: {
            id: `vt_bd_${seq++}`,
            kind: 'building',
            isPolygon: true,
            name: bName,
            points: simplifyRing(geoPts, landmark ? 24 : dist <= 360 ? 16 : 10, true),
            ...(landmark ? { landmark } : {}),
            ...(arch.bldgClass ? { bldgClass: arch.bldgClass } : {}),
            ...(arch.levels ? { levels: arch.levels } : {}),
          },
        });
      }
    }

    // E. LOCAL HERITAGE, NATURE & WATER POIS FROM VECTOR TILE
    for (const layerName of ['pois', 'poi']) {
      const layer = vt.layers[layerName];
      if (!layer) continue;
      const extent = layer.extent || 4096;

      for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i);
        if (feat.type !== 1) continue;
        const props = feat.properties || {};
        const kind = String(props.kind || props.subclass || props.class || '').toLowerCase();
        const rawName = String(props['name:fr'] || props.name || '').trim();

        let poiMeta: {
          category: CategoryKey;
          subType: string;
          mysteryTitle: string;
          xp: number;
        } | null = null;

        if (/^(castle|fort|fortress|city_gate|monument|memorial|archaeological_site|battlefield|museum|place_of_worship)$/.test(kind)) {
          if (!rawName) continue;
          poiMeta = {
            category: 'histoire',
            subType:
              kind === 'place_of_worship'
                ? 'Édifice sacré & patrimoine'
                : kind === 'museum'
                ? 'Lieu de mémoire & collections'
                : 'Monument ou vestige patrimonial',
            mysteryTitle: 'Sceau Patrimonial',
            xp: 110,
          };
        } else if (/^(ruins|quarry|mine|bunker|cave_entrance|cemetery)$/.test(kind)) {
          if (!rawName && kind === 'cemetery') continue;
          poiMeta = {
            category: 'etrange',
            subType: kind === 'cemetery' ? 'Nécropole / cimetière ancien' : 'Ruine ou cavité recensée',
            mysteryTitle: 'Silhouette Silencieuse',
            xp: 125,
          };
        } else if (/^(fountain|spring|waterfall|peak|viewpoint|watermill|windmill|rock)$/.test(kind)) {
          if (!rawName && kind === 'viewpoint') continue;
          poiMeta = {
            category: 'geographie',
            subType:
              kind === 'fountain' || kind === 'spring'
                ? 'Fontaine ou source'
                : kind === 'watermill' || kind === 'windmill'
                ? 'Moulin historique'
                : 'Belvédère & relief',
            mysteryTitle: 'Murmure de Source',
            xp: 110,
          };
        } else if (/^(tree|nature_reserve|garden)$/.test(kind)) {
          if (!rawName) continue;
          poiMeta = {
            category: 'ecosysteme',
            subType: kind === 'tree' ? 'Arbre remarquable' : 'Jardin ou réserve',
            mysteryTitle: 'Gardien Végétal',
            xp: 105,
          };
        }

        if (/^(subway_entrance|cave_entrance|quarry|mine|bunker)$/.test(kind)) {
          const geomSub = feat.loadGeometry();
          const ptSub = geomSub[0]?.[0];
          if (ptSub) {
            const posSub = tilePixelToLatLng(tx, ty, z, ptSub.x, ptSub.y, extent);
            const distSub = haversineMeters(lat, lng, posSub.lat, posSub.lng);
            if (distSub <= 1550) {
              const subKind: SubterraneanKind =
                kind === 'subway_entrance'
                  ? 'portal'
                  : kind === 'cave_entrance'
                  ? 'natural_cave'
                  : kind === 'quarry'
                  ? 'quarry'
                  : kind === 'mine'
                  ? 'mine'
                  : 'military';
              subterraneanBucket.push({
                dist: distSub,
                feat: {
                  id: `vt_subp_${tx}_${ty}_${i}`,
                  kind: subKind,
                  name:
                    rawName ||
                    (kind === 'subway_entrance'
                      ? 'Accès souterrain'
                      : kind === 'cave_entrance'
                      ? 'Porche de grotte'
                      : kind === 'quarry'
                      ? 'Carrière'
                      : kind === 'mine'
                      ? 'Galerie minière'
                      : 'Casemate / abri'),
                  points: [{ lat: posSub.lat, lng: posSub.lng }],
                  source: 'OpenStreetMap (Z15)',
                },
              });
            }
          }
        }

        if (!poiMeta) continue;
        const geom = feat.loadGeometry();
        const pt = geom[0]?.[0];
        if (!pt) continue;
        const pos = tilePixelToLatLng(tx, ty, z, pt.x, pt.y, extent);
        if (haversineMeters(lat, lng, pos.lat, pos.lng) > 1500) continue;

        const finalName = rawName || poiMeta.subType;
        const dedupeKey = `${finalName.toLowerCase()}_${pos.lat.toFixed(3)}_${pos.lng.toFixed(3)}`;
        if (seenPoiKeys.has(dedupeKey)) continue;
        seenPoiKeys.add(dedupeKey);

        const strat = inferStratumFromYearOrText(null, `${finalName} ${kind}`, poiMeta.category);
        pois.push({
          id: sanitizeId(`vt_poi_${tx}_${ty}_${i}`),
          name: finalName.slice(0, 180),
          mysteryTitle: poiMeta.mysteryTitle,
          category: poiMeta.category,
          subType: poiMeta.subType,
          stratum: strat.stratum,
          eraLabel: strat.eraLabel,
          source: 'Topologie OpenStreetMap',
          lat: pos.lat,
          lng: pos.lng,
          summary: `[${strat.eraLabel}] ${finalName} — ${poiMeta.subType.toLowerCase()} repéré dans la trame topographique locale OpenStreetMap.`,
          nearWaterway: false,
          waterwayName: '',
          safetyNotice: '',
          externalUrl: `https://www.openstreetmap.org/#map=17/${pos.lat}/${pos.lng}`,
          xpReward: poiMeta.xp,
          unlockRadiusMeters: 85,
          relatedPoiIds: [],
          relatedPoiTitles: [],
        });
      }
    }
  }

  waterBucket.sort((a, b) => a.dist - b.dist);
  greenBucket.sort((a, b) => a.dist - b.dist);
  urbanGroundBucket.sort((a, b) => a.dist - b.dist);
  roadBucket.sort((a, b) =>
    a.roadPrio !== b.roadPrio ? a.roadPrio - b.roadPrio : a.dist - b.dist
  );
  pathRailBucket.sort((a, b) => a.dist - b.dist);
  subterraneanBucket.sort((a, b) => a.dist - b.dist);

  // Spatially stratify buildings so wide 0.8x / 0.5x urban zooms preserve building blocks everywhere
  // while keeping 100% fine detail in the immediate neighborhood around the explorer!
  const selectedBuildings: TerrainFeature[] = [];
  const nearBuildings: typeof buildingBucket = [];
  const outerCellMap = new Map<string, typeof buildingBucket>();

  for (const b of buildingBucket) {
    if (b.priority === 0) {
      selectedBuildings.push(b.feat);
    } else if (b.dist <= 330) {
      nearBuildings.push(b);
    } else {
      let arr = outerCellMap.get(b.cellKey);
      if (!arr) {
        arr = [];
        outerCellMap.set(b.cellKey, arr);
      }
      arr.push(b);
    }
  }

  nearBuildings.sort((a, b) => a.dist - b.dist);
  for (const nb of nearBuildings.slice(0, 950)) {
    selectedBuildings.push(nb.feat);
  }

  // Sort each 55m x 55m outer urban cell by largest building footprint first, then round-robin across all cells
  const outerCells = Array.from(outerCellMap.values());
  for (const cellArr of outerCells) {
    cellArr.sort((a, b) => b.spanM - a.spanM);
  }
  outerCells.sort((a, b) => a[0].dist - b[0].dist);

  const MAX_TOTAL_BUILDINGS = 2500;
  for (let round = 0; round < 5 && selectedBuildings.length < MAX_TOTAL_BUILDINGS; round++) {
    for (const cellArr of outerCells) {
      if (round < cellArr.length) {
        selectedBuildings.push(cellArr[round].feat);
        if (selectedBuildings.length >= MAX_TOTAL_BUILDINGS) break;
      }
    }
  }

  const combinedTerrain: TerrainFeature[] = [
    ...urbanGroundBucket.slice(0, 240).map((x) => x.feat),
    ...greenBucket.slice(0, 340).map((x) => x.feat),
    ...waterBucket.slice(0, 240).map((x) => x.feat),
    ...pathRailBucket.slice(0, 300).map((x) => x.feat),
    ...roadBucket.slice(0, 920).map((x) => x.feat),
    ...selectedBuildings,
  ];

  return {
    terrain: combinedTerrain,
    pois: pois.slice(0, 18),
    subterranean: subterraneanBucket.slice(0, 140).map((x) => x.feat),
  };
}

function classifyEncyclopedicText(
  title: string,
  textRaw: string,
  hasMerimee = false
): { category: CategoryKey; subType: string; mysteryTitle: string; xpReward: number } {
  const text = `${title} ${textRaw}`.toLowerCase();
  if (
    /légende|folklore|fantôme|hanté|diable|fée|miracul|mythe|mystère|trésor|station fantôme|insolite|sorci|alchimie|templier/.test(
      text
    )
  ) {
    return {
      category: 'legende',
      subType: 'Légende urbaine / rurale & insolite',
      mysteryTitle: 'Rumeur Énigmatique',
      xpReward: 150,
    };
  }
  if (/grotte|souterrain|catacombe|carrière|ruine|friche|abandonn|crypte|bunker|abri|tunnel/.test(text)) {
    return {
      category: 'etrange',
      subType: 'Souterrain, ruine ou vestige caché',
      mysteryTitle: 'Passage Oublié',
      xpReward: 135,
    };
  }
  if (/dolmen|menhir|mégalith|tumulus|cromlech/.test(text)) {
    return {
      category: 'legende',
      subType: 'Mégalithe & tradition ancienne',
      mysteryTitle: 'Monolithe Ancien',
      xpReward: 140,
    };
  }
  if (/géolog|falaise|gouffre|source|fontaine|rivière|fleuve|cascade|sommet|colline|vallée|rocher|île/.test(text)) {
    return {
      category: 'geographie',
      subType: 'Particularité géologique ou hydrologique',
      mysteryTitle: 'Singularité du Relief',
      xpReward: 115,
    };
  }
  if (/réserve naturelle|jardin botanique|parc naturel|faune|flore|biodiversité|arbre remarquable/.test(text)) {
    return {
      category: 'ecosysteme',
      subType: 'Sanctuaire écologique',
      mysteryTitle: 'Refuge Naturel',
      xpReward: 115,
    };
  }
  return {
    category: 'histoire',
    subType: hasMerimee ? 'Monument Historique (Mérimée)' : 'Strate historique & événement',
    mysteryTitle: hasMerimee ? 'Sceau Patrimonial' : 'Chronique d’Époque',
    xpReward: hasMerimee ? 130 : 110,
  };
}

// 2. Connector: Wikipedia FR Standard GeoSearch
async function queryWikipediaFr(lat: number, lng: number, radius: number): Promise<RawPoi[]> {
  const gsRadius = Math.min(Math.max(radius * 2, 2600), 10000);
  const url = `https://fr.wikipedia.org/w/api.php?action=query&generator=geosearch&ggscoord=${encodeURIComponent(
    `${lat}|${lng}`
  )}&ggsradius=${gsRadius}&ggslimit=16&prop=${encodeURIComponent(
    'coordinates|extracts|info'
  )}&inprop=url&exintro=1&explaintext=1&exlimit=max&exchars=950&format=json`;

  try {
    const resp = await fetchWithTimeout(url, {}, 5500);
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            pageid: number;
            title: string;
            extract?: string;
            fullurl?: string;
            coordinates?: Array<{ lat: number; lon: number }>;
          }
        >;
      };
    };

    const pages = data.query?.pages ? Object.values(data.query.pages) : [];
    const results: RawPoi[] = [];

    for (const page of pages) {
      const coord = page.coordinates?.[0];
      if (!coord || !page.title) continue;
      const extract = (page.extract || '').trim();
      if (extract.length < 30) continue;
      const cls = classifyEncyclopedicText(page.title, extract, false);
      const yearMatch = extract.match(/\b(1\d{3}|20\d{2}|[4-9]\d{2})\b/);
      const parsedYear = yearMatch ? Number(yearMatch[1]) : null;
      const strat = inferStratumFromYearOrText(parsedYear, `${page.title} ${extract}`, cls.category);

      results.push({
        id: sanitizeId(`wiki_fr_${page.pageid}`),
        name: page.title.slice(0, 180),
        mysteryTitle: cls.mysteryTitle,
        category: cls.category,
        subType: cls.subType,
        stratum: strat.stratum,
        eraLabel: strat.eraLabel,
        source: 'Wikipédia',
        lat: coord.lat,
        lng: coord.lon,
        summary: extract.slice(0, 2200),
        nearWaterway: false,
        waterwayName: '',
        safetyNotice: '',
        externalUrl: page.fullurl || `https://fr.wikipedia.org/?curid=${page.pageid}`,
        xpReward: cls.xpReward,
        unlockRadiusMeters: 90,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
    }
    return results;
  } catch {
    return [];
  }
}

// 3. Connector: Wikipedia CirrusSearch — Local Legends, Urban Myths, Ghost Places, Underground & Curiosities
async function queryFolkloreAndLegends(lat: number, lng: number): Promise<RawPoi[]> {
  const searchExpr = `nearcoord:15km,${lat},${lng} (légende OR folklore OR fantôme OR mystère OR insolite OR souterrain OR catacombes OR dolmen OR menhir OR fée OR diable OR ruine OR carrière OR grotte)`;
  const url = `https://fr.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    searchExpr
  )}&gsrlimit=12&prop=${encodeURIComponent(
    'coordinates|extracts|info'
  )}&inprop=url&exintro=1&explaintext=1&exlimit=max&exchars=950&format=json`;

  try {
    const resp = await fetchWithTimeout(url, {}, 5500);
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            pageid: number;
            title: string;
            extract?: string;
            fullurl?: string;
            coordinates?: Array<{ lat: number; lon: number }>;
          }
        >;
      };
    };

    const pages = data.query?.pages ? Object.values(data.query.pages) : [];
    const out: RawPoi[] = [];

    for (const page of pages) {
      const coord = page.coordinates?.[0];
      if (!coord || !page.title) continue;
      if (haversineMeters(lat, lng, coord.lat, coord.lon) > 8500) continue;

      const extract = (page.extract || '').trim();
      if (extract.length < 25) continue;

      const cls = classifyEncyclopedicText(page.title, extract, false);
      const finalCat: CategoryKey = cls.category === 'histoire' ? 'legende' : cls.category;
      const finalSub =
        finalCat === 'legende' ? 'Légende locale, curiosité ou lieu insolite' : cls.subType;
      const strat = inferStratumFromYearOrText(null, `${page.title} ${extract}`, finalCat);

      out.push({
        id: sanitizeId(`folk_${page.pageid}`),
        name: page.title.slice(0, 180),
        mysteryTitle: finalCat === 'legende' ? 'Murmure de Légende' : 'Entrée Dissimulée',
        category: finalCat,
        subType: finalSub,
        stratum: strat.stratum,
        eraLabel: strat.eraLabel,
        source: 'Chroniques & Folklore (WP)',
        lat: coord.lat,
        lng: coord.lon,
        summary: extract.slice(0, 2200),
        nearWaterway: false,
        waterwayName: '',
        safetyNotice:
          finalCat === 'etrange'
            ? 'Certains lieux souterrains ou abandonnés sont interdits d’accès : observez-les depuis la voie publique.'
            : '',
        externalUrl: page.fullurl || `https://fr.wikipedia.org/?curid=${page.pageid}`,
        xpReward: 155,
        unlockRadiusMeters: 95,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
    }
    return out;
  } catch {
    return [];
  }
}

// 4. Connector: Wikidata SPARQL (Historical Strata via P571 Inception + Base Mérimée P380 + Waterways P206)
async function queryWikidataSparql(lat: number, lng: number, radius: number): Promise<RawPoi[]> {
  const radiusKm = Math.min(Math.max(radius / 1000, 1.8), 4.5).toFixed(1);
  const sparql = `
SELECT DISTINCT ?place ?placeLabel ?placeDescription ?coord ?waterLabel ?inception ?merimee WHERE {
  SERVICE wikibase:around {
    ?place wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${radiusKm}" .
  }
  OPTIONAL { ?place wdt:P206 ?water . }
  OPTIONAL { ?place wdt:P571 ?inception . }
  OPTIONAL { ?place wdt:P380 ?merimee . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}
LIMIT 28
`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  try {
    const resp = await fetchWithTimeout(
      url,
      { headers: { Accept: 'application/sparql-results+json' } },
      4800
    );
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      results?: {
        bindings?: Array<{
          place?: { value: string };
          placeLabel?: { value: string };
          placeDescription?: { value: string };
          coord?: { value: string };
          waterLabel?: { value: string };
          inception?: { value: string };
          merimee?: { value: string };
        }>;
      };
    };

    const bindings = data.results?.bindings || [];
    const out: RawPoi[] = [];
    const seenQ = new Set<string>();

    for (const b of bindings) {
      const uri = b.place?.value || '';
      const qid = uri.split('/').pop() || '';
      if (!qid || seenQ.has(qid)) continue;
      seenQ.add(qid);

      const label = b.placeLabel?.value || '';
      if (!label || /^Q\d+$/.test(label)) continue;

      const m = (b.coord?.value || '').match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
      if (!m) continue;
      const pLng = Number(m[1]);
      const pLat = Number(m[2]);
      if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) continue;

      const desc = b.placeDescription?.value || 'Lieu répertorié dans le graphe patrimonial Wikidata.';
      const merimeeCode = b.merimee?.value || '';
      const inceptionRaw = b.inception?.value || '';
      const yearMatch = inceptionRaw.match(/^(-?\d{1,4})/);
      const inceptionYear = yearMatch ? Number(yearMatch[1]) : null;

      const cls = classifyEncyclopedicText(label, desc, Boolean(merimeeCode));
      const strat = inferStratumFromYearOrText(inceptionYear, `${label} ${desc}`, cls.category);
      const waterName =
        b.waterLabel?.value && !/^Q\d+$/.test(b.waterLabel.value) ? b.waterLabel.value : '';

      const merimeeNote = merimeeCode
        ? ` Classé/inscrit aux Monuments Historiques français (notice Base Mérimée ${merimeeCode}).`
        : '';

      out.push({
        id: sanitizeId(`wd_${qid}`),
        name: label.slice(0, 180),
        mysteryTitle: cls.mysteryTitle,
        category: cls.category,
        subType: cls.subType,
        stratum: strat.stratum,
        eraLabel: strat.eraLabel,
        source: merimeeCode ? 'Wikidata · Base Mérimée' : 'Wikidata',
        lat: pLat,
        lng: pLng,
        summary: `[${strat.eraLabel}] ${desc.charAt(0).toUpperCase()}${desc.slice(1)}.${merimeeNote}`.slice(
          0,
          2200
        ),
        nearWaterway: Boolean(waterName),
        waterwayName: waterName.slice(0, 120),
        safetyNotice: cls.category === 'etrange' ? 'Observez le site depuis les accès publics.' : '',
        externalUrl: merimeeCode
          ? `https://pop.culture.gouv.fr/notice/merimee/${merimeeCode}`
          : uri,
        xpReward: cls.xpReward,
        unlockRadiusMeters: 90,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
    }
    return out;
  } catch {
    return [];
  }
}

// 5. Connector: Macrostrat Geological Bedrock & Deep-Time Strata
function translateLithology(raw: string): string {
  return raw
    .replace(/limestone/gi, 'calcaire')
    .replace(/sandstone/gi, 'grès')
    .replace(/clay/gi, 'argile')
    .replace(/shale/gi, 'schiste argileux')
    .replace(/sand/gi, 'sables')
    .replace(/gravel/gi, 'alluvions et graviers')
    .replace(/granite/gi, 'granite')
    .replace(/gneiss/gi, 'gneiss')
    .replace(/chalk/gi, 'craie')
    .replace(/marl/gi, 'marne')
    .replace(/dolomite/gi, 'dolomie')
    .replace(/basalt/gi, 'basalte')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function queryMacrostratGeology(
  lat: number,
  lng: number
): Promise<{ bedrock: BedrockInfo | null; geoPois: RawPoi[] }> {
  const cellLat = Math.round(lat * 50) / 50;
  const cellLng = Math.round(lng * 50) / 50;
  const gKey = `${cellLat.toFixed(2)}_${cellLng.toFixed(2)}`;
  const hit = geologyCache.get(gKey);
  if (hit) return hit.data;

  const url = `https://macrostrat.org/api/v2/geologic_units/map?lat=${cellLat}&lng=${cellLng}&response=long`;
  try {
    const resp = await fetchWithTimeout(url, {}, 4800);
    if (!resp.ok) return { bedrock: null, geoPois: [] };
    const json = (await resp.json()) as {
      success?: {
        data?: Array<{
          map_id: number;
          name?: string;
          strat_name_long?: string;
          lith?: string;
          descrip?: string;
          comments?: string;
          best_int_name?: string;
          t_age?: number;
          b_age?: number;
        }>;
      };
    };

    const units = json.success?.data || [];
    if (units.length === 0) return { bedrock: null, geoPois: [] };

    const deepUnit = units.find((u) => (u.b_age || 0) > 0.05) || units[0];
    const period = deepUnit.best_int_name || 'Quaternaire / Cénozoïque';
    const bAge = Number(deepUnit.b_age || 0);
    const tAge = Number(deepUnit.t_age || 0);
    const ageRangeMa =
      bAge > 0.1
        ? `-${bAge.toFixed(1)} à -${tAge.toFixed(1)} Ma`
        : 'Holocène (-11 700 ans à nos jours)';
    const lithFr = translateLithology(deepUnit.lith || 'roches sédimentaires');
    const env = deepUnit.descrip || deepUnit.comments || 'Bassin sédimentaire et socle continental';

    const bedrock: BedrockInfo = {
      period,
      ageRangeMa,
      lithology: lithFr || 'Substrat minéral',
      environment: env,
    };

    // Anchor Macrostrat outcrop coordinates to the deterministic 0.02° world cell so it never shifts while walking
    const offsetLat = cellLat + 0.00042;
    const offsetLng = cellLng + 0.00052;
    const eraLabel = `${period} (${ageRangeMa})`;

    const geoPoi: RawPoi = {
      id: sanitizeId(`macrostrat_${deepUnit.map_id}_${gKey}`),
      name: deepUnit.name || deepUnit.strat_name_long || `Affleurement du ${period}`,
      mysteryTitle: 'Veine Géologique',
      category: 'geographie',
      subType: 'Strate géologique & lithologie',
      stratum: 'temps_profond',
      eraLabel,
      source: 'Macrostrat Géologie',
      lat: offsetLat,
      lng: offsetLng,
      summary: `Couche géologique profonde sous ce territoire : datée du ${period} (${ageRangeMa}). Composition lithologique dominante : ${
        lithFr || 'roches stratifiées'
      }. Contexte paléo-environnemental : ${env}.`,
      nearWaterway: false,
      waterwayName: '',
      safetyNotice: '',
      externalUrl: `https://macrostrat.org/map/#/z=13/x=${cellLng.toFixed(4)}/y=${cellLat.toFixed(4)}/bedrock/lines/`,
      xpReward: 135,
      unlockRadiusMeters: 95,
      relatedPoiIds: [],
      relatedPoiTitles: [],
    };

    const result = { bedrock, geoPois: [geoPoi] };
    geologyCache.set(gKey, { expires: Date.now() + 60 * 60 * 1000, data: result });
    return result;
  } catch {
    return { bedrock: null, geoPois: [] };
  }
}

// 6. Connector: Paleobiology Database (Real Fossil Sites in Region)
async function queryPaleobioFossils(lat: number, lng: number): Promise<RawPoi[]> {
  const cellLat = Math.round(lat * 25) / 25;
  const cellLng = Math.round(lng * 25) / 25;
  const fKey = `${cellLat.toFixed(2)}_${cellLng.toFixed(2)}`;
  const hit = fossilCache.get(fKey);
  if (hit) return hit.data;

  const delta = 0.16;
  const url = `https://paleobiodb.org/data1.2/occs/list.json?lngmin=${(cellLng - delta).toFixed(
    3
  )}&lngmax=${(cellLng + delta).toFixed(3)}&latmin=${(cellLat - delta).toFixed(3)}&latmax=${(
    cellLat + delta
  ).toFixed(3)}&limit=6&show=coords,class,time`;

  try {
    const resp = await fetchWithTimeout(url, {}, 4800);
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      records?: Array<{
        oid: string;
        tna?: string;
        idn?: string;
        oei?: string;
        eag?: number;
        lag?: number;
        phl?: string;
        cll?: string;
        lat?: string | number;
        lng?: string | number;
      }>;
    };

    const records = data.records || [];
    const pois: RawPoi[] = [];
    const seenCoords = new Set<string>();

    for (const rec of records) {
      const fLat = Number(rec.lat);
      const fLng = Number(rec.lng);
      if (!Number.isFinite(fLat) || !Number.isFinite(fLng)) continue;
      if (haversineMeters(cellLat, cellLng, fLat, fLng) > 9500) continue;

      const key = `${fLat.toFixed(3)}_${fLng.toFixed(3)}`;
      if (seenCoords.has(key)) continue;
      seenCoords.add(key);

      const taxon = rec.tna || rec.idn || 'Fossile ancien';
      const interval = rec.oei || 'Ère préhistorique ancienne';
      const ageMa = rec.eag ? `-${rec.eag} millions d’années` : interval;

      pois.push({
        id: sanitizeId(`pbdb_${rec.oid}`),
        name: `Gisement fossile : ${taxon}`,
        mysteryTitle: 'Empreinte Fossile',
        category: 'geographie',
        subType: 'Site paléontologique (Fossiles)',
        stratum: 'temps_profond',
        eraLabel: `${interval} (${ageMa})`,
        source: 'Paleobiology DB',
        lat: fLat,
        lng: fLng,
        summary: `Découverte paléontologique répertoriée dans la Paleobiology Database : spécimen de ${taxon} (${
          rec.cll || rec.phl || 'organisme fossile'
        }), datant de l’étage ${interval} (${ageMa}). Témoin direct d’un ancien océan ou écosystème disparu.`,
        nearWaterway: false,
        waterwayName: '',
        safetyNotice: 'La collecte de fossiles peut être réglementée : privilégiez l’observation photographique.',
        externalUrl: `https://paleobiodb.org/classic/basicTaxonInfo?taxon_name=${encodeURIComponent(taxon)}`,
        xpReward: 155,
        unlockRadiusMeters: 105,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
    }
    fossilCache.set(fKey, { expires: Date.now() + 60 * 60 * 1000, data: pois });
    return pois;
  } catch {
    return [];
  }
}

// 7. Connectors: iNaturalist + GBIF / INPN Biodiversity
async function queryBiodiversity(lat: number, lng: number, radius: number): Promise<RawPoi[]> {
  const km = Math.max(1, Math.min(7, Math.round((radius / 1000) * 1.4)));
  const inatUrl = `https://api.inaturalist.org/v1/observations?lat=${lat}&lng=${lng}&radius=${km}&quality_grade=research&locale=fr&per_page=8&order_by=votes`;
  const d = 0.022;
  const gbifUrl = `https://api.gbif.org/v1/occurrence/search?decimalLatitude=${(lat - d).toFixed(
    4
  )},${(lat + d).toFixed(4)}&decimalLongitude=${(lng - d).toFixed(4)},${(lng + d).toFixed(
    4
  )}&hasCoordinate=true&limit=6`;

  const [inatRes, gbifRes] = await Promise.allSettled([
    fetchWithTimeout(inatUrl, {}, 5000).then((r) => (r.ok ? r.json() : null)),
    fetchWithTimeout(gbifUrl, {}, 4800).then((r) => (r.ok ? r.json() : null)),
  ]);

  const pois: RawPoi[] = [];
  const seenTaxa = new Set<string>();

  if (inatRes.status === 'fulfilled' && inatRes.value) {
    const obsList = (
      inatRes.value as {
        results?: Array<{
          id: number;
          geojson?: { coordinates?: [number, number] };
          observed_on?: string;
          uri?: string;
          taxon?: {
            name?: string;
            preferred_common_name?: string;
            threatened?: boolean;
            endemic?: boolean;
            wikipedia_summary?: string;
          };
        }>;
      }
    ).results || [];

    for (const obs of obsList) {
      const coords = obs.geojson?.coordinates;
      const taxon = obs.taxon;
      if (!coords || coords.length < 2 || !taxon) continue;
      const [oLng, oLat] = coords;
      const commonName = taxon.preferred_common_name || taxon.name || 'Espèce sauvage';
      const latin = taxon.name || commonName;
      if (seenTaxa.has(latin)) continue;
      seenTaxa.add(latin);

      const isProtected = Boolean(taxon.threatened || taxon.endemic);
      const cleanWiki = (taxon.wikipedia_summary || '').replace(/<[^>]+>/g, '').trim();

      pois.push({
        id: sanitizeId(`inat_${obs.id}`),
        name: commonName.slice(0, 180),
        mysteryTitle: isProtected ? 'Espèce Protégée ?' : 'Trace du Vivant',
        category: 'ecosysteme',
        subType: isProtected ? 'Espèce menacée / patrimoniale' : 'Faune & Flore sauvage',
        stratum: 'vivant_folklore',
        eraLabel: 'Biodiversité Actuelle',
        source: 'iNaturalist',
        lat: oLat,
        lng: oLng,
        summary: [
          `Observation naturaliste validée : ${commonName} (${latin}).`,
          isProtected ? 'Espèce sensible ou protégée dans cet habitat.' : '',
          cleanWiki,
        ]
          .filter(Boolean)
          .join(' ')
          .slice(0, 2200),
        nearWaterway: false,
        waterwayName: '',
        safetyNotice: 'Approche silencieuse : ne dérangez jamais un spécimen sauvage ou sa zone de nidification.',
        externalUrl: obs.uri || `https://www.inaturalist.org/observations/${obs.id}`,
        xpReward: isProtected ? 145 : 100,
        unlockRadiusMeters: 95,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
    }
  }

  if (gbifRes.status === 'fulfilled' && gbifRes.value) {
    const gbifList = (
      gbifRes.value as {
        results?: Array<{
          key: number;
          species?: string;
          scientificName?: string;
          vernacularName?: string;
          kingdom?: string;
          family?: string;
          decimalLatitude?: number;
          decimalLongitude?: number;
          datasetName?: string;
          iucnRedListCategory?: string;
        }>;
      }
    ).results || [];

    for (const rec of gbifList) {
      if (typeof rec.decimalLatitude !== 'number' || typeof rec.decimalLongitude !== 'number') continue;
      const species = rec.species || rec.scientificName || '';
      if (!species || seenTaxa.has(species)) continue;
      seenTaxa.add(species);

      const display = rec.vernacularName || species;
      const redList =
        rec.iucnRedListCategory && !['LC', 'NE'].includes(rec.iucnRedListCategory)
          ? ` (Statut UICN : ${rec.iucnRedListCategory})`
          : '';

      pois.push({
        id: sanitizeId(`gbif_${rec.key}`),
        name: display.slice(0, 180),
        mysteryTitle: 'Présence Biologique',
        category: 'ecosysteme',
        subType: `Inventaire scientifique (${rec.kingdom === 'Plantae' ? 'Flore' : 'Faune'})`,
        stratum: 'vivant_folklore',
        eraLabel: 'Inventaire Muséum / GBIF',
        source: 'GBIF · INPN',
        lat: rec.decimalLatitude,
        lng: rec.decimalLongitude,
        summary: `Occurrence biologique issue des inventaires scientifiques mondiaux GBIF / INPN : ${display} (${
          rec.scientificName || species
        }), famille des ${rec.family || 'espèces locales'}${redList}. ${
          rec.datasetName ? `Programme source : ${rec.datasetName.slice(0, 140)}.` : ''
        }`.slice(0, 2200),
        nearWaterway: false,
        waterwayName: '',
        safetyNotice: 'Respectez les biotopes fragiles lors de votre passage.',
        externalUrl: `https://www.gbif.org/occurrence/${rec.key}`,
        xpReward: redList ? 145 : 105,
        unlockRadiusMeters: 95,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
    }
  }

  return pois.slice(0, 12);
}

// ============================================================================
// 8. BASE MICRO-HISTOIRE & PLAQUES (osm-france-historic) + BRGM BSS EAU SOUTERRAINE (Hub'Eau)
// ============================================================================
async function queryMicroHistoryAndSubterranean(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<{ microHistory: RawPoi[]; subterraneanWater: RawPoi[] }> {
  const searchRadius = Math.min(Math.max(Math.round(radiusMeters * 1.15), 1100), 3200);
  const whereClause = `within_distance(meta_geo_point,geom'POINT(${lng} ${lat})',${searchRadius}m) AND (name IS NOT NULL OR inscription IS NOT NULL OR type IN ('archaeological_site','ruins','castle','bunker','mine','quarry','aqueduct','boundary_stone','lavoir','tomb','monument','wreck'))`;
  const odsUrl = `https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/osm-france-historic/records?where=${encodeURIComponent(
    whereClause
  )}&limit=22`;

  const dLat = Math.min(0.018, Math.max(0.008, radiusMeters / 110540));
  const cosLat = Math.max(0.15, Math.cos((lat * Math.PI) / 180));
  const dLng = dLat / cosLat;
  const bbox = `${(lng - dLng).toFixed(4)},${(lat - dLat).toFixed(4)},${(lng + dLng).toFixed(4)},${(
    lat + dLat
  ).toFixed(4)}`;
  const hubeauUrl = `https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/stations?bbox=${bbox}&size=8`;

  const [odsRes, hubRes] = await Promise.allSettled([
    fetchWithTimeout(odsUrl, {}, 3800).then((r) => (r.ok ? r.json() : null)),
    fetchWithTimeout(hubeauUrl, {}, 3600).then((r) => (r.ok ? r.json() : null)),
  ]);

  const microHistory: RawPoi[] = [];
  if (odsRes.status === 'fulfilled' && odsRes.value?.results) {
    const records = odsRes.value.results as Array<{
      type?: string | null;
      name?: string | null;
      build_date?: string | null;
      description?: string | null;
      inscription?: string | null;
      civilization?: string | null;
      heritage?: string | null;
      ref_mhs?: string | null;
      meta_name_com?: string | null;
      meta_geo_point?: { lon?: number; lat?: number };
      meta_osm_id?: string | null;
      meta_osm_url?: string | null;
      website?: string | null;
    }>;

    const TYPE_LABELS_FR: Record<string, string> = {
      memorial: 'Plaque commémorative & mémoire locale',
      archaeological_site: 'Site archéologique répertorié',
      ruins: 'Ruine historique',
      castle: 'Château ou maison forte',
      bunker: 'Casemate ou abri souterrain',
      mine: 'Ancienne mine ou galerie',
      quarry: 'Ancienne carrière d’extraction',
      aqueduct: 'Aqueduc ancien',
      boundary_stone: 'Borne historique d’Ancien Régime',
      lavoir: 'Lavoir traditionnel',
      wayside_cross: 'Croix ou calvaire de chemin',
      wayside_shrine: 'Oratoire de chemin',
      tomb: 'Sépulture ou tombeau remarquable',
      monument: 'Monument commémoratif',
      building: 'Édifice historique inscrit',
      industrial: 'Vestige d’industrie ancienne',
      manor: 'Manoir historique',
      fort: 'Ouvrage fortifié',
    };

    for (const rec of records) {
      const pt = rec.meta_geo_point;
      if (!pt || typeof pt.lat !== 'number' || typeof pt.lon !== 'number') continue;

      const rawType = (rec.type || 'historic').toLowerCase();
      const rawName = (rec.name || '').trim();
      const cleanInscription = (rec.inscription || '')
        .replace(/;/g, ' · ')
        .replace(/\s+/g, ' ')
        .trim();
      const cleanDesc = (rec.description || '').trim();

      if (!rawName && !cleanInscription && (rawType === 'memorial' || rawType === 'wayside_cross' || rawType === 'fountain')) {
        continue;
      }

      const typeFr = TYPE_LABELS_FR[rawType] || `Patrimoine local (${rawType})`;
      let displayTitle = rawName;
      if (!displayTitle) {
        if (cleanInscription) {
          const snippet = cleanInscription.split('·')[0].trim().slice(0, 58);
          displayTitle = `Plaque : « ${snippet}${snippet.length >= 58 ? '…' : ''} »`;
        } else {
          displayTitle = typeFr;
        }
      }

      const isSubterraneanOrEtrange = /bunker|mine|quarry|ruins|wreck|industrial|pillbox|tunnel/.test(rawType);
      const isLegendOrPrehist =
        /prehistoric|neolithic|megalith|celtic/i.test(rec.civilization || '') ||
        /légende|diable|fée|templier|mystère/i.test(`${displayTitle} ${cleanInscription}`);

      const category: CategoryKey = isLegendOrPrehist
        ? 'legende'
        : isSubterraneanOrEtrange
        ? 'etrange'
        : 'histoire';

      let parsedYear: number | null = null;
      if (rec.build_date) {
        const ym = rec.build_date.match(/(-?\d{3,4})/);
        if (ym) parsedYear = Number(ym[1]);
      }

      const strat = inferStratumFromYearOrText(
        parsedYear,
        `${displayTitle} ${cleanInscription} ${rec.civilization || ''} ${rawType}`,
        category
      );

      const parts: string[] = [];
      if (cleanDesc) parts.push(cleanDesc);
      if (cleanInscription) parts.push(`Inscription relevée sur place : « ${cleanInscription} ».`);
      if (rec.civilization) parts.push(`Culture / période associée : ${rec.civilization}.`);
      if (rec.build_date) parts.push(`Datation mentionnée : ${rec.build_date}.`);
      if (rec.ref_mhs) parts.push(`Référence Base Mérimée : ${rec.ref_mhs}.`);
      if (parts.length === 0) {
        parts.push(
          `${displayTitle} — ${typeFr.toLowerCase()} recensé dans l’inventaire collaboratif du patrimoine de France${
            rec.meta_name_com ? ` (${rec.meta_name_com})` : ''
          }.`
        );
      }

      microHistory.push({
        id: sanitizeId(`ods_hist_${rec.meta_osm_id || `${pt.lat}_${pt.lon}`}`),
        name: displayTitle.slice(0, 180),
        mysteryTitle: cleanInscription
          ? 'Inscription Murale'
          : isSubterraneanOrEtrange
          ? 'Vestige Caché'
          : 'Trace du Passé',
        category,
        subType: rec.ref_mhs ? `${typeFr} (Mérimée ${rec.ref_mhs})` : typeFr,
        stratum: strat.stratum,
        eraLabel: strat.eraLabel,
        source: 'Inventaire Micro-Histoire & Plaques',
        lat: pt.lat,
        lng: pt.lon,
        summary: parts.join(' ').slice(0, 2100),
        nearWaterway: rawType === 'lavoir' || rawType === 'aqueduct',
        waterwayName: '',
        safetyNotice: isSubterraneanOrEtrange
          ? 'Observez les casemates, anciennes mines ou ruines uniquement depuis les accès sécurisés.'
          : '',
        externalUrl:
          rec.website ||
          (rec.ref_mhs
            ? `https://pop.culture.gouv.fr/notice/merimee/${encodeURIComponent(rec.ref_mhs)}`
            : rec.meta_osm_url || `https://www.openstreetmap.org/#map=18/${pt.lat}/${pt.lon}`),
        xpReward: cleanInscription || rec.ref_mhs ? 135 : 115,
        unlockRadiusMeters: 80,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });

      if (microHistory.length >= 12) break;
    }
  }

  const subterraneanWater: RawPoi[] = [];
  if (hubRes.status === 'fulfilled' && hubRes.value?.data) {
    const stations = hubRes.value.data as Array<{
      bss_id?: string;
      code_bss?: string;
      urn_bss?: string;
      nom_commune?: string;
      x?: number;
      y?: number;
      profondeur_investigation?: number | null;
      altitude_station?: string | number | null;
      noms_masse_eau_edl?: string[] | string | null;
      date_debut_mesure?: string | null;
    }>;

    for (const st of stations) {
      if (typeof st.y !== 'number' || typeof st.x !== 'number') continue;
      const depth = st.profondeur_investigation ? `${Math.round(st.profondeur_investigation)} m` : 'profondeur variable';
      const aquiferRaw = Array.isArray(st.noms_masse_eau_edl)
        ? st.noms_masse_eau_edl[0]
        : st.noms_masse_eau_edl;
      const aquiferName = aquiferRaw ? String(aquiferRaw).trim() : 'Nappe phréatique locale';
      const bssCode = st.bss_id || st.code_bss || 'BSS';

      subterraneanWater.push({
        id: sanitizeId(`bss_eau_${bssCode}`),
        name: `Puits souterrain ${bssCode} (${aquiferName})`.slice(0, 180),
        mysteryTitle: 'Abîme Phréatique',
        category: 'etrange',
        subType: `Ouvrage souterrain & nappe (${depth})`,
        stratum: 'temps_profond',
        eraLabel: 'Hydrogéologie Souterraine',
        source: 'BRGM · Banque du Sous-Sol (Hub’Eau)',
        lat: st.y,
        lng: st.x,
        summary: `Forage ou puits d’observation hydrogéologique (${bssCode}) répertorié dans la Banque du Sous-Sol du BRGM à ${
          st.nom_commune || 'proximité'
        }. Sous vos pieds s’étend l’aquifère « ${aquiferName} », atteint ici à ${depth} sous la surface${
          st.date_debut_mesure ? ` (suivi depuis ${st.date_debut_mesure.slice(0, 4)})` : ''
        }.`,
        nearWaterway: true,
        waterwayName: aquiferName,
        safetyNotice: 'Ouvrage technique protégé : n’ouvrez jamais un capot de puits ou de piézomètre.',
        externalUrl: st.urn_bss || 'https://ades.eaufrance.fr/',
        xpReward: 130,
        unlockRadiusMeters: 90,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });

      if (subterraneanWater.length >= 4) break;
    }
  }

  return { microHistory, subterraneanWater };
}

// ============================================================================
// 9. IGN GÉOPLATEFORME (BD TOPO V3) — SOURCES, GROTTES, ROCHERS, VESTIGES & CROIX
// ============================================================================
function extractFirstCoordFromGeoJson(geom: unknown): { lat: number; lng: number } | null {
  if (!geom || typeof geom !== 'object') return null;
  const g = geom as { type?: string; coordinates?: unknown };
  if (g.type === 'Point' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
    return { lng: Number(g.coordinates[0]), lat: Number(g.coordinates[1]) };
  }
  if (g.type === 'MultiPoint' && Array.isArray(g.coordinates) && Array.isArray(g.coordinates[0])) {
    return { lng: Number(g.coordinates[0][0]), lat: Number(g.coordinates[0][1]) };
  }
  if (g.type === 'Polygon' && Array.isArray(g.coordinates) && Array.isArray(g.coordinates[0])) {
    const ring = g.coordinates[0] as number[][];
    if (ring.length > 0) {
      let sLng = 0;
      let sLat = 0;
      for (const pt of ring) {
        sLng += Number(pt[0]);
        sLat += Number(pt[1]);
      }
      return { lng: sLng / ring.length, lat: sLat / ring.length };
    }
  }
  if (
    g.type === 'MultiPolygon' &&
    Array.isArray(g.coordinates) &&
    Array.isArray(g.coordinates[0]) &&
    Array.isArray(g.coordinates[0][0])
  ) {
    const ring = g.coordinates[0][0] as number[][];
    if (ring.length > 0) {
      let sLng = 0;
      let sLat = 0;
      for (const pt of ring) {
        sLng += Number(pt[0]);
        sLat += Number(pt[1]);
      }
      return { lng: sLng / ring.length, lat: sLat / ring.length };
    }
  }
  return null;
}

async function queryIgnBdTopoLocalHeritage(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<RawPoi[]> {
  const dLat = Math.min(0.025, Math.max(0.011, radiusMeters / 110540));
  const cosLat = Math.max(0.15, Math.cos((lat * Math.PI) / 180));
  const dLng = dLat / cosLat;

  const minLng = (lng - dLng).toFixed(5);
  const minLat = (lat - dLat).toFixed(5);
  const maxLng = (lng + dLng).toFixed(5);
  const maxLat = (lat + dLat).toFixed(5);
  const bboxExpr = `BBOX(geometrie,${minLng},${minLat},${maxLng},${maxLat},'EPSG:4326')`;

  const buildWfsUrl = (typeName: string, extraCql: string, count: number) => {
    const cql = extraCql ? `${bboxExpr} AND ${extraCql}` : bboxExpr;
    return `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=${encodeURIComponent(
      typeName
    )}&CQL_FILTER=${encodeURIComponent(cql)}&COUNT=${count}&OUTPUTFORMAT=application/json`;
  };

  const [hydroRes, oroRes, zaiRes, cpRes] = await Promise.allSettled([
    fetchWithTimeout(buildWfsUrl('BDTOPO_V3:detail_hydrographique', '', 14), {}, 3600).then((r) =>
      r.ok ? r.json() : null
    ),
    fetchWithTimeout(buildWfsUrl('BDTOPO_V3:detail_orographique', '', 14), {}, 3600).then((r) =>
      r.ok ? r.json() : null
    ),
    fetchWithTimeout(
      buildWfsUrl('BDTOPO_V3:zone_d_activite_ou_d_interet', "categorie='Culture et loisirs'", 16),
      {},
      3600
    ).then((r) => (r.ok ? r.json() : null)),
    fetchWithTimeout(
      buildWfsUrl(
        'BDTOPO_V3:construction_ponctuelle',
        "nature IN ('Menhir','Dolmen','Ruine','Monument','Moulin à vent','Calvaire','Croix','Phare','Puits')",
        14
      ),
      {},
      3600
    ).then((r) => (r.ok ? r.json() : null)),
  ]);

  const pois: RawPoi[] = [];
  let unnamedHydroCount = 0;
  let unnamedOroCount = 0;
  let unnamedCrossCount = 0;

  // 1. Hydrographic details (Springs, Fountains, Waterfalls, Resurgences, Wells)
  if (hydroRes.status === 'fulfilled' && hydroRes.value?.features) {
    for (const f of hydroRes.value.features) {
      const p = f.properties || {};
      const nature = String(p.nature || '').trim();
      if (!/^(Fontaine|Source|Source captée|Cascade|Perte|Résurgence|Puits|Lavoir|Geyser)$/i.test(nature)) {
        continue;
      }
      const toponyme = String(p.toponyme || '').trim();
      if (!toponyme) {
        if (unnamedHydroCount >= 2) continue;
        unnamedHydroCount += 1;
      }
      const pos = extractFirstCoordFromGeoJson(f.geometry);
      if (!pos) continue;

      const label = toponyme || `${nature} locale`;
      const isLegend = /fée|saint|miracul|diable|sorci|roi|reine|napoléon/i.test(label);
      pois.push({
        id: sanitizeId(`ign_hyd_${p.cleabs || f.id}`),
        name: label.slice(0, 180),
        mysteryTitle: isLegend ? 'Fontaine Légendaire' : 'Murmure d’Eau Vive',
        category: isLegend ? 'legende' : 'geographie',
        subType: `${nature} (Topographie IGN)`,
        stratum: isLegend ? 'vivant_folklore' : 'temps_profond',
        eraLabel: isLegend ? 'Tradition des Fontaines' : 'Hydrologie & Sources',
        source: 'IGN · BD TOPO',
        lat: pos.lat,
        lng: pos.lng,
        summary: `${label} — ${nature.toLowerCase()} cartographiée par l’Institut national de l’information géographique et forestière (IGN BD TOPO). Les sources, lavoirs et fontaines structurent depuis des siècles les haltes rurales et la micro-géographie de l’eau.`,
        nearWaterway: true,
        waterwayName: toponyme || nature,
        safetyNotice: '',
        externalUrl: `https://cartes.gouv.fr/`,
        xpReward: toponyme ? 130 : 105,
        unlockRadiusMeters: 85,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
    }
  }

  // 2. Orographic details (Caves, Chasms, Remarkable Rocks, Peaks, Gorges)
  if (oroRes.status === 'fulfilled' && oroRes.value?.features) {
    for (const f of oroRes.value.features) {
      const p = f.properties || {};
      const nature = String(p.nature || '').trim();
      if (
        !/^(Grotte|Gouffre|Aven|Rochers|Pic|Sommet|Gorge|Chaos|Falaise|Cratère|Volcan|Arche naturelle)$/i.test(
          nature
        )
      ) {
        continue;
      }
      const toponyme = String(p.toponyme || '').trim();
      if (!toponyme) {
        if (unnamedOroCount >= 2) continue;
        unnamedOroCount += 1;
      }
      const pos = extractFirstCoordFromGeoJson(f.geometry);
      if (!pos) continue;

      const isCave = /grotte|gouffre|aven/i.test(nature);
      const label = toponyme || `${nature} remarquable`;
      pois.push({
        id: sanitizeId(`ign_oro_${p.cleabs || f.id}`),
        name: label.slice(0, 180),
        mysteryTitle: isCave ? 'Bouche d’Ombre' : 'Relief Singulier',
        category: isCave ? 'etrange' : 'geographie',
        subType: `${nature} (Relief IGN)`,
        stratum: 'temps_profond',
        eraLabel: 'Géomorphologie & Reliefs',
        source: 'IGN · BD TOPO',
        lat: pos.lat,
        lng: pos.lng,
        summary: `${label} — particularité orographique (${nature.toLowerCase()}) relevée sur les cartes d’état-major et la BD TOPO de l’IGN.`,
        nearWaterway: false,
        waterwayName: '',
        safetyNotice: isCave
          ? 'Ne pénétrez pas dans une grotte ou un gouffre non aménagé sans encadrement spéléologique.'
          : 'Prudence aux abords des chaos rocheux et escarpements.',
        externalUrl: `https://cartes.gouv.fr/`,
        xpReward: 135,
        unlockRadiusMeters: 90,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
    }
  }

  // 3. Archaeological vestiges, Megaliths, Castles, Forts & Museums (ZAI)
  if (zaiRes.status === 'fulfilled' && zaiRes.value?.features) {
    for (const f of zaiRes.value.features) {
      const p = f.properties || {};
      const nature = String(p.nature || '').trim();
      if (
        !/^(Vestige archéologique|Mégalithe|Château|Fort|Ouvrage militaire|Monument|Musée|Parc ou jardin)$/i.test(
          nature
        )
      ) {
        continue;
      }
      const toponyme = String(p.toponyme || '').trim();
      if (!toponyme) continue;
      const pos = extractFirstCoordFromGeoJson(f.geometry);
      if (!pos) continue;

      const isMegalith = /mégalithe|menhir|dolmen|tumulus|cromlech/i.test(`${nature} ${toponyme}`);
      const isArcheo = /archéolog|abri|gallo|oppidum|antique/i.test(`${nature} ${toponyme}`);
      const strat = inferStratumFromYearOrText(
        null,
        `${toponyme} ${nature}`,
        isMegalith ? 'legende' : 'histoire'
      );

      pois.push({
        id: sanitizeId(`ign_zai_${p.cleabs || f.id}`),
        name: toponyme.slice(0, 180),
        mysteryTitle: isMegalith
          ? 'Pierre des Anciens'
          : isArcheo
          ? 'Site Archéologique'
          : 'Haut-Lieu Patrimonial',
        category: isMegalith ? 'legende' : 'histoire',
        subType: `${nature} (Inventaire IGN)`,
        stratum: isMegalith ? 'prehistoire' : strat.stratum,
        eraLabel: isMegalith ? 'Préhistoire & Mégalithes' : strat.eraLabel,
        source: 'IGN · BD TOPO',
        lat: pos.lat,
        lng: pos.lng,
        summary: `${toponyme} (${nature.toLowerCase()}${
          p.commune ? `, commune de ${p.commune}` : ''
        }) — site patrimonial ou archéologique référencé dans la base officielle IGN BD TOPO.`,
        nearWaterway: false,
        waterwayName: '',
        safetyNotice: '',
        externalUrl: `https://cartes.gouv.fr/`,
        xpReward: isMegalith || isArcheo ? 150 : 125,
        unlockRadiusMeters: 90,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
    }
  }

  // 4. Punctual Heritage Constructions (Menhirs, Dolmens, Ruins, Windmills, Wayside Crosses)
  if (cpRes.status === 'fulfilled' && cpRes.value?.features) {
    for (const f of cpRes.value.features) {
      const p = f.properties || {};
      const nature = String(p.nature || '').trim();
      const toponyme = String(p.toponyme || '').trim();

      if ((nature === 'Croix' || nature === 'Calvaire' || nature === 'Puits') && !toponyme) {
        if (unnamedCrossCount >= 2) continue;
        unnamedCrossCount += 1;
      }

      const pos = extractFirstCoordFromGeoJson(f.geometry);
      if (!pos) continue;

      const isMegalith = /menhir|dolmen/i.test(nature);
      const isRuin = /ruine/i.test(nature);
      const label =
        toponyme ||
        (nature === 'Croix' ? 'Croix de chemin ancienne' : `${nature} patrimonial`);

      pois.push({
        id: sanitizeId(`ign_cp_${p.cleabs || f.id}`),
        name: label.slice(0, 180),
        mysteryTitle: isMegalith
          ? 'Mégalithe Dressé'
          : isRuin
          ? 'Vestige en Ruine'
          : 'Repère de Chemin',
        category: isMegalith ? 'legende' : isRuin ? 'etrange' : 'histoire',
        subType: `${nature} (Petit patrimoine IGN)`,
        stratum: isMegalith ? 'prehistoire' : 'moyen_age',
        eraLabel: isMegalith ? 'Préhistoire & Mégalithes' : 'Petit Patrimoine Rural & Urbain',
        source: 'IGN · BD TOPO',
        lat: pos.lat,
        lng: pos.lng,
        summary: `${label} — élément de petit patrimoine (${nature.toLowerCase()}) positionné par photogrammétrie ou levé topographique IGN.`,
        nearWaterway: nature === 'Puits',
        waterwayName: nature === 'Puits' ? 'Nappe phréatique' : '',
        safetyNotice: isRuin ? 'Ne grimpez pas sur les maçonneries anciennes non consolidées.' : '',
        externalUrl: `https://cartes.gouv.fr/`,
        xpReward: isMegalith ? 150 : toponyme ? 125 : 100,
        unlockRadiusMeters: 80,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
    }
  }

  return pois.slice(0, 16);
}

// ============================================================================
// 10. ARCHÉOLOGIE PRÉVENTIVE, FOUILLES & DIAGNOSTICS (INRAP / WIKIDATA / WP)
// ============================================================================
async function queryPreventiveArchaeology(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<RawPoi[]> {
  const radiusKm = Math.min(Math.max((radiusMeters / 1000) * 1.45, 2.2), 6.0).toFixed(1);
  const sparql = `
SELECT DISTINCT ?site ?siteLabel ?siteDescription ?coord ?periodLabel ?discDate ?merimee WHERE {
  SERVICE wikibase:around {
    ?site wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${radiusKm}" .
  }
  VALUES ?archClass { wd:Q839954 wd:Q15661340 wd:Q57821 wd:Q751876 wd:Q896956 wd:Q134307 }
  ?site wdt:P31/wdt:P279* ?archClass .
  OPTIONAL { ?site wdt:P2348 ?period . }
  OPTIONAL { ?site wdt:P575 ?discDate . }
  OPTIONAL { ?site wdt:P380 ?merimee . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}
LIMIT 12
`;
  const wdUrl = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  const wpSearch = `nearcoord:9km,${lat},${lng} (fouilles OR INRAP OR "archéologie préventive" OR "diagnostic archéologique" OR nécropole OR gallo-romain OR oppidum OR thermes OR "abri sous roche" OR magdalénien)`;
  const wpUrl = `https://fr.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    wpSearch
  )}&gsrlimit=8&prop=coordinates|extracts|info&inprop=url&exintro=1&explaintext=1&exlimit=max&exchars=900&format=json`;

  const [wdRes, wpRes] = await Promise.allSettled([
    fetchWithTimeout(wdUrl, { headers: { Accept: 'application/sparql-results+json' } }, 4000).then(
      (r) => (r.ok ? r.json() : null)
    ),
    fetchWithTimeout(wpUrl, {}, 3800).then((r) => (r.ok ? r.json() : null)),
  ]);

  const out: RawPoi[] = [];

  if (wdRes.status === 'fulfilled' && wdRes.value?.results?.bindings) {
    const seen = new Set<string>();
    for (const b of wdRes.value.results.bindings) {
      const uri = String(b.site?.value || '');
      const qid = uri.split('/').pop() || '';
      if (!qid || seen.has(qid)) continue;
      seen.add(qid);

      const label = String(b.siteLabel?.value || '').trim();
      if (!label || /^Q\d+$/.test(label)) continue;

      const m = String(b.coord?.value || '').match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
      if (!m) continue;
      const pLng = Number(m[1]);
      const pLat = Number(m[2]);

      const period =
        b.periodLabel?.value && !/^Q\d+$/.test(b.periodLabel.value) ? b.periodLabel.value : '';
      const discYear = b.discDate?.value ? String(b.discDate.value).slice(0, 4) : '';
      const desc =
        b.siteDescription?.value ||
        'Gisement ou vestige archéologique fouillé et documenté sur ce secteur.';
      const merimee = b.merimee?.value || '';

      const strat = inferStratumFromYearOrText(
        null,
        `${label} ${period} ${desc}`,
        'histoire'
      );

      out.push({
        id: sanitizeId(`arch_wd_${qid}`),
        name: label.slice(0, 180),
        mysteryTitle: 'Fouille Enfoui sous nos Pas',
        category: 'histoire',
        subType: period
          ? `Site archéologique (${period})`
          : 'Site archéologique & fouilles',
        stratum: strat.stratum === 'contemporain' ? 'antiquite' : strat.stratum,
        eraLabel: period || strat.eraLabel,
        source: 'Archéologie & Fouilles (Atlas / INRAP)',
        lat: pLat,
        lng: pLng,
        summary: [
          `${label} — ${desc.charAt(0).toUpperCase()}${desc.slice(1)}.`,
          period ? `Horizon chronoculturel : ${period}.` : '',
          discYear ? `Mise au jour / fouilles attestées dès ${discYear}.` : '',
          merimee ? `Notice patrimoniale Base Mérimée : ${merimee}.` : '',
        ]
          .filter(Boolean)
          .join(' ')
          .slice(0, 2100),
        nearWaterway: false,
        waterwayName: '',
        safetyNotice: 'Le sous-sol archéologique est protégé par le Code du patrimoine : tout prélèvement est interdit.',
        externalUrl: merimee
          ? `https://pop.culture.gouv.fr/notice/merimee/${encodeURIComponent(merimee)}`
          : uri,
        xpReward: 155,
        unlockRadiusMeters: 90,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
    }
  }

  if (wpRes.status === 'fulfilled' && wpRes.value?.query?.pages) {
    const pages = Object.values(wpRes.value.query.pages) as Array<{
      pageid: number;
      title: string;
      extract?: string;
      fullurl?: string;
      coordinates?: Array<{ lat: number; lon: number }>;
    }>;

    for (const p of pages) {
      const coord = p.coordinates?.[0];
      if (!coord || !p.title) continue;
      if (/institut national de recherches/i.test(p.title)) continue;
      if (haversineMeters(lat, lng, coord.lat, coord.lon) > 6500) continue;

      const extract = (p.extract || '').trim();
      if (extract.length < 35) continue;

      const strat = inferStratumFromYearOrText(null, `${p.title} ${extract}`, 'histoire');
      out.push({
        id: sanitizeId(`arch_wp_${p.pageid}`),
        name: p.title.slice(0, 180),
        mysteryTitle: 'Strate Archéologique',
        category: 'histoire',
        subType: 'Fouilles archéologiques & strates enfouies',
        stratum: strat.stratum === 'contemporain' ? 'antiquite' : strat.stratum,
        eraLabel: strat.eraLabel,
        source: 'Archéologie & Fouilles (Atlas / INRAP)',
        lat: coord.lat,
        lng: coord.lon,
        summary: extract.slice(0, 2100),
        nearWaterway: false,
        waterwayName: '',
        safetyNotice: '',
        externalUrl: p.fullurl || `https://fr.wikipedia.org/?curid=${p.pageid}`,
        xpReward: 150,
        unlockRadiusMeters: 90,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
    }
  }

  return out.slice(0, 10);
}

// ============================================================================
// 11. PATRIMOINE NATUREL & GÉOLOGIQUE INPN (INPG, ZNIEFF, SITES CLASSÉS & ARBRES REMARQUABLES)
// ============================================================================
function extractClosestRingPointOrCentroid(
  geom: unknown,
  refLat: number,
  refLng: number
): { lat: number; lng: number } | null {
  if (!geom || typeof geom !== 'object') return null;
  const g = geom as { type?: string; coordinates?: unknown };

  const pickBestFromRing = (ring: number[][]): { lat: number; lng: number } | null => {
    if (!Array.isArray(ring) || ring.length === 0) return null;
    let best: { lat: number; lng: number } | null = null;
    let bestDist = Infinity;
    const step = Math.max(1, Math.floor(ring.length / 40));
    for (let i = 0; i < ring.length; i += step) {
      const pt = ring[i];
      if (!Array.isArray(pt) || pt.length < 2) continue;
      const cLng = Number(pt[0]);
      const cLat = Number(pt[1]);
      if (!Number.isFinite(cLat) || !Number.isFinite(cLng)) continue;
      const d = haversineMeters(refLat, refLng, cLat, cLng);
      if (d < bestDist) {
        bestDist = d;
        best = { lat: cLat, lng: cLng };
      }
    }
    return best;
  };

  if (g.type === 'Point' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
    return { lng: Number(g.coordinates[0]), lat: Number(g.coordinates[1]) };
  }
  if (g.type === 'Polygon' && Array.isArray(g.coordinates) && Array.isArray(g.coordinates[0])) {
    return pickBestFromRing(g.coordinates[0] as number[][]);
  }
  if (
    g.type === 'MultiPolygon' &&
    Array.isArray(g.coordinates) &&
    Array.isArray(g.coordinates[0]) &&
    Array.isArray(g.coordinates[0][0])
  ) {
    let bestOverall: { lat: number; lng: number } | null = null;
    let bestD = Infinity;
    for (const poly of g.coordinates as number[][][][]) {
      const cand = poly?.[0] ? pickBestFromRing(poly[0]) : null;
      if (cand) {
        const d = haversineMeters(refLat, refLng, cand.lat, cand.lng);
        if (d < bestD) {
          bestD = d;
          bestOverall = cand;
        }
      }
    }
    return bestOverall;
  }
  return extractFirstCoordFromGeoJson(geom);
}

async function queryInpnPatrinatAndTrees(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<{ inpnGeoEco: RawPoi[]; remarkableTrees: RawPoi[] }> {
  const dLat = Math.min(0.045, Math.max(0.018, (radiusMeters * 1.4) / 110540));
  const cosLat = Math.max(0.15, Math.cos((lat * Math.PI) / 180));
  const dLng = dLat / cosLat;
  const bbox = `${(lng - dLng).toFixed(5)},${(lat - dLat).toFixed(5)},${(lng + dLng).toFixed(
    5
  )},${(lat + dLat).toFixed(5)},EPSG:4326`;

  const wfsPatrinat = (layer: string, count: number) =>
    `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=${encodeURIComponent(
      layer
    )}&BBOX=${bbox}&COUNT=${count}&OUTPUTFORMAT=application/json`;

  const treeSparql = `
SELECT DISTINCT ?tree ?treeLabel ?treeDescription ?coord WHERE {
  SERVICE wikibase:around {
    ?tree wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "5.5" .
  }
  VALUES ?tClass { wd:Q811534 wd:Q15123269 }
  ?tree wdt:P31/wdt:P279* ?tClass .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}
LIMIT 6
`;
  const treeWpSearch = `nearcoord:10km,${lat},${lng} ("arbre remarquable" OR "chêne centenaire" OR "tilleul de Sully" OR "if millénaire" OR "forêt ancienne" OR "jardin remarquable")`;
  const treeWpUrl = `https://fr.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    treeWpSearch
  )}&gsrlimit=5&prop=coordinates|extracts|info&inprop=url&exintro=1&explaintext=1&exlimit=max&exchars=750&format=json`;

  const [inpgRes, znieffRes, scRes, treeWdRes, treeWpRes] = await Promise.allSettled([
    fetchWithTimeout(wfsPatrinat('patrinat_inpg:inpg', 5), {}, 3600).then((r) =>
      r.ok ? r.json() : null
    ),
    fetchWithTimeout(wfsPatrinat('patrinat_znieff1:znieff1', 5), {}, 3600).then((r) =>
      r.ok ? r.json() : null
    ),
    fetchWithTimeout(wfsPatrinat('patrinat_sc:sc', 4), {}, 3600).then((r) =>
      r.ok ? r.json() : null
    ),
    fetchWithTimeout(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(treeSparql)}`,
      { headers: { Accept: 'application/sparql-results+json' } },
      3800
    ).then((r) => (r.ok ? r.json() : null)),
    fetchWithTimeout(treeWpUrl, {}, 3600).then((r) => (r.ok ? r.json() : null)),
  ]);

  const inpnGeoEco: RawPoi[] = [];
  const remarkableTrees: RawPoi[] = [];

  // 1. Inventaire National du Patrimoine Géologique (INPG — MNHN / PatriNat)
  if (inpgRes.status === 'fulfilled' && inpgRes.value?.features) {
    for (const f of inpgRes.value.features) {
      const p = f.properties || {};
      const nom = String(p.nom_site || '').trim();
      if (!nom) continue;
      const pos = extractClosestRingPointOrCentroid(f.geometry, lat, lng);
      if (!pos) continue;
      const areaHa = p.area_sig ? `${Number(p.area_sig).toFixed(1)} ha` : 'périmètre géologique';
      const code = p.id_mnhn || p.id_local || 'INPG';

      inpnGeoEco.push({
        id: sanitizeId(`inpg_${code}`),
        name: nom.slice(0, 180),
        mysteryTitle: 'Sanctuaire Géologique (INPG)',
        category: 'geographie',
        subType: `Géosite national INPG (${code})`,
        stratum: 'temps_profond',
        eraLabel: 'Patrimoine Géologique National',
        source: 'INPN · Géologie INPG & ZNIEFF',
        lat: pos.lat,
        lng: pos.lng,
        summary: `Géosite inscrit à l’Inventaire National du Patrimoine Géologique (INPG — Muséum national d’Histoire naturelle, réf. ${code}, ${areaHa}). Ce site témoigne d’une coupe stratigraphique, géomorphologique, karstique ou paléontologique majeure${
          p.operateur ? ` suivie par ${p.operateur}` : ''
        }.`,
        nearWaterway: /rivière|source|gorge|vallée|céou|vézère|seine|loire/i.test(nom),
        waterwayName: '',
        safetyNotice: 'Site géologique patrimonial : ne martelez pas les parois et ne prélevez aucun minéral ou fossile.',
        externalUrl: p.url_fiche || `https://inpn.mnhn.fr/site/inpg/${encodeURIComponent(code)}`,
        xpReward: 165,
        unlockRadiusMeters: 105,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
    }
  }

  // 2. ZNIEFF de Type I (MNHN / PatriNat — joyaux écologiques à forte valeur biologique)
  if (znieffRes.status === 'fulfilled' && znieffRes.value?.features) {
    for (const f of znieffRes.value.features) {
      const p = f.properties || {};
      const nom = String(p.nom_site || '').trim();
      if (!nom) continue;
      const pos = extractClosestRingPointOrCentroid(f.geometry, lat, lng);
      if (!pos) continue;
      const code = p.id_mnhn || p.id_local || 'ZNIEFF';
      const areaHa = p.area_sig ? `${Math.round(Number(p.area_sig))} ha` : 'secteur écologique';

      inpnGeoEco.push({
        id: sanitizeId(`znieff1_${code}`),
        name: `ZNIEFF : ${nom}`.slice(0, 180),
        mysteryTitle: 'Refuge Sauvage (ZNIEFF)',
        category: 'ecosysteme',
        subType: `Zone naturelle d’intérêt écologique (${areaHa})`,
        stratum: 'vivant_folklore',
        eraLabel: 'Inventaire Écologique INPN',
        source: 'INPN · Géologie INPG & ZNIEFF',
        lat: pos.lat,
        lng: pos.lng,
        summary: `Zone Naturelle d’Intérêt Écologique, Faunistique et Floristique de type I (« ${nom} », réf. MNHN ${code}, ${areaHa}). Ces noyaux de biodiversité abritent des habitats rares ou des espèces déterminantes inventoriés par le Muséum national d’Histoire naturelle.`,
        nearWaterway: /marais|étang|rivière|ruisseau|vallée|berge|île|humide/i.test(nom),
        waterwayName: '',
        safetyNotice: 'Restez sur les sentiers balisés afin de préserver la quiétude de la faune et de la flore.',
        externalUrl: p.url_fiche || `https://inpn.mnhn.fr/zone/znieff/${encodeURIComponent(code)}`,
        xpReward: 150,
        unlockRadiusMeters: 105,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
    }
  }

  // 3. Sites Classés Patrimoniaux (PatriNat SC)
  if (scRes.status === 'fulfilled' && scRes.value?.features) {
    for (const f of scRes.value.features.slice(0, 2)) {
      const p = f.properties || {};
      const nom = String(p.nom_site || '').trim();
      if (!nom) continue;
      const pos = extractClosestRingPointOrCentroid(f.geometry, lat, lng);
      if (!pos) continue;
      const code = p.id_mnhn || 'SC';

      remarkableTrees.push({
        id: sanitizeId(`site_classe_${code}_${nom.slice(0, 20)}`),
        name: nom.slice(0, 180),
        mysteryTitle: 'Paysage Classé Monument Naturel',
        category: 'ecosysteme',
        subType: 'Site naturel ou paysager classé',
        stratum: 'vivant_folklore',
        eraLabel: 'Grand Paysage Protégé',
        source: 'Arbres Remarquables & Sites Classés',
        lat: pos.lat,
        lng: pos.lng,
        summary: `${nom} — ensemble paysager et naturel protégé au titre des Sites Classés français (réf. INPN ${code}), reconnu pour son caractère historique, artistique, pittoresque ou légendaire.`,
        nearWaterway: false,
        waterwayName: '',
        safetyNotice: '',
        externalUrl: p.url_fiche || 'https://inpn.mnhn.fr/',
        xpReward: 145,
        unlockRadiusMeters: 100,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
    }
  }

  // 4. Arbres Remarquables (Wikidata + Wikipédia FR)
  if (treeWdRes.status === 'fulfilled' && treeWdRes.value?.results?.bindings) {
    for (const b of treeWdRes.value.results.bindings) {
      const uri = String(b.tree?.value || '');
      const qid = uri.split('/').pop() || '';
      const label = String(b.treeLabel?.value || '').trim();
      if (!qid || !label || /^Q\d+$/.test(label)) continue;
      const m = String(b.coord?.value || '').match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
      if (!m) continue;
      const desc =
        b.treeDescription?.value || 'Arbre vénérable et témoin botanique pluriséculaire.';

      remarkableTrees.push({
        id: sanitizeId(`tree_wd_${qid}`),
        name: label.slice(0, 180),
        mysteryTitle: 'Doyen Végétal Centenaire',
        category: 'ecosysteme',
        subType: 'Arbre remarquable centenaire',
        stratum: 'vivant_folklore',
        eraLabel: 'Patrimoine Arboré Vivant',
        source: 'Arbres Remarquables & Sites Classés',
        lat: Number(m[2]),
        lng: Number(m[1]),
        summary: `${label} — ${desc.charAt(0).toUpperCase()}${desc.slice(1)}. Les arbres remarquables constituent de véritables monuments vivants mêlant mémoire villageoise, biodiversité saproxylique et légendes anciennes.`,
        nearWaterway: false,
        waterwayName: '',
        safetyNotice: 'Ne piétinez pas le système racinaire au pied du tronc et ne gravez jamais l’écorce.',
        externalUrl: uri,
        xpReward: 160,
        unlockRadiusMeters: 85,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
    }
  }

  if (treeWpRes.status === 'fulfilled' && treeWpRes.value?.query?.pages) {
    const pages = Object.values(treeWpRes.value.query.pages) as Array<{
      pageid: number;
      title: string;
      extract?: string;
      fullurl?: string;
      coordinates?: Array<{ lat: number; lon: number }>;
    }>;
    for (const p of pages) {
      const coord = p.coordinates?.[0];
      if (!coord || !p.title) continue;
      if (haversineMeters(lat, lng, coord.lat, coord.lon) > 8000) continue;
      const extract = (p.extract || '').trim();
      if (extract.length < 30) continue;

      remarkableTrees.push({
        id: sanitizeId(`tree_wp_${p.pageid}`),
        name: p.title.slice(0, 180),
        mysteryTitle: 'Arbre ou Jardin Remarquable',
        category: 'ecosysteme',
        subType: 'Arbre remarquable / Jardin patrimonial',
        stratum: 'vivant_folklore',
        eraLabel: 'Patrimoine Botanique',
        source: 'Arbres Remarquables & Sites Classés',
        lat: coord.lat,
        lng: coord.lon,
        summary: extract.slice(0, 2000),
        nearWaterway: false,
        waterwayName: '',
        safetyNotice: '',
        externalUrl: p.fullurl || `https://fr.wikipedia.org/?curid=${p.pageid}`,
        xpReward: 150,
        unlockRadiusMeters: 90,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
    }
  }

  return {
    inpnGeoEco: inpnGeoEco.slice(0, 8),
    remarkableTrees: remarkableTrees.slice(0, 6),
  };
}

// ============================================================================
// 12. MOBILIER PATRIMONIAL (BASE PALISSY) & MÉMOIRE INDUSTRIELLE / FRICHES
// ============================================================================
async function queryIndustrialFrichesAndPalissy(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<{ palissyPois: RawPoi[]; industrialFriches: RawPoi[] }> {
  const radiusKm = Math.min(Math.max((radiusMeters / 1000) * 1.25, 1.8), 4.5).toFixed(1);
  const palissySparql = `
SELECT DISTINCT ?obj ?objLabel ?objDescription ?locLabel ?coord ?palissy ?inception WHERE {
  SERVICE wikibase:around {
    ?loc wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${radiusKm}" .
  }
  ?obj wdt:P481 ?palissy ;
       wdt:P276 ?loc .
  OPTIONAL { ?obj wdt:P571 ?inception . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}
LIMIT 10
`;
  const frichesWpSearch = `nearcoord:9km,${lat},${lng} (friche OR "ancienne gare" OR "Petite Ceinture" OR manufacture OR filature OR fonderie OR forge OR verrerie OR houillère OR moulin OR abattoirs OR "patrimoine industriel")`;
  const frichesWpUrl = `https://fr.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    frichesWpSearch
  )}&gsrlimit=8&prop=coordinates|extracts|info&inprop=url&exintro=1&explaintext=1&exlimit=max&exchars=900&format=json`;

  const searchR = Math.min(Math.max(Math.round(radiusMeters * 1.4), 1600), 4000);
  const odsWhere = `within_distance(meta_geo_point,geom'POINT(${lng} ${lat})',${searchR}m) AND type IN ('industrial','mine','quarry','wreck','railway_station','locomotive','windmill','watermill','kiln','lime_kiln')`;
  const odsIndusUrl = `https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/osm-france-historic/records?where=${encodeURIComponent(
    odsWhere
  )}&limit=10`;

  const [palRes, wpRes, odsRes] = await Promise.allSettled([
    fetchWithTimeout(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(palissySparql)}`,
      { headers: { Accept: 'application/sparql-results+json' } },
      4200
    ).then((r) => (r.ok ? r.json() : null)),
    fetchWithTimeout(frichesWpUrl, {}, 3800).then((r) => (r.ok ? r.json() : null)),
    fetchWithTimeout(odsIndusUrl, {}, 3600).then((r) => (r.ok ? r.json() : null)),
  ]);

  const palissyPois: RawPoi[] = [];
  const industrialFriches: RawPoi[] = [];

  if (palRes.status === 'fulfilled' && palRes.value?.results?.bindings) {
    const seenLoc = new Set<string>();
    for (const b of palRes.value.results.bindings) {
      const code = String(b.palissy?.value || '').trim();
      const objLabel = String(b.objLabel?.value || '').trim();
      if (!code || !objLabel || /^Q\d+$/.test(objLabel)) continue;

      const m = String(b.coord?.value || '').match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
      if (!m) continue;
      // Slight deterministic micro-jitter (~12m) if multiple Palissy treasures share a building so they don't collapse on 1 pixel
      const baseLng = Number(m[1]);
      const baseLat = Number(m[2]);
      const locKey = `${baseLat.toFixed(4)}_${baseLng.toFixed(4)}`;
      const countAtLoc = seenLoc.has(locKey) ? 1 : 0;
      seenLoc.add(locKey);
      if (countAtLoc > 0 && palissyPois.length >= 4) continue;

      const pLat = baseLat + (countAtLoc ? 0.00038 : 0.00018);
      const pLng = baseLng + (countAtLoc ? -0.00038 : 0.00018);
      const hostName =
        b.locLabel?.value && !/^Q\d+$/.test(b.locLabel.value) ? b.locLabel.value : 'Édifice local';
      const desc = b.objDescription?.value || 'Objet mobilier classé au titre des Monuments Historiques';
      const yearMatch = String(b.inception?.value || '').match(/^(-?\d{3,4})/);
      const strat = inferStratumFromYearOrText(
        yearMatch ? Number(yearMatch[1]) : null,
        `${objLabel} ${desc}`,
        'histoire'
      );

      palissyPois.push({
        id: sanitizeId(`palissy_${code}`),
        name: `Trésor mobilier : ${objLabel}`.slice(0, 180),
        mysteryTitle: 'Relique ou Objet Classé',
        category: 'histoire',
        subType: `Objet classé Base Palissy (${code})`,
        stratum: strat.stratum,
        eraLabel: strat.eraLabel,
        source: 'Base Palissy (Mobilier Classé)',
        lat: pLat,
        lng: pLng,
        summary: `Objet patrimonial abrité au sein de « ${hostName} » : ${objLabel} (${desc}). Référencé dans la Base Palissy du ministère de la Culture sous la cote ${code}. Les cloches anciennes, orgues, cadrans solaires, vitraux et statues racontent l’artisanat d’art caché derrière les façades.`,
        nearWaterway: false,
        waterwayName: '',
        safetyNotice: '',
        externalUrl: `https://pop.culture.gouv.fr/notice/palissy/${encodeURIComponent(code)}`,
        xpReward: 150,
        unlockRadiusMeters: 85,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
      if (palissyPois.length >= 6) break;
    }
  }

  if (wpRes.status === 'fulfilled' && wpRes.value?.query?.pages) {
    const pages = Object.values(wpRes.value.query.pages) as Array<{
      pageid: number;
      title: string;
      extract?: string;
      fullurl?: string;
      coordinates?: Array<{ lat: number; lon: number }>;
    }>;
    for (const p of pages) {
      const coord = p.coordinates?.[0];
      if (!coord || !p.title) continue;
      if (haversineMeters(lat, lng, coord.lat, coord.lon) > 7000) continue;
      const extract = (p.extract || '').trim();
      if (extract.length < 30) continue;

      industrialFriches.push({
        id: sanitizeId(`friche_wp_${p.pageid}`),
        name: p.title.slice(0, 180),
        mysteryTitle: 'Friche ou Mémoire Ouvrière',
        category: 'etrange',
        subType: 'Friche industrielle, ferroviaire ou moulin',
        stratum: /moulin|forge/i.test(p.title) ? 'moderne' : 'contemporain',
        eraLabel: /moulin|forge/i.test(p.title)
          ? 'Artisanat & Hydraulique Ancienne'
          : 'Ère Industrielle & Ferroviaire',
        source: 'Friches & Mémoire Industrielle',
        lat: coord.lat,
        lng: coord.lon,
        summary: extract.slice(0, 2100),
        nearWaterway: /moulin|canal|port| écluse/i.test(`${p.title} ${extract}`),
        waterwayName: '',
        safetyNotice: 'Certaines friches industrielles ou ferroviaires ne se visitent que depuis l’extérieur ou lors d’ouvertures encadrées.',
        externalUrl: p.fullurl || `https://fr.wikipedia.org/?curid=${p.pageid}`,
        xpReward: 150,
        unlockRadiusMeters: 95,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
    }
  }

  if (odsRes.status === 'fulfilled' && odsRes.value?.results) {
    for (const rec of odsRes.value.results) {
      const pt = rec.meta_geo_point;
      if (!pt || typeof pt.lat !== 'number' || typeof pt.lon !== 'number') continue;
      const rawType = String(rec.type || 'industrial').toLowerCase();
      const label =
        (rec.name || '').trim() ||
        (rawType === 'lime_kiln' || rawType === 'kiln'
          ? 'Ancien four à chaux ou tuilerie'
          : rawType === 'watermill'
          ? 'Ancien moulin à eau'
          : rawType === 'windmill'
          ? 'Ancien moulin à vent'
          : rawType === 'mine'
          ? 'Ancien puits ou galerie de mine'
          : rawType === 'quarry'
          ? 'Ancien front de carrière'
          : 'Vestige d’activité industrielle');

      industrialFriches.push({
        id: sanitizeId(`indus_ods_${rec.meta_osm_id || `${pt.lat}_${pt.lon}`}`),
        name: label.slice(0, 180),
        mysteryTitle: 'Vestige Productif Oublié',
        category: 'etrange',
        subType: `Patrimoine industriel & artisanal (${rawType})`,
        stratum: /mill|kiln/.test(rawType) ? 'moderne' : 'contemporain',
        eraLabel: 'Mémoire Productive & Friches',
        source: 'Friches & Mémoire Industrielle',
        lat: pt.lat,
        lng: pt.lon,
        summary: `${label}${
          rec.meta_name_com ? ` (${rec.meta_name_com})` : ''
        } — ancien site d’extraction, de transformation ou de transport témoignant du passé artisanal et industriel du territoire.${
          rec.description ? ` ${rec.description}` : ''
        }`,
        nearWaterway: rawType === 'watermill',
        waterwayName: '',
        safetyNotice: 'Prudence aux abords des anciennes carrières, fours et friches non aménagées.',
        externalUrl:
          rec.meta_osm_url || `https://www.openstreetmap.org/#map=18/${pt.lat}/${pt.lon}`,
        xpReward: 140,
        unlockRadiusMeters: 85,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
    }
  }

  return {
    palissyPois: palissyPois.slice(0, 6),
    industrialFriches: industrialFriches.slice(0, 8),
  };
}

// ============================================================================
// 13. TOPONYMIE HISTORIQUE (LIEUX-DITS ANCIENS IGN) & VOIES FERRÉES DISPARUES
// ============================================================================
function explainHistoricalToponym(name: string): {
  evocative: boolean;
  category: CategoryKey;
  stratum: HistoricalStratum;
  eraLabel: string;
  explanation: string;
} {
  const n = name.toLowerCase();
  if (/fée|diable|enfer|sorci|loup|dragon|dame blanche|lutin|géant|gargantua|sarrasin/.test(n)) {
    return {
      evocative: true,
      category: 'legende',
      stratum: 'vivant_folklore',
      eraLabel: 'Toponymie Légendaire',
      explanation:
        'Ce micro-toponyme conserve la trace d’une croyance populaire, d’un conte rural ou d’une figure mythologique attachée au relief.',
    };
  }
  if (/menhir|dolmen|peyre|pierre|tombelle|tumulus|camp|césar|romain|châtel|castel|motte/.test(n)) {
    return {
      evocative: true,
      category: 'histoire',
      stratum: 'antiquite',
      eraLabel: 'Toponymie Archéologique',
      explanation:
        'En archéologie du paysage, les lieux-dits en « Peyre / Pierre », « Camp de César », « Châtel » ou « Motte » signalent fréquemment un site antique, mégalithique ou castral disparu.',
    };
  }
  if (/temple|commanderie|maladrerie|léproserie|abbaye|prieuré|moine|ermitage|justice|gibet|potence/.test(n)) {
    return {
      evocative: true,
      category: 'histoire',
      stratum: 'moyen_age',
      eraLabel: 'Toponymie Médiévale',
      explanation:
        'Ce lieu-dit perpétue la mémoire d’une institution médiévale (commanderie, maladrerie, prieuré ou ancienne haute-justice seigneuriale) aujourd’hui effacée du bâti.',
    };
  }
  if (/moulin|gué|bac|forge|four|tuilerie|verrerie|mine|fer|charbon|saline|lavoir|font/.test(n)) {
    return {
      evocative: true,
      category: 'etrange',
      stratum: 'moderne',
      eraLabel: 'Toponymie d’Ancien Métier & Passage',
      explanation:
        'Ce nom de parcelle issu du cadastre ancien révèle l’emplacement d’un gué oublié, d’un moulin, d’une forge ou d’un four rural.',
    };
  }
  return {
    evocative: false,
    category: 'histoire',
    stratum: 'moderne',
    eraLabel: 'Micro-Toponymie Cadastrale',
    explanation:
      'Lieu-dit traditionnel transmis par les terriers, le cadastre napoléonien et les levés d’État-Major de l’IGN.',
  };
}

async function queryHistoricalToponymyAndLostRails(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<RawPoi[]> {
  const dLat = Math.min(0.028, Math.max(0.013, radiusMeters / 110540));
  const cosLat = Math.max(0.15, Math.cos((lat * Math.PI) / 180));
  const dLng = dLat / cosLat;
  const minLng = (lng - dLng).toFixed(5);
  const minLat = (lat - dLat).toFixed(5);
  const maxLng = (lng + dLng).toFixed(5);
  const maxLat = (lat + dLat).toFixed(5);
  const bboxExpr = `BBOX(geometrie,${minLng},${minLat},${maxLng},${maxLat},'EPSG:4326')`;

  const lieuxDitsUrl = `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BDTOPO_V3%3Alieu_dit_non_habite&CQL_FILTER=${encodeURIComponent(
    bboxExpr
  )}&COUNT=28&OUTPUTFORMAT=application/json`;

  const lostRailCql = `${bboxExpr} AND etat_de_l_objet <> 'En service'`;
  const lostRailUrl = `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BDTOPO_V3%3Atroncon_de_voie_ferree&CQL_FILTER=${encodeURIComponent(
    lostRailCql
  )}&COUNT=8&OUTPUTFORMAT=application/json`;

  const [ldRes, railRes] = await Promise.allSettled([
    fetchWithTimeout(lieuxDitsUrl, {}, 3500).then((r) => (r.ok ? r.json() : null)),
    fetchWithTimeout(lostRailUrl, {}, 3500).then((r) => (r.ok ? r.json() : null)),
  ]);

  const out: RawPoi[] = [];

  if (ldRes.status === 'fulfilled' && ldRes.value?.features) {
    const candidates: Array<{ feat: any; info: ReturnType<typeof explainHistoricalToponym> }> = [];
    for (const f of ldRes.value.features) {
      const top = String(f.properties?.toponyme || '').trim();
      if (!top || top.length < 3) continue;
      candidates.push({ feat: f, info: explainHistoricalToponym(top) });
    }
    // Prioritize evocative etymological toponyms first, plus up to 2 classic local lieux-dits
    candidates.sort((a, b) => Number(b.info.evocative) - Number(a.info.evocative));
    let genericCount = 0;

    for (const { feat, info } of candidates) {
      if (!info.evocative) {
        if (genericCount >= 2) continue;
        genericCount += 1;
      }
      const pos = extractFirstCoordFromGeoJson(feat.geometry);
      if (!pos) continue;
      const top = String(feat.properties?.toponyme || '').trim();

      out.push({
        id: sanitizeId(`ign_toponym_${feat.properties?.cleabs || feat.id}`),
        name: `Lieu-dit « ${top} »`.slice(0, 180),
        mysteryTitle: info.evocative ? 'Énigme Toponymique' : 'Nom de Terre Ancien',
        category: info.category,
        subType: info.evocative ? 'Toponyme historique révélateur' : 'Lieu-dit non habité (Cadastre / IGN)',
        stratum: info.stratum,
        eraLabel: info.eraLabel,
        source: 'Toponymie & Voies Disparues (IGN)',
        lat: pos.lat,
        lng: pos.lng,
        summary: `Lieu-dit ancien « ${top} » conservé dans le répertoire toponymique de l’IGN (BDNyme / BD TOPO). ${info.explanation}`,
        nearWaterway: /moulin|gué|bac|font|lavoir/i.test(top),
        waterwayName: '',
        safetyNotice: '',
        externalUrl: 'https://remonterletemps.ign.fr/',
        xpReward: info.evocative ? 145 : 115,
        unlockRadiusMeters: 85,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
      if (out.length >= 5) break;
    }
  }

  if (railRes.status === 'fulfilled' && railRes.value?.features) {
    let railAdded = 0;
    for (const f of railRes.value.features) {
      const p = f.properties || {};
      const coords = f.geometry?.coordinates;
      let pos: { lat: number; lng: number } | null = null;
      if (Array.isArray(coords) && coords.length > 0 && Array.isArray(coords[0])) {
        const mid = coords[Math.floor(coords.length / 2)];
        if (Array.isArray(mid) && mid.length >= 2) {
          pos = { lng: Number(mid[0]), lat: Number(mid[1]) };
        }
      }
      if (!pos) pos = extractFirstCoordFromGeoJson(f.geometry);
      if (!pos) continue;

      // Avoid clustering two segments of the same abandoned track right next to each other
      if (out.some((x) => haversineMeters(x.lat, x.lng, pos!.lat, pos!.lng) < 280)) continue;

      const etat = String(p.etat_de_l_objet || 'Non exploité');
      const railName = p.cpx_toponyme
        ? `Ancienne voie ferrée : ${p.cpx_toponyme}`
        : `Voie ferrée fantôme (${etat.toLowerCase()})`;

      out.push({
        id: sanitizeId(`ign_lostrail_${p.cleabs || f.id}`),
        name: railName.slice(0, 180),
        mysteryTitle: 'Rails Fantômes',
        category: 'etrange',
        subType: `Tronçon ferroviaire ${etat.toLowerCase()} (IGN)`,
        stratum: 'contemporain',
        eraLabel: 'Archéologie Ferroviaire (XIXe–XXe)',
        source: 'Toponymie & Voies Disparues (IGN)',
        lat: pos.lat,
        lng: pos.lng,
        summary: `${railName} — ancien tracé ferroviaire aujourd’hui ${etat.toLowerCase()} répertorié par l’IGN (${
          p.largeur ? `écartement ${String(p.largeur).toLowerCase()}` : 'voie historique'
        }). Ces lignes déclassées rappellent le maillage des tacots départementaux, embranchements industriels et ceintures ferroviaires du XIXe siècle.`,
        nearWaterway: false,
        waterwayName: '',
        safetyNotice: 'N’empruntez jamais une emprise ferroviaire fermée au public ou non aménagée en voie verte.',
        externalUrl: 'https://remonterletemps.ign.fr/',
        xpReward: 150,
        unlockRadiusMeters: 90,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
      railAdded += 1;
      if (railAdded >= 3) break;
    }
  }

  return out;
}

// ============================================================================
// 14. MÉMOIRE LITTÉRAIRE, ARTISTIQUE, CINÉMATOGRAPHIQUE & SOCIALE
// ============================================================================
async function queryCulturalAndLiteraryMemory(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<RawPoi[]> {
  const radiusKm = Math.min(Math.max((radiusMeters / 1000) * 1.35, 2.0), 4.8).toFixed(1);
  const sparql = `
SELECT DISTINCT ?work ?workLabel ?workDescription ?locLabel ?coord ?kind ?creatorLabel ?joconde ?bnf WHERE {
  SERVICE wikibase:around {
    ?loc wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${radiusKm}" .
  }
  {
    ?work wdt:P180 ?loc ; wdt:P31/wdt:P279* wd:Q3305213 .
    OPTIONAL { ?work wdt:P170 ?creator . }
    OPTIONAL { ?work wdt:P347 ?joconde . }
    BIND("peinture" AS ?kind)
  }
  UNION
  {
    ?work wdt:P840 ?loc ; wdt:P31/wdt:P279* wd:Q7725634 .
    OPTIONAL { ?work wdt:P50 ?creator . }
    OPTIONAL { ?work wdt:P268 ?bnf . }
    BIND("roman" AS ?kind)
  }
  UNION
  {
    ?work wdt:P915 ?loc ; wdt:P31/wdt:P279* wd:Q11424 .
    OPTIONAL { ?work wdt:P57 ?creator . }
    BIND("cinema" AS ?kind)
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}
LIMIT 12
`;

  const wpMemSearch = `nearcoord:8km,${lat},${lng} ("peint par" OR "lieu de tournage" OR "cité dans" OR écrivain OR poète OR gravure OR Résistance OR grève)`;
  const wpMemUrl = `https://fr.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    wpMemSearch
  )}&gsrlimit=6&prop=coordinates|extracts|info&inprop=url&exintro=1&explaintext=1&exlimit=max&exchars=850&format=json`;

  const [wdRes, wpRes] = await Promise.allSettled([
    fetchWithTimeout(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`,
      { headers: { Accept: 'application/sparql-results+json' } },
      4200
    ).then((r) => (r.ok ? r.json() : null)),
    fetchWithTimeout(wpMemUrl, {}, 3800).then((r) => (r.ok ? r.json() : null)),
  ]);

  const out: RawPoi[] = [];

  if (wdRes.status === 'fulfilled' && wdRes.value?.results?.bindings) {
    const seenWork = new Set<string>();
    for (const b of wdRes.value.results.bindings) {
      const uri = String(b.work?.value || '');
      const qid = uri.split('/').pop() || '';
      const workLabel = String(b.workLabel?.value || '').trim();
      if (!qid || seenWork.has(qid) || !workLabel || /^Q\d+$/.test(workLabel)) continue;
      seenWork.add(qid);

      const m = String(b.coord?.value || '').match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
      if (!m) continue;
      const pLng = Number(m[1]) - 0.00022;
      const pLat = Number(m[2]) + 0.00022;

      const kind = String(b.kind?.value || 'roman');
      const creator =
        b.creatorLabel?.value && !/^Q\d+$/.test(b.creatorLabel.value) ? b.creatorLabel.value : '';
      const locName =
        b.locLabel?.value && !/^Q\d+$/.test(b.locLabel.value) ? b.locLabel.value : 'ce lieu';
      const joconde = b.joconde?.value || '';

      const titlePrefix =
        kind === 'peinture'
          ? 'Regard de peintre'
          : kind === 'cinema'
          ? 'Scène de cinéma'
          : 'Scène littéraire';

      out.push({
        id: sanitizeId(`cult_wd_${qid}`),
        name: `${titlePrefix} : « ${workLabel} »`.slice(0, 180),
        mysteryTitle:
          kind === 'peinture'
            ? 'Toile & Estampe d’Antan'
            : kind === 'cinema'
            ? 'Bobine & Décor Réel'
            : 'Page de Roman sur Place',
        category: kind === 'roman' ? 'legende' : 'histoire',
        subType:
          kind === 'peinture'
            ? 'Tableau / Iconographie (Musées & Joconde)'
            : kind === 'cinema'
            ? 'Lieu de tournage cinématographique'
            : 'Lieu de récit littéraire (BnF / Lettres)',
        stratum: kind === 'peinture' ? 'moderne' : 'contemporain',
        eraLabel:
          kind === 'peinture'
            ? 'Mémoire Picturale & Estampes'
            : kind === 'cinema'
            ? 'Mémoire du Septième Art'
            : 'Géographie Littéraire',
        source: 'Mémoire Littéraire, Arts & Cinéma',
        lat: pLat,
        lng: pLng,
        summary: [
          `À hauteur de « ${locName} » s’ancre l’œuvre « ${workLabel} »${
            creator ? ` signée ${creator}` : ''
          }.`,
          b.workDescription?.value ? `${b.workDescription.value}.` : '',
          joconde ? `Conservé dans les collections des Musées de France (Base Joconde ${joconde}).` : '',
        ]
          .filter(Boolean)
          .join(' ')
          .slice(0, 2100),
        nearWaterway: false,
        waterwayName: '',
        safetyNotice: '',
        externalUrl: joconde
          ? `https://pop.culture.gouv.fr/notice/joconde/${encodeURIComponent(joconde)}`
          : uri,
        xpReward: 145,
        unlockRadiusMeters: 90,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
      if (out.length >= 6) break;
    }
  }

  if (wpRes.status === 'fulfilled' && wpRes.value?.query?.pages) {
    const pages = Object.values(wpRes.value.query.pages) as Array<{
      pageid: number;
      title: string;
      extract?: string;
      fullurl?: string;
      coordinates?: Array<{ lat: number; lon: number }>;
    }>;
    for (const p of pages) {
      const coord = p.coordinates?.[0];
      if (!coord || !p.title) continue;
      if (haversineMeters(lat, lng, coord.lat, coord.lon) > 6500) continue;
      const extract = (p.extract || '').trim();
      if (extract.length < 35) continue;

      out.push({
        id: sanitizeId(`cult_wp_${p.pageid}`),
        name: p.title.slice(0, 180),
        mysteryTitle: 'Écho Artistique ou Social',
        category: 'histoire',
        subType: 'Mémoire sociale, littéraire ou artistique',
        stratum: 'contemporain',
        eraLabel: 'Chroniques Sociales & Arts',
        source: 'Mémoire Littéraire, Arts & Cinéma',
        lat: coord.lat,
        lng: coord.lon,
        summary: extract.slice(0, 2100),
        nearWaterway: false,
        waterwayName: '',
        safetyNotice: '',
        externalUrl: p.fullurl || `https://fr.wikipedia.org/?curid=${p.pageid}`,
        xpReward: 140,
        unlockRadiusMeters: 90,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      });
      if (out.length >= 9) break;
    }
  }

  return out.slice(0, 8);
}

function enrichAndLinkPois(
  allSourcesPois: RawPoi[],
  terrain: TerrainFeature[],
  centerLat: number,
  centerLng: number
): RawPoi[] {
  const merged: RawPoi[] = [];

  for (const candidate of allSourcesPois) {
    const duplicate = merged.find(
      (existing) => haversineMeters(existing.lat, existing.lng, candidate.lat, candidate.lng) < 36
    );
    if (duplicate) {
      if (candidate.summary.length > duplicate.summary.length) {
        duplicate.summary = `${candidate.summary} (Sources croisées : ${duplicate.source} & ${candidate.source})`.slice(
          0,
          2350
        );
      }
      if (!duplicate.source.includes(candidate.source)) {
        duplicate.source = `${duplicate.source} + ${candidate.source}`.slice(0, 85);
      }
      if (candidate.category === 'legende') {
        duplicate.category = 'legende';
        duplicate.subType = candidate.subType;
      }
      duplicate.xpReward = Math.max(duplicate.xpReward, candidate.xpReward + 15);
    } else {
      merged.push(candidate);
    }
  }

  // Compute river/waterway proximity against real Z15 water polygons & waterway lines
  const waterways = terrain.filter((t) => t.kind === 'waterway' || t.kind === 'water');
  for (const poi of merged) {
    if (poi.nearWaterway) continue;
    let bestDist = Infinity;
    let bestWaterName = '';
    for (const ww of waterways) {
      for (const pt of ww.points) {
        const d = haversineMeters(poi.lat, poi.lng, pt.lat, pt.lng);
        if (d < bestDist) {
          bestDist = d;
          bestWaterName = ww.name;
        }
      }
    }
    if (bestDist <= 185) {
      poi.nearWaterway = true;
      poi.waterwayName = bestWaterName || 'Cours d’eau';
    }
  }

  // Balanced selection across sources & categories so specialized archives are never drowned out by dense urban OSM/WP
  const bySource = new Map<string, RawPoi[]>();
  for (const poi of merged) {
    const primarySource = poi.source.split('+')[0].trim();
    const bucket = bySource.get(primarySource) || [];
    bucket.push(poi);
    bySource.set(primarySource, bucket);
  }
  for (const bucket of bySource.values()) {
    bucket.sort(
      (a, b) =>
        haversineMeters(centerLat, centerLng, a.lat, a.lng) -
        haversineMeters(centerLat, centerLng, b.lat, b.lng)
    );
  }

  const balanced: RawPoi[] = [];
  let round = 0;
  while (balanced.length < 96) {
    let addedInRound = false;
    for (const bucket of bySource.values()) {
      if (round < bucket.length) {
        balanced.push(bucket[round]);
        addedInRound = true;
        if (balanced.length >= 96) break;
      }
    }
    if (!addedInRound) break;
    round += 1;
  }

  // Semantic relationships across strata, waterways, and folklore/underground/archaeology pairs
  for (let i = 0; i < balanced.length; i++) {
    const a = balanced[i];
    const candidates: Array<{ poi: RawPoi; score: number }> = [];
    for (let j = 0; j < balanced.length; j++) {
      if (i === j) continue;
      const b = balanced[j];
      const dist = haversineMeters(a.lat, a.lng, b.lat, b.lng);
      if (dist > 2400) continue;

      let score = 0;
      if (a.nearWaterway && b.nearWaterway && a.waterwayName && a.waterwayName === b.waterwayName) score += 5;
      if (a.stratum === b.stratum && a.stratum !== 'vivant_folklore' && dist < 1600) score += 4;
      if (a.category === b.category && dist < 900) score += 3;
      if (
        (a.category === 'legende' && b.category === 'etrange') ||
        (a.category === 'etrange' && b.category === 'legende')
      ) {
        score += 4;
      }
      if (dist < 380) score += 2.5;

      if (score > 0) {
        candidates.push({ poi: b, score: score - dist / 1200 });
      }
    }
    candidates.sort((x, y) => y.score - x.score);
    const top = candidates.slice(0, 4);
    a.relatedPoiIds = top.map((c) => c.poi.id);
    a.relatedPoiTitles = top.map((c) => c.poi.name);
  }

  return balanced;
}

/**
 * Queries official French BRGM / Géorisques BDCavités national subterranean cavities database
 * (natural caves/dolines, underground quarries, wine/urban cellars, mine galleries, civil/military works).
 */
async function queryGeorisquesCavites(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<{ cavitePois: RawPoi[]; caviteFeatures: SubterraneanFeature[] }> {
  // BDCavités covers France (mainland + Corsica + DOM); skip fast outside relevant bounds
  const inMainlandFrance = lat >= 41.2 && lat <= 51.3 && lng >= -5.4 && lng <= 9.8;
  const inDom =
    (lat >= 14.2 && lat <= 18.2 && lng >= -63.3 && lng <= -60.7) ||
    (lat >= -21.5 && lat <= -12.5 && lng >= 44.9 && lng <= 56.0) ||
    (lat >= 2.0 && lat <= 5.9 && lng >= -54.7 && lng <= -51.5);
  if (!inMainlandFrance && !inDom) {
    return { cavitePois: [], caviteFeatures: [] };
  }

  try {
    const rayon = Math.min(4200, Math.max(1600, Math.round(radiusMeters * 1.25)));
    const url = `https://www.georisques.gouv.fr/api/v1/cavites?latlon=${encodeURIComponent(
      `${lng.toFixed(5)},${lat.toFixed(5)}`
    )}&rayon=${rayon}&page_size=50`;
    const resp = await fetchWithTimeout(url, {}, 3800);
    if (!resp.ok) return { cavitePois: [], caviteFeatures: [] };

    const json = (await resp.json()) as {
      data?: Array<{
        identifiant?: string;
        type?: string;
        nom?: string | null;
        reperage_geo?: string | null;
        departement?: { code?: string; nom?: string };
        longitude?: number;
        latitude?: number;
      }>;
    };
    const rows = Array.isArray(json.data) ? json.data : [];
    if (rows.length === 0) return { cavitePois: [], caviteFeatures: [] };

    const scored: Array<{
      dist: number;
      named: boolean;
      feat: SubterraneanFeature;
      poi: RawPoi;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const cLat = Number(r.latitude);
      const cLng = Number(r.longitude);
      if (!Number.isFinite(cLat) || !Number.isFinite(cLng)) continue;
      const dist = haversineMeters(lat, lng, cLat, cLng);
      if (dist > rayon + 300) continue;

      const rawType = String(r.type || 'indéterminé').trim().toLowerCase();
      const rawNom = String(r.nom || '').trim();
      const ident = String(r.identifiant || `cav_${i}`).trim();
      const repGeo = String(r.reperage_geo || 'Inventaire BRGM').trim();
      const deptLabel = r.departement?.nom ? ` (${r.departement.nom})` : '';

      let subKind: SubterraneanKind = 'cave_cellar';
      let typeLabelFr = 'Cavité souterraine recensée';
      let mysteryTitle = 'Chambre Souterraine';
      let stratum: HistoricalStratum = 'moderne';
      let eraLabel = 'Sous-sol historique';

      if (rawType.includes('carri')) {
        subKind = 'quarry';
        typeLabelFr = 'Ancienne carrière souterraine';
        mysteryTitle = 'Piliers des Carrières';
        stratum = 'moderne';
        eraLabel = 'Extraction souterraine';
      } else if (rawType.includes('naturel')) {
        subKind = 'natural_cave';
        typeLabelFr = 'Cavité karstique naturelle / aven';
        mysteryTitle = 'Gouffre & Karst';
        stratum = 'temps_profond';
        eraLabel = 'Karst & Temps profond';
      } else if (rawType.includes('mine')) {
        subKind = 'mine';
        typeLabelFr = 'Galerie ou puits minier';
        mysteryTitle = 'Veine Minière';
        stratum = 'contemporain';
        eraLabel = 'Patrimoine minier';
      } else if (rawType.includes('militaire')) {
        subKind = 'military';
        typeLabelFr = 'Souterrain ou abri militaire';
        mysteryTitle = 'Casemate Enfouie';
        stratum = 'contemporain';
        eraLabel = 'Ouvrage défensif';
      } else if (rawType.includes('civil')) {
        subKind = 'crypt';
        typeLabelFr = 'Ouvrage souterrain civil (aqueduc, galerie, sappe)';
        mysteryTitle = 'Voûte Enfouie';
        stratum = 'moyen_age';
        eraLabel = 'Génie civil ancien';
      } else if (rawType.includes('cave')) {
        subKind = 'cave_cellar';
        typeLabelFr = 'Cave voûtée ou cellier profond';
        mysteryTitle = 'Cellier Voûté';
        stratum = 'moderne';
        eraLabel = 'Caves & fondations';
      }

      const cleanNom =
        rawNom && rawNom.toLowerCase() !== 'inconnu' && rawNom.toLowerCase() !== 'sans nom'
          ? rawNom
          : '';
      const displayTitle = cleanNom
        ? `${typeLabelFr} — ${cleanNom}`
        : `${typeLabelFr} (${ident})`;

      const feat: SubterraneanFeature = {
        id: sanitizeId(`bdcav_${ident}`),
        kind: subKind,
        name: displayTitle.slice(0, 140),
        points: [{ lat: cLat, lng: cLng }],
        depthLabel: repGeo,
        source: 'BRGM Géorisques · BDCavités',
      };

      const poi: RawPoi = {
        id: sanitizeId(`poi_bdcav_${ident}`),
        name: displayTitle.slice(0, 175),
        mysteryTitle,
        category: subKind === 'natural_cave' ? 'geographie' : 'etrange',
        subType: typeLabelFr,
        stratum,
        eraLabel,
        source: 'BRGM Géorisques · BDCavités',
        lat: cLat,
        lng: cLng,
        summary: `[${eraLabel}] ${displayTitle}${deptLabel} — cavité souterraine répertoriée par le BRGM dans la base nationale BDCavités (dossier ${ident}, repérage : ${repGeo.toLowerCase()}). Témoin discret des vides karstiques, carrières de pierre ou caves historiques qui façonnent le sous-sol local.`,
        nearWaterway: false,
        waterwayName: '',
        safetyNotice:
          'Cavité souterraine recensée (risque d’effondrement, gaz ou accès privé/interdit) : restez en surface et ne pénétrez jamais hors site aménagé.',
        externalUrl: 'https://www.georisques.gouv.fr/risques/cavites-souterraines',
        xpReward: cleanNom ? 140 : 125,
        unlockRadiusMeters: 90,
        relatedPoiIds: [],
        relatedPoiTitles: [],
      };

      scored.push({
        dist,
        named: cleanNom.length > 0,
        feat,
        poi,
      });
    }

    scored.sort((a, b) => {
      if (a.named !== b.named && Math.abs(a.dist - b.dist) < 500) {
        return a.named ? -1 : 1;
      }
      return a.dist - b.dist;
    });

    return {
      caviteFeatures: scored.slice(0, 48).map((s) => s.feat),
      cavitePois: scored.slice(0, 9).map((s) => s.poi),
    };
  } catch {
    return { cavitePois: [], caviteFeatures: [] };
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.get('/api/explore', async (req: Request, res: Response) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Math.min(Math.max(Number(req.query.radius) || 1800, 600), 4500);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({ error: 'Coordonnées GPS invalides.' });
      return;
    }

    // Snap cache key to ~245m cells so backtracking & adjacent walks share warm sector payloads
    const snapLat = Math.round(lat * 450) / 450;
    const snapLng = Math.round(lng * 450) / 450;
    const cacheKey = `v15_${snapLat.toFixed(4)}_${snapLng.toFixed(4)}_${Math.round(radius / 200)}`;
    const cached = sectorCache.get(cacheKey);
    if (cached) {
      res.setHeader('Cache-Control', 'private, max-age=120, stale-while-revalidate=300');
      res.json(cached.data);
      return;
    }

    const existingInFlight = inFlightSectorRequests.get(cacheKey);
    if (existingInFlight) {
      try {
        const sharedPayload = await existingInFlight;
        res.setHeader('Cache-Control', 'private, max-age=120, stale-while-revalidate=300');
        res.json(sharedPayload);
      } catch {
        res.status(502).json({ error: 'Erreur temporaire lors du sondage du secteur.' });
      }
      return;
    }

    const buildSectorPromise = (async (): Promise<SectorPayload> => {

    const queryOpenMeteoWeather = async (wLat: number, wLng: number): Promise<WeatherInfo | null> => {
      const wKey = `${wLat.toFixed(2)}_${wLng.toFixed(2)}`;
      const wHit = weatherCache.get(wKey);
      if (wHit && wHit.expires > Date.now()) return wHit.data;
      try {
        const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
          wLat.toFixed(4)
        )}&longitude=${encodeURIComponent(
          wLng.toFixed(4)
        )}&current=temperature_2m,weather_code,wind_speed_10m,is_day&timezone=auto`;
        const wResp = await fetchWithTimeout(wUrl, {}, 3400);
        if (!wResp.ok) return null;
        const wJson = (await wResp.json()) as {
          current?: {
            temperature_2m?: number;
            weather_code?: number;
            wind_speed_10m?: number;
            is_day?: number;
          };
        };
        if (!wJson.current) return null;
        const code = Number(wJson.current.weather_code ?? 0);
        const tempC = Math.round(Number(wJson.current.temperature_2m ?? 15));
        const windKmh = Math.round(Number(wJson.current.wind_speed_10m ?? 8));
        const isDay = Number(wJson.current.is_day ?? 1) === 1;

        let condition: WeatherInfo['condition'] = 'clear';
        let labelFr = isDay ? 'Ciel dégagé' : 'Nuit étoilée';
        if (code >= 95) {
          condition = 'storm';
          labelFr = 'Orage local';
        } else if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
          condition = 'snow';
          labelFr = 'Averses de neige';
        } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
          condition = 'rain';
          labelFr = code >= 63 || code >= 81 ? 'Pluie soutenue' : 'Pluie fine & bruine';
        } else if (code === 45 || code === 48) {
          condition = 'fog';
          labelFr = 'Brume & brouillard';
        } else if (code >= 2 && code <= 3) {
          condition = 'cloudy';
          labelFr = 'Ciel nuageux';
        } else if (code === 1) {
          condition = 'clear';
          labelFr = isDay ? 'Éclaircies' : 'Nuit claire';
        }

        const info: WeatherInfo = { condition, tempC, windKmh, isDay, labelFr };
        weatherCache.set(wKey, { expires: Date.now() + 15 * 60 * 1000, data: info });
        return info;
      } catch {
        return null;
      }
    };

    const [
      topoRes,
      elevRes,
      weatherRes,
      wikiRes,
      folkRes,
      wdRes,
      geoRes,
      fossilRes,
      bioRes,
      microSubRes,
      ignRes,
      archeoRes,
      inpnTreeRes,
      indusPalissyRes,
      toponymRailRes,
      cultMemRes,
      cavitesRes,
    ] = await Promise.allSettled([
      queryVectorTileTopology(lat, lng),
      querySectorElevationGrid(lat, lng),
      queryOpenMeteoWeather(lat, lng),
      queryWikipediaFr(lat, lng, radius),
      queryFolkloreAndLegends(lat, lng),
      queryWikidataSparql(lat, lng, radius),
      queryMacrostratGeology(lat, lng),
      queryPaleobioFossils(lat, lng),
      queryBiodiversity(lat, lng, radius),
      queryMicroHistoryAndSubterranean(lat, lng, radius),
      queryIgnBdTopoLocalHeritage(lat, lng, radius),
      queryPreventiveArchaeology(lat, lng, radius),
      queryInpnPatrinatAndTrees(lat, lng, radius),
      queryIndustrialFrichesAndPalissy(lat, lng, radius),
      queryHistoricalToponymyAndLostRails(lat, lng, radius),
      queryCulturalAndLiteraryMemory(lat, lng, radius),
      queryGeorisquesCavites(lat, lng, radius),
    ]);

    const topoData =
      topoRes.status === 'fulfilled'
        ? topoRes.value
        : { terrain: [], pois: [], subterranean: [] };
    const elevationData = elevRes.status === 'fulfilled' ? elevRes.value : null;
    const weatherData = weatherRes.status === 'fulfilled' ? weatherRes.value : null;
    const wikiPois = wikiRes.status === 'fulfilled' ? wikiRes.value : [];
    const folkPois = folkRes.status === 'fulfilled' ? folkRes.value : [];
    const wdPois = wdRes.status === 'fulfilled' ? wdRes.value : [];
    const geoData = geoRes.status === 'fulfilled' ? geoRes.value : { bedrock: null, geoPois: [] };
    const fossilPois = fossilRes.status === 'fulfilled' ? fossilRes.value : [];
    const bioPois = bioRes.status === 'fulfilled' ? bioRes.value : [];
    const microSubData =
      microSubRes.status === 'fulfilled'
        ? microSubRes.value
        : { microHistory: [], subterraneanWater: [] };
    const ignPois = ignRes.status === 'fulfilled' ? ignRes.value : [];
    const archeoPois = archeoRes.status === 'fulfilled' ? archeoRes.value : [];
    const inpnTreeData =
      inpnTreeRes.status === 'fulfilled'
        ? inpnTreeRes.value
        : { inpnGeoEco: [], remarkableTrees: [] };
    const indusPalissyData =
      indusPalissyRes.status === 'fulfilled'
        ? indusPalissyRes.value
        : { palissyPois: [], industrialFriches: [] };
    const toponymRailPois = toponymRailRes.status === 'fulfilled' ? toponymRailRes.value : [];
    const cultMemPois = cultMemRes.status === 'fulfilled' ? cultMemRes.value : [];
    const cavitesData =
      cavitesRes.status === 'fulfilled'
        ? cavitesRes.value
        : { cavitePois: [], caviteFeatures: [] };

    const sourcesActive: string[] = [];
    if (
      topoData.terrain.length > 0 ||
      topoData.pois.length > 0 ||
      topoData.subterranean.length > 0
    ) {
      sourcesActive.push('Topologie OSM (Z15)');
    }
    if (elevationData) {
      sourcesActive.push(elevationData.sourceLabel);
    }
    if (cavitesData.caviteFeatures.length > 0) {
      sourcesActive.push('BRGM Géorisques · BDCavités');
    }
    if (ignPois.length > 0) sourcesActive.push('IGN BD TOPO');
    if (toponymRailPois.length > 0) sourcesActive.push('Toponymie & Voies Disparues (IGN)');
    if (archeoPois.length > 0) sourcesActive.push('Archéologie & Fouilles (Atlas / INRAP)');
    if (inpnTreeData.inpnGeoEco.length > 0) sourcesActive.push('INPN · Géologie INPG & ZNIEFF');
    if (inpnTreeData.remarkableTrees.length > 0) {
      sourcesActive.push('Arbres Remarquables & Sites Classés');
    }
    if (indusPalissyData.palissyPois.length > 0) {
      sourcesActive.push('Base Palissy (Mobilier Classé)');
    }
    if (indusPalissyData.industrialFriches.length > 0) {
      sourcesActive.push('Friches & Mémoire Industrielle');
    }
    if (cultMemPois.length > 0) sourcesActive.push('Mémoire Littéraire, Arts & Cinéma');
    if (microSubData.microHistory.length > 0) sourcesActive.push('Micro-Histoire & Plaques');
    if (microSubData.subterraneanWater.length > 0) sourcesActive.push('BRGM Sous-Sol & Nappes (Hub’Eau)');
    if (wikiPois.length > 0) sourcesActive.push('Wikipédia FR');
    if (wdPois.length > 0) sourcesActive.push('Wikidata & Base Mérimée');
    if (folkPois.length > 0) sourcesActive.push('Folklore & Légendes');
    if (geoData.bedrock || geoData.geoPois.length > 0) sourcesActive.push('Macrostrat Géologie');
    if (fossilPois.length > 0) sourcesActive.push('Paleobiology DB');
    if (bioPois.length > 0) sourcesActive.push('iNaturalist & GBIF');

    // Feed specialized & newly added archives FIRST so deduplication preserves their rich provenance!
    const pois = enrichAndLinkPois(
      [
        ...cavitesData.cavitePois,
        ...inpnTreeData.inpnGeoEco,
        ...inpnTreeData.remarkableTrees,
        ...archeoPois,
        ...indusPalissyData.palissyPois,
        ...indusPalissyData.industrialFriches,
        ...toponymRailPois,
        ...cultMemPois,
        ...folkPois,
        ...ignPois,
        ...microSubData.microHistory,
        ...microSubData.subterraneanWater,
        ...geoData.geoPois,
        ...fossilPois,
        ...wikiPois,
        ...wdPois,
        ...topoData.pois,
        ...bioPois,
      ],
      topoData.terrain,
      lat,
      lng
    );

    // Assemble unified subterranean cartography (MVT tunnels/metro/culverts + BRGM BDCavités + BSS aquifers + IGN/heritage caves/crypts)
    const combinedSubterranean: SubterraneanFeature[] = [
      ...topoData.subterranean,
      ...cavitesData.caviteFeatures,
    ];
    const seenSubNodes = new Set<string>();
    for (const sf of combinedSubterranean) {
      if (!sf.isLine && sf.points[0]) {
        seenSubNodes.add(`${sf.points[0].lat.toFixed(4)}_${sf.points[0].lng.toFixed(4)}`);
      }
    }

    for (const wPoi of microSubData.subterraneanWater) {
      const k = `${wPoi.lat.toFixed(4)}_${wPoi.lng.toFixed(4)}`;
      if (seenSubNodes.has(k)) continue;
      seenSubNodes.add(k);
      combinedSubterranean.push({
        id: `sub_bss_${wPoi.id}`,
        kind: 'well_aquifer',
        name: wPoi.name,
        points: [{ lat: wPoi.lat, lng: wPoi.lng }],
        source: wPoi.source,
      });
    }

    for (const hPoi of [...ignPois, ...pois]) {
      const hay = `${hPoi.name} ${hPoi.subType}`.toLowerCase();
      if (
        !/catacomb|crypte|carri[èe]re|souterrain|traboule|grotte|gouffre|aven|doline|mine|casemate|abri|bunker|aqueduc|[ée]gout|puits|r[ée]surgence|perte/.test(
          hay
        )
      ) {
        continue;
      }
      const k = `${hPoi.lat.toFixed(4)}_${hPoi.lng.toFixed(4)}`;
      if (seenSubNodes.has(k)) continue;
      seenSubNodes.add(k);
      const inferredKind: SubterraneanKind = /carri[èe]re|catacomb/.test(hay)
        ? 'quarry'
        : /grotte|gouffre|aven|doline|r[ée]surgence|perte/.test(hay)
        ? 'natural_cave'
        : /mine/.test(hay)
        ? 'mine'
        : /casemate|bunker|abri/.test(hay)
        ? 'military'
        : /puits|aqueduc|[ée]gout/.test(hay)
        ? 'well_aquifer'
        : 'crypt';
      combinedSubterranean.push({
        id: `sub_poi_${hPoi.id}`,
        kind: inferredKind,
        name: hPoi.name,
        points: [{ lat: hPoi.lat, lng: hPoi.lng }],
        source: hPoi.source,
      });
    }

    const payload: SectorPayload = {
      center: { lat, lng },
      radiusMeters: radius,
      pois,
      terrain: topoData.terrain,
      subterranean: combinedSubterranean.slice(0, 220),
      bedrock: geoData.bedrock,
      elevation: elevationData,
      weather: weatherData,
      sourcesActive,
      fetchedAt: new Date().toISOString(),
    };

    if (pois.length > 0 || topoData.terrain.length > 0) {
      sectorCache.set(cacheKey, { expires: Date.now() + 20 * 60 * 1000, data: payload });
    }

    return payload;
    })();

    inFlightSectorRequests.set(cacheKey, buildSectorPromise);
    try {
      const payload = await buildSectorPromise;
      res.setHeader('Cache-Control', 'private, max-age=120, stale-while-revalidate=300');
      res.json(payload);
    } catch {
      res.status(502).json({ error: 'Erreur temporaire lors du sondage du secteur.' });
    } finally {
      inFlightSectorRequests.delete(cacheKey);
    }
  });

  app.get('/api/geocode', async (req: Request, res: Response) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      res.json({ results: [] });
      return;
    }
    const normQ = q.toLowerCase();
    const cachedGeo = geocodeCache.get(normQ);
    if (cachedGeo) {
      res.json({ results: cachedGeo.results });
      return;
    }
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=fr&q=${encodeURIComponent(
        q
      )}`;
      const resp = await fetchWithTimeout(url, {}, 6000);
      if (!resp.ok) {
        res.json({ results: [] });
        return;
      }
      const raw = (await resp.json()) as Array<{ display_name: string; lat: string; lon: string }>;
      const results = raw.map((item) => ({
        label: item.display_name,
        lat: Number(item.lat),
        lng: Number(item.lon),
      }));
      if (results.length > 0) {
        geocodeCache.set(normQ, { expires: Date.now() + 30 * 60 * 1000, results });
      }
      res.json({ results });
    } catch {
      res.json({ results: [] });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(
      '/assets',
      express.static(path.join(distPath, 'assets'), {
        maxAge: '1y',
        immutable: true,
      })
    );
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('index.html') ||
            filePath.endsWith('sw.js') ||
            filePath.endsWith('manifest.webmanifest') ||
            /workbox-[a-zA-Z0-9_-]+\.js$/.test(filePath)
          ) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      })
    );
    app.get('*', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Terra 16 server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
