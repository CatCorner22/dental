"use client";

import { useEffect, useRef, useState } from "react";

// VOICE DICTATION — browser speech recognition feeding the same deterministic
// pipeline as typed text. Nothing here bypasses a gate: dictated words land in
// the input box and face the identical audit, queue, and copy lock.
//
// The honest caveat is stated in the UI: browser speech services may process
// audio on the vendor's servers, so the de-identification rule applies to the
// SPOKEN words, not just the typed ones. Hidden when the API is unsupported —
// a dead microphone button is worse than none.

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getRecognizer(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function DictationButton({ onText, disabled }: { onText: (text: string) => void; disabled?: boolean }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    setSupported(getRecognizer() !== null);
    return () => recRef.current?.stop();
  }, []);

  if (!supported) return null;

  const stop = () => {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  };

  const start = () => {
    const rec = getRecognizer();
    if (!rec) return;
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r?.isFinal) {
          const t = r[0]?.transcript?.trim();
          if (t) onTextRef.current(t);
        }
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
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
            : "Dictate into the note box. Speak de-identified facts only — the browser's speech service may process audio off-device."
        }
        onClick={listening ? stop : start}
      >
        {listening ? "◼ Stop dictation" : "🎤 Dictate"}
      </button>
      {listening && (
        <span className="text-xs text-rose-800" role="status">
          Listening — speak de-identified facts only.
        </span>
      )}
    </span>
  );
}
