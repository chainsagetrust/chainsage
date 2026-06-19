import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  // `chainsage` is imported type-only (erased at runtime); alias it to the SDK's
  // source types so there is exactly ONE definition of Address/Intent/Verdict.
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
