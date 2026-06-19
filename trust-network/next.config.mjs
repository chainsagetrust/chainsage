/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The reputation engine ships raw TypeScript source (no build step); transpile
  // it. The Address/Verdict types come from `chainsage` via type-only imports
  // that SWC strips before bundling, so they never need resolving here.
  transpilePackages: ["@chainsage/trust-network"],
};

export default nextConfig;
