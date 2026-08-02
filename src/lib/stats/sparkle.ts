// Sparkle, the tooth mascot. Fixed, human-written micro-copy — deterministic
// selection, never AI-generated (a stated anti-drift guardrail).
//
// Ethics rules, enforced by tests and honored in every line:
// transparent encouragement (never hidden persuasion), fully ignorable,
// positive only (no shame, no staff comparisons, no guilt), truthful about
// this workflow, zero new tracking, and never lecturing. Team-minded lines
// draw on plain ownership-and-teamwork ideas in our own words — no quotes,
// no branding. Roughly one line in three carries a team principle; the rest
// stay light so the principle lines feel subtle, not preachy.
type SparkleContext = "dashboard" | "afterSubmit" | "firstPass" | "empty" | "conflict";

const LINES: Record<SparkleContext, string[]> = {
  dashboard: [
    "Sparkle says: standard words, standard order, standard-issue great notes.",
    "Sparkle says: a clean note covers the next teammate's visit.",
    "Sparkle says: the audit is a teammate, not a judge.",
    "Sparkle says: simple and standard wins every time.",
    "Sparkle says: every clean note is a gift to the next shift.",
    "Sparkle says: one module per procedure keeps everything tidy.",
    "Sparkle says: own the note, and the note takes care of the team.",
    "Sparkle says: say it clearly once and the whole chain wins.",
    "Sparkle says: top finding first. Then the next one.",
    "Sparkle says: a good note today is a calm phone call tomorrow."
  ],
  afterSubmit: [
    "Sparkle says: nicely done — filed and traceable.",
    "Sparkle says: that one covers the next shift. Thank you!",
    "Sparkle says: another one in the record. Shiny.",
    "Sparkle says: filed, stamped, and team-ready.",
    "Sparkle says: that ticket is officially on the books."
  ],
  firstPass: [
    "Sparkle says: first-pass clean — the whole team feels that!",
    "Sparkle says: zero flags. Absolutely gleaming.",
    "Sparkle says: spotless note. The streak lives on!",
    "Sparkle says: clean on the first try — the next reader thanks you."
  ],
  empty: [
    "Sparkle says: fresh page, fresh start. The team's got this.",
    "Sparkle says: a quiet list is a fine place to begin."
  ],
  conflict: [
    "Sparkle says: two hands on one note — reloading keeps you in step.",
    "Sparkle says: teamwork moment! The newer save wins, nothing is lost."
  ]
};

// Deterministic by a caller-supplied seed (submission id, day number) so the
// same event always shows the same line and nothing generative is involved.
export function sparkleLine(context: SparkleContext, seed: number): string {
  const lines = LINES[context];
  const idx = ((Math.trunc(seed) % lines.length) + lines.length) % lines.length;
  return lines[idx];
}

// UTC day number: the same line all day, a fresh one tomorrow. Rotation this
// slow encourages without nagging.
export function daySeed(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}

// Exposed for the copy-quality tests only.
export const ALL_SPARKLE_LINES: readonly string[] = Object.values(LINES).flat();
