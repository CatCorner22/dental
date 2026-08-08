import type { NoteState } from "@/lib/schema/types";
import type { Severity } from "@/lib/audit/types";
import type { ClinicalRole } from "@/lib/auth/clinicalRoles";
import { checkFilingAuthority } from "@/lib/auth/approval";
import { activeModules } from "@/lib/modules";
import { composeNote } from "@/lib/compose/composeNote";
import { runAudit } from "@/lib/audit/engine";
import { isValueEmpty } from "@/lib/schema/conditions";
import { deriveDraftStatus, type DraftStatus } from "./draftStatus";

// Server-side status: run the same audit the client runs, derive the same
// status. Used by the drafts PATCH (to cache status) and the dashboard.
export function statusForNote(
  note: NoteState,
  opts: {
    submitted: boolean;
    lastSendFailed: boolean;
    /**
     * Owner (or editor) clinical role. Without it, a clean hygienist note that
     * still needs dentist filing caches as "ready" and Home / My notes show a
     * green chip while Submit refuses — Andon lied about the finish line
     * (UIX-001 list path).
     */
    clinicalRole?: ClinicalRole;
  }
): { status: DraftStatus; counts: Record<Severity, number> } {
  const modules = activeModules(note.selectedModuleIds);
  const report = runAudit({ note, modules, composedText: composeNote(note, modules) });
  // Same emptiness rule the client uses, so server and client statuses agree.
  const hasContent = Object.values(note.values).some((v) => !isValueEmpty(v));
  const filingAllowed =
    opts.clinicalRole === undefined
      ? undefined
      : checkFilingAuthority(opts.clinicalRole, modules, note).allowed;
  const status = deriveDraftStatus({
    hasContent,
    counts: report.counts,
    phiStops: report.phiStops.length,
    submitted: opts.submitted,
    lastSendFailed: opts.lastSendFailed,
    filingAllowed
  });
  return { status, counts: report.counts };
}
