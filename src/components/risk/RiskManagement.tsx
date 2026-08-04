"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HelpTip } from "@/components/ui/HelpTip";

// RISK MANAGEMENT — operational, interactive, and honest about its maturity.
//
// The mechanics work today (checklists persist per browser, topics expand,
// links land on real features); the CONTENT is a starting set awaiting the
// practice's own review, and the banner says so. A placeholder that looks
// finished is how wrong guidance calcifies — so the provisional state is
// labeled, not hidden.
//
// Checklist state is localStorage only: which boxes a person ticked on a
// training page is not clinical data and does not belong in the database.

interface ChecklistItem {
  id: string;
  text: string;
}

interface RiskTopic {
  id: string;
  title: string;
  summary: string;
  points: string[];
  checklist?: { title: string; items: ChecklistItem[] };
  appLinks?: { href: string; label: string }[];
}

const TOPICS: RiskTopic[] = [
  {
    id: "curve-hero-transfer",
    title: "Curve Hero transfer discipline",
    summary:
      "The riskiest moment in this workflow is the paste: a perfect note in the wrong chart is a records error no audit can see.",
    points: [
      "Standardize locks Copy until every blocking item is fixed, attested, or escalated — never work around the lock by retyping from the screen.",
      "The two-identifier confirmation before copy exists because chart mix-ups survive on single identifiers. Match two, every time.",
      "Identity, exact dates, signatures, and codes are completed in Curve Hero only. If it identifies the patient, it never belonged in Smile Notes.",
      "Paste, then read the pasted note once inside the chart before signing. Formatting survives most pastes; verify, do not assume."
    ],
    checklist: {
      title: "Before every paste into Curve Hero",
      items: [
        { id: "ch-chart", text: "The correct patient chart is open in Curve Hero" },
        { id: "ch-two-id", text: "Two identifiers matched (for example name and date of birth)" },
        { id: "ch-copy-unlocked", text: "Copy unlocked on its own — no blocking item bypassed" },
        { id: "ch-reread", text: "Pasted note re-read inside the chart before signing" }
      ]
    },
    appLinks: [
      { href: "/standardize", label: "Standardize" },
      { href: "/reference/curve-hero-header", label: "Curve Hero header reference" }
    ]
  },
  {
    id: "documentation-defensibility",
    title: "Documentation defensibility",
    summary:
      "Notes are written for the reader you hope never arrives: a board reviewer, an insurer's auditor, or opposing counsel.",
    points: [
      "Active voice names the actor. \"The dentist extracted tooth 17\" survives cross-examination; \"tooth was extracted\" invites the question the note should have answered.",
      "Informed refusal is documented like informed consent: what was recommended, what the patient was told could happen, and the decision in the patient's own terms.",
      "A recorded absence (\"not applicable\") is defensible; a blank is not. The omission notice on the builder exists for exactly this.",
      "The audit report and ruleset version are frozen with every filed note — never edit history, file an addendum."
    ],
    appLinks: [
      { href: "/history", label: "Submission history (frozen records)" },
      { href: "/training", label: "Training arena" }
    ]
  },
  {
    id: "phi-boundaries",
    title: "PHI boundaries",
    summary:
      "This tool is de-identified by construction. The boundary holds only if every person holds it.",
    points: [
      "No names, exact dates, contact details, record numbers, or identifiable photographs — the PHI gate blocks what it can see, and you catch what it cannot.",
      "The privacy-stop override is an attestation with your name on it. Use it for false positives, never for convenience.",
      "AI assist and ByteStar run behind the same PHI gate; nothing leaves for a provider while an identifier is present.",
      "Dictation uses the browser's speech engine, which may process audio off this device — the de-identification rule applies to the SPOKEN words, not just the typed ones. Never say a patient's name into the microphone.",
      "If PHI reaches a filed note anyway, tell the Team Lead the same day — the response plan depends on speed."
    ],
    checklist: {
      title: "If you spot PHI where it should not be",
      items: [
        { id: "phi-stop", text: "Stop the draft — do not copy, download, or submit" },
        { id: "phi-remove", text: "Remove or mask the identifier in the draft" },
        { id: "phi-report", text: "Report to the Team Lead the same day" },
        { id: "phi-review", text: "Note how it got in, so the gate can learn the pattern" }
      ]
    },
    appLinks: [{ href: "/reference/data-hygiene", label: "Data Hygiene Guide" }]
  },
  {
    id: "scope-supervision",
    title: "Scope and supervision",
    summary:
      "Tennessee licenses draw hard lines around who may do what, under whose supervision. The note should read as if the Board will read it.",
    points: [
      "The license-scope charts on the Tennessee law page state what each level may and may not do, with citations.",
      "A note naming a procedure and a provider level implicitly claims the pairing was lawful — make the supervision statement explicit when the rules require one.",
      "When scope is unclear mid-visit, the conservative reading wins until someone verifies the rule."
    ],
    appLinks: [{ href: "/reference/tennessee-law", label: "TN law & license-scope charts" }]
  },
  {
    id: "business-practices",
    title: "Business practices",
    summary:
      "Billing narratives, records requests, and retention are practice-level risks that documentation quality either shrinks or feeds.",
    points: [
      "Billing narratives must be supported by the clinical note — the justification rules flag SRP, buildup, and crown claims that lack their evidence.",
      "A records request is answered from the frozen submission record, never from memory or a re-edited draft.",
      "Retention follows Tennessee requirements; deletion is a decision with a name attached, not a cleanup habit.",
      "Every audit-log row exists so that \"who did what, when\" is a lookup, not an argument."
    ],
    appLinks: [
      { href: "/history", label: "Submission history" },
      { href: "/admin/audit", label: "Audit log (Team Lead+)" }
    ]
  },
  {
    id: "incident-response",
    title: "Incident response",
    summary:
      "Placeholder pending the practice's written incident plan — the skeleton below is the industry-standard shape.",
    points: [
      "Contain first: stop the workflow that is leaking before documenting it.",
      "Notify the Team Lead and practice owner on the same business day.",
      "Preserve the frozen records involved — never delete or edit during a response.",
      "Debrief in the digest cycle: what pattern let it happen, and which rule or template closes it."
    ]
  }
];

