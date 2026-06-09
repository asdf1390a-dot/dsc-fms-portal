// lib/assets/offline-cache.ts
//
// Phase 3 — offline mode for asset master.
//
// Provides a thin IndexedDB wrapper used by the Quick Update / Scan pages so
// field operators can look up assets and queue updates while disconnected.
//
// Stores:
//   - `assets`         keyPath: id              (mirrors a subset of the assets table)
//   - `pending_updates` keyPath: id (autoIncrement) — queued mutations awaiting sync
//
// All functions are SSR-safe: they short-circuit on the server.

export type CachedAsset = {
  id: string;
  machine_asset_number?: string | null;
  qr_payload?: string | null;
  name_en?: string | null;
  name_ko?: string | null;
  name_ta?: string | null;
  serial_no?: string | null;
  location?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

export type PendingUpdate = {
  id?: number;
  asset_id: string;
  patch: Record<string, unknown>;
  note?: string | null;
  created_at: number;
  attempts?: number;
};

const DB_NAME = 'dsc_fms_assets';
const DB_VERSION = 1;
const STORE_ASSETS = 'assets';
const STORE_PENDING = 'pending_updates';

function hasIDB(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIDB()) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        const s = db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
        s.createIndex('machine_asset_number', 'machine_asset_number', { unique: false });
        s.createIndex('qr_payload', 'qr_payload', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        db.createObjectStore(STORE_PENDING, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db: IDBDatabase, name: string, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(name, mode).objectStore(name);
}

function reqAsync<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

// ─── assets cache ────────────────────────────────────────────────

export async function cacheAssets(rows: CachedAsset[]): Promise<number> {
  if (!hasIDB() || !rows?.length) return 0;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_ASSETS, 'readwrite');
    const s = t.objectStore(STORE_ASSETS);
    let n = 0;
    rows.forEach((row) => {
      if (!row?.id) return;
      s.put(row);
      n += 1;
    });
    t.oncomplete = () => resolve(n);
    t.onerror = () => reject(t.error);
  });
}

export async function getCachedAssetCount(): Promise<number> {
  if (!hasIDB()) return 0;
  const db = await openDb();
  return reqAsync(tx(db, STORE_ASSETS, 'readonly').count());
}

export async function findCachedByPayload(payload: string): Promise<CachedAsset | null> {
  if (!hasIDB() || !payload) return null;
  const db = await openDb();
  const store = tx(db, STORE_ASSETS, 'readonly');
  const term = payload.trim();

  // 1. direct ID hit
  const byId = await reqAsync<CachedAsset | undefined>(store.get(term));
  if (byId) return byId;

  // 2. by machine_asset_number index
  try {
    const byTag = await reqAsync<CachedAsset | undefined>(
      store.index('machine_asset_number').get(term),
    );
    if (byTag) return byTag;
  } catch {}

  // 3. by qr_payload index
  try {
    const byQr = await reqAsync<CachedAsset | undefined>(
      store.index('qr_payload').get(term),
    );
    if (byQr) return byQr;
  } catch {}

  // 4. last URL segment fallback (in case QR encodes a URL)
  const lastSeg = (() => {
    try {
      const p = term.split('?')[0].split('#')[0];
      const segs = p.split('/').filter(Boolean);
      return segs[segs.length - 1] || null;
    } catch {
      return null;
    }
  })();
  if (lastSeg && lastSeg !== term) return findCachedByPayload(lastSeg);

  return null;
}

export async function clearAssetCache(): Promise<void> {
  if (!hasIDB()) return;
  const db = await openDb();
  await reqAsync(tx(db, STORE_ASSETS, 'readwrite').clear());
}

// ─── pending updates queue ───────────────────────────────────────

export async function queueUpdate(u: Omit<PendingUpdate, 'id' | 'created_at' | 'attempts'>): Promise<number> {
  if (!hasIDB()) throw new Error('IndexedDB not available');
  const db = await openDb();
  const row: PendingUpdate = {
    ...u,
    created_at: Date.now(),
    attempts: 0,
  };
  return reqAsync(tx(db, STORE_PENDING, 'readwrite').add(row)) as Promise<number>;
}

export async function listPending(): Promise<PendingUpdate[]> {
  if (!hasIDB()) return [];
  const db = await openDb();
  return reqAsync<PendingUpdate[]>(tx(db, STORE_PENDING, 'readonly').getAll());
}

export async function getPendingCount(): Promise<number> {
  if (!hasIDB()) return 0;
  const db = await openDb();
  return reqAsync(tx(db, STORE_PENDING, 'readonly').count());
}

export async function removePending(id: number): Promise<void> {
  if (!hasIDB()) return;
  const db = await openDb();
  await reqAsync(tx(db, STORE_PENDING, 'readwrite').delete(id));
}

export async function bumpAttempts(id: number): Promise<void> {
  if (!hasIDB()) return;
  const db = await openDb();
  const store = tx(db, STORE_PENDING, 'readwrite');
  const row = (await reqAsync(store.get(id))) as PendingUpdate | undefined;
  if (!row) return;
  row.attempts = (row.attempts || 0) + 1;
  await reqAsync(store.put(row));
}

// ─── sync helper ─────────────────────────────────────────────────

/**
 * Drain pending updates by POSTing to /api/assets/[id]/quick-update.
 * Caller supplies an `authHeader` getter that returns "Bearer <jwt>".
 * Returns the number of successfully synced updates.
 */
export async function syncPending(
  authHeader: () => Promise<string | null> | string | null,
): Promise<{ synced: number; failed: number }> {
  if (!hasIDB() || typeof fetch !== 'function') return { synced: 0, failed: 0 };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }
  const pending = await listPending();
  let synced = 0;
  let failed = 0;
  for (const p of pending) {
    try {
      const auth = (await authHeader()) || '';
      const res = await fetch(`/api/assets/${encodeURIComponent(p.asset_id)}/quick-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(auth ? { Authorization: auth } : {}),
        },
        body: JSON.stringify({ patch: p.patch, note: p.note || null, client_ts: p.created_at }),
      });
      if (res.ok) {
        if (p.id != null) await removePending(p.id);
        synced += 1;
      } else {
        if (p.id != null) await bumpAttempts(p.id);
        failed += 1;
      }
    } catch {
      if (p.id != null) await bumpAttempts(p.id);
      failed += 1;
    }
  }
  return { synced, failed };
}
