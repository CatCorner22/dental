"use client";

import type { AuditFinding, AuditReport } from "@/lib/audit/types";
import {
  SEVERITY_CHIP,
  SEVERITY_LABELS,
  SEVERITY_RAIL,
  SEVERITY_MEANING,
  SEVERITY_ORDER,
  STATUS_CLASS,
  statusLabel
} from "@/lib/audit/types";
import { useState } from "react";
import { ATTESTATION_RULE } from "@/lib/standardize/resolution";
import {
  composeFindingAttestation,
  displayReasonCode,
  FINDING_ATTEST_CODES,
  isValidFindingAttestSelection,
  type FindingAttestCode
} from "@/lib/standardize/reasonCodes";
import { HelpTip } from "@/components/ui/HelpTip";
import { Character } from "@/components/mascot/Sparkle";
import { daySeed, sparkleLine } from "@/lib/stats/sparkle";


/**
 * The identity of a finding across re-audits. Same shape resolution.ts uses,
 * and for the same reason: "required.missing" carries no matched text, so
 * without the field every one of a note's thirteen would be the same row.
 */
export function findingKey(f: AuditFinding): string {
  const field = f.fieldRef ? `${f.fieldRef.moduleId}.${f.fieldRef.fieldId}` : "";
  return `finding:${f.ruleId}:${field}:${f.matchedText ?? ""}`;
}

