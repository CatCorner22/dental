// Threading tokens for filed Smile Notes.
//
// The goal: every email about one filed note — the original and any resend
// after a send failure — lands in ONE conversation in the corporate mailbox,
// so a reader sees the whole history of a ticket in one place.
//
// WHY THIS IS NOT INITIALS AND A YEAR OF BIRTH.
//
// A token built from a patient's initials and birth year is a patient
// identifier. Under the HIPAA Safe Harbor method, dates connected to an
// individual and any "unique identifying number, characteristic, or code" have
// to come out for data to count as de-identified — and initials plus a birth
// year is precisely a unique characteristic-plus-date. It is also strong enough
// to re-identify in a small practice: in a three-office Knoxville practice
// there is usually exactly one "JRB-1974". Putting that in a SUBJECT LINE is
// the worst available place for it, because subject lines are transmitted in
// the clear between mail servers, copied into bounce messages and out-of-office
// replies, indexed by mail search, and shown in phone notification previews on
// a locked screen.
//
// Hiding it as white text does not help and makes it worse. Subject lines carry
// no formatting at all — they are plain text by RFC 5322, so "white text" has
// nothing to render it and the value would simply show. Even where a body can
// be styled, invisible-but-present data is still fully present: it is copied,
// searched, and read by every automated system in the path, while the humans
// who might have caught the mistake are the only ones who cannot see it.
//
// So the token is RANDOM and carries nothing. Threading does not need to know
// who the patient is — it only needs a stable, unique string per note, which
// the ticket already is.

/** RFC 5322 addr-spec-safe domain taken from the configured sender. */
function domainFrom(sender: string | undefined): string {
  const at = sender?.lastIndexOf("@") ?? -1;
  const raw = at >= 0 ? sender!.slice(at + 1) : "";
  // Strip a display-name wrapper: "Notes <notes@x.com>" leaves "x.com>".
  const cleaned = raw.replace(/[>\s].*$/, "").trim().toLowerCase();
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(cleaned) ? cleaned : "smile-notes.invalid";
}

/**
 * Only the LEADING ticket-shaped run, bounded.
 *
 * Stripping the disallowed characters is what actually blocks header
 * injection — a CR or LF in a header value is the whole attack. But stripping
 * alone would fold "DN-1\r\nBcc: attacker@evil.com" into the single token
 * "DN-1Bccattackerevil.com" and carry the attacker's text along inside a
 * well-formed id. Taking the leading run instead yields "DN-1": the ticket,
 * and nothing else.
 */
function safeTicket(ticket: string): string {
  return (ticket.match(/^[A-Za-z0-9._-]+/)?.[0] ?? "unknown").slice(0, 64);
}

/**
 * The conversation root for a ticket. Stable across the original send and
 * every later resend, which is what actually makes them thread.
 */
export function threadRootId(ticket: string, sender?: string): string {
  return `<smile-note-${safeTicket(ticket)}@${domainFrom(sender)}>`;
}

/**
 * A unique id for THIS message. Every send needs its own, or a resend looks
 * like a duplicate of the original and some servers drop it silently.
 */
export function messageId(ticket: string, attempt: number, sender?: string): string {
  const attemptN = Number.isFinite(attempt) ? Math.max(0, Math.trunc(attempt)) : 0;
  return `<smile-note-${safeTicket(ticket)}-${attemptN}@${domainFrom(sender)}>`;
}

// An index signature as well as the named keys: Resend's `headers` parameter
// takes a Record<string, string>, and a closed interface is not assignable to
// it even though every value is a string.
export interface ThreadHeaders extends Record<string, string> {
  "Message-ID": string;
  References: string;
}

/**
 * Headers that put a ticket's messages in one conversation.
 *
 * `attempt` is 0 for the original send and increments for each resend. The
 * original IS the thread root; a resend points back at it, which is what mail
 * clients actually group on.
 */
export function threadHeaders(
  ticket: string,
  attempt: number,
  sender?: string
): ThreadHeaders {
  const root = threadRootId(ticket, sender);
  if (attempt <= 0) {
    return { "Message-ID": root, References: root };
  }
  return {
    "Message-ID": messageId(ticket, attempt, sender),
    References: root,
    "In-Reply-To": root
  };
}

/**
 * The human-visible thread token in the subject.
 *
 * The ticket is already a random, opaque, practice-unique string, so it is the
 * token — inventing a second identifier beside it would give staff two things
 * to quote and no benefit. Bracketed so it survives "Re:" and "Fwd:" prefixes
 * and stays greppable in a mail client's search box.
 */
export function subjectToken(ticket: string): string {
  return `[${ticket}]`;
}

/** Subject line for a filed note. Identical across resends, so subject-based
 *  threading works even in clients that ignore References. */
export function submissionSubject(ticket: string, auditStatus: string): string {
  return `Smile Note ${subjectToken(ticket)} — ${auditStatus}`;
}
