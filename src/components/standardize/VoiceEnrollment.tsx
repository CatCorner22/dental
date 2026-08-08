"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  browserSpeechEngine,
  dictationDisabled,
  type DictationEngine
} from "@/lib/dictation/engine";
import {
  canCompleteEnrollment,
  completeEnrollment,
  ENROLLMENT_MAX_MS,
  ENROLLMENT_MIN_MS,
  ENROLLMENT_MIN_PROMPTS,
  ENROLLMENT_MIN_UTTERANCES,
  ENROLLMENT_TARGET_MS,
  enrollmentPercent,
  enrollmentRemainingMs,
  readEnrollment,
  type EnrollmentRecord
} from "@/lib/dictation/enrollment";
import { glossColloquialisms } from "@/lib/dictation/comprehension";
import { normalizeDictation } from "@/lib/dictation/normalize";
import {
  enrollmentScript,
  isUsaRegionId,
  USA_REGIONS,
  type UsaRegionId
} from "@/lib/dictation/regional";
import { HelpTip } from "@/components/ui/HelpTip";

// READ-ONLY VOICE ENROLLMENT — first deliverable.
//
// The writer speaks for 3–5 minutes with the software. Transcripts appear in
// a preview pane only. Nothing is written into the note box, drafts, or
// clipboard. Autocorrect is forbidden: join-only dental repairs may show in
// the preview as "tidied", but colloquialisms are glossed, never replaced.
// Completing enrollment unlocks apply-mode dictation on this browser.

