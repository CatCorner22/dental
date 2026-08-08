// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ApplyWithReadback } from "./ReadbackConfirm";

describe("ApplyWithReadback — scoped safety confirm", () => {
  it("blocks Apply when laterality flips until tokens are confirmed", () => {
    const onApply = vi.fn();
    render(
      <ApplyWithReadback
        before="Lower left molar restored."
        after="Lower right molar restored."
        applyLabel="Apply this wording"
        onApply={onApply}
        onKeep={() => {}}
      />
    );
    expect(screen.getByTestId("readback-confirm")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /apply this wording/i }) as HTMLButtonElement).disabled
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /apply this wording/i }));
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("readback-ack"));
    expect(
      (screen.getByRole("button", { name: /apply this wording/i }) as HTMLButtonElement).disabled
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /apply this wording/i }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("Keep mine stays free even when readback is required", () => {
    const onKeep = vi.fn();
    render(
      <ApplyWithReadback
        before="Tooth 19 restored."
        after="Tooth 18 restored."
        applyLabel="Apply this wording"
        onApply={() => {}}
        onKeep={onKeep}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /keep mine/i }));
    expect(onKeep).toHaveBeenCalledTimes(1);
  });

  it("wording-only rewrites stay one-click (no readback gate)", () => {
    const onApply = vi.fn();
    render(
      <ApplyWithReadback
        before="pt tolerated the procedure well."
        after="The patient tolerated the procedure well."
        applyLabel="Apply this wording"
        onApply={onApply}
        onKeep={() => {}}
      />
    );
    expect(screen.queryByTestId("readback-confirm")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /apply this wording/i }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});
