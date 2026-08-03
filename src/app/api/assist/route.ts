import { generateText } from "ai";
import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { readJsonRecord } from "@/lib/http/readJson";
import { checkThrottle, recordFailure } from "@/lib/auth/throttle";
import { getAssistConfig, runAssist } from "@/lib/assist/service";
import { logAction } from "@/lib/db/repo/auditLog";
import {
  ASSIST_CAPABILITIES,
  ASSIST_PROMPT_VERSION,
  type AssistCapability
} from "@/lib/assist/prompts";
import { encodeDriftDetail } from "@/lib/assist/drift";

export const runtime = "nodejs";

// AI assist. Same privacy contract as /api/standardize — nothing stored, no
// row, no log of the content — plus one more hop: the text goes to the
// configured model provider, server-side, ONLY after the PHI gate passes.
// The browser never talks to a provider; CSP connect-src stays 'self'.

const MAX_INPUT = 20000;
// Tighter than standardize: each run is a paid model call, and the meter is
// per user so one person's scripting cannot spend the practice's budget.
const FREE_RUNS = 40;

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
  await recordFailure(db, key, now, FREE_RUNS);

  const outcome = await runAssist(capability as AssistCapability, raw, async ({ system, prompt }) => {
    const res = await generateText({ model: config.model, system, prompt });
    return res.text;
  });

  // Provenance, when the caller is working a draft: one audit row per
  // successful assist naming the capability, prompt version, and retrieved
  // sources — identifiers only, never text. The submit route folds these
  // into the frozen filing so a reviewer can see which AI touched what.
  const draftId = typeof parsed.value.draftId === "string" ? parsed.value.draftId.slice(0, 64) : "";
  if (outcome.ok && draftId) {
    await logAction(db, {
      actorId: guard.user.id,
      actorName: `${guard.user.displayName} (${guard.user.username})`,
      action: "assist.used",
      target: draftId,
      detail: `${outcome.capability} v${outcome.promptVersion}${outcome.retrievedSources.length ? ` [${outcome.retrievedSources.join(", ")}]` : ""}`
    });
  }

  // DRIFT ROW — every outcome, including the refusals.
  //
  // Only successes were recorded before, which threw away the entire signal.
  // Each refusal is a labelled example of the model misbehaving, produced free
  // of charge by a deterministic judge at the moment it happened, and it is the
  // only way to answer the one question that matters about a language model in
  // production: is it getting worse? One fabricated sentence is an event and
  // invisible. `content-invented` climbing from 2% to 30% across a thousand calls
  // is a provider quietly changing the model behind a version name.
  //
  // Logged unconditionally, unlike the provenance row above, because a refusal
  // from the standalone standardizer counts exactly as much as one from a draft.
  //
  // NOT ONE CHARACTER OF NOTE TEXT. The capability, the prompt version, the model
  // identity, and the rejection codes — all constants from this codebase, none
  // derived from anything anyone typed. The model identity is the load-bearing
  // field: "anthropic/claude-sonnet-4.5" is a pointer, not a version.
  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: "assist.drift",
    target: draftId || null,
    detail: encodeDriftDetail({
      outcome: outcome.ok ? "ok" : outcome.code,
      capability: capability as AssistCapability,
      promptVersion: ASSIST_PROMPT_VERSION,
      model: config.model,
      codes: outcome.ok ? [] : outcome.codes
    })
  });

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
    capability: outcome.capability,
    promptVersion: outcome.promptVersion
  });
}
