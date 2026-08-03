"use client";

import { useMemo, useRef, useState } from "react";
import { SEVERITY_LABELS } from "@/lib/audit/types";
import type { Severity } from "@/lib/audit/types";
import type { AppliedChange, RaisedFlag } from "@/lib/standardize/standardize";
import { BlockPicker } from "./BlockPicker";
import {
  andon,
  ATTESTATION_RULE,
  blockedExplanation,
  buildConcerns,
  copyAllowed,
  isValidAttestation,
  openBlocking,
  reconcile,
  resolveItem,
  type FindingLike,
  type QueueItem
} from "@/lib/standardize/resolution";

// THE RESOLUTION QUEUE. The transformer never auto-corrects and the user never
// overrides: every deterministic rewrite is accepted item by item, every flag
// is fixed or attested, and a genuine disagreement with a RULE goes to a Team
// Lead instead of through a bypass. Copy stays locked until the queue is
// clear. The messages are cold logic on purpose — what was found, why the
// line stops, exactly how to move — because a block whose reason is visible
// is a block that gets respected instead of gamed.

interface Result {
  text: string;
  applied: AppliedChange[];
  flags: RaisedFlag[];
  clean: boolean;
  findings: FindingLike[];
}

const SEV_CLASS: Record<string, string> = {
  S0: "border-red-300 bg-red-50 text-red-900",
  S1: "border-orange-300 bg-orange-50 text-orange-900",
  S2: "border-amber-300 bg-amber-50 text-amber-900",
  S3: "border-sky-200 bg-sky-50 text-sky-900",
  S4: "border-slate-200 bg-white text-slate-600"
};

const ANDON_CLASS: Record<string, string> = {
  red: "border-red-300 bg-red-50 text-red-900",
  amber: "border-amber-300 bg-amber-50 text-amber-900",
  green: "border-green-300 bg-green-50 text-green-900"
};

