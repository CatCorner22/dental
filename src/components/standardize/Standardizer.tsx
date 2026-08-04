"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import { SEVERITY_CHIP, SEVERITY_CLASS, SEVERITY_LABELS } from "@/lib/audit/types";
import type { AuditFinding, Severity } from "@/lib/audit/types";
import { standardize } from "@/lib/standardize/standardize";
import { runTextAudit } from "@/lib/audit/engine";
import type { AppliedChange, RaisedFlag } from "@/lib/standardize/standardize";
import { BlockPicker } from "./BlockPicker";
import { ByteAdvisor } from "@/components/advisor/ByteAdvisor";
import { ByteStarAdvisor } from "@/components/advisor/ByteStarAdvisor";
import { TextDiff } from "@/components/diff/TextDiff";
import type { VerifiedExtraction } from "@/lib/assist/extraction";
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
  /**
   * Deterministic SOAP sectioning, when the note had enough shape to sort. Null
   * when the pass declined — too few sentences, or everything landing in one
   * section — because five headings around two lines reads worse than two lines.
   *
   * Separate from `text` on purpose: reordering is a bigger claim than
   * substituting a word, so a person chooses it by name.
   */
  soap: { text: string; sections: string[] } | null;
}

const ANDON_CLASS: Record<string, string> = {
  red: "border-red-300 bg-red-50 text-red-900",
  amber: "border-amber-300 bg-amber-50 text-amber-900",
  green: "border-green-300 bg-green-50 text-green-900"
};

const toFindingLike = (f: AuditFinding): FindingLike => ({
  ruleId: f.ruleId,
  category: f.category,
  severity: f.severity,
  message: f.message,
  matchedText: f.matchedText ?? null,
  occurrences: f.occurrences ?? 1,
  suggestion: f.suggestion ?? null
});

