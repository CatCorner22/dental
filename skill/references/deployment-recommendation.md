# Deployment recommendation

## The web app is the only runtime

Smile Notes runs as a practice-controlled web application. All standards development —
templates, terminology, audit rules, training, and regression examples — lives in this
repository, versioned and enforced in code. There is no companion chat assistant, no
external skill package, and no second runtime: chat instructions cannot enforce anything,
and every rule here is enforced by the deterministic engine with tests.

A hosted app adds code, authentication, logging, maintenance, incident-response,
processor, and cost surfaces. Hosting does not inherently improve privacy — the controls
below are what do.

Deployment flow:

```text
Structured browser form
  -> local prohibited-data gate
  -> deterministic clinical audit
  -> optional allowlisted de-identified AI request
  -> deterministic output audit
  -> clinician review
  -> manual EDR transfer
```

Required controls include:

- no patient-identity fields
- browser-side prohibited-data gate before transmission
- no raw-note upload followed by attempted de-identification
- no note content in storage, logs, analytics, replay, traces, URLs, errors, or support tickets
- server-side allowlist validation
- app authentication, multifactor authentication, least privilege, and protected previews
- approved AI-gateway endpoint and retention controls (only when the optional assist layer is enabled)
- no prompt or response body logging
- rule-versioned regression tests and rollback
- legal, compliance, privacy, security, and professional-liability review

If the practice later proposes processing PHI, stop the rollout and reassess every
processor, subprocessor, endpoint, log, storage location, retention period, BAA, access
control, policy, and incident workflow. A BAA alone does not make the application
compliant.

Official product sources:

- [Vercel shared responsibility](https://vercel.com/docs/security/shared-responsibility)
- [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection)
- [Vercel runtime logs](https://vercel.com/docs/logs/runtime)
- [Vercel security and compliance](https://vercel.com/docs/security/compliance)
