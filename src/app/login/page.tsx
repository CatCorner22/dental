import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { countUsers } from "@/lib/db/repo/users";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Sign in — Dental Note Builder" };

export default async function LoginPage() {
  const db = await getDb();
  if ((await countUsers(db)) === 0) redirect("/setup");
  return (
    <div className="mx-auto max-w-md py-12">
      <h1 className="mb-1 text-2xl font-bold">🦷 Dental Note Builder</h1>
      <p className="mb-6 text-sm text-slate-600">Sign in to build and submit standardized notes.</p>
      <LoginForm />
    </div>
  );
}
