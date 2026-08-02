import type { Config } from "drizzle-kit";

export default {
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle"
} satisfies Config;
