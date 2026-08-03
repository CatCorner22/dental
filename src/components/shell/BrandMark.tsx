import { APP_NAME } from "@/lib/brand";

// The wordmark with the real logomark, inlined. Inline SVG keeps the old
// emoji-glyph properties this component was built around — crisp at every
// density, zero requests, cannot 404 — while replacing the 🦷 emoji (which
// renders differently on every platform and is nobody's property) with the
// practice's own registrable mark. Source of truth for the full-size assets:
// public/brand/ and docs/brand.md.
function MarkGlyph({ px }: { px: number }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={px}
      height={px}
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <rect x="40" y="40" width="432" height="432" rx="104" fill="#2B6CB8" />
      <rect x="118" y="120" width="150" height="18" rx="9" fill="#FFFFFF" opacity="0.35" />
      <rect x="118" y="158" width="96" height="18" rx="9" fill="#FFFFFF" opacity="0.22" />
      <path
        fill="#FFFFFF"
        d="M256 196c-16 -14 -42 -14 -56 4c-13 16 -12 40 -4 58c7 15 10 30 12 58c1 16 22 16 25 1c3 -17 6 -29 23 -29c17 0 20 12 23 29c3 15 24 15 25 -1c2 -28 5 -43 12 -58c8 -18 9 -42 -4 -58c-14 -18 -40 -18 -56 -4z"
      />
      <path
        d="M226 254 q30 24 60 0"
        fill="none"
        stroke="#2B6CB8"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <circle cx="376" cy="376" r="84" fill="#5FB3A8" stroke="#FFFFFF" strokeWidth="14" />
      <path
        d="M338 378 l26 26 l50 -56"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="26"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BrandMark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span
      className={
        size === "lg"
          ? "inline-flex items-center gap-2 text-xl font-semibold tracking-tight"
          : "inline-flex items-center gap-1.5 text-base font-semibold tracking-tight sm:text-lg"
      }
    >
      <MarkGlyph px={size === "lg" ? 28 : 24} />
      {APP_NAME}
    </span>
  );
}
