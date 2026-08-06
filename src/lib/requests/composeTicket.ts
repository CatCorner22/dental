import { CHECKLIST, CYCLES, type GauntletAnswers } from "./gauntlet";

// Render a cleared request as the plain-text ticket the Smile Notes Team reads.
// Plain text on purpose: it survives every mail client, quotes cleanly in a
// reply, and cannot smuggle markup into someone's inbox.
export function composeTicket(
  input: GauntletAnswers,
  meta: { requestedBy: string; requestedAtEt: string }
): string {
  const lines: string[] = [];
  lines.push("Smile Notes — data change request");
  lines.push("Cleared all five sterilization cycles of the Data Hygiene Gauntlet.");
  lines.push("");
  lines.push(`Ask:          ${input.summary.trim()}`);
  lines.push(`Change type:  ${input.changeType.trim()}`);
  lines.push(`Requested by: ${meta.requestedBy}`);
  lines.push(`Requested at: ${meta.requestedAtEt}`);
  lines.push(`Data owner:   ${input.dataOwner.trim()}`);
  lines.push(`Downstream:   ${input.downstream.join(", ")}`);
  lines.push("");
  lines.push("─".repeat(64));
  lines.push("The five cycles");
  lines.push("─".repeat(64));
  for (const cycle of CYCLES) {
    lines.push("");
    lines.push(`Cycle ${cycle.n} — ${cycle.title}`);
    lines.push(cycle.prompt);
    lines.push("");
    lines.push(indent((input.answers[cycle.id] ?? "").trim()));
  }
  lines.push("");
  lines.push("─".repeat(64));
  lines.push("Pre-flight checklist");
  lines.push("─".repeat(64));
  for (const item of CHECKLIST) {
    lines.push(`  [${input.checklist[item.id] ? "x" : " "}] ${item.label}`);
  }
  lines.push("");
  lines.push(
    "This request was gated in-app: every cycle had to be answered specifically,"
  );
  lines.push(
    "with a measurable gain and a named workflow choke point, before it could be sent."
  );
  return lines.join("\n");
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n");
}
