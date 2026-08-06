// Practice pack body validation — composition of shipped ids only.
// Freeform clinical prose never enters a pack.

import { MODULES_BY_ID } from "@/lib/modules";
import { SUGGESTABLE_BLOCK_IDS } from "@/lib/phrases/suggestedBlocks";
import type { ClinicalRole } from "@/lib/auth/clinicalRoles";

const SUGGESTABLE = new Set<string>(SUGGESTABLE_BLOCK_IDS);
const CLINICAL_ROLES = new Set<ClinicalRole>([
  "unset",
  "assistant",
  "hygienist",
  "dentist",
  "smilenotes"
]);

export type PackBody = {
  title: string;
  description: string;
  moduleIds: string[];
  blockIds: string[];
  authorRoles: ClinicalRole[];
};

export type PackValidation =
  | { ok: true; value: PackBody }
  | { ok: false; error: string };

function asStringArray(v: unknown, label: string): { ok: true; value: string[] } | { ok: false; error: string } {
  if (!Array.isArray(v)) return { ok: false, error: `${label} must be a list.` };
  if (!v.every((x) => typeof x === "string")) {
    return { ok: false, error: `${label} must be plain text ids.` };
  }
  return { ok: true, value: v.map((s) => s.trim()).filter(Boolean) };
}

export function validatePackBody(input: Record<string, unknown>): PackValidation {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (title.length < 2 || title.length > 80) {
    return { ok: false, error: "Title must be 2–80 characters." };
  }
  const description =
    typeof input.description === "string" ? input.description.trim().slice(0, 400) : "";

  const modules = asStringArray(input.moduleIds ?? input.module_ids, "Modules");
  if (!modules.ok) return modules;
  const blocks = asStringArray(input.blockIds ?? input.block_ids, "Blocks");
  if (!blocks.ok) return blocks;
  const rolesRaw = asStringArray(input.authorRoles ?? input.author_roles ?? [], "Roles");
  if (!rolesRaw.ok) return rolesRaw;

  if (modules.value.length === 0 && blocks.value.length === 0) {
    return { ok: false, error: "Add at least one module or one verified block." };
  }
  if (blocks.value.length > 7) {
    return { ok: false, error: "At most seven verified blocks per pack." };
  }
  if (modules.value.length > 8) {
    return { ok: false, error: "At most eight modules per pack." };
  }

  for (const id of modules.value) {
    if (id === "universal-core") {
      return { ok: false, error: "Universal Core is always on — do not list it in a pack." };
    }
    if (!MODULES_BY_ID.has(id)) {
      return { ok: false, error: `Unknown module: ${id}.` };
    }
  }
  for (const id of blocks.value) {
    if (!SUGGESTABLE.has(id)) {
      return {
        ok: false,
        error: `Block "${id}" is not on the short suggestable list. Packs use shipped short blocks only.`
      };
    }
  }

  const authorRoles: ClinicalRole[] = [];
  for (const r of rolesRaw.value) {
    if (!CLINICAL_ROLES.has(r as ClinicalRole)) {
      return { ok: false, error: `Unknown clinical role: ${r}.` };
    }
    if (r === "smilenotes") {
      return { ok: false, error: "Smile Notes clinical role is not a pack audience." };
    }
    authorRoles.push(r as ClinicalRole);
  }

  // Dedupe preserving order.
  const uniq = (ids: string[]) => [...new Set(ids)];

  return {
    ok: true,
    value: {
      title,
      description,
      moduleIds: uniq(modules.value),
      blockIds: uniq(blocks.value),
      authorRoles: [...new Set(authorRoles)]
    }
  };
}
