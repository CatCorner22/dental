import { notFound, redirect } from "next/navigation";
import { canWriteNote, seesAllNotes } from "@/lib/auth/roles";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { getDb } from "@/lib/db/client";
import { getDraft } from "@/lib/db/repo/drafts";
import { BuilderShell } from "@/components/builder/BuilderShell";
import { listActiveOffices } from "@/lib/db/repo/offices";
import { getUserById } from "@/lib/db/repo/users";

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
  const offices = await listActiveOffices(db);
  // A brand-new draft starts at the author's usual office purely as a
  // convenience. It is a starting position, never a constraint — staff rotate,
  // and the picker beside it is always free.
  const me = await getUserById(db, user.id);
  const initialOfficeId = draft.officeId ?? me?.defaultOfficeId ?? null;

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
