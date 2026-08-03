import { BANNED_ABBREVIATIONS } from "@/lib/vocab/abbreviations";
import { STALE_PHRASES, VAGUE_PHRASES } from "@/lib/vocab/vague-phrases";
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
