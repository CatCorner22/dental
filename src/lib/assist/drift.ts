// DRIFT DETECTION.
//
// The second half of "learn over time", and the half that is actually safe to
// build. Nothing here adjusts a rule, tunes a threshold, or trains on anything.
// It counts.
//
// The insight it rests on: every verifier refusal is already a LABELLED EXAMPLE
// of the model misbehaving, produced for free, at the moment it happened, by a
// deterministic judge. A refusal says "this output changed a dose" or "this
// output invented a clinical claim" — which is exactly the annotation an
// evaluation set is expensive to obtain. The application was throwing all of it
// away: the assist route logged successes and discarded refusals, so there was no
// way to answer the only question that matters about a language model in
// production — "is it getting worse?"
//
// It cannot be answered from a single call. One fabricated sentence is a
// refusal, correctly handled, invisible. A thousand calls where `content-invented`
// went from 2% to 30% is a provider silently changing the model behind a version
// name, or a prompt edit that broke something, or a new note type the assistant
// was never suited to. That is drift, it is a trend rather than an event, and a
// trend is only visible if somebody kept count.
//
// WHAT IS COUNTED AND WHAT IS NOT. The assist path's privacy contract is that no
// note text is ever stored or logged. That is not relaxed here by one character.
// A drift row holds the capability, the prompt version, the model identity, and
// the rejection CODES — rule names, all of them constants from this codebase, none
// of them derived from what anyone typed. The codes are what make the signal
// legible; the text would add nothing a code does not already say.
//
// MODEL IDENTITY IS THE LOAD-BEARING FIELD. "anthropic/claude-sonnet-4.5" is a
// pointer, not a version, and the thing on the other end of it changes without
// notice. Attributing a rise in refusals to the right cause is impossible without
// recording what answered the call.

export type DriftOutcome =
  | "ok"
  | "verifier-rejected"
  | "phi-blocked"
  | "model-error"
  // From main's schema-constrained list path: the model answered but the answer
  // did not fit the contract. Distinct from model-error on purpose — a provider
  // that is down is somebody else's problem, and a provider returning malformed
  // structure is a signal about the model or the prompt.
  | "invalid-shape";

export interface DriftEvent {
  outcome: DriftOutcome;
  capability: string;
  promptVersion: string;
  model: string;
  /** Rejection codes, or PHI rule ids. Never text. */
  codes: string[];
  /**
   * Tokens the call consumed, from main's metering. Zero when the provider was
   * never reached, which is most refusals — a PHI block costs nothing, and that
   * asymmetry is itself worth seeing.
   */
  tokens: number;
  /**
   * Fact counts for the extract capability, whose refusals are PER FACT inside
   * a successful call. COUNTS ONLY — the facts themselves are clinical content
   * and never touch a log. Absent for every other capability, and absent on
   * rows written before this field existed, which the decoder tolerates.
   */
  facts?: { pinned: number; refused: number; questions: number };
  at: Date;
}

/**
 * The audit-log `detail` encoding.
 *
 * A single string, because it rides in the existing audit log rather than a new
 * table — the log is already immutable, already admin-readable, already exported
 * to CSV, and already the place a reviewer looks. A parallel table would have
 * needed all of that built again.
 *
 * Deliberately parseable rather than prose. The stats below read it back, and a
 * format nothing can read is a format that rots.
 */
export function encodeDriftDetail(e: Omit<DriftEvent, "at">): string {
  const facts = e.facts ? ` facts=${e.facts.pinned}/${e.facts.refused}/${e.facts.questions}` : "";
  const codes = e.codes.length > 0 ? ` codes=${e.codes.join("+")}` : "";
  return `${e.outcome} cap=${e.capability} prompt=${e.promptVersion} model=${e.model} tokens=${e.tokens}${facts}${codes}`;
}

export function decodeDriftDetail(detail: string): Omit<DriftEvent, "at"> | null {
  const m =
    /^(\S+) cap=(\S+) prompt=(\S+) model=(\S+?)(?: tokens=(\d+))?(?: facts=(\d+)\/(\d+)\/(\d+))?(?: codes=(\S+))?$/.exec(
      detail.trim()
    );
  if (!m) return null;
  const outcome = m[1] as DriftOutcome;
  if (
    !["ok", "verifier-rejected", "phi-blocked", "model-error", "invalid-shape"].includes(outcome)
  ) {
    return null;
  }
  return {
    outcome,
    capability: m[2],
    promptVersion: m[3],
    model: m[4],
    tokens: m[5] ? Number(m[5]) : 0,
    ...(m[6] !== undefined
      ? { facts: { pinned: Number(m[6]), refused: Number(m[7]), questions: Number(m[8]) } }
      : {}),
    codes: m[9] ? m[9].split("+").filter(Boolean) : []
  };
}

