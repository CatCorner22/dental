// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { PinnedMyBlocks } from "./PinnedMyBlocks";

describe("PinnedMyBlocks — always-visible chrome", () => {
  it("loads and shows insert chips without a closed disclosure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          blocks: [
            { id: 1, title: "Recall opener", body: "Patient presents for recall." },
            { id: 2, title: "LA stem", body: "Local anesthesia: <agent>." }
          ]
        })
      })
    );
    const onInsert = vi.fn();
    render(<PinnedMyBlocks canEdit onInsert={onInsert} />);
    expect(await screen.findByRole("button", { name: /recall opener/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /my blocks ▸/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /recall opener/i }));
    expect(onInsert).toHaveBeenCalledWith("Patient presents for recall.");
    vi.unstubAllGlobals();
  });

  it("renders nothing when the writer cannot edit", () => {
    const { container } = render(<PinnedMyBlocks canEdit={false} onInsert={vi.fn()} />);
    expect(container.textContent).toBe("");
  });
});
