export interface StoredFieldPhoto {
  id: string;
  poiId: string;
  dataUrl: string;
  createdAtIso: string;
}

const DB_NAME = 'terra16_carnet_photos_v1';
const STORE_NAME = 'photos';

function openPhotoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_poi', 'poiId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function compressImageFile(file: File, maxDim = 1100): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire le fichier image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format d’image non reconnu.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export async function getPhotosForPoi(poiId: string): Promise<StoredFieldPhoto[]> {
  try {
    const db = await openPhotoDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const idx = tx.objectStore(STORE_NAME).index('by_poi');
      const req = idx.getAll(IDBKeyRange.only(poiId));
      req.onsuccess = () => {
        const list = (req.result as StoredFieldPhoto[]) || [];
        list.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function getAllStoredPhotos(): Promise<StoredFieldPhoto[]> {
  try {
    const db = await openPhotoDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as StoredFieldPhoto[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function importStoredPhotos(photos: StoredFieldPhoto[]): Promise<number> {
  if (!Array.isArray(photos) || photos.length === 0) return 0;
  try {
    const db = await openPhotoDb();
    let count = 0;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const ph of photos) {
        if (
          ph &&
          typeof ph.id === 'string' &&
          typeof ph.poiId === 'string' &&
          typeof ph.dataUrl === 'string' &&
          ph.dataUrl.startsWith('data:image/')
        ) {
          store.put({
            id: ph.id.slice(0, 180),
            poiId: ph.poiId.slice(0, 140),
            dataUrl: ph.dataUrl,
            createdAtIso: typeof ph.createdAtIso === 'string' ? ph.createdAtIso : new Date().toISOString(),
          });
          count++;
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return count;
  } catch {
    return 0;
  }
}

export async function addPhotoForPoi(poiId: string, file: File): Promise<StoredFieldPhoto[]> {
  const existing = await getPhotosForPoi(poiId);
  if (existing.length >= 20) {
    throw new Error('Limite de 20 photos atteinte pour cette page du Carnet.');
  }
  const dataUrl = await compressImageFile(file);
  const photo: StoredFieldPhoto = {
    id: `${poiId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    poiId,
    dataUrl,
    createdAtIso: new Date().toISOString(),
  };

  const db = await openPhotoDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(photo);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return getPhotosForPoi(poiId);
}

export async function deletePhotoById(photoId: string, poiId: string): Promise<StoredFieldPhoto[]> {
  const db = await openPhotoDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(photoId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return getPhotosForPoi(poiId);
}

export async function clearAllStoredPhotos(): Promise<void> {
  try {
    const db = await openPhotoDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore IndexedDB unavailability in restricted environments
  }
}

