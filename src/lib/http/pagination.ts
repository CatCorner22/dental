// List endpoints and list pages return a bounded page, never the whole table.
// A practice accumulates drafts and submissions forever; without a ceiling
// every dashboard render grows a little slower until one day it times out.
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export interface PageParams {
  limit: number;
  offset: number;
}

// Anything unparseable falls back to the default rather than erroring: a bad
// ?limit should not fail a page load, and clamping is the honest response to
// "give me everything".
export function parsePageParams(url: string): PageParams {
  const params = new URL(url).searchParams;
  return {
    limit: clampInt(params.get("limit"), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE),
    offset: clampInt(params.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER)
  };
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
