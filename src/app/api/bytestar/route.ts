import { generateObject, jsonSchema } from "ai";
import { requireRole } from "@/lib/auth/guards";
import { meetsRole } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { readJsonRecord } from "@/lib/http/readJson";
import { checkThrottle, recordFailure } from "@/lib/auth/throttle";
import { logAction } from "@/lib/db/repo/auditLog";
import { BYTESTAR_UNAVAILABLE, getByteStarConfig } from "@/lib/bytestar/config";
import { MODEL_ESCAPE_ORIGIN } from "@/lib/bytestar/escape";
import { ladderStageForEscape } from "@/lib/bytestar/ladder";
import { encodeByteStarDetail } from "@/lib/bytestar/log";
import { BYTESTAR_PROMPT_VERSION } from "@/lib/bytestar/prompts";
import { toObservationalSuggestion } from "@/lib/bytestar/public";
import { resolveReads, runByteStar } from "@/lib/bytestar/service";
import { runCanary } from "@/lib/bytestar/canary";
import { isByteStarPermaKilled, modelEscapeHistory } from "@/lib/bytestar/state";
import { isForbiddenUserAction } from "@/lib/bytestar/one-way";
import { RULESET_VERSION } from "@/lib/version";

export const runtime = "nodejs";

const MAX_INPUT = 20000;
/** Auto-observe cadence is debounced client-side; cap server runs per user. */
const FREE_RUNS = 60;

export async function GET(): Promise<Response> {
  const config = getByteStarConfig();
  const db = await getDb();
  const perma = await isByteStarPermaKilled(db);
  return Response.json({
    enabled: config.enabled && !perma,
    promptVersion: BYTESTAR_PROMPT_VERSION,
    mode: "observe-only"
  });
}

export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;

  const config = getByteStarConfig();
  const db = await getDb();
  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const action = parsed.value.action;

  if (isForbiddenUserAction(action)) {
    return Response.json({ error: BYTESTAR_UNAVAILABLE }, { status: 403 });
  }

  // Team Lead may clear a ladder perma-kill after review — cage maintenance,
  // not feedback to the model.
  if (action === "perma-clear") {
    if (!meetsRole(guard.user.role, "lead")) {
      return Response.json({ error: "Team Lead access required." }, { status: 403 });
    }
    await logAction(db, {
      actorId: guard.user.id,
      actorName: `${guard.user.displayName} (${guard.user.username})`,
      action: "bytestar.perma-clear",
      detail: encodeByteStarDetail({
        outcome: "perma-clear",
        promptVersion: BYTESTAR_PROMPT_VERSION,
        model: config.model,
        tokens: 0
      })
    });
    return Response.json({ ok: true, action: "perma-clear" });
  }

  const permaKilled = await isByteStarPermaKilled(db);
  if (!config.enabled || permaKilled) {
    return Response.json({ error: BYTESTAR_UNAVAILABLE, code: "unavailable" }, { status: 503 });
  }

  // Team Lead may run the frozen canary eval against the live model. The
  // result is a rail-survival report — a drift detector with a denominator —
  // logged as one transparent bytestar.eval row (pass count, yield, codes).
  if (action === "run-eval") {
    if (!meetsRole(guard.user.role, "lead")) {
      return Response.json({ error: "Team Lead access required." }, { status: 403 });
    }
    let evalTokens = 0;
    const report = await runCanary(
      async ({ system, prompt, schemaName, schema }) => {
        const res = await generateObject({
          model: config.model,
          system,
          prompt,
          schema: jsonSchema(schema),
          schemaName
        });
        evalTokens += (res.usage?.inputTokens ?? 0) + (res.usage?.outputTokens ?? 0);
        return res.object;
      },
      { config }
    );
    await logAction(db, {
      actorId: guard.user.id,
      actorName: `${guard.user.displayName} (${guard.user.username})`,
      action: "bytestar.eval",
      detail: `${encodeByteStarDetail({
        outcome: report.passed === report.total ? "ok" : "verifier-rejected",
        promptVersion: BYTESTAR_PROMPT_VERSION,
        model: config.model,
        tokens: evalTokens,
        kept: report.keptTotal,
        refused: report.refusedTotal
      })} pass=${report.passed}/${report.total}`
    });
    return Response.json({ report });
  }

  const raw = typeof parsed.value.text === "string" ? parsed.value.text : "";
  if (!raw.trim()) {
    return Response.json({ benchmarks: null, observations: [] });
  }
  if (raw.length > MAX_INPUT) {
    return Response.json(
      { error: `That is longer than ${MAX_INPUT.toLocaleString()} characters.` },
      { status: 413 }
    );
  }

  const now = new Date();
  const key = `bytestar:${guard.user.id}`;
  const meter = await checkThrottle(db, key, now);
  if (meter.locked) {
    return Response.json(
      { error: BYTESTAR_UNAVAILABLE, benchmarks: null, observations: [] },
      { status: 429, headers: { "retry-after": String(meter.retryAfterSec) } }
    );
  }
  await recordFailure(db, key, now, FREE_RUNS);

  let usedTokens = 0;
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
    { config, permaKilled, reads: resolveReads() }
  );

  const onCoursePct = outcome.benchmarks
    ? Math.round(outcome.benchmarks.onCourse * 100)
    : undefined;

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
      codes: outcome.codes,
      sources: outcome.ok ? outcome.retrievedSources : undefined
    })
  });

  if (!outcome.ok && outcome.code === "escape-model") {
    const prior = await modelEscapeHistory(db);
    const stage = ladderStageForEscape(prior, now.getTime());
    await logAction(db, {
      ...actor,
      action: "bytestar.escape",
      detail: `${encodeByteStarDetail({
        outcome: "escape",
        promptVersion: BYTESTAR_PROMPT_VERSION,
        model: config.model,
        tokens: usedTokens,
        codes: outcome.codes
      })} ${MODEL_ESCAPE_ORIGIN} stage=${stage}`
    });
    if (stage === "perma-kill") {
      await logAction(db, {
        actorId: null,
        actorName: "ByteStar ladder",
        action: "bytestar.perma-kill",
        detail: encodeByteStarDetail({
          outcome: "perma-kill",
          promptVersion: BYTESTAR_PROMPT_VERSION,
          model: config.model,
          tokens: 0,
          codes: outcome.codes
        })
      });
    }
  }

  if (!outcome.ok && (outcome.code === "phi-blocked" || outcome.code === "verifier-rejected")) {
    await logAction(db, {
      ...actor,
      action: "bytestar.refused",
      detail: `${outcome.code} v${BYTESTAR_PROMPT_VERSION} ruleset ${RULESET_VERSION} ${usedTokens} tokens [${outcome.codes.join(", ")}]`
    });
  }

  const benchmarks = outcome.benchmarks ?? null;

  if (!outcome.ok) {
    return Response.json({
      observations: [],
      benchmarks,
      unavailable: true
    });
  }

  return Response.json({
    observations: outcome.suggestions.map(toObservationalSuggestion),
    benchmarks,
    promptVersion: outcome.promptVersion,
    unavailable: false
  });
}
