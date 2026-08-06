import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Next sets `"jsx": "preserve"` in tsconfig, which leaves JSX for the Next
  // compiler and is not something esbuild can execute. Telling esbuild to use
  // the automatic runtime is what makes a .tsx test file runnable without
  // adding a React plugin — and without touching the tsconfig the app builds
  // with, which would be changing production compilation to serve the tests.
  esbuild: { jsx: "automatic" },
  test: {
    // node stays the DEFAULT. The ~145 library test files are pure functions
    // over strings and objects, and standing up a DOM for every one of them
    // would cost seconds per run for nothing. Component tests opt in per file
    // with
    //
    //   // @vitest-environment jsdom
    //
    // on the first line. Chosen over environmentMatchGlobs (deprecated in
    // Vitest 3) and over a two-project split (two configs to keep in step)
    // because this way the requirement is stated in the file that has it.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test/setup.ts"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  }
});
