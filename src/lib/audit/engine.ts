import type {
  AuditContext,
  AuditFinding,
  AuditGates,
  AuditReport,
  OverallStatus,
  Severity
} from "./types";
import { SEVERITY_ORDER } from "./types";
import type { NoteState } from "@/lib/schema/types";
import { fieldKey } from "@/lib/schema/types";
import { isFieldVisible } from "@/lib/schema/conditions";
import { runPhiRule } from "./rules/phi";
import { runResidueRule } from "./rules/residue";
import { runAbbreviationRule, runStigmatizingRule, runVaguePhraseRule } from "./rules/terminology";
import { runAnatomyStateRule, runAnatomyTextRule } from "./rules/anatomy";
import { newSpellingBudget, runSpellingRule } from "./rules/spelling";
import { runRequiredRule } from "./rules/required";
import { runMeasurementRule } from "./rules/measurement";
import { runPlainLanguageRule } from "./rules/plain-language";

// Pure and isomorphic. The client runs the full audit live; the email route
// re-runs the text audit server-side so a tampered client cannot bypass it.

export function runTextAudit(text: string): AuditFinding[] {
  return [
    ...runPhiRule(text),
    ...runResidueRule(text),
    ...runAbbreviationRule(text),
    ...runVaguePhraseRule(text),
    ...runStigmatizingRule(text),
    ...runAnatomyTextRule(text)
  ];
}

export function runAudit(ctx: AuditContext): AuditReport {
  const voices = splitByAudience(ctx.note, ctx.modules);
  const findings: AuditFinding[] = [
    ...runRequiredRule(ctx.note, ctx.modules),
    ...runAnatomyStateRule(ctx.note, ctx.modules),
    ...runMeasurementRule(ctx.note, ctx.modules),
    ...suppressPatientVoiceStyle(runTextAudit(ctx.composedText), voices),
    ...runFieldSpelling(ctx.note, ctx.modules),
    ...runPatientLanguage(ctx.note, ctx.modules)
  ];
  return buildReport(findings);
}

// The plain-language rule, over patient-facing fields only.
//
// Deliberately a FIELD walk rather than part of runTextAudit. runTextAudit sees
// the whole composed note, where "radiograph" and "periodontitis" are the
// correct words — flagging them there would bury every real finding under a
// hundred style rows and would contradict the abbreviation rule, which spends
// its time putting those words IN.
function runPatientLanguage(note: NoteState, modules: AuditContext["modules"]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const mod of modules) {
    for (const section of mod.sections) {
      for (const field of section.fields) {
        if (field.audience !== "patient") continue;
        if (field.type !== "text" && field.type !== "textarea") continue;
        if (!isFieldVisible(field, mod.id, note)) continue;
        const value = note.values[fieldKey(mod.id, field.id)];
        if (!value || value.kind !== "text" || !value.value.trim()) continue;
        findings.push(
          ...runPlainLanguageRule(value.value, { moduleId: mod.id, fieldId: field.id })
        );
      }
    }
  }
  return findings;
}

interface VoiceSplit {
  patient: string;
  record: string;
}

// Every visible, non-empty field value, sorted by who the words are written
// for. Only the raw values — never the labels, which are the app's own text.
function splitByAudience(note: NoteState, modules: AuditContext["modules"]): VoiceSplit {
  const patient: string[] = [];
  const record: string[] = [];
  for (const mod of modules) {
    for (const section of mod.sections) {
      for (const field of section.fields) {
        if (!isFieldVisible(field, mod.id, note)) continue;
        const value = note.values[fieldKey(mod.id, field.id)];
        if (!value) continue;
        let text = "";
        if (value.kind === "text") text = value.value;
        else if (value.kind === "select") text = `${value.value} ${value.otherText ?? ""}`;
        else if (value.kind === "multiselect") text = value.values.join("\n");
        if (!text.trim()) continue;
        (field.audience === "patient" ? patient : record).push(text);
      }
    }
  }
  return { patient: patient.join("\n"), record: record.join("\n") };
}

/**
 * Drop auto-applicable abbreviation findings that exist ONLY in patient-facing
 * text.
 *
 * `abbrev.xray` is severityClass "style", which in this app means one
 * deterministic replacement a staff member may apply: "x-ray" becomes
 * "radiograph". That is right for the clinical record and exactly backwards for
 * a paragraph the patient reads, where the plain-language rule is at the same
 * moment asking for "radiograph" to become "x-ray".
 *
 * Without this the panel would show both findings at once, each undoing the
 * other, and the writer would have no way to satisfy the tool. The suppression
 * is narrow on purpose: only STYLE abbreviations, and only when the matched
 * text appears nowhere in the clinical half of the note. A word used in both
 * halves keeps its finding, because there it really is about the record.
 */
function suppressPatientVoiceStyle(findings: AuditFinding[], voices: VoiceSplit): AuditFinding[] {
  if (!voices.patient.trim()) return findings;
  return findings.filter((f) => {
    if (f.category !== "abbreviation" || f.severity !== "S3" || !f.matchedText) return true;
    return !(voices.patient.includes(f.matchedText) && !voices.record.includes(f.matchedText));
  });
}

