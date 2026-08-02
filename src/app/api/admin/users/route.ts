import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getUserByUsername, insertUser, listUsers } from "@/lib/db/repo/users";
import { logAction } from "@/lib/db/repo/auditLog";
import { readJsonRecord } from "@/lib/http/readJson";
import { hashPassword, passwordPolicyError } from "@/lib/auth/password";
import { sanitizeIdentity } from "@/lib/text/sanitizeIdentity";
import {
  canAddUser,
  canManageUsers,
  canSendResetLink,
  canSetPasswordDirectly,
  ROLE_LABEL,
  type Role
} from "@/lib/auth/roles";
import { emailPolicyError, normalizeEmail } from "@/lib/auth/emails";
import { issueResetLink } from "@/lib/auth/issueResetLink";
import { generateResetToken } from "@/lib/auth/resetToken";

export const runtime = "nodejs";

const ROLES: Role[] = ["readonly", "user", "lead", "manager", "admin"];

export async function GET(): Promise<Response> {
  // Anyone who manages users needs to see them. What they may DO to each row is
  // enforced per-action against the target's role, not by hiding the list.
  const guard = await requireRole("lead");
  if (!guard.ok) return guard.response;
  const db = await getDb();
  const users = await listUsers(db);
  return Response.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      active: u.active,
      // Addresses are where a reset link is DELIVERED, so they are targeting
      // data for an account takeover. Only shown for accounts this caller is
      // actually allowed to send a link to.
      ...(canSendResetLink(guard.user.role, u.role)
        ? { email: u.email, groupEmail: u.groupEmail }
        : {}),
      createdAt: u.createdAt
    }))
  });
}

export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole("lead");
  if (!guard.ok) return guard.response;
  if (!canManageUsers(guard.user.role)) {
    return Response.json({ error: "You cannot add users." }, { status: 403 });
  }
  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const b = parsed.value;
  const username = typeof b.username === "string" ? b.username.trim() : "";
  const cleanName = typeof b.displayName === "string" ? sanitizeIdentity(b.displayName) : "";
  const displayName = cleanName || username;
  const password = typeof b.password === "string" ? b.password : "";
  // An unknown/omitted role must NOT silently fall back to a default — a typo
  // would then create an account at a level the actor never chose.
  if (b.role !== undefined && !ROLES.includes(b.role as Role)) {
    return Response.json({ error: "Unknown role." }, { status: 400 });
  }
  const role = (b.role as Role) ?? "user";

  // Authority check against the TARGET's role: a Team Lead may not mint a
  // Developer, and a Hierarchy Manager may only ever mint a Team Lead.
  if (!canAddUser(guard.user.role, role)) {
    return Response.json(
      { error: `You cannot create a ${ROLE_LABEL[role]} account.` },
      { status: 403 }
    );
  }

  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/i.test(username)) {
    return Response.json({ error: "Username must be 3-40 letters, digits, or . _ -" }, { status: 400 });
  }

  const email = typeof b.email === "string" ? normalizeEmail(b.email) : "";
  const groupEmail = typeof b.groupEmail === "string" ? normalizeEmail(b.groupEmail) : "";
  const emailError = emailPolicyError(role, { email: email || null, groupEmail: groupEmail || null });
  if (emailError) return Response.json({ error: emailError }, { status: 400 });

  // Two ways to give the account a password, decided by authority:
  //  - A Smile Notes Developer may set one directly (the existing flow).
  //  - Everyone else invites by email. They never choose or see a credential,
  //    so the account is created with an unusable random hash and only becomes
  //    reachable once the invitee sets their own password via the link.
  const settingDirectly = password !== "" && canSetPasswordDirectly(guard.user.role);
  if (password !== "" && !settingDirectly) {
    return Response.json(
      { error: "You cannot set a password. Add the person's email and they will be sent a link." },
      { status: 403 }
    );
  }
  if (settingDirectly) {
    const pwError = passwordPolicyError(password);
    if (pwError) return Response.json({ error: pwError }, { status: 400 });
  } else if (!email) {
    return Response.json(
      { error: "An email address is required so the new user can be sent a set-password link." },
      { status: 400 }
    );
  }

  const db = await getDb();
  // Stored lowercase so "Nurse" and "nurse" can never be two people; the
  // unique-constraint catch turns a lost race into a clean 409, not a 500.
  const uname = username.toLowerCase();
  if (await getUserByUsername(db, uname)) {
    return Response.json({ error: "That username is taken." }, { status: 409 });
  }
  let created;
  try {
    created = await insertUser(db, {
      id: crypto.randomUUID(),
      username: uname,
      displayName,
      role,
      // A random token hashed as a password: no one knows it and no one can
      // guess it, so the account cannot be logged into until the link is used.
      passHash: await hashPassword(settingDirectly ? password : generateResetToken()),
      active: true,
      email: email || null,
      groupEmail: groupEmail || null
    });
  } catch {
    return Response.json({ error: "That username is taken." }, { status: 409 });
  }
  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: "user.create",
    target: uname,
    detail: role
  });

  let invited: boolean | undefined;
  if (!settingDirectly) {
    const sent = await issueResetLink(db, created, guard.user.id, new Date(), "welcome");
    invited = sent.ok;
    await logAction(db, {
      actorId: guard.user.id,
      actorName: `${guard.user.displayName} (${guard.user.username})`,
      action: sent.ok ? "user.invite-sent" : "user.invite-failed",
      target: uname,
      detail: sent.ok ? email : `${email} (${sent.reason})`
    });
  }
  return Response.json({ id: created.id, invited }, { status: 201 });
}