const STORAGE_KEY = "smile-notes.risk-checklists.v1";

function loadChecked(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function RiskManagement() {
  const [openId, setOpenId] = useState<string | null>(TOPICS[0]?.id ?? null);
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    typeof window === "undefined" ? {} : loadChecked()
  );

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Private browsing: the checklist still works for the session.
      }
      return next;
    });
  };

  const progress = useMemo(() => {
    const all = TOPICS.flatMap((t) => t.checklist?.items ?? []);
    const done = all.filter((i) => checked[i.id]).length;
    return { done, total: all.length };
  }, [checked]);

  return (
    <div className="space-y-4">
      <div className="flex max-w-3xl items-start gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <p className="min-w-0 flex-1">
          <strong>Provisional content.</strong> The mechanics on this page are live; the guidance
          is a starting set awaiting review by the practice owner and, where it touches law,
          counsel. Treat it as training scaffolding, not policy, until that review lands.
        </p>
        <HelpTip label="About this risk page">
          Checklist ticks are stored only in this browser — nothing here is recorded to the
          server or attached to any patient record. Reset them by clearing site data.
        </HelpTip>
      </div>

      {progress.total > 0 && (
        <p className="text-xs text-slate-600" role="status">
          Personal checklist progress: {progress.done} of {progress.total} items ticked on this
          device.
        </p>
      )}

      <div className="space-y-3">
        {TOPICS.map((topic) => {
          const open = openId === topic.id;
          return (
            <section key={topic.id} className="card overflow-hidden p-0">
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : topic.id)}
              >
                <span>
                  <span className="block text-sm font-bold text-brand-navy">{topic.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                    {topic.summary}
                  </span>
                </span>
                <span aria-hidden className="shrink-0 text-slate-400">
                  {open ? "▾" : "▸"}
                </span>
              </button>
              {open && (
                <div className="border-t border-slate-100 px-4 py-3">
                  <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
                    {topic.points.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                  {topic.checklist && (
                    <fieldset className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
                      <legend className="px-1 text-xs font-semibold text-slate-700">
                        {topic.checklist.title}
                      </legend>
                      {topic.checklist.items.map((item) => (
                        <label
                          key={item.id}
                          className="mt-1 flex items-start gap-2 text-xs text-slate-800"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={!!checked[item.id]}
                            onChange={() => toggle(item.id)}
                          />
                          <span className={checked[item.id] ? "text-slate-400 line-through" : ""}>
                            {item.text}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                  {topic.appLinks && topic.appLinks.length > 0 && (
                    <p className="mt-3 flex flex-wrap gap-2 text-xs">
                      {topic.appLinks.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          className="rounded-full bg-brand-teal/10 px-2.5 py-1 font-medium text-brand-navy ring-1 ring-brand-teal/30 hover:bg-brand-teal/20"
                        >
                          {l.label} →
                        </Link>
                      ))}
                    </p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
