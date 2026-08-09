// Where feedback goes. Defined once so the login reminder, the header link,
// and anywhere else that offers to contact the developer can never drift to
// different addresses.
//
// NO DEFAULT, DELIBERATELY. This shipped as a hardcoded personal address, and
// the footer put it on every page of a clinical tool — so a staff member
// replying about "the note for the 2pm extraction" sent clinical context to a
// personal mailbox outside whatever HIPAA boundary the practice had drawn. An
// address that belongs to the practice is a deployment fact, not a source-code
// constant, and the honest default for an unset one is to show no link at all
// rather than route staff mail somewhere nobody chose.
//
// NEXT_PUBLIC_ because the footer renders in client components; it is a
// published contact address, not a secret.
export const FEEDBACK_EMAIL: string =
  process.env.NEXT_PUBLIC_FEEDBACK_EMAIL?.trim() || "";

/** Whether a feedback address is configured; false hides the affordance. */
export const FEEDBACK_CONFIGURED = FEEDBACK_EMAIL.length > 0;

export const FEEDBACK_REASONS = [
  "support",
  "upgrade requests",
  "ideas and suggestions",
  "to report bugs"
] as const;

// A prefilled subject means the developer can sort an inbox without opening
// anything; the body is left empty so the writer starts where the cursor is.
// Returns null when unconfigured, so a caller cannot build `mailto:?subject=…`
// and hand someone an empty compose window.
export function feedbackMailto(subject = "Smile Notes — feedback"): string | null {
  if (!FEEDBACK_CONFIGURED) return null;
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
