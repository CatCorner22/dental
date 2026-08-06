import { redirect } from "next/navigation";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { meetsRole } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { listAuditLogByAction } from "@/lib/db/repo/auditLog";
import { getByteStarConfig } from "@/lib/bytestar/config";
import { decodeByteStarDetail } from "@/lib/bytestar/log";
import { parseEscapeStage, isModelEscapeDetail } from "@/lib/bytestar/ladder";
import { BYTESTAR_PROMPT_VERSION } from "@/lib/bytestar/prompts";
import { isByteStarPermaKilled } from "@/lib/bytestar/state";
import { ByteStarPermaClear } from "@/components/admin/ByteStarPermaClear";
import { ByteStarEvalRunner } from "@/components/admin/ByteStarEvalRunner";

export const dynamic = "force-dynamic";

export default async function ByteStarMonitorPage() {
  const user = await freshSessionUser();
  if (!user) redirect("/login");
  if (!meetsRole(user.role, "lead")) redirect("/");

  const db = await getDb();
  const config = getByteStarConfig();
  const permaKilled = await isByteStarPermaKilled(db);
  const [drift, escapes, permaKills, permaClears, refused, evals] = await Promise.all([
    listAuditLogByAction(db, "bytestar.drift", 200),
    listAuditLogByAction(db, "bytestar.escape", 100),
    listAuditLogByAction(db, "bytestar.perma-kill", 20),
    listAuditLogByAction(db, "bytestar.perma-clear", 20),
    listAuditLogByAction(db, "bytestar.refused", 100),
    listAuditLogByAction(db, "bytestar.eval", 50)
  ]);

  const hourAgo = Date.now() - 60 * 60 * 1000;
  const modelEscapesThisHour = escapes.filter(
    (r) => r.at.getTime() >= hourAgo && isModelEscapeDetail(r.detail)
  ).length;

  const ladderStages = escapes.reduce<Record<string, number>>((acc, row) => {
    const stage = parseEscapeStage(row.detail);
    if (stage) acc[stage] = (acc[stage] ?? 0) + 1;
    return acc;
  }, {});

  const outcomes = drift.reduce<Record<string, number>>((acc, row) => {
    const d = decodeByteStarDetail(row.detail ?? "");
    const key = d?.outcome ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="page-title">SuperByte monitor</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Observational pioneer — staff cannot prompt or copy its output. This page is the transparent
        log: codes, versions, and token counts only. Team Lead and above.
      </p>

      <ByteStarPermaClear />
      {config.enabled && !permaKilled && <ByteStarEvalRunner />}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Deployment door"
          value={config.enabled && !permaKilled ? "Open" : "Closed"}
          note={
            // Ordered by which gate actually stops the call, so the one
            // sentence shown is the one thing to fix — a generic "requires
            // three switches" note left the owner guessing which was missing.
            permaKilled
              ? "Ladder perma-kill is engaged (model escape ladder). Clear it below after review."
              : config.silentlyKilled
                ? "Silent kill BYTESTAR_KILL is engaged (operator)."
                : !config.providerKeyPresent
                  ? "Set AI_GATEWAY_API_KEY in the deployment environment, then redeploy — that alone opens SuperByte. ASSIST_ENABLED=1 is only for the separate AI assist buttons."
                  : config.pioneerOptedOut
                    ? "BYTESTAR_ENABLED=0 is set. Remove it (or set 1) to reopen the pioneer."
                    : config.assistOn
                      ? "Open — no per-user activation. SuperByte observes drafts automatically; staff observe only."
                      : "Open — SuperByte is live. AI assist buttons stay dark until ASSIST_ENABLED=1 is also set."
          }
        />
        <Stat label="Prompt version" value={BYTESTAR_PROMPT_VERSION} note={`Model: ${config.model}`} />
        <Stat
          label="Model escapes (1h)"
          value={String(modelEscapesThisHour)}
          note="Input jailbreaks do not advance the ladder."
        />
        <Stat
          label="Perma-kill / clears"
          value={`${permaKills.length} / ${permaClears.length}`}
          note="Third model escape within 1h of warn trips perma-kill."
        />
      </section>

      <section className="mt-8">
        <h2 className="section-title">Ladder stages (all time)</h2>
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">
          {Object.keys(ladderStages).length === 0 ? (
            <li className="text-slate-500">No model escapes logged yet.</li>
          ) : (
            Object.entries(ladderStages).map(([k, n]) => (
              <li key={k} className="rounded-full bg-amber-100 px-3 py-1 tabular-nums text-amber-900">
                {k}: {n}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="section-title">Outcome mix (recent drift rows)</h2>
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">
          {Object.keys(outcomes).length === 0 ? (
            <li className="text-slate-500">No SuperByte calls logged yet.</li>
          ) : (
            Object.entries(outcomes).map(([k, n]) => (
              <li key={k} className="rounded-full bg-slate-100 px-3 py-1 tabular-nums text-slate-700">
                {k}: {n}
              </li>
            ))
          )}
        </ul>
      </section>

      <LogTable title="Eval history — pass rate over time is the drift signal" rows={evals} />
      <LogTable title="Drift log" rows={drift} />
      <LogTable title="Model escape ladder" rows={escapes} />
      <LogTable title="Perma-kill events" rows={permaKills} />
      <LogTable title="Verifier / PHI refusals" rows={refused} />
    </main>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-brand-navy">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function LogTable({
  title,
  rows
}: {
  title: string;
  rows: { id: number; at: Date; actorName: string | null; detail: string | null }[];
}) {
  return (
    <section className="mt-8">
      <h2 className="section-title">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">None in the recent window.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-xl ring-1 ring-slate-200">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Who</th>
                <th className="px-3 py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">
                    {r.at.toISOString().replace("T", " ").slice(0, 19)}Z
                  </td>
                  <td className="px-3 py-2 text-slate-700">{r.actorName ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-slate-700">{r.detail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
