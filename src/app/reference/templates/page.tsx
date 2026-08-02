import { MarkdownDoc } from "@/components/reference/MarkdownDoc";
import { readReferenceDoc } from "@/lib/content";

export const metadata = { title: "Templates — Smile Notes" };

export default function Page() {
  return <MarkdownDoc markdown={readReferenceDoc("templates")} />;
}
