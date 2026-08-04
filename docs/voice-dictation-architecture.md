# Voice dictation — architecture decision record

**Status:** Phase 1 shipped. **Source basis:** `knowledge/sources/voice-to-text-landscape.md`.
**Owner:** engineering; the practice's compliance reviewer approves any phase change.

## The decision, in one paragraph

Dictation in Smile Notes is entry assistance for one writer, one text box, one device — not
a transcription service. So the scale machinery in the research (streaming gateways, GPU
fleets, VAD tuning) is deliberately not built. What IS adopted from the research: a
swappable engine seam so the transcription engine is never load-bearing architecture, a
deterministic dental-vocabulary layer at the only level this codebase trusts (join-only
repairs, never meaning changes), engine-derived compliance labeling, and a deployment
off-switch. Audio is never stored, never sent to this app's servers, and never retained:
the only artifact that exists downstream of speech is the text the writer watches land.

## Phases

| Phase | Engine | Audio boundary | Status |
|---|---|---|---|
| 1 | Browser speech service (`browserSpeechEngine`) | May leave the device (vendor engine) — labeled in the UI, spoken de-identification instructed, deployment off-switch available | **Shipped** |
| 2 | On-device Whisper via WASM/ONNX runtime (Transformers.js-class) | Audio never leaves the machine; model weights self-hosted under `/public` (CSP forbids third-party fetches) | Planned; slots into the engine seam |
| 3 | Cloud STT with dental vocabulary boosting (Deepgram-class) | Only under a signed BAA + private endpoint + zero retention, and only if Phase 2 accuracy proves insufficient on real dictation | Not planned; listed so "no" is a position with conditions |

## Rules that hold in every phase

1. **The engine is behind `DictationEngine`** (`src/lib/dictation/engine.ts`). The button,
   the normalization pass, and every downstream gate are engine-agnostic. `offDevice` on
   the interface drives the user-facing warning — truth lives in the type, not in copy.
2. **Normalization is join-only** (`src/lib/dictation/normalize.ts`): split dental
   compounds are reassembled ("bite wing" → "bitewing", "x ray" → "x-ray"); numbers,
   doses, teeth, negations, and everything else pass through untouched. Line breaks and
   sentence punctuation are hard boundaries. Idempotent by test.
3. **Dictated text has no privileged path.** It lands in the input box, in front of the
   writer, and faces the same standardize pass, resolution queue, audit, and copy lock as
   typed text. There is no dictate-and-file.
4. **No audio artifact.** Nothing records, uploads, or retains audio in this codebase, in
   any phase. Phase 3, if it ever happens, adds a BAA'd transient stream — never storage.
5. **The off-switch is a deployment decision**: `NEXT_PUBLIC_DICTATION_DISABLED=1` removes
   the feature at build time for a practice whose compliance review rejects Phase 1's
   off-device engine.

## What Phase 2 requires before it ships

- Model weights self-hosted (CSP-clean), sized for operatory hardware (`tiny`/`base`
  tier; the research puts `tiny` at 39M params, ~1 GB, 32× realtime).
- A frozen dictation eval: a fixed set of spoken-form dental utterances with gold
  transcripts, scored per engine — the same discipline as every other candidate gate in
  this repo. The browser engine's score is the baseline to beat.
- The join table revisited against real Whisper output: its error shapes differ from
  consumer engines and the table must be grown from evidence, not guesses.
