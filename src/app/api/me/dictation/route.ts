import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { readJsonRecord } from "@/lib/http/readJson";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isUsaRegionId, type UsaRegionId } from "@/lib/dictation/regional";

export const runtime = "nodejs";

// DICTATION ENROLLMENT, RECORDED AGAINST THE PERSON.
//
// What is stored: that the read-aloud practice session happened, when, and
// which regional prompt set was used to boost the recognizer. That is all.
//
// What is NOT stored, here or anywhere: audio, transcripts, or any sample of
// the writer's voice. The enrollment session is preview-only by construction
// (see VoiceEnrollment) and nothing it hears is retained after the session
// closes. This route could not leak a recording because it is never sent one.
//
// The counts the client reports are its own evidence that the session really
// ran, so the server re-checks them against the same thresholds rather than
// trusting the word "done" from a page it does not control.

export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;

  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const { listenedMs, utterances, promptsCompleted, region } = parsed.value as Record<
    string,
    unknown
  >;

  // Re-check the unlock rule server-side. The thresholds are imported so this
  // cannot drift from the client's own gate — one definition, checked twice.
  const { canCompleteEnrollment } = await import("@/lib/dictation/enrollment");
  const progress = {
    listenedMs: typeof listenedMs === "number" ? listenedMs : 0,
    utterances: typeof utterances === "number" ? utterances : 0,
    promptsCompleted: typeof promptsCompleted === "number" ? promptsCompleted : 0,
    region: (isUsaRegionId(region) ? region : "general") as UsaRegionId
  };
  if (!canCompleteEnrollment(progress)) {
    return Response.json(
      { error: "That practice session is too short to finish enrollment." },
      { status: 400 }
    );
  }

  const db = await getDb();
  await db
    .update(users)
    .set({ dictationEnrolledAt: new Date(), dictationRegion: progress.region })
    .where(eq(users.id, guard.user.id));

  return Response.json({ enrolled: true, region: progress.region });
}

// Clearing it is the writer's own to do — "set it up again on a better
// microphone" needs a way back, and an enrollment nobody can undo is a setting
// that can only ever be wrong once.
export async function DELETE(): Promise<Response> {
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;
  const db = await getDb();
  await db
    .update(users)
    .set({ dictationEnrolledAt: null, dictationRegion: null })
    .where(eq(users.id, guard.user.id));
  return Response.json({ enrolled: false });
}
