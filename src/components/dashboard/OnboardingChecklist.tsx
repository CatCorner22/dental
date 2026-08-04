"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// FIRST-WEEK CHECKLIST — the guided tour, as a dismissible card.
//
// Tracked per user per browser in localStorage: which tour steps a person has
// visited is not clinical data and does not belong in the database. The card
// disappears forever once dismissed or completed — onboarding that nags a
// veteran is onboarding that gets mocked.

const STEPS = [
  {
    id: "note",
    label: "Start a Smile Note and watch the audit panel react as you type",
    href: "/",
    hint: "The + New Smile Note button above."
  },
  {
    id: "standardize",
    label: "Paste a messy note into Standardize and clear its resolution queue",
    href: "/standardize",
    hint: "Copy unlocks only when the queue is clear — that is the point."
  },
  {
    id: "wordmap",
    label: "Skim the Word map to see what the practice standardizes on",
    href: "/",
    hint: "Below your drafts on this page."
  },
  {
    id: "law",
    label: "Open the Tennessee law page and find your license-scope chart",
    href: "/reference/tennessee-law",
    hint: "Charts are cited to TCA and Board Rules."
  },
  {
    id: "risk",
    label: "Read the Curve Hero transfer checklist on the Risk page",
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

  return (
    <section className="card border-l-4 border-l-brand-teal" aria-label="Getting started checklist">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-brand-navy">Getting started</h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Five short stops. Tick them off as you go — this card leaves when you finish or
            dismiss it, and never comes back.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 text-xs text-slate-500 underline hover:text-slate-700"
          onClick={() => save({ ...state, dismissed: true })}
        >
          Dismiss
        </button>
      </div>
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
      <p className="mt-2 text-xs text-slate-500" role="status">
        {state.done.length} of {STEPS.length} done
      </p>
    </section>
  );
}
