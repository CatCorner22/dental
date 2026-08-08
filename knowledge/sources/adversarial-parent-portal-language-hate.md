# Adversarial hate — angry parent / portal chart language

- **Type**: red-team / adversarial patient-family language review (not live parent interviews)
- **Ingested**: 2026-08-08
- **Tags**: plain-language, stigma, anxiety-comfort, pediatric, portal, cures-act, patient-summary, red-team, family
- **Status**: fix backlog ready; portal-bound copy is the policy lock
- **Method**: Hostile mock persona — angry parent of a pediatric dental patient who opened a portal / Cures Act summary and found Smile Notes / chart language cold, stigmatizing, or confusing. Instructed to **hate** the product. Grounded in shipped code: `audience: "patient"` summary that is optional and S3-only for plain words; `STIGMATIZING_PHRASES` at S3 (never rewrite); `anxiety-comfort` add-on unused by any pediatric Quick Pick; `PLAIN_WORDS` missing common pediatric procedure names. **Not** observed Cornerstone parent sessions — hypotheses to falsify with real portal read-alouds.

## Axiom

Your stigma list and plain-word table do not forgive an empty **Written for the patient** box. If a parent opens the portal and reads “Child was uncooperative… pulpotomy on K… radiograph…” while Anxiety and Comfort sat unused on the rail, the note is not “honest documentation” — it is a cold label pasted into a family’s living room.

**Why it matters:** Cures Act access is not a courtesy channel. Parents act on what they can understand and trust. Style-severity theater that never blocks a jargon dump, stigma rules that never rewrite and barely cover pediatric blame-words, and a comfort module that nobody selects for kids are the same failure mode: the product documents the office’s feelings about the child, not the care the caregiver can use next.

## Persona

| Field | Hate lens |
| --- | --- |
| Who | Parent / guardian of a pediatric patient; just read a portal or after-visit summary; already scared about needles, restraint talk, or a crying visit |
| Skill | Everyday English; no dental school; will Google every clinical noun and assume the worst |
| Core hate | Optional patient summary; plain-language that never blocks; stigma that scolds staff in blue S3 while the kid still gets called uncooperative in the record parents see; Anxiety and Comfort built and then left off the pediatric path |

## Five hates (mean, fair, code-grounded)

| # | Hate | Attack surface | Evidence in repo | Why it kills trust |
| --- | --- | --- | --- | --- |
| **1** | **Plain language is a suggestion, not a gate** | Portal / patient summary | `plain-language.test.ts`: findings are always **S3 Style**, “never a block.” `PLAIN_WORDS` only runs on `audience: "patient"` fields. A summary full of *radiograph, caries, maxillary, extraction, prophylaxis* can file. | I cannot tell if my kid has a cavity or “periodontitis.” You built a dictionary, then graded it “wording only.” Style does not stop a confused parent from spiraling at 9 p.m. |
| **2** | **The patient box is optional — so parents inherit the chart voice** | Cures / portal path | `universal-core` section **Written for the patient**: comment says compose omits an empty section; “a note that skips this costs nothing.” Delivery is required only *if* someone bothered to write the summary. | You know patients read notes by law (header in `plain-language.ts`). Then you made the plain voice skippable. When staff skip it, I get the legal record tone — abbreviations, tooth letters, clinician shorthand — and you still claim a “patient-facing layer.” |
| **3** | **Stigma rules are S3 theater with pediatric blind spots** | Labeling a scared child / blaming a parent | `STIGMATIZING_PHRASES`: *uncooperative*, *refused*, *failed to*, *claims*, *no-show* — all **S3**, never auto-applied (`standardize.ts` refuses to rewrite stigma). No hits for everyday kid-blame: *difficult child*, *behavior problem*, *tantrum*, *noncompliant parent*, *mom insists*, *spoiled*. Effort rude-list catches *whiny/hysterical* at S1 in the full note — still not a parent-voice rewrite, and not wired as a portal-specific hard stop. | Flagging “uncooperative” in a blue chip while the sentence still ships into my portal is contempt with a style badge. “Patient refused” → “declined” is adult framing; on a five-year-old it reads as **we** failed you. You catch the textbook slur and miss the family-shaming register. |
| **4** | **Anxiety and Comfort exists — and kids almost never get it** | Unused module / wrong scaffold | `anxiety-comfort.ts`: structured patient-reported anxiety, concerns, comfort measures, “what helped / repeat next time.” Only Quick Pick that loads it: **assistant-chairside** (`direct-restorative` + imaging + anxiety). **No pediatric Quick Pick at all.** `pediatric.ts` has free-text **Patient response** and a three-option behavior-guidance select — perfect place for “uncooperative” to land instead of “agreed a stop signal / took breaks / support person.” | My kid told intake they were terrified of the drill. That answer had “nowhere to live” until you built this module — then you left it off the visit type that needs it. Next clinician re-asks from scratch; I read a behavior label instead of what actually calmed them. |
| **5** | **Adult “you” + missing pediatric plain words** | Confusion / cold voice | Patient-summary `standardPhrases`: “We cleaned **your** teeth,” “We filled a cavity,” adult openers. `PLAIN_WORDS` has *extraction, restoration, prophylaxis* — **zero** entries for *pulpotomy, pulpectomy, stainless steel crown, silver diamine fluoride, sealant, space maintainer* (all options on the pediatric module). Help text admits Standardize “rewrites toward clinical wording, which is usually the wrong direction for this box.” | You hand me “pulpotomy on the mandibular primary…” with no plain twin. I hear nerve death and Google horror. Or you Standardize my plain words *back* into jargon. Addressing a kindergartner as “you” in a guardian portal is not warmth — it is a template that forgot who is reading. |

