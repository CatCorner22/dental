import { MarkdownDoc } from "@/components/reference/MarkdownDoc";
import { readReferenceDoc } from "@/lib/content";

export const metadata = { title: "Evidence and sources" };

// This document was allowlisted in content.ts from the beginning and never
// given a route, so nothing in the app could reach it. It is the answer to
// "who says so" — the benchmark findings, the adopted controls, the Tennessee
// primary authorities, and the stated limits of the research behind every rule
// the tool enforces. Leaving the strongest provenance content in the repo
// unreachable meant the tool could assert a standard without ever showing its
// working.
export default function Page() {
  return <MarkdownDoc markdown={readReferenceDoc("sourceLedger")} />;
}
