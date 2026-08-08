// PRACTICE FILING ROLLUP — modules + finding categories at file time.
//
// Purpose: falsify whether Check-your-note (#101) changed export behaviour.
// Practice totals only — never per-staff scores (digest rule 2 / charter).
//
// Snapshot is frozen onto the submission at submit. Historical rows without a
// snapshot contribute what the frozen audit markdown can still yield (severity
// counts, module titles) and skip category/killer detail rather than invent it.
//
// See knowledge/sources/check-your-note-ux-research.md backlog #5.

import type { AuditCategory, AuditReport, Severity } from "@/lib/audit/types";
import { isKillerFinding, killerShortLabel } from "@/lib/audit/killers";
import { MODULES_BY_ID } from "@/lib/modules";

export const FILING_ROLLUP_VERSION = 1 as const;

const SEVERITIES: Severity[] = ["S0", "S1", "S2", "S3", "S4"];

const EMPTY_COUNTS: Record<Severity, number> = {
  S0: 0,
  S1: 0,
  S2: 0,
  S3: 0,
  S4: 0
};

/** Compact stamp written with the filing — identifiers only, no note prose. */
export type FilingRollupSnapshot = {
  v: typeof FILING_ROLLUP_VERSION;
  moduleIds: string[];
  /** Finding instances by audit category at file time. */
  categories: Partial<Record<AuditCategory, number>>;
  /** Distinct killer ruleIds present on the filed report. */
  killerRuleIds: string[];
  counts: Record<Severity, number>;
};

export type PracticeFilingRollup = {
  notesTotal: number;
  notesWithSnapshot: number;
  /** Notes whose snapshot (or markdown fallback) listed at least one killer. */
  notesWithKillers: number;
  modules: Array<{ id: string; title: string; notes: number }>;
  categories: Array<{ category: string; label: string; findings: number; notes: number }>;
  killers: Array<{ ruleId: string; label: string; notes: number }>;
  /** Sum of severity finding counts across notes (practice total, not a score). */
  severityFindings: Record<Severity, number>;
  /** Notes that carried at least one finding at this severity. */
  severityNotes: Record<Severity, number>;
};

export const AUDIT_CATEGORY_LABEL: Record<AuditCategory, string> = {
  phi: "Privacy",
  required: "Required fields",
  "template-residue": "Template leftovers",
  "stale-text": "Stale text",
  "duplicate-text": "Duplicate text",
  anatomy: "Anatomy / tooth chart",
  abbreviation: "Abbreviations",
  "vague-phrase": "Vague phrases",
  stigmatizing: "Stigmatizing wording",
  "plain-language": "Plain language",
  spelling: "Spelling",
  measurement: "Measurements",
  "medication-safety": "Medication safety"
};

/**
 * Build the stamp from the live audit at submit. Pure — no DB, no clock.
 */
export function buildFilingRollupSnapshot(
  report: AuditReport,
  moduleIds: readonly string[]
): FilingRollupSnapshot {
  const categories: Partial<Record<AuditCategory, number>> = {};
  const killerRuleIds: string[] = [];
  const seenKillers = new Set<string>();

  for (const f of report.findings) {
    categories[f.category] = (categories[f.category] ?? 0) + 1;
    if (isKillerFinding(f) && !seenKillers.has(f.ruleId)) {
      seenKillers.add(f.ruleId);
      killerRuleIds.push(f.ruleId);
    }
  }
  killerRuleIds.sort();

  const counts = { ...EMPTY_COUNTS };
  for (const s of SEVERITIES) {
    const n = report.counts[s];
    counts[s] = typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }

  const ids = [...new Set(moduleIds.filter((id) => typeof id === "string" && id.trim() !== ""))].sort();

  return {
    v: FILING_ROLLUP_VERSION,
    moduleIds: ids,
    categories,
    killerRuleIds,
    counts
  };
}

/**
 * Tolerate junk. A historical row, a half-written column, or an older shape
 * must never throw the digest — return null and let callers fall back.
 */
export function parseFilingRollupSnapshot(raw: unknown): FilingRollupSnapshot | null {
  if (raw == null) return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  if (obj.v !== 1) return null;
  if (!Array.isArray(obj.moduleIds)) return null;

  const moduleIds = obj.moduleIds
    .filter((id): id is string => typeof id === "string" && id.trim() !== "")
    .map((id) => id.trim());

  const counts = { ...EMPTY_COUNTS };
  const rawCounts = obj.counts;
  if (rawCounts && typeof rawCounts === "object") {
    for (const s of SEVERITIES) {
      const n = (rawCounts as Record<string, unknown>)[s];
      if (typeof n === "number" && Number.isFinite(n) && n >= 0) counts[s] = Math.floor(n);
    }
  }

  const categories: Partial<Record<AuditCategory, number>> = {};
  const rawCats = obj.categories;
  if (rawCats && typeof rawCats === "object") {
    for (const [key, n] of Object.entries(rawCats as Record<string, unknown>)) {
      if (typeof n === "number" && Number.isFinite(n) && n > 0 && key in AUDIT_CATEGORY_LABEL) {
        categories[key as AuditCategory] = Math.floor(n);
      }
    }
  }

  const killerRuleIds = Array.isArray(obj.killerRuleIds)
    ? obj.killerRuleIds.filter((id): id is string => typeof id === "string" && id.trim() !== "")
    : [];

  return { v: 1, moduleIds, categories, killerRuleIds, counts };
}

