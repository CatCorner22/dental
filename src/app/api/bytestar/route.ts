import { generateObject, jsonSchema } from "ai";
import { requireRole } from "@/lib/auth/guards";
import { meetsRole } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { readJsonRecord } from "@/lib/http/readJson";
import { checkThrottle, recordFailure } from "@/lib/auth/throttle";
import { logAction } from "@/lib/db/repo/auditLog";
import { runPhiRule } from "@/lib/audit/rules/phi";
import { scanPhiForProvider } from "@/lib/audit/rules/phi-secondary";
import { BYTESTAR_UNAVAILABLE, getByteStarConfig } from "@/lib/bytestar/config";
import { detectEscape, MODEL_ESCAPE_ORIGIN } from "@/lib/bytestar/escape";
import { measureBenchmarks } from "@/lib/bytestar/benchmarks";
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
/** Vercel: hard stop hung provider calls before they pin concurrency. */
export const maxDuration = 30;

const MAX_INPUT = 20000;
/** Auto-observe cadence is debounced client-side; cap server runs per user. */
const FREE_RUNS = 60;
/** Provider call budget — shorter than maxDuration so the route can log and return. */
const PROVIDER_TIMEOUT_MS = 20_000;

export async function GET(): Promise<Response> {
  // Signed-in only, like every other route here. This handler shipped with no
  // guard: the POST beside it checks, but the GET did not, and middleware lets
  // /api/* through by design so nothing else caught it. Two problems, one fix.
  // It told anonymous callers whether AI is configured and which prompt
  // version is live, and — the sharper edge — every anonymous hit ran getDb()
  // plus two audit_log queries against a pool that defaults to ONE connection
  // per isolate. That is a free database amplifier pointed at the app's
  // narrowest resource, reachable without an account.
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;

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

  const providerSignal = AbortSignal.timeout(PROVIDER_TIMEOUT_MS);

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
          schemaName,
          abortSignal: providerSignal
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

  const input = raw.slice(0, MAX_INPUT);
  const benchmarksEarly = measureBenchmarks(input);

  // PHI + escape before the meter: a blocked draft must not burn FREE_RUNS.
  // Same gates runByteStar applies; checked here so we can refuse without charging.
  const primaryPhi = runPhiRule(input).filter((f) => f.category === "phi");
  const phi = scanPhiForProvider(input, primaryPhi);
  if (phi.length > 0) {
    const actor = {
      actorId: guard.user.id,
      actorName: `${guard.user.displayName} (${guard.user.username})`
    };
    await logAction(db, {
      ...actor,
      action: "bytestar.refused",
      detail: `phi-blocked v${BYTESTAR_PROMPT_VERSION} ruleset ${RULESET_VERSION} 0 tokens [${phi.map((f) => f.ruleId).join(", ")}]`
    });
    return Response.json({
      observations: [],
      benchmarks: benchmarksEarly,
      code: "phi-blocked",
      unavailable: true
    });
  }

  const inputEscapeHits = detectEscape(input);
  if (inputEscapeHits.length > 0) {
    await logAction(db, {
      actorId: guard.user.id,
      actorName: `${guard.user.displayName} (${guard.user.username})`,
      action: "bytestar.escape",
      detail: `${encodeByteStarDetail({
        outcome: "escape-input",
        promptVersion: BYTESTAR_PROMPT_VERSION,
        model: config.model,
        tokens: 0,
        codes: inputEscapeHits.map((hit) => hit.signal)
      })} origin=user`
    });
    return Response.json({
      observations: [],
      benchmarks: benchmarksEarly,
      code: "escape-input",
      unavailable: true
    });
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
        schemaName,
        abortSignal: providerSignal
      });
      usedTokens += (res.usage?.inputTokens ?? 0) + (res.usage?.outputTokens ?? 0);
      return res.object;
    },
    {
      config,
      permaKilled,
      reads: resolveReads(),
      // Prefer the fresh session clinical role over any client-supplied claim.
      clinicalRole: guard.user.clinicalRole
    }
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
      sources: outcome.ok ? outcome.retrievedSources : undefined,
      // Which cage configuration ran — Team Leads see the router's decision.
      modes: outcome.ok ? outcome.modes : undefined,
      profile: outcome.ok ? outcome.profile : undefined
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
        actorName: "SuperByte ladder",
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
    unavailable: false,
    modes: outcome.modes,
    profile: outcome.profile,
    ...(outcome.jurisdictionNotice ? { jurisdictionNotice: outcome.jurisdictionNotice } : {})
  });
}
