// BYTESTAR OPT-IN — per device, because the disclaimer is a decision about
// THIS screen's use of an experimental pioneer, not a property of the account.
// Mirrors displayPrefs: junk-tolerant, private-mode safe, no server round-trip.

export interface ByteStarPrefs {
  /** User has opted into the pioneer path on this device. */
  optedIn: boolean;
  /** User has acknowledged the experimental disclaimer. Required before opt-in sticks. */
  disclaimerAcked: boolean;
  /** ISO timestamp of the acknowledgment, for the transparent log on first use. */
  ackedAt: string | null;
}

export const DEFAULT_BYTESTAR_PREFS: ByteStarPrefs = {
  optedIn: false,
  disclaimerAcked: false,
  ackedAt: null
};

export const BYTESTAR_PREFS_KEY = "smilenotes.bytestar";

/** Exact disclaimer copy the owner commissioned. Do not paraphrase. */
export const BYTESTAR_DISCLAIMER =
  "ByteStar is an experimental, pioneer LLM with ML capabilities. Users who opt in must be aware that they are responsible for their notes, and that ByteStar is for general informational purposes only. While intended to be helpful and to serve as a guide, a NorthStar, a ByteStar if you will, artificial intelligence programs might make mistakes, so you cannot rely on ByteStar as your only resource.";

export function parseByteStarPrefs(raw: string | null | undefined): ByteStarPrefs {
  if (!raw) return DEFAULT_BYTESTAR_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<ByteStarPrefs>;
    const disclaimerAcked = parsed.disclaimerAcked === true;
    const optedIn = parsed.optedIn === true && disclaimerAcked;
    const ackedAt =
      typeof parsed.ackedAt === "string" && parsed.ackedAt.length > 0 ? parsed.ackedAt : null;
    return { optedIn, disclaimerAcked, ackedAt };
  } catch {
    return DEFAULT_BYTESTAR_PREFS;
  }
}

export function serializeByteStarPrefs(prefs: ByteStarPrefs): string {
  return JSON.stringify(prefs);
}

export function readByteStarPrefs(): ByteStarPrefs {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_BYTESTAR_PREFS;
    return parseByteStarPrefs(localStorage.getItem(BYTESTAR_PREFS_KEY));
  } catch {
    return DEFAULT_BYTESTAR_PREFS;
  }
}

export function writeByteStarPrefs(prefs: ByteStarPrefs): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(BYTESTAR_PREFS_KEY, serializeByteStarPrefs(prefs));
  } catch {
    // Private mode: opt-in simply does not persist. Session stays on Byte.
  }
}

/** Opt in only after the disclaimer is acknowledged. */
export function optInByteStar(now: Date = new Date()): ByteStarPrefs {
  const next: ByteStarPrefs = {
    optedIn: true,
    disclaimerAcked: true,
    ackedAt: now.toISOString()
  };
  writeByteStarPrefs(next);
  return next;
}

export function optOutByteStar(): ByteStarPrefs {
  const next: ByteStarPrefs = {
    ...DEFAULT_BYTESTAR_PREFS,
    disclaimerAcked: false,
    ackedAt: null,
    optedIn: false
  };
  writeByteStarPrefs(next);
  return next;
}
