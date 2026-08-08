/**
 * Handoff gates beyond severity-based computeGates.
 *
 * Honest Finish brutal follow-up: litigation killers used to escape via a
 * checkbox ack. That made the app a deposition exhibit ("saw risk, let it
 * leave"). Killers now hard-block Copy and File until cleared — Soft S2 that
 * is NOT in the killer set may still warn without blocking Copy.
 *
 * Does not invent clinical facts. Does not change RULESET_VERSION (UI/product
 * gate, not a new audit rule).
 */
export function killersBlockHandoff(killerCount: number): boolean {
  return killerCount > 0;
}
