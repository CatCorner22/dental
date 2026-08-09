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
export type SparkleContext =
  | "dashboard"
  | "afterSubmit"
  | "firstPass"
  | "empty"
  | "conflict"
  | "paste"
  | "resolving"
  | "scoped"
  | "saved"
  | "history"
  | "signIn"
  | "lost"
  | "batch"
  | "training";

const LINES: Record<SparkleContext, string[]> = {
  dashboard: [
    "Sparkle says: standard words, standard order, notes we can all trust.",
    "Sparkle says: a clean note covers the next teammate's visit.",
    "Sparkle says: the audit is a teammate, not a judge.",
    "Sparkle says: simple and standard wins every time.",
    "Sparkle says: every clean note is a gift to the next shift.",
    "Sparkle says: one module per procedure keeps everything tidy.",
    "Sparkle says: own the note, and the note takes care of the team.",
    "Sparkle says: say it clearly once and the whole team wins.",
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
    "Sparkle says: first-pass clean — the next reader feels that.",
    "Sparkle says: zero flags on this pass. Gleaming.",
    "Sparkle says: spotless note. Nothing left open.",
    "Sparkle says: clean on the first try — the next reader thanks you."
  ],
  empty: [
    "Sparkle says: fresh page, fresh start. The team's got this.",
    "Sparkle says: a quiet list is a fine place to begin."
  ],
  conflict: [
    "Sparkle says: two hands on one note — reloading keeps the team in sync.",
    "Sparkle says: teamwork moment! The newer save wins, nothing is lost."
  ],
  // Pasting an existing note in. The reassurance that matters here is that
  // nothing lands in the record without the writer putting it there.
  paste: [
    "Sparkle says: paste it in — the tidy-up happens where you can see it.",
    "Sparkle says: your words, sorted into sections. Move anything that landed oddly.",
    "Sparkle says: nothing moves into the note until you say so."
  ],
  // Working through the audit findings.
  resolving: [
    "Sparkle says: one finding at a time is plenty.",
    "Sparkle says: the panel shrinks as you work. That is the whole idea.",
    "Sparkle says: each one you close makes the next reader's day easier."
  ],
  // A section this licence hands to someone else. Said as a handoff, which is
  // what it is, rather than as a refusal.
  scoped: [
    "Sparkle says: the dentist signs this section. Everything else is yours.",
    "Sparkle says: this part goes to the dentist — your half is already solid."
  ],
  saved: [
    "Sparkle says: saved. Your work is safe on the server.",
    "Sparkle says: tucked away safely. Carry on."
  ],
  history: [
    "Sparkle says: filed notes land here once you submit your first one.",
    "Sparkle says: a quiet record is a fine place to start."
  ],
  // The sign-in card. The first thing anyone sees all day.
  signIn: [
    "Sparkle says: welcome back. Let's make today's notes easy to read.",
    "Sparkle says: good to see you. Every note you write covers a teammate."
  ],
  // A page that is not there. Softening it is the whole job — a person who
  // took a wrong turn has already had the unhelpful part of the experience.
  lost: [
    "Sparkle says: that page is not here. Your notes are, and they are fine.",
    "Sparkle says: nothing at this address — the note is one tap away."
  ],
  batch: [
    "Sparkle says: end of the day — let's see which ones are ready.",
    "Sparkle says: a quick sweep now saves a phone call later."
  ],
  training: [
    "Sparkle says: practice here costs nothing and helps every real note.",
    "Sparkle says: a few minutes here makes tomorrow's notes quicker."
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
