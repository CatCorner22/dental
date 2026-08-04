import { Resend } from "resend";
import { getEmailConfig } from "./config";
import type { WatchSweep } from "@/lib/law/watch";

// LAW-WATCH ALERT MAIL — the weekly sweep, pushed instead of polled.
//
// Recipient comes only from the server environment (same rule as submission
// mail: no request chooses a recipient). Content is source names, signal
// counts, and links to official pages — public information about the law,
// never anything about a patient or a note.

export type AlertOutcome = { attempted: false } | { attempted: true; sent: boolean };

export async function sendLawWatchAlert(sweep: WatchSweep): Promise<AlertOutcome> {
  const config = getEmailConfig();
  if (!config.configured) return { attempted: false };

  const signaling = sweep.sources.filter((s) => s.items.length > 0 || s.keywordHits > 0);
  const failed = sweep.sources.filter((s) => s.status === "fetch-failed");

  const lines: string[] = [
    "Smile Notes legal watch — weekly sweep.",
    "",
    signaling.length === 0
      ? "No dental-relevant signals this week."
      : `${signaling.length} source(s) show dental-relevant signals:`,
    ""
  ];
  for (const s of signaling) {
    lines.push(`- ${s.label} (${s.keywordHits} keyword signals): ${s.url}`);
    for (const item of s.items) {
      lines.push(`    · ${item.title} — ${item.whyRelevant}`);
    }
  }
  if (failed.length > 0) {
    lines.push("", `Unreachable this run: ${failed.map((s) => s.label).join(", ")}.`);
  }
  lines.push(
    "",
    "Signals are pointers to the primary source, never a substitute for reading it.",
    "Review on the Tennessee law page; nothing in the app changes without human review."
  );

  try {
    const resend = new Resend(config.apiKey);
    const { error } = await resend.emails.send({
      from: config.from as string,
      to: [config.corporateEmail as string],
      subject: `Smile Notes legal watch — ${signaling.length > 0 ? `${signaling.length} source(s) with signals` : "no signals"}`,
      text: lines.join("\n")
    });
    if (error) console.error("law-watch alert email failed:", error.name ?? "error");
    return { attempted: true, sent: !error };
  } catch {
    console.error("law-watch alert email threw");
    return { attempted: true, sent: false };
  }
}
