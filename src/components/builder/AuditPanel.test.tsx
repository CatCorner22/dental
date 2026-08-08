// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { AuditPanel, findingKey } from "./AuditPanel";
import type { AuditFinding, AuditReport, Severity } from "@/lib/audit/types";

// The audit panel is where a writer meets every rule the tool has, and two of
// its behaviours are safety properties rather than styling: which findings may
// be attested, and whether two findings can be told apart. Both were reasoned
// about in review and neither could be checked by anything until now.

const finding = (over: Partial<AuditFinding> = {}): AuditFinding => ({
  ruleId: "vague.tolerated-well",
  category: "vague-phrase",
  severity: "S2",
  message: '"tolerated well" is vague.',
  matchedText: "tolerated well",
  occurrences: 1,
  ...over
});

const requiredMissing = (fieldId: string): AuditFinding => ({
  ruleId: "required.missing",
  category: "required",
  severity: "S1",
  message: `"${fieldId}" is required and empty.`,
  fieldRef: { moduleId: "universal-core", fieldId },
  occurrences: 1
});

function report(findings: AuditFinding[]): AuditReport {
  const counts = { S0: 0, S1: 0, S2: 0, S3: 0, S4: 0 } as Record<Severity, number>;
  for (const f of findings) counts[f.severity] += 1;
  return {
    findings,
    counts,
    status: findings.length ? "NEEDS CLINICIAN ACTION" : "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED",
    phiStops: findings.filter((f) => f.category === "phi" && f.severity === "S0")
  };
}

const ATTEST = /this is right as written/i;
const DISAGREE = /disagree with this rule/i;

describe("what the audit panel offers per finding", () => {
  it("never offers an attestation on a missing required field", () => {
    // THE one that matters. The server re-runs computeGates at submit and
    // returns 422 on any open S1, so an attestation here would let someone
    // write a reason, watch the row settle, press Submit and be refused. The
    // field is empty; the only thing that resolves it is filling it in.
    render(
      <AuditPanel
        report={report([requiredMissing("visit-purpose")])}
        onAttest={() => {}}
        onEscalate={() => {}}
      />
    );
    expect(screen.queryByRole("button", { name: ATTEST })).toBeNull();
  });

  it("never offers an attestation on a STOP", () => {
    // A wrong site or an identifier is not made right by explaining it, and the
    // PHI stop has its own attested path with a signed record behind it.
    render(
      <AuditPanel
        report={report([finding({ severity: "S0", ruleId: "anatomy.wrong-site", category: "anatomy" })])}
        onAttest={() => {}}
        onEscalate={() => {}}
      />
    );
    expect(screen.queryByRole("button", { name: ATTEST })).toBeNull();
  });

  it("does offer one on an advisory finding", () => {
    render(<AuditPanel report={report([finding()])} onAttest={() => {}} onEscalate={() => {}} />);
    expect(screen.getByRole("button", { name: ATTEST })).toBeTruthy();
  });

  it("never offers to escalate a PHI catch", () => {
    // Escalating copies the finding into a wish a Team Lead reads on another
    // screen. For a PHI hit that would move the flagged fragment somewhere new.
    render(
      <AuditPanel
        report={report([finding({ category: "phi", severity: "S2", ruleId: "phi.bare-name" })])}
        onAttest={() => {}}
        onEscalate={() => {}}
      />
    );
    expect(screen.queryByRole("button", { name: DISAGREE })).toBeNull();
  });

  it("offers nothing to resolve when the panel is read-only", () => {
    // canEdit false means no handlers are passed. A read-only viewer must not
    // be shown controls that cannot do anything.
    render(<AuditPanel report={report([finding()])} />);
    expect(screen.queryByRole("button", { name: ATTEST })).toBeNull();
    expect(screen.queryByRole("button", { name: DISAGREE })).toBeNull();
  });

  it("shows a recorded attestation instead of asking again", () => {
    const f = finding();
    render(
      <AuditPanel
        report={report([f])}
        attestations={{ [findingKey(f)]: "The patient was asked and reported no discomfort." }}
        onAttest={() => {}}
        onEscalate={() => {}}
      />
    );
    expect(screen.getByText(/asked and reported no discomfort/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: ATTEST })).toBeNull();
  });

  it("requires a reason code before Record it, and stores the coded reason", () => {
    const onAttest = vi.fn();
    render(<AuditPanel report={report([finding()])} onAttest={onAttest} onEscalate={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: ATTEST }));
    const record = screen.getByRole("button", { name: /record it/i }) as HTMLButtonElement;
    expect(record.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/attestation reason code/i), {
      target: { value: "correct-as-written" }
    });
    expect(record.disabled).toBe(false);
    fireEvent.click(record);
    expect(onAttest).toHaveBeenCalledTimes(1);
    const [, reason] = onAttest.mock.calls[0];
    expect(String(reason)).toMatch(/^\[correct-as-written\]/);
  });
});

