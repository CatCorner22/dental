// One source of truth for the product's identity and legal footer.
//
// Every surface that says the product's name — page titles, the header mark,
// the login screen, outgoing email subjects, the ticket template — reads it
// from here. Branding that is retyped in thirty files is branding that drifts:
// half the app ends up on the old name after the next rename.
//
// The tone is deliberately minimal: a wordmark, one tagline, one legal line.
// No slogans, no gradients, no second logo. A clinical tool earns trust by
// looking calm and staying out of the way.

export const APP_NAME = "Smile Notes";

// The whole mark, for places that render name + glyph together.
export const APP_MARK = "🦷";

export const APP_TAGLINE = "Standardized dental documentation";

// Longer form for metadata and the app description.
export const APP_DESCRIPTION =
  "Standardized, de-identified Smile Note drafts with a deterministic audit pass. No patient identifiers ever enter this tool.";

// Page titles read "<page> — Smile Notes" everywhere. Helper so the separator
// and order cannot drift between routes.
export function pageTitle(page?: string): string {
  return page ? `${page} — ${APP_NAME}` : APP_NAME;
}

// ---------------------------------------------------------------------------
// Legal
// ---------------------------------------------------------------------------

// The year is fixed rather than computed from the clock. A copyright line
// states when the work was published; silently rolling it forward every
// January would assert a publication date that never happened.
export const COPYRIGHT_YEAR = 2026;
export const COPYRIGHT_HOLDER = "Blake Reagan";

export const COPYRIGHT = `© Copyright ${COPYRIGHT_YEAR} ${COPYRIGHT_HOLDER}, all rights reserved.`;

// Shown in the footer of every page and on the sign-in screen, because consent
// to it is stated as a condition of use — it has to be visible BEFORE someone
// signs in, not only after.
export const PRIVACY_POLICY =
  "Privacy Policy: by using this software platform, you agree that you will not input PII or other legally sensitive information into Smile Notes.";
