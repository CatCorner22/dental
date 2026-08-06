import { afterEach } from "vitest";

// Shared test setup. Runs for EVERY test file, including the node-environment
// library tests, so everything here has to be safe without a DOM.

afterEach(async () => {
  // Unmount anything a component test rendered. Without this, each test's tree
  // stays in the document and the next `getByRole` sees both — which shows up
  // as a "found multiple elements" failure in a test that did nothing wrong.
  //
  // Imported lazily and only when a document exists: the library tests run in
  // the node environment, where @testing-library/react has nothing to clean up
  // and importing it at module scope would cost every one of them the load.
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});
