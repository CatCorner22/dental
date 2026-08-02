// Turn a draft title into a safe attachment filename base.
// Slug first, cap the length, then fall back — so long titles keep their
// name instead of silently becoming "dental-note".
export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "dental-note";
}
