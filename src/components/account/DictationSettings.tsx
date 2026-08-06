"use client";

import { useDictationUnlock, VoiceEnrollment } from "@/components/standardize/VoiceEnrollment";

// DICTATION SETUP, moved off the critical path.
//
// Voice enrollment is a good feature with a bad location. It used to render
// ABOVE the textarea on the second-most-used screen in the app for anyone who
// had not done it — a 382-line panel with a region picker, a prompt carousel
// and a progress bar, demanding three to five minutes of reading aloud, sitting
// between a clinician and the note they came to write. People who will never
// dictate paid that cost on every visit.
//
// Nothing about the feature changed. The enrollment is the same read-only
// three-to-five minutes, still stored per device in localStorage with no server
// round trip, and the mic still appears on the note's text fields once it is
// done. It is simply here, where someone goes when they want it, instead of in
// front of everyone who does not.
export function DictationSettings({ username }: { username: string }) {
  const voice = useDictationUnlock(username);

  return (
    <section className="mt-8">
      <h2 className="mb-2 text-lg font-semibold">Dictation</h2>
      {voice.unlocked ? (
        <div className="rounded-lg border border-brand-teal/40 bg-brand-teal/5 p-3 text-sm text-slate-700">
          <p className="font-semibold text-brand-navy">Dictation is set up on this device.</p>
          <p className="mt-1 text-xs text-slate-600">
            The microphone appears on the note&rsquo;s text fields. Enrollment is stored on this
            device only — a different browser or computer needs its own.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-2 text-sm text-slate-600">
            Optional. Reading a short script once teaches the browser how you say dental words, so
            what it types is closer to what you meant. Nothing is sent anywhere — the recognition
            runs in the browser and the result is stored on this device.
          </p>
          <VoiceEnrollment username={username} onUnlocked={voice.markUnlocked} />
        </>
      )}
    </section>
  );
}
