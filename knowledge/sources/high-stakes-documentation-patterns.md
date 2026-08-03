# Transferable patterns from other high-stakes documentation domains

- **Source**: Web research compiled 2026-08-03 from primary standards and regulator
  documents where they exist (FAA AC 00-46F, ICAO Doc 9432 / Annex 10, 14 CFR 121.542,
  NASA CR 177549 / Degani & Wiener, IAED *Principles of EMD* ch. 12, DOE-HDBK-1028-2009,
  DOE O 422.1, W3C WCAG 2.2, EU GMP Annex 11, FDA eCTD Technical Conformance Guide,
  GOV.UK Service Manual and Design System, NN/g), plus clearly-labelled vendor material
  for the legal-tech UX conventions where no standards body exists.
- **Type**: research synthesis for design and rule work
- **Ingested**: 2026-08-03
- **Tags**: aviation, human-factors, checklists, emergency-dispatch, nuclear-safety,
  legal-tech, accessibility, wcag, poka-yoke, audit-trail, gxp, ectd, provenance, ux
- **Scope note**: deliberately NOT a dental-software competitor scan (that is
  `curve-hero-pms-clinical-documentation.md` and
  `benchmarks/smile-notes-vs-curve-hero.md`). Everything below is imported from a
  domain that has no dental content at all.

## Why this document exists

Smile Notes already has the *hard* parts of several of these patterns —
`verifyMeaning()`, the S0–S4 severity ramp, FIX-OR-ATTEST resolution, the export
jidoka gates, `RULESET_VERSION` stamping, the submission ticket. What the other
domains supply is (a) names for what exists, which is worth more than it sounds when
talking to a practice owner or a carrier, and (b) a small number of genuinely missing
mechanisms. Each entry below says which of the two it is.

---

## 1. Aviation

| Pattern | What it is |
|---|---|
| **Readback / hearback** (ICAO Annex 10 Vol II; Doc 9432 §2.8.3) | The receiver repeats safety-critical items back verbatim; the sender is *required* to listen and correct discrepancies. Stringency scales with the seriousness of a misunderstanding — only a named list must be read back (route clearances, runway instructions, altimeter settings, SSR codes, levels, headings, speeds). |
| **Standardised phraseology** (ICAO Doc 9432) | A closed vocabulary with fixed meanings, and words banned outside one context ("TAKE OFF" is used only for the actual clearance; "DEPARTURE"/"AIRBORNE" otherwise). |
| **Challenge–do–verify vs do–verify** (Degani & Wiener, NASA CR 177549 / *Human Factors* 35(2)) | Two checklist philosophies. CDV is one item at a time in unvarying sequence with a second person verifying; DV lets the crew work from memory flows and then verify. Crews degrade CDV into a fast "do-list" when the checklist is long — and lose exactly the redundancy the checklist existed for. |
| **Killer items** (same) | The critical subset whose omission *alone* can cause an accident. Guideline: put them as early as possible in the task-checklist, and duplicating a very few of them is justified. |
| **Sterile cockpit** (14 CFR 121.542) | During named critical phases, only duties required for safe operation are permitted — the rule enumerates the phases rather than leaving "critical" to judgment. |
| **ASRS ID strip + de-identification** (FAA AC 00-46F §10.2, §11) | The reporter's identity lives on a detachable strip which NASA time-stamps and *returns as a receipt*, then analysts strip names, dates and times from the narrative before it enters the database. Confidentiality and "proof I filed" are solved by two separate artefacts. |
| **ASRS narrative scaffold + CALLBACK** (ASRS briefing material) | The free-text box is prompted ("Who, When, What, Where, Why — tell us your story") and training shows a side-by-side *insufficient* vs *excellent* narrative. De-identified lessons are published back to the community in the CALLBACK newsletter. |

**Apply here**

1. **Readback as the AI-accept interaction, with a stringency list.** `verifyMeaning()`
   already does hearback in software. What is missing is the ICAO insight that readback
   is *scoped*: not every token is read back, only the named safety-critical class. Define
   a `READBACK_CLASS` — tooth numbers, surfaces, quadrants, drug names, doses and units,
   anaesthetic carpules, times, laterality — and on accepting any AI rewrite make the
   clinician confirm *those tokens only*, rendered as a short list rather than a paragraph.
   Cheap (the token classes already exist in `vocab/teeth.ts`, `vocab/units.ts`,
   `standardize/notation.ts`), and it converts "diff review" from a wall of text into
   five items a human can actually check. This is the single strongest idea in this
   document.
