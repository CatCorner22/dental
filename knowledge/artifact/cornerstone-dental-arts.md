# Project Artifact — Cornerstone Dental Arts

**What this file is.** The living synthesis for the Cornerstone project. It sits on top of the
source files in `knowledge/sources/` and links to them rather than repeating them. Update it after
every significant step. Read it first when a new session starts.

**Filing rule.** New sources go through the `ingest-source` skill into `knowledge/sources/` and get
one line in `knowledge/INDEX.md`. This Artifact is the synthesis layer, not a second filing system.

**No protected health information appears here, ever.** This project is de-identified by design.
Write about roles, patterns, and populations — never a named person, never an exact date of service.

---

## 1. Goal and end deliverable

**Goal.** Fit Smile Notes — a de-identified, deterministic note-standardizing tool — to the real
practice that will use it, and keep it defensible under Tennessee law.

**End deliverable.** A working tool that three Knoxville offices can use chairside, where:

- every filed note records which office produced it, who filed it, and under which ruleset version;
- the tool refuses to invent any clinical fact, and blocks a note that carries an identifier;
- staff can find the rule that applies to them, in plain words, in the app; and
- the practice can point at the evidence behind each rule.

**Term note.** *De-identified* means no patient name, exact date, contact detail, record number, or
image. *Deterministic* means the tool makes no AI calls and never guesses — it reorders and flags
what a human typed, and nothing more.

---

## 2. Progress log

