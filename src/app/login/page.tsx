import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { countUsers } from "@/lib/db/repo/users";
import { LoginForm } from "@/components/auth/LoginForm";
import { BrandMark } from "@/components/shell/BrandMark";
import { mfaFeatureEnabled } from "@/lib/auth/mfaFeature";
import { APP_TAGLINE, PRIVACY_POLICY } from "@/lib/brand";
import { Character } from "@/components/mascot/Sparkle";
import { daySeed, sparkleLine } from "@/lib/stats/sparkle";

export const metadata = { title: "Sign in" };

// The first screen anyone sees, and previously the least designed: a form
// floating unanchored on the cream ground. The card gives the credentials a
// surface, the gradient hairline is the same one-line brand gesture the
// primary button carries, and everything else stays quiet — a sign-in page
// earns trust by being calm, not by being loud.
export default async function LoginPage() {
  const db = await getDb();
  if ((await countUsers(db)) === 0) redirect("/setup");
  return (
    <div className="mx-auto max-w-md py-14">
      <div className="relative overflow-hidden rounded-2xl bg-white p-8 shadow-[0_4px_24px_rgba(59,43,102,0.10),0_1px_3px_rgba(59,43,102,0.06)] ring-1 ring-slate-200">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-navy via-brand-blue to-brand-teal"
        />
        <h1 className="mb-1">
          <BrandMark size="lg" />
        </h1>
        <p className="mb-4 text-sm text-slate-600">{APP_TAGLINE}. Sign in to continue.</p>
        {/* Sparkle on the sign-in card. Deterministic copy from a fixed table,
            like everywhere else she speaks — and the one screen in the app that
            is guaranteed to be seen by every person, every day. */}
        <div className="mb-6 flex items-center gap-2.5 rounded-lg bg-brand-cream/70 px-3 py-2">
          <Character id="sparkle" size="sm" />
          <p className="text-xs text-slate-600">{sparkleLine("signIn", daySeed(new Date()))}</p>
        </div>
        <LoginForm mfaAvailable={mfaFeatureEnabled()} />
        <p className="mt-4 text-[0.7rem] leading-relaxed text-slate-500">
          Developers: if the only Developer account is locked, set{" "}
          <code className="rounded bg-slate-100 px-1">ADMIN_USERNAME</code>,{" "}
          <code className="rounded bg-slate-100 px-1">ADMIN_PASSWORD</code>, and{" "}
          <code className="rounded bg-slate-100 px-1">ADMIN_PASSWORD_RESET=1</code> in Vercel,
          redeploy once, sign in, then remove the reset flag.
        </p>
      </div>
      {/* The policy conditions USE on agreement, so it has to be readable
          before the credentials are typed — not only in the footer of pages
          you reach after signing in. */}
      <p className="mt-6 px-2 text-xs leading-relaxed text-slate-500">{PRIVACY_POLICY}</p>
    </div>
  );
}
