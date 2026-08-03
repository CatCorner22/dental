import { MarkdownDoc } from "@/components/reference/MarkdownDoc";
import { readReferenceDoc } from "@/lib/content";

export const metadata = { title: "Sedation & imaging" };

export default function Page() {
  return <MarkdownDoc markdown={readReferenceDoc("sedationImaging")} />;
}
