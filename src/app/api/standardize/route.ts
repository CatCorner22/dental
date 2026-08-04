import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { readJsonRecord } from "@/lib/http/readJson";
import { standardize } from "@/lib/standardize/standardize";
import { structureIntoSoap } from "@/lib/standardize/structure";
import { runTextAudit } from "@/lib/audit/engine";
import { checkThrottle, recordFailure } from "@/lib/auth/throttle";

export const runtime = "nodejs";

const MAX_INPUT = 20000;
// Generous: this is a typing aid someone may run on every note of a busy day.
// The meter exists to bound a script, not to interrupt a clinician.
const FREE_RUNS = 120;

// Standardize pasted text, then audit the RESULT.
//
// Nothing is stored. The text arrives, is transformed in memory, and is
// returned — there is no row, no draft, and no log of the content. That is the
// whole privacy design of this endpoint: the safest place to put clinical prose
// is nowhere, and a tool that only reformats does not need to keep it.
export async function POST(req: Request): Promise<Response> {
  // "user" and above: a read-only account cannot author, so it has nothing to
  // standardize.
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;

  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const raw = typeof parsed.value.text === "string" ? parsed.value.text : "";
  if (!raw.trim()) {
    return Response.json({ error: "Paste some text first." }, { status: 400 });
  }
  if (raw.length > MAX_INPUT) {
    return Response.json(
      { error: `That is longer than ${MAX_INPUT.toLocaleString()} characters. Standardize it in sections.` },
      { status: 413 }
    );
  }

  const db = await getDb();
  const now = new Date();
  const key = `standardize:${guard.user.id}`;
  const meter = await checkThrottle(db, key, now);
  if (meter.locked) {
    return Response.json(
      { error: `Too many runs just now. Try again in ${meter.retryAfterSec} seconds.` },
      { status: 429, headers: { "retry-after": String(meter.retryAfterSec) } }
    );
  }
  await recordFailure(db, key, now, FREE_RUNS);

  const result = standardize(raw);

  // SOAP structuring, offered alongside the vocabulary pass rather than folded
  // into it. Two reasons it is a separate field rather than a replacement for
  // `text`: reordering is a bigger claim than substituting a word, so a person
  // chooses it by name; and the caller may be the inline builder button working on
  // ONE FIELD, where sectioning a single value would be absurd.
  //
  // Deterministic. The `soap` AI capability does the same job and needs a verifier
  // to police it, because a model can quietly reword while reorganising. This
  // cannot — it is a partition of a sentence list, and structure.test.ts asserts on
  // every case that each sentence comes out exactly once and byte-identical.
  // It therefore works with AI switched off, which is the default and what a
  // practice actually gets on day one.
  const structured = structureIntoSoap(result.text);

  // Audit the OUTPUT, not the input. The point of the pass is to hand back text
  // that is ready to paste, so the findings the user sees must be the ones that
  // survive standardization — not the ones it already fixed for them.
  const findings = runTextAudit(result.text);

  return Response.json({
    text: result.text,
    applied: result.applied,
    flags: result.flags,
    clean: result.clean,
    soap: structured.declined || structured.alreadyStructured
      ? null
      : { text: structured.text, sections: structured.sections },
    findings: findings.map((f) => ({
      ruleId: f.ruleId,
      category: f.category,
      severity: f.severity,
      message: f.message,
      matchedText: f.matchedText ?? null,
      occurrences: f.occurrences ?? 1
    }))
  });
}
