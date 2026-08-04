# Smile Notes — model charter

**Status:** Gate 0 and Gate 1 complete. No learned parameters in the product.
**Owner:** engineering, with the practice's clinical lead as approver for any change of level.
**Last reviewed:** 2026-08-04, against `RULESET_VERSION` 2.10.0.

This is the artifact the bespoke-LLM decision guide says should exist before any
training decision, and until now it did not. Its job is to make one question
answerable with evidence instead of enthusiasm:

> **Would a model with learned parameters do something for Smile Notes that the
> deterministic engine cannot, and how would we know?**

---

## 1. Where this product actually sits

Using the guide's control ladder:

| Level | Artifact | Smile Notes |
|---:|---|---|
| — | Deterministic rules engine | **The product.** Not on the ladder at all, because it is not a language model. |
| 0 | Prompt templates, schemas, routing | **Present**, in the optional assist layer. Off by default; two switches required. |
| 1 | RAG index or external memory | Partially — the controlled vocabulary tables and `/reference` pages are a curated retrieval layer, consulted deterministically rather than by embedding search. |
| 2 | LoRA / PEFT adapter | None. |
| 3 | Merged derivative checkpoint | None. |
| 4 | Full SFT or preference-tuned checkpoint | None. |
| 5 | Continued-pretrained checkpoint | None. |
| 6 | Distilled student | None. |
| 7 | From-scratch foundation model | None. |

**The honest label is: a bespoke AI *system* with a deterministic core and an
optional, verifier-gated Level 0 assist.** It is not a bespoke LLM, and calling
it one would be the category error the guide opens with.

**Byte vs ByteStar.** Byte is the always-on deterministic advisor (practice
knowledge compiled into trigger→advice entries; no provider call). **ByteStar**
is the optional pioneer path: Level 0 prompting against the same gateway, plus
silent killswitch (`BYTESTAR_KILL`), escape backstops, dual PHI scan (primary
rules + second-line identifier patterns), meaning verification on any proposed
rewrite, a fixed experimental disclaimer shown under the panel for every
reader, and a Team Lead–visible transparent log (`bytestar.*` audit actions).
Staff do not prompt ByteStar and there is no per-device opt-in UI — the
deployment switch (`BYTESTAR_ENABLED`) is the only door. ByteStar suggests; it
never writes the note and never touches the deterministic engine. No learned
parameters ship in this repository.

That is not a deficiency to be corrected. It is the design. The differentiator
this product sells is that every output is reproducible against a stamped
ruleset version, and learned parameters are in tension with that by
construction.

---

## 2. The model requirements contract

The guide's own template, filled in with real numbers rather than adjectives.
Every line here is either measured today or has a named test that measures it.

```yaml
model_mission:
  primary_users: [dentist, hygienist, dental assistant, treatment coordinator]
  primary_tasks:
    - expand controlled shorthand deterministically and reversibly
    - flag ambiguous shorthand for the writer to resolve, never guess it
    - extract clinical facts read-only for the chart readback and audit
    - raise audit findings against a stamped ruleset
  prohibited_or_unsupported_tasks:
    - inferring any clinical fact the note did not state
    - diagnosing, or suggesting a diagnosis
    - writing to the note without a human action
    - transmitting note content that carries PHI to any outside provider

inputs:
  languages: [en-US]
  modalities: [text]
  context_tokens:
    median: ~250 words of composed note
    p95: ~900 words
    maximum: no hard cap; the audit and parser are linear in input length

outputs:
  modes: [plain_text, structured_facts]
  required_formats:
    - facts carry spans into the input and values from controlled tables only
    - no generated clinical text reaches a note without passing verifyMeaning()

quality_contract:
  task_metrics:
    - parser clause coverage on the shorthand corpus     # measured: 94.6%
    - zero invented teeth across the corpus              # measured: enforced by test
    - negation correctness on absence-of-allergy terms   # measured: enforced by test
  human_rubrics:
    - a finding must state what was found and what moves it, never scold
  safety_metrics:
    - PHI gate blocks before any provider call, no override path
    - no extractor table may define a banned abbreviation
  worst_case_slices:
    - notes that are mostly negated findings (a clean hygiene recall)
    - notes mixing historical restorations with work done today
    - shorthand-dense operative notes with doses and tooth ranges

deployment_contract:
  target_hardware: commodity practice workstations and wall-mounted tablets
  time_to_first_token_ms_p95: n/a — the deterministic path has no model call
  latency_budget: extraction of a full note stays under 5 ms; audit runs off the
    keystroke path via useDeferredValue
  offline_required: the deterministic core must work with no network at all

governance:
  base_model_licenses_allowed: none in use
  data_rights_required: filed notes never leave the practice's own record
  retention_policy: frozen submissions are immutable; no note text is logged
  model_update_cadence: RULESET_VERSION bump per change, with a written note
```

---

## 3. Gate 1: the baseline a learned model must beat

The guide is explicit that a deterministic or non-generative baseline is the
**first** rung of the baseline ladder, and that training is justified only when
the failure belongs in learned parameters. Here is that baseline, measured.

