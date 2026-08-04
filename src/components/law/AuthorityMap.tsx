// THE AUTHORITY MAP — how Tennessee dental law fits together, at a glance.
//
// Server-rendered nested layout rather than a client-side diagram library:
// the relationships are a shallow tree plus overlays, which nesting and
// arrows-in-text express without shipping a renderer. The full Mermaid source
// for the same map lives in docs/tn-dental-authority-map.md for anyone who
// wants the graph form.

const tiers = [
  {
    title: "Tennessee General Assembly",
    tone: "bg-brand-navy text-white",
    body: "Writes the statutes (Tennessee Code Annotated) and session law.",
    items: ["TCA Title 63, Ch. 5 — Dental Practice Act", "TCA § 63-2-101 — record release", "TCA § 63-1-176 — minors' consent", "TCA § 53-10-310 — CSMD check", "Public Ch. 1107 (2026) — supervision, eff. 1/1/2027"]
  },
  {
    title: "Board of Dentistry (created by the Act)",
    tone: "bg-brand-blue text-white",
    body: "Writes and enforces the rules; disciplines licensees.",
    items: ["Rules 0460-01 — general", "0460-02 — dentists (.07 sedation, .12 records)", "0460-03 — hygienists", "0460-04 — assistants"]
  },
  {
    title: "Every licensed dental professional in Tennessee",
    tone: "bg-white ring-1 ring-slate-200",
    body: "Practices inside the statutes and rules — with three overlays that apply at the same time.",
    items: []
  }
] as const;

const overlays = [
  {
    title: "Federal overlays",
    detail: "HIPAA Privacy & Security (2026 updates) · OSHA bloodborne pathogens · DEA controlled substances"
  },
  {
    title: "Professional ethics",
    detail: "ADA Principles of Ethics & Code of Professional Conduct — autonomy, nonmaleficence, beneficence, justice, veracity"
  },
  {
    title: "Patient-safety standards",
    detail: "Joint Commission Do-Not-Use list · ISMP error-prone abbreviations · CDC dental infection control"
  }
] as const;

export function AuthorityMap() {
  return (
    <div className="space-y-2">
      {tiers.map((t, i) => (
        <div key={t.title} className="relative">
          {i > 0 && (
            <div aria-hidden className="mx-auto -mt-1 mb-1 w-fit text-slate-400">
              ↓ <span className="text-[0.65rem] align-middle">{i === 1 ? "delegates rulemaking" : "binds"}</span>
            </div>
          )}
          <div className={`rounded-xl p-3 ${t.tone}`}>
            <p className="text-sm font-bold">{t.title}</p>
            <p className={`mt-0.5 text-xs ${i < 2 ? "text-white/85" : "text-slate-600"}`}>{t.body}</p>
            {t.items.length > 0 && (
              <ul className={`mt-1.5 flex flex-wrap gap-1.5 text-[0.7rem] ${i < 2 ? "text-white/95" : ""}`}>
                {t.items.map((item) => (
                  <li key={item} className={`rounded-full px-2 py-0.5 ${i < 2 ? "bg-white/15" : "bg-slate-100"}`}>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
      <div aria-hidden className="mx-auto -mt-1 mb-1 w-fit text-slate-400">
        ↑ <span className="text-[0.65rem] align-middle">overlaid simultaneously by</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {overlays.map((o) => (
          <div key={o.title} className="rounded-xl bg-brand-teal/10 p-3 ring-1 ring-brand-teal/30">
            <p className="text-xs font-bold text-brand-navy">{o.title}</p>
            <p className="mt-1 text-[0.7rem] leading-relaxed text-slate-600">{o.detail}</p>
          </div>
        ))}
      </div>
      <p className="text-[0.65rem] text-slate-500">
        Enforcement flows back up: Board discipline cites the rules, the rules cite the Act, and
        civil litigation reads the record against all of it at once.
      </p>
    </div>
  );
}
