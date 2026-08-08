# Adversarial hate panels — consolidated digest (25 lenses)

- **Type**: red-team / adversarial stakeholder simulation (not live interviews)
- **Ingested**: 2026-08-08
- **Updated**: 2026-08-08 (round 2 — 4× prior pool)
- **Tags**: ux, adversarial, red-team, litigation, hipaa, accessibility, ops, adoption, chairside, insurance, board, labor
- **Status**: cruelty sheet + ranked fix backlog; policy locks called out; hypotheses to falsify with real Cornerstone runs
- **Pool size**: **24 unique** hostile lenses + RDH labor deepening of A (prior pool = 5 → **≥4×**; 20 round-2 digests on disk)

## Epistemic frame

Every panel below is a **hostile mock agent** grounded in shipped code, prior research digests, and public litigation / PMS patterns. **None** is a live Cornerstone interview, Board contact, carrier underwriting quote, OCR review, or DSO RFP response. Treat quotes as design pressure, not attributed speech. Friendly market panels live separately in `market-ux-stakeholder-panels.md` when that source is on the branch; this file is the **hate** twin.

**Axiom shared across lenses:** Pretty does not forgive a wrong author, a soft killer, an unread gate, or unpaid documentation labor. Fix the **default clinical path** or the pilot dies quietly (Curve Favorites only) or loudly (walkout / Board / carrier).

---

## Roster (25)

### Round 1 — original five

| ID | Persona | Core indictment |
| --- | --- | --- |
| **A** | Burned RDH (labor / surveillance) | GPA, peer smell, Soft S2, unpaid charting after the last rinse — walkout on scoreboards |
| **B** | Plaintiff attorney | Ready / GPA / soft killers = deposition exhibits of false confidence |
| **C** | Fintech / consumer-app design snob | Marketing skin on a clinical tool; motion and brand without one honest job per screen |
| **D** | TN office manager | Shared-iPad wrong author + wifi draft loss = pilot kill; schedule slip from Copy tax |
| **E** | Cynical associate DDS | Hygiene drafts Assessment; Copy without dentist-owned killers; second-app homework |

Deepening for A: [`adversarial-rdh-surveillance-labor.md`](adversarial-rdh-surveillance-labor.md). Round-1 detail for B–E is synthesized in the cross-cuts and backlog below (no separate files were kept).

### Round 2 — twenty more (4× the prior pool as net-new, plus round 1 = 25)

| ID | Persona | File |
| --- | --- | --- |
| **F** | Dental insurance / UR auditor | [`adversarial-insurance-auditor-hate.md`](adversarial-insurance-auditor-hate.md) |
| **G** | TN Board of Dentistry investigator | [`tn-board-investigator-hate.md`](tn-board-investigator-hate.md) |
| **H** | Front desk coordinator | [`adversarial-hate-front-desk.md`](adversarial-hate-front-desk.md) |
| **I** | Traveling temp agency recruiter (TN) | [`adversarial-temp-agency-recruiter.md`](adversarial-temp-agency-recruiter.md) |
| **J** | Practice IT / HIPAA security officer | [`adversarial-it-hipaa-security.md`](adversarial-it-hipaa-security.md) |
| **K** | OMFS / specialist receiving referrals | [`adversarial-hate-omfs-referral.md`](adversarial-hate-omfs-referral.md) |
| **L** | Malpractice carrier risk / UW | [`carrier-risk-false-confidence-uw.md`](carrier-risk-false-confidence-uw.md) |
| **M** | Accessibility / low-vision / motor advocate | [`adversarial-a11y-advocate-hate.md`](adversarial-a11y-advocate-hate.md) |
| **N** | Curve Hero power user | [`adversarial-curve-power-user.md`](adversarial-curve-power-user.md) |
| **O** | Angry parent / portal chart language | [`adversarial-parent-portal-language-hate.md`](adversarial-parent-portal-language-hate.md) |
| **P** | DSO VP of Compliance (~40 offices) | [`adversarial-dso-compliance-vp-hate.md`](adversarial-dso-compliance-vp-hate.md) |
| **Q** | RSI clinician / dictation dependency | [`adversarial-rsi-dictation-hate.md`](adversarial-rsi-dictation-hate.md) |
| **R** | After-hours emergency dentist | [`adversarial-hate-emergency-dentist.md`](adversarial-hate-emergency-dentist.md) |
| **S** | Chairside DA (documents while drill runs) | [`adversarial-hate-chairside-da.md`](adversarial-hate-chairside-da.md) |
| **T** | Plaintiff's privacy / HIPAA attorney | [`adversarial-privacy-hipaa-attorney-hate.md`](adversarial-privacy-hipaa-attorney-hate.md) |
| **U** | Dental school faculty (checkbox medicine) | [`adversarial-faculty-checkbox-medicine-hate.md`](adversarial-faculty-checkbox-medicine-hate.md) |
| **V** | Color-blind + dyslexic chairside writer | [`adversarial-cvd-dyslexia-hate.md`](adversarial-cvd-dyslexia-hate.md) |
| **W** | Practice owner who writes the check | [`adversarial-practice-owner-hate.md`](adversarial-practice-owner-hate.md) |
| **X** | Team Lead / QA coach | [`adversarial-hate-qa-lead-coach.md`](adversarial-hate-qa-lead-coach.md) |

