"use client";

import { useEffect, useState } from "react";

/**
 * Personal starters as a single closed chip — no second card above the note.
 * Prefer inserting into the focused prose field; fall back to Visit narrative.
 */
export function PinnedMyBlocks({
  canEdit,
  onInsert
}: {
  canEdit: boolean;
  onInsert: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [blocks, setBlocks] = useState<{ id: number; title: string; body: string }[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || blocks !== null) return;
    let cancelled = false;
    void fetch("/api/me/blocks")
      .then((r) => r.json())
      .then((d: { blocks?: { id: number; title: string; body: string }[] }) => {
        if (!cancelled) setBlocks(Array.isArray(d.blocks) ? d.blocks : []);
      })
      .catch(() => {
        if (!cancelled) {
          setBlocks([]);
          setError("Could not load your blocks.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, blocks]);

  if (!canEdit) return null;

  return (
    <div className={open ? "basis-full mt-1.5" : "contents"}>
      <button
        type="button"
        className="chip"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        My blocks {open ? "▾" : "▸"}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <p className="text-[0.7rem] leading-snug text-slate-600">
            Your personal starters. Inserts into the box you are in, or the Visit narrative if none
            is focused.
          </p>
          {error && (
            <p className="text-xs text-rose-700" role="alert">
              {error}
            </p>
          )}
          {blocks === null && <p className="text-xs text-slate-500">Loading…</p>}
          {blocks && blocks.length === 0 && (
            <p className="text-xs text-slate-500">
              None yet. Save one under a field&rsquo;s Verified block → My blocks.
            </p>
          )}
          {blocks && blocks.length > 0 && (
            <ul className="space-y-1">
              {blocks.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-slate-800" title={b.body}>
                    {b.title}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary shrink-0 text-xs"
                    onClick={() => {
                      onInsert(b.body);
                      setOpen(false);
                    }}
                  >
                    Insert
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
