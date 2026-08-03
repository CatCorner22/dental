// Implausible quantities in free text.
//
// The structured measurement rule only guards fields that use the measurement
// picker. Everything typed as prose — which is most of a note — had no sanity
// check at all, so "prescribed 1 ton of amoxicillin" or "irrigated with 5
// gallons of saline" passed straight through.
//
// THE HARD BOUNDARY THIS MODULE RESPECTS: it never computes, converts, or
// suggests a dose. It says "that number cannot be right, look at it" and stops.
// It does not say "did you mean 500 mg", because the moment a documentation
// tool proposes a dose it has become a clinical decision-support system, and
// that is a different product with a different regulatory posture. The app's
// safety boundary is explicit about this and it is not negotiable for a typo
// checker.
//
// So every finding here is a QUESTION for the clinician, never an answer.
//
// The bounds are deliberately far outside anything real. This is a
// missing-decimal / wrong-unit / extra-zero detector, not a formulary. A bound
// tight enough to catch a genuinely wrong-but-believable dose would also fire
// on legitimate outliers, and a checker that cries wolf gets ignored — which
// costs more safety than it buys.

export interface ImplausibleQuantity {
  /** The text as written, e.g. "1 ton". */
  matched: string;
  /** Why it cannot be right. Never contains a proposed correct value. */
  reason: string;
  count: number;
}

// Units that are never a sensible quantity in a dental note at ANY magnitude.
// A dental operatory does not measure in tons or gallons.
const NEVER_UNITS: { re: RegExp; label: string }[] = [
  { re: /\btons?\b|\btonnes?\b/i, label: "tons" },
  { re: /\bgallons?\b/i, label: "gallons" },
  { re: /\bquarts?\b/i, label: "quarts" },
  { re: /\bpints?\b/i, label: "pints" },
  { re: /\bstones?\b(?!\s*(?:formation|removal))/i, label: "stones" },
  { re: /\bbarrels?\b/i, label: "barrels" }
];

// Magnitude ceilings for units that ARE legitimate. Set far above any real
// value — these catch a missing decimal point or a stray zero, nothing subtler.
const CEILINGS: { unit: string; re: RegExp; max: number; why: string }[] = [
  { unit: "mg", re: /\bmg\b/i, max: 10_000, why: "that is more than ten grams of drug" },
  { unit: "g", re: /\bg(?:rams?)?\b/i, max: 100, why: "that is more than a hundred grams of drug" },
  { unit: "mcg", re: /\bmcg\b|\bµg\b/i, max: 100_000, why: "that is more than a tenth of a gram" },
  { unit: "mL", re: /\bml\b/i, max: 2_000, why: "that is more than two litres" },
  { unit: "L", re: /\bl(?:it(?:re|er)s?)?\b/i, max: 10, why: "that is more than ten litres" },
  // Nothing in a mouth is measured in hundreds of millimetres.
  { unit: "mm", re: /\bmm\b/i, max: 200, why: "nothing in the oral cavity is that large" },
  { unit: "cm", re: /\bcm\b/i, max: 30, why: "nothing in the oral cavity is that large" },
  { unit: "carpules", re: /\bcarpules?\b/i, max: 20, why: "that is far more anesthetic than any single visit uses" },
  { unit: "kg", re: /\bkg\b/i, max: 400, why: "that is not a plausible body weight" },
  { unit: "lb", re: /\blbs?\b|\bpounds?\b/i, max: 900, why: "that is not a plausible body weight" }
];

// A percentage over 100 is arithmetically impossible, not merely unlikely.
const PERCENT = /(\d+(?:\.\d+)?)\s*%/g;

// number (with optional decimal and thousands separators) followed by a unit
// word within a couple of characters.
const NUM_UNIT = /(\d[\d,]*(?:\.\d+)?)\s{0,3}([A-Za-zµ°/]+)/g;

function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

function bump(list: ImplausibleQuantity[], item: ImplausibleQuantity): void {
  const found = list.find((x) => x.matched.toLowerCase() === item.matched.toLowerCase());
  if (found) found.count += item.count;
  else list.push(item);
}

export function findImplausibleQuantities(text: string): ImplausibleQuantity[] {
  const out: ImplausibleQuantity[] = [];
  if (typeof text !== "string" || !text) return out;

  for (const m of text.matchAll(NUM_UNIT)) {
    const [whole, numRaw, unitRaw] = m;
    const n = toNumber(numRaw);
    if (!Number.isFinite(n)) continue;

    // Units that are wrong at any size.
    const never = NEVER_UNITS.find((u) => u.re.test(unitRaw));
    if (never) {
      bump(out, {
        matched: whole.trim(),
        reason: `A dental note is never measured in ${never.label}. Check the number and the unit — this tool will not guess what was meant.`,
        count: 1
      });
      continue;
    }

    // Legitimate units at an impossible magnitude.
    // Longest unit token first so "mL" is not matched by the "L" pattern.
    const ceiling = [...CEILINGS]
      .sort((a, b) => b.unit.length - a.unit.length)
      .find((c) => c.re.test(unitRaw) && unitRaw.length <= c.unit.length + 6);
    if (ceiling && n > ceiling.max) {
      bump(out, {
        matched: whole.trim(),
        reason: `${whole.trim()} is not a plausible quantity — ${ceiling.why}. Check for a missing decimal point or an extra zero. This tool will not guess the intended value.`,
        count: 1
      });
    }
  }

  for (const m of text.matchAll(PERCENT)) {
    const n = toNumber(m[1]);
    if (n > 100) {
      bump(out, {
        matched: m[0].trim(),
        reason: `${m[0].trim()} is impossible — a percentage cannot exceed 100. Check the number.`,
        count: 1
      });
    }
  }

  return out;
}
