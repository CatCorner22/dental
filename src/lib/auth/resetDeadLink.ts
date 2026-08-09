// The dead-reset-link sentinel, in ONE place.
//
// The /api/reset route answers every token failure — expired, already used,
// never existed, deactivated account — with a single deliberately vague
// sentence, so nobody can probe which links are real. ResetForm keys its
// terminal "stop typing, this link will never work" panel off that same
// sentence. Until this module existed the two sides were coupled by a regex
// in one file matching a string literal in another: rewording the route's
// copy would have silently turned the terminal panel back into a retryable
// red line under a form that can never succeed.
export const RESET_LINK_DEAD_MESSAGE = "This link is no longer valid. Ask for a new one.";

/** Does a reset-route error mean the token itself is dead (vs. e.g. a password-policy refusal)? */
export function isResetLinkDeadMessage(message: string | undefined): boolean {
  return message === RESET_LINK_DEAD_MESSAGE;
}
