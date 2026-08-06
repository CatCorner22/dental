// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { NavLinks } from "./NavLinks";

// usePathname is the only thing this component reads from Next. Mocking it is
// what lets the active-state rule — which is real logic with a real trap in it
// — be tested at all.
const { pathname } = vi.hoisted(() => ({ pathname: { current: "/" } }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

const ITEMS = [
  { href: "/", label: "Notes", alsoOwns: ["/note/"] },
  { href: "/notes", label: "My notes" },
  { href: "/reference/templates", label: "Learn", activePrefix: "/reference" },
  { href: "/wishes", label: "Ask" }
];

// Unmounts before returning. cleanup() only runs BETWEEN tests, so a helper
// called twice in one test would leave two navs in the document and the second
// lookup would fail with "found multiple elements" — a failure about the test,
// not about the component.
function activeLabel(at: string): string | null {
  pathname.current = at;
  const view = render(<NavLinks items={ITEMS} />);
  const current = screen.queryByRole("link", { current: "page" });
  const label = current?.textContent ?? null;
  view.unmount();
  return label;
}

describe("which nav pill is lit", () => {
  it("lights exactly one pill, or none", () => {
    for (const path of ["/", "/notes", "/note/abc", "/reference/templates", "/wishes", "/account"]) {
      pathname.current = path;
      const { unmount } = render(<NavLinks items={ITEMS} />);
      expect(screen.queryAllByRole("link", { current: "page" }).length, path).toBeLessThanOrEqual(1);
      unmount();
    }
  });

  it("lights Notes on the home page", () => {
    expect(activeLabel("/")).toBe("Notes");
  });

  it("keeps Notes lit inside a specific note", () => {
    // The reason alsoOwns exists. "Notes" points at "/", and "/" cannot be used
    // for a startsWith test when every path starts with it — so opening a draft
    // used to un-highlight the place you are working.
    expect(activeLabel("/note/1f2e3d")).toBe("Notes");
  });

  it("does NOT light Notes on /notes, and vice versa", () => {
    // The near-miss that makes this worth a test: "/notes" and "/note/" differ
    // by one character in the same position, and either prefix rule matching
    // the other would light two pills at once.
    expect(activeLabel("/notes")).toBe("My notes");
    expect(activeLabel("/notes?tab=filed")).toBe("My notes");
  });

  it("lights Learn across the whole reference section, not just its landing page", () => {
    expect(activeLabel("/reference/templates")).toBe("Learn");
    expect(activeLabel("/reference/word-map")).toBe("Learn");
    expect(activeLabel("/reference/tennessee-law")).toBe("Learn");
  });

  it("lights nothing on a destination that lives in the More menu", () => {
    // /account and /admin/* are reachable, but no pill owns them. Lighting one
    // anyway would tell someone they are somewhere they are not.
    expect(activeLabel("/account")).toBeNull();
    expect(activeLabel("/admin/users")).toBeNull();
  });
});
