// Postgres `serial` primary keys are int4. JavaScript will happily produce an
// integer far outside that range from a URL segment — Number.isInteger(1e21)
// is true — and handing one to the driver raises "value out of range for type
// integer", which surfaces as an unhandled 500 or a white-screened page
// rather than the 404 the request deserves.
//
// So every id that comes from outside is checked against the range the column
// can actually hold, not merely against "is it a whole number".
export const INT4_MIN = -2_147_483_648;
export const INT4_MAX = 2_147_483_647;

export function isInt4(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= INT4_MIN && n <= INT4_MAX;
}

// Parse a path segment or query value into a usable row id, or null when it
// is not one. Rejects negatives and zero too: no serial key is ever <= 0, so
// those are always a miss rather than a lookup worth making.
export function parseRowId(raw: string): number | null {
  if (!/^\d{1,10}$/.test(raw.trim())) return null;
  const n = Number(raw);
  return isInt4(n) && n > 0 ? n : null;
}
