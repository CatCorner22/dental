import { MarkdownDoc } from "@/components/reference/MarkdownDoc";
import { readReferenceDoc } from "@/lib/content";

export const metadata = { title: "Sedation & imaging — Smile Notes" };

export default function Page() {
  return <MarkdownDoc markdown={readReferenceDoc("sedationImaging")} />;
}
