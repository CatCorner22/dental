# Dental Note Standards and Templates

Operational draft current through August 1, 2026.

## Use

- Use only blank templates or de-identified facts.
- Keep names, exact dates, contact data, record numbers, signatures, and image files out of AI input.
- Let the clinician select the diagnosis, procedure, medication, dose, monitoring plan, and discharge decision.
- Resolve every placeholder in the EDR. A blank never means normal.
- Run the formal audit after every draft or normalization. Do not finalize with an open STOP or REQUIRED finding.
- Apply current federal law, Tennessee law and rules when relevant, payer rules, facility policy, and manufacturer instructions.
- Require licensed-clinician review and signature.

## Coverage

The modular set covers examinations, emergencies, imaging, prevention, restorative dentistry, endodontics, periodontics, prosthodontics, implants, orthodontics, pediatrics, oral medicine, surgery, trauma, pathology, grafting, prescriptions, teledentistry, nitrous oxide, IV moderate sedation, deep sedation, and general anesthesia. Use the universal module for a new or uncommon procedure.

## Guided staff process

1. Choose Blank template, Guided draft, Normalize wording, or Audit only.
2. Confirm that the input is synthetic or approved under the practice's de-identification process.
3. Select the national, Tennessee, facility, specialty, pediatric, or anesthesia profile.
4. Confirm the encounter, exact care status, each procedure-site pair, and every triggered module.
5. Enter only clinician-supplied, de-identified facts. Use not assessed, unknown, not applicable, or unresolved when accurate.
6. Build the Universal Core and confirmed procedure modules.
7. Run the formal audit.
8. Resolve STOP, REQUIRED, and REVIEW findings in that order.
9. Rerun the audit.
10. Transfer the draft to the correct EDR chart. Add exact dates, times, identities, links, codes, and signatures only there.
11. Have the clinician compare every fact with the source and sign.
12. Add later facts only through the authorized correction, late-entry, or addendum process.

The audit must not return a percentage or claim that a note is complete or compliant.

## De-identified dental note templates

Complete patient identity, exact dates, signatures, legal authority, contact details, and record links only in the clinical system. Replace every angle-bracket field or mark it not assessed, not applicable, unknown, or unresolved. Do not send patient text or images to AI.

### Module router

| Visit or procedure | Use |
|---|---|
| Any encounter | Universal Core |
| Comprehensive, periodic, limited, consultation, recall | Examination Add-On |
| Pain, swelling, trauma, urgent or palliative care | Emergency Add-On |
| Any image acquired, received, or interpreted | Imaging Add-On |
| Prophylaxis, fluoride, sealant, caries-arrest material | Preventive Add-On |
| Direct restoration, core, buildup, temporary restoration | Direct Restorative Add-On |
| Crown, veneer, inlay, onlay, bridge, provisional | Fixed Prosthodontic Add-On |
| Denture, partial denture, reline, rebase, repair | Removable Prosthodontic Add-On |
| Root-canal or pulp procedure | Endodontic Add-On |
| Periodontal evaluation, debridement, scaling, maintenance, surgery | Periodontal Add-On |
| Implant placement, uncovering, restoration, maintenance, removal | Implant Add-On |
| Extraction, biopsy, graft, trauma, orthognathic, TMJ or other surgery | Operative Add-On plus named procedure add-on |
| Oral, IV, intranasal, intramuscular sedation; deep sedation; general anesthesia | Sedation and Anesthesia Add-On plus time-oriented record |
| Nitrous oxide and oxygen only | Nitrous Oxide Add-On |
| Pediatric or special-needs care | Pediatric and Behavior Add-On |
| Braces, aligners, retainers, appliances | Orthodontic Add-On |
| Mucosal lesion, salivary, TMD, sleep, cancer screening | Oral Medicine Add-On |
| Remote encounter | Teledentistry Add-On |
| Postoperative call or other clinical communication | Communication and Follow-Up Add-On |
| Pathology or laboratory result review | Pathology Result Add-On |
| Refused, deferred, stopped, or incomplete care | Refusal and Incomplete Care Add-On |
| Late information or correction to a signed entry | Late Entry, Correction, or Addendum Add-On in the EDR only |
| Unlisted procedure | Universal Procedure Add-On |

### Universal Core

#### Visit

- Encounter type: <value>
- Visit purpose: <patient-reported words, de-identified>
- Interval events: <patient report, external record, or none reported>
- Source and reliability limits: <value>

