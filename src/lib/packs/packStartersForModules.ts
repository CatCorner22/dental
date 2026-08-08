// Fast Lane → optional pack starters.
//
// Fast Lane itself still applies modules only (structure). When a published
// practice pack overlaps those modules, we may *offer* its suggestable verified
// blocks — never silent-insert, never invent facts, never bypass BlockRow attest.
// See knowledge/sources/team-lead-practice-packs-workflow.md (Silent Fast Lane
// pack dump = Never) and builder-text-blocks-predictive-ux.md (§2 text packs).

import type { ClinicalRole } from "@/lib/auth/clinicalRoles";
import { BLOCK_BY_ID, type VerifiedBlock } from "@/lib/phrases/blocks";
import { SUGGESTABLE_BLOCK_IDS } from "@/lib/phrases/suggestedBlocks";
import { packsForVisit, type PublishedPackLite } from "./publishedForVisit";

const SUGGESTABLE = new Set<string>(SUGGESTABLE_BLOCK_IDS);

/** Dentist-owned judgement — same gate as section starters. */
const DENTIST_JUDGEMENT_BLOCKS = new Set<string>(["referral"]);

export type PackStartersOffer = {
  /** Matching pack titles, stable order, for staff-facing copy. */
  packTitles: string[];
  /** Suggestable verified blocks only — empty means: render nothing. */
  blocks: VerifiedBlock[];
};

function roleAllowsBlock(clinicalRole: ClinicalRole, blockId: string): boolean {
  if (clinicalRole === "hygienist" || clinicalRole === "assistant") {
    return !DENTIST_JUDGEMENT_BLOCKS.has(blockId);
  }
  return true;
}

/**
 * After Fast Lane applies modules, resolve optional attested starters from
 * published packs that match the writer and those modules.
 *
 * Ranking only — caller must still gate insert behind BlockRow attest.
 */
export function packStartersForAppliedModules(
  packs: readonly PublishedPackLite[],
  clinicalRole: ClinicalRole,
  appliedModuleIds: readonly string[],
  limit = 5
): PackStartersOffer {
  if (appliedModuleIds.length === 0) return { packTitles: [], blocks: [] };

  const matching = packsForVisit(packs, clinicalRole, appliedModuleIds);
  if (matching.length === 0) return { packTitles: [], blocks: [] };

  const packTitles: string[] = [];
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const p of matching) {
    const before = ids.length;
    for (const id of p.blockIds) {
      if (!SUGGESTABLE.has(id)) continue;
      if (!roleAllowsBlock(clinicalRole, id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      if (ids.length >= limit) break;
    }
    if (ids.length > before && p.title.trim() && !packTitles.includes(p.title)) {
      packTitles.push(p.title);
    }
    if (ids.length >= limit) break;
  }

  const blocks = ids
    .map((id) => BLOCK_BY_ID.get(id))
    .filter((b): b is VerifiedBlock => Boolean(b));

  return { packTitles, blocks };
}
