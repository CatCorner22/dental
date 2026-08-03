import { redirect } from "next/navigation";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { AccountForm } from "@/components/account/AccountForm";
import { RevokeSessions } from "@/components/account/RevokeSessions";
import { MfaSettings } from "@/components/account/MfaSettings";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { getUserById } from "@/lib/db/repo/users";

export const runtime = "nodejs";
export const metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await freshSessionUser(); // fresh display name and role
  if (!user) redirect("/login");
  const row = await getUserById(await getDb(), user.id);
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-bold">My account</h1>
      <dl className="mb-6 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="font-semibold text-slate-600">Username</dt>
        <dd className="font-mono">{user.username}</dd>
        <dt className="font-semibold text-slate-600">Display name</dt>
        <dd>{user.displayName}</dd>
        <dt className="font-semibold text-slate-600">Role</dt>
        <dd>{ROLE_LABEL[user.role]}</dd>
      </dl>
      <h2 className="mb-2 text-lg font-semibold">Change password</h2>
      <AccountForm />
      <h2 className="mb-2 mt-8 text-lg font-semibold">Two-factor authentication</h2>
      <MfaSettings enabled={row?.mfaEnabled ?? false} />
      <h2 className="mb-2 mt-8 text-lg font-semibold">Session security</h2>
      <RevokeSessions />
    </div>
  );
}
