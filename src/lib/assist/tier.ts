import type { ClinicalRole } from "@/lib/auth/clinicalRoles";
import { authorCapabilities } from "@/lib/scope/authorCapabilities";
import type { AssistCapability } from "./prompts";

// CAPABILITY FOLLOWS LICENCE.
//
// Every one of the five assist capabilities has a deterministic twin that ships
// in this repository and needs no provider, no key, and no network:
//
//   normalize   -> standardize()                 (lib/standardize)
//   soap        -> structureIntoSoap()           (lib/standardize/structure)
//   interrogate -> the completeness and justification rules inside
//                  runTextAudit, plus Byte's knowledge table
//   conflicts   -> the ConText assertion layer in lib/extract, plus the
//                  medication-safety interaction screens
//   extract     -> extractFacts()                (lib/extract)
//
// So "AI is off" has never meant "the feature is gone" here — it means the
// deterministic half runs. This module makes the SAME distinction follow the
// writer's licence instead of only the deployment switch, and it is a pure
// function of (role, capability) so it can be tested; vitest is node-only over
// src/**/*.test.ts, and a rule this consequential should not live where the
// only way to check it is to click.
//
// The pattern is copied from SuperByte, which already ships it:
// ByteStarAdvisor renders `pioneerObs.length > 0 ? pioneerObs : instrument` —
// the model's reading when there is one, the deterministic instrument's when
// there is not, in the same shape and the same tone.

export type AssistTier = "predictive" | "deterministic";

/**
 * What the writer's licence entitles this capability to.
 *
 * "predictive" — the model may be called, and its output is still refused by
 * verifyMeaning() if it changed the clinical substance of the input.
 * "deterministic" — the twin runs instead. Never nothing.
 */
export function capabilityTier(role: ClinicalRole, capability: AssistCapability): AssistTier {
  const profile = authorCapabilities(role);
  if (profile.assistTier === "deterministic") return "deterministic";

  // A predictive-tier licence still does not get a model for a capability whose
  // job is to state a clinical judgement the licence cannot record. An
  // auxiliary asking "what is missing from this note" is a fair question about
  // documentation; an auxiliary being handed a generated assessment is the tool
  // walking them into an act outside their scope. The deterministic twin
  // answers the documentation question without ever writing the judgement.
  if (!profile.mayRecordJudgement && JUDGEMENT_SHAPED.has(capability)) {
    return "deterministic";
  }
  return "predictive";
}

/**
 * Capabilities whose output reads as a clinical conclusion rather than as a
 * rearrangement of what the writer already said.
 *
 * `soap` and `normalize` only move and re-word text the writer wrote, so they
 * are safe at any licence. `interrogate` and `conflicts` produce statements
 * about what the record MEANS, which is the dentist's to make. `extract` is
 * read-only and quotes its evidence, so it stays available.
 */
const JUDGEMENT_SHAPED: ReadonlySet<AssistCapability> = new Set<AssistCapability>([
  "interrogate",
  "conflicts"
]);

/** Every capability this role may reach through a model. */
export function predictiveCapabilities(
  role: ClinicalRole,
  all: readonly AssistCapability[]
): AssistCapability[] {
  return all.filter((c) => capabilityTier(role, c) === "predictive");
}

/**
 * Why a capability came back deterministic, in words a person can act on.
 *
 * Never "you are not allowed": the deterministic twin ran and produced an
 * answer. The sentence has to say which half answered and what would change it.
 */
export function tierExplanation(role: ClinicalRole): string {
  const profile = authorCapabilities(role);
  if (role === "unset") {
    return "No clinical role is recorded on this account, so the deterministic checks answered — they cannot be wrong about what the note says. A Hierarchy Manager can record the role in User admin to turn on the predictive half.";
  }
  if (!profile.mayRecordJudgement) {
    return `The deterministic checks answered. A ${profile.label.toLowerCase()} documents findings and care; the questions that read as a clinical conclusion are the dentist's, and the tool does not put one in front of you to sign.`;
  }
  return "The deterministic checks answered.";
}
