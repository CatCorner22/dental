// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CheckNoteSummaryPanel } from "./CheckNoteSummary";
import type { CheckNoteSummary } from "@/lib/status/checkNoteSummary";
import type { AuditFinding } from "@/lib/audit/types";

const anestheticKiller: AuditFinding = {
  ruleId: "complete.anesthetic-no-amount",
  category: "required",
  severity: "S2",
  message: "Anesthetic without amount.",
  suggestion: "Record the agent and amount."
};

const cleanSummary: CheckNoteSummary = {
  moduleTitles: ["Universal Core"],
  killers: [],
  openStops: [],
  omissionCount: 0,
  requiresKillerAck: false
};

const sparseSummary: CheckNoteSummary = {
  moduleTitles: ["Universal Core", "Preventive"],
  killers: [anestheticKiller],
  openStops: [],
  omissionCount: 0,
  requiresKillerAck: true
};

describe("CheckNoteSummaryPanel — finish gate", () => {
  it("MedPro-sparse note shows killer and requires ack checkbox", () => {
    const onAck = vi.fn();
    render(
      <CheckNoteSummaryPanel
        summary={sparseSummary}
        killersAcknowledged={false}
        onKillersAcknowledged={onAck}
        onChangeFinding={() => {}}
      />
    );
    expect(screen.getByText(/Anesthetic amount missing/i)).toBeTruthy();
    expect(screen.getByTestId("check-note-killer-ack")).toBeTruthy();
    expect(screen.getByText(/Universal Core · Preventive/)).toBeTruthy();
  });

  it("Change fires for a killer without inventing clinical content", () => {
    const onChange = vi.fn();
    render(
      <CheckNoteSummaryPanel
        summary={sparseSummary}
        killersAcknowledged={false}
        onKillersAcknowledged={() => {}}
        onChangeFinding={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^Change$/i }));
    expect(onChange).toHaveBeenCalledWith(anestheticKiller);
  });

  it("clean note has no killer ack checkbox", () => {
    render(
      <CheckNoteSummaryPanel
        summary={cleanSummary}
        killersAcknowledged={false}
        onKillersAcknowledged={() => {}}
        onChangeFinding={() => {}}
      />
    );
    expect(screen.queryByTestId("check-note-killer-ack")).toBeNull();
    expect(screen.getByText(/No litigation-sensitive gaps/i)).toBeTruthy();
  });
});
