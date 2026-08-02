import { STATUS_META, type DraftStatus } from "@/lib/status/draftStatus";

// Color is always paired with an icon and a text label, never color alone.
export function StatusChip({ status, size = "sm" }: { status: DraftStatus; size?: "sm" | "md" }) {
  const meta = STATUS_META[status] ?? STATUS_META.unfinished;
  const pad = size === "md" ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold ${pad} ${meta.chipClass}`}
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  );
}
