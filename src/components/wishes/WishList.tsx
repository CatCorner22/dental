"use client";

import { Character } from "@/components/mascot/Sparkle";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORY_LABEL,
  ruleDisagreementStats,
  STATUS_LABEL,
  WISH_CATEGORIES,
  WISH_DETAIL_MAX,
  WISH_STATUSES,
  WISH_TITLE_MAX,
  wishError,
  type WishCategory,
  type WishStatus
} from "@/lib/wishes/wishes";

export interface WishRowView {
  id: number;
  authorName: string;
  category: string;
  title: string;
  detail: string;
  status: string;
  decidedByName: string | null;
  decidedNote: string | null;
  createdAtLabel: string;
}

const STATUS_CLASS: Record<string, string> = {
  new: "bg-brand-blue/20 text-brand-navy",
  looking: "bg-amber-100 text-amber-900",
  planned: "bg-violet-100 text-violet-900",
  done: "bg-green-100 text-green-900",
  declined: "bg-slate-200 text-slate-700"
};

async function send(url: string, init: RequestInit) {
  try {
    const res = await fetch(url, init);
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.ok) return { ok: true as const };
    return { ok: false as const, error: data.error ?? "That did not work." };
  } catch {
    return { ok: false as const, error: "Network problem — check the connection and try again." };
  }
}

