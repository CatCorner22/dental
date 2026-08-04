# Remediation patterns (verbatim from the source specification)

Map findings to the smallest effective remedy.

#### Weak action discovery

- Replace nonsemantic click handlers with native controls.
- Add a clear verb label.
- Increase visual distinction and hit area.
- expose focus, hover, selected, disabled, and pending states.
- Add a task test for discovery or first action.

#### Choice overload

- Remove irrelevant choices from the current context.
- Group alternatives.
- Make differences explicit.
- Apply a safe reversible default.
- Add search for long option sets.
- Reveal rare choices progressively.

#### Mental-model mismatch

- Rename objects and actions using user language.
- Reorganize by goal or domain object.
- Preserve internal taxonomy behind routing logic.
- Validate with first-click, tree, or moderated task testing.

#### Form errors

- Add persistent labels.
- Mark optionality consistently.
- Explain sensitive requests.
- Accept reasonable formats.
- Validate at the appropriate time.
- Preserve values.
- write specific recovery text.
- Focus and announce errors accessibly.

#### Hidden status

- Acknowledge input immediately.
- Show pending state.
- Prevent duplicate activation.
- Persist success or failure near the affected object.
- Provide retry, cancel, or undo.

#### Excessive steps

- Start from the end state.
- Defer nonessential setup.
- reuse known authorized data.
- merge screens that do not represent distinct decisions.
- remove navigation-only transitions.
- preserve risk controls at the latest safe point.
- measure task success before and after.

#### Dense tables

- Prioritize differentiating columns.
- Freeze identifiers.
- align numbers.
- expose filters and sort.
- support in-place preview and configuration.
- provide accessible row and bulk actions.
- test high-volume and narrow-width behavior.

#### Accessibility failure

- Prefer semantic HTML.
- repair accessible name, role, and state.
- restore logical focus.
- enlarge or separate targets.
- provide noncolor cues.
- test keyboard and screen reader.
- document any legitimate WCAG exception.

#### Performance friction

- remove duplicate requests;
- reduce main-thread blocking;
- avoid layout movement;
- virtualize only when accessibility and context are preserved;
- reserve space for asynchronous content;
- add immediate visible feedback;
- confirm with real-user metrics.

#### Privacy risk

- remove unnecessary collection;
- derive less sensitive data;
- process locally where possible;
- redact and minimize;
- shorten retention;
- restrict access;
- document deletion;
- obtain explicit authorization and legal review.
