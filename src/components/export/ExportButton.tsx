import { APP_NAME } from "@/lib/brand";

// A plain link, not a fetch-and-Blob dance.
//
// The route already sets Content-Disposition: attachment, so the browser
// downloads it natively — which means it works with JavaScript disabled, works
// in a locked-down operatory browser, streams rather than buffering the whole
// file in memory, and gets a real progress indicator for free. Building a Blob
// client-side would be more code doing a worse job.
export function ExportButton({
  table,
  label = "Export to Excel (CSV)"
}: {
  table: "users" | "audit-log" | "submissions";
  label?: string;
}) {
  return (
    <a
      href={`/api/export/${table}`}
      className="btn-secondary print:hidden"
      // `download` is a hint; the server's Content-Disposition is what actually
      // names the file, so the two cannot disagree.
      download
      title={`Download this table as a CSV file that opens in Excel. ${APP_NAME} records the export in the audit log.`}
    >
      {label}
    </a>
  );
}
