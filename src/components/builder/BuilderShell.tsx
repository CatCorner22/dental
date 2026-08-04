"use client";

import type { ClinicalRole } from "@/lib/auth/clinicalRoles";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ALL_MODULES, activeModules, moduleMatches } from "@/lib/modules";
import { noteReducer } from "@/lib/state/noteReducer";
import { composeNote, composeNoteText, suggestedFilename } from "@/lib/compose/composeNote";
import { computeGates, runAudit } from "@/lib/audit/engine";
import { OMISSION_NOTICE_THRESHOLD, omissionReport } from "@/lib/audit/omissions";
import { findingsByField } from "@/lib/audit/byField";
import { applyMaskPlan, buildMaskPlan } from "@/lib/audit/maskPhi";
import { deriveDraftStatus } from "@/lib/status/draftStatus";
import { isValueEmpty } from "@/lib/schema/conditions";
import { useAutosave } from "@/lib/client/useAutosave";
import type { FieldValue, NoteState } from "@/lib/schema/types";
import { NoteForm } from "./NoteForm";
import { AuditPanel } from "./AuditPanel";
import { NoteReadback } from "./NoteReadback";
import { ByteAdvisor } from "@/components/advisor/ByteAdvisor";
import { ByteStarAdvisor } from "@/components/advisor/ByteStarAdvisor";
import { SaveIndicator } from "./SaveIndicator";
import { StatusChip } from "@/components/ui/StatusChip";
import { ProgressRing } from "./ProgressRing";
import { Dialog } from "@/components/ui/Dialog";
import { HelpTip } from "@/components/ui/HelpTip";
import { LicenseScopeCard } from "@/components/law/LicenseScopeCard";

