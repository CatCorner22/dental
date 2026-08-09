/**
 * Honest Finish — acceptance falsifiers from adversarial-hate-codesign.md.
 *
 * These tests are the deposition contract: if any fail, Ready lied, a killer
 * escaped, or a shared-tablet / RSI / CVD hole reopened.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { STATUS_DISPLAY, SEVERITY_SHAPE, SEVERITY_MEANING, statusLabel } from "@/lib/audit/types";
import { computeGates, buildReport } from "@/lib/audit/engine";
import type { AuditFinding } from "@/lib/audit/types";
import { builderFinishLine } from "@/lib/status/finishLine";
import {
  killersBlockHandoff,
  copyExportLocked,
  submitHandoffBlocked,
  writingEnabled
} from "@/lib/status/handoffGates";
import { copyBlockedForDentistJudgement } from "@/lib/status/copyOwnership";
import { buildCheckNoteSummary } from "@/lib/status/checkNoteSummary";
import { isKillerFinding } from "@/lib/audit/killers";
import { checkFilingAuthority } from "@/lib/auth/approval";
import { activeModules } from "@/lib/modules";
import { fieldKey, type NoteState } from "@/lib/schema/types";
import { ALL_SPARKLE_LINES, sparkleLine } from "@/lib/stats/sparkle";

const readyLine = {
  hasContent: true,
  filingAllowed: true,
  exportAllowed: true,
  emailAllowed: true,
  blockedReason: null as string | null
};

const softS2: AuditFinding = {
  ruleId: "quality.stale-boilerplate",
  category: "stale-text",
  severity: "S2",
  message: "Boilerplate review item."
};

const anestheticKiller: AuditFinding = {
  ruleId: "complete.anesthetic-no-amount",
  category: "required",
  severity: "S2",
  message: "Anesthetic without amount."
};

const rationaleKiller: AuditFinding = {
  ruleId: "complete.clinical-rationale",
  category: "required",
  severity: "S2",
  message: "Clinical rationale missing."
};

describe("Honest Finish acceptance falsifiers", () => {
  describe("Ready never lies", () => {
    it("finish line never contains Ready when killers or Soft S2 remain", () => {
      expect(builderFinishLine({ ...readyLine, killersBlockHandoff: true })).not.toMatch(/Ready/i);
      expect(builderFinishLine({ ...readyLine, openReviewCount: 1 })).not.toMatch(/Ready/i);
      expect(builderFinishLine({ ...readyLine, openReviewCount: 3, killersBlockHandoff: true })).not.toMatch(
        /Ready/i
      );
    });

    it("STATUS_DISPLAY for clinician-review states does not lead with Ready", () => {
      for (const stored of [
        "READY FOR CLINICIAN REVIEW",
        "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED"
      ] as const) {
        const shown = STATUS_DISPLAY[stored];
        expect(shown.toLowerCase().startsWith("ready"), `${stored} → ${shown}`).toBe(false);
        expect(statusLabel(stored)).toBe(shown);
      }
    });

    it("SEVERITY_MEANING for S2 does not claim the note is finished", () => {
      expect(SEVERITY_MEANING.S2.toLowerCase()).not.toMatch(/\bready\b/);
      expect(SEVERITY_MEANING.S2).toMatch(/Does not mean finished/i);
      expect(SEVERITY_MEANING.S2).toMatch(/Open review/i);
    });
  });

  describe("role-before-work", () => {
    it("unset role cannot write, Copy, or File", () => {
      expect(writingEnabled(true, false)).toBe(false);
      expect(writingEnabled(true, true)).toBe(true);
      expect(writingEnabled(false, true)).toBe(false);

      expect(
        copyExportLocked({
          hasContent: true,
          exportAllowed: true,
          roleRecorded: false,
          dentistMustOwnKillers: false,
          filingAllowed: true,
          killersBlock: false
        })
      ).toBe(true);

      expect(
        submitHandoffBlocked({
          hasContent: true,
          emailAllowed: true,
          filingAllowed: true,
          roleRecorded: false,
          killersBlock: false,
          alreadySubmitted: false
        })
      ).toBe(true);

      const line = builderFinishLine({ ...readyLine, roleRecorded: false });
      expect(line).toMatch(/writing/i);
      expect(line).not.toMatch(/Ready/i);
    });
  });

  describe("litigation killers hard-block (no checkbox escape)", () => {
    it("open killers lock Copy and File", () => {
      expect(killersBlockHandoff(1)).toBe(true);
      expect(
        copyExportLocked({
          hasContent: true,
          exportAllowed: true,
          roleRecorded: true,
          dentistMustOwnKillers: false,
          filingAllowed: true,
          killersBlock: true
        })
      ).toBe(true);
      expect(
        submitHandoffBlocked({
          hasContent: true,
          emailAllowed: true,
          filingAllowed: true,
          roleRecorded: true,
          killersBlock: true,
          alreadySubmitted: false
        })
      ).toBe(true);
    });

    it("Check-your-note summary marks killersBlockHandoff with no ack path in contract", () => {
      const summary = buildCheckNoteSummary({
        report: buildReport([anestheticKiller]),
        omissions: { answered: 0, licensed: 0, byLicence: [], rate: 0 },
        modules: [{ id: "universal-core", title: "Universal Core" }]
      });
      expect(summary.killers.length).toBe(1);
      expect(summary.killersBlockHandoff).toBe(true);
      expect(isKillerFinding(anestheticKiller)).toBe(true);
    });

    it("submit route source still hard-blocks killers at 422 (no ack escape)", () => {
      const src = readFileSync(
        join(process.cwd(), "src/app/api/drafts/[id]/submit/route.ts"),
        "utf8"
      );
      expect(src).toMatch(/Litigation-sensitive gaps block filing/);
      expect(src).toMatch(/no checkbox bypass/i);
      expect(src).toMatch(/status: 422/);
      expect(src).toMatch(/openKillers\.length > 0/);
    });
  });

  describe("Copy locked when filing authority denied", () => {
    it("hygienist + Assessment content → filing denied and Copy locked", () => {
      const note: NoteState = {
        selectedModuleIds: ["preventive"],
        values: {
          [fieldKey("universal-core", "diagnosis")]: {
            kind: "text",
            value: "Generalized mild gingivitis."
          }
        }
      };
      const filing = checkFilingAuthority("hygienist", activeModules(note.selectedModuleIds), note);
      expect(filing.allowed).toBe(false);
      expect(
        copyExportLocked({
          hasContent: true,
          exportAllowed: true,
          roleRecorded: true,
          dentistMustOwnKillers: false,
          filingAllowed: filing.allowed,
          killersBlock: false
        })
      ).toBe(true);
    });

    it("aux + dentist-judgement killer → Copy blocked for ownership", () => {
      expect(
        copyBlockedForDentistJudgement({
          clinicalRole: "hygienist",
          killers: [rationaleKiller]
        })
      ).toBe(true);
      expect(
        copyExportLocked({
          hasContent: true,
          exportAllowed: true,
          roleRecorded: true,
          dentistMustOwnKillers: true,
          filingAllowed: true,
          killersBlock: true
        })
      ).toBe(true);
    });
  });

  describe("Soft S2 non-killers do not flip exportAllowed alone", () => {
    it("S2-only report still allows Copy via computeGates", () => {
      const report = buildReport([softS2]);
      expect(report.counts.S2).toBe(1);
      expect(report.counts.S0).toBe(0);
      expect(isKillerFinding(softS2)).toBe(false);
      expect(computeGates(report, false).exportAllowed).toBe(true);
      expect(killersBlockHandoff(0)).toBe(false);
      expect(
        copyExportLocked({
          hasContent: true,
          exportAllowed: true,
          roleRecorded: true,
          dentistMustOwnKillers: false,
          filingAllowed: true,
          killersBlock: false
        })
      ).toBe(false);
      // Honesty: Copy allowed does not mean Ready.
      expect(builderFinishLine({ ...readyLine, openReviewCount: 1 })).toMatch(/Copy does not clear/i);
    });
  });

  describe("CVD / a11y channels", () => {
    it("SEVERITY_SHAPE provides a distinct non-color glyph per severity", () => {
      const shapes = Object.values(SEVERITY_SHAPE);
      expect(new Set(shapes).size).toBe(shapes.length);
      expect(SEVERITY_SHAPE.S0).toBe("■");
      expect(SEVERITY_SHAPE.S2).toBe("◆");
    });

    it("globals.css: glove 44px on .chip/.tap/.tap-sq without requiring pointer:coarse", () => {
      const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
      // The Honest Finish block must set 44px BEFORE any coarse-only rule for chips.
      const tapBlock = css.slice(css.indexOf(".tap,"), css.indexOf("@media (pointer: coarse)"));
      expect(tapBlock).toMatch(/\.tap,\s*\n\.chip\s*\{[^}]*min-height:\s*44px/);
      expect(tapBlock).toMatch(/\.tap-sq\s*\{[^}]*min-height:\s*44px/);
      expect(tapBlock).toMatch(/min-width:\s*44px/);
    });

    it("globals.css: prefers-reduced-motion kills .sparkle-pop animation/transform", () => {
      const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
      expect(css).toMatch(
        /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.sparkle-pop\s*\{[^}]*animation:\s*none/
      );
      expect(css).toMatch(
        /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.sparkle-pop\s*\{[^}]*transform:\s*none/
      );
    });
  });

  describe("clinical-path score smell", () => {
    it("firstPass sparkle lines do not mention streak / GPA / badge / scoreboard", () => {
      for (let i = 0; i < 8; i++) {
        const line = sparkleLine("firstPass", i);
        expect(line.toLowerCase()).not.toMatch(/streak|gpa|badge|scoreboard|rank|letter grade/);
      }
      const streakHits = ALL_SPARKLE_LINES.filter((l) => /streak lives/i.test(l));
      expect(streakHits).toEqual([]);
    });
  });

  describe("clipboard egress honesty (source contract)", () => {
    it("BuilderShell Copy confirm names clipboard egress", () => {
      const src = readFileSync(
        join(process.cwd(), "src/components/builder/BuilderShell.tsx"),
        "utf8"
      );
      expect(src).toMatch(/clipboard/);
      expect(src).toMatch(/clear the clipboard/i);
      expect(src).toMatch(/SharedTabletIdleLock/);
      expect(src).toMatch(/copyExportLocked/);
      expect(src).toMatch(/writingEnabled/);
    });
  });
});
