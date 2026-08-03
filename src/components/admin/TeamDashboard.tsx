"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface TeamView {
  clinicGpa: number | null;
  medianTimeToFile: number | null;
  afterHoursFilings: number;
  /** Share of graded filings whose billing narrative was complete at filing. */
  narrativeReadyRate: number | null;
  members: {
    displayName: string;
    band: "thriving" | "stable" | "support";
    coachingTip: string | null;
  }[];
  redemptions: {
    id: number;
    userName: string;
    itemTitle: string;
    cost: number;
    status: string;
    createdAt: string;
  }[];
}

const BAND_LABEL = {
  thriving: { label: "Thriving", cls: "border-green-300 bg-green-50 text-green-900" },
  stable: { label: "Cruising", cls: "border-slate-200 bg-white text-slate-700" },
  support: { label: "Support offered", cls: "border-sky-300 bg-sky-50 text-sky-900" }
} as const;

export function TeamDashboard({ view }: { view: TeamView }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const decide = async (id: number, approve: boolean) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/store/redemptions/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approve, note })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Could not decide that request.");
      else {
        setNoteFor(null);
        setNote("");
        router.refresh();
      }
    } catch {
      setError("Could not reach the server.");
    }
    setBusy(false);
  };

  const open = view.redemptions.filter((r) => r.status === "requested");

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Macro label="Clinic GPA (all graded notes)" value={view.clinicGpa?.toFixed(2) ?? "—"} />
        <Macro
          label="Median same-day time to file"
          value={view.medianTimeToFile === null ? "—" : `${view.medianTimeToFile} min`}
        />
        <Macro label="After-hours filings" value={String(view.afterHoursFilings)} />
        <Macro
          label="Billing narrative complete at filing"
          value={view.narrativeReadyRate === null ? "—" : `${Math.round(view.narrativeReadyRate * 100)}%`}
        />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Coaching matrix</h2>
        {view.members.length === 0 ? (
          <p className="text-sm text-slate-500">
            Bands appear once people have three or more graded filings in the last thirty days.
          </p>
        ) : (
          <ul className="space-y-2">
            {view.members.map((m) => (
              <li key={m.displayName} className={`rounded border px-3 py-2 text-sm ${BAND_LABEL[m.band].cls}`}>
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{m.displayName}</span>
                  <span className="text-xs font-semibold uppercase">{BAND_LABEL[m.band].label}</span>
                </div>
                {m.coachingTip && <p className="mt-0.5 text-xs">{m.coachingTip}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">
          Store fulfillment {open.length > 0 && <span className="text-sm font-normal text-amber-700">({open.length} waiting)</span>}
        </h2>
        {error && (
          <p className="mb-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
            {error}
          </p>
        )}
        {view.redemptions.length === 0 ? (
          <p className="text-sm text-slate-500">No requests yet.</p>
        ) : (
          <ul className="space-y-2">
            {view.redemptions.map((r) => (
              <li key={r.id} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    <span className="font-medium">{r.userName}</span> — {r.itemTitle}{" "}
                    <span className="text-xs text-slate-500">({r.cost.toLocaleString()} pts)</span>
                  </span>
                  {r.status === "requested" ? (
                    <span className="flex gap-2">
                      <button className="btn-primary text-xs" disabled={busy} onClick={() => decide(r.id, true)}>
                        Approve
                      </button>
                      <button
                        className="btn-secondary text-xs"
                        disabled={busy}
                        onClick={() => setNoteFor(noteFor === r.id ? null : r.id)}
                      >
                        Decline…
                      </button>
                    </span>
                  ) : (
                    <span className="text-xs font-semibold uppercase text-slate-500">{r.status}</span>
                  )}
                </div>
                {noteFor === r.id && (
                  <div className="mt-2 flex items-end gap-2">
                    <div className="grow">
                      <label className="field-label" htmlFor={`decline-${r.id}`}>
                        Why not? The person who asked reads this, and the points refund automatically.
                      </label>
                      <input
                        id={`decline-${r.id}`}
                        className="field-input text-sm"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </div>
                    <button
                      className="btn-secondary text-xs"
                      disabled={busy || note.trim().length === 0}
                      onClick={() => decide(r.id, false)}
                    >
                      Decline
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Macro({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
      <div className="text-xl font-bold text-slate-800">{value}</div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
}
