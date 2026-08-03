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
          cream: "#FBF7EF",
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
