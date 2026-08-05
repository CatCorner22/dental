import { getDb } from "@/lib/db/client";
import { countUsers, createFirstAdminGuarded } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";
import { hashPassword, passwordPolicyError } from "@/lib/auth/password";
import { usernamePolicyError } from "@/lib/auth/username";
import { sanitizeIdentity } from "@/lib/text/sanitizeIdentity";

export const runtime = "nodejs";

// Bootstrap the first admin — allowed ONLY while the users table is empty.
export async function POST(req: Request): Promise<Response> {
  const db = await getDb();
  if ((await countUsers(db)) > 0) {
    return Response.json({ error: "Setup is already complete." }, { status: 409 });
  }
  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const b = parsed.value;
  const username = typeof b.username === "string" ? b.username.trim() : "";
  const cleanName = typeof b.displayName === "string" ? sanitizeIdentity(b.displayName) : "";
  const displayName = cleanName || username;
  const password = typeof b.password === "string" ? b.password : "";
  const userError = usernamePolicyError(username);
  if (userError) return Response.json({ error: userError }, { status: 400 });
  const pwError = passwordPolicyError(password);
  if (pwError) return Response.json({ error: pwError }, { status: 400 });
  // Atomic: the count re-check and the insert share one serialized
  // transaction, so two concurrent setups can never both become admin.
  // Usernames are stored lowercase so "Admin" and "admin" can never be
  // two different people in the audit log.
  const outcome = await createFirstAdminGuarded(db, {
    id: crypto.randomUUID(),
    username: username.toLowerCase(),
    displayName,
    role: "admin",
    passHash: await hashPassword(password),
    active: true
  });
  if (outcome === "exists") {
    return Response.json({ error: "Setup is already complete." }, { status: 409 });
  }
  await logAction(db, { actorId: null, action: "setup.first-admin", target: username.toLowerCase() });
  return Response.json({ ok: true }, { status: 201 });
}
