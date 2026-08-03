// THE MEANING VERIFIER: the deterministic gate every AI-proposed rewrite must
// pass before a human is even shown it.
//
// The trust model is "the model proposes, the rails dispose". A language model
// is allowed to rewrite wording, reorder sentences, and tighten prose — the
// things regex cannot do — precisely BECAUSE this module rejects any output
// that differs from the input in clinical substance. The checks are the
// runtime form of the invariants meaning.test.ts pins for the deterministic
// pass: if a property matters enough to test, it matters enough to enforce on
// text a model wrote.
//
// Every rejection is typed and loud. A silent fallback would teach users that
// the AI "sometimes does nothing"; a stated rejection teaches them the tool
// checks its own work — which is the entire reason to trust it.

export interface VerifyRejection {
  code:
    | "digits-changed"
    | "negation-changed"
    | "teeth-changed"
    | "units-changed"
    | "drugs-changed"
    | "attribution-dropped"
    | "content-shrunk"
    | "claims-added"
    | "not-questions";
  detail: string;
}

export interface VerifyResult {
  ok: boolean;
  rejections: VerifyRejection[];
}

// Sorted multiset compare: order may legitimately change (a restructure moves
// sentences), values may not.
function multiset(tokens: string[]): string {
  return tokens
    .map((t) => t.toLowerCase())
    .sort()
    .join("|");
}

function digits(text: string): string[] {
  return text.match(/\d+(?:\.\d+)?/g) ?? [];
}

const NEGATION = /\b(?:no|not|never|denies|denied|without|non|none|nothing)\b/gi;

function negations(text: string): string[] {
  return text.match(NEGATION) ?? [];
}

// Tooth designators: "#19", "tooth 19", "teeth 1, 16", and primary letters in
// a tooth context. Bare numbers are already covered by the digit check; this
// adds the letter designators a digit check cannot see.
function toothLetters(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\b(?:tooth|teeth)\s+((?:[A-T](?:\s*,\s*|\s+and\s+|\s*))+)/gi)) {
    for (const letter of m[1].match(/[A-T]/g) ?? []) out.push(letter.toUpperCase());
  }
  return out;
}

const UNIT = /\b(?:mg|mcg|µg|kg|g|mL|ml|L|mm|cm|carpules?|units?|%)\b|%/gi;

function units(text: string): string[] {
  return text.match(UNIT) ?? [];
}

// Drug tokens: the same lexicon family the interaction screens watch, plus
// the common dental prescriptions. A model output that gains or loses one of
// these has changed the clinical record, whatever else it kept.
const DRUG =
  /\b(?:amoxicillin|penicillin|clindamycin|azithromycin|metronidazole|flagyl|doxycycline|clarithromycin|erythromycin|fluconazole|miconazole|ketoconazole|itraconazole|nystatin|chlorhexidine|ibuprofen|advil|motrin|naproxen|aleve|diclofenac|ketorolac|toradol|acetaminophen|tylenol|hydrocodone|oxycodone|codeine|tramadol|warfarin|coumadin|dabigatran|rivaroxaban|apixaban|lithium|methotrexate|propranolol|nadolol|timolol|simvastatin|atorvastatin|lovastatin|prednisone|dexamethasone|epinephrine|lidocaine|articaine|septocaine|mepivacaine|bupivacaine|marcaine|midazolam|diazepam|valium|triazolam|halcion|fentanyl|ketamine|propofol|nitrous)\b/gi;

function drugs(text: string): string[] {
  return text.match(DRUG) ?? [];
}

// Attribution markers: "patient reports/states/denies", "per patient",
// "parent reports". Dropping one converts a reported statement into an
// asserted clinical fact — the exact promotion the TN scope rules forbid.
const ATTRIBUTION =
  /\b(?:patient|parent|guardian|caregiver)\s+(?:reports?|states?|stated|denies|denied|describes?|says?)\b|\bper\s+(?:the\s+)?(?:patient|parent|guardian)\b|\bexternal\s+record\s+states?\b/gi;

function attributions(text: string): string[] {
  return text.match(ATTRIBUTION) ?? [];
}

// Clinical claim tokens: diagnoses, procedures, and outcome verbs a rewrite
// must not invent. Digits/drugs catch numeric and Rx hallucinations; this
// catches "examined" becoming "extracted" with no number change.
const CLINICAL_CLAIM =
  /\b(?:caries|decay|pulpitis|abscess|periodontitis|gingivitis|periapical|radiolucency|fracture|fractured|extracted|extraction|extirpation|obturation|pulpotomy|pulpectomy|crown|bridge|implant|veneer|onlay|inlay|sealant|scaling|planing|curettage|osteotomy|biopsy|sutured|suture|incision|drainage|referral|referred|diagnosis|diagnosed|irreversible|necrosis|perforat(?:ed|ion)|separated\s+instrument|file\s+separation)\b/gi;

