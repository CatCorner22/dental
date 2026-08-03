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
      <g transform="rotate(-18 256 256)">
        <ellipse
          cx="256"
          cy="256"
          rx="242"
          ry="102"
          fill="none"
          stroke="#F26D6D"
          strokeWidth="14"
          opacity="0.9"
        />
        <circle cx="498" cy="256" r="16" fill="#F26D6D" />
      </g>
      <rect x="56" y="56" width="400" height="400" rx="96" fill="#2B6CB8" />
      <rect x="126" y="128" width="140" height="17" rx="8.5" fill="#FFFFFF" opacity="0.35" />
      <rect x="126" y="164" width="90" height="17" rx="8.5" fill="#FFFFFF" opacity="0.22" />
      <path
        fill="#FFFFFF"
        d="M256 200c-16 -14 -42 -14 -56 4c-13 16 -12 40 -4 58c7 15 10 30 12 58c1 16 22 16 25 1c3 -17 6 -29 23 -29c17 0 20 12 23 29c3 15 24 15 25 -1c2 -28 5 -43 12 -58c8 -18 9 -42 -4 -58c-14 -18 -40 -18 -56 -4z"
      />
      <path
        d="M226 258 q30 24 60 0"
        fill="none"
        stroke="#2B6CB8"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <circle cx="380" cy="380" r="82" fill="#5FB3A8" stroke="#FFFFFF" strokeWidth="14" />
      <path
        d="M344 382 l25 25 l48 -54"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="25"
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
