/**
 * WHY THERE IS NO MICROPHONE.
 *
 * `engine.available()` answers one question — does a recognizer constructor
 * exist — and the UI treated that as the whole story. It is not, and the two
 * gaps both fail in the worst possible way: silently, or with the wrong reason.
 *
 *  - SECURE CONTEXT. Chrome exposes `webkitSpeechRecognition` on plain http and
 *    then refuses to start, reporting `not-allowed`. The button therefore
 *    appeared, failed, and told the writer "Microphone permission is blocked
 *    for this site" — sending them to fix a permission that was never the
 *    problem, on a page where no permission could have helped.
 *  - FIREFOX. It ships no SpeechRecognition at all (the implementation sits
 *    behind an off-by-default pref). The constructor is absent, the button
 *    renders nothing, and the writer is left to conclude the feature is broken
 *    rather than absent.
 *
 * So availability is a value with a reason attached, computed in one place and
 * rendered wherever the microphone would otherwise be. Pure and
 * environment-injectable, so every branch is testable without a browser.
 */

export type DictationAvailability =
  /** A microphone can be offered. */
  | { status: "ready" }
  /** The deployment turned dictation off at build time. */
  | { status: "disabled" }
  /** The page is not a secure context; the engine will refuse to start. */
  | { status: "insecure" }
  /** This browser has no speech recognition to offer. */
  | { status: "unsupported" }
  /** Server render: nothing is known yet, so promise nothing. */
  | { status: "unknown" };

export interface DictationEnvironment {
  /** `NEXT_PUBLIC_DICTATION_DISABLED === "1"`. */
  disabled: boolean;
  /** `window.isSecureContext`. */
  secureContext: boolean;
  /** A SpeechRecognition constructor exists on this window. */
  hasEngine: boolean;
}

/**
 * Order matters, and it is the order of things a person can act on.
 *
 * "disabled" outranks everything: when a practice has turned the feature off,
 * naming a browser or a certificate would send somebody to fix a problem that
 * is not theirs. Secure context outranks engine support because an insecure
 * origin can hide engine support that is really there.
 */
export function dictationAvailability(env: DictationEnvironment): DictationAvailability {
  if (env.disabled) return { status: "disabled" };
  if (!env.secureContext) return { status: "insecure" };
  if (!env.hasEngine) return { status: "unsupported" };
  return { status: "ready" };
}

/**
 * What to say, in one sentence, to somebody who wanted to talk to the app.
 *
 * Every sentence names the thing that would change the outcome. "Not
 * available" tells a person nothing they can use; "your browser cannot do
 * this, Chrome, Edge and Safari can" tells them exactly what to do next.
 *
 * Empty string for the two states with nothing to say: ready needs no excuse,
 * and unknown is a server render that has not measured anything yet.
 */
export function availabilityMessage(a: DictationAvailability): string {
  switch (a.status) {
    case "disabled":
      return "Dictation is switched off for this practice.";
    case "insecure":
      return "Dictation needs a secure (https) connection. This page is not on one, so the microphone cannot start.";
    case "unsupported":
      return "This browser cannot do speech recognition. Chrome, Edge and Safari can.";
    case "ready":
    case "unknown":
      return "";
  }
}
