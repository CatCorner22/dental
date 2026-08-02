import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getUserByUsername, insertUser, listUsers } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";
import { hashPassword, passwordPolicyError } from "@/lib/auth/password";
import { sanitizeIdentity } from "@/lib/text/sanitizeIdentity";
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
  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const b = parsed.value;
  const username = typeof b.username === "string" ? b.username.trim() : "";
  const cleanName = typeof b.displayName === "string" ? sanitizeIdentity(b.displayName) : "";
  const displayName = cleanName || username;
  const password = typeof b.password === "string" ? b.password : "";
  const role = ROLES.includes(b.role as Role) ? (b.role as Role) : "user";
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/i.test(username)) {
    return Response.json({ error: "Username must be 3-40 letters, digits, or . _ -" }, { status: 400 });
  }
  const pwError = passwordPolicyError(password);
  if (pwError) return Response.json({ error: pwError }, { status: 400 });
  const db = await getDb();
  // Stored lowercase so "Nurse" and "nurse" can never be two people; the
  // unique-constraint catch turns a lost race into a clean 409, not a 500.
  const uname = username.toLowerCase();
  if (await getUserByUsername(db, uname)) {
    return Response.json({ error: "That username is taken." }, { status: 409 });
  }
  let created;
  try {
    created = await insertUser(db, {
      id: crypto.randomUUID(),
      username: uname,
      displayName,
      role,
      passHash: await hashPassword(password),
      active: true
    });
  } catch {
    return Response.json({ error: "That username is taken." }, { status: 409 });
  }
  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: "user.create",
    target: uname,
    detail: role
  });
  return Response.json({ id: created.id }, { status: 201 });
}
