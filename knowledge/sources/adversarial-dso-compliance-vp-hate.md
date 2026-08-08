# Adversarial hate — DSO VP of Compliance (40-office scale)

- **Type**: red-team / adversarial stakeholder simulation (not a live DSO RFP or vendor questionnaire)
- **Ingested**: 2026-08-08
- **Tags**: dso, enterprise, compliance, sso, rbac, clinical-role, practice-packs, digest, multi-office, scale, red-team
- **Status**: hypotheses to falsify; enterprise go/no-go criteria, not a pilot polish list
- **Method**: Hostile mock DSO VP of Compliance evaluating Smile Notes for **~40 offices**. Instructed to **hate** anything that does not scale. Grounded in shipped code: Lead-only transfer, practice packs without office/org scope, `clinicalRole` default `unset`, credentials login with **no SSO/IdP surface**, Team Lead digest with **no read receipt** and a **500-row hard cap**. **Not** observed DSO procurement. Treat as kill-sheet hypotheses.

## Axiom

Smile Notes is a **three-office practice tool wearing enterprise vocabulary**. At forty sites it does not fail gracefully — it **multiplies unpaid Lead labor, ungoverned defaults, and unread oversight pages** while Legal still gets told the organization “runs a documentation compliance platform.”

**Why it matters:** A DSO compliance VP does not buy chairside honesty theater. They buy **identity, role attestation, multi-site governance, and an oversight loop someone can prove they closed**. Without those, every Andon is a local anecdote. Scale converts anecdotes into **enterprise liability**.

## Persona

| Field | Hate lens |
| --- | --- |
| Who | VP of Compliance / Risk for a regional DSO (~40 offices, hundreds of writers, shared staffing, corporate counsel on speed dial) |
| Skill | Vendor questionnaires, BAAs, IdP onboarding, multi-site policy rollouts, board/carrier discovery readiness |
| Core hate | Lead bottlenecks · per-office pack theater · unset clinical roles · no SSO story · digest nobody reads · single-tenant assumptions dressed as “offices” |
| Will not accept | “Ask your Team Lead” as architecture · “MFA exists as a flag” as identity · Pretty digests without acknowledgment · Pilot success at one Knoxville office as proof for forty |

---

## Six kill criteria (refuse the deal)

| # | Kill | What the product actually does | Why a 40-office compliance org stops |
| --- | --- | --- | --- |
| **K1** | **Lead is the runtime bus** | `canTransferNotes` requires **lead+**. Hygienist handoff, pack dual-control, digest access, user admin for rank-and-file — all funnel through Team Lead. When Lead is at lunch, sick, covering another site, or never hired at that location, the clinical path **stalls or bypasses** (Copy into Curve while transfer waits). | You cannot staff **forty** Lead-shaped humans as the SPOF for filing authority and pack publish. “Escalate to Lead” is not an enterprise control. It is a **scheduling dependency**. First busy Friday across three regions = silent paste bypass at scale. |
| **K2** | **Pack governance does not survive multi-site math** | `practice_packs` has **no `officeId`, no region, no org unit**. Dual-control Lead workflow assumes one practice queue. At DSO scale you get either **(a) forty local Lead pack factories** (per-office packs — ungoverned drift, clone risk, no corporate catalog) or **(b) one global publish** that stamps every site with the loudest Lead’s recipe. | Compliance needs **corporate-approved pack catalogs** with optional regional overlays and an audit of who published what where. Your Workflow v1 is a **boutique approval hobby**. Forty offices of dual-control queues is not “mature process.” It is **headcount you will not fund**. |
| **K3** | **Unset clinical role is the load-bearing default** | Schema default: `clinical_role = "unset"`. `unset` may still write judgment paths the product elsewhere pretends to lock; Andon scolds; filing authority for unset is permissive. Artifact itself admits the practice has not said who holds which role. | Across forty offices, “ask Lead to set role” is **configuration debt that never clears**. Temps, floaters, and weekend coverage arrive **unset**. Scope theater collapses. Discovery exhibit: hundreds of accounts the DSO **chose not to classify** while marketing claimed Tennessee scope enforcement. |
| **K4** | **No SSO / IdP story** | Auth path is **username + password** (`credentials` sign-in). MFA is a **deployment flag** (`MFA_ENABLED`), not enforced enterprise SSO. Zero SAML/OIDC/SCIM surface in the repo. Shared-tablet + long session already hated by IT panels; DSO IT will not provision **forty offices of local password accounts**. | Procurement kill on the questionnaire line item. No Okta/Entra/Google Workspace federation = **no joiner/mover/leaver**, no forced re-auth against corporate policy, no central disable on termination. Password reset by Lead is not identity lifecycle. It is **help-desk fan fiction**. |
| **K5** | **Digest is unread oversight cosplay** | `/digest` is Lead+-gated, 30-day window, **`DIGEST_ROW_CAP = 500`**, anti-scoreboard by design. No acknowledgment, no forced review cadence, no regional rollup, no “compliance officer closed this signal” receipt. At volume, the cap **truncates the very period you claim to review**. | A control that exists only when someone remembers to open a page is **not a control**. Forty offices × busy Leads = **zero closed-loop evidence**. Counsel will ask: who reviewed documentation risk last month? Answer: “the page exists.” That answer fails a board packet. |
| **K6** | **“Offices” are labels, not tenancy or permission boundaries** | `offices` + `user_offices` exist. Comment in schema is explicit: assignment is **not a permission boundary** — **every office remains selectable by everyone**. Single database tenant. No org isolation, no cross-office Minimum Necessary, no regional admin scope. | A DSO cannot prove Office A staff cannot browse Office B’s clinical drafts as casually as a picker. Location on the note header is **metadata cosplay**. Multi-site HIPAA / Minimum Necessary / litigation hold isolation is **absent**. Three Knoxville rooms ≠ forty legal entities / markets / state boards. |