| Measure | Value | Where it is enforced |
|---|---:|---|
| Clause coverage on the shorthand corpus | **94.6%** | `src/lib/extract/coverage.test.ts`, ratcheted at 90% |
| Notes in the corpus yielding zero facts | **0** | same file |
| Teeth invented across the whole corpus | **0** | same file, introducer check per site |
| Full-note extraction latency | **< 5 ms** | same file, 50× corpus under 1 s |
| Determinism | byte-identical across repeated runs | `extract.test.ts` |
| Total tests | 1,636 across 98 files | CI |

**This is an unusually strong Gate 1 baseline, and it raises the bar for
everything above it.** A learned model would have to beat 94.6% coverage *and*
retain reproducibility, offline operation, and per-decision traceability. On the
5.4% the parser cannot read, the current behaviour is to say so and show the
writer the phrase — which is not a failure mode a model obviously improves on,
because the honest alternative to "I could not read this" is not "here is a
guess."

---

## 4. Where a learned model *could* legitimately earn a slot

This section exists so that "no" is a position with conditions rather than a
reflex. Three candidates, in order of how well they survive the guide's gates.

### 4.1 Ambiguity disambiguation — an encoder, not a generator

**The gap.** The vocabulary tables refuse to expand ambiguous shorthand: `CR` is
composite resin and centric relation, `GP` is gutta-percha and general
practitioner, `mod` is mesio-occluso-distal and moderate. Today the writer is
asked. That is correct and safe, and it is also friction on every occurrence.

**The candidate.** A small **encoder-only classifier** over the surrounding
clause that *proposes* a reading with a confidence. The guide is explicit that
encoder-only models are "often the correct tool for a narrow prediction task"
and that generation should not be used where classification suffices.

**Why it survives the gates.** It is a bounded classification with a closed
label set, the training data is the practice's own ratified vocabulary
decisions, and — critically — **it proposes, a human confirms, and the
deterministic layer writes.** The model never touches the note. Its worst case
is a wrong suggestion that a person declines, which is the same worst case the
current ambiguity prompt already has.

**What would have to be true first.** A frozen disambiguation eval set with
per-term accuracy, measured against the current behaviour (ask every time) and
against a simple deterministic context heuristic. If a hand-written heuristic
gets most of the way, the model does not earn its slot.

### 4.2 Clause routing for the unread 5.4% — also an encoder

**The gap.** Unparsed clauses are reported honestly but generically.

**The candidate.** A classifier that labels an unread clause with a probable
*category* — "this looks like a medication statement" — so the prompt to the
writer is specific rather than generic, and so the grammar's growth queue is
ranked by category rather than by frequency alone.

**The hard constraint.** It labels a *question*, never a fact. Nothing it
outputs may enter the chart or the audit as an assertion.

### 4.3 Embeddings for the learning ledger — retrieval, not generation

**The gap.** `src/lib/learning/` clusters proposals by exact token match, so
`post-op instr`, `postop instructions` and `POI` are three separate proposals
that each independently fail the threshold.

**The candidate.** A sentence-embedding model to cluster surface variants of one
underlying term before the threshold is applied.

**Why it is the safest of the three.** It touches no note and produces no
clinical claim; it only decides which proposals are the same proposal. The
guide's §15.3 reasoning applies directly — retrieval for what is changeable and
attributable.

---

## 5. What is ruled out, and why

| Path | Verdict | Reason, in the guide's own terms |
|---|---|---|
| Continued pretraining | **No** | §5.2's gate needs a measured domain-language gap that SFT cannot fix. The measured gap is 5.4% of clauses, and it is a *vocabulary* gap with a human-ratified fix already built. |
| Full SFT / preference tuning | **No** | No residual behavioural objective has been named or measured. Gate 2 has not been attempted because Gate 1 has not failed. |
| From-scratch pretraining | **No** | §5.3 asks for a strategic requirement no licensable base satisfies. There is none. Failure pattern #3, "training from scratch for branding," is the risk here. |
| **Training on filed notes** | **Hard no** | §17.3: "Training is a poor place to store facts that require access control, correction, or deletion," and "removing a record from the dataset does not remove its influence from existing weights." Also failure pattern #23, training on production logs by default. This is the one that would end the product. |
| Multi-model review chain | **No** | Failure pattern #12: one LLM as teacher, reward and judge creates "an apparently improving closed loop." The deterministic `verifyMeaning()` is strictly stronger for this purpose because it cannot be flattered. |
| SFT as a knowledge store | **No** | Failure pattern #11: facts become stale, hard to cite, hard to delete. The vocabulary tables are the correct store and they are diffable. |

---

## 6. Review trigger

This charter is re-opened when any of the following becomes true, and not
before:

1. Parser clause coverage stalls below 90% on a corpus grown to 100+ notes,
   *and* the residue is not addressable by vocabulary.
2. A frozen disambiguation eval shows a deterministic context heuristic
   plateauing well below what staff need to stop being asked.
3. The practice adopts a second language in which the controlled tables cannot
   be maintained by hand.
4. A named, measured behavioural failure appears that demonstrations could fix
   and rules cannot.

Absent one of those, the correct engineering move is to keep growing the tables
and the grammar, because that is the form of learning this product can version,
diff, revert, and defend.
