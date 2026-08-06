# Stability & scalability deep dive (Vercel + Neon)

Ingested: 2026-08-06. Tags: reliability, serverless, postgres, neon, vercel, ai, autosave, digest.

## Scope

Second pass after draft-autosave and go-live UX work. Evidence from code paths that decide whether a cold start, chairside autosave storm, or AI provider hang takes the practice offline or silently loses data.

## What already scales

- Deferred audit (`useDeferredValue`) keeps typing responsive while rules re-run.
- OCC draft PATCH + flush-before-submit + claim-for-submit close double-file races.
- API guards re-read role/active from the DB (JWT watermark), not trust the cookie alone.
- Draft/history list APIs page via `parsePageParams`.

## Findings → actions shipped this pass

| Priority | Finding | Harm | Fix |
|---|---|---|---|
| Critical | Production could boot on PGlite under `/tmp` without `POSTGRES_URL` | Cold start wipes users/drafts/filings while the UI looks healthy | `resolveDbBackend` rejects production without `POSTGRES_URL` |
| Critical | Default `pg.Pool` max per isolate is unbounded | Connection storms against Neon under many concurrent isolates | `postgresPoolOptions` default `max: 1`, idle/connect timeouts, `PG_POOL_MAX` ceiling |
| High | Every cold start re-ran ~55 idempotent DDL statements | Latency + connection burn on login / SuperByte auto-observe after idle | `schema_boot` + `SCHEMA_BOOT_VERSION`; `ensureSchema` skips when current |
| High | `/api/bytestar` had no `maxDuration` / provider abort; meter before PHI | Hung providers pin concurrency; PHI-blocked drafts burn quota | Mirror assist: `maxDuration=30`, `AbortSignal.timeout(20s)`, PHI+escape before meter |
| High | Digest loaded up to 2000 full notes + audit JSON | Memory spike on Team Lead digest | Default/cap 500 + truncated notice |
| High | Missing `(action, at)` index on `audit_log` | Assist/SuperByte/digest prefix scans degrade as AI log grows | `audit_log_action_at_idx` |
| Moderate | Draft OCC update + revision prune not one transaction | Crash/multi-tab left recovery ring inconsistent | `updateDraftChecked` wraps update+insert+prune in `db.transaction` |
| Moderate | SuperByte GET failure mapped to “Pioneer dark” | Outage looks like intentional feature-off | `unreachable` deploy status + honest copy |
| Moderate | `countWishes` loaded every row into JS | Unnecessary memory as the wish list grows | `count(*)` |

## Now / Next / Later / Watch

### Now (this PR)

Shipped as above. `.env.example` documents required `POSTGRES_URL` in production and `PG_POOL_MAX`.

### Next

- Submit-config / gamify silent catches: surface “couldn’t reach server” instead of “email off” / award miss.
- Bound `listRedemptions`; explicit JWT `maxAge` (product choice: chairside shift length vs 30-day Auth.js default).
- Digest: optional split query (markdown-only metrics vs audit counts) if practices routinely exceed 500 filings / 30 days.

### Later

- Practice-pack CAS transitions (workflow branch) — not on main at ingest time.
- Neon serverless / WebSocket driver (optional once pool max=1 is proven).
- Token-based AI metering; shared abort plumbing on `GenerateListFn` types.
- MFA default-on once a second Developer + reset email are reliable.

### Watch

- Neon connection errors after deploy with many simultaneous cold starts (pool max=1 should help; confirm pooled host in `POSTGRES_URL`).
- SuperByte `BYTESTAR_READS` > 1 sharing one 20s abort — total pioneer wall clock capped; quiet observations under load are expected.
- `SCHEMA_BOOT_VERSION` discipline: every new DDL statement must bump the constant or existing DBs skip the change.

## Non-goals

- Inventing hygienist Transfer without a policy decision (Lead+ only remains).
- Rewriting frozen historical submissions.
- Changing transformer meaning rules (`RULESET_VERSION` untouched).
