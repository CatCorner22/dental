"use client";

import { createContext, useContext } from "react";
import { DictationButton } from "@/components/standardize/DictationButton";
import { useDictationUnlock } from "@/components/standardize/VoiceEnrollment";

// Who is writing, for the purpose of finding their dictation enrollment.
//
// A context rather than a prop threaded through NoteForm and all seven input
// components: only one of them needs it, and a required prop on every field
// renderer to serve one optional control on one of them is the kind of plumbing
// that gets copy-pasted wrong later.
//
// There is no SessionProvider in this app — every page reads the user fresh
// from the database on the server, deliberately, so that a demotion bites on
// the next click rather than when a token expires. So the username arrives the
// same way everything else about the user does: down from the server page.
export const DictationUserContext = createContext<string>("");

// The microphone on a note field.
//
// Renders NOTHING unless this device has been enrolled — and DictationButton
// itself renders nothing when the browser has no speech engine, or when
// NEXT_PUBLIC_DICTATION_DISABLED is set. So a writer who types pays no pixels
// and no attention for a feature they are not using.
//
// That is the whole correction. Dictation was never the problem; its placement
// was. The standardize screen put a 382-line, three-to-five-minute enrollment
// panel ABOVE the textarea for everyone who had not done it. Enrollment now
// lives in My account, and this is what is left at the point of writing: a
// button, for the people who set it up.
export function DictationField({ onText }: { onText: (text: string) => void }) {
  const username = useContext(DictationUserContext);
  const voice = useDictationUnlock(username);
  if (!username || !voice.unlocked) return null;
  return (
    <div className="mt-1">
      <DictationButton onText={onText} region={voice.record?.region} />
    </div>
  );
}
