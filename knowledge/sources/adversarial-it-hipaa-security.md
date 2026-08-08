# Adversarial hate panel — Practice IT / HIPAA security officer

- **Type**: red-team / adversarial stakeholder simulation (not a live OCR or BAA review)
- **Ingested**: 2026-08-08
- **Tags**: hipaa, security, phi, browser, tablet, clipboard, drafts, mfa, session, red-team
- **Status**: demand list for owner / ops; several items are deployment knobs already in code
- **Method**: One mock agent instructed to **hate** Smile Notes as a Practice IT / HIPAA security officer. Hostile by design. Grounded in shipped surfaces: browser builder, shared-tablet ops, `navigator.clipboard`, IndexedDB/`localStorage` draft mirrors, `MFA_ENABLED` default-off, long-lived session cookies + revoke watermark. **Not** a formal Security Risk Analysis.

## Axiom

Smile Notes puts clinical note text in a **browser on shared glass**, then **copies it to the system clipboard** and **mirrors drafts onto the device**. That is not "de-identified by branding." It is an ePHI-adjacent workstation risk with MFA off by default.

**Why it matters:** A plaintiff attorney hates thin notes. An IT officer hates **uncontrolled endpoints**. This panel kills pilots on **device, session, and egress** — not on cream UI.

## Persona

| Field | Value |
| --- | --- |
| Role | Practice IT / HIPAA security officer (multi-office dental) |
| Personality | Hostile, impatient, breach-notification haunted |
| Core hate | Browser PHI risk · shared tablets · clipboard · local drafts · MFA off · session bleed |
| Will not accept | "Staff are trained" as a control · "PHI gate on AI" as endpoint security · Pretty privacy copy without device lock |

---

## 7 vulnerabilities (kill / pain)

Severity: **KILL** = refuse go-live or pull the plug mid-pilot. **PAIN** = tolerate only with a dated remediation plan and compensating controls.

| # | Severity | Vulnerability | What actually happens | Why it hurts |
| --- | --- | --- | --- | --- |
| **1** | **KILL** | **Shared tablet = shared identity** | One iPad stays signed in across hygienists and rooms. Next patient opens prior author's draft / role / open note. Session watermark + "sign out all devices" exist; **per-hand-off lock before next patient does not.** | Wrong-author charting. Wrong Minimum Necessary. Wrong attribution in a complaint. Pilot kill on first wrong-author incident. |
| **2** | **KILL** | **MFA off by default** | `MFA_ENABLED` must be `"1"` or login never asks for a second factor — even for accounts with stale enrollments. Feature is disarmed until ops confidence exists. | 2026 HIPAA Security Rule direction: MFA for ePHI access is no longer a shrug. Password-only on a browser app that holds clinical text is a risk-analysis finding you cannot paper over with a banner. |
| **3** | **KILL** | **Clipboard is the product egress** | Primary handoff is `Copy for Curve` → `navigator.clipboard.writeText(markdown)`. Full note body leaves the app into **OS clipboard**, paste targets, clipboard managers, MDM screenshots of paste, and shoulder-surf. | You do not control the sink. BAA covers your app. It does **not** cover whatever the clipboard manager cached after lunch. |
| **4** | **PAIN→KILL** | **Local draft mirrors on the device** | IndexedDB ring (`smile-notes-draft-backup`) + `localStorage` fallback store note state, title, officeId for crash recovery. Same-device survivability — also **same-device persistence after the clinician walks away.** | Shared tablet + local mirror = clinical text recoverable by the next user, a stolen device, or a tech with Safari Web Inspector. "Deleted when server confirms save" is not a wipe-on-logout guarantee you can show OCR. |
| **5** | **PAIN** | **Long-lived browser session bleed** | Session cookie lives on the order of **30 days**. Revoke-all and password-change watermarks kill old tokens — **only if someone presses the button.** Idle chairside tablets do not self-evict. | Stolen cookie / borrowed glass / "I thought I signed out" is the classic dental breach story. Thirty days is not a chairside session. |
| **6** | **PAIN** | **Browser = unmanaged PHI workstation class** | Staff open the builder on personal phones, home laptops, borrowed kiosks. No enforced device posture, no MDM attestation in-app, no "managed browser only" gate. | You cannot inventory what you cannot see. Asset inventory and endpoint encryption are 2026 Security Rule operational expectations — this app expands the attack surface into every browser that can reach the URL. |
| **7** | **PAIN** | **Title / free-text identifier bleed past "de-identified" story** | Product narrative: de-identified notes. Reality: draft titles and free text still carry patient-shaped identifiers; prior research already flags title bypass of PHI screens. Clipboard and local mirrors copy that text wholesale. | Marketing says PHI-free. OCR asks what left the browser. One named patient in a title turns your "de-id" story into a contradiction in a risk analysis. |

