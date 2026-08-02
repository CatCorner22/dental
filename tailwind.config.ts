import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Office typography standard: Aptos / Calibri / Arial, in that order,
      // with safe fallbacks. Base size is set in globals.css (12 pt).
      fontFamily: {
        sans: ["Aptos", "Calibri", "Arial", "Helvetica", "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;
