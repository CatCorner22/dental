// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { FeedbackNotice, markFeedbackNoticeUnseen } from "./FeedbackNotice";

const SEEN_KEY = "dnb.feedback.seen.v1";

describe("FeedbackNotice — once per browser (first impression)", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("opens when the browser has not dismissed it", async () => {
    render(<FeedbackNotice enabled />);
    expect(await screen.findByRole("heading", { name: /feedback shapes/i })).toBeTruthy();
  });

  it("stays closed after Got it — and login re-arm is a no-op", async () => {
    const { unmount } = render(<FeedbackNotice enabled />);
    const gotIt = await screen.findByRole("button", { name: /got it/i });
    await act(async () => {
      gotIt.click();
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
    render(<FeedbackNotice enabled={false} />);
    await act(async () => {});
    expect(screen.queryByRole("heading", { name: /feedback shapes/i })).toBeNull();
  });
});