2. **Name the killer items and hoist them.** The audit ramp is ordered by severity, but
   S0/S1 is a wide band. Tag the subset where a single omission is independently
   case-losing (wrong-tooth risk, dose/unit, laterality, consent decision, unresolved
   ambiguity in a medication term) as killer items, render them above everything else,
   and — per Degani & Wiener's explicit endorsement of duplicating a very few critical
   items — repeat them in the pre-copy confirmation even though they were shown once
   already. Cheap: a boolean on the rule definition plus ordering.
3. **A banned-outside-one-context vocabulary tier.** `vocab/` currently splits into
   expand / flag-ambiguous / never-expand. ICAO adds a fourth idea worth stealing: a term
   that is *permitted only in one section*. Candidate: words that are fine in Subjective
   as reported speech but must not appear in Assessment as findings. Moderate cost, and
   it targets a real liability pattern (staff-authored assessment language).
4. **Publish a de-identified CALLBACK.** The gamify/insights layer already computes
   practice-level data. Add a periodic "what the audit caught this month, de-identified"
   digest for the team — the ASRS finding is that a non-punitive, de-identified feedback
   loop is what keeps people reporting rather than hiding. Pure adoption play, cheap,
   and it fits the "encouragement is earned and specific" tone rule.
5. **The ID-strip separation is already yours — say so.** `tickets/stamp.ts` gives staff a
   ticket, timestamp, actor and ruleset version while no patient identifier is stored.
   That is precisely the ASRS ID-strip design, and citing AC 00-46F when explaining the
   de-identified posture to a practice owner is worth more than explaining it from first
   principles.

Sources: <https://asrs.arc.nasa.gov/docs/AC_00-46F.pdf> ·
<https://asrs.arc.nasa.gov/overview/confidentiality.html> ·
<https://www.ealts.com/documents/ICAO%20Doc%209432%20Manual%20of%20Radiotelephony%20(4th%20ed.%202007).pdf> ·
<https://skybrary.aero/articles/read-back-or-hear-back> ·
<https://www.faa.gov/sites/faa.gov/files/2022-11/NASA%20Ames%20Rpt%20CR%20177549%20.pdf> ·
<https://journals.sagepub.com/doi/10.1177/001872089303500209> ·
<https://www.law.cornell.edu/cfr/text/14/121.542> ·
<https://asrs.arc.nasa.gov/publications/directline/dl4_sterile.htm>

---

## 2. Legal drafting and contract review

| Pattern | What it is |
|---|---|
| **Clause library vs playbook** | A clause library stores approved *language*; a playbook adds the *decision layer* — when to use which, and when to stop. Consistently drawn distinction across the practitioner literature. |
| **Three-tier positions** (preferred / acceptable-fallback / walkaway) | Each clause carries pre-approved language at three levels of concession, with the walkaway as a hard floor. |
| **Escalation matrix** | Tier 1 the negotiator decides alone; tier 2 a manager; tier 3 senior counsel. Authority is bound to the tier, not to the person's confidence. |
| **Suggestion mode** (Google Docs; Word tracked changes) | Proposed edits are objects *separate from* the document, coloured, attributable to an author, individually accept/reject, optionally carrying a comment thread; a preview can render the document with all suggestions accepted or all rejected. |
| **Reason codes on out-of-playbook edits** | Non-standard edits are not blocked, they are routed — flagged with context and a reason code to a reviewer. |
| **Hidden-revision / compare detection** | Version-compare tooling that specifically hunts changes someone tried to bury. |
| **Public standard instruments** (oneNDA, Common Paper) | A neutral, branded, community-drafted standard where you fill in *variables only*; edit the body and you lose the right to call it the standard. Adoption argument: "it's not my form, it's the market standard," which removes the adversarial framing. |

**Apply here**

1. **Give every deterministic change and every AI suggestion a three-tier position.**
   Today a change is applied-and-itemised or a flag. Borrow the tiering explicitly:
   *preferred* (canonical expansion, applied deterministically), *acceptable* (a variant
   the practice has approved locally via `LocalVocabularyPanel`), *walkaway* (never
   expanded — the ISMP/Joint Commission do-not-use set, which `2.8.0` already refuses to
   launder). Naming the third tier "walkaway" in the UI and in staff training gives the
   refusal a reason people recognise instead of reading as a tool limitation. Cheap:
   presentation and vocabulary metadata.