#### Medical and dental review

- History reviewed in the clinical system: <yes/no>
- Changes reported: <de-identified fact or none reported>
- Allergies and reactions reviewed: <yes/no; facts remain in EDR>
- Current medications reviewed: <yes/no; facts remain in EDR>
- Relevant conditions, surgeries, pregnancy, substance use, and prior anesthesia events: <de-identified clinical facts>
- Relevant dental history and risk factors: <facts>
- Consultation or clearance status: <fact>

#### Subjective

- Site: <region/tooth/surface>
- Symptom: <value>
- Onset and course: <relative duration, not an identifying date>
- Severity and scale: <value>
- Quality: <value>
- Triggers and relief: <value>
- Associated symptoms: <value>
- Pertinent negatives reported: <value>
- Patient goal: <value>

#### Objective

- General observation: <specific finding>
- Extraoral examination: <specific structures and findings>
- Intraoral soft-tissue examination: <specific structures and findings>
- Dentition and hard-tissue examination: <tooth/site/surface and finding>
- Periodontal screening or examination: <method and findings>
- Occlusion and function: <finding>
- Tests: <name, site, method, result, control, limitation>
- Images: <modality and linked Imaging Add-On>
- Examination limits: <fact>

#### Assessment

- Clinician-supplied diagnosis: <exact term>
- Diagnosis status: <final/working/differential>
- Tooth, site, surface, extent, stage, grade, or severity: <when applicable>
- Supporting evidence: <fact>
- Unresolved evidence or differential: <fact>
- Prognosis and basis: <clinician-supplied fact>
- Current licensed diagnostic terminology or code: <optional; verify locally>

#### Plan and decision

- Recommended care and purpose: <fact>
- Expected benefit: <fact>
- Material risks: <fact>
- Alternatives: <fact>
- No-treatment option and likely consequence: <fact>
- Questions discussed: <fact>
- Patient decision: <accepted/declined/deferred/requested another option>
- Consent or refusal form status: <complete only in EDR>
- Planned sequence: <fact>

#### Care delivered

- Add-on modules used: <list>
- Procedure status: <started/completed/partly completed/stopped/deferred>
- Complication status: <specific event or no complication observed during stated period>
- Patient response: <objective observation and patient report>

#### Handoff

- Condition at end of visit: <specific findings>
- Instructions: <topic and delivery method>
- Return precautions: <exact trigger and action>
- Medication or prescription: <linked Medication Add-On>
- Follow-up interval and purpose: <value>
- Referral or communication: <role, reason, urgency, status>
- Author, reviewer, attestation, and signature: <complete only in EDR>

### Examination Add-On

- Examination type: <comprehensive/periodic/limited/consultation/postoperative>
- Caries-risk assessment: <method, clinician-supplied level, drivers>
- Periodontal classification: <clinician-supplied diagnosis, extent, stage, grade>
- Oral cancer and mucosal screening: <structures, findings, limits>
- Occlusal, orthodontic, prosthetic, endodontic, implant, TMD, airway, and esthetic findings: <only assessed domains>
- Existing conditions and treatment charted: <yes/no/limited>
- Diagnostic records selected: <facts>
- Problem list and priorities: <facts>
- Recall or reassessment basis: <risk and condition, not routine>

### Emergency Add-On

- Chief problem and urgency: <fact>
- Airway, breathing, circulation, fever, swelling, dysphagia, dyspnea, trismus, neurologic, and trauma screen: <specific findings or not assessed>
- Site and spread: <fact>
- Pain assessment: <scale, quality, course>
- Dental tests and controls: <fact>
- Images and interpretation: <fact>
- Clinician-supplied diagnosis or working diagnosis: <term>
- Definitive, palliative, or stabilization care: <exact procedure>
- Drainage, hemostasis, occlusion, splint, dressing, or temporary restoration: <fact>
- Prescription and medication: <linked add-on>
- Escalation, emergency referral, or return precautions: <exact criteria>
- Follow-up and definitive-care plan: <fact>

### Imaging Add-On

