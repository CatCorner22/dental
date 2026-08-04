import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";

// NODE RUNTIME, not Edge.
//
// This app is self-hosted next to the practice's own database — there is no
// edge network in front of it and never will be, so Edge bought nothing and
// cost something real: `jose`, which NextAuth uses for JWT work, reaches for
// CompressionStream, and the build warned on every run that a Node API was
// being used in a runtime that does not have it. A permanent warning is worse
// than the thing it warns about, because it is the one that teaches you to
// stop reading build output.
//
// The middleware still uses only the db-free config and still only gates page
// navigation; every API route re-checks the role via requireRole (guards.ts).
// Running on Node changes where it executes, not what it decides.
export const runtime = "nodejs";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    // Everything except the public auth pages, the auth/setup/reset APIs, and
    // static assets. Each exclusion is anchored to a segment boundary so a
    // future route like /login-help or /setup-guide is NOT silently public.
    //
    // /reset and /api/reset MUST be public: the entire point of a reset link is
    // that someone who cannot sign in can use it. The token in the URL is the
    // credential, and the POST handler is what judges it.
    "/((?!login(?:/|$)|setup(?:/|$)|reset(?:/|$)|api/auth(?:/|$)|api/setup(?:/|$)|api/reset(?:/|$)|_next/static|_next/image|favicon\\.ico$|icon\\.svg$).*)"
  ]
};
