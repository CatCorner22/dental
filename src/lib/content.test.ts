import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DOC_NAMES, readReferenceDoc } from "./content";

// Two of the eight allowlisted reference documents had no route for the whole
// life of the project. `source-ledger.md` and `deployment-recommendation.md`
// were listed in the allowlist, shipped in the repo, linked from the README —
// and unreachable from inside the app. The source ledger is the strongest
// provenance content the tool has: the benchmark findings, the adopted
// controls, the Tennessee primary authorities, and the stated limits of the
// research behind every rule the audit enforces.
//
// Nothing failed, because "allowlisted" and "reachable" were never compared.
// This compares them, so a document added to the allowlist and then forgotten
// is a red test rather than a file nobody opens.

const APP_REFERENCE = path.join(process.cwd(), "src/app/reference");

/** Every `readReferenceDoc("x")` argument appearing in a reference page. */
function routedDocNames(): Set<string> {
  const found = new Set<string>();
  for (const entry of readdirSync(APP_REFERENCE, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const page = path.join(APP_REFERENCE, entry.name, "page.tsx");
    if (!existsSync(page)) continue;
    for (const m of readFileSync(page, "utf8").matchAll(/readReferenceDoc\(\s*"([^"]+)"\s*\)/g)) {
      found.add(m[1]);
    }
  }
  return found;
}

describe("every allowlisted reference document is reachable", () => {
  it("has a page rendering each one", () => {
    const routed = routedDocNames();
    const unreachable = DOC_NAMES.filter((name) => !routed.has(name));
    expect(
      unreachable,
      "allowlisted in content.ts but no page under src/app/reference renders them"
    ).toEqual([]);
  });

  it("routes nothing that is not allowlisted", () => {
    const allowed = new Set<string>(DOC_NAMES);
    const unknown = [...routedDocNames()].filter((n) => !allowed.has(n));
    expect(unknown, "pages requesting a doc name that content.ts does not define").toEqual([]);
  });

  it("can actually read every allowlisted file off disk", () => {
    // The allowlist points at paths. A renamed or deleted markdown file would
    // otherwise only surface as a 500 in production.
    for (const name of DOC_NAMES) {
      expect(readReferenceDoc(name).length, `${name} is empty or missing`).toBeGreaterThan(0);
    }
  });
});

describe("the reference navigation reaches every reference page", () => {
  it("links each page directory that exists", () => {
    const layout = readFileSync(path.join(APP_REFERENCE, "layout.tsx"), "utf8");
    const linked = new Set(
      [...layout.matchAll(/href:\s*"\/reference\/([^"]+)"/g)].map((m) => m[1])
    );
    const dirs = readdirSync(APP_REFERENCE, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(path.join(APP_REFERENCE, e.name, "page.tsx")))
      .map((e) => e.name);
    const orphaned = dirs.filter((d) => !linked.has(d));
    expect(orphaned, "reference pages with no nav link — reachable only by typing the URL").toEqual(
      []
    );
  });
});
