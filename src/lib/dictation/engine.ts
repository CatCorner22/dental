// DICTATION ENGINE SEAM — the provider-abstraction decision, made deliberately.
//
// The voice-to-text landscape digest is explicit: build against a swappable
// engine interface, not one vendor's API. Today one engine exists (the
// browser's built-in speech service). The planned second engine is on-device
// Whisper via a WASM/ONNX runtime — audio never leaving the machine — which
// slots in HERE without touching the button, the normalization pass, or any
// gate downstream.
//
// The `offDevice` flag is load-bearing UI truth: engines that may ship audio
// to a vendor's servers are labeled so in the interface, and the warning the
// writer sees is derived from the engine, not hard-coded.

export interface DictationEngine {
  id: string;
  label: string;
  /** True when audio may be processed off this device. Drives the warning. */
  offDevice: boolean;
  available: () => boolean;
  /** Begin listening; final transcript chunks arrive on `onFinal`. */
  start: (onFinal: (text: string) => void, onEnd: () => void) => void;
  stop: () => void;
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null;
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

/** The browser's built-in speech service. Consumer-grade: audio may be
 *  processed on the vendor's servers, so the de-identification rule applies
 *  to the SPOKEN words. The engine to replace, not the engine to build on. */
export function browserSpeechEngine(): DictationEngine {
  let rec: SpeechRecognitionLike | null = null;
  return {
    id: "browser-speech",
    label: "Browser speech service",
    offDevice: true,
    available: () => getRecognizer() !== null,
    start: (onFinal, onEnd) => {
      const r = getRecognizer();
      if (!r) {
        onEnd();
        return;
      }
      r.lang = "en-US";
      r.continuous = true;
      r.interimResults = false;
      r.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          if (result?.isFinal) {
            const t = result[0]?.transcript?.trim();
            if (t) onFinal(t);
          }
        }
      };
      r.onend = onEnd;
      r.onerror = onEnd;
      rec = r;
      r.start();
    },
    stop: () => {
      rec?.stop();
      rec = null;
    }
  };
}

/**
 * The deployment's dictation posture. `NEXT_PUBLIC_DICTATION_DISABLED=1`
 * removes the feature entirely — a practice whose compliance review will not
 * accept an off-device engine turns the microphone off here, not by policy
 * memo. Build-time constant by Next.js design, which is correct: the posture
 * is a deployment decision, not a per-user preference.
 */
export function dictationDisabled(): boolean {
  return process.env.NEXT_PUBLIC_DICTATION_DISABLED === "1";
}
