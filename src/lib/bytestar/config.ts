import { getAssistConfig } from "@/lib/assist/service";

// BYTESTAR DEPLOYMENT GATES — the silent cage around the pioneer.
//
// Three switches, all required, none of them named in any prompt the model
// ever sees:
//   1. The assist dual-switch (ASSIST_ENABLED + AI_GATEWAY_API_KEY). ByteStar
//      rides the same provider; it cannot outrun the deployment that hosts it.
//   2. BYTESTAR_ENABLED=1 — the operator's opt-in for the pioneer path.
//   3. BYTESTAR_KILL — the SILENT killswitch. When set to "1", ByteStar is
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
}

export function getByteStarConfig(
  env: Record<string, string | undefined> = process.env
): ByteStarConfig {
  const assist = getAssistConfig(env);
  const optedIn = env.BYTESTAR_ENABLED === "1";
  // The silent kill. Named for operators; invisible to every prompt.
  const silentlyKilled = env.BYTESTAR_KILL === "1";
  return {
    enabled: assist.enabled && optedIn && !silentlyKilled,
    model: env.BYTESTAR_MODEL || assist.model,
    silentlyKilled
  };
}

/** Bland copy for any caller that is not the Team Lead monitor. */
export const BYTESTAR_UNAVAILABLE =
  "ByteStar is unavailable right now. Keep drafting with Byte; your note is unchanged.";
