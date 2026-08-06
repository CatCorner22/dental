"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  browserSpeechEngine,
  dictationDisabled,
  type DictationEngine
} from "@/lib/dictation/engine";
import { normalizeDictation } from "@/lib/dictation/normalize";
import { DENTAL_ENROLLMENT_PHRASES, phrasesForRegion, type UsaRegionId } from "@/lib/dictation/regional";
import { glossColloquialisms } from "@/lib/dictation/comprehension";

// VOICE DICTATION — apply mode (post-enrollment only).
//
// Enrollment is the first deliverable and is read-only. This button only
// mounts when unlock is granted. Join-only dental repairs may run; regional
// colloquialisms are NEVER autocorrected — optional gloss chips explain them.
//
// The warning the writer sees is derived from the ENGINE's offDevice flag.

export function DictationButton({
  onText,
  disabled,
  region = "general",
  grammarExtra = []
}: {
  onText: (text: string) => void;
  disabled?: boolean;
  /** Region used for grammar boosting + read-only glosses. */
  region?: UsaRegionId;
  /** Extra phrases to boost (e.g. from enrollment record). */
  grammarExtra?: readonly string[];
}) {
  const engine: DictationEngine = useMemo(() => browserSpeechEngine(), []);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [tidied, setTidied] = useState(0);
  const [interim, setInterim] = useState("");
  const [lastFinal, setLastFinal] = useState("");
  const [error, setError] = useState("");
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const grammarPhrases = useMemo(() => {
    const regional = phrasesForRegion(region).map((p) => p.say);
    return [...new Set([...DENTAL_ENROLLMENT_PHRASES, ...regional, ...grammarExtra])].slice(0, 80);
  }, [region, grammarExtra]);

  useEffect(() => {
    setSupported(!dictationDisabled() && engine.available());
    return () => engine.stop();
  }, [engine]);

  if (!supported) return null;

  const stop = () => {
    engine.stop();
    setListening(false);
    setInterim("");
  };

  const start = () => {
    setTidied(0);
    setError("");
    setLastFinal("");
    engine.start(
      (raw) => {
        // Deterministic dental-term joins only — never colloquial "fixes".
        const { text, changes } = normalizeDictation(raw);
        if (changes.length > 0) setTidied((n) => n + changes.length);
        setLastFinal(text);
        setInterim("");
        onTextRef.current(text);
      },
      () => {
        setListening(false);
        setInterim("");
      },
      {
        grammarPhrases,
        onInterim: (t) => setInterim(t),
        onError: (code, message) => {
          if (code === "no-speech" || code === "aborted") return;
          setError(message);
        }
      }
    );
    setListening(true);
  };

  const glosses = lastFinal ? glossColloquialisms(lastFinal, region) : [];

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        className={`btn-secondary min-h-11 px-4 ${listening ? "border-rose-400 bg-rose-50 text-rose-900" : ""}`}
        disabled={disabled}
        aria-pressed={listening}
        title={
          listening
            ? "Stop dictating"
            : engine.offDevice
              ? `Dictate into the note box via the ${engine.label.toLowerCase()} (${engine.lang}). Speak de-identified facts only — this engine may process audio off-device. No autocorrect.`
              : `Dictate into the note box via ${engine.label.toLowerCase()} (${engine.lang}) — audio stays on this device. No autocorrect.`
        }
        onClick={listening ? stop : start}
      >
        {listening ? "◼ Stop dictation" : "🎤 Dictate"}
      </button>
      {listening && (
        <span className="text-xs text-rose-800" role="status">
          Listening ({engine.lang}
          {engine.offDevice ? " — speak de-identified facts only" : ""}).
          {interim ? ` …${interim}` : ""}
        </span>
      )}
      {!listening && tidied > 0 && (
        <span className="text-xs text-slate-500" role="status">
          {tidied} dental term{tidied === 1 ? "" : "s"} tidied (split words joined — nothing
          reworded or autocorrected).
        </span>
      )}
      {error && (
        <span className="text-xs text-red-700" role="alert">
          {error}
        </span>
      )}
      {glosses.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {glosses.map((g) => (
            <span
              key={g.phrase}
              className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.65rem] text-slate-600"
              title="Read-only gloss — your words were not changed"
            >
              {g.phrase}: {g.gloss}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
