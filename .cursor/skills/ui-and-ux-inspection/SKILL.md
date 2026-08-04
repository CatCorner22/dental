---
name: ui-and-ux-inspection
description: Inspect a bespoke web application for usability, cognitive-load, accessibility, interaction, workflow, performance, and privacy defects, producing reproducible severity- and confidence-rated findings with remediation and verification tests. Use when the user asks to inspect or audit a web interface; review UX, UI, forms, navigation, accessibility, or cognitive load; simplify a workflow; analyze screenshots or routes; generate Playwright or accessibility tests; compare an implementation with design heuristics; or create a remediation backlog.
---

# UI and UX Inspection

Source: owner-supplied research report "Eye Tracking, Web-App Usability, and Cognitive
Design" (ingested 2026-08-04; digest at `knowledge/sources/eye-tracking-uiux-research.md`).
The specification below is the report's own, preserved verbatim; the detailed
inspection procedure and remediation patterns live one level deep:

- Full step-by-step procedure: [procedure.md](procedure.md)
- Remediation patterns: [remediation-patterns.md](remediation-patterns.md)

## Purpose

Inspect a bespoke web application for usability, cognitive-load, accessibility,
interaction, workflow, performance, and privacy defects.

The skill must:

1. Identify defects that reduce task success, increase time-on-task, increase
   errors, cause abandonment, or undermine informed user control.
2. Trace critical user processes backward from successful end states.
3. Distinguish observed evidence from inference.
4. Produce reproducible findings with severity, confidence, affected routes,
   evidence, remediation, and verification tests.
5. Prefer standards-compliant native semantics and established interaction
   conventions over unnecessary custom controls.
6. Never claim that automated inspection proves usability.
7. Never collect eye-tracking, webcam, biometric, production analytics, or
   personal data without explicit authorization.

## Invocation

Use when the user asks to:

- inspect or audit a web interface;
- review UX, UI, forms, navigation, accessibility, or cognitive load;
- simplify a workflow;
- analyze screenshots or routes;
- generate Playwright or accessibility tests;
- compare an implementation with design heuristics;
- create a remediation backlog.

Suggested slash-command name: `/ui-and-ux-inspection`

## Inputs

Accept as many of the following as are available.

### Required inputs

- `repository_root`: path to the application repository.
- At least one of: `app_url`; local run command; route or component list;
  screenshots; design files or implementation files.

### Preferred inputs

- `critical_processes`: end-to-end user goals, written as outcomes.
- `target_routes`: public and authenticated routes to inspect.
- `test_accounts`: least-privilege test credentials or fixture instructions.
- `personas`: roles, domain expertise, access needs, devices, and language.
- `analytics_baseline`: task completion, funnels, errors, latency, support data.
- `design_system`: component library, tokens, and interaction standards.
- `browser_matrix`: supported browsers, viewports, and input methods.
- `constraints`: regulatory, security, technical, brand, and deadline limits.
- `allowed_commands`: commands the agent is authorized to execute.
- `write_permission`: whether the agent may modify code or only report.
- `study_population`: optional recruitment definition, including whether
  U.S. native-born status is relevant and how it was directly measured.

### Prohibited assumptions

Do not infer: citizenship or nativity; disability; age; gender; race or
ethnicity; literacy; medical status; intent to consent; production
authorization; permission to retain screenshots or telemetry.

## Outputs

Create or return:

1. `ui-ux-inspection.md` — executive summary; scope and limitations; critical
   findings; workflow analysis; accessibility results; performance findings;
   privacy findings; prioritized remediation plan; test plan.
2. `ui-ux-findings.json` — machine-readable findings using the schema below.
3. Optional, only when authorized: `tests/ui-ux/*.spec.ts`; accessibility test
   files; Lighthouse reports; sanitized screenshots; route inventory; proposed
   code patches; before-and-after flow diagrams.

### Finding schema

```json
{
  "id": "UIX-001",
  "title": "Save action has no persistent completion state",
  "category": "feedback",
  "severity": "high",
  "confidence": "high",
  "status": "open",
  "routes": ["/records/:id/edit"],
  "user_process": "Edit and save a record",
  "affected_users": ["all", "keyboard users"],
  "evidence_type": ["runtime", "code", "automated-test"],
  "observed_evidence": [
    "Button enters no visible pending state",
    "No aria-live result is announced",
    "Repeated activation creates two requests"
  ],
  "user_impact": {
    "task_success": "at risk",
    "time_on_task": "increased",
    "error_rate": "increased",
    "accessibility": "serious"
  },
  "heuristics": ["visibility-of-status", "error-prevention"],
  "standards": ["WCAG 4.1.3 where applicable"],
  "reproduction": [
    "Open an editable record",
    "Change the title",
    "Activate Save twice within one second"
  ],
  "remediation": [
    "Disable or debounce duplicate submission",
    "Show a pending state immediately",
    "Render persistent saved or failed status",
    "Announce the result accessibly"
  ],
  "verification": [
    "One network mutation occurs",
    "Visible state changes within 100 ms",
    "Result is exposed to assistive technology",
    "Failure preserves the edited value"
  ],
  "estimated_effort": "small",
  "dependencies": [],
  "privacy_notes": []
}
```

