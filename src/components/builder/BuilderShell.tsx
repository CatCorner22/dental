"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
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
  const [toast, setToast] = useState<string | null>(null);

  const autosave = useAutosave(draftId, initialVersion);
  const { markEdited } = autosave;
  const firstRender = useRef(true);
  // The stored submitted / send-failed state holds until the first edit here;
  // an edit means the note has changed since it was filed (the server's PATCH
  // recompute makes the same call).
  const [editedSinceLoad, setEditedSinceLoad] = useState(false);

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
    submitted: initialSubmitted && !editedSinceLoad,
    lastSendFailed: initialSendFailed && !editedSinceLoad
  });

  // Autosave on any change (skip the initial render). Depends on the stable
  // markEdited callback — never on the autosave object itself.
  useEffect(() => {
    if (!canEdit) return;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setEditedSinceLoad(true);
    markEdited(state, title);
  }, [state, title, canEdit, markEdited]);

  const filename = suggestedFilename(state, ALL_MODULES);

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
            className="min-w-0 flex-1 rounded border border-transparent px-1 text-lg font-semibold hover:border-slate-300 focus:border-blue-500 focus:outline-none disabled:bg-transparent"
            value={title}
            disabled={!canEdit}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Note title"
          />
          <StatusChip status={liveStatus} size="md" />
          {canEdit && <SaveIndicator state={autosave.state} />}
          {canEdit && (
            <>
              <button className="btn-secondary" onClick={() => void autosave.flush()}>Save</button>
              <button
                className="btn-primary"
                disabled={!hasContent || !gates.emailAllowed || liveStatus === "submitted"}
                title={
                  liveStatus === "submitted"
                    ? "Already submitted — edit the note to submit again"
                    : gates.emailAllowed
                      ? "Submit to the office"
                      : "Resolve every STOP and REQUIRED finding first"
                }
                onClick={async () => {
                  await autosave.flush();
                  setShowSubmit(true);
                }}
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
            <label className="mb-1 flex items-center gap-2 rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
              <input type="checkbox" checked disabled /> Universal Core
            </label>
            <div className="max-h-[55vh] space-y-0.5 overflow-y-auto">
              {ALL_MODULES.filter((m) => !m.alwaysOn).map((m) => (
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
                  className={`rounded px-3 py-1 text-sm font-medium ${tab === t ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
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
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-900 shadow-lg" role="status">
          {toast}
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
          onSubmitted={(ticket, sparkle) => {
            setShowSubmit(false);
            setToast(`Submitted as ${ticket}. ${sparkle}`);
            setTimeout(() => router.push("/history"), 1800);
          }}
        />
      )}
    </div>
  );
}
