import { ResetForm } from "@/components/auth/ResetForm";

export const runtime = "nodejs";
export const metadata = { title: "Set your password — Smile Notes" };
// The token is a credential in the URL; never let a proxy or CDN keep a copy.
export const dynamic = "force-dynamic";

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // The token is NOT validated here. Doing so would turn this page into an
  // oracle that says which links are real before anyone commits to using one,
  // and it would put the token through server-side rendering for no gain. The
  // POST handler is the single place that judges it.
  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="mb-1 text-2xl font-bold">Set your password</h1>
      <p className="mb-4 text-sm text-slate-500">
        This link works once and expires an hour after it was sent.
      </p>
      <ResetForm token={token} />
    </div>
  );
}
