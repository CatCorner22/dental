"use client";

import { canRecordClinicalJudgement, type ClinicalRole } from "@/lib/auth/clinicalRoles";
import { checkFilingAuthority } from "@/lib/auth/approval";

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
import Link from "next/link";
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
import { builderFinishLine } from "@/lib/status/finishLine";
import { withOffice } from "@/lib/drafts/autoTitle";
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
import {
  packBlockIdsForVisit,
  type PublishedPackLite
} from "@/lib/packs/publishedForVisit";
import { fieldKey } from "@/lib/schema/types";
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
import { TransferDraftDialog } from "@/components/notes/TransferDraftDialog";
import { daySeed, sparkleLine } from "@/lib/stats/sparkle";
import type { UsaRegionId } from "@/lib/dictation/regional";

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

/**
 * The three ways a finished note leaves this app, and the words for each.
 *
 * One table so the button and the confirmation that follows it cannot end up
 * describing different actions — which is exactly what happened when the
 * clipboard route grew a chart check and the two download routes did not.
 * `label` is what the trigger says, `noun` is what it is called when it is
 * locked, and `verb` is the button that actually does it.
 */
const EXPORT_ROUTES: {
  intent: "copy" | "md" | "txt";
  label: (edr: string) => string;
  noun: string;
  verb: string;
}[] = [
  { intent: "copy", label: (edr) => `Copy for ${edr}`, noun: "Copy", verb: "Copy to clipboard" },
  { intent: "md", label: () => "Download .md", noun: "Download", verb: "Download the .md file" },
  { intent: "txt", label: () => "Download .txt", noun: "Download", verb: "Download the .txt file" }
];

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
  canTransfer = false,
  autoFocusKey,
  edrName,
  username,
  dictationEnrolled = false,
  dictationRegion = null
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
   * System-role transfer power (Team Lead+). Distinct from clinical handoff
   * copy: a hygienist is told to transfer, but only a lead can run the API.
   */
  canTransfer?: boolean;
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
  /**
   * Has this person finished the dictation practice session, and with which
   * regional prompt set? Resolved on the SERVER and passed down — a client
   * fetch would race the legal-notice gate on a page that mounts the instant
   * somebody signs in.
   */
  dictationEnrolled?: boolean;
  dictationRegion?: string | null;
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(noteReducer, initialNote);
  const [title, setTitle] = useState(initialTitle);
  const [officeId, setOfficeId] = useState<string | null>(initialOfficeId);
  // Has this session made a real edit yet? Distinguishes "nothing has happened"
  // from "something happened and was reverted" — see the autosave effect.
  const hasEdited = useRef(false);
  const [tab, setTab] = useState<"audit" | "chart" | "prior" | "preview">("audit");
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
  // WHICH WAY THE NOTE IS LEAVING, AND WHETHER THE CHART CHECK IS DONE.
  //
  // This used to be a boolean that only the clipboard consulted, and the two
  // download buttons sat eight pixels away from it writing the same composed
  // note to a file with no check at all. The check is about the chart the note
  // is going into, not about the clipboard API, so a file on the desktop that
  // gets pasted five minutes later needs it every bit as much — arguably more,
  // because by then the writer is not looking at this screen. One intent, one
  // confirmation, three destinations.
  const [exportIntent, setExportIntent] = useState<null | "copy" | "md" | "txt">(null);
  const [pasteConfirmed, setPasteConfirmed] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  // Below `lg` the module rail, form, and Sidekick stack vertically (see the
  // flex-col wrapper below), which buried live audit feedback under the
  // entire form — a clinician charting on a phone or tablet had to scroll
  // past everything just to see whether the note was blocked. This mirrors
  // the Sidekick into a reachable sheet on those screens instead; the desktop
  // sticky aside is untouched.
  const [showMobileAudit, setShowMobileAudit] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
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
  // Published practice packs (Team Lead Workflow) — boost Section starters and
  // reorder Fast Lane featured picks (no pack-browser chip wall).
  const [practicePacks, setPracticePacks] = useState<PublishedPackLite[]>([]);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/workflow/packs?status=published")
      .then((r) => (r.ok ? r.json() : { packs: [] }))
      .then((d: { packs?: Array<Record<string, unknown>> }) => {
        if (cancelled || !Array.isArray(d.packs)) return;
        setPracticePacks(
          d.packs.map((p) => ({
            id: Number(p.id),
            title: String(p.title ?? ""),
            description: String(p.description ?? ""),
            moduleIds: Array.isArray(p.moduleIds) ? (p.moduleIds as string[]) : [],
            blockIds: Array.isArray(p.blockIds) ? (p.blockIds as string[]) : [],
            authorRoles: Array.isArray(p.authorRoles) ? (p.authorRoles as string[]) : []
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setPracticePacks([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  // Add-ons beyond the always-on Universal Core. Drives the module rail's
  // summary line so a closed rail still says what the note covers.
  const extraModuleCount = state.selectedModuleIds.filter(
    (id) => !ALL_MODULES.find((m) => m.id === id)?.alwaysOn
  ).length;
  const packBlockIds = useMemo(
    () => packBlockIdsForVisit(practicePacks, clinicalRole, state.selectedModuleIds),
    [practicePacks, clinicalRole, state.selectedModuleIds]
  );

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
  // Same rule the submit API enforces — surface it before the dialog fails.
  // Computed before liveStatus so the Andon chip cannot say Ready while Submit
  // is blocked for dentist filing (UIX-001).
  const filing = useMemo(
    () => checkFilingAuthority(clinicalRole, auditModules, deferredState),
    [clinicalRole, auditModules, deferredState]
  );

  const liveStatus = deriveDraftStatus({
    hasContent,
    counts: report.counts,
    phiStops: report.phiStops.length,
    submitted: resentNow || (initialSubmitted && !editedSinceLoad) || submittedNow,
    // A successful resend clears the failure — it wins over the stored flag.
    lastSendFailed: !resentNow && ((initialSendFailed && !editedSinceLoad) || sendFailedNow),
    filingAllowed: filing.allowed
  });

  // Why Submit is off. Pure and in lib/status so it can be tested — it named a
  // count of zero as a second task when a stop was the only blocker.
  const blockedReason = useMemo(() => submitBlockedReason(report.counts), [report.counts]);
  // Every reason Submit is off, in one place — including main's filing
  // authority check, which is the one whose reason a person can least guess at
  // ("a dentist must file this note"). The aria-disabled Submit reads this and
  // so does the sentence beside it, so the two can never disagree about
  // whether the button works.
  const submitBlocked =
    !hasContent || !gates.emailAllowed || !filing.allowed || liveStatus === "submitted";

  // Scope cue (Assessment/Plan are dentist) vs transfer-required (filing blocked).
  // Hygienists who may still file must not see "ownership must move" (UIX-002).
  const showScopeCue =
    canEdit &&
    liveStatus !== "submitted" &&
    !canRecordClinicalJudgement(clinicalRole);
  const needsTransfer = canEdit && liveStatus !== "submitted" && !filing.allowed;
  const topStop = report.findings.find((f) => f.severity === "S0");
  const finishLine = builderFinishLine({
    hasContent,
    filingAllowed: filing.allowed,
    exportAllowed: gates.exportAllowed,
    emailAllowed: gates.emailAllowed,
    blockedReason
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

  // THE FILE IS NAMED AFTER THE NOTE, NOT AFTER ITS MODULES.
  //
  // Every download landed as `dental-note-draft-universal-core`, so a
  // downloads folder held five files with the same name and a counter after
  // it. The note already carries a name built to be searched on —
  // date_Who_Where_time — and using it costs nothing. `suggestedFilename`
  // stays as the fallback for a note whose title has been emptied.
  const filename = useMemo(() => {
    const fromTitle = title
      .trim()
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 120);
    return fromTitle || suggestedFilename(state, ALL_MODULES);
  }, [title, state]);

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
    canEdit &&
    hasContent &&
    gates.emailAllowed &&
    filing.allowed &&
    liveStatus !== "submitted" &&
    !showSubmit;
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

  // TWO IDENTIFIERS BEFORE THE NOTE LEAVES.
  //
  // Carried over from the standardize screen, which asked for this and which
  // the builder never did — so the copy that went into a chart was the one with
  // no check on it. A perfect note in the wrong chart is a records error this
  // tool cannot see, and the only person who can is the one about to paste.
  //
  // Two presses, not a dialog: the first opens the confirmation, the second
  // sends the note. A modal here would be dismissed by reflex.
  const runExport = async (intent: "copy" | "md" | "txt") => {
    if (intent === "md") return download(`${filename}.md`, markdown);
    if (intent === "txt") {
      return download(
        `${filename}.txt`,
        composeNoteText(deferredState, auditModules, { officeName })
      );
    }
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // No clipboard permission (an insecure origin, a locked-down kiosk). The
      // note still has to reach the chart, and the check has already been made.
      download(`${filename}.md`, markdown);
    }
  };

  const confirmExport = async () => {
    const intent = exportIntent;
    if (!intent || !pasteConfirmed) return;
    setExportIntent(null);
    setPasteConfirmed(false);
    await runExport(intent);
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
  // BYTE AND SUPERBYTE ARE NOT TABS, AND NOT DESKTOP-ONLY EITHER.
  //
  // They were two of six tabs, so seeing either one meant losing sight of the
  // audit, and a writer who never pressed a tab never met them at all — a
  // real-time helper you have to go and find is not a real-time helper. That
  // was fixed by lifting them above the tabs.
  //
  // It was only half a fix. They still lived inside the sidekick, and the
  // sidekick is `hidden lg:block`, so on a phone or a portrait tablet the pair
  // was `display: none` — present in the markup, invisible to the writer and
  // skipped by a screen reader — until somebody tapped the audit bar. "Always
  // visible, for every role" cannot mean "on a wide screen". So they are their
  // own fragment now, rendered in the aside on a wide screen and inline above
  // the form on a narrow one, and NOT inside the mobile sheet, which would put
  // two live copies on screen at once.
  // THE CHART CHECK, RENDERED WHEREVER AN EXPORT CAN BE STARTED.
  //
  // Two surfaces offer Copy — the desktop sidekick and the phone's audit sheet
  // — and both go through the same intent. A fragment rather than a duplicated
  // block, because a confirmation that exists in two hand-maintained copies is
  // a confirmation that will eventually say two different things, and the one
  // it guards is "is this the right patient's chart".
  const exportCheck = exportIntent && !copied && (
    <div
      id="builder-export-check"
      className="mt-2 w-full rounded border border-brand-blue/40 bg-brand-blue/10 p-3"
    >
      <p className="mb-1 text-xs font-semibold text-brand-navy">
        One check before this leaves Smile Notes
      </p>
      <label className="flex items-start gap-2 text-xs text-brand-navy">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={pasteConfirmed}
          onChange={(e) => setPasteConfirmed(e.target.checked)}
        />
        <span>
          The correct chart is open in {edrName} and I matched <strong>two</strong> identifiers
          there (for example name and date of birth). A perfect note in the wrong chart is a
          records error this tool cannot see — only you can.
        </span>
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          className="btn-complete text-xs"
          onClick={() => void confirmExport()}
          aria-disabled={!pasteConfirmed}
        >
          {EXPORT_ROUTES.find((r) => r.intent === exportIntent)?.verb ?? "Continue"}
        </button>
        <button className="btn-secondary text-xs" onClick={() => setExportIntent(null)}>
          Not yet
        </button>
      </div>
    </div>
  );

  const advisors = (
    <div className="space-y-2">
      {/* Byte first: it is the deterministic advisor reading the note that was
          just typed, and it is the one whose advice cites a rule. SuperByte is
          the experimental one and sits under it. */}
      <ByteAdvisor text={markdown} clinicalRole={clinicalRole} />
      <ByteStarAdvisor text={markdown} />
    </div>
  );

  const sidekickBody = (
    <>
      {/* One status signal here, not three. The ring, a StatusChip and the
          report status as text all sat in this row, with the SAME chip already
          in the note bar above and the AuditPanel repeating the same status
          string as a banner ~180px below. Seven expressions of one note's state
          on one screen. The chip lives in the note bar; the panel says the rest. */}
      <div className="mb-3 flex items-center gap-3">
        <ProgressRing counts={report.counts} filingAllowed={filing.allowed} />
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
      {/* Byte and SuperByte are rendered ONCE, by the aside — see the
          `advisors` fragment and the layout note there. They are not in this
          fragment, so the mobile sheet does not show a second live copy of the
          pair the writer already has in front of them.

          The jump links arriving from main stay, scoped to `lg`: on a wide
          screen they scroll the aside to an advisor that is right above them,
          and below `lg` this whole fragment only exists inside the audit sheet,
          where a link pointing at something outside the sheet would scroll the
          page behind it. slate-500 rather than the slate-400 this arrived with
          — see the guard in src/lib/theme/contrast.test.ts. */}
      <nav
        aria-label="Advisor jump links"
        className="mb-1.5 hidden flex-wrap items-center gap-1.5 text-[0.7rem] lg:flex"
      >
        <span className="text-slate-500">Jump to</span>
        {(
          [
            ["advisor-byte", "Byte"],
            ["advisor-superbyte", "SuperByte"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200/80"
            onClick={() =>
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
            }
          >
            {label}
          </button>
        ))}
      </nav>
      {/* flex-wrap, not a single row. Even at four, tabs do not reliably fit
          the aside at every desktop width, and without wrapping the last one
          pushed the whole PAGE two pixels wider than the viewport — which the
          cross-browser smoke test asserts against. */}
      <div className="mb-3 flex flex-wrap gap-1">
        {([["audit", `Audit (${report.findings.length})`], ["chart", "Chart"], ["prior", "Prior"], ["preview", "Preview"]] as const).map(([t, label]) => (
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
        {/* EVERY WAY OUT ASKS THE SAME QUESTION.
            Three buttons that all put the composed note somewhere a patient
            record can receive it, so all three open the same one check. The
            ellipsis is not decoration — it is the standard signal that a
            control opens a step rather than doing the thing, and its absence
            is why pressing "Copy for Curve Hero" and getting no clipboard read
            as a broken button. */}
        {EXPORT_ROUTES.map(({ intent, label, noun, verb }) => {
          const locked = !hasContent || !gates.exportAllowed;
          const primary = intent === "copy";
          return (
            <button
              key={intent}
              className={locked || !primary ? "btn-secondary" : "btn-complete"}
              aria-disabled={locked}
              aria-expanded={exportIntent === intent}
              aria-controls={exportIntent === intent ? "builder-export-check" : undefined}
              aria-describedby={locked && hasContent ? "builder-export-locked" : undefined}
              title={
                !hasContent
                  ? "Add note content first"
                  : gates.exportAllowed
                    ? `${verb} — after one check that the right chart is open`
                    : "Resolve every stop finding before copy or download"
              }
              onClick={() => {
                if (locked) {
                  document.getElementById("builder-export-locked")?.focus();
                  return;
                }
                setPasteConfirmed(false);
                setExportIntent((cur) => (cur === intent ? null : intent));
              }}
            >
              {primary && copied
                ? "Copied — ready to paste ✓"
                : locked && hasContent
                  ? `🔒 ${noun} locked`
                  : `${label(edrName)}…`}
            </button>
          );
        })}
        {exportCheck}
        <HelpTip label="About copy and download">
          Copy and download stay locked while any stop finding is open. A privacy stop can be
          attested; other stops must be fixed in the note. Required fields block Submit but not
          copy. A downloaded file leaves this app, so it asks the same chart check the clipboard
          does.
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
        <p
          id="builder-export-locked"
          className="mt-2 text-xs text-rose-800"
          role="status"
          // Reachable by script only, so pressing a locked export lands the
          // cursor on the reason it is locked.
          tabIndex={-1}
        >
          Copy and download are locked until every stop is fixed
          {report.phiStops.length > 0 && !overrideActive
            ? " (or a privacy stop is attested)"
            : ""}
          . Open findings are listed in the audit panel.
        </p>
      )}
    </>
  );

  // Tablet/phone sheet — audit + Copy first. Dumping the full desktop Sidekick
  // (advisors always open + four tabs) into a max-w-lg dialog buried the finish
  // reason under scroll (showtime residual #1).
  const mobileSheetBody = (
    <>
      <div className="mb-3 flex items-center gap-3">
        <ProgressRing counts={report.counts} filingAllowed={filing.allowed} />
        <div className="min-w-0 flex-1">
          <StatusChip status={liveStatus} />
          <p className="mt-1 text-xs font-medium text-slate-800">{finishLine}</p>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {/* The same two-identifier check the desktop panel asks for. This
            button used to call the old one-press `copy`, which went straight to
            the clipboard — so the phone, which is the screen most likely to be
            in someone's hand beside the wrong chart, was the one surface with
            no check on it at all. */}
        <button
          className={!hasContent || !gates.exportAllowed ? "btn-secondary" : "btn-complete"}
          aria-disabled={!hasContent || !gates.exportAllowed}
          aria-expanded={exportIntent === "copy"}
          onClick={() => {
            if (!hasContent || !gates.exportAllowed) return;
            setPasteConfirmed(false);
            setExportIntent((cur) => (cur === "copy" ? null : "copy"));
          }}
        >
          {copied
            ? "Copied — ready to paste ✓"
            : !gates.exportAllowed && hasContent
              ? "🔒 Copy locked"
              : `Copy for ${edrName}…`}
        </button>
        {report.phiStops.length > 0 && !overrideActive && (
          <button
            type="button"
            className="btn-secondary border-rose-300 text-rose-800"
            onClick={() => {
              setShowMobileAudit(false);
              setShowOverride(true);
            }}
          >
            Review privacy stop
          </button>
        )}
      </div>
      {exportCheck}
      {hasContent && !gates.exportAllowed && (
        <p className="mb-3 text-xs text-rose-800" role="status">
          Copy locked until every stop is fixed
          {report.phiStops.length > 0 && !overrideActive
            ? " (or a privacy stop is attested)"
            : ""}
          . Findings are listed below.
        </p>
      )}
      <AuditPanel
        report={report}
        onJump={() => setShowMobileAudit(false)}
        started={hasContent}
        attestations={resolutionsForNote.attested}
        escalated={resolutionsForNote.escalated}
        onAttest={canEdit ? recordAttestation : undefined}
        onEscalate={canEdit ? escalateFinding : undefined}
      />
      <details className="mt-3 rounded-lg border border-slate-200 p-2">
        <summary className="tap cursor-pointer text-xs font-semibold text-slate-700">
          Byte & SuperByte
        </summary>
        <div className="mt-2 space-y-2">
          <ByteAdvisor text={markdown} clinicalRole={clinicalRole} />
          <ByteStarAdvisor text={markdown} />
        </div>
      </details>
      <details className="mt-2 rounded-lg border border-slate-200 p-2">
        <summary className="tap cursor-pointer text-xs font-semibold text-slate-700">
          Chart · Prior · Preview
        </summary>
        <div className="mt-2 flex flex-wrap gap-1">
          {([["chart", "Chart"], ["prior", "Prior"], ["preview", "Preview"]] as const).map(
            ([t, label]) => {
              // Desktop Sidekick defaults to "audit"; on mobile audit lives
              // above this disclosure, so treat unset as Chart.
              const pressed = t === "chart" ? tab === "chart" || tab === "audit" : tab === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  aria-pressed={pressed}
                  className={`tap rounded px-3 text-sm font-medium ${pressed ? "bg-brand-blue text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  {label}
                </button>
              );
            }
          )}
        </div>
        <div className="pane-40 mt-2">
          {tab === "prior" ? (
            <PriorNotes />
          ) : tab === "preview" ? (
            <pre className="whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-xs leading-relaxed text-slate-800">
              {markdown}
            </pre>
          ) : (
            <NoteReadback text={markdown} />
          )}
        </div>
      </details>
    </>
  );

  return (
    <div className={canEdit ? "pb-36 sm:pb-28" : undefined}>
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
          {/* THE NOTE'S NAME GETS A WHOLE ROW ON A PHONE.
              `flex-1` next to an office dropdown and a modules button left it
              about fifty pixels wide at 390px, showing "Untitl" — a name built
              out of four searchable facts, clipped after six letters, in a
              field too narrow to edit. It is the note's identity and the first
              thing on the screen; below `sm` it takes the row. */}
          <input
            className="tap-input w-full min-w-0 rounded border border-transparent px-1 py-1.5 text-lg font-semibold hover:border-slate-300 focus:border-brand-blue focus:outline-none disabled:bg-transparent sm:w-auto sm:flex-1"
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
              // Picking the office also completes the note's own name.
              //
              // A draft is created before anyone has chosen where the visit
              // happened, so it is born as date_Who_time and gains the place
              // here. withOffice rebuilds from the date and time ALREADY in the
              // title rather than from the clock — the last segment is when the
              // note was started, and restamping it at the moment somebody
              // touched a dropdown would falsify the one fact in the title that
              // could later matter. A title the writer typed is left alone.
              onChange={(e) => {
                const id = e.target.value || null;
                setOfficeId(id);
                setTitle((t) => withOffice(t, offices.find((o) => o.id === id)?.name ?? null));
              }}
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
          {canEdit && <SaveIndicator state={autosave.state} onRetry={() => void flush()} />}
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

      {/* Mobile/tablet finish strip — one line for the blocker that matters,
          then the audit sheet. Hygienists on a tablet should not archaeology
          the Sidekick to learn why Copy/Submit is off.

          NO SECOND STATUS CHIP. The same "Review suggested" pill sits in the
          note bar sixty pixels above this one, so a phone showed one note's
          state twice on one screen — the duplication the sidekick's own comment
          calls out and then reintroduced here. The ring carries the severity
          and the stop line says what to do about it, which is more than a
          repeated pill was saying. */}
      <div className="mb-4 space-y-2 lg:hidden">
        <button
          type="button"
          onClick={() => setShowMobileAudit(true)}
          className="tap flex w-full items-center gap-3 rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-left shadow-sm"
          aria-label="Open audit, copy, and preview"
        >
          <ProgressRing counts={report.counts} filingAllowed={filing.allowed} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-slate-800">
              {topStop ? `Stop: ${topStop.message}` : finishLine}
            </span>
            <span className="mt-0.5 block truncate text-[0.65rem] text-slate-500">
              {report.findings.length === 0
                ? "Tap for audit and copy"
                : `${report.findings.length} finding${report.findings.length === 1 ? "" : "s"} — tap for audit and copy`}
            </span>
          </span>
          <span aria-hidden className="shrink-0 text-slate-400">
            ▸
          </span>
        </button>
      </div>

      {/* One Andon card — coalesce unset-role + scope/transfer so the first
          viewport is not a stack of amber slabs (swarm / Chicken Little). */}
      {(clinicalRole === "unset" || showScopeCue || needsTransfer) && canEdit && liveStatus !== "submitted" && (
        <div
          className={`mb-4 rounded-xl px-3 py-2.5 text-sm ${
            needsTransfer || clinicalRole === "unset"
              ? "border border-amber-300 bg-amber-50 text-amber-950"
              : "border border-slate-300 bg-slate-50 text-slate-800"
          }`}
          role="status"
        >
          {clinicalRole === "unset" ? (
            <>
              <p className="font-semibold">Clinical role is not recorded on this account</p>
              <p className="mt-1 text-xs leading-relaxed">
                Scope locks and role templates stay open until a Team Lead sets Assistant,
                Hygienist, or Dentist on this account in User admin.
              </p>
            </>
          ) : needsTransfer ? (
            <>
              <p className="font-semibold">Dentist must file this note</p>
              <p className="mt-1 text-xs leading-relaxed">
                {filing.message ??
                  "This draft includes dentist-owned content or a dentist-level module. Transfer ownership so a dentist reviews and files under their license. Nothing you wrote is lost."}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {canTransfer ? (
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => setShowTransfer(true)}
                  >
                    Transfer to dentist
                  </button>
                ) : (
                  <p className="text-xs text-slate-700">
                    Ask a Team Lead to transfer this note, or open{" "}
                    <Link href="/notes" className="font-medium text-brand-blue underline">
                      My notes
                    </Link>{" "}
                    if you have transfer rights on another account.
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="font-semibold">Assessment and Plan stay with the dentist</p>
              <p className="mt-1 text-xs leading-relaxed">
                Record findings in Objective and Care delivered. Locked sections read as waiting
                for the dentist — not as fields you left unfinished. You can file when this note
                stays in your license scope.
              </p>
            </>
          )}
        </div>
      )}

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
            practicePacks={practicePacks}
            // Structure only — packs re-rank Section starters and featured
            // pick order; they are not a second Fast Lane chip browser.
            onApply={(pick) => dispatch({ type: "applyModules", moduleIds: pick.moduleIds })}
            onInsertMyBlock={(text) => {
              // Prefer the focused prose control; fall back to Visit narrative.
              const active = document.activeElement as HTMLElement | null;
              const fieldRoot = active?.closest?.("[id^='field-']") as HTMLElement | null;
              const id = fieldRoot?.id?.replace(/^field-/, "");
              const key =
                id && id.includes(".")
                  ? id
                  : fieldKey("universal-core", "narrative-subjective");
              const cur = state.values[key];
              const prior =
                cur?.kind === "text" && cur.value.trim() !== "" ? `${cur.value.trim()}\n\n` : "";
              setValue(key, { kind: "text", value: prior + text });
            }}
          />
          <fieldset disabled={!canEdit} className="min-w-0">
            <DictationUserContext.Provider
              value={{
                username,
                enrolled: dictationEnrolled,
                region: (dictationRegion as UsaRegionId | null) ?? null
              }}
            >
            <NoteForm
              modules={modules}
              state={state}
              onChange={setValue}
              findingsByField={fieldFindings}
              clinicalRole={clinicalRole}
              packBlockIds={packBlockIds}
            />
            </DictationUserContext.Provider>
          </fieldset>
        </section>

        {/* Sidekick — and, above `lg`, the advisors that lead it.
            The rest of the sidekick is desktop-only: the mobile bar and sheet
            above cover the same ground where this would otherwise sit below the
            entire form.

            THE ASIDE ITSELF IS NOT HIDDEN ANY MORE. It was `hidden lg:block`,
            which is what made Byte and SuperByte `display: none` on a phone —
            present in the markup, invisible on screen, skipped by a screen
            reader. The obvious fix, a second inline copy for narrow screens,
            stopped being available the moment main gave the advisors ids
            (`advisor-byte`, `advisor-superbyte`) for its jump links: two copies
            means two elements answering to one id, and getElementById picks
            whichever comes first. So there is exactly ONE copy, and `order`
            moves it — above the form on a phone, beside it on a desktop. */}
        <aside className="order-first shrink-0 lg:order-none lg:w-[26rem]">
          <div className="card p-3 lg:sticky lg:top-20">
            <div className="lg:mb-3">{advisors}</div>
            <div className="hidden lg:block">{sidekickBody}</div>
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
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur">
          {/* Finish cluster first — Gestalt: reason + Save + Submit is the job.
              Entry tools (paste / earlier version) sit in a disclosure so they
              never compete with the finish control on a tablet (UIX-004). That
              also fixes what this branch fixed a different way: four controls
              and a sentence sharing one flex-wrap reflowed into four rows and
              117px of an 844px screen. Two rows now, and the same two every
              time — the height of the bar is a number rather than a function of
              the message currently in it. */}
          <div className="mx-auto flex max-w-7xl flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p
                className="min-w-0 flex-1 text-xs text-slate-600"
                id="builder-submit-blocked"
                // Focusable only by script, so pressing a blocked Submit lands
                // the cursor on the sentence that says why. Never in the tab
                // order — a paragraph is not a stop on the way to anywhere.
                tabIndex={-1}
              >
                {liveStatus === "submitted"
                  ? "Filed. Edit the note to submit again."
                  : !filing.allowed
                    ? "A dentist must file this note — transfer ownership first."
                    : finishLine}
              </p>
              <button className="btn-secondary" title="Save now (Ctrl+S)" onClick={() => void flush()}>
                Save
              </button>
              {/* NOT `disabled`, ON PURPOSE.
                  A natively disabled button is removed from the tab order and
                  skipped by screen readers, so the one control that ends the
                  task simply did not exist for anybody driving this from a
                  keyboard — and neither did the sentence saying why, because
                  aria-describedby is only read out when the element it
                  describes can be reached. `aria-disabled` keeps it focusable
                  and announced as unavailable, which is the whole point of
                  having written the reason down. Pressing it while blocked
                  moves the cursor to that reason rather than doing nothing.
                  globals.css carries the matching look. */}
              <button
                className="btn-primary"
                aria-disabled={submitBlocked}
                aria-describedby="builder-submit-blocked"
                onClick={() => {
                  if (submitBlocked) {
                    document.getElementById("builder-submit-blocked")?.focus();
                    return;
                  }
                  void trySubmit();
                }}
              >
                Submit
              </button>
            </div>
            <details className="group">
              <summary className="tap cursor-pointer list-none py-1 text-xs font-medium text-slate-500 underline decoration-dotted underline-offset-2 marker:content-none [&::-webkit-details-marker]:hidden">
                Ways into this note
              </summary>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => setShowPaste(true)}
                  title="Already written this note somewhere else? Paste the text here and Smile Notes will sort it into sections for you to place."
                >
                  Start from text I wrote
                </button>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  title="Go back to an automatically saved earlier version of THIS note. Nothing is lost — the current version is kept too."
                  onClick={() => void openRevisions()}
                >
                  Undo back to an earlier version
                </button>
              </div>
            </details>
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
          className={`fixed inset-x-4 z-40 mx-auto w-fit max-w-md rounded-lg border px-4 py-2 text-sm font-medium shadow-lg ${
            canEdit
              ? // Clear the finish bar even when "Ways into this note" is open.
                "bottom-[calc(8.5rem+env(safe-area-inset-bottom))] sm:bottom-[calc(7.5rem+env(safe-area-inset-bottom))]"
              : "bottom-4"
          } ${
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
        <Dialog title="Audit & copy" onClose={() => setShowMobileAudit(false)}>
          {mobileSheetBody}
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
      {showTransfer && (
        <TransferDraftDialog
          draftId={draftId}
          draftTitle={title}
          onClose={() => setShowTransfer(false)}
          onDone={() => {
            setShowTransfer(false);
            router.push("/notes");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