function clinicalClaims(text: string): string[] {
  return text.match(CLINICAL_CLAIM) ?? [];
}

const QUESTION_SENTINELS = new Set([
  "no open questions.",
  "no contradictions found.",
  "no conflicts found.",
  "none."
]);

export interface VerifyOptions {
  /**
   * "rewrite": full content-preservation contract (normalize, restructure).
   * "questions": output must contain no clinical assertions at all — every
   * substantive line ends in a question mark (interrogate, conflicts).
   */
  mode: "rewrite" | "questions";
}

export function verifyMeaning(input: string, output: string, opts: VerifyOptions): VerifyResult {
  const rejections: VerifyRejection[] = [];

  if (opts.mode === "questions") {
    // A question engine must never assert. Every non-empty line is a question
    // or one of a tiny allow-list of "nothing found" sentinels — length is
    // not a loophole for short clinical recommendations.
    const lines = output
      .split("\n")
      .map((l) => l.replace(/^[\s\-*\d.)]+/, "").trim())
      .filter((l) => l.length > 0);
    const declarative = lines.filter(
      (l) => !/\?$/.test(l) && !QUESTION_SENTINELS.has(l.toLowerCase())
    );
    if (declarative.length > 0) {
      rejections.push({
        code: "not-questions",
        detail: `A question list may not assert: "${declarative[0].slice(0, 80)}"`
      });
    }
    // Questions must not smuggle in new numbers either — "was the dose
    // 500 mg?" plants a value the note never contained.
    const inDigits = new Set(digits(input));
    const newDigits = digits(output).filter((d) => !inDigits.has(d));
    if (newDigits.length > 0) {
      rejections.push({
        code: "digits-changed",
        detail: `A question introduced a number the note never contained: ${newDigits[0]}`
      });
    }
    return { ok: rejections.length === 0, rejections };
  }

  if (multiset(digits(input)) !== multiset(digits(output))) {
    rejections.push({
      code: "digits-changed",
      detail: `Input numbers [${digits(input).join(", ")}] != output numbers [${digits(output).join(", ")}]`
    });
  }

  if (multiset(negations(input)) !== multiset(negations(output))) {
    rejections.push({
      code: "negation-changed",
      detail: `Negation tokens changed: [${negations(input).join(", ")}] -> [${negations(output).join(", ")}]`
    });
  }

  if (multiset(toothLetters(input)) !== multiset(toothLetters(output))) {
    rejections.push({
      code: "teeth-changed",
      detail: "Primary-tooth letter designators changed."
    });
  }

  if (multiset(units(input)) !== multiset(units(output))) {
    rejections.push({
      code: "units-changed",
      detail: `Measurement units changed: [${units(input).join(", ")}] -> [${units(output).join(", ")}]`
    });
  }

  if (multiset(drugs(input)) !== multiset(drugs(output))) {
    rejections.push({
      code: "drugs-changed",
      detail: `Drug mentions changed: [${drugs(input).join(", ")}] -> [${drugs(output).join(", ")}]`
    });
  }

  // Attributions may be REWORDED but not reduced in count: "pt states" may
  // become "patient states", never disappear.
  if (attributions(output).length < attributions(input).length) {
    rejections.push({
      code: "attribution-dropped",
      detail:
        "A reported statement lost its attribution — a patient report must never become an asserted fact."
    });
  }

  // Content-shrink guard: a rewrite that returns much less text has dropped
  // clauses, and a dropped clause in a clinical note is a dropped fact.
  const inWords = input.split(/\s+/).filter(Boolean).length;
  const outWords = output.split(/\s+/).filter(Boolean).length;
  if (inWords >= 10 && outWords < inWords * 0.6) {
    rejections.push({
      code: "content-shrunk",
      detail: `Output has ${outWords} words for ${inWords} input words — content was dropped, not standardized.`
    });
  }

  // Invented clinical claims: the model may reword, not diagnose or invent
  // procedures. Only ADDED claims fail — dropped wording is the shrink guard's
  // job, and synonym swaps that leave the lexicon are accepted.
  const inClaims = new Set(clinicalClaims(input).map((c) => c.toLowerCase()));
  const addedClaims = [
    ...new Set(
      clinicalClaims(output)
        .map((c) => c.toLowerCase())
        .filter((c) => !inClaims.has(c))
    )
  ];
  if (addedClaims.length > 0) {
    rejections.push({
      code: "claims-added",
      detail: `Output invented clinical claims the note never contained: ${addedClaims.join(", ")}`
    });
  }

  return { ok: rejections.length === 0, rejections };
}
