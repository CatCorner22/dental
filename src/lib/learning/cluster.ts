// SURFACE-VARIANT CLUSTERING — merge typo/spacing variants before thresholds.
//
// Exact-token grouping misses "post-op instr" vs "postop instructions".
// This is retrieval-side only: it decides which proposals are the same
// proposal. It never writes clinical claims or touches filed note meaning.

import { areDentalSynonyms } from "./synonyms";

export function normalizeSubject(token: string): string {
  return token
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Dice coefficient on character bigrams — cheap and offline. */
export function bigramSimilarity(a: string, b: string): number {
  const na = normalizeSubject(a);
  const nb = normalizeSubject(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return na === nb ? 1 : 0;
  const A = new Map<string, number>();
  for (let i = 0; i < na.length - 1; i++) {
    const g = na.slice(i, i + 2);
    A.set(g, (A.get(g) ?? 0) + 1);
  }
  let overlap = 0;
  let bCount = 0;
  for (let i = 0; i < nb.length - 1; i++) {
    const g = nb.slice(i, i + 2);
    bCount += 1;
    const have = A.get(g) ?? 0;
    if (have > 0) {
      overlap += 1;
      A.set(g, have - 1);
    }
  }
  const aCount = na.length - 1;
  return (2 * overlap) / (aCount + bCount);
}

export interface TokenCluster {
  /** Canonical subject shown to reviewers (longest common-ish form). */
  canonical: string;
  members: string[];
}

/**
 * Cluster unknown tokens by normalized form + bigram similarity.
 * Threshold is intentionally high so distinct abbreviations stay separate.
 */
export function clusterTokens(
  tokens: string[],
  similarityThreshold = 0.82
): TokenCluster[] {
  const clusters: TokenCluster[] = [];
  for (const token of tokens) {
    let placed = false;
    for (const c of clusters) {
      const sameNorm = normalizeSubject(token) === normalizeSubject(c.canonical);
      const sameSynonym = areDentalSynonyms(token, c.canonical);
      const sim = bigramSimilarity(token, c.canonical);
      if (sameNorm || sameSynonym || sim >= similarityThreshold) {
        c.members.push(token);
        // Prefer the longer surface form as the display subject.
        if (token.length > c.canonical.length) c.canonical = token;
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ canonical: token, members: [token] });
  }
  return clusters;
}
