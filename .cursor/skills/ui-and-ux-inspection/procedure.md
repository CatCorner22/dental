# Inspection procedure (verbatim from the source specification)

### Preflight and authorization

1. Read repository instructions and existing project documentation.
2. Confirm whether the task is report-only or permits modifications.
3. Identify commands that can be run safely.
4. Do not connect to production, submit real transactions, send messages,
   delete data, invite users, or alter accounts unless explicitly authorized.
5. Use test fixtures and least-privilege accounts.
6. Detect secrets and redact them from logs and screenshots.
7. Record unavailable inputs and resulting limits.

### Build an interface inventory

1. Identify framework, router, design system, form library, state management,
   API client, authentication flow, testing tools, and analytics hooks.
2. Enumerate:
   - routes;
   - layouts and navigation;
   - forms;
   - tables;
   - dialogs;
   - menus and comboboxes;
   - notifications;
   - loading, empty, error, and permission states;
   - destructive actions;
   - onboarding and account gates.
3. Map shared components to all consuming routes.
4. Flag one-off implementations that duplicate design-system components.
5. Identify responsive breakpoints and supported input modes.

### Define critical user outcomes

For each user process, express success as an observable end state.

Good:

- “The user submits a valid reimbursement request and receives a trackable
  reference.”
- “The user finds an overdue invoice and records a partial payment.”
- “The user exports the filtered report they inspected.”

Avoid:

- “The user visits the dashboard.”
- “The user clicks the submit button.”
- “The user spends time in the app.”

### Trace each process backward

Starting from the successful state:

1. List the minimum information, authorization, and commitment required.
2. Identify the latest safe point at which each item is needed.
3. Mark each current step as:
   - essential;
   - inferable;
   - reusable;
   - deferrable;
   - mergeable;
   - removable;
   - risk control.
4. Count:
   - screens;
   - modal transitions;
   - decisions;
   - required fields;
   - repeated entries;
   - navigation changes;
   - external waits;
   - confirmation steps.
5. Propose a shorter path.
6. Preserve security, legal, financial, and accessibility requirements.
7. Produce a Mermaid flow comparing current and proposed paths.
8. State that step reductions are proposals until measured.

### Inspect visual hierarchy and scanability

Check whether a first-time user can identify within a few seconds:

- current location;
- page purpose;
- current object;
- system status;
- primary action;
- critical exception;
- next step.

Inspect:

- descriptive headings;
- front-loaded labels;
- meaningful left edges in tables and lists;
- hierarchy created by size, position, weight, and whitespace;
- competing primary buttons;
- excessive card grids;
- decorative elements occupying prime attention;
- critical content in weak right rails;
- banner-like content likely to be ignored;
- status conveyed only by color;
- truncation hiding differentiating information;
- headings that say “Details,” “Information,” or “Overview” without meaning.

Do not claim that a static hierarchy check is eye tracking. Label it as an
attention or scanability proxy.

### Inspect Gestalt grouping

For every form, panel, toolbar, table, and dialog:

- verify that proximity reflects semantic relationship;
- verify that common containers do not group unrelated controls;
- verify that similar styling implies similar behavior;
- verify that spacing between groups is greater than spacing within groups;
- verify that labels, units, help, and errors remain attached to their control;
- verify that destructive controls are perceptually separated;
- verify that disabled, selected, focused, and active states are distinguishable.

### Inspect choices and progressive disclosure

Flag:

- long undifferentiated menus;
- advanced controls shown before the relevant decision;
- nested disclosure that hides frequently compared information;
- configuration required before the user understands the value;
- defaults with high consequence or unclear rationale;
- mutually exclusive choices implemented as unrelated checkboxes;
- option labels that do not explain differences.

Recommend based on context:

- radio buttons for a small visible choice set;
- search or autocomplete for long sets;
- categorized menus;
- safe, reversible defaults;
- recommended options with transparent rationale;
- progressive disclosure for infrequent or conditional options;
- side-by-side comparison where users must evaluate tradeoffs.

### Inspect affordances and signifiers

Flag:

- clickable nonsemantic containers;
- links styled as body text;
- body text styled as links;
- icon-only primary actions;
- hover-only actions;
- invisible drag capability;
- unclear selected tabs;
- custom controls without standard keyboard behavior;
- cursor changes without semantic action;
- controls whose state is conveyed only by animation.

Prefer:

- native elements;
- text labels for consequential actions;
- visible focus;
- persistent selected state;
- explicit drag handles;
- adequate hit areas;
- familiar placement and vocabulary.

### Inspect navigation and mental models

Check:

