"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ByteStarFace } from "./SuperByte";
import { BenchmarkRails } from "./BenchmarkRails";
import { NorthStarCompass } from "./NorthStarCompass";
import { measureBenchmarks } from "@/lib/bytestar/benchmarks";
import { instrumentObservations, type InstrumentObservation } from "@/lib/bytestar/instrument";
import { BYTESTAR_DISCLAIMER } from "@/lib/bytestar/prefs";
import { BYTESTAR_ONE_WAY_NOTICE } from "@/lib/bytestar/one-way";
import {
  superbyteLayerLabel,
  superbyteLiveStatus,
  type SuperByteDeployStatus
} from "@/lib/bytestar/liveStatus";
import { TrendSpark, type TrendSample } from "./TrendSpark";
import { HelpTip } from "@/components/ui/HelpTip";

// BYTESTAR — observational pioneer. ONE-WAY FEEDBACK: SuperByte gives staff
// objective language and graphics; staff never prompt, copy, or send feedback
// back. Pioneer model when enabled; deterministic instrument readings always.
//
// Nav UX (2026 HF Chat UI / MessageUpdate / RouterMetadata patterns, adapted):
// staff pace readings (no hostile auto-rotate), see present-tense status, see
// which layer spoke, and open drift rails on demand. Never a chat box.

interface Observation {
  kind: string;
  say: string;
  why: string;
  question?: string;
  source: string;
  corroboration?: { seen: number; reads: number };
  /** Deterministic label: strong claim without a named authority behind it. */
  tentative?: boolean;
}

const OBSERVE_DEBOUNCE_MS = 1800;
const MIN_CHARS = 24;

function layerToneClass(tone: ReturnType<typeof superbyteLayerLabel>["tone"]): string {
  switch (tone) {
    case "pioneer":
      return "bg-amber-100 text-amber-950 ring-amber-300";
    case "instrument":
      return "bg-teal-50 text-teal-900 ring-teal-300";
    case "reading":
      return "bg-slate-100 text-slate-700 ring-slate-300";
    case "dark":
      return "bg-slate-200 text-slate-700 ring-slate-400";
    default:
      return "bg-white text-slate-600 ring-slate-200";
  }
}

