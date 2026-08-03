import type { ModuleDef } from "@/lib/schema/types";
import { opts, optionalTeeth } from "./shared";

export const periodontal: ModuleDef = {
  id: "periodontal",
  title: "Periodontal Add-On",
  order: 90,
  description: "Periodontal evaluation, debridement, scaling, maintenance, surgery.",
  sections: [
    {
      id: "main",
      title: "Periodontics",
      fields: [
        {
          id: "exam-type",
          type: "select",
          label: "Examination type",
          required: true,
          options: opts("screening", "comprehensive", "reassessment", "maintenance")
        },
        {
          id: "chart",
          type: "text",
          label:
            "Probing depth, recession, clinical attachment level, bleeding, suppuration, mobility, furcation, plaque, calculus, mucogingival and implant findings",
          standardPhrases: ["Site-specific chart linked in the EDR."]
        },
        {
          id: "occlusal-findings",
          type: "text",
          label:
            "Proximal contacts, endodontic-periodontal lesions, restoration and prosthesis status, fremitus, and occlusal findings",
          placeholderHint: "<facts>"
        },
        {
          id: "image-bone",
          type: "text",
          label: "Image and bone findings",
          placeholderHint: "<fact>",
          standardPhrases: ["See the Imaging add-on."]
        },
        {
          id: "bone-quality",
          type: "text",
          label: "Bone quality, quantity, pattern, and anatomic limitations",
          placeholderHint: "<clinician-supplied image or examination facts>"
        },
        {
          id: "risk-factors",
          type: "text",
          label:
            "Named systemic, behavioral, tobacco, glycemic, medication, genetic, and local risk factors",
          placeholderHint: "<facts>"
        },
        {
          id: "diagnosis",
          type: "text",
          label: "Clinician-supplied diagnosis",
          required: true,
          placeholderHint: "<gingival/periodontal/peri-implant term>"
        },
        {
          id: "stage-grade",
          type: "text",
          label: "Periodontitis extent, stage, and grade",
          placeholderHint: "<when diagnosed>"
        },
        {
          id: "procedure",
          type: "select",
          label: "Procedure",
          required: true,
          options: opts(
            "debridement",
            "scaling and root planing",
            "periodontal maintenance",
            "gingivectomy",
            "flap surgery",
            "graft",
            "regeneration",
            "crown lengthening"
          ),
          allowOther: true
        },
        optionalTeeth(
          "teeth",
          "Teeth treated (if site-specific)",
          "Leave blank for full-mouth or quadrant work; describe those in the field below."
        ),
        {
          id: "sites",
          type: "text",
          label: "Quadrant, sextant, surfaces, and sites",
          required: true,
          placeholderHint: "<value>"
        },
        {
          id: "technique",
          type: "textarea",
          label:
            "Anesthesia, instruments, irrigation, medicament, laser settings, graft, membrane, biologic, and sutures",
          placeholderHint: "<only supplied facts>"
        },
        {
          id: "response",
          type: "text",
          label: "Tissue response, deposits removed, endpoint, complications, and hemostasis",
          placeholderHint: "<fact>"
        },
        {
          id: "follow-up",
          type: "textarea",
          label:
            "Self-care instruction, risk-factor counseling, reevaluation, maintenance interval, and referral",
          placeholderHint: "<fact>"
        }
      ]
    }
  ]
};
