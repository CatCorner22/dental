import Link from "next/link";
import { StatusChip } from "@/components/ui/StatusChip";
import { Character } from "@/components/mascot/Sparkle";
import { daySeed, sparkleLine } from "@/lib/stats/sparkle";
import type { RecentRow } from "./HomeAside";

// The home page for an account that cannot author a note.
//
// A read-only account exists for a biller, a locum, or a reviewer: it sees
// every clinical note in the practice and writes none of them. Rendering the
// builder for them would put a disabled form where the work should be, and
// creating a draft on their behalf would be worse — a row in the database
// belonging to someone who cannot fill it in.
export function ReadOnlyHome({
  recent,
  totalDrafts
}: {
  recent: RecentRow[];
  totalDrafts: number;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="section-title">Recent notes</h2>
        {totalDrafts > 0 && (
          <Link href="/notes" className="text-sm font-semibold text-brand-blue hover:underline">
            See all {totalDrafts} →
          </Link>
        )}
      </div>
      {recent.length === 0 ? (
        // rounded-xl and p-8 to match the other four empty states in the app.
        // The dashed treatment stays on purpose — that is the vocabulary that
        // separates "nothing here yet" from a populated list — but the radius
        // and padding were a hand-rolled near-miss of it.
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <Character id="sparkle" size="md" />
          {/* For a view-only account this component IS the whole home page, and
              the only copy was a sparkle line — "fresh page, fresh start" — which
              says neither what belongs here nor why the reader cannot add to it.
              A biller or locum on day one got a dashed rectangle and a cartoon
              tooth. Say the thing first; keep the sparkle as the quiet second
              line, the way DraftList already does. */}
          <p className="text-sm text-slate-600">
            Notes written anywhere in the practice appear here. Your account has view-only access,
            so there is nothing to start.
          </p>
          <p className="text-sm text-slate-500">{sparkleLine("empty", daySeed(new Date()))}</p>
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100 overflow-hidden p-0">
          {recent.map((d) => (
            <li key={d.id}>
              <Link
                href={`/note/${d.id}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-800">{d.title}</span>
                  <span className="block text-xs text-slate-500">
                    Updated {d.updatedAtLabel}
                    {d.ownerName ? ` · ${d.ownerName}` : ""}
                  </span>
                </span>
                <StatusChip status={d.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
