import { defineConfig } from "vitest/config";
import path from "node:path";
const SCRATCH = "/tmp/claude-0/-home-user-dental/b447cc9b-2783-5698-a628-3667214cef73/scratchpad";
export default defineConfig({
  test: { environment: "node", include: [SCRATCH + "/*.repro.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } }
});
