"use client";

import { useState } from "react";
import type { ClinicalRole } from "@/lib/auth/clinicalRoles";
import { ByteAdvisor } from "./ByteAdvisor";

// BYTE + THE DEEP MODEL — the host half of ByteAdvisor's "Think deeper".
//
// ByteAdvisor renders the button and stays read-only by architecture; this
// wrapper owns the wire. One POST to /api/assist (capability: interrogate —
// the questions a later reader would ask, never facts), and every outcome the
// route can return has visible copy: the questions, the deterministic-twins
// explanation, the privacy refusal, the throttle, and assist-off. A refusal
// the user cannot read is a bug, so nothing is silently swallowed — including
// a network miss. Nothing here writes into the note: no setter, no insert
// affordance, no write path.

/** Every outcome "Think deeper" can land in — each renders visible copy. */
type DeepAskState =
  | { status: "asking" }
  | { status: "questions"; items: string[] }
  | { status: "deterministic"; explanation: string }
  | { status: "phi"; message: string }
  | { status: "notice"; message: string };

export function ByteAskDeeper({
  text,
  clinicalRole,
  draftId,
  assistEnabled = false
}: {
  text: string;
  clinicalRole?: ClinicalRole;
  /** Provenance target: a successful assist stamps assist.used on this draft. */
  draftId?: string;
  /**
   * Server-known enablement (ASSIST_ENABLED + key, from getAssistConfig on the
   * page). Gates the affordance only; every capability/PHI/throttle decision
   * stays on the server at POST time.
   */
  assistEnabled?: boolean;
}) {
  const [deepAsk, setDeepAsk] = useState<DeepAskState | null>(null);

  const askDeeper = async () => {
    setDeepAsk({ status: "asking" });
    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ capability: "interrogate", text, draftId })
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.ok && body.tier === "deterministic") {
        setDeepAsk({ status: "deterministic", explanation: String(body.explanation ?? "") });
        return;
      }
      if (res.ok && body.ok === false && body.code === "phi-blocked") {
        setDeepAsk({ status: "phi", message: String(body.message ?? "") });
        return;
      }
      if (res.ok && (Array.isArray(body.items) || typeof body.text === "string")) {
        const items = Array.isArray(body.items)
          ? body.items.map(String)
          : String(body.text).split("\n").filter(Boolean);
        setDeepAsk({ status: "questions", items });
        return;
      }
      // 503 assist-off, 429 throttle, 400/413, 422 refusal, 502 model error —
      // the server writes the reason; show it verbatim.
      setDeepAsk({
        status: "notice",
        message: String(body.error ?? "The deep model did not answer. Try again shortly.")
      });
    } catch {
      setDeepAsk({ status: "notice", message: "Could not reach the deep model — check the connection." });
    }
  };

  return (
    <>
      <ByteAdvisor
        text={text}
        clinicalRole={clinicalRole}
        assistEnabled={assistEnabled}
        onAskDeeper={() => void askDeeper()}
      />
      {deepAsk && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs"
        >
          {deepAsk.status === "asking" ? (
            <p className="text-slate-600">Asking the deep model what this note leaves open…</p>
          ) : deepAsk.status === "questions" ? (
            <>
              <p className="mb-1 font-semibold text-brand-navy">
                What this note leaves open ({deepAsk.items.length})
              </p>
              <ul className="list-disc space-y-1 pl-4 text-slate-700">
                {deepAsk.items.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
              <p className="mt-1.5 border-t border-slate-100 pt-1 text-[0.65rem] text-slate-500">
                Questions, never facts — nothing here writes into the note.
              </p>
            </>
          ) : deepAsk.status === "deterministic" ? (
            <p className="text-slate-700">{deepAsk.explanation}</p>
          ) : deepAsk.status === "phi" ? (
            <p className="text-rose-800">{deepAsk.message}</p>
          ) : (
            <p className="text-slate-700">{deepAsk.message}</p>
          )}
          {deepAsk.status !== "asking" && (
            <button
              type="button"
              className="tap mt-1.5 rounded text-xs font-medium text-brand-blue underline decoration-dotted underline-offset-2"
              onClick={() => setDeepAsk(null)}
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </>
  );
}
