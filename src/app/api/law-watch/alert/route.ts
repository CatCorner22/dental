import { createHash, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db/client";
import { logAction } from "@/lib/db/repo/auditLog";
import { runLegalWatch } from "@/lib/law/watch";
import { sendLawWatchAlert } from "@/lib/email/sendLawWatchAlert";

export const runtime = "nodejs";
// Six source fetches at 8s plus a mail round-trip sit right at the platform
// default; give the scheduled sweep the same ceiling as the manual one.
export const maxDuration = 60;

/**
 * Constant-time string compare for a shared secret.
 *
 * timingSafeEqual throws on length mismatch, which would itself leak the
 * secret's length, so compare fixed-width digests of both sides instead.
 */
function timingSafeEqualStr(a: string, b: string): boolean {
  const da = createHash("sha256").update(a).digest();
  const db = createHash("sha256").update(b).digest();
  return timingSafeEqual(da, db);
}

// SCHEDULED LAW-WATCH ALERT — the sweep the Team Lead runs by hand, on a
// timer, with the result mailed to the practice inbox.
//
// Authentication is the CRON_SECRET bearer token (Vercel cron convention),
// not a session: there is no user on a schedule. Without the secret set the
// endpoint refuses everything — an unauthenticated fetch-and-mail endpoint
// would be a free amplification loop.
//
// Deterministic keyword signals ONLY, no AI pass: a scheduled job should
// never quietly spend model tokens, and the keyword layer alone decides
// "worth a look" well enough for an email whose whole job is a pointer.

const FETCH_TIMEOUT_MS = 8000;

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

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization");
  // Fails closed when unset, and compares in constant time: `!==` on a secret
  // leaks its prefix through response timing to an endpoint anyone can reach.
  if (!secret || !timingSafeEqualStr(auth ?? "", `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const sweep = await runLegalWatch(fetchPage);
  const outcome = await sendLawWatchAlert(sweep);

  const db = await getDb();
  const ok = sweep.sources.filter((s) => s.status === "ok").length;
  const failed = sweep.sources.filter((s) => s.status === "fetch-failed").length;
  const items = sweep.sources.reduce((a, s) => a + s.items.length, 0);
  await logAction(db, {
    actorId: null,
    actorName: "Legal watch schedule",
    action: "law.watch-alert",
    detail: `sweep ok=${ok} failed=${failed} items=${items} mailed=${outcome.attempted && outcome.sent ? 1 : 0}`
  });

  return Response.json({
    ok: true,
    sources: sweep.sources.length,
    signals: items,
    mailed: outcome.attempted ? outcome.sent : false
  });
}
