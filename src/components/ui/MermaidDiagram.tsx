"use client";

import { useEffect, useId, useRef } from "react";

// Lazy Mermaid render — reference pages only. Keeps the diagram off the critical
// path for clinical screens. CSP allows same-origin scripts; mermaid runs in-bundle.

export function MermaidDiagram({
  chart,
  title
}: {
  chart: string;
  title: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reactId = useId().replace(/:/g, "");
  const renderId = `mmd-${reactId}`;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!ref.current) return;
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
            primaryColor: "#e8eef5",
            primaryTextColor: "#1e3a5f",
            primaryBorderColor: "#1e3a5f",
            lineColor: "#475569",
            secondaryColor: "#f0fdfa",
            tertiaryColor: "#fff7ed",
            fontFamily: "Aptos, Calibri, \"Segoe UI\", system-ui, sans-serif"
          }
        });
        const { svg } = await mermaid.render(renderId, chart);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          const svgEl = ref.current.querySelector("svg");
          if (svgEl) {
            svgEl.setAttribute("role", "img");
            svgEl.setAttribute("aria-label", title);
          }
        }
      } catch {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = `<pre class="text-xs text-red-800 whitespace-pre-wrap">${escapeHtml(chart)}</pre>`;
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [chart, renderId, title]);

  return (
    <div className="overflow-x-auto rounded-xl bg-white p-3 ring-1 ring-slate-200">
      <p className="mb-2 text-xs font-semibold text-brand-navy">{title}</p>
      <div ref={ref} className="flex min-h-[8rem] justify-center [&_svg]:max-w-full">
        <p className="text-xs text-slate-500">Loading diagram…</p>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
