# Curve Hero (Curve Dental) — clinical documentation & notes system

- **Source**: User-provided research synthesis (pasted text, 2026-08-02); synthesizes Curve Dental official help articles (Zendesk), product pages, blogs, and demo descriptions/transcripts current as of mid-2026
- **Type**: other (product research synthesis)
- **Author/Origin**: Compiled by the project owner from Curve Dental public documentation
- **Published**: mid-2026 (currency of underlying sources)
- **Ingested**: 2026-08-02
- **Tags**: dental, pms, clinical-notes, note-templates, benchmarking, ai-documentation, ux

## Summary

Curve Hero (Curve Dental; recent branding Curve SuperHero, with Curve Care+ ambient AI) is a
leading 100% cloud, browser-based all-in-one dental practice management system used by tens of
thousands of dental professionals. It unifies scheduling, charting, perio, imaging, clinical
notes, treatment planning, billing, insurance, patient engagement, and reporting, with a design
emphasis on minimal clicks, persistent patient context, and standardized low-typing clinical
documentation. It is the primary competitive benchmark for this repo's dental
notes-standardization app — especially its note tagging/attachment model, Curve Forms template
builder, and AI-generate-then-human-review loop.

## Key concepts

- **Sidekick (signature UI element)** — a persistent side panel that stays visible across all
  modules and acts as a patient-centric command center: select a patient once and get 1–2
  click access to Charting, Notes, Perio, Imaging, Billing, Files & Letters, and Profile, plus
  expandable summary sections (Appointments, Insurance, Recare, Profile, Billing/aging, Notes)
  with flags/hover alerts for medical conditions, forms, insurance, and custom fields. Enables
  "dual-monitor-like" behavior in one browser window; a privacy mode can hide names.
- **Critical-note alerting** — the Notes module/icon turns red whenever a Critical-tagged note
  exists, and critical notes carry a red icon when expanded; Critical notes are always visible
  in Sidekick. This is Curve's strongest visual alert pattern.
- **Charting module** — an always-visible interactive odontogram beside Treatment Plan Cards,
  with two modes: Planning (new/future work, typically shown red) and History (completed work,
  this-practice vs. other-practice color coding, sortable by date/tooth/code/provider/clinic).
- **Shortcut-driven charting** — customizable Shortcut buttons (including multi-tooth/multi-code
  macros) are the fastest path; procedures "paint" visually onto the odontogram via click or
  click-and-drag surface selection and auto-populate the Treatment Plan Card with ADA/CDT code,
  description, site, surfaces, material, and visit grouping. Some visuals (e.g., accurate
  Class V painting) require Advanced mode.
- **Treatment Plan Cards** — organize procedures into visits with insurance/patient/total
  estimates and PPO write-offs; cards can be expanded, resized, separated, reordered; multiple
  independent plans/tabs per patient support phasing and options.
- **Notes are first-class structured objects**, not free-floating text: free-form, templated,
  or AI-generated, and tightly linked to clinical context (visits, procedures, teeth, invoices,
  perio exams, images) when created in context.
- **Note tags (~24 system defaults) are the primary organizational and behavioral mechanism** —
  tags control attachment, visibility, and behavior, not just labeling. Key clinical tags:
  Treatment Planning (default pre-checkout note on visits), Clinical History (visit/
  date-of-service-attached, preferred for continuity), Clinical (standalone, contextual
  visibility), Critical (always visible + red alert), plus Perio, Image, Chart Label, Pop-up
  (appears on patient selection), Billing, Correspondence, Memo/To Do, etc.
- **Auto-conversion on checkout** — Treatment Planning notes automatically convert to Clinical
  History and attach to the date of service/procedures when the visit is checked out; charted
  procedures simultaneously move from Planning to History.
- **Context-of-creation determines attachment (key nuance)** — notes created contextually
  (right-click a visit or procedure) link to that object; notes created generically in the
  Notes module or Sidekick may NOT attach even if tagged "correctly." Auto-tagging follows
  creation context; manual retagging is possible via right-click. Best practice: attach
  clinical notes to visits for tracking and auditability.
