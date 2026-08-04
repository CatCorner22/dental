import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { countUsers } from "@/lib/db/repo/users";
import { LoginForm } from "@/components/auth/LoginForm";
import { BrandMark } from "@/components/shell/BrandMark";
import { APP_TAGLINE, PRIVACY_POLICY } from "@/lib/brand";

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
      <div className="relative overflow-hidden rounded-2xl bg-white p-8 shadow-[0_4px_24px_rgba(30,58,95,0.10),0_1px_3px_rgba(30,58,95,0.06)] ring-1 ring-slate-200">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-navy via-brand-blue to-brand-teal"
        />
        <h1 className="mb-1">
          <BrandMark size="lg" />
        </h1>
        <p className="mb-6 text-sm text-slate-600">{APP_TAGLINE}. Sign in to continue.</p>
        <LoginForm />
      </div>
      {/* The policy conditions USE on agreement, so it has to be readable
          before the credentials are typed — not only in the footer of pages
          you reach after signing in. */}
      <p className="mt-6 px-2 text-xs leading-relaxed text-slate-500">{PRIVACY_POLICY}</p>
    </div>
  );
}
