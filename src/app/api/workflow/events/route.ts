import { requireRole } from "@/lib/auth/guards";
import { canManagePracticePacks } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { listPackEvents } from "@/lib/db/repo/practicePacks";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const guard = await requireRole("lead");
  if (!guard.ok) return guard.response;
  if (!canManagePracticePacks(guard.user.role)) {
    return Response.json({ error: "Team Lead access required." }, { status: 403 });
  }
  const url = new URL(req.url);
  const packParam = url.searchParams.get("packId");
  const packId = packParam ? Number.parseInt(packParam, 10) : undefined;
  if (packParam && !Number.isInteger(packId)) {
    return Response.json({ error: "Invalid packId." }, { status: 400 });
  }
  const db = await getDb();
  const events = await listPackEvents(db, packId);
  return Response.json({ events });
}
