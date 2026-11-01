import { getAllStoredPhotos, importStoredPhotos, StoredFieldPhoto } from './photoStore';
import {
  CollectedSpecimen,
  ExplorerProgress,
  haversineMeters,
  NpcEncounterRecord,
  RumorLead,
  SectorPayloadData,
  UnlockedEntry,
} from './types';

// ============================================================================
// 1. TERRA INCOGNITA — FOG OF WAR WORLD CELLS (~36m grid)
// ============================================================================
const FOG_STORAGE_KEY = 'terra16_fog_cells_v1';
const FOG_SCALE = 2500; // 1 / 2500 deg lat ≈ 44 m

export function fogCoordsFromLatLng(lat: number, lng: number): { fx: number; fy: number } {
  const cosLat = Math.max(0.2, Math.cos((Math.round(lat * 4) / 4) * (Math.PI / 180)));
  return {
    fx: Math.floor(lng * FOG_SCALE * cosLat),
    fy: Math.floor(lat * FOG_SCALE),
  };
}

export function fogKeyFromCoords(fx: number, fy: number): string {
  return `${fx}_${fy}`;
}

export function loadRevealedFogSet(): Set<string> {
  try {
    const raw = localStorage.getItem(FOG_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.slice(-14000));
  } catch {
    return new Set();
  }
}

let pendingFogSetToSave: Set<string> | null = null;
let fogSaveTimerId: number | null = null;
let fogFlushListenersBound = false;

export function saveRevealedFogSet(set: Set<string>): void {
  pendingFogSetToSave = null;
  if (fogSaveTimerId !== null && typeof window !== 'undefined') {
    window.clearTimeout(fogSaveTimerId);
    fogSaveTimerId = null;
  }
  try {
    const arr = Array.from(set);
    const trimmed = arr.length > 14000 ? arr.slice(arr.length - 14000) : arr;
    localStorage.setItem(FOG_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota
  }
}

export function flushRevealedFogSet(): void {
  if (pendingFogSetToSave) {
    saveRevealedFogSet(pendingFogSetToSave);
  }
}

export function scheduleSaveRevealedFogSet(set: Set<string>, delayMs = 850): void {
  pendingFogSetToSave = set;
  if (typeof window === 'undefined') {
    saveRevealedFogSet(set);
    return;
  }
  if (!fogFlushListenersBound) {
    fogFlushListenersBound = true;
    window.addEventListener('pagehide', flushRevealedFogSet);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushRevealedFogSet();
      }
    });
  }
  if (fogSaveTimerId !== null) return;
  fogSaveTimerId = window.setTimeout(() => {
    fogSaveTimerId = null;
    flushRevealedFogSet();
  }, delayMs);
}

/**
 * Reveals circular fog-of-war cells around (lat, lng) within radiusMeters.
 * Returns a new Set if any new cell was uncovered, or null if unchanged.
 */
export function revealFogAroundPlayer(
  lat: number,
  lng: number,
  radiusMeters: number,
  existing: Set<string>
): Set<string> | null {
  const center = fogCoordsFromLatLng(lat, lng);
  const cellRadius = Math.max(2, Math.ceil(radiusMeters / 40));
  let changed = false;
  let next: Set<string> | null = null;

  for (let dy = -cellRadius; dy <= cellRadius; dy++) {
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      if (dx * dx + dy * dy > cellRadius * cellRadius + 1) continue;
      const key = fogKeyFromCoords(center.fx + dx, center.fy + dy);
      if (!existing.has(key)) {
        if (!next) next = new Set(existing);
        next.add(key);
        changed = true;
      }
    }
  }
  return changed ? next : null;
}

/**
 * Computes % of cells revealed within ~450m around the explorer's current position.
 */
export function computeLocalSectorExplorationPct(
  lat: number,
  lng: number,
  revealed: Set<string>
): number {
  const center = fogCoordsFromLatLng(lat, lng);
  const r = 10; // ~440m radius
  let total = 0;
  let uncovered = 0;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      total++;
      if (revealed.has(fogKeyFromCoords(center.fx + dx, center.fy + dy))) {
        uncovered++;
      }
    }
  }
  if (total === 0) return 0;
  return Math.min(100, Math.round((uncovered / total) * 100));
}

// ============================================================================
// 2. BESACE HORS-LIGNE — INDEXEDDB OFFLINE SECTOR SATCHEL
// ============================================================================
export interface CachedSectorRecord {
  id: string;
  label: string;
  centerLat: number;
  centerLng: number;
  poiCount: number;
  savedAtIso: string;
  payload: SectorPayloadData;
}

const BESACE_DB = 'terra16_offline_besace_v1';
const BESACE_STORE = 'sectors';

function openBesaceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BESACE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BESACE_STORE)) {
        db.createObjectStore(BESACE_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function buildSectorCacheId(lat: number, lng: number): string {
  return `sec_${lat.toFixed(2)}_${lng.toFixed(2)}`;
}

export async function saveSectorToBesace(
  label: string,
  payload: SectorPayloadData
): Promise<CachedSectorRecord[]> {
  const db = await openBesaceDb();
  const id = buildSectorCacheId(payload.center.lat, payload.center.lng);
  const record: CachedSectorRecord = {
    id,
    label: label.trim().slice(0, 90) || `Secteur ${payload.center.lat.toFixed(3)}°N, ${payload.center.lng.toFixed(3)}°E`,
    centerLat: payload.center.lat,
    centerLng: payload.center.lng,
    poiCount: payload.pois.length,
    savedAtIso: new Date().toISOString(),
    payload,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BESACE_STORE, 'readwrite');
    tx.objectStore(BESACE_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return listBesaceSectors();
}

export async function listBesaceSectors(): Promise<CachedSectorRecord[]> {
  try {
    const db = await openBesaceDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(BESACE_STORE, 'readonly');
      const req = tx.objectStore(BESACE_STORE).getAll();
      req.onsuccess = () => {
        const list = (req.result as CachedSectorRecord[]) || [];
        list.sort((a, b) => b.savedAtIso.localeCompare(a.savedAtIso));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function deleteBesaceSector(id: string): Promise<CachedSectorRecord[]> {
  const db = await openBesaceDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BESACE_STORE, 'readwrite');
    tx.objectStore(BESACE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return listBesaceSectors();
}

export async function findNearestBesaceSector(
  lat: number,
  lng: number,
  maxDistMeters = 2800
): Promise<CachedSectorRecord | null> {
  const all = await listBesaceSectors();
  let best: CachedSectorRecord | null = null;
  let bestDist = maxDistMeters;
  for (const rec of all) {
    const d = haversineMeters(lat, lng, rec.centerLat, rec.centerLng);
    if (d <= bestDist) {
      bestDist = d;
      best = rec;
    }
  }
  return best;
}

// ============================================================================
// 3. ARCHIVE COMPLÈTE DU GRIMOIRE (EXPORT / IMPORT JSON + PHOTOS + BROUILLARD)
// ============================================================================
export interface GrimoireArchiveBundle {
  format: 'terra16_grimoire_v1';
  exportedAtIso: string;
  progress: ExplorerProgress;
  entries: UnlockedEntry[];
  photos: StoredFieldPhoto[];
  fogCells: string[];
  encounters?: NpcEncounterRecord[];
  rumors?: RumorLead[];
  specimens?: CollectedSpecimen[];
}

const ENCOUNTERS_STORAGE_KEY = 'terra16_encounters_v1';
const RUMORS_STORAGE_KEY = 'terra16_rumors_v1';
const SPECIMENS_STORAGE_KEY = 'terra16_specimens_v1';

export function loadSavedEncounters(): NpcEncounterRecord[] {
  try {
    const raw = localStorage.getItem(ENCOUNTERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as NpcEncounterRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveEncountersToStorage(records: NpcEncounterRecord[]): void {
  try {
    localStorage.setItem(ENCOUNTERS_STORAGE_KEY, JSON.stringify(records.slice(0, 260)));
  } catch {
    // Ignore storage quota
  }
}

export function loadSavedRumorLeads(): RumorLead[] {
  try {
    const raw = localStorage.getItem(RUMORS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RumorLead[]) : [];
  } catch {
    return [];
  }
}

export function saveRumorLeadsToStorage(leads: RumorLead[]): void {
  try {
    localStorage.setItem(RUMORS_STORAGE_KEY, JSON.stringify(leads.slice(0, 120)));
  } catch {
    // Ignore storage quota
  }
}

export function loadSavedSpecimens(): CollectedSpecimen[] {
  try {
    const raw = localStorage.getItem(SPECIMENS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CollectedSpecimen[]) : [];
  } catch {
    return [];
  }
}

export function saveSpecimensToStorage(specimens: CollectedSpecimen[]): void {
  try {
    localStorage.setItem(SPECIMENS_STORAGE_KEY, JSON.stringify(specimens.slice(0, 64)));
  } catch {
    // Ignore storage quota
  }
}

export async function exportGrimoireArchiveJson(
  progress: ExplorerProgress,
  entries: UnlockedEntry[],
  fogSet: Set<string>,
  encounters: NpcEncounterRecord[] = [],
  rumors: RumorLead[] = [],
  specimens: CollectedSpecimen[] = []
): Promise<void> {
  const photos = await getAllStoredPhotos();
  const bundle: GrimoireArchiveBundle = {
    format: 'terra16_grimoire_v1',
    exportedAtIso: new Date().toISOString(),
    progress,
    entries,
    photos,
    fogCells: Array.from(fogSet).slice(-14000),
    encounters: encounters.slice(0, 260),
    rumors: rumors.slice(0, 120),
    specimens: specimens.slice(0, 64),
  };

  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateTag = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `terra16-grimoire-${dateTag}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function parseAndRestoreGrimoireArchive(file: File): Promise<{
  progress: ExplorerProgress;
  entries: UnlockedEntry[];
  fogCells: string[];
  encounters: NpcEncounterRecord[];
  rumors: RumorLead[];
  specimens: CollectedSpecimen[];
  importedPhotosCount: number;
}> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Partial<GrimoireArchiveBundle>;
  if (parsed.format !== 'terra16_grimoire_v1' || !Array.isArray(parsed.entries) || !parsed.progress) {
    throw new Error('Fichier d’archive Terra 16 non reconnu.');
  }

  const importedPhotosCount = await importStoredPhotos(parsed.photos || []);
  return {
    progress: parsed.progress,
    entries: parsed.entries,
    fogCells: Array.isArray(parsed.fogCells) ? parsed.fogCells : [],
    encounters: Array.isArray(parsed.encounters) ? parsed.encounters : [],
    rumors: Array.isArray(parsed.rumors) ? parsed.rumors : [],
    specimens: Array.isArray(parsed.specimens) ? parsed.specimens : [],
    importedPhotosCount,
  };
}
