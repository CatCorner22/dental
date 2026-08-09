import Link from "next/link";
import { redirect } from "next/navigation";
import { meetsRole } from "@/lib/auth/roles";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { BatchTriage } from "@/components/notes/BatchTriage";
import { HelpTip } from "@/components/ui/HelpTip";
import { Character } from "@/components/mascot/Sparkle";
import { daySeed, sparkleLine } from "@/lib/stats/sparkle";

export const runtime = "nodejs";
export const metadata = { title: "Batch check" };

// END-OF-DAY TRIAGE.
//
// The one workflow in the app that is genuinely shaped like a pile of strings
// rather than like a note: several short notes written during the day, pasted
// in together, checked at once to find which ones need work. There is no
// NoteState equivalent because there is no single note here.
//
// It kept its own page when the standardize screen was retired, because
// folding it into the note builder would have meant putting a multi-note
// textarea inside a single note — which is the sort of thing that makes people
// paste one patient's note into another's.
//
// It triages only. A row offers Copy ONLY when its checks come back clean; a
// note with open findings leaves through the note builder, past the audit and
// the two-identifier check, or it does not leave. (This comment once claimed
// no copy button existed at all while the component rendered an ungated one —
// the batch-13 drive caught the contradiction and the gate now matches the
// contract.)
export default async function BatchPage() {
  const user = await freshSessionUser();
  if (!user) redirect("/login");
  if (!meetsRole(user.role, "user")) redirect("/notes");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h1 className="page-title">Batch check</h1>
          <HelpTip label="About batch check">
            Paste several notes separated by a line containing only three dashes. Each one is run
            through the same wording pass and the same checks the note builder uses, and reported
            as clean or needing work. Nothing here is saved and nothing can be filed from here.
          </HelpTip>
        </div>
        <Link href="/notes" className="text-sm font-semibold text-brand-blue hover:underline">
          ← My notes
        </Link>
      </div>
      <div className="flex items-center gap-2.5">
        <Character id="sparkle" size="sm" />
        <p className="text-sm text-slate-600">{sparkleLine("batch", daySeed(new Date()))}</p>
      </div>
      <p className="max-w-3xl text-sm text-slate-600">
        A triage view for the end of the day. Separate each note with a line containing only{" "}
        <code className="rounded bg-slate-100 px-1">---</code>. Nothing typed here is saved; to
        work on one, copy it and paste it into a note.
      </p>
      <BatchTriage />
    </div>
  );
}
