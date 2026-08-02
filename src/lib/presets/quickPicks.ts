// Quick Picks preselect a bundle of MODULES for a common visit type, so a user
// starts with the right sections instead of hunting the rail. They select
// structure ONLY — never any field value, and never a clinical assertion.
export interface QuickPick {
  id: string;
  label: string;
  description: string;
  moduleIds: string[]; // add-on module ids; universal-core is always present
  featured?: boolean; // shown as a one-click card on the dashboard
}

// The four most common visit types in a general practice get one-click cards.
export const FEATURED_PICK_IDS = ["recall-exam", "restorative", "simple-extraction", "emergency"] as const;

export const QUICK_PICKS: QuickPick[] = [
  {
    id: "recall-exam",
    label: "Recall exam + cleaning",
    description: "Periodic examination with prophylaxis and imaging.",
    moduleIds: ["examination", "preventive", "imaging"]
  },
  {
    id: "restorative",
    label: "Restoration",
    description: "Direct restoration with imaging and local anesthetic.",
    moduleIds: ["direct-restorative", "imaging", "medication"]
  },
  {
    id: "simple-extraction",
    label: "Simple extraction",
    description: "Extraction with imaging and medication.",
    moduleIds: ["extraction", "imaging", "medication"]
  },
  {
    id: "surgical-extraction-iv",
    label: "Surgical extraction + IV sedation",
    description: "Operative extraction under IV moderate sedation, with imaging and medication.",
    moduleIds: ["extraction", "operative", "sedation-anesthesia", "imaging", "medication"]
  },
  {
    id: "endo",
    label: "Root canal",
    description: "Endodontic treatment with imaging and medication.",
    moduleIds: ["endodontic", "imaging", "medication"]
  },
  {
    id: "perio-srp",
    label: "Periodontal therapy",
    description: "Periodontal evaluation and scaling with imaging.",
    moduleIds: ["periodontal", "imaging"]
  },
  {
    id: "emergency",
    label: "Emergency / pain visit",
    description: "Limited emergency evaluation with imaging and medication.",
    moduleIds: ["emergency", "imaging", "medication"]
  },
  {
    id: "implant-placement",
    label: "Implant placement",
    description: "Implant surgery with imaging and medication.",
    moduleIds: ["implant", "operative", "imaging", "medication"]
  }
];
