"use client";

import { useState } from "react";

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
  audit
}: {
  ticket: string;
  note: string;
  audit: string;
}) {
  const [copied, setCopied] = useState<"note" | "both" | null>(null);

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

  return (
    <div className="mb-4 flex flex-wrap gap-2 print:hidden">
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
    </div>
  );
}