- **Curve Forms template system (two-tier)** — reached via Application Switcher → Note
  Templates. Tier 1 *Questions*: reusable building blocks (checkboxes, text boxes, yes/no,
  select/dropdowns, section headers, static text blocks) assembled in a Question Builder and
  categorized for reuse. Tier 2 *Templates*: assemble questions into full note forms with
  categories, colors (can match appointment types), required fields (red asterisks that block
  saving until completed), favorites, and nesting for complex cases (e.g., multi-crown).
- **QuickText** — a lighter in-app mechanism for rapid canned-text note insertion, distinct
  from (and often the inspiration for) full Forms templates.
- **Curve Care+ ambient AI (Notes+)** — an ambient listening widget records the clinical
  conversation (up to ~60 minutes, pause/resume, auto-pauses when other AI tools are active),
  produces a transcript, then offers "Create AI SOAP Note" or "Complete With Curve AI" (fills
  a selected template from the conversation). The provider always reviews/edits before saving;
  notes can auto-link to the visit. Earlier Bola AI integration provided voice dictation
  (worked more readily in free notes than some templated views).
- **Voice charting (Charting+ / Perio+)** — hands-free call-outs populate the odontogram in
  real time (conditions, statuses, shortcuts); Perio+ takes full pocket-depth/condition
  charting by voice (sets of three readings, "Jump Tooth #"), enabling solo exams without a
  scribe.
- **Perio module** — separate graphical module with keyboard shortcuts and exam settings
  (order patterns, start with pocket depth or gingival margin, skip teeth, alert thresholds);
  findings integrate into the patient record and can carry Perio-tagged notes.
- **Color coding is pervasive** — schedule (red unconfirmed/emergency, green confirmed/recare,
  orange new patient, purple perio, blue restorative), recare status (overdue/scheduled/
  unscheduled), planned-vs-history charting colors, template colors matched to appointment
  types.
- **Dental variables/selectors** — tooth/site numbers incl. supernumerary, surfaces
  (M/D/O/B/L/F plus Class V and combinations via click/drag), materials, ADA/CDT codes,
  providers, fees, visit sequencing, conditions/statuses. Structured note "variables" come
  from Forms components rather than classic mail-merge placeholders — Curve leans on reusable
  questions + context + AI fill instead of merge fields.
- **End-to-end flow** — patient selection populates Sidekick → Smart Forms auto-populate chart
  data → visual charting + optional ambient AI in the operatory → notes attached to the visit
  and tagged → treatment plan presented (print/email/text with eSign) → checkout converts
  Planning to History → ongoing contextual access via Sidekick with Critical alerts, filters,
  and bulk note printing via Reports; notes feed audit trails.

## Notable quotes and data

- Claimed **3.5× faster charting** (marketing claim).
- Claimed **case-acceptance improvements up to ~30%** attributed to patient-friendly visuals.
- Ambient AI recording cap of **~60 minutes** per session, with pause/resume.
- **~24 default note tags** (numbered 1–24) governing note behavior.
- **1–2 click access** to modules via Sidekick is the stated design target.
- Notes support embedded images and tables, but full file attachments are limited or routed
  through the Files module.

## Relationships

- Agrees with: none noted (first source in the knowledge base).
- Contradicts: none noted.

## Raw notes

**Stated implications for this repo's notes-standardization app (the source's own 7-point
list):** (1) contextual attachment + tagging rules mirroring visit/procedure/tooth linkage;
(2) modular reusable form-builder components (checkboxes, dropdowns for surfaces/materials/
conditions, required fields, categories); (3) persistent/easily accessible patient context
panel; (4) visual cues and color/alert systems; (5) seamless AI generation + human review
(SOAP or custom templates); (6) minimal-click entry paths and shortcuts for common dental
variables; (7) clean modern UI usable chairside or on secondary devices. Suggested
differentiators: deeper standardization *enforcement*, cross-PMS portability, richer
audit/export, specialized note intelligence.

**Caveats:** public documentation is thin on exhaustive dropdown lists, exact component
schemas, and full tag behavior tables (proprietary; needs customer access or demos). AI widget
availability differs between free and templated notes. Multi-clinic, permissions, and
role-based visibility add complexity not fully covered here.