## Severity model

Use impact, frequency, reach, and recoverability.

- `critical` — blocks a critical task for a substantial user group; exposes
  sensitive data; causes irreversible loss, financial harm, or unsafe action;
  creates a keyboard trap or equivalent complete access failure; violates
  authorization boundaries.
- `high` — materially reduces task success; causes repeated or consequential
  errors; blocks an important task for a meaningful subgroup; creates serious
  accessibility or recovery defects.
- `moderate` — increases time, uncertainty, or correction burden; has a
  workaround that typical users may discover; affects a secondary task or
  smaller population.
- `low` — minor friction or inconsistency with limited behavioral consequence.
- `informational` — observation, opportunity, or item requiring human
  validation.

Never assign severity from aesthetics alone.

## Confidence model

- `high`: directly reproduced, observed in code and runtime, or verified by
  multiple independent evidence sources.
- `medium`: strongly implied by one reliable source or a documented heuristic.
- `low`: inferred from incomplete context, static screenshots, or an uncertain
  user assumption.

Keep severity and confidence separate. A potentially critical issue may have
low confidence and should be escalated for verification, not silently lowered.

## Inspection procedure

Follow [procedure.md](procedure.md) end to end: preflight and authorization;
interface inventory; critical user outcomes; backward process tracing; visual
hierarchy and scanability; Gestalt grouping; choices and progressive
disclosure; affordances and signifiers; navigation and mental models; forms;
feedback, state, and recovery; tables, filters, and search; onboarding and
engagement; accessibility (WCAG 2.2 AA default); responsive and environmental
behavior; performance; automated test plan; human-validation prompts;
eye-tracking mode (optional, disabled by default); privacy inspection.

## Internal controls

The skill must obey the following controls.

1. Evidence separation — Label each finding as observed, automated,
   user-reported, or inferred. Never present a heuristic prediction as
   measured user behavior.
2. Change control — Do not modify code unless write permission is explicit.
   Keep patches small and reversible. Do not redesign brand or product
   strategy beyond scope. Run existing tests before and after changes.
3. Safety — Never execute destructive production actions. Never bypass
   authentication or authorization. Never weaken validation, logging, privacy,
   or security merely to reduce steps.
4. Accessibility — Do not remove accessibility semantics to satisfy visual
   design. Do not accept an automated score as proof of conformance.
5. Privacy — Do not infer protected or sensitive traits. Do not retain
   personal data unnecessarily. Do not expose test credentials or screenshots
   containing secrets.
6. Reproducibility — Record route, viewport, browser, data fixture, account
   role, build commit, and steps for runtime findings. Record tool versions
   and configuration.
7. Deduplication — Consolidate shared-component defects into one root finding.
   List all affected routes and instances.
8. Confidence — Do not inflate confidence because a rule is familiar.
   Downgrade conclusions drawn only from screenshots or incomplete flows.
9. Metrics — Recommend task outcomes before click or engagement counts. Pair
   efficiency gains with correctness, accessibility, privacy, and trust
   guardrails.
10. Demographics — Do not treat U.S.-based, English-speaking, or
    native-English participants as equivalent to U.S. native-born. Require
    direct, optional, defined self-report for subgroup analysis.

## Heuristic catalog

Use the following identifiers.

- `UIX-H01` Visibility of system status
- `UIX-H02` Match to user mental model
- `UIX-H03` User control and freedom
- `UIX-H04` Consistency and standards
- `UIX-H05` Error prevention
- `UIX-H06` Recognition over recall
- `UIX-H07` Efficiency and progressive disclosure
- `UIX-H08` Minimal and hierarchical presentation
- `UIX-H09` Error recognition and recovery
- `UIX-H10` Contextual help
- `UIX-H11` Gestalt grouping
- `UIX-H12` Clear affordances and signifiers
- `UIX-H13` Choice architecture
- `UIX-H14` Target size and proximity
- `UIX-H15` Form clarity and data minimization
- `UIX-H16` Accessible semantics and operation
- `UIX-H17` Responsive and environmental resilience
- `UIX-H18` Performance and interaction causality
- `UIX-H19` Honest engagement and informed choice
- `UIX-H20` Privacy and sensitive-data control

## Report format

The final report must begin with an executive summary and include:

1. Scope and limitations.
2. Critical findings table.
3. Critical-process step counts.
4. Current and proposed Mermaid flows.
5. Accessibility findings.
6. Performance findings.
7. Privacy findings.
8. Quick wins.
9. Structural remediations.
10. Proposed KPIs and experiments.
11. Verification checklist.

For each recommendation, state: user problem; evidence; expected metric
direction; implementation outline; risk or tradeoff; verification test.

Do not promise a numerical uplift unless it was measured in the inspected
product. Numerical targets must be labeled as proposed experiment gates.
