import { MarkdownDoc } from "@/components/reference/MarkdownDoc";
import { readReferenceDoc } from "@/lib/content";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { meetsRole } from "@/lib/auth/roles";
import {
  authoritiesByCategory,
  authorityById,
  CATEGORY_LABEL,
  CATEGORY_ORDER
} from "@/lib/law/tn-law";
import { AuthorityMap } from "@/components/law/AuthorityMap";
import { LicenseScopeCharts } from "@/components/law/LicenseScopeCharts";
import { LawWatchPanel } from "@/components/law/LawWatchPanel";
import { HelpTip } from "@/components/ui/HelpTip";

export const metadata = { title: "Tennessee law" };

// THE TENNESSEE LAW LIBRARY — organized, cited, linked, and wired to the app.
//
// Three layers on one page, most-oriented first: the authority MAP (how the
// pieces fit), the LIBRARY (every authority with citation, official link,
// practice impact, and the app features that enforce it), and the WATCH
// agents (Team Lead+; scan the official sources for changes). The original
// prose training summary stays at the bottom — the library organizes it, it
// does not replace it.

export default async function Page() {
  const user = await freshSessionUser();
  const byCategory = authoritiesByCategory();
  return (
    <div className="space-y-8">
      <div className="flex max-w-3xl items-start gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <p className="min-w-0 flex-1">
          Internal training summary — not legal advice. Every entry links its primary source;
          verify the current Tennessee Code, the Secretary of State Rule 0460 index, and Board
          notices before relying on any item.
        </p>
        <HelpTip label="About this law page">
          Charts and library entries cite TCA and Board Rules. They train the team and explain what
          the app enforces — they are not a substitute for counsel or the official text.
        </HelpTip>
      </div>

      <section>
        <p className="eyebrow">How the authorities fit together</p>
        <h1 className="page-title mb-3">Tennessee law and Rules for dental practice</h1>
        <AuthorityMap />
      </section>

      <section aria-labelledby="license-scope-heading">
        <h2 id="license-scope-heading" className="sr-only">
          License scope charts
        </h2>
        <LicenseScopeCharts />
      </section>

      {user && meetsRole(user.role, "lead") && <LawWatchPanel />}

      <section>
        <p className="eyebrow">The library</p>
        <h2 className="section-title mb-1">Every authority, cited and wired to this app</h2>
        <p className="mb-4 max-w-3xl text-sm text-slate-600">
          Each entry cites its primary source and names the audit rules and features in this
          application that implement it — the law, and where the software earns its keep.
        </p>
        <div className="space-y-6">
          {CATEGORY_ORDER.map((cat) => {
            const entries = byCategory.get(cat) ?? [];
            if (entries.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="label-section mb-2">
                  {CATEGORY_LABEL[cat]}
                </h3>
                <div className="space-y-3">
                  {entries.map((a) => (
                    <article key={a.id} id={a.id} className="card">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h4 className="text-sm font-bold text-brand-navy">{a.title}</h4>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-brand-blue underline decoration-dotted underline-offset-2"
                        >
                          {a.citation}
                          {a.unofficialMirror ? " (mirror)" : ""}
                        </a>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">{a.summary}</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                        <span className="font-semibold text-slate-700">In practice: </span>
                        {a.practiceImpact}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {a.appEnforcement.map((e) => (
                          <span
                            key={e}
                            className="rounded-full bg-brand-teal/10 px-2 py-0.5 text-[0.65rem] text-brand-navy ring-1 ring-brand-teal/30"
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                      {a.relatedIds.length > 0 && (
                        <p className="mt-2 text-[0.65rem] text-slate-500">
                          Related:{" "}
                          {a.relatedIds.map((rid, i) => {
                            const rel = authorityById(rid);
                            return (
                              <span key={rid}>
                                {i > 0 && " · "}
                                <a href={`#${rid}`} className="underline decoration-dotted">
                                  {rel ? rel.citation : rid}
                                </a>
                              </span>
                            );
                          })}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <p className="eyebrow">Extended training summary</p>
        <MarkdownDoc markdown={readReferenceDoc("tennesseeLaw")} />
      </section>
    </div>
  );
}
