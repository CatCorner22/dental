import type { Severity } from "@/lib/audit/types";

// One derivation, two callers: the server recomputes and caches this on every
// save/submit, and the client derives it live from the same audit report, so
// the status chip never drifts between them.
export type DraftStatus =
  | "unfinished"
  | "blocked"
  | "action-needed"
  | "review"
  | "ready"
  | "submitted"
  | "error";

export interface StatusInput {
  hasContent: boolean;
  counts: Record<Severity, number> | null;
  submitted: boolean;
  lastSendFailed: boolean;
}

export function deriveDraftStatus(input: StatusInput): DraftStatus {
  if (input.submitted) return "submitted";
  if (input.lastSendFailed) return "error";
  if (!input.hasContent) return "unfinished";
  const c = input.counts;
  if (!c) return "unfinished";
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
