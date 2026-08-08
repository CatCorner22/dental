"use client";

import type { AuditFinding } from "@/lib/audit/types";
import { SEVERITY_CHIP, SEVERITY_LABELS } from "@/lib/audit/types";
import { killerShortLabel } from "@/lib/audit/killers";
import type { CheckNoteSummary as Summary } from "@/lib/status/checkNoteSummary";

/**
 * Jump to a finding's field — same contract as AuditPanel (open collapsed
 * sections, respect reduced motion, focus the control). Completeness killers
 * have no fieldRef; callers pass onChangeWithoutField to leave the finish
 * dialog and open the audit surface instead.
 */
export function jumpToFindingField(finding: AuditFinding, beforeJump?: () => void): boolean {
  if (!finding.fieldRef) return false;
  beforeJump?.();
  const el = document.getElementById(
    `field-${finding.fieldRef.moduleId}-${finding.fieldRef.fieldId}`
  );
  if (!el) return false;
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (node instanceof HTMLDetailsElement) node.open = true;
  }
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  el.querySelector<HTMLElement>("input, select, textarea, button")?.focus({
    preventScroll: true
  });
  return true;
}

/**
 * Check-your-note body for Copy confirm and Submit dialog.
 *
 * One job: make killer items and open stops visible before the irreversible
 * handoff. Does not invent clinical facts. Does not auto-apply fixes.
 */
export function CheckNoteSummaryPanel({
  summary,
  killersAcknowledged,
  onKillersAcknowledged,
  onChangeFinding,
  compact
}: {
  summary: Summary;
  killersAcknowledged: boolean;
  onKillersAcknowledged: (acked: boolean) => void;
  /** Change link: jump to field, or fall back (e.g. open audit) when no fieldRef. */
  onChangeFinding: (finding: AuditFinding) => void;
  /** Tighter padding for the Copy aside strip. */
  compact?: boolean;
}) {
  const text = compact ? "text-xs" : "text-sm";
  return (
    <div
      className={
        compact
          ? "mb-2 rounded border border-amber-300/70 bg-amber-50/80 p-2"
          : "mb-3 rounded border border-amber-300 bg-amber-50 p-3"
      }
      data-testid="check-note-summary"
    >
      <p className={`mb-1 font-semibold text-amber-950 ${text}`}>Check your note</p>
      <p className={`mb-2 text-amber-950/90 ${compact ? "text-[0.7rem]" : "text-xs"}`}>
        Before this leaves Smile Notes — modules, litigation-sensitive gaps, and open stops.
        Change opens the field; nothing here invents a clinical fact.
      </p>

      {summary.moduleTitles.length > 0 && (
        <p className={`mb-2 text-slate-800 ${compact ? "text-[0.7rem]" : "text-xs"}`}>
          <span className="font-medium">Modules: </span>
          {summary.moduleTitles.join(" · ")}
        </p>
      )}

      {summary.killers.length > 0 && (
        <ul className="mb-2 space-y-1.5" aria-label="Litigation-sensitive gaps">
          {summary.killers.map((f) => (
            <li
              key={`k:${f.ruleId}:${f.fieldRef ? `${f.fieldRef.moduleId}.${f.fieldRef.fieldId}` : ""}:${f.matchedText ?? ""}`}
              className="flex items-start justify-between gap-2 rounded bg-white/70 px-2 py-1.5"
            >
              <div className="min-w-0">
                <span
                  className={`mr-1 inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${SEVERITY_CHIP[f.severity]}`}
                >
                  {SEVERITY_LABELS[f.severity]}
                </span>
                <span className={`font-medium text-slate-900 ${text}`}>
                  {killerShortLabel(f.ruleId)}
                </span>
                {f.suggestion && (
                  <p className={`mt-0.5 text-slate-600 ${compact ? "text-xs" : "text-sm"}`}>
                    {f.suggestion}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="shrink-0 text-xs font-medium text-brand-blue underline"
                onClick={() => onChangeFinding(f)}
              >
                Change
              </button>
            </li>
          ))}
        </ul>
      )}

      {summary.openStops.length > 0 && (
        <ul className="mb-2 space-y-1" aria-label="Open stops">
          {summary.openStops.slice(0, 5).map((f) => (
            <li
              key={`s:${f.ruleId}:${f.fieldRef ? `${f.fieldRef.moduleId}.${f.fieldRef.fieldId}` : ""}:${f.matchedText ?? ""}`}
              className="flex items-start justify-between gap-2 px-1"
            >
              <span className={`text-slate-800 ${compact ? "text-[0.7rem]" : "text-xs"}`}>
                <span className="font-medium">{SEVERITY_LABELS[f.severity]}:</span>{" "}
                {f.message.length > 90 ? `${f.message.slice(0, 87)}…` : f.message}
              </span>
              {f.fieldRef && (
                <button
                  type="button"
                  className="shrink-0 text-xs font-medium text-brand-blue underline"
                  onClick={() => onChangeFinding(f)}
                >
                  Change
                </button>
              )}
            </li>
          ))}
          {summary.openStops.length > 5 && (
            <li className={`text-slate-600 ${compact ? "text-[0.65rem]" : "text-xs"}`}>
              +{summary.openStops.length - 5} more in the audit panel
            </li>
          )}
        </ul>
      )}

      {summary.omissionCount > 0 && (
        <p className={`mb-2 text-slate-700 ${compact ? "text-[0.7rem]" : "text-xs"}`}>
          {summary.omissionCount} required field
          {summary.omissionCount === 1 ? "" : "s"} answered with a named omission licence
          (not assessed / not applicable / unknown…). Counted, not blocked.
        </p>
      )}

      {summary.killers.length === 0 && summary.openStops.length === 0 && (
        <p className={`mb-2 text-green-900 ${compact ? "text-[0.7rem]" : "text-xs"}`}>
          No litigation-sensitive gaps or open stops on this pass. Still confirm the chart
          identifiers below — this tool cannot see which chart is open.
        </p>
      )}

      {summary.requiresKillerAck && (
        <>
          <p
            className={`mb-2 rounded border border-amber-400/80 bg-white/80 px-2 py-1.5 font-medium text-amber-950 ${compact ? "text-xs" : "text-sm"}`}
            role="status"
            data-testid="check-note-unresolved-risk"
          >
            Copy allowed with unresolved risk items. These do not block filing by
            policy — you must accept them before the note leaves.
          </p>
          <label className={`flex items-start gap-2 text-amber-950 ${text}`}>
            <input
              type="checkbox"
              className="mt-0.5"
              checked={killersAcknowledged}
              onChange={(e) => onKillersAcknowledged(e.target.checked)}
              data-testid="check-note-killer-ack"
            />
            <span>
              I am filing / copying this note with the unresolved items listed here
              {summary.killers.some((k) => !k.fieldRef)
                ? " (use Change, or fix them in the visit narrative / audit panel)"
                : ""}
              .
            </span>
          </label>
        </>
      )}
    </div>
  );
}