function runFieldSpelling(note: NoteState, modules: AuditContext["modules"]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  // ONE budget across every field, so total close-match work per audit run is
  // bounded no matter how many text fields the note spreads its words across.
  const budget = newSpellingBudget();
  for (const mod of modules) {
    for (const section of mod.sections) {
      for (const field of section.fields) {
        if (field.type !== "text" && field.type !== "textarea") continue;
        if (!isFieldVisible(field, mod.id, note)) continue;
        const value = note.values[fieldKey(mod.id, field.id)];
        if (!value || value.kind !== "text" || !value.value.trim()) continue;
        findings.push(
          ...runSpellingRule(value.value, { moduleId: mod.id, fieldId: field.id }, budget)
        );
      }
    }
  }
  return findings;
}

export function buildReport(findings: AuditFinding[]): AuditReport {
  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );
  const counts: Record<Severity, number> = { S0: 0, S1: 0, S2: 0, S3: 0, S4: 0 };
  for (const f of sorted) counts[f.severity]++;
  const phiStops = sorted.filter((f) => f.category === "phi" && f.severity === "S0");

  let status: OverallStatus;
  if (counts.S0 > 0) status = "BLOCKED";
  else if (counts.S1 > 0) status = "NEEDS CLINICIAN ACTION";
  else if (counts.S2 > 0) status = "READY FOR CLINICIAN REVIEW";
  else status = "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED";

  return { findings: sorted, counts, status, phiStops };
}

// An attestation has to say something. The old floor was five characters —
// checked only in the browser, so a tampered client could waive every privacy
// stop with no reason at all, and the server logged "(no reason given)" and
// filed the note anyway. The gate the whole compliance story leans on was
// client-side theater.
//
// One validator, used by BOTH the dialog and the submit route, so the two can
// never disagree about what counts as a reason. The bar is deliberately about
// substance, not length alone: four words that state what the flagged text
// actually is ("tooth numbers not a date", "lot number of the implant").
// Sincerity cannot be validated; friction plus a named, frozen record is the
// enforceable part.
export const PHI_ATTESTATION_RULE =
  "State what the flagged text actually is, in at least four words (20 characters or more).";

// Zero-width and format characters are NOT matched by \s, so a reason built
// from them passed every check — 23 characters, 4 "words", 5 distinct — while
// rendering as blank to every human who would ever read it. The attestation
// would have been written into the frozen legal record and the audit log as
// empty space: exactly the waive-with-no-reason failure this validator exists
// to close, wearing a costume.
//
// Stripped rather than rejected, and stripped in the SAME helper the frozen
// record uses, so what gets validated is what gets read.
const INVISIBLE = new RegExp(
  "[" +
    "\\u00AD\\u180B-\\u180E\\u200B-\\u200F\\u202A-\\u202E" +
    "\\u2060-\\u2064\\u3164\\u115F\\u1160\\uFFA0" +
    "\\uFE00-\\uFE0F\\uFEFF" +
  "]|[\\u{E0000}-\\u{E007F}]",
  "gu"
);

export function visibleText(text: string): string {
  return text.replace(INVISIBLE, "");
}

// A DENYLIST of invisible characters is unwinnable, and this one lost: the
// list above did not know about BRAILLE PATTERN BLANK, the HANGUL FILLERs,
// variation selectors, or tag characters, and a reason built from those scored
// 23 characters / 4 words / 5 distinct and returned true while rendering as
// empty space on the frozen legal record. Unicode will always have one more.
//
// So the test is inverted: rather than naming what does not count, require a
// floor of characters that certainly DO render. Latin letters and digits,
// because that is what this practice writes in. That is a deliberate limit and
// the one real cost of the approach - a reason written wholly in another
// script would be refused - and it is better stated here than discovered later.
const RENDERING_CHAR = /[\p{Script=Latin}\p{Nd}]/gu;

export function isValidPhiAttestation(reason: string): boolean {
  const trimmed = visibleText(reason).trim();
  if (trimmed.length < 20) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 4) return false;

  const rendering = trimmed.match(RENDERING_CHAR) ?? [];
  if (rendering.length < 15) return false;
  if (new Set(rendering.map((c) => c.toLowerCase())).size < 5) return false;

  // Three DISTINCT words. "asdfg asdfg asdfg asdfg" is four words and one
  // idea, and it cleared every other check here.
  const distinct = new Set(
    words
      .map((w) => w.toLowerCase().replace(/[^\p{Script=Latin}\p{Nd}]/gu, ""))
      .filter(Boolean)
  );
  return distinct.size >= 3;
}

// phiOverridden: the user completed the explicit override dialog and attested
// that every flagged item was reviewed and none is an identifier.
export function computeGates(report: AuditReport, phiOverridden: boolean): AuditGates {
  const phiBlocked = report.phiStops.length > 0 && !phiOverridden;
  const nonPhiStops = report.counts.S0 - report.phiStops.length;
  // Any unresolved S0 stops the line: a wrong-site or invalid-tooth note must
  // not leave the tool by copy/download either, matching the finding's own
  // "correct the site before this entry leaves the tool." A PHI S0 is the one
  // stop a person can waive, via the attested override.
  const blocked = phiBlocked || nonPhiStops > 0;
  return {
    exportAllowed: !blocked,
    emailAllowed: !blocked && report.counts.S1 === 0
  };
}
