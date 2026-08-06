import { resolveClinicalRole } from "./clinicalRoles";
import { auth } from "./auth";
import { getDb } from "@/lib/db/client";
import { getUserById } from "@/lib/db/repo/users";
import { meetsRole, type Role, type SessionUser } from "./roles";
import { isTokenRevoked } from "./sessionWatermark";

export type GuardResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: Response };

// The authority for API authorization. Middleware is convenience; every route
// calls this so a role check is never skipped. Role and active state are read
// fresh from the database (one primary-key lookup), so deactivating or
// demoting a user takes effect on their very next request — not when their
// 30-day token expires.
//
// The legal-record notice is enforced here too: until a user has
// acknowledged it, no API works except the acknowledgment itself
// (requireAck: false). Without this, the notice is only a dismissible
// modal — curl could file and email notes with no attestation on record.
export async function requireRole(
  min: Role,
  opts: { requireAck?: boolean } = {}
): Promise<GuardResult> {
  const session = await auth();
  const sessionUser = session?.user;
  if (!sessionUser) {
    return { ok: false, response: Response.json({ error: "Not signed in." }, { status: 401 }) };
  }
  const db = await getDb();
  const row = await getUserById(db, sessionUser.id);
  if (!row || !row.active) {
    return {
      ok: false,
      response: Response.json({ error: "This account is not active." }, { status: 403 })
    };
  }
  // Session revocation: a token minted before the last password change, admin
  // reset, or "sign out on all devices" is dead NOW — otherwise a stolen cookie
  // survives the very remediation meant to cut it off.
  if (isTokenRevoked(row, sessionUser.pwAt)) {
    return {
      ok: false,
      response: Response.json(
        { error: "This session was ended. Sign in again." },
        { status: 401 }
      )
    };
  }
  if (!meetsRole(row.role, min)) {
    return {
      ok: false,
      response: Response.json({ error: "You do not have access to this action." }, { status: 403 })
    };
  }
  if (opts.requireAck !== false && row.noticeAckAt === null) {
    return {
      ok: false,
      response: Response.json(
        { error: "Acknowledge the legal-record notice first (shown when you open the app)." },
        { status: 403 }
      )
    };
  }
  return {
    ok: true,
    user: {
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      role: row.role,
      noticeAcked: row.noticeAckAt !== null,
      // Fresh from the row, like role and active. A scope corrected after
      // someone signed in has to bite on their next request.
      clinicalRole: resolveClinicalRole(row.role, row.clinicalRole)
    }
  };
}
