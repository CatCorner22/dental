import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { parseRowId } from "@/lib/db/int4";
import { deleteUserBlock } from "@/lib/db/repo/userBlocks";

export const runtime = "nodejs";

// Delete ONE of the caller's own blocks. The repo query is owner-scoped, so
// aiming this at someone else's id deletes nothing and reports not-found.

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const numId = parseRowId(id);
  if (numId === null) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  const db = await getDb();
  const deleted = await deleteUserBlock(db, guard.user.id, numId);
  if (!deleted) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
