import { MarkdownDoc } from "@/components/reference/MarkdownDoc";
import { readReferenceDoc } from "@/lib/content";

export const metadata = { title: "Tennessee law — Smile Notes" };

export default function Page() {
  return (
    <div>
      <div className="mb-4 max-w-3xl rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Internal training summary — not legal advice. Verify the current Tennessee Code, the
        Secretary of State Rule 0460 index, and Board notices before relying on any item.
      </div>
      <MarkdownDoc markdown={readReferenceDoc("tennesseeLaw")} />
    </div>
  );
}
