"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { standardize } from "@/lib/standardize/standardize";
import { runTextAudit } from "@/lib/audit/engine";
import { SEVERITY_LABELS } from "@/lib/audit/types";
import type { SyntheticTrainingNote } from "@/lib/training/synthetic-notes";

// STANDARDIZE DRILL — read a synthetic messy note, decide what the engine
// should flag, then reveal the answer. Same engine as production; the drill
// costs nothing to run and can never touch a real record.
//
// Deliberately NOT scored or gamified: the training-arena bounties reward
// repairs, and a reveal-based drill that paid points would pay for clicking.

export function StandardizeDrill({ notes }: { notes: SyntheticTrainingNote[] }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const note = notes[index % Math.max(1, notes.length)];

  const answer = useMemo(() => {
    if (!note || !revealed) return null;
    const pass = standardize(note.text);
    const findings = runTextAudit(pass.text);
    return { pass, findings };
  }, [note, revealed]);

  if (!note) return null;

  return (
    <section className="card mt-8">
      <h2 className="section-title mb-1">Standardize drill</h2>
      <p className="mb-3 max-w-3xl text-xs text-slate-600">
        A synthetic draft in a real staff voice. Read it, name the problems out loud, then reveal
        what the engine flags — the same deterministic pass that checks real notes. No points, no
        timer; the drill is for calibration, not competition.
      </p>
      <p className="text-xs font-semibold text-slate-500">
        {note.title} · {note.noteType}
      </p>
      <pre className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-3 font-mono text-xs text-slate-800">
        {note.text}
      </pre>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary text-xs"
          onClick={() => setRevealed((v) => !v)}
        >
          {revealed ? "Hide the engine's read" : "Reveal what the engine flags"}
        </button>
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => {
            setIndex((i) => (i + 1) % notes.length);
            setRevealed(false);
          }}
        >
          Next draft ({(index % notes.length) + 1} of {notes.length})
        </button>
        <Link href="/" className="btn-secondary text-xs">
          Try fixing it in a note →
        </Link>
      </div>
      {answer && (
        <div className="mt-3 rounded border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-700">
            Audit findings ({answer.findings.length}) and judgment flags ({answer.pass.flags.length})
          </p>
          <ul className="mt-1.5 space-y-1 text-xs text-slate-700">
            {answer.findings.map((f, i) => (
              <li key={`f-${i}`}>
                <span className="font-semibold">{SEVERITY_LABELS[f.severity]}</span> — {f.message}
              </li>
            ))}
            {answer.pass.flags.map((fl, i) => (
              <li key={`fl-${i}`}>
                <span className="font-semibold">Your call</span> — {fl.guidance}
              </li>
            ))}
            {answer.findings.length === 0 && answer.pass.flags.length === 0 && (
              <li>The engine found nothing — which is itself worth discussing.</li>
            )}
          </ul>
          {note.expectedDefectTags.length > 0 && (
            <p className="mt-2 text-[0.65rem] text-slate-500">
              Planted defects: {note.expectedDefectTags.join(", ")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
