import { getDb } from "@/lib/db/client";
import { countUsers, getUserByUsername, insertUser } from "@/lib/db/repo/users";
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
  if (await getUserByUsername(db, username)) {
    return Response.json({ error: "That username is taken." }, { status: 409 });
  }
  await insertUser(db, {
    id: crypto.randomUUID(),
    username,
    displayName,
    role: "admin",
    passHash: await hashPassword(password),
    active: true
  });
  await logAction(db, { actorId: null, action: "setup.first-admin", target: username });
  return Response.json({ ok: true }, { status: 201 });
}