- Study status: <ordered/acquired/received/reviewed/interpreted/referred>
- Modality and exact view: <value>
- Count or series: <value>
- Patient-specific reason and selection facts: <value>
- Prior images reviewed or unavailable: <fact>
- Anatomy, side, arch, teeth, and field of view: <value>
- Acquisition source and protocol metadata: <value>
- Quality, artifacts, and diagnostic limits: <value>
- Comparison: <de-identified reference>
- Findings by structure: <clinician-supplied interpretation>
- Structure or field-of-view status: <assessed—finding/assessed—no abnormality observed/not in field/not assessable—reason>
- Impression: <clinician-supplied interpretation>
- Incidental finding and action: <value>
- Result communication and follow-up: <value>
- CBCT entire volume reviewed or referred: <yes/no/not applicable; role>

### Preventive Add-On

- Procedure: <prophylaxis/periodontal maintenance/fluoride/sealant/caries-arrest material/oral-hygiene instruction/other>
- Indication and risk drivers: <fact>
- Teeth and surfaces: <Universal designation and surface>
- Plaque, calculus, stain, gingival inflammation, bleeding, and deposits: <site and extent>
- Method and instruments: <fact>
- Product or material, concentration, amount, manufacturer, and lot: <if required; complete in EDR>
- Isolation and moisture control: <fact>
- Application or treatment steps: <clinician-supplied facts>
- SDF or other caries-arrest consent, expected discoloration, and site: <when applicable>
- Oral-hygiene teaching and teach-back: <fact>
- Response, adverse event, reassessment, and interval basis: <fact>

### Direct Restorative Add-On

- Tooth and surfaces: <designation/surfaces>
- Diagnosis and indication: <clinician-supplied term>
- Preoperative tests and image: <fact>
- Anesthesia: <linked Medication Add-On or none>
- Isolation: <dental dam/relative/other>
- Existing material or caries removed: <fact>
- Preparation and pulp protection: <fact>
- Material, shade, liner, base, adhesive, matrix, wedge, and curing: <exact supplied facts>
- Contacts, margins, contour, occlusion, and finish: <specific findings and adjustments>
- Postoperative image: <fact>
- Complication, response, instructions, and prognosis: <fact>

### Fixed Prosthodontic Add-On

- Therapeutic goal, risk, and prognosis: <clinician-supplied facts>
- Procedure stage: <evaluation/preparation/impression/scan/provisional/try-in/cementation/repair/removal>
- Tooth, abutment, pontic, or implant site: <value>
- Diagnosis and indication: <fact>
- Material and design: <fact>
- Reduction, margin design and location, core, post, and tissue management: <fact>
- Impression or optical scan, opposing arch, bite record, and quality: <fact>
- Shade and characterization: <fact>
- Provisional material, cement, contacts, margins, and occlusion: <fact>
- Laboratory prescription and due stage: <linked in EDR>
- Try-in evaluation: <fit, margins, contacts, occlusion, shade, patient decision>
- Final cement, isolation, cleanup, radiograph, and occlusion: <fact>
- Goal achieved, deviation and reason, maintenance, and interdisciplinary coordination: <facts>
- Complication, instructions, hygiene, and follow-up: <fact>

### Removable Prosthodontic Add-On

- Therapeutic goal, risk, and prognosis: <clinician-supplied facts>
- Appliance and stage: <complete denture/partial/overdenture/immediate/reline/rebase/repair/evaluation>
- Arch and design: <value>
- Diagnosis and indication: <fact>
- Existing appliance findings: <fit, retention, stability, support, occlusion, tissue>
- Impression, scan, border molding, jaw relation, vertical dimension, and facebow: <fact>
- Tooth mold, shade, arrangement, framework, base, and material: <fact>
- Try-in findings and patient decision: <fact>
- Delivery adjustments: <pressure areas, border, retention, stability, phonetics, esthetics, occlusion>
- Goal achieved, deviation and reason, maintenance, and interdisciplinary coordination: <facts>
- Identification mark and laboratory details: <if required; EDR only>
- Insertion, removal, hygiene, sleep, diet, sore-spot, and recall instructions: <fact>
- Complication and follow-up: <fact>

### Endodontic Add-On

