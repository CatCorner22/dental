# Adversarial hate — RSI clinician / dictation dependency

- **Type**: red-team / adversarial accessibility + voice-product review (not live RSI sessions)
- **Ingested**: 2026-08-08
- **Tags**: accessibility, rsi, motor, dictation, voice, asr, whisper, enrollment, ambient, clinical-safety, red-team
- **Status**: fix backlog ready; push-to-talk + engine honesty is the policy lock — ambient listen stays rejected
- **Method**: Hostile mock clinician (DDS/RDH with upper-limb RSI who **must** dictate to keep documenting) instructed to **hate** Smile Notes voice path. Grounded in shipped code: enrollment gate (`DICTATION_ENROLLMENT_VERSION` 2.0.0, 90s / 8 utterances / 6 prompts), `browserSpeechEngine` only (`offDevice: true`), Phase 2 Whisper planned-not-shipped in `docs/voice-dictation-architecture.md`, Account pilgrimage via `DictationField` → `/account`, HelpTip still selling “three to five minutes” adaptation. **Not** observed Cornerstone RSI sessions — hypotheses to falsify with real glove+pain+operatory runs.

## Axiom

Your enrollment ritual and browser ASR are not “safety.” They are a **tax on the body that cannot type**. An RSI clinician who opens a note box and gets a link to Account instead of a mic has already lost the chairside minute. Shipping ambient listen to “fix” that pain is not compassion — it is Care+-shaped PHI theater that invents soft tissue into the record while the writer’s wrists fail.

**Why it matters:** Dictation is the accommodation path for writers who cannot sustain keyboard volume. If that path is gated, vendor-bound, off-device, and missing the on-device engine the ADR already named, Smile Notes is ableist with a compliance smile. Fix push-to-talk honesty and Phase 2 — or admit voice is a Chrome demo, not a clinical tool.

## Persona

| Field | Hate lens |
| --- | --- |
| Who | Mid-career DDS or RDH with forearm/wrist RSI; gloves + chairside time pressure; may use Safari/iPad or shared Firefox front desk; cannot re-train wrists on every computer |
| Skill | Dictation as accommodation (Dragon-class expectation); dental spoken forms; HIPAA boundary literacy |
| Core hate | Enrollment before any mutate; browser speech only (no Whisper Phase 2); off-device audio with de-id lecture; Account scavenger hunt; copy that still claims the engine “adapts” to a voice |

## Five voice / RSI kills

| # | Kill | Accommodation / clinical | Evidence in repo | Why it kills |
| --- | --- | --- | --- | --- |
| **1** | **Enrollment gate before the mic may mutate a note** | RSI: every extra minute of setup is pain + lost production; clinical: note still unwritten while the script plays | `enrollment.ts`: unlock needs ≥90s listen, ≥8 finals, ≥6 prompts. `DictationField` hides `DictationButton` until `user.enrolled`. Setup lives on `/account` (`DictationSettings`). HelpTip in `VoiceEnrollment` still says “three to five minutes so recognition adapts” — while comments in `enrollment.ts` admit Chrome does **no** per-speaker adaptation from a web page. | You charge a ritual for a capability the vendor never trains. The RSI writer pays twice: once in pain, once in lies about “adaptation.” |
| **2** | **Browser ASR only — Chrome/Edge theater, Firefox silent death** | Accommodation requires a predictable engine on the machine they actually use | `engine.ts`: sole live engine is `browserSpeechEngine` (`id: "browser-speech"`). `availability.ts`: unsupported → “Chrome, Edge and Safari can.” Firefox: no constructor → mic story becomes a prose apology under the focused field. Secure-context / `not-allowed` misdiagnosis was already a shipped footgun (documented in availability header). | RSI does not care that your seam is elegant. If the operatory browser has no recognizer, the accommodation does not exist. “Set up on Account” on a machine that cannot hear is cruelty with a link. |
| **3** | **`offDevice: true` is the product — Whisper Phase 2 is vapor** | Accommodation + HIPAA: on-device path is the ADR’s own upgrade; clinical: vendor WER on dental terms | ADR Phase table: Phase 1/1.5 **Shipped**; Phase 2 on-device Whisper WASM/ONNX **Planned**. Engine comment names Whisper as the second engine; no runtime ships it. Join-only `normalize.ts` cannot rescue half the procedure names the landscape digest says generic STT mangles. Risk copy tells the writer to speak de-identified facts into a consumer engine. | You documented the ethical engine and shipped the consumer one. The RSI writer who needs accuracy gets Google-grade dental gibberish plus a lecture about not saying the patient’s name. |
| **4** | **Mic discovery is an Account pilgrimage + focus-gated apology** | Motor: extra navigation and hunting burn the hands that already hurt | Unenrolled + ready → `DictationField` shows “Set up dictation” link to `/account`, not an inline unlock. Explanations only when `focused` (good for clutter; bad when the writer is already mid-note under pain). Enrollment UI still badges “No changes allowed” and walks regional scripts before any note text moves. | Accommodation that requires leaving the note, finishing a script, and returning is not chairside. It is homework assigned to injured hands. |
| **5** | **Push-to-talk honesty rotten at the edges: restart fragility, network errors, no Phase-2 eval gate** | Continuous chairside dictation under RSI needs a stable listen session, not silent `onend` death | Browser engine: continuous + supervised restart on idle `onend`; `network` / `not-allowed` surface as errors; interims display-only. No frozen dental dictation eval corpus yet (ADR lists it as a Phase 2 prerequisite). No hold-to-talk / foot-pedal / external mic story in product UI. | The writer with RSI needs a boring, durable mic. They get a flaky web speech session, no scored dental eval, and a roadmap slide. Pain does not wait for `tiny` weights under `/public`. |

