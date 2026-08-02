// The Data Hygiene Gauntlet.
//
// A request to add, remove, or modify a table, field, header, dropdown, or
// dependency is not "a small tweak on the screen". In a dental system it
// reaches charts, recalls, medical alerts at chairside, imaging and lab links,
// claims, and every production report — and historical chart integrity is
// non-negotiable. So a proposal is treated as CONTAMINATED until it clears all
// five sterilization cycles.
//
// This module is PURE — no React, no database, no network. That matters: the
// same function guards the button in the browser AND the API route, so a
// request cannot be forced through by calling the endpoint directly. The client
// copy of the verdict is a convenience; the server's is the one that counts.

export type CycleId = "necessity" | "exhaustion" | "ripple" | "behavior" | "protection";

export interface CycleDef {
  id: CycleId;
  n: number;
  title: string;
  prompt: string;
  contaminated: string;
  sterile: string;
}

export const CYCLES: CycleDef[] = [
  {
    id: "necessity",
    n: 1,
    title: "Necessity Sterilization",
    prompt:
      "Why does this specific table, field, header, content change, or new dependency drive an immediate clinical decision, patient-safety action, or daily operational outcome in the practice right now?",
    contaminated:
      "“It would be nice for later analysis” or “Dentists might find it interesting someday.”",
    sterile:
      "“It is required right now to correctly sequence multi-visit treatment, auto-trigger the proper recall or post-op protocol, prevent chair double-booking for complex cases, or surface a critical medical alert at the moment of care.”"
  },
  {
    id: "exhaustion",
    n: 2,
    title: "Existing Data Exhaustion",
    prompt:
      "Why have we proven that current charts, existing fields (including custom ones), reports, filters, templates, or a simple process/UI adjustment cannot already deliver what we need?",
    contaminated:
      "“I haven’t fully audited the current system or asked the clinical team what already exists.”",
    sterile:
      "“We completed a documented review of production reports, clinical note templates, appointment views, and treatment-plan structures — the needed distinction or linkage is simply not present.”"
  },
  {
    id: "ripple",
    n: 3,
    title: "Ripple-vs-Reward Calculation",
    prompt:
      "Why is the measurable gain (chair-time recovered, fewer incomplete charts, reduced claim rework, fewer missed recalls, less daily manual workaround) clearly larger than the full cost of engineering, data-migration risk to historical records, regression testing across modules, staff retraining, and temporary slowdown across the operatories?",
    contaminated: "“It’s just one field / one dropdown — nothing will break.”",
    sterile:
      "“Eliminating this daily friction across our operatories saves X hours per week and cuts Y specific errors; that outweighs the estimated tech effort plus testing of scheduling, charting, claims, portal, and imaging links.”"
  },
  {
    id: "behavior",
    n: 4,
    title: "Behavior Lock-In",
    prompt:
      "Why will every relevant team member (front desk, hygienists, assistants, doctors) consistently and accurately capture or maintain this data at the moment it matters, rather than the field becoming ignored noise?",
    contaminated: "“We’ll mention it in the morning huddle” or “It will appear in a monthly review.”",
    sterile:
      "“The system forces the entry at a natural workflow choke point (check-in, chart close, claim generation, or checkout) and the data immediately enables something the team already needs.”"
  },
  {
    id: "protection",
    n: 5,
    title: "Core Practice Protection",
    prompt:
      "Why does this strengthen patient safety and continuity of care, regulatory/record readiness (HIPAA documentation completeness, board standards), or the practice’s ability to run efficiently and reliably more than any non-structural alternative?",
    contaminated: "“More granular data is always better.”",
    sterile:
      "“It closes a documented gap that has already produced incomplete treatment histories, missed recalls, gaps in required documentation, or safety flags that failed to surface — directly protecting care quality and reducing clinical and operational risk.”"
  }
];

export type ChecklistId =
  | "auditCompleted"
  | "costQuantified"
  | "downstreamMapped"
  | "ownerAssigned"
  | "alternativesRuledOut";

