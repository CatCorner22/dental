"use client";

import { canRecordClinicalJudgement, type ClinicalRole } from "@/lib/auth/clinicalRoles";

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
import { moduleVisibleInRail } from "@/lib/scope/authorCapabilities";
import { noteReducer } from "@/lib/state/noteReducer";
import { composeNote, composeNoteText, suggestedFilename } from "@/lib/compose/composeNote";
import { computeGates, runAudit } from "@/lib/audit/engine";
import { OMISSION_NOTICE_THRESHOLD, omissionReport } from "@/lib/audit/omissions";
import { findingsByField } from "@/lib/audit/byField";
import { applyMaskPlan, buildMaskPlan } from "@/lib/audit/maskPhi";
import { deriveDraftStatus } from "@/lib/status/draftStatus";
import { submitBlockedReason } from "@/lib/status/submitBlocked";
import { isValueEmpty } from "@/lib/schema/conditions";
import { validateNoteState } from "@/lib/schema/validateNoteState";
import { useAutosave } from "@/lib/client/useAutosave";
import { isDirty } from "@/lib/client/autosaveMachine";
import {
  clearDraftBackup,
  readLatestDraftBackup,
  writeDraftBackup
} from "@/lib/client/draftBackup";
import type { FieldValue, NoteState } from "@/lib/schema/types";
import type { AuditFinding } from "@/lib/audit/types";
import { dentistOwnedKeys } from "@/lib/schema/scopeGuard";
import { NoteForm } from "./NoteForm";
import { FastLane } from "./FastLane";
import { PasteIntake } from "./PasteIntake";
import { DictationUserContext } from "./fields/DictationField";
import { AuditPanel } from "./AuditPanel";
import { NoteReadback } from "./NoteReadback";
import { PriorNotes } from "./PriorNotes";
import { ByteAdvisor } from "@/components/advisor/ByteAdvisor";
import { ByteStarAdvisor } from "@/components/advisor/ByteStarAdvisor";
import { SaveIndicator } from "./SaveIndicator";
import { StatusChip } from "@/components/ui/StatusChip";
import { ProgressRing } from "./ProgressRing";
import { Dialog } from "@/components/ui/Dialog";
import { HelpTip } from "@/components/ui/HelpTip";
import { LicenseScopeCard } from "@/components/law/LicenseScopeCard";
import { daySeed, sparkleLine } from "@/lib/stats/sparkle";

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
  canEdit,
  autoFocusKey,
  edrName,
  username
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
  /**
   * `moduleId.fieldId` to land the cursor in on mount. The home page sets it;
   * /note/[id] does not, because arriving at a specific note from a link is a
   * navigation, and stealing focus mid-navigation moves the page under someone
   * who was reading it.
   */
  autoFocusKey?: string;
  /**
   * The practice's charting product, resolved on the server (see lib/edr).
   * A prop rather than a call here because the override lives in a server-only
   * environment variable, and reading it from a client bundle silently gives
   * every practice the default name instead of theirs.
   */
  edrName: string;
  /** Whose dictation enrollment to look for. See DictationUserContext. */
  username: string;
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(noteReducer, initialNote);
  const [title, setTitle] = useState(initialTitle);
  const [officeId, setOfficeId] = useState<string | null>(initialOfficeId);
  // Has this session made a real edit yet? Distinguishes "nothing has happened"
  // from "something happened and was reverted" — see the autosave effect.
  const hasEdited = useRef(false);
  const [tab, setTab] = useState<"audit" | "chart" | "byte" | "bytestar" | "prior" | "preview">("audit");
  const [override, setOverride] = useState<{ signature: string; reason: string } | null>(null);
  // ATTESTATIONS AND ESCALATIONS on ordinary findings.
  //
  // Held in component state and keyed by a signature of the note's content,
  // exactly like the PHI override above — not in drafts.noteState, and not in a
  // new drafts column. A compliance artifact does not belong in the mutable
  // working copy: the note it describes can change under it, and the revision
  // ring would carry copies of a judgement about text that no longer exists.
  // Edit the note and the signature moves, which is the correct behaviour —
  // "this wording is right" was said about wording, and the wording changed.
  const [resolutions, setResolutions] = useState<{
    signature: string;
    attested: Record<string, string>;
    escalated: Record<string, boolean>;
  }>({ signature: "", attested: {}, escalated: {} });
  const [showOverride, setShowOverride] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pasteConfirmOpen, setPasteConfirmOpen] = useState(false);
  const [pasteConfirmed, setPasteConfirmed] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  // Below `lg` the module rail, form, and Sidekick stack vertically (see the
  // flex-col wrapper below), which buried live audit feedback under the
  // entire form — a clinician charting on a phone or tablet had to scroll
  // past everything just to see whether the note was blocked. This mirrors
  // the Sidekick into a reachable sheet on those screens instead; the desktop
  // sticky aside is untouched.
  const [showMobileAudit, setShowMobileAudit] = useState(false);
  // Paste is an ENTRY mode — reached for once, at the start of a note, and
  // never again in it. As a permanent card above the fields it spent the top of
  // the busiest screen on something used at most once per note; behind a button
  // it costs one control and appears exactly when it is wanted.
  const [showPaste, setShowPaste] = useState(false);
  // The module picker was a 240px COLUMN of its own, holding one closed
  // disclosure, permanently, next to the note. Most notes are Universal Core
  // plus at most one add-on, chosen once at the start. A dialog off the note bar
  // gives the writing the width back and costs a click on the rare visit that
  // needs it.
  const [showModules, setShowModules] = useState(false);

  const autosave = useAutosave(draftId, initialVersion);
  const { markEdited, flush, adoptVersion } = autosave;
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
  // Add-ons beyond the always-on Universal Core. Drives the module rail's
  // summary line so a closed rail still says what the note covers.
  const extraModuleCount = state.selectedModuleIds.filter(
    (id) => !ALL_MODULES.find((m) => m.id === id)?.alwaysOn
  ).length;

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
    () =>
      runAudit({
        note: deferredState,
        modules: auditModules,
        composedText: markdown,
        clinicalRole
      }),
    [deferredState, auditModules, markdown, clinicalRole]
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

  // The signature attestations are held against: the composed note itself.
  // Coarser than tracking each finding's own text, and deliberately so —
  // "this reads correctly" is a statement about the note, and once the note has
  // moved on it is a statement about something else.
  const resolutionsForNote =
    resolutions.signature === markdown
      ? resolutions
      : { signature: markdown, attested: {}, escalated: {} };

  const recordAttestation = (key: string, reason: string) =>
    setResolutions((r) => {
      const base = r.signature === markdown ? r : { signature: markdown, attested: {}, escalated: {} };
      return { ...base, signature: markdown, attested: { ...base.attested, [key]: reason } };
    });

  // A disagreement is about the RULE. The reason and the rule id travel; the
  // note text never does — a wish is read by a Team Lead in a different screen,
  // and clinical content has no business being copied there.
  const escalateFinding = async (finding: AuditFinding) => {
    const key = `finding:${finding.ruleId}:${finding.fieldRef ? `${finding.fieldRef.moduleId}.${finding.fieldRef.fieldId}` : ""}:${finding.matchedText ?? ""}`;
    try {
      const res = await fetch("/api/wishes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: "rule-disagreement",
          title: `Rule disagreement: ${finding.ruleId}`,
          detail: `A writer disagreed with this rule while composing a note.\n\n(Rule: ${finding.ruleId} — raised in the note builder.)`
        })
      });
      if (!res.ok) {
        setToast({ text: "Could not reach the wish list — try again shortly.", tone: "error" });
        return;
      }
      setResolutions((r) => {
        const base = r.signature === markdown ? r : { signature: markdown, attested: {}, escalated: {} };
        return { ...base, signature: markdown, escalated: { ...base.escalated, [key]: true } };
      });
      setToast({ text: "Sent to a Team Lead as a rule disagreement.", tone: "success" });
    } catch {
      setToast({ text: "Could not reach the wish list — check the connection.", tone: "error" });
    }
  };

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

  // Why Submit is off. Pure and in lib/status so it can be tested — it named a
  // count of zero as a second task when a stop was the only blocker.
  const blockedReason = useMemo(() => submitBlockedReason(report.counts), [report.counts]);

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

  // OFFLINE SAFETY NET — same-device IndexedDB ring + localStorage fallback.
  //
  // Autosave retries on reconnect and flushes on pagehide; this mirror covers
  // the window when the tab dies before the server ack. Deleted on save.
  const [backupOffer, setBackupOffer] = useState<{
    note: NoteState;
    title: string;
    officeId: string | null;
    at: number;
  } | null>(null);
  const [showRevisions, setShowRevisions] = useState(false);
  const [revisions, setRevisions] = useState<
    { id: number; version: number; title: string; savedAt: string }[]
  >([]);
  const [revisionsBusy, setRevisionsBusy] = useState(false);

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    void (async () => {
      const mirror = await readLatestDraftBackup(draftId);
      if (cancelled || !mirror) return;
      const valid = validateNoteState(mirror.note);
      if (!valid.ok) {
        await clearDraftBackup(draftId);
        return;
      }
      if (JSON.stringify(mirror.note) === JSON.stringify(initialNote)) {
        await clearDraftBackup(draftId);
        return;
      }
      setBackupOffer({
        note: valid.value,
        title: mirror.title || initialTitle,
        officeId: mirror.officeId,
        at: mirror.at
      });
    })();
    return () => {
      cancelled = true;
    };
    // Mount-only: the offer describes the state of the world when the page opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!canEdit || !hasEdited.current) return;
    if (isDirty(autosave.state)) {
      void writeDraftBackup(draftId, {
        note: state,
        title,
        officeId,
        at: Date.now()
      });
    } else if (autosave.state.status === "saved") {
      void clearDraftBackup(draftId);
    }
  }, [state, title, officeId, autosave.state, canEdit, draftId]);

  const openRevisions = useCallback(async () => {
    setShowRevisions(true);
    setRevisionsBusy(true);
    try {
      const res = await fetch(`/api/drafts/${draftId}/revisions`);
      if (!res.ok) {
        setToast({ text: "Could not load earlier saves.", tone: "error" });
        setShowRevisions(false);
        return;
      }
      const data = (await res.json()) as {
        revisions?: { id: number; version: number; title: string; savedAt: string }[];
      };
      setRevisions(data.revisions ?? []);
    } catch {
      setToast({ text: "Could not load earlier saves.", tone: "error" });
      setShowRevisions(false);
    } finally {
      setRevisionsBusy(false);
    }
  }, [draftId]);

  const restoreRevision = useCallback(
    async (revisionId: number) => {
      setRevisionsBusy(true);
      try {
        const res = await fetch(`/api/drafts/${draftId}/revisions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ revisionId, baseVersion: autosave.version })
        });
        if (res.status === 409) {
          setToast({
            text: "Someone else saved while you were restoring — reload, then try again.",
            tone: "error"
          });
          return;
        }
        if (!res.ok) {
          setToast({ text: "Could not restore that save.", tone: "error" });
          return;
        }
        const data = (await res.json()) as {
          version: number;
          title: string;
          officeId: string | null;
          note: NoteState;
        };
        dispatch({ type: "restore", state: data.note });
        setTitle(data.title);
        setOfficeId(data.officeId);
        adoptVersion(data.version);
        setShowRevisions(false);
        setToast({
          text: `Earlier save restored — autosave will keep it on the server. ${sparkleLine("saved", daySeed(new Date()))}`,
          tone: "success"
        });
      } catch {
        setToast({ text: "Could not restore that save.", tone: "error" });
      } finally {
        setRevisionsBusy(false);
      }
    },
    [draftId, autosave.version, adoptVersion]
  );

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

  // Land the cursor, once, on the field the host page nominated.
  //
  // Done here by DOM lookup rather than by threading an autoFocus prop through
  // NoteForm and all seven input components: every field already carries a
  // `field-${moduleId}-${fieldId}` anchor for the audit panel's "go to field"
  // jump, and reusing it keeps the focus rule in one place instead of seven.
  //
  // Guarded on document.activeElement. Hydration is not instant, and someone
  // who has already clicked into a different field — or started scrolling with
  // a control focused — must not have the page yanked out from under them a
  // moment later. No scroll: the narrative sits at the top of the note, and
  // scrolling on arrival is disorienting when nothing asked for it.
  useEffect(() => {
    if (!autoFocusKey || !canEdit) return;
    const [moduleId, fieldId] = autoFocusKey.split(".");
    if (!moduleId || !fieldId) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    document
      .getElementById(`field-${moduleId}-${fieldId}`)
      ?.querySelector<HTMLElement>("input, select, textarea")
      ?.focus({ preventScroll: true });
    // Mount only. A re-run on any later render would steal focus mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // TWO IDENTIFIERS BEFORE THE CLIPBOARD.
  //
  // Carried over from the standardize screen, which asked for this and which
  // the builder never did — so the copy that went into a chart was the one with
  // no check on it. A perfect note in the wrong chart is a records error this
  // tool cannot see, and the only person who can is the one about to paste.
  //
  // Two presses, not a dialog: the first opens the confirmation, the second
  // writes the clipboard. A modal here would be dismissed by reflex.
  const copy = async () => {
    if (!pasteConfirmed) {
      setPasteConfirmOpen(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setPasteConfirmOpen(false);
      setPasteConfirmed(false);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      download(`${filename}.md`, markdown);
    }
  };

  const setValue = (key: string, value: FieldValue) => dispatch({ type: "setValue", key, value });

  // Paste intake destination. APPENDS rather than replaces: sending a second
  // partition to the same field must not silently delete the first, and a
  // writer who already typed something there is not expecting it overwritten.
  // Everything else about it is an ordinary edit — same reducer, same autosave,
  // same audit, same undo story as typing.
  const appendToField = (key: string, text: string) => {
    const existing = state.values[key];
    const prior = existing?.kind === "text" ? existing.value.trim() : "";
    dispatch({
      type: "setValue",
      key,
      value: { kind: "text", value: prior ? `${prior} ${text.trim()}` : text.trim() }
    });
  };

  // Which narrative destinations this licence may not write. The scope guard
  // already refuses these on save; offering a button that is going to 403 is
  // how a person learns a rule from an error message instead of from the UI.
  const lockedFieldKeys = useMemo(() => {
    if (canRecordClinicalJudgement(clinicalRole)) return new Set<string>();
    return dentistOwnedKeys(modules);
  }, [clinicalRole, modules]);

  // Shared between the desktop sticky aside and the mobile audit sheet, so
  // the two never drift into two different implementations of the same
  // panel. Closes over local state directly rather than taking props — it is
  // rendered, not reused as a component, so there is no extra fiber or
  // remount cost to doing it this way.
  const sidekickBody = (
    <>
      {/* One status signal here, not three. The ring, a StatusChip and the
          report status as text all sat in this row, with the SAME chip already
          in the note bar above and the AuditPanel repeating the same status
          string as a banner ~180px below. Seven expressions of one note's state
          on one screen. The chip lives in the note bar; the panel says the rest. */}
      <div className="mb-3 flex items-center gap-3">
        <ProgressRing counts={report.counts} />
        <p className="min-w-0 flex-1 text-xs text-slate-500">
          {auditing
            ? "Checking the latest edit…"
            : "Live check, deterministic only. It never scores the note, and nothing here is applied for you."}
        </p>
      </div>
      {/* The writer's own TN scope, one click away — advisory here; the
          Assessment/Plan scope-lock does the enforcing. */}
      <div className="mb-3">
        <LicenseScopeCard clinicalRole={clinicalRole} />
      </div>
      {/* flex-wrap, not a single row. Six tabs do not fit the aside at any
          desktop width, and without wrapping the last one pushed the whole
          PAGE two pixels wider than the viewport — which the cross-browser
          smoke test asserts against. It went unseen because that suite never
          visits the builder; the builder moving onto the home page is what
          finally put it in front of the check. */}
      <div className="mb-3 flex flex-wrap gap-1">
        {([["audit", `Audit (${report.findings.length})`], ["chart", "Chart"], ["byte", "Byte"], ["bytestar", "SuperByte"], ["prior", "Prior"], ["preview", "Preview"]] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`tap rounded px-3 text-sm font-medium ${tab === t ? "bg-brand-blue text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="pane-60">
        {tab === "audit" ? (
          <AuditPanel
            report={report}
            onJump={() => setShowMobileAudit(false)}
            started={hasContent}
            attestations={resolutionsForNote.attested}
            escalated={resolutionsForNote.escalated}
            onAttest={canEdit ? recordAttestation : undefined}
            onEscalate={canEdit ? escalateFinding : undefined}
          />
        ) : tab === "byte" ? (
          /* Byte reads the same composed markdown the chart does — one
             memoized composition, one deferred cadence. Advice-only here; the
             "think deeper" path lives on the Standardize screen where the
             assist consent and queue already are. */
          <ByteAdvisor text={markdown} clinicalRole={clinicalRole} />
        ) : tab === "bytestar" ? (
          <ByteStarAdvisor text={markdown} />
        ) : tab === "prior" ? (
          /* A frozen filed note beside the draft — for checking against the
             last visit, never for copying it forward. */
          <PriorNotes />
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
          className={
            !hasContent || !gates.exportAllowed ? "btn-secondary" : "btn-complete"
          }
          disabled={!hasContent || !gates.exportAllowed}
          aria-disabled={!hasContent || !gates.exportAllowed}
          aria-describedby={!gates.exportAllowed && hasContent ? "builder-export-locked" : undefined}
          title={
            !hasContent
              ? "Add note content before copying"
              : gates.exportAllowed
                // main's wording for the enabled state — it names where the
                // note is going, which "Copy the composed note" did not — with
                // this branch's de-shouted lock text.
                ? `Copy a clean note for pasting into ${edrName}`
                : "Resolve every stop finding before copy or download"
          }
          onClick={copy}
        >
          {copied
            ? "Copied — ready to paste ✓"
            : !gates.exportAllowed && hasContent
              ? "🔒 Copy locked"
              : `Copy for ${edrName}`}
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
                : "Resolve every stop finding before copy or download"
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
                : "Resolve every stop finding before copy or download"
          }
          onClick={() => download(`${filename}.txt`, composeNoteText(deferredState, auditModules, { officeName }))}
        >
          Download .txt
        </button>
        {pasteConfirmOpen && !copied && (
          <div className="mt-2 w-full rounded border border-brand-blue/40 bg-brand-blue/10 p-3">
            <label className="flex items-start gap-2 text-xs text-brand-navy">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={pasteConfirmed}
                onChange={(e) => setPasteConfirmed(e.target.checked)}
              />
              <span>
                The correct chart is open in {edrName} and I matched <strong>two</strong>{" "}
                identifiers there (for example name and date of birth). A perfect note in the
                wrong chart is a records error this tool cannot see — only you can.
              </span>
            </label>
            <button className="btn-complete mt-2 text-xs" onClick={copy} disabled={!pasteConfirmed}>
              Copy to clipboard
            </button>
          </div>
        )}
        <HelpTip label="About copy and download">
          Copy and download stay locked while any stop finding is open. A privacy stop can be
          attested; other stops must be fixed in the note. Required fields block Submit but not
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
          Copy and download are locked until every stop is fixed
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
      {/* Sticky patient-header-style bar — IDENTITY AND STATE ONLY.
          It used to also carry Earlier saves, Save, Submit and a HelpTip, which
          put the controls you reach for at the END of a note in the most
          valuable strip on the screen at the START of one — and on a phone
          wrapped it to four or five rows, pinning a third of the viewport for
          the whole session. Those moved to a sticky action bar at the bottom,
          which is where a primary action belongs and what the mockup asked for.

          md:top-20, not top-0: the app header is sticky at top-0 with z-40, so
          this bar — pinned to the same coordinate with a lower z — slid
          UNDERNEATH it and vanished on the first scroll. The one bar meant to
          stay with you was the one that did not. 80px matches the offset the
          module rail and the Sidekick already use. */}
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur md:top-20">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="tap-input min-w-0 flex-1 rounded border border-transparent px-1 py-1.5 text-lg font-semibold hover:border-slate-300 focus:border-brand-blue focus:outline-none disabled:bg-transparent"
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
          {canEdit && (
            <button
              type="button"
              className="chip"
              onClick={() => setShowModules(true)}
              title="Which modules this note covers"
            >
              {extraModuleCount === 0 ? "Core only" : `Core + ${extraModuleCount}`}
            </button>
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
        </div>
      </div>

      {/* The "Not ready to file yet" banner used to live here. Its job — saying
          WHY Submit is off, on the screen rather than in a tooltip — is now done
          by the action bar at the bottom, beside the button it is about, and
          without a full-width orange banner competing with the note. */}

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
          absence is a legitimate answer, and so is a fact, but only one of them tells
          whoever reads this next what happened.
        </p>
      )}

      {!canEdit && (
        <p className="mb-4 rounded border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700">
          You have read-only access. You can view this note but not edit or submit it.
        </p>
      )}

      {/* The offline mirror found unsaved work from a previous session. Offered,
          never auto-applied: the writer decides which copy is the truth. */}
      {canEdit && backupOffer && (
        <div
          className="mb-4 rounded border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900"
          role="status"
        >
          <p>
            <strong>Unsaved work from a previous session was found on this device</strong> (
            {new Date(backupOffer.at).toLocaleString()}). It never reached the server — restore it
            here, or keep the server copy and discard it.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary text-xs"
              onClick={() => {
                dispatch({ type: "restore", state: backupOffer.note });
                setTitle(backupOffer.title);
                setOfficeId(backupOffer.officeId);
                setBackupOffer(null);
                setToast({
                  text: `Local backup restored — it will autosave like any edit. ${sparkleLine("saved", daySeed(new Date()))}`,
                  tone: "success"
                });
              }}
            >
              Restore local backup
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => {
                void clearDraftBackup(draftId);
                setBackupOffer(null);
              }}
            >
              Keep server copy, discard backup
            </button>
          </div>
        </div>
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
        {/* Form. THE NOTE IS FIRST.
            Two cards used to sit above it — a paste box and a verified-block
            picker with a destination dropdown — so the first two things on the
            busiest screen were tools used occasionally, in front of the fields
            used every time. Paste is now a button in the note bar, because it is
            an ENTRY mode: you reach for it once, at the start, and never again
            in that note. Verified blocks moved into the chip row of each text
            field, which deleted the destination dropdown outright. */}
        <section className="min-w-0 flex-1 space-y-4">
          {/* Progressive Fast Lane, from main: while this note is still
              Core-only, offer role-aware visit scaffolds in place. These add
              structure, never a second draft and never clinical values.

              Outside the fieldset on purpose — it takes canEdit itself, and
              inside it a read-only viewer would see the cards greyed rather
              than absent. */}
          <FastLane
            clinicalRole={clinicalRole}
            canEdit={canEdit}
            visible={extraModuleCount === 0}
            onApply={(pick) => {
              dispatch({ type: "applyModules", moduleIds: pick.moduleIds });
              if (!title.trim() || title.trim() === "Untitled note") {
                setTitle(pick.label);
              }
            }}
          />
          <fieldset disabled={!canEdit} className="min-w-0">
            <DictationUserContext.Provider value={username}>
            <NoteForm
              modules={modules}
              state={state}
              onChange={setValue}
              findingsByField={fieldFindings}
              clinicalRole={clinicalRole}
            />
            </DictationUserContext.Provider>
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

      {/* THE ACTION BAR — what you do when the note is finished, at the end.
          Save, Submit and the two ways in and back (paste, earlier saves) were
          all in the sticky header. Putting the end of the task at the start of
          the screen is the order-of-operations complaint in one line, and it
          cost a phone four or five wrapped rows of pinned chrome.

          The reason Submit is off is stated HERE, next to the disabled button,
          rather than only in a title tooltip that no tablet and no keyboard
          user ever sees — and it is stated even on an untouched note, which the
          old banner deliberately skipped, leaving the disabled control with no
          on-screen explanation at all. */}
      {canEdit && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => setShowPaste(true)}
              title="Paste a note you already wrote and choose where its sections go"
            >
              Paste a note
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              title="Restore a recent server autosave of this working copy"
              onClick={() => void openRevisions()}
            >
              Earlier saves
            </button>
            <p className="min-w-0 flex-1 text-xs text-slate-600" id="builder-submit-blocked">
              {liveStatus === "submitted"
                ? "Filed. Edit the note to submit again."
                : !hasContent
                  ? "Write something and Submit turns on."
                  : gates.emailAllowed
                    ? "Ready to file."
                    : blockedReason}
            </p>
            <button className="btn-secondary" title="Save now (Ctrl+S)" onClick={() => void flush()}>
              Save
            </button>
            <button
              className="btn-primary"
              disabled={!hasContent || !gates.emailAllowed || liveStatus === "submitted"}
              aria-disabled={!hasContent || !gates.emailAllowed || liveStatus === "submitted"}
              aria-describedby="builder-submit-blocked"
              onClick={() => void trySubmit()}
            >
              Submit
            </button>
          </div>
        </div>
      )}

      {showModules && (
        <Dialog title="Modules in this note" onClose={() => setShowModules(false)}>
          <p className="mb-2 text-xs text-slate-600">
            Universal Core is always on. Add the modules for what actually happened this visit.
          </p>
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
              {ALL_MODULES.filter(
                (m) =>
                  !m.alwaysOn &&
                  moduleVisibleInRail(clinicalRole, m.id) &&
                  moduleMatches(m, moduleQuery)
              ).map((m) => (
                <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-brand-blue/10">
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
        </Dialog>
      )}

      {/* Both sides of this conflict were moving the same thing — what sits
          above the fields — in opposite directions. main added the Fast Lane
          there; this branch took paste OUT of there and put it behind a button.
          Both survive: the Fast Lane renders in the form section (see below,
          where main put it), and paste stays a dialog. They do not compete,
          because the Fast Lane only appears on a Core-only note and disappears
          the moment it is used, while paste is reached for deliberately. */}
      {showPaste && (
        <Dialog title="Paste an existing note" onClose={() => setShowPaste(false)}>
          <PasteIntake onSend={appendToField} canEdit={canEdit} lockedSections={lockedFieldKeys} />
        </Dialog>
      )}

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
      {showRevisions && (
        <Dialog title="Earlier saves" onClose={() => setShowRevisions(false)}>
          <p className="mb-3 text-sm text-slate-600">
            Working-copy autosaves on the server (last 20). Restoring replaces what is on screen
            and saves as a new version — filed submissions are unchanged.
          </p>
          {revisionsBusy && revisions.length === 0 ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : revisions.length === 0 ? (
            <p className="text-sm text-slate-500">No earlier saves yet — keep typing; autosave builds the list.</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {revisions.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium text-slate-800">v{r.version}</span>
                    <span className="text-slate-500">
                      {" "}
                      · {new Date(r.savedAt).toLocaleString()}
                      {r.title ? ` · ${r.title}` : ""}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    disabled={revisionsBusy}
                    onClick={() => void restoreRevision(r.id)}
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Dialog>
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