export interface DriftWindow {
  /** Calls that reached the model and were accepted. */
  accepted: number;
  /** Calls the verifier refused after the model answered. */
  refused: number;
  /** Calls never made, because the text was not de-identified. */
  phiBlocked: number;
  /** Provider failures. Not the model's fault and not the writer's. */
  errors: number;
  /**
   * Refusals as a share of calls the model actually answered.
   *
   * PHI blocks are excluded from the denominator on purpose: they are a fact
   * about what staff typed, not about how the model behaved, and folding them in
   * would move the number that is supposed to mean "the model is drifting" every
   * time somebody pastes a phone number.
   */
  refusalRate: number;
  /** Rejection code -> count, most frequent first. */
  byCode: { code: string; count: number }[];
  /** Model identity -> refusal rate, so a silent provider swap is attributable. */
  byModel: { model: string; answered: number; refused: number; refusalRate: number }[];
}

function rate(refused: number, answered: number): number {
  return answered === 0 ? 0 : Math.round((refused / answered) * 1000) / 1000;
}

export function summarize(events: DriftEvent[]): DriftWindow {
  let accepted = 0;
  let refused = 0;
  let phiBlocked = 0;
  let errors = 0;
  const codes = new Map<string, number>();
  const models = new Map<string, { answered: number; refused: number }>();

  for (const e of events) {
    const model = models.get(e.model) ?? { answered: 0, refused: 0 };
    switch (e.outcome) {
      case "ok":
        accepted++;
        model.answered++;
        break;
      case "verifier-rejected":
        refused++;
        model.answered++;
        model.refused++;
        for (const c of e.codes) codes.set(c, (codes.get(c) ?? 0) + 1);
        break;
      case "phi-blocked":
        phiBlocked++;
        for (const c of e.codes) codes.set(c, (codes.get(c) ?? 0) + 1);
        break;
      case "invalid-shape":
        // Counted with the refusals: the model DID answer, and the answer was
        // rejected. Filing it under provider errors would hide a prompt or model
        // regression behind a number nobody reads as a quality signal.
        refused++;
        model.answered++;
        model.refused++;
        for (const c of e.codes) codes.set(c, (codes.get(c) ?? 0) + 1);
        break;
      case "model-error":
        errors++;
        break;
    }
    models.set(e.model, model);
  }

  return {
    accepted,
    refused,
    phiBlocked,
    errors,
    refusalRate: rate(refused, accepted + refused),
    byCode: [...codes.entries()]
      .map(([code, count]) => ({ code, count }))
      // Count descending, then code ascending so the order is stable for a
      // reader comparing two days.
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
    byModel: [...models.entries()]
      .map(([model, m]) => ({ ...m, model, refusalRate: rate(m.refused, m.answered) }))
      .sort((a, b) => b.answered - a.answered || a.model.localeCompare(b.model))
  };
}

/**
 * Refusals that mean the model invented content, as opposed to garbling it.
 *
 * Separated because the two are different problems with different owners. A
 * `digits-changed` refusal is a transcription-shaped failure. `content-invented`
 * and `attribution-added` are the model asserting things nobody said, which is
 * the failure this whole layer exists to prevent and the one that would end up in
 * front of a plaintiff's expert. A practice watching one number should watch this
 * one.
 */
export const FABRICATION_CODES: readonly string[] = [
  "content-invented",
  "attribution-added",
  "not-questions"
];

export function fabricationRate(window: DriftWindow): number {
  const answered = window.accepted + window.refused;
  const fabrications = window.byCode
    .filter((c) => FABRICATION_CODES.includes(c.code))
    .reduce((sum, c) => sum + c.count, 0);
  return rate(fabrications, answered);
}

/**
 * A judgement, stated in words, about whether this window needs a human.
 *
 * Thresholds rather than a model, and named constants rather than magic numbers,
 * because the point is that a person can read the rule and disagree with it. The
 * tool's own error signal, human-reviewed, never self-adjusting — the same
 * contract the rule-disagreement queue already runs on.
 */
export const DRIFT_THRESHOLDS = {
  /** Above this share of answered calls refused, something has changed. */
  refusalRate: 0.25,
  /** Fabrication is held to a far tighter bar than garbling. */
  fabricationRate: 0.05,
  /** Below this many answered calls, a rate is noise. */
  minimumSample: 20
} as const;

