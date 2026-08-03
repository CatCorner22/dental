import { MarkdownDoc } from "@/components/reference/MarkdownDoc";
import { readReferenceDoc } from "@/lib/content";

export const metadata = { title: "Templates" };

export default function Page() {
  return <MarkdownDoc markdown={readReferenceDoc("templates")} />;
}
