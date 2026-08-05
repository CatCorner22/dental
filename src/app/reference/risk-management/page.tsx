import { RiskManagement } from "@/components/risk/RiskManagement";
import { MarkdownDoc } from "@/components/reference/MarkdownDoc";
import { readReferenceDoc } from "@/lib/content";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { meetsRole } from "@/lib/auth/roles";

export const metadata = { title: "Risk management" };

// RISK MANAGEMENT — the practice-level view of what this app enforces
// note-by-note: Curve Hero transfer discipline, defensibility, PHI
// boundaries, scope/supervision, business practices, incident response.
// Interactive scaffolding now; content is provisional and labeled as such.

export default async function RiskManagementPage() {
  const user = await freshSessionUser();
  const showResearch = Boolean(user && meetsRole(user.role, "lead"));

  return (
    <div>
      <p className="eyebrow">Practice-level view</p>
      <h1 className="page-title mb-1">Risk management</h1>
      <p className="mb-4 max-w-3xl text-sm text-slate-600">
        What the note-level rules add up to: fewer records errors at the Curve Hero paste, notes
        that survive review, PHI that never leaves, scope that matches licensure, and business
        records that answer questions before they become disputes.
      </p>

      {showResearch && (
        <div className="mb-6 max-w-3xl space-y-3">
          <details
            id="documentation-research"
            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <summary className="cursor-pointer text-sm font-semibold text-brand-navy">
              Claim-file documentation research (Team Lead+)
            </summary>
            <p className="mt-2 text-xs text-slate-600">
              Internal synthesis from public carrier claim files and case studies. Correlation in
              closed claims — not a promise that better notes prevent litigation. Grounds the
              language optimizer for risk reduction rules in the audit engine.
            </p>
            <div className="mt-4 rounded-md bg-white p-3 ring-1 ring-slate-200">
              <MarkdownDoc markdown={readReferenceDoc("documentationResearch")} />
            </div>
          </details>

          <details
            id="documentation-integrity"
            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <summary className="cursor-pointer text-sm font-semibold text-brand-navy">
              Documentation integrity framework (Team Lead+)
            </summary>
            <p className="mt-2 text-xs text-slate-600">
              National integrity framework distilled for dental + dental prescribing. Multi-audience
              risk table, bounded negatives, and an explicit park list for pharmacy DEA and claim-packet
              workflows this app does not own. Companion to the claim-file digest above.
            </p>
            <div className="mt-4 rounded-md bg-white p-3 ring-1 ring-slate-200">
              <MarkdownDoc markdown={readReferenceDoc("documentationIntegrity")} />
            </div>
          </details>
        </div>
      )}

      <RiskManagement />
    </div>
  );
}
