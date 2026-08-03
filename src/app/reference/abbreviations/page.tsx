import { BANNED_ABBREVIATIONS } from "@/lib/vocab/abbreviations";
import { STALE_PHRASES, STIGMATIZING_PHRASES, VAGUE_PHRASES } from "@/lib/vocab/vague-phrases";
import { PLAIN_WORDS } from "@/lib/vocab/plain-language";
import { SEVERITY_LABELS } from "@/lib/audit/types";

export const metadata = { title: "Abbreviation rules" };

// Generated straight from the audit's own data, so this page can never
// drift from what the audit enforces.
export default function Page() {
  return (
    <article className="doc">
      <h1>Abbreviation and phrase rules</h1>
      <p>
        These tables are generated from the exact lists the audit pass enforces. STYLE items have
        one deterministic replacement a staff member may apply. REVIEW items hide a clinical fact,
        so a clinician supplies the specific wording.
      </p>
      <h2>Replace ambiguous shorthand</h2>
      <table>
        <thead>
          <tr>
            <th>Avoid</th>
            <th>Use when true</th>
            <th>Handling</th>
          </tr>
        </thead>
        <tbody>
          {BANNED_ABBREVIATIONS.map((a) => (
            <tr key={a.id}>
              <td>{a.display}</td>
              <td>{a.replacement}</td>
              <td>{a.severityClass === "style" ? `S3 ${SEVERITY_LABELS.S3}` : `S2 ${SEVERITY_LABELS.S2}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Replace vague or unsafe phrases</h2>
      <table>
        <thead>
          <tr>
            <th>Avoid</th>
            <th>Write instead</th>
          </tr>
        </thead>
        <tbody>
          {VAGUE_PHRASES.map((p) => (
            <tr key={p.id}>
              <td>{p.display}</td>
              <td>{p.replacement}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Words that label the patient</h2>
      <p>
        Patients have routine access to these notes. Each of these describes the person rather than
        the care. The tool flags them and never rewrites them, because the right wording depends on
        what actually happened at the visit.
      </p>
      <table>
        <thead>
          <tr>
            <th>Avoid</th>
            <th>Write instead</th>
          </tr>
        </thead>
        <tbody>
          {STIGMATIZING_PHRASES.map((p) => (
            <tr key={p.id}>
              <td>{p.display}</td>
              <td>{p.replacement}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Plain words for patient-facing text</h2>
      <p>
        This table runs the opposite way to the first one, on purpose. The clinical record wants{" "}
        <em>radiograph</em>; the patient reading their own summary wants <em>x-ray</em>. Both are
        right for their own reader, so each list is applied only where it belongs — this one only
        to fields written for the patient, such as the summary in Universal Core.
      </p>
      <p>
        Nothing here is ever rewritten for you. A plainer word can carry a different clinical claim,
        so the tool points and you decide. Standardize still works on those fields — it warns you
        first that it rewrites toward clinical wording, and Undo puts your words back in one click.
        Keeping the term and explaining it once clears the finding:{" "}
        <em>periodontitis (gum disease that has reached the bone)</em>.
      </p>
      <table>
        <thead>
          <tr>
            <th>Avoid</th>
            <th>Write instead</th>
          </tr>
        </thead>
        <tbody>
          {PLAIN_WORDS.map((p) => (
            <tr key={p.id}>
              <td>{p.display}</td>
              <td>{p.replacement}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Copy-forward and stale-text signals</h2>
      <table>
        <thead>
          <tr>
            <th>Signal</th>
            <th>Write instead</th>
          </tr>
        </thead>
        <tbody>
          {STALE_PHRASES.map((p) => (
            <tr key={p.id}>
              <td>{p.display}</td>
              <td>{p.replacement}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
