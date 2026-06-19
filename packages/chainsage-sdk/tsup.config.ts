import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/mcp.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  target: "es2020",
  // Inline the shared verdict engine (it ships .ts) so the published package is
  // self-contained. Keep viem external — it's a peer dependency.
  noExternal: ["@chainsage/engine"],
  external: ["viem"],
});
