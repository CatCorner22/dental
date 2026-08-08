# Adversarial — Curve Hero power user vs Smile Notes

- **Type**: red-team persona (not a live interview)
- **Ingested**: 2026-08-08
- **Tags**: ux, adversarial, curve-hero, favorites, quicktext, forms, care-plus, adoption, red-team
- **Status**: cruelty sheet for product honesty; pairs with other adversarial hate panels in `knowledge/sources/`
- **Persona**: Curve Hero power user — owns Forms templates, lives in Favorites + QuickText, Care+ curious, zero patience for a second app that feels like a Favorites clone with homework
- **Grounding**: public Curve docs + in-repo builder/benchmark sources; **not** observed Cornerstone sessions

## Axiom

Smile Notes is not competing with Curve. It is competing with **Favorites under the right visit** — and today it loses that race while charging a paste tax.

**Why it matters:** If this user never opens a second tab, the audit engine is a museum piece. Win ninety seconds of Favorites muscle memory or admit you are optional polish.

---

## Feature-by-feature cruelty

| Capability | Curve Hero (what they already have) | Smile Notes (what you ask them to do) | Verdict from the chair |
| --- | --- | --- | --- |
| **Start a note** | Patient selected → Sidekick → visit → Favorite template colored like the appointment | Leave Curve → open another site → pick modules → hope Fast Lane means something | Extra app before the first clinical word |
| **Speed path** | Favorites = required clicks + text slots that produce a **saveable note** | Fast Lane = **modules only** — structure without sentences | Favorites clone that forgot the favorite part |
| **Canned prose** | QuickText under the note, one tap, stays on the visit | Verified blocks / MyBlocks buried until a textarea is focused and a chip panel opened | Hidden QuickText with worse discoverability |
| **Template authorship** | Staff build Forms: Questions → Templates → Favorites, required fields that **block save** | Module registry is developer-only; practice cannot author without a Gauntlet + deploy | You took away their craft and called it “standardization” |
| **Required fields** | Red asterisks on the same screen as the note | Audit panel / Check-your-note / Ready chip elsewhere — sermon after the work | Nanny after the fact, not rails in the path |
| **Visit attachment** | Context-of-creation attaches; checkout can convert Planning → Clinical History | Copy → paste → pray they attach in Curve | You ship prose; Curve still owns legality — and you added a hop |
| **Patient context** | Sidekick always on: alerts, critical notes, appointments, insurance flags | De-identified blank room — by charter | Correct safety story; feels like working blind |
| **Ambient / AI** | Care+ → transcript → AI SOAP / Complete With AI → provider review before save | Assist is gated rewrite/questions; ambient is a coded non-goal | Care+ curious user hears “we refuse the thing Curve already sells” |
| **Charting adjacency** | Odontogram + shortcuts paint codes/surfaces next to the note | Tooth fields in some modules; no chart of record | Notes tool that cannot see the mouth |
| **Finish** | Save on the visit. Done. | Survive audit → Copy for Curve Hero → flip apps → paste → save again | Inferior Favorites clone **with extra steps** — the whole indictment |
| **Enforcement / intelligence** | Thin: templates + required clicks; vague phrases and recycled Planning language still file | Deterministic audit, vocab, frozen ticket + ruleset, role gates | The only place you win — and this user does not care until a deposition |

---

## 8 reasons you’ll never switch

1. **Two-app tax.** Curve already holds the patient, the visit, the signature, and the legal chart. Anything that ends in clipboard is optional by definition.
2. **Favorites still win the ninety seconds.** One favorite under the right visit beats Fast Lane + chips + Copy every turnover.
3. **Fast Lane is a lie next to Favorites.** It adds modules. Favorites produce note text. Same marketing energy, different payload.
4. **QuickText is muscle memory.** MyBlocks exist and hide. Power users do not hunt closed chip panels between patients.
5. **Forms is their craft.** They built the crown template, the emergency pack, the hygiene favorite. Smile Notes says “developer-only registry” and expects gratitude.
6. **Care+ curiosity has a vendor already.** Ambient → review → save is Curve’s pitch. Your refusal is principled; it is not a reason to leave Sidekick.
7. **Paste fidelity is not attachment.** Even a perfect clipboard note can miss visit attachment, recycle Planning language at checkout, or sit untagged. You cannot fix Curve’s trap from outside Curve.
8. **Nanny software on the slow path.** GPA/Ready theater, attestation lists, and full AuditPanel sermons train associates to bypass — back to QuickText, where nobody grades them.

---

## 4 concessions that might open a tab once

1. **Pinned MyBlocks as first thumb targets** — role-filtered, insert-ready prose that pastes into Curve with zero cleanup. Feels like QuickText without leaving the builder chrome.
2. **Fast Lane → optional attested pack** — modules **plus** suggested verified blocks (placeholders still block; nothing silently filled). Closes “Fast Lane did nothing clinical” without becoming Forms.
3. **DDS killer-only finish** — ≤3 open litigation killers + fat Copy. Hygienist builds; dentist does not sit through the sermon. Associate bypass drops.
4. **Hard proof on the killers Curve templates miss** — anesthetic amount, imaging interpretation, consent+decision, clinical rationale (and wrong-site already hard). If Copy refuses thin notes that Favorites happily save, the power user opens the tab **for liability**, not for love.

---

## The trap

**Ship a Forms clone, silent clinical fill, or Care+-style ambient draft to “beat Favorites.”**

That is how you lose the only users who might respect you (the ones who hate invented findings) and hand the plaintiff attorney fluent fiction with a Ready chip. Power-user cruelty is answered by **making attested blocks as obvious as Favorites** and **hard-gating killers on Copy** — not by becoming Curve with worse charting and a paste tax.

---

## What this persona maps onto (already-ranked backlog)

| Their demand | Builder / product map | Do not ship |
| --- | --- | --- |
| Feel like Favorites | Pinned MyBlocks; Fast Lane pack offer; section-scoped suggested blocks | Silent fill; staff Forms authoring |
| Kill the nanny on DDS path | DDS killer-only handoff before Copy | Force full AuditPanel before every Copy |
| Care+ curiosity | Keep assist as rewrite/questions + PHI gate + verifyMeaning | Ambient invent; copy-forward prior notes |
| Worth the tab | Hard-gate litigation killers + freeze attestations onto filing | Soft training mode; GPA that looks like a gate |

## Related

- `knowledge/sources/builder-text-blocks-predictive-ux.md`
- `knowledge/benchmarks/smile-notes-vs-curve-hero.md`
- `knowledge/sources/curve-hero-pms-clinical-documentation.md`
- `knowledge/sources/check-your-note-ux-research.md`