2. **Bind attestation authority to a tier — the escalation matrix.** `resolution.ts` has
   ATTESTED and ESCALATED, but any user can attest anything. The legal-ops convention is
   that authority is *pre-assigned per severity*: an assistant may attest S2/S3, a
   clinician S1, and the killer-item class plus any PHI override needs a second named
   person. This is the highest-liability-reduction item in this area and the repo already
   has roles and a wish/escalation channel to hang it on.
3. **Preview-with-all-accepted / all-rejected.** The Google Docs API exposes exactly three
   views (`SUGGESTIONS_INLINE`, preview-accepted, preview-rejected). `tokenDiff` gives the
   inline view; add the two clean previews as a toggle. Cheap, and it answers the question
   a reviewer actually has — "what does the note read like if I take all of this?" —
   without making them simulate it in their head.
4. **Reason codes, not free text, on attestation.** Annex 11 (area 6) and legal exception
   routing agree here: a reason captured as a short predefined list *plus* optional free
   text is reviewable in aggregate, where pure prose is not. `resolution.ts` currently
   demands "real words". Keep that, but prefix a required code (`correct-as-written`,
   `patient-quote`, `practice-standard-term`, `rule-disagreement`) so the QA pass can
   count categories. Cheap, and it turns attestations into improvement data.
5. **Publish the practice's abbreviation dictionary as its "oneNDA".** Cornerstone has its
   own 15-term dictionary. Presenting the shared vocabulary as a neutral practice standard
   with versioned variables — rather than as software imposing rules — is the documented
   adoption lever, and it matches how oneNDA gets past resistance.

⚠️ **Verification note**: the accept/modify/reject *convention* is solidly established
(Word and Google Docs first-party docs). The specific vendor implementations cited
(ContractKen, Paralegent, Vaquill, Intelligex, Spellbook) are marketing pages; treat
their described behaviour as evidence of a convergent convention, not as verified
capability, and treat any efficiency claim as unverified.

Sources: <https://support.google.com/docs/answer/6033474> ·
<https://developers.google.com/workspace/docs/api/how-tos/suggestions> ·
<https://ironcladapp.com/resources/articles/modern-contract-playbook> ·
<https://www.contractken.com/post/contract-playbook-guide> ·
<https://www.onenda.org/how-we-did-it> ·
<https://commonpaper.com/standards/mutual-nda/>

---

## 3. Emergency medical dispatch (MPDS / ProQA)

| Pattern | What it is |
|---|---|
| **Case Entry → Chief Complaint → Key Questions → Instructions → Final Coding** (IAED) | A fixed five-stage funnel. Case Entry is asked of *every* caller; Key Questions are closed-ended and specific to the chosen Chief Complaint. |
| **Determinant code** (e.g. `27-D-4-G`) | The whole interrogation compresses to one short code: complaint number, acuity letter, descriptor, suffix. Downstream systems consume the code, not the transcript. |
| **Scripted PAIs read verbatim vs generalised PDIs** | Pre-Arrival Instructions for cardiac arrest, choking, childbirth, ABCs are *scripted* and read as written; Post-Dispatch Instructions are generalised. Only the highest-stakes text is verbatim-locked. |
| **Named, enumerated omission licences** | Questions may be skipped only when: the caller is in immediate danger, the answer is obvious, or the caller already volunteered it. The shortcut is part of the protocol rather than a deviation. |
| **Compliance scoring with a documented dose–response** | Case review scores whether every question was asked *and asked as written*. IAED reports the correct determinant level was chosen 36.5% of the time when neither Case Entry nor Key Questions hit 100% compliance, 74.5% / 82.2% when one did, and 93.2% when both did. |
| **Risk-scaled review volume** | Centres under 1,300 calls/year review 100% of cases; large centres review a sliding 3%–7%. |

**Apply here**

1. **Answer the "rigid but fast" question the way IAED does: enumerate the skip licences.**
   This is the transferable core. A protocol becomes tolerable in real time when the
   *permitted shortcuts are written into it*. For the note transformer: a required field
   may be satisfied by an explicit, recorded "not applicable — obvious from procedure" or
   "already stated in another section" choice, and the audit records *which licence* was
   used. That is different from an override: the licence is finite, named, and countable.
   Cheap, and it directly attacks the adoption objection that the tool is slow.
