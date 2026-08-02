import type { NoteState } from "@/lib/schema/types";
import type { Severity } from "@/lib/audit/types";
import { activeModules } from "@/lib/modules";
import { composeNote } from "@/lib/compose/composeNote";
import { runAudit } from "@/lib/audit/engine";
import { deriveDraftStatus, type DraftStatus } from "./draftStatus";

// Server-side status: run the same audit the client runs, derive the same
// status. Used by the drafts PATCH (to cache status) and the dashboard.
export function statusForNote(
  note: NoteState,
  opts: { submitted: boolean; lastSendFailed: boolean }
): { status: DraftStatus; counts: Record<Severity, number> } {
  const modules = activeModules(note.selectedModuleIds);
  const report = runAudit({ note, modules, composedText: composeNote(note, modules) });
  const hasContent = Object.keys(note.values).length > 0;
  const status = deriveDraftStatus({
    hasContent,
    counts: report.counts,
    submitted: opts.submitted,
    lastSendFailed: opts.lastSendFailed
  });
  return { status, counts: report.counts };
}
