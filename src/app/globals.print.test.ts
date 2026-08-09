import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// The print stylesheet's contract, pinned at the source level because every
// one of these lines fixes a defect that exists ONLY on paper — a paginating
// print engine is the sole runtime that can show it, and no test environment
// here has one. Each assertion names the failure it guards; if a refactor
// trips one, regenerate the record and reference PDFs before relaxing it.
const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
const printBlocks = [...css.matchAll(/@media print \{([\s\S]*?)\n\}/g)].map((m) => m[1]);
const print = printBlocks.join("\n");

describe("print stylesheet contract", () => {
  it("has the two print blocks this contract pins", () => {
    expect(printBlocks.length).toBeGreaterThanOrEqual(2);
  });

  it("lets the frozen record's <pre> break across pages", () => {
    // The record's <pre> also carries .card, and the handout block gives .card
    // `break-inside: avoid`. For a note taller than one page that instruction
    // can only be satisfied by pushing the whole block to a fresh page —
    // page 1 of the legal record printed 80% blank.
    expect(print).toMatch(/pre \{[^}]*break-inside: auto !important/);
  });

  it("prints the record's <pre> at 11pt over the screen utility size", () => {
    // The same .card class brings text-sm along; without !important the
    // utility wins on specificity and the promised 11pt prints at 10.5.
    expect(print).toMatch(/pre \{[^}]*font-size: 11pt !important/);
  });

  it("turns OpenType alternates off on paper, calt included", () => {
    // The screen's safety glyphs (slashed zero, l/I disambiguation, tabular
    // figures) are glyph substitutions Chromium's print-to-PDF emits with no
    // ToUnicode mapping: the PDF text layer silently loses every digit and
    // lowercase l. `normal` is not enough — Inter's contextual alternates
    // (calt) are a default-on feature that substitutes the hyphens and colon
    // inside "2026-08-08 17:21" the same unmappable way. The declaration must
    // disable calt explicitly, which also resets the screen list.
    expect(print).toMatch(/body \{[^}]*font-feature-settings: "calt" 0/);
  });

  it("hides buttons as chrome but honors the print-keep opt-out", () => {
    // Hiding every <button> printed a tooth-numbering handout with no teeth —
    // the chart's teeth are buttons. ToothChart.test.tsx pins the other side
    // of this contract.
    expect(print).toMatch(/button:not\(\.print-keep\)/);
    // And the kept buttons carry their pressed state in ink, because printers
    // drop the background colors the screen's active style relies on.
    expect(print).toMatch(/button\.print-keep\[aria-pressed="true"\]/);
  });
});