function formatMs(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function useDictationUnlock(username: string): {
  unlocked: boolean;
  record: EnrollmentRecord | null;
  refresh: () => void;
  markUnlocked: (record: EnrollmentRecord) => void;
} {
  const [record, setRecord] = useState<EnrollmentRecord | null>(null);

  const refresh = useCallback(() => {
    setRecord(username ? readEnrollment(username) : null);
  }, [username]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    unlocked: record !== null,
    record,
    refresh,
    markUnlocked: (r) => setRecord(r)
  };
}

export function VoiceEnrollment({
  username,
  onUnlocked
}: {
  username: string;
  onUnlocked: (record: EnrollmentRecord) => void;
}) {
  const engine: DictationEngine = useMemo(() => browserSpeechEngine(), []);
  const [supported, setSupported] = useState(false);
  const [region, setRegion] = useState<UsaRegionId>("general");
  const [listening, setListening] = useState(false);
  const [listenedMs, setListenedMs] = useState(0);
  const [utterances, setUtterances] = useState(0);
  const [promptIndex, setPromptIndex] = useState(0);
  const [completedPrompts, setCompletedPrompts] = useState<Set<number>>(() => new Set());
  const [previewLines, setPreviewLines] = useState<string[]>([]);
  const previewRef = useRef<HTMLUListElement>(null);
  // THE PREVIEW HAS TO KEEP MOVING.
  //
  // Lines are appended to the end and the pane holds about eight of them while
  // retaining forty, and nothing ever scrolled it — so roughly forty seconds
  // into a three-to-five minute read-aloud the box froze on the first few
  // utterances while the user kept talking. That is indistinguishable from
  // recognition having died, and people stopped and abandoned setup even though
  // the timer and the utterance counter were still climbing.
  //
  // Pin to the bottom only when the reader is already there: someone who has
  // scrolled up to check how a word came out should not be yanked back down by
  // the next utterance.
  //
  // UP HERE with the other hooks, not next to the <ul> it serves: the component
  // early-returns when `supported` is false, and `supported` flips to true
  // after mount in any browser with a speech engine. A hook below that return
  // is a hook that exists on the second render and not the first — React #310,
  // which unmounts the whole subtree. That crash shipped once; the hook-order
  // rule is why.
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
      el.scrollTop = el.scrollHeight;
    }
  }, [previewLines]);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [tidied, setTidied] = useState(0);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const utterancesRef = useRef(0);
  const promptsRef = useRef<Set<number>>(new Set());
  const promptIndexRef = useRef(0);

  const script = useMemo(() => enrollmentScript(region), [region]);
  const currentPrompt = script[promptIndex] ?? script[0] ?? "";

  useEffect(() => {
    promptIndexRef.current = promptIndex;
  }, [promptIndex]);

  useEffect(() => {
    setSupported(!dictationDisabled() && engine.available());
    return () => {
      engine.stop();
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [engine]);

  const liveMs = () =>
    accumulatedRef.current +
    (startedAtRef.current !== null ? Date.now() - startedAtRef.current : 0);

  const stopTicker = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (startedAtRef.current !== null) {
      accumulatedRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
    setListenedMs(accumulatedRef.current);
  };

  const stop = useCallback(() => {
    engine.stop();
    stopTicker();
    setListening(false);
    setInterim("");
  }, [engine]);

  const tryUnlock = useCallback(() => {
    const progress = {
      listenedMs: liveMs(),
      utterances: utterancesRef.current,
      promptsCompleted: promptsRef.current.size,
      region
    };
    if (!canCompleteEnrollment(progress)) return false;
    const record = completeEnrollment(username, progress);
    if (!record) return false;
    engine.stop();
    stopTicker();
    setListening(false);
    onUnlocked(record);
    return true;
  }, [username, region, onUnlocked, engine]);

  const start = () => {
    if (!username) {
      setError("Sign in is required before voice enrollment.");
      return;
    }
    setError("");
    setTidied(0);
    const grammar = script.slice(0, 60);
    startedAtRef.current = Date.now();
    tickRef.current = setInterval(() => {
      const ms = liveMs();
      setListenedMs(ms);
      if (ms >= ENROLLMENT_MAX_MS) {
        if (!tryUnlock()) stop();
      }
    }, 500);

    engine.start(
      (raw) => {
        // Preview path: normalize for display only — NEVER leaves this panel.
        const { text, changes } = normalizeDictation(raw);
        if (changes.length) setTidied((n) => n + changes.length);
        setPreviewLines((prev) => [...prev.slice(-40), text]);
        setInterim("");
        utterancesRef.current += 1;
        setUtterances(utterancesRef.current);
        promptsRef.current = new Set(promptsRef.current).add(promptIndexRef.current);
        setCompletedPrompts(new Set(promptsRef.current));
        tryUnlock();
      },
      () => {
        stopTicker();
        setListening(false);
        setInterim("");
      },
      {
        grammarPhrases: grammar,
        onInterim: (t) => setInterim(t),
        onError: (code, message) => {
          if (code === "no-speech" || code === "aborted") return;
          setError(message);
        }
      }
    );
    setListening(true);
  };

  if (!supported) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        Voice enrollment needs a browser with speech recognition (Chrome or Edge on desktop are
        typical). Dictation stays off until that is available — or until a Team Lead sets the
        deployment off-switch intentionally.
      </div>
    );
  }

  const remaining = enrollmentRemainingMs(listenedMs);
  const pct = enrollmentPercent(listenedMs);

  const glosses = glossColloquialisms(previewLines.slice(-3).join(" "), region);
  const ready =
    listenedMs >= ENROLLMENT_MIN_MS &&
    utterances >= ENROLLMENT_MIN_UTTERANCES &&
    completedPrompts.size >= ENROLLMENT_MIN_PROMPTS;

  return (
    <section
      aria-label="Voice enrollment — read only"
      className="rounded-xl border border-amber-300 bg-gradient-to-b from-amber-50 to-white p-4 shadow-sm"
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-brand-navy">
            Voice enrollment — read only
            <HelpTip label="Why enrollment is required">
              Dictation may change a clinical note. Before that is allowed, you speak with the
              software for three to five minutes so recognition adapts to your voice. Nothing you
              say here is written into a note.
            </HelpTip>
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600">
            First deliverable: preview only — no note changes, no autocorrect, no clipboard write.
            Speak the prompts in English. Regional phrases help the engine hear everyday U.S.
            speech; dental lines cover operatory wording. Minimum {formatMs(ENROLLMENT_MIN_MS)},
            target {formatMs(ENROLLMENT_TARGET_MS)}.
          </p>
        </div>
        <span className="rounded bg-amber-900/90 px-2 py-0.5 text-[0.65rem] font-bold text-amber-50">
          No changes allowed
        </span>
      </div>

      <label className="mb-3 block text-xs font-medium text-slate-700">
        Your U.S. region (colloquial practice set)
        <select
          className="field-input mt-1 max-w-md text-sm"
          value={region}
          disabled={listening || listenedMs > 0}
          onChange={(e) => {
            const v = e.target.value;
            if (isUsaRegionId(v)) {
              setRegion(v);
              setPromptIndex(0);
              setCompletedPrompts(new Set());
              promptsRef.current = new Set();
            }
          }}
        >
          {USA_REGIONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label} — {r.blurb}
            </option>
          ))}
        </select>
      </label>

      <div className="mb-3 rounded-lg bg-white p-3 ring-1 ring-slate-200">
        <p className="text-[0.7rem] font-semibold text-slate-500">
          Say this aloud
        </p>
        <p className="mt-1 text-base font-medium text-slate-900">&ldquo;{currentPrompt}&rdquo;</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={promptIndex <= 0}
            onClick={() => setPromptIndex((i) => Math.max(0, i - 1))}
          >
            Previous prompt
          </button>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={promptIndex >= script.length - 1}
            onClick={() => setPromptIndex((i) => Math.min(script.length - 1, i + 1))}
          >
            Next prompt
          </button>
          <span className="self-center text-xs text-slate-500">
            Prompt {promptIndex + 1} of {script.length} · {completedPrompts.size} covered
          </span>
        </div>
      </div>

      <div className="mb-3">
        <div className="mb-1 flex justify-between gap-2 text-xs text-slate-600">
          <span>
            Listening time {formatMs(listenedMs)} / {formatMs(ENROLLMENT_TARGET_MS)}
            {remaining > 0 ? ` · ${formatMs(remaining)} until unlock eligible` : " · unlock eligible"}
          </span>
          <span>
            {utterances} utterance{utterances === 1 ? "" : "s"} (need {ENROLLMENT_MIN_UTTERANCES}) ·{" "}
            {completedPrompts.size}/{ENROLLMENT_MIN_PROMPTS} prompts
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-teal transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`btn-primary ${listening ? "border-rose-600 bg-rose-600 hover:bg-rose-700" : ""}`}
          onClick={listening ? stop : start}
        >
          {listening ? "◼ Pause enrollment" : "🎤 Start enrollment listening"}
        </button>
        {listening && (
          <span className="text-xs text-rose-800" role="status">
            Listening in English only ({engine.lang}
            {engine.offDevice ? " · audio may leave this device — speak de-identified facts" : ""}
            ).
          </span>
        )}
        {ready && (
          <button type="button" className="btn-primary" onClick={() => tryUnlock()}>
            Complete enrollment
          </button>
        )}
      </div>

      {error && (
        <p className="mb-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
        <p className="mb-1 text-[0.7rem] font-semibold text-slate-500">
          Live preview — not written to any note
        </p>
        {interim && (
          <p className="mb-2 text-sm italic text-slate-500" aria-live="polite">
            {interim}
          </p>
        )}
        <ul
          ref={previewRef}
          className="max-h-40 space-y-1 overflow-y-auto font-mono text-xs text-slate-800"
        >
          {previewLines.length === 0 ? (
            <li className="text-slate-500">Spoken finals will appear here.</li>
          ) : (
            previewLines.map((line, i) => <li key={`${i}-${line.slice(0, 12)}`}>{line}</li>)
          )}
        </ul>
        {tidied > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            {tidied} dental split-term join{tidied === 1 ? "" : "s"} shown in preview only — nothing
            reworded or autocorrected.
          </p>
        )}
        {glosses.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {glosses.map((g) => (
              <span
                key={g.phrase}
                className="rounded bg-white px-2 py-0.5 text-[0.7rem] text-slate-600 ring-1 ring-slate-200"
                title="Read-only gloss — the transcript was not changed"
              >
                <span className="font-medium text-slate-800">{g.phrase}</span>: {g.gloss}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
