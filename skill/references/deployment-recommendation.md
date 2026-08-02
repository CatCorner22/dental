# Deployment recommendation

## Use ChatGPT first

Use a private ChatGPT Project and the installed Skill for standards development and a synthetic or practice-approved de-identified pilot. This is the fastest way to freeze the templates, terminology, audit rules, training, and regression examples.

Use a practice-controlled workspace and project-only memory. Add only public references, generic templates, and approved de-identified content. Keep all identifiers, exact dates, patient images, radiographs, EDR text, signatures, and record links out.

## Use Vercel second

Move to a Vercel proof of concept only when the practice needs a point-and-click wizard, hard required-field gates, browser-side prohibited-data screening, centrally released rule versions, application roles, or nonclinical rule metrics.

Vercel does not inherently improve privacy. A hosted app adds code, authentication, logging, maintenance, incident-response, processor, and cost surfaces.

Recommended later flow:

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
- approved OpenAI endpoint and retention controls
- no prompt or response body logging
- rule-versioned regression tests and rollback
- legal, compliance, privacy, security, and professional-liability review

If the practice later proposes processing PHI, stop the rollout and reassess every processor, subprocessor, endpoint, log, storage location, retention period, BAA, access control, policy, and incident workflow. A BAA alone does not make the application compliant.

Official product sources:

- [OpenAI Projects in ChatGPT](https://help.openai.com/en/articles/10169521-projects-in-chatgpt)
- [OpenAI business data privacy](https://openai.com/business-data/)
- [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data)
- [OpenAI Build Skills](https://learn.chatgpt.com/docs/build-skills)
- [Vercel shared responsibility](https://vercel.com/docs/security/shared-responsibility)
- [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection)
- [Vercel runtime logs](https://vercel.com/docs/logs/runtime)
- [Vercel security and compliance](https://vercel.com/docs/security/compliance)