**Count:** Round 1 = **A–E** (5). Round 2 = **F–X** (19 net-new) + RDH surveillance file deepening **A** = **20 digests**. Unique personas = **24** (≥4× prior pool).

---

## Cross-cutting hates (what almost every lens repeats)

| Theme | Who screams loudest | One-line kill |
| --- | --- | --- |
| **False confidence** | B, L, G, F, W | Ready / GPA / Soft S2 look “done” while litigation killers stay open |
| **Wrong author / shared iPad** | D, J, I, T, P | Session survives handoff; next writer inherits draft, role, My blocks |
| **Glove / motor / mid-note UI** | M, S, Q, V, A | Chips, ToothPicker, dialogs, enrollment paths designed for break-room mice |
| **Paste tax vs Favorites** | N, E, H, R, W | Second app that loses to Curve Favorites under the visit |
| **Surveillance / unpaid labor** | A, X, D, W | Digest, GPA, Soft S2 without Lead relief or time in the schedule |
| **Identity / HIPAA egress** | J, T, P | MFA optional; clipboard is the product; local draft mirrors; no SSO at DSO scale |
| **Checkbox medicine** | U, F, B, L | Attested packs + GPA teach click-through competence, not reasoning |
| **Hue-first severity / cream fog** | M, V | Warm-ramp S0/S1/S2 + micro-Inter + opt-in contrast |
| **Role-before-work missing** | E, P, I, G | `clinicalRole = unset` as load-bearing default |
| **Recipient / portal audiences ignored** | K, O, F | Note is GP-writer-shaped; specialist, parent, and auditor cannot use it |

---

## Ranked fix backlog

Effort = invasiveness. **Policy** = requires owner / counsel lock before engineering treats it as product law.

### P0 — ship or the pilot dies (ops + chairside)

| # | Fix | Satisfies | Notes |
| --- | --- | --- | --- |
| **1** | **Hard author switch on shared devices** — lock / re-auth / wipe local draft mirrors before next patient; no silent session inheritance | D, J, I, T, P | Pilot kill criterion #1 |
| **2** | **Role-before-work** — cannot start a clinical note with `unset`; temps get a Fast Path that still forces role | E, P, I, G, A | Configuration debt is discovery exhibit |
| **3** | **DDS killer-only Copy path** — litigation killer class blocks Copy/Submit until dentist-owned resolution (or explicit policy-attested exception) | B, L, E, G, W | **Policy lock** — do not soft-train around this |
| **4** | **Glove-default targets on clinical path** — chips / tooth cells / finish controls meet large targets without relying on `pointer: coarse` alone; kill mid-press sparkle | M, S, Q, V | Default path, not `/account` scavenger hunt |
| **5** | **Pinned My blocks + discoverable verified blocks** without focus-trap hell while drill runs | S, N, A, Q | Already partially shipped on Daylight branches — verify on this tree |
| **6** | **Draft recovery that survives wifi blips** without becoming the next user's clipboard of ePHI | D, J, T | Recovery ≠ persistence after walkaway |

### P1 — policy / honesty (false confidence class)

| # | Fix | Satisfies | Notes |
| --- | --- | --- | --- |
| **7** | **GPA / Ready honesty contract** — Ready never means defensible; hide letter grades when killer-class findings open; ban “safe / compliant / lawsuit-proof” staff copy | B, L, A, U, W | Carrier UW kill sheet |
| **8** | **Freeze attestations on filing** — stamp who attested what; no post-hoc rewrite of the checkbox story | G, B, L, U | Board / deposition |
| **9** | **Independent verification path** for high-stakes fields (tooth, dose, consent) — second eyes or readback class, not another Soft S2 | B, L, check-your-note research | **Policy lock** |
| **10** | **Strip peer scoreboards / walkout triggers** — digest stays instrument, never ranking; Lead coach card without league tables | A, X | Lead hate is the mirror of RDH hate |
| **11** | **Severity encoding without hue monopoly** — shape + short word + spacing; ProgressRing must change form, not only stroke color | V, M | CVD / dyslexia |
| **12** | **Default contrast / reduced-motion that actually stops transform** | M, V, S | Opt-in high-contrast is not a clinical control |

### P2 — adoption / audience / scale

