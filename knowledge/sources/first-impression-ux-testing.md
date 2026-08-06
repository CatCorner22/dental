# First-impression UI/UX — relentless testing digest

Ingested: 2026-08-06. Tags: ux, chairside, go-live, testing, first-impression, mobile.

## Why

Shared-clinic go-live fails on the first thirty seconds: false “required” on locked dentist sections, Submit that looks ready then refuses, a feedback modal every sign-in, and empty transfer dialogs that look broken. Relentless component + pure-helper tests are the strategy — redesign is not.

## Shipped this pass

Landed go-live UX hardening (PR #89 cherry-pick) plus honesty / finish-line follow-ups:

| Surface | Change | Test |
|---|---|---|
| Locked Assessment/Plan | “Waiting for dentist” — not “N required” | `NoteForm.test.tsx` |
| Builder finish | Filing authority on Submit; handoff banner; Lead-only Transfer; tablet strip shows top STOP / finish line; unset-role Andon | `finishLine.test.ts` (pure) |
| Feedback notice | Once per browser (`localStorage`); login re-arm is a no-op | `FeedbackNotice.test.tsx` |
| Transfer dialog | Loading / error / empty — never a blank select | `TransferDraftDialog.test.tsx` |
| Submit dialog | Config probe failure ≠ “email not configured” | `SubmitDialog.test.tsx` |
| Login | Developer break-glass collapsed under `<details>` | (page chrome) |
| Action bar | `safe-area-inset-bottom` so Submit clears the home indicator | (CSS) |

## Adversarial cases that must stay green

1. Hygienist + dentist-owned Assessment → summary matches Waiting for dentist, not required.
2. `builderFinishLine({ filingAllowed: false, emailAllowed: true })` never says Ready.
3. Dismiss feedback → remount after `markFeedbackNoticeUnseen()` → still closed.
4. Transfer fetch reject / 403 → alert + disabled Transfer; never silent empty list.
5. Submit-config network reject → “Could not reach…” copy; Submit still enabled after settle.

## Non-goals

- Hygienist self-transfer (policy: Lead+).
- Dashboard redesign, SuperByte density rewrite.
- Broad OnboardingChecklist redesign.
