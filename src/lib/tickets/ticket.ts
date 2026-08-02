// A ticket number is derived from the submissions serial id, so it is unique
// and monotonic. Gaps from rolled-back submissions are acceptable and expected.
export function formatTicket(id: number): string {
  if (!Number.isInteger(id) || id < 1) {
    throw new Error(`ticket id must be a positive integer, received ${id}`);
  }
  return `DN-${String(id).padStart(6, "0")}`;
}
