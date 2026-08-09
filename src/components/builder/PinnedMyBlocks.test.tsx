// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { markApiReady, resetApiReady } from "@/lib/client/apiReady";

import { PinnedMyBlocks } from "./PinnedMyBlocks";

// The blocks load waits for the legal-record notice gate (see the gate tests
// below), so tests that want chips on screen open the gate first.
const ackNotice = () => act(async () => markApiReady());

beforeEach(() => {
  resetApiReady();
});
afterEach(() => {
  resetApiReady();
  vi.unstubAllGlobals();
});

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
    await ackNotice();
    expect(await screen.findByRole("button", { name: /recall opener/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /my blocks ▸/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /recall opener/i }));
    expect(onInsert).toHaveBeenCalledWith("Patient presents for recall.");
  });

  it("renders nothing when the writer cannot edit", () => {
    const { container } = render(<PinnedMyBlocks canEdit={false} onInsert={vi.fn()} />);
    expect(container.textContent).toBe("");
  });
});

// The regression these pin: this strip mounts with the builder the moment
// somebody signs in, and on a fresh session the legal-record notice gate is
// still up — every API route answers 403 until it is acknowledged. A bare
// mount fetch therefore always logged a red 403 on the first load of the app
// (the cross-browser smoke's chromium/phone leg, the only one that ever sees
// an unacknowledged notice, failed on exactly this). The fetch must wait for
// markApiReady(), like the other two components that walked into this before
// it — see src/lib/client/apiReady.ts.
describe("PinnedMyBlocks behind the notice gate", () => {
  it("does not fetch until the notice is acknowledged, then loads", async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ blocks: [{ id: 1, title: "Post-op check", body: "Healing normally." }] })
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<PinnedMyBlocks canEdit onInsert={() => {}} />);
    expect(fetchMock).not.toHaveBeenCalled();

    await ackNotice();
    expect(fetchMock).toHaveBeenCalledWith("/api/me/blocks");
    expect(await screen.findByRole("button", { name: "Post-op check" })).toBeTruthy();
  });

  it("never fetches for a read-only session, even after acknowledgment", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<PinnedMyBlocks canEdit={false} onInsert={() => {}} />);
    await ackNotice();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
