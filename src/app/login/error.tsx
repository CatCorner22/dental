"use client";

// The login segment's own error boundary, and why it must exist: a hydrated
// server-action POST that dies mid-flight (wifi drop between operatories)
// rejects into the nearest error boundary — it cannot be try/caught in the
// form without wrapping the server reference in a client closure, which makes
// React SSR a dead sentinel and kills the no-JS path entirely. Without this
// file that rejection lands in the app-wide boundary, whose copy talks about
// the note builder to someone who has not signed in yet.
//
// The copy is the fetch-era inline message, kept verbatim so the failure
// reads the same as it always has.
export default function LoginError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-14">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="section-title mb-2">Sign in</h1>
        <p className="text-sm text-red-700" role="alert">
          Could not reach the server — check the connection and try again.
        </p>
        <button type="button" className="btn-primary mt-4" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
