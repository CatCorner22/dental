import type { ModuleDef } from "@/lib/schema/types";
import { YES_NO, opts } from "./shared";

const DEPTHS = opts("minimal sedation", "moderate sedation", "deep sedation", "general anesthesia");

export const sedationAnesthesia: ModuleDef = {
  id: "sedation-anesthesia",
  title: "Sedation and Anesthesia Add-On",
  order: 170,
  description:
    "Oral, IV, intranasal, intramuscular sedation; deep sedation; general anesthesia. Use with the facility's separate time-oriented anesthesia record. Depth is independent of route. Drug names, doses, and actual times belong only in the time-oriented record and the EDR — never calculate or convert a dose.",
  sections: [
    {
      id: "plan",
      title: "Depth, route, and authority",
      fields: [
        {
          id: "intended-depth",
          type: "select",
          label: "Intended depth",
          required: true,
          options: DEPTHS
        },
        {
          id: "achieved-depth",
          type: "select",
          label: "Achieved depth",
          required: true,
          options: DEPTHS,
          helpText:
            "The team must be able to rescue the patient from at least the next deeper level."
        },
        {
          id: "route",
          type: "multiselect",
          label: "Route",
          required: true,
          options: opts("enteral", "inhalation", "intravenous", "intramuscular", "intranasal"),
          joiner: ", "
        },
        {
          id: "fitness",
          type: "text",
          label: "Clinician fitness or candidacy determination",
          required: true,
          placeholderHint: "<fact>"
        },
        {
          id: "permit-status",
          type: "select",
          label: "Permit and facility status verified",
          required: true,
          options: opts("verified in the EDR workflow", "unresolved"),
          helpText:
            "Tennessee: IV moderate sedation requires the comprehensive permit; deep sedation and general anesthesia require their own permits, plus the facility permit."
        },
        {
          id: "team-roles",
          type: "text",
          label: "Anesthesia provider and team roles",
          required: true,
          placeholderHint: "<roles only>",
          helpText:
            "Tennessee: conscious sedation needs one person besides the operating dentist; deep sedation or general anesthesia needs two."
        }
      ]
    },
    {
      id: "preassessment",
      title: "Preassessment and consent",
      fields: [
        {
          id: "day-of-update",
          type: "select",
          label: "Day-of medical, medication, airway, fasting, and baseline update",
          required: true,
          options: opts("linked in the EDR", "unresolved")
        },
        {
          id: "asa-exam",
          type: "text",
          label: "ASA class and focused physical examination",
          required: true,
          placeholderHint: "<clinician-supplied facts>"
        },
        {
          id: "consent-reaffirmed",
          type: "select",
          label:
            "Consent reaffirmed before cognition-altering medication and questions addressed",
          required: true,
          options: opts("linked in the EDR", "unresolved")
        }
      ]
    },
    {
      id: "intraoperative",
      title: "Intraoperative record",
      fields: [
        {
          id: "drugs",
          type: "select",
          label: "Drugs, doses, units, routes, and actual times",
          required: true,
          options: opts("recorded in the time-oriented anesthesia record only"),
          helpText: "Never restate, calculate, or convert doses in this draft."
        },
        {
          id: "monitors",
          type: "select",
          label: "Oxygenation, ventilation, circulation, consciousness, and required monitor data",
          required: true,
          options: opts("recorded in the time-oriented anesthesia record only")
        },
        {
          id: "team-events",
          type: "text",
          label:
            "Team-role changes, handoffs, positioning, padding, extremity protection, and eye protection",
          placeholderHint: "<when applicable>",
          standardPhrases: ["Not applicable."]
        },
        {
          id: "events",
          type: "textarea",
          label:
            "Deeper-than-intended sedation, airway or emergency intervention, reversal, and response",
          required: true,
          standardPhrases: [
            "The patient did not move to a deeper level than intended, and no airway or emergency intervention was needed during the stated period."
          ]
        },
        {
          id: "times",
          type: "select",
          label: "Procedure and anesthesia start and stop",
          options: opts("recorded in the EDR")
        }
      ]
    },
    {
      id: "recovery",
      title: "Recovery and discharge",
      fields: [
        {
          id: "effectiveness",
          type: "text",
          label: "Sedation effectiveness and planned dental care completed",
          required: true,
          placeholderHint: "<yes/no, supporting facts, and what remained>"
        },
        {
          id: "recovery-monitoring",
          type: "text",
          label: "Recovery monitoring",
          required: true,
          placeholderHint: "<linked facts>"
        },
        {
          id: "discharge-criteria",
          type: "textarea",
          label: "Discharge criteria",
          required: true,
          placeholderHint:
            "<consciousness, oxygenation, ventilation, circulation, mobility or baseline, pain, nausea, bleeding, and other applicable criteria with support>",
          helpText: "Do not write discharged stable without the supporting criteria."
        },
        {
          id: "discharge-determination",
          type: "text",
          label: "Clinician discharge determination",
          required: true,
          placeholderHint: "<specific facts>"
        },
        {
          id: "responsible-adult",
          type: "select",
          label: "Responsible adult, instructions, destination, and discharge time",
          required: true,
          options: opts("recorded in the EDR")
        },
        {
          id: "postop-contact",
          type: "text",
          label: "Postoperative contact status and unresolved event follow-up",
          placeholderHint: "<fact>"
        },
        {
          id: "reconciliation",
          type: "select",
          label: "Record reconciliation completed",
          required: true,
          options: YES_NO,
          helpText: "The narrative and the time-oriented anesthesia record must agree."
        }
      ]
    }
  ]
};
