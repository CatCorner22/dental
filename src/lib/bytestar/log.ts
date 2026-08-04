// TRANSPARENT BYTESTAR LOGS — identifiers, codes, versions, tokens only.
// Never note text, never suggestion prose, never evidence quotes. The same
// privacy contract as assist.drift: a log that becomes a second copy of the
// clinical record is a log that failed its job.

export type ByteStarLogOutcome =
  | "ok"
  | "unavailable"
  | "perma-killed"
  | "perma-kill"
  | "perma-clear"
  | "phi-blocked"
  | "escape"
  | "escape-input"
  | "escape-model"
  | "verifier-rejected"
  | "model-error"
  | "invalid-shape";

export interface ByteStarLogEvent {
  outcome: ByteStarLogOutcome;
  promptVersion: string;
  model: string;
  tokens: number;
  /** Kept / refused suggestion counts on ok path. */
  kept?: number;
  refused?: number;
  /** Machine-readable codes (escape signals, verifier codes, phi rule ids). */
  codes?: string[];
  /** Benchmark on-course share, 0..100 integer, when measured. */
  onCoursePct?: number;
}

export function encodeByteStarDetail(e: ByteStarLogEvent): string {
  const parts = [
    e.outcome,
    `prompt=${e.promptVersion}`,
    `model=${e.model}`,
    `tokens=${e.tokens}`
  ];
  if (e.kept !== undefined) parts.push(`kept=${e.kept}`);
  if (e.refused !== undefined) parts.push(`refused=${e.refused}`);
  if (e.onCoursePct !== undefined) parts.push(`onCourse=${e.onCoursePct}`);
  if (e.codes?.length) parts.push(`codes=${e.codes.join("+")}`);
  return parts.join(" ");
}

export function decodeByteStarDetail(detail: string): Partial<ByteStarLogEvent> | null {
  if (!detail) return null;
  const tokens = detail.split(/\s+/);
  const outcome = tokens[0] as ByteStarLogOutcome;
  const out: Partial<ByteStarLogEvent> = { outcome };
  for (const t of tokens.slice(1)) {
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq);
    const v = t.slice(eq + 1);
    if (k === "prompt") out.promptVersion = v;
    else if (k === "model") out.model = v;
    else if (k === "tokens") out.tokens = Number(v) || 0;
    else if (k === "kept") out.kept = Number(v) || 0;
    else if (k === "refused") out.refused = Number(v) || 0;
    else if (k === "onCourse") out.onCoursePct = Number(v) || 0;
    else if (k === "codes") out.codes = v.split("+").filter(Boolean);
  }
  return out;
}
