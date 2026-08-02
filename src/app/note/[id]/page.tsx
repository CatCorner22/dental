import { notFound, redirect } from "next/navigation";
import { canWriteNote, seesAllNotes } from "@/lib/auth/roles";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { getDb } from "@/lib/db/client";
import { getDraft } from "@/lib/db/repo/drafts";
import { BuilderShell } from "@/components/builder/BuilderShell";

export const runtime = "nodejs";
export const metadata = { title: "Note — Dental Note Builder" };

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await freshSessionUser(); // fresh role/active — never the stale token
  if (!user) redirect("/login");
  const db = await getDb();
  const draft = await getDraft(db, id);
  if (!draft) notFound();
  if (!seesAllNotes(user.role) && draft.ownerId !== user.id) notFound();

  const canEdit = canWriteNote(user.role, draft.ownerId, user.id);

  return (
    <BuilderShell
      // Keyed by version: "Reload latest" calls router.refresh(), and without
      // a key change the client state (including an open conflict) survives —
      // the advertised recovery path would reload nothing.
      key={`${draft.id}:${draft.version}`}
      draftId={draft.id}
      initialTitle={draft.title}
      initialNote={draft.noteState}
      initialVersion={draft.version}
      initialSubmitted={draft.status === "submitted"}
      initialSendFailed={draft.lastSendFailed}
      canEdit={canEdit}
    />
  );
}
