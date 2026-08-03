import { describe, expect, it } from "vitest";
import {
  messageId,
  subjectToken,
  submissionSubject,
  threadHeaders,
  threadRootId
} from "./threading";

// Threading has one job: every email about one filed note lands in ONE
// conversation, so a reader sees a ticket's whole history in one place.
//
// The tests that matter most are the ones asserting what the token does NOT
// contain. A token built from a patient's initials and birth year would be a
// unique characteristic plus a date — a patient identifier under HIPAA Safe
// Harbor, and re-identifying in a small practice, placed in the one field that
// travels in the clear, lands in bounce messages, and shows on a locked phone.

describe("the token carries no patient data", () => {
  it("is built from the ticket alone", () => {
    expect(subjectToken("DN-000042")).toBe("[DN-000042]");
    expect(threadRootId("DN-000042", "notes@practice.com")).toBe(
      "<smile-note-DN-000042@practice.com>"
    );
  });

  it("is stable for a ticket and different between tickets", () => {
    expect(threadRootId("DN-000042", "n@p.com")).toBe(threadRootId("DN-000042", "n@p.com"));
    expect(threadRootId("DN-000042", "n@p.com")).not.toBe(threadRootId("DN-000043", "n@p.com"));
  });

  it("puts the ticket in the subject, bracketed so Re:/Fwd: cannot detach it", () => {
    const s = submissionSubject("DN-000042", "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED");
    expect(s).toContain("[DN-000042]");
    expect(`Re: ${s}`).toContain("[DN-000042]");
  });
});

describe("one ticket, one conversation", () => {
  it("the original send IS the thread root", () => {
    const h = threadHeaders("DN-000042", 0, "notes@practice.com");
    expect(h["Message-ID"]).toBe("<smile-note-DN-000042@practice.com>");
    expect(h.References).toBe(h["Message-ID"]);
    expect(h["In-Reply-To"]).toBeUndefined();
  });

  it("a resend points back at the original instead of starting a new thread", () => {
    const first = threadHeaders("DN-000042", 0, "notes@practice.com");
    const again = threadHeaders("DN-000042", 1, "notes@practice.com");
    expect(again.References).toBe(first["Message-ID"]);
    expect(again["In-Reply-To"]).toBe(first["Message-ID"]);
    // …but carries its own id, or some servers treat it as a duplicate and
    // silently drop it.
    expect(again["Message-ID"]).not.toBe(first["Message-ID"]);
  });

  it("keeps the subject identical across resends, for clients that thread on it", () => {
    expect(submissionSubject("DN-000042", "READY FOR CLINICIAN REVIEW")).toBe(
      submissionSubject("DN-000042", "READY FOR CLINICIAN REVIEW")
    );
  });

  it("gives every attempt a distinct message id", () => {
    const ids = new Set([0, 1, 2, 3].map((n) => messageId("DN-000042", n, "n@p.com")));
    expect(ids.size).toBe(4);
  });
});

describe("the headers are always well formed", () => {
  it("survives a missing or malformed sender", () => {
    for (const sender of [undefined, "", "not-an-email", "@", "a@b"]) {
      const h = threadHeaders("DN-1", 0, sender);
      expect(h["Message-ID"]).toMatch(/^<[^<>@\s]+@[a-z0-9.-]+>$/);
    }
  });

  it("strips a display-name wrapper from the sender", () => {
    expect(threadRootId("DN-1", "Smile Notes <notes@practice.com>")).toContain("@practice.com>");
  });

  it("cannot be broken by a hostile ticket string", () => {
    // A header value containing CR/LF would be header injection. The ticket is
    // server-generated, but the sanitizer is the guarantee, not the provenance.
    const h = threadHeaders("DN-1\r\nBcc: attacker@evil.com", 0, "n@p.com");
    // The CR/LF is the attack; stripping it is the guarantee. Keeping only the
    // leading ticket-shaped run also stops the attacker's text riding along
    // inside an otherwise well-formed id.
    expect(h["Message-ID"]).toBe("<smile-note-DN-1@p.com>");
    for (const v of Object.values(h)) {
      expect(v).not.toMatch(/[\r\n]/);
    }
  });

  it("bounds a runaway ticket", () => {
    expect(threadRootId("D".repeat(500), "n@p.com").length).toBeLessThan(100);
  });
});
