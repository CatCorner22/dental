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

// What a completed flush means for the caller: "clean" = every edit is on the
// server; "conflict" = a newer version exists there; "error" = the save
// failed and local edits are still unsaved. Submit must only proceed on
// "clean" — anything else risks filing content the user has not seen.
export type FlushOutcome = "clean" | "conflict" | "error";

interface UseAutosave {
  state: AutosaveState;
  version: number;
  markEdited: (note: NoteState, title: string) => void;
  flush: () => Promise<FlushOutcome>;
  resolveConflict: () => void;
}

// Wraps the pure autosave machine: debounces edits into a version-checked
// PATCH, drains trailing edits, and surfaces conflicts. Design rules:
// - One save chain at a time; joiners await the running chain.
// - The chain keeps saving while new edits queue up, and STOPS on the first
//   conflict or error — no automatic retry (an offline tab must not hammer
//   the server in a zero-delay loop). The next edit or flush retries.
// - flush() resolves only when everything is drained or a stop is hit, and
//   reports which, so Submit can gate on it.
export function useAutosave(draftId: string, initialVersion: number): UseAutosave {
  const [state, dispatch] = useReducer(autosaveReducer, initialAutosave);
  const versionRef = useRef(initialVersion);
  const pending = useRef<{ note: NoteState; title: string } | null>(null);
  const chain = useRef<Promise<FlushOutcome> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<AutosaveState>(state);
  stateRef.current = state;
  const unmounted = useRef(false);

  const runChain = useCallback((): Promise<FlushOutcome> => {
    if (chain.current) return chain.current;
    const run = (async (): Promise<FlushOutcome> => {
      while (pending.current) {
        // An unresolved conflict freezes saving; a PATCH with the stale
        // version is guaranteed 409 noise.
        if (stateRef.current.status === "conflict") return "conflict";
        if (unmounted.current) return "clean"; // never save after unmount
        const payload = pending.current;
        dispatch({ type: "saveStart" });
        try {
          const res = await fetch(`/api/drafts/${draftId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              baseVersion: versionRef.current,
              note: payload.note,
              title: payload.title
            })
          });
          if (res.status === 409) {
            const data = (await res.json().catch(() => ({}))) as { version?: number };
            dispatch({ type: "save409", serverVersion: data.version ?? versionRef.current });
            return "conflict";
          }
          if (!res.ok) {
            dispatch({ type: "saveErr", message: `Save failed (${res.status}).` });
            return "error";
          }
          const data = (await res.json()) as { version: number };
          versionRef.current = data.version;
          // Only clear "pending" if nothing changed since this save's
          // payload; a trailing edit keeps the loop going.
          if (pending.current === payload) pending.current = null;
          dispatch({ type: "saveOk", version: data.version, at: Date.now() });
        } catch {
          dispatch({ type: "saveErr", message: "Save failed — check your connection." });
          return "error";
        }
      }
      return "clean";
    })();
    chain.current = run.finally(() => {
      chain.current = null;
    });
    return chain.current;
  }, [draftId]);

  const markEdited = useCallback(
    (note: NoteState, title: string) => {
      pending.current = { note, title };
      dispatch({ type: "edit" });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void runChain(), DEBOUNCE_MS);
    },
    [runChain]
  );

  const flush = useCallback(async (): Promise<FlushOutcome> => {
    if (timer.current) clearTimeout(timer.current);
    if (stateRef.current.status === "conflict") return "conflict";
    if (!pending.current) return chain.current ? await chain.current : "clean";
    return runChain();
  }, [runChain]);

  // "Keep editing here": the user chose their local edits over the newer
  // server version. Adopt the server's version counter so the next save is
  // an explicit last-writer-wins overwrite instead of an endless 409 loop,
  // then save the kept edits right away.
  const resolveConflict = useCallback(() => {
    const current = stateRef.current;
    if (current.status === "conflict") {
      versionRef.current = current.serverVersion;
    }
    dispatch({ type: "resolved" });
    if (pending.current) {
      // stateRef still reads "conflict" until React re-renders; run on the
      // next tick so the chain sees the resolved state.
      setTimeout(() => void runChain(), 0);
    }
  }, [runChain]);

  useEffect(() => {
    unmounted.current = false;
    const warn = (e: BeforeUnloadEvent) => {
      // pending is the ground truth for unsaved local work — it covers the
      // dirty, saving, error, AND conflict states.
      if (pending.current !== null || isDirty(stateRef.current)) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      // Never fire a save after the builder unmounts.
      unmounted.current = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Memoized so consumers can safely use this object in effect dependencies.
  return useMemo(
    () => ({ state, version: versionRef.current, markEdited, flush, resolveConflict }),
    [state, markEdited, flush, resolveConflict]
  );
}
