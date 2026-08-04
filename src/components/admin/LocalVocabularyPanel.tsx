import type { UnknownAbbreviation } from "@/lib/vocab/unknownAbbreviations";

// The shorthand this practice uses that the tool cannot read.
//
// A server component over data already stored, shown to the role that can already
// read every note and can already file a change request. It reports; it changes
// nothing. The route forward is a human writing a ticket, which is the same
// contract the rule-disagreement stats run on.
//
// Placed on the Team Lead dashboard rather than in an admin corner because this is
// a coaching artefact as much as a vocabulary one: a term eight people use and the
// tool cannot expand is either missing from the table or a habit worth a
// conversation, and the lead is the person who can tell which.

export function LocalVocabularyPanel({ entries, notesScanned }: {
  entries: UnknownAbbreviation[];
  notesScanned: number;
}) {
  if (notesScanned === 0) {
    return (
      <section className="mt-8 rounded-xl bg-white ring-1 ring-slate-200 p-4">
        <h2 className="section-title">Shorthand the tool does not know</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Nothing filed yet. Once notes are on file, this lists the abbreviations the practice
          uses that the transformer cannot expand — so the vocabulary can be extended from what
          people actually write rather than from a guess.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-xl bg-white ring-1 ring-slate-200 p-4">
      <h2 className="section-title">Shorthand the tool does not know</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-700">
        Read from the {notesScanned.toLocaleString()} most recent filed notes. These are
        abbreviation-shaped words the transformer cannot expand and cannot flag — so they reach
        the record unexplained, and whoever reads it in five years has to guess.
      </p>
      <p className="mt-1 max-w-3xl text-xs text-slate-500">
        A preloaded national list covers the common terms. The rest is always local — a material
        only this practice stocks, a shorthand one operatory uses — and no published list will
        ever contain it. Nothing here changes automatically: if a term belongs in the practice&apos;s
        vocabulary, ask the Smile Notes team to add it.
      </p>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">
          Nothing recurring. Every abbreviation in recent notes is one the tool already
          understands, which is what this should look like most of the time.
        </p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-slate-100">
            {entries.map((e) => (
              <li key={e.token} className="flex flex-wrap items-baseline gap-x-3 py-1.5 text-sm">
                <span className="font-mono font-semibold text-slate-900">{e.token}</span>
                <span className="text-slate-600">
                  in {e.notes} note{e.notes === 1 ? "" : "s"}
                  {e.count !== e.notes && `, ${e.count} times`}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            <a className="font-medium text-blue-700 underline" href="/requests">
              Ask for one to be added to the vocabulary
            </a>
          </p>
        </>
      )}
    </section>
  );
}
