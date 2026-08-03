import { SHORTHAND, SHORTHAND_OWNS } from "@/lib/vocab/shorthand";

export const metadata = { title: "Shorthand expansions" };

// Generated from the same table the standardizer uses, so this page cannot
// drift from what the tool actually does.
//
// These 51 entries had no staff-facing surface at all. The standardizer has
// been expanding shorthand on first use since the beginning and nobody outside
// the code could see the list, which meant the one question staff actually ask
// — "will it touch MY shorthand, and what will it turn it into?" — had no
// answer anywhere in the product.
//
// The ambiguous entries matter most and are listed first. Those are the ones
// the tool refuses to expand, and a clinician needs to know that a flagged
// "GP" is waiting on them rather than being quietly resolved.
const DOMAIN_LABEL: Record<string, string> = {
  dental: "Dental",
  medical: "Medical",
  dosing: "Dosing frequency"
};

export default function Page() {
  const ambiguous = SHORTHAND.filter((s) => s.alternatives?.length);
  const unambiguous = SHORTHAND.filter((s) => !s.alternatives?.length);
  const byDomain = (domain: string) => unambiguous.filter((s) => s.domain === domain);

  return (
    <article className="doc">
      <h1>Shorthand expansions</h1>
      <p>
        A term of art is written out in full the <strong>first</strong> time it appears, with the
        shorthand in parentheses after it, and the shorthand alone after that:
      </p>
      <blockquote>
        Root canal therapy (RCT) was started. The RCT was completed at the second visit.
      </blockquote>
      <p>
        That keeps a note readable to someone who was not in the operatory — an insurer, a
        specialist, a colleague covering a shift — without making you spell out the same phrase six
        times. These {SHORTHAND.length} entries are the exact table the Standardize step uses.
      </p>

      <h2>Never expanded — these come back to you</h2>
      <p>
        Each of these means more than one real thing in a dental chart. Guessing would put a
        clinical claim in the note that you never made, so the tool flags them and leaves the choice
        to you. There are {ambiguous.length} of them.
      </p>
      <table>
        <thead>
          <tr>
            <th>Shorthand</th>
            <th>Could mean</th>
          </tr>
        </thead>
        <tbody>
          {ambiguous.map((s) => (
            <tr key={s.id}>
              <td>
                <strong>{s.display}</strong>
              </td>
              <td>{(s.alternatives ?? []).join("  ·  ")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Expanded on first use</h2>
      <p>
        One unambiguous reading each, so the tool writes the full term the first time and leaves the
        shorthand alone afterwards.
      </p>
      {["dental", "medical", "dosing"].map((domain) => {
        const rows = byDomain(domain);
        if (rows.length === 0) return null;
        return (
          <section key={domain}>
            <h3>{DOMAIN_LABEL[domain]}</h3>
            <table>
              <thead>
                <tr>
                  <th>Shorthand</th>
                  <th>Written out as</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.display}</strong>
                    </td>
                    <td>{s.expansion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      <h2>Where this differs from the Abbreviation rules page</h2>
      <p>
        Two different rules, and it is worth knowing which one applies. The entries on this page are{" "}
        <strong>expanded on first use and then left alone</strong> — they are legitimate terms of
        art. The entries on the{" "}
        <a href="/reference/abbreviations">Abbreviation rules</a> page are{" "}
        <strong>replaced everywhere</strong>, because they are ambiguous or unsafe wherever they
        appear.
      </p>
      <p>
        {SHORTHAND_OWNS.size} entries appear on both lists. Where that happens the expansion
        convention wins, so the note reads &ldquo;bitewing radiograph (BW)&rdquo; rather than being
        flagged for a term it just defined properly.
      </p>
      <p className="text-sm text-slate-600">
        Dosing frequencies follow the ISMP error-prone abbreviation list. <strong>qd</strong> and{" "}
        <strong>qod</strong> are deliberately never expanded: they are confused with each other and
        with <strong>qid</strong> in real handwriting, and that confusion has caused real dosing
        errors.
      </p>
    </article>
  );
}
