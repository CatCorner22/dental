import { redirect } from "next/navigation";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { canManageUsers } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { listOpenStandardsWishes, listWishes } from "@/lib/db/repo/wishes";
import { formatEasternTime } from "@/lib/tickets/etTime";
import { sortWishes } from "@/lib/wishes/wishes";
import { WishList } from "@/components/wishes/WishList";
import { ExportButton } from "@/components/export/ExportButton";

export const runtime = "nodejs";
export const metadata = { title: "Wish list" };

export default async function WishesPage() {
  // Everyone signed in, INCLUDING a read-only account. Someone who cannot
  // author a note can still see an empty glove box or a sterilizer running
  // cold, and requiring authoring rights to report that would silence exactly
  // the people most likely to notice.
  const user = await freshSessionUser();
  if (!user) redirect("/login");
  const db = await getDb();
  // The paged list PLUS every open below-standard report, deduplicated. The
  // page cap is what made a safety report disappear; fetching those rows
  // separately means the cap can never reach them.
  const [paged, openStandards] = await Promise.all([
    listWishes(db),
    listOpenStandardsWishes(db)
  ]);
  const seen = new Set(paged.map((w) => w.id));
  const rows = sortWishes([...paged, ...openStandards.filter((w) => !seen.has(w.id))]);

  return (
    <div className="max-w-3xl">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Wish list</h1>
        <ExportButton table="wishes" />
      </div>
      <p className="mb-4 text-sm text-slate-600">
        What would make this place work better. Every entry carries the name of whoever raised it —
        not to police anyone, but so there is someone to ask when a supply request needs a detail or
        a concern needs following up.
      </p>
      <WishList
        canDecide={canManageUsers(user.role)}
        wishes={rows.map((w) => ({
          id: w.id,
          authorName: w.authorName,
          category: w.category,
          title: w.title,
          detail: w.detail,
          status: w.status,
          decidedByName: w.decidedByName,
          decidedNote: w.decidedNote,
          createdAtLabel: formatEasternTime(w.createdAt)
        }))}
      />
    </div>
  );
}