function FindingRow({
  finding,
  onJump,
  attestation,
  onAttest,
  onEscalate,
  escalated
}: {
  finding: AuditFinding;
  onJump?: () => void;
  /** The reason already recorded for this finding, if any. */
  attestation?: string;
  onAttest?: (key: string, reason: string) => void;
  onEscalate?: (finding: AuditFinding) => void;
  escalated?: boolean;
}) {
  const [writing, setWriting] = useState(false);
  const [reason, setReason] = useState("");
  const [attestCode, setAttestCode] = useState<FindingAttestCode | "">("");
  const key = findingKey(finding);
  // Fix-only, and both halves matter.
  //
  // S0 is fix-only everywhere: a wrong site or an identifier is not made right
  // by explaining it, and the PHI stop has its own attested path with a signed
  // record behind it.
  //
  // "required.missing" is fix-only for a harder reason: the SERVER re-runs
  // runAudit and computeGates at submit and refuses with 422 on any open S1. An
  // attestation here would turn the row green, and then the submit would be
  // refused anyway — a dead end built on purpose. The field is empty; the only
  // thing that resolves it is filling it in.
  const attestable =
    Boolean(onAttest) && finding.severity !== "S0" && finding.ruleId !== "required.missing";
  const escalatable = Boolean(onEscalate) && finding.category !== "phi";

  const jump = () => {
    if (!finding.fieldRef) return;
    // When the panel is open inside the mobile audit sheet, the field being
    // jumped to sits behind the modal's backdrop — closing it first is what
    // makes "Go to field" land somewhere visible instead of scrolling a
    // hidden page underneath an overlay.
    onJump?.();
    const el = document.getElementById(`field-${finding.fieldRef.moduleId}-${finding.fieldRef.fieldId}`);
    if (!el) return;
    // Sections collapse now, so the field this finding points at may be inside
    // a closed <details>. scrollIntoView on a hidden element scrolls nowhere
    // and focus() does nothing — the jump would silently fail, on exactly the
    // findings a writer most needs to reach. Open every ancestor first.
    for (let node = el.parentElement; node; node = node.parentElement) {
      if (node instanceof HTMLDetailsElement) node.open = true;
    }
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
      className={`rounded-r border-l-4 px-3 py-2.5 text-xs text-slate-800 ${
        SEVERITY_RAIL[finding.severity]
      } ${finding.fieldRef ? "cursor-pointer hover:bg-white" : ""}`}
      onClick={finding.fieldRef ? jump : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold">
          {/* A chip, not a headline. The plain label only: the raw code (S0..S4) is
              ruleset taxonomy and belongs in the frozen audit report, not in front
              of a person trying to finish a note — a reviewer with no clinical
              training read "S1 REQUIRED" as an error code they had caused. */}
          <span
            className={`rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold ${
              SEVERITY_CHIP[finding.severity]
            }`}
          >
            {SEVERITY_LABELS[finding.severity]}
          </span>
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
          <button
            type="button"
            /* The row itself is clickable, so an un-stopped click here runs jump()
               twice — once directly, once on the way up. Harmless-looking, except
               jump() moves focus, so the second pass re-focuses a field the writer
               may already have started typing in. */
            onClick={(e) => {
              e.stopPropagation();
              jump();
            }}
            className="shrink-0 underline"
          >
            Go to field
          </button>
        )}
      </div>
      <p className="mt-1">{finding.message}</p>
      {/* WHAT HAPPENS NEXT, said out loud. The single most common complaint in the
          usability review was that the app says no without saying why or what it
          costs: "does this stop me filing, or is it advice?" was unanswerable from
          a colour and a word. */}
      <p className="mt-1 opacity-80">{SEVERITY_MEANING[finding.severity]}</p>
      {finding.suggestion && (
        <p className="mt-1">
          <span className="font-semibold">Standard wording:</span> {finding.suggestion}
        </p>
      )}

      {/* FIX, ATTEST, OR DISAGREE — the three endings the standardize screen
          offered and the builder never did. They are here because the writer
          who reads a finding and knows the text is right had nowhere to say so:
          the only options were edit it anyway or leave a row open forever.
          Neither is a record of a clinician's judgement.

          None of this opens a gate. computeGates still decides what may be
          exported and filed, the server re-runs it at submit, and an attestation
          is a note on a row — not permission. */}
      {attestation ? (
        <p className="mt-1.5 rounded bg-white/70 px-2 py-1 text-[0.7rem] text-slate-700">
          <span className="font-semibold">You recorded:</span> {displayReasonCode(attestation)}
        </p>
      ) : escalated ? (
        <p className="mt-1.5 rounded bg-white/70 px-2 py-1 text-[0.7rem] text-slate-700">
          Sent to a Team Lead as a rule disagreement.
        </p>
      ) : (attestable || escalatable) && (
        /* STOP THE ROW EATING THIS BLOCK.
           The <li> above carries onClick=jump whenever the finding has a fieldRef,
           and every control below is a descendant of it — so without this, tapping
           "This is right as written", typing in the reason box, or pressing
           "Record it" ALSO fires jump(). Two ways that breaks:

             - On a phone the panel renders inside the "Audit & copy" sheet with
               onJump={() => setShowMobileAudit(false)}, so the first tap opens the
               reason form and closes the sheet around it in the same event. The
               writer never sees the form they just opened.
             - On desktop, clicking into the reason input scrolls to the note field
               and focuses it, so the keystrokes land in the clinical field instead.

           attestable is exactly the advisory findings this flow exists for, and
           spelling, plain-language and measurement all attach a fieldRef — so this
           was every row that matters. */
        <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
          {writing ? (
            <div className="space-y-1">
              <label className="block text-[0.7rem] font-medium text-slate-700">
                Reason code
                <select
                  className="field-input mt-0.5 py-1"
                  aria-label="Attestation reason code"
                  value={attestCode}
                  onChange={(e) => setAttestCode(e.target.value as FindingAttestCode | "")}
                >
                  <option value="">Select why this text is right…</option>
                  {FINDING_ATTEST_CODES.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <input
                type="text"
                /* text-xs would beat the 16px iOS zoom guard .field-input carries
                   for narrow/coarse screens — see globals.css. */
                className="field-input py-1"
                placeholder="Optional detail (adds to the record)"
                aria-label="Optional attestation detail"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="btn-primary text-xs"
                  disabled={!isValidFindingAttestSelection(attestCode, reason)}
                  onClick={() => {
                    if (!attestCode) return;
                    onAttest?.(key, composeFindingAttestation(attestCode, reason));
                    setWriting(false);
                    setAttestCode("");
                    setReason("");
                  }}
                >
                  Record it
                </button>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => {
                    setWriting(false);
                    setAttestCode("");
                    setReason("");
                  }}
                >
                  Cancel
                </button>
              </div>
              {/* Code is required; optional prose still uses the substance bar when
                  present. Rule disagreement stays on Escalate — not an attest code. */}
              <p className="text-[0.7rem] opacity-70">
                Pick a code. Optional detail: {ATTESTATION_RULE} Disagree with the rule? Use
                “Disagree with this rule” instead.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 text-[0.7rem]">
              {attestable && (
                <button type="button" className="underline" onClick={() => setWriting(true)}>
                  This is right as written
                </button>
              )}
              {escalatable && (
                <button
                  type="button"
                  className="underline"
                  onClick={() => onEscalate?.(finding)}
                >
                  Disagree with this rule
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function AuditPanel({
  report,
  onJump,
  attestations,
  escalated,
  onAttest,
  onEscalate,
  started = true
}: {
  report: AuditReport;
  /** Called just before a "Go to field" jump scrolls — used to dismiss the
      mobile audit sheet so the target field is not left behind a backdrop. */
  onJump?: () => void;
  /** findingKey -> the reason the writer recorded. */
  attestations?: Record<string, string>;
  /** findingKey -> already sent to a Team Lead. */
  escalated?: Record<string, boolean>;
  onAttest?: (key: string, reason: string) => void;
  onEscalate?: (finding: AuditFinding) => void;
  /**
   * Has the writer put anything in this note yet?
   *
   * On an untouched note every required field raises required.missing, so the
   * panel opened as a wall of thirteen identical orange cards saying the note
   * was not ready — before a single character had been typed. That is the tool
   * grading a blank page, and it is the loudest thing on the busiest screen at
   * the exact moment there is nothing to say.
   *
   * Until the note has content those become one quiet line with a count. Every
   * finding comes back the moment there is something to have an opinion about,
   * and the per-section "N required" badges have been carrying the same
   * information all along, in the place the work actually happens.
   */
  started?: boolean;
}) {
  const requiredMissing = report.findings.filter((f) => f.ruleId === "required.missing");
  const visible = started ? report.findings : report.findings.filter((f) => f.ruleId !== "required.missing");
  const quietRequired = !started && requiredMissing.length > 0;

  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5">
        {/* statusLabel, not report.status. The union is the stored value that
            gets frozen into the submission; this is the sentence a person reads. */}
        <div className={`flex-1 rounded border px-3 py-2 text-sm font-semibold ${STATUS_CLASS[report.status]}`}>
          {statusLabel(report.status)}
        </div>
        <HelpTip label="How to read the audit">
          A stop blocks copy and filing until it is fixed or (for privacy stops) attested. A
          required item blocks filing only. Advice never stops the line. Tap a finding with a field
          link to jump there. Nothing here is applied to the note for you.
        </HelpTip>
      </div>
      {/* The "deterministic checks only / nothing is applied for you" disclaimer
          used to live here as its own paragraph. It said the same thing as the
          line beside the ring directly above it AND the help tip beside this
          status banner — three statements of one promise inside 200px. The line
          above carries it now; the tip carries the detail. */}
      {/* Breathing room between items. At space-y-1.5 eleven open required fields
          smashed into one another vertically and read as a single block of alarm. */}
      {quietRequired && (
        <p className="mb-3 rounded border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
          <strong className="font-semibold text-slate-800">
            {requiredMissing.length} required field{requiredMissing.length === 1 ? "" : "s"} to fill.
          </strong>{" "}
          Each section below carries its own count. They are listed here one by one once you start
          writing.
        </p>
      )}
      <ul className="space-y-2.5">
        {SEVERITY_ORDER.flatMap((sev) =>
          visible
            .filter((f) => f.severity === sev)
            .map((f, i) => (
              // moduleId is part of the key: field ids are only unique within
              // a module, so two modules' identical required/spelling findings
              // must not collide.
              <FindingRow
                key={`${findingKey(f)}-${i}`}
                finding={f}
                onJump={onJump}
                attestation={attestations?.[findingKey(f)]}
                escalated={escalated?.[findingKey(f)]}
                onAttest={onAttest}
                onEscalate={onEscalate}
              />
            ))
        )}
        {visible.length === 0 && !quietRequired && (
          // The one moment in the note worth celebrating, and it earns exactly
          // one sparkle. The sentence underneath is unchanged: a clean checker
          // is not a signed note, and this is the last place to blur that.
          <li className="rounded border border-green-200 bg-green-50 px-2.5 py-2 text-xs text-green-900">
            <span className="mb-1.5 flex items-center gap-2">
              <span className="relative inline-flex">
                <Character id="sparkle" size="sm" />
                <span aria-hidden className="sparkle-pop absolute -right-1 -top-1 text-brand-gold">
                  ✦
                </span>
              </span>
              <span className="font-semibold">{sparkleLine("firstPass", daySeed(new Date()))}</span>
            </span>
            No finding from the deterministic checker. A licensed clinician still compares every
            fact with the source record and signs in the EDR.
          </li>
        )}
      </ul>
    </div>
  );
}
