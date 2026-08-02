// Regenerates src/lib/vocab/lexicon-generated.ts from the skill documents so
// every word the office's own templates and references use is a known word
// for the spelling audit. Run after editing skill/ content:
//   node scripts/build-lexicon.mjs
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const sources = [
  path.join(root, "skill/SKILL.md"),
  path.join(root, "skill/assets/dental-note-templates.md"),
  ...readdirSync(path.join(root, "skill/references"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(root, "skill/references", f))
];

const words = new Set();
for (const file of sources) {
  const text = readFileSync(file, "utf8");
  for (const m of text.toLowerCase().matchAll(/[a-z]{3,}/g)) words.add(m[0]);
}

const sorted = [...words].sort();
const lines = [];
for (let i = 0; i < sorted.length; i += 12) {
  lines.push(sorted.slice(i, i + 12).join(" "));
}

const out = `// GENERATED FILE — do not edit by hand.
// Rebuilt from skill/ markdown by scripts/build-lexicon.mjs.

const WORDS = \`
${lines.join("\n")}
\`;

export const GENERATED_LEXICON: ReadonlySet<string> = new Set(
  WORDS.split(/\\s+/).filter(Boolean)
);
`;

writeFileSync(path.join(root, "src/lib/vocab/lexicon-generated.ts"), out);
console.log(`lexicon-generated.ts: ${sorted.length} words from ${sources.length} files`);
