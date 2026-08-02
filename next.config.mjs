/** @type {import('next').NextConfig} */
const nextConfig = {
  // PGlite ships a WASM bundle whose loader resolves data files via import.meta
  // URLs; webpack bundling breaks that. Keep the DB drivers external so they
  // load from node_modules at runtime.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  outputFileTracingIncludes: {
    "/reference/**": ["./skill/**"]
  }
};

export default nextConfig;
