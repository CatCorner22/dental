import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getWish, updateWishStatus } from "@/lib/db/repo/wishes";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";
import { sanitizeMultiline } from "@/lib/text/sanitizeMultiline";
import { canManageUsers } from "@/lib/auth/roles";
import { isWishStatus, WISH_NOTE_MAX } from "@/lib/wishes/wishes";
import { parseRowId } from "@/lib/db/int4";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// Moving a wish through its statuses is a Team Lead job — the same people who
// can act on a supply request or escalate a standards concern.
export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("lead");
  if (!guard.ok) return guard.response;
  if (!canManageUsers(guard.user.role)) {
    return Response.json({ error: "You cannot change a wish's status." }, { status: 403 });
  }
  const { id } = await params;
  const numId = parseRowId(id);
  if (numId === null) return Response.json({ error: "Not found." }, { status: 404 });

  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const b = parsed.value;
  if (!isWishStatus(b.status)) {
    return Response.json({ error: "Unknown status." }, { status: 400 });
  }
  const note = typeof b.note === "string" ? sanitizeMultiline(b.note, WISH_NOTE_MAX) : "";

  // "Not doing this" always carries a reason. The author is named, so they are
  // owed one — and a wish list where things die silently stops being used
  // within a month.
  if (b.status === "declined" && !note.trim()) {
    return Response.json(
      { error: "Say why. The person who raised this is named and deserves an answer." },
      { status: 422 }
    );
  }

  const db = await getDb();
  const existing = await getWish(db, numId);
  if (!existing) return Response.json({ error: "Not found." }, { status: 404 });

  await updateWishStatus(db, numId, {
    status: b.status,
    decidedByName: `${guard.user.displayName} (${guard.user.username})`,
    decidedNote: note || null,
    updatedAt: new Date()
  });

  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: "wish.status",
    target: String(numId),
    detail: `${existing.status} -> ${b.status}`
  });

  return Response.json({ ok: true });
}
