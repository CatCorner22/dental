import type { OfficeSeed } from "@/lib/db/repo/offices";

// Practice configuration.
//
// This file is the ONLY place a specific practice appears in the codebase, and
// it exists so that fitting Smile Notes to the next practice is an edit here
// plus a row in a table — not a fork. Everything downstream reads offices from
// the database; these values seed an empty deployment and are never consulted
// again once the practice starts editing its own.
//
// Deliberately not environment variables: three offices with addresses do not
// fit comfortably in env, and a practice that mistypes one wants to see the
// diff in review rather than discover it in production.

export const PRACTICE_NAME = process.env.PRACTICE_NAME || "Cornerstone Dental Arts";

/**
 * Offices seeded on first boot when the table is empty.
 *
 * Order is the order they appear in the picker, so the flagship comes first —
 * the option most people want should not be the one they have to hunt for.
 */
export const OFFICE_SEEDS: OfficeSeed[] = [
  {
    id: "town-and-country",
    name: "Town & Country Circle",
    shortCode: "T&C",
    address: "8912 Town and Country Circle, Knoxville, TN 37923",
    phone: "(865) 531-7117",
    sortOrder: 0
  },
  {
    id: "executive-park",
    name: "Executive Park",
    shortCode: "EP",
    address: "8925 Executive Park Dr, Knoxville, TN 37923",
    phone: "(865) 693-8871",
    sortOrder: 1
  },
  {
    id: "fort-sanders-west",
    name: "Fort Sanders West",
    shortCode: "FSW",
    address: "280 Fort Sanders W Blvd #117, Knoxville, TN 37922",
    phone: "(865) 539-6030",
    sortOrder: 2
  }
];
