import { Character } from "@/components/mascot/Sparkle";
import { daySeed, sparkleLine } from "@/lib/stats/sparkle";

// THE GREETING — Sparkle and your name, upper left, directly under the tabs.
//
// It is the first thing on the page and it is deliberately small: one line of
// name, one line from Sparkle, and then the work. The old version carried a
// HelpTip explaining the dashboard and sat in a row with two buttons and a
// popover, which made the first thing you saw a control panel rather than a
// hello.
//
// A server component. The line rotates once per UTC day from a fixed table of
// human-written copy — nothing generative, no tracking, and the same line for
// everyone all day, which is what keeps it encouragement rather than a nudge
// aimed at you specifically.
//
// No emoji beside the name. Sparkle is right there being the friendly part.
export function GreetingBar({ displayName }: { displayName: string }) {
  return (
    <div className="flex items-center gap-3">
      <Character id="sparkle" size="md" />
      <div className="min-w-0">
        <h1 className="page-title">Hi {displayName}</h1>
        <p className="text-sm text-slate-600">{sparkleLine("dashboard", daySeed(new Date()))}</p>
      </div>
    </div>
  );
}
