// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { SubmitDialog } from "./BuilderDialogs";
import type { CheckNoteSummary } from "@/lib/status/checkNoteSummary";

const cleanCheckNote: CheckNoteSummary = {
  moduleTitles: ["Universal Core"],
  killers: [],
  openStops: [],
  omissionCount: 0,
  killersBlockHandoff: false
};

const sparseCheckNote: CheckNoteSummary = {
  moduleTitles: ["Universal Core"],
  killers: [
    {
      ruleId: "complete.anesthetic-no-amount",
      category: "required",
      severity: "S2",
      message: "Anesthetic without amount."
    }
  ],
  openStops: [],
  omissionCount: 0,
  killersBlockHandoff: true
};

function renderSubmit(checkNote: CheckNoteSummary = cleanCheckNote) {
  return render(
    <SubmitDialog
      draftId="d1"
      phiOverrideReason={null}
      checkNote={checkNote}
      onChangeFinding={() => {}}
      onClose={() => {}}
      onFiled={() => {}}
      onStartAnother={() => {}}
      onGoToDashboard={() => {}}
    />
  );
}

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

    renderSubmit();

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

    renderSubmit();

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

    renderSubmit();
    expect(screen.getByRole("button", { name: /Checking/i })).toBeTruthy();

    await act(async () => {
      resolveConfig(new Response(JSON.stringify({ emailConfigured: true }), { status: 200 }));
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Submit note/i })).toBeTruthy();
    });
  });
});

describe("SubmitDialog — Check your note killer gate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps Submit disabled while litigation killers remain open (no checkbox escape)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (String(url).includes("submit-config")) {
          return Promise.resolve(
            new Response(JSON.stringify({ emailConfigured: true }), { status: 200 })
          );
        }
        return Promise.reject(new Error(`unexpected ${url}`));
      })
    );

    renderSubmit(sparseCheckNote);
    expect(await screen.findByText(/Anesthetic amount missing/i)).toBeTruthy();
    expect(screen.getByTestId("check-note-killers-block")).toBeTruthy();
    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: /Submit note/i }) as HTMLButtonElement).disabled
      ).toBe(true);
    });
  });
});
