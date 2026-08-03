import type { Severity } from "@/lib/audit/types";

// One derivation, two callers: the server recomputes and caches this on every
// save/submit, and the client derives it live from the same audit report, so
// the status chip never drifts between them.
export type DraftStatus =
  | "unfinished"
  | "phi"
  | "blocked"
  | "action-needed"
  | "review"
  | "ready"
  | "submitted"
  | "error";

export interface StatusInput {
  hasContent: boolean;
  counts: Record<Severity, number> | null;
  // PHI stops at S0, from report.phiStops.length. Carried separately from the
  // counts because the counts cannot distinguish a privacy stop from a
  // wrong-site stop — and those are different situations for the practice.
  // A wrong-site block is a note problem; a privacy stop means a possible
  // patient identifier is SITTING IN THE PRACTICE DATABASE right now, saved
  // by autosave before any human decided anything. The dashboard has to say
  // which one it is, because the remediation is different: fix the field, vs
  // get the identifier out of the tool.
  phiStops: number;
  submitted: boolean;
  lastSendFailed: boolean;
}

export function deriveDraftStatus(input: StatusInput): DraftStatus {
  if (input.submitted) return "submitted";
  if (input.lastSendFailed) return "error";
  if (!input.hasContent) return "unfinished";
  const c = input.counts;
  if (!c) return "unfinished";
  // Privacy outranks the generic block: when both are true, the identifier
  // at rest is the more urgent fact.
  if (input.phiStops > 0) return "phi";
  if (c.S0 > 0) return "blocked";
  if (c.S1 > 0) return "action-needed";
  if (c.S2 > 0) return "review";
  return "ready";
}

export interface StatusMeta {
  label: string;
  short: string;
  icon: string;
  // Tailwind classes; color is always paired with the text label + icon above.
  chipClass: string;
  ring: string;
}

export const STATUS_META: Record<DraftStatus, StatusMeta> = {
  unfinished: {
    label: "Unfinished",
    short: "Draft",
    icon: "○",
    chipClass: "border-slate-300 bg-slate-100 text-slate-700",
    ring: "text-slate-400"
  },
  phi: {
    // A chip label, not a sentence. This shipped as "Privacy stop — possible
    // identifier saved in this draft": 52 characters against 8-19 for every
    // sibling, so it wrapped to two lines in the sidebar and pushed the Save
    // and Submit buttons across the sticky header. The detail it carried is
    // not lost — the audit panel states the actual finding directly beneath.
    label: "Privacy stop",
    short: "Privacy",
    icon: "⛨",
    chipClass: "border-rose-400 bg-rose-100 text-rose-900",
    ring: "text-rose-600"
  },
  blocked: {
    label: "Blocked — must fix",
    short: "Blocked",
    icon: "■",
    chipClass: "border-red-300 bg-red-100 text-red-900",
    ring: "text-red-500"
  },
  "action-needed": {
    label: "Action needed",
    short: "Action",
    icon: "▲",
    chipClass: "border-orange-300 bg-orange-100 text-orange-900",
    ring: "text-orange-500"
  },
  review: {
    label: "Review suggested",
    short: "Review",
    icon: "◆",
    chipClass: "border-amber-300 bg-amber-100 text-amber-900",
    ring: "text-amber-500"
  },
  ready: {
    label: "Ready to submit",
    short: "Ready",
    icon: "●",
    chipClass: "border-green-300 bg-green-100 text-green-900",
    ring: "text-green-500"
  },
  submitted: {
    label: "Submitted",
    short: "Sent",
    icon: "✓",
    chipClass: "border-blue-300 bg-blue-100 text-blue-900",
    ring: "text-blue-500"
  },
  error: {
    label: "Send failed",
    short: "Error",
    icon: "!",
    chipClass: "border-rose-400 bg-rose-100 text-rose-900",
    ring: "text-rose-500"
  }
};
