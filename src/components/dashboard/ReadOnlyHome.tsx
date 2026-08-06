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
        <div className="flex flex-col items-center gap-2 rounded border border-dashed border-slate-300 bg-white p-6 text-center">
          <Character id="sparkle" size="md" />
          <p className="text-sm text-slate-500">{sparkleLine("empty", daySeed(new Date()))}</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
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
