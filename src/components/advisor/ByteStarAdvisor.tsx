"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ByteStarFace } from "./ByteStar";
import { BenchmarkRails } from "./BenchmarkRails";
import { NorthStarCompass } from "./NorthStarCompass";
import { measureBenchmarks } from "@/lib/bytestar/benchmarks";
import { BYTESTAR_DISCLAIMER } from "@/lib/bytestar/prefs";
import { BYTESTAR_ONE_WAY_NOTICE } from "@/lib/bytestar/one-way";

// BYTESTAR — observational pioneer. ONE-WAY FEEDBACK: ByteStar gives staff
// objective language and graphics; staff never prompt, copy, or send feedback
// back. Auto-observe on debounced draft text; display-only panel.

interface Observation {
  kind: string;
  say: string;
  why: string;
  question?: string;
  source: string;
}

type DeployStatus = "unknown" | "off" | "on";

const OBSERVE_DEBOUNCE_MS = 1800;
const ROTATE_MS = 8000;

export function ByteStarAdvisor({ text }: { text: string }) {
  const deferred = useDeferredValue(text);
  const [deploy, setDeploy] = useState<DeployStatus>("unknown");
  const [observations, setObservations] = useState<Observation[]>([]);
  const [tipIndex, setTipIndex] = useState(0);
  const [observing, setObserving] = useState(false);
  const lastFetched = useRef("");

  const benchmarks = useMemo(() => measureBenchmarks(deferred), [deferred]);
  const mood =
    benchmarks.onCourse >= 0.75
      ? "happy"
      : benchmarks.onCourse >= 0.4
        ? "thinking"
        : deferred.trim()
          ? "concerned"
          : "idle";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/bytestar")
      .then((r) => r.json())
      .then((d: { enabled?: boolean }) => {
        if (!cancelled) setDeploy(d.enabled ? "on" : "off");
      })
      .catch(() => {
        if (!cancelled) setDeploy("off");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-observe — no staff interaction. Debounced draft in, observations out.
  useEffect(() => {
    if (deploy !== "on" || !deferred.trim() || deferred.length < 24) {
      setObservations([]);
      return;
    }
    const t = window.setTimeout(() => {
      if (lastFetched.current === deferred) return;
      lastFetched.current = deferred;
      setObserving(true);
      void fetch("/api/bytestar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: deferred })
      })
        .then((r) => r.json())
        .then((d: { observations?: Observation[]; unavailable?: boolean }) => {
          if (d.unavailable) {
            setObservations([]);
            return;
          }
          setObservations(Array.isArray(d.observations) ? d.observations : []);
          setTipIndex(0);
        })
        .catch(() => setObservations([]))
        .finally(() => setObserving(false));
    }, OBSERVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [deferred, deploy]);

  // Rotate observations without user clicks — the panel is not a conversation.
  useEffect(() => {
    if (observations.length <= 1) return;
    const id = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % observations.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [observations.length]);

  const tip = observations[Math.min(tipIndex, Math.max(0, observations.length - 1))];

  return (
    <section
      aria-label="ByteStar observational pioneer"
      className="bytestar-panel select-none rounded-xl bg-gradient-to-br from-amber-50/90 via-white to-teal-50/40 p-3 ring-1 ring-amber-300/60"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <ByteStarFace mood={mood} />
          <div className="absolute -bottom-1 -right-1 rounded bg-amber-900/90 px-1 py-px text-[0.55rem] font-bold uppercase tracking-wider text-amber-100">
            observe
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-brand-navy">ByteStar</h3>
              <p className="text-[0.65rem] uppercase tracking-wide text-amber-900/60">
                gives you feedback · you do not give it feedback
              </p>
            </div>
            <NorthStarCompass onCourse={benchmarks.onCourse} />
          </div>

          <p className="mt-2 text-[0.65rem] font-medium leading-relaxed text-amber-950/80">
            {BYTESTAR_ONE_WAY_NOTICE}
          </p>
          <p className="mt-1 text-[0.65rem] leading-relaxed text-slate-600">{BYTESTAR_DISCLAIMER}</p>

          {deploy === "off" ? (
            <p className="mt-2 text-xs text-slate-500">
              Pioneer observation is not enabled on this deployment. Local drift gauges still update as you type.
            </p>
          ) : tip ? (
            <div
              className="relative mt-2 overflow-hidden rounded-lg bg-white/90 p-2.5 ring-1 ring-amber-200/80"
              aria-live="polite"
              aria-atomic
            >
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />
              <p className="text-[0.65rem] uppercase tracking-wide text-amber-900/70">{tip.kind}</p>
              <p className="text-sm font-medium text-slate-900">{tip.say}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{tip.why}</p>
              {tip.question && (
                <p className="mt-1 text-xs font-medium text-brand-navy">{tip.question}</p>
              )}
              <p className="mt-1.5 border-t border-amber-100/80 pt-1 text-[0.65rem] text-slate-400">
                Source: {tip.source}
              </p>
              {observations.length > 1 && (
                <p className="mt-1 text-[0.6rem] tabular-nums text-slate-400">
                  Observation {(tipIndex % observations.length) + 1} of {observations.length} · rotates automatically
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              {observing
                ? "ByteStar is reading the draft…"
                : deferred.trim().length < 24
                  ? "Keep typing — objective observations appear here when the draft is long enough to analyze."
                  : "No pioneer observations for this draft right now. Drift gauges below stay live."}
            </p>
          )}
        </div>
      </div>

      {benchmarks.gauges.words > 0 && (
        <div className="mt-3 border-t border-amber-200/50 pt-3">
          <div className="flex items-baseline justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Drift to NorthStar
            </h4>
            <span className="text-[0.65rem] tabular-nums text-slate-500">
              {Math.round(benchmarks.onCourse * 100)}% on course
            </span>
          </div>
          <BenchmarkRails readings={benchmarks.readings} />
        </div>
      )}
    </section>
  );
}
