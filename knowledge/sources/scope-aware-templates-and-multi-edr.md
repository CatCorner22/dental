# License-scope templates and multi-EDR scalability

Tags: tennessee, license-scope, templates, bytestar, byte, audit, edr, pms, curve-hero.
Ingested: 2026-08-05.

## Problem

SuperByte, Byte, and the audit helper were role-blind while TN license charts
already stated who may diagnose and plan. Quick picks offered the same scaffolds
to every writer. Curve Hero was hard-coded in handoff UX, blocking clean deploys
beside other charting systems.

## Design (smallest coherent change)

1. **Author capabilities** (`src/lib/scope/authorCapabilities.ts`) — maps
   `ClinicalRole` → license level, SuperByte lens, featured pick ids, module rail
   visibility. Enforcement stays in `clinicalRoles` / `approval`; this file is
   templates + coaching only.

2. **Scope-aware Quick picks** — hygienist prophylaxis / periodontal, assistant
   chairside, dentist exam scaffolds with `authorRoles` filters.

3. **Tailored audit** — `tailorAuditFindings` suppresses dentist-owned
   `required.missing` and judgement completeness coaching for auxiliaries when
   Assessment/Plan are empty; emits `scope.author-handoff` (S3). Filing authority
   remains the hard stop.

4. **Byte `authorScope`** — knowledge entries may target dentist / hygienist /
   assistant / auxiliary; safety tips stay `any`.

5. **SuperByte AUTHOR LICENSE lens** — server injects the signed-in role’s
   capability text; prompt v1.6.0; EDR-ready wording replaces Curve-only language.

6. **EDR product seam** (`src/lib/edr/product.ts`) — `EDR_PRODUCT_NAME` /
   `NEXT_PUBLIC_EDR_PRODUCT_NAME` configure handoff copy. No PMS sync API — the
   body pipeline stays de-identified; only the product name in UI/prompts changes.

## Non-goals

- Splitting `assistant` into RDA vs practical DA on the account (charts already
  distinguish them; enforcement still uses the collapsed role).
- Bidirectional PMS integration or write-back.
- Weakening standardize’s meaning-preservation contract.
