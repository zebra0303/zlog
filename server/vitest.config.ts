import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    setupFiles: ["src/__tests__/setup.ts"],
    testTimeout: 10000,
    env: {
      ALLOW_LOCAL_FEDERATION: "false",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/db/migrations/**"],
      reporter: ["text-summary", "html"],
      reportsDirectory: "./coverage",
    },
  },
  resolve: {
    alias: {
      "@zlog/shared": path.resolve(__dirname, "../shared/types/index.ts"),
    },
  },
});