- labels use user-domain language;
- objects have one canonical name;
- navigation is organized around user goals and objects;
- browser Back and Forward work predictably;
- meaningful state is deep-linkable where safe;
- active location is visible;
- users do not need knowledge of internal teams or database schemas;
- permissions do not create unexplained disappearing navigation;
- recent and frequent destinations are available where appropriate;
- search results explain why they match;
- ordering and ranking logic are visible when consequential.

### Inspect forms

For every field:

1. Verify a persistent accessible label.
2. Verify required or optional status is consistent.
3. Verify the user understands why sensitive data is requested.
4. Verify formatting examples persist when needed.
5. Accept and normalize reasonable input formats.
6. Use correct autocomplete and input-purpose semantics.
7. Ensure units and constraints are visible before submission.
8. Preserve values after errors, authentication renewal, or navigation where
   appropriate.
9. Avoid asking for information already available and authorized for reuse.
10. Avoid premature validation while the user is still entering a plausible
    value.
11. Validate after blur, section progression, or submission as appropriate.
12. Provide an error summary for multiple errors.
13. Move or announce focus to the first relevant error without disorienting
    the user.
14. State what happened and how to recover.
15. Validate on the server even when client validation exists.
16. Verify duplicate submission protection.
17. Verify draft, autosave, and unsaved-change behavior.
18. Verify conditional fields are removed from validation when hidden.
19. Verify date, currency, time zone, locale, and decimal behavior.
20. Verify pasted values and password-manager behavior.

### Inspect feedback, state, and recovery

Check all mutations and long operations for:

- immediate acknowledgement;
- pending state;
- prevention of duplicate activation;
- success confirmation;
- persistent resulting state;
- specific failure;
- retry path;
- cancellation where feasible;
- retained user data;
- undo for reversible destructive actions;
- partial-failure handling;
- offline or interrupted-network handling;
- stale-data conflict handling;
- session-expiration recovery.

Test slow, failed, duplicate, and out-of-order responses.

### Inspect tables, filters, and search

Check:

- differentiating information appears early in each row;
- numeric columns align consistently;
- sorting state is visible and accessible;
- active filters remain visible;
- result count reflects filters;
- “clear all” is available;
- empty states distinguish no data from no matches;
- filter changes do not silently discard work;
- row actions work with keyboard and touch;
- essential actions are not hover-only;
- pagination or virtualization preserves context;
- selection persists or resets explicitly;
- bulk action scope is visible;
- export reflects the visible view or clearly states differences;
- authorization is enforced server-side for search and export;
- sensitive filter values are not exposed in shareable URLs without review.

### Inspect onboarding and engagement

Flag:

- forced tutorials;
- setup before value;
- mandatory preference questions without immediate use;
- fake progress;
- artificial task fragmentation;
- streak or urgency patterns that punish absence;
- preselected consent;
- unclear cancellation or opt-out;
- engagement metrics disconnected from successful outcomes.

Prefer:

- guided real tasks;
- templates;
- sample data;
- dismissible contextual help;
- truthful progress;
- user-controlled reminders;
- reversible defaults;
- explicit value before commitment.

### Inspect accessibility

Use WCAG 2.2 AA as the default target unless the project specifies another
standard.

Automated checks must include where supported:

- accessible names, roles, and states;
- missing or duplicate labels;
- duplicate IDs;
- landmark structure;
- heading hierarchy;
- image alternatives;
- form associations;
- color contrast;
- invalid ARIA;
- focusable hidden elements;
- dialog semantics;
- document language;
- target size proxies.

Manual checks must include:

1. Complete critical processes using keyboard only.
2. Verify visible focus and logical focus order.
3. Verify no keyboard traps.
4. Verify focus enters, remains within, and exits dialogs appropriately.
5. Verify errors and status are exposed to assistive technology.
6. Verify zoom and reflow.
7. Verify text spacing does not break content.
8. Verify reduced-motion behavior.
9. Verify content is understandable without color.
10. Verify touch and coarse-pointer operation.
11. Verify targets meet at least the applicable 24 CSS-pixel requirement or
    a documented exception; prefer 44 CSS pixels for important controls.
12. Verify custom widgets against established ARIA interaction patterns.
13. Perform at least one screen-reader smoke test for critical flows.

Automated success does not prove accessibility.

### Inspect responsive and environmental behavior

Test representative widths and orientations, such as:

- 320 CSS pixels;
- 375 CSS pixels;
- 768 CSS pixels;
- 1024 CSS pixels;
- 1440 CSS pixels.

Also test:

