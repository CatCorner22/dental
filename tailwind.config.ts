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
      // The atomic-age brand palette (docs/brand.md). Retro-future is an
      // ACCENT here, never a costume: severity colors (red/orange/amber/
      // green) are untouched, clinical surfaces stay calm, and these tokens
      // carry the warmth — cream ground, space-navy ink, orbit coral,
      // starburst gold, check teal.
      colors: {
        brand: {
          // Deepened from #FBF7EF. A white card on the old value had roughly a 2%
          // luminance gap from the page and a design review called the result
          // "aggressively flat" — correctly. Darkening the GROUND rather than
          // tinting the cards keeps every card white, which is what keeps the text
          // on it maximally readable, and buys the separation from the page.
          cream: "#F4EEE4",
          navy: "#1E3A5F",
          blue: "#2B6CB8",
          teal: "#5FB3A8",
          coral: "#F26D6D",
          gold: "#F2CE4B"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
