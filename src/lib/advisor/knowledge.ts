// BYTE'S BRAIN — the advisory knowledge base.
//
// ===========================================================================
// WHAT BYTE IS, AND WHAT BYTE IS NOT
//
// Byte is the practice's knowledge, compiled: Tennessee dental-record law, the
// pharmacy safety literature, the litigation lessons from the owner's research,
// and the practice's own writing standards — evaluated deterministically
// against the note being drafted, live, on every pause in typing.
//
// Byte is READ-ONLY AND ADVISE-ONLY, structurally. There is no code path from
// this module to a note: it consumes text and returns advice objects, and the
// UI that renders them contains no write action. The human is in control at
// all times, not as a policy but as an architecture — Byte could not touch the
// record even if every rule below were wrong.
//
// Byte is also NOT the audit. The audit engine gates; findings block or advise
// with severities and it owns enforcement. Byte coaches: WHY the standard
// exists, which case or rule it comes from, and what a stronger note looks
// like. Same tables, same facts, different job — the audit is the referee,
// Byte is the trainer. Byte never blocks anything, ever.
//
// EVERY ENTRY CITES ITS SOURCE. Advice without a source is one person's
// opinion wearing a mascot costume; advice with "Tenn. Comp. R. 0460-02-.12"
// or "Schwarcz, Mich. Ct. App. 2015" under it is the practice's institutional
// knowledge, teaching itself to whoever is typing.
// ===========================================================================

import type { ClinicalFact } from "@/lib/extract/facts";

export interface AdvisorContext {
  /** The note text, as typed so far. */
  text: string;
  /** Lower-cased text, computed once for the many entries that scan it. */
  lower: string;
  /** The deterministic parser's reading of the note. */
  facts: ClinicalFact[];
  /** Fact kinds present, for cheap membership checks. */
  kinds: Set<ClinicalFact["kind"]>;
}

export interface KnowledgeEntry {
  id: string;
  /** Short, glanceable. What Byte says in the speech bubble. */
  say: string;
  /** The teaching: why this matters, in cold logic with warmth allowed. */
  why: string;
  /** Where this comes from. Always present, always specific. */
  source: string;
  /**
   * Higher fires first when several entries match. Safety beats law beats
   * craft — a dose question outranks a style question every time.
   */
  priority: number;
  /** Pure predicate over the drafting context. */
  when: (ctx: AdvisorContext) => boolean;
}

const hasProcedureCategory = (ctx: AdvisorContext, category: string): boolean =>
  ctx.facts.some((f) => f.kind === "procedure" && f.category === category && f.assertion.polarity === "affirmed");

const hasCareEvent = (ctx: AdvisorContext, needle: string): boolean =>
  ctx.facts.some((f) => f.kind === "care-event" && f.event.includes(needle));

const mentions = (ctx: AdvisorContext, ...needles: string[]): boolean =>
  needles.some((n) => ctx.lower.includes(n));

