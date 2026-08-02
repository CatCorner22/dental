import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getUserById, updateUser } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";
import { hashPassword } from "@/lib/auth/password";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("admin");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const db = await getDb();
  const target = await getUserById(db, id);
  if (!target) return Response.json({ error: "Not found." }, { status: 404 });
  let b: Record<string, unknown> = {};
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const password = typeof b.password === "string" ? b.password : "";
  if (password.length < 10) {
    return Response.json({ error: "Password must be at least 10 characters." }, { status: 400 });
  }
  await updateUser(db, id, { passHash: await hashPassword(password) });
  await logAction(db, { actorId: guard.user.id, action: "user.reset-password", target: target.username });
  return Response.json({ ok: true });
}
