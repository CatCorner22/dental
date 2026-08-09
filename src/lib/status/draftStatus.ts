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
  | "handoff"
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
  /**
   * When false, a clean audit must NOT become "Ready to submit". Hygienist
   * notes that still need dentist filing otherwise showed a green chip while
   * Submit stayed disabled — Andon lied about the finish line.
   */
  filingAllowed?: boolean;
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
  // Filing authority is a finish gate, not an audit severity. Without this,
  // StatusChip said Ready while the action bar said transfer ownership.
  if (input.filingAllowed === false) return "handoff";
  return "ready";
}

export interface StatusMeta {
  label: string;
  short: string;
  icon: string;
  // Tailwind classes; color is always paired with the text label + icon above.
  chipClass: string;
  ring: string;
  // The 4px bar on a list row. Redundant with the chip on purpose: the chip
  // carries the word and icon, the rail makes a column of rows scannable
  // without reading. Never the only encoding of the state.
  rail: string;
}

export const STATUS_META: Record<DraftStatus, StatusMeta> = {
  unfinished: {
    label: "Unfinished",
    short: "Draft",
    icon: "○",
    chipClass: "border-slate-300 bg-slate-100 text-slate-700",
    ring: "text-slate-400",
    rail: "bg-slate-300"
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
    ring: "text-rose-600",
    rail: "bg-rose-500"
  },
  blocked: {
    label: "Blocked — must fix",
    short: "Blocked",
    icon: "■",
    chipClass: "border-severity-stop/40 bg-severity-stop-soft text-severity-stop-ink",
    ring: "text-severity-stop-rail",
    rail: "bg-severity-stop-rail"
  },
  "action-needed": {
    label: "Action needed",
    short: "Action",
    icon: "▲",
    chipClass:
      "border-severity-required/40 bg-severity-required-soft text-severity-required-ink",
    ring: "text-severity-required-rail",
    rail: "bg-severity-required-rail"
  },
  review: {
    // Co-design Honest Finish: "suggested" softens open risk. Text-first label
    // so CVD writers do not read this as almost-Ready amber comfort.
    label: "Needs review",
    short: "Review",
    icon: "◆",
    chipClass: "border-severity-review/40 bg-severity-review-soft text-severity-review-ink",
    ring: "text-severity-review-rail",
    rail: "bg-severity-review-rail"
  },
  handoff: {
    label: "Dentist must file",
    short: "Handoff",
    icon: "→",
    chipClass: "border-slate-400 bg-slate-100 text-slate-800",
    ring: "text-slate-500",
    rail: "bg-slate-400"
  },
  ready: {
    label: "Ready to submit",
    short: "Ready",
    icon: "●",
    chipClass: "border-severity-clear/40 bg-severity-clear-soft text-severity-clear-ink",
    ring: "text-severity-clear-rail",
    rail: "bg-severity-clear-rail"
  },
  submitted: {
    label: "Submitted",
    short: "Sent",
    icon: "✓",
    chipClass: "border-brand-blue/40 bg-blue-50 text-brand-navy",
    ring: "text-brand-blue",
    rail: "bg-brand-blue"
  },
  error: {
    label: "Send failed",
    short: "Error",
    icon: "!",
    chipClass: "border-rose-400 bg-rose-100 text-rose-900",
    ring: "text-rose-500",
    rail: "bg-rose-600"
  }
};
