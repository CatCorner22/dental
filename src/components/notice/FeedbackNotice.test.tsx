// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

const SEEN_KEY = "dnb.feedback.seen.v1";

// The feedback address is a deployment fact now (NEXT_PUBLIC_FEEDBACK_EMAIL),
// and both this component and lib/feedback read it at MODULE scope — so each
// case sets the environment and re-imports rather than sharing one instance.
async function load(email: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_FEEDBACK_EMAIL", email);
  return import("./FeedbackNotice");
}
const CONFIGURED = "feedback@practice.test";

describe("FeedbackNotice — once per browser (first impression)", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  it("opens when the browser has not dismissed it", async () => {
    const { FeedbackNotice } = await load(CONFIGURED);
    render(<FeedbackNotice enabled />);
    expect(await screen.findByRole("heading", { name: /feedback shapes/i })).toBeTruthy();
  });

  it("shows the configured address, not a compiled-in one", async () => {
    const { FeedbackNotice } = await load(CONFIGURED);
    render(<FeedbackNotice enabled />);
    await screen.findByRole("heading", { name: /feedback shapes/i });
    expect(screen.getByText(CONFIGURED)).toBeTruthy();
    const here = screen.getByRole("link", { name: "here" });
    expect(here.getAttribute("href")).toContain(`mailto:${CONFIGURED}`);
  });

  it("stays closed after Not now — and login re-arm is a no-op", async () => {
    const { FeedbackNotice, markFeedbackNoticeUnseen } = await load(CONFIGURED);
    const { unmount } = render(<FeedbackNotice enabled />);
    const notNow = await screen.findByRole("button", { name: /not now/i });
    await act(async () => {
      notNow.click();
    });
    expect(localStorage.getItem(SEEN_KEY)).toBe("1");
    unmount();

    // Former bug: every sign-in cleared sessionStorage and re-armed the modal.
    markFeedbackNoticeUnseen();
    expect(localStorage.getItem(SEEN_KEY)).toBe("1");

    render(<FeedbackNotice enabled />);
    await act(async () => {});
    expect(screen.queryByRole("heading", { name: /feedback shapes/i })).toBeNull();
  });

  it("does not open when disabled (e.g. notice already gated off)", async () => {
    const { FeedbackNotice } = await load(CONFIGURED);
    render(<FeedbackNotice enabled={false} />);
    await act(async () => {});
    expect(screen.queryByRole("heading", { name: /feedback shapes/i })).toBeNull();
  });

  // The whole point of this dialog is to hand someone an address. With none
  // configured it would interrupt a clinician's first sign-in to offer a dead
  // end — so it must not appear at all, rather than appear empty.
  it("never opens when no feedback address is configured", async () => {
    const { FeedbackNotice } = await load("");
    render(<FeedbackNotice enabled />);
    await act(async () => {});
    expect(screen.queryByRole("heading", { name: /feedback shapes/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /not now/i })).toBeNull();
  });
});
