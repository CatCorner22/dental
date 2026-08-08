# Adversarial hate — plaintiff's privacy / HIPAA attorney

- **Type**: red-team / adversarial privacy counsel review (not a legal opinion, not OCR guidance)
- **Ingested**: 2026-08-08
- **Tags**: hipaa, privacy, phi, clipboard, localstorage, indexeddb, shared-device, override, title, red-team, litigation
- **Status**: fix backlog ready; shared-device + egress controls are the policy lock
- **Method**: Hostile mock plaintiff's privacy / HIPAA attorney instructed to **hate** Smile Notes. Grounded in shipped code: `navigator.clipboard.writeText`, `draftBackup` IndexedDB + `localStorage`, 30-day JWT sessions on shared operatories, `PhiOverrideDialog` reason-code waiver, title → emailed filename fold, S2 bare-name export pass vs AI any-phi block. **Not** a court filing — deposition hypotheses to falsify with device forensics and staff discovery.

## Axiom

Your PHI **checker** does not forgive your PHI **egress**. A privacy stop that can be waived with a dropdown, a patient name that only *reviews* while Copy still runs, and a plaintext draft mirror on a shared iPad are not "defense in depth." They are exhibits.

**Why it matters:** HIPAA litigation and OCR investigations do not grade your intent. They grade **where identifiers went**, **who could read them**, and **whether your UI manufactured consent**. If the product writes clinical text to clipboard, disk, and browser storage while calling itself PII-free by premise, counsel will treat the premise as marketing and the paths as the breach.

## Persona

| Field | Hate lens |
| --- | --- |
| Who | Plaintiff's privacy / HIPAA attorney; secondary: OCR investigator reading product claims against code |
| Skill | Covered entity / BA duties; minimum necessary; workstation controls; "reasonable and appropriate" safeguards; discovery of logs, backups, and UI attestations |
| Core hate | Clipboard as unsupervised disclosure; localStorage/IDB draft mirrors as unencrypted workstation PHI; shared iPad session + backup bleed; PHI override as paperwork theater; title/filename as the quiet exfil channel; asymmetric gates (AI stricter than Copy) |

## Six deposition angles

| # | Angle | What counsel asks under oath | Evidence in repo | Why it lands |
| --- | --- | --- | --- | --- |
| **1** | **Clipboard is a disclosure channel you do not control** | "After 'Copy for Curve Hero,' where does the note text live, for how long, and on which devices?" | `BuilderShell` `runExport` → `navigator.clipboard.writeText(markdown)`. No wipe. Permission failure **downloads** `.md` instead. Comment admits phone was once one-press with no chart check. | System clipboard / Universal Clipboard / paste buffers are outside your BA boundary. You designed egress into an unmanaged buffer, then celebrated "Copied — ready to paste ✓." |
| **2** | **Chart check is self-serving theater** | "Show me any technical control that verified the open Curve chart before PHI left the app." | `exportCheck`: a **checkbox** — "correct chart is open… matched **two** identifiers." `confirmExport` only requires `pasteConfirmed` (+ killer ack). Product itself says the tool "cannot see which chart is open." | Counsel will call this manufactured consent. Two identifiers checked by the same hurried hand that already has the wrong chart open is not a safeguard; it is a liability receipt. |
| **3** | **localStorage / IndexedDB drafts are workstation PHI caches** | "Did Smile Notes store draft clinical text on shared clinic devices in cleartext browser storage?" | `draftBackup.ts`: writes full `note` + `title` to `localStorage` key `smile-notes.draft-backup.${id}` **and** IndexedDB ring (`LOCAL_BACKUP_KEEP = 8`). Header comment claims "De-identified note state only (same content as the draft)" — circular. Cleared only after **server save ack**. | Dirty drafts with names, phones, dates sit on the iPad until save succeeds. Crash, sleep, or abandon = residual PHI for the next session on that origin. Calling it "de-identified" because it matches the draft is the exhibit caption. |
| **4** | **Shared iPad = foreseeable multi-user access** | "What prevents User B from recovering User A's unfinished note, or acting under User A's 30-day session?" | Auth: JWT session strategy; watermark comments admit **30-day** cookies vs chairside walk-away. `/api/me/sessions` DELETE exists because shared machines are "the realistic way a dental practice loses control of an identity." Display prefs / tour / risk checklist are **browser** localStorage, not locked to a signed-in principal for every surface. Draft backup is **device-scoped by draftId**, not wiped on sign-out. | You documented the threat in your own comments, then left plaintext mirrors and long-lived sessions as the default chairside path. Foreseeability is already in the source. |
| **5** | **PHI override is waiver theater with an asymmetric conscience** | "When the product flagged identifiers, what stopped staff from exporting anyway — and why is AI stricter than Copy?" | `PhiOverrideDialog`: checkbox + reason **code** + optional detail → `composePhiOverrideReason` → export/submit unlock. Dialog comment: before masking, "between patients the waiver wins." Server enforces `isValidPhiAttestation` (good) but still records a **human waiver**, not a technical remove. `phi-names.test.ts`: bare name is **S2** — not in `phiStops`, **exportAllowed**. `assist/service.ts`: **any** phi finding blocks the model. | You know names are identifiers: the AI gate treats them as such. Copy/download does not. Reason codes make a pretty Lead digest and a terrible deposition: "You picked 'tooth-or-site-numbers' and then pasted John Smith into Curve." |
| **6** | **Title fields are the quiet exfil path** | "Does the note title become a filename or other metadata that can carry a patient name off-box?" | Submit route: `runPhiRule(draft.title)`; comment — `slugifyTitle(draft.title)` becomes **emailed attachment filename**. `phi-regressions.test.ts`: name in title is visible S2 review, **not** a hard stop; dates/phones/MRNs block. Sticky header title invites "John Smith crown seat 8" under time pressure. | Filename + email attachment is disclosure metadata. Screening that *notices* a name but still permits export is notice without custody. Counsel will ask why the title was ever free-text for identifiers. |