| Date | Step |
| --- | --- |
| 2026-08-02 | Filed the Curve Hero benchmark source. |
| 2026-08-03 | Filed the Cornerstone practice profile and both Tennessee sources. Resolved the retention question. |
| 2026-08-03 | Shipped Phases 0–5 of the Cornerstone plan across five pull requests: dose safety, offices, clinical roles, three service modules, periodontal structure, Cures Act language, reference parity. |
| 2026-08-03 | Hardened the de-identified premise: bare-name detection, a real attestation, a privacy status, and redaction. |
| 2026-08-03 | Hostile review plus a browser accessibility pass. Fixed twelve items; ten remain open and are listed in §9. |
| 2026-08-03 | Created this Artifact. Seeded from five existing sources. Ingested nothing new. |
| 2026-08-03 | Built the patient-experience layer from the practice's own standardization document: encounter types for phone and portal contact, an open-items handoff, an anxiety and comfort module, a patient-facing summary with its own plain-word rule, and a page splitting the note header between Curve Hero and Smile Notes. Money stays out of the clinical record entirely, at the practice's direction. |
| 2026-08-06 | Researched Curve Hero note shape (Forms / QuickText / AI SOAP) vs Smile Notes builder acceleration. Filed `knowledge/sources/builder-text-blocks-predictive-ux.md`: verified blocks and MyBlocks already exist but are under-discovered; recommended section-scoped suggested blocks and Fast Lane text packs — not a Forms clone or ambient AI. |
| 2026-08-08 | Market UX + four mock stakeholder panels (hygiene, dentists+OM, design/IT, temps). Filed `knowledge/sources/market-ux-stakeholder-panels.md`: Daylight-chart brand recommit, glove-first tablet finish, role-before-work; ambient AI / write-back / scoreboards rejected. |
| 2026-08-08 | Shipped Daylight chart tokens + glove-first tablet finish + pinned My blocks + audit WHAT/WHY/HOW pedagogy (market panels #1/#2/#4/#5). |
| 2026-08-08 | Ran expanded adversarial hate panels (≥4× prior pool of 5): 24 unique hostile lenses + per-lens digests; consolidated fix backlog and pilot kill criteria in `knowledge/sources/adversarial-hate-panels.md`. Simulated agents only — not live Cornerstone interviews. |

---

## 3. Source ingest log

**Read this row first: none of these five sources is peer-reviewed primary literature.** All are
commissioned consultancy or research reports supplied by the project owner, or an internal
assessment. They are useful, and several proved accurate when tested against the code — but their
claims carry the confidence of a consultancy report, not of a controlled study. Treat any clinical
or financial number in them as a lead to verify, not as an established finding.

| Source | Peer-reviewed | Full text read | Conclusions supported by its own data | Confidence |
| --- | --- | --- | --- | --- |
| [Curve Hero PMS documentation](../sources/curve-hero-pms-clinical-documentation.md) | **No** — vendor and market research | Yes | **Partial** — describes product behavior; no study design | Moderate for feature description; low for any performance claim |
| [Cornerstone practice profile](../sources/cornerstone-dental-arts-practice-profile.md) | **No** — commissioned report | Yes | **Partial** — practice facts plausible; marketing figures vendor-sourced | Moderate for staffing, services, and the abbreviation dictionary; **low** for the amenity and revenue claims |
| [TN note standardization](../sources/tn-dental-note-standardization-curve-hero.md) | **No** — commissioned deep research | Yes | **Yes** — cites named rules and states its own limits | Moderate-to-high for the legal framing; the report says outright it is not a legal opinion |
| [TN legal best practices](../sources/tn-dental-legal-best-practices.md) | **No** — commissioned report | Yes | **Yes** — cites specific code sections and a reproducible abbreviation table | High for the Joint Commission table; moderate for the rest |
| [Smile Notes vs Curve Hero benchmark](../benchmarks/smile-notes-vs-curve-hero.md) | **No** — internal assessment | Yes | **Yes** — every claim traced to a file, assessed against code not the README | High for what the code does; it makes no external claims |

**What raises confidence anyway.** Three independent sources agree on the adult retention period,
and the Joint Commission abbreviation table matched, item for item, the gaps that adversarial
testing found in the code. Independent agreement across sources is weaker evidence than a study,
but it is real evidence.

---

## 4. Key findings

**The practice.** Three offices in Knoxville — Town & Country Circle, Executive Park, Fort Sanders
West — around 30 staff, founded 1988, running Curve Hero. Doctors, hygienists, assistants, and
coordinators all work in the building, so the clinical-role distinction Tennessee law turns on is a
real staffing fact here, not a hypothetical.

**Tennessee sets an outcome, not a format.** The state prescribes no SOAP order. The record must
let a later dentist reconstruct the basis for diagnosis, plan, outcome, and continuity of care.
Any recommended note order is a conservative design choice, not a statutory mandate.

**Retention — resolved.** Two sources looked like they disagreed. They did not:

- **Adults: seven years** from last professional contact (Tenn. Comp. R. & Regs. 0460-02-.12).
- **Minors: minority plus one year, or ten years from last service, whichever is longer** — and
  that ten-year figure comes from a *different authority*, the TN Department of Health Standards of
  Practice Manual. The Board rule's minor floor is seven.
- Taking the longer period satisfies either reading. Taking seven does not.

This was a category error, not a legal conflict. Worth remembering as a pattern: when two sources
disagree on a number, check whether they are answering the same question about the same population.

**Diagnosis belongs to the dentist.** Tennessee hygienists may collect findings *for* diagnosis;
assistants may not exercise professional judgement. So the tool must never turn a staff observation
into a diagnosis, and must record three identities separately: who typed the entry, who performed
the care, and which dentist reviewed it.

**The Joint Commission "Do Not Use" list is the sharpest actionable finding.** The report reproduced
it in full, and it matched the gaps testing found in the code exactly — `U`, `IU`, `MS`/`MSO4`/
`MgSO4`, trailing zeros, and the missing leading zero. That last one was not merely undetected: a
live test showed the tool was *mangling* it, turning "Midazolam .5 mg" into "Midazolam.5 mg" and
misquoting ".50000 mg" as "50000 mg". All fixed.

**Patients read these notes.** The 21st Century Cures Act gives patients routine access, which makes
plain, person-first, non-stigmatizing wording a documentation requirement rather than a courtesy.

---

## 5. Statistical analyses performed

**None yet, and that is worth stating plainly.** No source supplied a 2×2 table, a sensitivity or
specificity figure, a confidence interval, or an absolute risk. The numbers these reports do carry
are counts and market figures, not test performance or treatment effect.

Two numbers deserve caution if anyone tries to act on them:

- *"Luxury amenities raise case acceptance 15–45% and patient acquisition 18–60%."* Vendor-sourced,
  no study design, no comparator, an implausibly wide range, and an obvious commercial interest.
  This is a marketing claim wearing a percentage. Do not spend money on it without a real source.
- *"368 reviews at 4.59 stars, 42% spam rate."* A market snapshot with no stated method.

When a clinical or diagnostic question does arrive, the rules in
`references/stats-and-risk.md` apply: absolute risk beside relative risk, NNT where relevant, and
the assumed prevalence stated beside any PPV.

---

## 6. Open questions and known unknowns

**Known unknowns — we know we do not know these:**

1. Does Cornerstone actually offer facial aesthetics (botulinum toxin, fillers)? The profile lists
   it as a service. That is a different regulatory surface — product, lot, expiry, reconstitution,
   adverse events — and no module exists. **Asked, not yet answered.**
2. Which staff hold which clinical role? The tool defaults every account to "unset", which
   restricts nobody, and waits for the practice to say.
3. Has Tennessee dental counsel or the liability carrier reviewed any of this? The standardization
   report explicitly recommends it and says it is not a legal opinion. No evidence that review has
   happened.
4. What is the practice's actual chart-audit cadence today? The report recommends 5–10% monthly or
   quarterly. Current state unknown.
5. Which of the three offices will pilot first, and does the pilot cohort include a hygienist and an
   assistant, not only doctors?

**Suspected unknown unknowns — where a surprise most likely hides:**

- **The gap between the written workflow and the chairside one.** Every source describes intended
  process. None observed a real appointment. The place a documentation tool fails is the ninety
  seconds between patients, and we have no observation of that.
- **Curve Hero's actual paste behavior.** The whole design assumes a human copies a note into Curve.
  Nobody has watched that happen. Formatting loss, field limits, or an autosave collision would all
  surface only in the real product.
- **What staff already do to save time.** Copy-forward habits, personal shorthand, and shared logins
  are common in busy practices and none would appear in a commissioned report.
- **Whether the de-identified premise survives contact with reality.** Staff under time pressure may
  type a name because it is faster. The tool now detects, redacts, and blocks — but the honest
  measure is what people actually type in month three.

---

## 7. Structured challenges

**Challenge: "Three independent sources agree on seven years, so it is settled."**
Two of the three trace to the same underlying regulation, so this is closer to one source cited
three times than to three independent confirmations. The adult figure is very likely right, and it
matches what the app already said — but the practice's own counsel should confirm it, and the
minors rule remains genuinely split between two authorities. *Response: kept the seven-year adult
statement, rewrote the minors line to cite both authorities and take the longer period.*

**Challenge: "The reports describe the practice accurately."**
They describe what someone was told about the practice. Staffing, services, and revenue came from
public sources and interviews, not from an audit. The abbreviation dictionary is the most
trustworthy item because it is concrete and checkable; the revenue estimate is the least.

**Challenge: "The tool is de-identified, therefore compliance is straightforward."**
This premise is doing the heaviest lifting in the whole design, so it deserves the hardest look.
Testing found it weaker in code than on paper — lowercase names were invisible, a redaction button
left identifiers behind, and the draft title still bypasses the screen entirely and reaches the
outbound filename. Several are fixed; the title is not. *A premise this load-bearing needs
continuous testing, not a one-time assertion.*

**Challenge: "Auto-populating note sections from dropdowns saves time, so it is good."**
It also makes the record assert something nobody did. A dropdown that writes "reviewed home care"
puts a claim in a legal document that no human stated. *Response: declined. One-click phrases a
clinician picks give the same keystroke saving with a person in the loop.*

**Challenge: "The practice wants a locked note header with patient ID, date, and time."**
That is a Curve Hero header. An electronic record stamps those automatically; a de-identified
drafting layer must not hold them. *Response: build the safe fields, and give staff a page saying
which fields belong in Curve.*

---

## 8. Care-plan and practice-improvement implications

**For patient care**

- Dose-safety abbreviations now get caught before a note leaves the tool. This is the change most
  likely to prevent a real harm, and it came directly from the Joint Commission table.
- Range of motion, pocket depths, and bleeding scores are now numbers the tool can compare between
  visits, so a later reader sees a trend rather than a paragraph.
- Sleep apnea notes now state that the diagnosis and the sleep study belong to the physician, which
  keeps the dental record inside the practice of dentistry.

**For the team**

- Clinical roles are recorded separately from system permissions, because a licence and a job title
  are different things.
- Every rule the tool enforces is visible to staff in the app, in the same words the checker uses.
- Documentation stays in plain, person-first language, because patients read it.

**For the practice**

- Each filed note carries its office, its submitter, and its ruleset version, frozen at filing.
- The de-identified premise is now tested rather than asserted — with ten known gaps still open.

---

## 9. Next actions

**Highest value first.**

1. **Close the draft-title gap.** The title is never checked for identifiers and becomes the
   emailed attachment filename. This is the largest remaining hole in the de-identified premise.
2. **Work the nine other verified findings** from the hostile review — false alarms that block
   legitimate notes, four unrecognised date formats, and a redaction path that erases clinical text.
3. **Ask the practice the five open questions in §6**, starting with facial aesthetics and who holds
   which clinical role.
4. **Watch how staff use the patient summary.** The plain-word rule is new and its list is a first
   draft. Two things to measure at the pilot: which words staff keep and explain rather than
   replace, and which clinical terms the list is missing. Both change the list, and neither can be
   guessed from outside the operatory.
5. **Get Tennessee dental counsel to review**, as the source report itself recommends.
6. **Watch one real appointment** at each office before the pilot. Every source describes intended
   process; none observed the actual ninety seconds between patients.
7. **Decide on the HIPAA 2026 operational controls** — mandatory multi-factor sign-in, encryption at
   rest, annual security risk analysis, business-associate agreement tracking, and Tennessee's
   45-day breach notification. These are practice operations and hosting, not app features, and the
   repository documents none of them. Multi-factor sign-in and encryption at rest are partly
   app-side and could be built.

---

## 10. Glossary

| Term | Plain meaning |
| --- | --- |
| De-identified | No patient name, exact date, contact detail, record number, or image |
| Deterministic | Makes no AI calls and never guesses; it reorders and flags what a human typed |
| EDR / PMS | The electronic dental record — here, Curve Hero — where the real chart lives |
| Scope of practice | What each licence legally allows that person to do |
| Cures Act | US law giving patients routine access to their own notes |
| Frozen record | The exact copy of a note stored at filing; it never changes afterwards |
| NNT | Number needed to treat — how many people get a treatment for one to benefit |
| Prevalence | How common a condition is in the group being tested |

---

## 11. Stakeholder and co-design input

**Recorded so far:** the project owner has made every scoping decision to date — build all four
gaps, keep the app configurable per practice, keep money out of the clinical record entirely,
refuse dropdown auto-writing, and route the two unreachable reference documents.

**Not yet gathered, and needed:** input from the people who will use this daily — hygienists,
assistants, and front-desk coordinators. Every design decision so far rests on reports about the
practice and on the owner's judgement. Neither is a substitute for watching a hygienist try to
file a note between patients.
