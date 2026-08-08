// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { BLOCK_BY_ID } from "@/lib/phrases/blocks";
import { FastLanePackOffer } from "./FastLanePackOffer";

const la = BLOCK_BY_ID.get("local-anesthetic")!;
const consent = BLOCK_BY_ID.get("consent-conversation")!;

describe("FastLanePackOffer — no silent dump", () => {
  it("asks before showing assertion panels — nothing inserted on mount", () => {
    const onInsert = vi.fn();
    const onDismiss = vi.fn();
    render(
      <FastLanePackOffer
        packTitles={["Restorative"]}
        blocks={[la, consent]}
        onDismiss={onDismiss}
        onInsert={onInsert}
      />
    );
    expect(screen.getByText(/offer pack starters/i)).toBeTruthy();
    expect(screen.queryByText(/confirm each statement/i)).toBeNull();
    expect(onInsert).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("Not now dismisses without writing", () => {
    const onInsert = vi.fn();
    const onDismiss = vi.fn();
    render(
      <FastLanePackOffer
        packTitles={["Restorative"]}
        blocks={[la]}
        onDismiss={onDismiss}
        onInsert={onInsert}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /not now/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onInsert).not.toHaveBeenCalled();
  });

  it("Yes reveals BlockRows but still does not insert until attest", () => {
    const onInsert = vi.fn();
    render(
      <FastLanePackOffer
        packTitles={["Restorative"]}
        blocks={[la]}
        onDismiss={vi.fn()}
        onInsert={onInsert}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /yes — show starters/i }));
    expect(screen.getByText(/local anesthetic/i)).toBeTruthy();
    expect(screen.getByText(/confirm each statement/i)).toBeTruthy();
    // Open the row — Insert stays disabled without checkboxes.
    fireEvent.click(screen.getByRole("button", { name: /local anesthetic record/i }));
    const insertBtn = screen.getByRole("button", { name: /confirm every statement to insert/i });
    expect((insertBtn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(insertBtn);
    expect(onInsert).not.toHaveBeenCalled();
  });

  it("inserts only after every assertion is checked", () => {
    const onInsert = vi.fn();
    render(
      <FastLanePackOffer
        packTitles={["Restorative"]}
        blocks={[la]}
        onDismiss={vi.fn()}
        onInsert={onInsert}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /yes — show starters/i }));
    fireEvent.click(screen.getByRole("button", { name: /local anesthetic record/i }));
    const boxes = screen.getAllByRole("checkbox");
    for (const box of boxes) fireEvent.click(box);
    fireEvent.click(screen.getByRole("button", { name: /insert into note/i }));
    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert.mock.calls[0]?.[0]).toBe("local-anesthetic");
    expect(String(onInsert.mock.calls[0]?.[1])).toContain("<");
  });

  it("renders nothing when the block list is empty", () => {
    const { container } = render(
      <FastLanePackOffer packTitles={[]} blocks={[]} onDismiss={vi.fn()} onInsert={vi.fn()} />
    );
    expect(container.textContent).toBe("");
  });
});