/**
 * Severity counts from a frozen audit markdown (composeAuditReport output).
 * Digests historically expected JSON counts that were never stored — this
 * recovers S0–S4 from the Issues table without rewriting frozen text.
 */
export function parseSeverityCountsFromFrozenAudit(auditMarkdown: string): Record<Severity, number> {
  const out = { ...EMPTY_COUNTS };
  if (!auditMarkdown || typeof auditMarkdown !== "string") return out;
  // "| 1 | S2 Review | …" — severity token is the second column.
  const rowRe = /^\|\s*\d+\s*\|\s*(S[0-4])\b/gm;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(auditMarkdown)) !== null) {
    const sev = m[1] as Severity;
    out[sev] += 1;
  }
  return out;
}

/**
 * Module titles from "- Modules confirmed: Extraction; Direct restorative".
 * Maps titles back to ids when the catalog still knows them; unknown titles
 * are skipped (never invent an id).
 */
export function parseModuleIdsFromFrozenAudit(auditMarkdown: string): string[] {
  if (!auditMarkdown) return [];
  const line = auditMarkdown.match(/^- Modules confirmed:\s*(.+)$/m);
  if (!line) return [];
  const titles = line[1]
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);
  if (titles.length === 0) return [];

  const byTitle = new Map<string, string>();
  for (const [id, mod] of MODULES_BY_ID) {
    byTitle.set(mod.title.toLowerCase(), id);
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const title of titles) {
    const id = byTitle.get(title.toLowerCase());
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids.sort();
}

export type FilingRollupNoteInput = {
  /** Stamped jsonb when present. */
  filingRollup?: unknown;
  /** Frozen audit markdown — fallback for severity + module titles. */
  auditReport?: string;
};

/**
 * Resolve the best available snapshot for one filed note.
 */
export function resolveFilingSnapshot(note: FilingRollupNoteInput): FilingRollupSnapshot | null {
  const stamped = parseFilingRollupSnapshot(note.filingRollup);
  if (stamped) return stamped;

  const audit = note.auditReport ?? "";
  if (!audit.trim()) return null;

  const counts = parseSeverityCountsFromFrozenAudit(audit);
  const moduleIds = parseModuleIdsFromFrozenAudit(audit);
  const hasAny = moduleIds.length > 0 || SEVERITIES.some((s) => counts[s] > 0);
  if (!hasAny) return null;

  // Markdown fallback cannot recover categories / killer ruleIds honestly.
  return {
    v: 1,
    moduleIds,
    categories: {},
    killerRuleIds: [],
    counts
  };
}

/**
 * Practice-level rollup. No author ids, no rankings.
 */
export function buildPracticeFilingRollup(notes: readonly FilingRollupNoteInput[]): PracticeFilingRollup {
  const moduleNotes = new Map<string, number>();
  const categoryFindings = new Map<string, number>();
  const categoryNotes = new Map<string, number>();
  const killerNotes = new Map<string, number>();
  const severityFindings = { ...EMPTY_COUNTS };
  const severityNotes = { ...EMPTY_COUNTS };

  let notesWithSnapshot = 0;
  let notesWithKillers = 0;

  for (const note of notes) {
    const snap = resolveFilingSnapshot(note);
    if (!snap) continue;
    notesWithSnapshot += 1;

    const stamped = parseFilingRollupSnapshot(note.filingRollup);
    // Killer count only from real stamps — markdown fallback has empty killers.
    if (stamped && stamped.killerRuleIds.length > 0) notesWithKillers += 1;

    for (const id of snap.moduleIds) {
      if (id === "universal-core") continue; // always-on; noise in the rollup
      moduleNotes.set(id, (moduleNotes.get(id) ?? 0) + 1);
    }

    const catsThisNote = new Set<string>();
    for (const [cat, n] of Object.entries(snap.categories)) {
      if (!n || n <= 0) continue;
      categoryFindings.set(cat, (categoryFindings.get(cat) ?? 0) + n);
      catsThisNote.add(cat);
    }
    for (const cat of catsThisNote) {
      categoryNotes.set(cat, (categoryNotes.get(cat) ?? 0) + 1);
    }

    for (const ruleId of snap.killerRuleIds) {
      killerNotes.set(ruleId, (killerNotes.get(ruleId) ?? 0) + 1);
    }

    for (const s of SEVERITIES) {
      if (snap.counts[s] > 0) {
        severityFindings[s] += snap.counts[s];
        severityNotes[s] += 1;
      }
    }
  }

  const modules = [...moduleNotes.entries()]
    .map(([id, n]) => ({
      id,
      title: MODULES_BY_ID.get(id)?.title ?? id,
      notes: n
    }))
    .sort((a, b) => b.notes - a.notes || a.title.localeCompare(b.title));

  const categories = [...categoryFindings.entries()]
    .map(([category, findings]) => ({
      category,
      label: AUDIT_CATEGORY_LABEL[category as AuditCategory] ?? category,
      findings,
      notes: categoryNotes.get(category) ?? 0
    }))
    .sort((a, b) => b.findings - a.findings || a.label.localeCompare(b.label));

  const killers = [...killerNotes.entries()]
    .map(([ruleId, n]) => ({
      ruleId,
      label: killerShortLabel(ruleId),
      notes: n
    }))
    .sort((a, b) => b.notes - a.notes || a.label.localeCompare(b.label));

  return {
    notesTotal: notes.length,
    notesWithSnapshot,
    notesWithKillers,
    modules,
    categories,
    killers,
    severityFindings,
    severityNotes
  };
}
