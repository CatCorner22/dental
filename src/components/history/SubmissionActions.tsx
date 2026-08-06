"use client";

import { useState } from "react";
import { statusLabel } from "@/lib/audit/types";

// Getting a filed Smile Note back OUT of the tool.
//
// Until now the frozen record could only be read on screen. A records request,
// a board inquiry, or a malpractice discovery demand asks for a document, and
// the only way to produce one was to select the text by hand — per note, by
// whoever happened to have practice-wide read.
//
// Everything here is client-side over content the server already rendered into
// this page, so it adds no endpoint and no new way to reach a note: whoever can
// see this page can already read every character of it.
export function SubmissionActions({
  ticket,
  note,
  audit,
  submittedByName,
  submittedAtEt,
  ruleVersion,
  auditStatus
}: {
  ticket: string;
  note: string;
  audit: string;
  submittedByName?: string;
  submittedAtEt?: string;
  ruleVersion?: string;
  auditStatus?: string;
}) {
  const [copied, setCopied] = useState<"note" | "both" | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestConfirmed, setRequestConfirmed] = useState(false);

  const copy = async (what: "note" | "both", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard is permission-gated and blocked outright in some kiosk
      // configurations. Download always works, so point at it rather than
      // failing silently.
      window.alert("The clipboard is blocked in this browser. Use Download instead.");
    }
  };

  const download = (suffix: string, text: string) => {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // The ticket is in the filename so a folder of exports stays traceable to
    // the record without opening any of them.
    a.download = `smile-note-${ticket}${suffix}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // The note and its audit report travel together. A frozen note without the
  // report it passed is half the record.
  const bundle = `${note}\n\n---\n\n${audit}\n`;

  // The records-request bundle adds the provenance a requester actually needs:
  // who filed it, when, under which frozen ruleset, with what audit verdict.
  // Everything in it is already on this page — the helper is assembly, not a
  // new way to reach a note.
  const requestBundle = [
    `# Records-request export — ${ticket}`,
    "",
    "| Field | Value |",
    "|---|---|",
    `| Ticket | ${ticket} |`,
    submittedByName ? `| Filed by | ${submittedByName} |` : null,
    submittedAtEt ? `| Filed at (Eastern) | ${submittedAtEt} |` : null,
    ruleVersion ? `| Ruleset version (frozen) | ${ruleVersion} |` : null,
    auditStatus ? `| Audit status at filing | ${statusLabel(auditStatus)} |` : null,
    "",
    "This is the frozen record exactly as submitted. Patient identity, exact dates,",
    "and signatures live only in the electronic dental record (EDR); pair this",
    "export with the EDR chart when responding to a request.",
    "",
    "## Note",
    "",
    note,
    "",
    "## Audit report",
    "",
    audit,
    ""
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return (
    <div className="mb-4 print:hidden">
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={() => copy("note", note)}>
          {copied === "note" ? "Copied ✓" : "Copy note"}
        </button>
        <button className="btn-secondary" onClick={() => copy("both", bundle)}>
          {copied === "both" ? "Copied ✓" : "Copy note + audit"}
        </button>
        <button className="btn-secondary" onClick={() => download("", note)}>
          Download note
        </button>
        <button className="btn-secondary" onClick={() => download("-with-audit", bundle)}>
          Download note + audit
        </button>
        <button className="btn-secondary" onClick={() => window.print()}>
          Print
        </button>
        <button
          className="btn-secondary"
          aria-expanded={requestOpen}
          onClick={() => setRequestOpen((v) => !v)}
        >
          Records-request bundle…
        </button>
      </div>
      {requestOpen && (
        <div className="mt-2 rounded border border-brand-blue/40 bg-brand-blue/10 p-3">
          <p className="text-xs text-brand-navy">
            One document with the note, audit report, filing metadata, and frozen ruleset version —
            the shape a board inquiry or discovery demand asks for. Identity fields stay in the
            EDR; this export carries none.
          </p>
          <label className="mt-2 flex items-start gap-2 text-xs text-brand-navy">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={requestConfirmed}
              onChange={(e) => setRequestConfirmed(e.target.checked)}
            />
            <span>
              This export answers a verified request, and I confirmed in the EDR that this ticket
              belongs to the patient whose records were requested.
            </span>
          </label>
          <button
            className="btn-primary mt-2 text-xs"
            disabled={!requestConfirmed}
            onClick={() => download("-records-request", requestBundle)}
          >
            Download records-request bundle
          </button>
        </div>
      )}
    </div>
  );
}
