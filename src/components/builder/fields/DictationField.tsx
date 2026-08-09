"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DictationButton } from "@/components/standardize/DictationButton";
import { VoiceEnrollment } from "@/components/standardize/VoiceEnrollment";
import { Dialog } from "@/components/ui/Dialog";
import {
  availabilityMessage,
  dictationAvailability,
  type DictationAvailability
} from "@/lib/dictation/availability";
import { dictationDisabled } from "@/lib/dictation/engine";
import type { EnrollmentRecord } from "@/lib/dictation/enrollment";
import type { UsaRegionId } from "@/lib/dictation/regional";

/**
 * Who is writing, and whether they have set dictation up.
 *
 * A context rather than a prop threaded through NoteForm and all seven input
 * components: only one of them needs it, and a required prop on every field
 * renderer to serve one optional control on one of them is the kind of
 * plumbing that gets copy-pasted wrong later.
 *
 * There is no SessionProvider in this app — every page reads the user fresh
 * from the database on the server, deliberately, so that a demotion bites on
 * the next click rather than when a token expires. `enrolled` now arrives the
 * same way, and for one further reason: a client fetch would race the
 * legal-notice gate, which refuses every API with 403 until the notice is
 * acknowledged, on a page that mounts the instant somebody signs in.
 */
export interface DictationUser {
  username: string;
  enrolled: boolean;
  region: UsaRegionId | null;
}

export const DictationUserContext = createContext<DictationUser>({
  username: "",
  enrolled: false,
  region: null
});

function useAvailability(): DictationAvailability {
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
  return availability;
}

async function persistEnrollment(record: EnrollmentRecord): Promise<string | null> {
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
      return data.error ?? "Could not save dictation setup.";
    }
    return null;
  } catch {
    return "Could not reach the server — try again.";
  }
}

/**
 * The microphone on a note field — or the reason there is not one.
 *
 * Honest Finish / RSI hate: enrollment must not force an Account pilgrimage
 * mid-note. Ready browsers get an inline Set up dialog; Account remains the
 * settings home.
 */
export function DictationField({
  onText,
  active,
  focused
}: {
  onText: (text: string) => void;
  active: boolean;
  focused: boolean;
}) {
  const user = useContext(DictationUserContext);
  const availability = useAvailability();
  const [showEnroll, setShowEnroll] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Local override so enroll-here unlocks the mic without leaving the note. */
  const [localUnlock, setLocalUnlock] = useState<{
    enrolled: true;
    region: UsaRegionId;
  } | null>(null);

  const enrolled = user.enrolled || localUnlock?.enrolled === true;
  const region = localUnlock?.region ?? user.region;

  if (!user.username) return null;
  if (availability.status === "unknown" || availability.status === "disabled") return null;

  if (availability.status === "ready" && enrolled) {
    if (!active) return null;
    return (
      <div className="mt-1">
        <DictationButton onText={onText} region={region ?? "general"} />
      </div>
    );
  }

  if (!focused) return null;

  if (availability.status === "ready") {
    return (
      <div className="mt-1">
        <button
          type="button"
          className="text-xs font-medium text-brand-blue underline"
          onClick={() => {
            setSaveError(null);
            setShowEnroll(true);
          }}
        >
          Set up dictation here
        </button>
        <span className="text-xs text-slate-600"> — about ninety seconds, once.</span>
        {showEnroll && (
          <Dialog title="Set up dictation" onClose={() => setShowEnroll(false)}>
            <p className="mb-3 text-sm text-slate-700">
              Saves to your account. When you finish, Dictate appears on this
              field — no trip to Account.
            </p>
            <VoiceEnrollment
              username={user.username}
              onUnlocked={(record) => {
                void (async () => {
                  setSaving(true);
                  setSaveError(null);
                  const err = await persistEnrollment(record);
                  setSaving(false);
                  if (err) {
                    setSaveError(err);
                    return;
                  }
                  setLocalUnlock({ enrolled: true, region: record.region });
                  setShowEnroll(false);
                })();
              }}
            />
            {saving ? (
              <p className="mt-2 text-xs text-slate-600">Saving setup…</p>
            ) : null}
            {saveError ? (
              <p className="mt-2 text-sm text-red-700" role="alert">
                {saveError}
              </p>
            ) : null}
          </Dialog>
        )}
      </div>
    );
  }

  return <p className="mt-1 text-xs text-slate-600">{availabilityMessage(availability)}</p>;
}
