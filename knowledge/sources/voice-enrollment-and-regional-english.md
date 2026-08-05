# Voice enrollment + USA regional English (no autocorrect)

Tags: voice, dictation, enrollment, english, regional-english, speech-recognition, drift.
Ingested: 2026-08-05.

## Deliverable

First voice product surface is **read-only enrollment**: the writer speaks English
prompts for 3–5 minutes; transcripts stay in a preview pane; nothing mutates a note.
Apply-mode dictation unlocks only after thresholds in `DICTATION_ENROLLMENT_VERSION`.

## Stability practices adopted

- Continuous recognition with supervised restart on idle `onend`
- Finals committed; interims display-only
- `maxAlternatives = 1` (no second-guess autocorrect)
- `en-US` only
- Join-only dental normalize; colloquialisms glossed, never rewritten
- Grammar phrase boosting (JSGF) for dental + regional sayings when supported
- Textarea `spellCheck={false}` / `autoCorrect="off"` on the standardize input

## Regional lexicon

`src/lib/dictation/regional.ts` — Northeast, South, Midwest, Southwest, West, General.
Used for enrollment scripts, grammar hints, and read-only comprehension chips.
