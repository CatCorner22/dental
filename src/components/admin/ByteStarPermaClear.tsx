"use client";

import { useState } from "react";

export function ByteStarPermaClear() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <h2 className="text-sm font-semibold text-brand-navy">Clear ladder perma-kill</h2>
      <p className="mt-1 text-xs text-slate-600">
        Use only after review. This re-opens the pioneer door when the model tripped the third escape
        within an hour of its warning. Does not change BYTESTAR_KILL in the environment.
      </p>
      <button
        type="button"
        className="btn-secondary mt-2 text-xs"
        disabled={pending}
        onClick={() => {
          setPending(true);
          setMsg(null);
          void fetch("/api/bytestar", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "perma-clear" })
          })
            .then(async (r) => {
              if (!r.ok) {
                // Surface the server's actual reason. The old fixed "Team Lead
                // access required" message showed even when the failure was
                // something else entirely, which made the latch look broken.
                const data = (await r.json().catch(() => ({}))) as { error?: string };
                throw new Error(data.error ?? `Could not clear (HTTP ${r.status}).`);
              }
              setMsg("Perma-kill cleared. Refresh to see updated status.");
            })
            .catch((e: Error) =>
              setMsg(e.message || "Could not reach the server — check the connection and try again.")
            )
            .finally(() => setPending(false));
        }}
      >
        {pending ? "Clearing…" : "Clear perma-kill latch"}
      </button>
      {msg && <p className="mt-2 text-xs text-slate-700">{msg}</p>}
    </div>
  );
}
