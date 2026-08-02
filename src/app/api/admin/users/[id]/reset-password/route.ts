import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getUserById, updateUser } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";
import { hashPassword, passwordPolicyError } from "@/lib/auth/password";
import { clearThrottle, loginKey, passwordCheckKey } from "@/lib/auth/throttle";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("admin");
  if (!guard.ok) return guard.response;
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
  await updateUser(db, id, { passHash: await hashPassword(password), passwordChangedAt: new Date() });
  // Clear both throttles for this account. Per-username lockout means a
  // determined attacker can keep someone locked out by failing on purpose;
  // this is the escape hatch — an admin reset gets them back in immediately
  // instead of making them wait out someone else's guessing.
  await clearThrottle(db, loginKey(target.username));
  await clearThrottle(db, passwordCheckKey(target.id));
  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: "user.reset-password",
    target: target.username
  });
  return Response.json({ ok: true });
}