- Tooth: <Universal designation>
- Clinician-supplied pulpal diagnosis: <term>
- Clinician-supplied apical diagnosis: <term>
- Symptoms, sensibility, percussion, palpation, bite, probing, mobility, and controls: <results>
- Preoperative image and restorability: <fact>
- Case risk and disposition: <patient, diagnostic, tooth, anatomy, prior-treatment, isolation, vital-structure proximity, capability, and referral facts when assessed>
- Treatment stage: <pulp therapy/root-canal initiation/working length/cleaning and shaping/obturation/retreatment/surgery/emergency>
- Anesthesia and isolation: <fact; dental dam status>
- Access and canals located or treated: <named canals>
- Working-length method and length for each canal: <value/unit>
- Instrumentation and apical preparation: <clinician-supplied facts>
- Irrigants: <name, concentration, amount, delivery, activation>
- Intracanal medicament: <name and placement>
- Obturation: <material, sealer, technique, length, density>
- Temporary or definitive coronal seal: <material>
- Procedural error, separation, ledge, transportation, perforation, extrusion, or other complication: <fact>
- Postoperative image, occlusion, restoration plan, prognosis, instructions, and referral: <fact>

### Periodontal Add-On

- Examination type: <screening/comprehensive/reassessment/maintenance>
- Probing depth, recession, clinical attachment level, bleeding, suppuration, mobility, furcation, plaque, calculus, mucogingival and implant findings: <site-specific chart linked in EDR>
- Proximal contacts, endodontic-periodontal lesions, restoration and prosthesis status, fremitus, and occlusal findings: <facts>
- Image and bone findings: <fact>
- Bone quality, quantity, pattern, and anatomic limitations: <clinician-supplied image or examination facts>
- Named systemic, behavioral, tobacco, glycemic, medication, genetic, and local risk factors: <facts>
- Clinician-supplied diagnosis: <gingival/periodontal/peri-implant term>
- Periodontitis extent, stage, and grade: <when diagnosed>
- Procedure: <debridement/scaling and root planing/maintenance/gingivectomy/flap/graft/regeneration/crown lengthening/other>
- Quadrant, sextant, teeth, surfaces, and sites: <value>
- Anesthesia, instruments, irrigation, medicament, laser settings, graft, membrane, biologic, and sutures: <only supplied facts>
- Tissue response, deposits removed, endpoint, complications, and hemostasis: <fact>
- Self-care instruction, risk-factor counseling, reevaluation, maintenance interval, and referral: <fact>

### Implant Add-On

- Stage: <evaluation/guided planning/placement/grafting/uncovering/impression/scan/provisional/final restoration/maintenance/repair/removal>
- Edentulous site and adjacent teeth: <value>
- Diagnosis and indication: <fact>
- Image and anatomical risk review: <fact>
- Guide and plan: <clinician-supplied facts>
- Implant or component manufacturer, system, dimensions, lot, and catalog: <EDR only>
- Osteotomy, irrigation, insertion torque, stability measure, depth, position, and angulation: <verified values>
- Cover screw or healing abutment: <fact>
- Graft, membrane, biologic, fixation, and closure: <fact>
- Restoration component, torque source and verified value, screw access, cement, contacts, and occlusion: <fact>
- Baseline probing and image: <when appropriate>
- Complication, neurosensory status, sinus or anatomical event, instructions, hygiene, and follow-up: <fact>

### Operative Add-On

- Exact operation: <name>
- Surgeon, assistants, anesthesia roles: <roles only in AI draft>
- Preoperative diagnosis and indication: <fact>
- Postoperative diagnosis: <clinician-supplied term>
- Site, side, arch, tooth, lesion, and procedure status: <fact>
- Consent and procedural pause: <status>
- Preparation, antisepsis, draping, and isolation: <fact>
- Incision, flap, exposure, dissection, bone removal, sectioning, debridement, irrigation, and technique: <only performed steps>
- Findings: <fact>
- Specimen, culture, pathology request, orientation, and chain status: <EDR only>
- Device, graft, implant, material, manufacturer, and lot: <EDR only>
- Drain, fixation, closure, suture, dressing, and pack: <fact>
- Estimated blood loss and method: <amount/unit>
- Counts when applicable: <status>
- Complication and management: <fact>
- Hemostasis: <method and observed status>
- Condition at transfer, instructions, prescription, referral, and follow-up: <fact>

### Extraction Add-On

- Tooth or root: <designation>
- Eruption or impaction status and classification: <clinician-supplied fact>
- Indication and image: <fact>
- Procedure: <simple/surgical/coronectomy/sectioning/root removal/other>
- Flap, bone removal, sectioning, elevation, delivery, socket inspection, curettage, irrigation, and smoothing: <performed steps>
- Root completeness and anatomical findings: <fact>
- Sinus, nerve, adjacent tooth, tuberosity, fracture, displacement, or other event: <fact>
- Socket preservation, medicament, membrane, or graft: <fact>
- Closure, suture, hemostasis, specimen, and postoperative image: <fact>
- Instructions, precautions, prescription, and follow-up: <fact>

