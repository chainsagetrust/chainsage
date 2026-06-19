/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The shared verdict engine ships TypeScript source; let Next transpile it.
  transpilePackages: ["@chainsage/engine"],
};

export default nextConfig;
