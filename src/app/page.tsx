import { redirect } from "next/navigation";
import { canWriteNote, seesAllNotes } from "@/lib/auth/roles";
import { freshSessionUser } from "@/lib/auth/freshUser";
import { getDb } from "@/lib/db/client";
import {
  insertDraft,
  listAllDrafts,
  listDraftsByOwner,
  newestOpenDraftForOwner,
  ownerDraftCount,
  countAllDrafts
} from "@/lib/db/repo/drafts";
import { getOffice, officesForPicker } from "@/lib/db/repo/offices";
import { edrProductShort } from "@/lib/edr/product";
import { listUsers } from "@/lib/db/repo/users";
import { formatEasternTime } from "@/lib/tickets/etTime";
import { BuilderShell } from "@/components/builder/BuilderShell";
import { GreetingBar } from "@/components/dashboard/GreetingBar";
import { HomeAside } from "@/components/dashboard/HomeAside";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { ReadOnlyHome } from "@/components/dashboard/ReadOnlyHome";
import type { DraftStatus } from "@/lib/status/draftStatus";

export const runtime = "nodejs";
export const metadata = { title: "Notes" };

// HOME IS THE NOTE.
//
// It used to be a dashboard: an onboarding card, a greeting row with two
// buttons and a popover, four quick-pick tiles, a resume strip, a draft list
// with its own search box and filter chips, and a word-map accordion —
// somewhere between 1,900 and 2,400 pixels before the work started. Three
// clicks and a scroll stood between signing in and a cursor in a field, and the
// first clinical control was an eleven-option dropdown.
//
// Now the builder is the page. The draft is resolved HERE, on the server,
// before anything renders: resume the newest open note, or create one. That
// ordering matters more than it looks — the alternative, mounting an unsaved
// builder and creating the row on the first keystroke, breaks in three ways at
// once. useAutosave closes over the draft id, so a save that starts before the
// row exists PATCHes /api/drafts/ and retries the 404 forever; BuilderShell is
// keyed on `${id}:${version}`, so navigating after the create remounts it from
// the server's empty note and discards everything typed in between; and the
// unsaved-work guard would fire on the front door of the app. Losing the first
// sentence of a clinical note is the worst outcome available here, and a server
// render costs nothing next to it.
export default async function HomePage() {
  const user = await freshSessionUser(); // fresh role/active — never the stale token
  if (!user) redirect("/login");
  const db = await getDb();
  const canEdit = user.role !== "readonly";

  // Recent notes for the aside. Bounded, and the total comes back too, so the
  // "see all" link can say how many there are instead of implying this is all.
  const mine = !seesAllNotes(user.role);
  const recent = mine ? await listDraftsByOwner(db, user.id) : await listAllDrafts(db);
  const totalDrafts = mine ? await ownerDraftCount(db, user.id) : await countAllDrafts(db);
  const ownerNames: Record<string, string> = {};
  if (user.role !== "user") {
    for (const u of await listUsers(db)) ownerNames[u.id] = u.displayName;
  }
  const recentRows = recent.slice(0, 3).map((d) => ({
    id: d.id,
    title: d.title,
    status: d.status as DraftStatus,
    ownerName: ownerNames[d.ownerId],
    // Pre-formatted on the server (Eastern time, like every other timestamp in
    // the app) so SSR and hydration render identical text — toLocaleString() in
    // the client would use the SERVER's zone during SSR and the browser's
    // after, a hydration mismatch on every row.
    updatedAtLabel: formatEasternTime(d.updatedAt)
  }));

  // A read-only account cannot author a note, so there is no builder to show
  // them and no draft to create on their behalf.
  if (!canEdit) {
    return (
      <div className="space-y-6">
        <GreetingBar displayName={user.displayName} />
        <ReadOnlyHome recent={recentRows} totalDrafts={totalDrafts} />
      </div>
    );
  }

  let draft = await newestOpenDraftForOwner(db, user.id);
  if (!draft) {
    draft = await insertDraft(db, {
      id: crypto.randomUUID(),
      ownerId: user.id,
      noteState: { selectedModuleIds: [], values: {} },
      title: "Untitled note"
    });
  }

  // Only ACTIVE offices are offered for a new choice; a note already recorded
  // at a since-retired office keeps that value and still displays it, because
  // where care happened is a fact about the past, not a current setting.
  const active = await officesForPicker(db, user.id);
  const current = draft.officeId ? await getOffice(db, draft.officeId) : undefined;
  const offices =
    current && !active.some((o) => o.id === current.id) ? [...active, current] : active;

  return (
    <div className="space-y-5">
      <GreetingBar displayName={user.displayName} />
      <OnboardingChecklist username={user.username} />
      <BuilderShell
        // Keyed by version: "Reload latest" calls router.refresh(), and without
        // a key change the client state (including an open conflict) survives —
        // the advertised recovery path would reload nothing.
        key={`${draft.id}:${draft.version}`}
        draftId={draft.id}
        initialTitle={draft.title}
        initialOfficeId={draft.officeId ?? null}
        clinicalRole={user.clinicalRole}
        offices={offices.map((o) => ({ id: o.id, name: o.name }))}
        initialNote={draft.noteState}
        initialVersion={draft.version}
        initialSubmitted={draft.status === "submitted"}
        initialSendFailed={draft.lastSendFailed}
        canEdit={canWriteNote(user.role, draft.ownerId, user.id)}
        edrName={edrProductShort()}
        username={user.username}
        // The one thing the home page does that /note/[id] does not: land the
        // cursor. Time-to-first-editable-field is the metric this whole page
        // exists to move, and it is zero only if something is focused.
        //
        // "What the patient reports" rather than the field above it: a visit
        // note starts with why they are here. Safety sits first in the section
        // because a safety fact outranks everything when the note is read BACK,
        // which is a different question from where writing begins.
        autoFocusKey="universal-core.narrative-subjective"
      />
      <HomeAside
        recent={recentRows}
        totalDrafts={totalDrafts}
        clinicalRole={user.clinicalRole}
        currentDraftId={draft.id}
      />
    </div>
  );
}
