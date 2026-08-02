import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getUserById, updateUser } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export const runtime = "nodejs";

// Any signed-in user (including read-only) may change their own password.
export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole("readonly");
  if (!guard.ok) return guard.response;
  let b: Record<string, unknown> = {};
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const current = typeof b.current === "string" ? b.current : "";
  const next = typeof b.next === "string" ? b.next : "";
  if (next.length < 10) {
    return Response.json({ error: "New password must be at least 10 characters." }, { status: 400 });
  }
  const db = await getDb();
  const user = await getUserById(db, guard.user.id);
  if (!user) return Response.json({ error: "Not found." }, { status: 404 });
  if (!(await verifyPassword(current, user.passHash))) {
    return Response.json({ error: "Your current password is wrong." }, { status: 403 });
  }
  await updateUser(db, user.id, { passHash: await hashPassword(next) });
  await logAction(db, { actorId: user.id, action: "user.self-password" });
  return Response.json({ ok: true });
}
