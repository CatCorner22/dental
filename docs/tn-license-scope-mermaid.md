# Tennessee dental license scope — Mermaid sources

Training charts rendered in-app at `/reference/tennessee-law` (License scope section).
Typed source of truth: `src/lib/law/license-scope.ts`.

**Not legal advice.** Verify Tenn. Code Ann. § 63-5-108 and Tenn. Comp. R. & Regs. 0460
before relying on any item.

## Hierarchy

```mermaid
flowchart TD
  DDS["Licensed dentist<br/>TCA § 63-5-108(a)–(b)<br/>Rules 0460-02"]
  RDH["Licensed dental hygienist<br/>TCA § 63-5-108(c)<br/>Rules 0460-03"]
  RDA["Registered dental assistant<br/>0460-01-.01(26)<br/>Rules 0460-04"]
  PDA["Practical dental assistant<br/>0460-01-.01(23)<br/>Rules 0460-04"]

  DDS -->|"employs / supervises<br/>TCA § 63-5-108(d)"| RDH
  DDS -->|"direct supervision<br/>+ full responsibility"| RDA
  DDS -->|"direct supervision<br/>+ full responsibility"| PDA

  RDH -.->|"may NOT practice<br/>independent of dentist<br/>TCA § 63-5-108(c)(3)"| STOP["No independent<br/>hygiene office"]
```

## Supervision

```mermaid
flowchart LR
  subgraph DIRECT["DIRECT supervision — dentist present / responsible"]
    D1["RDH: root planing, subgingival curettage,<br/>N2O, local anesthesia<br/>TCA § 63-5-108(c)(4)"]
    D2["RDH local anesthesia: dentist<br/>physically at same office<br/>0460-03-.09(5) / .12"]
    D3["RDA / practical DA: all intraoral<br/>assisting under direct supervision<br/>0460-01-.01(23),(26); 0460-04-.08"]
  end

  subgraph GENERAL["GENERAL supervision — RDH only, statutory conditions"]
    G1["Other hygiene services ≤15 consecutive<br/>business days if TCA § 63-5-108(c)(5)<br/>conditions all met"]
    G2["Dentist examined patient ≤11 months prior;<br/>written Tx plan; emergency protocols;<br/>patient notice; ≥1 yr FTE experience"]
  end

  subgraph PC1107["NEW — Pub. Ch. 1107, eff. 1/1/2027"]
    P1["New patient: RDH needs DIRECT supervision<br/>by a dentist who has seen the patient<br/>before Dx radiographs, hard/soft-tissue<br/>data, prophylaxis, or fluoride"]
  end
```

## Reserved acts and certification gates

```mermaid
flowchart TD
  ONLYDDS["DENTIST ONLY — professional judgment<br/>TCA § 63-5-108(d)"]
  ONLYDDS --> A["Diagnosis and treatment planning"]
  ONLYDDS --> B["Oral surgery / cutting hard or soft tissue<br/>except RDH curettage / root planing"]
  ONLYDDS --> C["Interpret dental radiographs<br/>TCA § 63-5-108(b)(11)"]
  ONLYDDS --> D["Permanent restorations unless Board-certified<br/>auxiliary pathway applies"]
  ONLYDDS --> E["General / conscious sedation — permit rules"]

  ONLYRDH["HYGIENIST ONLY among auxiliaries"]
  ONLYRDH --> F["Scaling / curettage of deposits<br/>TCA § 63-5-108(d)"]

  CERT["CERTIFICATION GATES"]
  CERT --> G["RDH: local anesthesia .12 · N2O .06 · restorative/prosthetic .10"]
  CERT --> H["RDA: polish .04 · N2O monitor .05 · sealants .09 · radiographs .11 · expanded .10"]
```
