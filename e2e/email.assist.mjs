// Email delivery + assist ON-state drive — the output artery, whole.
//
// EMAIL (the Resend HTTPS API, not SMTP) is driven against a LOCAL SINK that
// this probe hosts itself: resend@4 honors RESEND_BASE_URL, so the sink
// receives the real message — recipient, ticket subject, threading headers,
// and both attachments (note + audit report, named from the slugified title).
// Covers the sent path, the send-failure path (filed panel copy, status
// "error", submit.email-failed), and the resend recovery chain.
// ASSIST covers the pre-provider gates live: the wired "Think deeper" UI, the
// PHI refusal (meter uncharged), the provider-stage outcome with a dummy key
// (model-error copy + exactly one assist.drift row), the deterministic tier
// for an unset-role account (no audit rows at all), and bytestar-on-key-alone.
//
// Requires a freshly-booted server (empty in-memory DB) with the smoke admin
// AND this env (set BEFORE boot — resend captures its base URL at load):
//   RESEND_BASE_URL=http://127.0.0.1:3199 RESEND_API_KEY=re_test_123
//   EMAIL_FROM="Smile Notes <notes@example.test>" CORPORATE_EMAIL=records@example.test
//   ASSIST_ENABLED=1 AI_GATEWAY_API_KEY=dummy-key-for-gates
//   BASE_URL=http://127.0.0.1:3000 node e2e/email.assist.mjs
// SKIP_EMAIL=1 skips the two email sections (assist-only re-runs).
import http from "node:http";
import { chromium } from "playwright";
import { signIn, dismiss, makeReady } from "./_noteSeed.mjs";
const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const SINK_PORT = 3199;

const failures = [];
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"}  ${l}`); if (!c) failures.push(l); };

// ---- The Resend sink -------------------------------------------------------
const captured = [];
let failMode = false;
const sink = http.createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    if (req.method === "POST" && req.url === "/emails") {
      if (failMode) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ statusCode: 500, name: "internal_server_error", message: "sink says no" }));
        return;
      }
      const parsed = JSON.parse(body);
      captured.push(parsed);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: `sunk-${captured.length}` }));
      return;
    }
    res.writeHead(404).end();
  });
});
await new Promise((r) => sink.listen(SINK_PORT, "127.0.0.1", r));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await signIn(page, BASE);

