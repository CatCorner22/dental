// The login form's action state and its pure logic, in a module of their own.
//
// A "use server" file may only export async functions, so anything sync and
// testable — the redirect-path sanitizer, the failure-message branches — lives
// here where node-env vitest can reach it, and loginAction.ts stays a thin
// shell around signIn.

export interface LoginState {
  error: string;
  // After any failure on an MFA-enabled deployment the form OFFERS the
  // authenticator-code field. Offers, never asserts: the server keeps every
  // failure indistinguishable so an attacker cannot learn whether an account
  // has MFA — this flag is about which fields render, not about what went
  // wrong.
  offerTotp: boolean;
  // Threaded through the form as a hidden input as well as through state, so
  // the ≥3-attempts throttle hint still works when JavaScript never loaded and
  // every submission is a full-page POST with no client state at all.
  attempts: number;
  // Echoed so a no-JS failure re-render does not empty the field the user got
  // right. The password is deliberately never echoed — a secret must not be
  // reflected into an HTML response.
  username: string;
}

export const initialLoginState: LoginState = {
  error: "",
  offerTotp: false,
  attempts: 0,
  username: ""
};

/**
 * Reduce an attacker-influenceable callbackUrl to a same-origin path.
 *
 * Taking only pathname+search makes the result same-origin by construction —
 * there is no origin left to escape to. The one hole that survives that
 * reduction is a protocol-relative "//evil.org" (its pathname parses as
 * "//evil.org" in some URL libraries and the browser would treat a bare
 * "//host" location as cross-origin), so anything not starting with exactly
 * one "/" falls back to home.
 *
 * Runs twice on purpose: in the login page (deciding what goes into the
 * hidden input) and again in the action (deciding where to redirect), because
 * the hidden input is client-tamperable and only the server-side pass is a
 * guarantee.
 */
export function sanitizeCallbackPath(raw: string | undefined | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  try {
    const u = new URL(raw, "http://internal");
    const path = u.pathname + u.search;
    if (!path.startsWith("/") || path.startsWith("//")) return "/";
    return path;
  } catch {
    return "/";
  }
}

/**
 * The failure copy, ported branch-for-branch from the fetch-era client. The
 * server never says WHY sign-in failed (wrong password, unknown user, missing
 * code and throttle-paused are deliberately identical), so the message can
 * only be shaped by what this deployment supports and what the form has
 * already offered.
 */
export function loginFailureMessage(
  mfaAvailable: boolean,
  totpWasOffered: boolean,
  attempts: number
): string {
  const throttleHint =
    attempts >= 3
      ? " If you have tried several times, wait a few minutes — sign-in is briefly paused after repeated failures."
      : "";
  const base = !mfaAvailable
    ? "Sign-in failed. Check the username and password."
    : totpWasOffered
      ? "Sign-in failed. Check the username, password, and authenticator code."
      : "Sign-in failed. If this account uses an authenticator app, enter the current code below.";
  return base + throttleHint;
}
