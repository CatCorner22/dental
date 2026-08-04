"use client";

import { useId, useState } from "react";
import {
  LICENSE_SCOPE_MERMAID,
  LICENSE_SCOPES,
  type LicenseScope
} from "@/lib/law/license-scope";
import { MermaidDiagram } from "@/components/ui/MermaidDiagram";
import { HelpTip } from "@/components/ui/HelpTip";

// Can / cannot by Tennessee dental license level — cited charts for staff.
// Training aid only; not a substitute for the Code or Board rules.

export function LicenseScopeCharts() {
  const [activeId, setActiveId] = useState(LICENSE_SCOPES[0].id);
  const active = LICENSE_SCOPES.find((s) => s.id === activeId) ?? LICENSE_SCOPES[0];
  const tablistId = useId();
  const panelId = useId();

  return (
    <div className="space-y-6">
      <div
        className="max-w-3xl rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
        role="status"
      >
        <p className="font-semibold">Training aid — not legal advice</p>
        <p className="mt-0.5 text-xs leading-relaxed">
          Verify the current Tennessee Code and Board Rule 0460 PDFs before relying on any
          boundary. Charts summarize hard stops staff hit every day.
        </p>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="max-w-3xl">
          <p className="eyebrow">Who may do what</p>
          <h2 className="section-title inline-flex items-center gap-2">
            Tennessee license scope at a glance
            <HelpTip label="About these charts">
              Sources: Tenn. Code Ann. § 63-5-108; Rules 0460-01-.01, 0460-03-.09, 0460-04-.08
              and related certification rules; 2026 Tenn. Pub. Ch. 1107 (eff. 1/1/2027). Hover any
              lightbulb for a short tip.
            </HelpTip>
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Pick a license level below to see what that person may and may not do, with citations.
            Diagrams show how the roles and supervision levels fit together.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="License level" id={tablistId}>
        {LICENSE_SCOPES.map((s) => {
          const selected = s.id === activeId;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`${tablistId}-${s.id}`}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              className={`tap min-h-11 rounded-lg px-4 py-2 text-sm font-semibold ${
                selected
                  ? "bg-brand-navy text-white shadow-sm"
                  : "bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50"
              }`}
              onClick={() => setActiveId(s.id)}
              onKeyDown={(e) => {
                const ids = LICENSE_SCOPES.map((x) => x.id);
                const i = ids.indexOf(activeId);
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveId(ids[(i + 1) % ids.length]!);
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveId(ids[(i - 1 + ids.length) % ids.length]!);
                } else if (e.key === "Home") {
                  e.preventDefault();
                  setActiveId(ids[0]!);
                } else if (e.key === "End") {
                  e.preventDefault();
                  setActiveId(ids[ids.length - 1]!);
                }
              }}
            >
              {s.shortLabel}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-600" id={`${panelId}-cue`}>
        Showing scope for <strong>{active.shortLabel}</strong>. Use arrow keys to move between
        license levels.
      </p>

      <div role="tabpanel" id={panelId} aria-labelledby={`${tablistId}-${active.id}`}>
        <ScopeCard scope={active} />
      </div>

      <details className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
        <summary className="cursor-pointer text-sm font-semibold text-brand-navy">
          Show relationship diagrams
          <span className="ml-2 font-normal text-slate-500">(optional — charts)</span>
        </summary>
        <div className="mt-3 space-y-4">
          <MermaidDiagram title="How the roles relate" chart={LICENSE_SCOPE_MERMAID.hierarchy} />
          <MermaidDiagram
            title="Supervision: direct vs general vs 2027 new-patient rule"
            chart={LICENSE_SCOPE_MERMAID.supervision}
          />
          <MermaidDiagram
            title="Reserved acts and certification gates"
            chart={LICENSE_SCOPE_MERMAID.reserved}
          />
        </div>
      </details>
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

      <ScopeList
        title="May"
        tip="Acts this license level may perform when trained and assigned."
        tone="ok"
        items={scope.may}
      />
      {scope.withCertification.length > 0 && (
        <ScopeList
          title="May with Board certification / permit"
          tip="Allowed only with the matching Board certification or permit and the supervision the rule names."
          tone="cert"
          items={scope.withCertification}
        />
      )}
      <ScopeList
        title="May not"
        tip="Hard stops. Do not assign these acts to this license level."
        tone="no"
        items={scope.mayNot}
      />
    </article>
  );
}

function ScopeList({
  title,
  tip,
  tone,
  items
}: {
  title: string;
  tip: string;
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
      <h4 className={`inline-flex items-center gap-1.5 text-sm font-bold ${heading}`}>
        {title}
        <HelpTip label={`About ${title}`}>{tip}</HelpTip>
      </h4>
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