| # | Fix | Satisfies | Notes |
| --- | --- | --- | --- |
| **13** | **Marketing / work skin split** — login may brand; Builder is cold logic, one job per section | C, W, N | Daylight polish is not the adoption plan |
| **14** | **90-second Lead coach card on digest** — closed-loop acknowledgment optional later; never unread cosplay as control | X, P, D | DSO will still demand more |
| **15** | **Temp Fast Path** — role + office + one pack recipe; recruiter can brief in one sentence | I, D | |
| **16** | **Referral / portal language packs** — specialist packet fields; Cures-safe parent-facing summary discipline | K, O, F | Do not invent clinical facts to please UR |
| **17** | **Emergency / trauma speed lane** — killer-only finish, no module tourism after hours | R, H | |
| **18** | **Dictation without Account pilgrimage** — enrollment and apply-mode reachable chairside; RSI path | Q, S | |
| **19** | **DSO / enterprise gate** (later) — SSO/IdP, org-scoped packs, office as permission boundary, digest receipts | P, J | Not Cornerstone-blocking; refuse fake enterprise claims |
| **20** | **Faculty-safe pedagogy mode** (optional) — reward patient-specific prose, not pack completion GPA | U | Do not ship as Soft training that bypasses killers |

---

## Explicit traps (do not “fix” hate by shipping these)

| Trap | Why it fails every honest panel |
| --- | --- |
| Silent fill / ambient AI SOAP | Invents clinical facts; Care+ curiosity is not a product goal here |
| Soft training mode that bypasses killers | Carrier and Board exhibits |
| Forms / Favorites clone without audit win | Curve already won speed; you only win enforcement |
| Peer scoreboards / GPA leaderboards | RDH walkout; Lead weaponizes Soft S2 |
| “Carrier mode” that invents medical necessity | Insurance auditor hate + fraud risk |
| Daylight cream / motion as the adoption strategy | Owner and a11y panels: pretty ≠ closed consent gaps |
| Claiming BAA + de-id banner = multi-site HIPAA posture | IT / privacy / DSO kill |
| Lead-as-architecture at 40 offices | Scheduling dependency dressed as compliance |

---

## Pilot kill criteria (refuse go-live / pull plug)

1. **Wrong author on a shared iPad** (any confirmed incident).
2. **Wifi draft loss with no recovery** during a live schedule block.
3. **Copy succeeds with open litigation-killer findings** under a policy that claimed otherwise.
4. **MFA left off** while clinical text is in production (IT / HIPAA).
5. **Scoreboard or GPA used to rank writers** in a staff-visible surface.

---

## Measurement (falsify the hate)

| Claim | Falsifier |
| --- | --- |
| Glove path is viable | Timed glove+tablet run: apply pack → fill → Copy without mistap tooth / unread gate |
| Shared device is safe | Forced handoff protocol: author B cannot open author A’s draft without re-auth |
| Ready is honest | Adversarial UI test: thin note with open killer cannot present as finished / A-grade |
| Not unpaid labor | Schedule study: documentation minutes inside the appointment block, not after |
| Worth the paste tax | Side-by-side: Favorites-only vs Smile Notes for same visit type — audit win must be visible in ≤90s |

---

## Relationship to friendly research

Friendly stakeholder panels (market UX appeal) argue for Daylight chart, tablet finish, role-before-work, and pinned blocks as **delight**. This digest argues the same items are often **survival**. Prefer the hate ranking when the two conflict: honesty and attributable authorship outrank brand atmosphere.

---

## Per-panel one-liners (scan sheet)

| ID | One-liner |
| --- | --- |
| A | Surveillance smell + Soft S2 unpaid labor → walkout |
| B | Ready/GPA with open killers = plaintiff exhibit |
| C | Brand-first login cannot outrank a confused Builder |
| D | Wrong author + lost draft = OM kills the pilot |
| E | Hygiene Assessment + dentist Copy without killers = associate contempt |
| F | Completeness theater ≠ medical necessity narrative |
| G | Unset roles + soft gates = Board reconstruction failure |
| H | Schedule slip from paste tax lands on the desk |
| I | Temps inherit chrome; recruiter will not staff that liability |
| J | Shared identity + clipboard egress + MFA-off = KILL |
| K | Referral text without imaging/rationale is GP vanity prose |
| L | Underwriting prices false confidence; hide the comfort signals |
| M | Default AA or it is ableism with a CI badge |
| N | Competing with Favorites under the visit — and losing |
| O | Portal parents read stigma and jargon as cruelty |
| P | Three-office tool in enterprise clothing |
| Q | Dictation buried on Account is not an RSI product |
| R | After-hours needs killer-only speed, not module tourism |
| S | One gloved hand + drill noise; break-room UX dies |
| T | Clipboard + local mirrors + weak session = privacy complaint fuel |
| U | Attested packs train checkbox medicine |
| V | Warm-ramp severity + micro-Inter fails CVD/dyslexia |
| W | Pretty is not ROI; default path closes consent gaps |
| X | Lead digest without coach instruments is Soft S2 with a title |
