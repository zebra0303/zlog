import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(({ mode }) => {
  // 루트(..)의 .env 파일에서 PORT 환경변수 로드
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");
  const apiPort = env.PORT || "3000";
  const apiTarget = `http://localhost:${apiPort}`;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        external: ["mermaid"],
        // Chunk splitting optimization for performance
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom", "react-router"],
            "ui-vendor": [
              "lucide-react",
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-tabs",
            ],
            "markdown-vendor": [
              "remark-parse",
              "remark-rehype",
              "rehype-stringify",
              "rehype-raw",
              "rehype-sanitize",
            ],
            "emoji-vendor": ["emoji-picker-react"],
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/uploads": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/rss.xml": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/site.webmanifest": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/category": {
          target: apiTarget,
          changeOrigin: true,
          // /category/:slug/rss.xml만 프록시
          bypass(req) {
            if (req.url?.endsWith("/rss.xml")) return undefined;
            return req.url;
          },
        },
      },
    },
  };
});
