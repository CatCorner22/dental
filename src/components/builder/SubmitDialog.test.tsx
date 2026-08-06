// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { SubmitDialog } from "./BuilderDialogs";

describe("SubmitDialog — email config honesty", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("says Email is not configured only when the server confirms it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (String(url).includes("submit-config")) {
          return Promise.resolve(
            new Response(JSON.stringify({ emailConfigured: false }), { status: 200 })
          );
        }
        return Promise.reject(new Error(`unexpected ${url}`));
      })
    );

    render(
      <SubmitDialog
        draftId="d1"
        phiOverrideReason={null}
        onClose={() => {}}
        onFiled={() => {}}
        onStartAnother={() => {}}
        onGoToDashboard={() => {}}
      />
    );

    expect(await screen.findByText(/Email is not configured on the server/i)).toBeTruthy();
    expect(screen.queryByText(/Could not reach the server/i)).toBeNull();
  });

  it("does not claim email is off when the config probe fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (String(url).includes("submit-config")) {
          return Promise.reject(new Error("offline"));
        }
        return Promise.reject(new Error(`unexpected ${url}`));
      })
    );

    render(
      <SubmitDialog
        draftId="d1"
        phiOverrideReason={null}
        onClose={() => {}}
        onFiled={() => {}}
        onStartAnother={() => {}}
        onGoToDashboard={() => {}}
      />
    );

    expect(await screen.findByText(/Could not reach the server to check email/i)).toBeTruthy();
    expect(screen.queryByText(/Email is not configured on the server/i)).toBeNull();

    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: /Submit note/i }) as HTMLButtonElement).disabled
      ).toBe(false);
    });
  });

  it("waits on Checking… until the probe settles", async () => {
    let resolveConfig: (v: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveConfig = resolve;
          })
      )
    );

    render(
      <SubmitDialog
        draftId="d1"
        phiOverrideReason={null}
        onClose={() => {}}
        onFiled={() => {}}
        onStartAnother={() => {}}
        onGoToDashboard={() => {}}
      />
    );

    expect(
      (screen.getByRole("button", { name: /Checking/i }) as HTMLButtonElement).disabled
    ).toBe(true);

    await act(async () => {
      resolveConfig(
        new Response(JSON.stringify({ emailConfigured: true }), { status: 200 })
      );
    });

    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: /Submit note/i }) as HTMLButtonElement).disabled
      ).toBe(false);
    });
  });
});
