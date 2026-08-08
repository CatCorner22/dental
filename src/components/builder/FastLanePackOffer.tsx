"use client";

import { useState } from "react";

import type { VerifiedBlock } from "@/lib/phrases/blocks";
import { BlockRow } from "@/components/standardize/BlockPicker";

/**
 * Optional attested pack starters after a Fast Lane apply.
 *
 * Fast Lane already added modules only. This panel asks before showing any
 * BlockRow — nothing clinical is inserted until each statement is confirmed.
 * "Not now" dismisses without writing.
 */
export function FastLanePackOffer({
  packTitles,
  blocks,
  onDismiss,
  onInsert
}: {
  packTitles: readonly string[];
  blocks: readonly VerifiedBlock[];
  onDismiss: () => void;
  onInsert: (blockId: string, text: string) => void;
}) {
  const [accepted, setAccepted] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(() => blocks.map((b) => b.id));

  if (blocks.length === 0) return null;

  const visible = blocks.filter((b) => remaining.includes(b.id));
  if (visible.length === 0) return null;

  const packLabel =
    packTitles.length === 0
      ? "a matching practice pack"
      : packTitles.length === 1
        ? `“${packTitles[0]}”`
        : packTitles.map((t) => `“${t}”`).join(", ");

  return (
    <section
      className="rounded-lg border border-slate-200 bg-slate-50 p-2.5"
      aria-label="Pack starters offer"
    >
      {!accepted ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <p className="min-w-0 flex-1 text-sm text-slate-800">
            Offer pack starters from {packLabel}? Modules are already on the note.
            Starters still need per-block confirmation — nothing is filled in yet.
          </p>
          <button type="button" className="btn-primary text-xs" onClick={() => setAccepted(true)}>
            Yes — show starters
          </button>
          <button type="button" className="btn-secondary text-xs" onClick={onDismiss}>
            Not now
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[0.7rem] leading-snug text-slate-600">
              Optional attested templates from {packLabel}. Confirm each statement, then replace
              the placeholders — filing stays blocked until you do. Nothing is inserted until you
              confirm.
            </p>
            <button type="button" className="text-xs text-slate-500 underline" onClick={onDismiss}>
              Dismiss
            </button>
          </div>
          {visible.map((block) => (
            <BlockRow
              key={block.id}
              block={block}
              open={openId === block.id}
              onToggle={() => setOpenId(openId === block.id ? null : block.id)}
              onInsert={(text) => {
                onInsert(block.id, text);
                setOpenId(null);
                const next = remaining.filter((id) => id !== block.id);
                setRemaining(next);
                if (next.length === 0) onDismiss();
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
