import { decodeByteStarDetail } from "./log";
import { isModelEscapeDetail, parseEscapeStage } from "./ladder";

// BYTESTAR PERIOD SUMMARY — the transparent log, rolled up for the digest.
//
// Same privacy contract as the log itself: counts, codes, versions, tokens.
// Never note text, never observation prose. A Team Lead reads this to answer
// "is the pioneer earning its calls, and did the cage hold this period?" —
// per-person columns are deliberately absent.

export interface ByteStarLogInput {
  action: string;
  detail: string | null;
  atMs: number;
}

export interface ByteStarSummary {
  /** Model-path runs attempted (drift rows) in the window. */
  runs: number;
  /** Outcome mix across those runs (ok, phi-blocked, escape-*, …). */
  outcomes: Record<string, number>;
  /** Observations that survived every rail, and those the rails refused. */
  keptTotal: number;
  refusedTotal: number;
  /** Provider tokens spent in the window (drift + eval rows). */
  tokens: number;
  /** Router profile mix (documentation / high-risk / legal), when logged. */
  profiles: Record<string, number>;
  /** Escape ladder events by stage, plus how many were model-originated. */
  escapes: { total: number; modelOriginated: number; stages: Record<string, number> };
  /** Canary eval runs and the most recent pass ratio ("8/13"), if any ran. */
  evals: { runs: number; lastPass: string | null };
  permaKills: number;
  permaClears: number;
}

const PASS_RE = /\bpass=(\d+\/\d+)\b/;

export function buildByteStarSummary(rows: ByteStarLogInput[], sinceMs: number): ByteStarSummary {
  const inWindow = rows.filter((r) => r.atMs >= sinceMs);
  const summary: ByteStarSummary = {
    runs: 0,
    outcomes: {},
    keptTotal: 0,
    refusedTotal: 0,
    tokens: 0,
    profiles: {},
    escapes: { total: 0, modelOriginated: 0, stages: {} },
    evals: { runs: 0, lastPass: null },
    permaKills: 0,
    permaClears: 0
  };

  // Newest-first input keeps "lastPass" the most recent eval naturally.
  const sorted = [...inWindow].sort((a, b) => b.atMs - a.atMs);

  for (const row of sorted) {
    const decoded = decodeByteStarDetail(row.detail ?? "");
    switch (row.action) {
      case "bytestar.drift": {
        summary.runs += 1;
        const outcome = decoded?.outcome ?? "unknown";
        summary.outcomes[outcome] = (summary.outcomes[outcome] ?? 0) + 1;
        summary.keptTotal += decoded?.kept ?? 0;
        summary.refusedTotal += decoded?.refused ?? 0;
        summary.tokens += decoded?.tokens ?? 0;
        if (decoded?.profile) {
          summary.profiles[decoded.profile] = (summary.profiles[decoded.profile] ?? 0) + 1;
        }
        break;
      }
      case "bytestar.escape": {
        summary.escapes.total += 1;
        if (isModelEscapeDetail(row.detail)) summary.escapes.modelOriginated += 1;
        const stage = parseEscapeStage(row.detail);
        if (stage) summary.escapes.stages[stage] = (summary.escapes.stages[stage] ?? 0) + 1;
        summary.tokens += decoded?.tokens ?? 0;
        break;
      }
      case "bytestar.eval": {
        summary.evals.runs += 1;
        if (summary.evals.lastPass === null) {
          const m = row.detail?.match(PASS_RE);
          if (m) summary.evals.lastPass = m[1]!;
        }
        summary.tokens += decoded?.tokens ?? 0;
        break;
      }
      case "bytestar.perma-kill":
        summary.permaKills += 1;
        break;
      case "bytestar.perma-clear":
        summary.permaClears += 1;
        break;
      default:
        break;
    }
  }
  return summary;
}
