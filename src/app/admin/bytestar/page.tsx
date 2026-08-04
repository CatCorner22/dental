import { redirect } from "next/navigation";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { meetsRole } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { listAuditLogByAction } from "@/lib/db/repo/auditLog";
import { getByteStarConfig } from "@/lib/bytestar/config";
import { decodeByteStarDetail } from "@/lib/bytestar/log";
import { BYTESTAR_PROMPT_VERSION } from "@/lib/bytestar/prompts";
import { ESCAPE_TRIP_THRESHOLD } from "@/lib/bytestar/escape";

export const dynamic = "force-dynamic";

// TEAM LEAD MONITOR — every ByteStar event in the clear.
// Identifiers, codes, versions, tokens. Never note text. The silent kill
// state is visible HERE so an operator can confirm the cage without the
// pioneer path ever naming it.

export default async function ByteStarMonitorPage() {
  const user = await freshSessionUser();
  if (!user) redirect("/login");
  if (!meetsRole(user.role, "lead")) redirect("/");

  const db = await getDb();
  const config = getByteStarConfig();
  const [drift, escapes, optIns, optOuts, refused] = await Promise.all([
    listAuditLogByAction(db, "bytestar.drift", 200),
    listAuditLogByAction(db, "bytestar.escape", 100),
    listAuditLogByAction(db, "bytestar.opt-in", 100),
    listAuditLogByAction(db, "bytestar.opt-out", 100),
    listAuditLogByAction(db, "bytestar.refused", 100)
  ]);

  const hourAgo = Date.now() - 60 * 60 * 1000;
  const escapesThisHour = escapes.filter((r) => r.at.getTime() >= hourAgo).length;
  const softLocked = escapesThisHour >= ESCAPE_TRIP_THRESHOLD;

  const outcomes = drift.reduce<Record<string, number>>((acc, row) => {
    const d = decodeByteStarDetail(row.detail ?? "");
    const key = d?.outcome ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="page-title">ByteStar monitor</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Transparent log of the optional pioneer advisor. Codes, versions, and token counts only —
        never note content. Team Lead and above.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Deployment door"
          value={config.enabled ? "Open" : "Closed"}
          note={
            config.silentlyKilled
              ? "Silent kill is engaged (operator)."
              : softLocked
                ? `Soft lock: ${escapesThisHour} escapes this hour (threshold ${ESCAPE_TRIP_THRESHOLD}).`
                : config.enabled
                  ? "Assist + BYTESTAR_ENABLED are on."
                  : "Requires ASSIST_ENABLED, API key, and BYTESTAR_ENABLED."
          }
        />
        <Stat label="Prompt version" value={BYTESTAR_PROMPT_VERSION} note={`Model: ${config.model}`} />
        <Stat
          label="Escapes (1h)"
          value={String(escapesThisHour)}
          note={`${escapes.length} recorded total in the recent window.`}
        />
        <Stat
          label="Opt-ins / opt-outs"
          value={`${optIns.length} / ${optOuts.length}`}
          note="Device-local preference; rows are acknowledgments only."
        />
      </section>

      <section className="mt-8">
        <h2 className="section-title">Outcome mix (recent drift rows)</h2>
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">
          {Object.keys(outcomes).length === 0 ? (
            <li className="text-slate-500">No ByteStar calls logged yet.</li>
          ) : (
            Object.entries(outcomes).map(([k, n]) => (
              <li key={k} className="rounded-full bg-slate-100 px-3 py-1 tabular-nums text-slate-700">
                {k}: {n}
              </li>
            ))
          )}
        </ul>
      </section>

      <LogTable title="Drift log" rows={drift} />
      <LogTable title="Escape attempts" rows={escapes} />
      <LogTable title="Verifier / PHI refusals" rows={refused} />
      <LogTable title="Opt-in acknowledgments" rows={optIns} />
      <LogTable title="Opt-out acknowledgments" rows={optOuts} />
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
