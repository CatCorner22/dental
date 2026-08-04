import { RiskManagement } from "@/components/risk/RiskManagement";

export const metadata = { title: "Risk management" };

// RISK MANAGEMENT — the practice-level view of what this app enforces
// note-by-note: Curve Hero transfer discipline, defensibility, PHI
// boundaries, scope/supervision, business practices, incident response.
// Interactive scaffolding now; content is provisional and labeled as such.

export default function RiskManagementPage() {
  return (
    <div>
      <p className="eyebrow">Practice-level view</p>
      <h1 className="page-title mb-1">Risk management</h1>
      <p className="mb-4 max-w-3xl text-sm text-slate-600">
        What the note-level rules add up to: fewer records errors at the Curve Hero paste, notes
        that survive review, PHI that never leaves, scope that matches licensure, and business
        records that answer questions before they become disputes.
      </p>
      <RiskManagement />
    </div>
  );
}
