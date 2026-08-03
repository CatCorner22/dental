import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { countUsers } from "@/lib/db/repo/users";
import { LoginForm } from "@/components/auth/LoginForm";
import { BrandMark } from "@/components/shell/BrandMark";
import { APP_TAGLINE, PRIVACY_POLICY } from "@/lib/brand";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const db = await getDb();
  if ((await countUsers(db)) === 0) redirect("/setup");
  return (
    <div className="mx-auto max-w-md py-12">
      <h1 className="mb-1">
        <BrandMark size="lg" />
      </h1>
      <p className="mb-6 text-sm text-slate-600">{APP_TAGLINE}. Sign in to continue.</p>
      <LoginForm />
      {/* The policy conditions USE on agreement, so it has to be readable
          before the credentials are typed — not only in the footer of pages
          you reach after signing in. */}
      <p className="mt-6 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
        {PRIVACY_POLICY}
      </p>
    </div>
  );
}
