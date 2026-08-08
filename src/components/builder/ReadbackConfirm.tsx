"use client";

import { useEffect, useMemo, useState } from "react";
import { diffReadback } from "@/lib/readback/readbackClass";

/**
 * ICAO-style scoped readback on Accept.
 *
 * When the proposal changes tooth / surface / laterality / drug / dose tokens,
 * Apply stays disabled until the writer confirms that short list. Wording-only
 * rewrites (pt → patient) stay one-click. Keep mine is always free.
 */
export function ApplyWithReadback({
  before,
  after,
  applyLabel,
  keepLabel = "Keep mine",
  onApply,
  onKeep
}: {
  before: string;
  after: string;
  applyLabel: string;
  keepLabel?: string;
  onApply: () => void;
  onKeep: () => void;
}) {
  const diff = useMemo(() => diffReadback(before, after), [before, after]);
  const [acked, setAcked] = useState(false);
  useEffect(() => {
    setAcked(false);
  }, [before, after]);

  const canApply = !diff.requiresConfirm || acked;

  return (
    <div className="w-full space-y-2">
      {diff.requiresConfirm && (
        <div
          className="rounded border border-amber-300 bg-amber-50 px-2.5 py-2"
          data-testid="readback-confirm"
        >
          <p className="text-xs font-semibold text-amber-950">Confirm safety tokens</p>
          <p className="mt-0.5 text-[0.7rem] text-amber-950/90">
            Tooth, surface, side, drug, or dose changed in this proposal. Check them before
            Apply — same idea as a radio readback, not a full re-read of the paragraph.
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Safety tokens to confirm">
            {diff.confirmItems.map((t) => (
              <li
                key={t.key + t.label}
                className="rounded bg-white px-1.5 py-0.5 text-xs font-medium text-slate-900 ring-1 ring-amber-200"
              >
                {t.label}
              </li>
            ))}
          </ul>
          <label className="mt-2 flex items-start gap-2 text-xs text-amber-950">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={acked}
              onChange={(e) => setAcked(e.target.checked)}
              data-testid="readback-ack"
            />
            <span>
              I confirmed: {diff.confirmItems.map((t) => t.label).join(" · ")}.
            </span>
          </label>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-primary text-xs"
          disabled={!canApply}
          onClick={onApply}
        >
          {applyLabel}
        </button>
        <button type="button" className="chip" onClick={onKeep}>
          {keepLabel}
        </button>
      </div>
    </div>
  );
}