export function Standardizer({ assistEnabled = false }: { assistEnabled?: boolean }) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiQuestions, setAiQuestions] = useState<{ title: string; lines: string[] } | null>(null);
  // The span-verified extraction: pinned facts with their evidence, demoted
  // questions, and per-fact refusals. Held for review — nothing here touches
  // the note until a person adds it, and whatever they add goes through the
  // same live check and queue as hand-typed text.
  const [aiFacts, setAiFacts] = useState<VerifiedExtraction | null>(null);
  // An AI rewrite is a PROPOSAL, held here until the writer accepts it.
  //
  // It used to go straight into the input box. The note said "nothing is
  // accepted yet" — but the writer's own words had already been overwritten,
  // with no diff and no way back, on the one path in this app that can
  // restructure a whole note rather than swap a word. Holding it here is what
  // makes that sentence true.
  const [aiProposal, setAiProposal] = useState<
    { capability: string; label: string; before: string; after: string } | null
  >(null);
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
  const runAssist = async (
    capability: "normalize" | "soap" | "interrogate" | "conflicts" | "extract"
  ) => {
    setAiBusy(capability);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ capability, text: input })
      });
      const data = (await res.json().catch(() => ({}))) as {
        text?: string;
        items?: string[];
        extraction?: VerifiedExtraction;
        error?: string;
      };
      if (!res.ok || (capability !== "extract" && !data.text)) {
        setError(data.error ?? "The AI service did not answer. Everything else still works.");
      } else if (capability === "extract") {
        setAiFacts(data.extraction ?? { pinned: [], questions: [], refused: [] });
        setAiQuestions(null);
      } else if (capability === "interrogate" || capability === "conflicts") {
        // Rendered from the VALIDATED array, not by splitting prose. Splitting
        // on newlines turned a wrapped line into two questions and a preamble
        // into a first one; the server now answers through a schema and checks
        // it, so there is nothing left here to parse.
        setAiQuestions({
          title: capability === "interrogate" ? "What this note leaves open" : "Possible contradictions",
          lines: data.items ?? []
        });
      } else {
        setAiProposal({
          capability,
          label: capability === "normalize" ? "Tightened wording" : "Restructured as SOAP",
          before: input,
          // The guard above ensured text is present for the rewrite
          // capabilities; the fallback only satisfies the type-narrowing.
          after: data.text ?? ""
        });
        setAiQuestions(null);
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

  // The Curve Hero handoff. The single highest-consequence mistake this tool
  // can enable is a perfect note pasted into the WRONG patient's chart — so
  // the copy is gated on a two-identifier match confirmation, per the TN
  // research recommendation ("match at least two patient identifiers against
  // the open Curve chart before confirming the paste").
  const [pasteConfirmOpen, setPasteConfirmOpen] = useState(false);
  const [pasteChecked, setPasteChecked] = useState(false);

  const copy = async () => {
    if (!result) return;
    if (!pasteConfirmOpen) {
      setPasteConfirmOpen(true);
      setPasteChecked(false);
      return;
    }
    if (!pasteChecked) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setPasteConfirmOpen(false);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("The clipboard is blocked in this browser. Select the text and copy it by hand.");
    }
  };

  // THE LIVE CHECK — the whole page's time saving, so it gets the long comment.
  //
  // The old shape was: type blind, press Standardize, wait for the server, read
  // a wall of findings, fix, press Re-check, wait again. Every lap cost a round
  // trip and a context switch, and the person doing the laps has a patient in
  // the chair.
  //
  // The transformer is deterministic and, measured, runs in about a millisecond
  // — so it can run on every pause in typing, client-side, and show what WILL
  // happen before anyone presses anything. Fix a problem and its row disappears
  // as you type. By the time Standardize is pressed the queue is usually
  // already empty, and the press is a formality that unlocks Copy.
  //
  // WHAT THIS DOES NOT CHANGE: nothing here is accepted, and Copy stays locked
  // behind the same queue. The preview runs the SAME functions the server runs
  // (same tables, same ruleset version, one bundle), so what it shows and what
  // the formal check finds cannot disagree. The builder already runs the full
  // audit client-side on every keystroke; this is that same, established path.
  const deferredInput = useDeferredValue(input);
  const live = useMemo(() => {
    const text = deferredInput.trim();
    if (!text) return null;
    const pass = standardize(text);
    const findings = runTextAudit(pass.text).map(toFindingLike);
    const concerns = buildConcerns({ applied: pass.applied, flags: pass.flags }, findings);
    return {
      text: pass.text,
      changes: pass.applied.length,
      blocking: concerns.filter((c) => c.blocking && c.source !== "change"),
      style: concerns.filter((c) => !c.blocking).length
    };
  }, [deferredInput]);
  const liveLagging = deferredInput !== input;

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
          /* The input IS the workspace, so it gets workspace height. The old
             16rem box left most of a 900px screen empty and made a long note
             scroll inside a porthole. */
          className="field-input min-h-[16rem] font-mono text-sm lg:min-h-[45vh]"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // The hands-stay-on-keys path. Anyone fast enough to want this
            // knows the convention from every chat box on earth.
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && input.trim() && !busy) {
              e.preventDefault();
              void run();
            }
          }}
          placeholder="Type or paste the note exactly as you would write it. De-identified facts only — no patient name, exact date, contact detail, or record number."
          aria-describedby="std-help"
        />
        <p id="std-help" className="mt-1 text-xs text-slate-500">
          {input.length.toLocaleString()} characters · Ctrl+Enter to check. Nothing you type here is
          saved — the text is standardized in memory and returned.
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
          {result?.soap && (
            /* Always available, unlike the AI button further down — this pass needs
               no model, which matters because AI is off by default and this is the
               deployment a practice actually gets. Loading the sectioned text back
               into the box rather than copying it straight out keeps the resolution
               queue in charge: the note is re-checked and Copy stays locked until
               the queue is clear. */
            <button
              className="btn-secondary"
              disabled={busy}
              title="Group the sentences under Safety, Subjective, Objective, Assessment and Plan. No AI, and no sentence is reworded."
              onClick={() => {
                setInput(result.soap!.text);
                setResult(null);
                setItems([]);
                setNotice(
                  `Sorted into ${result.soap!.sections.join(", ")}. Every sentence was moved, none reworded — check it, then re-check to unlock Copy.`
                );
              }}
            >
              Structure as SOAP
            </button>
          )}
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
              <button
                className="btn-secondary text-xs"
                onClick={() => runAssist("extract")}
                disabled={!input.trim() || aiBusy !== null}
                title="The model proposes structured facts; each must quote your text verbatim, a deterministic check refuses anything unsupported, and you accept or reject what remains one fact at a time."
              >
                {aiBusy === "extract" ? "Working…" : "Pin facts to evidence"}
              </button>
            </div>
          </div>
        )}

        {/*
          The proposal. Source stays in the box above, the change is shown
          here, and nothing moves until the writer says so — the model path is
          the one that can restructure a whole note, so it does not get the
          apply-then-undo treatment the deterministic pass gets.
        */}
        {aiProposal && (
          <div
            className="mt-3 rounded border border-violet-300 bg-white p-3"
            role="region"
            aria-label={`AI proposal: ${aiProposal.label}`}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-violet-900">
                {aiProposal.label} — proposed, not applied
              </h2>
              <span className="text-xs text-slate-500">verified against your text</span>
            </div>
            <p className="mb-2 text-xs text-slate-600">
              Your text is untouched until you accept this. Read the change, then choose.
            </p>
            <TextDiff before={aiProposal.before} after={aiProposal.after} />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="btn-primary text-xs"
                onClick={() => {
                  setInput(aiProposal.after);
                  setAiProposal(null);
                  setResult(null);
                  setItems([]);
                  setNotice(
                    "Applied. Nothing is accepted yet — press Standardize and work the queue like any other text."
                  );
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
              >
                Use this wording
              </button>
              <button
                className="btn-secondary text-xs"
                onClick={() => {
                  setAiProposal(null);
                  setNotice("Discarded. Your wording was never changed.");
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
              >
                Keep mine
              </button>
            </div>
          </div>
        )}

        {/* THE EVIDENCE-PINNED FACTS, one decision per fact.
            The acceptance test this screen exists to satisfy, from the owner's
            blueprint: no AI-generated clinical fact is finalized without
            visible source evidence or affirmative clinician confirmation. The
            evidence is the quoted line under each fact; the confirmation is
            the button; and everything a person adds still goes through the
            same live check and resolution queue as hand-typed text. */}
        {aiFacts && (
          <div
            className="mt-3 rounded border border-violet-300 bg-white p-3"
            role="region"
            aria-label="Evidence-pinned facts"
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-violet-900">
                Facts pinned to your own words
              </h2>
              <button className="text-xs text-slate-500 underline" onClick={() => setAiFacts(null)}>
                Dismiss
              </button>
            </div>

            {aiFacts.pinned.length === 0 && aiFacts.questions.length === 0 && (
              <p className="text-sm text-slate-600">
                Nothing could be pinned to your text
                {aiFacts.refused.length > 0
                  ? " — every proposal was refused by the deterministic check. Your note is untouched."
                  : ". The note may not contain extractable facts yet."}
              </p>
            )}

            {aiFacts.pinned.length > 0 && (
              <ul className="space-y-2">
                {aiFacts.pinned.map((f, i) => (
                  <li key={i} className="rounded border border-slate-200 p-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-violet-900">
                        {f.kind}
                      </span>
                      <span className="text-sm font-medium text-slate-900">{f.statement}</span>
                      {f.parserAgrees && (
                        <span
                          className="text-xs text-teal-700"
                          title="The deterministic parser independently read a fact of this kind in the same words — a second reader that shares nothing with the model."
                        >
                          ✓ parser agrees
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Evidence, from your text:{" "}
                      <span className="rounded bg-amber-50 px-1 font-mono text-slate-800">
                        “{f.quote}”
                      </span>
                    </p>
                    <div className="mt-1.5 flex gap-2">
                      <button
                        className="btn-secondary text-xs"
                        onClick={() => {
                          setInput((prev) => `${prev.replace(/\s+$/, "")}\n${f.statement}`);
                          setResult(null);
                          setItems([]);
                          setNotice(
                            "Fact added as a line in your note. It goes through the same check and queue as anything you type."
                          );
                          // The human half of the precision loop: one count-only
                          // beacon, fire-and-forget. A failed beacon must never
                          // cost the user their click, so nothing awaits it and
                          // nothing reports it.
                          void fetch("/api/assist/feedback", {
                            method: "POST",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ decision: "accepted" })
                          }).catch(() => {});
                        }}
                      >
                        Add to note
                      </button>
                      <button
                        className="btn-secondary text-xs"
                        title="Select the quoted evidence in your note, using the browser's own selection."
                        onClick={() => {
                          // Native selection IS the highlight: no overlay div
                          // mirroring a textarea, no styling that can drift out
                          // of sync with the text. The scrollTop estimate puts
                          // the selection on screen; the selection makes it
                          // unmistakable.
                          const el = inputRef.current;
                          if (!el) return;
                          // Offsets were computed against the text as it was
                          // when the facts were pinned. An edit since then
                          // makes them stale, and selecting the wrong words
                          // while calling them evidence would be worse than
                          // refusing — so the quote is re-verified first.
                          let start = f.start;
                          let end = f.end;
                          if (el.value.slice(start, end) !== f.quote) {
                            const idx = el.value.indexOf(f.quote);
                            if (idx < 0) {
                              setNotice(
                                "That quoted evidence is no longer in the note — the text was edited since these facts were pinned. Run Pin facts again."
                              );
                              return;
                            }
                            start = idx;
                            end = idx + f.quote.length;
                          }
                          el.focus();
                          el.setSelectionRange(start, end);
                          const before = el.value.slice(0, start);
                          const lines = before.split("\n").length - 1;
                          const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
                          el.scrollTop = Math.max(0, lines * lineHeight - el.clientHeight / 2);
                        }}
                      >
                        Show in note
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {aiFacts.questions.length > 0 && (
              <div className="mt-2 rounded bg-violet-50 p-2">
                <p className="text-xs font-semibold text-violet-900">
                  Too uncertain to state — confirm these yourself:
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-slate-800">
                  {aiFacts.questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}

            {aiFacts.refused.length > 0 && (
              /* Shown, not hidden. A refusal the user can read is the check
                 working in public — and the fastest cure for over-trusting
                 the model is watching it get caught. */
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-slate-700">
                  Refused by the deterministic check ({aiFacts.refused.length})
                </summary>
                <ul className="mt-1 space-y-1 text-xs text-slate-700">
                  {aiFacts.refused.map((r, i) => (
                    <li key={i} className="rounded border border-red-100 bg-red-50/60 px-2 py-1">
                      <span className="font-mono">{r.code}</span> — “{r.statement}”: {r.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
              Every fact above quotes your own words, located and checked deterministically. Nothing
              enters the note without your click, and what you add is re-checked like anything typed.
            </p>
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
            {/*
              The output pane shows the RESULT; this shows the CHANGE. The two
              are different questions, and only the second one lets a reader
              accept the rewrite on evidence rather than on trust. Collapsed by
              default so the note itself stays the main thing on the page.
            */}
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-slate-700">
                See exactly what changed
              </summary>
              <TextDiff before={input} after={result.text} className="mt-2" />
            </details>
            {allowed && pasteConfirmOpen && !copied && (
              <div className="mt-2 rounded border border-blue-300 bg-blue-50 p-3">
                <label className="flex items-start gap-2 text-xs text-blue-900">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={pasteChecked}
                    onChange={(e) => setPasteChecked(e.target.checked)}
                  />
                  <span>
                    The correct chart is open in Curve Hero and I matched <strong>two</strong>{" "}
                    identifiers there (for example name and date of birth). A perfect note in the
                    wrong chart is a records error this tool cannot see — only you can.
                  </span>
                </label>
                <button className="btn-primary mt-2 text-xs" onClick={copy} disabled={!pasteChecked}>
                  Copy to clipboard
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div ref={queueRef} tabIndex={-1} role="region" aria-label="Resolution queue" className="outline-none">
        {/* Byte rides the same deferred text the live check uses: one analysis
            cadence, one source of truth, zero extra keystroke cost. Read-only
            by architecture — the panel has no path into the note. "Think
            deeper" routes to the existing verified interrogate capability. */}
        <div className="mb-4 space-y-3">
          <ByteAdvisor
            text={deferredInput}
            assistEnabled={assistEnabled}
            onAskDeeper={() => runAssist("interrogate")}
          />
          {/* ByteStar is the optional pioneer. Opt-in + disclaimer live inside
              the panel; deployment gate is server-side and silent. */}
          <ByteStarAdvisor text={deferredInput} />
        </div>
        {result === null ? (
          live === null ? (
            <div className="card text-sm text-slate-600">
              <h2 className="section-title mb-1">This checks as you type</h2>
              <p>
                Start typing and this panel shows, live, what the tool would tidy and what will
                need your judgement — before you press anything. Fix something and its row
                disappears. Press <strong>Standardize</strong> when you are done to accept the
                changes item by item and unlock Copy.
              </p>
            </div>
          ) : (
            /* LIVE, AND SAYS SO. Everything here is a preview: nothing has been
               accepted, nothing can be copied, and the formal queue — with its
               attestation and escalation paths — still owns those decisions. */
            <div className="card" aria-live="polite" aria-label="Live check">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="section-title">Live check</h2>
                <span className="text-xs text-slate-500">
                  {liveLagging ? "checking…" : "updates as you type"}
                </span>
              </div>

              <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                <div className="card-inset">
                  <div className="text-xl font-bold text-brand-navy">{live.changes}</div>
                  <div className="text-xs text-slate-600">
                    wording {live.changes === 1 ? "fix" : "fixes"} ready
                  </div>
                </div>
                <div className="card-inset">
                  <div className={`text-xl font-bold ${live.blocking.length > 0 ? "text-orange-700" : "text-brand-navy"}`}>
                    {live.blocking.length}
                  </div>
                  <div className="text-xs text-slate-600">need your judgement</div>
                </div>
                <div className="card-inset">
                  <div className="text-xl font-bold text-brand-navy">{live.style}</div>
                  <div className="text-xs text-slate-600">style notes</div>
                </div>
              </div>

              {live.blocking.length > 0 ? (
                <ul className="space-y-1.5">
                  {live.blocking.slice(0, 6).map((c) => (
                    <li key={c.key} className="flex items-start gap-2 text-sm text-slate-800">
                      <span
                        className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide ${SEVERITY_CHIP[c.severity]}`}
                      >
                        {SEVERITY_LABELS[c.severity]}
                      </span>
                      <span>{c.what}</span>
                    </li>
                  ))}
                  {live.blocking.length > 6 && (
                    <li className="text-xs text-slate-500">…and {live.blocking.length - 6} more.</li>
                  )}
                </ul>
              ) : (
                <p className="text-sm text-slate-700">
                  Nothing needs your judgement so far.
                  {live.changes > 0 &&
                    ` The ${live.changes} wording ${live.changes === 1 ? "fix" : "fixes"} will be shown for your acceptance when you press Standardize.`}
                </p>
              )}

              {live.changes > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium text-slate-700">
                    Preview the standardized wording
                  </summary>
                  <TextDiff before={deferredInput} after={live.text} className="mt-2" />
                </details>
              )}

              <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
                Preview only — nothing is accepted and Copy stays locked until you press{" "}
                <strong>Standardize</strong> (Ctrl+Enter) and clear the queue.
              </p>
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div
              className={`flex items-center justify-between rounded border px-3 py-2 text-sm font-semibold ${ANDON_CLASS[light.state]}`}
              aria-live="polite"
            >
              <span>
                {light.state === "green" && (
                  <span className="sparkle-pop mr-1 text-brand-gold" aria-hidden="true">
                    ✦
                  </span>
                )}
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
                    <li key={i.concern.key} className={`rounded border px-3 py-1.5 ${SEVERITY_CLASS[i.concern.severity]}`}>
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
      className={`rounded border p-3 text-sm ${settled ? "border-green-300 bg-green-50" : SEVERITY_CLASS[concern.severity]}`}
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
