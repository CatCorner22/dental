import { generateObject, generateText, jsonSchema } from "ai";
import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { readJsonRecord } from "@/lib/http/readJson";
import { checkThrottle, recordFailure } from "@/lib/auth/throttle";
import { getAssistConfig, runAssist } from "@/lib/assist/service";
import { logAction } from "@/lib/db/repo/auditLog";
import { encodeDriftDetail } from "@/lib/assist/drift";
import { ASSIST_CAPABILITIES, ASSIST_PROMPT_VERSION, type AssistCapability } from "@/lib/assist/prompts";
import { RULESET_VERSION } from "@/lib/version";
import { capabilityTier, tierExplanation } from "@/lib/assist/tier";
import { runPhiRule } from "@/lib/audit/rules/phi";
import { scanPhiForProvider } from "@/lib/audit/rules/phi-secondary";

export const runtime = "nodejs";
/** Vercel: hard stop hung provider calls before they pin concurrency. */
export const maxDuration = 30;

// AI assist. Same privacy contract as the rest of the note pipeline — nothing stored, no
// row, no log of the content — plus one more hop: the text goes to the
// configured model provider, server-side, ONLY after the PHI gate passes.
// The browser never talks to a provider; CSP connect-src stays 'self'.

const MAX_INPUT = 20000;
// Tighter than the deterministic paths: each run is a paid model call, and the meter is
// per user so one person's scripting cannot spend the practice's budget.
const FREE_RUNS = 40;
/** Provider call budget — shorter than maxDuration so the route can log and return. */
const PROVIDER_TIMEOUT_MS = 20_000;

