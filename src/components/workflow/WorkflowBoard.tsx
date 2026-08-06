"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { SUGGESTABLE_BLOCK_IDS } from "@/lib/phrases/suggestedBlocks";
import { BLOCK_BY_ID } from "@/lib/phrases/blocks";
import { ALL_MODULES } from "@/lib/modules";

type Pack = {
  id: number;
  title: string;
  description: string;
  status: string;
  version: number;
  moduleIds: string[];
  blockIds: string[];
  authorRoles: string[];
  createdByName: string;
  submittedById: string | null;
  submittedByName: string | null;
  decidedByName: string | null;
  decidedNote: string | null;
  updatedAt: string;
  publishedAt: string | null;
};

type EventRow = {
  id: number;
  packId: number;
  at: string;
  actorName: string;
  action: string;
  fromVersion: number | null;
  toVersion: number | null;
  decisionNote: string | null;
};

const ADDON_MODULES = ALL_MODULES.filter((m) => !m.alwaysOn);

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  published: "Published",
  rejected: "Rejected",
  retired: "Retired"
};

function emptyForm() {
  return {
    title: "",
    description: "",
    moduleIds: [] as string[],
    blockIds: [] as string[],
    authorRoles: [] as string[]
  };
}

export function WorkflowBoard({
  currentUserId,
  initialPacks,
  initialEvents
}: {
  currentUserId: string;
  initialPacks: Pack[];
  initialEvents: EventRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"packs" | "history">("packs");
  const [packs, setPacks] = useState(initialPacks);
  const [events, setEvents] = useState(initialEvents);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [rejectNotes, setRejectNotes] = useState<Record<number, string>>({});

  const suggestable = useMemo(
    () => SUGGESTABLE_BLOCK_IDS.map((id) => BLOCK_BY_ID.get(id)!).filter(Boolean),
    []
  );
  const titleById = useMemo(
    () => Object.fromEntries(packs.map((p) => [p.id, p.title] as const)),
    [packs]
  );

  const refresh = () => router.refresh();

  const call = async (url: string, init: RequestInit) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "content-type": "application/json", ...(init.headers ?? {}) }
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; pack?: Pack };
      if (!res.ok) {
        setError(data.error ?? "Request failed.");
        return null;
      }
      return data;
    } catch {
      setError("Could not reach the server.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setFormOpen(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (p: Pack) => {
    setEditingId(p.id);
    setForm({
      title: p.title,
      description: p.description,
      moduleIds: [...p.moduleIds],
      blockIds: [...p.blockIds],
      authorRoles: [...p.authorRoles]
    });
    setFormOpen(true);
  };

  const save = async () => {
    const body = {
      title: form.title,
      description: form.description,
      moduleIds: form.moduleIds,
      blockIds: form.blockIds,
      authorRoles: form.authorRoles
    };
    const data = editingId
      ? await call(`/api/workflow/packs/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "save", ...body })
        })
      : await call("/api/workflow/packs", {
          method: "POST",
          body: JSON.stringify(body)
        });
    if (!data?.pack) return;
    setPacks((list) => {
      const others = list.filter((p) => p.id !== data.pack!.id);
      return [data.pack!, ...others];
    });
    resetForm();
    refresh();
  };

  const act = async (id: number, action: string, extra: Record<string, unknown> = {}) => {
    const data = await call(`/api/workflow/packs/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action, ...extra })
    });
    if (!data?.pack) return;
    setPacks((list) => {
      if (action === "revise") return [data.pack!, ...list];
      const others = list.filter((p) => p.id !== data.pack!.id && p.id !== id);
      return [data.pack!, ...others];
    });
    const ev = await fetch("/api/workflow/events").then((r) => r.json());
    if (Array.isArray(ev.events)) setEvents(ev.events);
    refresh();
  };

  const toggle = (key: "moduleIds" | "blockIds" | "authorRoles", id: string) => {
    setForm((f) => {
      const list = f[key];
      return {
        ...f,
        [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
      };
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={tab === "packs" ? "btn-primary text-sm" : "btn-secondary text-sm"}
          onClick={() => setTab("packs")}
        >
          Practice packs
        </button>
        <button
          type="button"
          className={tab === "history" ? "btn-primary text-sm" : "btn-secondary text-sm"}
          onClick={() => setTab("history")}
        >
          History
        </button>
      </div>

      <p className="text-sm text-slate-600">
        Packs are menus of shipped starters and modules. They do not write clinical facts. A second
        Team Lead must approve before publish. Pack publish is not dentist filing of a note.
      </p>

      {error && (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {error}
        </p>
      )}

      {tab === "packs" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={busy}
              onClick={() => (formOpen && !editingId ? resetForm() : openCreate())}
            >
              {formOpen && !editingId ? "Close form" : "New pack"}
            </button>
          </div>

          {formOpen && (
            <div className="card space-y-3 p-3">
              <h2 className="text-sm font-semibold text-brand-navy">
                {editingId ? `Edit pack #${editingId}` : "New practice pack"}
              </h2>
              <label className="block text-xs font-medium text-slate-700">
                Title
                <input
                  className="field-input mt-1"
                  value={form.title}
                  maxLength={80}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-medium text-slate-700">
                Short description
                <input
                  className="field-input mt-1"
                  value={form.description}
                  maxLength={400}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
              <details className="rounded border border-slate-200 p-2" open>
                <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                  Modules (structure) — {form.moduleIds.length} selected
                </summary>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {ADDON_MODULES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`chip ${form.moduleIds.includes(m.id) ? "ring-2 ring-brand-teal" : ""}`}
                      onClick={() => toggle("moduleIds", m.id)}
                    >
                      {m.title}
                    </button>
                  ))}
                </div>
              </details>
              <details className="rounded border border-slate-200 p-2">
                <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                  Section starters (blocks) — {form.blockIds.length} selected
                </summary>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {suggestable.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className={`chip ${form.blockIds.includes(b.id) ? "ring-2 ring-brand-teal" : ""}`}
                      title={b.purpose}
                      onClick={() => toggle("blockIds", b.id)}
                    >
                      {b.title}
                    </button>
                  ))}
                </div>
              </details>
              <fieldset>
                <legend className="text-xs font-semibold text-slate-700">
                  Who sees it (empty = everyone)
                </legend>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(["hygienist", "assistant", "dentist"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`chip ${form.authorRoles.includes(r) ? "ring-2 ring-brand-teal" : ""}`}
                      onClick={() => toggle("authorRoles", r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void save()}>
                  {editingId ? "Save changes" : "Save draft"}
                </button>
                <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={resetForm}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <ul className="space-y-3">
            {packs.length === 0 && (
              <li className="text-sm text-slate-500">No packs yet. Create one for a common visit type.</li>
            )}
            {packs.map((p) => {
              const isSubmitter = p.submittedById != null && p.submittedById === currentUserId;
              return (
                <li key={p.id} className="card p-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold text-brand-navy">
                      {p.title}{" "}
                      <span className="font-normal text-slate-500">
                        v{p.version} · {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </h3>
                    <span className="text-xs text-slate-500">by {p.createdByName}</span>
                  </div>
                  {p.description && <p className="mt-1 text-xs text-slate-600">{p.description}</p>}
                  <p className="mt-2 text-xs text-slate-600">
                    Modules: {p.moduleIds.length ? p.moduleIds.join(", ") : "—"} · Blocks:{" "}
                    {p.blockIds.length
                      ? p.blockIds.map((id) => BLOCK_BY_ID.get(id)?.title ?? id).join(", ")
                      : "—"}
                  </p>
                  {p.submittedByName && (
                    <p className="mt-1 text-xs text-slate-500">Submitted by {p.submittedByName}</p>
                  )}
                  {p.decidedByName && (
                    <p className="mt-1 text-xs text-slate-500">
                      Decided by {p.decidedByName}
                      {p.decidedNote ? ` — ${p.decidedNote}` : ""}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(p.status === "draft" || p.status === "rejected") && (
                      <>
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          disabled={busy}
                          onClick={() => openEdit(p)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-primary text-xs"
                          disabled={busy}
                          onClick={() => void act(p.id, "submit")}
                        >
                          Submit for review
                        </button>
                      </>
                    )}
                    {p.status === "in_review" &&
                      (isSubmitter ? (
                        <p className="text-xs text-slate-600">
                          Waiting for a second Team Lead — you cannot approve your own submission.
                        </p>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-primary text-xs"
                            disabled={busy}
                            onClick={() => void act(p.id, "decide", { approve: true })}
                          >
                            Approve
                          </button>
                          <input
                            className="field-input max-w-xs py-1 text-xs"
                            placeholder="Reject note (required)"
                            value={rejectNotes[p.id] ?? ""}
                            onChange={(e) =>
                              setRejectNotes((n) => ({ ...n, [p.id]: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            className="btn-secondary text-xs"
                            disabled={busy}
                            onClick={() =>
                              void act(p.id, "decide", {
                                approve: false,
                                note: rejectNotes[p.id] ?? ""
                              })
                            }
                          >
                            Reject
                          </button>
                        </>
                      ))}
                    {p.status === "approved" && (
                      <button
                        type="button"
                        className="btn-primary text-xs"
                        disabled={busy}
                        onClick={() => void act(p.id, "publish")}
                      >
                        Publish
                      </button>
                    )}
                    {p.status === "published" && (
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        disabled={busy}
                        onClick={() => void act(p.id, "revise")}
                      >
                        Open revision draft
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {tab === "history" && (
        <ul className="space-y-2">
          {events.length === 0 && <li className="text-sm text-slate-500">No pack events yet.</li>}
          {events.map((e) => (
            <li key={e.id} className="rounded border border-slate-200 px-3 py-2 text-xs text-slate-700">
              <span className="font-semibold">{e.action}</span> on{" "}
              {titleById[e.packId] ?? `pack #${e.packId}`}
              {e.toVersion != null ? ` (v${e.toVersion})` : ""} — {e.actorName}
              <span className="text-slate-500"> · {new Date(e.at).toLocaleString()}</span>
              {e.decisionNote && <p className="mt-0.5 text-slate-600">{e.decisionNote}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
