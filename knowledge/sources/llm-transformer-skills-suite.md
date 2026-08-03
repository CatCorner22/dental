# Cross-platform LLM Code Transformer Skills Suite — adoption digest

- **Source**: llm-code-transformer-skills-suite.zip (user-supplied, 2026-08-03); eight
  agent-skill documents (transformer-core, advanced-codebase-context, agentic-coding-loop,
  continuous-improver, verification-suite, multi-file-transformer, prompt-script-optimizer,
  techniques-catalog)
- **Type**: agent tooling / process methodology (not dental domain content)
- **Ingested**: 2026-08-03
- **Tags**: agent-skills, verification, self-improvement, prompt-engineering, process

## What it is

A generic, cross-platform skill pack that gives an LLM coding agent a 16x-Prompt-style
"transformer" workflow: context selection, structured prompt composition, safe multi-file
edits with diffs/rollback, a verification suite (TDD-preferring, adversarial, iterative
fix loops), and a SICA-inspired continuous-improvement memory (LEARNINGS, SUCCESS_PATTERNS,
FAILURE_ANALYSIS, utility logging, versioned skill archive).

## Adoption decision

The suite is about how a CODING AGENT works, not what the dental app does, so the raw
files were not vendored into the product. The practices that earn their keep were
distilled into [`.cursor/rules/transformer-development.mdc`](../../.cursor/rules/transformer-development.mdc),
which binds future agents working in this repo to:

- **Storm-first testing** (adversarial case before implementation) — the discipline that
  found the plural-count defect this repo shipped for weeks.
- **The full verification loop** (tsc → full suite → build → per-change commits).
- **Versioning discipline** — `RULESET_VERSION` for rules/vocab, `ASSIST_PROMPT_VERSION`
  for AI prompts, immutable frozen submissions.
- **Adversarial-model testing** for the AI layer (the injectable `GenerateFn` pattern).
- **Memory where the repo already keeps it** — `knowledge/sources` digests, story-comments
  at fix sites, pinned regression tests — rather than a parallel LEARNINGS.md structure
  that would drift.

## What was deliberately not adopted

- RepoMap/PageRank context tooling, multi-LLM routing, evolutionary prompt mutation:
  useful for large polyglot codebases; overhead without payoff in a single Next.js repo
  with a dense test suite.
- A separate utility-scoring log: the repo's own metrics (first-pass rate, drift
  dashboards planned for the product) serve the same purpose where it matters.

## Relationship to the product

The suite's "chain-of-verification" idea appears in the product itself in a stronger,
deterministic form: `src/lib/verify/verifyMeaning.ts` refuses AI rewrites that change
clinical substance — a verifier the model cannot argue with, which is the property a
clinical tool needs and a generic coding suite does not provide.
