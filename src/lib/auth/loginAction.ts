"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/lib/auth/auth";
import { mfaFeatureEnabled } from "@/lib/auth/mfaFeature";
import {
  loginFailureMessage,
  sanitizeCallbackPath,
  type LoginState
} from "@/lib/auth/loginFormState";

// THE REPO'S FIRST SERVER ACTION, and why the login form of all places gets it.
//
// The form used to be a controlled <form onSubmit> calling next-auth's client
// signIn. Before React hydrates, a submit — click or Enter — fell back to
// native GET submission: the page reloaded to /login? and the typed
// credentials were silently discarded (nothing leaked; the inputs carry no
// name attributes in that era, so the query was empty — but the fastest
// typist on the slowest connection, the operatory phone on bad wifi, lost
// their sign-in and any ?callbackUrl the middleware had attached).
//
// A server action closes that window from the other side: React SSRs the
// <form action> with a real method="POST", so a pre-hydration submit is a
// native POST that Next executes server-side — the user is actually signed in
// (MPA mode, redirect on the same response as the session cookie), not merely
// protected from loss. After hydration the identical form submits via fetch
// with inline state. Credentials ride the POST body over TLS in both modes and
// never appear in a URL.
export async function loginAction(prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const totp = String(formData.get("totp") ?? "").trim();
  // Sanitized here even though the page already sanitized what it rendered
  // into the hidden input: the input is client-tamperable, and only this pass
  // decides where the redirect actually goes.
  const dest = sanitizeCallbackPath(String(formData.get("callbackUrl") ?? ""));
  // In pure-MPA mode `prev` is the initial state on every POST, so the facts
  // the message branches need — was the code field already offered, how many
  // tries is this — round-trip as hidden inputs instead of client state.
  const offered = prev.offerTotp || formData.get("mfaOffered") === "1" || totp !== "";
  const attempts = Math.max(prev.attempts, Number(formData.get("attempts")) || 0) + 1;

  try {
    await signIn("credentials", { username, password, totp, redirectTo: dest });
  } catch (err) {
    if (err instanceof AuthError) {
      // Every authorize() refusal — wrong password, unknown user, missing or
      // wrong code, throttle pause — lands here looking identical, which is a
      // security property the copy must preserve, not a gap to improve on.
      const mfa = mfaFeatureEnabled();
      return {
        error: loginFailureMessage(mfa, offered, attempts),
        offerTotp: mfa,
        attempts,
        username
      };
    }
    // NEXT_REDIRECT lands here. That IS the success path — signIn with a
    // redirectTo answers by throwing the framework's redirect, which must
    // propagate for the 303 (MPA) or router navigation (hydrated) to happen.
    // Swallowing non-AuthError throws would eat the sign-in itself.
    throw err;
  }
  // Unreachable: signIn with redirectTo always throws (redirect on success,
  // AuthError on refusal). Returning prev keeps the signature honest.
  return prev;
}
