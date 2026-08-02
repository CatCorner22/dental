import { MarkdownDoc } from "@/components/reference/MarkdownDoc";
import { readReferenceDoc } from "@/lib/content";

export const metadata = { title: "Terminology & style" };

export default function Page() {
  return <MarkdownDoc markdown={readReferenceDoc("terminology")} />;
}
