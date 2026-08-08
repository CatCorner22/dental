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

/**
 * Whether Copy / download is locked on the builder finish surface.
 *
 * Single source of truth for BuilderShell — tested by Honest Finish acceptance
 * falsifiers so the UI cannot drift from the hate-panel contract.
 */
export function copyExportLocked(args: {
  hasContent: boolean;
  exportAllowed: boolean;
  roleRecorded: boolean;
  dentistMustOwnKillers: boolean;
  filingAllowed: boolean;
  killersBlock: boolean;
}): boolean {
  return (
    !args.hasContent ||
    !args.exportAllowed ||
    !args.roleRecorded ||
    args.dentistMustOwnKillers ||
    !args.filingAllowed ||
    args.killersBlock
  );
}

/**
 * Whether Submit / File is locked on the builder finish surface.
 * Killers hard-block; Soft S2 non-killers do not (emailAllowed already ignores S2).
 */
export function submitHandoffBlocked(args: {
  hasContent: boolean;
  emailAllowed: boolean;
  filingAllowed: boolean;
  roleRecorded: boolean;
  killersBlock: boolean;
  alreadySubmitted: boolean;
}): boolean {
  return (
    !args.hasContent ||
    !args.emailAllowed ||
    !args.filingAllowed ||
    !args.roleRecorded ||
    args.killersBlock ||
    args.alreadySubmitted
  );
}

/** Role-before-work: unset clinical role cannot write the note. */
export function writingEnabled(canEdit: boolean, roleRecorded: boolean): boolean {
  return canEdit && roleRecorded;
}
