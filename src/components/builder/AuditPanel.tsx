"use client";

import type { AuditFinding, AuditReport } from "@/lib/audit/types";
import { SEVERITY_CLASS, SEVERITY_LABELS, SEVERITY_ORDER, STATUS_CLASS } from "@/lib/audit/types";


function FindingRow({ finding, onJump }: { finding: AuditFinding; onJump?: () => void }) {
  const jump = () => {
    if (!finding.fieldRef) return;
    // When the panel is open inside the mobile audit sheet, the field being
    // jumped to sits behind the modal's backdrop — closing it first is what
    // makes "Go to field" land somewhere visible instead of scrolling a
    // hidden page underneath an overlay.
    onJump?.();
    const el = document.getElementById(`field-${finding.fieldRef.moduleId}-${finding.fieldRef.fieldId}`);
    if (!el) return;
    // The CSS reduced-motion block cannot reach a JS smooth scroll, and this
    // file was reintroducing in JS exactly the animated scrolling globals.css
    // argues against — a control still gliding when a tap lands takes the tap.
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    // Land the cursor in the field, not just the viewport on it — one click
    // instead of scroll-then-click for every finding fixed.
    el.querySelector<HTMLElement>("input, select, textarea, button")?.focus({ preventScroll: true });
  };
  return (
    <li
      className={`rounded border px-2.5 py-2 text-xs ${SEVERITY_CLASS[finding.severity]} ${finding.fieldRef ? "cursor-pointer" : ""}`}
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

export function AuditPanel({
  report,
  onJump
}: {
  report: AuditReport;
  /** Called just before a "Go to field" jump scrolls — used to dismiss the
      mobile audit sheet so the target field is not left behind a backdrop. */
  onJump?: () => void;
}) {
  return (
    <div>
      <div className={`mb-3 rounded border px-3 py-2 text-sm font-semibold ${STATUS_CLASS[report.status]}`}>
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
                onJump={onJump}
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
