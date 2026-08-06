# SuperByte navigation UI/UX — Hugging Face grounded enhancements

- **Source**: Hugging Face product docs (Chat UI, LLM Router, TGI/Gradio consuming patterns, transformers.js React status tutorial) + Smile Notes SuperByte rails (`ByteStarAdvisor`, one-way API, instrument gauges)
- **Type**: UX architecture digest + ship decision
- **Ingested**: 2026-08-06
- **Owner ask**: Determine whether Hugging Face surfaces justify SuperByte nav UI/UX upgrades; keep the panel “very good” without becoming a chat

## Assessment (Large-Txt / intake)

| Area | Finding |
| --- | --- |
| Size of ask | UI/UX adaptation, not a new model train |
| Efficiency hierarchy | Prompting + existing rails → UI polish. No PEFT / CPT. |
| Hard rails | One-way feedback; no copy; no thumbs; PHI gate; `verifyMeaning` before staff see pioneer text |

## Hugging Face patterns reviewed

| HF surface | What it teaches | Adopt for SuperByte? |
| --- | --- | --- |
| [Chat UI](https://huggingface.co/docs/chat-ui) / HuggingChat | Streaming status, message browse control, tools as secondary chrome | **Partial** — status + staff-paced readings; **reject** chat input, MCP tools in-panel, multimodal upload |
| [LLM Router `RouterMetadata`](https://huggingface.co/docs/chat-ui/configuration/llm-router) | UI shows which route/model spoke | **Yes** — Pioneer / Instrument / Reading / Pioneer dark chip |
| Chat UI `MessageUpdate` architecture | Fine-grained present-tense generation status | **Yes** — live status line (what SuperByte is doing *now*) |
| Gradio `ChatInterface` examples | Empty-state orientation | **Already covered** by existing empty copy; no prompt examples (would invite staff→model talk) |
| TGI streaming / Inference Playground | Token stream as primary UX | **No** — observations are verified JSON batches; streaming would surface unverified fragments |
| Hub Spaces “assistant sidebar” demos | Generic chat sidebars | **No** — conflicts with observe-only; Byte/SuperByte stay always-on, not tab-hidden |

## Defects the patterns expose in the prior SuperByte panel

1. **Hostile auto-rotate (8s)** — yanked the only clinical observation while staff were reading; Chat UI never auto-advances the message you are reading.
2. **No present-tense status** — tagline described what SuperByte *is*; Byte already said what it *is doing*.
3. **Layer opacity** — pioneer vs instrument was buried in tip microcopy; RouterMetadata shows the speaking layer up front.
4. **Drift rails always expanded** — long aside push; progressive disclosure keeps the compass primary.
5. **Aside length** — Byte then SuperByte with no jump links; monitor page same problem for Team Leads.

## Shipped adaptations (this ingest)

- User-paced Previous / Next readings (Byte parity); auto-rotate removed
- `superbyteLiveStatus` + layer chip (`src/lib/bytestar/liveStatus.ts`)
- Drift gauges behind `<details>`; NorthStar compass stays glanceable
- Builder aside jump links (scroll, do not tab-swap)
- SuperByte monitor section jump nav

## Explicit non-goals (reject list)

- Chat box, prompt field, thumbs, “was this helpful”
- Streaming unverified tokens into the panel
- Vendoring HuggingChat / Chat UI as a product shell
- Training or fine-tuning from panel interactions
- Confidence percentages from the model (instrument rails stay directional)

## Self-audit (residual)

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Staff confuse Instrument with Pioneer | Med | Med | Layer chip + tip microcopy |
| Collapsed gauges unread | Med | Low | Summary line shows % on course; compass still open |
| Jump links mistaken for tabs that hide audit | Low | Med | Comment + scroll-only behavior; both panels remain mounted |
| HF docs drift | Med | Low | Digest cites pattern names, not pinned library versions |

**Calibrated confidence**: 0.82 that these UX changes improve chairside glanceability without weakening one-way rails. Residual: live user observation not yet measured.
