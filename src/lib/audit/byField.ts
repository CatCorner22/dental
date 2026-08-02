import type { AuditFinding } from "./types";
import { fieldKey } from "@/lib/schema/types";

export type FieldFindings = Record<string, AuditFinding[]>;

// Group findings that carry a fieldRef by their "moduleId.fieldId" key, so the
// form can mark each field invalid and show its findings inline.
export function findingsByField(findings: AuditFinding[]): FieldFindings {
  const map: FieldFindings = {};
  for (const f of findings) {
    if (!f.fieldRef) continue;
    const key = fieldKey(f.fieldRef.moduleId, f.fieldRef.fieldId);
    (map[key] ??= []).push(f);
  }
  return map;
}

// A field is "invalid" for a11y purposes when it carries a STOP or REQUIRED.
export function fieldIsInvalid(list: AuditFinding[] | undefined): boolean {
  return !!list?.some((f) => f.severity === "S0" || f.severity === "S1");
}
