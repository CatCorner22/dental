import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getDraft, transferDraft } from "@/lib/db/repo/drafts";
import { getUserById } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("admin");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const db = await getDb();
  const draft = await getDraft(db, id);
  if (!draft) return Response.json({ error: "Draft not found." }, { status: 404 });
  let b: Record<string, unknown> = {};
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const toUserId = typeof b.toUserId === "string" ? b.toUserId : "";
  const to = await getUserById(db, toUserId);
  if (!to || !to.active) {
    return Response.json({ error: "Pick an active user to transfer to." }, { status: 400 });
  }
  if (to.role === "readonly") {
    return Response.json({ error: "Cannot transfer a draft to a read-only user." }, { status: 400 });
  }
  await transferDraft(db, id, toUserId, new Date());
  await logAction(db, {
    actorId: guard.user.id,
    action: "draft.transfer",
    target: id,
    detail: `${draft.ownerId} -> ${toUserId}`
  });
  return Response.json({ ok: true });
}
