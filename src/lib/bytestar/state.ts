import type { Db } from "@/lib/db/client";
import { listAuditLogByAction } from "@/lib/db/repo/auditLog";
import { parseEscapeStage, isModelEscapeDetail, type ModelEscapeRow } from "./ladder";

// Deployment-wide ByteStar cage state from the transparent audit log.
// No note content — only ladder stages and perma-kill markers.

export async function isByteStarPermaKilled(db: Db): Promise<boolean> {
  const [kills, clears] = await Promise.all([
    listAuditLogByAction(db, "bytestar.perma-kill", 3),
    listAuditLogByAction(db, "bytestar.perma-clear", 3)
  ]);
  if (kills.length === 0) return false;
  const latestKill = kills[0];
  const latestClear = clears[0];
  if (latestClear && latestClear.id > latestKill.id) return false;
  return true;
}

export async function modelEscapeHistory(db: Db, limit = 50): Promise<ModelEscapeRow[]> {
  const rows = await listAuditLogByAction(db, "bytestar.escape", limit);
  return rows
    .filter((r) => isModelEscapeDetail(r.detail))
    .map((r) => ({
      atMs: r.at.getTime(),
      stage: parseEscapeStage(r.detail)
    }));
}