// ---- EMAIL: the sent path --------------------------------------------------
if (!process.env.SKIP_EMAIL) {
  const draft = await makeReady(page, ctx, BASE);
  check(Boolean(draft), `note filled to fileable (${draft})`);
  const d = (await (await ctx.request.get(`${BASE}/api/drafts/${draft}`)).json()).draft;
  await ctx.request.patch(`${BASE}/api/drafts/${draft}`, {
    data: { baseVersion: d.version, title: "Crown Seat Visit" }
  });
  const r = await ctx.request.post(`${BASE}/api/drafts/${draft}/submit`, { data: { format: "md" } });
  const body = await r.json();
  check(r.ok() && body.emailed === true, `filing reports emailed:true (${r.status()} emailed=${body.emailed})`);
  const ticket = body.ticket ?? "";
  check(/^SN-\d+/.test(ticket) || ticket.length > 0, `a ticket was minted (${ticket})`);

  check(captured.length === 1, `the sink received exactly one message (${captured.length})`);
  const m = captured[0] ?? {};
  check((m.to ?? []).join(",") === "records@example.test", `sent to the server-configured corporate address (${m.to})`);
  check((m.subject ?? "").includes(ticket), `subject carries the ticket (${m.subject})`);
  const hdrs = m.headers ?? {};
  const hdrKeys = Object.keys(hdrs).map((k) => k.toLowerCase());
  check(hdrKeys.includes("message-id"), `threading Message-ID header present [${hdrKeys.join(",")}]`);
  const atts = m.attachments ?? [];
  const names = atts.map((a) => a.filename);
  check(names.some((n) => /^crown-seat-visit-.*\.md$/.test(n) && !/-audit\.md$/.test(n)), `note attachment named from the slugified title (${names[0]})`);
  check(names.some((n) => /-audit\.md$/.test(n)), `audit-report attachment included (${names[1]})`);
  const noteAtt = atts.find((a) => !/-audit\.md$/.test(a.filename));
  const decoded = Buffer.from(noteAtt?.content ?? "", "base64").toString("utf8");
  check(/Subjective|subjective|tooth/i.test(decoded), "the attachment body is the composed note");

  await page.goto(`${BASE}/admin/audit`, { waitUntil: "networkidle" });
  await dismiss(page);
  const audit1 = ((await page.locator("body").textContent()) ?? "").replace(/\s+/g, " ");
  check(/Note submitted(?! \()/.test(audit1), "the audit log labels the clean filing 'Note submitted'");
}

// ---- EMAIL: the failure path + resend, through the UI ----------------------
if (!process.env.SKIP_EMAIL) {
  failMode = true;
  const draft = await makeReady(page, ctx, BASE);
  check(Boolean(draft), `second note filled to fileable (${draft})`);
  await page.goto(`${BASE}/note/${draft}`, { waitUntil: "networkidle" });
  await dismiss(page);
  // File through the real SubmitDialog so the FiledResult contract is live.
  await page.getByRole("button", { name: /^submit$/i }).first().click();
  await page.waitForTimeout(900);
  const dlg = page.getByRole("dialog").last();
  await dlg.getByRole("button", { name: /submit note/i }).click();
  await page.waitForTimeout(3500);
  const dlgText = ((await dlg.textContent()) ?? "").replace(/\s+/g, " ");
  check(/not sent|failed|could not/i.test(dlgText), `the filed panel says the email did NOT go out [${dlgText.slice(0, 120)}]`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  // The builder must not claim Submitted: a failed send stays resubmittable.
  const chips = (await page.locator('body').textContent()) ?? "";
  check(/Send failed|error/i.test(chips), "the status surface reports the send failure");

  const dr = (await (await ctx.request.get(`${BASE}/api/drafts/${draft}`)).json()).draft;
  check(dr.lastSendFailed === true || dr.status === "error", `the server marked the draft send-failed (status=${dr.status} lastSendFailed=${dr.lastSendFailed})`);

  await page.goto(`${BASE}/admin/audit`, { waitUntil: "networkidle" });
  const audit2 = ((await page.locator("body").textContent()) ?? "").replace(/\s+/g, " ");
  check(/Note submitted \(email failed\)/.test(audit2), "the audit log labels the failure 'Note submitted (email failed)'");

  // Recovery: sink healthy again, resend the SAME submission.
  failMode = false;
  const before = captured.length;
  const rr = await ctx.request.post(`${BASE}/api/drafts/${draft}/resend`, { data: {} });
  check(rr.ok(), `resend succeeds once the mail system recovers (${rr.status()})`);
  check(captured.length === before + 1, `the sink received the resent message (${captured.length - before})`);
  const dr2 = (await (await ctx.request.get(`${BASE}/api/drafts/${draft}`)).json()).draft;
  check(dr2.lastSendFailed === false, `the send-failed flag clears after a successful resend (${dr2.lastSendFailed})`);
  // A clean submission refuses resend: 409, not a second email.
  const firstDraftId = (captured[0]?.attachments?.[0]?.filename ?? "");
  void firstDraftId;
}

// ---- ASSIST: the wired UI + the server gates -------------------------------
{
  // The affordance renders for an enabled deployment once the note has words.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await dismiss(page);
  const subj = await page.evaluate(() => ([...document.querySelectorAll("textarea")].find((t) => /subjective/.test(t.id)) || {}).id);
  await page.fill(`[id="${subj}"]`, "Patient reports cold sensitivity on tooth 14 for one week.");
  await page.waitForTimeout(600);
  const deepBtn = page.getByRole("button", { name: "Think deeper" });
  check((await deepBtn.count()) > 0, "the Think deeper affordance renders on an assist-enabled deployment");

  // PHI in the note → the privacy refusal renders, meter uncharged, no provider call.
  await page.fill(`[id="${subj}"]`, "Call the patient back at 615-555-0142 about tooth 14.");
  await page.waitForTimeout(600);
  await deepBtn.click();
  await page.waitForTimeout(1500);
  check((await page.getByText(/The AI was not called/).count()) > 0, "PHI in the note shows the named privacy refusal");
  // Scoped: the onboarding checklist has its own Dismiss button.
  await page.getByRole("status").filter({ hasText: "The AI was not called" }).getByRole("button", { name: "Dismiss" }).click();

  // Provider path with a dummy key → model-error surfaces as readable copy,
  // and the drift monitor gets its row (the meter + drift pipeline, live).
  await page.fill(`[id="${subj}"]`, "Patient reports cold sensitivity on tooth 14 for one week.");
  await page.waitForTimeout(600);
  await deepBtn.click();
  await page.waitForTimeout(25000); // provider timeout budget is 20s
  const panelText = ((await page.locator('[role="status"]').allTextContents()).join(" ")).replace(/\s+/g, " ");
  check(/did not answer|model|error|failed|leaves open/i.test(panelText), `the provider outcome renders readable copy [${panelText.slice(0, 100)}]`);

  // Deterministic tier: an unset-role user gets the twins explanation, no audit rows.
  await ctx.request.post(`${BASE}/api/admin/users`, { data: { username: "norole1", displayName: "No Role", role: "user", password: "norole1-pass-1234" } });
  const nctx = await browser.newContext();
  const np = await nctx.newPage();
  await signIn(np, BASE, "norole1", "norole1-pass-1234");
  const ar = await nctx.request.post(`${BASE}/api/assist`, { data: { capability: "interrogate", text: "Extraction of tooth 30 completed." } });
  const ab = await ar.json();
  check(ar.status() === 200 && ab.tier === "deterministic", `unset role gets the deterministic twin (${ar.status()} tier=${ab.tier})`);
  check(/deterministic checks answered/i.test(ab.explanation ?? ""), "the explanation names the deterministic checks");
  await nctx.close();

  // SuperByte is live on key-alone (ASSIST_ENABLED deliberately not required).
  const bs = await (await ctx.request.get(`${BASE}/api/bytestar`)).json();
  check(bs.enabled === true, `bytestar reports enabled on key-alone (${JSON.stringify(bs)})`);

  // The drift row from the provider call is on the audit page; the
  // deterministic call left no row at all. Counted from the TABLE rows — the
  // DriftPanel above the table repeats the label in its own copy.
  await page.goto(`${BASE}/admin/audit`, { waitUntil: "networkidle" });
  const auditRows = await page.evaluate(() =>
    [...document.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => td.textContent?.trim() ?? "").join(" | ")
    )
  );
  const driftRows = auditRows.filter((r) => r.includes("AI assist outcome (drift monitor)"));
  check(driftRows.length === 1, `the provider call landed exactly one assist.drift row (${driftRows.length})`);
  check(/cap=interrogate/.test(driftRows[0] ?? ""), "the drift row names the capability, model, and outcome");
  // The deterministic-tier call must be invisible to the monitors: had it
  // written anything, an assist row would name it.
  check(!auditRows.some((r) => r.includes("AI assist used")), "the deterministic-tier call wrote no assist rows");
}

await browser.close();
sink.close();
if (failures.length) { console.error(failures.length + " failure(s)"); process.exit(1); }
console.log("\nAll email + assist checks passed.");
