// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { SharedTabletIdleLock } from "./SharedTabletIdleLock";

vi.mock("@/components/shell/SignOutButton", () => ({
  SwitchAuthorButton: ({ className }: { className?: string }) => (
    <button type="button" className={className}>
      Switch author
    </button>
  )
}));

describe("SharedTabletIdleLock", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays quiet until idle, then forces an authorship choice", () => {
    vi.useFakeTimers();
    render(<SharedTabletIdleLock idleMs={1_000} displayName="amanda" />);
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/amanda/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /switch author/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /still me/i })).toBeTruthy();
  });

  it("Still me dismisses and re-arms the idle timer", () => {
    vi.useFakeTimers();
    render(<SharedTabletIdleLock idleMs={500} />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.click(screen.getByRole("button", { name: /still me/i }));
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
