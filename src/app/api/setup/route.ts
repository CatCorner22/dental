import { getDb } from "@/lib/db/client";
import { countUsers, createFirstAdminGuarded } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";
import { hashPassword } from "@/lib/auth/password";

export const runtime = "nodejs";

// Bootstrap the first admin — allowed ONLY while the users table is empty.
export async function POST(req: Request): Promise<Response> {
  const db = await getDb();
  if ((await countUsers(db)) > 0) {
    return Response.json({ error: "Setup is already complete." }, { status: 409 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const username = typeof b.username === "string" ? b.username.trim() : "";
  const displayName = typeof b.displayName === "string" && b.displayName.trim() ? b.displayName.trim() : username;
  const password = typeof b.password === "string" ? b.password : "";
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/i.test(username)) {
    return Response.json({ error: "Username must be 3-40 letters, digits, or . _ -" }, { status: 400 });
  }
  if (password.length < 10) {
    return Response.json({ error: "Password must be at least 10 characters." }, { status: 400 });
  }
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
