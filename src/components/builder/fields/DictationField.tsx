"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { DictationButton } from "@/components/standardize/DictationButton";
import {
  availabilityMessage,
  dictationAvailability,
  type DictationAvailability
} from "@/lib/dictation/availability";
import { dictationDisabled } from "@/lib/dictation/engine";
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

/**
 * What this browser, on this origin, can actually do.
 *
 * Measured in an effect rather than during render: `window` does not exist on
 * the server, and a server render that guessed would contradict itself on
 * hydration. Starts as "unknown", which promises nothing.
 */
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

/**
 * The microphone on a note field — or the reason there is not one.
 *
 * This used to `return null` in every case except "enrolled and supported",
 * so the note page contained no microphone and never said the word dictation.
 * Somebody who wanted to talk to the app had no way to discover that the
 * feature existed, where to set it up, or why it was missing. On an insecure
 * origin it was worse than silent: the engine reported a blocked microphone
 * permission, sending people to fix something that was never wrong.
 *
 * There is always an answer now, and it appears only where it is wanted.
 * `active` is the same focused-or-has-content signal the verified-block chip
 * uses, so a writer who is simply typing pays one line for this, in the one
 * box their cursor is in.
 */
export function DictationField({
  onText,
  active,
  focused
}: {
  onText: (text: string) => void;
  /** The cursor is here, or this box already holds words. Governs the control. */
  active: boolean;
  /**
   * The cursor is here RIGHT NOW. Governs the prose.
   *
   * These were one flag, and the flag was "focused or has content" — which is
   * never false again once somebody has written a sentence. So the twenty-word
   * setup offer, or the paragraph explaining why this browser cannot dictate,
   * was repeated under every filled box on the note: five copies in the
   * narrative alone, all saying the same thing, none of them news. A control
   * can reasonably stay where the work is. An explanation cannot.
   */
  focused: boolean;
}) {
  const user = useContext(DictationUserContext);
  const availability = useAvailability();

  if (!user.username) return null;
  // Nothing measured yet, or the practice switched the feature off at build
  // time. In the second case there is nothing this person can do about it, and
  // a note field is the wrong place to explain a deployment decision.
  if (availability.status === "unknown" || availability.status === "disabled") return null;

  // The control, in the boxes being worked in. `active` rather than `focused`
  // so it does not vanish the instant you reach for it — but not everywhere
  // either: a microphone under all eleven sections of an untouched note is the
  // clutter this redesign exists to remove.
  if (availability.status === "ready" && user.enrolled) {
    if (!active) return null;
    return (
      <div className="mt-1">
        <DictationButton onText={onText} region={user.region ?? "general"} />
      </div>
    );
  }

  // Everything below is an explanation rather than a control, so it shows only
  // in the field the cursor is in RIGHT NOW. The same sentence under all eleven
  // sections is noise, and the same sentence under every box you have already
  // written in is the same noise arriving one field at a time.
  if (!focused) return null;

  if (availability.status === "ready") {
    return (
      <p className="mt-1 text-xs text-slate-500">
        <Link href="/account" className="text-brand-blue underline">
          🎤 Set up dictation
        </Link>{" "}
        — about ninety seconds, once. Then you can talk into any note box, on any
        computer you sign in to.
      </p>
    );
  }

  return <p className="mt-1 text-xs text-slate-500">🎤 {availabilityMessage(availability)}</p>;
}