export function driftVerdict(window: DriftWindow): {
  level: "quiet" | "watch" | "investigate";
  reason: string;
} {
  const answered = window.accepted + window.refused;
  if (answered < DRIFT_THRESHOLDS.minimumSample) {
    return {
      level: "quiet",
      reason: `${answered} answered call${answered === 1 ? "" : "s"} in this window — too few to read a rate from.`
    };
  }
  const fab = fabricationRate(window);
  if (fab > DRIFT_THRESHOLDS.fabricationRate) {
    return {
      level: "investigate",
      reason:
        `${Math.round(fab * 100)}% of answered calls tried to add content that was not in the note ` +
        `(the bar is ${Math.round(DRIFT_THRESHOLDS.fabricationRate * 100)}%). The rails caught every one. ` +
        `Check whether the model behind "${window.byModel[0]?.model ?? "the configured name"}" changed.`
    };
  }
  if (window.refusalRate > DRIFT_THRESHOLDS.refusalRate) {
    return {
      level: "watch",
      reason:
        `${Math.round(window.refusalRate * 100)}% of answered calls were refused. Nothing unsafe reached a ` +
        `clinician, but staff are spending clicks on drafts they never see — worth reading the top codes below.`
    };
  }
  return {
    level: "quiet",
    reason: `${Math.round(window.refusalRate * 100)}% of answered calls refused, across ${answered}. Normal.`
  };
}

// ===========================================================================
// EXTRACTION HEALTH — the sampled-precision loop, done the zero-persistence way.
//
// E-discovery earns the right to use probabilistic classification in front of
// courts by MEASURING error with statistical sampling. This product's twist is
// that nothing extracted is ever stored, so there is no corpus to sample after
// the fact — and there does not need to be, because every extraction decision
// already passes a human at the moment it exists. The measurements fall out of
// counts the log already holds:
//
//   MACHINE PRECISION PROXY: per-fact refusal rate. What share of the model's
//   proposals could not survive the deterministic verifier. Rising = the model
//   (or a silent provider swap) is drifting toward fabrication.
//
//   HUMAN ACCEPTANCE: of the facts that DID survive the verifier, how many did
//   a clinician actually add to a note. Falling = the surviving facts are
//   technically grounded but clinically useless — a failure mode the verifier
//   cannot see and the only person who can is the one clicking.
//
// Two numbers, two failure directions, no note content anywhere.
// ===========================================================================

export interface ExtractionWindow {
  /** Extract calls that reached the model and returned a valid shape. */
  calls: number;
  factsPinned: number;
  factsRefused: number;
  questions: number;
  /** refused / (pinned + refused). The machine-precision proxy. */
  perFactRefusalRate: number;
  /** Facts a human clicked into a note, from the count-only decision beacon. */
  humanAccepted: number;
  /** humanAccepted / factsPinned, capped at 1 — see the note in summarizeExtraction. */
  acceptanceRate: number;
  /** Refusal code -> count, most frequent first. */
  byCode: { code: string; count: number }[];
}

export function summarizeExtraction(events: DriftEvent[], humanAccepted: number): ExtractionWindow {
  let calls = 0;
  let pinned = 0;
  let refused = 0;
  let questions = 0;
  const codes = new Map<string, number>();

  for (const e of events) {
    if (e.capability !== "extract") continue;
    if (e.outcome !== "ok") continue;
    calls++;
    if (e.facts) {
      pinned += e.facts.pinned;
      refused += e.facts.refused;
      questions += e.facts.questions;
    }
    // On the ok path, codes are the PER-FACT refusal codes — the general
    // summarize() ignores them there, and this is the aggregation that reads
    // them.
    for (const c of e.codes) codes.set(c, (codes.get(c) ?? 0) + 1);
  }

  const proposed = pinned + refused;
  return {
    calls,
    factsPinned: pinned,
    factsRefused: refused,
    questions,
    perFactRefusalRate: proposed === 0 ? 0 : Math.round((refused / proposed) * 1000) / 1000,
    humanAccepted,
    // Capped, and the cap is honesty rather than cosmetics: the beacon and the
    // drift rows are written by different requests, so a window boundary can
    // catch an acceptance whose pinning landed in the previous window. A rate
    // over 1 would read as data corruption when it is only clock skew.
    acceptanceRate: pinned === 0 ? 0 : Math.min(1, Math.round((humanAccepted / pinned) * 1000) / 1000),
    byCode: [...codes.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
  };
}
