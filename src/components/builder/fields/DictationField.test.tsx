// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { DictationField, DictationUserContext, type DictationUser } from "./DictationField";

// WHY THERE IS NO MICROPHONE — answered, at the point of writing.
//
// This component used to return null in every case except "enrolled and
// supported". The note page therefore contained no microphone and never said
// the word dictation, so somebody who wanted to talk to the app could not
// discover that the feature existed, where to set it up, or why it was absent.
//
// The rule now: always have an answer, and only show it where the cursor is.

const USER = (over: Partial<DictationUser> = {}): DictationUser => ({
  username: "amanda",
  enrolled: false,
  region: null,
  ...over
});

function setEnvironment({
  secure = true,
  engine = true
}: { secure?: boolean; engine?: boolean } = {}) {
  Object.defineProperty(window, "isSecureContext", { value: secure, configurable: true });
  const w = window as unknown as { SpeechRecognition?: unknown };
  if (engine) w.SpeechRecognition = function Fake() {} as unknown;
  else delete w.SpeechRecognition;
}

function renderField(user: DictationUser, active = true, focused = active) {
  return render(
    <DictationUserContext.Provider value={user}>
      <DictationField onText={vi.fn()} active={active} focused={focused} />
    </DictationUserContext.Provider>
  );
}

afterEach(() => {
  const w = window as unknown as { SpeechRecognition?: unknown };
  delete w.SpeechRecognition;
});

describe("when dictation is set up", () => {
  it("offers the microphone", () => {
    setEnvironment();
    renderField(USER({ enrolled: true, region: "general" }));
    expect(screen.getByRole("button", { name: /dictate/i })).toBeTruthy();
  });

  it("offers no setup prompt to somebody who has already done it", () => {
    setEnvironment();
    renderField(USER({ enrolled: true }));
    expect(screen.queryByRole("button", { name: /set up dictation here/i })).toBeNull();
  });
});

describe("when it is not set up yet", () => {
  it("offers inline setup here — not an Account pilgrimage", () => {
    // Honest Finish / RSI hate: leaving the note mid-chair to enroll was the
    // discovery hole. Silence was worse; /account-only was the next failure.
    setEnvironment();
    renderField(USER());
    expect(screen.getByRole("button", { name: /set up dictation here/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /set up dictation/i })).toBeNull();
  });

  it("says how long it takes, because that is the question", () => {
    setEnvironment();
    renderField(USER());
    expect(screen.getByText(/ninety seconds, once/i)).toBeTruthy();
  });

  it("stays out of the way of a field the cursor is not in", () => {
    // Eleven sections each repeating the same offer is the clutter this app
    // has spent its whole redesign removing.
    setEnvironment();
    renderField(USER(), false);
    expect(screen.queryByRole("button", { name: /set up dictation here/i })).toBeNull();
  });
});

describe("when the browser or the page cannot do it", () => {
  it("blames the connection rather than a microphone permission", () => {
    // The bug this replaces: Chrome exposes the recognizer on plain http, then
    // refuses to start with `not-allowed`, which was reported as a blocked
    // permission — a permission no amount of clicking could have granted.
    setEnvironment({ secure: false });
    renderField(USER({ enrolled: true }));
    expect(screen.getByText(/secure \(https\) connection/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /dictate/i })).toBeNull();
  });

  it("names the browsers that work", () => {
    // Firefox ships no SpeechRecognition, and used to produce silence.
    setEnvironment({ engine: false });
    renderField(USER({ enrolled: true }));
    expect(screen.getByText(/Chrome, Edge and Safari/)).toBeTruthy();
  });

  it("explains itself even to somebody who is already enrolled", () => {
    // Set it up on your own laptop, then open the front-desk machine: the
    // account says ready, the browser cannot, and the mismatch needs a reason.
    setEnvironment({ engine: false });
    renderField(USER({ enrolled: true }));
    expect(screen.queryByRole("button", { name: /dictate/i })).toBeNull();
    expect(screen.getByText(/cannot do speech recognition/i)).toBeTruthy();
  });
});

describe("when there is nobody to dictate for", () => {
  it("renders nothing at all without a signed-in user", () => {
    setEnvironment();
    const { container } = renderField(USER({ username: "" }));
    expect(container.textContent).toBe("");
  });
});

// A CONTROL CAN STAY WHERE THE WORK IS. AN EXPLANATION CANNOT.
//
// `active` used to be one flag meaning "focused or already has content", and it
// governed both the microphone and the prose beside it. That flag never goes
// false again once somebody has written a sentence, so the twenty-word setup
// offer was repeated under every filled box — five copies in the narrative
// alone, all identical, none of them news. Seen on a running build, which is
// what prompted splitting the two.
describe("the sentence goes away, the button does not", () => {
  it("keeps the microphone in a box that has words but no cursor", () => {
    setEnvironment();
    renderField(USER({ enrolled: true, region: "general" }), true, false);
    expect(screen.getByRole("button", { name: /dictate/i })).toBeTruthy();
  });

  it("drops the setup offer from a box that has words but no cursor", () => {
    setEnvironment();
    renderField(USER(), true, false);
    expect(screen.queryByRole("button", { name: /set up dictation here/i })).toBeNull();
  });

  it("drops the cannot-do-this explanation there too", () => {
    setEnvironment({ engine: false });
    renderField(USER({ enrolled: true }), true, false);
    expect(screen.queryByText(/cannot do speech recognition/i)).toBeNull();
  });

  it("shows nothing at all in a box nobody has been in", () => {
    setEnvironment();
    const { container } = renderField(USER({ enrolled: true, region: "general" }), false, false);
    expect(container.textContent).toBe("");
  });
});
