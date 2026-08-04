import { describe, expect, it } from "vitest";
import { authoritiesByCategory, authorityById, CATEGORY_ORDER, TN_AUTHORITIES } from "./tn-law";
import { screenLoadedPhrases } from "@/lib/language/loaded-phrases";
import { runLegalWatch, WATCH_SOURCES } from "./watch";
import type { GenerateListFn } from "@/lib/assist/service";

// The law library is held to the same standards as the advisors: every claim
// linked, every link on an expected domain, every cross-reference resolvable,
// and every sentence clean under the practice's language screen.

const ALLOWED_DOMAINS = [
  "publications.tnsosfiles.com",
  "www.tn.gov",
  "www.capitol.tn.gov",
  "law.justia.com",
  "www.hhs.gov",
  "www.osha.gov",
  "www.deadiversion.usdoj.gov",
  "www.ada.org",
  "www.jointcommission.org",
  "www.ismp.org",
  "www.cdc.gov"
];

describe("the authority library holds itself to its own standard", () => {
  it("ids are unique", () => {
    const ids = TN_AUTHORITIES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every link is https on an expected official domain or labelled mirror", () => {
    for (const a of TN_AUTHORITIES) {
      const url = new URL(a.url);
      expect(url.protocol, a.id).toBe("https:");
      expect(ALLOWED_DOMAINS, `${a.id}: ${url.hostname}`).toContain(url.hostname);
      // Unofficial mirrors must say so; official domains must not.
      if (url.hostname === "law.justia.com") expect(a.unofficialMirror, a.id).toBe(true);
    }
  });

  it("every cross-reference resolves", () => {
    for (const a of TN_AUTHORITIES) {
      for (const rid of a.relatedIds) {
        expect(authorityById(rid), `${a.id} -> ${rid}`).toBeDefined();
      }
    }
  });

  it("every entry names at least one app enforcement point", () => {
    for (const a of TN_AUTHORITIES) {
      expect(a.appEnforcement.length, a.id).toBeGreaterThan(0);
    }
  });

  it("every summary and impact passes the language screen", () => {
    for (const a of TN_AUTHORITIES) {
      expect(screenLoadedPhrases(`${a.title} ${a.summary} ${a.practiceImpact}`), a.id).toEqual([]);
    }
  });

  it("categories cover every entry and keep a stable order", () => {
    const byCat = authoritiesByCategory();
    const total = CATEGORY_ORDER.reduce((n, c) => n + (byCat.get(c)?.length ?? 0), 0);
    expect(total).toBe(TN_AUTHORITIES.length);
  });
});

describe("legal watch agents", () => {
  const okFetch = async (url: string) =>
    `<html><body>Board of Dentistry notice: rule 0460 amendment effective for dentists. ${url}</body></html>`;

  it("reports keyword signals deterministically without AI", async () => {
    const sweep = await runLegalWatch(okFetch);
    expect(sweep.aiEnabled).toBe(false);
    expect(sweep.sources).toHaveLength(WATCH_SOURCES.length);
    const sos = sweep.sources.find((s) => s.sourceId === "sos-rules")!;
    expect(sos.status).toBe("ok");
    expect(sos.keywordHits).toBeGreaterThan(0);
    expect(sos.items).toEqual([]);
  });

  it("one unreachable source never costs the sweep", async () => {
    const flaky = async (url: string) => {
      if (url.includes("capitol")) throw new Error("down");
      return okFetch(url);
    };
    const sweep = await runLegalWatch(flaky);
    const ga = sweep.sources.find((s) => s.sourceId === "general-assembly")!;
    expect(ga.status).toBe("fetch-failed");
    expect(sweep.sources.filter((s) => s.status !== "fetch-failed").length).toBe(
      WATCH_SOURCES.length - 1
    );
  });

  it("AI items always carry OUR source url — a model cannot mint a citation link", async () => {
    const generate: GenerateListFn = async () => ({
      items: [
        {
          title: "Rule 0460-02 amendment filed",
          whyRelevant: "Changes record retention details for dentists."
        }
      ]
    });
    const sweep = await runLegalWatch(okFetch, generate);
    for (const s of sweep.sources) {
      for (const item of s.items) {
        expect(item.url).toBe(s.url);
      }
    }
  });

  it("discards AI output that fails validation, keeping the keyword signal", async () => {
    const generate: GenerateListFn = async () => ({ items: [{ nonsense: true }] });
    const sweep = await runLegalWatch(okFetch, generate);
    const sos = sweep.sources.find((s) => s.sourceId === "sos-rules")!;
    expect(sos.items).toEqual([]);
    expect(sos.keywordHits).toBeGreaterThan(0);
    expect(sos.note).toContain("review the source");
  });

  it("skips the AI call entirely when a page has no dental signal", async () => {
    let calls = 0;
    const generate: GenerateListFn = async () => {
      calls += 1;
      return { items: [] };
    };
    await runLegalWatch(async () => "<html><body>gardening tips</body></html>", generate);
    expect(calls).toBe(0);
  });
});
