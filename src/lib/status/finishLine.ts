/**
 * One-line finish copy for the builder action bar and mobile strip.
 *
 * Order matters: empty draft → role authorship → dentist ownership → filing
 * authority → audit stops → open killers → open Soft S2 review → Ready.
 *
 * Honest Finish: "Ready" never appears with open killers or open Soft S2
 * reviews. Litigation killers hard-block Copy/File (no checkbox escape).
 */
export function builderFinishLine(args: {
  hasContent: boolean;
  filingAllowed: boolean;
  exportAllowed: boolean;
  emailAllowed: boolean;
  blockedReason: string | null;
  /** Account has no clinical role — blocks write + Copy/File. */
  roleRecorded?: boolean;
  /** Open litigation killers hard-block handoff. */
  killersBlockHandoff?: boolean;
  /** Open S2 review findings that are not killers (Copy still allowed). */
  openReviewCount?: number;
  /**
   * Aux writer + open dentist-judgement killers — Copy waits for dentist
   * ownership (subset of killersBlockHandoff; Andon messaging).
   */
  dentistMustOwnKillers?: boolean;
}): string {
  const {
    hasContent,
    filingAllowed,
    exportAllowed,
    emailAllowed,
    blockedReason,
    roleRecorded = true,
    killersBlockHandoff = false,
    openReviewCount = 0,
    dentistMustOwnKillers = false
  } = args;
  if (!hasContent) return "Write something to unlock Submit and Copy.";
  if (!roleRecorded) {
    return "Record clinical role before writing, Copy, or File — ask a Team Lead.";
  }
  if (dentistMustOwnKillers) {
    return "Dentist must accept Assessment risk items before Copy — transfer ownership.";
  }
  if (!filingAllowed) {
    return "Dentist must file this note — transfer ownership before Copy.";
  }
  if (!exportAllowed) return blockedReason || "Copy locked until every stop is fixed.";
  if (killersBlockHandoff) {
    return "Litigation-sensitive gaps block Copy and File until fixed — no checkbox bypass.";
  }
  if (openReviewCount > 0) {
    return "Open review items remain — Copy does not clear them.";
  }
  if (emailAllowed) return "Ready to file.";
  return blockedReason || "Fix open stops before filing.";
}
