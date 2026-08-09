// Draft-conflict drive — integer optimistic concurrency on drafts.version → 409
// → ConflictDialog, driven live across two browser contexts as the SAME account
// (canWriteNote = admin || owner, so both may edit one draft). Batch 10 pinned
// the dialog's contract in jsdom; this proves the whole chain fires against a real
// server, and exercises BOTH resolutions:
//   "Keep editing here" — adopts the server version; B's next save overwrites A's
//                         (last-writer-wins, by design);
//   "Reload latest"     — remounts the note (key={id:version}) and shows the
//                         server's latest text, not the stale local draft.
// Finale (transfer × conflict × 403): a NON-admin former owner whose draft is
// transferred away hits 403 "You cannot edit this draft." on the very next save —
// that plain sentence must reach SaveIndicator verbatim, with no wire-format words
// or status codes on screen.
//
// Requires a freshly-booted server (empty in-memory DB) with the smoke admin.
//   BASE_URL=http://127.0.0.1:3000 node e2e/conflict.mjs
import { chromium } from "playwright";
import { signIn, dismiss } from "./_noteSeed.mjs";
const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";

const failures = [];
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"}  ${l}`); if (!c) failures.push(l); };
const browser = await chromium.launch();

async function openNote(draftId) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await signIn(page, BASE);
  await page.goto(`${BASE}/note/${draftId}`, { waitUntil: "networkidle" });
  await dismiss(page);
  const subj = await page.evaluate(() =>
    ([...document.querySelectorAll("textarea")].find((t) => /subjective/.test(t.id)) || {}).id
  );
  return { ctx, page, subj };
}
// Type, then wait past the 800ms debounce so the autosave PATCH lands.
async function typeAndSave(o, text) {
  await o.page.fill(`[id="${o.subj}"]`, text);
  await o.page.waitForTimeout(1400);
}
const conflictDialog = (page) => page.getByRole("dialog").filter({ hasText: "A newer version of this note exists" });

// A draft to fight over: signed in once to create it via the API.
let draftId;
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, BASE);
  const r = await ctx.request.post(`${BASE}/api/drafts`, { data: { note: { selectedModuleIds: ["universal-core"], values: {} } } });
  draftId = (await r.json()).draft?.id ?? (await (await ctx.request.get(`${BASE}/api/drafts`)).json()).drafts[0].id;
  check(Boolean(draftId), `draft to contend over created (${draftId})`);
  await ctx.close();
}

// Two writers open it at the same version.
const A = await openNote(draftId);
const B = await openNote(draftId);

// A saves → server advances to a version B has not seen.
await typeAndSave(A, "A writes first: tooth 14 sensitivity, one week.");
// B saves against its stale baseVersion → 409 → ConflictDialog.
await typeAndSave(B, "B writes over the top, unaware of A.");
await conflictDialog(B.page).waitFor({ timeout: 8000 }).catch(() => {});
check((await conflictDialog(B.page).count()) > 0, "a stale save raises the ConflictDialog in the second tab");

// It is non-dismissible: ESC and a backdrop click do NOT close it.
await B.page.keyboard.press("Escape");
await B.page.waitForTimeout(300);
check((await conflictDialog(B.page).count()) > 0, "ESC does not dismiss the conflict");
await B.page.mouse.click(5, 5); // outside the panel
await B.page.waitForTimeout(300);
check((await conflictDialog(B.page).count()) > 0, "a backdrop click does not dismiss the conflict");

// "Keep editing here" = last-writer-wins: B adopts the server version and its
// next save overwrites A's.
await B.page.getByRole("button", { name: "Keep editing here" }).click();
await B.page.waitForTimeout(300);
check((await conflictDialog(B.page).count()) === 0, "'Keep editing here' closes the dialog");
await typeAndSave(B, "B insists: this is the version that stands now.");
{
  const server = (await (await A.ctx.request.get(`${BASE}/api/drafts/${draftId}`)).json()).draft;
  const val = JSON.stringify(server.noteState?.values ?? {});
  check(/B insists/.test(val) && !/A writes first/.test(val), "after 'Keep editing here', B's text overwrote A's (last-writer-wins, by design)");
}

