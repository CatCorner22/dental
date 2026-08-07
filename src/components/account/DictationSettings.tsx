"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { VoiceEnrollment } from "@/components/standardize/VoiceEnrollment";
import {
  availabilityMessage,
  dictationAvailability,
  type DictationAvailability
} from "@/lib/dictation/availability";
import { browserSpeechEngine, dictationDisabled } from "@/lib/dictation/engine";
import type { EnrollmentRecord } from "@/lib/dictation/enrollment";

// DICTATION SETUP, ON THE PERSON RATHER THAN THE BROWSER.
//
// Voice enrollment is a good feature that had two bad properties. Its location
// was fixed first: it used to render ABOVE the textarea on the second-most-used
// screen for anyone who had not done it, so people who would never dictate paid
// minutes of reading aloud on every visit. It lives here now.
//
// The second was worse, and is fixed here: the completed enrollment lived in
// this browser's localStorage. The read-aloud came back on every new computer,
// every profile, every private window and after any "clear site data" — so in
// an operatory of shared workstations it never stayed done. It is recorded
// against the account now. Set it up once, on any machine, and the microphone
// is there on all of them.
//
// Smile Notes stores no audio and no transcript — only that the session
// happened, when, and which regional prompt set was used. That is not the same
// as "recognition stays on this device": browserSpeechEngine().offDevice is the
// load-bearing UI truth (same flag DictationButton and VoiceEnrollment use).
export function DictationSettings({
  username,
  enrolled,
  region
}: {
  username: string;
  enrolled: boolean;
  region: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Engine truth for copy: do not invent an on-device story when offDevice is set.
  const engine = browserSpeechEngine();
  // Only the browser knows whether it has an engine and whether this origin is
  // secure, so it is measured after mount. A server render promises nothing.
  const [availability, setAvailability] = useState<DictationAvailability>({ status: "unknown" });
  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    setAvailability(
      dictationAvailability({
        disabled: dictationDisabled(),
        secureContext: window.isSecureContext,
        hasEngine: Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition)
      })
    );
  }, []);

  const save = async (record: EnrollmentRecord) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/me/dictation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          listenedMs: record.listenedMs,
          utterances: record.utterances,
          promptsCompleted: record.promptsCompleted,
          region: record.region
        })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not save your dictation setup.");
        return;
      }
      // Re-read from the server so the note screens see the new state on the
      // next navigation rather than after a manual reload.
      router.refresh();
    } catch {
      setError("Could not reach the server — try again.");
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    setError("");
    try {
      await fetch("/api/me/dictation", { method: "DELETE" });
      router.refresh();
    } catch {
      setError("Could not reach the server — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8">
      <h2 className="section-title mb-2">Dictation</h2>

      {/* Stated even to somebody already enrolled: a person who set this up on
          their own laptop and then opened Firefox at the front desk needs to
          know why the microphone is missing, and rendering nothing is not an
          answer to that question. */}
      {availability.status !== "ready" && availability.status !== "unknown" && (
        <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {availabilityMessage(availability)}
        </p>
      )}

      {enrolled ? (
        <div className="rounded-lg border border-brand-teal/40 bg-brand-teal/5 p-3 text-sm text-slate-700">
          <p className="font-semibold text-brand-navy">Dictation is set up for your account.</p>
          <p className="mt-1 text-xs text-slate-600">
            The microphone appears on the note&rsquo;s text boxes, on every computer you sign in
            to{region ? ` (prompt set: ${region})` : ""}. Smile Notes does not keep a recording.
            {engine.offDevice
              ? " The browser speech service may process audio off this device — speak de-identified facts only."
              : ""}
          </p>
          <button
            type="button"
            className="btn-secondary mt-2 text-xs"
            disabled={busy}
            onClick={() => void clear()}
          >
            {busy ? "Working…" : "Set it up again"}
          </button>
        </div>
      ) : (
        <>
          <p className="mb-2 text-sm text-slate-600">
            Optional, and about ninety seconds. Reading a short script once lets you hear how the
            software handles dental words, and teaches it the phrases you use. Smile Notes does not
            keep audio or a transcript — only that you finished is saved.
            {engine.offDevice
              ? " The browser speech service may process audio off this device, so speak de-identified facts only."
              : " Recognition stays on this device."}
          </p>
          <VoiceEnrollment username={username} onUnlocked={(r) => void save(r)} />
        </>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
