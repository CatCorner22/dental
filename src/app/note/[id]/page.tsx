import { notFound, redirect } from "next/navigation";
import { canWriteNote, seesAllNotes } from "@/lib/auth/roles";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { getDb } from "@/lib/db/client";
import { getDraft } from "@/lib/db/repo/drafts";
import { BuilderShell } from "@/components/builder/BuilderShell";
import { getOffice, officesForPicker } from "@/lib/db/repo/offices";

export const runtime = "nodejs";
export const metadata = { title: "Note" };

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await freshSessionUser(); // fresh role/active — never the stale token
  if (!user) redirect("/login");
  const db = await getDb();
  const draft = await getDraft(db, id);
  if (!draft) notFound();
  if (!seesAllNotes(user.role) && draft.ownerId !== user.id) notFound();

  const canEdit = canWriteNote(user.role, draft.ownerId, user.id);

  // Only ACTIVE offices are offered for a new choice; a note already recorded
  // at a since-retired office keeps that value and still displays it, because
  // where care happened is a fact about the past, not a current setting.
  const active = await officesForPicker(db, user.id);
  // Plus the office this draft is ALREADY recorded at, even if it has since
  // been retired. Without it the picker's value matches no option and the
  // browser renders a blank box — so a draft written at a closed location
  // looks like it has no office, and "fixing" the blank silently relocates the
  // encounter to wherever the user picks.
  const current = draft.officeId ? await getOffice(db, draft.officeId) : undefined;
  const offices =
    current && !active.some((o) => o.id === current.id) ? [...active, current] : active;
  // NO pre-selection. The picker shows exactly what the draft holds, so the
  // screen can never display an office the record does not have — the failure
  // a single "default office" made possible, where filing without touching
  // anything froze null while the clinician was looking at a location. A
  // person's own offices are simply listed first.
  const initialOfficeId = draft.officeId ?? null;

  return (
    <BuilderShell
      // Keyed by version: "Reload latest" calls router.refresh(), and without
      // a key change the client state (including an open conflict) survives —
      // the advertised recovery path would reload nothing.
      key={`${draft.id}:${draft.version}`}
      draftId={draft.id}
      initialTitle={draft.title}
      initialOfficeId={initialOfficeId}
      offices={offices.map((o) => ({ id: o.id, name: o.name }))}
      initialNote={draft.noteState}
      initialVersion={draft.version}
      initialSubmitted={draft.status === "submitted"}
      initialSendFailed={draft.lastSendFailed}
      canEdit={canEdit}
    />
  );
}
