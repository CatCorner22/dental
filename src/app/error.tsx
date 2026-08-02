"use client";

// App-level error boundary. Shows a calm recovery screen instead of a raw
// crash; never includes the error detail (it could echo note text).
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="mb-2 text-4xl" aria-hidden>
        🦷
      </p>
      <h1 className="mb-2 text-xl font-bold">Something went wrong</h1>
      <p className="mb-6 text-sm text-slate-600">
        Your draft is safe — auto-save keeps the last saved version. Try again, and tell your
        administrator if this keeps happening.
      </p>
      <button type="button" className="btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
