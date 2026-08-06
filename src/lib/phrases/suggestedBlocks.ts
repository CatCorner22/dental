// CONTEXTUAL VERIFIED-BLOCK SUGGESTIONS.
//
// Curve Hero's unfair advantage for staff is Favorites + QuickText under the
// right visit — not a blank SOAP pad. Smile Notes already has verified blocks;
// they hide behind a focused-textarea chip, so chairside writers never find
// them. This module ranks a SHORT list of those blocks for the section the
// writer just opened.
//
// Hard product rails (do not weaken):
//  1. Suggestions are ranking only — nothing is pre-checked or auto-inserted.
//  2. Full DES-12 / hygiene / operative scaffolds stay out of this list; they
//     belong in the full "Verified block" catalog, not a three-chip strip.
//  3. The narrative section never gets suggestions. It is open on first paint;
//     a chip there is cognitive load paid by every note, including Core-only
//     typing that does not need a pack.
//  4. Role scope is enforced by the caller (locked sections should pass
//     outOfScope and skip rendering). This file still refuses dentist-judgement
//     scaffolds to hygienist/assistant roles as belt-and-suspenders.

import type { ClinicalRole } from "@/lib/auth/clinicalRoles";
import { BLOCK_BY_ID, type VerifiedBlock } from "@/lib/phrases/blocks";

/** Short, field-sized blocks safe to offer as section suggestions. */
export const SUGGESTABLE_BLOCK_IDS = [
  "medical-history-reviewed",
  "consent-conversation",
  "local-anesthetic",
  "no-complications",
  "postop-instructions",
  "radiograph-interpretation",
  "referral"
] as const;

export type SuggestableBlockId = (typeof SUGGESTABLE_BLOCK_IDS)[number];

const SUGGESTABLE = new Set<string>(SUGGESTABLE_BLOCK_IDS);

/** Sections that never show a suggestion strip (first-paint / wrong job). */
const SILENT_SECTIONS = new Set([
  "narrative",
  "visit",
  "subjective",
  "assessment",
  "patient-facing",
  "open-items"
]);

/**
 * Universal Core section → preferred short blocks, in display order.
 * Module boosts (below) may prepend when the visit type makes them relevant.
 */
const SECTION_BLOCKS: Readonly<Record<string, readonly SuggestableBlockId[]>> = {
  "history-review": ["medical-history-reviewed"],
  objective: ["radiograph-interpretation"],
  // Referral prose lives on handoff.referral — keep plan for consent only.
  plan: ["consent-conversation"],
  // Post-op instructions live on handoff (instructions textarea), not here.
  "care-delivered": ["local-anesthetic", "no-complications"],
  handoff: ["postop-instructions", "referral"]
};

/**
 * When a section has several prose fields, put each block where it belongs.
 * Missing entries fall back to preferredInsertFieldId.
 */
const BLOCK_FIELD_HINTS: Readonly<
  Record<string, Partial<Record<SuggestableBlockId, string>>>
> = {
  "history-review": { "medical-history-reviewed": "relevant-conditions" },
  objective: { "radiograph-interpretation": "images" },
  plan: { "consent-conversation": "narrative-plan" },
  "care-delivered": {
    "local-anesthetic": "patient-response",
    "no-complications": "complication-status"
  },
  handoff: {
    "postop-instructions": "instructions",
    referral: "referral"
  }
};

/** Add-on modules that imply procedure / anesthetic documentation. */
const PROCEDURE_MODULES = new Set([
  "direct-restorative",
  "extraction",
  "operative",
  "endodontic",
  "periodontal",
  "implant",
  "biopsy",
  "bone-graft-sinus",
  "trauma",
  "fixed-prosthodontic",
  "universal-procedure",
  "cosmetic",
  "emergency"
]);

const ANESTHETIC_MODULES = new Set([
  ...PROCEDURE_MODULES,
  "medication",
  "nitrous",
  "sedation-anesthesia"
]);

