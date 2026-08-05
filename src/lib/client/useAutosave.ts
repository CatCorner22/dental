"use client";

import { useCallback, useEffect, useMemo, useRef, useReducer } from "react";
import type { NoteState } from "@/lib/schema/types";
import {
  autosaveReducer,
  initialAutosave,
  isDirty,
  saveErrorMessage,
  type AutosaveState
} from "./autosaveMachine";

/** Near-realtime: short enough that a power blip rarely eats a finished sentence. */
const DEBOUNCE_MS = 800;
/** While offline/error, keep nudging without hammering (backoff starts here). */
const RETRY_MS = 4000;

// What a completed flush means for the caller: "clean" = every edit is on the
// server; "conflict" = a newer version exists there; "error" = the save
// failed and local edits are still unsaved. Submit must only proceed on
// "clean" — anything else risks filing content the user has not seen.
export type FlushOutcome = "clean" | "conflict" | "error";

interface UseAutosave {
  state: AutosaveState;
  version: number;
  markEdited: (note: NoteState, title: string, officeId: string | null) => void;
  flush: () => Promise<FlushOutcome>;
  resolveConflict: () => void;
  // Adopt a version the server minted outside the save chain (the submit
  // claim bumps it), so the next autosave is not a guaranteed 409.
  adoptVersion: (version: number) => void;
}

// Wraps the pure autosave machine: debounces edits into a version-checked
// PATCH, drains trailing edits, retries on reconnect, and flushes on pagehide.
// Design rules:
// - One save chain at a time; joiners await the running chain.
// - Stops on conflict (human must choose). Soft-retries on network error when
//   the tab is online again or on a timer — never a zero-delay hammer loop.
// - flush() resolves only when everything is drained or a stop is hit.
export function useAutosave(draftId: string, initialVersion: number): UseAutosave {
  const [state, dispatch] = useReducer(autosaveReducer, initialAutosave);
  const versionRef = useRef(initialVersion);
  const pending = useRef<{ note: NoteState; title: string; officeId: string | null } | null>(null);
  const chain = useRef<Promise<FlushOutcome> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        const payload = pending.current;
        dispatch({ type: "saveStart" });
        try {
          const res = await fetch(`/api/drafts/${draftId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              baseVersion: versionRef.current,
              note: payload.note,
              title: payload.title,
              // Saved on the same chain as the note, so switching office is
              // as durable as typing — and so a note filed straight after the
              // change cannot freeze the previous location into the record.
              officeId: payload.officeId
            }),
            // Best-effort delivery when the tab is closing (pagehide flush).
            keepalive: true
          });
          if (res.status === 409) {
            const data = (await res.json().catch(() => ({}))) as { version?: number };
            dispatch({ type: "save409", serverVersion: data.version ?? versionRef.current });
            return "conflict";
          }
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as { error?: unknown };
            dispatch({ type: "saveErr", message: saveErrorMessage(res.status, data) });
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

  const scheduleRetry = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => {
      if (unmounted.current) return;
      if (stateRef.current.status === "conflict") return;
      if (pending.current || stateRef.current.status === "error" || stateRef.current.status === "dirty") {
        void runChain().then((outcome) => {
          if (outcome === "error" && !unmounted.current) scheduleRetry();
        });
      }
    }, RETRY_MS);
  }, [runChain]);

  const markEdited = useCallback(
    (note: NoteState, title: string, officeId: string | null) => {
      pending.current = { note, title, officeId };
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
  const adoptVersion = useCallback((version: number) => {
    if (version > versionRef.current) versionRef.current = version;
  }, []);

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
    const onPageHide = () => {
      // Cancel debounce and push immediately — the laptop lid / power cut case.
      if (timer.current) clearTimeout(timer.current);
      if (pending.current && stateRef.current.status !== "conflict") {
        void runChain();
      }
    };
    const onOnline = () => {
      if (pending.current || stateRef.current.status === "error") {
        void runChain().then((outcome) => {
          if (outcome === "error") scheduleRetry();
        });
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onPageHide();
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      unmounted.current = true;
      if (timer.current) clearTimeout(timer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      // Last-chance flush while the document is still alive.
      if (pending.current && stateRef.current.status !== "conflict") {
        void runChain();
      }
    };
  }, [runChain, scheduleRetry]);

  // Soft retry while stuck in error with pending work.
  useEffect(() => {
    if (state.status === "error" && pending.current) scheduleRetry();
  }, [state.status, scheduleRetry]);

  // Memoized so consumers can safely use this object in effect dependencies.
  return useMemo(
    () => ({ state, version: versionRef.current, markEdited, flush, resolveConflict, adoptVersion }),
    [state, markEdited, flush, resolveConflict, adoptVersion]
  );
}