### Biopsy, Lesion, and Infection Add-On

- Procedure: <incisional biopsy/excisional biopsy/aspiration/culture/incision and drainage/exposure/other>
- Lesion or infection site: <precise anatomy>
- Size in three dimensions, color, surface, border, consistency, mobility, symptoms, duration, and image findings: <facts>
- Differential or diagnosis: <clinician-supplied terms>
- Incision, tissue removed, drainage amount and character, irrigation, drain, closure, and hemostasis: <facts>
- Specimen container, fixative, orientation, test request, laboratory, and tracking: <EDR only>
- Pathology follow-up owner and due status: <role and workflow>
- Escalation and return precautions: <exact triggers>

### Bone Graft, Regeneration, and Sinus Add-On

- Procedure and site: <value>
- Defect type and measurements: <fact>
- Donor and recipient sites: <fact>
- Sinus membrane status and management: <fact>
- Graft, membrane, biologic, fixation, manufacturer, amount, and lot: <EDR only>
- Preparation, decortication, harvest, placement, containment, closure, and stability: <performed steps>
- Complication, hemostasis, image, instructions, and follow-up: <fact>

### Dentoalveolar Trauma Add-On

- Event mechanism, relative timing, witness role, and prior care: <de-identified facts>
- Loss of consciousness, altered mental status, headache, nausea, vomiting, neck pain, airway symptoms, nasal or ear bleeding, and other injury: <assessed findings or limits>
- Missing tooth or fragment location, transport medium, and dry time: <facts when triggered>
- Facial bones, cranial nerves, temporomandibular joints, wounds, foreign body, and soft-tissue sites: <findings>
- Preinjury and current occlusion; midline, interference, overbite, and overjet: <facts when relevant>
- Per-tooth infraction, fracture, pulp exposure, mobility, displacement direction and extent, percussion, color, probing, sensibility, caries, and restorations: <facts>
- Root development, root fracture, periodontal-ligament, alveolar, periapical, and foreign-body image findings: <clinician interpretation>
- All teeth, fragments, and appliance parts located: <yes/no/unknown with action>
- Clinician-supplied injury diagnosis: <term>
- Repositioning, replantation, splint type, teeth included, material, duration plan, sutures, and wound care: <fact>
- Photograph status, safeguarding concern, and medical or tetanus referral status: <fact>
- Prognosis, instructions, diet, hygiene, medication, warning signs, referral, scheduled follow-up, and sensibility-monitoring plan: <fact>

### Nitrous Oxide Add-On

- Indication: <fact>
- Preprocedure review and baseline: <fact>
- Administrator and monitor roles: <value>
- Start and stop times: <EDR only>
- Nitrous oxide and oxygen concentrations over time: <time-oriented record>
- Continuous direct observation: <fact>
- Patient responsiveness, ventilation, oxygenation, and adverse change: <fact>
- Oxygen recovery period and endpoint: <fact>
- Discharge condition and instructions: <specific facts>

### Sedation and Anesthesia Add-On

Use with the separate time-oriented anesthesia record.

- Intended and achieved depth: <minimal/moderate/deep/general>
- Route: <enteral/inhalation/intravenous/intramuscular/intranasal/other>
- Clinician fitness or candidacy determination: <fact>
- Permit and facility status verified: <EDR workflow>
- Anesthesia provider and team roles: <value>
- Day-of medical, medication, airway, fasting, and baseline update: <linked status>
- ASA class and focused physical examination: <clinician-supplied facts>
- Consent reaffirmed before cognition-altering medication and questions addressed: <linked status>
- Drugs, doses, units, routes, and actual times: <time-oriented record only>
- Oxygenation, ventilation, circulation, consciousness, and required monitor data: <time-oriented record only>
- Team-role changes, handoffs, positioning, padding, extremity protection, and eye protection: <when applicable>
- Deeper-than-intended sedation, airway or emergency intervention, reversal, and response: <fact>
- Procedure and anesthesia start and stop: <EDR only>
- Sedation effectiveness and planned dental care completed: <yes/no, supporting facts, and what remained>
- Recovery monitoring: <linked facts>
- Discharge criteria: <consciousness, oxygenation, ventilation, circulation, mobility or baseline, pain, nausea, bleeding, and other applicable criteria with support>
- Clinician discharge determination: <specific facts>
- Responsible adult, instructions, destination, and discharge time: <EDR only>
- Postoperative contact status and unresolved event follow-up: <fact>
- Record reconciliation completed: <yes/no>

