# Tennessee dental authority map

How the authorities that bind a licensed dental professional in Tennessee relate.
Rendered in-app at `/reference/tennessee-law`; source data in `src/lib/law/tn-law.ts`.

```mermaid
flowchart TD
  GA["Tennessee General Assembly"] -->|enacts| TCA["Tennessee Code Annotated"]
  GA -->|enacts session law| PC1107["Public Ch. 1107 (2026)<br/>hygienist supervision of new patients<br/>effective 1/1/2027"]

  TCA --> T63["Title 63, Ch. 5<br/>Dental Practice Act"]
  TCA --> T632101["§ 63-2-101<br/>records within 10 working days"]
  TCA --> T631176["§ 63-1-176<br/>minors' consent"]
  TCA --> T5310310["§ 53-10-310<br/>CSMD check before opioids"]

  T63 -->|creates & delegates rulemaking| BOARD["TN Board of Dentistry"]
  PC1107 -.->|amends supervision baseline| R046003

  BOARD --> R046001["Rules 0460-01<br/>general"]
  BOARD --> R046002["Rules 0460-02<br/>dentists"]
  BOARD --> R046003["Rules 0460-03<br/>hygienists"]
  BOARD --> R046004["Rules 0460-04<br/>assistants"]

  R046002 --> R12["0460-02-.12<br/>records: minimum content,<br/>7-year retention, addendum-only correction"]
  R046002 --> R07["0460-02-.07<br/>anesthesia & sedation"]
  DOH["TN Dept. of Health<br/>Standards of Practice Manual"] -.->|extends retention for minors<br/>(longer of majority+1 or 10 years)| R12

  subgraph OVERLAYS["Simultaneous overlays on every licensee"]
    HIPAA["HIPAA Privacy & Security<br/>(2026 Security Rule updates)"]
    OSHA["OSHA bloodborne pathogens<br/>29 CFR 1910.1030"]
    DEA["DEA controlled substances<br/>21 CFR 1301"]
    ADA["ADA Principles of Ethics &<br/>Code of Professional Conduct"]
    JC["Joint Commission<br/>Do-Not-Use list"]
    ISMP["ISMP error-prone<br/>abbreviations"]
    CDC["CDC dental<br/>infection control"]
  end

  LICENSEE(("Every licensed dental<br/>professional in Tennessee"))

  T63 ==>|binds| LICENSEE
  R046001 ==> LICENSEE
  R046002 ==> LICENSEE
  R046003 ==> LICENSEE
  R046004 ==> LICENSEE
  T632101 ==> LICENSEE
  T631176 ==> LICENSEE
  T5310310 ==> LICENSEE
  HIPAA ==> LICENSEE
  OSHA ==> LICENSEE
  DEA ==> LICENSEE
  ADA -.->|professional ethics| LICENSEE
  JC -.->|safety standard| LICENSEE
  ISMP -.->|safety standard| LICENSEE
  CDC -.->|safety standard| LICENSEE

  LICENSEE -->|documents in| RECORD["The patient record"]
  RECORD -->|read against ALL of the above by| ENF["Board discipline &<br/>civil litigation"]
  ENF -.->|cites| R046002
  ENF -.->|cites| T63
```

Solid arrows: creation, delegation, or binding force. Dashed arrows: overlay,
amendment, or citation-in-enforcement. The record is where every authority
meets: Board discipline cites the rules, the rules cite the Act, and civil
litigation reads the note against all of it at once.
