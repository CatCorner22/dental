// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { TransferDraftDialog } from "./TransferDraftDialog";

describe("TransferDraftDialog — honest load states", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows Loading users… until the directory arrives", async () => {
    let resolveFetch: (v: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          })
      )
    );

    render(
      <TransferDraftDialog
        draftId="d1"
        draftTitle="Morning hygiene"
        onClose={() => {}}
        onDone={() => {}}
      />
    );

    expect(screen.getByRole("option", { name: /Loading users/i })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /^Transfer$/i }) as HTMLButtonElement).disabled
    ).toBe(true);

    await act(async () => {
      resolveFetch(
        new Response(
          JSON.stringify({
            users: [
              {
                id: "u2",
                username: "hyg.sam",
                displayName: "Sam Hyg",
                role: "user",
                clinicalRole: "hygienist",
                active: true
              },
              {
                id: "u1",
                username: "dr.lee",
                displayName: "Dr Lee",
                role: "user",
                clinicalRole: "dentist",
                active: true
              }
            ]
          }),
          { status: 200 }
        )
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /Dr Lee/i })).toBeTruthy();
    });
    expect(screen.queryByRole("option", { name: /Loading users/i })).toBeNull();
    // Dentists sort first and carry a clinical label for the handoff picker.
    const options = screen.getAllByRole("option").map((o) => o.textContent ?? "");
    const lee = options.findIndex((t) => /Dr Lee/.test(t));
    const sam = options.findIndex((t) => /Sam Hyg/.test(t));
    expect(lee).toBeGreaterThan(-1);
    expect(sam).toBeGreaterThan(-1);
    expect(lee).toBeLessThan(sam);
    expect(options[lee]).toMatch(/Dentist/i);
  });

  it("surfaces a connection error instead of an empty select", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network down")))
    );

    render(
      <TransferDraftDialog
        draftId="d1"
        draftTitle="Morning hygiene"
        onClose={() => {}}
        onDone={() => {}}
      />
    );

    expect((await screen.findByRole("alert")).textContent).toMatch(/Could not load users/i);
    expect(screen.getByRole("option", { name: /Could not load users/i })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /^Transfer$/i }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("does not treat a non-OK response as an empty user list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("{}", { status: 403 })))
    );

    render(
      <TransferDraftDialog
        draftId="d1"
        draftTitle="Morning hygiene"
        onClose={() => {}}
        onDone={() => {}}
      />
    );

    expect((await screen.findByRole("alert")).textContent).toMatch(/Could not load users/i);
  });
});
