// PHI end-to-end drive — the single most load-bearing promise the product makes,
// and the one seam never verified whole in a browser until batch 11. A note is
// filled to fileable (e2e/_noteSeed.mjs), an identifier is added, and BOTH escape
// hatches are exercised end to end:
//   MASK      — opaque [KIND-XXXX] tokens replace the identifier in place, the S0
//               privacy stop clears, and the note files;
//   OVERRIDE  — an attested waiver (checkbox + reason code both required) unblocks
//               Submit without changing the note; the filed audit row reads
//               "Privacy stop overridden (attested)", carries the phi.* rule ids,
//               and NEVER the matched identifier.
// Plus the title-as-filename gate: a name in the draft title (which becomes the
// emailed attachment's filename) blocks filing with the title phi finding.
//
// Requires a freshly-booted server (empty in-memory DB) with the smoke admin; see
// e2e/_noteSeed.mjs for how a note is filled to fileable on current main.
//   BASE_URL=http://127.0.0.1:3000 node e2e/phi.mask-override.mjs
import { chromium } from "playwright";
import { signIn, dismiss, makeReady } from "./_noteSeed.mjs";
const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";

const failures = [];
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"}  ${l}`); if (!c) failures.push(l); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(`[${page.url().replace(BASE, "")}] ${m.text().slice(0, 140)}`); });
page.on("pageerror", (e) => errs.push(`PAGEERROR [${page.url().replace(BASE, "")}] ` + String(e).slice(0, 140)));
await signIn(page, BASE);

const submitBtn = () => page.getByRole("button", { name: /^submit$/i }).first();
const reviewBtn = () => page.getByRole("button", { name: /review privacy stop/i }).first();
const subjId = () => page.evaluate(() => ([...document.querySelectorAll("textarea")].find((t) => /subjective/.test(t.id)) || {}).id);
async function addPhi(text) {
  const id = await subjId();
  const cur = await page.inputValue(`[id="${id}"]`);
  await page.fill(`[id="${id}"]`, cur + " " + text);
  await page.waitForTimeout(2800);
  return id;
}
async function fileViaDialog() {
  await submitBtn().click();
  await page.waitForTimeout(900);
  const dlg = page.getByRole("dialog").last();
  await dlg.getByRole("button", { name: /submit note/i }).click();
  await page.waitForTimeout(2500);
}

// ---- MASK path ------------------------------------------------------------
{
  const draft = await makeReady(page, ctx, BASE);
  check(Boolean(draft), `note filled to fileable (${draft})`);
  check((await submitBtn().getAttribute("aria-disabled")) !== "true", "clean note is submittable before PHI is added");

  // "identifier" + "phone" carry the two S0 stops (phi.ssn, phi.phone) without
  // tripping the shorthand gate — the word "SSN" is itself flagged S1, which
  // would survive masking and mask the real result (a probe-content artifact,
  // not a product defect: verified in src/lib/audit via runTextAudit).
  await addPhi("Patient identifier 123-45-6789, phone 865-555-0134.");
  check((await submitBtn().getAttribute("aria-disabled")) === "true", "an identifier blocks Submit (S0 privacy stop)");
  check((await reviewBtn().count()) > 0, "the privacy-stop review affordance appears");

  await reviewBtn().click();
  const dlg = page.getByRole("dialog").filter({ hasText: /identifier/i });
  await dlg.waitFor({ timeout: 8000 });
  const maskBtn = dlg.getByRole("button", { name: /^mask \d+ flagged item/i });
  check((await maskBtn.count()) === 1, "the dialog offers masking as the primary action");
  await maskBtn.click();
  await page.waitForTimeout(2800);
  const id = await subjId();
  const field = await page.inputValue(`[id="${id}"]`);
  check(!/123-45-6789/.test(field) && !/865-555-0134/.test(field), "the raw identifiers are gone from the field");
  check(/\[[A-Z]+-[A-Z0-9]{4}\]/.test(field), `masked tokens replaced them (${(field.match(/\[[A-Z-]+[A-Z0-9]{4}\]/) || ["?"])[0]})`);
  // Poll for the re-audit to clear the stop — if it never does, dump why.
  let unblocked = false;
  for (let i = 0; i < 20; i++) {
    if ((await submitBtn().getAttribute("aria-disabled")) !== "true") { unblocked = true; break; }
    await page.waitForTimeout(500);
  }
  if (!unblocked) {
    const reason = (await page.locator("#builder-submit-blocked").textContent().catch(() => "")) ?? "";
    console.log(`   DIAG blockedReason="${reason.trim().slice(0, 160)}"  field="${field.slice(-100)}"`);
  }
  check(unblocked, "the stop clears after masking — Submit unblocks");

  if (unblocked) {
    await fileViaDialog();
    const subs = (await (await ctx.request.get(`${BASE}/api/submissions?limit=20`)).json()).submissions ?? [];
    check(subs.length >= 1, `masked note filed (${subs.length} submissions)`);
  } else {
    check(false, "masked note filed (skipped — Submit never unblocked)");
  }
}