## Four fixes (do these; stop polishing the dictionary)

Effort = invasiveness. **Policy** = anything marked portal / patient delivery must be readable and non-stigmatizing on the **default** path, not after a staff hero moment.

| # | Fix | Kills | Notes |
| --- | --- | --- | --- |
| **1** | **Portal delivery gate: plain words or explain-once, or no send** | 1, 2, 5 | When `patient-summary-delivery` is portal / printed / given, open `plain.*` findings block delivery (or require the house “term (plain explanation)” form). Empty patient summary cannot claim portal delivery. Skipping the section is fine for internal drafts — not for “sent through the patient portal.” |
| **2** | **Pediatric path bundles Anxiety and Comfort** | 4 | Add a featured **Pediatric visit** Quick Pick: `pediatric` + `anxiety-comfort` (+ imaging as needed). Soft-require anxiety level / comfort measures when pediatric procedure fields are filled, or surface a hard omission if behavior guidance is used and anxiety-comfort is absent. The “what helped” field is the handoff parents actually need. |
| **3** | **Stigma: close pediatric/parent gaps; escalate when audience is patient or delivery is portal** | 3 | Extend patterns for kid/parent blame register (*difficult*, *tantrum* as character label, *noncompliant parent*, *spoiled*, etc.) with the same care you used for diabetic-vs-diagnosis. On `audience: "patient"` text (and composed text destined for portal delivery), treat stigma as **S1/S2 stop**, not blue Style. Still never auto-rewrite meaning — block until a human replaces the label with behavior + what was tried. |
| **4** | **Parent-voice phrases + pediatric PLAIN_WORDS; freeze Standardize on patient fields** | 5 | Add plain entries for pulpotomy, SSC, SDF, sealant, space maintainer, primary/permanent in caregiver words. Standard phrases: “Here is what we found for your child,” guardian-addressed, 5th-grade. Disable or invert Standardize on `audience: "patient"` so one click cannot jargonize the portal box. |

## The trap — caring rules that never touch the parent

**Plain-word list + stigma S3 chips + Anxiety and Comfort on the rail + a skippable patient summary** is the trap.

It photographs as Cures-ready and person-first. Version notes can brag about the patient-experience layer. Reference pages show the tables. Tests prove “uncooperative” is detected and “radiograph” is flagged.

Then a busy chairside note selects Pediatric, types a free-text response that labels the child, skips **Written for the patient**, never opens Anxiety and Comfort, files clean of S0/S1 — and the parent later reads chart voice (or a jargon paste) in the portal. Every “caring” control was either optional, Style-only, or on a Quick Pick kids do not use.

That is language **theater**: the dictionaries exist; the family still gets cold, stigmatizing, or confusing copy. Do not “fix” this with more adult standard phrases or another S3 row. Wire the portal path, the pediatric scaffold, and the severity of labels parents will read — or admit the patient layer is a staff conscience feature, not a family one.

## Explicitly do not ship (parent hate)

- Auto-rewriting stigma into softer synonyms that change clinical meaning (keep human judgment; block, don’t invent).
- Inferring sedation from a high anxiety rating (module already forbids this — keep that line).
- Replacing the clinical record voice with portal voice inside Curve / legal fields.
- A “friendly” AI rewrite of the patient summary that invents comfort measures the team did not document.
- More STYLE findings with no delivery gate — another blue chip is not a handoff.

## Measurement (falsifiers)

| Metric | Keep | Kill |
| --- | --- | --- |
| Portal-marked summary with unresolved `plain.*` | 0 ship | S3-only file + send |
| Pediatric Quick Pick includes `anxiety-comfort` | Default scaffold | Anxiety only on assistant restorative |
| Stigma hit inside `audience: "patient"` text | Blocks delivery / S1+ | Blue S3 and still pasted |
| Parent read-aloud: can state what happened next without Googling procedure names | Yes on first pass | Pulpotomy / SSC / SDF unexplained |
| “What helped” present when behavior guidance used | Present or explicit N/A | Free-text “uncooperative” only |

## Open questions for the owner

1. **Portal delivery as hard gate** — accept friction on finish when patient text still has jargon or stigma?
2. **Require anxiety-comfort with pediatric** — always, or only when behavior guidance / stabilization used?
3. **Guardian address vs child “you”** — practice preference for portal voice when the patient is a minor?

## Related

- `knowledge/sources/adversarial-a11y-advocate-hate.md` (sibling red-team form)
- `src/lib/vocab/plain-language.ts` (S3-only patient dictionary; Cures rationale)
- `src/lib/vocab/vague-phrases.ts` (`STIGMATIZING_PHRASES`)
- `src/lib/modules/anxiety-comfort.ts`
- `src/lib/modules/pediatric.ts`
- `src/lib/modules/universal-core.ts` (optional patient-facing section)
- `src/lib/presets/quickPicks.ts` (no pediatric pick; anxiety only on assistant-chairside)
- `src/lib/audit/rules/plain-language.test.ts` / `stigmatizing.test.ts`
