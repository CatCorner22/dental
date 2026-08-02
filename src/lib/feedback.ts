// Where feedback goes. Defined once so the login reminder, the header link,
// and anywhere else that offers to contact the developer can never drift to
// different addresses.
export const FEEDBACK_EMAIL = "blakereagan@protonmail.com";

export const FEEDBACK_REASONS = [
  "support",
  "upgrade requests",
  "ideas and suggestions",
  "to report bugs"
] as const;

// A prefilled subject means the developer can sort an inbox without opening
// anything; the body is left empty so the writer starts where the cursor is.
export function feedbackMailto(subject = "Dental Note Builder — feedback"): string {
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