## Four product demands

Effort = invasiveness. **Policy** = no cleartext PHI on shared devices; no unmanaged egress; no waiver that is easier than redact.

| # | Demand | Closes angles | Notes |
| --- | --- | --- | --- |
| **1** | **Egress custody: clipboard TTL + no silent download fallback for PHI-bearing text** | 1, 2 | After successful paste handoff, clear or overwrite clipboard when the platform allows; never fall back to an unencrypted `.md`/`.txt` on disk without an explicit, logged "write file" path and short retention guidance. Prefer in-app paste bridge / one-shot token over durable OS buffers where feasible. |
| **2** | **Shared-device draft hygiene: encrypt or eliminate local mirrors; wipe on logout / user switch** | 3, 4 | Stop plaintext `localStorage` mirrors of clinical drafts on multi-user origins. Bind backup to authenticated user + wipe on sign-out and session revoke. Idle lock shorter than 30-day cookie fantasy. Offer "this is a shared iPad" mode that disables local backup entirely. |
| **3** | **Kill override-as-default: mask-first hard path; names that gate AI must gate Copy** | 5 | Make Mask the only one-tap recovery; Override requires second person or Lead role for S0, or time-gated friction that survives rush. Align export gate with AI gate for `phi.*` category — or admit Copy is a known PHI path and stop calling the product PII-free by premise. |
| **4** | **Title custody: structured non-PHI titles; block identifier egress in filenames** | 6 | Title templates without free-text patient identifiers; treat bare-name title hits as export stops (or strip/refuse slugify when phi hits). Never email an attachment whose basename can be a patient name. |

## The trap — privacy theater

**Deterministic PHI rules + Privacy stop dialog + reason codes + "two identifiers" checkbox + AI PHI gate** is the trap.

It photographs as a covered-entity-grade control environment. The audit panel goes red. Masking offers `[PERSON-A7K2]`. Tests prove five-character attestations are dead. SuperByte refuses the call when a bare name appears.

Then the same product: writes the full composed note to the **system clipboard**; on clipboard failure, **downloads** it; mirrors dirty drafts to **plaintext localStorage + an 8-deep IDB ring** on the operatory iPad; lets a **checkbox** stand in for chart identity; lets **S2 bare names** ride out on Copy and on **emailed filenames**; and records a **dropdown waiver** when staff are between patients — exactly the failure mode your own dialog comment predicts.

That is privacy **theater**: the gates look adult; the egress paths are adolescent. Do not "fix" this with more reason codes, a prettier override dialog, or another HelpTip that confesses the tool cannot see the chart. Fix custody of the text, or admit the product is a drafting aid that **expects** PHI to leave unmanaged.

## Explicitly do not ship (privacy hate)

- More override reason codes without closing the S2-name export hole.
- "De-identified" labeling for storage that holds the same bytes as a draft that may contain identifiers.
- Celebratory "Copied ✓" without clipboard custody.
- Longer sessions "for convenience" on shared glass.
- Silent `.md` download as the clipboard-permission consolation prize.
- Training that tells staff the checkbox is a HIPAA control.

## Measurement (falsifiers)

| Metric | Keep | Kill |
| --- | --- | --- |
| Cleartext clinical draft bytes in localStorage/IDB on shared-device mode | 0 | Any `smile-notes.draft-backup.*` with note body |
| Clipboard / download egress of text with open `phi.*` (incl. S2 names) without mask or dual control | 0 | Current S2 pass-through |
| Title/filename containing `phi.name*` / definite ID patterns on email send | Blocked or stripped | S2 review + send |
| Session idle on shared iPad before lock / re-auth | Minutes, not 30 days | Walk-away still typed-as-prior-user |
| Override rate vs Mask rate (Lead digest) | Mask dominates | Override wins between patients |

## Open questions for the owner

1. **Shared-iPad mode** — disable local backup and shorten session, or accept exhibit risk?
2. **Export gate = AI gate** for all `phi` category findings — accept more friction on Copy?
3. **Dual control on PHI override** — Lead/second signature, or keep single-writer waiver?

## Related

- `knowledge/sources/draft-autosave-reliability.md` (IDB mirror as reliability — privacy cost not priced)
- `knowledge/sources/tn-dental-legal-best-practices.md` (HIPAA Security Rule context)
- `knowledge/sources/high-stakes-documentation-patterns.md` (independent verification / check-answers)
- `src/lib/client/draftBackup.ts`
- `src/components/builder/BuilderShell.tsx` (clipboard, chart check, backup offer)
- `src/components/builder/BuilderDialogs.tsx` (`PhiOverrideDialog`)
- `src/app/api/drafts/[id]/submit/route.ts` (title → filename)
- `src/lib/audit/rules/phi-names.test.ts` (S2 bare name ≠ stop)
- `src/lib/assist/service.ts` (any-phi AI gate)
- `src/lib/auth/sessionWatermark.ts` (30-day cookie vs revoke)