// None of these three render on first paint — a conflict, a PHI override,
// and a submit confirmation are all things that happen only after an edit
// or a click. Splitting them out of the initial chunk keeps their weight
// (and react-markdown-adjacent Sparkle copy) off the note page's first load,
// which is the heaviest page in the app. `ssr: false` is safe: none of the
// three is ever the FIRST thing rendered for a request — they only appear
// after client-side state changes post-mount.
const ConflictDialog = dynamic(() => import("./BuilderDialogs").then((m) => m.ConflictDialog), {
  ssr: false
});
const PhiOverrideDialog = dynamic(() => import("./BuilderDialogs").then((m) => m.PhiOverrideDialog), {
  ssr: false
});
const SubmitDialog = dynamic(() => import("./BuilderDialogs").then((m) => m.SubmitDialog), {
  ssr: false
});

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
  initialOfficeId,
  clinicalRole,
  offices,
  initialNote,
  initialVersion,
  initialSubmitted,
  initialSendFailed,
  canEdit
}: {
  draftId: string;
  initialTitle: string;
  initialOfficeId: string | null;
  clinicalRole: ClinicalRole;
  offices: { id: string; name: string }[];
  initialNote: NoteState;
  initialVersion: number;
  initialSubmitted: boolean;
  initialSendFailed: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(noteReducer, initialNote);
  const [title, setTitle] = useState(initialTitle);
  const [officeId, setOfficeId] = useState<string | null>(initialOfficeId);
  // Has this session made a real edit yet? Distinguishes "nothing has happened"
  // from "something happened and was reverted" — see the autosave effect.
  // Has this session made a real edit yet? Distinguishes "nothing has happened"
  // from "something happened and was reverted" — see the autosave effect.
  const hasEdited = useRef(false);
  const [tab, setTab] = useState<"audit" | "chart" | "byte" | "bytestar" | "preview">("audit");
  const [override, setOverride] = useState<{ signature: string; reason: string } | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  // Below `lg` the module rail, form, and Sidekick stack vertically (see the
  // flex-col wrapper below), which buried live audit feedback under the
  // entire form — a clinician charting on a phone or tablet had to scroll
  // past everything just to see whether the note was blocked. This mirrors
  // the Sidekick into a reachable sheet on those screens instead; the desktop
  // sticky aside is untouched.
  const [showMobileAudit, setShowMobileAudit] = useState(false);

  const autosave = useAutosave(draftId, initialVersion);
  const { markEdited, flush } = autosave;
  // The stored submitted / send-failed state holds until the first edit here;
  // an edit means the note has changed since it was filed (the server's PATCH
  // recompute makes the same call). A submit in THIS tab flips submittedNow
  // so the chip is honest without a reload.
  const [editedSinceLoad, setEditedSinceLoad] = useState(false);
  const [submittedNow, setSubmittedNow] = useState(false);
  const [sendFailedNow, setSendFailedNow] = useState(false);
  // Flips true after a successful resend so the chip reads "submitted" without
  // a reload — the resend delivered the already-filed copy, it did not edit it.
  const [resentNow, setResentNow] = useState(false);
  const [resending, setResending] = useState(false);
  const [moduleQuery, setModuleQuery] = useState("");

  // TYPING FIRST, GRADING A BEAT LATER.
  //
  // composeNote + runAudit ran on `state` directly, which put the whole audit
  // stack between a key going down and the letter appearing: ~3 ms for a typical
  // note and ~13 ms fully loaded on a developer machine, and a burst of ten
  // keystrokes paid it ten times. A clinician's tablet is several times slower.
  //
  // Deferring the audited copy costs a typing burst ONE audit instead of one per
  // character, and React can abandon a run a newer keystroke already invalidated.
  // The inputs stay fully controlled, so no character is dropped or reordered, and
  // the autosave effect deliberately keeps using the FRESH state: what gets saved
  // must never lag what was typed.
  //
  // Safe because the client audit was never the gate — the submit route re-composes
  // and re-audits server-side and refuses with 422 on any open STOP or REQUIRED
  // finding. While the panel catches up it says so out loud rather than letting a
  // settled-looking report describe a note that has moved on.
  const deferredState = useDeferredValue(state);
  const auditing = deferredState !== state;

  // The FORM's module list stays fresh: ticking a module is a discrete choice and
  // its section has to appear under the finger that ticked it. activeModules is a
  // filter over ~32 definitions, so computing both is free.
  const modules = useMemo(() => activeModules(state.selectedModuleIds), [state.selectedModuleIds]);
  const auditModules = useMemo(
    () => activeModules(deferredState.selectedModuleIds),
    [deferredState.selectedModuleIds]
  );
  // The office name the CLIENT composes with must be the one the SERVER
  // freezes, or the preview is not the artifact and the two audits disagree.
  const officeName = useMemo(
    () => offices.find((o) => o.id === officeId)?.name ?? null,
    [offices, officeId]
  );
  const markdown = useMemo(
    () => composeNote(deferredState, auditModules, { officeName }),
    [deferredState, auditModules, officeName]
  );
  const report = useMemo(
    () => runAudit({ note: deferredState, modules: auditModules, composedText: markdown }),
    [deferredState, auditModules, markdown]
  );
  const fieldFindings = useMemo(() => findingsByField(report.findings), [report.findings]);

  // How much of this note is a recorded absence rather than a fact. Deferred with
  // the rest of the graded copy, and never a gate — see omissions.ts for why
  // closing the escape hatch would make notes worse, not better.
  const omissions = useMemo(
    () => omissionReport(deferredState, auditModules),
    [deferredState, auditModules]
  );

  const phiSignature = useMemo(
    () => JSON.stringify(report.phiStops.map((f) => [f.ruleId, f.matchedText]).sort()),
    [report.phiStops]
  );
  const overrideActive = override !== null && override.signature === phiSignature;

  // Everything the privacy screen flagged that has literal text to replace —
  // the S0 stops AND the S2 name heuristics, because if a clinician has
  // decided to redact, they want the identifiers gone, not just the ones that
  // happen to block the line.
  const phiFindings = useMemo(
    () => report.findings.filter((f) => f.category === "phi" && f.matchedText),
    [report.findings]
  );

  // Replace every flagged identifier with a random opaque token, in place,
  // across the fields the clinician actually typed into.
  //
  // This is the third option the dialog was missing. Before it, a privacy stop
  // offered retype-by-hand or waive-the-stop, and between patients the waiver
  // wins — a bad default for the one gate the PII-free premise rests on. One
  // click now leaves the note MORE de-identified than it was, and the audit
  // re-runs on the result like any other edit.
  const maskIdentifiers = useCallback(() => {
    const plan = buildMaskPlan(phiFindings);
    if (plan.length === 0) return 0;
    let changed = 0;
    for (const [key, value] of Object.entries(state.values)) {
      if (value.kind !== "text") continue;
      const masked = applyMaskPlan(value.value, plan);
      if (masked === value.value) continue;
      changed++;
      dispatch({ type: "setValue", key, value: { kind: "text", value: masked } });
    }
    return changed;
  }, [phiFindings, state.values, dispatch]);
  const gates = computeGates(report, overrideActive);
  // From the SAME snapshot the report came from, deliberately. Read from the fresh
  // state instead, the first keystroke of a note would set hasContent true while
  // the counts were still all zero — and deriveDraftStatus turns that pair into
  // "Ready to submit", in green, on an empty note with every required field still
  // open. An andon that flashes the wrong colour is worse than one that takes an
  // extra frame to be right.
  const hasContent = useMemo(
    () => Object.values(deferredState.values).some((v) => !isValueEmpty(v)),
    [deferredState.values]
  );
  const liveStatus = deriveDraftStatus({
    hasContent,
    counts: report.counts,
    phiStops: report.phiStops.length,
    submitted: resentNow || (initialSubmitted && !editedSinceLoad) || submittedNow,
    // A successful resend clears the failure — it wins over the stored flag.
    lastSendFailed: !resentNow && ((initialSendFailed && !editedSinceLoad) || sendFailedNow)
  });

  // Autosave on any change. The content-identity guard (not a first-render
  // ref) survives StrictMode's double effect run: until a real edit, `state`
  // IS `initialNote` and `title` IS `initialTitle`, so nothing fires.
  useEffect(() => {
    if (!canEdit) return;
    // On MOUNT, unchanged means "do not save" — otherwise opening a note would
    // write it. After the first real edit it means something different and
    // dangerous: a value was already queued, and returning here leaves it
    // queued. Change the office and change it straight back (two arrow keys)
    // and the FIRST value stayed pending, so Submit flushed the office the
    // clinician had just corrected away — onto a legal record, while the
    // picker on screen showed the right one. So once edited, always re-queue;
    // re-saving identical data is harmless and self-correcting.
    const unchanged =
      state === initialNote && title === initialTitle && officeId === initialOfficeId;
    if (unchanged && !hasEdited.current) return;
    if (!unchanged) hasEdited.current = true;
    setEditedSinceLoad(true);
    setSubmittedNow(false);
    setSendFailedNow(false);
    // Also clear the resend flag: an edit makes the note re-submittable, and a
    // lingering resentNow would keep the chip on "Submitted" and disable both
    // Submit and Resend, wedging the edited draft behind a false status.
    setResentNow(false);
    markEdited(state, title, officeId);
  }, [state, title, officeId, canEdit, markEdited, initialNote, initialTitle, initialOfficeId]);

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

  // Resend the already-filed copy when the email failed. This is the ONLY
  // resend affordance reachable after a reload — before it, a send-failed
  // draft offered Submit (which 409s, pointing at a Resend that did not exist
  // outside the just-closed modal), so the undelivered ticket was wedged and
  // the only escape, editing the note, filed a duplicate.
  const doResend = useCallback(async () => {
    setResending(true);
    try {
      const res = await fetch(`/api/drafts/${draftId}/resend`, { method: "POST" });
      if (res.ok) {
        setResentNow(true);
        setToast({ text: "Resent — the office received the note.", tone: "success" });
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setToast({ text: data.error ?? "Resend failed — try again shortly.", tone: "error" });
      }
    } catch {
      setToast({ text: "Resend failed — check the connection and try again.", tone: "error" });
    } finally {
      setResending(false);
    }
  }, [draftId]);

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

  // Shared between the desktop sticky aside and the mobile audit sheet, so
  // the two never drift into two different implementations of the same
  // panel. Closes over local state directly rather than taking props — it is
  // rendered, not reused as a component, so there is no extra fiber or
  // remount cost to doing it this way.
  const sidekickBody = (
    <>
      <div className="mb-3 flex items-center gap-3">
        <ProgressRing counts={report.counts} />
        <div className="min-w-0">
          <StatusChip status={liveStatus} />
          <p className="mt-1 text-xs text-slate-500">
            {auditing ? "Checking the latest edit…" : report.status}
          </p>
        </div>
      </div>
      {/* The writer's own TN scope, one click away — advisory here; the
          Assessment/Plan scope-lock does the enforcing. */}
      <div className="mb-3">
        <LicenseScopeCard clinicalRole={clinicalRole} />
      </div>
      <div className="mb-3 flex gap-1">
        {([["audit", `Audit (${report.findings.length})`], ["chart", "Chart"], ["byte", "Byte"], ["bytestar", "ByteStar"], ["preview", "Preview"]] as const).map(([t, label]) => (
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
      <div className="pane-60">
        {tab === "audit" ? (
          <AuditPanel report={report} onJump={() => setShowMobileAudit(false)} />
        ) : tab === "byte" ? (
          /* Byte reads the same composed markdown the chart does — one
             memoized composition, one deferred cadence. Advice-only here; the
             "think deeper" path lives on the Standardize screen where the
             assist consent and queue already are. */
          <ByteAdvisor text={markdown} />
        ) : tab === "bytestar" ? (
          <ByteStarAdvisor text={markdown} />
        ) : tab === "chart" ? (
          /* Fed the COMPOSED note rather than any single field, because a
             tooth named in one field and a procedure named in another are one
             clinical statement and the chart has to see both. Composition is
             already memoized on the deferred state, so this rides the same
             off-the-keystroke-path pipeline the audit does. */
          <NoteReadback text={markdown} />
        ) : (
          <pre className="whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-xs leading-relaxed text-slate-800">{markdown}</pre>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <button
          className="btn-secondary"
          disabled={!hasContent || !gates.exportAllowed}
          aria-disabled={!hasContent || !gates.exportAllowed}
          aria-describedby={!gates.exportAllowed && hasContent ? "builder-export-locked" : undefined}
          title={
            !hasContent
              ? "Add note content before copying"
              : gates.exportAllowed
                ? "Copy the composed note"
                : "Resolve every STOP finding before copy or download"
          }
          onClick={copy}
        >
          {copied ? "Copied ✓" : !gates.exportAllowed && hasContent ? "🔒 Copy locked" : "Copy"}
        </button>
        <button
          className="btn-secondary"
          disabled={!hasContent || !gates.exportAllowed}
          aria-disabled={!hasContent || !gates.exportAllowed}
          aria-describedby={!gates.exportAllowed && hasContent ? "builder-export-locked" : undefined}
          title={
            !hasContent
              ? "Add note content before downloading"
              : gates.exportAllowed
                ? "Download as Markdown"
                : "Resolve every STOP finding before copy or download"
          }
          onClick={() => download(`${filename}.md`, markdown)}
        >
          Download .md
        </button>
        <button
          className="btn-secondary"
          disabled={!hasContent || !gates.exportAllowed}
          aria-disabled={!hasContent || !gates.exportAllowed}
          aria-describedby={!gates.exportAllowed && hasContent ? "builder-export-locked" : undefined}
          title={
            !hasContent
              ? "Add note content before downloading"
              : gates.exportAllowed
                ? "Download as plain text"
                : "Resolve every STOP finding before copy or download"
          }
          onClick={() => download(`${filename}.txt`, composeNoteText(deferredState, auditModules, { officeName }))}
        >
          Download .txt
        </button>
        <HelpTip label="About copy and download">
          Copy and download stay locked while any STOP finding is open. A privacy STOP can be
          attested; other STOPs must be fixed in the note. Required fields block Submit but not
          copy.
        </HelpTip>
        {report.phiStops.length > 0 && !overrideActive && (
          <button
            type="button"
            className="btn-secondary border-rose-300 text-rose-800 hover:bg-rose-50"
            onClick={() => {
              setShowMobileAudit(false);
              setShowOverride(true);
            }}
          >
            Review privacy stop
          </button>
        )}
      </div>
      {hasContent && !gates.exportAllowed && (
        <p id="builder-export-locked" className="mt-2 text-xs text-rose-800" role="status">
          Copy and download are locked until every STOP is fixed
          {report.phiStops.length > 0 && !overrideActive
            ? " (or a privacy stop is attested)"
            : ""}
          . Open findings are listed in the audit panel.
        </p>
      )}
    </>
  );

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
            aria-label="Smile Note title"
          />
          {/* WHERE this encounter happened.
              Beside the title, in the sticky header, because it is encounter
              identity rather than a clinical finding — the thing a reader
              checks before trusting anything below it. Every office is offered
              to everyone: staff rotate between locations and patients are seen
              at whichever one suits the visit, so tying this to the author
              would be wrong on both counts. */}
          {offices.length > 0 && (
            <select
              className="tap-input rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={officeId ?? ""}
              disabled={!canEdit}
              onChange={(e) => setOfficeId(e.target.value || null)}
              aria-label="Office where this encounter happened"
              title="Which office this visit happened at. Staff rotate, so this is per note, not per person."
            >
              <option value="">Office…</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <StatusChip status={liveStatus} size="md" />
          {canEdit && <SaveIndicator state={autosave.state} />}
          {canEdit && liveStatus === "error" && (
            <button
              className="btn-primary border-rose-600 bg-rose-600 hover:bg-rose-700"
              disabled={resending}
              title="The note is filed but its email did not send. Resend the same filed copy — this never files a second ticket."
              onClick={() => void doResend()}
            >
              {resending ? "Resending…" : "Resend email"}
            </button>
          )}
          {canEdit && (
            <>
              <button className="btn-secondary" title="Save now (Ctrl+S)" onClick={() => void flush()}>Save</button>
              <button
                className="btn-primary"
                disabled={!hasContent || !gates.emailAllowed || liveStatus === "submitted"}
                aria-disabled={!hasContent || !gates.emailAllowed || liveStatus === "submitted"}
                aria-describedby={
                  canEdit && hasContent && !gates.emailAllowed && liveStatus !== "submitted"
                    ? "builder-submit-blocked"
                    : undefined
                }
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
              <HelpTip label="About Submit">
                Submit files the note to the office. It stays off until every STOP and every
                REQUIRED field is clear. Already submitted notes need an edit before a new submit.
              </HelpTip>
            </>
          )}
        </div>
      </div>

      {/* WHY SUBMIT IS OFF, in words, on the screen.
          The reason lived only in a `title` tooltip — which does not exist on a
          tablet, never appears for a keyboard user, and needs a deliberate hover a
          hurried person will not perform. A usability review's single most common
          complaint was the app saying no without saying why: someone filled a note,
          pressed Submit, nothing happened, and they had to infer the cause from
          coloured chips in a panel. Counted and named, with the count matching the
          panel so the two cannot disagree. */}
      {canEdit && hasContent && !gates.emailAllowed && liveStatus !== "submitted" && (
        <p
          id="builder-submit-blocked"
          className="mb-4 rounded border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-900"
          role="status"
        >
          <strong>Not ready to file yet.</strong>{" "}
          {report.counts.S0 > 0 && (
            <>
              {report.counts.S0} item{report.counts.S0 === 1 ? "" : "s"} must be fixed
              {report.counts.S1 > 0 ? ", and " : ". "}
            </>
          )}
          {report.counts.S1 > 0 && (
            <>
              {report.counts.S1} required field{report.counts.S1 === 1 ? "" : "s"}{" "}
              {report.counts.S1 === 1 ? "is" : "are"} still open.{" "}
            </>
          )}
          Each one is listed in the audit panel with a link straight to the field.
        </p>
      )}

      {/* WHAT THIS NOTE ACTUALLY SAYS, when most of it says "not applicable".
          Shown, never blocked. Clicking a licence is one action and finding out the
          real answer is a conversation, so the escape hatch is the path of least
          resistance — a usability reviewer walking the app cold found exactly that.
          The answer is not to close it (a form that refuses "I do not know" gets a
          fabricated value instead) but to stop it being invisible. */}
      {canEdit && omissions.licensed > 0 && omissions.rate >= OMISSION_NOTICE_THRESHOLD && (
        <p className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <strong>
            {omissions.licensed} of {omissions.answered + omissions.licensed} required answers record
            an absence rather than a finding.
          </strong>{" "}
          That is allowed and it is written into the note — {" "}
          {omissions.byLicence
            .map((b) => `${b.fields.length} × "${b.licence.label}"`)
            .join(", ")}
          . Worth one more look if any of them could be answered instead: a recorded
          absence is defensible, and so is a fact, but only one of them is useful to
          whoever reads this next.
        </p>
      )}

      {!canEdit && (
        <p className="mb-4 rounded border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700">
          You have read-only access. You can view this note but not edit or submit it.
        </p>
      )}

      {/* Mobile/tablet audit bar. Below `lg` the module rail, form, and
          Sidekick stack vertically (see the flex-col wrapper just below),
          which buried live audit feedback under the entire form — reaching
          it meant scrolling past every field first. Placed here, above that
          stack, it is visible without scrolling and opens the same Sidekick
          content in a dismissible sheet. */}
      <button
        type="button"
        onClick={() => setShowMobileAudit(true)}
        className="tap mb-4 flex w-full items-center gap-3 rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-left shadow-sm lg:hidden"
      >
        <ProgressRing counts={report.counts} />
        <span className="min-w-0 flex-1">
          <StatusChip status={liveStatus} />
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {report.findings.length === 0
              ? "No findings — view audit & preview"
              : `${report.findings.length} finding${report.findings.length === 1 ? "" : "s"} — view audit & preview`}
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-slate-400">▸</span>
      </button>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Module rail */}
        <aside className="shrink-0 lg:w-60">
          <div className="card p-3 lg:sticky lg:top-20">
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
            <div className="pane-55 space-y-0.5">
              {ALL_MODULES.filter((m) => !m.alwaysOn && moduleMatches(m, moduleQuery)).map((m) => (
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
            <NoteForm
              modules={modules}
              state={state}
              onChange={setValue}
              findingsByField={fieldFindings}
              clinicalRole={clinicalRole}
            />
          </fieldset>
        </section>

        {/* Sidekick — desktop only below `lg`; the mobile bar + sheet above
            covers the same ground where this would otherwise sit below the
            entire form. */}
        <aside className="hidden shrink-0 lg:block lg:w-[26rem]">
          <div className="card p-3 lg:sticky lg:top-20">
            {sidekickBody}
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

      {showMobileAudit && (
        <Dialog title="Audit & preview" onClose={() => setShowMobileAudit(false)}>
          {sidekickBody}
        </Dialog>
      )}
      {showOverride && (
        <PhiOverrideDialog
          phiStops={report.phiStops}
          maskableCount={phiFindings.length}
          onMask={() => {
            const changed = maskIdentifiers();
            setShowOverride(false);
            setToast({
              text:
                changed > 0
                  ? "Flagged identifiers replaced with masked tokens."
                  : "Nothing to mask in the editable fields.",
              tone: changed > 0 ? "success" : "error"
            });
          }}
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