## Four fixes (do these; do not ship ambient)

Effort = invasiveness. **Policy** = accommodation is push-to-talk into the focused box after honest setup; ambient room listen stays a coded non-goal.

| # | Fix | Kills | Notes |
| --- | --- | --- | --- |
| **1** | **Honest enrollment: ninety seconds, no “adaptation” myth, optional skip-with-attest for Team Lead policy** | 1, 4 | Align HelpTip + knowledge copy with `enrollment.ts` comments: session proves mic + dental hearing, does not train a profile. Keep thresholds; kill the 3–5 minute adaptation story. Consider Lead-configurable unlock without ritual only if compliance owner accepts the risk — default stays practice-once. Inline “complete setup” drawer on the note beats Account exile. |
| **2** | **Ship Whisper Phase 2 behind the existing `DictationEngine` seam — or stop advertising voice as ready** | 2, 3, 5 | Self-host weights under `/public`, CSP-clean; frozen dental spoken-form eval vs browser baseline; `offDevice: false` UI truth. Until then, label the product “browser speech (limited browsers)” in Account and Risk — not a silent mic tease. |
| **3** | **Availability that names the next action on THIS machine** | 2, 4 | Keep `dictationAvailability` reason codes. Add operatory matrix (which tablets/browsers work). Never send Firefox users to enrollment. Prefer one focused-field status line over scavenger links when unsupported. |
| **4** | **RSI control surface: large hold-to-talk / sticky listen, visible interim, deterministic joins only** | 5 | 44×44+ mic control always; clear Listening/Stop; no ambient always-on. Keep join-only normalize; grow join table from Whisper error shapes when Phase 2 lands. External foot-pedal / OS dictation remain escape hatches — document them, do not pretend the web button replaces Dragon overnight. |

## The trap — shipping ambient listen

**“Just turn on ambient / Care+-style room listen so the RSI doctor never has to press Dictate”** is the trap.

It photographs as accessibility. Curve already sells ambient AI SOAP. The RSI persona will beg for hands-free. Marketing will call it compassion.

Then the product records (or streams) an operatory full of names, DOBs, and soft-tissue chat; a generative layer drafts fluent fiction; the same charter that forbids meaning-changing rewrites suddenly has an invented assessment in the box; biometric/PHI boundary collapses; and the writer’s wrists are “saved” by a system that invents findings they must now police under time pressure.

That is **accessibility theater with a wiretap**. This repo already parks ambient Care+ clones as coded non-goals (`check-your-note-ux-research.md`, `builder-text-blocks-predictive-ux.md`, team-lead packs). Do not reopen that door to soothe this hate list. The RSI fix is **reliable, on-device, push-to-talk dictation** — not a microphone that never stops.

## Explicitly do not ship (voice hate)

- Ambient / always-listening room capture (Care+ clone).
- Cloud STT Phase 3 before Phase 2 eval fails for real reasons (ADR conditions stand).
- Autocorrect or generative “fix my dental terms” that changes clinical meaning.
- Hiding unsupported browsers behind a silent null mic.
- Re-lengthening enrollment to “feel thorough” after admitting the engine does not adapt.
- Using RSI pain as the political argument for ambient AI.

## Measurement (falsifiers)

| Metric | Keep | Kill |
| --- | --- | --- |
| Time from focused text box → first committed dictated token (enrolled, supported browser) | ≤ 2 taps / ≤ 5s | Account pilgrimage mid-note |
| Enrollment copy claims | Matches non-adaptation truth in `enrollment.ts` | “Adapts to your voice” / stale 3–5 min myth |
| Unsupported browser | Named next action; no enrollment CTA | Link to Account that cannot unlock |
| Phase 2 | Frozen dental WER ≤ browser baseline on same utterances; `offDevice: false` | Roadmap-only Whisper |
| Ambient | Absent | Any always-on listen path |

## Open questions for the owner

1. **Inline enrollment drawer on the note** — accept Account as secondary, or keep setup off the clinical path?
2. **Lead-attest skip of enrollment** — allowed under practice policy, or always speak-once?
3. **Phase 2 priority vs check-your-note** — which ships first when capacity is one vertical slice?
4. **Confirm ambient stays non-goal** even when RSI advocates demand hands-free?

## Related

- `docs/voice-dictation-architecture.md` (phases; Phase 2 prerequisites)
- `knowledge/sources/voice-to-text-landscape.md` (Whisper tiers; consumer-path warning)
- `knowledge/sources/voice-enrollment-and-regional-english.md`
- `knowledge/sources/check-your-note-ux-research.md` (ambient on reject list)
- `knowledge/sources/builder-text-blocks-predictive-ux.md` (Care+ non-goal)
- `knowledge/sources/adversarial-a11y-advocate-hate.md` (sibling motor/glove hate)
- `src/lib/dictation/enrollment.ts`
- `src/lib/dictation/engine.ts`
- `src/lib/dictation/availability.ts`
- `src/components/standardize/VoiceEnrollment.tsx`
- `src/components/builder/fields/DictationField.tsx`
- `src/components/account/DictationSettings.tsx`
