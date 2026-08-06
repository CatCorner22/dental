"use client";

import { useEffect, useState } from "react";
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
  // Whether the picker has ever been opened. A <details> renders its children
  // whether or not it is open, so MyBlocks used to fetch on mount — which was
  // harmless on a page you navigated to and is not on the home page, where the
  // note builder mounts the instant someone signs in. Every API refuses with
  // 403 until the legal-record notice is acknowledged, so that fetch raced the
  // notice dialog and lost, logging a console error on the first load of the
  // app. Fetching when the picker is actually opened fixes the race and stops
  // a request nobody asked for on every note.
  const [everOpened, setEverOpened] = useState(false);

  return (
    <details
      className="mt-3 rounded border border-slate-200 bg-white p-3"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) setEverOpened(true);
      }}
    >
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
      {everOpened && <MyBlocks onInsert={onInsert} />}
    </details>
  );
}

interface MyBlock {
  id: number;
  title: string;
  body: string;
}

// PERSONAL BLOCKS — the writer's own starting text, saved to their account.
//
// Different trust model from the verified blocks above: these are the
// writer's OWN words, so there is no assertion checklist — but the server
// refuses to save one containing an identifier, and whatever is inserted
// still faces the full audit and resolution queue like hand-typed text.
function MyBlocks({ onInsert }: { onInsert: (text: string) => void }) {
  const [blocks, setBlocks] = useState<MyBlock[] | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/me/blocks")
      .then((r) => r.json())
      .then((d: { blocks?: MyBlock[] }) => {
        if (!cancelled) setBlocks(Array.isArray(d.blocks) ? d.blocks : []);
      })
      .catch(() => {
        if (!cancelled) setBlocks([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/me/blocks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, body })
      });
      const data = (await res.json().catch(() => ({}))) as { block?: MyBlock; error?: string };
      if (!res.ok || !data.block) {
        setError(data.error ?? "Could not save the block.");
      } else {
        setBlocks((prev) => [data.block!, ...(prev ?? [])]);
        setTitle("");
        setBody("");
        setFormOpen(false);
      }
    } catch {
      setError("Could not reach the server — try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    setBlocks((prev) => (prev ?? []).filter((b) => b.id !== id));
    // Optimistic: a failed delete resurfaces on the next page load, which is
    // the right failure mode for a personal convenience list.
    void fetch(`/api/me/blocks/${id}`, { method: "DELETE" }).catch(() => undefined);
  };

  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700">My blocks — your own starting text</p>
        <button
          type="button"
          className="text-xs text-brand-blue underline"
          onClick={() => setFormOpen((v) => !v)}
        >
          {formOpen ? "Cancel" : "+ Save a new block"}
        </button>
      </div>
      {formOpen && (
        <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2">
          <input
            className="field-input py-1 text-xs"
            placeholder="Block name (for example: My adult recall opener)"
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="New block title"
          />
          <textarea
            className="field-input mt-1.5 min-h-[5rem] font-mono text-xs"
            placeholder="De-identified starting text. Identifiers are refused — a saved block would repeat them into every future note."
            value={body}
            maxLength={4000}
            onChange={(e) => setBody(e.target.value)}
            aria-label="New block text"
          />
          <button
            type="button"
            className="btn-primary mt-1.5 text-xs"
            disabled={saving || !title.trim() || !body.trim()}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save block"}
          </button>
          {error && (
            <p className="mt-1 text-xs text-red-700" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
      {blocks === null ? (
        <p className="mt-1.5 text-xs text-slate-400">Loading…</p>
      ) : blocks.length === 0 ? (
        !formOpen && (
          <p className="mt-1.5 text-xs text-slate-500">
            None yet. Save the openings you retype most — a recall visit, your op-note skeleton —
            and start 80% written.
          </p>
        )
      ) : (
        <ul className="mt-1.5 space-y-1">
          {blocks.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-2 rounded border border-slate-200 px-2.5 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800" title={b.body}>
                {b.title}
              </span>
              <button type="button" className="btn-secondary shrink-0 text-xs" onClick={() => onInsert(b.body)}>
                Insert
              </button>
              <button
                type="button"
                className="shrink-0 text-xs text-slate-400 underline hover:text-rose-700"
                onClick={() => void remove(b.id)}
                aria-label={`Delete block "${b.title}"`}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
