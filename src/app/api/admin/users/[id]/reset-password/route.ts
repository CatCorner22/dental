import { requireRole } from "@/lib/auth/guards";
import { setPasswordAndRevokeLinks } from "@/lib/db/repo/resetTokens";
import { canSetPasswordDirectly } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { getUserById } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";
import { hashPassword, passwordPolicyError } from "@/lib/auth/password";
import { clearThrottle, passwordCheckKey } from "@/lib/auth/throttle";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("admin");
  if (!guard.ok) return guard.response;
  // Belt and braces: the ladder already stops anyone below Developer, but this
  // states the rule the hierarchy actually cares about — Team Leads and
  // Hierarchy Managers reset ONLY by emailed link and must never learn a
  // credential. Use POST /api/admin/users/[id]/reset-link instead.
  if (!canSetPasswordDirectly(guard.user.role)) {
    return Response.json(
      { error: "Only a Smile Notes Developer can set a password directly. Send a reset link instead." },
      { status: 403 }
    );
  }
  const { id } = await params;
  const db = await getDb();
  const target = await getUserById(db, id);
  if (!target) return Response.json({ error: "Not found." }, { status: 404 });
  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const b = parsed.value;
  const password = typeof b.password === "string" ? b.password : "";
  const pwError = passwordPolicyError(password);
  if (pwError) return Response.json({ error: pwError }, { status: 400 });
  // passwordChangedAt revokes every session minted before this instant —
  // resetting a possibly-compromised account must cut off the old cookie,
  // not just change what the attacker's NEXT login would need.
  await setPasswordAndRevokeLinks(db, id, await hashPassword(password), new Date());
  // Clear this user's change-password throttle so they can immediately set a
  // new password after the reset. Login itself is throttled by IP now, not by
  // account, so there is no per-user login lock for an admin to release — a
  // locked IP self-expires and never traps a specific person.
  await clearThrottle(db, passwordCheckKey(target.id));
  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: "user.reset-password",
    target: target.username
  });
  return Response.json({ ok: true });
}
