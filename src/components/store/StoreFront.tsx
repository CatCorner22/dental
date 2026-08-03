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
      <p className="text-sm">
        Balance:{" "}
        <span className="text-lg font-bold text-brand-blue">
          {balance === null ? "…" : balance.toLocaleString()}
        </span>{" "}
        points
      </p>
      {error && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900" role="status">
          {notice}
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal">
                Tier {item.tier} · {TIER_LABEL[item.tier] ?? ""}
              </p>
              <p className="font-medium">{item.title}</p>
              {item.detail && <p className="text-xs text-slate-500">{item.detail}</p>}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-sm font-bold">{item.cost.toLocaleString()} pts</span>
              <button
                className="btn-primary text-xs"
                disabled={busy !== null || balance === null || balance < item.cost}
                title={
                  balance !== null && balance < item.cost
                    ? `Needs ${(item.cost - balance).toLocaleString()} more points`
                    : "Request this reward"
                }
                onClick={() => redeem(item)}
              >
                {busy === item.id ? "Requesting…" : "Redeem"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {redemptions.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-slate-700">My requests</h2>
          <ul className="space-y-1 text-sm">
            {redemptions.map((r) => (
              <li key={r.id} className="rounded border border-slate-200 bg-white px-3 py-1.5">
                <span className="font-medium">{r.itemTitle}</span>{" "}
                <span className="text-xs text-slate-500">({r.cost.toLocaleString()} pts)</span>{" "}
                <span
                  className={
                    r.status === "approved"
                      ? "text-xs font-semibold text-green-700"
                      : r.status === "declined"
                        ? "text-xs font-semibold text-slate-500"
                        : "text-xs font-semibold text-amber-700"
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
