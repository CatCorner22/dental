# Assessment: UX, visual design, and performance review

- **Assessed**: 2026-08-03, against the running app (dev server, live browser walkthrough at
  desktop and mobile widths) and the production build output — not against the README.
- **Method**: `npm test` (916 tests), `npx tsc --noEmit`, `npm run build`, then a hands-on
  walkthrough of setup → dashboard → note builder → history/store/reference/account at 1440px and
  390–414px, using a real browser. Two fixes below were implemented and re-verified the same way
  after the change.
- **Scope note, stated up front because the request that triggered this used marketing language**:
  Smile Notes is a login-gated internal staff tool, not a public marketing site. "Promote use,"
  "visually intuitive," and "aesthetically comforting" are read here as *staff adoption and daily
  usability*, not conversion-funnel design — the two goals sometimes want different things,
  and a few recommendations below say so explicitly.

## Verdict

The app was already unusually disciplined on exactly the axes this review was asked to check.
Accessibility (focus traps, forced-colors, `prefers-reduced-motion`, 44px tap targets, WCAG
contrast on form borders), performance architecture (zero third-party network calls, no unused JS
frameworks, SVG mascots with explicit dimensions and native lazy-loading, deduped per-request DB
reads via `React.cache`), and defensive UI (hydration-safe timestamps, layout-shift-proofed nav
wrapping) all show the same "verified in a real browser" rigor as the audit engine. Two real,
narrow issues were found in a live walkthrough, both now fixed and re-verified; the rest of this
document is what to consider next, ranked, with the reasoning for why some things were
deliberately *not* touched.

## What was fixed

### 1. Mobile note builder buried live audit feedback below the entire form

**Found by**: live browser walkthrough at 390×844 (`src/components/builder/BuilderShell.tsx`).
Below the `lg` breakpoint, module rail → form → Sidekick stack vertically in DOM order (the same
`flex-col` that intentionally prevents horizontal overflow), which put the audit panel — the
"andon" signal the whole Jidoka design leans on — after every field in the form. A clinician
charting on a phone had to scroll past the entire note to see whether it was blocked.

**Fix**: a tappable summary bar (progress ring + status chip + finding count) now sits right below
the sticky title bar, visible without scrolling, on screens below `lg`. Tapping it opens the same
Sidekick content (audit/preview tabs, Copy/Download, "Review privacy stop") in the app's existing
accessible `Dialog` primitive — same focus trap, ESC handling, and focus-return already used
everywhere else, so no new interaction pattern was invented. "Go to field" now closes that sheet
before scrolling and focusing the target, so the field is not left behind a backdrop.
`AuditPanel` gained one optional `onJump` callback for this; no rule, message, or severity in the
audit engine itself changed. Desktop (`lg+`) is byte-for-byte the same layout as before — the
Sidekick aside is still sticky in its own column — verified side-by-side in the same session.

### 2. The note page's dialogs were bundled into first load, unused until clicked

**Found by**: reading the production build's route table (`/note/[id]` was the heaviest page in
the app at 183 kB first load JS) and `BuilderShell.tsx`'s imports.

**Fix**: `ConflictDialog`, `PhiOverrideDialog`, and `SubmitDialog` (`BuilderDialogs.tsx`) are now
loaded via `next/dynamic` with `ssr: false` instead of a static import. None of the three is ever
the first thing a request renders — they only appear after a client-side state change post-mount
(a save conflict, a PHI stop, or a Submit click) — so deferring their code is free. `/note/[id]`
dropped from 183 kB → 181 kB first load JS. Modest, but it is the single busiest page in the app
and the change carries zero behavioral risk (verified: dialogs still open with no visible delay,
no console errors, `npm test` and `tsc --noEmit` still clean).

## What was found and deliberately left alone

**The findings list repeats the `S1 REQUIRED` severity label once per row, and a brand-new empty
note legitimately has a dozen-plus required fields.** A first pass read this as "visual noise";
looking closer, it is not a bug — it is the poka-yoke design working as intended (every gap in a
comprehensive clinical note *should* be visible, not summarized away), and a note that size is the
worst case, not the typical case. Any change here touches how findings are grouped or labeled,
which lands inside `src/lib/audit/` — the one part of this codebase with an explicit, tested
invariant ("must never change what a note says") and a version-bump discipline
(`RULESET_VERSION`, adversarial tests). That is not something to freelance during a general UX
pass. If the practice reports this as a real friction point after use, the safe version of a fix
is UI-only and additive: group `AuditPanel`'s list by severity behind `<details>`-style sections
that **default open** (so nothing is hidden by default — Jidoka's visibility must survive the
change), with only the *count* per section collapsed into the summary line. That is a
`src/components/builder/AuditPanel.tsx` change, not an `src/lib/audit/` change, and should still
get its own adversarial look at a note with 20+ findings before shipping.

**The header nav wraps to two or three lines on a phone for higher-privilege roles** (Team Lead /
Hierarchy Manager / Developer accounts see up to 11 links). This is not an oversight —
`AppHeader.tsx` carries a comment describing the exact bug this wrapping avoids ("verified in a
real browser" that an unwrapped nav forced the layout viewport to 554px on a 375px device and
pushed dialogs partly off-screen). The wrap is the fix for a worse, previously-shipped bug, not the
bug itself. It is still real vertical real estate lost above the fold on the busiest screen in the
app for exactly the roles that also administer users and read the audit log. The recommended fix —
described in detail below rather than shipped — is a "More" disclosure that collapses the
lower-frequency admin links (Team, Users, Audit log, Requests, Wish list) behind one button below
`sm`, keeping Dashboard/Standardize/History/Store/Account always visible. Building a *correct*
accessible disclosure (focus management, outside-click, ESC, no layout jump) to the standard the
rest of this app holds itself to is real, careful work — the kind this codebase's own `Dialog`
component shows took real iteration to get right — so it is written up here as a scoped
recommendation with an implementation sketch rather than rushed into this pass:

