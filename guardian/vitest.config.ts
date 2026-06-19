import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // The verdict engine + its 11 calibration tests now live in the shared
    // package. Guardian still runs them so its test contract stays green.
    include: ["lib/**/*.test.ts", "../packages/engine/*.test.ts"],
  },
});
