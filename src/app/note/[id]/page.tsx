import { notFound } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/client";
import { getDraft } from "@/lib/db/repo/drafts";
import { BuilderShell } from "@/components/builder/BuilderShell";

export const runtime = "nodejs";
export const metadata = { title: "Note — Dental Note Builder" };

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = session!.user;
  const db = await getDb();
  const draft = await getDraft(db, id);
  if (!draft) notFound();
  if (user.role === "user" && draft.ownerId !== user.id) notFound();

  const canEdit = user.role !== "readonly" && (user.role === "admin" || draft.ownerId === user.id);

  return (
    <BuilderShell
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
