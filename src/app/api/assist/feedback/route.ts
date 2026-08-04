import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";

export const runtime = "nodejs";

// The human half of the extraction-precision loop, as a COUNT-ONLY beacon.
//
// The verifier's refusal rate says what share of the model's proposals could
// not be pinned to evidence. This says what happened to the survivors: a
// clinician either added a pinned fact to a note or did not, and that decision
// is the only precision measurement a zero-persistence design can have —
// there is no stored corpus to sample later, ON PURPOSE.
//
// Nothing about the fact travels here. Not the statement, not the quote, not
// the kind. One decision word, logged as one audit row, aggregated by the
// drift monitor into an acceptance rate. A beacon that carried content would
// be the least-protected copy of the clinical record within a month.
export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;

  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const decision = parsed.value.decision;
  if (decision !== "accepted") {
    // The only decision worth a row today. The enum is checked server-side so
    // a client cannot invent decision kinds that skew the denominator.
    return Response.json({ error: "Unknown decision." }, { status: 400 });
  }

  const db = await getDb();
  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: "assist.fact-decision",
    target: null,
    detail: "extract accepted"
  });
  return Response.json({ ok: true });
}
