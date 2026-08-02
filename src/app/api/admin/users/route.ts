import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getUserByUsername, insertUser, listUsers } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";
import { hashPassword } from "@/lib/auth/password";
import type { Role } from "@/lib/auth/roles";

export const runtime = "nodejs";

const ROLES: Role[] = ["readonly", "user", "admin"];

export async function GET(): Promise<Response> {
  const guard = await requireRole("admin");
  if (!guard.ok) return guard.response;
  const db = await getDb();
  const users = await listUsers(db);
  return Response.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      active: u.active,
      createdAt: u.createdAt
    }))
  });
}

export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole("admin");
  if (!guard.ok) return guard.response;
  let b: Record<string, unknown> = {};
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const username = typeof b.username === "string" ? b.username.trim() : "";
  const displayName = typeof b.displayName === "string" && b.displayName.trim() ? b.displayName.trim() : username;
  const password = typeof b.password === "string" ? b.password : "";
  const role = ROLES.includes(b.role as Role) ? (b.role as Role) : "user";
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/i.test(username)) {
    return Response.json({ error: "Username must be 3-40 letters, digits, or . _ -" }, { status: 400 });
  }
  if (password.length < 10) {
    return Response.json({ error: "Password must be at least 10 characters." }, { status: 400 });
  }
  const db = await getDb();
  if (await getUserByUsername(db, username)) {
    return Response.json({ error: "That username is taken." }, { status: 409 });
  }
  const created = await insertUser(db, {
    id: crypto.randomUUID(),
    username,
    displayName,
    role,
    passHash: await hashPassword(password),
    active: true
  });
  await logAction(db, { actorId: guard.user.id, action: "user.create", target: username, detail: role });
  return Response.json({ id: created.id }, { status: 201 });
}
