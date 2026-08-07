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
    //
    // /fonts MUST be public, and the bug that taught us was a good one. The
    // login page uses the self-hosted typeface, the person on the login page is
    // by definition not signed in, so the middleware 307'd the .woff2 request
    // to /login — and Firefox's font sanitizer then reported the LOGIN PAGE'S
    // HTML, served where a font should be, as "downloadable font: rejected by
    // sanitizer". Chromium and WebKit swallow a failed font without a console
    // error, so CI's cross-browser smoke caught it in exactly one browser and
    // the file itself was blameless: byte-identical to the official release
    // and accepted by every sanitizer once it actually arrived. A font file
    // carries no PHI; gating it behind auth broke only the login page's own
    // typography.
    //
    // /characters and /brand are the same lesson, learned from a screenshot
    // instead of a sanitizer: the login card shows Sparkle, the person looking
    // at it is not signed in, and the gated SVG came back as the login page's
    // HTML — a broken-image icon on the most-seen screen in the app. Mascot
    // and logo art carry no PHI.
    "/((?!login(?:/|$)|setup(?:/|$)|reset(?:/|$)|api/auth(?:/|$)|api/setup(?:/|$)|api/reset(?:/|$)|_next/static|_next/image|fonts/|characters/|brand/|favicon\\.ico$|icon\\.svg$).*)"
  ]
};
