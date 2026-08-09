// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ByteAskDeeper } from "./ByteAskDeeper";

// The host half of Byte's "Think deeper": one POST to /api/assist, and every
// outcome the route can return must land as VISIBLE copy — the questions, the
// deterministic-twins explanation, the privacy refusal, the throttle/off
// notices, and a network miss. A refusal the user cannot read is a bug; so is
// an affordance that renders when assist is off.

const NOTE = "Extraction of tooth 30 completed under local anesthetic today.";

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ByteAskDeeper", () => {
  it("renders no affordance when assist is disabled", () => {
    render(<ByteAskDeeper text={NOTE} assistEnabled={false} />);
    expect(screen.queryByRole("button", { name: "Think deeper" })).toBeNull();
  });

  it("renders no affordance for an empty note even when enabled", () => {
    render(<ByteAskDeeper text="" assistEnabled />);
    expect(screen.queryByRole("button", { name: "Think deeper" })).toBeNull();
  });

  it("posts interrogate with the note text and draft id, and renders the questions", async () => {
    const fetchMock = mockFetch(200, {
      text: "q1\nq2",
      items: ["Was consent documented?", "What was the anesthetic amount?"],
      capability: "interrogate",
      promptVersion: 3
    });
    render(<ByteAskDeeper text={NOTE} draftId="d-1" assistEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "Think deeper" }));
    await waitFor(() => {
      expect(screen.getByText(/What this note leaves open \(2\)/)).toBeTruthy();
    });
    expect(screen.getByText("Was consent documented?")).toBeTruthy();
    expect(screen.getByText(/Questions, never facts/)).toBeTruthy();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/assist");
    expect(JSON.parse(String(init.body))).toEqual({
      capability: "interrogate",
      text: NOTE,
      draftId: "d-1"
    });
  });

  it("shows the deterministic-twins explanation as itself, not as an error", async () => {
    mockFetch(200, {
      tier: "deterministic",
      capability: "interrogate",
      explanation: "The deterministic checks answered."
    });
    render(<ByteAskDeeper text={NOTE} assistEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "Think deeper" }));
    await waitFor(() => {
      expect(screen.getByText("The deterministic checks answered.")).toBeTruthy();
    });
  });

  it("shows the privacy refusal verbatim on phi-blocked", async () => {
    mockFetch(200, {
      ok: false,
      code: "phi-blocked",
      codes: ["phi.phone"],
      message: "The AI was not called. 1 possible identifier must be removed or masked first."
    });
    render(<ByteAskDeeper text={NOTE} assistEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "Think deeper" }));
    await waitFor(() => {
      expect(screen.getByText(/The AI was not called/)).toBeTruthy();
    });
  });

  it("shows the server's reason for off/throttle/refusal statuses", async () => {
    mockFetch(503, { error: "AI assist is not enabled on this deployment." });
    render(<ByteAskDeeper text={NOTE} assistEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "Think deeper" }));
    await waitFor(() => {
      expect(screen.getByText(/AI assist is not enabled/)).toBeTruthy();
    });
  });

  it("says so on a network miss, and the panel can be dismissed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    render(<ByteAskDeeper text={NOTE} assistEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "Think deeper" }));
    await waitFor(() => {
      expect(screen.getByText(/Could not reach the deep model/)).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/Could not reach the deep model/)).toBeNull();
  });
});
