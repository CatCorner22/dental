import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearDraftBackup,
  readLatestDraftBackup,
  writeDraftBackup
} from "./draftBackup";
import type { NoteState } from "@/lib/schema/types";

// Node has no localStorage; the backup module falls back to it when IndexedDB
// is missing. A tiny in-memory store is enough to prove the durable mirror path.
function installMemoryLocalStorage() {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    }
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true
  });
}

const note: NoteState = {
  selectedModuleIds: ["extraction"],
  values: { "extraction.tooth": { kind: "text", value: "#14" } }
};

describe("draftBackup (localStorage fallback)", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("writes and reads the latest mirror, then clears it", async () => {
    const draftId = "draft-backup-1";
    await writeDraftBackup(draftId, {
      note,
      title: "Extraction note",
      officeId: "office-a",
      at: 1_700_000_000_000
    });
    const latest = await readLatestDraftBackup(draftId);
    expect(latest).toMatchObject({
      draftId,
      title: "Extraction note",
      officeId: "office-a",
      at: 1_700_000_000_000
    });
    expect(latest?.note.selectedModuleIds).toEqual(["extraction"]);

    await writeDraftBackup(draftId, {
      note: { selectedModuleIds: ["hygiene"], values: {} },
      title: "Newer",
      officeId: null,
      at: 1_700_000_100_000
    });
    const newer = await readLatestDraftBackup(draftId);
    expect(newer?.title).toBe("Newer");
    expect(newer?.at).toBe(1_700_000_100_000);

    await clearDraftBackup(draftId);
    expect(await readLatestDraftBackup(draftId)).toBeNull();
  });

  it("isolates mirrors per draft id", async () => {
    await writeDraftBackup("a", {
      note,
      title: "A",
      officeId: null,
      at: 1
    });
    await writeDraftBackup("b", {
      note: { selectedModuleIds: [], values: {} },
      title: "B",
      officeId: null,
      at: 2
    });
    expect((await readLatestDraftBackup("a"))?.title).toBe("A");
    expect((await readLatestDraftBackup("b"))?.title).toBe("B");
    await clearDraftBackup("a");
    expect(await readLatestDraftBackup("a")).toBeNull();
    expect((await readLatestDraftBackup("b"))?.title).toBe("B");
  });
});
