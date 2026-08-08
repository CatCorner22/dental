// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PhiOverrideDialog } from "./BuilderDialogs";
import type { AuditFinding } from "@/lib/audit/types";
import { isValidPhiAttestation } from "@/lib/audit/engine";

const stop: AuditFinding = {
  ruleId: "phi.date",
  category: "phi",
  severity: "S0",
  message: "Looks like an exact date.",
  matchedText: "03/15/2024",
  occurrences: 1
};

describe("PhiOverrideDialog — reason codes", () => {
  it("refuses Override until a code is chosen (checkbox alone is not enough)", () => {
    const onConfirm = vi.fn();
    render(
      <PhiOverrideDialog
        phiStops={[stop]}
        maskableCount={0}
        onMask={() => {}}
        onConfirm={onConfirm}
        onClose={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("checkbox"));
    const override = screen.getByRole("button", {
      name: /override this privacy stop/i
    }) as HTMLButtonElement;
    expect(override.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/phi override reason code/i), {
      target: { value: "tooth-or-site-numbers" }
    });
    expect(override.disabled).toBe(false);
    fireEvent.click(override);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const reason = String(onConfirm.mock.calls[0][0]);
    expect(reason).toMatch(/^\[tooth-or-site-numbers\]/);
    expect(isValidPhiAttestation(reason)).toBe(true);
  });
});
