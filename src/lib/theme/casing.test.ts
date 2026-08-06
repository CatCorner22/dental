import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { findShouting, isUnshouted, ALLOWED_ACRONYMS } from "./casing";
import { SEVERITY_LABELS, SEVERITY_MEANING, STATUS_DISPLAY, statusLabel } from "@/lib/audit/types";
import type { OverallStatus } from "@/lib/audit/types";
import { ALL_MODULES } from "@/lib/modules";

// THE BAN.
//
// This app does not shout. The rule and the reasoning live in casing.ts; this
// file is what stops it eroding one component at a time, which is exactly how
// it got everywhere the first time — `text-xs uppercase tracking-wide
// text-slate-500` was copied into twenty-seven places because it was already in
// twenty-six.
//
// Two halves, because there are two ways to shout: the CSS that transforms
// ordinary text into capitals, and copy that was typed in capitals to begin
// with. A guard against only one of them just moves the problem.

const SRC = path.join(process.cwd(), "src");

function walk(dir: string, match: (f: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, match));
    else if (match(entry.name)) out.push(full);
  }
  return out;
}

const RENDERED = walk(SRC, (f) => /\.(tsx|css)$/.test(f) && !f.endsWith(".test.tsx"));

/**
 * Strip comments before looking for the utility.
 *
 * The comments in this codebase explain what was removed and why, so several
 * of them contain the word this test bans. Banning the word in prose would
 * make the record of the decision unwriteable, which is the wrong trade — the
 * ban is on the utility, not on discussing it.
 */
function withoutComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("no CSS shouts", () => {
  it("uses the `uppercase` utility nowhere in the rendered tree", () => {
    const offenders: string[] = [];
    for (const file of RENDERED) {
      const src = withoutComments(readFileSync(file, "utf8"));
      // `toUpperCase` is a string operation on data — tooth ids, abbreviation
      // detection — and has nothing to do with how text is displayed.
      const stripped = src.replace(/toUpperCase/g, "");
      if (/\buppercase\b/.test(stripped)) offenders.push(path.relative(process.cwd(), file));
    }
    expect(
      offenders,
      `all-caps text is banned (see src/lib/theme/casing.ts). Use .label-section, ` +
        `.label-micro or .eyebrow instead of the \`uppercase\` utility.`
    ).toEqual([]);
  });

  it("does not reintroduce it as raw CSS either", () => {
    const css = withoutComments(readFileSync(path.join(SRC, "app/globals.css"), "utf8"));
    expect(/text-transform\s*:\s*uppercase/.test(css)).toBe(false);
  });
});

describe("no copy shouts", () => {
  it("keeps the severity vocabulary in sentence case", () => {
    for (const [sev, label] of Object.entries(SEVERITY_LABELS)) {
      expect(findShouting(label), `SEVERITY_LABELS.${sev} shouts`).toEqual([]);
    }
  });

  it("keeps what a severity MEANS in sentence case", () => {
    for (const [sev, meaning] of Object.entries(SEVERITY_MEANING)) {
      expect(findShouting(meaning), `SEVERITY_MEANING.${sev} shouts`).toEqual([]);
    }
  });

  it("keeps every displayed status in sentence case", () => {
    for (const [stored, shown] of Object.entries(STATUS_DISPLAY)) {
      expect(findShouting(shown), `STATUS_DISPLAY["${stored}"] shouts`).toEqual([]);
    }
  });

  it("keeps every module, section and field label in sentence case", () => {
    // The labels a writer reads on every note. An acronym is fine here — a
    // field may legitimately be called "PHI check" — and the allowlist in
    // casing.ts is what draws that line.
    const offenders: string[] = [];
    for (const mod of ALL_MODULES) {
      if (!isUnshouted(mod.title)) offenders.push(`module "${mod.title}"`);
      for (const section of mod.sections) {
        if (!isUnshouted(section.title)) offenders.push(`section "${section.title}"`);
        for (const field of section.fields) {
          if (!isUnshouted(field.label)) offenders.push(`field "${field.label}"`);
          if (field.helpText && !isUnshouted(field.helpText)) {
            offenders.push(`help on "${field.label}": ${findShouting(field.helpText).join(", ")}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("the stored audit status is presentation, not data", () => {
  // The union itself STAYS shouted, and the test says so out loud so nobody
  // "finishes the job" by renaming it. It is written into
  // submissions.auditStatus at filing and counted by name in computeStats — a
  // filed note's status is a compliance fact about the past.
  const STORED: OverallStatus[] = [
    "BLOCKED",
    "NEEDS CLINICIAN ACTION",
    "READY FOR CLINICIAN REVIEW",
    "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED"
  ];

  it("gives every stored status something to show", () => {
    for (const s of STORED) {
      expect(STATUS_DISPLAY[s], `no display label for ${s}`).toBeTruthy();
      expect(statusLabel(s)).toBe(STATUS_DISPLAY[s]);
    }
    expect(Object.keys(STATUS_DISPLAY).sort()).toEqual([...STORED].sort());
  });

  it("shows an unrecognised stored status verbatim rather than nothing", () => {
    // A row written by an older ruleset. Showing what was recorded beats
    // showing a blank where a filed note's status should be.
    expect(statusLabel("SOME OLDER STATUS")).toBe("SOME OLDER STATUS");
  });
});

describe("what counts as shouting", () => {
  it("catches a word typed in capitals", () => {
    expect(findShouting("This is REQUIRED before filing.")).toEqual(["REQUIRED"]);
  });

  it("catches every one, not just the first", () => {
    expect(findShouting("STOP and READ")).toEqual(["STOP", "READ"]);
  });

  it("leaves an acronym alone", () => {
    expect(findShouting("Never record PHI in a SOAP note.")).toEqual([]);
  });

  it("leaves ordinary sentence case alone", () => {
    expect(findShouting("Needs clinician action")).toEqual([]);
  });

  it("does not fire on a single capital letter", () => {
    // "A note" and "I" are not shouting, and neither is the start of a
    // sentence — which is the whole difference between this rule and the
    // literal reading of "ban capital letters".
    expect(findShouting("A note that starts with a capital is fine.")).toEqual([]);
  });

  it("treats the severity codes as identifiers", () => {
    expect(findShouting("S0 and S1 block filing")).toEqual([]);
  });

  it("holds the acronym list to acronyms", () => {
    // A guard on the guard. The cheap way to silence this test is to add the
    // shouted word to ALLOWED_ACRONYMS, so the list itself has a shape: real
    // initialisms are short. Anything longer is a word someone wanted in caps.
    for (const acronym of ALLOWED_ACRONYMS) {
      expect(acronym.length, `"${acronym}" is too long to be an acronym`).toBeLessThanOrEqual(5);
    }
  });
});
