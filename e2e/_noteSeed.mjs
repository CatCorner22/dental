// Shared batch-10 seed helpers. main's "Honest Finish" work made filing a note
// much stricter (litigation-killer completeness rules, expanded required
// sub-sections, segmented button-groups replacing <select> for <=4 options,
// ambiguity gates). makeReady encodes what it now takes to reach a fileable
// note: rich narrative that satisfies the content killers, expand every
// collapsed section, fill selects + segmented groups + text (biased to
// none-type options so asserting an open item does not cascade new required
// tracking fields), and attest residual Soft-S2 review findings.
export const READY_OBJECTIVE =
  "Comprehensive oral evaluation completed by the treating dentist. Tooth 14 mesial-occlusal-distal composite restoration placed to treat recurrent caries diagnosed on clinical exam and confirmed on bitewing radiographs, which showed occlusal radiolucency and no periapical pathology. Risks, benefits, and alternatives including no treatment were discussed; the patient's questions were answered and the patient consented and accepted. No known drug allergies (NKDA); medical history reviewed and unchanged. Local infiltration 2% lidocaine 1:100k epi, 1 carpule. No complications; hemostasis achieved; post-operative instructions given verbally and in writing. Plan: recall in six months for routine evaluation; return sooner if pain, swelling, or sensitivity persists.";

export async function dismiss(page) {
  for (const [text, name] of [
    ["Before you begin", /i understand/i],
    ["Send feedback", /not now|got it|dismiss/i]
  ]) {
    const d = page.getByRole("dialog").filter({ hasText: text });
    if (await d.count()) {
      const b = d.getByRole("button", { name });
      if (await b.count()) await b.first().click().catch(() => {});
      await page.waitForTimeout(400);
    }
  }
}

const HYDRATED = () => {
  const f = document.querySelector("form");
  return f && Object.keys(f).some((k) => k.startsWith("__reactFiber"));
};

export async function signIn(page, base, user = "smokeadmin", pass = "smoke-pass-12345") {
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.waitForFunction(HYDRATED);
  await page.fill("#li-user", user);
  await page.fill("#li-pass", pass);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 }),
    page.click('button[type="submit"]')
  ]);
  await page.waitForLoadState("networkidle");
  await dismiss(page);
}

// Fill the OPEN builder note to a fileable state. Returns the draft id, or null.
// If injectSubjective is given it is appended to the subjective field (used by
// the PHI drive to plant an identifier).
export async function makeReady(page, ctx, base, { subjectiveExtra = "" } = {}) {
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await dismiss(page);
  const areas = await page.evaluate(() =>
    [...document.querySelectorAll("textarea")].slice(0, 4).map((t) => t.id)
  );
  const subj = areas.find((id) => /subjective/.test(id));
  const obs = areas.find((id) => /objective/.test(id));
  if (subj) {
    await page.fill(
      `[id="${subj}"]`,
      "Patient reports sensitivity on tooth 14 for one week, worse with cold; no swelling or spontaneous pain." +
        (subjectiveExtra ? " " + subjectiveExtra : "")
    );
  }
  if (obs) await page.fill(`[id="${obs}"]`, READY_OBJECTIVE);
  await page.waitForTimeout(1200);
  const narr = [subj, obs].filter(Boolean);

  const expandAll = async () => {
    for (let i = 0; i < 4; i++) {
      const shut = await page.locator("details[data-section]:not([open]) > summary").all();
      if (!shut.length) return;
      for (const s of shut) {
        await s.click().catch(() => {});
        await page.waitForTimeout(80);
      }
      await page.waitForTimeout(250);
    }
  };
  const fillAll = () =>
    page.evaluate((narrIds) => {
      const fire = (n, ev) => n.dispatchEvent(new Event(ev, { bubbles: true }));
      const NONE = /none|no known|not (assessed|applicable|required|reported)|nothing|no outstanding|no open|unremarkable|denies/i;
      let sel = 0, grp = 0, txt = 0;
      document.querySelectorAll("select").forEach((el) => {
        if (el.value) return;
        const opts = [...el.options].filter((o) => o.value !== "" && o.value !== "__other__");
        if (!opts.length) return;
        const o = opts.find((o) => NONE.test(o.textContent || o.value)) || opts[0];
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(el, o.value);
        fire(el, "change");
        sel++;
      });
      document.querySelectorAll('div[role="group"]').forEach((g) => {
        if (/record this as an absence/i.test(g.getAttribute("aria-label") || "")) return;
        const btns = [...g.querySelectorAll("button[aria-pressed]")];
        if (!btns.length) return;
        if (btns.some((b) => b.getAttribute("aria-pressed") === "true")) return;
        const pick = btns.find((b) => NONE.test(b.textContent || "")) || btns[0];
        pick.click();
        grp++;
      });
      document
        .querySelectorAll("textarea, input:not([type='checkbox']):not([type='radio']):not([type='file']):not([type='hidden'])")
        .forEach((el) => {
          if (narrIds.includes(el.id)) return;
          if ((el.value || "").trim()) return;
          const type = (el.getAttribute("type") || "text").toLowerCase();
          const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const v =
            type === "date"
              ? "2026-08-09"
              : type === "number"
                ? "1"
                : type === "email"
                  ? "records@example.com"
                  : "Reviewed and addressed at this visit; no additional concerns noted.";
          Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
          fire(el, "input");
          fire(el, "change");
          txt++;
        });
      return { sel, grp, txt };
    }, narr);

  const attestAll = async () => {
    for (let r = 0; r < 60; r++) {
      const btn = page.getByRole("button", { name: "This is right as written" }).first();
      if (!(await btn.count())) break;
      await btn.evaluate((el) => el.click());
      await page.waitForTimeout(180);
      const s = page.locator("select").filter({ has: page.locator("option", { hasText: /why this text is right/i }) }).first();
      if (await s.count()) await s.selectOption({ index: 1 }).catch(() => {});
      await page.waitForTimeout(100);
      const rec = page.getByRole("button", { name: "Record it" }).first();
      if (await rec.count()) await rec.evaluate((el) => el.click());
      await page.waitForTimeout(240);
    }
  };

  // Fill to a fixpoint, then attest, then fill again (attesting or picking an
  // option reveals conditional required sub-fields). Require TWO consecutive
  // empty fill passes before concluding — one is premature while a
  // just-revealed field has not rendered yet, which is what made the seed flaky.
  let quiet = 0;
  for (let i = 0; i < 12 && quiet < 2; i++) {
    await expandAll();
    const f = await fillAll();
    await page.waitForTimeout(1200);
    if (!f.sel && !f.grp && !f.txt) {
      quiet++;
      await attestAll();
      await page.waitForTimeout(800);
    } else {
      quiet = 0;
    }
  }
  await attestAll();
  await page.waitForTimeout(1500);
  const drafts = (await (await ctx.request.get(`${base}/api/drafts`)).json()).drafts ?? [];
  return drafts[0]?.id ?? null;
}
