import { redirect } from "next/navigation";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { meetsRole } from "@/lib/auth/roles";
import { StoreFront } from "@/components/store/StoreFront";

export const runtime = "nodejs";
export const metadata = { title: "Clinic store" };

export default async function StorePage() {
  const user = await freshSessionUser();
  if (!user) redirect("/login");
  if (!meetsRole(user.role, "user")) redirect("/");
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold">Clinic store</h1>
      <p className="mb-4 max-w-2xl text-sm text-slate-600">
        Points come from clean, complete notes — the store turns them into real things the
        practice fulfils. Requesting sets the points aside immediately; a Team Lead approves or
        declines (with a reason, and an automatic refund).
      </p>
      <StoreFront />
    </div>
  );
}
