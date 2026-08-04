"use client";

import { useMemo, useState } from "react";
import type { WordMapGroup } from "@/lib/standardize/wordMap";

// The word map, rendered. Search-first, because the way anyone actually uses a
// vocabulary reference is "what am I supposed to say instead of X" — not
// reading 200 rows top to bottom.
export function WordMap({ groups, total, auto }: { groups: WordMapGroup[]; total: number; auto: number }) {
  const [q, setQ] = useState("");
  // Collapsed by default. This component's own premise — search-first, "not
  // reading 200 rows top to bottom" — was contradicted by opening the first
  // group on load, which on the dashboard dumped 87 term-of-art rows below the
  // draft list and stretched the primary "start a note" screen to ~4,000px.
  // Progressive disclosure (UIX-H07): the reader searches, or expands the one
  // category they want. The count line still advertises the full total.
  const [openId, setOpenId] = useState<string | null>(null);

  const needle = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) return groups;
    return groups
      .map((g) => ({
        ...g,
        entries: g.entries.filter(
          (e) => e.avoid.toLowerCase().includes(needle) || e.use.toLowerCase().includes(needle)
        )
      }))
      .filter((g) => g.entries.length > 0);
  }, [groups, needle]);

  const hits = filtered.reduce((n, g) => n + g.entries.length, 0);

  return (
    <div>
      <div className="mb-3">
        <label className="field-label" htmlFor="wm-search">
          Search the standard wording
        </label>
        <input
          id="wm-search"
          type="search"
          className="field-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. x-ray, tolerated, abcess"
          aria-describedby="wm-count"
        />
        <p id="wm-count" className="mt-1 text-xs text-slate-500" aria-live="polite">
          {needle
            ? `${hits} match${hits === 1 ? "" : "es"}`
            : `${total} entries · ${auto} the tool applies for you · ${total - auto} need your judgement`}
        </p>
      </div>

      <div className="space-y-2">
        {filtered.map((g) => {
          // While searching, every matching group is open — collapsing a result
          // the user just searched for makes them click twice to see it.
          const open = needle ? true : openId === g.id;
          return (
            <section key={g.id} className="rounded-xl bg-white ring-1 ring-slate-200">
              <h3>
                <button
                  type="button"
                  className="tap flex w-full items-center justify-between gap-2 px-3 text-left"
                  aria-expanded={open}
                  aria-controls={`wm-${g.id}`}
                  onClick={() => setOpenId(open && !needle ? null : g.id)}
                  disabled={Boolean(needle)}
                >
                  <span className="font-semibold">
                    {g.title}{" "}
                    <span className="font-normal text-slate-500">({g.entries.length})</span>
                  </span>
                  {!needle && <span aria-hidden="true">{open ? "−" : "+"}</span>}
                </button>
              </h3>
              {open && (
                <div id={`wm-${g.id}`} className="border-t border-slate-100 px-3 py-2">
                  <p className="mb-2 text-xs text-slate-500">{g.blurb}</p>
                  <ul className="space-y-1">
                    {g.entries.map((e, i) => (
                      <li
                        key={`${e.avoid}-${i}`}
                        className="grid gap-x-3 gap-y-0.5 border-b border-slate-50 py-1 text-sm last:border-0 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,2fr)] sm:items-baseline"
                      >
                        <span className="font-mono text-slate-700 line-through decoration-slate-300">
                          {e.avoid}
                        </span>
                        <span aria-hidden="true" className="hidden text-slate-400 sm:inline">
                          →
                        </span>
                        <span>
                          {e.use}
                          {!e.auto && (
                            <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-900">
                              your call
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })}
        {filtered.length === 0 && (
          <p className="rounded border border-slate-200 bg-white p-3 text-sm text-slate-500">
            Nothing matches “{q}”. That wording may already be standard.
          </p>
        )}
      </div>
    </div>
  );
}
