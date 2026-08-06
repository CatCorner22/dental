"use client";

import { useState } from "react";
import { BlockPicker } from "@/components/standardize/BlockPicker";

// VERIFIED BLOCKS, in the note.
//
// The picker itself is unchanged — it still refuses to insert until every
// assertion in the block has been ticked, and the text it inserts still carries
// <placeholders> that the residue rule blocks at S1 until they are replaced.
// Those three locks are the whole point of a verified block and none of them
// move.
//
// What is new is that it needs a destination. On the standardize screen there
// was one textarea and nowhere else for text to go; a note has five narrative
// fields, and dropping a consent block into whichever one happened to be first
// would be the same auto-placement mistake the paste intake exists to avoid.
const DESTINATIONS = [
  { key: "universal-core.narrative-objective", label: "What you observed and did" },
  { key: "universal-core.narrative-safety", label: "Safety and history" },
  { key: "universal-core.narrative-subjective", label: "What the patient reports" },
  { key: "universal-core.narrative-assessment", label: "Assessment" },
  { key: "universal-core.narrative-plan", label: "Plan" }
] as const;

export function BlockInsert({
  onInsert,
  lockedSections
}: {
  onInsert: (fieldKey: string, text: string) => void;
  lockedSections: ReadonlySet<string>;
}) {
  const available = DESTINATIONS.filter((d) => !lockedSections.has(d.key));
  const [target, setTarget] = useState<string>(available[0]?.key ?? DESTINATIONS[0].key);
  if (available.length === 0) return null;

  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200 shadow-sm">
      <label className="field-label" htmlFor="block-destination">
        Insert verified blocks into
      </label>
      <select
        id="block-destination"
        className="field-input max-w-sm"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      >
        {available.map((d) => (
          <option key={d.key} value={d.key}>
            {d.label}
          </option>
        ))}
      </select>
      <BlockPicker onInsert={(text) => onInsert(target, text)} />
    </div>
  );
}
