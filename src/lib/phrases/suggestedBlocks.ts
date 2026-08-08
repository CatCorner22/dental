// CONTEXTUAL SECTION STARTERS (verified-block shortlist).
//
// Curve Hero's unfair advantage for staff is Favorites + QuickText under the
// right visit — not a blank SOAP pad. Smile Notes already has verified blocks;
// they hide behind a focused-textarea chip, so chairside writers never find
// them on sections that only have text fields (Care delivered).
//
// Iteration-2 rails from Curve-persona + UX swarm (2026-08-06):
//  1. Ranking only — nothing pre-checked or auto-inserted.
//  2. Short blocks only — no DES-12 / full visit scaffolds.
//  3. Never on narrative (first-paint typing surface).
//  4. Universal Core sections only — kills a second strip on add-on modules
//     that competed with Care delivered in one viewport.
//  5. Local anesthetic only when the visit actually implies anesthesia modules
//     — hygiene-only prophy must not teach staff to ignore the strip.
//  6. Referral hidden for hygienist/assistant.

import type { ClinicalRole } from "@/lib/auth/clinicalRoles";
import { BLOCK_BY_ID, type VerifiedBlock } from "@/lib/phrases/blocks";

/** Short, field-sized blocks safe to offer as section starters. */
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

/** Sections that never show a starter strip (first-paint / wrong job). */
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
 * Module boosts (below) may add anesthetic / radiograph / referral weight.
 */
const SECTION_BLOCKS: Readonly<Record<string, readonly SuggestableBlockId[]>> = {
  "history-review": ["medical-history-reviewed"],
  objective: ["radiograph-interpretation"],
  plan: ["consent-conversation"],
  // LA is module-boosted only — a prophy day must not lead with carpules.
  "care-delivered": ["no-complications"],
  // Postop is module-boosted — hygiene handoff is not "post-operative".
  handoff: ["referral"]
};

/** Visits that imply local anesthetic / procedural complications language. */
const ANESTHETIC_MODULES = new Set([
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
  "emergency",
  "medication",
  "nitrous",
  "sedation-anesthesia"
]);

/** Visits where surgical-style postop instructions are the right handoff pack. */
const POSTOP_MODULES = new Set([
  "direct-restorative",
  "extraction",
  "operative",
  "endodontic",
  "implant",
  "biopsy",
  "bone-graft-sinus",
  "trauma",
  "fixed-prosthodontic",
  "emergency",
  "periodontal"
]);

/** Blocks that assert dentist-owned judgement — keep out of auxiliary suggestions. */
const DENTIST_JUDGEMENT_BLOCKS = new Set<string>(["referral"]);

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

export interface SuggestedBlocksQuery {
  /** Module that owns the open section. */
  moduleId: string;
  /** Section id within that module (e.g. care-delivered). */
  sectionId: string;
  /** All selected add-on ids plus always-on core. */
  selectedModuleIds: readonly string[];
  clinicalRole: ClinicalRole;
  /**
   * Block ids from published practice packs that match this visit.
   * Boosted only when they have a field home in this section.
   */
  packBlockIds?: readonly string[];
  /** Hard cap — keep the strip scannable. */
  limit?: number;
}

function selectedSet(ids: readonly string[]): Set<string> {
  return new Set(ids);
}

function hasAny(selected: Set<string>, modules: Set<string>): boolean {
  for (const id of selected) {
    if (modules.has(id)) return true;
  }
  return false;
}

/**
 * Rank verified blocks for one open section. Empty means: render nothing.
 */
export function suggestedBlocksFor(q: SuggestedBlocksQuery): VerifiedBlock[] {
  const limit = q.limit ?? 3;

  // Add-on modules get structure from Fast Lane / the module rail. Starters
  // live on Universal Core only so a restorative note does not show two
  // "Section starters" chips in one viewport (Care delivered + Direct restorative).
  if (q.moduleId !== "universal-core") return [];
  if (SILENT_SECTIONS.has(q.sectionId)) return [];

  const selected = selectedSet(q.selectedModuleIds);
  const scores = new Map<string, number>();
  const bump = (id: string, weight: number) => {
    if (!SUGGESTABLE.has(id)) return;
    scores.set(id, (scores.get(id) ?? 0) + weight);
  };

  for (const id of SECTION_BLOCKS[q.sectionId] ?? []) {
    bump(id, 10);
  }

  // Published practice packs: raise matching starters for this section only.
  for (const id of q.packBlockIds ?? []) {
    if (BLOCK_FIELD_HINTS[q.sectionId]?.[id as SuggestableBlockId]) {
      bump(id, 20);
    }
  }

  const anestheticVisit = hasAny(selected, ANESTHETIC_MODULES);
  const postopVisit = hasAny(selected, POSTOP_MODULES);

  if (q.sectionId === "care-delivered" && anestheticVisit) {
    // Ahead of the section-default no-complications (10): LA is the pack
    // writers came for on restorative / extraction days.
    bump("local-anesthetic", 14);
  }

  if (q.sectionId === "handoff" && postopVisit) {
    bump("postop-instructions", 12);
  }

  if (selected.has("imaging") && q.sectionId === "objective") {
    bump("radiograph-interpretation", 12);
  }

  if ((selected.has("examination") || selected.has("emergency")) && q.sectionId === "plan") {
    bump("consent-conversation", 3);
  }
  if ((selected.has("examination") || selected.has("emergency")) && q.sectionId === "handoff") {
    bump("referral", 3);
  }

  if (
    (selected.has("preventive") || selected.has("periodontal")) &&
    q.sectionId === "history-review"
  ) {
    bump("medical-history-reviewed", 4);
  }

  // Hygiene-only (preventive ± imaging, no anesthetic module): keep history +
  // radiograph; do not leave residual LA/postop scores from section defaults.
  if (!anestheticVisit && q.sectionId === "care-delivered") {
    scores.delete("local-anesthetic");
  }
  if (!postopVisit && q.sectionId === "handoff") {
    scores.delete("postop-instructions");
  }

  if (q.clinicalRole === "hygienist" || q.clinicalRole === "assistant") {
    for (const id of DENTIST_JUDGEMENT_BLOCKS) {
      scores.delete(id);
    }
  }

  // Objective radiograph only when imaging is on — otherwise the section
  // default would offer a dead suggestion on exam-without-images days.
  if (q.sectionId === "objective" && !selected.has("imaging")) {
    scores.delete("radiograph-interpretation");
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
 * Default Universal Core home for a suggestable block (section + field).
 * Used by Fast Lane pack offers, which insert outside an open section strip.
 * Returns null when the block is not in the suggestable home map.
 */
export function suggestableBlockHome(
  blockId: string
): { sectionId: string; fieldId: string } | null {
  for (const [sectionId, map] of Object.entries(BLOCK_FIELD_HINTS)) {
    const fieldId = map[blockId as SuggestableBlockId];
    if (fieldId) return { sectionId, fieldId };
  }
  return null;
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
