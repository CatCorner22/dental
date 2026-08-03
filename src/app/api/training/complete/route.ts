import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { readJsonRecord } from "@/lib/http/readJson";
import { runTextAudit } from "@/lib/audit/engine";
import { isScenarioComplete, SCENARIO_BY_ID } from "@/lib/training/scenarios";
import { awardOnce } from "@/lib/db/repo/gamify";
import { logAction } from "@/lib/db/repo/auditLog";
import { checkThrottle, recordFailure } from "@/lib/auth/throttle";

export const runtime = "nodejs";

// Completing a practice case. VERIFIED SERVER-SIDE with the same audit that
// gates real notes — a tampered client earns nothing. The repaired text is
// audited in memory and discarded, exactly like /api/standardize; the only
// thing stored is the ledger row, and the unique index makes the bounty
// once-per-scenario however many times completion is posted.
export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;
  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const scenario = SCENARIO_BY_ID.get(String(parsed.value.scenarioId ?? ""));
  const text = typeof parsed.value.text === "string" ? parsed.value.text : "";
  if (!scenario || !text.trim() || text.length > 20000) {
    return Response.json({ error: "Invalid scenario or text." }, { status: 400 });
  }

  const db = await getDb();
  const now = new Date();
  const key = `training:${guard.user.id}`;
  const meter = await checkThrottle(db, key, now);
  if (meter.locked) {
    return Response.json(
      { error: `Too many attempts just now. Try again in ${meter.retryAfterSec} seconds.` },
      { status: 429, headers: { "retry-after": String(meter.retryAfterSec) } }
    );
  }
  await recordFailure(db, key, now, 60);

  const findings = runTextAudit(text);
  if (!isScenarioComplete(findings)) {
    return Response.json({
      complete: false,
      findings: findings
        .filter((f) => f.severity === "S0" || f.severity === "S1" || f.severity === "S2")
        .map((f) => ({ ruleId: f.ruleId, severity: f.severity, message: f.message, suggestion: f.suggestion ?? null }))
    });
  }

  const paid = await awardOnce(db, {
    userId: guard.user.id,
    refType: "training",
    refId: scenario.id,
    points: scenario.bounty,
    reason: `bounty:${scenario.id}`
  });
  if (paid) {
    await logAction(db, {
      actorId: guard.user.id,
      actorName: `${guard.user.displayName} (${guard.user.username})`,
      action: "training.completed",
      target: scenario.id,
      detail: `${scenario.bounty} pt bounty`
    });
  }
  return Response.json({ complete: true, bounty: paid ? scenario.bounty : 0, alreadyEarned: !paid });
}
