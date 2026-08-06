"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Character } from "@/components/mascot/Sparkle";

// FIRST-WEEK CHECKLIST — the guided tour, as a dismissible card.
//
// Tracked per user per browser in localStorage: which tour steps a person has
// visited is not clinical data and does not belong in the database. The card
// disappears forever once dismissed or completed — onboarding that nags a
// veteran is onboarding that gets mocked.

const STEPS = [
  {
    id: "note",
    label: "Write a couple of sentences and watch the audit panel react",
    href: "/",
    hint: "The note is already open, with the cursor in it."
  },
  {
    id: "standardize",
    label: "Press ✨ Standardize on a free-text field and read what changed",
    href: "/",
    hint: "It shows the diff and lets you undo. Nothing is applied for you."
  },
  {
    id: "wordmap",
    label: "Skim the Word map to see what the practice standardizes on",
    href: "/reference/word-map",
    hint: "Built from the same tables the audit enforces."
  },
  {
    id: "law",
    label: "Open the Tennessee law page and find your license-scope chart",
    href: "/reference/tennessee-law",
    hint: "Charts are cited to TCA and Board Rules."
  },
  {
    id: "risk",
    label: "Read the EDR transfer checklist on the Risk page",
    href: "/reference/risk-management",
    hint: "Two identifiers, every paste."
  }
] as const;

interface Stored {
  done: string[];
  dismissed: boolean;
}

function keyFor(username: string): string {
  return `smile-notes.onboarding.v1.${username}`;
}

function load(username: string): Stored {
  try {
    const raw = window.localStorage.getItem(keyFor(username));
    return raw ? (JSON.parse(raw) as Stored) : { done: [], dismissed: false };
  } catch {
    return { done: [], dismissed: false };
  }
}

export function OnboardingChecklist({ username }: { username: string }) {
  // Render nothing until the client knows the stored state — a checklist that
  // flashes and vanishes on hydration reads as a bug.
  const [state, setState] = useState<Stored | null>(null);

  useEffect(() => {
    setState(load(username));
  }, [username]);

  if (!state || state.dismissed || state.done.length >= STEPS.length) return null;

  const save = (next: Stored) => {
    setState(next);
    try {
      window.localStorage.setItem(keyFor(username), JSON.stringify(next));
    } catch {
      // Private browsing: works for the session, forgets after. Acceptable.
    }
  };

  const toggle = (id: string) => {
    const done = state.done.includes(id) ? state.done.filter((d) => d !== id) : [...state.done, id];
    save({ ...state, done });
  };

  // A DISCLOSURE, not a card.
  //
  // As an always-open card this was around 220 pixels of first-week reading
  // sitting between the greeting and the note, on every visit until it was
  // ticked off or dismissed. The note is the point of the page; onboarding gets
  // one line and opens when it is wanted.
  return (
    <details className="rounded-lg border-l-4 border-l-brand-teal bg-white px-3 py-2 ring-1 ring-slate-200">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 text-sm [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 font-semibold text-brand-navy">
          <Character id="sparkle" size="xs" />
          First week? Five short stops{" "}
          <span className="font-normal text-slate-500">
            ({state.done.length} of {STEPS.length} done)
          </span>
        </span>
        <button
          type="button"
          className="shrink-0 text-xs text-slate-500 underline hover:text-slate-700"
          onClick={(e) => {
            // Inside a <summary>: without this the click also toggles the
            // disclosure, so dismissing visibly opens the thing being dismissed.
            e.preventDefault();
            e.stopPropagation();
            save({ ...state, dismissed: true });
          }}
        >
          Dismiss
        </button>
      </summary>
      <p className="mt-1.5 text-xs text-slate-600">
        Tick them off as you go — this leaves when you finish or dismiss it, and never comes back.
      </p>
      <ul className="mt-2 space-y-1.5">
        {STEPS.map((s) => {
          const done = state.done.includes(s.id);
          return (
            <li key={s.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={done}
                onChange={() => toggle(s.id)}
                aria-label={`Mark "${s.label}" ${done ? "not done" : "done"}`}
              />
              <span className={done ? "text-slate-400 line-through" : "text-slate-800"}>
                <Link href={s.href} className="underline decoration-dotted underline-offset-2">
                  {s.label}
                </Link>{" "}
                <span className="text-xs text-slate-500">— {s.hint}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
