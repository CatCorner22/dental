import { MarkdownDoc } from "@/components/reference/MarkdownDoc";
import { readReferenceDoc } from "@/lib/content";

export const metadata = { title: "Deployment recommendation" };

// Allowlisted in content.ts and never routed, like the source ledger.
//
// This one is operator content rather than chairside content, and it still
// belongs on a reachable page: the reference section is already behind an auth
// guard, and a document nobody can open is worse than a nav entry a hygienist
// scrolls past.
export default function Page() {
  return <MarkdownDoc markdown={readReferenceDoc("deployment")} />;
}