export function Standardizer({ assistEnabled = false }: { assistEnabled?: boolean }) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiQuestions, setAiQuestions] = useState<{ title: string; lines: string[] } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const queueRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const run = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    setCopied(false);
    try {
      const res = await fetch("/api/standardize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: input })
      });
      const data = (await res.json().catch(() => ({}))) as Result & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not standardize that text.");
      } else {
        setResult(data);
        const concerns = buildConcerns({ applied: data.applied, flags: data.flags }, data.findings);
        setItems((prev) => reconcile(prev, concerns));
        setTimeout(() => queueRef.current?.focus(), 50);
      }
    } catch {
      setError("Could not reach the server — check the connection and try again.");
    }
    setBusy(false);
  };

  // AI assist. The model NEVER bypasses the rails: a rewrite lands back in
  // the input box and goes through the same deterministic check and the same
  // resolution queue as hand-typed text. Question capabilities return
  // questions only — the verifier refuses anything that asserts.
  const runAssist = async (capability: "normalize" | "soap" | "interrogate" | "conflicts") => {
    setAiBusy(capability);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ capability, text: input })
      });
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok || !data.text) {
        setError(data.error ?? "The AI service did not answer. Everything else still works.");
      } else if (capability === "interrogate" || capability === "conflicts") {
        setAiQuestions({
          title: capability === "interrogate" ? "What this note leaves open" : "Possible contradictions",
          lines: data.text.split("\n").map((l) => l.trim()).filter(Boolean)
        });
      } else {
        setInput(data.text);
        setNotice(
          "The AI rewrote the wording. Nothing is accepted yet — press Standardize and work the queue like any other text."
        );
        setResult(null);
        setItems([]);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } catch {
      setError("Could not reach the server — check the connection and try again.");
    }
    setAiBusy(null);
  };

  const rejectChanges = () => {
    // Rejecting any rewrite rejects the PROPOSAL: nothing was changed, nothing
    // is offered for copy, and the writer edits their own wording instead.
    setResult(null);
    setItems([]);
    setNotice(
      "Rewrite rejected. Nothing was changed and nothing will be copied. Edit your wording and press Standardize again."
    );
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("The clipboard is blocked in this browser. Select the text and copy it by hand.");
    }
  };

  const light = useMemo(() => andon(items), [items]);
  const allowed = result !== null && copyAllowed(items);
  const openItems = openBlocking(items);
  const resolved = items.filter((i) => i.concern.blocking && i.state.kind !== "open").length;
  const totalBlocking = items.filter((i) => i.concern.blocking).length;
  const infoItems = items.filter((i) => !i.concern.blocking);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <label className="field-label" htmlFor="std-in">
          Paste your note
        </label>
        <textarea
          id="std-in"
          ref={inputRef}
          className="field-input min-h-[16rem] font-mono text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type or paste the note exactly as you would write it. De-identified facts only — no patient name, exact date, contact detail, or record number."
          aria-describedby="std-help"
        />
        <p id="std-help" className="mt-1 text-xs text-slate-500">
          {input.length.toLocaleString()} characters. Nothing you paste here is saved — the text is
          standardized in memory and returned.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={run} disabled={busy || !input.trim()}>
            {busy ? "Checking…" : result ? "Re-check" : "Standardize"}
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              setInput("");
              setResult(null);
              setItems([]);
              setError("");
              setNotice("");
              setAiQuestions(null);
            }}
            disabled={busy || (!input && !result)}
          >
            Clear
          </button>
        </div>

        <BlockPicker
          onInsert={(text) => {
            setInput((prev) => (prev.trim() ? `${prev.replace(/\s+$/, "")}\n\n${text}` : text));
            setNotice(
              "Block inserted. Replace every <placeholder> with this visit's facts — the note stays blocked while any placeholder survives."
            );
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
        />

        {assistEnabled && (
          <div className="mt-3 rounded border border-violet-200 bg-violet-50 p-3">
            <p className="mb-2 text-xs font-semibold text-violet-900">
              AI assist — every AI draft is checked against your text for changed numbers,
              negations, drugs, and attributions before you see it, and still goes through the
              queue. It rewrites wording, never facts.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-secondary text-xs"
                onClick={() => runAssist("normalize")}
                disabled={!input.trim() || aiBusy !== null}
              >
                {aiBusy === "normalize" ? "Working…" : "Tighten the wording"}
              </button>
              <button
                className="btn-secondary text-xs"
                onClick={() => runAssist("soap")}
                disabled={!input.trim() || aiBusy !== null}
              >
                {aiBusy === "soap" ? "Working…" : "Structure as SOAP"}
              </button>
              <button
                className="btn-secondary text-xs"
                onClick={() => runAssist("interrogate")}
                disabled={!input.trim() || aiBusy !== null}
              >
                {aiBusy === "interrogate" ? "Working…" : "What is this note missing?"}
              </button>
              <button
                className="btn-secondary text-xs"
                onClick={() => runAssist("conflicts")}
                disabled={!input.trim() || aiBusy !== null}
              >
                {aiBusy === "conflicts" ? "Working…" : "Check for contradictions"}
              </button>
            </div>
          </div>
        )}

        {aiQuestions && (
          <div className="mt-3 rounded border border-violet-300 bg-white p-3" role="region" aria-label={aiQuestions.title}>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-violet-900">{aiQuestions.title}</h2>
              <button className="text-xs text-slate-500 underline" onClick={() => setAiQuestions(null)}>
                Dismiss
              </button>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
              {aiQuestions.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              Questions only — the AI is not allowed to answer them. If one applies, add the fact
              to your note and re-check.
            </p>
          </div>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-3 rounded border border-sky-300 bg-sky-50 p-2 text-sm text-sky-900" role="status">
            {notice}
          </p>
        )}

        {result && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="field-label mb-0">Standardized note</span>
              <button
                className="btn-secondary"
                onClick={copy}
                disabled={!allowed}
                aria-disabled={!allowed}
                title={allowed ? "Copy for Curve Hero" : blockedExplanation(items)}
              >
                {copied ? "Copied ✓" : allowed ? "Copy for Curve Hero" : "🔒 Copy locked"}
              </button>
            </div>
            <div
              className={`min-h-[8rem] whitespace-pre-wrap rounded border p-3 font-mono text-sm ${
                allowed ? "border-green-300 bg-white" : "border-slate-300 bg-slate-50 text-slate-500"
              }`}
              aria-label="Standardized note"
            >
              {result.text}
            </div>
            {!allowed && (
              <p className="mt-2 text-xs text-slate-600" role="status">
                {blockedExplanation(items)}
              </p>
            )}
          </div>
        )}
      </div>

      <div ref={queueRef} tabIndex={-1} role="region" aria-label="Resolution queue" className="outline-none">
        {result === null ? (
          <div className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            The resolution queue appears here. Every change the tool proposes is accepted by you,
            item by item; everything it catches is fixed, attested, or sent to a Team Lead. The
            note unlocks when the queue is clear.
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className={`flex items-center justify-between rounded border px-3 py-2 text-sm font-semibold ${ANDON_CLASS[light.state]}`}
              aria-live="polite"
            >
              <span>
                {light.state === "green"
                  ? totalBlocking === 0
                    ? "Clean on the first pass. That is the standard, and you hit it — the next reader of this record will not have a single question."
                    : "Queue clear. The note is unlocked."
                  : `${openItems.length} of ${totalBlocking} item${totalBlocking === 1 ? "" : "s"} still need${openItems.length === 1 ? "s" : ""} you.`}
              </span>
              <span aria-hidden="true">
                {resolved}/{totalBlocking} ✓
              </span>
            </div>

            {items
              .filter((i) => i.concern.blocking)
              .map((item) => (
                <ConcernCard
                  key={item.concern.key}
                  item={item}
                  onResolve={(state) => setItems((prev) => resolveItem(prev, item.concern.key, state))}
                  onRejectChanges={rejectChanges}
                  onWantsFix={() => inputRef.current?.focus()}
                />
              ))}

            {infoItems.length > 0 && (
              <details className="rounded border border-slate-200 bg-white p-3 text-sm">
                <summary className="cursor-pointer font-semibold text-slate-700">
                  Style notes ({infoItems.length}) — do not block
                </summary>
                <ul className="mt-2 space-y-1">
                  {infoItems.map((i) => (
                    <li key={i.concern.key} className={`rounded border px-3 py-1.5 ${SEV_CLASS[i.concern.severity]}`}>
                      <span className="text-xs font-semibold uppercase">
                        {i.concern.severity} {SEVERITY_LABELS[i.concern.severity as Severity] ?? ""}
                      </span>
                      <span className="block">{i.concern.what}</span>
                      <span className="block text-xs opacity-80">{i.concern.how}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ConcernCard({
  item,
  onResolve,
  onRejectChanges,
  onWantsFix
}: {
  item: QueueItem;
  onResolve: (state: QueueItem["state"]) => void;
  onRejectChanges: () => void;
  onWantsFix: () => void;
}) {
  const { concern, state } = item;
  const [mode, setMode] = useState<"none" | "attest" | "escalate">("none");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const settled = state.kind !== "open";

  const attest = () => {
    if (!isValidAttestation(reason)) {
      setErr(ATTESTATION_RULE);
      return;
    }
    onResolve({ kind: "attested", reason: reason.trim() });
  };

  const escalate = async () => {
    if (!isValidAttestation(reason)) {
      setErr("Say why the rule is wrong, in at least four real words — a Team Lead reads this.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/wishes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: "rule-disagreement",
          title: `Rule disagreement: ${concern.ruleId ?? concern.what.slice(0, 100)}`,
          // The reason and the rule — never the note text. A disagreement is
          // about the RULE; patient content stays on this screen.
          detail: `${reason.trim()}\n\n(Rule: ${concern.ruleId ?? "transformer flag"} — raised on the Standardize screen.)`
        })
      });
      const data = (await res.json().catch(() => ({}))) as { id?: number; error?: string };
      if (!res.ok || !data.id) {
        setErr(data.error ?? "Could not reach the wish list. Try again.");
      } else {
        onResolve({ kind: "escalated", wishId: data.id });
      }
    } catch {
      setErr("Could not reach the server — check the connection and try again.");
    }
    setBusy(false);
  };

  return (
    <div
      className={`rounded border p-3 text-sm ${settled ? "border-green-300 bg-green-50" : SEV_CLASS[concern.severity]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-xs font-semibold uppercase">
            {settled ? "Resolved" : `${concern.severity} ${SEVERITY_LABELS[concern.severity as Severity] ?? ""}`}
          </span>
          <p className="font-medium">{concern.what}</p>
        </div>
        {settled && (
          <span className="shrink-0 text-green-700" aria-hidden="true">
            ✓
          </span>
        )}
      </div>

      {settled ? (
        <p className="mt-1 text-xs text-green-900">
          {state.kind === "reviewed" && "Change read and accepted."}
          {state.kind === "attested" && `Attested: “${state.reason}”`}
          {state.kind === "escalated" && `Sent to a Team Lead for resolution (entry #${state.wishId}). The rule stays in force until they decide.`}
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs">
            <strong>Why this stops the line:</strong> {concern.why}
          </p>
          <p className="mt-1 text-xs">
            <strong>How to move:</strong> {concern.how}
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            {concern.source === "change" ? (
              <>
                <button className="btn-secondary text-xs" onClick={() => onResolve({ kind: "reviewed" })}>
                  Accept this change
                </button>
                <button className="btn-secondary text-xs" onClick={onRejectChanges}>
                  Reject the rewrite
                </button>
              </>
            ) : (
              <>
                <button className="btn-secondary text-xs" onClick={onWantsFix}>
                  Fix the text, then Re-check
                </button>
                {concern.attestable && (
                  <button
                    className="btn-secondary text-xs"
                    onClick={() => {
                      setMode(mode === "attest" ? "none" : "attest");
                      setErr("");
                    }}
                  >
                    It is correct as written
                  </button>
                )}
                {concern.escalatable && (
                  <button
                    className="btn-secondary text-xs"
                    onClick={() => {
                      setMode(mode === "escalate" ? "none" : "escalate");
                      setErr("");
                    }}
                  >
                    I disagree with this rule
                  </button>
                )}
              </>
            )}
          </div>

          {mode !== "none" && (
            <div className="mt-2">
              <label className="text-xs font-semibold" htmlFor={`reason-${concern.key}`}>
                {mode === "attest"
                  ? "Why is it correct as written? This goes on the record with your name."
                  : "Why is the rule wrong or too broad? A Team Lead reads this and decides. Quote nothing from the patient note."}
              </label>
              <textarea
                id={`reason-${concern.key}`}
                className="field-input mt-1 text-sm"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              {err && (
                <p className="mt-1 text-xs text-red-700" role="alert">
                  {err}
                </p>
              )}
              <div className="mt-1 flex gap-2">
                <button
                  className="btn-primary text-xs"
                  onClick={mode === "attest" ? attest : escalate}
                  disabled={busy}
                >
                  {mode === "attest" ? "Attest" : busy ? "Sending…" : "Send to Team Lead"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
