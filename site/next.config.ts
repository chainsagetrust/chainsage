import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The shared verdict engine ships TypeScript source; let Next transpile it.
  // Used by Guardian (the /app route) via the lib/chain + lib/risk re-export shims.
  transpilePackages: [
    "@chainsage/engine",
    "@chainsage/policy-engine",
    "@chainsage/trust-network",
  ],
  turbopack: {
    // @chainsage/engine is symlinked in from ../packages/engine, which lives
    // OUTSIDE this app directory. Next 16 builds with Turbopack by default, and
    // Turbopack only transpiles workspace source — so it was treating the
    // engine's raw .ts as an opaque module with "no exports". Pointing the
    // workspace root at the monorepo root pulls packages/engine in-workspace so
    // its TypeScript is transpiled (parity with what Next 14/webpack did for
    // the standalone Guardian app).
    root: path.join(process.cwd(), ".."),
  },
};

export default nextConfig;
