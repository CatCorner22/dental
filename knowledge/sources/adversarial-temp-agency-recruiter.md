# Adversarial hate panel — traveling temp agency recruiter (TN)

- **Type**: red-team / adversarial stakeholder simulation (not a live interview)
- **Ingested**: 2026-08-08
- **Tags**: ux, adversarial, temps, ops, adoption, tennessee, red-team, chairside
- **Status**: fix backlog ready; shared-iPad policy needs owner lock
- **Method**: One hostile mock agent instructed to **hate** Smile Notes from the placement business. Grounded in shipped surfaces (unset-role Andon, Training Arena, Fast Lane / My blocks, Curve paste hop, shared-clinic iPad reality). **Not** observed Cornerstone sessions — hypotheses to falsify on a real one-shift placement.

## Axiom

A temp who cannot Copy a clean note by patient three is a failed placement. Smile Notes loses that battle today on **unset role**, **training-as-homework**, **shared iPad authorship**, and the **Favorites speed gap** — not on honesty.

**Why it matters:** Multi-office TN practices buy temps by the day. If day one burns payroll on amber Andons and a second chart that is slower than Curve Favorites, the OM calls the agency, not engineering. The recruiter kills the tool before the RDH ever hates it.

## Persona

| Field | Value |
| --- | --- |
| Lens | Traveling temp agency recruiter |
| Places | RDHs and dental assistants across multi-office East TN practices |
| Skill | Fill chairs by 8:00; keep the account; never eat a no-show blame that was really software |
| Hate | Any surface that makes a competent temp **unproductive on day one** |
| Success metric | Time-to-first Copy ≤ Curve Favorites path by patient three; zero wrong-author filings |

## 5 kills

| # | Kill | Attack surface | Why the recruiter ends the pilot |
| --- | --- | --- | --- |
| **1** | **Unset-role Andon is the greeting** | Default `clinicalRole = "unset"`; builder amber card says Team Lead must set Assistant / Hygienist / Dentist in User admin | Temp arrives before Lead. Scope locks stay open or confusing. First emotional beat is “you are not allowed to be useful yet.” Placement looks broken; agency gets the callback. |
| **2** | **Training is a third job, not a Fast Path** | `/training` Arena: bounty scenarios (root canal, SRP, sedation numbers), not a one-shift role-scoped path into real modules | Temps are paid for chairs, not homework. “Complete the arena first” steals productive minutes. Soft training that disables hard stops (tempting fix) teaches thin charts that then hit production. Either way: day-one drag. |
| **3** | **Shared iPad has no hard author switch** | One clinic iPad; prior session / prior My blocks / prior draft context; ALCOA+ attributable fails when accounts blur | Temp B inherits Temp A’s chrome or drafts under the wrong name. Wrong-author on a shared device is an **immediate pilot kill** for any OM who has lived a Board complaint. Recruiter will not send people into that liability. |
| **4** | **Favorites gap vs Curve** | Fast Lane adds **modules**; Curve Favorites / QuickText drop **sentences**. My blocks start empty for a traveling temp. Verified blocks stay under-discovered | Temp’s muscle memory is one-tap prose in Curve. Smile Notes asks for a second app, discovery of chips, then paste. Day-one productivity collapses to “I’ll just type in Curve.” Agency hears: your people are slow. |
| **5** | **Lead bottleneck × multi-office** | Role set + Transfer both need Lead+; Lead is at another Knoxville office; wifi drop without recovery feels like lost work | Unset role (kill 1) and dentist-owned filing cannot self-heal. Temp waits. Chair waits. Recruiter eats the reputation hit for “temps who can’t finish notes.” |

## 5 fixes

| # | Fix | Kills it closes | Notes |
| --- | --- | --- | --- |
| **1** | **Role-before-work at provision** | 1, 5 | Clinical role set when the temp account is created — never day-of Andon. Coordinator Monday readiness strip: unset writers visible before open. Unset must not be the first viewport beat. |
| **2** | **One-shift temp Fast Path** | 2, 4 | Role-scoped ≤3 steps into the visit packs that matter (assistant vs hygienist). Audit stays **on**. Training Arena remains practice — never a gate, never a soft-mode bypass. |
| **3** | **Shared-iPad session hard switch** | 3 | Lock / switch author before the next patient: badge or PIN, clear prior draft chrome, force named session. **Pilot kill if wrong-author is possible.** |
| **4** | **Pinned role packs + paste fidelity** | 4 | Practice-owned attested packs (not personal My blocks) as first thumb targets for temps who have no personal library. Clipboard paste into Curve needs zero cleanup. Fast Lane must feel like Favorites without inventing findings. |
| **5** | **Draft survivability + Lead relief without lies** | 5 | Local recovery after wifi kill. In-flow escalate / secondary when Lead is offline — **no fake Transfer Andon**. Role already set (fix 1) removes the common stuck state. |

## Trap

**Do not ship a shared “temp” login, a soft training mode that disables hard stops, or silent clinical fill / ambient AI to “win Favorites” for day-one speed.**

| Tempting shortcut | Who wants it | Why it is fatal |
| --- | --- | --- |
| One clinic “temp” account (role unset or generic) so placement skips User admin | Recruiter + rushed OM | Destroys attributable authorship; wrong-author on shared iPad becomes policy. Board / plaintiff gift. |
| Soft training / audit-off so temps are not “drowned” day one | Recruiter under callback pressure | Wrong muscle memory. Thin charts graduate to production. Carrier and attorney panels already named this kill. |
| Silent pack dump / Forms clone / ambient fill to match Curve Favorites speed | Product ego + recruiter speed demand | Invents findings. Temps lose the only reason an honest RDH would prefer Smile Notes over Curve. |

The honest speed path is **role already set + role-scoped attested packs + hard session switch + paste fidelity** — never softer gates.

## Falsifiers (recruiter will measure these)

| Metric | Keep agency account | Kill placement / tool |
| --- | --- | --- |
| Temp time-to-first Copy | Down by patient three, day one | Flat/up vs Curve Favorites |
| Unset-role on a scheduled temp | Zero at start of shift | Amber Andon greets the temp |
| Wrong-author on shared iPad | Zero | Any → end pilot; agency pulls people |
| Draft recovery after wifi kill | Recovers | Rebuild from memory → callbacks |
| Training as gate to production | Never | “Finish arena first” on a paid shift |

## Related

- `knowledge/sources/adversarial-hate-panels.md` (aggregate panels; OM lens D overlaps)
- `knowledge/sources/builder-text-blocks-predictive-ux.md` (Favorites gap / safe packs)
- `knowledge/sources/draft-autosave-reliability.md` (wifi / draft survival)
- `knowledge/sources/first-impression-ux-testing.md` (unset-role Andon, go-live honesty)
- `src/lib/auth/clinicalRoles.ts` (default `unset`)
- `src/components/builder/BuilderShell.tsx` (unset-role Andon copy)
- `src/lib/training/scenarios.ts` / `TrainingArena.tsx` (practice arena, not Fast Path)
