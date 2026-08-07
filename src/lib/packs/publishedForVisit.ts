import type { ClinicalRole } from "@/lib/auth/clinicalRoles";

export type PublishedPackLite = {
  id: number;
  title: string;
  description: string;
  moduleIds: string[];
  blockIds: string[];
  authorRoles: string[];
};

/**
 * Packs that apply to this writer and visit: role match (or open audience)
 * and at least one module overlap when the note already has add-ons; when
 * Core-only, any role-matching pack is a Fast Lane candidate.
 */
export function packsForVisit(
  packs: readonly PublishedPackLite[],
  clinicalRole: ClinicalRole,
  selectedModuleIds: readonly string[]
): PublishedPackLite[] {
  const selected = new Set(selectedModuleIds.filter((id) => id !== "universal-core"));
  const coreOnly = selected.size === 0;
  return packs.filter((p) => {
    if (p.authorRoles.length > 0 && !p.authorRoles.includes(clinicalRole)) return false;
    if (coreOnly) return true;
    return p.moduleIds.some((id) => selected.has(id));
  });
}

export function packBlockIdsForVisit(
  packs: readonly PublishedPackLite[],
  clinicalRole: ClinicalRole,
  selectedModuleIds: readonly string[]
): string[] {
  const ids: string[] = [];
  for (const p of packsForVisit(packs, clinicalRole, selectedModuleIds)) {
    for (const id of p.blockIds) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

/**
 * Module ids preferred by published packs for this role (Core-only audience).
 * Used to reorder Fast Lane featured picks — not to invent new chips.
 */
export function packPreferredModuleIds(
  packs: readonly PublishedPackLite[],
  clinicalRole: ClinicalRole
): string[] {
  const ids: string[] = [];
  for (const p of packsForVisit(packs, clinicalRole, [])) {
    for (const id of p.moduleIds) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

/** Stable reorder: pack-overlapping picks first; relative order otherwise preserved. */
export function orderPicksByPackModules<T extends { moduleIds: readonly string[] }>(
  picks: readonly T[],
  preferredModuleIds: readonly string[]
): T[] {
  if (preferredModuleIds.length === 0) return [...picks];
  const preferred = new Set(preferredModuleIds);
  return [...picks].sort((a, b) => {
    const aHit = a.moduleIds.some((id) => preferred.has(id)) ? 0 : 1;
    const bHit = b.moduleIds.some((id) => preferred.has(id)) ? 0 : 1;
    return aHit - bHit;
  });
}
