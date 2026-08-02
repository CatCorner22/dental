import { auth } from "./auth";
import { meetsRole, type Role, type SessionUser } from "./roles";

export type GuardResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: Response };

// The authority for API authorization. Middleware is convenience; every route
// calls this so a role check is never skipped.
export async function requireRole(min: Role): Promise<GuardResult> {
  const session = await auth();
  const user = session?.user;
  if (!user) {
    return { ok: false, response: Response.json({ error: "Not signed in." }, { status: 401 }) };
  }
  if (!meetsRole(user.role, min)) {
    return {
      ok: false,
      response: Response.json({ error: "You do not have access to this action." }, { status: 403 })
    };
  }
  return { ok: true, user: user as SessionUser };
}
