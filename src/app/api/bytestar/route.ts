import { generateObject, jsonSchema } from "ai";
import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { readJsonRecord } from "@/lib/http/readJson";
import { checkThrottle, recordFailure } from "@/lib/auth/throttle";
import { logAction, listAuditLogByAction } from "@/lib/db/repo/auditLog";
import { BYTESTAR_UNAVAILABLE, getByteStarConfig } from "@/lib/bytestar/config";
import { runByteStar } from "@/lib/bytestar/service";
import { BYTESTAR_PROMPT_VERSION } from "@/lib/bytestar/prompts";
import { encodeByteStarDetail } from "@/lib/bytestar/log";
import { RULESET_VERSION } from "@/lib/version";

export const runtime = "nodejs";

const MAX_INPUT = 20000;
const FREE_RUNS = 30;
const ESCAPE_WINDOW_MS = 60 * 60 * 1000;

async function recentEscapeCount(db: Awaited<ReturnType<typeof getDb>>): Promise<number> {
  const rows = await listAuditLogByAction(db, "bytestar.escape", 50);
  const since = Date.now() - ESCAPE_WINDOW_MS;
  return rows.filter((r) => r.at.getTime() >= since).length;
}

export async function GET(): Promise<Response> {
  // Status only — Team Lead chrome and the opt-in panel ask "is the pioneer
  // door even on this deployment?" without spending a model call. Never
  // reveals whether the silent kill is the reason; callers see enabled=false.
  const config = getByteStarConfig();
  return Response.json({
    enabled: config.enabled,
    promptVersion: BYTESTAR_PROMPT_VERSION
  });
}

export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;

  const config = getByteStarConfig();
  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // Opt-in / opt-out acknowledgments — transparent, no note content. Logged
  // even when the pioneer door is closed so Team Lead can see who tried.
  const action = parsed.value.action;
  if (action === "opt-in" || action === "opt-out") {
    const db = await getDb();
    await logAction(db, {
      actorId: guard.user.id,
      actorName: `${guard.user.displayName} (${guard.user.username})`,
      action: action === "opt-in" ? "bytestar.opt-in" : "bytestar.opt-out",
      detail: encodeByteStarDetail({
        outcome: action === "opt-in" ? "opt-in" : "opt-out",
        promptVersion: BYTESTAR_PROMPT_VERSION,
        model: config.model,
        tokens: 0
      })
    });
    return Response.json({ ok: true, action });
  }

  // Bland. No mention of BYTESTAR_KILL, soft-kill, or any cage detail.
  if (!config.enabled) {
    return Response.json({ error: BYTESTAR_UNAVAILABLE, code: "unavailable" }, { status: 503 });
  }

  const raw = typeof parsed.value.text === "string" ? parsed.value.text : "";
  if (!raw.trim()) {
    return Response.json({ error: "Paste some text first." }, { status: 400 });
  }
  if (raw.length > MAX_INPUT) {
    return Response.json(
      { error: `That is longer than ${MAX_INPUT.toLocaleString()} characters. Work in sections.` },
      { status: 413 }
    );
  }

  const db = await getDb();
  const now = new Date();
  const key = `bytestar:${guard.user.id}`;
  const meter = await checkThrottle(db, key, now);
  if (meter.locked) {
    return Response.json(
      { error: `Too many ByteStar runs just now. Try again in ${meter.retryAfterSec} seconds.` },
      { status: 429, headers: { "retry-after": String(meter.retryAfterSec) } }
    );
  }
  await recordFailure(db, key, now, FREE_RUNS);

  let usedTokens = 0;
  const escapes = await recentEscapeCount(db);
  const actor = {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`
  };

  const outcome = await runByteStar(
    raw,
    async ({ system, prompt, schemaName, schema }) => {
      const res = await generateObject({
        model: config.model,
        system,
        prompt,
        schema: jsonSchema(schema),
        schemaName
      });
      usedTokens += (res.usage?.inputTokens ?? 0) + (res.usage?.outputTokens ?? 0);
      return res.object;
    },
    { config, recentEscapeCount: escapes }
  );

  const onCoursePct = outcome.benchmarks
    ? Math.round(outcome.benchmarks.onCourse * 100)
    : undefined;

  // Transparent log — every call, every outcome. Codes/versions/tokens only.
  await logAction(db, {
    ...actor,
    action: "bytestar.drift",
    detail: encodeByteStarDetail({
      outcome: outcome.ok ? "ok" : outcome.code,
      promptVersion: BYTESTAR_PROMPT_VERSION,
      model: config.model,
      tokens: usedTokens,
      kept: outcome.ok ? outcome.suggestions.length : undefined,
      refused: outcome.ok ? outcome.refused : undefined,
      onCoursePct,
      codes: outcome.codes
    })
  });

  if (!outcome.ok && outcome.code === "escape") {
    await logAction(db, {
      ...actor,
      action: "bytestar.escape",
      detail: encodeByteStarDetail({
        outcome: "escape",
        promptVersion: BYTESTAR_PROMPT_VERSION,
        model: config.model,
        tokens: usedTokens,
        codes: outcome.codes
      })
    });
  }

  if (!outcome.ok && (outcome.code === "phi-blocked" || outcome.code === "verifier-rejected")) {
    await logAction(db, {
      ...actor,
      action: "bytestar.refused",
      detail: `${outcome.code} v${BYTESTAR_PROMPT_VERSION} ruleset ${RULESET_VERSION} ${usedTokens} tokens [${outcome.codes.join(", ")}]`
    });
  }

  if (!outcome.ok) {
    const status =
      outcome.code === "unavailable" || outcome.code === "soft-killed"
        ? 503
        : outcome.code === "model-error"
          ? 502
          : 422;
    return Response.json(
      {
        error: outcome.message,
        code: outcome.code,
        // Benchmarks still travel on refusal so the drift graphics stay live
        // even when the pioneer is dark — they are local, not model output.
        benchmarks: outcome.benchmarks ?? null
      },
      { status }
    );
  }

  return Response.json({
    suggestions: outcome.suggestions,
    refused: outcome.refused,
    benchmarks: outcome.benchmarks,
    promptVersion: outcome.promptVersion
  });
}
