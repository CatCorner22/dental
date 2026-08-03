import { SHORTHAND } from "@/lib/vocab/shorthand";
import { BANNED_ABBREVIATIONS } from "@/lib/vocab/abbreviations";

// Retrieval for the assist prompts — the "RAG" layer, sized to the truth.
//
// The corpus worth retrieving from is not a vector store of documents; it is
// the practice's OWN controlled vocabulary and safety rules, which live in
// code and are therefore always current. The retired ChatGPT skill drifted
// from the app within weeks (the FMS/NKA conflation) precisely because it was
// a copy; this module cannot drift because it reads the same tables the
// deterministic pass enforces. When the practice's knowledge corpus outgrows
// what keyword selection can serve, THAT is the moment for embeddings — not
// before.
//
// Selection is evidence-based: a snippet is included only when the input
// actually contains the tokens it governs. Stuffing the full terminology
// table into every prompt would bury the model's attention and bill the
// practice for tokens that change nothing.

export interface RetrievedContext {
  /** Human-readable section titles included, for provenance stamps. */
  sources: string[];
  /** The text appended to the system prompt. Empty when nothing applies. */
  text: string;
}

const MAX_CONTEXT_CHARS = 4000;

function terminologyFor(input: string): string[] {
  const lines: string[] = [];
  for (const sh of SHORTHAND) {
    const re = new RegExp(sh.pattern.source, sh.pattern.flags);
    if (!re.test(input)) continue;
    if (sh.alternatives) {
      lines.push(
        `- "${sh.display}" is AMBIGUOUS (${sh.alternatives.join("; ")}). Never expand it — leave it and let the writer resolve it.`
      );
    } else {
      lines.push(
        `- "${sh.display}" expands to "${sh.expansion}" on first use, written as: ${sh.expansion} (${sh.display}).`
      );
    }
  }
  for (const abbr of BANNED_ABBREVIATIONS) {
    const re = new RegExp(abbr.pattern.source, abbr.pattern.flags);
    if (!re.test(input)) continue;
    if (abbr.severityClass === "style") {
      lines.push(`- "${abbr.display}" is written as "${abbr.replacement}".`);
    } else {
      lines.push(
        `- "${abbr.display}" needs clinical facts to expand (${abbr.replacement}). Never guess — leave it for the writer.`
      );
    }
  }
  return lines;
}

const SEDATION_CUE = /\b(?:sedat\w+|midazolam|nitrous|N2O|anesthesia|anesthetic|IV\s+moderate|deep\s+sedation)\b/i;
const SEDATION_CHECKLIST = `SEDATION RECORD ELEMENTS (Tennessee Board review expects all of these):
- pre-operative evaluation, airway assessment, NPO/fasting status
- specific consent for sedation AND the procedure, reaffirmed before cognition-altering medication
- monitors in use (SpO2, BP, HR, RR, ETCO2 when applicable) — readings live in the time-oriented record
- drug log (name, dose, route, time, who gave it) INCLUDING local anesthetics — in the time-oriented record only, never restated in prose
- start/end times, recovery observations, discharge criteria WITH supporting facts, responsible adult
- emergency preparedness confirmed for one level deeper than intended; permit-holding provider identified by role`;

const TOOTH_CUE = /\b(?:tooth|teeth)\b|#\d{1,2}\b/i;
const TOOTH_RULES = `TOOTH NOTATION (practice standard):
- ADA Universal only in the record: permanent 1-32, primary A-T, supernumerary +50 or letter+S.
- FDI two-digit notation must never appear in the note body — a bare "18" is ambiguous between systems.
- Surfaces: anterior teeth take M I D F L; posterior take M O D B L. Never I on a posterior or O on an anterior.`;

const CONSENT_CUE = /\bconsent|risks?\s+and\s+benefits?|treatment\s+options?\b/i;
const CONSENT_RULES = `CONSENT DOCUMENTATION (litigation-informed):
- Record the CONVERSATION, not just a signature: diagnosis discussed, material risks named, alternatives including no treatment, questions asked, and the patient's decision in their own terms.
- Never assert that consent occurred unless the input states it. A consent discussion without a recorded decision is half a record.`;

export function retrieveContext(input: string): RetrievedContext {
  const sources: string[] = [];
  const parts: string[] = [];

  const term = terminologyFor(input);
  if (term.length > 0) {
    sources.push("practice terminology");
    parts.push(`PRACTICE TERMINOLOGY (the controlled vocabulary the audit enforces — use these exact forms):\n${term.join("\n")}`);
  }
  if (SEDATION_CUE.test(input)) {
    sources.push("sedation record elements");
    parts.push(SEDATION_CHECKLIST);
  }
  if (TOOTH_CUE.test(input)) {
    sources.push("tooth notation");
    parts.push(TOOTH_RULES);
  }
  if (CONSENT_CUE.test(input)) {
    sources.push("consent documentation");
    parts.push(CONSENT_RULES);
  }

  let text = parts.join("\n\n");
  if (text.length > MAX_CONTEXT_CHARS) text = text.slice(0, MAX_CONTEXT_CHARS);
  return { sources, text };
}
