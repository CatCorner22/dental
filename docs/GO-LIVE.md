# Go-live runbook

The ordered path from an empty Vercel project to clinicians writing real notes,
with the checks that prove each step actually worked. Follow it top to bottom;
nothing here is optional except where it says so.

The README explains what each environment variable does. This document is
narrower on purpose: what to do, in what order, and how to know it worked.

---

## Before you start

Have these ready:

- A **Postgres database** — Neon or Vercel Postgres. Copy the **pooled**
  connection string, not the direct endpoint. Serverless opens a pool per
  instance, and a direct endpoint runs out of connections as traffic grows.
- A long random **`AUTH_SECRET`** (`openssl rand -base64 32`).
- A decision on **email** (below) and on **AI** (below). Both can wait; the app
  files notes without either.

---

## 1. Database first, and prove it

Set on the Vercel project, Production environment only:

```
POSTGRES_URL=postgresql://…      # the POOLED string
PG_POOL_MAX=5
AUTH_SECRET=…
```

`PG_POOL_MAX` matters more than it looks. The default is **1 connection per
instance**, chosen when each isolate served one request at a time. Vercel's
Fluid Compute (on by default for new projects) serves many concurrent requests
per instance, so a default pool serializes a busy morning behind one connection
and starts timing out at ten seconds. Five is a reasonable start.

**Do not set `PGLITE_DIR`.** Production refuses every value of it, including
`memory://`, and that refusal is deliberate: an in-memory database looks
completely healthy — logins work, notes save, history renders — right up until
the instance recycles and every clinical record is gone. If you are copying
environment variables from a working local setup, this is the line to delete.

**Prove the database before anyone uses it.** From a checkout:

```sh
POSTGRES_URL='postgresql://…' scripts/postgres-durability.sh
```

It boots the app in production mode, files a real note, restarts the server,
and verifies the account, the submission, the frozen filename, the open draft,
and the audit rows all survive and are still readable *through the app*. It
prints `Production database durability: verified.` or it tells you what broke.
Run it against the real connection string, not a copy.

## 2. First admin

Deploy, then open **`/setup`** and create the first admin account in the
browser. The page closes itself permanently once an account exists.

Prefer this over `ADMIN_USERNAME`/`ADMIN_PASSWORD`. Those seed an admin at boot
and then sit in the project's environment forever, a bootstrap password in
plaintext that nothing in the code will ever notice or rotate.

**Never set `ADMIN_PASSWORD_RESET=1` on a live deployment.** It rewrites the
admin password and clears MFA on *every cold start* while it is set, which on
serverless is many times a day.

## 3. Turn on two-factor

1. Create a **second admin account** first. MFA with one Developer and one lost
   authenticator is a locked-out practice.
2. Set `MFA_ENABLED=1`.
3. Enroll both admins from **Account → Set up two-factor authentication**.

## 4. Email (optional, but it is how notes leave)

```
RESEND_API_KEY=…
EMAIL_FROM=Smile Notes <notes@yourdomain>
CORPORATE_EMAIL=records@yourpractice        # inside your HIPAA boundary
```

All three or none — two of three silently disables sending. Without them notes
still file and appear in History with a ticket; they are simply not emailed,
and the audit log says so ("Note submitted (email off)").

The emailed attachment carries the **frozen note**. Resend therefore processes
clinical content: get a **BAA in place before real patient records flow**.

Verify with one real filing: file a note, confirm it arrives at the corporate
inbox with two attachments (the note and its audit report), and confirm the
audit log row reads "Note submitted" rather than "(email failed)".

## 5. AI (optional, off by default)

```
ASSIST_ENABLED=1
AI_GATEWAY_API_KEY=…
```

Note text goes to the configured provider after the PHI gate. **Get a BAA in
place first.**

One asymmetry to know about: **SuperByte turns on from `AI_GATEWAY_API_KEY`
alone**, without `ASSIST_ENABLED`. That is deliberate in the code, but it means
adding a gateway key to try assist also enables a feature that sends draft text
to the provider. Until you have decided, set:

```
BYTESTAR_ENABLED=0
```

## 6. Practice identity

```
PRACTICE_NAME=Your Practice Name
```

The office list seeds from `src/lib/practice/config.ts` on first boot, and it
ships with real addresses for a specific Knoxville practice. Edit that file
before first boot, or correct the offices in the admin afterwards — the seed
only runs while the table is empty.

Optional, if you use something other than Curve Hero:
`EDR_PRODUCT_NAME`, `EDR_PRODUCT_SHORT`, and their `NEXT_PUBLIC_` twins.

## 7. Feedback address

```
NEXT_PUBLIC_FEEDBACK_EMAIL=support@yourpractice
```

Optional and **unset by default on purpose**: staff replying about a note carry
clinical context, so that mail must land inside your boundary. With it unset,
the footer link and the first-run reminder simply do not appear.

This is inlined at build time — changing it requires a redeploy, not a restart.

## 8. Weekly legal watch (optional)

Set `CRON_SECRET` to a long random string. `vercel.json` calls
`/api/law-watch/alert` Mondays at 13:00 UTC; with email configured it mails the
sweep. Without the secret the endpoint refuses everyone, which is the intended
closed default.

## 9. Lock the doors

- **Vercel Deployment Protection** on, so only the team can reach the app.
- **Scope `POSTGRES_URL` to Production only.** A Preview deployment inheriting
  it would write real clinical rows from an unreviewed branch.
- Confirm the corporate inbox is inside the practice's HIPAA boundary.

---

## Post-deploy verification

Against the live deployment, signed in as the new admin:

1. **Write and file one real note.** It should reach the corporate inbox with
   both attachments and appear in History with a ticket.
2. **Try to file a note containing a phone number.** Submit must block with the
   privacy stop, Mask must replace it with an opaque token, and the note must
   then file.
3. **Check `/admin/audit`.** The filing, the sign-in, and the account creation
   should all be there.
4. **Sign in wrong five times on purpose.** The sixth attempt should be refused
   even with the right password, and the lock should lapse.

Then, from a checkout, against a **staging** database (never production):

```sh
npm ci && npm run build
scripts/stability-battery.sh          # 14 probes, each on a fresh server
```

Pass a repeat count (`scripts/stability-battery.sh 3`) to hunt flakes before a
release. A probe that passes once and fails on an identical second run is
either an unreliable app or an unreliable test, and both matter more once
clinicians depend on it.

---

## If something is wrong

- **Every page 500s** → `POSTGRES_URL` is missing or unreachable. The Vercel
  logs carry the real message; the browser deliberately shows a generic one.
- **Records disappear after a while** → the deployment is on an ephemeral
  database. Check that `PGLITE_DIR` and `ALLOW_EPHEMERAL_DB` are *unset* and
  `POSTGRES_URL` is set. `ALLOW_EPHEMERAL_DB` exists only for test harnesses.
- **Requests time out under load** → raise `PG_POOL_MAX` and confirm you are on
  the pooled connection string.
- **Notes file but never arrive** → one of the three email variables is
  missing. The audit log distinguishes "(email off)" from "(email failed)"; a
  filed note is never lost either way, and Resend can be retried from the note.
