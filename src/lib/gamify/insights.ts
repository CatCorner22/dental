import type { SubmissionStatRow } from "@/lib/stats/computeStats";

// Deterministic "strengths and opportunities" from the frozen subscores.
// No model, no PHI, no adjectives about the PERSON — only about the notes.
// A line earns its place by being actionable; observations without a next
// step are decoration.

const AXIS_LABEL: Record<string, string> = {
  completeness: "completeness (required facts present)",
  specificity: "specificity (exact values over vague wording)",
  consistency: "consistency (no colliding statements)",
  justification: "billing-narrative readiness"
};

const AXIS_TIP: Record<string, string> = {
  completeness: "the verified blocks fill the recurring gaps fastest",
  specificity: "swap the flagged vague phrases for the measured value",
  consistency: "watch the medication and site statements against the history",
  justification: "reference the periodontal charting and the structural findings by name"
};

export function deriveInsights(rows: SubmissionStatRow[], windowDays = 30, now = new Date()): string[] {
  const cutoff = now.getTime() - windowDays * 86_400_000;
  const graded = rows.filter(
    (r) => r.gpaSubscores && r.submittedAtUtc.getTime() >= cutoff
  );
  if (graded.length < 3) return [];

  const sums: Record<string, { total: number; n: number }> = {};
  for (const r of graded) {
    for (const [axis, score] of Object.entries(r.gpaSubscores!)) {
      const bucket = sums[axis] ?? { total: 0, n: 0 };
      bucket.total += score;
      bucket.n++;
      sums[axis] = bucket;
    }
  }
  const averages = Object.entries(sums)
    .map(([axis, { total, n }]) => ({ axis, avg: total / n }))
    .filter((a) => AXIS_LABEL[a.axis])
    .sort((a, b) => b.avg - a.avg);
  if (averages.length === 0) return [];

  const lines: string[] = [];
  const best = averages[0];
  if (best.avg >= 0.9) {
    lines.push(`Strongest axis: ${AXIS_LABEL[best.axis]} — averaging ${(best.avg * 100).toFixed(0)}%.`);
  }
  const worst = averages[averages.length - 1];
  if (worst.avg < 0.85 && worst.axis !== best.axis) {
    lines.push(
      `Most room: ${AXIS_LABEL[worst.axis]} (${(worst.avg * 100).toFixed(0)}%) — ${AXIS_TIP[worst.axis]}.`
    );
  }
  return lines;
}