export function ByteStarAdvisor({ text }: { text: string }) {
  const deferred = useDeferredValue(text);
  const [deploy, setDeploy] = useState<SuperByteDeployStatus>("unknown");
  const [pioneerObs, setPioneerObs] = useState<Observation[]>([]);
  const [tipIndex, setTipIndex] = useState(0);
  const [observing, setObserving] = useState(false);
  const lastFetched = useRef("");
  const [trend, setTrend] = useState<TrendSample[]>([]);
  const [profile, setProfile] = useState<string | null>(null);
  const [readModes, setReadModes] = useState<string[]>([]);
  const [jurisdictionNotice, setJurisdictionNotice] = useState<string | null>(null);

  const benchmarks = useMemo(() => measureBenchmarks(deferred), [deferred]);

  // Session trend: sample the on-course share as the draft evolves. Client
  // memory only — resets with the page, stored nowhere.
  useEffect(() => {
    if (!deferred.trim()) {
      setTrend([]);
      return;
    }
    setTrend((prev) => {
      const next = [...prev, { v: benchmarks.onCourse }];
      return next.length > 30 ? next.slice(next.length - 30) : next;
    });
    // benchmarks derives from deferred; sampling on deferred is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferred]);
  const instrument = useMemo(() => instrumentObservations(benchmarks), [benchmarks]);
  const observations: (Observation | InstrumentObservation)[] =
    pioneerObs.length > 0 ? pioneerObs : instrument;

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
        // Network/DB failure is not "feature off" — keep gauges honest.
        if (!cancelled) setDeploy("unreachable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (deploy !== "on" || !deferred.trim() || deferred.length < MIN_CHARS) {
      setPioneerObs([]);
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
        .then(
          (d: {
            observations?: Observation[];
            unavailable?: boolean;
            modes?: string[];
            profile?: string;
            jurisdictionNotice?: string;
          }) => {
            if (d.unavailable) {
              setPioneerObs([]);
              setProfile(null);
              setReadModes([]);
              setJurisdictionNotice(null);
              return;
            }
            setPioneerObs(Array.isArray(d.observations) ? d.observations : []);
            setProfile(typeof d.profile === "string" ? d.profile : null);
            setReadModes(Array.isArray(d.modes) ? d.modes : []);
            setJurisdictionNotice(
              typeof d.jurisdictionNotice === "string" ? d.jurisdictionNotice : null
            );
            setTipIndex(0);
          }
        )
        .catch(() => setPioneerObs([]))
        .finally(() => setObserving(false));
    }, OBSERVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [deferred, deploy]);

  const tip = observations[Math.min(tipIndex, Math.max(0, observations.length - 1))];
  const feedbackSource = pioneerObs.length > 0 ? "pioneer" : instrument.length > 0 ? "instrument" : null;
  const liveStatus = superbyteLiveStatus({
    draftLen: deferred.trim().length,
    minChars: MIN_CHARS,
    deploy,
    observing,
    feedbackSource,
    observationCount: observations.length
  });
  const layer = superbyteLayerLabel(feedbackSource, observing, deploy);
  const onCoursePct = Math.round(benchmarks.onCourse * 100);

  return (
    <section
      id="advisor-superbyte"
      aria-label="SuperByte observational pioneer"
      className="bytestar-panel select-none scroll-mt-2 rounded-xl bg-gradient-to-br from-amber-50/90 via-white to-teal-50/40 p-3 ring-1 ring-amber-300/60"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <ByteStarFace mood={mood} />
          <div className="absolute -bottom-1 -right-1 rounded bg-amber-900/90 px-1 py-px text-[0.55rem] font-bold text-amber-100">
            observe
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-base font-bold text-brand-navy">SuperByte</h3>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-px text-[0.6rem] font-bold ring-1 ${layerToneClass(layer.tone)}`}
                  title="Which layer is speaking — pioneer model or local instrument gauges"
                >
                  {layer.label}
                </span>
                <HelpTip label="What SuperByte does">
                  One-way observations only. You cannot prompt it, rate it, or copy its text into
                  the note. When the pioneer model is off, the gauges still run locally from the
                  same rules Byte uses.
                  {" "}
                  {BYTESTAR_DISCLAIMER}
                </HelpTip>
              </div>
              <p className="text-xs text-amber-900/70">
                gives you feedback · you do not give it feedback
              </p>
              {/* Present-tense status — HF MessageUpdate pattern. The tagline
                  above says what SuperByte IS; this line says what it is doing. */}
              <p className="mt-0.5 text-xs font-medium text-amber-950/80" aria-live="polite">
                {liveStatus}
              </p>
              {profile && profile !== "documentation" && (
                /* Which cage configuration read this draft. Strict reads run
                   more passes, demand unanimity, and refuse rewrites — worth a
                   visible chip so staff know why observations went quieter. */
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[0.6rem] font-bold text-rose-900 ring-1 ring-rose-300">
                  {readModes.filter((m) => m !== "documentation").join(" + ")} — strict read
                  <HelpTip label="About strict reads">
                    This draft touches a higher-risk domain, so SuperByte read it under a stricter
                    profile: unanimous independent reads, no rewrites, named authorities only.
                    Fewer observations here is the system working.
                  </HelpTip>
                </span>
              )}
            </div>
            <NorthStarCompass onCourse={benchmarks.onCourse} />
          </div>
          {jurisdictionNotice && (
            <p className="mt-2 rounded border border-slate-300 bg-slate-50 px-2 py-1 text-[0.65rem] leading-relaxed text-slate-700">
              {jurisdictionNotice}
            </p>
          )}

          {/* The one-way rule stays on screen — it governs how you may USE the
              panel, so it has to be readable without asking. The long
              experimental disclaimer moved into the help tip beside the title:
              it describes what SuperByte IS rather than anything happening now,
              and a permanent 60-word paragraph in an always-visible panel
              pushed Byte off the bottom of the aside entirely. */}
          <p className="mt-2 text-xs font-medium leading-relaxed text-amber-950/80">
            {BYTESTAR_ONE_WAY_NOTICE}
          </p>

          {tip ? (
            <div
              className="relative mt-2 overflow-hidden rounded-lg bg-white/90 p-2.5 ring-1 ring-amber-200/80"
              aria-live="polite"
              aria-atomic
            >
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />
              <p className="text-xs font-semibold text-amber-900">
                {tip.kind}
                {feedbackSource === "instrument" && (
                  <span className="ml-1 normal-case text-slate-400">· instrument reading</span>
                )}
                {"tentative" in tip && tip.tentative && (
                  /* Assigned by deterministic code (strong claim, no named
                     authority) — never by the model grading itself. */
                  <span className="ml-1.5 rounded bg-orange-100 px-1.5 py-px normal-case font-semibold text-orange-900 ring-1 ring-orange-300">
                    Tentative — requires clinician review
                  </span>
                )}
              </p>
              <p className="text-base font-semibold leading-snug text-slate-900">{tip.say}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">{tip.why}</p>
              {tip.question && (
                <p className="mt-1.5 text-sm font-semibold text-brand-navy">{tip.question}</p>
              )}
              <p className="mt-1.5 border-t border-amber-100/80 pt-1 text-[0.65rem] text-slate-400">
                Source: {tip.source}
                {"corroboration" in tip && tip.corroboration && tip.corroboration.reads > 1 && (
                  <span className="ml-2 text-teal-700">
                    · corroborated in {tip.corroboration.seen} of {tip.corroboration.reads} independent reads
                  </span>
                )}
              </p>
              {observations.length > 1 && (
                /* Staff pace — same control Byte uses. Auto-rotate fought the
                   reader (HF Chat UI lets people browse messages; we do not
                   yank the only observation off screen every 8s). */
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-amber-900 underline decoration-dotted underline-offset-2"
                    onClick={() =>
                      setTipIndex((i) => (i - 1 + observations.length) % observations.length)
                    }
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-amber-900 underline decoration-dotted underline-offset-2"
                    onClick={() => setTipIndex((i) => (i + 1) % observations.length)}
                  >
                    Next reading ({(tipIndex % observations.length) + 1} of {observations.length})
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              {observing
                ? "SuperByte is reading the draft…"
                : deferred.trim().length < MIN_CHARS
                  ? "Keep typing — feedback appears when the draft is long enough to analyze."
                  : deploy === "off"
                    ? "Pioneer model is dark on this deployment. A Team Lead opens it by setting AI_GATEWAY_API_KEY (see SuperByte monitor), then redeploying. Gauges below still run locally."
                    : deploy === "unreachable"
                      ? "Could not reach the pioneer just now — try again shortly. Gauges below still run locally."
                      : "Drift gauges below are live. Pioneer observations appear as the draft settles."}
            </p>
          )}
        </div>
      </div>

      {benchmarks.gauges.words > 0 && (
        /* Progressive disclosure — compass stays the glanceable primary;
           rail detail opens on demand (eye-tracking: progressive disclosure
           over deletion; HF Chat UI keeps tools secondary to the message). */
        <details className="mt-3 border-t border-amber-200/50 pt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
            <h4 className="label-micro inline-flex items-center gap-1">
              Drift to NorthStar
              <HelpTip label="About drift gauges" side="top">
                Each rail shows how this draft sits against practice targets (read coverage, active
                voice, later-reader pillars, TN cues). Toward / on-target / away is computed
                locally — not a model score.
              </HelpTip>
            </h4>
            <div className="flex items-center gap-2">
              <TrendSpark samples={trend} />
              <span
                className={`text-[0.65rem] tabular-nums ${
                  benchmarks.onCourse >= 0.75 ? "text-teal-700" : "text-amber-800"
                }`}
              >
                {onCoursePct}% on course · open
              </span>
            </div>
          </summary>
          <BenchmarkRails readings={benchmarks.readings} />
        </details>
      )}
    </section>
  );
}
