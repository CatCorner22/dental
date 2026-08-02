// Sparkle, the tooth mascot. Fixed, human-written micro-copy — deterministic
// selection, never AI-generated (a stated anti-drift guardrail). Cute but
// professional; never clinical advice.
type SparkleContext = "dashboard" | "afterSubmit" | "firstPass";

const LINES: Record<SparkleContext, string[]> = {
  dashboard: [
    "Sparkle says: standard words, standard order, standard-issue great notes.",
    "Sparkle says: a clean note today saves a headache tomorrow.",
    "Sparkle says: one module per procedure keeps everything tidy.",
    "Sparkle says: the audit is your teammate, not your judge."
  ],
  afterSubmit: [
    "Sparkle says: nicely done — filed and traceable.",
    "Sparkle says: another one in the record. Shiny.",
    "Sparkle says: that ticket is officially on the books."
  ],
  firstPass: [
    "Sparkle says: first-pass clean — you make this look easy!",
    "Sparkle says: zero flags. Absolutely gleaming.",
    "Sparkle says: spotless note. The streak lives on!"
  ]
};

// Deterministic by a caller-supplied seed (e.g. submission id) so the same
// event always shows the same line and there is nothing generative involved.
export function sparkleLine(context: SparkleContext, seed: number): string {
  const lines = LINES[context];
  const idx = ((Math.trunc(seed) % lines.length) + lines.length) % lines.length;
  return lines[idx];
}
