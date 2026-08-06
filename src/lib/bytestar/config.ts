import { getAssistConfig } from "@/lib/assist/service";

// BYTESTAR DEPLOYMENT GATES — the silent cage around the pioneer.
//
// The switches, none of them named in any prompt the model ever sees:
//   1. AI_GATEWAY_API_KEY — the real door. If a provider key is present,
//      SuperByte is open. Requiring ASSIST_ENABLED=1 *as well* locked the
//      site owner out of the SuperByte tab after they already put a key in
//      (same class of foot-gun as the old BYTESTAR_ENABLED=1 hunt). Assist
//      buttons stay on their own dual-switch; the pioneer does not.
//   2. BYTESTAR_ENABLED — an explicit "0" closes the pioneer path while the
//      rest of assist stays up. Unset means OPEN.
//   3. BYTESTAR_KILL — the SILENT killswitch. When set to "1", SuperByte is
//      unavailable. The model is never told that this variable exists, never
//      told that it was tripped, and never told why a call returned
//      "unavailable". By the time a response would have been useful to an
//      escape attempt, the call has already been refused upstream of the
//      provider.
//
// The "silent" part is load-bearing. A killswitch the model can reason about
// is a killswitch the model can try to talk its way around. A killswitch that
// simply makes the doorway not exist cannot be negotiated with.
//
// The cage that still holds every open call: PHI gate, escape ladder,
// meaning verifier, one-way API fence, source allow-list. Those are the bars;
// this file is only the door.

export interface ByteStarConfig {
  /** True only when every gate is open and the silent kill is not tripped. */
  enabled: boolean;
  /** Model id, inherited from assist unless overridden. */
  model: string;
  /**
   * True when the silent killswitch is the reason the feature is dark.
   * Exposed ONLY to Team Lead monitors and operator diagnostics — never to
   * the model, never to the end-user chrome (which sees a bland "unavailable").
   */
  silentlyKilled: boolean;
  /** Diagnostics: is the separate AI-assist dual-switch on? */
  assistOn: boolean;
  /** Diagnostics: is a gateway key present (SuperByte's real door)? */
  providerKeyPresent: boolean;
  /** Diagnostics for the Team Lead monitor: did BYTESTAR_ENABLED=0 close it? */
  pioneerOptedOut: boolean;
}

export function getByteStarConfig(
  env: Record<string, string | undefined> = process.env
): ByteStarConfig {
  const assist = getAssistConfig(env);
  const providerKeyPresent = Boolean(env.AI_GATEWAY_API_KEY?.trim());
  const pioneerOptedOut = env.BYTESTAR_ENABLED === "0";
  // The silent kill. Named for operators; invisible to every prompt.
  const silentlyKilled = env.BYTESTAR_KILL === "1";
  return {
    enabled: providerKeyPresent && !pioneerOptedOut && !silentlyKilled,
    model: env.BYTESTAR_MODEL || assist.model,
    silentlyKilled,
    assistOn: assist.enabled,
    providerKeyPresent,
    pioneerOptedOut
  };
}

/** Bland copy for any caller that is not the Team Lead monitor. */
export const BYTESTAR_UNAVAILABLE =
  "SuperByte is unavailable right now. Keep drafting with Byte; your note is unchanged.";
