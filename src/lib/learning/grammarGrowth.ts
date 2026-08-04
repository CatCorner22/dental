import { classifyUnparsedClause, type UnparsedCategory } from "@/lib/extract/classifyUnparsed";
import { extractFacts } from "@/lib/extract/extract";
import type { Sighting } from "./proposals";

// GRAMMAR GROWTH QUEUE — unread phrases ranked by category, not only frequency.
//
// Feeds the same learning ledger philosophy: evidence for humans to ratify
// table/grammar changes. Never invents clinical facts.

export interface GrammarGrowthItem {
  category: UnparsedCategory;
  /** Representative phrase (truncated). */
  sample: string;
  occurrences: number;
  notes: number;
  authors: number;
  /** Why teaching this shape would help. */
  effect: string;
}

const EFFECT: Record<UnparsedCategory, string> = {
  medication:
    "Teaching this shape would let the parser read drug/dose lines that currently stay unread.",
  procedure: "Teaching this shape would put more procedure acts on the chart readback.",
  finding: "Teaching this shape would capture findings that currently leave gaps on the chart.",
  imaging: "Teaching this shape would attach imaging phrases to the radiograph record rules.",
  "consent-or-instructions":
    "Teaching this shape would surface consent/instruction gaps Byte already coaches.",
  measurement: "Teaching this shape would capture mm/BP-style measurements the grammar misses.",
  other: "Teaching this shape would shrink the residual unread pile."
};

/**
 * Rank unread clause categories across filed notes for the grammar growth queue.
 * Authors threshold mirrors vocabulary proposals: one person's noise is not jargon.
 */
export function grammarGrowthFromNotes(sightings: Sighting[], limit = 12): GrammarGrowthItem[] {
  const buckets = new Map<
    UnparsedCategory,
    { samples: string[]; notes: Set<number>; authors: Set<string>; occurrences: number }
  >();

  sightings.forEach((s, noteIndex) => {
    const { unparsed } = extractFacts(s.text);
    const seenInNote = new Set<UnparsedCategory>();
    for (const span of unparsed) {
      const phrase = s.text.slice(span.start, span.end).trim();
      if (!phrase) continue;
      const { category } = classifyUnparsedClause(phrase);
      const bucket = buckets.get(category) ?? {
        samples: [],
        notes: new Set<number>(),
        authors: new Set<string>(),
        occurrences: 0
      };
      bucket.occurrences += 1;
      bucket.authors.add(s.authorId);
      if (!seenInNote.has(category)) {
        bucket.notes.add(noteIndex);
        seenInNote.add(category);
      }
      if (bucket.samples.length < 3 && !bucket.samples.includes(phrase.slice(0, 80))) {
        bucket.samples.push(phrase.slice(0, 80));
      }
      buckets.set(category, bucket);
    }
  });

  const items: GrammarGrowthItem[] = [];
  for (const [category, b] of buckets) {
    if (b.authors.size < 2 || b.notes.size < 3 || b.occurrences < 5) continue;
    items.push({
      category,
      sample: b.samples[0] ?? category,
      occurrences: b.occurrences,
      notes: b.notes.size,
      authors: b.authors.size,
      effect: EFFECT[category]
    });
  }

  items.sort(
    (a, b) =>
      b.authors - a.authors || b.notes - a.notes || b.occurrences - a.occurrences || a.category.localeCompare(b.category)
  );
  return items.slice(0, limit);
}
