import { getAssistConfig } from "@/lib/assist/service";

// BYTESTAR DEPLOYMENT GATES — the silent cage around the pioneer.
//
// The switches, none of them named in any prompt the model ever sees:
//   1. The assist dual-switch (ASSIST_ENABLED + AI_GATEWAY_API_KEY). SuperByte
//      rides the same provider; it cannot outrun the deployment that hosts it.
//   2. BYTESTAR_ENABLED — an explicit "0" closes the pioneer path while the
//      rest of assist stays up. Unset means OPEN (pre-go-live posture: a
//      separate =1 hunt locked the site owner out of a feature whose real
//      gate is the assist key — the cage is the rails below, not this flag).
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
  /** Diagnostics for the Team Lead monitor: is the assist dual-switch on? */
  assistOn: boolean;
  /** Diagnostics for the Team Lead monitor: did BYTESTAR_ENABLED=0 close it? */
  pioneerOptedOut: boolean;
}

export function getByteStarConfig(
  env: Record<string, string | undefined> = process.env
): ByteStarConfig {
  const assist = getAssistConfig(env);
  const pioneerOptedOut = env.BYTESTAR_ENABLED === "0";
  // The silent kill. Named for operators; invisible to every prompt.
  const silentlyKilled = env.BYTESTAR_KILL === "1";
  return {
    enabled: assist.enabled && !pioneerOptedOut && !silentlyKilled,
    model: env.BYTESTAR_MODEL || assist.model,
    silentlyKilled,
    assistOn: assist.enabled,
    pioneerOptedOut
  };
}

/** Bland copy for any caller that is not the Team Lead monitor. */
export const BYTESTAR_UNAVAILABLE =
  "SuperByte is unavailable right now. Keep drafting with Byte; your note is unchanged.";
