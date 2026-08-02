import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { ackNotice } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  // The one route that must work BEFORE the notice is acknowledged.
  const guard = await requireRole("readonly", { requireAck: false });
  if (!guard.ok) return guard.response;
  const db = await getDb();
  // Only the acknowledgement that actually landed is worth logging; repeat
  // calls are idempotent and must not let anyone grow the audit log at will.
  if (await ackNotice(db, guard.user.id, new Date())) {
    await logAction(db, {
      actorId: guard.user.id,
      actorName: `${guard.user.displayName} (${guard.user.username})`,
      action: "notice.ack"
    });
  }
  return Response.json({ ok: true });
}
