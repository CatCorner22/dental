import { permanentRedirect } from "next/navigation";

export const runtime = "nodejs";

// Filed notes now live beside drafts on /notes, because they are two states of
// the same thing and "where is that note" should not have two answers.
//
// A permanent redirect rather than a deletion: /history was a top-level nav
// destination for the life of the app, so it is in people's bookmarks and in
// links pasted into chat. Individual submissions are untouched at /history/[id].
export default function HistoryPage() {
  permanentRedirect("/notes?tab=filed");
}
