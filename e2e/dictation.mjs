// Dictation drive — the browser voice-entry surface, which had zero runtime
// coverage before batch 11. A Playwright addInitScript installs a *drivable* stub
// of webkitSpeechRecognition (exposing window.__speak / __interim) so the whole
// path runs end to end: the enrollment gate + server re-check, the apply-mode mic
// (renders only when ready + enrolled + focused), caret insertion (not append),
// deterministic dental joins (bite wing -> bitewing, post op -> post-op), the
// never-substitute regional gloss (gonna kept verbatim, explained by a chip),
// interim-not-committed, and the honest missing-engine message.
//
// The recognizer is exposed via non-writable getters, not a plain assignment:
// something in the production page nulls window.*SpeechRecognition after
// hydration, which silently defeats a data-property stub (available() sees it at
// mount, start() finds null on click). A getter survives that.
//
// Requires a freshly-booted server (empty in-memory DB) with the smoke admin.
//   BASE_URL=http://127.0.0.1:3000 node e2e/dictation.mjs
import { chromium } from "playwright";
import { signIn, dismiss } from "./_noteSeed.mjs";
const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";

const failures = [];
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"}  ${l}`); if (!c) failures.push(l); };
const browser = await chromium.launch();

const STUB = `
(() => {
  try { Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true }); } catch (e) {}
  class FakeRecognition {
    constructor() {
      this.lang = ''; this.continuous = false; this.interimResults = false;
      this.maxAlternatives = 1; this.onresult = null; this.onend = null; this.onerror = null; this.grammars = null;
    }
    start() { window.__activeRec = this; }
    stop() { if (this === window.__activeRec) window.__activeRec = null; if (this.onend) this.onend(); }
    abort() { this.stop(); }
  }
  Object.defineProperty(window, 'SpeechRecognition', { configurable: true, get() { return FakeRecognition; } });
  Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, get() { return FakeRecognition; } });
  const emit = (text, isFinal) => {
    const r = window.__activeRec;
    if (!r || !r.onresult) return false;
    r.onresult({ resultIndex: 0, results: { length: 1, 0: { isFinal: isFinal, length: 1, 0: { transcript: text } } } });
    return true;
  };
  window.__speak = (text) => emit(text, true);
  window.__interim = (text) => emit(text, false);
})();
`;

async function ctxWith(stub = true) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (stub) await ctx.addInitScript(STUB);
  return ctx;
}

// --- Sign in (no stub yet) and enroll via the API, then verify the server re-check.
{
  const ctx = await ctxWith(false);
  const page = await ctx.newPage();
  await signIn(page, BASE);
  // Server re-check: a too-short session is refused even if the client says done.
  const short = await ctx.request.post(`${BASE}/api/me/dictation`, { data: { listenedMs: 1000, utterances: 1, promptsCompleted: 0, region: "general" } });
  check(short.status() === 400, `short practice session refused server-side (${short.status()})`);
  // The prompts edge: 8 utterances but only 1 prompt completed must NOT enroll.
  const noPrompts = await ctx.request.post(`${BASE}/api/me/dictation`, { data: { listenedMs: 95000, utterances: 8, promptsCompleted: 1, region: "general" } });
  check(noPrompts.status() === 400, `8 utterances without advancing prompts does not enroll (${noPrompts.status()})`);
  // A complete session enrolls.
  const ok = await ctx.request.post(`${BASE}/api/me/dictation`, { data: { listenedMs: 95000, utterances: 8, promptsCompleted: 6, region: "general" } });
  const okBody = await ok.json().catch(() => ({}));
  check(ok.ok() && okBody.enrolled === true, `a complete session enrolls (${ok.status()} region=${okBody.region})`);
  await ctx.close();
}