### Pediatric and Behavior Add-On

- Developmental and communication needs: <fact>
- Accompanying-adult role, caregiver presence, parent or guardian report, and legal authority: <identity and authority stay in EDR>
- Interpreter, translation, and communication aid: <status>
- Preoperative instruction compliance and supplemental-document link: <EDR status>
- Behavior guidance: <tell-show-do/distraction/positive reinforcement/other exact method>
- Patient response: <objective behavior>
- Protective stabilization or restraint: <method, reason, alternatives tried, duration, monitoring, written consent, parent access status>
- Pediatric procedure: <sealant/SDF/stainless steel crown/pulpotomy/pulpectomy/space maintainer/trauma/other>
- Tooth, surface, isolation, material, medicament, appliance, and steps: <facts>
- Parent or guardian instructions and teach-back: <fact>
- Complication, planned next treatment, and follow-up: <fact>

### Orthodontic Add-On

#### Comprehensive Orthodontic Case Record

- Clinician-supplied diagnosis, problem list, prognosis, and treatment objectives: <facts>
- Facial, skeletal, dental, occlusal, periodontal, airway, temporomandibular, growth, and risk assessment: <assessed facts and limits>
- Records: <photographs/radiographs/cephalometrics/scan/models/measurements and EDR links>
- Options, risks, benefits, alternatives, no-treatment option, referral, and decision: <facts>
- Treatment plan, appliance strategy, planned stages, coordination, and retention plan: <facts>
- Progress evaluation, deviations, outcome, final records, prognosis, and maintenance: <facts>

#### Orthodontic Progress Visit

- Stage: <bonding/adjustment/aligner delivery/IPR/emergency/debond/retention/observation>
- Visit objective and progress: <facts>
- Appliance, arch, teeth, brackets, bands, wire, elastics, attachments, auxiliaries, and settings: <fact>
- Interproximal reduction: <tooth pair, surface, exact amount and unit>
- Aligner number, fit, tracking, attachments, and wear instruction: <fact>
- Oral hygiene, periodontal, caries, root, TMD, and compliance observations: <objective facts>
- Breakage, soft-tissue injury, emergency action, and adverse event: <fact>
- Debond, adhesive removal, final records, retainer type, delivery, wear, and follow-up: <fact>

### Oral Medicine Add-On

- Domain: <mucosal/salivary/orofacial pain/TMD/sleep/medication-related/cancer therapy/other>
- Site, duration, pattern, triggers, systemic features, and prior care: <facts>
- Examination and measurements: <specific findings>
- Cranial nerve, muscle, joint, range of motion, salivary, lymph node, skin, and mucosal findings: <assessed domains>
- Image, laboratory, culture, biopsy, sleep study, or external report: <fact>
- Clinician-supplied diagnosis or differential: <term>
- Medication review and possible association: <clinician-supplied fact>
- Plan, biopsy, referral, medical coordination, self-care, warning signs, and reassessment: <fact>

### Medication and Prescription Add-On

- Action: <administered/prescribed/dispensed/recommended/discontinued/reconciled>
- Generic drug and formulation: <fact>
- Concentration, amount, dose, unit, route, and actual time: <fact>
- Indication: <fact>
- Allergy, interaction, contraindication, pregnancy, renal, hepatic, bleeding, and substance-risk review: <clinician verification>
- Quantity, directions, duration, refills, monitoring, and disposal instruction: <verified prescription>
- Controlled-substance database or statutory workflow: <status required by current law>
- Counseling and teach-back: <fact>
- Adverse event and response: <fact>

### Teledentistry Add-On

- Technology: <secure video/store-and-forward>
- Dentist location and patient jurisdiction: <state only in AI draft>
- Identity and consent verification: <EDR status only>
- Participants and roles: <roles only>
- Records available: <fact>
- Data and image quality: <adequate/limited, with reason>
- History, remote examination limits, findings, and opinion: <facts>
- In-person examination or additional data needed: <fact>
- Referral, escalation, prescription, instructions, and follow-up: <fact>

