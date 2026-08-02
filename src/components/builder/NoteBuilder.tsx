"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { ALL_MODULES, activeModules } from "@/lib/modules";
import { initialNoteState, noteReducer } from "@/lib/state/noteReducer";
import { composeNote, composeNoteText, suggestedFilename } from "@/lib/compose/composeNote";
import { composeAuditReport } from "@/lib/compose/composeAuditReport";
import { computeGates, runAudit } from "@/lib/audit/engine";
import type { FieldValue } from "@/lib/schema/types";
import { NoteForm } from "./NoteForm";
import { AuditPanel } from "./AuditPanel";
import { EmailDialog, PhiOverrideDialog } from "./dialogs";

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function NoteBuilder() {
  const [state, dispatch] = useReducer(noteReducer, initialNoteState);
  const [rightTab, setRightTab] = useState<"preview" | "audit">("audit");
  const [override, setOverride] = useState<{ signature: string; reason: string } | null>(null);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  const modules = useMemo(() => activeModules(state.selectedModuleIds), [state.selectedModuleIds]);
  const markdown = useMemo(() => composeNote(state, modules), [state, modules]);
  const report = useMemo(
    () => runAudit({ note: state, modules, composedText: markdown }),
    [state, modules, markdown]
  );

  // The override attests to a specific set of flagged items. New or changed
  // flags need a new attestation.
  const phiSignature = useMemo(
    () => JSON.stringify(report.phiStops.map((f) => [f.ruleId, f.matchedText]).sort()),
    [report.phiStops]
  );
  const overrideActive = override !== null && override.signature === phiSignature;
  const gates = computeGates(report, overrideActive);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (Object.keys(state.values).length > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.values]);

  const filename = suggestedFilename(state, ALL_MODULES);
  const hasContent = Object.keys(state.values).length > 0;

  const copy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Module picker rail */}
      <aside className="shrink-0 lg:w-64">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-4">
          <h2 className="mb-2 text-sm font-bold text-slate-800">Modules</h2>
          <p className="mb-2 text-xs text-slate-500">
            Universal Core is always on. Add one module per procedure-site pair.
          </p>
          <label className="mb-1 flex items-center gap-2 rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
            <input type="checkbox" checked disabled /> Universal Core
          </label>
          <div className="max-h-[60vh] space-y-0.5 overflow-y-auto">
            {ALL_MODULES.filter((m) => !m.alwaysOn).map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-blue-50"
              >
                <input
                  type="checkbox"
                  checked={state.selectedModuleIds.includes(m.id)}
                  onChange={() => {
                    const removing = state.selectedModuleIds.includes(m.id);
                    const hasValues = Object.keys(state.values).some((k) => k.startsWith(`${m.id}.`));
                    if (removing && hasValues && !window.confirm(`Discard the entered ${m.title} data?`)) {
                      return;
                    }
                    dispatch({ type: "toggleModule", moduleId: m.id });
                  }}
                />
                {m.title.replace(" Add-On", "")}
              </label>
            ))}
          </div>
          <button
            type="button"
            className="btn-secondary mt-3 w-full justify-center text-xs"
            onClick={() => {
              if (!hasContent || window.confirm("Discard this draft and start a new note?")) {
                dispatch({ type: "reset" });
                setOverride(null);
              }
            }}
          >
            New note
          </button>
        </div>
      </aside>

      {/* Form */}
      <section className="min-w-0 flex-1 pb-24">
        <NoteForm
          modules={modules}
          state={state}
          onChange={(key, value: FieldValue) => dispatch({ type: "setValue", key, value })}
        />
      </section>

      {/* Preview / audit panel */}
      <aside className="shrink-0 lg:w-[26rem]">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-4">
          <div className="mb-3 flex gap-1">
            {(
              [
                ["audit", `Audit (${report.findings.length})`],
                ["preview", "Preview"]
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setRightTab(tab)}
                className={`rounded px-3 py-1 text-sm font-medium ${
                  rightTab === tab ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {rightTab === "audit" ? (
              <AuditPanel report={report} />
            ) : (
              <pre className="whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-xs leading-relaxed text-slate-800">
                {markdown}
              </pre>
            )}
          </div>
        </div>
      </aside>

      {/* Action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
          <span className="mr-auto flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            {(["S0", "S1", "S2", "S3", "S4"] as const).map(
              (s) =>
                report.counts[s] > 0 && (
                  <span
                    key={s}
                    className={`rounded-full px-2 py-0.5 ${
                      s === "S0"
                        ? "bg-red-100 text-red-900"
                        : s === "S1"
                          ? "bg-orange-100 text-orange-900"
                          : s === "S2"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {report.counts[s]} {s}
                  </span>
                )
            )}
            {report.phiStops.length > 0 && !overrideActive && (
              <button type="button" className="underline" onClick={() => setShowOverrideDialog(true)}>
                Review privacy stop
              </button>
            )}
            {overrideActive && <span className="text-red-700">privacy stop overridden</span>}
          </span>
          <button
            type="button"
            className="btn-secondary"
            disabled={!hasContent || !gates.exportAllowed}
            title={gates.exportAllowed ? "Copy the markdown draft" : "Blocked by the privacy stop"}
            onClick={copy}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!hasContent || !gates.exportAllowed}
            onClick={() => download(`${filename}.md`, markdown)}
          >
            Download .md
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!hasContent || !gates.exportAllowed}
            onClick={() => download(`${filename}.txt`, composeNoteText(state, modules))}
          >
            Download .txt
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!hasContent || !gates.exportAllowed}
            title="Audit report in the standard format, with the draft attached"
            onClick={() => download(`${filename}-audit.md`, composeAuditReport(report, modules, markdown))}
          >
            Audit report
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!hasContent || !gates.emailAllowed}
            title={
              gates.emailAllowed
                ? "Email the note to the corporate address"
                : "Resolve every STOP and REQUIRED finding first"
            }
            onClick={() => setShowEmailDialog(true)}
          >
            Email to office
          </button>
        </div>
      </div>

      {showOverrideDialog && (
        <PhiOverrideDialog
          phiStops={report.phiStops}
          onClose={() => setShowOverrideDialog(false)}
          onConfirm={(reason) => {
            setOverride({ signature: phiSignature, reason });
            setShowOverrideDialog(false);
          }}
        />
      )}
      {showEmailDialog && (
        <EmailDialog
          filename={filename}
          buildContent={(format) => (format === "md" ? markdown : composeNoteText(state, modules))}
          phiOverrideReason={overrideActive ? override!.reason : null}
          onClose={() => setShowEmailDialog(false)}
        />
      )}
    </div>
  );
}
