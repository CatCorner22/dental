import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { decideRedemption } from "@/lib/db/repo/gamify";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";
import { sanitizeIdentity } from "@/lib/text/sanitizeIdentity";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// Deciding a redemption — Team Lead and above. Approval is one click;
// declining requires a note back to the named person who asked (the wish-
// list rule, for the same reason), and the refund happens by APPENDING a
// ledger row in the same transaction.
export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("lead");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const numericId = Number.parseInt(id, 10);
  if (!Number.isInteger(numericId)) {
    return Response.json({ error: "Invalid id." }, { status: 400 });
  }
  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object" || typeof parsed.value.approve !== "boolean") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const note =
    typeof parsed.value.note === "string" ? sanitizeIdentity(parsed.value.note).slice(0, 500) : "";
  const db = await getDb();
  const result = await decideRedemption(db, {
    id: numericId,
    approve: parsed.value.approve,
    decidedByName: `${guard.user.displayName} (${guard.user.username})`,
    note
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: parsed.value.approve ? "store.redeem-approved" : "store.redeem-declined",
    target: String(numericId),
    detail: note || null
  });
  return Response.json({ ok: true });
}
