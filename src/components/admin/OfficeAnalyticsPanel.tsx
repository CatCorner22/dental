// OFFICE ANALYTICS — location-level filing volume and audit-status mix.
// Aggregates by office, never by person; the no-scoreboard rule holds.

export interface OfficeStatusRow {
  officeName: string;
  total: number;
  status: string;
}

export function OfficeAnalyticsPanel({
  rows,
  windowDays
}: {
  rows: OfficeStatusRow[];
  windowDays: number;
}) {
  const byOffice = new Map<string, { total: number; statuses: Map<string, number> }>();
  for (const r of rows) {
    const entry = byOffice.get(r.officeName) ?? { total: 0, statuses: new Map() };
    entry.total += r.total;
    entry.statuses.set(r.status, (entry.statuses.get(r.status) ?? 0) + r.total);
    byOffice.set(r.officeName, entry);
  }
  const offices = [...byOffice.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <section className="card mt-6">
      <h2 className="section-title mb-1">Filing volume by office</h2>
      <p className="mb-3 max-w-3xl text-xs text-slate-600">
        The last {windowDays} days, grouped by the office frozen onto each filing. Location
        aggregates only — nothing here names or ranks a person.
      </p>
      {offices.length === 0 ? (
        <p className="text-sm text-slate-500">No filings in this window yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
                <th scope="col" className="px-2 py-1.5">Office</th>
                <th scope="col" className="px-2 py-1.5 text-right">Filings</th>
                <th scope="col" className="px-2 py-1.5">Audit-status mix</th>
              </tr>
            </thead>
            <tbody>
              {offices.map(([name, data]) => (
                <tr key={name} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-1.5 font-medium text-slate-800">{name}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{data.total}</td>
                  <td className="px-2 py-1.5 text-xs text-slate-600">
                    {[...data.statuses.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .map(([status, n]) => `${status}: ${n}`)
                      .join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
