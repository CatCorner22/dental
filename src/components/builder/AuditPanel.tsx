"use client";

import type { AuditFinding, AuditReport } from "@/lib/audit/types";
import { SEVERITY_LABELS, SEVERITY_ORDER } from "@/lib/audit/types";

const SEVERITY_STYLES: Record<string, string> = {
  S0: "border-red-300 bg-red-50 text-red-900",
  S1: "border-orange-300 bg-orange-50 text-orange-900",
  S2: "border-amber-300 bg-amber-50 text-amber-900",
  S3: "border-blue-200 bg-blue-50 text-blue-900",
  S4: "border-slate-200 bg-slate-50 text-slate-700"
};

const STATUS_STYLES: Record<string, string> = {
  BLOCKED: "bg-red-100 text-red-900 border-red-300",
  "NEEDS CLINICIAN ACTION": "bg-orange-100 text-orange-900 border-orange-300",
  "READY FOR CLINICIAN REVIEW": "bg-amber-100 text-amber-900 border-amber-300",
  "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED": "bg-green-100 text-green-900 border-green-300"
};

function FindingRow({ finding }: { finding: AuditFinding }) {
  const jump = () => {
    if (!finding.fieldRef) return;
    const el = document.getElementById(`field-${finding.fieldRef.moduleId}-${finding.fieldRef.fieldId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Land the cursor in the field, not just the viewport on it — one click
    // instead of scroll-then-click for every finding fixed.
    el.querySelector<HTMLElement>("input, select, textarea, button")?.focus({ preventScroll: true });
  };
  return (
    <li
      className={`rounded border px-2.5 py-2 text-xs ${SEVERITY_STYLES[finding.severity]} ${finding.fieldRef ? "cursor-pointer" : ""}`}
      onClick={finding.fieldRef ? jump : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold">
          {finding.severity} {SEVERITY_LABELS[finding.severity]}
          {finding.matchedText && (
            <span className="ml-1.5 rounded bg-white/70 px-1 font-mono font-normal">
              {finding.matchedText.length > 40 ? `${finding.matchedText.slice(0, 37)}…` : finding.matchedText}
            </span>
          )}
          {finding.occurrences && finding.occurrences > 1 && (
            <span className="ml-1 font-normal">×{finding.occurrences}</span>
          )}
        </span>
        {finding.fieldRef && (
          <button type="button" onClick={jump} className="shrink-0 underline">
            Go to field
          </button>
        )}
      </div>
      <p className="mt-1">{finding.message}</p>
      {finding.suggestion && (
        <p className="mt-1">
          <span className="font-semibold">Standard wording:</span> {finding.suggestion}
        </p>
      )}
    </li>
  );
}

export function AuditPanel({ report }: { report: AuditReport }) {
  return (
    <div>
      <div className={`mb-3 rounded border px-3 py-2 text-sm font-semibold ${STATUS_STYLES[report.status]}`}>
        {report.status}
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Deterministic checks only — this audit never scores the note or replaces clinician review.
        Suggestions are never applied automatically.
      </p>
      <ul className="space-y-1.5">
        {SEVERITY_ORDER.flatMap((sev) =>
          report.findings
            .filter((f) => f.severity === sev)
            .map((f, i) => (
              // moduleId is part of the key: field ids are only unique within
              // a module, so two modules' identical required/spelling findings
              // must not collide.
              <FindingRow
                key={`${f.ruleId}-${f.matchedText ?? ""}-${f.fieldRef ? `${f.fieldRef.moduleId}.${f.fieldRef.fieldId}` : i}`}
                finding={f}
              />
            ))
        )}
        {report.findings.length === 0 && (
          <li className="rounded border border-green-200 bg-green-50 px-2.5 py-2 text-xs text-green-900">
            No finding from the deterministic checker. A licensed clinician still compares every
            fact with the source record and signs in the EDR.
          </li>
        )}
      </ul>
    </div>
  );
}