---

## Five enterprise must-haves (non-negotiable)

State WHAT must exist, WHY the line stops without it, HOW to move. Cold. No encouragement.

| # | Must-have | Demand | Stop condition if refused |
| --- | --- | --- | --- |
| **E1** | **SSO + directory lifecycle** | SAML/OIDC against corporate IdP; SCIM or equivalent for joiner/mover/leaver; MFA owned by IdP policy, not a local env flag staff can “turn on later.” Local passwords only as break-glass with dual control and expiry. | **No RFP advance.** Credentials-only is a hard fail. |
| **E2** | **Role attestation before write** | Clinical role required before Assessment/Plan and before any export that claims scope enforcement. Corporate roster sync or mandatory Lead/admin attestation with audit. Unset writers = **blocked**, not amber-greeted. Monday readiness report: unset count by office → near zero. | **No production claim of scope control.** |
| **E3** | **Org / region pack catalog (not forty Lead hobbies)** | Corporate-published pack sets; optional regional overlays; office inheritance; who-published-what-where export. Dual-control at **governance tier**, not “find a second Lead at each storefront.” Kill silent clinical fill; keep attested scaffolds. | **Park Workflow as boutique** — do not sell packs as DSO governance. |
| **E4** | **Closed-loop oversight, not a page** | Digest (or successor) with **ack / assigned owner / due / closed** for practice-level signals; regional and DSO rollups; row caps that do not silently drop half the fleet. Filing rollup by office without staff scoreboards. Prove someone **read and acted**. | **Treat current digest as coaching wallpaper**, not a compliance control. |
| **E5** | **Real multi-site access boundaries** | Office/region as **authorization**, not picker order. Transfer and visibility scoped; Lead bottleneck broken with **role-safe peer transfer** or dentist self-claim paths that still audit. Cross-office browse is a deliberate grant, not the default. | **Cap deployment to a single practice entity** until tenancy exists. |

---

## The trap — “enterprise ready” sticker on a practice pilot

**Trap: Sell “multi-office,” “Team Lead Workflow,” “documentation digest,” and “clinical roles” as DSO-ready compliance infrastructure.**

That vocabulary photographs well in a demo. The atomic mark looks serious. One Knoxville pilot can even look clean.

Then procurement opens the hood:

- Identity = local passwords (+ optional MFA flag).
- Governance = Lead lunch schedule.
- Packs = unscoped practice tables dressed as policy.
- Roles = unset by default with a courtesy Andon.
- Oversight = a page nobody acknowledges, truncated at 500 rows.
- Offices = labels every writer can select.

That is **compliance theater at enterprise scale**: the features named after the controls Legal wants, implemented as **single-practice conveniences**. Do not “fix” this with a PDF security questionnaire and a bigger digest headline. Either ship **E1–E5** or stay honest: **Smile Notes is a practice instrument, not a DSO control plane.**

Same family of trap: promising a “DSO admin console” that is only Hierarchy Manager screenshots plus more Leads. Headcount is not architecture.

---

## Explicitly do not ship (DSO hate)

- Per-office pack factories as the scaling story (forty dual-control queues).
- Soft “training mode” that leaves unset writers productive on real patients.
- Scoreboards / per-staff GPA dashboards sold as “enterprise visibility” (poisons notes; charter already forbids).
- Ambient / Care+ note generation to “speed onboarding across sites.”
- Claiming BAA + de-id banner = multi-site HIPAA posture (IT hate panel already killed that cousin).

---

## Measurement (falsifiers)

| Metric | Keep (enterprise) | Kill (current shape) |
| --- | --- | --- |
| Clinical writers on SSO | 100% of production writers | Local password accounts as steady state |
| Unset clinical role at open | ~0 scheduled writers | Andon-only; unset still files / judges |
| Pack publish source | Corporate catalog + audited overlay | Ad-hoc Lead publish with no office/region |
| Digest / rollup closed-loop | Ack + owner + close rate tracked | Page exists; no receipt; 500-row truncation |
| Cross-office draft visibility | Explicit grant only | Everyone can select / see practice-wide by Lead+ habit |
| Transfer SPOF | Peer/dentist path when Lead offline | Lead-only; Copy bypass while waiting |

---

## Open questions for the owner (not for the VP — they already voted no)

1. Is Smile Notes ever intended past a **single practice entity**, or is DSO a non-goal that marketing must stop implying?
2. If multi-site is real: IdP choice and who owns clinical-role source of truth (HRIS vs Lead)?
3. Pack authority: corporate-only vs regional overlay — pick before Workflow is sold outward.
4. Accept **Copy lock on handoff** (Board hate) as part of enterprise honesty, or admit Curve remains the ungoverned egress?

## Related

- `knowledge/sources/adversarial-it-hipaa-security.md` — MFA/session/clipboard kills (sibling identity pressure)
- `knowledge/sources/tn-board-investigator-hate.md` — unset role + Copy-past-handoff as Board exhibits
- `knowledge/sources/team-lead-practice-packs-workflow.md` — Lead dual-control pack model
- `knowledge/artifact/cornerstone-dental-arts.md` — three-office scope; unset role as known unknown
- Code: `src/lib/auth/roles.ts`, `src/lib/auth/clinicalRoles.ts`, `src/lib/db/schema.ts` (`offices`, `practice_packs`), `src/app/digest/page.tsx`, `src/lib/auth/loginAction.ts`