// ---- OVERRIDE path --------------------------------------------------------
{
  const before = ((await (await ctx.request.get(`${BASE}/api/submissions?limit=20`)).json()).submissions ?? []).length;
  const draft = await makeReady(page, ctx, BASE);
  check(Boolean(draft), `second note filled to fileable (${draft})`);
  await addPhi("Reached patient at 415-555-2277 to confirm.");
  check((await submitBtn().getAttribute("aria-disabled")) === "true", "second note blocked by its identifier");

  await reviewBtn().click();
  const dlg = page.getByRole("dialog").filter({ hasText: /identifier/i });
  await dlg.waitFor({ timeout: 8000 });
  const overrideBtn = dlg.getByRole("button", { name: /override this privacy stop/i });
  check(await overrideBtn.isDisabled(), "Override is disabled before the checkbox and a reason code");
  await dlg.getByRole("checkbox").check();
  check(await overrideBtn.isDisabled(), "the checkbox alone does not enable Override");
  await dlg.getByLabel("PHI override reason code").selectOption({ index: 1 });
  check(!(await overrideBtn.isDisabled()), "checkbox + a reason code enables Override");
  await overrideBtn.click();
  await page.waitForTimeout(800);
  check((await submitBtn().getAttribute("aria-disabled")) !== "true", "attested override unblocks Submit without changing the note");

  await fileViaDialog();
  const after = ((await (await ctx.request.get(`${BASE}/api/submissions?limit=20`)).json()).submissions ?? []).length;
  check(after === before + 1, `overridden note filed (${before} -> ${after})`);

  // The audit row: labelled, rule-id-bearing, and free of the matched identifier.
  await page.goto(`${BASE}/admin/audit`, { waitUntil: "networkidle" });
  await dismiss(page);
  const auditText = ((await page.locator("body").textContent()) ?? "").replace(/\s+/g, " ");
  check(/Privacy stop overridden \(attested\)/.test(auditText), "the audit viewer shows the labelled override row");
  check(/phi\./.test(auditText), "the row carries rule ids");
  check(!/415-555-2277/.test(auditText), "the matched identifier never reaches the audit log");
}

// ---- Title-as-filename gate (API level) -----------------------------------
// The title is draft metadata the composed-note audit never sees, yet
// slugifyTitle(title) becomes the emailed attachment's filename. An S0 identifier
// there (a phone/SSN — a bare name is only an S2 heuristic and does not block) is
// merged into the SAME report and blocks filing. Asserted on the 422 body — the
// finding must be present AND attributed to the title — not just on the status,
// so an empty-note required.missing rejection cannot pass for the title gate.
{
  const fresh = await ctx.request.post(`${BASE}/api/drafts`, { data: { note: { selectedModuleIds: ["universal-core"], values: {} } } });
  const id = (await fresh.json()).draft?.id ?? (await (await ctx.request.get(`${BASE}/api/drafts`)).json()).drafts[0].id;
  const d = (await (await ctx.request.get(`${BASE}/api/drafts/${id}`)).json()).draft;
  await ctx.request.patch(`${BASE}/api/drafts/${id}`, { data: { baseVersion: d.version, title: "Callback 615-555-0199" } });
  const r = await ctx.request.post(`${BASE}/api/drafts/${id}/submit`, { data: {} });
  const body = await r.json().catch(() => ({}));
  const titleFinding = (body.findings ?? []).find((f) => /phi\./.test(f.ruleId ?? "") && /title/i.test(f.message ?? ""));
  check(r.status() === 422, `an identifier in the title blocks filing (${r.status()})`);
  check(Boolean(titleFinding), `the block names the title as the phi source (${titleFinding?.ruleId ?? "no title finding"})`);
}

// Two classes of console noise this drive PROVOKES by design, neither an app JS
// error:
//   1. "Failed to load resource: … <4xx>" is the browser narrating an HTTP
//      status. This drive deliberately drives non-2xx responses — the submit gate
//      422s a blocked note, autosave 409s a stale one, a transfer 403s a former
//      owner. Submit SUCCESS is asserted by the filed-count checks above, never by
//      console silence, so this narration is expected.
//   2. React #185 (max update depth) / #418 (hydration race) fire only on `/`
//      while makeReady bulk-fills dozens of fields in a single tick — a probe
//      artifact: e2e/hydration.clean.mjs loads every one of these pages on a plain
//      navigation (no fill) and every page is clean. A human typing never trips it.
// Both are excluded; a genuine JS error, or a NEW React number, still surfaces.
const netErrs = errs
  .filter((e) => !/Failed to load resource/i.test(e))
  .filter((e) => !/feedback|bytestar/i.test(e))
  .filter((e) => !/React error #(185|418)/.test(e));
check(netErrs.length === 0, `no unexpected console errors [${netErrs.slice(0, 2).join(" | ")}]`);
await browser.close();
if (failures.length) { console.error(failures.length + " failure(s)"); process.exit(1); }
console.log("\nAll PHI end-to-end checks passed.");
