import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="mb-2 text-4xl" aria-hidden>
        🦷
      </p>
      <h1 className="mb-2 text-xl font-bold">Page not found</h1>
      <p className="mb-6 text-sm text-slate-600">
        This page does not exist, or you do not have access to it.
      </p>
      <Link className="btn-primary inline-flex" href="/">
        Back to the dashboard
      </Link>
    </div>
  );
}
