"use client";

import { useState } from "react";
import Link from "next/link";
import { LICENSE_SCOPES, type LicenseLevel } from "@/lib/law/license-scope";
import type { ClinicalRole } from "@/lib/auth/clinicalRoles";

// LICENSE SCOPE, IN THE BUILDER — the chart row that applies to the person
// writing, one click from the note instead of three pages away.
//
// Advisory display only: nothing here blocks a field (the scope-lock on
// Assessment/Plan already does the enforcing). A writer wondering mid-visit
// "may I even do this?" gets the cited answer without leaving the note.

const ROLE_TO_LEVEL: Partial<Record<ClinicalRole, LicenseLevel>> = {
  dentist: "dentist",
  hygienist: "dental-hygienist",
  // The card shows the registered level; practical assistants see the same
  // card's link to the full charts where both assistant levels are drawn.
  assistant: "registered-dental-assistant"
};

export function LicenseScopeCard({ clinicalRole }: { clinicalRole: ClinicalRole }) {
  const [open, setOpen] = useState(false);
  const level = ROLE_TO_LEVEL[clinicalRole];
  if (!level) return null;
  const scope = LICENSE_SCOPES.find((s) => s.id === level);
  if (!scope) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
      <button
        type="button"
        className="flex w-full items-baseline justify-between gap-2 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-xs font-semibold text-slate-700">
          Your license scope — {scope.shortLabel}
        </span>
        <span aria-hidden className="shrink-0 text-slate-400">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2 text-xs leading-relaxed text-slate-700">
          <p>
            <span className="font-semibold">Supervision: </span>
            {scope.supervision}
          </p>
          <div>
            <p className="font-semibold text-rose-900">Never within this license:</p>
            <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
              {scope.mayNot.slice(0, 3).map((item, i) => (
                <li key={i}>{item.text}</li>
              ))}
            </ul>
          </div>
          <p className="text-slate-500">
            Training summary, not legal advice — every line is cited on the{" "}
            <Link
              href="/reference/tennessee-law"
              className="underline decoration-dotted underline-offset-2"
            >
              full license-scope charts
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
