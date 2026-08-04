"use client";

import { useState } from "react";
import {
  LICENSE_SCOPE_MERMAID,
  LICENSE_SCOPES,
  type LicenseScope
} from "@/lib/law/license-scope";
import { MermaidDiagram } from "@/components/ui/MermaidDiagram";

// Can / cannot by Tennessee dental license level — cited charts for staff.
// Training aid only; not a substitute for the Code or Board rules.

export function LicenseScopeCharts() {
  const [activeId, setActiveId] = useState(LICENSE_SCOPES[0].id);
  const active = LICENSE_SCOPES.find((s) => s.id === activeId) ?? LICENSE_SCOPES[0];

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <p className="eyebrow">Who may do what</p>
        <h2 className="section-title">Tennessee license scope at a glance</h2>
        <p className="mt-1 text-sm text-slate-600">
          Brief, cited can / cannot for each license level. Full duty lists stay in the Board
          rules — these charts show the hard boundaries staff hit every day. Sources: Tenn. Code
          Ann. § 63-5-108; Tenn. Comp. R. & Regs. 0460-01-.01, 0460-03-.09, 0460-04-.08 and related
          certification rules; 2026 Tenn. Pub. Ch. 1107 (eff. 1/1/2027). Not legal advice — verify
          the current Code and Rule PDFs.
        </p>
      </div>

      <MermaidDiagram title="How the roles relate" chart={LICENSE_SCOPE_MERMAID.hierarchy} />
      <MermaidDiagram
        title="Supervision: direct vs general vs 2027 new-patient rule"
        chart={LICENSE_SCOPE_MERMAID.supervision}
      />
      <MermaidDiagram
        title="Reserved acts and certification gates"
        chart={LICENSE_SCOPE_MERMAID.reserved}
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="License level">
        {LICENSE_SCOPES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === activeId}
            className={`tap rounded-full px-3 py-1.5 text-sm font-medium ${
              s.id === activeId
                ? "bg-brand-navy text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            onClick={() => setActiveId(s.id)}
          >
            {s.shortLabel}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-600">
        Pick a license level to see what that person may and may not do, with citations.
      </p>

      <ScopeCard scope={active} />
    </div>
  );
}

function ScopeCard({ scope }: { scope: LicenseScope }) {
  return (
    <article className="card space-y-4" aria-labelledby={`scope-${scope.id}`}>
      <header>
        <h3 id={`scope-${scope.id}`} className="text-base font-bold text-brand-navy">
          {scope.title}
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          <span className="font-semibold">Basis: </span>
          {scope.licenseBasis}
        </p>
        <p className="mt-1 text-sm text-slate-700">{scope.supervision}</p>
      </header>

      <ScopeList title="May" tone="ok" items={scope.may} />
      {scope.withCertification.length > 0 && (
        <ScopeList
          title="May with Board certification / permit (+ listed supervision)"
          tone="cert"
          items={scope.withCertification}
        />
      )}
      <ScopeList title="May not" tone="no" items={scope.mayNot} />
    </article>
  );
}

function ScopeList({
  title,
  tone,
  items
}: {
  title: string;
  tone: "ok" | "no" | "cert";
  items: { text: string; citations: string[] }[];
}) {
  const styles =
    tone === "ok"
      ? "border-teal-200 bg-teal-50/80"
      : tone === "cert"
        ? "border-amber-200 bg-amber-50/80"
        : "border-red-200 bg-red-50/70";
  const heading =
    tone === "ok" ? "text-teal-900" : tone === "cert" ? "text-amber-950" : "text-red-900";

  return (
    <section className={`rounded-lg border p-3 ${styles}`}>
      <h4 className={`text-sm font-bold ${heading}`}>{title}</h4>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.text.slice(0, 48)} className="text-sm text-slate-800">
            <p>{item.text}</p>
            <p className="mt-0.5 text-[0.7rem] leading-relaxed text-slate-600">
              {item.citations.join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
