"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ALL_MODULES, activeModules } from "@/lib/modules";
import { noteReducer } from "@/lib/state/noteReducer";
import { composeNote, composeNoteText, suggestedFilename } from "@/lib/compose/composeNote";
import { computeGates, runAudit } from "@/lib/audit/engine";
import { findingsByField } from "@/lib/audit/byField";
import { deriveDraftStatus } from "@/lib/status/draftStatus";
import { isValueEmpty } from "@/lib/schema/conditions";
import { useAutosave } from "@/lib/client/useAutosave";
import type { FieldValue, NoteState } from "@/lib/schema/types";
import { NoteForm } from "./NoteForm";
import { AuditPanel } from "./AuditPanel";
import { SaveIndicator } from "./SaveIndicator";
import { StatusChip } from "@/components/ui/StatusChip";
import { ProgressRing } from "./ProgressRing";
import { ConflictDialog, PhiOverrideDialog, SubmitDialog } from "./BuilderDialogs";

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function BuilderShell({
  draftId,
  initialTitle,
  initialNote,
  initialVersion,
  initialSubmitted,
  initialSendFailed,
  canEdit
}: {
  draftId: string;
  initialTitle: string;
  initialNote: NoteState;
  initialVersion: number;
  initialSubmitted: boolean;
  initialSendFailed: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(noteReducer, initialNote);
  const [title, setTitle] = useState(initialTitle);
  const [tab, setTab] = useState<"audit" | "preview">("audit");
  const [override, setOverride] = useState<{ signature: string; reason: string } | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  const autosave = useAutosave(draftId, initialVersion);
  const { markEdited, flush } = autosave;
  // The stored submitted / send-failed state holds until the first edit here;
  // an edit means the note has changed since it was filed (the server's PATCH
  // recompute makes the same call). A submit in THIS tab flips submittedNow
  // so the chip is honest without a reload.
  const [editedSinceLoad, setEditedSinceLoad] = useState(false);
  const [submittedNow, setSubmittedNow] = useState(false);
  const [sendFailedNow, setSendFailedNow] = useState(false);
  const [moduleQuery, setModuleQuery] = useState("");

  const modules = useMemo(() => activeModules(state.selectedModuleIds), [state.selectedModuleIds]);
  const markdown = useMemo(() => composeNote(state, modules), [state, modules]);
  const report = useMemo(
    () => runAudit({ note: state, modules, composedText: markdown }),
    [state, modules, markdown]
  );
  const fieldFindings = useMemo(() => findingsByField(report.findings), [report.findings]);

  const phiSignature = useMemo(
    () => JSON.stringify(report.phiStops.map((f) => [f.ruleId, f.matchedText]).sort()),
    [report.phiStops]
  );
  const overrideActive = override !== null && override.signature === phiSignature;
  const gates = computeGates(report, overrideActive);
  const hasContent = useMemo(() => Object.values(state.values).some((v) => !isValueEmpty(v)), [state.values]);
  const liveStatus = deriveDraftStatus({
    hasContent,
    counts: report.counts,
    submitted: (initialSubmitted && !editedSinceLoad) || submittedNow,
    lastSendFailed: (initialSendFailed && !editedSinceLoad) || sendFailedNow
  });

  // Autosave on any change. The content-identity guard (not a first-render
  // ref) survives StrictMode's double effect run: until a real edit, `state`
  // IS `initialNote` and `title` IS `initialTitle`, so nothing fires.
  useEffect(() => {
    if (!canEdit) return;
    if (state === initialNote && title === initialTitle) return;
    setEditedSinceLoad(true);
    setSubmittedNow(false);
    setSendFailedNow(false);
    markEdited(state, title);
  }, [state, title, canEdit, markEdited, initialNote, initialTitle]);

  const filename = suggestedFilename(state, ALL_MODULES);

  // Submit is only offered when every local edit is on the server — the
  // server audits and files what IT stores, so a stale or conflicted flush
  // must stop the flow, not silently proceed.
  const trySubmit = useCallback(async () => {
    const outcome = await flush();
    if (outcome === "clean") {
      setShowSubmit(true);
    } else if (outcome === "error") {
      setToast({ text: "Could not save your latest edits — check the connection, then try again.", tone: "error" });
    }
    // "conflict": the ConflictDialog is already on screen; nothing to add.
  }, [flush]);

  // Toasts announce and then get out of the way.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  // Keyboard shortcuts, Curve-style: Ctrl/Cmd+S saves, Ctrl/Cmd+Enter submits.
  const submitEnabledRef = useRef(false);
  submitEnabledRef.current =
    canEdit && hasContent && gates.emailAllowed && liveStatus !== "submitted" && !showSubmit;
  useEffect(() => {
    if (!canEdit) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // Any open dialog (the mandatory notice, conflict, submit, PHI override)
      // owns the keyboard — the builder's shortcuts must not fire underneath it.
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        void flush();
      } else if (e.key === "Enter" && submitEnabledRef.current) {
        e.preventDefault();
        void trySubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEdit, flush, trySubmit]);

  // "Start another like this": a new draft with the same modules and title —
  // structure only, never a single value (no clinical assertion carries over).
  const startAnother = async () => {
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, note: { selectedModuleIds: state.selectedModuleIds, values: {} } })
      });
      if (!res.ok) throw new Error();
      const { id } = (await res.json()) as { id: string };
      window.location.assign(`/note/${id}`);
    } catch {
      setShowSubmit(false);
      setToast({ text: "Could not start the next note — try New note from the dashboard.", tone: "error" });
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      download(`${filename}.md`, markdown);
    }
  };

  const setValue = (key: string, value: FieldValue) => dispatch({ type: "setValue", key, value });

  return (
    <div className="pb-24">
      {/* Sticky patient-header-style bar */}
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="tap-input min-w-0 flex-1 rounded border border-transparent px-1 py-1.5 text-lg font-semibold hover:border-slate-300 focus:border-blue-500 focus:outline-none disabled:bg-transparent"
            value={title}
            disabled={!canEdit}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Note title"
          />
          <StatusChip status={liveStatus} size="md" />
          {canEdit && <SaveIndicator state={autosave.state} />}
          {canEdit && (
            <>
              <button className="btn-secondary" title="Save now (Ctrl+S)" onClick={() => void flush()}>Save</button>
              <button
                className="btn-primary"
                disabled={!hasContent || !gates.emailAllowed || liveStatus === "submitted"}
                title={
                  liveStatus === "submitted"
                    ? "Already submitted — edit the note to submit again"
                    : gates.emailAllowed
                      ? "Submit to the office (Ctrl+Enter)"
                      : "Resolve every STOP and REQUIRED finding first"
                }
                onClick={() => void trySubmit()}
              >
                Submit
              </button>
            </>
          )}
        </div>
      </div>

      {!canEdit && (
        <p className="mb-4 rounded border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700">
          You have read-only access. You can view this note but not edit or submit it.
        </p>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Module rail */}
        <aside className="shrink-0 lg:w-60">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-20">
            <h2 className="mb-2 text-sm font-bold text-slate-800">Modules</h2>
            <input
              type="search"
              className="field-input mb-1.5 py-1 text-xs"
              placeholder="Filter modules…"
              value={moduleQuery}
              onChange={(e) => setModuleQuery(e.target.value)}
              aria-label="Filter the module list"
            />
            <label className="mb-1 flex items-center gap-2 rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
              <input type="checkbox" checked disabled /> Universal Core
            </label>
            <div className="max-h-[55dvh] space-y-0.5 overflow-y-auto">
              {ALL_MODULES.filter(
                (m) => !m.alwaysOn && m.title.toLowerCase().includes(moduleQuery.toLowerCase())
              ).map((m) => (
                <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-blue-50">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={state.selectedModuleIds.includes(m.id)}
                    onChange={() => {
                      const removing = state.selectedModuleIds.includes(m.id);
                      const hasValues = Object.keys(state.values).some((k) => k.startsWith(`${m.id}.`));
                      if (removing && hasValues && !window.confirm(`Discard the entered ${m.title} data?`)) return;
                      dispatch({ type: "toggleModule", moduleId: m.id });
                    }}
                  />
                  {m.title.replace(" Add-On", "")}
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* Form */}
        <section className="min-w-0 flex-1">
          <fieldset disabled={!canEdit} className="min-w-0">
            <NoteForm modules={modules} state={state} onChange={setValue} findingsByField={fieldFindings} />
          </fieldset>
        </section>

        {/* Sidekick */}
        <aside className="shrink-0 lg:w-[26rem]">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-20">
            <div className="mb-3 flex items-center gap-3">
              <ProgressRing counts={report.counts} />
              <div className="min-w-0">
                <StatusChip status={liveStatus} />
                <p className="mt-1 text-xs text-slate-500">{report.status}</p>
              </div>
            </div>
            <div className="mb-3 flex gap-1">
              {([["audit", `Audit (${report.findings.length})`], ["preview", "Preview"]] as const).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  className={`tap rounded px-3 text-sm font-medium ${tab === t ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="max-h-[60dvh] overflow-y-auto">
              {tab === "audit" ? (
                <AuditPanel report={report} />
              ) : (
                <pre className="whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-xs leading-relaxed text-slate-800">{markdown}</pre>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              <button className="btn-secondary" disabled={!hasContent || !gates.exportAllowed} onClick={copy}>
                {copied ? "Copied ✓" : "Copy"}
              </button>
              <button className="btn-secondary" disabled={!hasContent || !gates.exportAllowed} onClick={() => download(`${filename}.md`, markdown)}>
                Download .md
              </button>
              <button className="btn-secondary" disabled={!hasContent || !gates.exportAllowed} onClick={() => download(`${filename}.txt`, composeNoteText(state, modules))}>
                Download .txt
              </button>
              {report.phiStops.length > 0 && !overrideActive && (
                <button className="text-xs font-medium text-rose-700 underline" onClick={() => setShowOverride(true)}>
                  Review privacy stop
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>

      {toast && (
        <div
          className={`fixed inset-x-4 bottom-4 z-40 mx-auto w-fit max-w-md rounded-lg border px-4 py-2 text-sm font-medium shadow-lg ${
            toast.tone === "error"
              ? "border-rose-300 bg-rose-50 text-rose-900"
              : "border-green-300 bg-green-50 text-green-900"
          }`}
          role={toast.tone === "error" ? "alert" : "status"}
        >
          {toast.text}
        </div>
      )}

      {showOverride && (
        <PhiOverrideDialog
          phiStops={report.phiStops}
          onClose={() => setShowOverride(false)}
          onConfirm={(reason) => {
            setOverride({ signature: phiSignature, reason });
            setShowOverride(false);
          }}
        />
      )}
      {autosave.state.status === "conflict" && (
        <ConflictDialog
          onReload={() => router.refresh()}
          onClose={autosave.resolveConflict}
        />
      )}
      {showSubmit && (
        <SubmitDialog
          draftId={draftId}
          phiOverrideReason={overrideActive ? override!.reason : null}
          onClose={() => setShowSubmit(false)}
          onFiled={(r) => {
            // A failed send stays resubmittable (matches the server, which
            // marks it "error"), so only a clean filing flips to Submitted.
            const failed = r.emailConfigured && !r.emailed;
            setSubmittedNow(!failed);
            setSendFailedNow(failed);
            // The submit claim bumped the server version; adopt it so this
            // tab's next edit saves cleanly instead of hitting a false 409.
            if (typeof r.version === "number") autosave.adoptVersion(r.version);
          }}
          onStartAnother={() => void startAnother()}
          onGoToDashboard={() => router.push("/")}
        />
      )}
    </div>
  );
}
