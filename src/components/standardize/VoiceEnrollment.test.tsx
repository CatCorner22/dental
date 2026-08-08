// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { VoiceEnrollment } from "./VoiceEnrollment";

// The transition this file exists to guard: `supported` starts false and flips
// true in an effect once the browser reports a speech engine. That means the
// component ALWAYS renders twice on a capable browser — once down the
// unsupported branch, once down the real one — and any hook that sits below
// the `if (!supported)` early return exists on the second render and not the
// first. React refuses that ("Rendered more hooks than during the previous
// render") and unmounts the subtree, which shipped once as a crash on
// /account: the preview auto-scroll effect was added next to the <ul> it
// serves, three hundred lines below the return it never met in review.
//
// jsdom has no speech engine, so the flip never happens in a default test —
// which is exactly why no existing test caught it. Install a stub recognizer
// BEFORE render and the second pass becomes reachable.
class FakeRecognizer {
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: unknown = null;
  onerror: unknown = null;
  onend: unknown = null;
  start() {}
  stop() {}
  abort() {}
}

describe("VoiceEnrollment on a browser that has a speech engine", () => {
  afterEach(() => {
    cleanup();
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  });

  it("survives the unsupported→supported flip after mount", async () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognizer;

    render(<VoiceEnrollment username="smokeadmin" onUnlocked={() => {}} />);

    // The post-flip UI must appear. If a hook is stranded below the early
    // return, this second render throws instead and the subtree unmounts —
    // React surfaces it as an error and nothing below renders.
    expect(await screen.findByRole("button", { name: /start/i })).toBeTruthy();
    // And the unsupported copy must be gone — proof the flip actually ran and
    // the assertion above did not pass against the first render's branch.
    expect(screen.queryByText(/needs a browser with speech recognition/i)).toBeNull();
  });
});
