"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { FEEDBACK_EMAIL, feedbackMailto } from "@/lib/feedback";

// Shown once per browser until dismissed. Login used to clear a sessionStorage
// key on every sign-in, which re-armed a modal gauntlet before the note —
// hostile for shared-clinic go-live testing. localStorage keeps the reminder
// available without forcing it every shift change.
const SEEN_KEY = "dnb.feedback.seen.v1";

/** No-op retained so LoginForm's call site stays stable across deploys. */
export function markFeedbackNoticeUnseen(): void {
  // Intentionally empty: re-arming every login fought chairside first paint.
}

export function FeedbackNotice({ enabled }: { enabled: boolean }) {
  // Starts closed and opens from an effect: localStorage does not exist
  // during SSR, so deciding this at render time would produce markup the
  // client disagrees with and React would throw a hydration mismatch.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // Storage unavailable — show it. Reminding twice is a smaller failure
      // than never reminding at all.
    }
    if (!seen) setOpen(true);
  }, [enabled]);

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* see above — dismissal still works for this view */
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <Dialog title="Your feedback shapes this tool" onClose={dismiss}>
      <div className="space-y-4">
        {/* The caution band carries the eye. Colour is never the only signal —
            the icon and the heading say the same thing for anyone who cannot
            distinguish it, or who prints the screen. */}
        <div className="flex gap-3 rounded-lg border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-400 text-lg font-bold text-amber-950 shadow-inner"
          >
            !
          </span>
          <div className="min-w-0 space-y-2 text-sm leading-relaxed text-amber-950">
            <p className="text-base font-bold tracking-tight">Heads up — we want to hear from you</p>
            <p>
              Send feedback{" "}
              <a
                href={feedbackMailto()}
                className="rounded font-bold text-amber-900 underline decoration-amber-500 decoration-2 underline-offset-2 hover:bg-amber-200 hover:text-amber-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              >
                here
              </a>{" "}
              for support, upgrade requests, ideas and suggestions, and to report bugs.
            </p>
          </div>
        </div>

        {/* The raw address, selectable, for anyone whose device has no mail
            client wired to mailto: — a shared clinic workstation often does
            not, and a dead link would otherwise be the end of the road. */}
        <p className="text-xs text-slate-500">
          No mail app? Write to{" "}
          <span className="select-all font-mono font-semibold text-slate-700">
            {FEEDBACK_EMAIL}
          </span>
          .
        </p>

        <p className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
          Please keep feedback free of patient identifiers, exactly like the notes themselves.
        </p>
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {/* Optional path — dismiss without mailing. Same once-per-browser mark
            as Got it so go-live testers are not trapped in a support gauntlet. */}
        <button type="button" className="btn-secondary" onClick={dismiss}>
          Not now
        </button>
        <a href={feedbackMailto()} className="btn-primary text-center" onClick={dismiss}>
          Send feedback
        </a>
      </div>
    </Dialog>
  );
}
