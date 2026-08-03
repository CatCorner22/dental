import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getUserById, mergeUsers } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";
import { canMergeUsers, ROLE_LABEL } from "@/lib/auth/roles";

export const runtime = "nodejs";

// Merge a duplicate account into the one a person actually uses.
//
// Live work (drafts) moves to the target; FILED submissions keep their original
// attribution forever, because they are a legal record of who signed what. The
// source account is deactivated, not deleted, since the record still points at
// it. See mergeUsers() for the transactional guarantees.
export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole("lead");
  if (!guard.ok) return guard.response;

  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const b = parsed.value;
  const sourceId = typeof b.sourceId === "string" ? b.sourceId : "";
  const targetId = typeof b.targetId === "string" ? b.targetId : "";
  if (!sourceId || !targetId) {
    return Response.json({ error: "Pick the duplicate account and the one to keep." }, { status: 400 });
  }
  if (sourceId === targetId) {
    return Response.json({ error: "Those are the same account." }, { status: 400 });
  }
  if (sourceId === guard.user.id) {
    return Response.json({ error: "You cannot merge your own account away." }, { status: 400 });
  }

  const db = await getDb();
  const source = await getUserById(db, sourceId);
  const target = await getUserById(db, targetId);
  if (!source || !target) return Response.json({ error: "Not found." }, { status: 404 });

  // Authority is measured against BOTH accounts: merging is destructive to the
  // source and grants its work to the target, so neither may sit above the
  // actor's ceiling.
  if (!canMergeUsers(guard.user.role, source.role)) {
    return Response.json(
      { error: `You cannot merge a ${ROLE_LABEL[source.role]} account.` },
      { status: 403 }
    );
  }
  if (!canMergeUsers(guard.user.role, target.role)) {
    return Response.json(
      { error: `You cannot merge into a ${ROLE_LABEL[target.role]} account.` },
      { status: 403 }
    );
  }

  // Merge is the bulk form of transfer — it moves EVERY draft the source owns
  // in one call — so it carries the same rule. An account you created is an
  // account whose password you set, so merging a colleague's work into it hands
  // you write access to all of it at once. Same reasoning as the self-merge
  // block above, one indirection later.
  if (target.createdById === guard.user.id && guard.user.role !== "admin") {
    return Response.json(
      {
        error:
          "You created that account, so you cannot merge work into it. " +
          "Ask a colleague or a Smile Notes Developer to make this merge."
      },
      { status: 403 }
    );
  }
  if (target.id === guard.user.id && guard.user.role !== "admin") {
    return Response.json(
      { error: "You cannot merge another person's work into your own account." },
      { status: 403 }
    );
  }

  // The authority checks above ran OUTSIDE the merge transaction, so a role
  // change landing in between could widen what this call is allowed to touch.
  // Passing the actor in lets mergeUsers re-assert both ceilings while holding
  // the lock, against the rows it is actually about to modify.
  const result = await mergeUsers(db, sourceId, targetId, new Date(), {
    id: guard.user.id,
    role: guard.user.role
  });
  if (!result.ok) {
    const message =
      result.reason === "last-admin"
        ? "That is the last active Smile Notes Developer — merging it away would lock everyone out."
        : result.reason === "same-user"
          ? "Those are the same account."
          : result.reason === "bad-target"
            ? "Merge into an active account that can edit notes — not a deactivated or read-only one."
            : result.reason === "not-allowed"
              ? "You are not allowed to merge these two accounts."
              : "Not found.";
    const status =
      result.reason === "missing" ? 404 : result.reason === "not-allowed" ? 403 : 409;
    return Response.json({ error: message }, { status });
  }

  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: "user.merge",
    target: `${source.username} → ${target.username}`,
    detail: `${result.draftsMoved} draft(s) moved; ${result.submissionsKept} filed submission(s) keep their original attribution`
  });

  return Response.json({
    ok: true,
    draftsMoved: result.draftsMoved,
    submissionsKept: result.submissionsKept
  });
}