2. **A determinant-code equivalent for the note.** MPDS's real trick is that a long
   interrogation collapses to a short machine-readable code. The stamp already carries
   ruleset version and audit status; adding a compact deterministic code (module set +
   killer-item state + resolution counts, e.g. `EXT-2/S1:0/ATT:1`) gives Curve Hero
   paste-recipients and any later reviewer a one-glance provenance token. Cheap, and it
   composes with the existing `composeStamp`.
3. **Verbatim-locked blocks, and only those.** `phrases/blocks.ts` verified blocks are the
   PAI analogue. Make the distinction explicit in the data model: `verbatim: true` blocks
   (consent language, post-op instruction sets, complication statements) cannot be edited
   at all — only accepted, rejected, or placeholder-filled — while everything else is
   editable prose. Today the residue rule enforces placeholder replacement but not
   verbatim integrity. Moderate cost, high liability value.
4. **Score compliance, not just outcome — and quote the dose–response.** The gamify layer
   scores note quality. Add the IAED metric shape: *was each required element addressed at
   all*, separately from *was the note good*. The 36.5% → 93.2% figure is the most
   persuasive number in this whole document for arguing to a practice owner that partial
   protocol compliance is not partial safety.
5. **Risk-scaled review sampling for the Team Lead queue.** Rather than reviewing
   everything or nothing, mirror the sliding scale: 100% review while a staff member is
   new or after a rule change, decaying to a percentage sample. Cheap, and it makes
   human review sustainable.

⚠️ **Verification note**: the compliance percentages come from an IAED-published chapter
(*Principles of Emergency Medical Dispatch*, ch. 12), i.e. the standards body describing
its own system. I did not read the underlying Clawson study. Directionally strong,
but do not present it as independent evidence.

Sources: <https://cdn.emergencydispatch.org/iaed/img/how-it-works-best/Principles-of-EMD-12.pdf> ·
<https://prioritydispatch.net/en/proqa> · <https://www.prioritydispatch.net/en/aqua> ·
<https://public.powerdms.com/BillericaPD/documents/1846641> (a real agency policy showing
the three named omission conditions in force)

---

## 4. Nuclear and industrial safety

| Pattern | What it is |
|---|---|
| **Peer-check / concurrent verification / independent verification** (DOE-HDBK-1028-2009 Vol 2) | Three distinct second-person tools, deliberately not interchangeable. PC prevents the *performer's* error, same time and place, informal, requested by the performer. CV: two people, same time and place, *separately* confirm a condition. IV: separated **by time and distance** from the person who created the condition — the separation is the mechanism. |
| **Three-way / repeat-back communication** | Sender states, receiver repeats back, sender confirms. Three exchanges, always. |
| **STAR** (Stop, Think, Act, Review) | A self-check ritual around each critical action. |
| **Place-keeping** | Physically marking each step done — the circle/slash convention — to prevent omitted or duplicated steps. |
| **Flagging** | Marking the correct component (and the similar ones *not* to touch) so an interruption does not resume on the wrong item. |
| **Pause / stop when unsure** | "Do not proceed in the face of uncertainty." Every person has authority to stop; uncertainty is a stop condition, not a judgment call. Knowledge-based mode carries a documented 10–50% error probability. |
| **Procedure use levels** (continuous / reference / information / multi-level; DOE O 422.1 ¶2.p(9)) | How closely a procedure must be held is declared per procedure, not left to the worker. |
| **Procedures must be "capable of performance as written"; if not, stop and fix** (DOE O 422.1 ¶2.p(3)) | The regulator puts the obligation on the *procedure*, and pairs the adherence demand with a mandatory channel to fix a bad procedure. |

**Answer to "what makes an operator follow a procedure rather than work around it"**

The documented answer is not discipline, it is three things: (a) the procedure is
*correct and executable as written* — DOE audits cite "cannot be executed as written" as
a violation of the order, i.e. an unusable procedure is the *organisation's* defect;
(b) there is a real, low-friction, non-punishing channel to get it changed, with feedback
gathered at post-job critique; (c) the required closeness of adherence is *declared*, so
"reference use" work is not being judged against a "continuous use" standard. Degani &
Wiener supply the negative control: crews shortcut long checklists into chunked
do-lists — so length itself is a violation-producing condition.

**Apply here**

