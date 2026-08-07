"use client";

import { useState } from "react";
import { VERIFIED_BLOCKS } from "@/lib/phrases/blocks";
import { BlockRow, MyBlocks } from "@/components/standardize/BlockPicker";

// VERIFIED BLOCKS, AT THE POINT OF WRITING.
//
// This is the same picker that used to sit in a card above the note, behind a
// "Insert verified blocks into [destination]" dropdown. That arrangement had
// the order of operations backwards twice over: it asked the writer to choose a
// destination before they had chosen a block, and it put a tool used
// occasionally in front of the fields used every single time.
//
// Here there is no destination to choose. The block goes into the box the
// cursor is already in, which is the only field it could sensibly have meant.
//
// The three locks that make a verified block safe are untouched, because this
// reuses BlockRow rather than reimplementing it: every assertion in the block is
// a checkbox the writer must tick, Insert stays disabled until they all are, and
// the inserted text carries <placeholders> the residue rule blocks at S1 until
// this visit's facts replace them.
//
// Closed by default and rendered as one small chip, so a writer who is simply
// typing pays a line of text for it and nothing else.
export function BlockChips({
  onInsert,
  active
}: {
  onInsert: (text: string) => void;
  /**
   * Whether this field is where the writer currently is — focused, or already
   * holding text.
   *
   * Without it the chip rendered under every textarea, so the Visit narrative
   * alone opened with three identical "Verified block" controls stacked down an
   * untouched note. A control offered everywhere is a control offered nowhere;
   * this one belongs to the box the cursor is in.
   */
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  if (!active && !open) return null;

  return (
    // The chip shares a line with its neighbours (see the chip row in
    // inputs.tsx); the panel it opens takes the whole width back, because a
    // list of verified blocks squeezed into a third of a column is unreadable.
    <div className={open ? "mt-1 w-full" : "mt-1"}>
      <button
        type="button"
        className="chip"
        aria-expanded={open}
        // Do not let the press move focus.
        //
        // Safari and Firefox on macOS do not focus a <button> when it is
        // clicked. The field's focusout therefore fired with a null
        // relatedTarget — indistinguishable from leaving the field — and the
        // chip unmounted between mousedown and click. The click landed on
        // nothing, so on those two browsers verified blocks could not be opened
        // on an empty field at all. Preventing the default on mousedown keeps
        // the caret in the textarea, which is also where it should be when the
        // panel opens. Keyboard users are unaffected: Tab still focuses the
        // button, and the wrapper in inputs.tsx sees that as staying put.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        Verified block {open ? "▾" : "▸"}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <p className="text-[0.7rem] leading-snug text-slate-600">
            The practice&rsquo;s standard wording for a fact pattern that fails audits when it is
            missing. Confirm each statement, then replace the placeholders with this visit&rsquo;s
            facts — they block filing until you do.
          </p>
          {VERIFIED_BLOCKS.map((block) => (
            <BlockRow
              key={block.id}
              block={block}
              open={openId === block.id}
              onToggle={() => setOpenId(openId === block.id ? null : block.id)}
              onInsert={(text) => {
                onInsert(text);
                setOpenId(null);
                setOpen(false);
              }}
            />
          ))}
          {/* The writer's OWN saved blocks, and the only way to create or delete
              one. This used to hang off BlockPicker, which this component
              replaced — dropping it would have made every block a person had
              already saved unreachable, and the whole feature write-only.

              Mounted inside `open`, so the fetch happens the first time the
              panel is opened rather than on mount. That timing is load-bearing:
              every API refuses with 403 until the legal-record notice is
              acknowledged, and the note builder mounts the instant someone signs
              in — a fetch on mount raced the notice dialog and lost, logging a
              console error on the first load of the app. */}
          <MyBlocks onInsert={onInsert} />
        </div>
      )}
    </div>
  );
}
