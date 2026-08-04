"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ByteStarFace } from "./ByteStar";
import { BenchmarkRails } from "./BenchmarkRails";
import { measureBenchmarks } from "@/lib/bytestar/benchmarks";
import {
  BYTESTAR_DISCLAIMER,
  optInByteStar,
  optOutByteStar,
  readByteStarPrefs,
  type ByteStarPrefs
} from "@/lib/bytestar/prefs";
import type { ByteStarSuggestion } from "@/lib/bytestar/schemas";

// BYTESTAR PANEL — optional pioneer advisor.
//
// READ-ONLY BY ARCHITECTURE. Suggestions never write into the note. The only
// buttons here are opt-in / opt-out / ask ByteStar / rotate tips. Applying a
// rewrite is a human copy action, never an automatic mutation.
//
// Local benchmarks always render (deterministic). Model suggestions appear
// only after deployment enablement + user opt-in + disclaimer ack.

type DeployStatus = "unknown" | "off" | "on";

export function ByteStarAdvisor({ text }: { text: string }) {
  const [prefs, setPrefs] = useState<ByteStarPrefs>({ optedIn: false, disclaimerAcked: false, ackedAt: null });
  const [deploy, setDeploy] = useState<DeployStatus>("unknown");
  const [suggestions, setSuggestions] = useState<ByteStarSuggestion[]>([]);
  const [tipIndex, setTipIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ackChecked, setAckChecked] = useState(false);

  const benchmarks = useMemo(() => measureBenchmarks(text), [text]);
  const mood =
    benchmarks.onCourse >= 0.75
      ? "happy"
      : benchmarks.onCourse >= 0.4
        ? "thinking"
        : text.trim()
          ? "concerned"
          : "idle";

  useEffect(() => {
    setPrefs(readByteStarPrefs());
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

  const tip = suggestions[Math.min(tipIndex, Math.max(0, suggestions.length - 1))];

  const logPrefs = (action: "opt-in" | "opt-out") => {
    void fetch("/api/bytestar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action })
    });
  };

  const handleOptIn = () => {
    if (!ackChecked) return;
    const next = optInByteStar();
    setPrefs(next);
    logPrefs("opt-in");
  };

  const handleOptOut = () => {
    const next = optOutByteStar();
    setPrefs(next);
    setSuggestions([]);
    setAckChecked(false);
    logPrefs("opt-out");
  };

  const ask = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/bytestar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text })
        });
        const data = await res.json();
        if (!res.ok) {
          setSuggestions([]);
          setError(typeof data.error === "string" ? data.error : "ByteStar is unavailable right now.");
          return;
        }
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        setTipIndex(0);
      } catch {
        setError("ByteStar could not be reached. Your note is unchanged.");
      }
    });
  };

  return (
    <section
      aria-label="ByteStar, optional pioneer advisor"
      className="rounded-xl bg-gradient-to-b from-amber-50/80 to-white p-3 ring-1 ring-amber-200/80"
    >
      <div className="flex items-start gap-3">
        <ByteStarFace mood={mood} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold text-brand-navy">ByteStar</h3>
            <span className="text-[0.65rem] uppercase tracking-wide text-amber-800/70">
              pioneer · optional · reads only
            </span>
          </div>

          {!prefs.optedIn ? (
            <div className="mt-2 space-y-2">
              <p className="text-xs leading-relaxed text-slate-700">{BYTESTAR_DISCLAIMER}</p>
              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={ackChecked}
                  onChange={(e) => setAckChecked(e.target.checked)}
                />
                <span>I have read the disclaimer. I remain responsible for my notes.</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={!ackChecked || deploy === "off"}
                  onClick={handleOptIn}
                >
                  Enable ByteStar on this device
                </button>
                {deploy === "off" && (
                  <span className="self-center text-[0.65rem] text-slate-500">
                    Not enabled on this deployment.
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-1 space-y-2">
              <p className="text-[0.65rem] leading-relaxed text-slate-500">{BYTESTAR_DISCLAIMER}</p>
              {tip ? (
                <div className="rounded-lg rounded-tl-none bg-white p-2.5 ring-1 ring-amber-200/70">
                  <p className="text-[0.65rem] uppercase tracking-wide text-amber-800/80">{tip.kind}</p>
                  <p className="text-sm font-medium text-slate-900">{tip.say}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{tip.why}</p>
                  {tip.rewrite && (
                    <p className="mt-1 rounded bg-slate-50 p-1.5 text-xs text-slate-700">
                      Suggested wording (not applied): <span className="font-medium">{tip.rewrite}</span>
                    </p>
                  )}
                  {tip.question && (
                    <p className="mt-1 text-xs font-medium text-brand-navy">{tip.question}</p>
                  )}
                  <p className="mt-1.5 border-t border-amber-100 pt-1 text-[0.65rem] text-slate-400">
                    Source: {tip.source}
                  </p>
                  {suggestions.length > 1 && (
                    <button
                      type="button"
                      className="mt-1 text-xs font-medium text-brand-blue underline decoration-dotted underline-offset-2"
                      onClick={() => setTipIndex((i) => (i + 1) % suggestions.length)}
                    >
                      Next suggestion ({(tipIndex % suggestions.length) + 1} of {suggestions.length})
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Benchmarks update as you type. Ask ByteStar when you want pioneer suggestions —
                  answers come back as guidance, never as edits.
                </p>
              )}
              {error && <p className="text-xs text-slate-700">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={pending || !text.trim() || deploy !== "on"}
                  onClick={ask}
                >
                  {pending ? "ByteStar is thinking…" : "Ask ByteStar"}
                </button>
                <button type="button" className="text-xs text-slate-500 underline" onClick={handleOptOut}>
                  Turn off on this device
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {benchmarks.gauges.words > 0 && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Drift to target
            </h4>
            <span className="text-[0.65rem] tabular-nums text-slate-500">
              {Math.round(benchmarks.onCourse * 100)}% of gauges on course
            </span>
          </div>
          <BenchmarkRails readings={benchmarks.readings} />
        </div>
      )}
    </section>
  );
}
