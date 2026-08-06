/**
 * The name a draft gives itself.
 *
 *     20260806_AmandaReagan_ParkWest_0430
 *     └─ date   └─ who      └─ where  └─ when it was started
 *
 * "Untitled note" was the name of every draft anybody had ever started, which
 * made the drafts list a column of identical rows and made a filed note's
 * filename carry nothing. Four facts are known the moment a draft exists — the
 * day, the person, the place, and the time — and every one of them is something
 * a person scanning a list is actually trying to match on.
 *
 * EASTERN TIME, deliberately. The practice is in Tennessee and the rest of the
 * record is stamped in Eastern (see lib/tickets/etTime.ts); a title generated
 * from a laptop's own zone would sort a note into a different day from the
 * submission stamp on that same note.
 *
 * NOT AN IDENTIFIER. The parts are a staff member's own name and their office —
 * never the patient's. That distinction is what lets this string be a filename,
 * appear in an email subject and sit in a list, all of which the PHI rules
 * forbid for anything patient-derived.
 */

/**
 * Strip a human name or place down to something that survives being a
 * filename: letters and digits, each word capitalised, run together.
 *
 *   "Amanda Reagan"        -> "AmandaReagan"
 *   "Park West"            -> "ParkWest"
 *   "O'Brien-Smith"        -> "OBrienSmith"
 *   "Cornerstone Dental #2" -> "CornerstoneDental2"
 *
 * Accents are folded rather than dropped, so "Núñez" becomes "Nunez" and not
 * "Nez" — losing letters out of somebody's name is worse than losing the mark.
 */
export function slugPart(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");
}

const ET_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

/** `{ date: "20260806", time: "0430" }` for a moment, in Eastern time. */
export function easternStamp(now: Date): { date: string; time: string } {
  const parts = ET_PARTS.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  let hour = get("hour");
  if (hour === "24") hour = "00"; // some engines emit 24 for midnight
  return { date: `${get("year")}${get("month")}${get("day")}`, time: `${hour}${get("minute")}` };
}

/** What a draft is called when nobody has named it. */
export const UNTITLED = "Untitled note";

export function autoDraftTitle(input: {
  now: Date;
  /** The author's display name. */
  displayName: string;
  /**
   * The office, when one is known. Drafts can be started before an office is
   * picked — the note bar's select begins empty — so this is optional and the
   * segment is simply left out rather than filled with "Unknown", which would
   * read as a recorded fact about the visit.
   */
  officeName?: string | null;
}): string {
  const { date, time } = easternStamp(input.now);
  const who = slugPart(input.displayName) || "Unnamed";
  const where = input.officeName ? slugPart(input.officeName) : "";
  return [date, who, where, time].filter(Boolean).join("_");
}

/**
 * Whether a title is one this function produced (or the old placeholder), and
 * may therefore be regenerated.
 *
 * This is the whole reason auto-titling is safe. An office is usually chosen a
 * moment AFTER the draft exists, so the title has to be rebuilt once it is —
 * but only when the writer has not named the note themselves. Anything a person
 * typed is theirs and is never overwritten.
 */
export function isAutoTitle(title: string): boolean {
  const t = title.trim();
  if (t === "" || t === UNTITLED) return true;
  // date _ Name [_ Place] _ time
  return /^\d{8}_[A-Za-z0-9]+(_[A-Za-z0-9]+)?_\d{4}$/.test(t);
}

/**
 * Put the office into a title that was generated before one was picked.
 *
 * Rebuilds from the EXISTING date and time rather than from the clock. The last
 * segment is the time the note was STARTED, and an office is typically chosen a
 * minute or two later — regenerating from `now` would quietly restamp the note
 * as beginning whenever the select was touched, which is the one fact in the
 * title somebody might later rely on.
 *
 * Returns the title unchanged when a person named the note themselves.
 */
export function withOffice(title: string, officeName: string | null | undefined): string {
  if (!isAutoTitle(title)) return title;
  const m = /^(\d{8})_([A-Za-z0-9]+)(?:_[A-Za-z0-9]+)?_(\d{4})$/.exec(title.trim());
  if (!m) return title; // "Untitled note" / empty — nothing to preserve
  const where = officeName ? slugPart(officeName) : "";
  return [m[1], m[2], where, m[3]].filter(Boolean).join("_");
}
