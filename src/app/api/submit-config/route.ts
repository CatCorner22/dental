import { requireRole } from "@/lib/auth/guards";
import { getEmailConfig } from "@/lib/email/config";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;
  return Response.json({ emailConfigured: getEmailConfig().configured });
}
