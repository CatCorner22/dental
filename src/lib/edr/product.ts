// ELECTRONIC DENTAL RECORD (EDR) PRODUCT SEAM.
//
// Smile Notes writes the de-identified clinical body. The practice's charting
// system stamps identity, dates of service, codes, and signatures. That
// handoff is product-agnostic by design — compose footers already say "EDR".
//
// This module is the single place UI copy and AI source labels name the
// configured charting product. Default is Curve Hero (the first deployment).
// Other practices set EDR_PRODUCT_NAME (and optional EDR_PRODUCT_SHORT) in the
// environment; no Curve-specific adapter is required for the body pipeline.
//
// Do NOT invent a PMS sync API here. Scaling means: same note body, configurable
// handoff vocabulary, unchanged PHI boundary.

const DEFAULT_PRODUCT_NAME = "Curve Hero";

function trimOrEmpty(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Display name of the practice's charting / EDR product.
 * Override with EDR_PRODUCT_NAME (server) or NEXT_PUBLIC_EDR_PRODUCT_NAME
 * (bundled into client components).
 */
export function edrProductName(
  env: Record<string, string | undefined> = process.env
): string {
  return (
    trimOrEmpty(env.EDR_PRODUCT_NAME) ||
    trimOrEmpty(env.NEXT_PUBLIC_EDR_PRODUCT_NAME) ||
    DEFAULT_PRODUCT_NAME
  );
}

/** Short label for buttons ("Copy for …"). Defaults to the full product name. */
export function edrProductShort(
  env: Record<string, string | undefined> = process.env
): string {
  return (
    trimOrEmpty(env.EDR_PRODUCT_SHORT) ||
    trimOrEmpty(env.NEXT_PUBLIC_EDR_PRODUCT_SHORT) ||
    edrProductName(env)
  );
}

/** Canonical lowercase token for SuperByte source allow-list matching. */
export function edrSourceToken(
  env: Record<string, string | undefined> = process.env
): string {
  return edrProductName(env).toLowerCase();
}

export function copyForEdrLabel(
  env: Record<string, string | undefined> = process.env
): string {
  return `Copy for ${edrProductShort(env)}`;
}

export function edrHandoffAttestation(
  env: Record<string, string | undefined> = process.env
): string {
  const product = edrProductName(env);
  return `The correct chart is open in ${product} and I matched two identifiers before pasting.`;
}

export function edrTransferChecklistTitle(
  env: Record<string, string | undefined> = process.env
): string {
  return `${edrProductName(env)} transfer discipline`;
}

/**
 * Phrases SuperByte may use in the "source" field for charting-product
 * conventions. Includes the configured product and the legacy Curve Hero
 * token so older model habits still pass the allow-list.
 */
export function edrAllowedSourcePhrases(
  env: Record<string, string | undefined> = process.env
): string[] {
  const name = edrProductName(env);
  const phrases = [name, "electronic dental record", "EDR", "Curve Hero"];
  return [...new Set(phrases)];
}
