// VOICE ENROLLMENT GATE — read-only practice before dictation may mutate text.
//
// First deliverable posture: the writer must speak with the software for
// 3–5 minutes while transcripts stay PREVIEW-ONLY. Nothing is written into a
// note, standardize input, or draft. Completion unlocks apply-mode dictation
// on this browser for this username.
//
// "Training the software on the user's voice" here means: a sustained English
// recognition session with regional + dental prompts so the browser engine
// adapts to this speaker, plus a durable unlock record. We do not store audio.

import type { UsaRegionId } from "./regional";

/**
 * Frozen contract — bump when unlock rules or min duration change.
 *
 * 2.0.0 shortened the session and moved the record onto the user row. Any
 * 1.0.0 record in a browser's localStorage is deliberately not honoured: it
 * proves a session that met the OLD rule on ONE browser, and the thing being
 * asserted now is a person-level fact. Re-enrolling costs ninety seconds.
 */
export const DICTATION_ENROLLMENT_VERSION = "2.0.0";

/**
 * Minimum active listening before unlock may complete.
 *
 * Was three minutes, on the theory that the engine adapts to the speaker.
 * Chrome's speech service does no per-speaker adaptation from a web page —
 * there is no profile to train and nothing is persisted on the vendor side by
 * this app. What the session actually buys is real: the writer finds out
 * whether the microphone works, hears how the engine handles dental words,
 * and reads prompts that seed the grammar hint list. Ninety seconds buys all
 * of that. Three minutes bought the same thing and then charged for it again
 * on the next computer.
 */
export const ENROLLMENT_MIN_MS = 90 * 1000;
/** Target session length shown to the writer. */
export const ENROLLMENT_TARGET_MS = 2 * 60 * 1000;
/** Soft ceiling — session auto-stops; unlock already allowed after MIN. */
export const ENROLLMENT_MAX_MS = 4 * 60 * 1000;
/** Need enough final utterances so a silent mic cannot unlock. */
export const ENROLLMENT_MIN_UTTERANCES = 8;
/** Distinct script prompts the writer should cover. */
export const ENROLLMENT_MIN_PROMPTS = 6;

export interface EnrollmentRecord {
  version: typeof DICTATION_ENROLLMENT_VERSION;
  username: string;
  region: UsaRegionId;
  completedAt: string; // ISO
  listenedMs: number;
  utterances: number;
  promptsCompleted: number;
}

export interface EnrollmentProgress {
  listenedMs: number;
  utterances: number;
  promptsCompleted: number;
  region: UsaRegionId;
}

export function enrollmentStorageKey(username: string): string {
  return `smile-notes.dictation-enroll.v1.${username}`;
}

export function canCompleteEnrollment(p: EnrollmentProgress): boolean {
  return (
    p.listenedMs >= ENROLLMENT_MIN_MS &&
    p.utterances >= ENROLLMENT_MIN_UTTERANCES &&
    p.promptsCompleted >= ENROLLMENT_MIN_PROMPTS
  );
}

export function enrollmentRemainingMs(listenedMs: number): number {
  return Math.max(0, ENROLLMENT_MIN_MS - listenedMs);
}

export function enrollmentPercent(listenedMs: number): number {
  return Math.min(100, Math.round((listenedMs / ENROLLMENT_TARGET_MS) * 100));
}

export function readEnrollment(
  username: string,
  storage: Pick<Storage, "getItem"> | null = typeof localStorage !== "undefined" ? localStorage : null
): EnrollmentRecord | null {
  if (!storage || !username) return null;
  try {
    const raw = storage.getItem(enrollmentStorageKey(username));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EnrollmentRecord>;
    if (parsed.version !== DICTATION_ENROLLMENT_VERSION) return null;
    if (parsed.username !== username) return null;
    if (typeof parsed.completedAt !== "string") return null;
    if (typeof parsed.listenedMs !== "number" || parsed.listenedMs < ENROLLMENT_MIN_MS) return null;
    if (typeof parsed.utterances !== "number" || parsed.utterances < ENROLLMENT_MIN_UTTERANCES) {
      return null;
    }
    if (
      typeof parsed.promptsCompleted !== "number" ||
      parsed.promptsCompleted < ENROLLMENT_MIN_PROMPTS
    ) {
      return null;
    }
    if (typeof parsed.region !== "string") return null;
    return parsed as EnrollmentRecord;
  } catch {
    return null;
  }
}

export function writeEnrollment(
  record: EnrollmentRecord,
  storage: Pick<Storage, "setItem"> | null = typeof localStorage !== "undefined" ? localStorage : null
): void {
  if (!storage) return;
  storage.setItem(enrollmentStorageKey(record.username), JSON.stringify(record));
}

export function clearEnrollment(
  username: string,
  storage: Pick<Storage, "removeItem"> | null = typeof localStorage !== "undefined" ? localStorage : null
): void {
  if (!storage || !username) return;
  storage.removeItem(enrollmentStorageKey(username));
}

export function isDictationUnlocked(username: string): boolean {
  return readEnrollment(username) !== null;
}

export function completeEnrollment(
  username: string,
  progress: EnrollmentProgress,
  now = new Date()
): EnrollmentRecord | null {
  if (!username || !canCompleteEnrollment(progress)) return null;
  const record: EnrollmentRecord = {
    version: DICTATION_ENROLLMENT_VERSION,
    username,
    region: progress.region,
    completedAt: now.toISOString(),
    listenedMs: progress.listenedMs,
    utterances: progress.utterances,
    promptsCompleted: progress.promptsCompleted
  };
  writeEnrollment(record);
  return record;
}