// After that round B is current and A is the stale tab (A never refreshed while
// B overwrote). So provoke on A, then exercise "Reload latest": A remounts (key
// change) and shows the server's latest — B's text — not A's stale local draft.
await A.page.fill(`[id="${A.subj}"]`, "A is stale now and tries to save.");
await A.page.waitForTimeout(1400);
await conflictDialog(A.page).waitFor({ timeout: 8000 }).catch(() => {});
check((await conflictDialog(A.page).count()) > 0, "editing from the now-stale tab re-raises the conflict");
await Promise.all([
  A.page.waitForLoadState("networkidle"),
  A.page.getByRole("button", { name: "Reload latest" }).click()
]);
await A.page.waitForTimeout(1500);
check((await conflictDialog(A.page).count()) === 0, "'Reload latest' closes the dialog");
check(
  (await A.page.inputValue(`[id="${A.subj}"]`)).includes("B insists"),
  "'Reload latest' remounts the note and shows the server's latest text (not the stale local draft)"
);

await A.ctx.close();
await B.ctx.close();

// --- Finale: transfer × the autosave error copy. The PATCH route checks
//     ownership BEFORE the version, so a NON-admin former owner whose draft is
//     transferred away hits 403 "You cannot edit this draft." on the very next
//     save — the one path where a save simply cannot succeed. That plain
//     sentence must reach SaveIndicator verbatim, with no wire-format words.
//     (An admin owner would never see this: canWriteNote = admin || owner.)
{
  const setup = await browser.newContext();
  const sp = await setup.newPage();
  await signIn(sp, BASE);
  // A non-admin owner and an admin recipient.
  await setup.request.post(`${BASE}/api/admin/users`, { data: { username: "owner1", displayName: "Owner One", role: "user", password: "owner1-pass-12345" } });
  await setup.request.post(`${BASE}/api/admin/users`, { data: { username: "xfer-admin", displayName: "Xfer Admin", role: "admin", password: "xfer-admin-pass-1" } });
  const users = (await (await setup.request.get(`${BASE}/api/admin/users`)).json()).users;
  const toId = users.find((u) => u.username === "xfer-admin").id;
  const ownerId = users.find((u) => u.username === "owner1").id;
  // A clinical role must be recorded before a user may write (Honest Finish).
  await setup.request.patch(`${BASE}/api/admin/users/${ownerId}`, { data: { clinicalRole: "dentist" } });

  // owner1 opens their own fresh draft.
  const own = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const op = await own.newPage();
  await signIn(op, BASE, "owner1", "owner1-pass-12345");
  const dr = await own.request.post(`${BASE}/api/drafts`, { data: { note: { selectedModuleIds: ["universal-core"], values: {} } } });
  const xid = (await dr.json()).draft?.id ?? (await (await own.request.get(`${BASE}/api/drafts`)).json()).drafts[0].id;
  await op.goto(`${BASE}/note/${xid}`, { waitUntil: "networkidle" });
  await dismiss(op);
  const osubj = await op.evaluate(() => ([...document.querySelectorAll("textarea")].find((t) => /subjective/.test(t.id)) || {}).id);

  // The admin transfers owner1's draft away while owner1's tab is open.
  const xr = await setup.request.post(`${BASE}/api/admin/drafts/${xid}/transfer`, { data: { toUserId: toId } });
  check(xr.ok(), `admin transfers the open draft away from owner1 (${xr.status()})`);

  // owner1 types → autosave → 403 (no longer the owner) → SaveIndicator copy.
  await op.fill(`[id="${osubj}"]`, "The former owner keeps typing, unaware.");
  await op.waitForTimeout(1600);
  const body = ((await op.locator("body").textContent()) ?? "").replace(/\s+/g, " ");
  check(/You cannot edit this draft/.test(body), "the transferred-away owner's save is refused with the plain 403 copy in SaveIndicator");
  // Scope the wire-word check to the save-status region, not the whole page.
  const saveText = (await op.locator('[role="status"], [role="alert"]').allTextContents()).join(" ");
  check(
    /You cannot edit this draft/.test(saveText) && !/baseVersion|noteState|selectedModuleIds|\b4\d\d\b/.test(saveText),
    `the SaveIndicator copy is clean — no wire words or status codes [${(saveText.match(/[^.]*cannot edit[^.]*/) || [""])[0].trim().slice(0, 60)}]`
  );

  await setup.close();
  await own.close();
}

await browser.close();
if (failures.length) { console.error(failures.length + " failure(s)"); process.exit(1); }
console.log("\nAll conflict checks passed.");