describe("telling two findings apart", () => {
  it("gives required-missing findings in different fields different keys", () => {
    // required.missing carries no matched text. Keyed on the rule alone, every
    // one of a note's thirteen was the same row — and resolving any one of them
    // resolved all thirteen.
    const a = requiredMissing("visit-purpose");
    const b = requiredMissing("diagnosis");
    expect(findingKey(a)).not.toBe(findingKey(b));
  });

  it("renders one row per required field rather than collapsing them", () => {
    render(
      <AuditPanel
        report={report([requiredMissing("visit-purpose"), requiredMissing("diagnosis")])}
        onAttest={() => {}}
        onEscalate={() => {}}
      />
    );
    expect(screen.getAllByText(/is required and empty/)).toHaveLength(2);
  });

  it("attests one finding without touching its neighbour", () => {
    const a = requiredMissing("visit-purpose");
    const b = finding();
    render(
      <AuditPanel
        report={report([a, b])}
        attestations={{ [findingKey(b)]: "Recorded against the other one only." }}
        onAttest={() => {}}
        onEscalate={() => {}}
      />
    );
    expect(screen.getAllByText(/Recorded against the other one only/)).toHaveLength(1);
  });
});

describe("the clean state", () => {
  it("celebrates without claiming the note is signed off", () => {
    // A clean deterministic checker is not a reviewed note, and this is the
    // last place that distinction can be blurred.
    render(<AuditPanel report={report([])} />);
    expect(screen.getByText(/Sparkle says:/)).toBeTruthy();
    expect(screen.getByText(/licensed clinician still compares every fact/i)).toBeTruthy();
  });
});

describe("jumping to a field", () => {
  it("opens a collapsed section before scrolling to the field inside it", () => {
    // Sections collapse now. scrollIntoView on a hidden element scrolls
    // nowhere and focus() does nothing, so without opening the ancestors first
    // the jump silently fails — on exactly the findings a writer needs most.
    const host = document.createElement("div");
    host.innerHTML = `
      <details id="sect">
        <summary>Visit</summary>
        <div id="field-universal-core-visit-purpose"><input /></div>
      </details>`;
    document.body.appendChild(host);
    const details = host.querySelector("details")!;
    const input = host.querySelector("input")!;
    input.scrollIntoView = vi.fn();
    (host.querySelector("#field-universal-core-visit-purpose") as HTMLElement).scrollIntoView =
      vi.fn();
    expect(details.open).toBe(false);

    render(<AuditPanel report={report([requiredMissing("visit-purpose")])} />);
    screen.getByRole("button", { name: /go to field/i }).click();

    expect(details.open).toBe(true);
    expect(document.activeElement).toBe(input);
    host.remove();
  });

  // The row is clickable when the finding has a fieldRef, and every resolution
  // control sits INSIDE that row. Nothing here stopped the click bubbling, so
  // pressing "This is right as written" also fired the jump — which on a phone
  // closes the audit sheet the form just opened inside, and on desktop yanks
  // focus into the note field mid-sentence.
  //
  // Nothing caught it because the two halves never met in a fixture: the
  // `finding()` factory has no fieldRef, so its rows were not clickable, and
  // `requiredMissing()` has one but is deliberately not attestable. The
  // combination below — attestable AND field-linked — is what every real
  // spelling, plain-language and measurement finding actually looks like.
  it("does not jump when a resolution control inside a field-linked row is used", () => {
    const onJump = vi.fn();
    const linked = finding({ fieldRef: { moduleId: "universal-core", fieldId: "visit-purpose" } });

    render(
      <AuditPanel
        report={report([linked])}
        onAttest={() => {}}
        onEscalate={() => {}}
        onJump={onJump}
      />
    );

    // fireEvent, not node.click(): the assertion below depends on React having
    // re-rendered with the reason form open, and a bare DOM click is not
    // wrapped in act() so that state update has not flushed yet.
    fireEvent.click(screen.getByRole("button", { name: ATTEST }));

    // The reason form opened, and the row did not also try to navigate away.
    expect(screen.getByLabelText(/attestation reason code/i)).toBeTruthy();
    expect(screen.getByLabelText(/optional attestation detail/i)).toBeTruthy();
    expect(onJump).not.toHaveBeenCalled();

    // The jump button still jumps — attest controls are siblings, not nested
    // under the row click target (Honest Finish a11y).
    fireEvent.click(screen.getByText(linked.message));
    expect(onJump).toHaveBeenCalledTimes(1);
  });

  it("exposes a keyboard-reachable Go to field control (Honest Finish a11y)", () => {
    const onJump = vi.fn();
    const linked = finding({
      fieldRef: { moduleId: "universal-core", fieldId: "visit-purpose" },
      message: "Vague phrase in visit purpose."
    });
    render(
      <AuditPanel report={report([linked])} onAttest={() => {}} onEscalate={() => {}} onJump={onJump} />
    );
    // Real <button>, not a mouse-only <li> — Enter/Space are native button activation.
    const row = screen.getByRole("button", { name: /Go to field: Review/i });
    fireEvent.click(row);
    expect(onJump).toHaveBeenCalledTimes(1);
  });
});
