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
      // The brand palette: light purple ground, purple ink, purple interactive.
      // Colour is used for CHROME — headings, rails, the shell — and NEVER for
      // state: severity (red/orange/amber/green) is untouched and lives in
      // src/lib/audit/types.ts.
      //
      // The token KEYS are historical. They kept their names through the move
      // off the old atomic-age set so that ~86 existing `brand-navy` /
      // `brand-blue` / `brand-teal` utilities did not all have to be rewritten
      // in the same commit that changed the colours. Read them by their role,
      // which is what the comments below give.
      //
      // The values are restated as data in src/lib/theme/palette.ts, where
      // contrast.test.ts asserts the ratios. Change one, change both.
      colors: {
        brand: {
          // GROUND. Deliberately not lighter: the previous value was deepened
          // from #FBF7EF because a white card on it had roughly a 2% luminance
          // gap from the page and a design review called the result
          // "aggressively flat" — correctly. Darkening the GROUND rather than
          // tinting the cards keeps every card white, which is what keeps the
          // text on it maximally readable, and buys the separation from the
          // page. A paler lilac here reintroduces exactly that bug.
          cream: "#EDE9F6",
          // INK: headings, the active nav pill, the top stop of .btn-primary.
          navy: "#3B2B66",
          // INTERACTIVE: links, the bottom stop of .btn-primary, focus.
          blue: "#6D4AC4",
          // QUIET CHROME: the .eyebrow, the .card-note rail. Carries no
          // severity, which is exactly why it is safe on an informational rail.
          teal: "#5B4A8F",
          // The one surviving warm accent — the queue-clear starburst.
          gold: "#F2CE4B"
          // coral: retired. It had zero uses in src/.
        },
        // The neutral ramp, tinted purple rather than blue. Overriding Tailwind's
        // own `slate` repaints roughly 676 utilities across the app without
        // editing a single component — and keeps the CLASS NAMES intact, which
        // matters more than it looks: the high-contrast rules in globals.css
        // select on `.text-slate-500` and `.border-slate-200` literally, so
        // renaming the utility would silently switch high-contrast mode off for
        // the people who need it most.
        slate: {
          50: "#F8F7FB",
          100: "#F1EFF6",
          200: "#E4E1EC",
          300: "#CFCADB",
          400: "#9C93B3",
          500: "#6E6685",
          600: "#565070",
          700: "#433E58",
          800: "#322E44",
          900: "#23202F"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