export const CHECKLIST: { id: ChecklistId; label: string; detail: string }[] = [
  {
    id: "auditCompleted",
    label: "Audit completed",
    detail:
      "A named person has checked current dashboards, reports, clinical templates, appointment views, custom fields, and existing dropdowns to confirm the data is not already available."
  },
  {
    id: "costQuantified",
    label: "Cost and impact quantified",
    detail:
      "Hours or errors saved per week versus estimated engineering + testing + training time, including the temporary productivity dip during transition."
  },
  {
    id: "downstreamMapped",
    label: "Downstream mapped",
    detail:
      "Every module and integration that touches the affected table or field is listed below."
  },
  {
    id: "ownerAssigned",
    label: "Owner assigned",
    detail:
      "A specific person is responsible for ongoing data quality, staff compliance, and whether the field is actually used correctly."
  },
  {
    id: "alternativesRuledOut",
    label: "Non-structural alternatives ruled out",
    detail:
      "A process change, report filter, existing field, UI workflow adjustment, or template update has been evaluated and documented as insufficient."
  }
];

export const DOWNSTREAM_MODULES = [
  "Scheduling",
  "Charting",
  "Claims",
  "Patient portal",
  "Imaging",
  "Labs",
  "Recalls",
  "Reporting",
  "Medical alerts"
] as const;

export interface GauntletAnswers {
  summary: string;
  changeType: string;
  answers: Record<CycleId, string>;
  checklist: Record<ChecklistId, boolean>;
  dataOwner: string;
  downstream: string[];
}

export interface CycleVerdict {
  id: CycleId;
  n: number;
  title: string;
  sterile: boolean;
  problems: string[];
}

export interface GauntletVerdict {
  sterile: boolean;
  cycles: CycleVerdict[];
  // Failures that are not attributable to one cycle (checklist, owner, ask).
  general: string[];
}

// --- signals -------------------------------------------------------------
// Keyword matching alone is trivially gamed, so completeness is judged on
// several independent axes. What this can enforce is SPECIFICITY, not truth —
// a determined person can still write a well-formed bad request. It stops the
// lazy ones; the human reading the ticket is the real filter.

const MIN_CHARS = 80;

// Drawn from the contaminated exemplars in the guide.
const CONTAMINATED_PHRASES: { re: RegExp; why: string }[] = [
  { re: /\b(would|woud|wud)\s+be\s+(nice|good|great|useful|handy)\b/i, why: "“would be nice” is curiosity, not an operational outcome" },
  { re: /\bnice\s+to\s+have\b/i, why: "“nice to have” is curiosity, not an operational outcome" },
  { re: /\b(for|to)\s+(later|future)\s+(analysis|use|reporting|reference)\b/i, why: "“for later analysis” is not an immediate need" },
  { re: /\bsome\s?day\b|\beventually\b|\bdown\s+the\s+(road|line)\b/i, why: "“someday” is not an immediate need" },
  { re: /\bjust\s+(in\s+case|one\s+(field|column|dropdown|box))\b/i, why: "“just one field” assumes no downstream cost" },
  { re: /\bnothing\s+(will|should)\s+break\b/i, why: "“nothing will break” is the assumption this gauntlet exists to test" },
  { re: /\b(haven'?t|have\s+not|has\s+not|hasn'?t)\s+(fully\s+)?(audit|audited|checked|reviewed|looked)/i, why: "the audit has not been done yet" },
  { re: /\bmore\s+granular\s+data\b|\bmore\s+data\s+is\s+(always\s+)?better\b/i, why: "“more granular data is better” is not a protection argument" },
  { re: /\bmorning\s+huddle\b/i, why: "a huddle mention is not a workflow choke point" },
  { re: /\b(monthly|quarterly|weekly)\s+(review|slide|deck|report)\b/i, why: "a periodic review does not lock in behavior at the moment of care" },
  { re: /\bmight\s+(be\s+)?(interesting|useful|helpful)\b/i, why: "“might be interesting” is curiosity" }
];

// Cycle 3 must carry a real number with a unit — that IS the calculation.
const QUANTIFIED = /\d+\s*(\+|-)?\s*(hour|hr|hrs|hours|min|minute|minutes|day|days|week|weeks|month|months|%|percent|error|errors|claim|claims|case|cases|chart|charts|recall|recalls|appointment|appointments|patient|patients|time|times|x\b)/i;

