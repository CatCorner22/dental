/**
 * One-line finish copy for the builder action bar and mobile strip.
 *
 * Order matters: empty draft → role authorship → filing authority → audit
 * gates → open risk / killer ack → Ready. A hygienist who has cleared every
 * S0 still cannot file dentist-owned content — saying "Ready to file" would
 * be a false green light on the finish control.
 *
 * Co-design (Honest Finish): "Ready" must not appear while unresolved risk
 * items (S2) or litigation killers awaiting ack remain. Soft S2 may still
 * allow Copy; the line must say so plainly.
 */
export function builderFinishLine(args: {
  hasContent: boolean;
  filingAllowed: boolean;
  exportAllowed: boolean;
  emailAllowed: boolean;
  blockedReason: string | null;
  /** Account has no clinical role — blocks Copy/File authorship checkpoint. */
  roleRecorded?: boolean;
  /** Open litigation killers that require Check-your-note ack before Copy. */
  requiresKillerAck?: boolean;
  /** Open S2 review findings (does not hard-block Copy). */
  openReviewCount?: number;
}): string {
  const {
    hasContent,
    filingAllowed,
    exportAllowed,
    emailAllowed,
    blockedReason,
    roleRecorded = true,
    requiresKillerAck = false,
    openReviewCount = 0
  } = args;
  if (!hasContent) return "Write something to unlock Submit and Copy.";
  if (!roleRecorded) {
    return "Record clinical role before Copy or File — ask a Team Lead.";
  }
  if (!filingAllowed) return "Dentist must file this note — transfer ownership first.";
  if (!exportAllowed) return blockedReason || "Copy locked until every stop is fixed.";
  if (requiresKillerAck) {
    return "Unresolved risk items — acknowledge on Copy before the note leaves.";
  }
  if (openReviewCount > 0) {
    return "Review open items before filing. Copy still allowed.";
  }
  if (emailAllowed) return "Ready to file.";
  return blockedReason || "Fix open stops before filing.";
}
