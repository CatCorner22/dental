import { redirect } from "next/navigation";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { ReferenceNav } from "@/components/reference/ReferenceNav";

export const runtime = "nodejs";

// The reference pages were the only family relying on middleware alone. The
// project's own rule (guards.ts) is that middleware is convenience and every
// route checks for itself, so one guard here covers every reference route. The
// content is internal training material rather than patient data, but a page
// whose protection lives in exactly one place is a page that loses it the day
// someone edits the matcher.
export default async function ReferenceLayout({ children }: { children: React.ReactNode }) {
  const user = await freshSessionUser();
  if (!user) redirect("/login");
  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <ReferenceNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
