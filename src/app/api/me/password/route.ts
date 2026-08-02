import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getUserById, updateUser } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export const runtime = "nodejs";

// Any signed-in user (including read-only) may change their own password.
export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole("readonly");
  if (!guard.ok) return guard.response;
  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const b = parsed.value;
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
  // Revokes every session minted before this instant — including this one.
  // Changing your password after a compromise must sign the attacker out,
  // and "signs you out everywhere" is the honest, expected trade.
  await updateUser(db, user.id, { passHash: await hashPassword(next), passwordChangedAt: new Date() });
  await logAction(db, {
    actorId: user.id,
    actorName: `${user.displayName} (${user.username})`,
    action: "user.self-password"
  });
  return Response.json({ ok: true, reauth: true });
}
