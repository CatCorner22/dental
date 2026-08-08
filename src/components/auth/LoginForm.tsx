"use client";

import { useActionState, useState } from "react";
import { HelpTip } from "@/components/ui/HelpTip";
import { loginAction } from "@/lib/auth/loginAction";
import { initialLoginState } from "@/lib/auth/loginFormState";

// A server-action form, not an onSubmit-fetch form — see the WHY-comment in
// loginAction.ts. The short version: the old shape lost whatever was typed if
// the submit landed before hydration; this shape signs the user in either way.
//
// callbackUrl arrives from the page already sanitized (and the action
// sanitizes it again before redirecting — the hidden input is tamperable).
export function LoginForm({ callbackUrl = "/" }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialLoginState);
  // CONTROLLED ON PURPOSE. React 19 auto-resets *uncontrolled* form fields
  // when an action completes, which would wipe the typed username and
  // password on every hydrated failure — a regression from the fetch era.
  // Controlled inputs survive the reset; before hydration controlled-ness is
  // moot because React is not running and the DOM values ride the native POST
  // body directly. Do not "simplify" these to uncontrolled + defaultValue.
  //
  // Username seeds from state so a no-JS failure re-render keeps the field
  // the user got right. The password never round-trips — the action refuses
  // to echo a secret into a response — so in that one mode it must be
  // retyped; honest, and only on the no-JS failure path.
  const [username, setUsername] = useState(state.username);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totp, setTotp] = useState("");

  return (
    <form action={formAction} className="space-y-3">
      {/* The action's inputs beyond the visible fields. Hidden values rather
          than client state so the message branches and the redirect work even
          when every submission is a full-page POST with no JS at all. */}
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <input type="hidden" name="attempts" value={state.attempts} />
      <input type="hidden" name="mfaOffered" value={state.offerTotp ? "1" : "0"} />
      <div>
        <label className="field-label" htmlFor="li-user">
          Username
        </label>
        <input
          id="li-user"
          name="username"
          className="field-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="field-label mb-0" htmlFor="li-pass">
            Password
          </label>
          <button
            type="button"
            className="text-xs font-medium text-brand-blue underline decoration-dotted underline-offset-2"
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <input
          id="li-pass"
          name="password"
          type={showPassword ? "text" : "password"}
          className="field-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      {state.offerTotp && (
        <div>
          <label className="field-label" htmlFor="li-totp">
            Authenticator code
          </label>
          {/* Offered after any failure on an MFA-enabled deployment, never
              asserted: the server keeps every failure identical so an
              attacker cannot learn whether an account has MFA. */}
          <input
            id="li-totp"
            name="totp"
            className="field-input"
            value={totp}
            onChange={(e) => setTotp(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            maxLength={7}
          />
        </div>
      )}
      {state.error && (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full justify-center" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200">
        <div className="flex items-start gap-1.5 font-medium text-slate-700">
          Locked out?
          <HelpTip label="Account recovery">
            Staff ask a Team Lead or Developer for a password-reset email. The sole Developer uses
            the Vercel break-glass env flags documented in .env.example — never leave
            ADMIN_PASSWORD_RESET=1 set after you are back in.
          </HelpTip>
        </div>
        <p className="mt-1">
          Ask a Team Lead or Developer for a reset link (they send it from User admin). There is no
          self-serve forgot-password — that keeps account takeover off the public internet.
        </p>
      </div>
    </form>
  );
}
