"use client";

import { useEffect, useState } from "react";

interface Item {
  id: number;
  title: string;
  detail: string;
  cost: number;
  tier: number;
}
interface Redemption {
  id: number;
  itemTitle: string;
  cost: number;
  status: string;
  decidedNote: string | null;
  createdAt: string;
}

const TIER_LABEL: Record<number, string> = {
  1: "Daily",
  2: "Weekly",
  3: "Monthly",
  4: "Quarterly",
  5: "Ultimate"
};

export function StoreFront() {
  const [balance, setBalance] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/store");
      const data = await res.json();
      if (res.ok) {
        setBalance(data.balance);
        setItems(data.items);
        setRedemptions(data.redemptions);
      } else {
        setError(data.error ?? "Could not load the store.");
      }
    } catch {
      setError("Could not reach the server.");
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const redeem = async (item: Item) => {
    setBusy(item.id);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/store", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId: item.id })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not redeem that.");
      } else {
        setNotice(
          `Requested: ${item.title}. The points are set aside now; a Team Lead fulfils it (and a decline refunds automatically).`
        );
        await load();
      }
    } catch {
      setError("Could not reach the server.");
    }
    setBusy(null);
  };

  return (
    <div className="space-y-4">
      {/* The balance is the one number this page exists to spend; it was a
          sentence of body text. A stat strip gives it the weight of a fact
          and keeps the how-to-earn next to the how-much. */}
      <div className="card flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-title-2 font-bold tabular-nums text-brand-navy">
          {balance === null ? "…" : balance.toLocaleString()}
        </span>
        <span className="text-sm font-semibold text-slate-700">points to spend</span>
        <span className="text-xs text-slate-500">Earned by filing clean, complete notes.</span>
      </div>
      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900" role="status">
          {notice}
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const short = balance !== null && balance < item.cost;
          return (
            <li key={item.id} className="card flex flex-col justify-between">
              <div>
                <p className="eyebrow">
                  Tier {item.tier} · {TIER_LABEL[item.tier] ?? ""}
                </p>
                <p className="mt-1 font-semibold text-slate-800">{item.title}</p>
                {item.detail && <p className="text-xs text-slate-500">{item.detail}</p>}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="font-mono text-sm font-bold tabular-nums text-brand-navy">
                    {item.cost.toLocaleString()} pts
                  </span>
                  {/* Said in the layout, not in a title tooltip: a finger
                      never sees a tooltip, and the distance to the reward is
                      the one fact that decides whether to keep writing. */}
                  {short && (
                    <span className="block text-xs text-slate-500">
                      {(item.cost - (balance ?? 0)).toLocaleString()} more to go
                    </span>
                  )}
                </span>
                <button
                  className="btn-primary text-xs"
                  disabled={busy !== null || balance === null || short}
                  title={short ? undefined : "Request this reward"}
                  onClick={() => redeem(item)}
                >
                  {busy === item.id ? "Requesting…" : "Redeem"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {redemptions.length > 0 && (
        <section>
          <h2 className="label-section mb-1.5">My requests</h2>
          <ul className="space-y-1 text-sm">
            {redemptions.map((r) => (
              <li key={r.id} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5">
                <span className="font-medium">{r.itemTitle}</span>{" "}
                <span className="text-xs text-slate-500">({r.cost.toLocaleString()} pts)</span>{" "}
                <span
                  className={
                    r.status === "approved"
                      ? "text-xs font-semibold capitalize text-green-700"
                      : r.status === "declined"
                        ? "text-xs font-semibold capitalize text-slate-500"
                        : "text-xs font-semibold capitalize text-amber-700"
                  }
                >
                  {r.status}
                </span>
                {r.decidedNote && <span className="block text-xs text-slate-500">“{r.decidedNote}”</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
