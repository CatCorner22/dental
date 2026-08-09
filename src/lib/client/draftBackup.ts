import type { NoteState } from "@/lib/schema/types";

// LOCAL DRAFT BACKUP — IndexedDB ring + localStorage fallback.
//
// Survives tab crash, laptop sleep, and brief offline windows on the same
// device. Never a substitute for server autosave; deleted when the server
// confirms a save. De-identified note state only (same content as the draft).

const DB_NAME = "smile-notes-draft-backup";
const STORE = "mirrors";
const DB_VERSION = 1;
/** Keep the last N local snapshots per draft for "oops" recovery. */
export const LOCAL_BACKUP_KEEP = 8;

export interface DraftBackupSnapshot {
  draftId: string;
  note: NoteState;
  title: string;
  officeId: string | null;
  at: number;
  /** Monotonic local sequence within this draft's ring. */
  seq: number;
}

function localStorageKey(draftId: string): string {
  return `smile-notes.draft-backup.${draftId}`;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => resolve(null);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: ["draftId", "seq"] });
          store.createIndex("byDraft", "draftId", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
    } catch {
      resolve(null);
    }
  });
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

/** Write the latest mirror to IndexedDB (ring) and localStorage (single slot). */
export async function writeDraftBackup(
  draftId: string,
  snapshot: Omit<DraftBackupSnapshot, "draftId" | "seq">
): Promise<void> {
  const payload = {
    note: snapshot.note,
    title: snapshot.title,
    officeId: snapshot.officeId,
    at: snapshot.at
  };
  try {
    localStorage.setItem(localStorageKey(draftId), JSON.stringify(payload));
  } catch {
    // Quota / private mode — IndexedDB may still work.
  }

  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const idx = store.index("byDraft");
    const existing = (await idbRequest(idx.getAll(draftId))) as DraftBackupSnapshot[];
    const nextSeq = existing.reduce((m, r) => Math.max(m, r.seq), 0) + 1;
    await idbRequest(
      store.put({
        draftId,
        seq: nextSeq,
        ...payload
      } satisfies DraftBackupSnapshot)
    );
    const sorted = [...existing, { draftId, seq: nextSeq, ...payload }].sort(
      (a, b) => b.seq - a.seq
    );
    for (const stale of sorted.slice(LOCAL_BACKUP_KEEP)) {
      store.delete([stale.draftId, stale.seq]);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB tx failed"));
    });
  } catch {
    // Backup is best-effort.
  } finally {
    db.close();
  }
}

/** Newest local mirror, or null. Prefers IndexedDB ring, then localStorage. */
export async function readLatestDraftBackup(draftId: string): Promise<DraftBackupSnapshot | null> {
  const db = await openDb();
  if (db) {
    try {
      const tx = db.transaction(STORE, "readonly");
      const idx = tx.objectStore(STORE).index("byDraft");
      const rows = (await idbRequest(idx.getAll(draftId))) as DraftBackupSnapshot[];
      db.close();
      if (rows.length > 0) {
        return rows.sort((a, b) => b.seq - a.seq)[0] ?? null;
      }
    } catch {
      db.close();
    }
  }
  try {
    const raw = localStorage.getItem(localStorageKey(draftId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      note?: unknown;
      title?: unknown;
      officeId?: unknown;
      at?: unknown;
    };
    if (typeof parsed.at !== "number") return null;
    return {
      draftId,
      seq: 0,
      note: parsed.note as NoteState,
      title: typeof parsed.title === "string" ? parsed.title : "Untitled note",
      officeId: typeof parsed.officeId === "string" ? parsed.officeId : null,
      at: parsed.at
    };
  } catch {
    return null;
  }
}

/** List local snapshots newest-first (IndexedDB ring). */
export async function listDraftBackups(draftId: string): Promise<DraftBackupSnapshot[]> {
  const db = await openDb();
  if (!db) {
    const one = await readLatestDraftBackup(draftId);
    return one ? [one] : [];
  }
  try {
    const tx = db.transaction(STORE, "readonly");
    const idx = tx.objectStore(STORE).index("byDraft");
    const rows = (await idbRequest(idx.getAll(draftId))) as DraftBackupSnapshot[];
    db.close();
    return rows.sort((a, b) => b.seq - a.seq);
  } catch {
    db.close();
    return [];
  }
}

/** Clear all local mirrors for a draft after the server confirms a save. */
export async function clearDraftBackup(draftId: string): Promise<void> {
  try {
    localStorage.removeItem(localStorageKey(draftId));
  } catch {
    /* ignore */
  }
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const idx = store.index("byDraft");
    const rows = (await idbRequest(idx.getAll(draftId))) as DraftBackupSnapshot[];
    for (const row of rows) {
      store.delete([row.draftId, row.seq]);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB tx failed"));
    });
  } catch {
    /* ignore */
  } finally {
    db.close();
  }
}

/**
 * Wipe every local draft mirror on this device.
 *
 * Honest Finish / IT co-design: shared tablets must not leave the prior
 * author's note recoverable after sign-out. Best-effort; never throws.
 */
export async function clearAllDraftBackups(): Promise<void> {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("smile-notes.draft-backup.")) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB clear failed"));
    });
  } catch {
    /* ignore */
  } finally {
    db.close();
  }
}