// Cycle 2 must name something actually inspected.
const NAMED_ARTIFACT = /\b(report|reports|template|templates|dashboard|dashboards|view|views|field|fields|dropdown|dropdowns|chart|charts|schedule|treatment[-\s]?plan|note|notes|filter|filters|module|modules)\b/i;

// Cycle 4 must name a moment in the day where the entry is forced.
const CHOKE_POINT = /\b(check[-\s]?in|check[-\s]?out|chart\s+close|closing\s+the\s+chart|claim\s+generation|checkout|hand[-\s]?off|handoff|sign[-\s]?off|appointment\s+(start|end)|before\s+dismissal|at\s+the\s+chair|chairside|intake)\b/i;

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function looksLikeEcho(answer: string, prompt: string): boolean {
  const a = normalize(answer);
  if (a.length < MIN_CHARS) return false;
  // Count how many of the prompt's distinctive words the answer simply repeats.
  const promptWords = new Set(
    normalize(prompt)
      .split(/[^a-z]+/)
      .filter((w) => w.length > 5)
  );
  if (promptWords.size === 0) return false;
  const answerWords = a.split(/[^a-z]+/).filter((w) => w.length > 5);
  if (answerWords.length === 0) return false;
  const overlap = answerWords.filter((w) => promptWords.has(w)).length;
  return overlap / answerWords.length > 0.7;
}

export function evaluateGauntlet(input: GauntletAnswers): GauntletVerdict {
  const cycles: CycleVerdict[] = [];
  const seen = new Map<string, CycleId>();

  for (const cycle of CYCLES) {
    const raw = (input.answers?.[cycle.id] ?? "").trim();
    const problems: string[] = [];

    if (raw.length === 0) {
      problems.push("No answer yet.");
    } else {
      if (raw.length < MIN_CHARS) {
        problems.push(`Too short to be an argument — write at least ${MIN_CHARS} characters.`);
      }
      for (const { re, why } of CONTAMINATED_PHRASES) {
        if (re.test(raw)) problems.push(`Contaminated: ${why}.`);
      }
      // The strongest real slop signal: the same text pasted into two cycles.
      const key = normalize(raw);
      const already = seen.get(key);
      if (already) {
        problems.push(`This is the same answer given for cycle ${CYCLES.find((c) => c.id === already)?.n}.`);
      } else {
        seen.set(key, cycle.id);
      }
      if (looksLikeEcho(raw, cycle.prompt)) {
        problems.push("This restates the question instead of answering it.");
      }
      if (cycle.id === "ripple" && !QUANTIFIED.test(raw)) {
        problems.push("No measurable gain given — state a number and a unit (e.g. “saves 6 hours a week”, “cuts 12 claim rejections a month”).");
      }
      if (cycle.id === "exhaustion" && !NAMED_ARTIFACT.test(raw)) {
        problems.push("Name what you actually checked (a report, template, view, field, or dropdown).");
      }
      if (cycle.id === "behavior" && !CHOKE_POINT.test(raw)) {
        problems.push("Name the workflow choke point where the entry is forced (check-in, chart close, claim generation, checkout…).");
      }
    }

    cycles.push({ id: cycle.id, n: cycle.n, title: cycle.title, sterile: problems.length === 0, problems });
  }

  const general: string[] = [];
  if ((input.summary ?? "").trim().length < 10) {
    general.push("Describe the ask in one line.");
  }
  if ((input.changeType ?? "").trim().length === 0) {
    general.push("Say what kind of change this is.");
  }
  for (const item of CHECKLIST) {
    if (!input.checklist?.[item.id]) general.push(`Pre-flight not confirmed: ${item.label}.`);
  }
  if ((input.dataOwner ?? "").trim().length < 2) {
    general.push("Name the person who will own this data's quality.");
  }
  if (!input.downstream || input.downstream.length === 0) {
    general.push("List at least one downstream module this touches.");
  }

  return {
    sterile: cycles.every((c) => c.sterile) && general.length === 0,
    cycles,
    general
  };
}
