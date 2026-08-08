"use client";

import { useEffect, useState } from "react";

const DEFAULT_PIN_LIMIT = 5;

/**
 * Personal starters on the builder chrome — always visible when the writer
 * has saved blocks (market UX: Curve QuickText analogue, not a closed chip
 * buried in Fast Lane). Caps at five Insert chips so the strip stays scannable.
 */
export function PinnedMyBlocks({
  canEdit,
  onInsert,
  limit = DEFAULT_PIN_LIMIT
}: {
  canEdit: boolean;
  onInsert: (text: string) => void;
  /** Max chips shown — research: pin 3–5. */
  limit?: number;
}) {
  const [blocks, setBlocks] = useState<{ id: number; title: string; body: string }[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canEdit) return;
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
  }, [canEdit]);

  if (!canEdit) return null;

  const pinned = (blocks ?? []).slice(0, Math.max(1, Math.min(limit, 5)));

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5" aria-label="My blocks">
      <span className="eyebrow shrink-0">My blocks</span>
      {blocks === null && <span className="text-xs text-slate-500">Loading…</span>}
      {error && (
        <span className="text-xs text-rose-700" role="alert">
          {error}
        </span>
      )}
      {blocks && blocks.length === 0 && (
        <span className="text-xs text-slate-500">
          None yet — save one under a field&rsquo;s Verified block.
        </span>
      )}
      {pinned.map((b) => (
        <button
          key={b.id}
          type="button"
          className="chip max-w-[12rem] truncate"
          title={b.body}
          onClick={() => onInsert(b.body)}
        >
          {b.title}
        </button>
      ))}
      {blocks && blocks.length > pinned.length && (
        <span className="text-xs text-slate-600">+{blocks.length - pinned.length} more in field picker</span>
      )}
    </div>
  );
}
