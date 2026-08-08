# Adversarial hate panel — front desk coordinator

- **Type**: red-team / adversarial stakeholder simulation (not a live interview)
- **Ingested**: 2026-08-08
- **Tags**: ux, adversarial, ops, front-desk, schedule, curve-hero, adoption, red-team
- **Status**: ops fix backlog; minutes are hypotheses to falsify on a real morning board
- **Method**: One mock agent — front desk coordinator who owns the chair board, checkout line, and the yell when the note is not in Curve. Instructed to **hate** Smile Notes. Grounded in charter reality (paste handoff, no write-back) and prior hate themes (two-app tax, doctor late, shared device). **Not** observed Cornerstone sessions.

## Axiom

I do not care that your note is “better.” I care that the **chair turns**, the **doctor is not late**, and the **chart in Curve is done** before the patient hits my window. Smile Notes that lives outside my board is schedule poison.

**Why it matters:** Friendly panels polish the builder. This panel kills the pilot when documentation lag becomes **waiting-room anger aimed at front desk**.

## Persona

| Field | Value |
| --- | --- |
| Role | Front desk coordinator (schedules chairs; owns board + checkout) |
| Personality | Hostile, time-obsessed, zero patience for second-app theater |
| Skill | Curve schedule fluency; can smell a “we’ll chart later” lie in one glance |
| Core hate | Schedule slip · two-app chaos · doctor late · I get yelled at for clinical lag |

## Six hate bullets

1. **You made me the note cop.** Patient at the window. Doctor still in Smile Notes. OM asks *me* why Curve is empty. I did not write the note. I still eat the scream.
2. **Two-app chaos is my tax.** Clinical lives in Smile Notes. My life is Curve schedule, phones, and checkout. Every hop is a chair I cannot seat and a call I cannot answer.
3. **Schedule slip is not abstract.** Hygiene runs long because paste + audit theater ate the turnaround. Next patient waits. I get the glare, not your Ready chip.
4. **Doctor late is product failure with my face on it.** Associate finishes operatory, then babysits your gate instead of walking to the next chair. Lobby clock does not care about attestation.
5. **I cannot see “note in Curve” from the board.** No status I trust. I chase assistants by text. Text is not a documentation system. Text is how pilots die quietly.
6. **Shared iPad / wrong author / Lead away = dead chairs.** Someone’s draft is stuck, Transfer is theater, wifi hiccups, and I am smiling at a full waiting room while back is “almost done.”

## Bypass behaviors (what I will do to protect the board)

| Bypass | What it looks like | Harm |
| --- | --- | --- |
| **Curve-only day** | I tell clinical: skip Smile Notes, QuickText in Curve, move. | Pilot adoption collapses; thin charts return |
| **Seat cold, chart later** | Next patient sits while yesterday’s note is “finishing.” | Wrong-visit attach risk; memory notes; I still get blamed at 5pm |
| **Verbal green light** | Assistant says “note’s done” — means drafted, not pasted. | Checkout without Curve Clinical History; OM explosion |
| **Buffer the doctor** | I pad the schedule 10–15 min because I already know the hop tax. | Capacity loss; “Smile Notes tax” becomes permanent folklore |
| **Text-and-yell ops** | Group text: “Who still has open notes?” instead of any product signal. | Noise, missed patients, coordinator burnout |
| **OM override path** | Escalate to OM to force Curve Favorites and kill the second app for the afternoon. | Explicit pilot kill |

## Five ops fixes — ranked by minutes saved (hypotheses)

Minutes = coordinator + chair-turn + lobby bleed avoided per busy half-day at one office. **Falsify on a real board.** Charter still forbids Curve write-back; fix the hop and the signal.

| Rank | Fix | Est. min saved / half-day | Why front desk cares | Do not ship |
| --- | --- | --- | --- |
| **1** | **Board-visible “Copied → in Curve” signal** (per chair / provider; coordinator strip, not clinical essay) | **25–40** | Stops text-chasing; I seat and checkout on facts | Fake “filed in Curve” without paste proof · write-back fantasy |
| **2** | **DDS killer-only finish + fat Copy** (hygiene builds; dentist ≤3 killers then paste) | **15–25** | Doctor late shrinks; I stop padding the schedule for nanny software | Full AuditPanel sermon on every DDS Copy |
| **3** | **Paste fidelity + cursor-ready clipboard** (zero cleanup in Curve) | **10–18** | Hop tax drops without second chart | Ambient invent · Forms clone |
| **4** | **Monday readiness + shared-iPad hard author switch + draft survivability** | **8–15** | Dead chairs from unset role / wrong author / wifi die less often | Soft audit mode · fake Transfer when Lead offline |
| **5** | **90-second coach card for “notes late to Curve”** (practice digest → one action, not unread homework) | **5–10** | OM and I coach one pattern instead of daily fire drills | Peer scoreboards · cheer at checkout |

### Sequencing front desk will accept

1. Ship **#1** or I keep Curve-only bypass. No signal = no trust.
2. Ship **#2 + #3** or I keep padding the doctor and blaming your app for lobby anger.
3. Ship **#4** or shared-device mornings end the pilot.
4. **#5** only after the board signal exists — coach without telemetry is another meeting.

## Traps (what this persona begs for that must be refused)

| Trap | Why I ask | Why you refuse |
| --- | --- | --- |
| Write notes straight into Curve for me | Ends my two-app hell | Charter: paste handoff; no public write API you can trust |
| Soft mode so chairs move | Speed today | Wrong muscle memory; thin charts graduate |
| “Mark complete” button I can hit from front desk | Stops the yell | Launders incomplete clinical into green |
| Auto seat-next when Smile Notes says Ready | Board automation fantasy | Ready ≠ in Curve; false confidence |

## Measurement (falsifiers for this panel)

| Metric | Keep | Kill |
| --- | --- | --- |
| Coordinator chase texts / half-day about open notes | Down ≥50% after board signal | Flat → bypass |
| Median chair turnaround when Smile Notes is in play | ≤ baseline Curve-only +2 min | Persistently worse → pad schedule forever |
| Doctor “late to next chair” attributed to note finish | Falling | Rising → OM kills pilot |
| Checkout with no Curve Clinical History same day | Near zero | Any pattern → verbal green-light culture |
| Wrong-author / stuck draft blocking a chair | Zero | Any → end shared-iPad use of product |

## Open questions for the owner

1. **Who owns the board signal?** Coordinator-facing status without PHI leakage across the desk.
2. **What proves “in Curve”?** Copied timestamp only, or human attest that paste landed on the visit?
3. **Shared front/back devices** — badge/PIN per patient, or accept dead-chair kill criterion?

## Related

- `knowledge/sources/adversarial-hate-panels.md` (clinical / attorney / OM / DDS panels — sibling swarm)
- `knowledge/sources/check-your-note-ux-research.md`
- `knowledge/sources/go-live-ux-command-check.md`
- `knowledge/sources/draft-autosave-reliability.md`
- Charter: paste + two-ID handoff; no Curve write-back
