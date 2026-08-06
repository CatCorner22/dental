import { describe, expect, it } from "vitest";
import {
  canCompleteEnrollment,
  completeEnrollment,
  DICTATION_ENROLLMENT_VERSION,
  ENROLLMENT_MIN_MS,
  ENROLLMENT_MIN_PROMPTS,
  ENROLLMENT_MIN_UTTERANCES,
  enrollmentRemainingMs,
  enrollmentStorageKey,
  readEnrollment,
  writeEnrollment
} from "./enrollment";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    }
  };
}

describe("dictation enrollment gate", () => {
  it("pins the unlock contract (drift guard)", () => {
    // 2.0.0: the session went from three minutes to ninety seconds and the
    // record moved from a browser's localStorage onto the user row. The
    // version is bumped WITH the thresholds on purpose — a stored 1.0.0
    // record proves a session that met the old rule on one browser, and the
    // thing being asserted now is a fact about a person.
    expect(DICTATION_ENROLLMENT_VERSION).toBe("2.0.0");
    expect(ENROLLMENT_MIN_MS).toBe(90_000);
    expect(ENROLLMENT_MIN_UTTERANCES).toBe(8);
    expect(ENROLLMENT_MIN_PROMPTS).toBe(6);
  });

  it("does not honour a record written under the previous contract", () => {
    // The migration boundary, stated as a test. An old localStorage record
    // would otherwise unlock the microphone on the strength of a rule that no
    // longer exists.
    const stale = JSON.stringify({
      version: "1.0.0",
      username: "amanda",
      region: "general",
      completedAt: new Date().toISOString(),
      listenedMs: 200_000,
      utterances: 30,
      promptsCompleted: 12
    });
    expect(readEnrollment("amanda", { getItem: () => stale })).toBeNull();
  });

  it("refuses unlock until time, utterances, and prompts are met", () => {
    expect(
      canCompleteEnrollment({
        listenedMs: ENROLLMENT_MIN_MS - 1,
        utterances: 20,
        promptsCompleted: 10,
        region: "general"
      })
    ).toBe(false);
    expect(
      canCompleteEnrollment({
        listenedMs: ENROLLMENT_MIN_MS,
        utterances: ENROLLMENT_MIN_UTTERANCES - 1,
        promptsCompleted: 10,
        region: "south"
      })
    ).toBe(false);
    expect(
      canCompleteEnrollment({
        listenedMs: ENROLLMENT_MIN_MS,
        utterances: ENROLLMENT_MIN_UTTERANCES,
        promptsCompleted: ENROLLMENT_MIN_PROMPTS,
        region: "midwest"
      })
    ).toBe(true);
  });

  it("persists a completed enrollment and rejects stale versions", () => {
    const storage = memoryStorage();
    const record = completeEnrollment(
      "alice",
      {
        listenedMs: ENROLLMENT_MIN_MS,
        utterances: ENROLLMENT_MIN_UTTERANCES,
        promptsCompleted: ENROLLMENT_MIN_PROMPTS,
        region: "west"
      },
      new Date("2026-08-05T12:00:00.000Z")
    );
    expect(record).not.toBeNull();
    writeEnrollment(record!, storage);
    expect(readEnrollment("alice", storage)?.region).toBe("west");
    expect(readEnrollment("bob", storage)).toBeNull();

    storage.setItem(
      enrollmentStorageKey("alice"),
      JSON.stringify({ ...record, version: "0.0.0" })
    );
    expect(readEnrollment("alice", storage)).toBeNull();
  });

  it("reports remaining time until unlock eligibility", () => {
    expect(enrollmentRemainingMs(0)).toBe(ENROLLMENT_MIN_MS);
    expect(enrollmentRemainingMs(ENROLLMENT_MIN_MS)).toBe(0);
  });
});
