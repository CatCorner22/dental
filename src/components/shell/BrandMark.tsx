import { APP_MARK, APP_NAME } from "@/lib/brand";

// The wordmark. One glyph, one name, no image asset — it stays crisp at every
// density, costs no request, and cannot 404. `aria-hidden` on the glyph keeps
// a screen reader from announcing "tooth Smile Notes".
export function BrandMark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span
      className={
        size === "lg"
          ? "inline-flex items-center gap-2 text-xl font-semibold tracking-tight"
          : "inline-flex items-center gap-1.5 text-base font-semibold tracking-tight sm:text-lg"
      }
    >
      <span aria-hidden="true">{APP_MARK}</span>
      {APP_NAME}
    </span>
  );
}
