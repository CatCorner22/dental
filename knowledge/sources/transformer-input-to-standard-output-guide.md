# Building Reliable Transformer-Powered Input-to-Standard-Output Tools

- **Source**: user-supplied research guide, pasted 2026-08-03 (research cutoff stated as 2026-08-03)
- **Type**: engineering guide / architecture reference (not dental domain content)
- **Author/Origin**: user-supplied; cites primary docs from Hugging Face, OpenAI, Anthropic,
  Pydantic, Zod, JSON Schema, OWASP and NIST
- **Ingested**: 2026-08-03
- **Tags**: architecture, transformer, ai-documentation, verification, prompt-engineering, process,
  security, evaluation

## Summary

A 22-section guide for applications that turn rough input into standardized output. Its thesis is
that reliable tools do not ask a model to "improve this" and trust the reply — they behave like
typed compilers: preserve the source, do deterministic cleanup first, put a typed contract on both
sides of the model, validate independently afterwards, show the user what changed, and measure the
whole pipeline on a fixed evaluation set before changing anything.

It matters here because Smile Notes now has **both** kinds of transformer: the deterministic
`standardize()` pass and, since PR #36, an AI assist path. The guide is the first external source
that speaks directly to the second.

## Key concepts

- **The rule of thumb.** Deterministic code for syntax, policy, validation, permissions and state
  changes. A model for bounded semantic interpretation. A typed contract on both sides.
- **Four layers to preserve** (§2.1): Source, Interpretation, Contract, Result. The source stays
  reachable; interpretation is labelled as interpretation; a result never presents an inference as
  a source fact.
- **Structural validity is not semantic validity** (§11.3). Schema-constrained decoding guarantees
  shape, never truth. A perfectly schema-valid object can invent a deadline nobody stated.
- **A generated edit is a proposal, not proof** (§3.6, §14.4). Preserve the original, require an
  explicit apply, show a diff.
- **Repair once, then fail clearly** (§13.3). Retrying until a validator accepts something selects
  for validator loopholes and hides model weakness (§19.7).
- **Silent truncation is dangerous** (§8.4). Head-or-tail cuts can remove a negation, an exception,
  or the closing instruction that made the rest meaningful.
- **Prompt engineering is not a security boundary** (§15). Delimiters and trust labels help; they do
  not make natural-language data safe the way a parameterized query does. Limit what a compromised
  generation can do.
- **Version every behavioral dependency** (§17.2): normalizer, prompt, schema, validators, model,
  revision, provider, generation profile. A prompt change is a software release.
- **Evaluate the pipeline, not the model** (§16.3). The unit under test is the whole configuration.

## Notable quotes and data

> "Use deterministic code for syntax, policy, validation, permissions, and state changes. Use a
> model for bounded semantic interpretation. Put a typed contract on both sides of the model."
> — §Technical summary

> "Constrained decoding can guarantee **shape**, but not truth or usefulness." — §11

> "A PPV with no prevalence attached is not a number, it is a decoration." — §16 (on reporting)

- Suggested starting evaluation set: **50–200 cases** for a narrow tool (§16.1).
- Illustrative launch gates: 100% schema validity after at most one repair; ≥98% first-pass schema
  validity; zero critical unsupported claims (§16.6).

## Relationships

- **Agrees with** [`llm-transformer-skills-suite`](llm-transformer-skills-suite.md) on
  chain-of-verification and diff/rollback discipline. Both are weaker than what this product already
  ships: `verifyMeaning()` is a *deterministic* verifier (multiset compare of digits, negations,
  tooth designators, units and drug names) rather than a second model asked to check the first.
- **Agrees with** [`tn-dental-note-standardization-curve-hero`](tn-dental-note-standardization-curve-hero.md).
  That report's transformer MUST-NOT list is the domain-specific instance of this guide's §2.3
  behavioral contract, and it is embedded verbatim in `src/lib/assist/prompts.ts`.
- **Contradicts the project's platform decision, and loses.** §4.3, §10 and §18.7 push provider
  portability, HuggingFace Inference Providers, Transformers.js, local/browser inference and
  cross-vendor swap tests. The owner's instruction on 2026-08-03 was explicit: *"We will not use any
  other platforms."* Anthropic through the existing `ai` SDK is the platform. Those sections are
  **not to be adopted**, and the contradiction is recorded here rather than smoothed over so a
  future session does not "helpfully" add an adapter layer.
- **Partially inapplicable by design.** Its token-budgeting chapter (§8) assumes long retrieved
  context. This product's retrieval is keyword selection over its own controlled-vocabulary tables,
  capped at 4,000 characters, so most of that chapter is theory here rather than practice.

## Raw notes

Where the guide's checklist was already satisfied before ingest: injectable inference behind an
interface (`GenerateFn`, with an adversarial test double), versioned prompts with a CI guard, a
deterministic PHI gate *before* the model call, typed outcome unions, provenance on retrieved
sources, and refuse-rather-than-truncate at 20,000 characters.

Gaps it surfaced, in the order they were built: a shared visible diff for both transformation paths;
preview-then-apply on the AI path; schema-constrained output for the list-shaped capabilities; a
golden evaluation set with documented thresholds; outcome telemetry that logs codes and versions but
never prompt bodies.
