"use client";

import { useState } from "react";
import { VERIFIED_BLOCKS, type VerifiedBlock } from "@/lib/phrases/blocks";

// The verified-block picker: pre-loaded text that cannot be lazily clicked in.
//
// Three locks against click-through (see blocks.ts for the design):
//  1. Every checkbox IS an assertion — the label states the fact going into
//     the record, and none are pre-checked.
//  2. Insert stays disabled until every box is ticked.
//  3. The inserted text carries <placeholders> that the template-residue
//     audit rule blocks at S1 until each is replaced with this visit's facts.

export function BlockPicker({ onInsert }: { onInsert: (text: string) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <details className="mt-3 rounded border border-slate-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-700">
        Insert a verified block — faster than typing, impossible to file untouched
      </summary>
      <p className="mt-1 text-xs text-slate-500">
        Each block is the practice&rsquo;s standard wording for a fact pattern that fails in
        audits when it is missing. You confirm each statement it makes, then fill in this
        visit&rsquo;s specifics — the placeholders block the note until you do.
      </p>
      <ul className="mt-2 space-y-2">
        {VERIFIED_BLOCKS.map((block) => (
          <li key={block.id}>
            <BlockRow
              block={block}
              open={openId === block.id}
              onToggle={() => setOpenId(openId === block.id ? null : block.id)}
              onInsert={(text) => {
                onInsert(text);
                setOpenId(null);
              }}
            />
          </li>
        ))}
      </ul>
    </details>
  );
}

function BlockRow({
  block,
  open,
  onToggle,
  onInsert
}: {
  block: VerifiedBlock;
  open: boolean;
  onToggle: () => void;
  onInsert: (text: string) => void;
}) {
  const [checked, setChecked] = useState<boolean[]>(() => block.verify.map(() => false));
  const allChecked = checked.every(Boolean);

  return (
    <div className="rounded border border-slate-200">
      <button
        type="button"
        className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="font-medium">{block.title}</span>
        <span className="text-xs text-slate-500">{block.purpose}</span>
      </button>
      {open && (
        <div className="border-t border-slate-200 px-3 py-2">
          <pre className="whitespace-pre-wrap rounded bg-slate-50 p-2 font-mono text-xs text-slate-700">
            {block.body}
          </pre>
          <fieldset className="mt-2">
            <legend className="text-xs font-semibold text-slate-700">
              Confirm each statement — these enter the record with your name:
            </legend>
            {block.verify.map((assertion, i) => (
              <label key={i} className="mt-1 flex items-start gap-2 text-xs text-slate-800">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked[i]}
                  onChange={(e) =>
                    setChecked((prev) => prev.map((c, j) => (j === i ? e.target.checked : c)))
                  }
                />
                <span>{assertion}</span>
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            className="btn-primary mt-2 text-xs"
            disabled={!allChecked}
            title={
              allChecked
                ? "Insert into your note"
                : "Every statement must be confirmed first — the checkboxes are the attestation."
            }
            onClick={() => {
              if (allChecked) {
                onInsert(block.body);
                setChecked(block.verify.map(() => false));
              }
            }}
          >
            {allChecked ? "Insert into note" : "Confirm every statement to insert"}
          </button>
        </div>
      )}
    </div>
  );
}
