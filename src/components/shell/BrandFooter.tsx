import { APP_NAME, COPYRIGHT, PRIVACY_POLICY } from "@/lib/brand";
import { FEEDBACK_EMAIL, feedbackMailto } from "@/lib/feedback";

// The footer carries three things, in descending order of how often someone
// needs them: what the tool is and is not, how to reach the developer, and the
// legal line. The legal line sits last and is visually quietest — always
// present, never shouting.
export function BrandFooter() {
  return (
    <footer className="mx-auto max-w-7xl px-4 pb-8 pt-6 text-xs leading-relaxed text-slate-500">
      <p>
        {APP_NAME} standardizes documentation wording and order. It is deterministic — it makes no
        AI calls and stores no patient data. It does not diagnose, select treatment, calculate
        doses, assign billing codes, or determine discharge readiness. A licensed clinician must
        compare every fact with the source record, resolve every audit finding, and sign in the
        EDR. Reference summaries are internal training aids, not legal advice.
      </p>
      {/* The login reminder is dismissible, so the route to the developer has
          to survive it being dismissed. */}
      <p className="mt-3">
        Support, upgrade requests, ideas and suggestions, or a bug to report?{" "}
        <a
          href={feedbackMailto()}
          className="tap rounded font-semibold text-brand-blue underline underline-offset-2 hover:text-brand-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
        >
          Send feedback
        </a>{" "}
        <span className="text-slate-500">({FEEDBACK_EMAIL})</span>
      </p>
      <p className="mt-4 border-t border-slate-200 pt-3 text-slate-500">
        {COPYRIGHT} {PRIVACY_POLICY}
      </p>
    </footer>
  );
}
