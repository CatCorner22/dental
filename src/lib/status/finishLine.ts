/**
 * One-line finish copy for the builder action bar and mobile strip.
 *
 * Order matters: empty draft → filing authority → audit gates. A hygienist
 * who has cleared every S0 still cannot file dentist-owned content — saying
 * "Ready to file" would be a false green light on the finish control.
 */
export function builderFinishLine(args: {
  hasContent: boolean;
  filingAllowed: boolean;
  exportAllowed: boolean;
  emailAllowed: boolean;
  blockedReason: string | null;
}): string {
  const { hasContent, filingAllowed, exportAllowed, emailAllowed, blockedReason } = args;
  if (!hasContent) return "Write something to unlock Submit and Copy.";
  if (!filingAllowed) return "Dentist must file this note — transfer ownership first.";
  if (!exportAllowed) return blockedReason || "Copy locked until every stop is fixed.";
  if (emailAllowed) return "Ready to file.";
  return blockedReason || "Fix open stops before filing.";
}