/** Blocks that assert dentist-owned judgement — keep out of auxiliary suggestions. */
const DENTIST_JUDGEMENT_BLOCKS = new Set<string>(["referral"]);

export interface SuggestedBlocksQuery {
  /** Module that owns the open section. */
  moduleId: string;
  /** Section id within that module (e.g. care-delivered). */
  sectionId: string;
  /** All selected add-on ids plus always-on core. */
  selectedModuleIds: readonly string[];
  clinicalRole: ClinicalRole;
  /** Hard cap — keep the strip scannable. */
  limit?: number;
}

/**
 * Rank verified blocks for one open section. Empty means: render nothing.
 */
export function suggestedBlocksFor(q: SuggestedBlocksQuery): VerifiedBlock[] {
  const limit = q.limit ?? 3;
  if (SILENT_SECTIONS.has(q.sectionId)) return [];

  const scores = new Map<string, number>();
  const bump = (id: string, weight: number) => {
    if (!SUGGESTABLE.has(id)) return;
    scores.set(id, (scores.get(id) ?? 0) + weight);
  };

  for (const id of SECTION_BLOCKS[q.sectionId] ?? []) {
    bump(id, 10);
  }

  // Add-on procedure sections (not Universal Core): same short pack as care-delivered.
  if (q.moduleId !== "universal-core" && PROCEDURE_MODULES.has(q.moduleId)) {
    bump("local-anesthetic", 8);
    bump("no-complications", 7);
    bump("postop-instructions", 6);
    bump("consent-conversation", 5);
  }

  const selected = new Set(q.selectedModuleIds);
  if (selected.has("imaging") || q.moduleId === "imaging") {
    if (q.sectionId === "objective" || q.moduleId === "imaging") {
      bump("radiograph-interpretation", 12);
    }
  }
  if ([...selected].some((id) => ANESTHETIC_MODULES.has(id))) {
    if (q.sectionId === "care-delivered" || PROCEDURE_MODULES.has(q.moduleId)) {
      bump("local-anesthetic", 4);
    }
  }
  if (selected.has("examination") || selected.has("emergency")) {
    if (q.sectionId === "plan") bump("consent-conversation", 3);
    if (q.sectionId === "handoff") bump("referral", 3);
  }

  // Hygiene-heavy visits: keep medical history obvious; skip anesthetic unless
  // a procedure module is also on.
  if (
    (selected.has("preventive") || selected.has("periodontal")) &&
    q.sectionId === "history-review"
  ) {
    bump("medical-history-reviewed", 4);
  }

  if (q.clinicalRole === "hygienist" || q.clinicalRole === "assistant") {
    for (const id of DENTIST_JUDGEMENT_BLOCKS) {
      scores.delete(id);
    }
  }

  const ranked = [...scores.entries()]
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([id]) => BLOCK_BY_ID.get(id))
    .filter((b): b is VerifiedBlock => Boolean(b));

  return ranked;
}

/**
 * Which field in a section should receive an inserted block.
 * Prefers the first textarea, then the first text field — never invents a key.
 */
export function preferredInsertFieldId(
  fields: readonly { id: string; type: string }[]
): string | null {
  const textarea = fields.find((f) => f.type === "textarea");
  if (textarea) return textarea.id;
  const text = fields.find((f) => f.type === "text");
  return text?.id ?? null;
}

/**
 * Resolve the insert target for a specific suggested block in a section.
 * Returns null when the section has no prose field that can take the text.
 */
export function insertFieldForBlock(
  sectionId: string,
  blockId: string,
  fields: readonly { id: string; type: string }[]
): string | null {
  const hinted = BLOCK_FIELD_HINTS[sectionId]?.[blockId as SuggestableBlockId];
  if (hinted && fields.some((f) => f.id === hinted && (f.type === "text" || f.type === "textarea"))) {
    return hinted;
  }
  return preferredInsertFieldId(fields);
}
