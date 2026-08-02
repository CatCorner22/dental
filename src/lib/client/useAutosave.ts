"use client";

import { useCallback, useEffect, useMemo, useRef, useReducer } from "react";
import type { NoteState } from "@/lib/schema/types";
import {
  autosaveReducer,
  initialAutosave,
  isDirty,
  type AutosaveState
} from "./autosaveMachine";

const DEBOUNCE_MS = 1500;

interface UseAutosave {
  state: AutosaveState;
  version: number;
  markEdited: (note: NoteState, title: string) => void;
  flush: () => Promise<void>;
  resolveConflict: () => void;
}

// Wraps the pure autosave machine: debounces edits into a version-checked
// PATCH, suppresses concurrent saves, and surfaces conflicts.
export function useAutosave(draftId: string, initialVersion: number): UseAutosave {
  const [state, dispatch] = useReducer(autosaveReducer, initialAutosave);
  const versionRef = useRef(initialVersion);
  const pending = useRef<{ note: NoteState; title: string } | null>(null);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<AutosaveState>(state);
  stateRef.current = state;

  const doSave = useCallback(async () => {
    if (inFlight.current || !pending.current) return;
    // Read into a local so TS does not narrow the ref for the whole closure
    // (the ref can change to "conflict" across the awaits below).
    const current = stateRef.current;
    if (current.status === "conflict") return;
    const payload = pending.current;
    inFlight.current = true;
    dispatch({ type: "saveStart" });
    try {
      const res = await fetch(`/api/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ baseVersion: versionRef.current, note: payload.note, title: payload.title })
      });
      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as { version?: number };
        dispatch({ type: "save409", serverVersion: data.version ?? versionRef.current });
      } else if (res.ok) {
        const data = (await res.json()) as { version: number };
        versionRef.current = data.version;
        // Only clear "pending" if nothing changed since this save's payload.
        if (pending.current === payload) pending.current = null;
        dispatch({ type: "saveOk", version: data.version, at: Date.now() });
      } else {
        dispatch({ type: "saveErr", message: `Save failed (${res.status}).` });
      }
    } catch {
      dispatch({ type: "saveErr", message: "Save failed — check your connection." });
    } finally {
      inFlight.current = false;
      // A trailing edit arrived during the save; save again.
      if (pending.current && stateRef.current.status !== "conflict") void doSave();
    }
  }, [draftId]);

  const markEdited = useCallback(
    (note: NoteState, title: string) => {
      pending.current = { note, title };
      dispatch({ type: "edit" });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void doSave(), DEBOUNCE_MS);
    },
    [doSave]
  );

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await doSave();
  }, [doSave]);

  const resolveConflict = useCallback(() => dispatch({ type: "resolved" }), []);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (isDirty(stateRef.current)) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      // Never fire a save after the builder unmounts.
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Memoized so consumers can safely use this object in effect dependencies.
  return useMemo(
    () => ({ state, version: versionRef.current, markEdited, flush, resolveConflict }),
    [state, markEdited, flush, resolveConflict]
  );
}