export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;

  const config = getAssistConfig();
  if (!config.enabled) {
    return Response.json(
      {
        error:
          "AI assist is not enabled on this deployment. Everything else works without it — ask an administrator about ASSIST_ENABLED."
      },
      { status: 503 }
    );
  }

  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const capability = parsed.value.capability;
  const raw = typeof parsed.value.text === "string" ? parsed.value.text : "";
  if (!ASSIST_CAPABILITIES.includes(capability as AssistCapability)) {
    return Response.json({ error: "Unknown assist capability." }, { status: 400 });
  }
  if (!raw.trim()) {
    return Response.json({ error: "Paste some text first." }, { status: 400 });
  }
  if (raw.length > MAX_INPUT) {
    return Response.json(
      { error: `That is longer than ${MAX_INPUT.toLocaleString()} characters. Work in sections.` },
      { status: 413 }
    );
  }

  // CAPABILITY FOLLOWS LICENCE.
  //
  // Checked here, on the server, against the clinical role read fresh from the
  // database by requireRole — not from the token, and not from anything the
  // browser sent. A licence gate the client could set is not a gate.
  //
  // A deterministic verdict is NOT a refusal, and the status code says so: 200,
  // with the tier named and an explanation of what would change it. The
  // deterministic twin of every capability ships in this repository and needs
  // no provider, so the honest answer here is "the other half answered", not
  // "no". The client runs the twin — the same pure functions the note is
  // already checked with — rather than the server round-tripping a result it
  // would have to re-derive.
  //
  // It also comes BEFORE the throttle and the model call, so a deterministic
  // tier spends neither the practice's run meter nor its money.
  const tier = capabilityTier(guard.user.clinicalRole, capability as AssistCapability);
  if (tier === "deterministic") {
    return Response.json({
      tier,
      capability,
      explanation: tierExplanation(guard.user.clinicalRole)
    });
  }

  const db = await getDb();
  const now = new Date();
  const key = `assist:${guard.user.id}`;
  const meter = await checkThrottle(db, key, now);
  if (meter.locked) {
    return Response.json(
      { error: `Too many AI runs just now. Try again in ${meter.retryAfterSec} seconds.` },
      { status: 429, headers: { "retry-after": String(meter.retryAfterSec) } }
    );
  }

  // PHI before the meter: a blocked identifier must not burn FREE_RUNS. Same
  // gate runAssist applies; checked here so we can refuse without charging.
  const input = raw.slice(0, MAX_INPUT);
  const primaryPhi = runPhiRule(input).filter((f) => f.category === "phi");
  const phi = scanPhiForProvider(input, primaryPhi);
  if (phi.length > 0) {
    return Response.json({
      ok: false,
      code: "phi-blocked",
      codes: [...new Set(phi.map((f) => f.ruleId))].sort(),
      message:
        `The AI was not called. ${phi.length} possible identifier${phi.length === 1 ? "" : "s"} ` +
        `must be removed or masked first — de-identified text is the condition for any AI ` +
        `assistance, with no exception and no override.`
    });
  }

  // Charge once we are about to call a provider (not on PHI refuse above).
  await recordFailure(db, key, now, FREE_RUNS);

  // Real token usage, captured here rather than plumbed back through the
  // injected seam — the seam's whole value is that a test can bind an adversary
  // to it, and widening its return type to carry billing data would make every
  // double carry billing data too.
  //
  // The run meter counts RUNS, which is a proxy: forty one-line questions and
  // forty full notes cost very different money. Recording what was actually
  // spent is the prerequisite for metering on it, and is useful on its own —
  // "which capability costs the practice most" is not answerable today.
  let usedTokens = 0;
  const addUsage = (u: { inputTokens?: number; outputTokens?: number } | undefined) => {
    usedTokens += (u?.inputTokens ?? 0) + (u?.outputTokens ?? 0);
  };
  const providerSignal = AbortSignal.timeout(PROVIDER_TIMEOUT_MS);

  const outcome = await runAssist(
    capability as AssistCapability,
    raw,
    async ({ system, prompt }) => {
      const res = await generateText({
        model: config.model,
        system,
        prompt,
        abortSignal: providerSignal
      });
      addUsage(res.usage);
      return res.text;
    },
    // The structured binding, for the capabilities that answer with a list.
    // The schema constrains what the model may emit; the service validates the
    // result again on its own terms, because a valid shape is not a valid
    // answer.
    async ({ system, prompt, schemaName, schema }) => {
      const res = await generateObject({
        model: config.model,
        system,
        prompt,
        schemaName,
        schema: jsonSchema(schema),
        abortSignal: providerSignal
      });
      addUsage(res.usage);
      return res.object;
    }
  );

  // Provenance, when the caller owns a draft: one audit row per successful
  // assist naming the capability, prompt version, and retrieved sources —
  // identifiers only, never text. Ownership is checked so a caller cannot
  // stamp assist.used onto a colleague's draft id.
  const draftId = typeof parsed.value.draftId === "string" ? parsed.value.draftId.slice(0, 64) : "";
  const actor = {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`
  };
  if (outcome.ok && draftId) {
    await logAction(db, {
      ...actor,
      action: "assist.used",
      target: draftId,
      detail: `${outcome.capability} v${outcome.promptVersion} ruleset ${RULESET_VERSION} ${usedTokens} tokens${outcome.retrievedSources.length ? ` [${outcome.retrievedSources.join(", ")}]` : ""}`
    });
  }
  // REFUSALS ARE THE MORE INFORMATIVE HALF, and they were not recorded at all.
  //
  // Only successes were logged, so the one question worth asking of a live
  // deployment — is this AI helping, and where does it fail? — had no data behind
  // it. A verifier rejection rate that climbs after a model revision is the signal
  // that the provider changed under you; a PHI-block rate that climbs is a
  // training problem in the practice, not a software one. Neither is visible from
  // a log of what worked.
  //
  // ONE row per call, in a PARSEABLE format, covering every outcome including the
  // successes — because a refusal rate needs a denominator, and a prose row cannot
  // supply one. encodeDriftDetail is read back by the drift monitor on the audit
  // page, which is where the trend becomes visible; a count nobody aggregates is a
  // count nobody uses.
  //
  // Codes, versions, model identity and token count only. Never the note, never
  // the prompt, never the model's draft — logging content to "improve quality" is
  // how a log becomes the least protected copy of the clinical record. The model
  // identity is the load-bearing field: "anthropic/claude-sonnet-4.5" is a pointer,
  // not a version, and a rate that moves while nothing in the practice changed is
  // unattributable without it.
  await logAction(db, {
    ...actor,
    action: "assist.drift",
    target: draftId || null,
    detail: encodeDriftDetail({
      outcome: outcome.ok ? "ok" : outcome.code,
      capability: capability as AssistCapability,
      promptVersion: ASSIST_PROMPT_VERSION,
      model: config.model,
      tokens: usedTokens,
      // On the ok path, extract's per-fact refusal codes still land here — a
      // climbing per-fact refusal rate is drift even when every call "succeeds".
      codes: outcome.ok ? (outcome.codes ?? []) : outcome.codes,
      ...(outcome.ok && outcome.extraction
        ? {
            facts: {
              pinned: outcome.extraction.pinned.length,
              refused: outcome.extraction.refused.length,
              questions: outcome.extraction.questions.length
            }
          }
        : {})
    })
  });

  if (!outcome.ok) {
    await logAction(db, {
      ...actor,
      action: "assist.refused",
      target: draftId || "(no draft)",
      detail: `${capability} ${outcome.code} v${ASSIST_PROMPT_VERSION} ruleset ${RULESET_VERSION} ${usedTokens} tokens${
        outcome.rejections?.length ? ` [${outcome.rejections.map((r) => r.code).join(", ")}]` : ""
      }`
    });
  }

  if (!outcome.ok) {
    // 422: the request was understood and refused for a stated reason. The
    // reason ships to the user — a refusal the user cannot read is a bug.
    return Response.json(
      { error: outcome.message, code: outcome.code, rejections: outcome.rejections ?? [] },
      { status: outcome.code === "model-error" ? 502 : 422 }
    );
  }

  return Response.json({
    text: outcome.text,
    // Present for the list capabilities: the validated array, so the browser
    // never has to re-derive structure by splitting the text back apart.
    ...(outcome.items ? { items: outcome.items } : {}),
    // The span-verified extraction: pinned facts with evidence offsets, demoted
    // questions, and per-fact refusals with their reasons. The browser renders
    // this; it never re-derives structure from text.
    ...(outcome.extraction ? { extraction: outcome.extraction } : {}),
    capability: outcome.capability,
    promptVersion: outcome.promptVersion
  });
}