1. **Independent verification for the killer-item class — separated by time and distance.**
   The repo has no second-person mechanism at all. Add IV (not CV) for the narrow set:
   PHI override, killer-item attestation, rule-disagreement escalation. IV's defining
   property is that the verifier must not be prompted by the performer and must be
   separated in time — which for software means the second person sees the *claim* and
   the note, never the first person's reasoning, and cannot be the same account. This is
   the biggest liability-reduction item in this document and it is a bounded feature:
   one queue, one status, one audit-log action.
2. **Rename the refusal path after "pause when unsure".** The product's differentiator is
   refusing to guess; DOE gives it a citable, industrial name and a stated basis
   (10–50% error probability in knowledge-based mode). Zero implementation cost, real
   value in staff training and in a carrier conversation — the tool is not being
   difficult, it is implementing a recognised human-performance control.
3. **Place-keeping in the resolution queue.** Concerns are listed; they are not *marked*.
   Adopt the circle/slash two-state convention explicitly — in-progress vs done — and
   persist it across an interruption or autosave, which the ASRS/checklist literature
   identifies as the moment items get skipped or double-done. Cheap
   (`autosaveMachine.ts` already holds the state boundary).
4. **Flagging for confusable neighbours.** The collision class the tests already guard
   (NKA/NKDA, FMS, Coe-Pak) is precisely DOE's "similar, closely located components"
   problem. When a flagged term has a known confusable sibling, show the sibling marked
   *do not touch* rather than only naming the ambiguity. Cheap: the collision table exists.
5. **Declare a use level per module, and treat "cannot be completed as written" as a
   defect of the module.** Some modules should be continuous-use (extraction, medication,
   sedation), others reference-use. Publishing that removes the fairness complaint. Pair
   it with the DOE obligation: a module that cannot be filled truthfully for a real visit
   is a bug in the module, and the wish channel is the "stop and fix" path — which the
   repo already has, but does not frame this way.

Sources: <https://www.energy.gov/sites/default/files/2026-04/1028-2009_Volume%202.pdf> ·
<https://www.humanperformancetools.com/human-performance-tools/human-performance-tool-spotlight-peer-checking> ·
<https://www.humanperformancetools.com/human-performance-tools/human-performance-tool-procedure-use-adherence> ·
<https://www.directives.doe.gov/directives-documents/400-series/0422.1-BOrder-chg4-ltdchg/@@images/file> ·
<https://www.energy.gov/documents/assessment-selected-conduct-operations-processes-wipppdf> ·
<https://www.nbpower.com/media/1492746/hsee-03-07-human-performance.pdf>

---

## 5. Error-proofing and accessibility in complex forms

| Pattern | What it is |
|---|---|
| **WCAG 2.2 SC 3.3.4 Error Prevention (Legal, Financial, Data)** — Level AA | For pages causing legal commitments or modifying stored data, at least one of **Reversible**, **Checked**, **Confirmed** must hold. SC 3.3.6 (AAA) extends it to all submissions. A dental note is squarely a legal record, so this is the criterion that applies. |
| **Check answers page** (GOV.UK / NHS Design System) | A summary list immediately before submission, every row with a "Change" link carrying visually-hidden text naming *what* it changes, returning the user to the summary rather than through the whole flow. |
| **One thing per page + question protocol** (GOV.UK Service Manual) | Split the form so each page is one question; and before asking anything, justify it: why you need it, what you do with it, how you keep it secure. |
| **Allow "I do not know"** (GOV.UK question pages) | If not-knowing is a valid state, it must be a first-class answer, not an empty field. |
| **Inline validation timing** (NN/g) | Do not validate mid-keystroke — premature errors are a *hostile pattern*. Validate on blur; once a field is in error, re-validate live so the message clears the moment it is fixed. State constraints up front, never after failure. Preserve the user's input on error. |
| **Progressive disclosure** (NN/g) | Defer advanced/rare options to a secondary surface — explicitly "less error-prone" for novices, with the caveat that everything frequently needed must be in the primary view. |
| **Confirm vs undo** (NN/g; Microsoft UX guide) | Reserve confirmation dialogs for serious, hard-to-undo consequences; routine confirmations get ignored. Prefer prevention, then undo. If a confirmation must carry detail, put the detail behind progressive disclosure. |
| **Poka-yoke: control vs warning** (Shingo) | Control devices make the error impossible; warning devices detect it and depend on the human. Control is strictly stronger because warnings can be ignored or overridden. Also the *motion-step method*: verify the prescribed sequence was followed. |

**Apply here**

