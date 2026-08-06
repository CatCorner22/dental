// DICTATION ENGINE SEAM — the provider-abstraction decision, made deliberately.
//
// The voice-to-text landscape digest is explicit: build against a swappable
// engine interface, not one vendor's API. Today one engine exists (the
// browser's built-in speech service). The planned second engine is on-device
// Whisper via a WASM/ONNX runtime — audio never leaving the machine — which
// slots in HERE without touching the button, the normalization pass, or any
// gate downstream.
//
// Stability rules for the browser engine (Phase 1 hardened):
// - English only (`en-US`); no multilingual guessing.
// - Finals are the only committed text; interims are display-only.
// - maxAlternatives = 1 so the engine cannot hand us an "autocorrected" #2.
// - Continuous mode with supervised restart on idle `onend` (not user stop).
// - Optional SpeechGrammarList hints boost dental + regional phrases without
//   rewriting anything after recognition.
//
// The `offDevice` flag is load-bearing UI truth: engines that may ship audio
// to a vendor's servers are labeled so in the interface.

/** Only U.S. English is supported in this product surface. */
export const DICTATION_LANG = "en-US";

export type DictationErrorCode =
  | "not-allowed"
  | "no-speech"
  | "network"
  | "aborted"
  | "unsupported"
  | "unknown";

export interface DictationStartOptions {
  /** Phrases to boost via SpeechGrammarList when the browser supports it. */
  grammarPhrases?: readonly string[];
  /** Called with non-final hypotheses for live preview only — never apply. */
  onInterim?: (text: string) => void;
  /** Structured error for UI; listening may continue or end depending on code. */
  onError?: (code: DictationErrorCode, message: string) => void;
}

export interface DictationEngine {
  id: string;
  label: string;
  /** True when audio may be processed off this device. Drives the warning. */
  offDevice: boolean;
  /** BCP-47 language tag this engine is locked to. */
  lang: string;
  available: () => boolean;
  /**
   * Begin listening. Final transcript chunks arrive on `onFinal`.
   * `onEnd` fires when the session fully stops (user stop or hard failure).
   */
  start: (
    onFinal: (text: string) => void,
    onEnd: () => void,
    opts?: DictationStartOptions
  ) => void;
  stop: () => void;
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<{
          isFinal: boolean;
          0: { transcript: string; confidence?: number };
          length: number;
        }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  grammars?: unknown;
};

type SpeechGrammarListLike = {
  addFromString: (grammar: string, weight?: number) => void;
  length: number;
};

function getRecognizerCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function getGrammarListCtor(): (new () => SpeechGrammarListLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechGrammarList?: new () => SpeechGrammarListLike;
    webkitSpeechGrammarList?: new () => SpeechGrammarListLike;
  };
  return w.SpeechGrammarList ?? w.webkitSpeechGrammarList ?? null;
}

/**
 * JSGF grammar string for phrase boosting. Browsers may ignore this; when
 * honored it improves recognition without post-hoc autocorrect.
 */
export function buildJsgfGrammar(phrases: readonly string[]): string {
  const cleaned = phrases
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 0 && p.length < 80)
    .slice(0, 80);
  if (cleaned.length === 0) return "#JSGF V1.0; grammar empty; public <u> = epsilon;";
  // Escape characters that break JSGF tokens.
  const alts = cleaned.map((p) =>
    p
      .replace(/[\\;|=*+<>()[\]{}]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
  return `#JSGF V1.0; grammar smileNotes; public <phrase> = ${alts.join(" | ")} ;`;
}

function mapError(code: string | undefined): DictationErrorCode {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "not-allowed";
    case "no-speech":
      return "no-speech";
    case "network":
      return "network";
    case "aborted":
      return "aborted";
    default:
      return "unknown";
  }
}

/**
 * The browser's built-in speech service. Consumer-grade: audio may be
 * processed on the vendor's servers, so the de-identification rule applies
 * to the SPOKEN words. Hardened for continuous English-only operatory use.
 */
export function browserSpeechEngine(): DictationEngine {
  let rec: SpeechRecognitionLike | null = null;
  let intentionalStop = false;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  const clearRestart = () => {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  };

  return {
    id: "browser-speech",
    label: "Browser speech service",
    offDevice: true,
    lang: DICTATION_LANG,
    available: () => getRecognizerCtor() !== null,
    start: (onFinal, onEnd, opts = {}) => {
      const Ctor = getRecognizerCtor();
      if (!Ctor) {
        opts.onError?.("unsupported", "Speech recognition is not available in this browser.");
        onEnd();
        return;
      }
      intentionalStop = false;
      clearRestart();

      const attach = (): void => {
        const r = new Ctor();
        r.lang = DICTATION_LANG;
        r.continuous = true;
        // Interims for live preview stability; only finals are committed.
        r.interimResults = true;
        // Never surface alternative "corrections" — first hypothesis only.
        r.maxAlternatives = 1;

        const GrammarCtor = getGrammarListCtor();
        if (GrammarCtor && opts.grammarPhrases && opts.grammarPhrases.length > 0) {
          try {
            const list = new GrammarCtor();
            list.addFromString(buildJsgfGrammar(opts.grammarPhrases), 1);
            r.grammars = list;
          } catch {
            // Grammar support is best-effort; recognition still works.
          }
        }

        r.onresult = (e) => {
          let interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const result = e.results[i];
            if (!result) continue;
            // Always take alternative 0 — maxAlternatives is 1 by contract.
            const t = result[0]?.transcript?.trim() ?? "";
            if (!t) continue;
            if (result.isFinal) onFinal(t);
            else interim = t;
          }
          if (interim) opts.onInterim?.(interim);
        };

        r.onerror = (ev) => {
          const code = mapError(ev.error);
          // no-speech is common during pauses — keep the session, do not end.
          if (code === "no-speech" || code === "aborted") {
            opts.onError?.(code, "Paused — keep speaking when ready.");
            return;
          }
          opts.onError?.(
            code,
            code === "not-allowed"
              ? "Microphone permission is blocked for this site."
              : code === "network"
                ? "Speech service network error — check the connection."
                : "Speech recognition error — try again."
          );
          if (code === "not-allowed" || code === "network") {
            intentionalStop = true;
            clearRestart();
            try {
              r.stop();
            } catch {
              /* ignore */
            }
            rec = null;
            onEnd();
          }
        };

        r.onend = () => {
          // Continuous mode often ends after a silence. Restart unless the
          // writer asked to stop or we hit a hard failure.
          if (intentionalStop) {
            rec = null;
            onEnd();
            return;
          }
          clearRestart();
          restartTimer = setTimeout(() => {
            if (intentionalStop) return;
            try {
              attach();
            } catch {
              intentionalStop = true;
              rec = null;
              onEnd();
            }
          }, 250);
        };

        rec = r;
        try {
          r.start();
        } catch {
          // InvalidStateError if already started — treat as soft failure.
          intentionalStop = true;
          rec = null;
          onEnd();
        }
      };

      attach();
    },
    stop: () => {
      intentionalStop = true;
      clearRestart();
      const r = rec;
      rec = null;
      try {
        r?.stop();
      } catch {
        try {
          r?.abort();
        } catch {
          /* ignore */
        }
      }
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
