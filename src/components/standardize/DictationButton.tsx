"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { browserSpeechEngine, dictationDisabled, type DictationEngine } from "@/lib/dictation/engine";
import { normalizeDictation } from "@/lib/dictation/normalize";

// VOICE DICTATION — a swappable engine feeding the same deterministic
// pipeline as typed text. Nothing here bypasses a gate: dictated words are
// term-normalized (joins only — see dictation/normalize.ts), land in the
// input box, and face the identical audit, queue, and copy lock.
//
// The warning the writer sees is derived from the ENGINE's offDevice flag,
// not hard-coded — when the on-device Whisper engine lands, the label and
// caution update themselves. Hidden entirely when the deployment disables
// dictation or the engine is unavailable: a dead microphone button is worse
// than none.

export function DictationButton({
  onText,
  disabled
}: {
  onText: (text: string) => void;
  disabled?: boolean;
}) {
  const engine: DictationEngine = useMemo(() => browserSpeechEngine(), []);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [tidied, setTidied] = useState(0);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    setSupported(!dictationDisabled() && engine.available());
    return () => engine.stop();
  }, [engine]);

  if (!supported) return null;

  const stop = () => {
    engine.stop();
    setListening(false);
  };

  const start = () => {
    setTidied(0);
    engine.start(
      (raw) => {
        // Deterministic dental-term joins only — the writer sees the result
        // land and edits it like anything typed.
        const { text, changes } = normalizeDictation(raw);
        if (changes.length > 0) setTidied((n) => n + changes.length);
        onTextRef.current(text);
      },
      () => setListening(false)
    );
    setListening(true);
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        className={`btn-secondary min-h-11 px-4 ${listening ? "border-rose-400 bg-rose-50 text-rose-900" : ""}`}
        disabled={disabled}
        aria-pressed={listening}
        title={
          listening
            ? "Stop dictating"
            : engine.offDevice
              ? `Dictate into the note box via the ${engine.label.toLowerCase()}. Speak de-identified facts only — this engine may process audio off-device.`
              : `Dictate into the note box via ${engine.label.toLowerCase()} — audio stays on this device.`
        }
        onClick={listening ? stop : start}
      >
        {listening ? "◼ Stop dictation" : "🎤 Dictate"}
      </button>
      {listening && (
        <span className="text-xs text-rose-800" role="status">
          Listening{engine.offDevice ? " — speak de-identified facts only" : ""}.
        </span>
      )}
      {!listening && tidied > 0 && (
        <span className="text-xs text-slate-500" role="status">
          {tidied} dental term{tidied === 1 ? "" : "s"} tidied (split words joined — nothing
          reworded).
        </span>
      )}
    </span>
  );
}
