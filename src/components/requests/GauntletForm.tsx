"use client";

import { useMemo, useState } from "react";
import {
  CHECKLIST,
  CYCLES,
  DOWNSTREAM_MODULES,
  evaluateGauntlet,
  type ChecklistId,
  type CycleId,
  type GauntletAnswers
} from "@/lib/requests/gauntlet";

const CHANGE_TYPES = [
  { value: "add", label: "Add something new" },
  { value: "modify", label: "Change something that exists" },
  { value: "remove", label: "Remove something" },
  { value: "dependency", label: "Change how things connect" }
];

const emptyAnswers = Object.fromEntries(CYCLES.map((c) => [c.id, ""])) as Record<CycleId, string>;
const emptyChecklist = Object.fromEntries(CHECKLIST.map((c) => [c.id, false])) as Record<
  ChecklistId,
  boolean
>;

export function GauntletForm({ initialSummary = "" }: { initialSummary?: string }) {
  const [step, setStep] = useState(0); // 0..4 cycles, 5 = pre-flight, 6 = report
  const [form, setForm] = useState<GauntletAnswers>({
    // Pre-filled from the digest's evidence when the request starts there —
    // the writer still walks every sterilization cycle by hand.
    summary: initialSummary,
    changeType: "",
    answers: emptyAnswers,
    checklist: emptyChecklist,
    dataOwner: "",
    downstream: []
  });
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState("");
  const [sentTicket, setSentTicket] = useState<string | null>(null);
  const [fallbackTicket, setFallbackTicket] = useState<string | null>(null);

  // The identical function the server runs. Showing the verdict live is a
  // courtesy; the server re-runs it and is the actual gate.
  const verdict = useMemo(() => evaluateGauntlet(form), [form]);

  const setAnswer = (id: CycleId, value: string) =>
    setForm((f) => ({ ...f, answers: { ...f.answers, [id]: value } }));

  if (sentTicket) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border-2 border-green-400 bg-green-50 p-4">
          <p className="text-base font-bold text-green-900">Sterile — sent to the Smile Notes Team</p>
          <p className="mt-1 text-sm text-green-900">
            Your request cleared all five cycles and is on its way. Keep a copy below for your own
            records.
          </p>
        </div>
        <TicketBlock text={sentTicket} />
      </div>
    );
  }

  const cycle = CYCLES[step];
  const cycleVerdict = cycle ? verdict.cycles.find((c) => c.id === cycle.id) : undefined;
  const answered = cycle ? (form.answers[cycle.id] ?? "").trim().length > 0 : true;

  const submit = async () => {
    setSending(true);
    setServerError("");
    setFallbackTicket(null);
    try {
      const res = await fetch("/api/change-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ticket?: string;
        error?: string;
      };
      if (res.ok && data.ok) {
        setSentTicket(data.ticket ?? "");
        return;
      }
      setServerError(data.error ?? "Could not send the request.");
      // On a delivery failure the server hands back the composed ticket so
      // nothing typed is lost — show it rather than swallowing it.
      if (data.ticket) setFallbackTicket(data.ticket);
    } catch {
      setServerError("Could not reach the server — check the connection and try again.");
    }
    setSending(false);
  };

  return (
    <div className="space-y-4">
      {/* Progress across the five cycles */}
      <ol className="flex flex-wrap gap-1.5" aria-label="Sterilization cycles">
        {CYCLES.map((c, i) => {
          const v = verdict.cycles.find((x) => x.id === c.id)!;
          const touched = (form.answers[c.id] ?? "").trim().length > 0;
          const state = v.sterile ? "sterile" : touched ? "contaminated" : "empty";
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={step === i ? "step" : undefined}
                className={`tap rounded-full border px-3 text-xs font-semibold ${
                  step === i ? "ring-2 ring-brand-blue ring-offset-1 " : ""
                }${
                  state === "sterile"
                    ? "border-green-400 bg-green-100 text-green-900"
                    : state === "contaminated"
                      ? "border-rose-400 bg-rose-100 text-rose-900"
                      : "border-slate-300 bg-white text-slate-600"
                }`}
              >
                {state === "sterile" ? "✓" : state === "contaminated" ? "!" : "○"} Cycle {c.n}
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => setStep(5)}
            aria-current={step === 5 ? "step" : undefined}
            className={`tap rounded-full border px-3 text-xs font-semibold ${
              step === 5 ? "ring-2 ring-brand-blue ring-offset-1 " : ""
            }${
              verdict.general.length === 0
                ? "border-green-400 bg-green-100 text-green-900"
                : "border-slate-300 bg-white text-slate-600"
            }`}
          >
            Pre-flight
          </button>
        </li>
      </ol>

      {cycle && (
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Cycle {cycle.n} of 5
          </p>
          <h2 className="mb-1 text-lg font-bold">{cycle.title}</h2>
          <p className="mb-3 text-sm text-slate-700">{cycle.prompt}</p>

          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <p className="rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900">
              <span className="font-bold">✕ Contaminated: </span>
              {cycle.contaminated}
            </p>
            <p className="rounded border border-green-300 bg-green-50 p-2 text-xs text-green-900">
              <span className="font-bold">✓ Sterile: </span>
              {cycle.sterile}
            </p>
          </div>

          <label className="field-label" htmlFor={`cycle-${cycle.id}`}>
            Your answer
          </label>
          <textarea
            id={`cycle-${cycle.id}`}
            className="field-input min-h-32"
            value={form.answers[cycle.id] ?? ""}
            onChange={(e) => setAnswer(cycle.id, e.target.value)}
            aria-invalid={answered && !cycleVerdict?.sterile ? true : undefined}
          />

          {answered && cycleVerdict && !cycleVerdict.sterile && (
            <ul className="mt-2 space-y-1" role="alert">
              {cycleVerdict.problems.map((p) => (
                <li key={p} className="text-xs font-medium text-rose-800">
                  ✕ {p}
                </li>
              ))}
            </ul>
          )}
          {cycleVerdict?.sterile && (
            <p className="mt-2 text-xs font-semibold text-green-800">
              ✓ Cycle {cycle.n} is sterile.
            </p>
          )}

          <div className="mt-4 flex flex-wrap justify-between gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Back
            </button>
            <button type="button" className="btn-primary" onClick={() => setStep((s) => s + 1)}>
              {step === 4 ? "Pre-flight checklist" : "Next cycle"}
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <PreFlight form={form} setForm={setForm} onBack={() => setStep(4)} onNext={() => setStep(6)} />
      )}

      {step === 6 && (
        <SterilizationReport
          verdict={verdict}
          sending={sending}
          serverError={serverError}
          fallbackTicket={fallbackTicket}
          onBack={() => setStep(5)}
          onFix={(id) => setStep(CYCLES.findIndex((c) => c.id === id))}
          onSubmit={submit}
        />
      )}
    </div>
  );
}

function PreFlight({
  form,
  setForm,
  onBack,
  onNext
}: {
  form: GauntletAnswers;
  setForm: React.Dispatch<React.SetStateAction<GauntletAnswers>>;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="card">
      <h2 className="mb-1 text-lg font-bold">Pre-flight checklist</h2>
      <p className="mb-3 text-sm text-slate-700">
        Confirm each of these before the request may be sent.
      </p>

      <div className="space-y-2">
        {CHECKLIST.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer gap-2 rounded border border-slate-200 p-2 hover:bg-slate-50"
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-blue"
              checked={form.checklist[item.id]}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  checklist: { ...f.checklist, [item.id]: e.target.checked }
                }))
              }
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-800">{item.label}</span>
              <span className="block text-xs text-slate-600">{item.detail}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className="field-label" htmlFor="pf-owner">
            Who owns this data&apos;s quality?
          </label>
          <input
            id="pf-owner"
            className="field-input"
            value={form.dataOwner}
            onChange={(e) => setForm((f) => ({ ...f, dataOwner: e.target.value }))}
            placeholder="Name and role"
          />
        </div>

        <fieldset>
          <legend className="field-label">Which modules does this touch?</legend>
          <div className="flex flex-wrap gap-1.5">
            {DOWNSTREAM_MODULES.map((m) => {
              const on = form.downstream.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      downstream: on ? f.downstream.filter((x) => x !== m) : [...f.downstream, m]
                    }))
                  }
                  className={`tap rounded-full border px-3 text-xs font-medium ${
                    on
                      ? "border-brand-blue bg-brand-blue text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-brand-blue/10"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label className="field-label" htmlFor="pf-type">
            What kind of change is this?
          </label>
          <select
            id="pf-type"
            className="field-input"
            value={form.changeType}
            onChange={(e) => setForm((f) => ({ ...f, changeType: e.target.value }))}
          >
            <option value="">Choose…</option>
            {CHANGE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="pf-summary">
            The ask, in one line
          </label>
          <input
            id="pf-summary"
            className="field-input"
            value={form.summary}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            placeholder="e.g. Add an implant torque value to the surgical Smile Note"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <button type="button" className="btn-secondary" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn-primary" onClick={onNext}>
          Sterilization report
        </button>
      </div>
    </div>
  );
}

function SterilizationReport({
  verdict,
  sending,
  serverError,
  fallbackTicket,
  onBack,
  onFix,
  onSubmit
}: {
  verdict: ReturnType<typeof evaluateGauntlet>;
  sending: boolean;
  serverError: string;
  fallbackTicket: string | null;
  onBack: () => void;
  onFix: (id: CycleId) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="card">
      <h2 className="mb-1 text-lg font-bold">Sterilization report</h2>
      <p className="mb-3 text-sm text-slate-700">
        {verdict.sterile
          ? "Every cycle is clear. This request may be sent to the Smile Notes Team."
          : "This request is still contaminated. Fix each item below — it cannot be sent until every cycle clears."}
      </p>

      <ul className="space-y-2">
        {verdict.cycles.map((c) => (
          <li
            key={c.id}
            className={`rounded border p-2 ${
              c.sterile ? "border-green-300 bg-green-50" : "border-rose-300 bg-rose-50"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`text-sm font-bold ${c.sterile ? "text-green-900" : "text-rose-900"}`}
              >
                {c.sterile ? "✓" : "✕"} Cycle {c.n} — {c.title}
              </span>
              {!c.sterile && (
                <button type="button" className="tap rounded px-2 text-xs underline" onClick={() => onFix(c.id)}>
                  Fix this cycle
                </button>
              )}
            </div>
            {!c.sterile && (
              <ul className="mt-1 space-y-0.5">
                {c.problems.map((p) => (
                  <li key={p} className="text-xs text-rose-800">
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {verdict.general.length > 0 && (
        <div className="mt-2 rounded border border-rose-300 bg-rose-50 p-2">
          <p className="text-sm font-bold text-rose-900">✕ Pre-flight</p>
          <ul className="mt-1 space-y-0.5">
            {verdict.general.map((g) => (
              <li key={g} className="text-xs text-rose-800">
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}

      {serverError && (
        <p className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-sm text-rose-900" role="alert">
          {serverError}
        </p>
      )}
      {fallbackTicket && <TicketBlock text={fallbackTicket} />}

      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <button type="button" className="btn-secondary" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!verdict.sterile || sending}
          title={verdict.sterile ? undefined : "Every cycle must clear first"}
          onClick={onSubmit}
        >
          {sending ? "Sending…" : "Send to the Smile Notes Team"}
        </button>
      </div>
    </div>
  );
}

function TicketBlock({ text }: { text: string }) {
  return (
    <div className="mt-3">
      <p className="field-label">Your request</p>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded border border-slate-300 bg-slate-50 p-3 text-xs text-slate-800">
        {text}
      </pre>
    </div>
  );
}
