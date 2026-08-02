import { requireRole } from "@/lib/auth/guards";
import { canActOn, canReceiveTransfer, canTransferNotes, ROLE_LABEL } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { getDraft, transferDraft } from "@/lib/db/repo/drafts";
import { getUserById } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("lead");
  if (!guard.ok) return guard.response;
  if (!canTransferNotes(guard.user.role)) {
    return Response.json({ error: "You cannot transfer Smile Notes." }, { status: 403 });
  }
  const { id } = await params;
  const db = await getDb();
  const draft = await getDraft(db, id);
  if (!draft) return Response.json({ error: "Draft not found." }, { status: 404 });
  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const b = parsed.value;
  const toUserId = typeof b.toUserId === "string" ? b.toUserId : "";
  const to = await getUserById(db, toUserId);
  if (!to || !to.active) {
    return Response.json({ error: "Pick an active user to transfer to." }, { status: 400 });
  }
  if (!canReceiveTransfer(to.role)) {
    return Response.json({ error: "Cannot transfer a Smile Note to a read-only user." }, { status: 400 });
  }

  // Transfer moves WRITE access, so it must respect the same ceiling every
  // other user-management action does. Without these two checks a Team Lead
  // could reassign any clinician's note — a Developer's included — to
  // themselves and then edit and file it under their own name, which is
  // exactly the "must not put words in a clinician's record" rule the
  // capability matrix exists to enforce.
  const owner = await getUserById(db, draft.ownerId);
  if (owner && !canActOn(guard.user.role, owner.role)) {
    return Response.json(
      { error: `You cannot reassign a Smile Note owned by a ${ROLE_LABEL[owner.role]}.` },
      { status: 403 }
    );
  }
  if (toUserId === guard.user.id && guard.user.role !== "admin") {
    return Response.json(
      { error: "You cannot transfer a Smile Note to yourself." },
      { status: 403 }
    );
  }
  if (toUserId === draft.ownerId) {
    return Response.json({ error: "That user already owns this draft." }, { status: 400 });
  }
  await transferDraft(db, id, toUserId, new Date());
  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: "draft.transfer",
    target: id,
    detail: `${draft.ownerId} -> ${toUserId}`
  });
  return Response.json({ ok: true });
}