---

## 5 controls to demand (non-negotiable)

State **WHAT** must exist, **WHY** the line stops without it, **HOW** to move. No theater.

| # | Control | Demand | Stop condition if refused |
| --- | --- | --- | --- |
| **C1** | **Hard author switch on shared devices** | Before next patient / next writer: lock screen or forced re-auth with visible identity; clear in-progress UI that is not theirs; optional auto-lock idle ≤5–15 min on tablet profiles. | **KILL pilot** on shared iPads. |
| **C2** | **MFA on for all clinical accounts** | `MFA_ENABLED=1` in production for anyone who can open drafts; documented break-glass with a second Developer + reset path. Password-only = temporary exception with owner signature and end date — not the steady state. | **Refuse production** as HIPAA-ready. |
| **C3** | **Clipboard / export accounting** | Log who copied/downloaded what draft when; short-lived clipboard policy guidance in ops SOP (paste immediately, do not leave note on clipboard); prefer in-app handoff where possible. Treat Copy as a **disclosure event**, not a convenience click. | Conditional go-live only with SOP + audit export. |
| **C4** | **Local mirror hygiene** | Wipe IndexedDB + `localStorage` draft backups on logout, author switch, and idle lock; MDM / supervised iPad profile for chairside glass; no personal-device clinical drafting without VPN + full-disk encryption policy. | Shared-tablet rooms stay on Curve-only until wiped. |
| **C5** | **Session lifetime fit for chairside** | Short idle timeout on interactive clinical sessions; revoke-all reachable in one tap from account; watermark already exists — **use it in the workflow**, not as a buried settings page. Thirty-day cookie without idle lock is unacceptable for front-desk glass. | Cap session risk or no browser on the floor. |

---

## 1 theater fix that does not help

| Theater | Why staff will love it | Why security rejects it |
| --- | --- | --- |
| **A bigger "No PHI / de-identified notes" banner (or a prettier privacy status chip)** | Cheap. Visible. Feels like compliance. Calms non-technical owners in a demo. | Does **zero** to stop shared-tablet session bleed, clipboard egress, local draft residue, or MFA-off login. OCR does not score banners. A false sense of control is worse than an honest risk register. |

If you ship only the banner, you have not answered this panel. You have decorated the breach.

---

## What they want us to do wrong (traps)

| Trap | Why it's fatal |
| --- | --- |
| "Turn MFA on later, after the pilot" | Pilot **is** production for PHI-adjacent text. Later never arrives. |
| "Staff will remember to sign out" | Training is not a technical control. Shared iPads prove it daily. |
| "Clipboard is fine — Curve is the system of record" | The path **between** systems is where the uncontrolled copy lives. |
| "Local backup is de-identified so it's fine on disk" | Titles + free text + clinical narrative are still sensitive; device theft does not read your charter. |
| Soften idle lock because "it slows hygiene" | Speed without lock is how the wrong author finishes the wrong patient. |

---

## How this maps to code / ops (grounding)

| Finding | Code / config touchpoint |
| --- | --- |
| MFA default-off | `src/lib/auth/mfaFeature.ts` — `MFA_ENABLED===1` |
| Session revoke watermark | `src/lib/auth/sessionWatermark.ts`; account revoke sessions UI |
| Clipboard egress | `BuilderShell` Copy → `navigator.clipboard.writeText` |
| Local drafts | `src/lib/client/draftBackup.ts` — IndexedDB + `localStorage` |
| Long session | Auth session design (~30 days) + optional revoke |
| Shared tablet ops risk | Already flagged as pilot kill in OM hate panel (wrong-author) |

---

## Measurement (falsifiers)

| Metric | Keep | Kill |
| --- | --- | --- |
| Wrong-author events on shared iPad | Zero | Any |
| MFA enrolled for clinical roles in prod | 100% | Any password-only clinical login after deadline |
| Idle lock on chairside profiles | On, ≤15 min | Disabled "for speed" |
| Local draft residue after logout / switch | None recoverable | Inspector can read prior note |
| Copy/export audit rows for disclosures | Present | Silent clipboard with no trail |

---

## Explicit non-asks (honest scope)

This officer is **not** demanding Curve write-back, ambient AI, or turning the builder into an MDM product. Demand is: **identity on glass, second factor, short sessions, wipe local residue, treat clipboard as disclosure.** Everything else is noise.

## Related

- [TN dental legal best practices](tn-dental-legal-best-practices.md) — 2026 HIPAA Security Rule MFA / encryption / SRA expectations
- [Draft autosave reliability](draft-autosave-reliability.md) — why local mirrors exist (reliability vs endpoint risk)
- Cornerstone artifact open action: decide HIPAA 2026 operational controls