1. **Claim SC 3.3.4 explicitly and pick your leg per flow.** The export/copy gate is the
   *Checked* leg; the paste confirmation is *Confirmed*. Nothing is *Reversible*. Document
   which leg each flow satisfies (the a11y guidance's own advice: write it down so the
   next developer does not regress it) and add a regression test. Near-zero cost, and it
   converts an accessibility obligation you already meet into a stated compliance claim.
2. **A "Check your note" summary before copy/paste.** This is the cheapest high-value UI
   item here. One summary list: modules used, killer items and their state, open concerns
   with their resolution, and a Change link per row with hidden text naming the target.
   It satisfies the *Confirmed* leg properly, and it is the same artefact the aviation
   killer-item duplication and the DOE peer-check both want.
3. **"Not documented" as a first-class answer.** GOV.UK's rule — if "I do not know" is
   valid, make it a real option — is the form-design expression of refusing to guess. An
   explicitly-chosen "not documented at this visit" is defensible in a record; a blank is
   not, and forcing a value is how fabrications enter notes. Cheap, and it removes a
   pressure to invent.
4. **Audit the validation timing against the hostile-pattern list.** Anywhere audit
   findings appear while the clinician is still typing a sentence, NN/g's category for
   that is *hostile*: it reads as grading a test before the student has answered. Rule:
   silent until blur (or until a sentence boundary), live only after a field's first
   error. There is an `engine-keystroke.test.ts`, so the seam exists; the question is
   whether the *timing policy* is stated and tested.
5. **Reclassify each gate as control or warning, and be honest about the mix.** Shingo's
   point is that warnings get overridden. The S0 export block is a control poka-yoke; a
   findings list is a warning. The PHI override is a control with a deliberate escape —
   which is defensible, but it should be labelled as the one warning-shaped path in an
   otherwise control-shaped system, and counted. Also worth adding: the *motion-step*
   check — did this note go through the prescribed sequence (standardize → audit →
   resolve → confirm), or did it arrive at export by another route?

Sources: <https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data> ·
<https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-all> ·
<https://design-system.service.gov.uk/patterns/check-answers/> ·
<https://service-manual.nhs.uk/design-system/patterns/check-answers> ·
<https://www.gov.uk/service-manual/design/form-structure> ·
<https://design-system.service.gov.uk/patterns/question-pages/> ·
<https://www.nngroup.com/articles/errors-forms-design-guidelines/> ·
<https://www.nngroup.com/articles/hostile-error-messages/> ·
<https://www.nngroup.com/articles/progressive-disclosure/> ·
<https://www.nngroup.com/articles/confirmation-dialog/> ·
<https://learn.microsoft.com/en-us/windows/win32/uxguide/mess-confirm> ·
<https://en.wikipedia.org/wiki/Poka-yoke>

---

## 6. Version control and provenance in regulated documents

| Pattern | What it is |
|---|---|
| **21 CFR 11.10(e)** | Secure, computer-generated, time-stamped audit trails covering create/modify/delete; changes **must not obscure previously recorded data**. |
| **EU GMP Annex 11 §9** | Same, plus two things Part 11 lacks: **the reason for a change or deletion must be documented**, and audit trails must be *convertible to a generally intelligible form* and **regularly reviewed**. |
| **ALCOA+** | Attributable, Legible, Contemporaneous, Original, Accurate (+ Complete, Consistent, Enduring, Available). Attributable specifically means a unique individual, never a shared account. |
| **eCTD lifecycle operations** (`new` / `replace` / `append` / `delete`) | You never edit a file in place. You submit a new *sequence* declaring which prior leaf is superseded; the reviewer's "current view" is the union of sequences with replaced and deleted leaves inactive but retained in history. FDA advises avoiding `append` and preferring `replace`, and warns that overusing `delete` confuses reviewers reconstructing the argument. |
| **Cumulative view vs sequence view** | The reviewer reads a computed current state; the history remains reconstructable. Breaking the replacement chain (referencing the original rather than the most recent leaf) silently resurrects old content. |

**Apply here**

1. **`replace`, never edit-in-place — and a cumulative view.** This is the strongest idea in
   this area and it maps exactly onto the AAPD append-only correction rule already in the
   knowledge base. Model a correction to a filed note as a new sequence carrying an
   explicit operation and a pointer to the superseded text, then render a *cumulative
   view* (what the note says now) alongside a *sequence list* (how it got there). The repo
   already forbids rewriting filed submissions; eCTD supplies the vocabulary and the
   reviewer-facing presentation, which is the part that is missing.