export function WishList({ wishes, canDecide }: { wishes: WishRowView[]; canDecide: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"open" | "all" | WishCategory>("open");
  const [notice, setNotice] = useState("");

  const shown = useMemo(() => {
    if (filter === "all") return wishes;
    if (filter === "open") return wishes.filter((w) => w.status !== "done" && w.status !== "declined");
    return wishes.filter((w) => w.category === filter);
  }, [wishes, filter]);

  const openStandards = wishes.filter(
    (w) => w.category === "standards" && w.status !== "done" && w.status !== "declined"
  ).length;

  const driftStats = useMemo(() => ruleDisagreementStats(wishes), [wishes]);

  return (
    <div className="space-y-4">
      <WishForm
        onDone={(msg) => {
          setNotice(msg);
          router.refresh();
        }}
      />

      {notice && (
        <p className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900" role="status">
          {notice}
        </p>
      )}

      {openStandards > 0 && (
        // Surfaced above the list, not buried in it: a below-standard
        // observation that scrolls off the page is the same as one nobody made.
        <p className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          {openStandards} open {openStandards === 1 ? "report" : "reports"} of something below
          standard.
        </p>
      )}

      {canDecide && driftStats.length > 0 && (
        // The calibration panel: which Smile Notes rules staff are disputing.
        // Visible only to the people who can settle a dispute — a rule with a
        // pile of open disagreements either needs tuning (send it through the
        // Gauntlet) or needs explaining (a training moment). Either way the
        // pattern is the signal; this is how the tool learns without ever
        // adjusting itself.
        <div className="rounded border border-violet-300 bg-violet-50 px-3 py-2 text-sm text-violet-950">
          <p className="font-medium">Rules staff are disputing</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {driftStats.slice(0, 5).map((s) => (
              <li key={s.rule}>
                <code className="rounded bg-white px-1">{s.rule}</code> — {s.open} open,{" "}
                {s.settled} settled
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["open", "Open"],
            ["all", "Everything"],
            ...WISH_CATEGORIES.map((c) => [c.id, c.label] as const)
          ] as [string, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key as typeof filter)}
            className={`tap rounded-full border px-3 text-sm ${
              filter === key
                ? "border-brand-blue bg-brand-blue text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="flex items-center gap-3 rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">
          <Character id="sparkle" size="sm" />
          <p>
            Nothing here yet. If you have noticed something — a supply running low, a step that
            takes too long, anything below standard — add it above.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map((w) => (
            <WishCard key={w.id} wish={w} canDecide={canDecide} onChanged={() => router.refresh()} />
          ))}
        </ul>
      )}
    </div>
  );
}

function WishCard({
  wish,
  canDecide,
  onChanged
}: {
  wish: WishRowView;
  canDecide: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<WishStatus>(wish.status as WishStatus);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isStandards = wish.category === "standards";
  const settled = wish.status === "done" || wish.status === "declined";

  const save = async () => {
    setBusy(true);
    setError("");
    const res = await send(`/api/wishes/${wish.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, note })
    });
    if (res.ok) {
      setOpen(false);
      setNote("");
      onChanged();
    } else {
      setError(res.error);
    }
    setBusy(false);
  };

  return (
    <li
      className={`rounded-lg border bg-white p-3 ${
        isStandards && !settled ? "border-amber-400" : "border-slate-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{wish.title}</p>
          <p className="text-xs text-slate-500">
            {CATEGORY_LABEL[wish.category as WishCategory] ?? wish.category} ·{" "}
            {/* Non-anonymous by design: a supply request needs someone to ask
                follow-up questions of, and a standards concern needs someone
                who can describe what they saw. */}
            {wish.authorName} · {wish.createdAtLabel}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            STATUS_CLASS[wish.status] ?? STATUS_CLASS.new
          }`}
        >
          {STATUS_LABEL[wish.status as WishStatus] ?? wish.status}
        </span>
      </div>

      {wish.detail && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{wish.detail}</p>
      )}

      {/* Rendered whenever there is a DECIDER, not only when there is a note.
          Nesting the name inside the note meant a note-less close showed no
          name at all: the card just turned green with nobody attached to the
          decision. Who closed it is the part that must never be missing. */}
      {wish.decidedByName && (
        <p className="mt-2 rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm">
          <span className="text-slate-500">{wish.decidedByName}:</span>{" "}
          {wish.decidedNote || <span className="italic text-slate-500">no reply given</span>}
        </p>
      )}

      {canDecide && (
        <div className="mt-2">
          {open ? (
            <div className="space-y-2">
              <div>
                <label className="field-label" htmlFor={`st-${wish.id}`}>
                  Status
                </label>
                <select
                  id={`st-${wish.id}`}
                  className="field-input w-auto"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as WishStatus)}
                >
                  {WISH_STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor={`nt-${wish.id}`}>
                  Reply{" "}
                  {/* Declining always needs a reason; CLOSING one needs it too
                      when the report is about something below standard. */}
                  {(status === "declined" || (isStandards && status === "done")) && (
                    <span className="text-red-700">(required)</span>
                  )}
                </label>
                <textarea
                  id={`nt-${wish.id}`}
                  className="field-input"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    status === "declined"
                      ? "Say why. They are named, so they deserve an answer."
                      : "Optional note back to them."
                  }
                />
              </div>
              {error && (
                <p className="text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <button className="btn-primary" disabled={busy} onClick={save}>
                  {busy ? "Saving…" : "Save"}
                </button>
                <button className="btn-secondary" onClick={() => setOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="tap rounded px-2 text-xs text-brand-blue hover:underline"
              onClick={() => setOpen(true)}
            >
              Update status
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function WishForm({ onDone }: { onDone: (msg: string) => void }) {
  const [category, setCategory] = useState<WishCategory | "">("");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const chosen = WISH_CATEGORIES.find((c) => c.id === category);

  const submit = async () => {
    const bad = wishError({ category, title, detail });
    if (bad) return setError(bad);
    setBusy(true);
    setError("");
    const res = await send("/api/wishes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category, title, detail })
    });
    if (res.ok) {
      setCategory("");
      setTitle("");
      setDetail("");
      onDone("Thank you — that is on the list, with your name on it.");
    } else {
      setError(res.error);
    }
    setBusy(false);
  };

  return (
    <section className="rounded-xl bg-white ring-1 ring-slate-200 p-4">
      <h2 className="mb-1 text-lg font-semibold">Add to the list</h2>
      <p className="mb-3 text-sm text-slate-600">
        Suggestions, supply requests, and anything you have seen that is below standard. You do not
        need to be certain and you do not need a solution — noticing is enough.
      </p>

      <div className="space-y-3">
        <div>
          <span className="field-label">What is it?</span>
          <div className="flex flex-wrap gap-1.5">
            {WISH_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`tap rounded-full border px-3 text-sm ${
                  category === c.id
                    ? "border-brand-blue bg-brand-blue text-white"
                    : c.urgent
                      ? "border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {chosen && <p className="mt-1 text-xs text-slate-500">{chosen.hint}</p>}
        </div>

        <div>
          <label className="field-label" htmlFor="wish-title">
            In one line
          </label>
          <input
            id="wish-title"
            className="field-input"
            maxLength={WISH_TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Small gloves run out every Thursday"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="wish-detail">
            Anything else <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            id="wish-detail"
            className="field-input"
            rows={3}
            maxLength={WISH_DETAIL_MAX}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Where, when, how often — whatever would help someone act on it."
          />
        </div>

        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <button className="btn-primary" disabled={busy} onClick={submit}>
          {busy ? "Adding…" : "Add to the list"}
        </button>
      </div>
    </section>
  );
}
