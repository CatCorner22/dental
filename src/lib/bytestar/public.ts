// SOURCE ALLOW-LIST — suggestions must cite a reputable USA / TN label.
// Refusing unknown sources stops the pioneer from drifting into invented
// authority strings on the way to the screen.

import { edrSourceToken } from "@/lib/edr/product";

const ALLOWED_PREFIXES = [
  "practice writing standard",
  "smile notes",
  "tn board",
  "tennessee board",
  "des-12",
  "public chapter",
  "malamed",
  "ada ",
  "american dental association",
  "cdc",
  "fda",
  "aapd",
  "ismp",
  "joint commission",
  "curve hero",
  "electronic dental record",
  "edr",
  "ruleset"
] as const;

export function isAllowedSource(source: string): boolean {
  const lower = source.trim().toLowerCase();
  if (lower.length < 3) return false;
  const product = edrSourceToken();
  if (product.length >= 3 && (lower.startsWith(product) || lower.includes(product))) {
    return true;
  }
  return ALLOWED_PREFIXES.some((p) => lower.startsWith(p) || lower.includes(p));
}

/** Strip copyable rewrite/evidence before the response reaches staff. */
export function toObservationalSuggestion(s: {
  kind: string;
  say: string;
  why: string;
  question?: string;
  source: string;
  corroboration?: { seen: number; reads: number };
  /** Deterministic strong-claim-without-authority label; shown to staff. */
  tentative?: boolean;
  /** Stripped before the client sees the observation. */
  rewrite?: string;
  evidence?: string;
}) {
  return {
    kind: s.kind,
    say: s.say,
    why: s.why,
    ...(s.question ? { question: s.question } : {}),
    source: s.source,
    ...(s.corroboration ? { corroboration: s.corroboration } : {}),
    ...(s.tentative ? { tentative: true } : {})
  };
}
