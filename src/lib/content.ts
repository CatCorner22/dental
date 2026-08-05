import { readFileSync } from "node:fs";
import path from "node:path";

// Single source of truth: the app renders the source markdown in skill/
// directly, so the reference pages and the docs can never disagree.
// Allowlist only — never a caller-supplied path.
const DOCS = {
  templates: "skill/assets/dental-note-templates.md",
  terminology: "skill/references/terminology-and-style.md",
  toothNotation: "skill/references/tooth-and-surface-notation.md",
  sedationImaging: "skill/references/sedation-and-imaging.md",
  tennesseeLaw: "skill/references/tennessee-dental-law-summary.md",
  sourceLedger: "skill/references/source-ledger.md",
  deployment: "skill/references/deployment-recommendation.md",
  dataHygiene: "skill/references/data-hygiene-guide.md",
  documentationResearch: "knowledge/sources/litigation-documentation-research.md",
  documentationIntegrity: "knowledge/sources/documentation-integrity-deep-research.md"
} as const;

export type DocName = keyof typeof DOCS;

// Exported so a test can assert every allowlisted document actually has a page
// rendering it. Two of these were allowlisted and unrouted for the whole life
// of the project, which nothing caught because "allowlisted" and "reachable"
// were never compared.
export const DOC_NAMES = Object.keys(DOCS) as DocName[];

export function readReferenceDoc(name: DocName): string {
  return readFileSync(path.join(process.cwd(), DOCS[name]), "utf8");
}
