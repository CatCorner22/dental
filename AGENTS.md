# Agent notes

## Cursor Cloud specific instructions

Smile Notes is a **single Next.js 15 app** (no monorepo, no Docker services required for local/dev). See `README.md` → **Run it** for the standard install/dev/test/build commands.

### Local runtime (non-obvious)

- **Database:** leave `POSTGRES_URL` unset. The app uses in-process PGlite under `.data/` (configurable via `PGLITE_DIR`). Do not point a cloud agent at production Postgres.
- **Auth:** `.env.local` must include `AUTH_SECRET` (see `.env.example`). First boot with an empty users table: open `/setup` to create the Developer account, or set `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
- **Optional features stay off by default:** email (`RESEND_*` / `CORPORATE_EMAIL`), AI assist (`ASSIST_ENABLED` + `AI_GATEWAY_API_KEY`), MFA (`MFA_ENABLED=1`). The builder, audit, save, and submit paths work without them; submissions file tickets even when email is unset.
- **No ESLint script.** The quality gate matching CI is `npx tsc --noEmit`, then `npm test`, then `npm run build` (with `AUTH_SECRET` set). Component tests opt into jsdom per file; default vitest env is `node`.
- **Playwright / cross-browser smoke** (`e2e/crossbrowser.smoke.mjs`) is CI-only: Playwright is installed with `npm i --no-save` in the workflow, not as a project dependency. Do not add it to the update script.
- **Dev server:** `npm run dev` → `http://localhost:3000`. After `/setup` + legal-record acknowledgment, home is the note builder (draft auto-created).

### Transformer / verification discipline

Workspace rule `.cursor/rules/transformer-development.mdc` is in force for changes under `src/lib/standardize/`, `vocab/`, `audit/`, and `assist/`. Prefer that rule over restating it here.