### Communication and Follow-Up Add-On

- Communication type: <postoperative call/telephone/portal/other>
- Initiating and receiving roles: <roles only>
- Reason: <fact>
- Patient or caregiver report: <de-identified facts>
- Clinician observations available and limits: <facts>
- Advice, instruction, recommendation, or no new advice: <clinician-supplied facts>
- Understanding or teach-back: <fact>
- Escalation, urgent or emergency trigger, and action: <fact>
- Follow-up owner, next step, and tracking status: <role and status>

### Pathology Result Add-On

- Specimen and procedure link: <EDR status only>
- Result source and status: <laboratory role; preliminary/final/amended>
- Clinician review: <status>
- Clinician-supplied result summary and diagnosis effect: <de-identified facts>
- Communication to patient, caregiver, referrer, or other clinician: <roles and status only>
- Plan, referral, surveillance, or additional procedure: <fact>
- Tracking owner and closure status: <role and status>

### Refusal and Incomplete Care Add-On

- Recommended care and clinical reason: <facts>
- Expected benefit and material risk: <facts>
- Alternatives and no-care option: <facts>
- Questions and clinician responses: <facts>
- Exact decision: <declined/deferred/stopped/partly completed>
- Care actually performed and care not performed: <facts>
- Current condition: <facts>
- Consequences, instructions, follow-up, referral, and return precautions: <facts>

### Late Entry, Correction, or Addendum Add-On

Complete this only in the EDR. Never alter, hide, or overwrite the signed original.

- Entry type: <late entry/correction/addendum>
- Original entry reference: <EDR only>
- Reason: <fact>
- New or corrected fact and source: <fact>
- Original remains visible: <EDR control>
- Current author, date, time, attestation, and signature: <EDR only>

### Universal Procedure Add-On

- Exact procedure name: <value>
- Procedure domain and status: <value>
- Diagnosis and indication: <clinician-supplied fact>
- Site, side, arch, tooth, surface, and structure: <fact>
- Consent and procedural pause: <status>
- Anesthesia, isolation, preparation, technique, instruments, materials, devices, settings, and measurements: <only supplied facts>
- Findings and endpoint: <specific facts>
- Complication, intervention, and response: <fact>
- Condition at end, instructions, return precautions, and follow-up: <fact>

### Clinician completion checklist

- [ ] No patient identifier or identifying date entered into AI
- [ ] Source of each material fact preserved
- [ ] Tooth, surface, arch, side, and dentition agree
- [ ] Diagnosis came from the clinician
- [ ] Consent matches the performed procedure
- [ ] Drugs and doses match source and time-oriented record
- [ ] No blank was converted to normal
- [ ] Images include indication, quality, findings, impression, and action
- [ ] CBCT entire volume was reviewed or referred
- [ ] Sedation record, monitoring, recovery, and discharge are complete
- [ ] Complications and condition at handoff are specific
- [ ] Every placeholder and unresolved flag resolved in the EDR
- [ ] Formal audit rerun; no open STOP or REQUIRED finding
- [ ] Every REVIEW finding resolved or given a clinician-approved disposition
- [ ] Final signed entry locked; later facts use the authorized addendum process
- [ ] Current state, payer, facility, and licensed-code requirements checked
- [ ] Licensed clinician reviewed and signed the final entry

## Formal audit pass

Run this audit after every draft or normalization. A blank template receives a design review, not a readiness audit.

### Audit sequence

1. **Privacy:** stop for possible identifiers and do not repeat them.
2. **Routing:** confirm the rule profile, encounter, care status, and every triggered module.
3. **Completeness:** find missing facts, units, sources, links, and placeholders.
4. **Anatomy:** compare dentition, tooth, surface, root, canal, arch, quadrant, side, implant or edentulous site, and image field of view.
5. **Clinical sequence:** compare concern, findings, assessment, recommendation, consent or refusal, performed care, outcome, and follow-up.
6. **Medication and anesthesia:** compare exact names, concentrations, amounts, doses, units, routes, actual times, depth, monitoring, recovery, and the linked time record. Never calculate or convert.
7. **Specialty rules:** apply every confirmed procedure module.
8. **Language:** check controlled terms, typos, ambiguous abbreviations, vague wording, contradictions, and possible stale text.
9. **Jurisdiction:** apply Tennessee or another approved local profile.
10. **Ready-to-sign gate:** resolve all STOP and REQUIRED findings, rerun, and require clinician review.

