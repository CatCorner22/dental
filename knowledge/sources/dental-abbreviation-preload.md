# Abbreviation preload: what was added, and the rule that decided each one

**Status:** internal working note for the vocabulary tables. Not clinical, legal, or
coding advice. The practice owns the final list.

## Why this exists

The transformer was measured against eight notes written the way staff type them
between patients — lowercase, shorthand, run-on. It made about **two substantive
changes per note** and walked silently past `c/o`, `w/`, `mh`, `bp`, `epi`, `lido`,
`ant`, `iso`, `perc`, `imp`, `temp`, `mod`, `cal`, `tp`, `cx` and more.

The same gap disabled the AI layer completely. The meaning verifier licenses a
model to introduce a word only when a vocabulary entry the note triggers produces
it, so with `w/` missing it refused a model that correctly wrote "with", and with
`epi` missing it refused "epinephrine" as a changed drug list. **Zero of five
faithful rewrites were accepted.**

One table feeds both. Filling it repaired both transformers.

## The classification rule

Every entry lands in exactly one of three categories. The third is the one people
miss and the one that matters most.

### 1. Expand — deterministic, adds no clinical claim

One reading, no hidden fact. `RCT` → root canal therapy. `w/` → with.
`epi` → epinephrine. Written out on first use with the initialism in parentheses
after it (`SHORTHAND`), or replaced directly every time where a parenthetical
would read absurdly (`BANNED_ABBREVIATIONS`, severity `style`) — a function word
like "with" or a dosing interval like `q6h` gets the direct form.

### 2. Ask — the reading changes the record

More than one real meaning in a dental chart. The tool flags and **leaves the text
alone**, because picking a reading would put a clinical claim in the note that the
writer never made. Discovered by measurement rather than prediction — one note
used `mod` for "moderate calculus" and for a "mod composite" eight lines apart:
one an observation, the other a billed site.

Current members: `mod`, `cal`, `temp`, `imp`, `tp`, `cx`, `perc` (percussion vs
Percocet), `endo` (endodontics vs endocarditis prophylaxis), `EXT` (extraction vs
extension), `NKA` (no known allergies vs no known **drug** allergies), `MI`
(maximum intercuspation vs myocardial infarction), `CAD` (coronary artery disease
vs computer-aided design), `RA` (rheumatoid arthritis vs relative analgesia),
`GP` (gutta-percha vs general practitioner), `PA`, `cap` (capsule vs the patient's
word for a crown), `ac`/`pc`.

### 3. Never use — flag, and never expand

Constructs with a documented history of being **misread**. The remedy is always
that a person writes the words out.

**Expanding one of these would launder it:** the note comes out clean, the reader
is reassured, and the writing habit that caused the documented error survives
completely intact. That is why this category cannot be folded into category 1
however unambiguous the "correct" expansion looks.

Current members: `U`, `IU`, `MS`/`MSO4`/`MgSO4`, `hs`/`qhs`, `TIW`/`BIW`,
`OD`/`OS`/`OU`/`AD`/`AS`/`AU`, `ss` (one half), `APAP`, `cc` (volume), `D/C`,
`qd`/`qod`, `PRN`, trailing-zero and naked-decimal doses.

## Sourcing

The categories above follow the published error-prone-abbreviation guidance from
the **Institute for Safe Medication Practices (ISMP)** and the **Joint Commission
"Do Not Use" list**, plus ordinary dental and medical terms of art.

**Verify against the current published lists before relying on this.** These lists
are revised, this file is a working note written from general familiarity rather
than transcribed from a specific edition, and an out-of-date safety list is worse
than none because it reads as authoritative. Anything in category 3 should be
checked against the live ISMP and Joint Commission publications by whoever owns
the practice's documentation standard.

## Deliberate exclusions

**Route abbreviations — `IV`, `IM`, `PO`, `SL` — are NOT expanded.** They were,
briefly, and it was wrong: these are among the most universally understood
constructs in medicine, read without pause by an insurer, an attorney or the next
treating dentist, so defining them adds noise rather than clarity. ".5 mg
intravenous (IV)" is worse writing than ".5 mg IV". An existing dose-safety test
caught it.

**Dosing intervals live in the direct-replacement table**, not the first-use one,
because `q6h` contains a digit and "every 6 hours (q6h)" puts the number 6 into a
dosing instruction twice. The digit-preservation property test caught that.

## Case sensitivity is a per-entry decision

The trap that scales badly. Most entries are matched case-insensitively because
staff type in lower case between patients. Three classes are not:

- **The lower-case form is an ordinary English word.** `TAD` (temporary anchorage
  device) stays uppercase-only, because "a tad sensitive" is a thing a note says
  and "a temporary anchorage device sensitive" is not. The quadrant entries
  (`UR`/`UL`/`LR`/`LL`) were already uppercase-only for the same reason.
- **The lower-case form is a common typo.** `IM` would have matched "im" — how
  "I'm" and "in" get typed in a hurry.
- **Ambiguous entries can safely be case-insensitive**, because they flag rather
  than rewrite. Widening the match only widens the question, which is why `EXT`,
  `NKA`, `GP` and `PA` were all extended to lower case as a *safety* improvement:
  an unflagged lower-case `nka` is an unverified allergy statement in the record.

`src/lib/vocab/collisions.test.ts` is the tripwire. It runs every silently-applied
expansion against a corpus of already-correct clinical prose and fails if one
fires inside a well-written sentence, and it snapshots the short, lower-case,
case-insensitive expansions so adding one is a deliberate reviewed act rather than
a side effect of a bulk import.

## What a national list cannot do

Roughly the last 20% is local: provider initials, room names, a particular
material, a shorthand one hygienist uses. No published list will ever contain
them. The path for those is the practice's own — the Data Hygiene Gauntlet
(`/requests`) and the wish list, ratified by a human — fed by a frequency count of
what the tool did not understand. That keeps the vocabulary improving without any
model learning anything, and without anyone hand-auditing notes.
