# Ingest–transform–output software: who uses it and how reliable it is

**Ingested:** 2026-08-04. **Type:** owner-supplied industry survey.

## The two sentences this project now quotes

> Practical reliability = tool correctness × input conformance × surrounding
> controls. … An imperfect tool can operate safely inside strong review and
> validation controls. **Mature industries trust the control environment, not
> the tool alone.**

This is the licence for a probabilistic component in this product, and also its
leash: the AI layer is defensible exactly to the extent the deterministic
control environment around it is strong, and no further.

## The deterministic/probabilistic line

Deterministic transformers (compilers, interface engines, production ETL,
document assembly) approach zero defects on conforming input and are verified
by construction plus regression suites. Their four characteristic failures —
nonconforming input, format drift, specification error, and **silent
mis-mapping** (valid-looking wrong output that raises no error) — are this
project's own failure taxonomy: the filing gate handles nonconforming input,
the corpus ratchet catches drift, RULESET_VERSION pins the specification, and
the odontogram readback exists precisely for silent mis-mapping.

Probabilistic transformers carry irreducible error and their published numbers
are condition-dependent. The universal control is a human or deterministic
validator downstream.

## The precedents that legitimize a probabilistic extractor here

- **E-discovery** runs ML review classification in front of courts by measuring
  recall/precision with statistical sampling — a defensible *process*, not a
  perfect tool. → The extraction capability gets sampled precision measurement
  reported on the digest, not a one-time benchmark.
- **Clinical speech-to-text**: the draft becomes the legal record only after a
  clinician reviews and signs. → Per-fact affirmative acceptance.
- **Document processing**: confidence thresholds route low-confidence fields to
  humans. → Below-threshold extractions become questions, never facts.

## Caveat adopted

"Treat unsourced percentages as marketing until you trace them to a named
study." Applies to our own numbers too: the corpus coverage figure is honest
because the corpus is in the repo and the test prints its misses; any published
precision figure for the extractor must come with its sampling method.
