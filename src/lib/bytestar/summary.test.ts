import { describe, expect, it } from "vitest";
import { buildByteStarSummary } from "./summary";
import { encodeByteStarDetail } from "./log";

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

describe("ByteStar period summary (digest rollup)", () => {
  it("aggregates runs, outcomes, kept/refused, tokens, and profiles", () => {
    const rows = [
      {
        action: "bytestar.drift",
        detail: encodeByteStarDetail({
          outcome: "ok",
          promptVersion: "1.5.0",
          model: "m",
          tokens: 120,
          kept: 2,
          refused: 1,
          profile: "documentation"
        }),
        atMs: NOW - DAY
      },
      {
        action: "bytestar.drift",
        detail: encodeByteStarDetail({
          outcome: "phi-blocked",
          promptVersion: "1.5.0",
          model: "m",
          tokens: 0,
          profile: "legal"
        }),
        atMs: NOW - 2 * DAY
      }
    ];
    const s = buildByteStarSummary(rows, NOW - 7 * DAY);
    expect(s.runs).toBe(2);
    expect(s.outcomes.ok).toBe(1);
    expect(s.outcomes["phi-blocked"]).toBe(1);
    expect(s.keptTotal).toBe(2);
    expect(s.refusedTotal).toBe(1);
    expect(s.tokens).toBe(120);
    expect(s.profiles.documentation).toBe(1);
    expect(s.profiles.legal).toBe(1);
  });

  it("excludes rows outside the window", () => {
    const rows = [
      {
        action: "bytestar.drift",
        detail: encodeByteStarDetail({ outcome: "ok", promptVersion: "1.5.0", model: "m", tokens: 5 }),
        atMs: NOW - 40 * DAY
      }
    ];
    const s = buildByteStarSummary(rows, NOW - 30 * DAY);
    expect(s.runs).toBe(0);
  });

  it("counts escapes by origin and ladder stage", () => {
    const base = encodeByteStarDetail({
      outcome: "escape",
      promptVersion: "1.5.0",
      model: "m",
      tokens: 10
    });
    const rows = [
      { action: "bytestar.escape", detail: `${base} origin=model stage=warn`, atMs: NOW - DAY },
      { action: "bytestar.escape", detail: `${base} origin=model stage=reset`, atMs: NOW - DAY },
      { action: "bytestar.perma-kill", detail: base, atMs: NOW - DAY }
    ];
    const s = buildByteStarSummary(rows, NOW - 7 * DAY);
    expect(s.escapes.total).toBe(2);
    expect(s.escapes.modelOriginated).toBe(2);
    expect(s.escapes.stages.warn).toBe(1);
    expect(s.escapes.stages.reset).toBe(1);
    expect(s.permaKills).toBe(1);
  });

  it("keeps the most recent canary pass ratio", () => {
    const detail = (pass: string) =>
      `${encodeByteStarDetail({ outcome: "ok", promptVersion: "1.5.0", model: "m", tokens: 50 })} pass=${pass}`;
    const rows = [
      { action: "bytestar.eval", detail: detail("11/13"), atMs: NOW - 3 * DAY },
      { action: "bytestar.eval", detail: detail("13/13"), atMs: NOW - DAY }
    ];
    const s = buildByteStarSummary(rows, NOW - 7 * DAY);
    expect(s.evals.runs).toBe(2);
    expect(s.evals.lastPass).toBe("13/13");
    expect(s.tokens).toBe(100);
  });
});
