import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    setupFiles: ["src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/__tests__/**", "src/vite-env.d.ts"],
      reporter: ["text-summary", "html"],
      reportsDirectory: "./coverage",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@zlog/shared": path.resolve(__dirname, "../shared/types/index.ts"),
      // Deduplicate React and Zustand to avoid dual-instance issues with zCommon
      react: path.resolve(__dirname, "../node_modules/react"),
      "react-dom": path.resolve(__dirname, "../node_modules/react-dom"),
      zustand: path.resolve(__dirname, "../node_modules/zustand"),
    },
  },
});
