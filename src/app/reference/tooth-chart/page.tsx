import { MarkdownDoc } from "@/components/reference/MarkdownDoc";
import { ToothChart } from "@/components/reference/ToothChart";
import { readReferenceDoc } from "@/lib/content";

export const metadata = { title: "Tooth chart — Smile Notes" };

export default function Page() {
  return (
    <div>
      <ToothChart />
      <MarkdownDoc markdown={readReferenceDoc("toothNotation")} />
    </div>
  );
}
