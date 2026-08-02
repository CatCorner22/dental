import { MarkdownDoc } from "@/components/reference/MarkdownDoc";
import { readReferenceDoc } from "@/lib/content";

export const metadata = { title: "Data Hygiene Guide — Smile Notes" };

export default function Page() {
  return <MarkdownDoc markdown={readReferenceDoc("dataHygiene")} />;
}