// --- Apply-mode: the mic appears for an enrolled writer, and drives text in.
{
  const ctx = await ctxWith(true);
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 120)); });
  page.on("pageerror", (e) => errs.push("PAGEERROR " + String(e).slice(0, 120)));
  await signIn(page, BASE);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await dismiss(page);
  check(await page.evaluate(() => window.isSecureContext) === true, "127.0.0.1 is a secure context (mic path is reachable)");
  check(await page.evaluate(() => typeof window.webkitSpeechRecognition === "function"), "the SpeechRecognition stub is installed before page scripts");

  // Focus the subjective narrative → the mic renders (ready + enrolled + active).
  const areas = await page.evaluate(() => [...document.querySelectorAll("textarea")].slice(0, 4).map((t) => t.id));
  const subj = areas.find((id) => /subjective/.test(id));
  await page.fill(`[id="${subj}"]`, "Patient reports discomfort. ");
  await page.click(`[id="${subj}"]`);
  await page.waitForTimeout(400);
  const mic = page.getByRole("button", { name: /dictate$|stop dictation/i }).first();
  check((await mic.count()) > 0, "the Dictate mic renders for an enrolled writer on a focused field");

  // Place the caret before "discomfort" (mid-field) and dictate — text inserts at the caret.
  await page.evaluate((id) => {
    const el = document.getElementById(id);
    const pos = el.value.indexOf("discomfort");
    el.focus(); el.setSelectionRange(pos, pos);
  }, subj);
  await mic.click();
  check((await mic.getAttribute("aria-pressed")) === "true", "clicking Dictate starts listening (aria-pressed)");
  // Interim shows but is never committed.
  await page.evaluate(() => window.__interim("bite wing pending"));
  await page.waitForTimeout(300);
  const afterInterim = await page.inputValue(`[id="${subj}"]`);
  check(!/bite wing pending/.test(afterInterim), "interim text is shown but never committed to the field");
  check((await page.getByText(/Listening/).count()) > 0, "the Listening status is shown while dictating");

  // A final with two speech-split dental compounds → deterministic joins, at the caret.
  await page.evaluate(() => window.__speak("bite wing taken and post op instructions given "));
  await page.waitForTimeout(400);
  const val = await page.inputValue(`[id="${subj}"]`);
  check(/bitewing/.test(val), "'bite wing' is joined to 'bitewing' (deterministic dental join)");
  check(/post-op/.test(val), "'post op' is hyphenated to 'post-op'");
  check(val.indexOf("bitewing") < val.indexOf("discomfort"), "the dictated text landed at the caret, not appended to the end");

  // A regional colloquialism must NOT be rewritten; a gloss chip explains it.
  await page.evaluate(() => window.__speak("we are gonna monitor tooth 14 "));
  await page.waitForTimeout(400);
  const val2 = await page.inputValue(`[id="${subj}"]`);
  check(/gonna/.test(val2) && !/going to/.test(val2), "'gonna' is kept verbatim — never autocorrected");
  check((await page.getByText(/gonna: going to/i).count()) > 0, "a read-only gloss chip explains the colloquialism");

  // Stop → the tidied counter reports the joins made (bite wing + post op = 2).
  await mic.click();
  await page.waitForTimeout(300);
  check((await mic.getAttribute("aria-pressed")) !== "true", "clicking Stop ends listening");
  check((await page.getByText(/dental terms? tidied/).count()) > 0, "the tidied-terms counter reports the joins after stopping");

  const netErrs = errs.filter((e) => !/403|feedback|bytestar/i.test(e));
  check(netErrs.length === 0, `apply-mode dictation has no unexpected console errors [${netErrs.join(" | ")}]`);
  await ctx.close();
}

// --- Missing-engine path (Firefox's situation): secure context, but the
//     recognizer constructor is absent. Chromium ships webkitSpeechRecognition
//     natively, so this must FORCE both properties to undefined to simulate a
//     browser without speech recognition.
{
  const ctx = await ctxWith(false);
  await ctx.addInitScript(`
    try { Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true }); } catch (e) {}
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, get() { return undefined; } });
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, get() { return undefined; } });
  `);
  const page = await ctx.newPage();
  await signIn(page, BASE);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await dismiss(page);
  const areas = await page.evaluate(() => [...document.querySelectorAll("textarea")].slice(0, 4).map((t) => t.id));
  const subj = areas.find((id) => /subjective/.test(id));
  await page.click(`[id="${subj}"]`);
  await page.waitForTimeout(500);
  check((await page.getByRole("button", { name: /dictate$|stop dictation/i }).count()) === 0, "no engine → no Dictate mic");
  check((await page.getByText(/This browser cannot do speech recognition/i).count()) > 0, "the missing-engine field shows the honest 'this browser cannot' message");
  await ctx.close();
}

await browser.close();
if (failures.length) { console.error(failures.length + " failure(s)"); process.exit(1); }
console.log("\nAll dictation checks passed.");
