import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Inter, self-hosted, with the office stack behind it for the moment
      // before the woff2 lands. globals.css has the @font-face and, more
      // importantly, the reason: this app renders doses and tooth numbers, and
      // the OS default faces cannot reliably distinguish 0 from O or 1 from l.
      fontFamily: {
        sans: [
          "InterVariable",
          "Aptos",
          "Calibri",
          "system-ui",
          "Arial",
          "Helvetica",
          "sans-serif"
        ]
      },
      // Type scale lifted from the NICE design system's published modular
      // scale, with its line heights. Adopted rather than invented because a
      // scale someone else has already run against clinical content is worth
      // more than one that looks nice in a mockup — and because Tailwind's
      // default ramp has no step between text-2xl and text-3xl, which is the
      // gap a page title needs to live in.
      fontSize: {
        "display-1": ["2.75rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        "display-2": ["2.125rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        "title-1": ["1.75rem", { lineHeight: "1.25", letterSpacing: "-0.015em" }],
        "title-2": ["1.375rem", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        "title-3": ["1.125rem", { lineHeight: "1.4", letterSpacing: "-0.005em" }]
      },
      // The brand palette: Daylight chart — cooler paper, space navy, note blue,
      // check teal. Severity state colors live under `severity` (luminance ladder);
      // brand chrome never encodes Stop/Ready alone.
      //
      // The token KEYS are historical. They kept their names through palette
      // moves so existing `brand-navy` / `brand-blue` / `brand-teal` utilities
      // did not all have to be rewritten. Read them by their role.
      //
      // Values are restated in src/lib/theme/palette.ts (contrast.test.ts).
      // Change one, change both. See color-theory-uiux.md + market-ux panels.
      colors: {
        brand: {
          // GROUND — cooler Daylight paper; white cards still separate.
          cream: "#F3F1EB",
          // INK: headings, the active nav pill, the top stop of .btn-primary.
          navy: "#1E3A5F",
          // INTERACTIVE: links, the bottom stop of .btn-primary, focus.
          blue: "#2B6CB8",
          // QUIET CHROME + Copy/complete: WCAG-safe check teal (mark badge
          // may still use the brighter decorative #5FB3A8).
          teal: "#0F766E",
          // The one surviving warm accent — the queue-clear starburst.
          gold: "#F2CE4B"
          // coral: retired from tokens; lives only in the brand mark orbit.
        },
        // Audit severity / clear — third channel beside shape + word.
        severity: {
          stop: {
            DEFAULT: "#9B1C1C",
            soft: "#FEF2F2",
            ink: "#7F1D1D",
            rail: "#B91C1C",
            on: "#FFFFFF"
          },
          required: {
            DEFAULT: "#C2410C",
            soft: "#FFF7ED",
            ink: "#9A3412",
            rail: "#EA580C",
            on: "#FFFFFF"
          },
          review: {
            DEFAULT: "#D97706",
            soft: "#FFFBEB",
            ink: "#1C1917",
            rail: "#D97706",
            on: "#1C1917"
          },
          style: {
            DEFAULT: "#6D28D9",
            soft: "#F5F3FF",
            ink: "#5B21B6",
            rail: "#7C3AED",
            on: "#FFFFFF"
          },
          info: {
            DEFAULT: "#475569",
            soft: "#F8FAFC",
            ink: "#334155",
            rail: "#64748B",
            on: "#FFFFFF"
          },
          clear: {
            DEFAULT: "#047857",
            soft: "#ECFDF5",
            ink: "#065F46",
            rail: "#059669",
            on: "#FFFFFF"
          }
        },
        // Cool blue-gray operatory neutrals (not purple-tinted).
        slate: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#5B6578",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
