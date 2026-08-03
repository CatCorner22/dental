import { requireRole } from "@/lib/auth/guards";
import { canActOn, canReceiveTransfer, canTransferNotes, ROLE_LABEL } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { getDraft, transferDraft } from "@/lib/db/repo/drafts";
import { getUserById, isCreatureOf } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("lead");
  if (!guard.ok) return guard.response;
  if (!canTransferNotes(guard.user.role)) {
    return Response.json({ error: "You cannot transfer Smile Notes." }, { status: 403 });
  }
  const { id } = await params;
  const db = await getDb();
  const draft = await getDraft(db, id);
  if (!draft) return Response.json({ error: "Draft not found." }, { status: 404 });
  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const b = parsed.value;
  const toUserId = typeof b.toUserId === "string" ? b.toUserId : "";
  const to = await getUserById(db, toUserId);
  if (!to || !to.active) {
    return Response.json({ error: "Pick an active user to transfer to." }, { status: 400 });
  }
  if (!canReceiveTransfer(to.role)) {
    return Response.json({ error: "Cannot transfer a Smile Note to a read-only user." }, { status: 400 });
  }

  // Transfer moves WRITE access, so it must respect the same ceiling every
  // other user-management action does. Without these two checks a Team Lead
  // could reassign any clinician's note — a Developer's included — to
  // themselves and then edit and file it under their own name, which is
  // exactly the "must not put words in a clinician's record" rule the
  // capability matrix exists to enforce.
  //
  // Two corrections to the original spelling of this check:
  //   - A missing owner row now FAILS CLOSED. `owner && !canActOn(...)` let a
  //     null owner sail past the ceiling. Unreachable today (drafts.ownerId is
  //     a foreign key and deleting an owner with drafts is refused) but a
  //     fail-open default is one migration away from mattering.
  //   - Your OWN note is exempt. canActOn(lead, "lead") is false, so a Team
  //     Lead or Hierarchy Manager could not hand off a note they wrote
  //     themselves — the guard was stronger than the matrix intends and broke
  //     an ordinary hand-off.
  const owner = await getUserById(db, draft.ownerId);
  const ownNote = draft.ownerId === guard.user.id;
  if (!ownNote && (!owner || !canActOn(guard.user.role, owner.role))) {
    return Response.json(
      {
        error: owner
          ? `You cannot reassign a Smile Note owned by a ${ROLE_LABEL[owner.role]}.`
          : "That Smile Note's owner could not be verified."
      },
      { status: 403 }
    );
  }
  // The DESTINATION carries the same ceiling as the owner. Merge — which this
  // file's own comment calls the bulk form of transfer, "so it carries the same
  // rule" — checks both endpoints; this checked only one, and the asymmetry was
  // exploitable in two ways.
  //
  // Alone: a Team Lead could push any clinician's live note onto a Hierarchy
  // Manager or the Developer. canActOn(lead, "manager") is false, so no lead —
  // including the one who did it — could pull it back. A one-way button that
  // strands a colleague's unfinished note out of everyone's reach.
  //
  // Chained: the self-transfer and created-by-me blocks immediately below stop
  // an actor sending a note to their OWN account. With no ceiling on the
  // destination, a manager sends it to a Team Lead they minted, signs in as
  // that lead, and sends it on to themselves — arriving at the outcome both
  // blocks exist to prevent, one hop later.
  if (!canActOn(guard.user.role, to.role) && toUserId !== guard.user.id) {
    return Response.json(
      { error: `You cannot transfer a Smile Note to a ${ROLE_LABEL[to.role]}.` },
      { status: 403 }
    );
  }
  if (toUserId === guard.user.id && guard.user.role !== "admin") {
    return Response.json(
      { error: "You cannot transfer a Smile Note to yourself." },
      { status: 403 }
    );
  }

  // An account you created is an account you control: you chose the address the
  // invite went to, so you set its password. Handing another clinician's work
  // to it is the same act as transferring to yourself, one indirection later —
  // and it is how a Team Lead would get write access to a record the matrix
  // says they may reassign but never author. Treated identically to self.
  // Transitive: an account minted by an account you minted is still yours.
  // The one-level form below was defeated by a puppet at one remove — mint two
  // Team Leads, have one mint a Member, and the OTHER lead may transfer into
  // it, with one human holding all three invite mailboxes.
  const toIsPuppet =
    guard.user.role !== "admin" && (await isCreatureOf(db, to.id, guard.user.id));
  if ((to.createdById === guard.user.id || toIsPuppet) && guard.user.role !== "admin") {
    return Response.json(
      {
        error:
          "That account traces back to you, so you cannot transfer work into it. " +
          "Ask a colleague or a Smile Notes Developer to make this transfer."
      },
      { status: 403 }
    );
  }
  if (toUserId === draft.ownerId) {
    return Response.json({ error: "That user already owns this draft." }, { status: 400 });
  }
  await transferDraft(db, id, toUserId, new Date());
  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: "draft.transfer",
    target: id,
    detail: `${draft.ownerId} -> ${toUserId}`
  });
  return Response.json({ ok: true });
}
