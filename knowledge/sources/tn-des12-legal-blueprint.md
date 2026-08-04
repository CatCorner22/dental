# Tennessee dental records, Curve Hero, and DES-12 — owner-authored blueprint

**Ingested:** 2026-08-04. **Type:** owner-authored deep-research blueprint (the practice
owner wrote the research script by hand; treat as the owner's own requirements
document as well as a legal digest).
**Companions:** `curve-hero-des12-blueprint.md` (same DES-12 framework, more Curve
mechanics) and `transformation-software-reliability.md` (the reliability survey).

Legal citations inside the source document are the author's; nothing here has been
independently Shepardized. The document itself says to verify the current official
Tennessee compilation before deployment. That caveat is adopted.

## What is genuinely new in this document

Most of the DES-12 framework, hard-stop table, and role matrix also appear in the
companion blueprint. Four things appear only here, and each is actionable:

1. **Public Chapter 1107 of 2026 → effective January 1, 2027.** A hygienist must be
   under DIRECT supervision of a dentist who has seen a NEW patient before
   completing diagnostic radiographs, hard-/soft-tissue data collection,
   prophylaxis, or fluoride application. The document specifies the exact
   effective-dated validation rule and says to ship it NOW rather than leave the
   date to staff recollection. → Implemented as `supervision-2027` in
   `src/lib/audit/rules/` the day this was ingested.

2. **Tenn. Code Ann. § 63-2-101** — records must be furnished within ten working
   days of a written request, and a summary does not satisfy the right to the full
   record. Bears on the digest/export drills and on how the patient-readable
   summary is described in UI copy: supplemental, never a substitute.

3. **Named Tennessee disciplinary actions** (Jones 2018, Lubovich 2018, Brewer
   2020, Cordice 2018) showing Rule 0460-02-.12's minimum elements enforced as
   requirements — reprimands, penalties, surrender. The completeness rules are not
   theoretical.

4. **The four-state field model**, stated more crisply than anywhere else:

   > Affirmatively present / Affirmatively absent / Not applicable /
   > Not documented — review required.
   >
   > "Not documented" must never be silently transformed into "none."

   The app already lives by the fourth line (no defaulted negatives; omission
   licences are counted and surfaced). The four-state enumeration is the cleanest
   statement yet of the target field model and is the reference for any future
   schema work.

## Where the app already complies

Checked against the code, not the README: no silent defaults for "no
complications"/"WNL" (affirmative entry required; omission licences counted);
tooth/surface conflicts and code-narrative checks (anatomy rules, consistency
rules over extracted facts); ambiguous-shorthand blocking (the tiered filing
gate); addendum-over-overwrite (frozen submissions are immutable); role scoping
(scope-of-practice lock, diagnosis reserved to dentist); PHI minimization
(nothing pasted into Standardize is stored; note text never logged).

## Gaps this document opens (tracked, not yet built)

- Dual-output patient summary generated only from the finalized note, with a
  semantic-equivalence check (summary may not upgrade "possible apical
  pathology" to "infected"). The plain-language machinery exists; the
  finalized-note-only pipeline and equivalence check do not.
- Teach-back / understanding-check fields (AHRQ) in education blocks.
- Language/interpreter capture on consent.
- `dentist_confirmation_required` as a first-class provenance field.
- DES-12 as an optional rendering order for composed notes (the module system is
  close; ordering and headings differ).
