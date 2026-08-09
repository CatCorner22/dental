import { generateObject, jsonSchema } from "ai";
import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { logAction } from "@/lib/db/repo/auditLog";
import { getAssistConfig, type GenerateListFn } from "@/lib/assist/service";
import { runLegalWatch } from "@/lib/law/watch";

export const runtime = "nodejs";
// Six source fetches at 8s each PLUS a model pass, so the platform default
// (10s Hobby / 15s Pro) would 504 this route mid-sweep and leave the caller
// with nothing. Matched to the assist routes' ceiling; the provider call below
// carries its own, shorter budget so the route can still log and answer.
export const maxDuration = 60;

// LEGAL WATCH SWEEP — Team Lead and above, on demand.
//
// Inputs are public government/professional pages; no note text and no PHI is
// anywhere on this path, which is why it does not pass the PHI gate — there is
// nothing to gate. The AI pass rides the same assist deployment switch as
// everything else and is optional: without it the sweep still reports
// deterministic keyword signals per source. One transparent audit row per
// sweep, counts only.

const FETCH_TIMEOUT_MS = 8000;
/** Provider budget — shorter than maxDuration so the route can still answer. */
const PROVIDER_TIMEOUT_MS = 20_000;

async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "SmileNotes-LegalWatch/1.0 (compliance monitoring)" }
    });
    if (!res.ok) throw new Error(String(res.status));
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(): Promise<Response> {
  const guard = await requireRole("lead");
  if (!guard.ok) return guard.response;

  const assist = getAssistConfig();
  let generateList: GenerateListFn | undefined;
  if (assist.enabled) {
    generateList = async ({ system, prompt, schemaName, schema }) => {
      const res = await generateObject({
        model: assist.model,
        system,
        prompt,
        schema: jsonSchema(schema),
        schemaName,
        // Bounded like every other provider call in the app. Without this a
        // hung gateway pins the sweep until the platform kills the whole
        // function, so the deterministic keyword signals — which are already
        // computed and useful on their own — never reach the caller either.
        abortSignal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
      });
      return res.object;
    };
  }

  const sweep = await runLegalWatch(fetchPage, generateList);

  const db = await getDb();
  const ok = sweep.sources.filter((s) => s.status === "ok").length;
  const failed = sweep.sources.filter((s) => s.status === "fetch-failed").length;
  const items = sweep.sources.reduce((a, s) => a + s.items.length, 0);
  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: "law.watch",
    detail: `sweep ok=${ok} failed=${failed} items=${items} ai=${sweep.aiEnabled ? 1 : 0}`
  });

  return Response.json({ sweep });
}
