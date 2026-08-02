/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/reference/**": ["./skill/**"]
  }
};

export default nextConfig;