2. **Reason for change is a hard requirement, not a nicety.** Annex 11 requires it where
   Part 11 does not — and the guidance explicitly blesses capturing it as a predefined
   selection list *or* free text. This is the same conclusion as the legal reason-codes
   item in area 2; two independent domains landing on it is a strong signal. Apply it to
   attestations, PHI overrides, late entries, and local vocabulary changes.
3. **"Convertible to a generally intelligible form" is a design requirement.** Annex 11
   says the audit trail must be renderable for a *non-specialist reviewer*. The admin
   audit page is a table of `action`/`target`/`detail`. Add a plain-sentence rendering —
   "Sarah Philips replaced the extraction outcome in ticket T-1043 at 4:12pm ET,
   reason: corrected tooth number" — generated from the same row. Cheap, and it is what a
   practice manager, an attorney, or a board investigator can actually read. The repo's
   own tone rule (cold logic, no condescension) already describes the register.
4. **Make the regular review of the trail a scheduled, recorded act.** Annex 11 requires
   audit trails to be *reviewed*, and the GxP literature treats the review as itself a
   documented activity. Cheap: a monthly Team Lead review that writes its own audit-log
   entry. It converts the log from evidence-if-subpoenaed into an operating control.
5. **Check ALCOA+ Attributable against shared workstations.** A front-desk machine where
   staff stay signed in defeats attribution no matter what the log records. Worth a
   deliberate decision (session timeout, re-auth on submit) documented against the
   ALCOA+ attribute rather than left implicit.

Sources: <https://health.ec.europa.eu/system/files/2016-11/annex11_01-2011_en_0.pdf> ·
<https://rx-360.org/wp-content/uploads/2018/08/Comparison-of-FDA-and-EU-Regulations-for-Audit-Trails-by-R.D.-McDowall-2014.pdf> ·
<https://www.fda.gov/media/93818/download> (eCTD Technical Conformance Guide — the
`append`/`delete` cautions) ·
<https://esubmission.ema.europa.eu/tiges/docs/eCTD%20Guidance%20v4%200-20160422-final.pdf> ·
<http://www.wjaets.com/sites/default/files/fulltext_pdf/WJAETS-2025-1499.pdf>

---

## If only a few things get built

Ranked by (liability reduction or adoption) ÷ implementation cost:

1. **Scoped readback on AI accept** (area 1) — confirm only the safety-critical token
   class, not the whole diff. Turns meaning-verification into something a human does in
   five seconds.
2. **"Check your note" summary page** (area 5) — satisfies WCAG 3.3.4 *Confirmed*, carries
   the killer items, and is a well-documented pattern with reference markup.
3. **Reason codes on every attestation and override** (areas 2 + 6) — two domains
   independently require it; makes attestations countable.
4. **Independent verification for the killer-item and PHI-override class** (area 4) —
   separated by time and distance, second account required. The only genuine two-person
   control in the list.
5. **Named omission licences** (area 3) — the documented answer to "rigid protocols are
   too slow", and the main adoption unlock.
6. **`replace`-style corrections with a cumulative view** (area 6) — the reviewer-facing
   half of append-only correction.
7. **Killer-item tagging and hoisting** (area 1) — cheap ordering change over existing rules.
8. **Validation-timing policy stated and tested** (area 5) — prevents the tool reading as
   hostile, which is the quiet adoption killer.

## What could not be verified

- **No study was found** applying readback/hearback, sterile cockpit, or two-person
  verification specifically to *clinical documentation software*. Every mapping above is
  my inference from the source domain, not a documented transfer.
- The IAED compliance dose–response (36.5% → 93.2%) is self-published by the standards
  body; the primary study was not read.
- Legal-tech accept/modify/reject implementations are vendor claims (area 2 note above).
  The underlying convention is verified via Google and Microsoft first-party docs.
- "Sterile cockpit" has no software-pattern literature behind it that I found; treat the
  analogy (a named, enumerated set of phases during which the tool refuses to interrupt)
  as a design idea rather than an imported standard.
- Poka-yoke's control/warning split is cited to Shingo via secondary sources (Wikipedia
  and lean-practice write-ups quoting *Zero Quality Control*); the primary text was not
  consulted.
- eCTD v4.0's removal of `append` is reported consistently by secondary sources but was
  not confirmed against the ICH v4.0 specification itself.