### Applicability and result states

| Applicability | Meaning |
|---|---|
| `REQUIRED_NOW` | Needed in the de-identified draft |
| `REQUIRED_IN_EDR` | Completed locally because it is identifying, signed, linked, licensed, or system-controlled |
| `CONDITIONAL` | Required only if the event or rule trigger applies |
| `OPTIONAL` | Useful but not required for the selected encounter |
| `NOT_APPLICABLE` | The clinician confirms it does not apply and gives a reason when needed |

Record each result as `PRESENT`, `EXPLICITLY_NOT_APPLICABLE`, `NOT_ASSESSED`, `UNKNOWN`, `UNRESOLVED`, or `MISSING`.

### Severity and readiness

| Severity | Meaning | Response |
|---|---|---|
| `S0 STOP` | Privacy, wrong-record or wrong-site risk, material contradiction, unsafe drug or sedation discrepancy, altered signed entry, or essential anesthesia record missing | Do not finalize. A clinician or compliance owner compares the source. |
| `S1 REQUIRED` | A triggered element, source, unit, consent item, status, disposition, or owner is missing | Add the verified fact or a clinician-approved state and reason. |
| `S2 REVIEW` | Unusual value, unclear source, possible contradiction, possible copy-forward, or vague phrase | Clinician confirms it. Do not auto-fix. |
| `S3 STYLE` | High-confidence language-only issue with no meaning change | Staff may correct it and list the change. |
| `S4 INFO` | EDR-only, legal, state, permit, delegation, retention, or governance reminder | Complete it locally. |

Overall result:

- any `S0`: `BLOCKED`
- no `S0` and any `S1`: `NEEDS CLINICIAN ACTION`
- only `S2` through `S4`: `READY FOR CLINICIAN REVIEW`
- no open `S0` through `S2`: `AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED`

Do not return a percentage or a compliance score.

### Safe-edit boundary

Never automatically change a diagnosis, prognosis, clinical interpretation, drug, dose, unit, concentration, route, time, tooth, surface, anatomy, measurement, image modality, material, device, procedure, status, complication, or sedation depth. A medication-name typo remains `S2 REVIEW` until a clinician verifies the source.

### High-risk audit checks

- Treat each procedure-site pair separately.
- Do not let a field in one module satisfy another module.
- Compare patient or caregiver report with clinician observation.
- Compare working, differential, and final diagnosis status.
- Compare planned, consented, started, completed, partly completed, stopped, deferred, and declined care.
- Compare consent or refusal with care actually performed.
- Compare diagnosis, indication, procedure, image, prescription, and billing site.
- Compare no allergy with a named allergy.
- Compare no anesthetic with a recorded anesthetic.
- Compare no complication with an adverse event, rescue, or reversal.
- Compare no specimen with pathology submission.
- Compare intended and achieved sedation depth.
- Reconcile the narrative with the time-oriented anesthesia record.
- Reconcile image status, findings, impression, communication, and follow-up.

### Template-residue checks

Flag angle brackets, square brackets, braces, three or more underscores, empty quotes, `TBD`, `TODO`, unresolved pick lists, duplicate sentences, unrelated modules, and stale wording such as same as above, see previous note, unchanged, today, last visit, or previously.

Text similarity alone is a review item. Escalate it only when it creates a material contradiction or possible wrong-record event.

### Audit output

```markdown
# Dental-note audit

- Status: <value>
- Rule profile: <value>
- Modules confirmed: <list>
- Audit version: <value>

## Issues

| ID | Severity | Module | Location | Finding | Required action | Owner |
|---|---|---|---|---|---|---|

## Terms changed

| Before | After | Rule | Clinician confirmation needed |
|---|---|---|---|

## Draft note

<de-identified draft>

## EDR-only finalization

- [ ] Correct chart confirmed locally
- [ ] Dates, times, identities, authority, and signatures completed locally
- [ ] Linked records reconciled
- [ ] Every issue resolved or given a clinician-approved disposition
- [ ] Licensed clinician compared every fact with the source and signed
```

The packaged deterministic checker screens possible identifiers, placeholders, controlled typos, ambiguous abbreviations, vague phrases, duplicate text, selected contradictions, ADA Universal tooth values, surfaces, arch, side, and module concepts. It does not replace the semantic audit.

