import type { Severity } from "@/lib/audit/types";

/**
 * Why Submit is off, in one sentence.
 *
 * Pure, and in lib rather than in the component, because it is a sentence about
 * clinical gating that a person acts on: it is the only place the app says what
 * standing between them and filing a note. It shipped as a template that pasted
 * both counts in unconditionally, so a note blocked solely by a stop read
 *
 *     1 to fix; 0 required fields still open — each is listed in the audit panel.
 *
 * A count of zero rendered as a second task. The fix is to join only the parts
 * that are true, which is also the thing worth a test.
 *
 * Returns "" when nothing blocks. Callers reach it only when something does, and
 * an empty string is a blank line rather than a false one.
 */
export function submitBlockedReason(counts: Record<Severity, number>): string {
  const parts = [
    counts.S0 > 0 ? `${counts.S0} to fix` : "",
    counts.S1 > 0
      ? `${counts.S1} required field${counts.S1 === 1 ? "" : "s"} still open`
      : ""
  ].filter(Boolean);
  if (parts.length === 0) return "";
  return `${parts.join("; ")} — each is listed in the audit panel.`;
}
