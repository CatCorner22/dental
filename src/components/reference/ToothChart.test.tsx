// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { ToothChart } from "./ToothChart";

// The print stylesheet hides every <button> as chrome — buttons are actions,
// and paper cannot act. The tooth chart is the exception that proves the rule:
// its teeth ARE buttons (they toggle detail on screen), and the first rendered
// print run produced a tooth-numbering handout with arch labels and no teeth.
// `print-keep` is the opt-out the print CSS honors (`button:not(.print-keep)`),
// so every tooth and the dentition caption must carry it. This is a contract
// with globals.css, pinned here because a class rename on either side fails
// only on paper, where no runtime test ever looks.
describe("ToothChart on paper", () => {
  it("marks every tooth button print-keep so the printed chart has teeth", () => {
    const { container } = render(<ToothChart />);
    const teeth = [...container.querySelectorAll("button")].filter((b) =>
      /^[0-9]+$|^[A-T]$/.test(b.textContent ?? "")
    );
    // Permanent dentition renders by default: 16 maxillary + 16 mandibular.
    expect(teeth).toHaveLength(32);
    for (const tooth of teeth) {
      expect(tooth.className).toContain("print-keep");
    }
  });

  it("keeps the dentition toggle as the printed caption", () => {
    const { container } = render(<ToothChart />);
    const toggles = [...container.querySelectorAll("button")].filter((b) =>
      /Permanent|Primary/.test(b.textContent ?? "")
    );
    expect(toggles).toHaveLength(2);
    for (const t of toggles) {
      expect(t.className).toContain("print-keep");
    }
    // The active one is distinguishable in ink: print CSS keys its border and
    // weight off aria-pressed, so the attribute must be present and truthful.
    const pressed = toggles.filter((t) => t.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(pressed[0]?.textContent).toContain("Permanent");
  });
});
