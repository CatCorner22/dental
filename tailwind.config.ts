import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Office typography standard: Aptos / Calibri / Arial, in that order,
      // with safe fallbacks. Base size is set in globals.css (12 pt).
      fontFamily: {
        sans: ["Aptos", "Calibri", "Arial", "Helvetica", "sans-serif"]
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