export const KNOWLEDGE: KnowledgeEntry[] = [
  // --- Safety and pharmacy -------------------------------------------------
  {
    id: "byte.dose-context",
    say: "Anesthetic on board — I am watching the math.",
    why:
      "A carpule of 2% lidocaine is 36 mg, and the published ceilings are 4.4 mg/kg or 300 mg " +
      "absolute. State the concentration with the count and the arithmetic takes care of itself; " +
      "leave the concentration off and nobody can compute the dose from this note, including you.",
    source: "Malamed dose tables; this practice's anesthetic-dose rule (ruleset 2.13.0)",
    priority: 90,
    when: (ctx) =>
      ctx.facts.some(
        (f) => f.kind === "medication" && f.assertion.polarity === "affirmed" && f.volumeMl !== undefined
      )
  },
  {
    id: "byte.weight-for-child",
    say: "Pediatric visit? A weight in kg makes every dose checkable.",
    why:
      "The kilogram rule exists because pound-kilogram confusion is a documented 2.2x overdose " +
      "path, and weight-based ceilings cannot be computed from a note that never states the " +
      "weight. One number turns every dose in this note into checkable arithmetic.",
    source: "Joint Commission Sentinel Event Alert 39; ISMP pediatric dosing guidance",
    priority: 85,
    when: (ctx) =>
      mentions(ctx, "pediatric", "child", "pulpotomy", "ssc") &&
      ctx.kinds.has("medication") &&
      !/\b\d+(?:\.\d+)?\s*kg\b/i.test(ctx.text)
  },
  {
    id: "byte.allergy-status",
    say: "A prescription is here — is the allergy status?",
    why:
      "The allergy line is the single most safety-relevant sentence in a dental chart, and it is " +
      "either verified at THIS visit or it is a rumor from the last one. NKDA when verified, the " +
      "allergy when present — either is defensible, and only silence is not.",
    source: "Tenn. Comp. R. 0460-02-.12 (concise medical history); ISMP",
    priority: 80,
    when: (ctx) =>
      ctx.kinds.has("medication") &&
      !mentions(ctx, "allerg", "nkda", "nka")
  },

  // --- Tennessee law and the record ---------------------------------------
  {
    id: "byte.radiograph-interpretation",
    say: "Images taken — Tennessee counts the INTERPRETATION as part of the record.",
    why:
      "\"BWs taken\" documents an exposure, not a diagnostic act. Tennessee expressly includes " +
      "radiographs AND their interpretations in the dental record, and interpretation is dentist " +
      "work. One line — who read it, what they saw, or interpretation pending with an owner — " +
      "closes the gap.",
    source: "Tenn. Comp. R. 0460-02-.12; Tenn. Code Ann. § 63-5-108",
    priority: 75,
    when: (ctx) =>
      ctx.facts.some(
        (f) =>
          f.kind === "procedure" &&
          f.category === "diagnostic" &&
          f.procedure.includes("radiograph") &&
          f.assertion.polarity === "affirmed"
      ) && !mentions(ctx, "interpret", "reviewed by", "read by", "impression")
  },
  {
    id: "byte.extraction-aftercare",
    say: "An extraction without documented aftercare is the Schwarcz gap.",
    why:
      "In Schwarcz, the procedure itself was found clinically acceptable — the discipline stood " +
      "on the missing documentation of the complication and the disclosure. Post-operative " +
      "instructions, complication status, and follow-up are what make an extraction note " +
      "defensible three years from now.",
    source: "Bureau of Health Care Servs. v. Schwarcz (Mich. Ct. App. 2015); owner's litigation research",
    priority: 70,
    when: (ctx) =>
      hasProcedureCategory(ctx, "surgical") &&
      !hasCareEvent(ctx, "post-operative") &&
      !mentions(ctx, "post-op", "postoperative")
  },
  {
    id: "byte.soft-tissue-close-the-loop",
    say: "A soft-tissue finding needs a disposition, not just a mention.",
    why:
      "D'Amour lost on exactly this: a lesion observed, not documented, not discussed. A finding " +
      "plus its disposition — described, measured where possible, disclosed, referred or " +
      "scheduled for review — is a closed loop. A finding alone is an open one, and open loops " +
      "are what records get judged on.",
    source: "D'Amour v. Bd. of Registration in Dentistry, 409 Mass. 572 (1991)",
    priority: 72,
    when: (ctx) =>
      ctx.facts.some(
        (f) => f.kind === "finding" && f.assertion.polarity === "affirmed" && ["lesion", "ulceration"].some((n) => f.finding.includes(n))
      ) && !mentions(ctx, "refer", "biopsy", "monitor", "recheck", "disclosed", "discussed")
  },
  {
    id: "byte.consent-is-a-conversation",
    say: "A signed form proves a signature. The note proves the conversation.",
    why:
      "Tennessee's informed-consent cases turn on what was actually discussed — risks, " +
      "alternatives, the option of doing nothing, the patient's questions. Two sentences " +
      "recording that conversation outweigh any stack of signed boilerplate.",
    source: "Sanders (Tenn. Ct. App. 1997); CNA/Dentist's Advantage claim guidance",
    priority: 65,
    when: (ctx) =>
      mentions(ctx, "consent") && !mentions(ctx, "risk", "alternative", "question", "declined", "option")
  },

  // --- Craft: the writing itself -------------------------------------------
  {
    id: "byte.active-voice",
    say: "Who did it? Active voice puts the actor in the sentence.",
    why:
      "\"2 carpules were administered\" hides the one fact a reviewer always wants: by whom. " +
      "\"The dentist administered 2 carpules\" is shorter, clearer, and attribution is the " +
      "difference between a record and a mystery. Passive voice is not wrong — it is just " +
      "where actors go to disappear.",
    source: "Adams, A Manual of Style for Contract Drafting (5th ed.); this practice's writing standard",
    priority: 40,
    when: (ctx) => detectPassive(ctx.text).length > 0
  },
  {
    id: "byte.specifics-beat-adjectives",
    say: "Numbers age better than adjectives.",
    why:
      "\"Deep pocket\" is an argument; \"6 mm pocket, distal of tooth 30\" is a fact. The reader " +
      "in three years — a colleague, an insurer, an attorney — can act on a measurement and can " +
      "only shrug at an adjective.",
    source: "CNA/Dentist's Advantage: factual, objective, professionally worded entries",
    priority: 35,
    when: (ctx) =>
      mentions(ctx, "deep pocket", "large caries", "significant bone loss", "severe decay") &&
      !ctx.kinds.has("measurement")
  },
  {
    id: "byte.first-fact",
    say: "Hi! I read as you type — teeth, doses, findings — and coach, never block.",
    why:
      "Everything Byte says is advice with a source under it: Tennessee record rules, pharmacy " +
      "safety literature, and the lessons of real disciplinary cases. The audit panel is the " +
      "referee; Byte is the trainer. Nothing here can touch your note.",
    source: "This practice's advisor charter: read-only, advise-only, source-cited",
    priority: 1,
    when: (ctx) => ctx.facts.length > 0
  },

  // --- Momentum: earned, specific encouragement ----------------------------
  {
    id: "byte.strong-note",
    say: "This note answers the questions before a reader asks them.",
    why:
      "Teeth named, doses computable, aftercare documented — this is what \"the record alone " +
      "shows what happened and why\" looks like in practice. The next reader of this chart, " +
      "whoever they are, will not need to call you.",
    source: "Tenn. Comp. R. 0460-02-.12's continuity standard, met",
    priority: 5,
    when: (ctx) =>
      ctx.facts.length >= 6 &&
      ctx.kinds.has("care-event") &&
      detectPassive(ctx.text).length === 0
  }
];

