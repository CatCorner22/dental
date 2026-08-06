import { describe, expect, it } from "vitest";

import {
  availabilityMessage,
  dictationAvailability,
  type DictationEnvironment
} from "./availability";

// The two silent failures this replaces:
//
//  - an insecure origin, where Chrome exposes the constructor and then refuses
//    to start, and the writer was told a microphone permission was blocked;
//  - Firefox, which has no engine at all, where the button simply never
//    appeared and the feature looked broken rather than absent.
//
// Both now produce a reason a person can act on, and the order of precedence
// is itself a decision worth pinning.

const env = (over: Partial<DictationEnvironment> = {}): DictationEnvironment => ({
  disabled: false,
  secureContext: true,
  hasEngine: true,
  ...over
});

describe("when a microphone can be offered", () => {
  it("is ready on a secure page in a browser with an engine", () => {
    expect(dictationAvailability(env())).toEqual({ status: "ready" });
  });

  it("says nothing when it is ready", () => {
    // A working feature does not need to explain itself.
    expect(availabilityMessage({ status: "ready" })).toBe("");
  });
});

describe("when it cannot", () => {
  it("names the practice's own off-switch first", () => {
    // THE precedence that matters. When a practice has turned dictation off,
    // telling somebody their browser is wrong sends them to fix a problem that
    // is not theirs and cannot be fixed from where they are standing.
    const off = dictationAvailability(env({ disabled: true, secureContext: false, hasEngine: false }));
    expect(off).toEqual({ status: "disabled" });
    expect(availabilityMessage(off)).toMatch(/switched off for this practice/i);
  });

  it("blames the connection, not a microphone permission", () => {
    // The bug being fixed. Chrome exposes webkitSpeechRecognition on plain
    // http and then refuses to start with `not-allowed`, which the UI reported
    // as a blocked permission — a permission no amount of clicking could grant.
    const insecure = dictationAvailability(env({ secureContext: false }));
    expect(insecure).toEqual({ status: "insecure" });
    expect(availabilityMessage(insecure)).toMatch(/secure \(https\) connection/i);
    expect(availabilityMessage(insecure)).not.toMatch(/permission/i);
  });

  it("puts the connection ahead of engine support", () => {
    // An insecure origin can hide engine support that is really there, so
    // "your browser cannot do this" would be a false statement about a browser
    // that can.
    expect(dictationAvailability(env({ secureContext: false, hasEngine: false }))).toEqual({
      status: "insecure"
    });
  });

  it("names browsers that work rather than saying it is unavailable", () => {
    const none = dictationAvailability(env({ hasEngine: false }));
    expect(none).toEqual({ status: "unsupported" });
    // "Not available" tells a person nothing they can use.
    expect(availabilityMessage(none)).toMatch(/Chrome, Edge and Safari/);
  });
});

describe("before anything has been measured", () => {
  it("promises nothing during a server render", () => {
    // The status exists so the server pass does not claim a capability it has
    // no way of knowing about and then contradict itself on hydration.
    expect(availabilityMessage({ status: "unknown" })).toBe("");
  });
});
