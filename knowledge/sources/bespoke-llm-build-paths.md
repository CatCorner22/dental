# Designing a bespoke language model that is actually an LLM

**Ingested:** 2026-08-04. **Source cutoff:** 2026-08-03.
**Type:** external technical decision guide, ingested whole.
**Where it landed in this repo:** `docs/model-charter.md`, which is the Gate 0/1
artifact this guide says should exist before any training decision.

---

## Why this source matters here

It is the first external document we have ingested that argues *against* the
direction a stakeholder was pushing, using evidence rather than caution. It is
therefore worth more than a source that agreed with us, and it is recorded in
full detail for that reason.

Its central distinction is one this project had been making informally and can
now make precisely:

> A system becomes a learned model derivative when optimization changes model
> parameters or adds trained parameters that participate in inference.

Prompting, retrieval, tools, memory and workflow code change the *input*. They
do not change learned parameters. So a highly specialized application built on
an unchanged checkpoint is a **bespoke AI system**, not a bespoke LLM.

## The control ladder

| Level | Artifact | New learned parameters? | Standalone? |
|---:|---|---:|---:|
| 0 | Prompt templates, schemas, routing | No | No |
| 1 | RAG index or external memory | No | No |
| 2 | Soft prompt, LoRA, or PEFT adapter | Yes | Usually no |
| 3 | Adapter merged into a permitted base | Yes | Yes |
| 4 | Full SFT or preference-tuned checkpoint | Yes | Yes |
| 5 | Continued-pretrained plus post-trained | Yes | Yes |
| 6 | Distilled student | Yes | Yes |
| 7 | Random-init pretraining, owned tokenizer | Yes | Yes |

Smile Notes sits at Level 0, with a deterministic engine that is not on the
ladder at all because it is not a language model.

## The findings that bear directly on decisions already taken here

Recorded because each one independently confirms a position this project
reached on its own reasoning, which is the useful kind of corroboration.

**Training on production logs is failure pattern #23.** Named explicitly:
"Consent, privacy, rights, and feedback-loop bias are bypassed." §17.3 goes
further — "Training is a poor place to store facts that require access control,
correction, or deletion," and, decisively, "removing a record from the dataset
does not remove its influence from existing weights." This is the argument
against an ingest-the-notes "AI Brain," stated by a source with no stake in
this repository.

**One LLM as teacher, reward and judge is failure pattern #12:** "Shared biases
create an apparently improving closed loop." This is the multi-model review
chain, and the guide's objection is the same one this project raised — the
reviewers are not independent, so their agreement is not evidence.

**Using SFT as a database is failure pattern #11:** "Facts become stale,
difficult to cite, and hard to delete." The controlled vocabulary tables are the
correct store precisely because they are diffable and revertible.

**Training from scratch for branding is failure pattern #3:** "ownership theater
but often worse capability and economics."

**Gate 1 requires a deterministic baseline first.** The guide's baseline ladder
opens with "a deterministic or non-generative baseline where applicable," and
gates further work on whether "a learned generative model has material value."
For this project the deterministic baseline is not a strawman to be cleared —
it is the product, and it measures 94.6% clause coverage.

**Retrieval is for changeable or attributable knowledge** (§15.3): information
that changes frequently, must be access-controlled or deleted, requires
citations, or belongs to individual tenants. That is a precise description of
dental note content, and an argument for keeping it out of weights.

## The findings that argue for something we have NOT done

Recorded separately, because a digest that only lists agreements is a digest
that was read for comfort.

**Encoder-only models are underused.** §7.1 lists them as "often the correct
tool for a narrow prediction task" and warns against generation where
classification suffices. Ambiguity disambiguation — `CR`, `GP`, `mod` — is
exactly a narrow classification with a closed label set. This is the strongest
candidate for legitimate learned parameters in this product, and it is now
written into the charter with the evidence that would justify it.

**Tokenizer fertility is measurable and we have not measured it** (§9.2).
Dental shorthand tokenizes poorly in general-purpose vocabularies. The guide
treats fertility — tokens per domain unit — as a real diagnostic. It only
matters if continued pretraining is on the table, which it is not, but the
measurement is cheap and would make the "no" better evidenced.

**Evaluation must be frozen before training, in four sets** (§4.2): development,
validation, sealed test, and adversarial/safety, partitioned by source or time
rather than randomly. This project has an adversarial suite and a corpus, and
did not have a formal contract. That gap is what `docs/model-charter.md` closes.

**A release is an artifact set, not a weight file.** The eight-item ownership
test in §2.2 maps cleanly onto what this repo already stamps with
`RULESET_VERSION`, and is a useful shape for any future model work.

## Deliberately not adopted

- Architecture guidance (MoE, hybrid attention, long-context extension,
  multimodality). Excellent material, entirely inapplicable at Level 0.
- The compute and parallelism planning sections. Same reason.
- Serving-runtime comparison. Same reason.

These are recorded as *not applicable at our level* rather than dismissed, so a
future reviewer can see the scan was complete.

## Open questions this raised

1. What is the measured tokenizer fertility of our shorthand corpus under a
   common subword vocabulary? Cheap to answer, and it would strengthen the
   continued-pretraining "no."
2. Would a hand-written context heuristic close most of the ambiguity gap? If
   so, the classifier in charter §4.1 never earns its slot, which is the
   outcome to hope for.
3. Our learning ledger clusters proposals by exact token match. How many
   genuinely-same proposals are we splitting across surface variants, and is
   that number large enough to justify an embedding model?
