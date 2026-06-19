import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  // `chainsage` is imported type-only (erased at runtime), but we alias it to the
  // SDK's source types so there is exactly ONE definition of `Intent` — the
  // engine reuses the SDK's, never a parallel copy.
  resolve: {
    alias: {
      chainsage: resolve(__dirname, "../chainsage-sdk/src/types.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["*.test.ts"],
  },
});