/**
 * Passive-voice detection, scoped to the clinical verbs that matter.
 *
 * A general passive detector over English is a research project; a detector
 * over the twenty verbs dental notes actually use is a table. Deliberately
 * NARROW: it looks for be-forms attached to the specific participles whose
 * hidden actor a reviewer will someday ask about ("was administered" — by
 * whom?), and it accepts the construction when a by-phrase follows, because
 * "was administered by Dr. M" names the actor and the coaching point
 * disappears.
 *
 * Advice-only. Passive voice is sometimes the right call, and a coach that
 * nags on every instance teaches people to dismiss the coach — so the UI
 * shows this once per session of drafting, not once per sentence.
 */
const PASSIVE_PARTICIPLES =
  "administered|placed|given|taken|reviewed|discussed|obtained|performed|completed|noted|observed|advised|prescribed|recorded|extracted|restored|applied|removed|adjusted|delivered|provided";

const PASSIVE_PATTERN = new RegExp(
  `\\b(?:was|were|is|are|has been|have been|being)\\s+(?:${PASSIVE_PARTICIPLES})\\b(?!\\s+by\\s+\\S)`,
  "gi"
);

export function detectPassive(text: string): string[] {
  const found: string[] = [];
  PASSIVE_PATTERN.lastIndex = 0;
  for (const m of text.matchAll(PASSIVE_PATTERN)) {
    found.push(m[0]);
    if (found.length >= 5) break;
  }
  return found;
}
