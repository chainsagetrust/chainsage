/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Both shared packages ship raw TypeScript source (no build step); let Next
  // transpile them. The Intent type comes from `chainsage` via a type-only
  // import that SWC strips before bundling, so it never needs resolving here.
  transpilePackages: ["@chainsage/engine", "@chainsage/policy-engine"],
};

export default nextConfig;
