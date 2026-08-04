# Voice-to-text AI landscape — architecture, compliance, and dental integration

- **Source**: user-supplied research survey, pasted 2026-08-04
- **Type**: engineering landscape / architecture reference (voice-to-text, ASR at scale)
- **Author/Origin**: user-supplied; cites Whisper/whisper.cpp/Faster-Whisper documentation,
  ASR-at-scale system-design literature, a HIPAA-compliant dental voice-AI deployment
  pattern, the OpenPlaud reference stack, and Curve Dental's API authentication docs
- **Ingested**: 2026-08-04

## What the source says (digest)

**Three product generations.** Legacy HMM engines (Dragon/SAPI), cloud-hardware products
(Plaud: capture devices + transformer LLM cloud), and open reference stacks (OpenPlaud:
Next.js/TypeScript, Postgres + Drizzle, and a dual transcription path — server-side via
OpenAI-compatible APIs and client-side zero-cost Whisper via Transformers.js in-browser).

**The common acoustic engine.** Whisper/Deepgram/Google are encoder-decoder transformers:
16 kHz mono → 80-channel log-Mel spectrogram (25 ms windows, 10 ms stride) → conv stem →
transformer encoder → autoregressive BPE decoding with control tokens. Whisper ships in six
tiers, `tiny` (39M params, ~1 GB) to `large` (1550M, ~10 GB); `whisper.cpp` and
Faster-Whisper are the CPU/low-latency production variants.

**Variables that must be chosen, not defaulted.** Sample rate (16 kHz mono or accuracy
degrades), model tier (latency/cost/WER trade), streaming vs batch (sub-200 ms RNN-T
streaming vs bidirectional-context batch), VAD tuning (hysteresis ~300 ms past silence;
filters 50–70% of compute), INT8 quantization (~4x compression, <1% WER loss), **custom
dental vocabulary (generic STT mis-transcribes roughly half of dental procedure names
without domain boosting)**, post-processing as a separable degrade-gracefully layer, and
retention/encryption posture as configuration, not afterthought.

**Architecture rules for scale.** Split streaming/batch at the gateway (never share
queues); keep models warm and batch per-path; autoscale batch on queue depth and streaming
on connection count; post-processing must fail without dropping the transcript; plan hybrid
edge/cloud early (up to ~70% of tasks on-device in reference architectures); build against
an OpenAI-compatible provider abstraction, never one vendor's API; separate storage
abstraction from business logic.

**Deterministic vs generative split (dental deployment pattern).** A production
HIPAA-compliant dental voice AI chains: Deepgram Enterprise with ~600-term dental
vocabulary → Azure OpenAI under BAA (private endpoint, zero retention) constrained to fixed
tool schemas → explicit refusal + human hand-off for clinical/ambiguous content. The
deterministic layer owns formatting, field mapping, and template population for anything
destined for the record; the generative layer works upstream on drafts a human reviews.

**Curve Hero integration.** Authenticated REST: `Authenticate` (practice-admin consent +
consumer ID/password) → bearer token per session, versioned via the `ACCEPT` header. Token
lifecycle belongs in a dedicated integration service. Two patterns: direct API write-back
vs clipboard-assisted paste; the defensible clinical path starts with schema-conformant
paste blocks and a human checkpoint, graduating to API write-back only with audit history
(the read-only → two-way phased precedent).

**Compliance baseline.** Consumer dictation (Apple/Google/Otter) does not meet HIPAA for
PHI. The reference baseline: BAA, AES-256 at rest, TLS 1.3 in transit, raw audio deleted
after processing, contractual no-training guarantee, exportable WORM audit logs, and —
where SaaS paths cannot satisfy the boundary — self-hosted VPC inference.

**Build order.** Streaming/batch decision → engine + tier behind a swappable abstraction →
compliance boundary before any PHI-bearing audio → deterministic schema layer distinct from
the generative layer → isolated Curve token service, paste-assisted before write-back →
dental vocabulary boosting early.

## Implications for this repository

1. **Our current dictation engine is the consumer-grade path the source warns about.**
   The browser SpeechRecognition API may process audio off-device. Mitigations shipped:
   engine-derived warning labels, spoken-de-identification instruction, and a deployment
   off-switch (`NEXT_PUBLIC_DICTATION_DISABLED=1`). The input text remains de-identified by
   construction and everything still passes the full audit/queue.
2. **The upgrade path is on-device Whisper, not cloud STT.** Client-side Whisper via a
   WASM/ONNX runtime keeps audio on the machine — no BAA question for the transcription
   leg, aligned with the charter (no provider call, no learned weights server-side). The
   engine seam (`src/lib/dictation/engine.ts`) exists so this lands without rearchitecting.
   CSP note: model weights would need to be self-hosted under `/public` (the app's CSP
   forbids third-party fetches by design).
3. **Dental vocabulary boosting, deterministically.** The source's "half of procedure
   names mis-transcribed" finding is addressed at our layer of the stack: a deterministic
   join-only normalization pass (`src/lib/dictation/normalize.ts`) repairs split compounds
   ("bite wing" → "bitewing") and nothing else. Meaning-changing correction stays refused.
4. **The deterministic/generative split it recommends is this product's existing shape.**
   Deterministic transformer owns the record-bound artifact; AI proposes upstream under
   verifyMeaning. The source independently converges on the architecture the charter
   mandates — useful external validation, no change required.
5. **Curve write-back stays deferred.** The paste-assisted human checkpoint we ship is the
   source's recommended starting posture. If the practice later wants API write-back, the
   token-lifecycle service and phased read-only-first roadmap described here are the spec.
6. **Not adopted:** server-side ASR fleets, streaming gateways, VAD/quantization tuning —
   scale machinery for a transcription *service*, out of scope for a notes tool whose
   dictation is one writer, one box, one device.