- 200% and 400% zoom or equivalent reflow;
- coarse pointer;
- keyboard;
- reduced motion;
- dark or high-contrast settings where supported;
- long names and translated strings;
- empty, one-item, and high-volume data;
- slow network;
- offline interruption;
- expired session;
- browser Back and reload;
- duplicate tabs;
- stale concurrent edits.

Do not treat these viewport values as exhaustive device coverage.

### Inspect performance

Run authorized automated diagnostics in consistent conditions.

Check:

- Interaction to Next Paint;
- Largest Contentful Paint;
- Cumulative Layout Shift;
- long main-thread tasks;
- route and API latency;
- loading waterfalls;
- layout movement around controls;
- expensive rerenders;
- unbounded table rendering;
- oversized scripts and images;
- blocking third parties;
- repeated API calls;
- duplicate submissions;
- missing skeleton or progress behavior;
- inaccessible loading states.

Use Lighthouse as a diagnostic tool, not as the only performance measure.
Prefer real-user p75 distributions for production decisions.

Suggested budgets unless the project defines stricter ones:

- INP p75: at or below 200 ms;
- LCP p75: at or below 2.5 s;
- CLS p75: at or below 0.1;
- no layout shift that moves the active target during interaction.

Record environment and variability for each lab run.

### Automated test plan

Detect the existing package manager and test framework before adding tools.

Preferred stack when compatible:

- Playwright for browser tasks;
- `@axe-core/playwright` for automated accessibility checks;
- Lighthouse or Lighthouse CI for diagnostics;
- the project’s existing unit and component-test framework;
- linting with accessibility rules where appropriate.

Generate task-level tests, not only page-load tests.

Example test intents:

- critical path succeeds with keyboard only;
- first invalid submission identifies and focuses the correct field;
- entered values survive a server validation failure;
- Save sends one mutation despite repeated activation;
- loading and completion states are visible;
- dialog focus is trapped and restored;
- Back returns to the prior meaningful state;
- active filters survive refresh when intended;
- clearing filters restores the full result set;
- an export contains the represented filters and columns;
- destructive action can be undone or requires appropriate confirmation;
- narrow viewport has no inaccessible horizontal clipping;
- reduced motion disables nonessential animation;
- unauthorized users cannot retrieve hidden data through direct endpoints.

### Human-validation prompts

When automated evidence is insufficient, request or recommend focused human
validation rather than asserting a conclusion.

Examples:

- “Can a first-time user predict what this icon does?”
- “Does this taxonomy match the language used by requesters?”
- “Is this default safe and expected?”
- “Is the right-side summary noticed during the task?”
- “Does the error message explain a viable recovery?”
- “Is the extra verification step required at this point or only before a later
  risky action?”

### Eye-tracking inspection mode

Eye-tracking mode is optional and disabled by default.

Do not activate a webcam or eye tracker without:

- explicit informed consent;
- approved protocol;
- stated purpose;
- data-minimization plan;
- retention and deletion schedule;
- access controls;
- legal and privacy review;
- an alternative for people who decline.

When authorized:

1. Define realistic tasks.
2. Define areas of interest before analysis.
3. Record calibration quality and exclusions.
4. Measure:
   - time to first fixation;
   - dwell share;
   - fixation count;
   - transition paths;
   - missed critical areas;
   - revisit behavior.
5. Pair gaze with:
   - task success;
   - time;
   - errors;
   - comprehension;
   - confidence.
6. Avoid interpreting fixation as comprehension.
7. Report individual variation as well as aggregate heatmaps.
8. Do not infer U.S. nativity from eye, face, language, or gaze data.
9. If U.S. native-born analysis is required, obtain it through an optional,
   direct screener using an explicit definition.
10. Prefer derived gaze events over retained face or eye video.

### Privacy inspection

Check whether the application or test process collects:

- face or eye images;
- gaze coordinates;
- behavioral biometrics;
- keystrokes;
- precise location;
- health or financial information;
- screen recordings;
- session replay;
- free-text sensitive data;
- authentication tokens;
- production identifiers.

For each collection, record:

- purpose;
- legal or contractual basis;
- user notice;
- consent where applicable;
- fields collected;
- third parties;
- retention;
- deletion;
- access;
- encryption;
- environment;
- ability to opt out;
- whether a less sensitive signal would suffice.

Default controls:

- no production personal data in screenshots;
- redact secrets and identifiers;
- no raw eye or face video unless essential;
- local or ephemeral processing where possible;
- shortest practical retention;
- role-based access;
- deletion verification;
- no demographic inference;
- no secondary use beyond the stated study;
- no vendor upload without authorization and data-processing review.

Do not give a categorical legal conclusion. Flag jurisdiction-dependent
biometric and privacy questions for qualified review.