- New `NavMore` client component: a button (`aria-expanded`, `aria-haspopup="menu"`) that opens a
  small popover (not the full-screen `Dialog` — a nav popover should not lock the page scroll or
  demand a dedicated title) anchored under it, closed on outside click, ESC, and `Tab`-out, with
  the same focus-visible ring the rest of the app uses.
- `AppHeader` passes the same five capability-gated links it does today, just split into "always
  visible" and "collapsed under 640px" arrays, so the *set* of links a role sees does not change —
  only where they render.
- Test the two states a hostile reviewer would try first: a Team Member (fewest links — does the
  button appear at all when it has nothing to hide?) and a Developer (most links — does the
  popover itself avoid the exact off-screen-on-a-phone bug the comment above describes?).

## Performance: what the numbers actually say

| Page | First Load JS (prod build) | Note |
| --- | --- | --- |
| Shared baseline (every page) | 103 kB | next-auth/jose client runtime; unavoidable with JWT sessions |
| `/note/[id]` (heaviest) | 181 kB (was 183 kB) | Rich client form-builder; the two fixes above are the only two levers pulled |
| `/standardize` | 145 kB | Second-heaviest; same shape of app, not reviewed line-by-line this pass |
| Everything else | 103–113 kB | Server components with tiny client islands |
| Edge middleware | 86.6 kB | NextAuth + jose; already trimmed to an edge-safe config with no db/bcrypt import |

None of this is large by Next.js standards, and the architecture already forecloses the two biggest
performance foot-guns a project like this usually has: there is no third-party script, font, or
analytics call at all (the CSP's `connect-src 'self'` and `img-src` rules make this a *policy*, not
an accident — see `next.config.mjs`), and every image in `public/` is a hand-authored SVG under 8 KB
already served `loading="lazy"` with explicit dimensions (no layout shift, nothing for `next/image`
to earn its keep optimizing). **The actual latency budget for this app is dominated by the database
round trip on every request**, not by JS weight — and that round trip is itself deliberate:
`freshSessionUser()` re-reads the caller's role and active state from Postgres on every single page
load, on purpose, so a demoted or deactivated account loses access on its very next click rather
than when a 30-day JWT expires. That is a security property worth the DB read; do not "fix" it by
caching it, and do not read the fact that every route in the build output is `ƒ` (dynamic) as an
oversight — the layout's `auth()` + `freshSessionUser()` calls make every page dynamic by
construction, and that construction is the point.

Where there is real headroom without touching that guarantee: it is already deduped to one primary
-key read per request via `React.cache` (`src/lib/auth/freshUser.ts`), so the next lever, if the
DB round trip is ever measured as the actual bottleneck in production, is **streaming** — wrapping
the dashboard's slower, lower-priority sections (the gamify stats query, the word map) in
`<Suspense>` so the fast, load-bearing content (quick picks, "continue where you left off," the
draft list) paints the instant its own query resolves instead of waiting on all of them together.
This was not implemented in this pass: it changes the dashboard's loading-state shape (skeletons,
suspense boundaries) and deserves its own look at what a slow gamify query actually looks like on
screen, rather than being bolted on speculatively.

## "Promote use": what actually helps, and what would fight the app's own design

Two asks in the original request pull in different directions once the app is understood as an
internal tool rather than a storefront, and it is worth saying which is which:

- **Genuinely useful, near-zero cost, not yet done**: a bare PWA manifest (`src/app/manifest.ts` in
  the App Router) plus a couple of icon sizes, so a front-desk or chairside device can "Add to Home
  Screen" and open straight to the dashboard instead of a browser tab with an address bar. No
  service worker, no offline caching — this is a legal-record tool with a hard live-session
  requirement, and promising offline capability it cannot safely honor would be worse than not
  having it. A manifest with `display: "standalone"` costs nothing and needs nothing beyond what
  `public/brand/` already has.
- **Would actively fight the app's own stated design if added**: any third-party analytics or
  session-replay tool (Vercel Analytics/Speed Insights included) to measure "promotion" or usage —
  the CSP's `connect-src 'self'` is not an oversight to route around, it is the app's answer to "no
  third-party requests at all," stated plainly in `next.config.mjs`'s own comments, and the whole
  gamification layer already goes out of its way to promise staff their numbers are private
  (`GamifyPanel.tsx`: "these numbers are yours alone"). If the practice wants adoption metrics, the
  same-origin path already half-exists: `src/lib/db/repo/auditLog.ts` logs named actions today, and
  a same-origin, no-PHI, staff-visible-if-they-ask usage count would be consistent with everything
  else this app already promises about who can see what.

## Priority order for future work (technical scope, not calendar time)

1. Ship the "More" mobile-nav disclosure described above — the only remaining UI friction found in
   this pass with a real, live-observed cost (vertical space on the busiest screen, for the roles
   doing the most on the smallest likely device).
2. Add the bare PWA manifest + icons for home-screen install.
3. If a real note is ever observed with enough findings that the flat list becomes hard to scan,
   revisit the severity-grouped `AuditPanel` UI sketch above — UI layer only, defaulted open, no
   `src/lib/audit/` change.
4. Consider Suspense/streaming for the dashboard's gamify/word-map sections, but only once there is
   a real measurement (not a guess) that the combined query time is worth the added loading-state
   complexity.
5. Everything in `knowledge/artifact/cornerstone-dental-arts.md` §9 outranks all of the above — the
   draft-title de-identification gap and the remaining hostile-review findings are correctness and
   safety work, and this review's scope (visual/UX/performance polish) should not be mistaken for
   a substitute for that list.
